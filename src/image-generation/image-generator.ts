import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { COMFYUI_CONFIG, GENERATION_DEFAULTS } from '../config/constants';
import { logger } from '../config/logger';
import { ModelLoader } from '../config/model-loader';
import type { FilteredPrompt, PromptData } from '../types';
import { SystemError, UserError } from '../types/errors';
import { ComfyUIClient } from './comfyui-client';
import { getDomainPath, getImageFilename } from './filename-utils';
import { ImageGrid } from './image-grid';
import { PromptProcessor } from './prompt-processor';
import { WorkflowLoader } from './workflow-loader';

/**
 * The outcome of a single image generation request.
 * @see ImageGenerator.generateImage
 */
export interface GenerationResult {
    /** URL (or grid path) the worker posts back to the channel. */
    url: string;
    /** How many of the requested images actually saved, e.g. `"4/4"` or `"3/4"`. */
    saved: string;
}

/**
 * Orchestrates the entire image generation process including model configuration,
 * workflow loading, ComfyUI interaction, and image saving.
 */
export class ImageGenerator {
    /**
     * The outcome of one generation: where to find the result image, plus how
     * many of the requested images actually saved (e.g. `"3/4"`) so the
     * worker can phrase a partial ("3 of 4 saved — one failed, see logs")
     * vs. a clean success.
     */
    public static async generateImage(filteredPrompt: FilteredPrompt): Promise<GenerationResult> {
        const client = new ComfyUIClient();

        try {
            logger.info('Starting image generation process');

            // Load model configuration first
            const modelName = filteredPrompt.model || GENERATION_DEFAULTS.MODEL;
            logger.info(`Using model: ${modelName}`);
            const modelConfig = await ModelLoader.loadModelConfiguration(modelName);

            if (!modelConfig) {
                const available = await ModelLoader.getModelsList().catch(() => 'unknown');
                throw new UserError(`Unknown model "${modelName}". Available models: ${available}`);
            }

            // Load workflow based on model configuration
            const workflowName = modelConfig.workflow;
            logger.info(`Loading workflow: ${workflowName}`);
            const workflowData = await WorkflowLoader.loadWorkflowByName(workflowName);
            if (!workflowData) {
                throw new SystemError(`Workflow "${workflowName}" failed to load. Check the workflows directory.`);
            }
            logger.debug('Workflow data loaded successfully');

            // Create prompt data
            const promptData: PromptData = PromptProcessor.createPromptData(workflowData);

            // Update prompt with model configuration
            PromptProcessor.updatePromptWithModelConfig(promptData, modelConfig, filteredPrompt);

            // Connect to ComfyUI
            logger.debug('Connecting to ComfyUI WebSocket');
            await client.connectWebSocket();

            // Queue the prompt
            const promptId = await client.queuePrompt(promptData.data);
            logger.info(`Prompt queued with ID: ${promptId}`);

            // Get images from WebSocket
            const images = await client.getImagesFromWebSocket(promptId);
            const imageCount = images.get('SaveImageWebsocket')?.length || 0;
            logger.info(`Received ${imageCount} image(s) from ComfyUI`);

            // Save individual images (counting per-image failures — P0-4).
            const imageData = images.get('SaveImageWebsocket') ?? [];
            const { saved: savedImagePaths } = await ImageGenerator.saveImageFiles(imageData, promptId);

            // If nothing saved, treat the whole generation as a failure so the
            // worker's retry (which gets a fresh service-start + connection) can
            // engage instead of reporting a clean success with no image (P0-4).
            if (savedImagePaths.length === 0) {
                throw new SystemError('All generated images failed to save (check the bot + sharp logs).');
            }

            const savedOfTotal = `${savedImagePaths.length}/${imageData.length}`;

            // Generate grid from saved images
            if (savedImagePaths.length > 1) {
                logger.info(`Generating image grid from ${savedImagePaths.length} images`);
                const gridPath = await ImageGrid.generateImageGrid(savedImagePaths, promptId);
                return { url: gridPath, saved: savedOfTotal };
            } else {
                return { url: getDomainPath(savedImagePaths[0]), saved: savedOfTotal };
            }
        } catch (error) {
            logger.error('Error during image generation:', error);
            throw error;
        } finally {
            client.close();
        }
    }

    /**
     * Saves the provided image data buffers to files on disk.
     *
     * Per-image failures are counted, not swallowed (P0-4): the caller
     * decides what a partial or total failure means. A total failure (0 of N
     * saved) is `failed === N`, which the caller turns into a `SystemError`
     * so the worker retries.
     * @param imageData The `SaveImageWebsocket` buffers produced by ComfyUI.
     * @param promptId The ID of the prompt that generated these images.
     * @returns The absolute paths that saved, plus a count of the ones that did not.
     */
    private static async saveImageFiles(
        imageData: Buffer[],
        promptId: string,
    ): Promise<{ saved: string[]; failed: number }> {
        const savedImages: string[] = [];
        let failed = 0;

        if (imageData.length === 0) {
            logger.warn('No images received from ComfyUI');
            return { saved: [], failed: 0 };
        }

        for (let index = 0; index < imageData.length; index++) {
            const imageBytes = imageData[index];
            // Index 1,2,... for individual images (grid will be 0)
            const filename = getImageFilename(promptId, index + 1, GENERATION_DEFAULTS.OUTPUT_FORMAT);
            const filepath = join(COMFYUI_CONFIG.FOLDER_PATH, filename);

            try {
                const webpImage = await sharp(imageBytes).webp().toBuffer();
                writeFileSync(filepath, webpImage);
                savedImages.push(filepath);
                logger.debug(`Saved image: ${filename}`);
            } catch (error) {
                failed++;
                logger.error(`Error saving image ${filename}:`, error);
            }
        }

        if (failed > 0 && failed < imageData.length) {
            // Some images failed but at least one saved: the result is still
            // usable, so surface the shortfall explicitly rather than acting
            // as if the whole batch succeeded (P0-4).
            logger.warn(
                `${failed} of ${imageData.length} image(s) failed to save; continuing with ${savedImages.length}.`,
            );
        }

        return { saved: savedImages, failed };
    }
}
