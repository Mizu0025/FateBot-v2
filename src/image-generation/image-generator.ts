import { writeFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { FilteredPrompt, PromptData } from '../types';
import { ModelLoader } from '../config/model-loader';
import { PromptProcessor } from './prompt-processor';
import { ComfyUIClient } from './comfyui-client';
import { getDomainPath, getImageFilename } from './filename-utils';
import { ImageGrid } from './image-grid';
import { WorkflowLoader } from './workflow-loader';
import { COMFYUI_CONFIG, GENERATION_DEFAULTS } from '../config/constants';
import { RuntimeConfig } from '../config/runtime-config';
import { logger } from '../config/logger';

export class ImageGenerator {
    /**
     * Generates one or more images based on the given filtered prompt.
     */
    static async generateImage(filteredPrompt: FilteredPrompt): Promise<string> {
        const client = new ComfyUIClient();

        try {
            logger.info("Starting image generation process");

            // Load model configuration first
            const modelName = filteredPrompt.model || RuntimeConfig.defaultModel;
            logger.info(`Using model: ${modelName}`);
            const modelConfig = await ModelLoader.loadModelConfiguration(modelName);

            if (!modelConfig) {
                throw new Error(`Model configuration not found for: ${modelName}`);
            }

            // Load workflow based on model configuration
            const workflowName = modelConfig.workflow;
            logger.info(`Loading workflow: ${workflowName}`);
            const workflowData = await WorkflowLoader.loadWorkflowByName(workflowName);
            if (!workflowData) {
                throw new Error(`Failed to load workflow: ${workflowName}`);
            }
            logger.debug("Workflow data loaded successfully");

            // Create prompt data
            const promptData: PromptData = PromptProcessor.createPromptData(workflowData);

            // Update prompt with model configuration
            PromptProcessor.updatePromptWithModelConfig(promptData, modelConfig, filteredPrompt);

            // Connect to ComfyUI
            logger.debug("Connecting to ComfyUI WebSocket");
            await client.connectWebSocket();

            // Queue the prompt
            const promptId = await client.queuePrompt(promptData.data);
            if (!promptId) {
                throw new Error("Failed to queue prompt.");
            }
            logger.info(`Prompt queued with ID: ${promptId}`);

            // Get images from WebSocket
            const images = await client.getImagesFromWebSocket(promptId);
            const imageCount = images.get('SaveImageWebsocket')?.length || 0;
            logger.info(`Received ${imageCount} image(s) from ComfyUI`);

            // Save individual images
            const savedImagePaths = await this.saveImageFiles(images);

            // Generate grid from saved images
            if (savedImagePaths.length > 1) {
                logger.info(`Generating image grid from ${savedImagePaths.length} images`);
                const gridPath = await ImageGrid.generateImageGrid(savedImagePaths);
                return gridPath;
            } else if (savedImagePaths.length === 1) {
                return getDomainPath(savedImagePaths[0]);
            } else {
                throw new Error("No images were generated");
            }

        } catch (error) {
            logger.error("Error during image generation:", error);
            throw error;
        } finally {
            client.close();
        }
    }

    /**
     * Saves the provided image data to files.
     */
    private static async saveImageFiles(images: Map<string, Buffer[]>): Promise<string[]> {
        const savedImages: string[] = [];
        const imageData = images.get('SaveImageWebsocket');

        if (!imageData || imageData.length === 0) {
            logger.warn("No images received from ComfyUI");
            return savedImages;
        }

        for (let index = 0; index < imageData.length; index++) {
            const imageBytes = imageData[index];
            // Index 1,2,... for individual images (grid will be 0)
            const filename = getImageFilename(index + 1, GENERATION_DEFAULTS.OUTPUT_FORMAT);
            const filepath = join(COMFYUI_CONFIG.FOLDER_PATH, filename);

            try {
                const webpImage = await sharp(imageBytes)
                    .webp()
                    .toBuffer();
                writeFileSync(filepath, webpImage);
                savedImages.push(filepath);
                logger.debug(`Saved image: ${filename}`);
            } catch (error) {
                logger.error(`Error saving image ${filename}:`, error);
            }
        }

        return savedImages;
    }
}