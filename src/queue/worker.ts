import { logger } from '../config/logger';
import { PromptQueue, PromptQueueItem } from './queue';
import { ComfyUiServiceManager } from '../managers/comfyui-service-manager';
import { ImageGenerator } from '../image-generation/image-generator';
import { UserError, SystemError } from '../types/errors';
import { classifyGenerationError } from '../utils/error-utils';

/**
 * The background worker coroutine that drains the prompt queue.
 *
 * For each queued request it:
 *   1. Ensures ComfyUI is running (starting the user service on demand).
 *   2. Generates the image(s) via {@link ImageGenerator}.
 *   3. Sends the result (or a classified failure) back to the IRC channel.
 *
 * A transient (retryable) failure is retried exactly once before being
 * reported, since the retry gets a fresh service-start + connection attempt.
 */
export class GenerationWorker {
    /**
     * @param queue The prompt queue requests are drained from.
     * @param service The ComfyUI service manager (start/stop/readiness).
     * @param send Sends a message back to an IRC channel.
     */
    constructor(
        private queue: PromptQueue,
        private service: ComfyUiServiceManager,
        private send: (channel: string, message: string) => void
    ) { }

    /**
     * Starts the worker loop. Runs for the lifetime of the bot process;
     * the loop never exits (a failed item is reported, not fatal).
     */
    public start(): void {
        this.loop().catch((error: unknown) => {
            logger.error('Generation worker loop crashed (should be unreachable):', error);
        });
    }

    private async loop(): Promise<void> {
        while (true) {
            const item = await this.queue.dequeue();
            logger.info(`Processing queued request from ${item.nick} (queue length: ${this.queue.length})`);
            try {
                const imagePath = await this.generateWithRetry(item);
                this.send(item.channel, `${item.nick}: Your image is ready! ${imagePath}`);
            } catch (error: unknown) {
                this.reportFailure(item, error);
            } finally {
                this.queue.noteItemProcessed();
            }
        }
    }

    /**
     * Generates an image, retrying once when the first attempt failed with a
     * retryable (likely transient) error.
     */
    private async generateWithRetry(item: PromptQueueItem): Promise<string> {
        try {
            return await this.generate(item);
        } catch (error: unknown) {
            const classified = classifyGenerationError(error);
            if (!classified.retryable) {
                throw error;
            }
            logger.info(`Transient failure (${classified.category}) for ${item.nick}, retrying once...`);
            return this.generate(item);
        }
    }

    /**
     * Ensures ComfyUI is up (starting it on demand) and runs the generation.
     */
    private async generate(item: PromptQueueItem): Promise<string> {
        const started = await this.service.ensureRunning();
        if (started) {
            this.send(item.channel, `ComfyUI was offline — starting it up now, generation will take a little longer...`);
        }
        return ImageGenerator.generateImage(item.prompt);
    }

    /**
     * Reports a failed generation back to the request's channel.
     */
    private reportFailure(item: PromptQueueItem, error: unknown): void {
        if (error instanceof UserError) {
            this.send(item.channel, `${item.nick}: Input error: ${error.message}`);
            return;
        }

        if (!(error instanceof SystemError)) {
            logger.error(`Unexpected error during image generation for ${item.nick}:`, error);
        } else {
            logger.error(`Image generation failed for ${item.nick}:`, error);
        }

        const classified = classifyGenerationError(error);
        const parts = [`Generation failed (${classified.category})`];
        if (classified.detail) {
            parts.push(classified.detail);
        }
        if (classified.retryable) {
            parts.push('likely transient — try again');
        }
        this.send(item.channel, `${item.nick}: ${parts.join('. ')}`);
    }
}
