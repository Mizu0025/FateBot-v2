import { logger } from './config/logger';

/**
 * The narrow subset of FateBot the shutdown path needs — no dependency on
 * the full class keeps this module side-effect-free and unit-testable.
 */
interface ShUTDOWNTarget {
    shutdown(signalName?: string): Promise<void>;
}

/**
 * Registers process-level signal + error handlers for a graceful FateBot
 * shutdown (P0-3).
 *
 * - SIGINT / SIGTERM → run {@link ShUTDOWNTarget.shutdown}, then
 *   `signalProcess.exit(0)`. A second signal while the first shutdown is
 *   still in flight forces `signalProcess.exit(1)` rather than restarting
 *   teardown (the common case: `systemctl` / `docker` sends SIGTERM right
 *   after SIGINT).
 * - uncaughtException / unhandledRejection → log and continue (defence-
 *   in-depth; the generation worker already has its own catch-all, and a
 *   stray non-fatal fault shouldn't take the process down silently).
 *
 * The process object is injectable so the registration logic can be unit-
 * tested without touching the real `process`.
 */
export function wireProcessSignals(bot: ShUTDOWNTarget, signalProcess: NodeJS.Process = process): void {
    let shutdownStarted = false;

    const onSignal = (signalName: string): void => {
        if (shutdownStarted) {
            logger.info(`Repeat ${signalName} received; already shutting down — forcing exit`);
            signalProcess.exit(1);
            return;
        }
        shutdownStarted = true;
        void (async () => {
            try {
                await bot.shutdown(signalName);
                logger.info(`FateBot exited cleanly on ${signalName}`);
                signalProcess.exit(0);
            } catch (error) {
                logger.error(`Error during ${signalName} shutdown:`, error);
                signalProcess.exit(1);
            }
        })();
    };

    signalProcess.on('SIGINT', () => onSignal('SIGINT'));
    signalProcess.on('SIGTERM', () => onSignal('SIGTERM'));
    signalProcess.on('uncaughtException', (error) => {
        // Log-and-continue: a stray exception in one handler is not
        // necessarily fatal — the user can still stop cleanly with a signal.
        logger.error('Uncaught exception (process continues):', error);
    });
    signalProcess.on('unhandledRejection', (reason) => {
        logger.error('Unhandled promise rejection (process continues):', reason);
    });
}
