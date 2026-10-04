import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { logger } from './config/logger';
import { wireProcessSignals } from './shutdown';

vi.mock('./config/logger');

/** A stand-in that exposes the narrow ShUTDOWNTarget surface. */
const makeFateBot = (shutdown: (signalName?: string) => Promise<void>) => ({
    async shutdown(signalName?: string) {
        return shutdown(signalName);
    },
});

describe('wireProcessSignals', () => {
    let fakeProcess: { on: Mock; exit: Mock };

    beforeEach(() => {
        vi.clearAllMocks();
        fakeProcess = {
            on: vi.fn(),
            exit: vi.fn(),
        };
    });

    const handlerFor = (event: string): ((...args: unknown[]) => void) => {
        const match = fakeProcess.on.mock.calls.find((c) => c[0] === event);
        if (!match) {
            throw new Error(`no handler registered for ${event}`);
        }
        return match[1] as (...args: unknown[]) => void;
    };

    it('registers handlers for SIGINT, SIGTERM, uncaughtException and unhandledRejection', () => {
        const bot = makeFateBot(async () => {});
        wireProcessSignals(bot, fakeProcess as unknown as NodeJS.Process);

        const events = fakeProcess.on.mock.calls.map((call) => call[0]);
        expect(events).toContain('SIGINT');
        expect(events).toContain('SIGTERM');
        expect(events).toContain('uncaughtException');
        expect(events).toContain('unhandledRejection');
    });

    it('on SIGINT: runs shutdown then exits 0', async () => {
        let shutdownRan = false;
        const bot = makeFateBot(async () => {
            shutdownRan = true;
        });
        wireProcessSignals(bot, fakeProcess as unknown as NodeJS.Process);

        handlerFor('SIGINT')('SIGINT');
        await new Promise((r) => setTimeout(r, 20));

        expect(shutdownRan).toBe(true);
        expect(fakeProcess.exit).toHaveBeenCalledWith(0);
    });

    it('on SIGTERM (without a prior SIGINT): runs shutdown then exits 0', async () => {
        let shutdownRan = false;
        const bot = makeFateBot(async () => {
            shutdownRan = true;
        });
        wireProcessSignals(bot, fakeProcess as unknown as NodeJS.Process);

        handlerFor('SIGTERM')('SIGTERM');
        await new Promise((r) => setTimeout(r, 20));

        expect(shutdownRan).toBe(true);
        expect(fakeProcess.exit).toHaveBeenCalledWith(0);
    });

    it('a second signal while the first shutdown is still in flight: exits 1 without re-running shutdown', async () => {
        // The first SIGINT's shutdown never resolves, so when the follow-up
        // SIGTERM fires we must exit(1) rather than start teardown again.
        const hang = vi.fn().mockImplementation(() => new Promise<void>(() => {}));
        const bot = makeFateBot(hang);
        wireProcessSignals(bot, fakeProcess as unknown as NodeJS.Process);

        handlerFor('SIGINT')('SIGINT');
        handlerFor('SIGTERM')('SIGTERM');

        await new Promise((r) => setTimeout(r, 20));
        expect(hang).toHaveBeenCalledTimes(1);
        expect(fakeProcess.exit).toHaveBeenCalledWith(1);
    });

    it('if shutdown throws, exits 1', async () => {
        const bot = makeFateBot(async () => {
            throw new Error('shutdown blew up');
        });
        wireProcessSignals(bot, fakeProcess as unknown as NodeJS.Process);

        handlerFor('SIGINT')('SIGINT');
        await new Promise((r) => setTimeout(r, 20));

        expect(fakeProcess.exit).toHaveBeenCalledWith(1);
    });

    it('uncaughtException: logs and does NOT exit (defence-in-depth)', () => {
        const bot = makeFateBot(async () => {});
        wireProcessSignals(bot, fakeProcess as unknown as NodeJS.Process);

        const err = new Error('stray top-level exception');
        handlerFor('uncaughtException')(err);

        expect(fakeProcess.exit).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith('Uncaught exception (process continues):', err);
    });

    it('unhandledRejection: logs and does NOT exit (defence-in-depth)', () => {
        const bot = makeFateBot(async () => {});
        wireProcessSignals(bot, fakeProcess as unknown as NodeJS.Process);

        const reason = new Error('a promise fell through the cracks');
        handlerFor('unhandledRejection')(reason);

        expect(fakeProcess.exit).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith('Unhandled promise rejection (process continues):', reason);
    });
});
