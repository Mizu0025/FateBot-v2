import { bool, cleanEnv, port, str } from 'envalid';
import { describe, expect, it, vi } from 'vitest';
import { posInt } from './env';

describe('env validation', () => {
    it('validates all required variables and applies defaults', () => {
        // arrange
        const inputEnv = {
            SERVER: 'testserver',
            PORT: '1234',
        };
        const validators = {
            SERVER: str({ default: 'address' }),
            PORT: port({ default: 6667 }),
        };

        // act
        const env = cleanEnv(inputEnv, validators);

        // assert
        expect(env.SERVER).toBe('testserver');
        expect(env.PORT).toBe(1234);
    });

    it('uses defaults when variables are missing', () => {
        // arrange
        const inputEnv = {};
        const validators = {
            SERVER: str({ default: 'address' }),
            PORT: port({ default: 6667 }),
        };

        // act
        const env = cleanEnv(inputEnv, validators);

        // assert
        expect(env.SERVER).toBe('address');
        expect(env.PORT).toBe(6667);
    });

    it('throws on invalid types', async () => {
        // arrange
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
            throw new Error('process.exit called');
        });
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // act & assert
        expect(() => {
            cleanEnv({ PORT: 'notanumber' }, { PORT: port() });
        }).toThrow();

        // Clean up spies
        exitSpy.mockRestore();
        errorSpy.mockRestore();
    });

    it('parses valid positive integers with posInt', () => {
        // arrange
        const inputEnv = {
            COMFYUI_IDLE_MINUTES: '30',
            COMFYUI_START_TIMEOUT_SECONDS: '60',
        };
        const validators = {
            COMFYUI_IDLE_MINUTES: posInt(),
            COMFYUI_START_TIMEOUT_SECONDS: posInt(),
        };

        // act
        const env = cleanEnv(inputEnv, validators);

        // assert
        expect(env.COMFYUI_IDLE_MINUTES).toBe(30);
        expect(env.COMFYUI_START_TIMEOUT_SECONDS).toBe(60);
    });

    it('rejects non-positive or non-integer values with posInt', () => {
        // arrange — collect validation errors via a custom reporter instead of
        // letting envalid print and exit.
        const validators = {
            COMFYUI_IDLE_MINUTES: posInt(),
        };
        const collectErrors = (value: string): string[] => {
            const messages: string[] = [];
            cleanEnv({ COMFYUI_IDLE_MINUTES: value }, validators, {
                reporter: ({ errors }) => {
                    for (const error of Object.values(errors)) {
                        if (error) {
                            messages.push(error.message);
                        }
                    }
                },
            });
            return messages;
        };

        // act & assert
        expect(collectErrors('0')).toEqual(['Expected a positive integer, got 0']);
        expect(collectErrors('-5')).toEqual(['Expected a positive integer, got -5']);
        expect(collectErrors('2.5')).toEqual(['Expected a positive integer, got 2.5']);
        expect(collectErrors('abc')).toEqual(['Expected a positive integer, got abc']);
    });
});

/**
 * P1-3 + P1-5 acceptance: the new keys (TLS, LOG_LEVEL, LOG_TO_FILE,
 * COMFYUI_START_POLL_INTERVAL_MS) are present in the validated environment with
 * the documented defaults and accept explicit overrides. The spec mirrors the
 * new keys added in P1-3/P1-5 (the full real spec would drag in dotenv + the
 * root `.env`, which isn't the intent of this test).
 */
describe('env (P1-3 + P1-5): new validated keys', () => {
    const validators = {
        PORT: port({ default: 6667 }),
        TLS: bool({ default: false }),
        LOG_LEVEL: str({ default: 'info' }),
        LOG_TO_FILE: bool({ default: false }),
        COMFYUI_START_POLL_INTERVAL_MS: posInt({ default: 2000 }),
        MODEL_CONFIG_PATH: str({ default: 'modelConfiguration.json' }),
    };

    it('applies declared defaults when the variables are missing', () => {
        const env = cleanEnv({}, validators);
        expect(env.PORT).toBe(6667);
        expect(env.TLS).toBe(false);
        expect(env.LOG_LEVEL).toBe('info');
        expect(env.LOG_TO_FILE).toBe(false);
        expect(env.COMFYUI_START_POLL_INTERVAL_MS).toBe(2000);
        expect(env.MODEL_CONFIG_PATH).toBe('modelConfiguration.json');
    });

    it('accepts explicit values and validates types', () => {
        const env = cleanEnv(
            {
                PORT: '7000',
                TLS: 'true',
                LOG_LEVEL: 'debug',
                LOG_TO_FILE: 'true',
                COMFYUI_START_POLL_INTERVAL_MS: '1500',
                MODEL_CONFIG_PATH: 'config/models.json',
            },
            validators,
        );
        expect(env.PORT).toBe(7000);
        expect(env.TLS).toBe(true);
        expect(env.LOG_LEVEL).toBe('debug');
        expect(env.LOG_TO_FILE).toBe(true);
        expect(env.COMFYUI_START_POLL_INTERVAL_MS).toBe(1500);
        expect(env.MODEL_CONFIG_PATH).toBe('config/models.json');
    });

    it('rejects a non-positive COMFYUI_START_POLL_INTERVAL_MS', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => cleanEnv({ COMFYUI_START_POLL_INTERVAL_MS: '0' }, validators)).toThrow();
        errorSpy.mockRestore();
    });

    it('rejects a non-boolean LOG_TO_FILE', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => cleanEnv({ LOG_TO_FILE: 'maybe' }, validators)).toThrow();
        errorSpy.mockRestore();
    });
});

/**
 * P2-6 acceptance: the generation retry policy keys (GENERATION_MAX_RETRIES,
 * GENERATION_RETRY_BASE_MS) are validated as positive integers, apply the
 * documented defaults, accept explicit overrides, and reject non-positive
 * values. Same approach as P1-5 — mirror the spec, don't import the live env.
 */
describe('env (P2-6): generation retry policy', () => {
    const validators = {
        GENERATION_MAX_RETRIES: posInt({ default: 2 }),
        GENERATION_RETRY_BASE_MS: posInt({ default: 2000 }),
    };

    it('applies the documented defaults when the variables are missing', () => {
        const env = cleanEnv({}, validators);
        expect(env.GENERATION_MAX_RETRIES).toBe(2);
        expect(env.GENERATION_RETRY_BASE_MS).toBe(2000);
    });

    it('honors explicit overrides', () => {
        const env = cleanEnv(
            {
                GENERATION_MAX_RETRIES: '5',
                GENERATION_RETRY_BASE_MS: '500',
            },
            validators,
        );
        expect(env.GENERATION_MAX_RETRIES).toBe(5);
        expect(env.GENERATION_RETRY_BASE_MS).toBe(500);
    });

    it('rejects a non-positive GENERATION_MAX_RETRIES', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => cleanEnv({ GENERATION_MAX_RETRIES: '0' }, validators)).toThrow();
        expect(() => cleanEnv({ GENERATION_MAX_RETRIES: '1.5' }, validators)).toThrow();
        errorSpy.mockRestore();
    });
});
