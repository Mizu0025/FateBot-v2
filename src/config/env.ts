import { cleanEnv, str, port } from 'envalid';

/**
 * Validates and cleans environment variables for the FateBot.
 * Uses envalid to ensure all required parameters are present with correct types.
 */
const env = cleanEnv(process.env, {
  /** IRC server address */
  SERVER: str({ default: 'hayate' }),
  /** Target IRC channel (e.g. #nanobot) */
  CHANNEL: str({ default: '#nanobot' }),
  /** Bot nickname on IRC */
  NICK: str({ default: 'FateBot' }),
  /** Keyword that triggers the bot's image generation logic */
  TRIGGER_WORD: str({ default: '!fate' }),
  /** IRC server port */
  PORT: port({ default: 6667 }),
  /** ComfyUI server address (legacy/fallback) */
  COMFYUI_ADDRESS: str({ default: 'hayate' }),
  /** ComfyUI server port (legacy/fallback) */
  COMFYUI_PORT: port({ default: 8188 }),
  /** Base domain path for static image serving */
  COMFYUI_DOMAIN_PATH: str({ default: 'mock_domain_path' }),
  /** Local folder path for image storage */
  COMFYUI_FOLDER_PATH: str({ default: '/home/mizu/Pictures/artbot/' }),
  /** Path to default workflow JSON file */
  COMFYUI_WORKFLOW_PATH: str({ default: 'src/workflows/SDXL.json' }),
  /** Full URL to the external Image Generation microservice */
  IMAGE_SERVICE_URL: str({ default: 'http://localhost:8000' }),
});

/**
 * Validated environment configuration object.
 */
export default env;
