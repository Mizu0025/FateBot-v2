import { ComfyUiServiceManager } from './comfyui-service-manager';
import { execFile } from 'child_process';
import { COMFYUI_CONFIG, COMFYUI_SERVICE_CONFIG } from '../config/constants';
import { SystemError } from '../types/errors';

jest.mock('../config/logger');
jest.mock('child_process');

const execFileMock = execFile as unknown as jest.Mock;

describe('ComfyUiServiceManager', () => {
    let manager: ComfyUiServiceManager;
    let mockFetch: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        COMFYUI_CONFIG.ADDRESS = 'localhost';
        COMFYUI_CONFIG.PORT = 8188;
        COMFYUI_SERVICE_CONFIG.UNIT_NAME = 'comfyui';
        COMFYUI_SERVICE_CONFIG.START_TIMEOUT_SECONDS = 120;
        COMFYUI_SERVICE_CONFIG.START_POLL_INTERVAL_MS = 1;

        manager = new ComfyUiServiceManager();
        mockFetch = jest.fn();
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
            mockFetch
                .mockResolvedValueOnce({ ok: false })
                .mockResolvedValue({ ok: true });

            const started = await manager.ensureRunning();

            expect(started).toBe(true);
            expect(execFileMock).toHaveBeenCalledWith(
                'systemctl', ['--user', 'start', 'comfyui'], expect.any(Function)
            );
        });

        it('should throw when the address is not configured', async () => {
            COMFYUI_CONFIG.ADDRESS = '';

            await expect(manager.ensureRunning()).rejects.toThrow(
                new SystemError('ComfyUI server address not configured.')
            );
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should throw when systemctl fails to start the service', async () => {
            mockFetch.mockResolvedValue({ ok: false });
            execFileMock.mockImplementation((_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
                cb(new Error('Unit comfyui.service not found.'));
            });

            await expect(manager.ensureRunning()).rejects.toThrow(
                new SystemError("Failed to start ComfyUI service 'comfyui': Unit comfyui.service not found.")
            );
        });

        it('should stop the service and throw when it never becomes ready', async () => {
            COMFYUI_SERVICE_CONFIG.START_TIMEOUT_SECONDS = 0; // fail the readiness deadline immediately
            mockFetch.mockResolvedValue({ ok: false });

            await expect(manager.ensureRunning()).rejects.toThrow(
                expect.objectContaining({
                    name: 'SystemError',
                    message: expect.stringContaining('ComfyUI startup timed out'),
                })
            );
            // The service must be torn down to prevent a crash loop.
            expect(execFileMock).toHaveBeenCalledWith(
                'systemctl', ['--user', 'stop', 'comfyui'], expect.any(Function)
            );
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
                expect.objectContaining({ message: expect.stringContaining('ComfyUI startup timed out') })
            );
        });
    });

    describe('stop', () => {
        it('should stop the user service', async () => {
            await manager.stop();

            expect(execFileMock).toHaveBeenCalledWith(
                'systemctl', ['--user', 'stop', 'comfyui'], expect.any(Function)
            );
        });

        it('should throw a SystemError when systemctl stop fails', async () => {
            execFileMock.mockImplementation((_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
                cb(new Error('user session not found'));
            });

            await expect(manager.stop()).rejects.toThrow(
                new SystemError("Failed to stop ComfyUI service 'comfyui': user session not found")
            );
        });
    });
});
