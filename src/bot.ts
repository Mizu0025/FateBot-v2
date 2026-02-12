/**
 * Entry point for the FateBot IRC client.
 * This file initializes the FateBot client instance and triggers the connection
 * to the configured IRC server.
 */
import { FateBot } from './bot-client';

/**
 * Instantiate and connect the bot.
 */
const bot = new FateBot();
bot.connect();