export function getImageFilename(clientId: string, index: number, extension: string): string {
    return `${clientId}_${index.toString().padStart(3, '0')}.${extension}`;
}