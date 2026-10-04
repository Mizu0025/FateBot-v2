import { execFile } from 'node:child_process';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { COMFYUI_CONFIG, COMFYUI_SERVICE_CONFIG } from '../config/constants';
import { SystemError } from '../types/errors';
import { ComfyUiServiceManager } from './comfyui-service-manager';

vi.mock('../config/logger');
// Explicit factory: Vitest's bare vi.mock('child_process') auto-mock does not
// route the test's mockImplementation to the source's promisify(execFile)
// binding. A vi.fn from a factory is what util.promisify forwards to reliably.
vi.mock('child_process', () => ({ execFile: vi.fn() }));

const execFileMock = execFile as unknown as Mock;

describe('ComfyUiServiceManager', () => {
    let manager: ComfyUiServiceManager;
    let mockFetch: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        COMFYUI_CONFIG.ADDRESS = 'localhost';
        COMFYUI_CONFIG.PORT = 8188;
        COMFYUI_SERVICE_CONFIG.UNIT_NAME = 'comfyui';
        COMFYUI_SERVICE_CONFIG.START_TIMEOUT_SECONDS = 120;
        COMFYUI_SERVICE_CONFIG.START_POLL_INTERVAL_MS = 1;

        manager = new ComfyUiServiceManager();
        mockFetch = vi.fn();
        global.fetch = mockFetch as unknown as typeof fetch;

        // Default: systemctl commands succeed.
        execFileMock.mockImplementation((_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
            cb(null);
        });
    });

    describe('isRunning', () => {
        it('should return true when the server answers with a 2xx response', async () => {
            mockFetch.mockResolvedValue({ ok: true });

            expect(await manager.isRunning()).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith('http://localhost:8188/system_stats', expect.anything());
        });

        it('should return false when the server responds non-2xx', async () => {
            mockFetch.mockResolvedValue({ ok: false, status: 503 });

            expect(await manager.isRunning()).toBe(false);
        });

        it('should return false when the server cannot be reached', async () => {
            mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

            expect(await manager.isRunning()).toBe(false);
        });
    });

    describe('ensureRunning', () => {
        it('should be a no-op when ComfyUI is already running', async () => {
            mockFetch.mockResolvedValue({ ok: true });

            const started = await manager.ensureRunning();

            expect(started).toBe(false);
            expect(execFileMock).not.toHaveBeenCalled();
        });

        it('should start the service and wait until it is ready', async () => {
            // First probe fails (not running), then the service comes up.
            mockFetch.mockResolvedValueOnce({ ok: false }).mockResolvedValue({ ok: true });

            const started = await manager.ensureRunning();

            expect(started).toBe(true);
            expect(execFileMock).toHaveBeenCalledWith(
                'systemctl',
                ['--user', 'start', 'comfyui'],
                expect.any(Function),
            );
        });

        it('should throw when the address is not configured', async () => {
            COMFYUI_CONFIG.ADDRESS = '';

            await expect(manager.ensureRunning()).rejects.toThrow(
                new SystemError('ComfyUI server address not configured.'),
            );
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should throw when systemctl fails to start the service', async () => {
            mockFetch.mockResolvedValue({ ok: false });
            execFileMock.mockImplementation((_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
                cb(new Error('Unit comfyui.service not found.'));
            });

            await expect(manager.ensureRunning()).rejects.toThrow(
                new SystemError("Failed to start ComfyUI service 'comfyui': Unit comfyui.service not found."),
            );
        });

        it('should stop the service and throw when it never becomes ready', async () => {
            COMFYUI_SERVICE_CONFIG.START_TIMEOUT_SECONDS = 0; // fail the readiness deadline immediately
            mockFetch.mockResolvedValue({ ok: false });

            await expect(manager.ensureRunning()).rejects.toThrow(
                expect.objectContaining({
                    name: 'SystemError',
                    message: expect.stringContaining('ComfyUI startup timed out'),
                }),
            );
            // The service must be torn down to prevent a crash loop.
            expect(execFileMock).toHaveBeenCalledWith('systemctl', ['--user', 'stop', 'comfyui'], expect.any(Function));
        });

        it('should still throw a startup timeout when the follow-up stop fails', async () => {
            COMFYUI_SERVICE_CONFIG.START_TIMEOUT_SECONDS = 0;
            mockFetch.mockResolvedValue({ ok: false });
            execFileMock.mockImplementation((_cmd: string, args: string[], cb: (err: Error | null) => void) => {
                if (args.includes('stop')) {
                    cb(new Error('session gone'));
                } else {
                    cb(null);
                }
            });

            // The stop failure is logged, not propagated — the startup timeout is the error.
            await expect(manager.ensureRunning()).rejects.toThrow(
                expect.objectContaining({ message: expect.stringContaining('ComfyUI startup timed out') }),
            );
        });

        it('serializes concurrent ensureRunning calls into one start pass (P0-2 mutex)', async () => {
            // Service comes up after a few polls. Two callers should share the
            // same start+poll window: start is issued exactly once, and no one
            // tears down the service the other is about to use.
            COMFYUI_SERVICE_CONFIG.START_TIMEOUT_SECONDS = 60;
            COMFYUI_SERVICE_CONFIG.START_POLL_INTERVAL_MS = 5;
            let probes = 0;
            mockFetch.mockImplementation(async () => {
                probes += 1;
                // First 3 probes (initial check + 2 polls): not up yet.
                if (probes < 4) {
                    return { ok: false };
                }
                return { ok: true };
            });

            const [a, b] = await Promise.all([manager.ensureRunning(), manager.ensureRunning()]);

            const startCalls = execFileMock.mock.calls.filter((c) => (c[1] as string[]).includes('start'));
            const stopCalls = execFileMock.mock.calls.filter((c) => (c[1] as string[]).includes('stop'));

            expect(a).toBe(true);
            expect(b).toBe(true);
            expect(startCalls).toHaveLength(1);
            expect(stopCalls).toHaveLength(0);
        });
    });

    describe('stop', () => {
        it('should stop the user service', async () => {
            await manager.stop();

            expect(execFileMock).toHaveBeenCalledWith('systemctl', ['--user', 'stop', 'comfyui'], expect.any(Function));
        });

        it('should throw a SystemError when systemctl stop fails', async () => {
            execFileMock.mockImplementation((_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
                cb(new Error('user session not found'));
            });

            await expect(manager.stop()).rejects.toThrow(
                new SystemError("Failed to stop ComfyUI service 'comfyui': user session not found"),
            );
        });
    });
});
