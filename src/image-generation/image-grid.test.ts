import { ImageGrid } from './image-grid';
import sharp from 'sharp';
import { join } from 'path';
import { getDomainPath, getImageFilename } from './filename-utils';
import { logger } from '../config/logger';

// Mock all dependencies
jest.mock('sharp');
jest.mock('path');
jest.mock('./filename-utils');
jest.mock('../config/logger');
jest.mock('../config/constants', () => ({
    COMFYUI_CONFIG: {
        FOLDER_PATH: '/mock/folder'
    }
}));

describe('ImageGrid', () => {
    const mockSharpInstance = {
        metadata: jest.fn(),
        toBuffer: jest.fn(),
        composite: jest.fn().mockReturnThis(),
        toFile: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);
        (join as jest.Mock).mockImplementation((...args) => args.join('/'));
        (getImageFilename as jest.Mock).mockReturnValue('promptid_0.webp');
        (getDomainPath as jest.Mock).mockReturnValue('http://domain.com/promptid_0.webp');
        mockSharpInstance.metadata.mockResolvedValue({ width: 512, height: 512 });
        mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('data'));
        mockSharpInstance.toFile.mockResolvedValue(undefined);
    });

    describe('generateImageGrid', () => {
        const filepaths = ['/path/to/promptid_1.webp', '/path/to/promptid_2.webp', '/path/to/promptid_3.webp', '/path/to/promptid_4.webp'];

        it('openImages opens an image from a provided filepath', async () => {
            // Arrange 
            // Act
            await ImageGrid.generateImageGrid([filepaths[0]]);

            // Assert
            expect(sharp).toHaveBeenCalledWith(filepaths[0]);
        });

        it('getImageDimensions returns image dimensions', async () => {
            // Arrange
            // Act
            await ImageGrid.generateImageGrid([filepaths[0]]);

            // Assert
            expect(mockSharpInstance.metadata).toHaveBeenCalled();
        });

        it('determineGridLayout returns cols and rows', async () => {
            // Arrange
            const paths = filepaths.slice(0, 4); // 4 images -> 2x2 grid

            // Act
            await ImageGrid.generateImageGrid(paths);

            // Assert
            // 2 cols * 512 width = 1024
            expect(sharp).toHaveBeenCalledWith(expect.objectContaining({
                create: expect.objectContaining({ width: 1024, height: 1024 })
            }));
        });

        it('createBlankCanvas returns a sharp canvas output', async () => {
            // Arrange
            // Act
            const result = await ImageGrid.generateImageGrid([filepaths[0]]);

            // Assert
            expect(sharp).toHaveBeenCalledWith(expect.objectContaining({ create: expect.any(Object) }));
            expect(result).toBe('http://domain.com/promptid_0.webp');
        });

        it('pasteImagesToGrid returns a grid composite', async () => {
            // Arrange 
            // Act
            await ImageGrid.generateImageGrid(filepaths.slice(0, 2));

            // Assert
            expect(mockSharpInstance.composite).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({ left: 0, top: 0 }),
                expect.objectContaining({ left: 512, top: 0 })
            ]));
        });

        it('saveGrid saves images to a path', async () => {
            // Arrange
            // Act
            await ImageGrid.generateImageGrid([filepaths[0]]);

            // Assert
            expect(mockSharpInstance.toFile).toHaveBeenCalledWith('/mock/folder/promptid_0.webp');
        });

        it('generateImageGrid returns a domainPath for the generated grid image', async () => {
            // Arrange
            // Act
            const result = await ImageGrid.generateImageGrid([filepaths[0]]);

            // Assert
            expect(result).toBe('http://domain.com/promptid_0.webp');
            expect(logger.info).toHaveBeenCalledWith("Image grid generated and saved");
        });

        it('should throw error if filepaths is empty', async () => {
            // Arrange
            const emptyPaths: string[] = [];

            // Act
            // Assert
            await expect(ImageGrid.generateImageGrid(emptyPaths)).rejects.toThrow("No filepaths provided for grid generation");
        });
    });
});
