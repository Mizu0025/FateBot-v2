import { FilteredPrompt, ModelConfiguration, PromptData, WorkflowData } from '../types';

export class PromptProcessor {
    /**
     * Creates a PromptData object from workflow data.
     */
    static createPromptData(workflowData: WorkflowData): PromptData {
        console.log("Creating PromptData object from workflow data.");

        const checkpointInputs = workflowData.Checkpoint?.inputs;
        const vaeLoaderInputs = workflowData.VAELoader?.inputs;
        const ksamplerInputs = workflowData.KSampler?.inputs;
        const latentImageInputs = workflowData.EmptyLatentImage?.inputs;
        const positivePromptInputs = workflowData.PositivePrompt?.inputs;
        const negativePromptInputs = workflowData.NegativePrompt?.inputs;

        return {
            data: workflowData,
            model: checkpointInputs?.ckpt_name || "",
            vae: vaeLoaderInputs?.vae_name || "",
            seed: ksamplerInputs?.seed || 0,
            steps: ksamplerInputs?.steps || 0,
            width: latentImageInputs?.width || 1024,
            height: latentImageInputs?.height || 1024,
            batch_size: latentImageInputs?.batch_size || 1,
            positive_prompt: positivePromptInputs?.text || "",
            negative_prompt: negativePromptInputs?.text || "",
            cfg: ksamplerInputs?.cfg || 8,
            sampler: ksamplerInputs?.sampler_name || "euler"
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
        promptData.data.Checkpoint.inputs.ckpt_name = modelConfig.checkpointName;
        promptData.data.VAELoader.inputs.vae_name = modelConfig.vae;

        Object.assign(promptData.data.KSampler.inputs, {
            steps: modelConfig.steps,
            ...(modelConfig.cfg && { cfg: modelConfig.cfg }),
            ...(modelConfig.sampler_name && { sampler_name: modelConfig.sampler_name }),
            seed: filteredPrompt.seed === -1 ? this.generateRandomSeed() : filteredPrompt.seed,
        });

        Object.assign(promptData.data.EmptyLatentImage.inputs, {
            width: filteredPrompt.width || modelConfig.imageWidth,
            height: filteredPrompt.height || modelConfig.imageHeight,
            batch_size: filteredPrompt.count,
        });

        promptData.data.PositivePrompt.inputs.text = `${modelConfig.defaultPositivePrompt}, ${filteredPrompt.prompt || ''}`.trim();
        promptData.data.NegativePrompt.inputs.text = `nsfw, nude, ${modelConfig.defaultNegativePrompt}, ${filteredPrompt.negative_prompt || ''}`.trim();
        
        console.log("PromptData updated with model configuration");
    }

    private static generateRandomSeed(): number {
        return Math.floor(Math.random() * 1000000) + 1;
    }
}