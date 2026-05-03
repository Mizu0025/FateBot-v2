import { DiffusionArchitecture, FilteredPrompt, ModelConfiguration, PromptData, WorkflowData, DIFFUSION_ARCHITECTURES } from '../types';
import { logger } from '../config/logger';

/**
 * Architecture-specific configuration overrides.
 * Each architecture may have ideal defaults for sampler/scheduler/CLIP behavior.
 */
const ARCH_DEFAULTS: Record<DiffusionArchitecture, {
    sampler: string;
    scheduler: string;
}> = {
    'sd-xl': {
        sampler: 'euler',
        scheduler: 'karras',
    },
    'mm-dit': {
        sampler: 'euler_ancestral',
        scheduler: 'normal',
    },
    'flow-matching': {
        sampler: 'euler',
        scheduler: 'simple',
    },
    '16ch-umodel': {
        sampler: 'euler_ancestral',
        scheduler: 'normal',
    },
    'dual-stream-dit': {
        sampler: 'euler',
        scheduler: 'normal',
    },
    'netayume': {
        sampler: 'euler_ancestral',
        scheduler: 'simple',
    },
};

/**
 * Handle the resolution of architecture from model configuration.
 * Returns the determined architecture, or 'sd-xl' as default for legacy models.
 */
function resolveArchitecture(modelConfig: ModelConfiguration): DiffusionArchitecture {
    const arch = modelConfig.architecture;
    if (arch && DIFFUSION_ARCHITECTURES[arch]) {
        return arch;
    }
    // Fallback: treat unknown/legacy models as SD-xl
    logger.debug('No explicit architecture found for model, defaulting to sd-xl', {
        model: modelConfig.checkpointName,
        workflow: modelConfig.workflow,
        architecture: arch,
    });
    return 'sd-xl';
}

/**
 * Handle the extraction and transformation of workflow data into 
 * a structured PromptData object, and applies model-specific configurations.
 */
export class PromptProcessor {
    /**
     * Extracts and flattens core generation parameters from a raw 
     * ComfyUI workflow into a structures PromptData object.
     * @param workflowData The full workflow object from a JSON file.
     * @returns A structured representation of the workflow's default parameters.
     */
    static createPromptData(workflowData: WorkflowData): PromptData {
        logger.debug("Creating PromptData object from workflow data");

        const checkpointInputs = workflowData.Checkpoint?.inputs;
        const vaeLoaderInputs = workflowData.VAELoader?.inputs;
        const ksamplerInputs = workflowData.KSampler?.inputs;
        const latentImageInputs = workflowData.EmptyLatentImage?.inputs;
        const positivePromptInputs = workflowData.PositivePrompt?.inputs;
        const negativePromptInputs = workflowData.NegativePrompt?.inputs;

        // Extract positive prompt - handle both direct string and PromptConcatenate reference
        let positivePrompt = "";
        if (typeof positivePromptInputs?.text === 'string') {
            positivePrompt = positivePromptInputs.text;
        } else if (Array.isArray(positivePromptInputs?.text) && workflowData.PromptConcatenate) {
            // If it's a reference to PromptConcatenate, get string_b (user prompt)
            positivePrompt = workflowData.PromptConcatenate.inputs.string_b || "";
        }

        // Extract negative prompt - handle both direct string and potential reference
        let negativePrompt = "";
        if (typeof negativePromptInputs?.text === 'string') {
            negativePrompt = negativePromptInputs.text;
        }

        return {
            data: workflowData,
            model: checkpointInputs?.ckpt_name || "",
            vae: vaeLoaderInputs?.vae_name || "",
            seed: ksamplerInputs?.seed || 0,
            steps: ksamplerInputs?.steps || 0,
            width: latentImageInputs?.width || 1024,
            height: latentImageInputs?.height || 1024,
            batch_size: latentImageInputs?.batch_size || 1,
            positive_prompt: positivePrompt,
            negative_prompt: negativePrompt,
            cfg: ksamplerInputs?.cfg || 8,
            sampler: ksamplerInputs?.sampler_name || "euler"
        };
    }

