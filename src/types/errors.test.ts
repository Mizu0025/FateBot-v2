import { FateBotError, UserError, SystemError } from './errors';

describe('Custom Errors', () => {
    describe('FateBotError', () => {
        it('should correctly set name and message', () => {
            const error = new FateBotError('base error');
            expect(error.name).toBe('FateBotError');
            expect(error.message).toBe('base error');
            expect(error instanceof Error).toBe(true);
            expect(error instanceof FateBotError).toBe(true);
        });
    });

    describe('UserError', () => {
        it('should correctly set name and message and inherit from FateBotError', () => {
            const error = new UserError('user input error');
            expect(error.name).toBe('UserError');
            expect(error.message).toBe('user input error');
            expect(error instanceof FateBotError).toBe(true);
            expect(error instanceof UserError).toBe(true);
        });
    });

    describe('SystemError', () => {
        it('should correctly set name, message, details and inherit from FateBotError', () => {
            const details = { status: 500, data: 'fail' };
            const error = new SystemError('system failure', details);
            expect(error.name).toBe('SystemError');
            expect(error.message).toBe('system failure');
            expect(error.details).toEqual(details);
            expect(error instanceof FateBotError).toBe(true);
            expect(error instanceof SystemError).toBe(true);
        });

        it('should work without details', () => {
            const error = new SystemError('system failure');
            expect(error.details).toBeUndefined();
        });
    });
});
