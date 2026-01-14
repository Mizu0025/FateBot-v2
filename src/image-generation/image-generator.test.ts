import { ImageGenerator } from './image-generator';
import { ComfyUIClient } from './comfyui-client';
import { ModelLoader } from '../config/model-loader';
import { WorkflowLoader } from './workflow-loader';
import { PromptProcessor } from './prompt-processor';
import { ImageGrid } from './image-grid';
import * as fs from 'fs';
import { logger } from '../config/logger';
import sharp from 'sharp';
import { getDomainPath, getImageFilename } from './filename-utils';
import { FilteredPrompt } from '../types';

// Mock all dependencies
jest.mock('./comfyui-client');
jest.mock('../config/model-loader');
jest.mock('./workflow-loader');
jest.mock('./prompt-processor');
jest.mock('./image-grid');
jest.mock('fs');
jest.mock('../config/logger');
jest.mock('sharp');
jest.mock('./filename-utils');

describe('ImageGenerator', () => {
    const mockFilteredPrompt: FilteredPrompt = {
        prompt: 'test prompt',
        model: 'test-model',
        width: 512,
        height: 512,
        negative_prompt: 'bad quality',
        count: 1,
        seed: 12345
    };

    const mockModelConfig = {
        workflow: 'test-workflow',
        positive_prompt: 'positive',
        negative_prompt: 'negative',
    };

    const mockWorkflowData = { nodes: [] };
    const mockPromptData = { data: { "1": { "class_type": "KSampler" } } };
    const mockPromptId = 'test-prompt-id';

    // Mock sharp chain
    const mockSharpInstance = {
        webp: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-webp-data')),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);
        (ModelLoader.loadModelConfiguration as jest.Mock).mockResolvedValue(mockModelConfig);
        (WorkflowLoader.loadWorkflowByName as jest.Mock).mockResolvedValue(mockWorkflowData);
        (PromptProcessor.createPromptData as jest.Mock).mockReturnValue(mockPromptData);
        (getImageFilename as jest.Mock).mockReturnValue('image_1.webp');
        (getDomainPath as jest.Mock).mockImplementation((filepath) => {
            const filename = filepath.split('/').pop();
            return `https://example.com/${filename}`;
        });

        // Mock ComfyUIClient methods
        const mockClient = {
            connectWebSocket: jest.fn().mockResolvedValue(undefined),
            queuePrompt: jest.fn().mockResolvedValue(mockPromptId),
            getImagesFromWebSocket: jest.fn(),
            close: jest.fn(),
            unloadModels: jest.fn().mockResolvedValue(undefined),
        };
        (ComfyUIClient as jest.Mock).mockImplementation(() => mockClient);
    });

    describe('generateImage', () => {
        it('should generate an image and return its domain path', async () => {
            // Arrange
            const mockImages = new Map([
                ['SaveImageWebsocket', [Buffer.from('image1')]]
            ]);
            const clientInstance = new ComfyUIClient();
            (clientInstance.getImagesFromWebSocket as jest.Mock).mockResolvedValue(mockImages);
            (ComfyUIClient as jest.Mock).mockReturnValue(clientInstance);

            // Act
            const result = await ImageGenerator.generateImage(mockFilteredPrompt);

            // Assert
            expect(result).toBe('https://example.com/image_1.webp');
            expect(clientInstance.connectWebSocket).toHaveBeenCalled();
            expect(clientInstance.queuePrompt).toHaveBeenCalledWith(mockPromptData.data);
            expect(fs.writeFileSync).toHaveBeenCalled();
            expect(clientInstance.close).toHaveBeenCalled();
        });

        it('should generate an image grid and return its path when multiple images are returned', async () => {
            // Arrange
            const mockImages = new Map([
                ['SaveImageWebsocket', [Buffer.from('image1'), Buffer.from('image2')]]
            ]);
            const clientInstance = new ComfyUIClient();
            (clientInstance.getImagesFromWebSocket as jest.Mock).mockResolvedValue(mockImages);
            (ComfyUIClient as jest.Mock).mockReturnValue(clientInstance);

            (ImageGrid.generateImageGrid as jest.Mock).mockResolvedValue('/path/to/grid.webp');

            // Act
            const result = await ImageGenerator.generateImage(mockFilteredPrompt);

            // Assert
            expect(result).toBe('/path/to/grid.webp');
            expect(ImageGrid.generateImageGrid).toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
        });

        it('should throw error if modelConfig is not found', async () => {
            // Arrange
            (ModelLoader.loadModelConfiguration as jest.Mock).mockResolvedValue(null);

            // Act
            // Assert
            await expect(ImageGenerator.generateImage(mockFilteredPrompt))
                .rejects.toThrow('Model configuration not found for: test-model');
        });

        it('should throw error if workflowData fails to load', async () => {
            // Arrange
            (WorkflowLoader.loadWorkflowByName as jest.Mock).mockResolvedValue(null);

            // Act
            // Assert
            await expect(ImageGenerator.generateImage(mockFilteredPrompt))
                .rejects.toThrow('Failed to load workflow: test-workflow');
        });

        it('should throw error if it fails to queue prompt', async () => {
            // Arrange
            const clientInstance = new ComfyUIClient();
            (clientInstance.queuePrompt as jest.Mock).mockResolvedValue(null);
            (ComfyUIClient as jest.Mock).mockReturnValue(clientInstance);

            // Act
            // Assert
            await expect(ImageGenerator.generateImage(mockFilteredPrompt))
                .rejects.toThrow('Failed to queue prompt.');
        });

        it('should throw error if no images were generated (savedImagePaths is empty)', async () => {
            // Arrange
            const mockImages = new Map([
                ['SaveImageWebsocket', []]
            ]);
            const clientInstance = new ComfyUIClient();
            (clientInstance.getImagesFromWebSocket as jest.Mock).mockResolvedValue(mockImages);
            (ComfyUIClient as jest.Mock).mockReturnValue(clientInstance);

            // Act
            // Assert
            await expect(ImageGenerator.generateImage(mockFilteredPrompt))
                .rejects.toThrow('No images were generated');
        });

        it('should throw error if generateImage try-catch fails', async () => {
            // Arrange
            const testError = new Error('Unexpected error');
            (ModelLoader.loadModelConfiguration as jest.Mock).mockRejectedValue(testError);

            // Act
            // Assert
            await expect(ImageGenerator.generateImage(mockFilteredPrompt))
                .rejects.toThrow('Unexpected error');
            expect(logger.error).toHaveBeenCalledWith("Error during image generation:", testError);
        });
    });

    describe('saveImageFiles (private via generateImage)', () => {
        it('should save images to files', async () => {
            // Arrange
            const mockImages = new Map([
                ['SaveImageWebsocket', [Buffer.from('image1')]]
            ]);
            const clientInstance = new ComfyUIClient();
            (clientInstance.getImagesFromWebSocket as jest.Mock).mockResolvedValue(mockImages);
            (ComfyUIClient as jest.Mock).mockReturnValue(clientInstance);

            // Act
            await ImageGenerator.generateImage(mockFilteredPrompt);

            // Assert
            expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), expect.any(Buffer));
            expect(sharp).toHaveBeenCalledWith(Buffer.from('image1'));
        });

        it('should log warning if no imageData is returned (map key missing)', async () => {
            // Arrange
            const mockImages = new Map();
            const clientInstance = new ComfyUIClient();
            (clientInstance.getImagesFromWebSocket as jest.Mock).mockResolvedValue(mockImages);
            (ComfyUIClient as jest.Mock).mockReturnValue(clientInstance);

            // Act
            // Assert
            await expect(ImageGenerator.generateImage(mockFilteredPrompt)).rejects.toThrow();
            expect(logger.warn).toHaveBeenCalledWith("No images received from ComfyUI");
        });

        it('should log warning if imageData length is 0', async () => {
            // Arrange
            const mockImages = new Map([['SaveImageWebsocket', []]]);
            const clientInstance = new ComfyUIClient();
            (clientInstance.getImagesFromWebSocket as jest.Mock).mockResolvedValue(mockImages);
            (ComfyUIClient as jest.Mock).mockReturnValue(clientInstance);

            // Act 
            // Assert
            await expect(ImageGenerator.generateImage(mockFilteredPrompt)).rejects.toThrow();
            expect(logger.warn).toHaveBeenCalledWith("No images received from ComfyUI");
        });

        it('should log error if saving images fails in try-catch', async () => {
            // Arrange
            const mockImages = new Map([
                ['SaveImageWebsocket', [Buffer.from('image1')]]
            ]);
            const clientInstance = new ComfyUIClient();
            (clientInstance.getImagesFromWebSocket as jest.Mock).mockResolvedValue(mockImages);
            (ComfyUIClient as jest.Mock).mockReturnValue(clientInstance);

            const testError = new Error('Sharp error');
            mockSharpInstance.toBuffer.mockRejectedValue(testError);

            // Act
            // Assert
            // This should not throw from generateImage as it is swallowed in saveImageFiles loop
            // but generateImage will throw "No images were generated" because savedImagePaths will be empty
            await expect(ImageGenerator.generateImage(mockFilteredPrompt)).rejects.toThrow("No images were generated");

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error saving image'), testError);
        });
    });

    describe('unloadModels', () => {
        it('should call unloadModels on ComfyUIClient', async () => {
            // Act
            await ImageGenerator.unloadModels();

            // Assert
            const clientInstance = (ComfyUIClient as jest.Mock).mock.results[0].value;
            expect(clientInstance.unloadModels).toHaveBeenCalled();
        });
    });
});
