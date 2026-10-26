import { VramProbe } from '../managers/comfyui-vram';
import env from './env';

/**
 * Bot connection and identification settings. TLS is env-driven (P1-3):
 * it defaults on for the conventional TLS port (6697) but can be forced
 * on/off explicitly for non-standard ports.
 */
export const BOT_CONFIG = {
    SERVER: env.SERVER,
    CHANNEL: env.CHANNEL,
    NICK: env.NICK,
    TRIGGER_WORD: env.TRIGGER_WORD,
    PORT: env.PORT,
    TLS: env.TLS,
    SASL_ACCOUNT: env.SASL_ACCOUNT,
    SASL_PASSWORD: env.SASL_PASSWORD,
} as const;

/**
 * Settings for communicating with the ComfyUI backend and handling file output.
 * Kept mutable (no `as const`) so tests can override values between cases.
 */
export type ComfyUiConfig = {
    ADDRESS: string;
    PORT: number;
    DOMAIN_PATH: string;
    FOLDER_PATH: string;
    /** Directory containing ComfyUI workflow JSON files (one per model name). */
    WORKFLOW_PATH: string;
    /** Path to the model configuration JSON file. */
    MODEL_CONFIG_PATH: string;
    /** Max ms to wait for the WebSocket to complete its handshake. */
    WS_CONNECT_TIMEOUT_MS: number;
    /** Max ms to wait for a queued prompt's images to stream back. */
    WS_IMAGE_TIMEOUT_MS: number;
};

export const COMFYUI_CONFIG: ComfyUiConfig = {
    ADDRESS: env.COMFYUI_ADDRESS,
    PORT: env.COMFYUI_PORT,
    DOMAIN_PATH: env.COMFYUI_DOMAIN_PATH,
    FOLDER_PATH: env.COMFYUI_FOLDER_PATH,
    WORKFLOW_PATH: env.COMFYUI_WORKFLOW_PATH,
    MODEL_CONFIG_PATH: env.MODEL_CONFIG_PATH,
    WS_CONNECT_TIMEOUT_MS: env.COMFYUI_WS_CONNECT_TIMEOUT_MS,
    WS_IMAGE_TIMEOUT_MS: env.COMFYUI_WS_IMAGE_TIMEOUT_MS,
};

/**
 * Control-plane settings for the user systemd service that runs ComfyUI.
 * The bot starts the service on demand and stops it after idle periods.
 */
export type ComfyUiServiceConfig = {
    /** Name of the user systemd unit (without the `.service` suffix). */
    UNIT_NAME: string;
    /** Minutes the queue may stay idle before the service is stopped. */
    IDLE_MINUTES: number;
    /** Max seconds to wait for the service to report readiness after start. */
    START_TIMEOUT_SECONDS: number;
    /** Seconds between readiness polls while waiting for the service to come up. */
    START_POLL_INTERVAL_MS: number;
};

export const COMFYUI_SERVICE_CONFIG: ComfyUiServiceConfig = {
    UNIT_NAME: env.COMFYUI_UNIT_NAME,
    IDLE_MINUTES: env.COMFYUI_IDLE_MINUTES,
    START_TIMEOUT_SECONDS: env.COMFYUI_START_TIMEOUT_SECONDS,
    START_POLL_INTERVAL_MS: env.COMFYUI_START_POLL_INTERVAL_MS,
};

/**
 * Predefined localized messages for the bot's help command.
 */
export const HELP_MESSAGES = {
    imageGeneration: `To generate an image, type: ${BOT_CONFIG.TRIGGER_WORD} <your_prompt>`,
    promptStructure: `${BOT_CONFIG.TRIGGER_WORD} <prompt_text> --width=<width> --height=<height> --model=<model> --no <negative_prompt_text> --count=<count> --seed=<seed>`,
    promptExample: 'Example:  a beautiful landscape --width=1024 --height=768 --model=epicMode --no=ugly, blurry',
} as const;

/**
 * Default fallback values for image generation parameters.
 */
export const GENERATION_DEFAULTS = {
    MODEL: 'paSanctuary',
    WIDTH: 1024,
    HEIGHT: 1024,
    COUNT: 4,
    OUTPUT_FORMAT: 'webp',
} as const;

/**
 * Generation retry policy (P2-6). A retryable (transient) failure is
 * re-attempted up to {@link MAX_RETRIES} more times; the worker waits
 * {@link BASE_MS} before the first retry and grows that wait for each further
 * retry. Surfaced so the worker can be driven by tests while production reads
 * the env-validated values.
 */
export type RetryConfig = {
    /** Maximum retries *after* the initial attempt (e.g. 2 => 3 total attempts). */
    MAX_RETRIES: number;
    /** Base backoff in ms before the first retry; grows per further retry. */
    BASE_MS: number;
};

export const RETRY_CONFIG: RetryConfig = {
    MAX_RETRIES: env.GENERATION_MAX_RETRIES,
    BASE_MS: env.GENERATION_RETRY_BASE_MS,
};

/**
 * VRAM headroom gate. Before a generation starts (and before ComfyUI is
 * started at all) the worker checks that at least {@link MIN_FREE_GIB} GiB of
 * GPU memory are free; if not, the job is refused immediately with a
 * retryable `InsufficientVRAM` error instead of burning ~20 s of GPU time and
 * dying mid-decode with CUDA out-of-memory. `0` disables the check (a machine
 * whose GPU is dedicated to ComfyUI never sees contention). The read itself is
 * best-effort: a machine where no GPU tool reports anything falls back to
 * "unknown" and the check is skipped rather than blocking generations.
 *
 * Kept mutable (like the ComfyUI config) so tests can override thresholds and
 * stub the reader.
 */
export type VramGateConfig = {
    /** Minimum free GPU memory (GiB) required to start a generation. 0 disables. */
    MIN_FREE_GIB: number;
    /**
     * Reads (total, free) GiB of GPU memory from the platform tooling.
     * `null` means "no usable measurement" — the caller skips the check.
     */
    read: () => Promise<{ totalGiB: number; freeGiB: number } | null>;
};

export const VRAM_GATE_CONFIG: VramGateConfig = {
    MIN_FREE_GIB: env.GENERATION_VRAM_MIN_FREE_GIB,
    read: VramProbe.readGpuMemory,
};
