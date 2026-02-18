import { cleanEnv, str, port } from 'envalid';

const env = cleanEnv(process.env, {
  SERVER: str({ default: 'address' }),
  CHANNEL: str({ default: '#channel' }),
  NICK: str({ default: 'nick' }),
  TRIGGER_WORD: str({ default: '!trigger' }),
  PORT: port({ default: 6667 }),
  COMFYUI_ADDRESS: str({ default: 'comfyAddress' }),
  COMFYUI_PORT: port({ default: 8188 }),
  COMFYUI_DOMAIN_PATH: str({ default: 'mock_domain_path' }),
  COMFYUI_FOLDER_PATH: str({ default: '/path/to/files/' }),
  COMFYUI_WORKFLOW_PATH: str({ default: 'src/workflows/workflow.json' }),
  SASL_ACCOUNT: str({ default: undefined }),
  SASL_PASSWORD: str({ default: undefined }),
});

export default env;
