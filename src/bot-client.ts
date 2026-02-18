import 'dotenv/config';
// @ts-ignore: No type definitions for 'irc-framework'
import IRC from 'irc-framework';
import { BOT_CONFIG } from './config/constants';
import { logger } from './config/logger';
import { PromptQueue } from './queue/queue';
import { InactivityManager } from './managers/inactivity-manager';
import { CommandHandler } from './handlers/command-handler';
import { MessageHandler } from './handlers/message-handler';

/**
 * The main bot client class that orchestrates the IRC connection,
 * prompt queue, and message handling.
 */
export class FateBot {
    private bot: any;
    private queue: PromptQueue;
    private inactivityManager: InactivityManager;
    private commandHandler: CommandHandler;
    private messageHandler: MessageHandler;

    /**
     * Initializes all bot components and sets up event listeners.
     */
    constructor() {
        this.bot = new IRC.Client();
        this.queue = new PromptQueue();
        this.inactivityManager = new InactivityManager(this.queue);
        this.commandHandler = new CommandHandler(this.bot, this.queue, this.inactivityManager);
        this.messageHandler = new MessageHandler(this.commandHandler);

        this.setupEventListeners();
    }

    /**
     * Sets up listeners for IRC events like 'registered', 'join', and 'message'.
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
            await this.messageHandler.handleMessage(event);
        });
    }

    /**
     * Connects the bot to the configured IRC server.
     */
    public connect() {
        const connectionOptions: any = {
            host: BOT_CONFIG.SERVER,
            port: BOT_CONFIG.PORT,
            nick: BOT_CONFIG.NICK,
        };

        if (BOT_CONFIG.SASL_ACCOUNT && BOT_CONFIG.SASL_PASSWORD) {
            logger.info(`Using SASL authentication for account: ${BOT_CONFIG.SASL_ACCOUNT}`);
            connectionOptions.account = {
                account: BOT_CONFIG.SASL_ACCOUNT,
                password: BOT_CONFIG.SASL_PASSWORD,
            };
        }

        this.bot.connect(connectionOptions);
    }
}
