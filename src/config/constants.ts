
import env from './env';

/**
 * Bot connection and identification settings.
 */
export const BOT_CONFIG = {
    SERVER: env.SERVER,
    CHANNEL: env.CHANNEL,
    NICK: env.NICK,
    TRIGGER_WORD: env.TRIGGER_WORD,
    PORT: env.PORT
} as const;

/**
 * Settings for communicating with the ComfyUI backend and handling file output.
 */
export const COMFYUI_CONFIG = {
    ADDRESS: env.COMFYUI_ADDRESS,
    PORT: env.COMFYUI_PORT,
    DOMAIN_PATH: env.COMFYUI_DOMAIN_PATH,
    FOLDER_PATH: env.COMFYUI_FOLDER_PATH,
    WORKFLOW_PATH: env.COMFYUI_WORKFLOW_PATH
} as const;

/**
 * Predefined localized messages for the bot's help command.
 */
export const HELP_MESSAGES = {
    imageGeneration: `To generate an image, type: ${BOT_CONFIG.TRIGGER_WORD} <your_prompt>`,
    promptStructure: `${BOT_CONFIG.TRIGGER_WORD} <prompt_text> --width=<width> --height=<height> --model=<model> --no <negative_prompt_text> --count=<count> --seed=<seed>`,
    promptExample: 'Example:  a beautiful landscape --width=1024 --height=768 --model=epicMode --no=ugly, blurry'
} as const;

/**
 * Default fallback values for image generation parameters.
 */
export const GENERATION_DEFAULTS = {
    MODEL: 'paSanctuary',
    WIDTH: 1024,
    HEIGHT: 1024,
    COUNT: 4,
    OUTPUT_FORMAT: 'webp'
} as const;
