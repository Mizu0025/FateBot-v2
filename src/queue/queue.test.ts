import { PromptQueue, PromptQueueItem } from './queue';
import { FilteredPrompt } from '../types';
import { logger } from '../config/logger';

// Helper to build a minimal, fully-typed queued request.
const makeItem = (id: number): PromptQueueItem => ({
    prompt: { prompt: `prompt-${id}`, count: 1 } as FilteredPrompt,
    nick: `user-${id}`,
    channel: '#test',
});

describe('PromptQueue', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.spyOn(logger, 'error').mockImplementation(() => logger);
        jest.spyOn(logger, 'debug').mockImplementation(() => logger);
        jest.spyOn(logger, 'info').mockImplementation(() => logger);
    });

    it('should add requests in FIFO order and return 1-indexed positions', async () => {
        const queue = new PromptQueue();
        const a = makeItem(1);
        const b = makeItem(2);
        const c = makeItem(3);

        expect(queue.addTask(a)).toBe(1);
        expect(queue.addTask(b)).toBe(2);
        expect(queue.addTask(c)).toBe(3);

        // Nothing has been handed to a worker yet, so all three are pending.
        expect(queue.length).toBe(3);
        expect(queue.isProcessing()).toBe(false);

        expect(await queue.dequeue()).toBe(a);
        expect(await queue.dequeue()).toBe(b);
        expect(await queue.dequeue()).toBe(c);
    });

    it('should hand a newly added item to a currently-waiting worker', async () => {
        const queue = new PromptQueue();

        // Worker asks for the next item before any exist. A waiting worker
        // means nothing is in flight, so the queue still reports idle.
        const pending = queue.dequeue();
        expect(queue.isProcessing()).toBe(false);
        expect(queue.isIdle()).toBe(true);

        // A request is dropped off; the worker's pending promise resolves with it.
        const item = makeItem(42);
        expect(queue.addTask(item)).toBe(1);

        expect(await pending).toBe(item);
        // The worker now holds an in-flight item; nothing is left pending.
        expect(queue.length).toBe(0);
        expect(queue.isProcessing()).toBe(true);
        expect(queue.isIdle()).toBe(false);

        // When the worker finishes, the queue is idle again.
        queue.noteItemProcessed();
        expect(queue.isProcessing()).toBe(false);
        expect(queue.isIdle()).toBe(true);
    });

    it('should report position 2 for a request arriving while one is in flight (cold start)', async () => {
        const queue = new PromptQueue();

        // Worker dequeues an empty queue → it is now waiting.
        const pending = queue.dequeue();

        // Request #1 lands while the worker is waiting → handed over (#1).
        const first = makeItem(1);
        expect(queue.addTask(first)).toBe(1);
        expect(await pending).toBe(first);
        expect(queue.isProcessing()).toBe(true);

        // Request #2 lands while request #1 is still in flight.
        // It must be counted ahead of nothing but behind the in-flight item.
        const second = makeItem(2);
        expect(queue.addTask(second)).toBe(2);

        // Request #3 while both #1 (in flight) and #2 (pending) are ahead.
        expect(queue.addTask(makeItem(3))).toBe(3);
    });

    it('should report length as the number of still-pending requests', () => {
        const queue = new PromptQueue();
        queue.addTask(makeItem(1));
        queue.addTask(makeItem(2));
        queue.addTask(makeItem(3));
        expect(queue.length).toBe(3);

        // Taking two leaves one pending.
        queue.dequeue();
        queue.dequeue();
        expect(queue.length).toBe(1);
    });

    it('should report processing state as the worker holding an item', () => {
        const queue = new PromptQueue();
        expect(queue.isProcessing()).toBe(false);

        queue.addTask(makeItem(1));
        expect(queue.isProcessing()).toBe(false); // not yet taken

        queue.dequeue();
        expect(queue.isProcessing()).toBe(true);

        queue.noteItemProcessed();
        expect(queue.isProcessing()).toBe(false);
    });

    describe('onIdle', () => {
        it('should fire when the queue becomes fully idle after processing', () => {
            const queue = new PromptQueue();
            const onIdle = jest.fn();
            queue.onIdle = onIdle;

            queue.addTask(makeItem(1));
            expect(onIdle).not.toHaveBeenCalled(); // one pending

            queue.dequeue();
            expect(onIdle).not.toHaveBeenCalled(); // one in flight

            queue.noteItemProcessed();
            expect(onIdle).toHaveBeenCalledTimes(1); // all done

            // Idle again after the next request completes.
            queue.addTask(makeItem(2));
            queue.dequeue();
            queue.noteItemProcessed();
            expect(onIdle).toHaveBeenCalledTimes(2);
        });

        it('should not fire while items are still waiting or in flight', () => {
            const queue = new PromptQueue();
            const onIdle = jest.fn();
            queue.onIdle = onIdle;

            queue.addTask(makeItem(1));
            expect(queue.isIdle()).toBe(false);

            queue.dequeue();
            queue.addTask(makeItem(2));
            expect(queue.isIdle()).toBe(false);
            expect(onIdle).not.toHaveBeenCalled();

            // One item is in flight and one is pending: still not idle.
            queue.noteItemProcessed();
            expect(queue.isIdle()).toBe(false);
            expect(onIdle).not.toHaveBeenCalled();

            queue.dequeue();
            queue.noteItemProcessed();
            expect(queue.isIdle()).toBe(true);
            expect(onIdle).toHaveBeenCalledTimes(1);
        });

        it('should be a no-op when no observer is attached', () => {
            const queue = new PromptQueue();
            expect(queue.onIdle).toBeUndefined();

            queue.addTask(makeItem(1));
            queue.dequeue();
            queue.noteItemProcessed(); // no observer → no notification, no throw
            expect(queue.isIdle()).toBe(true);
        });
    });

    it('should report idle when empty and nothing is in flight', () => {
        const queue = new PromptQueue();
        expect(queue.isIdle()).toBe(true);
        expect(queue.length).toBe(0);
        expect(queue.isProcessing()).toBe(false);
    });
});
