import { logger } from '../config/logger';

// Simple FIFO queue for async tasks (one at a time)
/**
 * A simple asynchronous FIFO queue that ensures only one task runs at a time.
 * Useful for serializing access to GPU resources.
 */
export class PromptQueue {
    private queue: Array<() => Promise<void>> = [];
    private running = false;
    /** Callback triggered when the queue becomes completely empty. */
    public onIdle?: () => void;

    /**
     * Adds a new asynchronous task to the queue.
     * @param task The function to be executed.
     * @returns The position (1-indexed) of the task in the queue.
     */
    addTask(task: () => Promise<void>): number {
        this.queue.push(task);
        const position = this.queue.length;
        logger.debug(`Task added to queue at position ${position}`);
        this.processQueue();
        return position;
    }

    /**
     * Internal method to execute the next task in the queue.
     */
    private async processQueue() {
        if (this.running || this.queue.length === 0) return;
        this.running = true;
        const task = this.queue[0];
        logger.debug('Starting to process task from queue');
        try {
            await task();
            logger.debug('Task completed successfully');
        } catch (e) {
            logger.error("Error processing task:", e);
        } finally {
            this.queue.shift();
            this.running = false;
            if (this.queue.length === 0) {
                logger.info('Queue is empty, all tasks processed');
                if (this.onIdle) {
                    this.onIdle();
                }
            }
            this.processQueue();
        }
    }

    /**
     * Gets the number of tasks currently in the queue.
     */
    get length(): number {
        return this.queue.length;
    }

    /**
     * Checks if a task is currently being executed.
     */
    isProcessing(): boolean {
        return this.running;
    }

    /**
     * Checks if the queue is both not processing any tasks and has no pending tasks.
     * @returns True if the queue is idle.
     */
    isIdle(): boolean {
        return !this.running && this.queue.length === 0;
    }
}
