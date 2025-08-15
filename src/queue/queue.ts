// Simple FIFO queue for async tasks (one at a time)
export class PromptQueue {
    private queue: Array<() => Promise<void>> = [];
    private running = false;

    addTask(task: () => Promise<void>): number {
        this.queue.push(task);
        this.processQueue();
        return this.queue.length;
    }

    private async processQueue() {
        if (this.running || this.queue.length === 0) return;
        this.running = true;
        const task = this.queue.shift();
        if (task) {
            try {
                await task();
            } catch (e) {
                console.error("Error processing task:", e);
                // Optionally log error
            }
        }
        this.running = false;
        if (this.queue.length > 0) {
            this.processQueue();
        }
    }
} 