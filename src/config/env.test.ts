import { cleanEnv, port, str } from 'envalid';
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
