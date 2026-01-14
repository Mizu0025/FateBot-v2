import { PromptProcessor } from './prompt-processor';
import { FilteredPrompt, ModelConfiguration, PromptData, WorkflowData } from '../types';
import { logger } from '../config/logger';

jest.mock('../config/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
    },
}));

describe('PromptProcessor', () => {
    const mockWorkflowData: WorkflowData = {
        Checkpoint: { inputs: { ckpt_name: 'test.ckpt' }, class_type: 'CheckpointLoaderSimple' },
        VAELoader: { inputs: { vae_name: 'test.vae' }, class_type: 'VAELoader' },
        KSampler: {
            inputs: {
                seed: 123, steps: 20, cfg: 8, sampler_name: 'euler',
                scheduler: 'normal', denoise: 1,
                model: ['1', 0], positive: ['1', 0], negative: ['1', 0], latent_image: ['1', 0]
            },
            class_type: 'KSampler'
        },
        EmptyLatentImage: { inputs: { width: 512, height: 512, batch_size: 1 }, class_type: 'EmptyLatentImage' },
        PositivePrompt: { inputs: { text: 'test positive', clip: ['1', 0] }, class_type: 'CLIPTextEncode' },
        NegativePrompt: { inputs: { text: 'test negative', clip: ['1', 0] }, class_type: 'CLIPTextEncode' },
        VAEDecode: { inputs: { samples: ['1', 0], vae: ['1', 0] }, class_type: 'VAEDecode' },
        SaveImageWebsocket: { inputs: { images: ['1', 0] }, class_type: 'SaveImageWebsocket' }
    };

    const mockModelConfig: ModelConfiguration = {
        checkpointName: 'config.ckpt',
        vae: 'config.vae',
        workflow: 'test-workflow',
        steps: 30,
        cfg: 7.5,
        sampler_name: 'dpmpp_2m',
        imageHeight: 1024,
        imageWidth: 1024,
        defaultPositivePrompt: 'masterpiece',
        defaultNegativePrompt: 'low quality'
    };

    const mockFilteredPrompt: FilteredPrompt = {
        prompt: 'user prompt',
        negative_prompt: 'user negative',
        width: 1024,
        height: 1024,
        model: 'xl',
        count: 1,
        seed: 456
    };

    describe('createPromptData', () => {
        it('should create PromptData from workflow data with direct prompts', () => {
            // Arrange
            const workflow = { ...mockWorkflowData };

            // Act
            const result = PromptProcessor.createPromptData(workflow);

            // Assert
            expect(result.model).toBe('test.ckpt');
            expect(result.vae).toBe('test.vae');
            expect(result.seed).toBe(123);
            expect(result.positive_prompt).toBe('test positive');
            expect(result.negative_prompt).toBe('test negative');
            expect(result.width).toBe(512);
        });

        it('should handle PromptConcatenate when creating PromptData', () => {
            // Arrange
            const workflowWithConcatenation: WorkflowData = {
                ...mockWorkflowData,
                PositivePrompt: { inputs: { text: ['1', 0], clip: ['1', 0] }, class_type: 'CLIPTextEncode' }, // text is an array/reference
                PromptConcatenate: {
                    inputs: { string_a: 'default', string_b: 'concatenated', delimiter: ',' },
                    class_type: 'PromptConcatenate'
                }
            };

            // Act
            const result = PromptProcessor.createPromptData(workflowWithConcatenation);

            // Assert
            expect(result.positive_prompt).toBe('concatenated');
        });

        it('should use default values for missing workflow data', () => {
            // Arrange
            const minimalWorkflow: any = {
                KSampler: { inputs: {} },
                EmptyLatentImage: { inputs: {} }
            };

            // Act
            const result = PromptProcessor.createPromptData(minimalWorkflow);

            // Assert
            expect(result.seed).toBe(0);
            expect(result.steps).toBe(0);
            expect(result.width).toBe(1024);
            expect(result.height).toBe(1024);
            expect(result.batch_size).toBe(1);
            expect(result.cfg).toBe(8);
            expect(result.sampler).toBe('euler');
        });
    });

    describe('updatePromptWithModelConfig', () => {
        it('should update PromptData with model config and filtered prompt', () => {
            // Arrange
            const promptData = PromptProcessor.createPromptData(JSON.parse(JSON.stringify(mockWorkflowData)));

            // Act
            PromptProcessor.updatePromptWithModelConfig(promptData, mockModelConfig, mockFilteredPrompt);

            // Assert
            expect(promptData.data.Checkpoint.inputs.ckpt_name).toBe(mockModelConfig.checkpointName);
            expect(promptData.data.VAELoader!.inputs.vae_name).toBe(mockModelConfig.vae);
            expect(promptData.data.KSampler.inputs.steps).toBe(mockModelConfig.steps);
            expect(promptData.data.KSampler.inputs.seed).toBe(mockFilteredPrompt.seed);
            expect(promptData.data.EmptyLatentImage.inputs.width).toBe(mockFilteredPrompt.width);
            expect(promptData.data.PositivePrompt.inputs.text).toBe('masterpiece, user prompt');
            expect(promptData.data.NegativePrompt.inputs.text).toBe('nsfw, nude, low quality, user negative');
        });

        it('should handle PromptConcatenate during update', () => {
            // Arrange
            const workflowWithConcatenation = JSON.parse(JSON.stringify(mockWorkflowData));
            workflowWithConcatenation.PromptConcatenate = {
                inputs: { string_a: '', string_b: '', delimiter: ',' },
                class_type: 'PromptConcatenate'
            };
            const promptData = PromptProcessor.createPromptData(workflowWithConcatenation);

            // Act
            PromptProcessor.updatePromptWithModelConfig(promptData, mockModelConfig, mockFilteredPrompt);

            // Assert
            expect(promptData.data.PromptConcatenate!.inputs.string_a).toBe(mockModelConfig.defaultPositivePrompt);
            expect(promptData.data.PromptConcatenate!.inputs.string_b).toBe(mockFilteredPrompt.prompt);
        });

        it('should generate a random seed if seed is -1', () => {
            // Arrange
            const promptData = PromptProcessor.createPromptData(JSON.parse(JSON.stringify(mockWorkflowData)));
            const filteredPromptWithRandomSeed = { ...mockFilteredPrompt, seed: -1 };
            const mathSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

            // Act
            PromptProcessor.updatePromptWithModelConfig(promptData, mockModelConfig, filteredPromptWithRandomSeed);

            // Assert
            expect(promptData.data.KSampler.inputs.seed).toBeGreaterThan(0);
            expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Generated random seed'));

            mathSpy.mockRestore();
        });

        it('should throw error if modelConfig is null', () => {
            // Arrange
            const promptData = PromptProcessor.createPromptData(JSON.parse(JSON.stringify(mockWorkflowData)));

            // Act & Assert
            expect(() => {
                PromptProcessor.updatePromptWithModelConfig(promptData, null, mockFilteredPrompt);
            }).toThrow('Model configuration not found.');
            expect(logger.error).toHaveBeenCalledWith('Model configuration not found for the specified model.');
        });
    });
});
