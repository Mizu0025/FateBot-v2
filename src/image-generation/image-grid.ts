import { join } from 'path';
import sharp from 'sharp';

// Helper function to determine grid layout
function determineGridLayout(numImages: number): { cols: number; rows: number } {
    const cols = Math.ceil(Math.sqrt(numImages));
    const rows = Math.ceil(numImages / cols);
    return { cols, rows };
}

// Helper function to get image dimensions
function getImageDimensions(images: sharp.Sharp[]): { widths: number[]; heights: number[] } {
    const widths: number[] = [];
    const heights: number[] = [];
    for (const img of images) {
        const metadata = img.metadata; // Access metadata directly if already loaded
        widths.push(metadata.width || 0);
        heights.push(metadata.height || 0);
    }
    // For simplicity, assume all images in the grid have the same dimensions
    // In a real-world scenario, you might need to resize or handle varying dimensions
    return { widths, heights: heights.map(() => heights[0]) };
}

// Helper function to paste images onto the grid
async function pasteImagesToGrid(images: sharp.Sharp[], grid: sharp.Sharp, cols: number, imageWidth: number, imageHeight: number): Promise<void> {
    let currentRow = 0;
    let currentCol = 0;

    for (const img of images) {
        await grid.composite([
            {
                input: await img.toBuffer(),
                top: currentRow * imageHeight,
                left: currentCol * imageWidth,
            },
        ]);

        currentCol++;
        if (currentCol >= cols) {
            currentCol = 0;
            currentRow++;
        }
    }
}

export async function saveImageGrid(clientId: string, images: sharp.Sharp[], comfyUIConfig: any): Promise<string> {
    const gridFilename = `${clientId}_grid.webp`;
    const gridPath = join(comfyUIConfig.FOLDER_PATH, gridFilename);

    if (images.length === 0) {
        console.warn("No images provided for grid saving.");
        return "";
    }

    // Determine grid layout
    const numImages = images.length;
    const { cols, rows } = determineGridLayout(numImages);

    // Get image dimensions (assuming all images have the same dimensions for simplicity)
    const firstImageMetadata = await images[0].metadata();
    const imageWidth = firstImageMetadata.width || 1024; // Default if metadata not available
    const imageHeight = firstImageMetadata.height || 1024; // Default if metadata not available

    // Create blank canvas
    const grid = sharp({
        create: {
            width: cols * imageWidth,
            height: rows * imageHeight,
            channels: 4, // RGBA
            background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        }
    });

    // Paste images onto grid
    await pasteImagesToGrid(images, grid, cols, imageWidth, imageHeight);

    // Save as WebP
    try {
        await grid.webp({ quality: 80 }).toFile(gridPath);
        console.log(`Image grid saved successfully as ${gridPath}`);
        return gridPath;
    } catch (err) {
        console.error(`Error saving image grid to ${gridPath}:`, err);
        throw err; // Re-throw to indicate failure
    }
}
