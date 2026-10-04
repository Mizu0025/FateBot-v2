import * as fs from 'node:fs';
import sharp from 'sharp';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { logger } from '../config/logger';
import { ModelLoader } from '../config/model-loader';
import type { FilteredPrompt } from '../types';
import { ComfyUIClient } from './comfyui-client';
import { getDomainPath, getImageFilename } from './filename-utils';
import { ImageGenerator } from './image-generator';
import { ImageGrid } from './image-grid';
import { PromptProcessor } from './prompt-processor';
import { WorkflowLoader } from './workflow-loader';

// Mock all dependencies
vi.mock('./comfyui-client');
vi.mock('../config/model-loader');
vi.mock('./workflow-loader');
vi.mock('./prompt-processor');
vi.mock('./image-grid');
vi.mock('fs');
vi.mock('../config/logger');
vi.mock('sharp');
vi.mock('./filename-utils');

describe('ImageGenerator', () => {
    const mockFilteredPrompt: FilteredPrompt = {
        prompt: 'test prompt',
        model: 'test-model',
        width: 512,
        height: 512,
        negative_prompt: 'bad quality',
        count: 1,
        seed: 12345,
    };

    const mockModelConfig = {
        workflow: 'test-workflow',
        positive_prompt: 'positive',
        negative_prompt: 'negative',
    };

    const mockWorkflowData = { nodes: [] };
    const mockPromptData = { data: { '1': { class_type: 'KSampler' } } };
    const mockPromptId = 'test-prompt-id';

    // Mock sharp chain
    const mockSharpInstance = {
        webp: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-webp-data')),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (sharp as unknown as Mock).mockReturnValue(mockSharpInstance);
        (ModelLoader.loadModelConfiguration as Mock).mockResolvedValue(mockModelConfig);
        (WorkflowLoader.loadWorkflowByName as Mock).mockResolvedValue(mockWorkflowData);
        (PromptProcessor.createPromptData as Mock).mockReturnValue(mockPromptData);
        (getImageFilename as Mock).mockReturnValue('image_1.webp');
        (getDomainPath as Mock).mockImplementation((filepath) => {
            const filename = filepath.split('/').pop();
            return `https://example.com/${filename}`;
        });

        // Mock ComfyUIClient methods
        const mockClient = {
            connectWebSocket: vi.fn().mockResolvedValue(undefined),
            queuePrompt: vi.fn().mockResolvedValue(mockPromptId),
            getImagesFromWebSocket: vi.fn(),
            close: vi.fn(),
        };
        (ComfyUIClient as unknown as Mock).mockImplementation(function () {
            return mockClient;
        });
    });

    describe('generateImage', () => {
        it('should generate an image and return its domain path', async () => {
            // Arrange
            const mockImages = new Map([['SaveImageWebsocket', [Buffer.from('image1')]]]);
            const clientInstance = new ComfyUIClient();
            (clientInstance.getImagesFromWebSocket as Mock).mockResolvedValue(mockImages);
            (ComfyUIClient as unknown as Mock).mockImplementation(function () {
                return clientInstance;
            });

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
            const mockImages = new Map([['SaveImageWebsocket', [Buffer.from('image1'), Buffer.from('image2')]]]);
            const clientInstance = new ComfyUIClient();
            (clientInstance.getImagesFromWebSocket as Mock).mockResolvedValue(mockImages);
            (ComfyUIClient as unknown as Mock).mockImplementation(function () {
                return clientInstance;
            });

            (ImageGrid.generateImageGrid as Mock).mockResolvedValue('/path/to/grid.webp');

            // Act
            const result = await ImageGenerator.generateImage(mockFilteredPrompt);

            // Assert
            expect(result).toBe('/path/to/grid.webp');
            expect(ImageGrid.generateImageGrid).toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
        });

        it('should throw error if modelConfig is not found', async () => {
            // Arrange
            (ModelLoader.loadModelConfiguration as Mock).mockResolvedValue(null);
            (ModelLoader.getModelsList as Mock).mockResolvedValue('model-a, model-b');

            // Act
            // Assert
            await expect(ImageGenerator.generateImage(mockFilteredPrompt)).rejects.toThrow(
                'Unknown model "test-model". Available models: model-a, model-b',
            );
        });

        it('should throw error if workflowData fails to load', async () => {
            // Arrange
            (WorkflowLoader.loadWorkflowByName as Mock).mockResolvedValue(null);

            // Act
            // Assert
            await expect(ImageGenerator.generateImage(mockFilteredPrompt)).rejects.toThrow(
                'Workflow "test-workflow" failed to load. Check the workflows directory.',
            );
        });

        it('should throw error if it fails to queue prompt', async () => {
            // Arrange — queuePrompt now rejects on failure (it no longer resolves
            // a bare `null`), and generateImage must surface that failure (P1-6).
            const clientInstance = new ComfyUIClient();
            (clientInstance.queuePrompt as Mock).mockRejectedValue(new Error('ComfyUI backend returned status 500'));
            (ComfyUIClient as unknown as Mock).mockImplementation(function () {
                return clientInstance;
            });

            // Act
            // Assert
            await expect(ImageGenerator.generateImage(mockFilteredPrompt)).rejects.toThrow(
                'ComfyUI backend returned status 500',
            );
        });

        it('should throw error if no images were generated (savedImagePaths is empty)', async () => {
            // Arrange
            const mockImages = new Map([['SaveImageWebsocket', []]]);
            const clientInstance = new ComfyUIClient();
            (clientInstance.getImagesFromWebSocket as Mock).mockResolvedValue(mockImages);
            (ComfyUIClient as unknown as Mock).mockImplementation(function () {
                return clientInstance;
            });

            // Act
            // Assert
            await expect(ImageGenerator.generateImage(mockFilteredPrompt)).rejects.toThrow(
                'ComfyUI finished but produced no images',
            );
        });

        it('should throw error if generateImage try-catch fails', async () => {
            // Arrange
            const testError = new Error('Unexpected error');
            (ModelLoader.loadModelConfiguration as Mock).mockRejectedValue(testError);

            // Act
            // Assert
            await expect(ImageGenerator.generateImage(mockFilteredPrompt)).rejects.toThrow('Unexpected error');
            expect(logger.error).toHaveBeenCalledWith('Error during image generation:', testError);
        });
    });

    describe('saveImageFiles (private via generateImage)', () => {
        it('should save images to files', async () => {
            // Arrange
            const mockImages = new Map([['SaveImageWebsocket', [Buffer.from('image1')]]]);
            const clientInstance = new ComfyUIClient();
            (clientInstance.getImagesFromWebSocket as Mock).mockResolvedValue(mockImages);
            (ComfyUIClient as unknown as Mock).mockImplementation(function () {
                return clientInstance;
            });

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
            (clientInstance.getImagesFromWebSocket as Mock).mockResolvedValue(mockImages);
            (ComfyUIClient as unknown as Mock).mockImplementation(function () {
                return clientInstance;
            });

            // Act
            // Assert
            await expect(ImageGenerator.generateImage(mockFilteredPrompt)).rejects.toThrow();
            expect(logger.warn).toHaveBeenCalledWith('No images received from ComfyUI');
        });

        it('should log warning if imageData length is 0', async () => {
            // Arrange
            const mockImages = new Map([['SaveImageWebsocket', []]]);
            const clientInstance = new ComfyUIClient();
            (clientInstance.getImagesFromWebSocket as Mock).mockResolvedValue(mockImages);
            (ComfyUIClient as unknown as Mock).mockImplementation(function () {
                return clientInstance;
            });

            // Act
            // Assert
            await expect(ImageGenerator.generateImage(mockFilteredPrompt)).rejects.toThrow();
            expect(logger.warn).toHaveBeenCalledWith('No images received from ComfyUI');
        });

        it('should log error if saving images fails in try-catch', async () => {
            // Arrange
            const mockImages = new Map([['SaveImageWebsocket', [Buffer.from('image1')]]]);
            const clientInstance = new ComfyUIClient();
            (clientInstance.getImagesFromWebSocket as Mock).mockResolvedValue(mockImages);
            (ComfyUIClient as unknown as Mock).mockImplementation(function () {
                return clientInstance;
            });

            const testError = new Error('Sharp error');
            mockSharpInstance.toBuffer.mockRejectedValue(testError);

            // Act
            // Assert
            // This should not throw from generateImage as it is swallowed in saveImageFiles loop
            // but generateImage will throw because savedImagePaths will be empty
            await expect(ImageGenerator.generateImage(mockFilteredPrompt)).rejects.toThrow(
                'ComfyUI finished but produced no images',
            );

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error saving image'), testError);
        });
    });

    // Note: the old `unloadModels` tests were removed along with the static
    // method — VRAM is now freed by stopping the ComfyUI user service (see
    // comfyui-service-manager.test.ts).
});
