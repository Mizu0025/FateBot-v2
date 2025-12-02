import { COMFYUI_CONFIG } from '../config/constants';
import { logger } from '../config/logger';

export function getImageFilename(index: number, extension: string): string {
    const now = new Date();

    // Format: YYYY-MM-DD_HHMMSS_microseconds_index
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}_${hours}${minutes}${seconds}_${index}.${extension}`;
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
