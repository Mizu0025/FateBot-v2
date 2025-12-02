export interface FilteredPrompt {
    prompt: string;
    width: number;
    height: number;
    model: string;
    negative_prompt: string;
    count: number;
    seed: number;
}

export interface ModelConfiguration {
    checkpointName: string;
    vae?: string;
    workflow: string;
    steps: number;
    cfg?: number;
    sampler_name?: string;
    imageHeight: number;
    imageWidth: number;
    defaultPositivePrompt: string;
    defaultNegativePrompt: string;
}

export interface WorkflowData {
    KSampler: KSamplerNode;
    Checkpoint: CheckpointNode;
    EmptyLatentImage: EmptyLatentImageNode;
    PositivePrompt: PromptNode;
    NegativePrompt: PromptNode;
    VAEDecode: VAEDecodeNode;
    SaveImageWebsocket: SaveImageWebsocketNode;
    VAELoader: VAELoaderNode;
    PromptConcatenate?: PromptConcatenateNode;
}

interface BaseNode<T> {
    inputs: T;
    class_type: string;
}

interface KSamplerNode extends BaseNode<KSamplerInputs> { }
interface CheckpointNode extends BaseNode<CheckpointInputs> { }
interface EmptyLatentImageNode extends BaseNode<EmptyLatentImageInputs> { }
interface PromptNode extends BaseNode<PromptInputs> { }
interface VAEDecodeNode extends BaseNode<VAEDecodeInputs> { }
interface SaveImageWebsocketNode extends BaseNode<SaveImageWebsocketInputs> { }
interface VAELoaderNode extends BaseNode<VAELoaderInputs> { }
interface PromptConcatenateNode extends BaseNode<PromptConcatenateInputs> { }

interface KSamplerInputs {
    seed: number;
    steps: number;
    cfg: number;
    sampler_name: string;
    scheduler: string;
    denoise: number;
    model: [string, number];
    positive: [string, number];
    negative: [string, number];
    latent_image: [string, number];
}

interface CheckpointInputs {
    ckpt_name: string;
}

interface EmptyLatentImageInputs {
    width: number;
    height: number;
    batch_size: number;
}

interface PromptInputs {
    text: string | [string, number];
    clip: [string, number];
}

interface PromptConcatenateInputs {
    string_a: string;
    string_b: string;
    delimiter: string;
}

interface VAEDecodeInputs {
    samples: [string, number];
    vae: [string, number];
}

interface SaveImageWebsocketInputs {
    images: [string, number];
}

interface VAELoaderInputs {
    vae_name: string | undefined;
}

export interface PromptData {
    data: WorkflowData;
    model: string;
    vae: string | undefined;
    seed: number;
    steps: number;
    width: number;
    height: number;
    batch_size: number;
    positive_prompt: string;
    negative_prompt: string;
    cfg: number;
    sampler: string;
} 