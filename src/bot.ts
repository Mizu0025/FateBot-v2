// Add this at the top to declare the module for TypeScript
// @ts-ignore: No type definitions for 'irc-framework'
import IRC from 'irc-framework';
import { BOT_CONFIG, HELP_MESSAGES } from './config/constants';
import { ModelLoader } from './config/model-loader';
import { PromptParser } from './text-filter/prompt-parser';
import { ImageGenerator } from './image-generation/image-generator';

const bot = new IRC.Client();
bot.connect({
    host: BOT_CONFIG.SERVER,
    port: BOT_CONFIG.PORT,
    nick: BOT_CONFIG.NICK,
});

bot.on('registered', () => {
    bot.join(BOT_CONFIG.CHANNEL);
});

bot.on('join', (event: any) => {
    if (event.nick === BOT_CONFIG.NICK && event.channel === BOT_CONFIG.CHANNEL) {
        bot.say(BOT_CONFIG.CHANNEL, 'FateBotTS has joined the channel!');
    }
});

bot.on('message', async (event: any) => {
    if (event.target === BOT_CONFIG.CHANNEL && event.message.toLowerCase().includes(BOT_CONFIG.TRIGGER_WORD)) {
        if (event.message.includes('--help')) {
            // Send help messages as NOTICE (private)
            bot.notice(event.nick, HELP_MESSAGES.imageGeneration);
            bot.notice(event.nick, HELP_MESSAGES.promptStructure);
            bot.notice(event.nick, HELP_MESSAGES.promptExample);
        } else if (event.message.includes('--models')) {
            // Send models list as NOTICE
            try {
                const models = await ModelLoader.getModelsList();
                bot.notice(event.nick, `Available models: ${models}`);
            } catch (error) {
                bot.notice(event.nick, `Error getting models: ${error}`);
            }
        } else {
            // Handle image generation request
            try {
                // Parse the prompt
                const filteredPrompt = await PromptParser.extractPrompts(event.message);
                
                // Send initial response
                bot.say(BOT_CONFIG.CHANNEL, `${event.nick}: Starting image generation...`);
                
                // Generate image asynchronously (non-blocking)
                ImageGenerator.generateImage(filteredPrompt)
                    .then((gridPath) => {
                        bot.say(BOT_CONFIG.CHANNEL, `${event.nick}: Your image is ready! ${gridPath}`);
                    })
                    .catch((error: any) => {
                        console.error("Error during image generation:", error);
                        bot.say(BOT_CONFIG.CHANNEL, `${event.nick}: An error occurred during image generation: ${error.message}`);
                    });
                    
            } catch (error: any) {
                console.error("Error parsing prompt:", error);
                bot.say(BOT_CONFIG.CHANNEL, `${event.nick}: Error parsing your request: ${error.message}`);
            }
        }
    }
}); 