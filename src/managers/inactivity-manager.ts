import { logger } from '../config/logger';
import { getGpuMemoryInfo, formatMemoryInfo } from '../utils/gpu-utils';
import { ImageGenerator } from '../image-generation/image-generator';
import { PromptQueue } from '../queue/queue';

/**
 * Manages bot inactivity by monitoring the prompt queue and 
 * automatically unloading models from VRAM after a period of idleness.
 */
export class InactivityManager {
    private inactivityTimer: NodeJS.Timeout | null = null;
    private readonly inactivityDelay = 10 * 60 * 1000; // 10 minutes

    /**
     * Initializes the manager and sets up the idle listener on the queue.
     * @param queue The prompt queue to monitor for activity.
     */
    constructor(private queue: PromptQueue) {
        this.queue.onIdle = () => this.resetInactivityTimer();
    }

    /**
     * Starts or resets the inactivity timer.
     * When the timer expires, it checks if the queue is still idle and unloads models if so.
     */
    private resetInactivityTimer() {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
        }
        this.inactivityTimer = setTimeout(async () => {
            if (this.queue.isIdle()) {
                const beforeMem = await getGpuMemoryInfo();
                const memStr = beforeMem ? ` (VRAM: ${formatMemoryInfo(beforeMem)})` : "";

                logger.info(`No requests for 10 minutes. Clearing VRAM cache${memStr}.`);

                try {
                    await ImageGenerator.unloadModels();

                    if (beforeMem) {
                        const afterMem = await getGpuMemoryInfo();
                        if (afterMem) {
                            logger.info(`VRAM cleared. Change: ${beforeMem.used}MB -> ${afterMem.used}MB`);
                        }
                    }
                } catch (error) {
                    logger.error("Error unloading models during inactivity:", error);
                }
            }
        }, this.inactivityDelay);
    }

    /**
     * Stops the inactivity timer completely.
     */
    public stop() {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
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
