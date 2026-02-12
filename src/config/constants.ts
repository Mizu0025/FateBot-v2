
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
 * Settings for communicating with the ComfyUI backend and handling file output.
 */
export const COMFYUI_CONFIG = {
    /** ComfyUI server address */
    ADDRESS: env.COMFYUI_ADDRESS,
    /** ComfyUI server port */
    PORT: env.COMFYUI_PORT,
    /** URL path prefix for served images */
    DOMAIN_PATH: env.COMFYUI_DOMAIN_PATH,
    /** Absolute local system path to output directory */
    FOLDER_PATH: env.COMFYUI_FOLDER_PATH,
    /** Path to default workflow file */
    WORKFLOW_PATH: env.COMFYUI_WORKFLOW_PATH,
    /** API endpoint for the image microservice */
    IMAGE_SERVICE_URL: env.IMAGE_SERVICE_URL
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
 * Default fallback values for image generation parameters.
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
