import { cleanEnv, str, port } from 'envalid';

const env = cleanEnv(process.env, {
  SERVER: str({ default: 'hayate' }),
  CHANNEL: str({ default: '#nanobot' }),
  NICK: str({ default: 'FateBot' }),
  TRIGGER_WORD: str({ default: '!fate' }),
  PORT: port({ default: 6667 }),
  COMFYUI_ADDRESS: str({ default: 'hayate' }),
  COMFYUI_PORT: port({ default: 8188 }),
  COMFYUI_DOMAIN_PATH: str({ default: 'mock_domain_path' }),
  COMFYUI_FOLDER_PATH: str({ default: '/home/mizu/Pictures/artbot/' }),
  COMFYUI_WORKFLOW_PATH: str({ default: 'src/workflows/SDXL.json' }),
  SASL_ACCOUNT: str({ default: undefined }),
  SASL_PASSWORD: str({ default: undefined }),
});

export default env;
