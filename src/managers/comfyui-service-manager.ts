import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../config/logger';
import { COMFYUI_CONFIG, COMFYUI_SERVICE_CONFIG } from '../config/constants';
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
     * Probes first: if the server is already up, this is a no-op.
     * @returns True if this call started the service, false if it was already running.
     * @throws SystemError if the service fails to start or never becomes ready.
     */
    public async ensureRunning(): Promise<boolean> {
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
        logger.error(`ComfyUI did not become ready within ${COMFYUI_SERVICE_CONFIG.START_TIMEOUT_SECONDS}s. Stopping the service to stop any crash loop.`);
        try {
            await this.stopService();
        } catch (error) {
            logger.error('Failed to stop ComfyUI service after startup timeout:', error);
        }
        throw new SystemError(`ComfyUI startup timed out after ${COMFYUI_SERVICE_CONFIG.START_TIMEOUT_SECONDS}s (service stopped). Check the service logs: journalctl --user -u ${COMFYUI_SERVICE_CONFIG.UNIT_NAME}`);
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
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
