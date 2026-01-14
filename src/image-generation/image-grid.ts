import sharp from 'sharp';
import { join } from 'path';
import { COMFYUI_CONFIG } from '../config/constants';
import { getDomainPath, getImageFilename } from './filename-utils';
import { logger } from '../config/logger';

/**
 * Handles the creation of composite image grids (montages) from multiple individual images
 * using the Sharp image processing library.
 */
export class ImageGrid {
    /**
     * Opens all images from the provided filepaths using Sharp.
     * @param filepaths Array of absolute paths to images.
     * @returns Array of Sharp image instances.
     */
    private static async openImages(filepaths: string[]): Promise<sharp.Sharp[]> {
        return filepaths.map(filepath => sharp(filepath));
    }

    /**
     * Retrieves the width and height of each image in the provided array.
     * @param images Array of Sharp image instances.
     * @returns An object containing arrays of widths and heights.
     */
    private static async getImageDimensions(images: sharp.Sharp[]): Promise<{ widths: number[], heights: number[] }> {
        const dimensions = await Promise.all(images.map(img => img.metadata()));
        const widths = dimensions.map(d => d.width || 0);
        const heights = dimensions.map(d => d.height || 0);
        return { widths, heights };
    }

    /**
     * Calculates the optimal number of columns and rows for a grid based on image count.
     * @param numImages Total number of images to place in the grid.
     * @returns An object with cols and rows.
     */
    private static determineGridLayout(numImages: number): { cols: number, rows: number } {
        const cols = Math.ceil(Math.sqrt(numImages));
        const rows = Math.ceil(numImages / cols);
        return { cols, rows };
    }

    /**
     * Initializes a transparent canvas of the appropriate size for the grid.
     * @param cols Number of columns.
     * @param rows Number of rows.
     * @param maxWidth Width of the widest image.
     * @param maxHeight Height of the tallest image.
     * @returns A Sharp instance representing the blank canvas.
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
     * Composes the individual images onto the blank grid canvas.
     * @param images Array of source images.
     * @param grid The blank canvas instance.
     * @param cols Grid column count.
     * @param maxWidth Target width for each cell.
     * @param maxHeight Target height for each cell.
     * @returns The Sharp instance containing the composed grid.
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
     * Saves the final grid image to the configured output folder.
     * @param grid The Sharp instance containing the final grid.
     * @param promptId The prompt ID for filename generation.
     * @returns The absolute path to the saved file.
     */
    private static async saveGrid(grid: sharp.Sharp, promptId: string): Promise<string> {
        const gridFilename = getImageFilename(promptId, 0, 'webp');
        const gridPath = join(COMFYUI_CONFIG.FOLDER_PATH, gridFilename);
        await grid.toFile(gridPath);
        return gridPath;
    }

    /**
     * Orchestrates the grid generation process from a list of local file paths.
     * @param filepaths Array of local image file paths.
     * @returns The public URL/domain path to the generated grid.
     * @throws Error if no filepaths are provided.
     */
    public static async generateImageGrid(filepaths: string[]): Promise<string> {
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