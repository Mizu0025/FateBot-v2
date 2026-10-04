import env from './env';

/**
 * Bot connection and identification settings.
 */
export const BOT_CONFIG = {
    SERVER: env.SERVER,
    CHANNEL: env.CHANNEL,
    NICK: env.NICK,
    TRIGGER_WORD: env.TRIGGER_WORD,
    PORT: env.PORT,
    SASL_ACCOUNT: env.SASL_ACCOUNT,
    SASL_PASSWORD: env.SASL_PASSWORD,
} as const;

/**
 * Settings for communicating with the ComfyUI backend and handling file output.
 * Kept mutable (no `as const`) so tests can override values between cases.
 */
export type ComfyUiConfig = {
    ADDRESS: string;
    PORT: number;
    DOMAIN_PATH: string;
    FOLDER_PATH: string;
    WORKFLOW_PATH: string;
    /** Max ms to wait for the WebSocket to complete its handshake. */
    WS_CONNECT_TIMEOUT_MS: number;
    /** Max ms to wait for a queued prompt's images to stream back. */
    WS_IMAGE_TIMEOUT_MS: number;
};

export const COMFYUI_CONFIG: ComfyUiConfig = {
    ADDRESS: env.COMFYUI_ADDRESS,
    PORT: env.COMFYUI_PORT,
    DOMAIN_PATH: env.COMFYUI_DOMAIN_PATH,
    FOLDER_PATH: env.COMFYUI_FOLDER_PATH,
    WORKFLOW_PATH: env.COMFYUI_WORKFLOW_PATH,
    WS_CONNECT_TIMEOUT_MS: env.COMFYUI_WS_CONNECT_TIMEOUT_MS,
    WS_IMAGE_TIMEOUT_MS: env.COMFYUI_WS_IMAGE_TIMEOUT_MS,
};

/**
 * Control-plane settings for the user systemd service that runs ComfyUI.
 * The bot starts the service on demand and stops it after idle periods.
 */
export type ComfyUiServiceConfig = {
    /** Name of the user systemd unit (without the `.service` suffix). */
    UNIT_NAME: string;
    /** Minutes the queue may stay idle before the service is stopped. */
    IDLE_MINUTES: number;
    /** Max seconds to wait for the service to report readiness after start. */
    START_TIMEOUT_SECONDS: number;
    /** Seconds between readiness polls while waiting for the service to come up. */
    START_POLL_INTERVAL_MS: number;
};

export const COMFYUI_SERVICE_CONFIG: ComfyUiServiceConfig = {
    UNIT_NAME: env.COMFYUI_UNIT_NAME,
    IDLE_MINUTES: env.COMFYUI_IDLE_MINUTES,
    START_TIMEOUT_SECONDS: env.COMFYUI_START_TIMEOUT_SECONDS,
    START_POLL_INTERVAL_MS: 2000,
};

/**
 * Predefined localized messages for the bot's help command.
 */
export const HELP_MESSAGES = {
    imageGeneration: `To generate an image, type: ${BOT_CONFIG.TRIGGER_WORD} <your_prompt>`,
    promptStructure: `${BOT_CONFIG.TRIGGER_WORD} <prompt_text> --width=<width> --height=<height> --model=<model> --no <negative_prompt_text> --count=<count> --seed=<seed>`,
    promptExample: 'Example:  a beautiful landscape --width=1024 --height=768 --model=epicMode --no=ugly, blurry',
} as const;

/**
 * Default fallback values for image generation parameters.
 */
export const GENERATION_DEFAULTS = {
    MODEL: 'paSanctuary',
    WIDTH: 1024,
    HEIGHT: 1024,
    COUNT: 4,
    OUTPUT_FORMAT: 'webp',
} as const;
