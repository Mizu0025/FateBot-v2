import { FilteredPrompt, ModelConfiguration, PromptData, WorkflowData } from '../types';

export class PromptProcessor {
    /**
     * Creates a PromptData object from workflow data.
     */
    static createPromptData(workflowData: WorkflowData): PromptData {
        console.log("Creating PromptData object from workflow data.");
        return {
            data: workflowData,
            model: workflowData["Checkpoint"]?.["inputs"]?.["ckpt_name"] || "",
            vae: workflowData["VAELoader"]?.["inputs"]?.["vae_name"] || "",
            seed: workflowData["KSampler"]?.["inputs"]?.["seed"] || 0,
            steps: workflowData["KSampler"]?.["inputs"]?.["steps"] || 0,
            width: workflowData["EmptyLatentImage"]?.["inputs"]?.["width"] || 1024,
            height: workflowData["EmptyLatentImage"]?.["inputs"]?.["height"] || 1024,
            batch_size: workflowData["EmptyLatentImage"]?.["inputs"]?.["batch_size"] || 1,
            positive_prompt: workflowData["PositivePrompt"]?.["inputs"]?.["text"] || "",
            negative_prompt: workflowData["NegativePrompt"]?.["inputs"]?.["text"] || "",
            cfg: workflowData["KSampler"]?.["inputs"]?.["cfg"] || 8,
            sampler: workflowData["KSampler"]?.["inputs"]?.["sampler_name"] || "euler"
        };
    }

    /**
     * Updates the PromptData object with model-specific configuration.
     */
    static updatePromptWithModelConfig(
        promptData: PromptData, 
        modelConfig: ModelConfiguration | null, 
        filteredPrompt: FilteredPrompt
    ): void {
        if (!modelConfig) {
            console.error("Model configuration not found for the specified model.");
            throw new Error("Model configuration not found.");
        }

        // Update the workflow data with model configuration
        promptData.data["Checkpoint"]["inputs"]["ckpt_name"] = modelConfig.checkpointName;
        promptData.data["VAELoader"]["inputs"]["vae_name"] = modelConfig.vae;
        promptData.data["KSampler"]["inputs"]["steps"] = modelConfig.steps;
        promptData.data["EmptyLatentImage"]["inputs"]["width"] = filteredPrompt.width || modelConfig.imageWidth;
        promptData.data["EmptyLatentImage"]["inputs"]["height"] = filteredPrompt.height || modelConfig.imageHeight;
        
        const defaultPositivePrompt = modelConfig.defaultPositivePrompt;
        const defaultNegativePrompt = modelConfig.defaultNegativePrompt;
        
        promptData.data["KSampler"]["inputs"]["seed"] = filteredPrompt.seed === -1 ? this.generateRandomSeed() : filteredPrompt.seed;
        promptData.data["EmptyLatentImage"]["inputs"]["batch_size"] = filteredPrompt.count;
        promptData.data["PositivePrompt"]["inputs"]["text"] = `${defaultPositivePrompt}, ${filteredPrompt.prompt || ''}`.trim();
        promptData.data["NegativePrompt"]["inputs"]["text"] = `nsfw, nude, ${defaultNegativePrompt}, ${filteredPrompt.negative_prompt || ''}`.trim();
        
        console.log("PromptData updated with model configuration");
    }

    private static generateRandomSeed(): number {
        return Math.floor(Math.random() * 1000000) + 1;
    }
} 