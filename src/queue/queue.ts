import { logger } from '../config/logger';

// Simple FIFO queue for async tasks (one at a time)
export class PromptQueue {
    private queue: Array<() => Promise<void>> = [];
    private running = false;

    addTask(task: () => Promise<void>): number {
        this.queue.push(task);
        const position = this.queue.length;
        logger.debug(`Task added to queue at position ${position}`);
        this.processQueue();
        return position;
    }

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
            // Optionally log error
        } finally {
            this.queue.shift();
            this.running = false;
            if (this.queue.length === 0) {
                logger.info('Queue is empty, all tasks processed');
            }
            this.processQueue();
        }
    }
} 