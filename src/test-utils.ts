import { WorkflowData } from './types';

/**
 * Fully typed minimal ComfyUI workflow used as a fixture in tests.
 *
 * Includes every node required by {@link WorkflowData} with zeroed / empty
 * input values so that code under test falls back to its defaults. This
 * replaces the previous untyped (`any`) workflow stubs.
 */
export function minimalWorkflowData(): WorkflowData {
    return {
        KSampler: {
            class_type: 'KSampler',
            inputs: {
                seed: 0,
                steps: 0,
                cfg: 0,
                sampler_name: '',
                scheduler: '',
                denoise: 0,
                model: ['1', 0],
                positive: ['2', 0],
                negative: ['3', 0],
                latent_image: ['4', 0],
            },
        },
        Checkpoint: {
            class_type: 'CheckpointLoaderSimple',
            inputs: { ckpt_name: '' },
        },
        EmptyLatentImage: {
            class_type: 'EmptyLatentImage',
            inputs: { width: 0, height: 0, batch_size: 0 },
        },
        PositivePrompt: {
            class_type: 'CLIPTextEncode',
            inputs: { text: '', clip: ['1', 0] },
        },
        NegativePrompt: {
            class_type: 'CLIPTextEncode',
            inputs: { text: '', clip: ['1', 0] },
        },
        VAEDecode: {
            class_type: 'VAEDecode',
            inputs: { samples: ['1', 0], vae: ['1', 0] },
        },
        SaveImageWebsocket: {
            class_type: 'SaveImageWebsocket',
            inputs: { images: ['1', 0] },
        },
        VAELoader: {
            class_type: 'VAELoader',
            inputs: { vae_name: undefined },
        },
    };
}
