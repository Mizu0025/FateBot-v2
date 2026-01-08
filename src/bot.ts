import 'dotenv/config';
// @ts-ignore: No type definitions for 'irc-framework'
import IRC from 'irc-framework';
import { BOT_CONFIG, HELP_MESSAGES } from './config/constants';
import { ModelLoader } from './config/model-loader';
import { RuntimeConfig } from './config/runtime-config';
import { PromptParser } from './text-filter/prompt-parser';
import { ImageGenerator } from './image-generation/image-generator';
import { PromptQueue } from './queue/queue';
import { logger } from './config/logger';
import { getGpuMemoryInfo, formatMemoryInfo } from './utils/gpu-utils';

const bot = new IRC.Client();
bot.connect({
    host: BOT_CONFIG.SERVER,
    port: BOT_CONFIG.PORT,
    nick: BOT_CONFIG.NICK,
});

bot.on('registered', () => {
    logger.info(`Connected to IRC server: ${BOT_CONFIG.SERVER}`);
    bot.join(BOT_CONFIG.CHANNEL);
});

bot.on('join', (event: any) => {
    if (event.nick === BOT_CONFIG.NICK && event.channel === BOT_CONFIG.CHANNEL) {
        logger.info(`Joined channel: ${BOT_CONFIG.CHANNEL}`);
        bot.say(BOT_CONFIG.CHANNEL, `${BOT_CONFIG.NICK} has joined the channel!`);
    }
});

const queue = new PromptQueue();
let inactivityTimer: NodeJS.Timeout | null = null;
const inactivityDelay = 10 * 60 * 1000; // 10 minutes

function resetInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    inactivityTimer = setTimeout(async () => {
        if (queue.isIdle()) {
            const beforeMem = await getGpuMemoryInfo();
            const memStr = beforeMem ? ` (VRAM: ${formatMemoryInfo(beforeMem)})` : "";

            logger.info(`No requests for 10 minutes. Clearing VRAM cache${memStr}.`);

            try {
                await ImageGenerator.unloadModels();

                if (beforeMem) {
                    const afterMem = await getGpuMemoryInfo();
                    if (afterMem) {
                        logger.info(`VRAM cleared. Change: ${beforeMem.used}MB -> ${afterMem.used}MB`);
                    }
                }
            } catch (error) {
                logger.error("Error unloading models during inactivity:", error);
            }
        }
    }, inactivityDelay);
}

// Start inactivity timer when queue becomes idle
queue.onIdle = () => {
    resetInactivityTimer();
};

/**
 * Handle help request command
 */
async function handleHelp(nick: string, _message: string) {
    logger.info(`Help requested by ${nick}`);
    bot.notice(nick, HELP_MESSAGES.imageGeneration);
    bot.notice(nick, HELP_MESSAGES.promptStructure);
    bot.notice(nick, HELP_MESSAGES.promptExample);
}

/**
 * Handle models list request command
 */
async function handleListModels(nick: string, _message: string) {
    logger.info(`Models list requested by ${nick}`);
    try {
        const models = await ModelLoader.getModelsList();
        bot.notice(nick, `Available models: ${models}`);
    } catch (error) {
        bot.notice(nick, `Error getting models: ${error}`);
    }
}

/**
 * Handle setting default model command
 */
async function handleSetDefaultModel(nick: string, message: string) {
    const parts = message.split('--set-default-model');
    const newModel = parts[1].trim();

    if (!newModel) {
        bot.notice(nick, "Usage: --set-default-model <model_name>");
        return;
    }

    try {
        const config = await ModelLoader.loadModelConfiguration(newModel);
        if (config) {
            const oldModel = RuntimeConfig.defaultModel;
            RuntimeConfig.defaultModel = newModel;
            logger.info(`Default model changed from ${oldModel} to ${newModel} by ${nick}`);
            bot.say(BOT_CONFIG.CHANNEL, `Default model changed to: ${newModel}`);
        } else {
            bot.notice(nick, `Model '${newModel}' not found. Use --models to see available models.`);
        }
    } catch (error) {
        bot.notice(nick, `Error setting model: ${error}`);
    }
}

/**
 * Handle manual VRAM unload command
 */
async function handleUnloadVram(nick: string, _message: string) {
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

        bot.notice(nick, response);
    } catch (error) {
        logger.error("Error during manual VRAM unload:", error);
        bot.notice(nick, `Error unloading VRAM: ${error}`);
    }
}

/**
 * Handle image generation request
 */
async function handleGenerateImage(nick: string, message: string) {
    try {
        // Parse the prompt
        const filteredPrompt = await PromptParser.extractPrompts(message);
        logger.debug(`Parsed prompt from ${nick}`, {
            width: filteredPrompt.width,
            height: filteredPrompt.height,
            model: filteredPrompt.model || 'default',
            count: filteredPrompt.count
        });

        // Clear any pending inactivity timer
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
            inactivityTimer = null;
        }

        // Queue the image generation task
        const position = queue.addTask(async () => {
            try {
                const gridPath = await ImageGenerator.generateImage(filteredPrompt);
                bot.say(BOT_CONFIG.CHANNEL, `${nick}: Your image is ready! ${gridPath}`);
            } catch (error: any) {
                logger.error("Error during image generation:", error);
                bot.say(BOT_CONFIG.CHANNEL, `${nick}: An error occurred during image generation: ${error.message}`);
            }
        });
        bot.say(BOT_CONFIG.CHANNEL, `${nick}: Starting image generation... You are #${position} in the queue.`);

    } catch (error: any) {
        logger.error("Error parsing prompt:", error);
        bot.say(BOT_CONFIG.CHANNEL, `${nick}: Error parsing your request: ${error.message}`);
    }
}

/**
 * Command mapping to organize different bot actions
 */
const commands: { flag: string, handler: (nick: string, message: string) => Promise<void> }[] = [
    { flag: '--help', handler: handleHelp },
    { flag: '--models', handler: handleListModels },
    { flag: '--set-default-model', handler: handleSetDefaultModel },
    { flag: '--unload-vram', handler: handleUnloadVram },
];

bot.on('message', async (event: any) => {
    const { target, nick, message } = event;

    // Only respond in the configured channel and with the trigger word
    if (target !== BOT_CONFIG.CHANNEL || !message.toLowerCase().includes(BOT_CONFIG.TRIGGER_WORD)) {
        return;
    }

    logger.debug(`Received request from ${nick}: ${message}`);

    // Check if the message contains any of the command flags
    const command = commands.find(c => message.includes(c.flag));

    if (command) {
        await command.handler(nick, message);
    } else {
        // Default action: image generation
        await handleGenerateImage(nick, message);
    }
});