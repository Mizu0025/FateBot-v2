import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';

export function getImageFilename(clientId: string, index: number): string {
    return `${clientId}_${index}.webp`;
}
