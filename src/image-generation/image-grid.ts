import { join } from 'path';
import sharp from 'sharp';

export function saveImageGrid(clientId: string, images: sharp.Sharp[], comfyUIConfig: any): string {
    const gridFilename = `${clientId}_grid.webp`;
    const gridPath = join(comfyUIConfig.FOLDER_PATH, gridFilename);

    // Determine grid layout
    const numImages = images.length;
    const { cols, rows } = determineGridLayout(numImages);

    // Get image dimensions
    const { widths, heights } = getImageDimensions(images);

    // Create blank canvas
    const grid = sharp({
        create: {
            width: cols * widths[0],
            height: rows * heights[0],
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 0 }
        }
    });

    // Paste images onto grid
    await pasteImagesToGrid(images, grid, cols, widths[0], heights[0]);

    // Save as WebP
    await grid.webp({ quality: 80 }).toFile(gridPath);

    return gridPath;
}
