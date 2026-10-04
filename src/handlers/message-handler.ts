import { BOT_CONFIG } from '../config/constants';
import { logger } from '../config/logger';
import type { IrcMessageEvent } from '../types/irc';
import type { CommandHandler } from './command-handler';

const FLAG_ALIASES = new Map<string, string>([
    ['--help', '--help'],
    ['--models', '--models'],
    ['--start-comfyui', '--start-comfyui'],
    ['--stop-comfyui', '--stop-comfyui'],
    ['--delete', '--delete'],
]);

/**
 * Split the message into whitespace tokens, lowercased, and return the one
 * that matches a registered command flag — if any.
 *
 * Matching on a *whole token* (rather than substring, as the pre-plan
 * implementation did) means a prompt like `a sign that says "--delete all"`
 * no longer triggers the destructive deletion path, and case-insensitive
 * matching means `--HELP` and `--help` behave the same everywhere.
 */
function findFlagInMessage(message: string): string | null {
    const tokens = message.toLowerCase().split(/\s+/);
    for (const token of tokens) {
        const flag = FLAG_ALIASES.get(token);
        if (flag) {
            return flag;
        }
    }
    return null;
}

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
     * Filters by channel and trigger word, then routes to the appropriate
     * command (matched on a whole lowercase token) or falls back to
     * image generation.
     * @param event The message event from the IRC client.
     */
    public async handleMessage(event: IrcMessageEvent) {
        const { target, nick, message } = event;

        if (target !== BOT_CONFIG.CHANNEL || !message.toLowerCase().includes(BOT_CONFIG.TRIGGER_WORD.toLowerCase())) {
            return;
        }

        logger.debug(`Received request from ${nick}: ${message}`);

        const flagged = findFlagInMessage(message);
        const command = flagged ? this.commands.find((c) => c.flag === flagged) : undefined;

        if (command) {
            await command.handler(nick, target, message);
        } else {
            await this.commandHandler.handleGenerateImage(nick, target, message);
        }
    }
}
