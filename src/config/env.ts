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
  /** Host for the external Image Generation microservice */
  IMAGE_SERVICE_HOST: str({ default: 'http://localhost' }),
  /** Port for the external Image Generation microservice */
  IMAGE_SERVICE_PORT: port({ default: 8000 }),
});

/**
 * Validated environment configuration object.
 */
export default env;
