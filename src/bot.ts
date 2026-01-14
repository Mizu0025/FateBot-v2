/**
 * Entry point for FateBot.
 * Initializes the FateBot client and starts the connection.
 */
import { FateBot } from './bot-client';

const bot = new FateBot();
bot.connect();