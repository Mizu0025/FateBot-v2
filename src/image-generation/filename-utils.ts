import { COMFYUI_CONFIG } from '../config/constants';
import { logger } from '../config/logger';

/**
 * Generates a consistent filename for a generated image.
 * @param promptId The ID of the prompt that created the image.
 * @param index The image index (useful for batches).
 * @param extension The file extension (e.g., 'webp').
 * @returns A formatted filename string.
 */
export function getImageFilename(promptId: string, index: number, extension: string): string {
    return `${promptId}_${index}.${extension}`;
}

/**
 * Converts a local filesystem path to a publicly accessible URL/domain path.
 * @param filepath The absolute local path to the image.
 * @returns The public domain URL for the image.
 * @throws Error if configuration is missing.
 */
export function getDomainPath(filepath: string): string {
    if (!COMFYUI_CONFIG.DOMAIN_PATH) {
        logger.error("Domain path is not set in the configuration.");
        throw new Error("Domain path not configured.");
    }
    if (!COMFYUI_CONFIG.FOLDER_PATH) {
        logger.error("Folder path is not set in the configuration.");
        throw new Error("Folder path not configured.");
    }
    const filename = filepath.split('/').pop();
    return `${COMFYUI_CONFIG.DOMAIN_PATH}${filename}`;
}
