import { writeFileSync } from 'fs';
import { join } from 'path';
import { FilteredPrompt } from '../types';
import { ModelLoader } from '../config/model-loader';
import { PromptProcessor } from './prompt-processor';
import { ComfyUIClient } from './comfyui-client';
import { ImageGrid } from './image-grid';
import { WorkflowLoader } from './workflow-loader';
import SDXL from '../workflows/SDXL.json';
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
            const workflowData = SDXL;
            // await WorkflowLoader.loadWorkflowData(SDXL);
            if (!workflowData) {
                throw new Error("Failed to load workflow data.");
            }

            // Create prompt data
            const promptData = PromptProcessor.createPromptData(workflowData);
            
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
            const savedImagePaths = await this.saveImageFiles(images, promptData.data["KSampler"]["inputs"]["seed"]);

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
     * Saves the provided image data to PNG files.
     */
    private static async saveImageFiles(images: Map<string, Buffer[]>, seed: number): Promise<string[]> {
        const savedImages: string[] = [];
        const imageData = images.get('SaveImageWebsocket');
        
        if (!imageData || imageData.length === 0) {
            console.warn("No images received from ComfyUI");
            return savedImages;
        }

        for (let index = 0; index < imageData.length; index++) {
            const imageBytes = imageData[index];
            const filename = `${seed}_${(index + 1).toString().padStart(3, '0')}.png`;
            const filepath = join(COMFYUI_CONFIG.FOLDER_PATH, filename);
            
            try {
                writeFileSync(filepath, imageBytes);
                savedImages.push(filepath);
                console.log(`Saved image: ${filepath}`);
            } catch (error) {
                console.error(`Error saving image ${filename}:`, error);
            }
        }

        return savedImages;
    }
} 