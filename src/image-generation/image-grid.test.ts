import { join } from 'path';
import sharp from 'sharp';
import { saveImageGrid } from './image-grid';

// Mock the sharp library
jest.mock('sharp', () => {
    // Mock the sharp function itself
    const mockSharp = jest.fn();

    // Mock the instance returned by sharp()
    const mockSharpInstance = {
        metadata: jest.fn().mockResolvedValue({ width: 100, height: 100, channels: 4 }),
        composite: jest.fn().mockReturnThis(),
        webp: jest.fn().mockReturnThis(),
        toFile: jest.fn().mockResolvedValue({}),
        toBuffer: jest.fn().mockResolvedValue(Buffer.from('mocked image buffer')),
    };

    // Mock the sharp({ create: ... }) call
    const mockSharpCreateInstance = {
        composite: jest.fn().mockReturnThis(),
        webp: jest.fn().mockReturnThis(),
        toFile: jest.fn().mockResolvedValue({}),
    };

    mockSharp.mockImplementation((input) => {
        if (typeof input === 'object' && input !== null && input.create) {
            // This is the sharp({ create: ... }) call
            return mockSharpCreateInstance;
        } else if (input instanceof Buffer || typeof input === 'string' || typeof input === 'object') {
            // This is a sharp(Buffer) or sharp(string) call for individual images
            return mockSharpInstance;
        }
        return mockSharpInstance; // Default fallback
    });

    return mockSharp;
});

describe('ImageGrid', () => {
    const mockComfyUIConfig = {
        FOLDER_PATH: '/mock/output/path',
    };
    const mockClientId = 'test-client-id';

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Reset mock implementations for sharp and its methods
        const mockSharp = sharp as jest.Mock;
        mockSharp.mockClear();

        const mockSharpInstance = {
            metadata: jest.fn().mockResolvedValue({ width: 100, height: 100, channels: 4 }),
            composite: jest.fn().mockReturnThis(),
            webp: jest.fn().mockReturnThis(),
            toFile: jest.fn().mockResolvedValue({}),
            toBuffer: jest.fn().mockResolvedValue(Buffer.from('mocked image buffer')),
        };
        const mockSharpCreateInstance = {
            composite: jest.fn().mockReturnThis(),
            webp: jest.fn().mockReturnThis(),
            toFile: jest.fn().mockResolvedValue({}),
        };

        mockSharp.mockImplementation((input) => {
            if (typeof input === 'object' && input !== null && input.create) {
                return mockSharpCreateInstance;
            } else if (input instanceof Buffer || typeof input === 'string' || typeof input === 'object') {
                return mockSharpInstance;
            }
            return mockSharpInstance;
        });

        // Ensure specific methods are correctly mocked for each test if needed
        mockSharpInstance.metadata.mockResolvedValue({ width: 100, height: 100, channels: 4 });
        mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('mocked image buffer'));
        mockSharpCreateInstance.toFile.mockResolvedValue({});
    });

    // Arrange
    // Act
    // Assert
    it('should save an image grid as a WebP file', async () => {
        // Arrange
        const mockImages = [
            sharp(Buffer.from('image1')),
            sharp(Buffer.from('image2')),
            sharp(Buffer.from('image3')),
            sharp(Buffer.from('image4')),
        ];
        const expectedGridFilename = `${mockClientId}_grid.webp`;
        const expectedGridPath = join(mockComfyUIConfig.FOLDER_PATH, expectedGridFilename);

        // Act
        await saveImageGrid(mockClientId, mockImages, mockComfyUIConfig as any);

        // Assert
        // Check if sharp was called to create the canvas
        expect(sharp).toHaveBeenCalled();
        const createCallArgs = (sharp as jest.Mock).mock.calls.find(call => call[0]?.create);
        expect(createCallArgs).toBeDefined();
        expect(createCallArgs[0].create.width).toBe(200); // 2x2 grid, 100px width each
        expect(createCallArgs[0].create.height).toBe(200); // 2x2 grid, 100px height each

        // Check if composite was called for each image
        expect(sharp().composite).toHaveBeenCalledTimes(mockImages.length);

        // Check if webp was called
        expect(sharp().webp).toHaveBeenCalledWith({ quality: 80 });

        // Check if toFile was called with the correct path
        expect(sharp().toFile).toHaveBeenCalledWith(expectedGridPath);
    });

    it('should handle an empty array of images gracefully', async () => {
        // Arrange
        const mockImages: sharp.Sharp[] = [];
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        // Act
        const result = await saveImageGrid(mockClientId, mockImages, mockComfyUIConfig as any);

        // Assert
        expect(result).toBe("");
        expect(consoleWarnSpy).toHaveBeenCalledWith("No images provided for grid saving.");
        expect(sharp).not.toHaveBeenCalled(); // No sharp calls should be made
        consoleWarnSpy.mockRestore();
    });

    it('should handle errors during image grid saving', async () => {
        // Arrange
        const mockImages = [sharp(Buffer.from('image1'))];
        const errorMessage = 'Sharp grid saving error';
        const mockSharpCreateInstance = {
            composite: jest.fn().mockReturnThis(),
            webp: jest.fn().mockReturnThis(),
            toFile: jest.fn().mockRejectedValue(new Error(errorMessage)),
        };
        (sharp as jest.Mock).mockImplementation((input) => {
            if (input?.create) return mockSharpCreateInstance;
            return { toBuffer: jest.fn().mockResolvedValue(Buffer.from('mocked image buffer')) };
        });

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Act
        await expect(saveImageGrid(mockClientId, mockImages, mockComfyUIConfig as any)).rejects.toThrow(errorMessage);

        // Assert
        expect(mockSharpCreateInstance.toFile).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith(`Error saving image grid to ${join(mockComfyUIConfig.FOLDER_PATH, `${mockClientId}_grid.webp`)}:`, expect.any(Error));
        expect(consoleErrorSpy.mock.calls[0][1].message).toBe(errorMessage);

        consoleErrorSpy.mockRestore();
    });

    it('should correctly determine grid layout for different numbers of images', async () => {
        // Arrange
        const mockImages1 = [sharp(Buffer.from('img1'))]; // 1 image
        const mockImages3 = [sharp(Buffer.from('img1')), sharp(Buffer.from('img2')), sharp(Buffer.from('img3'))]; // 3 images
        const mockImages5 = [sharp(Buffer.from('img1')), sharp(Buffer.from('img2')), sharp(Buffer.from('img3')), sharp(Buffer.from('img4')), sharp(Buffer.from('img5'))]; // 5 images

        // Act
        await saveImageGrid('client1', mockImages1, mockComfyUIConfig as any);
        await saveImageGrid('client3', mockImages3, mockComfyUIConfig as any);
        await saveImageGrid('client5', mockImages5, mockComfyUIConfig as any);

        // Assert
        // For 1 image: 1x1 grid
        expect(sharp).toHaveBeenNthCalledWith(1, expect.objectContaining({ create: expect.objectContaining({ width: 100, height: 100 }) }));
        // For 3 images: 2x2 grid (ceil(sqrt(3))=2, ceil(3/2)=2)
        expect(sharp).toHaveBeenNthCalledWith(4, expect.objectContaining({ create: expect.objectContaining({ width: 200, height: 200 }) }));
        // For 5 images: 3x2 grid (ceil(sqrt(5))=3, ceil(5/3)=2)
        expect(sharp).toHaveBeenNthCalledWith(7, expect.objectContaining({ create: expect.objectContaining({ width: 300, height: 200 }) }));
    });
});
