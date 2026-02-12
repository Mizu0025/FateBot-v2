import 'dotenv/config';
// @ts-ignore: No type definitions for 'irc-framework'
import IRC from 'irc-framework';
import { BOT_CONFIG, HELP_MESSAGES, COMFYUI_CONFIG } from './config/constants';
import { logger } from './config/logger';

/**
 * IRC client for FateBot.
 * Connects to IRC and proxies all commands to the image-service microservice.
 */
export class FateBot {
    /** The IRC client instance */
    private bot: any;
    /** The base URL for the image generation microservice */
    private serviceUrl = COMFYUI_CONFIG.IMAGE_SERVICE_URL;

    /**
     * Initializes the IRC client and sets up event listeners.
     */
    constructor() {
        this.bot = new IRC.Client();
        this.setupEventListeners();
    }

    /**
     * Configures the IRC client event listeners for connection, joining, and messages.
     * Handles routing of messages to appropriate command handlers.
     */
    private setupEventListeners() {
        this.bot.on('registered', () => {
            logger.info(`Connected to IRC server: ${BOT_CONFIG.SERVER}`);
            this.bot.join(BOT_CONFIG.CHANNEL);
        });

        this.bot.on('join', (event: any) => {
            if (event.nick === BOT_CONFIG.NICK && event.channel === BOT_CONFIG.CHANNEL) {
                logger.info(`Joined channel: ${BOT_CONFIG.CHANNEL}`);
                this.bot.say(BOT_CONFIG.CHANNEL, `${BOT_CONFIG.NICK} has joined the channel!`);
            }
        });

        this.bot.on('message', async (event: any) => {
            const { target, nick, message } = event;

            // Check if message is for us in the right channel
            if (target !== BOT_CONFIG.CHANNEL || !message.toLowerCase().includes(BOT_CONFIG.TRIGGER_WORD)) {
                return;
            }

            logger.debug(`Received request from ${nick}: ${message}`);

            // Basic Routing
            if (message.includes('--help')) {
                this.handleHelp(nick);
            } else if (message.includes('--models')) {
                await this.handleListModels(nick);
            } else {
                await this.handleGenerateImage(nick, message);
            }
        });
    }

    /**
     * Sends help information to a user via IRC notice.
     * @param nick The nickname of the user requesting help.
     */
    private handleHelp(nick: string) {
        this.bot.notice(nick, HELP_MESSAGES.imageGeneration);
        this.bot.notice(nick, HELP_MESSAGES.promptStructure);
        this.bot.notice(nick, HELP_MESSAGES.promptExample);
    }

    /**
     * Fetches the list of available AI models from the image service and notifies the user.
     * @param nick The nickname of the user requesting the model list.
     */
    private async handleListModels(nick: string) {
        try {
            const response = await fetch(`${this.serviceUrl}/models`);
            if (!response.ok) throw new Error("Service unavailable");
            const { models } = await response.json();
            this.bot.notice(nick, `Available models: ${models.join(', ')}`);
        } catch (error) {
            this.bot.notice(nick, `Error getting models: ${error}`);
        }
    }

    /**
     * Orchestrates the image generation process by communicating with the external microservice.
     * First requests the task, then waits for completion and posts the result back to the channel.
     * @param nick The nickname of the user requesting image generation.
     * @param message The raw message containing the generation prompt and optional flags.
     */
    private async handleGenerateImage(nick: string, message: string) {
        try {
            // Strip trigger word for the service
            const cleanedMessage = message.replace(BOT_CONFIG.TRIGGER_WORD, "").trim();

            // 1. Request generation (immediate return)
            const req = await fetch(`${this.serviceUrl}/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: cleanedMessage, nick })
            });

            if (!req.ok) throw new Error("Failed to queue request");
            const { job_id, queue_position } = await req.json();

            this.bot.say(BOT_CONFIG.CHANNEL, `${nick}: Starting image generation... You are #${queue_position} in the queue.`);

            // 2. Wait for completion
            const wait = await fetch(`${this.serviceUrl}/wait/${job_id}`);
            if (!wait.ok) throw new Error("Lost connection to service");
            const result = await wait.json();

            if (result.status === 'completed') {
                this.bot.say(BOT_CONFIG.CHANNEL, `${nick}: Your image is ready! ${result.result}`);
            } else {
                this.bot.say(BOT_CONFIG.CHANNEL, `${nick}: Image generation failed: ${result.error || "Unknown error"}`);
            }
        } catch (error: any) {
            logger.error("Error in handleGenerateImage:", error);
            this.bot.say(BOT_CONFIG.CHANNEL, `${nick}: An error occurred: ${error.message}`);
        }
    }

    /**
     * Establishes a connection to the IRC server using configured parameters.
     */
    public connect() {
        this.bot.connect({
            host: BOT_CONFIG.SERVER,
            port: BOT_CONFIG.PORT,
            nick: BOT_CONFIG.NICK,
        });
    }
}
