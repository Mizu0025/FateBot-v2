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

    it('should report the failure when the retry also fails', async () => {
        generateImageMock.mockImplementation(() =>
            Promise.reject(new SystemError('connect ECONNREFUSED', { code: 'ECONNREFUSED' })),
        );

        worker.start();
        queue.addTask(makeItem());
        await flush();

        expect(generateImageMock).toHaveBeenCalledTimes(2);
        expect(send).toHaveBeenCalledWith('#test', expect.stringContaining('likely transient — try again'));
        expect(send).toHaveBeenCalledWith('#test', expect.stringContaining('Generation failed (offline)'));
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
});
