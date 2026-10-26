import { execFile } from 'node:child_process';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { SystemError } from '../types/errors';
import { type GpuMemory, InsufficientVRAMError, VramProbe } from './comfyui-vram';

vi.mock('../config/logger');
// Explicit factory: vitest's bare auto-mock does not bind `vi.fn` reliably
// under `util.promisify` (the source captures the imported symbol at module
// scope). A vi.fn from a factory is what promisify forwards to reliably.
// Match the source's `node:child_process` specifier exactly — a different
// specifier (bare `child_process`) resolves to a different module id and the
// mock would not intercept the source's import.
vi.mock('node:child_process', () => ({ execFile: vi.fn() }));

const execFileMock = execFile as unknown as Mock;

// Measured on this box (2026-10-27): 24 GiB GPU with a 17 GiB LLM resident.
// The exact bytes are the real `rocm-smi --showmeminfo vram` output.
const AMD_TOTAL_BYTES = 25_753_026_560; // 24.00 GiB
const AMD_USED_BYTES = 22_309_326_848; // ~20.77 GiB in use
const AMD_OK = [
    `GPU[0]            : VRAM Total Memory (B): ${AMD_TOTAL_BYTES}`,
    `GPU[0]            : VRAM Total Used Memory (B): ${AMD_USED_BYTES}`,
    '',
].join('\n');
// Plausible nvidia-smi CSV row (MiB): total, free.
const NVIDIA_OK = ['24564, 3517', '24564, 3517'].join('\n');

/**
 * Runs `cb(null, {stdout, stderr})` for commands the mock recognises, else
 * ENOENT. Two promisify subtleties make both details load-bearing:
 *
 * - The callback is the *last* argument. `util.promisify` appends its
 *   continuation after any options object the source passes
 *   (`cmd, args, {timeout, windowsHide}, cb`), so reading it from a fixed
 *   3-arg signature would treat the options object as the callback and throw,
 *   which the source swallows into a `null` "unknown" reading.
 * - `promisify` of a real `child_process` function uses node's custom
 *   mapping so the Promise resolves to `{stdout, stderr}` — but a
 *   `vi.fn()` mock has no custom mapping, so the generic path resolves to
 *   the first non-error callback argument *as-is*. Calling `cb(null,
 *   'some-stdout')` would therefore resolve to a bare string and the
 *   source's `({ stdout } = await …)` destructure would yield `undefined`.
 *   Calling `cb(null, { stdout, stderr })` reproduces the observable result
 *   either way.
 */
function mockExecFile(byCommand: Record<string, string> = {}): void {
    execFileMock.mockImplementation((...args: unknown[]) => {
        const cmd = args[0] as string;
        const cb = args[args.length - 1] as (...a: unknown[]) => void;
        // Default: no GPU tooling installed anywhere (a non-GPU host).
        const stdout = byCommand[cmd];
        if (stdout === undefined) {
            cb(new Error(`ENOENT: no such file or directory '${cmd}'`));
            return;
        }
        cb(null, { stdout, stderr: '' });
    });
}

describe('VramProbe.readGpuMemory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reads (total, free) GiB from rocm-smi on a ROCm host', async () => {
        mockExecFile({ 'rocm-smi': AMD_OK });

        const memory = await VramProbe.readGpuMemory();

        expect(memory).not.toBeNull();
        expect((memory as GpuMemory).totalGiB).toBeCloseTo(24, 0);
        // free = (25753026560 - 22309326848) / 2^30 ≈ 3.21 GiB
        expect((memory as GpuMemory).freeGiB).toBeCloseTo(3.2, 1);
        // A successful AMD probe must not also shell out to nvidia-smi.
        expect(execFileMock.mock.calls.some(([cmd]) => (cmd as string) === 'nvidia-smi')).toBe(false);
    });

    it('falls back to nvidia-smi when rocm-smi is unavailable', async () => {
        mockExecFile({ 'nvidia-smi': NVIDIA_OK });

        const memory = await VramProbe.readGpuMemory();

        expect(memory).not.toBeNull();
        // nvidia-smi reports MiB; the probe converts to GiB.
        expect((memory as GpuMemory).totalGiB).toBeCloseTo(24564 / 1024);
        expect((memory as GpuMemory).freeGiB).toBeCloseTo(3517 / 1024);
    });

    it('returns null when neither GPU tool is installed (a non-GPU host)', async () => {
        mockExecFile(); // both commands ENOENT

        const memory = await VramProbe.readGpuMemory();

        expect(memory).toBeNull();
    });

    it('returns null when the AMD tool succeeds but reports no usable counters', async () => {
        // A wedged / uninitialised device: the tool exits 0 but the counters
        // are missing — this must read as "unknown", not "0 bytes free".
        mockExecFile({ 'rocm-smi': 'AMD GPU device(s) is/are in a low-power state' });

        const memory = await VramProbe.readGpuMemory();

        expect(memory).toBeNull();
    });

    it('treats used == total as 0 free, not a negative free count', async () => {
        mockExecFile({
            'rocm-smi': 'VRAM Total Memory (B): 1073741824\nVRAM Total Used Memory (B): 1073741824\n',
        });

        const memory = await VramProbe.readGpuMemory();

        expect(memory).not.toBeNull();
        expect((memory as GpuMemory).freeGiB).toBe(0);
    });
});

describe('InsufficientVRAMError', () => {
    it('is a SystemError subclass so the pipeline treats it as a system failure', () => {
        const error = new InsufficientVRAMError('Not enough GPU memory free', { freeGiB: 0.4, thresholdGiB: 4 });

        expect(error).toBeInstanceOf(SystemError);
        expect(error.details).toEqual({ freeGiB: 0.4, thresholdGiB: 4 });
        expect(error.message).toBe('Not enough GPU memory free');
    });
});