    /**
     * Maps user-provided prompt data and model-specific configurations 
     * onto the internal ComfyUI workflow nodes.
     * @param promptData The target PromptData object containing the workflow.
     * @param modelConfig The configuration for the selected AI model.
     * @param filteredPrompt The user's requested generation parameters (prompt, count, size, etc).
     * @throws Error if model configuration is missing.
     */
    static updatePromptWithModelConfig(
        promptData: PromptData,
        modelConfig: ModelConfiguration | null,
        filteredPrompt: FilteredPrompt
    ): void {
        if (!modelConfig) {
            logger.error("Model configuration not found for the specified model.");
            throw new Error("Model configuration not found.");
        }

        // Resolve architecture and get architecture-specific defaults
        const architecture = resolveArchitecture(modelConfig);
        const archDefaults = ARCH_DEFAULTS[architecture];

        logger.debug('Applied architecture-specific config', {
            architecture,
            model: modelConfig.checkpointName,
            defaults: archDefaults,
        });

        // Update the workflow data with model configuration
        if (promptData.data.Checkpoint) {
            promptData.data.Checkpoint.inputs.ckpt_name = modelConfig.checkpointName;
        }

        if (promptData.data.VAELoader && modelConfig.vae) {
            promptData.data.VAELoader.inputs.vae_name = modelConfig.vae;
        }

        // Build KSampler inputs with architecture-aware defaults
        const kSamplerInputs: Record<string, unknown> = {
            steps: modelConfig.steps,
            ...(modelConfig.cfg !== undefined && { cfg: modelConfig.cfg }),
            seed: filteredPrompt.seed === -1 ? this.generateRandomSeed() : filteredPrompt.seed,
        };

        // Sampler/scheduler priority: explicit config > architecture default > fallback
        if (modelConfig.sampler_name) {
            kSamplerInputs.sampler_name = modelConfig.sampler_name;
        } else if (archDefaults) {
            kSamplerInputs.sampler_name = archDefaults.sampler;
        }

        if (modelConfig.scheduler) {
            kSamplerInputs.scheduler = modelConfig.scheduler;
        } else if (archDefaults) {
            kSamplerInputs.scheduler = archDefaults.scheduler;
        }

        Object.assign(promptData.data.KSampler.inputs, kSamplerInputs);

        Object.assign(promptData.data.EmptyLatentImage.inputs, {
            width: filteredPrompt.width || modelConfig.imageWidth,
            height: filteredPrompt.height || modelConfig.imageHeight,
            batch_size: filteredPrompt.count,
        });

        // Handle prompt concatenation
        if (promptData.data.PromptConcatenate) {
            // If workflow uses PromptConcatenate, update string_a with default prompt and string_b with user prompt
            promptData.data.PromptConcatenate.inputs.string_a = modelConfig.defaultPositivePrompt;
            promptData.data.PromptConcatenate.inputs.string_b = filteredPrompt.prompt || '';
        } else {
            // Fallback to direct text assignment for workflows without PromptConcatenate
            if (typeof promptData.data.PositivePrompt.inputs.text === 'string') {
                promptData.data.PositivePrompt.inputs.text = `${modelConfig.defaultPositivePrompt}, ${filteredPrompt.prompt || ''}`.trim();
            }
        }

        // Update negative prompt
        if (typeof promptData.data.NegativePrompt.inputs.text === 'string') {
            promptData.data.NegativePrompt.inputs.text = `nsfw, nude, ${modelConfig.defaultNegativePrompt}, ${filteredPrompt.negative_prompt || ''}`.trim();
        }

        logger.debug('PromptData updated with model configuration', {
            steps: promptData.data.KSampler.inputs.steps,
            cfg: promptData.data.KSampler.inputs.cfg,
            sampler: promptData.data.KSampler.inputs.sampler_name,
            scheduler: promptData.data.KSampler.inputs.scheduler,
            width: promptData.data.EmptyLatentImage.inputs.width,
            height: promptData.data.EmptyLatentImage.inputs.height,
            batch_size: promptData.data.EmptyLatentImage.inputs.batch_size,
            architecture,
        });
    }

    /**
     * Generates a random integer between 1 and 1,000,000 for use as a seed.
     * @returns A random seed number.
     */
    private static generateRandomSeed(): number {
        const seed = Math.floor(Math.random() * 1000000) + 1;
        logger.debug(`Generated random seed: ${seed}`);
        return seed;
    }
}
