
import env from './env';

export const BOT_CONFIG = {
    SERVER: env.SERVER,
    CHANNEL: env.CHANNEL,
    NICK: env.NICK,
    TRIGGER_WORD: env.TRIGGER_WORD,
    PORT: env.PORT
} as const;

export const COMFYUI_CONFIG = {
    ADDRESS: env.COMFYUI_ADDRESS,
    DOMAIN_PATH: env.COMFYUI_DOMAIN_PATH,
    FOLDER_PATH: env.COMFYUI_FOLDER_PATH,
    WORKFLOW_PATH: env.COMFYUI_WORKFLOW_PATH
} as const;

export const HELP_MESSAGES = {
    imageGeneration: `To generate an image, type: ${BOT_CONFIG.TRIGGER_WORD} <your_prompt>`,
    promptStructure: `${BOT_CONFIG.TRIGGER_WORD} <prompt_text> [-w|--width <num>] [-h|--height <num>] [-m|--model <name>] [-n|--neg <text>] [-c|--count <num>] [-s|--seed <num>]`,
    promptExample: `Example: ${BOT_CONFIG.TRIGGER_WORD} a beautiful landscape -w 832 -h 1216 --model epicMode --neg ugly, blurry -c 2`
} as const;

export const GENERATION_DEFAULTS = {
    MODEL: 'paSanctuary',
    WIDTH: 1024,
    HEIGHT: 1024,
    COUNT: 4,
    OUTPUT_FORMAT: 'webp'
} as const; 
