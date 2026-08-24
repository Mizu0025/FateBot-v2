import { logger } from '../config/logger';
import { COMFYUI_SERVICE_CONFIG, HELP_MESSAGES } from '../config/constants';
import { MessageSender } from '../types/irc';
import { ModelLoader } from '../config/model-loader';
import { PromptParser } from '../text-filter/prompt-parser';
import { PromptQueue } from '../queue/queue';
import { InactivityManager } from '../managers/inactivity-manager';
import { ComfyUiServiceManager } from '../managers/comfyui-service-manager';
import { UserError } from '../types/errors';

/**
 * Handles specific bot commands and image generation requests.
 *
 * Image generation is queued as data (a {@link PromptQueueItem}); the
 * background worker owns service startup and the actual generation, so this
 * class only parses, queues, and reports — it never talks to ComfyUI itself
 * (except through the service manager for the explicit start/stop commands).
 */
export class CommandHandler {
    /**
     * @param bot The IRC client instance.
     * @param queue The prompt queue for managing image generation requests.
     * @param inactivityManager The manager for handling bot idle state.
     * @param service The ComfyUI user service manager (start/stop/readiness).
     */
    constructor(
        private bot: MessageSender,
        private queue: Pick<PromptQueue, 'addTask' | 'length' | 'isProcessing'>,
        private inactivityManager: Pick<InactivityManager, 'clearTimer'>,
        private service: ComfyUiServiceManager
    ) { }

    /**
     * Sends help information to the user via IRC notices.
     * @param nick The nickname of the user who requested help.
     */
    public async handleHelp(nick: string) {
        logger.info(`Help requested by ${nick}`);
        this.bot.notice(nick, HELP_MESSAGES.imageGeneration);
        this.bot.notice(nick, HELP_MESSAGES.promptStructure);
        this.bot.notice(nick, HELP_MESSAGES.promptExample);
    }

    /**
     * Lists all available AI models to the user.
     * @param nick The nickname of the user requesting the list.
     */
    public async handleListModels(nick: string) {
        logger.info(`Models list requested by ${nick}`);
        try {
            const models = await ModelLoader.getModelsList();
            this.bot.notice(nick, `Available models: ${models}`);
        } catch (error) {
            this.bot.notice(nick, `Error getting models: ${error}`);
        }
    }

    /**
     * Starts the ComfyUI user service on demand.
     * If ComfyUI is already up, that's reported as a no-op instead of an error.
     * @param nick The nickname of the user requesting the start.
     */
    public async handleStartComfyui(nick: string) {
        logger.info(`Manual ComfyUI start requested by ${nick}`);
        try {
            const started = await this.service.ensureRunning();
            this.bot.notice(nick, started
                ? `ComfyUI started. It will stay up until the queue has been idle for ${COMFYUI_SERVICE_CONFIG.IDLE_MINUTES} minutes.`
                : 'ComfyUI was already running.');
        } catch (error) {
            logger.error("Error starting ComfyUI:", error);
            this.bot.notice(nick, `Error starting ComfyUI: ${error instanceof Error ? error.message : error}`);
        }
    }

    /**
     * Stops the ComfyUI user service, freeing GPU memory.
     * Stopping it is always fine — the next image request starts it again.
     * @param nick The nickname of the user requesting the stop.
     */
    public async handleStopComfyui(nick: string) {
        logger.info(`Manual ComfyUI stop requested by ${nick}`);
        try {
            await this.service.stop();
            this.bot.notice(nick, 'ComfyUI stopped. It will start automatically on the next image request.');
        } catch (error) {
            logger.error("Error stopping ComfyUI:", error);
            this.bot.notice(nick, `Error stopping ComfyUI: ${error instanceof Error ? error.message : error}`);
        }
    }

    /**
     * Reports the current state of the ComfyUI service.
     * @param nick The nickname of the user requesting the status.
     */
    public async handleComfyuiStatus(nick: string) {
        logger.info(`ComfyUI status requested by ${nick}`);
        try {
            const running = await this.service.isRunning();
            this.bot.notice(nick, running
                ? `ComfyUI is running. Queue: ${this.queue.length} waiting, processing: ${this.queue.isProcessing() ? 'yes' : 'no'}.`
                : 'ComfyUI is not running. It will start automatically on the next image request.');
        } catch (error) {
            logger.error("Error checking ComfyUI status:", error);
            this.bot.notice(nick, `Error checking ComfyUI status: ${error instanceof Error ? error.message : error}`);
        }
    }

    /**
     * Parses a prompt and queues an image generation request for the worker.
     * @param nick The nickname of the user requesting the image.
     * @param channel The channel the request came from (replies go back here).
     * @param message The full message containing the prompt and optional flags.
     */
    public async handleGenerateImage(nick: string, channel: string, message: string) {
        try {
            const filteredPrompt = await PromptParser.extractPrompts(message);
            logger.debug(`Parsed prompt from ${nick}`, {
                width: filteredPrompt.width,
                height: filteredPrompt.height,
                model: filteredPrompt.model || 'default',
                count: filteredPrompt.count
            });

            this.inactivityManager.clearTimer();

            const position = this.queue.addTask({
                prompt: filteredPrompt,
                nick,
                channel
            });
            this.bot.say(channel, `${nick}: Starting image generation... You are #${position} in the queue.`);

        } catch (error: unknown) {
            if (error instanceof UserError) {
                this.bot.say(channel, `${nick}: Error parsing your request: ${error.message}`);
            } else {
                logger.error("Error during message handling:", error);
                this.bot.say(channel, `${nick}: An error occurred while processing your request.`);
            }
        }
    }
}