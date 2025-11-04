import { cleanEnv, str, port } from 'envalid';

const env = cleanEnv(process.env, {
  SERVER:        str({ default: 'hayate' }),
  CHANNEL:       str({ default: '#nanobot' }),
  NICK:          str({ default: 'FateBot' }),
  TRIGGER_WORD:  str({ default: '!fate' }),
  PORT:          port({ default: 6667 }),
  COMFYUI_ADDRESS:    str({ default: 'hayate:8188' }),
  COMFYUI_DOMAIN_PATH: str({ default: 'mock_domain_path' }),
  COMFYUI_FOLDER_PATH: str({ default: '/home/mizu/Pictures/artbot/' }),
});

export default env;
