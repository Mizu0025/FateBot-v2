import 'dotenv/config';
// Add this at the top to declare the module for TypeScript
// @ts-ignore: No type definitions for 'irc-framework'
import IRC from 'irc-framework';
import { BOT_CONFIG, HELP_MESSAGES } from './config/constants';
import { ModelLoader } from './config/model-loader';
import { RuntimeConfig } from './config/runtime-config';
import { PromptParser } from './text-filter/prompt-parser';
import { ImageGenerator } from './image-generation/image-generator';
import { PromptQueue } from './queue/queue';
import { logger } from './config/logger';

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

bot.on('message', async (event: any) => {
    if (event.target === BOT_CONFIG.CHANNEL && event.message.toLowerCase().includes(BOT_CONFIG.TRIGGER_WORD)) {
        logger.debug(`Received message with trigger word from ${event.nick}`);

        if (event.message.includes('--help')) {
            logger.info(`Help requested by ${event.nick}`);
            // Send help messages as NOTICE (private)
            bot.notice(event.nick, HELP_MESSAGES.imageGeneration);
            bot.notice(event.nick, HELP_MESSAGES.promptStructure);
            bot.notice(event.nick, HELP_MESSAGES.promptExample);
        } else if (event.message.includes('--models')) {
            logger.info(`Models list requested by ${event.nick}`);
            // Send models list as NOTICE
            try {
                const models = await ModelLoader.getModelsList();
                bot.notice(event.nick, `Available models: ${models}`);
            } catch (error) {
                bot.notice(event.nick, `Error getting models: ${error}`);
            }
        } else if (event.message.includes('--set-default-model')) {
            // Handle changing default model
            const parts = event.message.split('--set-default-model');
            const newModel = parts[1].trim();

            if (!newModel) {
                bot.notice(event.nick, "Usage: --set-default-model <model_name>");
            } else {
                try {
                    const config = await ModelLoader.loadModelConfiguration(newModel);
                    if (config) {
                        const oldModel = RuntimeConfig.defaultModel;
                        RuntimeConfig.defaultModel = newModel;
                        logger.info(`Default model changed from ${oldModel} to ${newModel} by ${event.nick}`);
                        bot.say(BOT_CONFIG.CHANNEL, `Default model changed to: ${newModel}`);
                    } else {
                        bot.notice(event.nick, `Model '${newModel}' not found. Use --models to see available models.`);
                    }
                } catch (error) {
                    bot.notice(event.nick, `Error setting model: ${error}`);
                }
            }
        } else {
            // Handle image generation request
            try {
                // Parse the prompt
                const filteredPrompt = await PromptParser.extractPrompts(event.message);
                logger.debug(`Parsed prompt from ${event.nick}`, {
                    width: filteredPrompt.width,
                    height: filteredPrompt.height,
                    model: filteredPrompt.model || 'default',
                    count: filteredPrompt.count
                });

                // Queue the image generation task
                const position = queue.addTask(async () => {
                    try {
                        const gridPath = await ImageGenerator.generateImage(filteredPrompt);
                        bot.say(BOT_CONFIG.CHANNEL, `${event.nick}: Your image is ready! ${gridPath}`);
                    } catch (error: any) {
                        logger.error("Error during image generation:", error);
                        bot.say(BOT_CONFIG.CHANNEL, `${event.nick}: An error occurred during image generation: ${error.message}`);
                    }
                });
                bot.say(BOT_CONFIG.CHANNEL, `${event.nick}: Starting image generation... You are #${position} in the queue.`);

            } catch (error: any) {
                logger.error("Error parsing prompt:", error);
                bot.say(BOT_CONFIG.CHANNEL, `${event.nick}: Error parsing your request: ${error.message}`);
            }
        }
    }
}); 