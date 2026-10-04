import { logger } from '../config/logger';
import type { FilteredPrompt } from '../types';
import { UserError } from '../types/errors';

/**
 * The slice of the prompt queue that idle-state observers depend on.
 * Declared so `InactivityManager` (and its tests) can depend on just this
 * surface instead of the full {@link PromptQueue}.
 */
export interface QueueMonitor {
    /** Callback triggered when the queue becomes completely idle (nothing
     *  pending, nothing in flight). */
    onIdle?: () => void;
    isIdle(): boolean;
}

/** A single queued image generation request, as dropped off by the IRC handler. */
export interface PromptQueueItem {
    /** The parsed and filtered prompt (dimensions, model, count, seed...). */
    prompt: FilteredPrompt;
    /** The IRC nickname the result should be addressed to. */
    nick: string;
    /** The channel the request came from (results are posted back here). */
    channel: string;
}

/**
 * Maximum number of requests the queue will hold at once (pending or in
 * flight). `addTask` rejects beyond this with a `UserError` so the IRC
 * handler can tell the user "queue full" — protecting the GPU from a flood
 * of accidental or deliberate requests. Kept mutable so tests can override
 * it, like {@link COMFYUI_CONFIG}.
 */
export const MAX_QUEUE_LIMIT: { value: number } = { value: 16 };

/**
 * A simple FIFO queue of image generation requests.
 *
 * The queue only stores data and never executes work — a single dedicated
 * worker coroutine (see {@link GenerationWorker}) drains it, which keeps
 * "who owns ComfyUI startup/shutdown" in one place.
 */
export class PromptQueue implements QueueMonitor {
    private items: PromptQueueItem[] = [];
    /** A pending promise that resolves when a worker asks for the next item. */
    private waiting: {
        resolve: (item: PromptQueueItem) => void;
    } | null = null;
    /** True while a worker holds an item it is processing. */
    private workerBusy = false;

    /** Callback triggered when the queue becomes completely idle. */
    public onIdle?: () => void;

    /**
     * Adds a request to the queue and lets any waiting worker take it.
     * @param item The generation request to enqueue.
     * @returns The position (1-indexed) the request queued at. Counts the
     * item already held by the worker (if any) ahead of new arrivals — so a
     * request arriving while one is in flight is #2, not #1.
     */
    addTask(item: PromptQueueItem): number {
        if (this.items.length >= MAX_QUEUE_LIMIT.value) {
            logger.warn(`Queue is full (${MAX_QUEUE_LIMIT.value}); rejecting request from ${item.nick}`);
            throw new UserError(`The queue is full (${MAX_QUEUE_LIMIT.value} waiting). Try again in a few moments.`);
        }

        // Hand the item directly to a currently waiting worker instead of
        // buffering it — otherwise it would stay in `items` and get
        // dequeued (and generated) a second time.
        if (this.waiting) {
            const waiter = this.waiting;
            this.waiting = null;
            this.workerBusy = true;
            logger.debug(`Request from ${item.nick} handed directly to the waiting worker`);
            waiter.resolve(item);
            return 1;
        }

        this.items.push(item);
        // One in-flight item (if any) is ahead of everything in the buffer.
        const position = (this.workerBusy ? 1 : 0) + this.items.length;
        logger.debug(`Request from ${item.nick} added to queue at position ${position}`);

        return position;
    }

    /**
     * Waits for the next item in the queue. Intended for exactly one worker
     * coroutine at a time — concurrent callers would race for items.
     * @returns The next queued request (may wait indefinitely).
     */
    dequeue(): Promise<PromptQueueItem> {
        const next = this.items.shift();
        if (next) {
            this.workerBusy = true;
            return Promise.resolve(next);
        }
        return new Promise<PromptQueueItem>((resolve) => {
            this.waiting = { resolve };
        });
    }

    /**
     * Called by the worker when it has finished processing its current item.
     * Marks the worker as free and notifies observers if the queue is empty.
     */
    noteItemProcessed(): void {
        this.workerBusy = false;
        this.maybeNotifyIdle();
    }

    /**
     * The number of requests still waiting (not yet handed to the worker).
     */
    get length(): number {
        return this.items.length;
    }

    /**
     * Checks if a request is currently being executed.
     */
    isProcessing(): boolean {
        return this.workerBusy;
    }

    /**
     * Checks if the queue is both not processing any requests and has no pending ones.
     * @returns True if the queue is idle.
     */
    isIdle(): boolean {
        return !this.workerBusy && this.items.length === 0;
    }

    /**
     * Fires the idle callback when the system is fully quiescent (nothing
     * pending, nothing in flight) and an observer is attached.
     */
    private maybeNotifyIdle(): void {
        if (this.isIdle() && this.onIdle) {
            logger.info('Queue is idle - all requests processed');
            this.onIdle();
        }
    }
}
