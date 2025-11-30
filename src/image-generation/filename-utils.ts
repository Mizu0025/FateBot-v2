import { COMFYUI_CONFIG } from '../config/constants';
import { logger } from '../config/logger';

export function getImageFilename(clientId: string, index: number, extension: string): string {
    return `${clientId}_${index.toString()}.${extension}`;
}

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
