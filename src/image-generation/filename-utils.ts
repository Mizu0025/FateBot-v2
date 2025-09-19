import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';

export function getImageFilename(clientId: string, index: number): string {
    // Ensure the filename reflects the WebP format
    return `${clientId}_${index}.webp`;
}
