import { describe, expect, it } from 'vitest';
import { SystemError } from '../types/errors';
import { classifyGenerationError } from './error-utils';

describe('classifyGenerationError', () => {
    describe('network codes', () => {
        it('classifies ECONNREFUSED as retryable offline', () => {
            const result = classifyGenerationError(new SystemError('connect ECONNREFUSED', { code: 'ECONNREFUSED' }));

            expect(result.category).toBe('offline');
            expect(result.retryable).toBe(true);
            expect(result.detail).toContain('is not accepting connections');
        });

        it('classifies ECONNRESET as retryable offline', () => {
            const result = classifyGenerationError(new SystemError('socket hang up', { code: 'ECONNRESET' }));

            expect(result.category).toBe('offline');
            expect(result.retryable).toBe(true);
        });

        it('classifies ETIMEDOUT as retryable offline', () => {
            const result = classifyGenerationError(new SystemError('timeout', { code: 'ETIMEDOUT' }));

            expect(result.category).toBe('offline');
            expect(result.retryable).toBe(true);
        });

        it('classifies EPIPE as retryable offline', () => {
            const result = classifyGenerationError(new SystemError('pipe closed', { code: 'EPIPE' }));

            expect(result.category).toBe('offline');
            expect(result.retryable).toBe(true);
        });
    });

    describe('HTTP status codes (backend)', () => {
        it.each([
            [400, false], // bad request — always same on retry
            [401, false], // unauthorized — re-running won't fix
            [403, false], // forbidden — re-running won't fix
            [404, false], // missing model — re-running won't fix
            [408, true], // request timeout — may be transient
            [429, true], // rate-limited — may be transient
            [500, true], // internal server error
            [502, true], // bad gateway
            [503, true], // service unavailable
        ])('HTTP %i → retryable=%t', (status, expectedRetryable) => {
            const result = classifyGenerationError(new SystemError(`backend ${status}`, { status, text: 'some body' }));

            expect(result.category).toBe('backend');
            expect(result.retryable).toBe(expectedRetryable);
        });
    });

    describe('message-based fallbacks', () => {
        it('classifies a message containing "timeout" as retryable timeout', () => {
            const result = classifyGenerationError(new Error('WebSocket timeout waiting for images'));

            expect(result.category).toBe('timeout');
            expect(result.retryable).toBe(true);
        });

        it('falls back to "internal" and truncates long messages', () => {
            const long = 'x'.repeat(500);
            const result = classifyGenerationError(new Error(long));

            expect(result.category).toBe('internal');
            expect(result.retryable).toBe(false);
            expect(result.detail.length).toBeLessThanOrEqual(200);
        });

        it('classifies a UserError as non-retryable internal', () => {
            const result = classifyGenerationError(new Error('bad input from user'));

            expect(result.category).toBe('internal');
            expect(result.retryable).toBe(false);
        });
    });
});
