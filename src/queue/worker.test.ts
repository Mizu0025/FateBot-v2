import { beforeEach, describe, expect, it, type Mock, type Mocked, vi } from 'vitest';
import { ImageGenerator } from '../image-generation/image-generator';
import type { ComfyUiServiceManager } from '../managers/comfyui-service-manager';
import type { FilteredPrompt } from '../types';
import { SystemError, UserError } from '../types/errors';
import { PromptQueue, type PromptQueueItem } from './queue';
import { GenerationWorker } from './worker';

vi.mock('../config/logger');
vi.mock('../image-generation/image-generator');

// Helper to build a minimal, fully-typed queued request.
const makeItem = (nick = 'user123'): PromptQueueItem => ({
    prompt: { prompt: 'a cat', count: 1 } as FilteredPrompt,
    nick,
    channel: '#test',
});

// Lets mocked async work (real setTimeouts in some tests) settle.
const flush = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

describe('GenerationWorker', () => {
    let queue: PromptQueue;
    let service: Mocked<ComfyUiServiceManager>;
    let send: Mock;
    let worker: GenerationWorker;
    let generateImageMock: Mock;

    beforeEach(() => {
        queue = new PromptQueue();
        service = {
            ensureRunning: vi.fn().mockResolvedValue(false),
            stop: vi.fn().mockResolvedValue(undefined),
            isRunning: vi.fn().mockResolvedValue(false),
        } as unknown as Mocked<ComfyUiServiceManager>;
        send = vi.fn();
        worker = new GenerationWorker(queue, service, send);
        generateImageMock = vi.mocked(ImageGenerator.generateImage);
        generateImageMock.mockReset();
        generateImageMock.mockResolvedValue({ url: '/path/to/image.webp', saved: '1/1' });
        // Retry sleeps are instant in tests — we assert *behavior*, not timing.
        vi.spyOn(GenerationWorker, 'sleep').mockImplementation(async () => {});
    });

    it('should process a queued request and send the result to the channel', async () => {
        worker.start();
        queue.addTask(makeItem());
        await flush();

        expect(service.ensureRunning).toHaveBeenCalledTimes(1);
        expect(generateImageMock).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledWith('#test', 'user123: Your image is ready! /path/to/image.webp');
        // The worker released the item, so the queue is idle again.
        expect(queue.isIdle()).toBe(true);
    });

    it('should announce service startup when ComfyUI had to be started', async () => {
        (service.ensureRunning as Mock).mockResolvedValue(true);

        worker.start();
        queue.addTask(makeItem());
        await flush();

        expect(send).toHaveBeenNthCalledWith(1, '#test', expect.stringContaining('ComfyUI was offline'));
        expect(send).toHaveBeenNthCalledWith(2, '#test', 'user123: Your image is ready! /path/to/image.webp');
    });

    it('should ensure the service is restarted on every generation', async () => {
        worker.start();
        queue.addTask(makeItem());
        await flush();
        queue.addTask(makeItem());
        await flush();

        expect(service.ensureRunning).toHaveBeenCalledTimes(2);
    });

    it('should report non-retryable failures without retrying', async () => {
        generateImageMock.mockRejectedValue(new SystemError('ComfyUI finished but produced no images'));

        worker.start();
        queue.addTask(makeItem());
        await flush();

        expect(generateImageMock).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledWith(
            '#test',
            'user123: Generation failed (internal). ComfyUI finished but produced no images',
        );
        expect(queue.isIdle()).toBe(true);
    });

    it('should retry once on a transient failure and report success', async () => {
        generateImageMock
            .mockRejectedValueOnce(new SystemError('connect ECONNREFUSED', { code: 'ECONNREFUSED' }))
            .mockResolvedValueOnce({ url: '/retry.webp', saved: '1/1' });

        worker.start();
        queue.addTask(makeItem());
        await flush();

        expect(generateImageMock).toHaveBeenCalledTimes(2);
        expect(service.ensureRunning).toHaveBeenCalledTimes(2);
        expect(send).toHaveBeenCalledWith('#test', 'user123: Your image is ready! /retry.webp');
    });

    it('should make exactly the configured number of retries when all fail (default 2)', async () => {
        generateImageMock.mockImplementation(() =>
            Promise.reject(new SystemError('connect ECONNREFUSED', { code: 'ECONNREFUSED' })),
        );

        worker.start();
        queue.addTask(makeItem());
        await flush();

        // Default GENERATION_MAX_RETRIES=2 => initial attempt + 2 retries = 3 calls.
        expect(generateImageMock).toHaveBeenCalledTimes(3);
        expect(send).toHaveBeenCalledWith('#test', expect.stringContaining('likely transient — try again'));
        expect(send).toHaveBeenCalledWith('#test', expect.stringContaining('Generation failed (offline)'));
    });

    it('should honor an injected MAX_RETRIES and stop retrying after that many', async () => {
        generateImageMock.mockImplementation(() =>
            Promise.reject(new SystemError('connect ECONNREFUSED', { code: 'ECONNREFUSED' })),
        );
        // MAX_RETRIES=1 => initial + 1 retry = 2 calls (fewer than the default 3).
        const workerOneRetry = new GenerationWorker(queue, service, send, { MAX_RETRIES: 1, BASE_MS: 1 });

        workerOneRetry.start();
        queue.addTask(makeItem());
        await flush();

        expect(generateImageMock).toHaveBeenCalledTimes(2);
    });

    it('should back off exponentially between retries (base * 2^attempt, jittered)', async () => {
        generateImageMock.mockImplementation(() =>
            Promise.reject(new SystemError('connect ECONNREFUSED', { code: 'ECONNREFUSED' })),
        );
        const delays: number[] = [];
        // Re-capture the sleep calls (beforeEach made it a plain no-op).
        vi.spyOn(GenerationWorker, 'sleep').mockImplementation((ms) => {
            delays.push(ms);
            return Promise.resolve();
        });
        const workerBackoff = new GenerationWorker(queue, service, send, { MAX_RETRIES: 2, BASE_MS: 1000 });

        workerBackoff.start();
        queue.addTask(makeItem());
        await flush();

        // Two retries => two sleeps. Jitter is uniform [0.5, 1), so each delay
        // lands in [base*2^a*0.5, base*2^a]. Attempt 0 => [500, 1000];
        // attempt 1 => [1000, 2000]. The base doubles, so the 2nd is always
        // >= the low bound of the 2nd and the 1st never exceeds the 2nd's low.
        expect(delays).toHaveLength(2);
        expect(delays[0]).toBeGreaterThanOrEqual(500);
        expect(delays[0]).toBeLessThanOrEqual(1000);
        expect(delays[1]).toBeGreaterThanOrEqual(1000);
        expect(delays[1]).toBeLessThanOrEqual(2000);
        expect(generateImageMock).toHaveBeenCalledTimes(3);
    });

    it('should report UserError as an input error', async () => {
        generateImageMock.mockRejectedValue(new UserError('bad prompt'));

        worker.start();
        queue.addTask(makeItem());
        await flush();

        expect(generateImageMock).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledWith('#test', 'user123: Input error: bad prompt');
    });

    it('should report honest partial-save count when some images failed to save (P0-4)', async () => {
        generateImageMock.mockResolvedValue({ url: '/path/partial.webp', saved: '3/4' });

        worker.start();
        queue.addTask(makeItem());
        await flush();

        expect(send).toHaveBeenCalledWith('#test', expect.stringContaining('3 of 4 saved'));
        expect(send).not.toHaveBeenCalledWith('#test', expect.stringContaining('4 of 4 saved'));
    });

    it('should process multiple queued requests in FIFO order', async () => {
        let call = 0;
        generateImageMock.mockImplementation(async () => {
            call += 1;
            await new Promise((resolve) => setTimeout(resolve, 5));
            return { url: `image-${call}.webp`, saved: '1/1' };
        });

        worker.start();
        queue.addTask(makeItem('first'));
        queue.addTask(makeItem('second'));
        await flush(100);

        expect(send.mock.calls[0]).toEqual(['#test', 'first: Your image is ready! image-1.webp']);
        expect(send.mock.calls[1]).toEqual(['#test', 'second: Your image is ready! image-2.webp']);
        expect(queue.isIdle()).toBe(true);
    });

    it('should stop the worker mid-idle: no further requests get processed (P0-3)', async () => {
        worker.start();
        // Wait until the worker is idle (dequeue is pending).
        await flush();

        // Enqueue one item that is currently processing (in flight).
        queue.addTask(makeItem('inflight'));
        // While that item is processing, stop() — it should finish first, and
        // then the loop should exit rather than pick up the next item.
        worker.stop();

        // The in-flight item MUST be reported — it is never abandoned mid-way.
        await flush();
        expect(send).toHaveBeenCalledWith('#test', 'inflight: Your image is ready! /path/to/image.webp');

        // After stop, the queue refuses further addTask calls.
        expect(() => queue.addTask(makeItem('rejected'))).toThrow(/shutting down/);
        expect(generateImageMock).toHaveBeenCalledTimes(1);
    });

    it('should let an in-flight request finish before exiting the loop (P0-3)', async () => {
        // Simulate a long generation; after stop() the item must still be
        // reported (not abandoned) and the queue must then reject new work.
        let resolveInflight: ((value: { url: string; saved: string }) => void) | undefined;
        generateImageMock.mockImplementationOnce(async () => {
            // Expose the resolver so the test can finish the in-flight item
            // at a controlled moment (after stop(), to prove it completes).
            const inflight = new Promise<{ url: string; saved: string }>((resolve) => {
                resolveInflight = resolve;
            });
            return inflight;
        });

        worker.start();
        queue.addTask(makeItem('slow-nick'));

        // Wait until the in-flight promise is actually running.
        await flush(20);
        expect(generateImageMock).toHaveBeenCalledTimes(1);

        // Stop while the item is in flight.
        worker.stop();

        // Finish the generation so the loop can complete the item and exit.
        expect(resolveInflight).toBeDefined();
        resolveInflight?.({ url: '/slow.webp', saved: '1/1' });

        await flush(120);

        // The in-flight item reported before the loop exited.
        expect(send).toHaveBeenCalledWith('#test', 'slow-nick: Your image is ready! /slow.webp');

        // Now the queue rejects further requests.
        expect(() => queue.addTask(makeItem('late'))).toThrow(/shutting down/);
    });
});
