/**
 * Entry point for FateBot.
 *
 * Initializes the bot, wires process-level signal + error handlers (P0-3),
 * starts the generation worker, and connects to IRC. Kept thin so the
 * shutdown logic is unit-testable in isolation (see ./shutdown.ts).
 */
import { FateBot } from './bot-client';
import { wireProcessSignals } from './shutdown';

const bot = new FateBot();
wireProcessSignals(bot);
bot.startWorkers();
bot.connect();
