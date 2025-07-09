export interface FilteredPrompt {
    prompt: string;
    width: number;
    height: number;
    model: string;
    negative_prompt: string;
}

export interface ModelConfiguration {
    checkpointName: string;
    vae: string;
    steps: number;
    imageHeight: number;
    imageWidth: number;
    defaultPositivePrompt: string;
    defaultNegativePrompt: string;
}

export interface WorkflowData {
    [key: string]: any;
}

export interface PromptData {
    data: WorkflowData;
    model: string;
    vae: string;
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