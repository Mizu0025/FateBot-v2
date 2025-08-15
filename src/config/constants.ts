export const BOT_CONFIG = {
    SERVER: process.env.SERVER || 'hayate',
    CHANNEL: process.env.CHANNEL || '#nanobot',
    NICK: 'FateBot',
    TRIGGER_WORD: '!fate',
    PORT: process.env.PORT || 6667
} as const;

export const COMFYUI_CONFIG = {
    ADDRESS: process.env.COMFYUI_ADDRESS || 'hayate:8188',
    DOMAIN_PATH: process.env.COMFYUI_DOMAIN_PATH || 'mock_domain_path',
    FOLDER_PATH: process.env.COMFYUI_FOLDER_PATH || '/home/mizu/Pictures/artbot/',
    WORKFLOW_PATH: process.env.COMFYUI_WORKFLOW_PATH || 'src/workflows/SDXL.json'
} as const;

export const HELP_MESSAGES = {
    imageGeneration: `To generate an image, type: ${BOT_CONFIG.TRIGGER_WORD} <your_prompt>`,
    promptStructure: `${BOT_CONFIG.TRIGGER_WORD} <prompt_text> --width=<width> --height=<height> --model=<model> --no <negative_prompt_text> --count=<count> --seed=<seed>`,
    promptExample: 'Example:  a beautiful landscape --width=1024 --height=768 --model=epicMode --no=ugly, blurry'
} as const; 
