
import env from './env';

/**
 * Bot connection and identification settings.
 */
export const BOT_CONFIG = {
    /** IRC Server hostname */
    SERVER: env.SERVER,
    /** IRC Channel name */
    CHANNEL: env.CHANNEL,
    /** Bot nick name */
    NICK: env.NICK,
    /** Command prefix trigger */
    TRIGGER_WORD: env.TRIGGER_WORD,
    /** IRC Server port */
    PORT: env.PORT
} as const;

/**
 * Settings for communicating with the external Image Generation microservice.
 */
export const IMAGE_SERVICE_CONFIG = {
    /** Host for the image microservice */
    HOST: env.IMAGE_SERVICE_HOST,
    /** Port for the image microservice */
    PORT: env.IMAGE_SERVICE_PORT,
    /** Full API base URL */
    URL: `${env.IMAGE_SERVICE_HOST}:${env.IMAGE_SERVICE_PORT}`
} as const;

/**
 * Predefined localized messages for the bot's help command.
 */
export const HELP_MESSAGES = {
    /** General instructions message */
    imageGeneration: `To generate an image, type: ${BOT_CONFIG.TRIGGER_WORD} <your_prompt>`,
    /** Full syntax description */
    promptStructure: `${BOT_CONFIG.TRIGGER_WORD} <prompt_text> --width=<width> --height=<height> --model=<model> --no <negative_prompt_text> --count=<count> --seed=<seed>`,
    /** Example command message */
    promptExample: 'Example:  a beautiful landscape --width=1024 --height=768 --model=epicMode --no=ugly, blurry'
} as const;

/**
 * Default fallback values for image generation parameters. (Legacy - mostly handled by service now)
 */
export const GENERATION_DEFAULTS = {
    /** Fallback AI model name */
    MODEL: 'paSanctuary',
    /** Fallback image width */
    WIDTH: 1024,
    /** Fallback image height */
    HEIGHT: 1024,
    /** Fallback batch count */
    COUNT: 4,
    /** Preferred image file extension */
    OUTPUT_FORMAT: 'webp'
} as const;
