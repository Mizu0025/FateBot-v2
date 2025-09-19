import { join } from 'path';
import sharp from 'sharp';
import { saveImage, ImageBytes } from './image-generator';
import { getImageFilename } from './filename-utils';

// Mock the sharp library
jest.mock('sharp', () => {
    const mockSharpInstance = {
        webp: jest.fn().mockReturnThis(),
        withMetadata: jest.fn().mockReturnThis(),
        toFile: jest.fn().mockResolvedValue({}), // Mock successful file saving
    };
    return jest.fn(() => mockSharpInstance);
});

// Mock fs.writeFileSync if it were used directly, but sharp handles file writing
// jest.mock('fs', () => ({
//     writeFileSync: jest.fn(),
// }));

// Mock getImageFilename to control its output
jest.mock('./filename-utils', () => ({
    getImageFilename: jest.fn(),
}));

describe('ImageGenerator', () => {
    const mockComfyUIConfig = {
        FOLDER_PATH: '/mock/output/path',
    };
    const mockClientId = 'test-client-id';
    const mockImageBytes: ImageBytes = {
        data: Buffer.from('fake image data'),
        width: 512,
        height: 512,
    };
    const mockIndex = 0;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Default mock implementation for getImageFilename
        (getImageFilename as jest.Mock).mockReturnValue(`${mockClientId}_${mockIndex + 1}.webp`);

        // Ensure sharp mock is reset and returns a new instance for each test
        (sharp as jest.Mock).mockClear();
        const mockSharpInstance = (sharp as jest.Mock).mock.results[0]?.value || {
            webp: jest.fn().mockReturnThis(),
            withMetadata: jest.fn().mockReturnThis(),
            toFile: jest.fn().mockResolvedValue({}),
        };
        mockSharpInstance.webp.mockReturnThis();
        mockSharpInstance.withMetadata.mockReturnThis();
        mockSharpInstance.toFile.mockResolvedValue({});
    });

    // Arrange
    // Act
    // Assert
    it('should save an image as WebP with metadata', async () => {
        // Arrange
        const expectedFilePath = join(mockComfyUIConfig.FOLDER_PATH, `${mockClientId}_${mockIndex + 1}.webp`);
        const expectedMetadata = {
            author: 'FateBot',
            creationDate: expect.any(String), // Expect a string for the date
        };

        // Act
        saveImage(mockClientId, mockImageBytes, mockIndex, mockComfyUIConfig as any);

        // Assert
        // Check if sharp was called with the image data
        expect(sharp).toHaveBeenCalledWith(Buffer.from('fake image data'));

        // Get the mock instance of sharp
        const sharpInstance = (sharp as jest.Mock).mock.results[0]?.value;
        expect(sharpInstance).toBeDefined();

        // Check if webp was called with correct options
        expect(sharpInstance.webp).toHaveBeenCalledWith({ quality: 80 });

        // Check if withMetadata was called with correct metadata
        expect(sharpInstance.withMetadata).toHaveBeenCalledWith({ exif: expectedMetadata });

        // Check if toFile was called with the correct filepath
        expect(sharpInstance.toFile).toHaveBeenCalledWith(expectedFilePath);

        // Check if getImageFilename was called correctly
        expect(getImageFilename).toHaveBeenCalledWith(mockClientId, mockIndex + 1);
    });

    it('should handle errors during image saving', async () => {
        // Arrange
        const errorMessage = 'Sharp processing error';
        const sharpInstance = (sharp as jest.Mock).mock.results[0]?.value;
        sharpInstance.toFile.mockRejectedValue(new Error(errorMessage));

        // Spy on console.error to check if it's called
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Act
        saveImage(mockClientId, mockImageBytes, mockIndex, mockComfyUIConfig as any);

        // Assert
        // Wait for the promise to settle (though saveImage is not async, the sharp promise is)
        await new Promise(process.nextTick);

        expect(sharpInstance.toFile).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith(`Error saving image ${join(mockComfyUIConfig.FOLDER_PATH, `${mockClientId}_${mockIndex + 1}.webp`)}:`, expect.any(Error));
        expect(consoleErrorSpy.mock.calls[0][1].message).toBe(errorMessage);

        // Restore console.error
        consoleErrorSpy.mockRestore();
    });
});
