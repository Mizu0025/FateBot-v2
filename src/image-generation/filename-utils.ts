export function getImageFilename(clientId: string, index: number): string {
    return `${clientId}_${index.toString().padStart(3, '0')}.png`;
} 