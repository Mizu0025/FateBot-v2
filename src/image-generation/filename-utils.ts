import { COMFYUI_CONFIG } from '../config/constants';

export function getImageFilename(clientId: string, index: number, extension: string): string {
    return `${clientId}_${index.toString()}.${extension}`;
}

export function getDomainPath(imagePath: string): string {
    if (!COMFYUI_CONFIG.DOMAIN_PATH) {
        console.error("Domain path is not set in the configuration.");
        throw new Error("Domain path is not set in the configuration.");
    }
    if (!COMFYUI_CONFIG.FOLDER_PATH) {
        console.error("Folder path is not set in the configuration.");
        throw new Error("Folder path is not set in the configuration.");
    }

    return imagePath.replace(COMFYUI_CONFIG.FOLDER_PATH, COMFYUI_CONFIG.DOMAIN_PATH);
}
