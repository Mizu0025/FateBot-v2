export const BOT_CONFIG = {
    SERVER: process.env.SERVER || 'hayate', // Now loaded from env
    CHANNEL: process.env.CHANNEL || '#nanobot', // Now loaded from env
    NICK: 'FateBotTS',
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
    promptStructure: `Prompt structure: '${BOT_CONFIG.TRIGGER_WORD}' <positive_text> --width=<w> --height=<h> --model=<m> --no=<negative_text>`,
    promptExample: 'Example:  a beautiful landscape --width=1024 --height=768 --model=epicMode --no=ugly, blurry'
} as const; 