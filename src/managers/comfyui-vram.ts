import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ErrorDetails } from '../types/errors';
import { SystemError } from '../types/errors';

const execFileAsync = promisify(execFile);
/** Per-probe budget so a wedged GPU management tool can't stall a generation. */
const PROBE_TIMEOUT_MS = 5000;

/** (total, free) GiB of the host's first GPU device. */
export interface GpuMemory {
    totalGiB: number;
    freeGiB: number;
}

/**
 * A generation refused because the GPU did not have enough free memory for a
 * job worth running. Carried as a dedicated class (rather than a marker on
 * `SystemError`) so the failure classifier can recognize it by type, and so
 * tests can assert on the type directly.
 *
 * Retrying is worthwhile *in principle* — the process occupying the GPU may
 * release memory — but only after the normal backoff has elapsed.
 */
export class InsufficientVRAMError extends SystemError {
    constructor(message: string, details?: ErrorDetails) {
        super(message, details);
    }
}

/**
 * Reads free/total GPU memory from the host's GPU tooling (best effort).
 *
 * AMD/ROCm hosts expose exact byte counters via `rocm-smi --showmeminfo vram`;
 * NVIDIA hosts expose them via `nvidia-smi --query-gpu memory.total,memory.free`.
 * Each probe is bounded by a timeout and a plausible-reading check, and the
 * first one that succeeds wins. On a machine with neither tool (or with a GPU
 * none of them can see) the probe returns `null`, which the caller treats as
 * "unknown" and skips the headroom gate rather than blocking every
 * generation.
 *
 * This is pre-flight instrumentation for one bot on a LAN, not a source of
 * truth — exactness is not required, only a defensible yes/no answer to
 * "is the GPU busy?".
 */
export class VramProbe {
    public static async readGpuMemory(): Promise<GpuMemory | null> {
        const amd = await VramProbe.withTimeout(VramProbe.readAmd());
        if (amd) {
            return amd;
        }
        const nvidia = await VramProbe.withTimeout(VramProbe.readNvidia().then((result) => (result ? result : null)));
        return nvidia ?? null;
    }

    private static async readAmd(): Promise<GpuMemory | null> {
        let stdout: string;
        try {
            ({ stdout } = await VramProbe.exec('rocm-smi', ['--showmeminfo', 'vram']));
        } catch {
            // Not a ROCm host, or the tool failed — no reading.
            return null;
        }
        const total = VramProbe.byteField(stdout, /VRAM Total Memory \(B\):\s*(\d+)/);
        const used = VramProbe.byteField(stdout, /VRAM Total Used Memory \(B\):\s*(\d+)/);
        if (total === null || used === null) {
            return null;
        }
        return {
            totalGiB: total / 1024 ** 3,
            freeGiB: Math.max(0, (total - used) / 1024 ** 3),
        };
    }

    private static async readNvidia(): Promise<GpuMemory | null> {
        let stdout: string;
        try {
            ({ stdout } = await VramProbe.exec('nvidia-smi', [
                '--query-gpu=memory.total,memory.free',
                '--format=csv,noheader,nounits',
                '--id=0',
            ]));
        } catch {
            // Not an NVIDIA host, or the tool failed — no reading.
            return null;
        }
        const line = stdout
            .split('\n')
            .map((l) => l.trim())
            .find(Boolean);
        if (!line) {
            return null;
        }
        // nvidia-smi reports MiB here (nounits).
        const parts = line.split(',').map((part) => Number(part.trim()));
        const [total, free] = parts;
        if (!Number.isFinite(total) || !Number.isFinite(free) || total <= 0) {
            return null;
        }
        return { totalGiB: total / 1024, freeGiB: free / 1024 };
    }

    private static exec(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
        // `util.promisify` resolves with the promisified function's return
        // shape, so the probe and every test that mocks this surface agree on
        // a concrete `{stdout, stderr}` object rather than relying on which
        // promisifying wrapper happens to be in play.
        return execFileAsync(command, args, { timeout: PROBE_TIMEOUT_MS, windowsHide: true });
    }

    private static withTimeout<T>(promise: Promise<T>): Promise<T> {
        let timer: NodeJS.Timeout | undefined;
        return Promise.race([
            promise,
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error(`VRAM probe timed out after ${PROBE_TIMEOUT_MS}ms`)),
                    PROBE_TIMEOUT_MS,
                );
            }),
        ]).finally(() => {
            if (timer) {
                clearTimeout(timer);
            }
        });
    }

    private static byteField(text: string, pattern: RegExp): number | null {
        const match = text.match(pattern);
        const value = match?.[1] !== undefined ? Number(match[1]) : NaN;
        return Number.isFinite(value) && value > 0 ? value : null;
    }
}
