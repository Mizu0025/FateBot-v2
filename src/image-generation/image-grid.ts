import sharp from 'sharp';
import { join } from 'path';
import { COMFYUI_CONFIG } from '../config/constants';
import { getDomainPath, getImageFilename } from './filename-utils';
import { logger } from '../config/logger';

export class ImageGrid {
    /**
     * Opens all images from the provided filepaths.
     */
    private static async openImages(filepaths: string[]): Promise<sharp.Sharp[]> {
        return filepaths.map(filepath => sharp(filepath));
    }

    /**
     * Gets the dimensions of each image.
     */
    private static async getImageDimensions(images: sharp.Sharp[]): Promise<{ widths: number[], heights: number[] }> {
        const dimensions = await Promise.all(images.map(img => img.metadata()));
        const widths = dimensions.map(d => d.width || 0);
        const heights = dimensions.map(d => d.height || 0);
        return { widths, heights };
    }

    /**
     * Determines the grid layout based on the number of images.
     */
    private static determineGridLayout(numImages: number): { cols: number, rows: number } {
        const cols = Math.ceil(Math.sqrt(numImages));
        const rows = Math.ceil(numImages / cols);
        return { cols, rows };
    }

    /**
     * Creates a blank canvas for the grid.
     */
    private static createBlankCanvas(cols: number, rows: number, maxWidth: number, maxHeight: number): sharp.Sharp {
        const gridWidth = cols * maxWidth;
        const gridHeight = rows * maxHeight;
        return sharp({
            create: {
                width: gridWidth,
                height: gridHeight,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 0 }
            }
        });
    }

    /**
     * Pastes each image into the grid.
     */
    private static async pasteImagesToGrid(
        images: sharp.Sharp[],
        grid: sharp.Sharp,
        cols: number,
        maxWidth: number,
        maxHeight: number
    ): Promise<sharp.Sharp> {
        const composites = [];

        for (let index = 0; index < images.length; index++) {
            const row = Math.floor(index / cols);
            const col = index % cols;
            const xOffset = col * maxWidth;
            const yOffset = row * maxHeight;

            composites.push({
                input: await images[index].toBuffer(),
                left: xOffset,
                top: yOffset
            });
        }

        return grid.composite(composites);
    }

    /**
     * Saves the grid to a file.
     */
    private static async saveGrid(grid: sharp.Sharp, promptId: string): Promise<string> {
        const gridFilename = getImageFilename(promptId, 0, 'webp');
        const gridPath = join(COMFYUI_CONFIG.FOLDER_PATH, gridFilename);
        await grid.toFile(gridPath);
        return gridPath;
    }

    /**
     * Generates a grid of images based on the filepaths provided.
     */
    static async generateImageGrid(filepaths: string[]): Promise<string> {
        if (filepaths.length === 0) {
            throw new Error("No filepaths provided for grid generation");
        }

        // Extract promptId from the first filename
        const firstFile = filepaths[0].split('/').pop() || '';
        const promptId = firstFile.split('_')[0];

        // Open all images
        const images = await this.openImages(filepaths);

        // Get dimensions
        const { widths, heights } = await this.getImageDimensions(images);

        // Determine grid layout
        const numImages = images.length;
        const { cols, rows } = this.determineGridLayout(numImages);

        // Find max dimensions
        const maxWidth = Math.max(...widths);
        const maxHeight = Math.max(...heights);

        // Create grid
        const grid = this.createBlankCanvas(cols, rows, maxWidth, maxHeight);

        // Paste images into grid
        const finalGrid = await this.pasteImagesToGrid(images, grid, cols, maxWidth, maxHeight);

        // Save grid as index 0
        const gridPath = await this.saveGrid(finalGrid, promptId);

        // Get domain path
        const domainPath = getDomainPath(gridPath);

        logger.info("Image grid generated and saved");
        return domainPath;
    }
}