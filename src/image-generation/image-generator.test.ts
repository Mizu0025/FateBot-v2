import * as fs from 'node:fs';
import sharp from 'sharp';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { logger } from '../config/logger';
import { ModelLoader } from '../config/model-loader';
import type { FilteredPrompt } from '../types';
import { SystemError } from '../types/errors';
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
            expect(result).toEqual({ url: 'https://example.com/image_1.webp', saved: '1/1' });
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
            expect(result).toEqual({ url: '/path/to/grid.webp', saved: '2/2' });
            expect(ImageGrid.generateImageGrid).toHaveBeenCalledWith(
                [expect.any(String), expect.any(String)],
                mockPromptId,
            );
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
                'All generated images failed to save',
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
            // Assert — with 1 image and a total failure, generateImage throws
            // a SystemError (P0-4) so the worker retries rather than reporting
            // a clean success with zero images. No partial-save warn here (a
            // total failure is a different code path from a partial failure).
            await expect(ImageGenerator.generateImage(mockFilteredPrompt)).rejects.toThrow(SystemError);
            await expect(ImageGenerator.generateImage(mockFilteredPrompt)).rejects.toThrow(
                'All generated images failed to save',
            );

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error saving image'), testError);
        });

        it('should warn and report honest partial count when some images fail to save (P0-4)', async () => {
            // Arrange — 4 requested, 2 fail to save, 2 succeed. The worker
            // must be told '2/4' (not a clean success) so it can phrase the
            // partial-save notice back to the channel user.
            // Reset toBuffer's implementation so this test doesn't inherit a
            // reject from a prior test (clearAllMocks only clears call history).
            mockSharpInstance.toBuffer.mockReset().mockResolvedValue(Buffer.from('mock-webp-data'));

            const mockImages = new Map([
                ['SaveImageWebsocket', [Buffer.from('a'), Buffer.from('b'), Buffer.from('c'), Buffer.from('d')]],
            ]);
            const clientInstance = new ComfyUIClient();
            (clientInstance.getImagesFromWebSocket as Mock).mockResolvedValue(mockImages);
            (ComfyUIClient as unknown as Mock).mockImplementation(function () {
                return clientInstance;
            });

            const w = fs.writeFileSync as unknown as Mock;
            w.mockImplementationOnce(() => {
                throw new Error('EPERM: encoder failed');
            });
            w.mockImplementationOnce(() => {
                throw new Error('EPERM: encoder failed');
            });
            // Remaining calls succeed (return undefined).

            // Act
            const result = await ImageGenerator.generateImage(mockFilteredPrompt);

            // Assert — 2 of 4 saved; the worker is informed via the result.
            expect(result.saved).toBe('2/4');
            expect(fs.writeFileSync).toHaveBeenCalledTimes(4);
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('2 of 4 image(s) failed to save'));
        });
    });

    // Note: the old `unloadModels` tests were removed along with the static
    // method — VRAM is now freed by stopping the ComfyUI user service (see
    // comfyui-service-manager.test.ts).
});
