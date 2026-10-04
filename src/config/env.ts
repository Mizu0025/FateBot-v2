import { cleanEnv, makeValidator, port, str } from 'envalid';

/**
 * Validator for positive integers (used for configurable timeouts/durations).
 * @throws EnvError when the value is not a whole number > 0.
 */
export const posInt = makeValidator<number>((input: string) => {
    const value = Number(input);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Expected a positive integer, got ${input}`);
    }
    return value;
});

const env = cleanEnv(process.env, {
    SERVER: str({ default: 'address' }),
    CHANNEL: str({ default: '#channel' }),
    NICK: str({ default: 'nick' }),
    TRIGGER_WORD: str({ default: '!trigger' }),
    PORT: port({ default: 6667 }),
    COMFYUI_ADDRESS: str({ default: 'comfyAddress' }),
    COMFYUI_PORT: port({ default: 8188 }),
    COMFYUI_DOMAIN_PATH: str({ default: 'mock_domain_path' }),
    COMFYUI_FOLDER_PATH: str({ default: '/path/to/files/' }),
    COMFYUI_WORKFLOW_PATH: str({ default: 'src/workflows/workflow.json' }),
    COMFYUI_UNIT_NAME: str({ default: 'comfyui' }),
    COMFYUI_IDLE_MINUTES: posInt({ default: 10 }),
    COMFYUI_START_TIMEOUT_SECONDS: posInt({ default: 120 }),
    // WebSocket client timeouts (milliseconds).
    COMFYUI_WS_CONNECT_TIMEOUT_MS: posInt({ default: 10000 }),
    COMFYUI_WS_IMAGE_TIMEOUT_MS: posInt({ default: 300000 }),
    SASL_ACCOUNT: str({ default: undefined }),
    SASL_PASSWORD: str({ default: undefined }),
});

export default env;
