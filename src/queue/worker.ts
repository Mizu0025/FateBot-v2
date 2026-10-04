import { RETRY_CONFIG, type RetryConfig } from '../config/constants';
import { logger } from '../config/logger';
import { type GenerationResult, ImageGenerator } from '../image-generation/image-generator';
import type { ComfyUiServiceManager } from '../managers/comfyui-service-manager';
import { SystemError, UserError } from '../types/errors';
import { classifyGenerationError } from '../utils/error-utils';
import { PromptQueue, type PromptQueueItem } from './queue';

/**
 * The background worker coroutine that drains the prompt queue.
 *
 * For each queued request it:
 *   1. Ensures ComfyUI is running (starting the user service on demand).
 *   2. Generates the image(s) via {@link ImageGenerator}.
 *   3. Sends the result (or a classified failure) back to the IRC channel.
 *
 * A transient (retryable) failure is retried with exponential backoff + jitter
 * (P2-6): the first attempt plus up to {@link RETRY_CONFIG.MAX_RETRIES} more,
 * waiting `BASE_MS * 2^attempt * jitter` between each. The retry policy can be
 * injected for tests (defaults to {@link RETRY_CONFIG}).
 *
 * The loop exits when the queue is shut down (see {@link stop}): the queue
 * hands back a shutdown sentinel and the worker stops without processing it.
 */
export class GenerationWorker {
    /**
     * @param queue The prompt queue requests are drained from.
     * @param service The ComfyUI service manager (start/stop/readiness).
     * @param send Sends a message back to an IRC channel.
     * @param retry The retry policy (defaults to {@link RETRY_CONFIG}).
     */
    constructor(
        private queue: PromptQueue,
        private service: ComfyUiServiceManager,
        private send: (channel: string, message: string) => void,
        private retry: RetryConfig = RETRY_CONFIG,
    ) {}

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
            // The queue hands back a shutdown sentinel on stop(); drop it and
            // exit. This is the single exit path — both a worker blocked in
            // a pending dequeue and one finishing an in-flight request land
            // here (P0-3).
            if (PromptQueue.isShutdownItem(item)) {
                logger.info('Worker stopping: queue shut down');
                return;
            }
            logger.info(`Processing queued request from ${item.nick} (queue length: ${this.queue.length})`);
            try {
                const result = await this.generateWithRetry(item);
                this.send(item.channel, GenerationWorker.successMessage(item.nick, result));
            } catch (error: unknown) {
                this.reportFailure(item, error);
            } finally {
                this.queue.noteItemProcessed();
            }
        }
    }

    /**
     * Signals the worker loop to stop by shutting down the queue (P0-3). Any
     * worker blocked in a dequeue is unblocked with the shutdown sentinel; a
     * worker finishing an in-flight request picks it up at the top of the
     * next iteration. The in-flight item is never abandoned mid-generation —
     * it finishes first; the loop simply stops picking up new work.
     * Idempotent.
     */
    public stop(): void {
        this.queue.shutdown();
    }

    /**
     * Phrases the success reply for a completed generation (P0-4). A clean
     * save reads as before; a partial save (some images failed) says so
     * explicitly instead of acting as if the whole batch succeeded.
     */
    private static successMessage(nick: string, result: GenerationResult): string {
        const base = `${nick}: Your image is ready! ${result.url}`;
        const [saved, total] = result.saved.split('/').map(Number);
        if (saved !== undefined && total !== undefined && saved < total) {
            return `${base} (${saved} of ${total} saved — one failed, see the bot logs)`;
        }
        return base;
    }

    /**
     * Generates a result, retrying with exponential backoff + jitter when an
     * attempt fails with a retryable (transient) error (P2-6).
     *
     * The initial attempt plus up to `this.retry.MAX_RETRIES` repeats are made.
     * Before each repeat the worker waits `BASE_MS * 2^attempt` ms scaled by a
     * uniform random jitter in [0.5, 1.0) — exponential growth so a flapped
     * backend gets more room to recover, and jitter so a burst of queued
     * failures don't thunder-herd the same retry instant. A *non*-retryable
     * error is rethrown immediately (retrying it would burn the GPU for an
     * identical failure). Each retry re-runs `generate` from scratch, which
     * re-checks (and re-starts a down) ComfyUI via `service.ensureRunning()`.
     */
    private async generateWithRetry(item: PromptQueueItem): Promise<GenerationResult> {
        const maxAttempts = this.retry.MAX_RETRIES + 1;
        let lastError: unknown;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                return await this.generate(item);
            } catch (error: unknown) {
                lastError = error;
                const classified = classifyGenerationError(error);
                if (!classified.retryable || attempt === maxAttempts - 1) {
                    throw error;
                }
                // Exponential backoff (base * 2^attempt) with a uniform [0.5, 1)
                // jitter, so a flapped backend gets more room each retry and a
                // burst of queued failures doesn't retry on the same instant.
                const baseDelayMs = this.retry.BASE_MS * 2 ** attempt;
                const delayMs = Math.round(baseDelayMs * (0.5 + Math.random() * 0.5));
                logger.info(
                    `Transient failure (${classified.category}) for ${item.nick} — retry ${attempt + 1}/${this.retry.MAX_RETRIES} in ${delayMs} ms...`,
                );
                await GenerationWorker.sleep(delayMs);
            }
        }

        // Unreachable — the loop either returns or throws on its last attempt —
        // but keeps the control-flow honest and satisfies the compiler.
        throw lastError;
    }

    /**
     * Waits the given number of milliseconds. Exposed as a public static so
     * tests can spy on it (and avoid real waits) without reaching into the
     * worker's internal backoff computation.
     */
    public static sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Ensures ComfyUI is up (starting it on demand) and runs the generation.
     */
    private async generate(item: PromptQueueItem): Promise<GenerationResult> {
        const started = await this.service.ensureRunning();
        if (started) {
            this.send(
                item.channel,
                `ComfyUI was offline — starting it up now, generation will take a little longer...`,
            );
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
