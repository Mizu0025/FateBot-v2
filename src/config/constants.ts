
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
    promptStructure: `${BOT_CONFIG.TRIGGER_WORD} <prompt_text> --width=<width> --height=<height> --model=<model> --no <negative_prompt_text> --count=<count> --seed=<seed>`,
    promptExample: 'Example:  a beautiful landscape --width=1024 --height=768 --model=epicMode --no=ugly, blurry'
} as const; 
