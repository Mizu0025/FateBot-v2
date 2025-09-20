import { writeFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { FilteredPrompt, PromptData } from '../types';
import { ModelLoader } from '../config/model-loader';
import { PromptProcessor } from './prompt-processor';
import { ComfyUIClient } from './comfyui-client';
import { getImageFilename } from './filename-utils';
import { ImageGrid } from './image-grid';
import { WorkflowLoader } from './workflow-loader';
import { COMFYUI_CONFIG } from '../config/constants';

export class ImageGenerator {
    /**
     * Generates one or more images based on the given filtered prompt.
     */
    static async generateImage(filteredPrompt: FilteredPrompt): Promise<string> {
        const client = new ComfyUIClient();
        
        try {
            console.log("Starting image generation process...");
            
            // Load workflow data
            const workflowData = await WorkflowLoader.loadWorkflowData(COMFYUI_CONFIG.WORKFLOW_PATH);
            if (!workflowData) {
                throw new Error("Failed to load workflow data.");
            }

            // Create prompt data
            const promptData: PromptData = PromptProcessor.createPromptData(workflowData);
            
            // Load model configuration
            const modelName = filteredPrompt.model || 'paSanctuary';
            const modelConfig = await ModelLoader.loadModelConfiguration(modelName);
            
            // Update prompt with model configuration
            PromptProcessor.updatePromptWithModelConfig(promptData, modelConfig, filteredPrompt);

            // Connect to ComfyUI
            await client.connectWebSocket();
            
            // Queue the prompt
            const promptId = await client.queuePrompt(promptData.data);
            if (!promptId) {
                throw new Error("Failed to queue prompt.");
            }

            // Get images from WebSocket
            const images = await client.getImagesFromWebSocket(promptId);
            
            // Save individual images
            const savedImagePaths = await this.saveImageFiles(images, client.clientId);

            // Generate grid from saved images
            if (savedImagePaths.length > 0) {
                const gridPath = await ImageGrid.generateImageGrid(savedImagePaths);
                return gridPath;
            } else {
                throw new Error("No images were generated");
            }

        } catch (error) {
            console.error("Error during image generation:", error);
            throw error;
        } finally {
            client.close();
        }
    }

    /**
     * Saves the provided image data to files.
     */
    private static async saveImageFiles(images: Map<string, Buffer[]>, clientId: string): Promise<string[]> {
        const savedImages: string[] = [];
        const imageData = images.get('SaveImageWebsocket');
        
        if (!imageData || imageData.length === 0) {
            console.warn("No images received from ComfyUI");
            return savedImages;
        }

        for (let index = 0; index < imageData.length; index++) {
            const imageBytes = imageData[index];
            // Index 1,2,... for individual images (grid will be 0)
            const filename = getImageFilename(clientId, index + 1, 'webp');
            const filepath = join(COMFYUI_CONFIG.FOLDER_PATH, filename);

            try {
                const webpImage = await sharp(imageBytes)
                    .webp()
                    .toBuffer();
                writeFileSync(filepath, webpImage);
                savedImages.push(filepath);
                console.log(`Saved image: ${filepath}`);
            } catch (error) {
                console.error(`Error saving image ${filename}:`, error);
            }
        }

        return savedImages;
    }
}