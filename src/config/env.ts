import { bool, cleanEnv, makeValidator, port, str } from 'envalid';

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

/**
 * Whether the configured IRC port is the conventional TLS port. Used as the
 * default for the `TLS` flag so a bare `PORT=6697` is treated as
 * TLS-secured without also setting `TLS` explicitly (P1-3). Read from the raw
 * environment because it must be decided before `cleanEnv` runs. When `PORT`
 * is unset, its effective default is 6667 (plain), so the TLS default is false.
 */
const PORT_IS_TLS_DEFAULT = process.env.PORT !== undefined ? Number(process.env.PORT) === 6697 : false;

const env = cleanEnv(process.env, {
    SERVER: str({ default: 'address' }),
    CHANNEL: str({ default: '#channel' }),
    NICK: str({ default: 'nick' }),
    TRIGGER_WORD: str({ default: '!trigger' }),
    PORT: port({ default: 6667 }),
    // IRC TLS. Defaults on for the conventional TLS port 6697; override
    // explicitly for TLS on a non-standard port or to force it off (P1-3).
    TLS: bool({ default: PORT_IS_TLS_DEFAULT }),
    COMFYUI_ADDRESS: str({ default: 'comfyAddress' }),
    COMFYUI_PORT: port({ default: 8188 }),
    COMFYUI_DOMAIN_PATH: str({ default: 'mock_domain_path' }),
    COMFYUI_FOLDER_PATH: str({ default: '/path/to/files/' }),
    /** Directory containing ComfyUI workflow JSON files (one per model name). */
    COMFYUI_WORKFLOW_PATH: str({ default: 'src/workflows' }),
    /** Path to the model configuration JSON file (P2-3). */
    MODEL_CONFIG_PATH: str({ default: 'modelConfiguration.json' }),
    COMFYUI_UNIT_NAME: str({ default: 'comfyui' }),
    COMFYUI_IDLE_MINUTES: posInt({ default: 10 }),
    COMFYUI_START_TIMEOUT_SECONDS: posInt({ default: 120 }),
    // WebSocket client timeouts (milliseconds).
    COMFYUI_WS_CONNECT_TIMEOUT_MS: posInt({ default: 10000 }),
    COMFYUI_WS_IMAGE_TIMEOUT_MS: posInt({ default: 300000 }),
    // Generation retry policy (P2-6): how many times a *retryable* (transient)
    // failure is re-attempted after the first attempt, and the base backoff the
    // worker waits before each retry (each retry multiplies the base, with
    // jitter). Defaults give 3 total attempts with ~2 s then ~8 s waits.
    GENERATION_MAX_RETRIES: posInt({ default: 2 }),
    GENERATION_RETRY_BASE_MS: posInt({ default: 2000 }),
    SASL_ACCOUNT: str({ default: undefined }),
    SASL_PASSWORD: str({ default: undefined }),
    // Logging (validated here so logger.ts reads a single source of truth).
    LOG_LEVEL: str({ default: 'info' }),
    LOG_TO_FILE: bool({ default: false }),
    // ComfyUI service control-plane.
    COMFYUI_START_POLL_INTERVAL_MS: posInt({ default: 2000 }),
});

export default env;
