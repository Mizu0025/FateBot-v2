import { writeFileSync, existsSync } from 'fs';
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
import { TagExtractor, TagExtractionResult } from '../tags/tag-extractor';
import { MetadataStore, ImageTagData } from '../tags/metadata-store';

/**
 * Orchestrates the entire image generation process including model configuration,
 * workflow loading, ComfyUI interaction, and image saving.
 */
export class ImageGenerator {
    /**
     * Generates one or more images based on the given filtered prompt.
     * @param filteredPrompt The parsed and filtered prompt details.
     * @returns The local path or URL to the generated image or grid.
     * @throws Error if generation fails at any stage.
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

            // Save individual images and extract tags
            const savedImagePaths = await this.saveImageFiles(images, promptData, filteredPrompt, modelConfig);

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
     * Saves the provided image data buffers to files on disk and extracts tags from the prompt.
     * @param images A map of output keys to image buffers.
     * @param promptData The prompt data (model, tags, etc.) associated with the generation.
     * @param filteredPrompt User's original prompt data.
     * @param modelConfig The model configuration used.
     * @returns An array of absolute file paths to the saved images.
     */
    private static async saveImageFiles(
        images: Map<string, Buffer[]>,
        promptData: PromptData,
        filteredPrompt: FilteredPrompt,
        modelConfig: any
    ): Promise<string[]> {
        const savedImages: string[] = [];
        const imageData = images.get('SaveImageWebsocket');

        if (!imageData || imageData.length === 0) {
            logger.warn("No images received from ComfyUI");
            return savedImages;
        }

        // Extract tags from the positive prompt (which has been updated by PromptProcessor)
        const finalPositivePrompt = promptData.positive_prompt || filteredPrompt.prompt || '';
        const tagResult = TagExtractor.extractFromPrompt(finalPositivePrompt);

        // Use model name (or checkpoint name) as the model field
        const modelName = filteredPrompt.model || RuntimeConfig.defaultModel || (modelConfig?.checkpointName);

        for (let index = 0; index < imageData.length; index++) {
            const imageBytes = imageData[index];
            // Index 1,2,... for individual images (grid will be 0)
            const filename = getImageFilename(promptData.seed, index + 1, GENERATION_DEFAULTS.OUTPUT_FORMAT);
            const filepath = join(COMFYUI_CONFIG.FOLDER_PATH, filename);

            try {
                const webpImage = await sharp(imageBytes)
                    .webp()
                    .toBuffer();
                writeFileSync(filepath, webpImage);
                savedImages.push(filepath);
                logger.debug(`Saved image: ${filename}`);

                // Save tag metadata for this image
                const tagData: ImageTagData = {
                    prompt: finalPositivePrompt,
                    negative_prompt: promptData.negative_prompt || '',
                    tags: Array.from(tagResult.tags),
                    model: String(modelName),
                    width: promptData.width,
                    height: promptData.height,
                    source: promptData.model || modelConfig?.checkpointName || '',
                    timestamp: new Date().toISOString()
                };
                MetadataStore.saveTags(filepath, tagData);
                logger.debug(`Extracted ${tagResult.tags.size} tags for ${filename}`);

            } catch (error) {
                logger.error(`Error saving image ${filename}:`, error);
            }
        }

        return savedImages;
    }

    /**
     * Manually unloads all models from VRAM on the ComfyUI server.
     */
    static async unloadModels(): Promise<void> {
        const client = new ComfyUIClient();
        await client.unloadModels();
    }
}