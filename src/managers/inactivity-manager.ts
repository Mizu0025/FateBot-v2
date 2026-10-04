import { COMFYUI_SERVICE_CONFIG } from '../config/constants';
import { logger } from '../config/logger';
import type { QueueMonitor } from '../queue/queue';
import type { ComfyUiServiceManager } from './comfyui-service-manager';

/**
 * Monitors the prompt queue and stops the ComfyUI service after a period of
 * idle time, freeing GPU memory for everything else on the machine.
 */
export class InactivityManager {
    private inactivityTimer: NodeJS.Timeout | null = null;

    /**
     * Initializes the manager and sets up the idle listener on the queue.
     * @param queue The prompt queue to monitor for activity.
     * @param service The ComfyUI service manager to stop after idle periods.
     */
    constructor(
        private queue: QueueMonitor,
        private service: ComfyUiServiceManager,
    ) {
        this.queue.onIdle = () => this.resetInactivityTimer();
    }

    /**
     * Starts or resets the inactivity timer.
     * When the timer expires, it checks if the queue is still idle and stops
     * the ComfyUI service if so.
     */
    private resetInactivityTimer() {
        this.clearTimer();
        const idleMinutes = COMFYUI_SERVICE_CONFIG.IDLE_MINUTES;
        this.inactivityTimer = setTimeout(
            async () => {
                if (!this.queue.isIdle()) {
                    return;
                }

                logger.info(`No requests for ${idleMinutes} minutes. Stopping ComfyUI to free VRAM.`);

                try {
                    await this.service.stop();
                    logger.info('ComfyUI service stopped.');
                } catch (error) {
                    logger.error('Error stopping ComfyUI during inactivity:', error);
                }
            },
            idleMinutes * 60 * 1000,
        );
    }

    /**
     * Stops the inactivity timer completely (e.g. during shutdown).
     */
    public stop() {
        this.clearTimer();
    }

    /**
     * Clears the current timer, usually called when new activity is detected.
     */
    public clearTimer() {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
    }
}
