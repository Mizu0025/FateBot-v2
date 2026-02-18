import { logger } from '../config/logger';
import { BOT_CONFIG, HELP_MESSAGES } from '../config/constants';
import { ModelLoader } from '../config/model-loader';
import { PromptParser } from '../text-filter/prompt-parser';
import { ImageGenerator } from '../image-generation/image-generator';
import { PromptQueue } from '../queue/queue';
import { getGpuMemoryInfo, formatMemoryInfo } from '../utils/gpu-utils';
import { InactivityManager } from '../managers/inactivity-manager';
import { UserError, SystemError } from '../types/errors';

/**
 * Handles specific bot commands and image generation requests.
 */
export class CommandHandler {
    /**
     * @param bot The IRC client instance.
     * @param queue The prompt queue for managing image generation tasks.
     * @param inactivityManager The manager for handling bot idle state.
     */
    constructor(
        private bot: any,
        private queue: PromptQueue,
        private inactivityManager: InactivityManager
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
     * Manually triggers a VRAM unload to free up GPU memory.
     * @param nick The nickname of the user requesting the unload.
     */
    public async handleUnloadVram(nick: string) {
        logger.info(`Manual VRAM unload requested by ${nick}`);
        try {
            const beforeMem = await getGpuMemoryInfo();
            await ImageGenerator.unloadModels();
            const afterMem = await getGpuMemoryInfo();

            let response = "Successfully requested VRAM unload.";
            if (beforeMem && afterMem) {
                response += ` Memory: ${beforeMem.used}MB -> ${afterMem.used}MB`;
            } else if (afterMem) {
                response += ` Current VRAM: ${formatMemoryInfo(afterMem)}`;
            }

            this.bot.notice(nick, response);
        } catch (error) {
            logger.error("Error during manual VRAM unload:", error);
            this.bot.notice(nick, `Error unloading VRAM: ${error}`);
        }
    }

    /**
     * Parses a prompt and queues an image generation task.
     * @param nick The nickname of the user requesting the image.
     * @param message The full message containing the prompt and optional flags.
     */
    public async handleGenerateImage(nick: string, message: string) {
        try {
            const filteredPrompt = await PromptParser.extractPrompts(message);
            logger.debug(`Parsed prompt from ${nick}`, {
                width: filteredPrompt.width,
                height: filteredPrompt.height,
                model: filteredPrompt.model || 'default',
                count: filteredPrompt.count
            });

            this.inactivityManager.clearTimer();

            const position = this.queue.addTask(async () => {
                try {
                    const gridPath = await ImageGenerator.generateImage(filteredPrompt);
                    this.bot.say(BOT_CONFIG.CHANNEL, `${nick}: Your image is ready! ${gridPath}`);
                } catch (error: any) {
                    if (error instanceof UserError) {
                        this.bot.say(BOT_CONFIG.CHANNEL, `${nick}: Input error: ${error.message}`);
                    } else if (error instanceof SystemError) {
                        this.bot.say(BOT_CONFIG.CHANNEL, `${nick}: A system error occurred. Please try again later. (Error ID: ${error.details?.status || 'INTERNAL'})`);
                    } else {
                        logger.error("Unexpected error during image generation:", error);
                        this.bot.say(BOT_CONFIG.CHANNEL, `${nick}: An unexpected error occurred.`);
                    }
                }
            });
            this.bot.say(BOT_CONFIG.CHANNEL, `${nick}: Starting image generation... You are #${position} in the queue.`);

        } catch (error: any) {
            if (error instanceof UserError) {
                this.bot.say(BOT_CONFIG.CHANNEL, `${nick}: Error parsing your request: ${error.message}`);
            } else {
                logger.error("Error during message handling:", error);
                this.bot.say(BOT_CONFIG.CHANNEL, `${nick}: An error occurred while processing your request.`);
            }
        }
    }
}
