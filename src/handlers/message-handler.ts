import { logger } from '../config/logger';
import { BOT_CONFIG } from '../config/constants';
import { IrcMessageEvent } from '../types/irc';
import { CommandHandler } from './command-handler';

/**
 * Handles incoming messages from the IRC server and routes them 
 * to the command handler (command flag or image generation).
 */
export class MessageHandler {
    private commands: { flag: string; handler: (nick: string, target: string, message: string) => Promise<void> }[];

    /**
     * @param commandHandler The handler for specific bot commands.
     */
    constructor(private commandHandler: CommandHandler) {
        this.commands = [
            { flag: '--help', handler: (n) => this.commandHandler.handleHelp(n) },
            { flag: '--models', handler: (n) => this.commandHandler.handleListModels(n) },
            { flag: '--start-comfyui', handler: (n) => this.commandHandler.handleStartComfyui(n) },
            { flag: '--stop-comfyui', handler: (n) => this.commandHandler.handleStopComfyui(n) },
            { flag: '--delete', handler: (n, t, m) => this.commandHandler.handleDeleteImages(n, t, m) },
        ];
    }

    /**
     * Processes an incoming message event.
     * Filters by channel and trigger word, then routes to the appropriate command.
     * @param event The message event from the IRC client.
     */
    public async handleMessage(event: IrcMessageEvent) {
        const { target, nick, message } = event;

        if (target !== BOT_CONFIG.CHANNEL || !message.toLowerCase().includes(BOT_CONFIG.TRIGGER_WORD)) {
            return;
        }

        logger.debug(`Received request from ${nick}: ${message}`);

        const command = this.commands.find(c => message.includes(c.flag));

        if (command) {
            await command.handler(nick, target, message);
        } else {
            await this.commandHandler.handleGenerateImage(nick, target, message);
        }
    }
}