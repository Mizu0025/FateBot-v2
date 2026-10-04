import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { COMFYUI_CONFIG, COMFYUI_SERVICE_CONFIG } from '../config/constants';
import { logger } from '../config/logger';
import { SystemError } from '../types/errors';

const execFileAsync = promisify(execFile);
/** How long a single readiness probe may take before being treated as "down". */
const PROBE_TIMEOUT_MS = 3000;

/**
 * Bridges between the bot and ComfyUI's user systemd service.
 *
 * ComfyUI is started on demand (when a queued job needs it) and stopped
 * after a period of idle time, so that it is never holding GPU memory
 * while the bot has nothing to do.
 */
export class ComfyUiServiceManager {
    /**
     * In-flight `ensureRunning()` promise. All concurrent invocations share
     * the same underlying start+poll pass, so the service is never started
     * (or torn down) twice for the same readiness window. The mutex is nulled
     * as soon as the shared promise settles — by any outcome (success or
     * throw) — so the next call can start fresh.
     *
     * This is the fix for P0-2: before this, two concurrent callers could
     * both time out and one could `stopService()` the very service the other
     * was mid-generation on.
     */
    private ensureMutex: Promise<boolean> | null = null;
    /**
     * Base URL of the ComfyUI HTTP/WS server, e.g. `http://localhost:8188`.
     */
    private baseUrl(): string {
        return `http://${COMFYUI_CONFIG.ADDRESS}:${COMFYUI_CONFIG.PORT}`;
    }

    /**
     * Probes ComfyUI's `/system_stats` endpoint to determine whether the
     * server is up and accepting requests.
     * @returns True if the server answered with an HTTP 2xx response.
     */
    public async isRunning(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl()}/system_stats`, {
                signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
            });
            return response.ok;
        } catch {
            // Connection refused, timeout, or server down — treat as not running.
            return false;
        }
    }

    /**
     * Ensures the ComfyUI service is started and ready to accept prompts.
     * Concurrent callers share the same underlying start+poll pass (P0-2) —
     * they all resolve with the same `started` boolean and the service is
     * only started once.
     * @returns True if the service was started by this (or a peer) call, false
     *         if it was already running before any of them began.
     * @throws SystemError if the service fails to start or never becomes ready.
     */
    public ensureRunning(): Promise<boolean> {
        if (!this.ensureMutex) {
            this.ensureMutex = this.doEnsureRunning().finally(() => {
                this.ensureMutex = null;
            });
        }
        return this.ensureMutex;
    }

    /**
     * The actual start+poll work, run at most once per shared window.
     * Probes first: if the server is already up this is a no-op returning
     * `false`. Otherwise starts the unit and polls until it reports ready or
     * the deadline elapses; on timeout the service is stopped so its
     * `Restart=on-failure` policy can't crash-loop.
     */
    private async doEnsureRunning(): Promise<boolean> {
        if (!COMFYUI_CONFIG.ADDRESS) {
            throw new SystemError('ComfyUI server address not configured.');
        }

        if (await this.isRunning()) {
            return false;
        }

        logger.info(`ComfyUI is not running. Starting user service '${COMFYUI_SERVICE_CONFIG.UNIT_NAME}'...`);
        await this.startService();

        const timeoutMs = COMFYUI_SERVICE_CONFIG.START_TIMEOUT_SECONDS * 1000;
        const deadline = Date.now() + timeoutMs;

        while (Date.now() < deadline) {
            await this.wait(COMFYUI_SERVICE_CONFIG.START_POLL_INTERVAL_MS);
            if (await this.isRunning()) {
                logger.info(`ComfyUI is up and ready (started from ${COMFYUI_SERVICE_CONFIG.UNIT_NAME}).`);
                return true;
            }
        }

        // The service never became ready. Stop it so `Restart=on-failure` can't
        // keep crash-looping and burning resources — the next request starts it fresh.
        logger.error(
            `ComfyUI did not become ready within ${COMFYUI_SERVICE_CONFIG.START_TIMEOUT_SECONDS}s. Stopping the service to stop any crash loop.`,
        );
        try {
            await this.stopService();
        } catch (error) {
            logger.error('Failed to stop ComfyUI service after startup timeout:', error);
        }
        throw new SystemError(
            `ComfyUI startup timed out after ${COMFYUI_SERVICE_CONFIG.START_TIMEOUT_SECONDS}s (service stopped). Check the service logs: journalctl --user -u ${COMFYUI_SERVICE_CONFIG.UNIT_NAME}`,
        );
    }

    /**
     * Stops the ComfyUI user service, freeing all GPU memory.
     * Stopping an already-stopped unit is a harmless no-op at the systemd level,
     * but this method still throws if `systemctl` itself fails (e.g. user session gone).
     */
    public async stop(): Promise<void> {
        logger.info(`Stopping ComfyUI service '${COMFYUI_SERVICE_CONFIG.UNIT_NAME}' to free VRAM.`);
        await this.stopService();
    }

    /**
     * Requests `systemctl --user start <unit>`.
     * @throws SystemError carrying the systemctl stderr when it fails.
     */
    private async startService(): Promise<void> {
        try {
            await execFileAsync('systemctl', ['--user', 'start', COMFYUI_SERVICE_CONFIG.UNIT_NAME]);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`systemctl start failed for ${COMFYUI_SERVICE_CONFIG.UNIT_NAME}:`, error);
            throw new SystemError(`Failed to start ComfyUI service '${COMFYUI_SERVICE_CONFIG.UNIT_NAME}': ${message}`);
        }
    }

    /**
     * Requests `systemctl --user stop <unit>`.
     * @throws SystemError carrying the systemctl stderr when it fails.
     */
    private async stopService(): Promise<void> {
        try {
            await execFileAsync('systemctl', ['--user', 'stop', COMFYUI_SERVICE_CONFIG.UNIT_NAME]);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`systemctl stop failed for ${COMFYUI_SERVICE_CONFIG.UNIT_NAME}:`, error);
            throw new SystemError(`Failed to stop ComfyUI service '${COMFYUI_SERVICE_CONFIG.UNIT_NAME}': ${message}`);
        }
    }

    private wait(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
