import random
from typing import Dict, Optional
from prompt_data import PromptData
from text_filter import FilteredPrompt

def create_prompt_data(workflow_data: Dict) -> PromptData:
    """Creates a PromptData object from workflow data."""
    return PromptData(workflow_data)

def update_prompt_with_model_config(prompt_data: PromptData, model_config: Optional[Dict], filteredPrompt: FilteredPrompt):
    """Updates the PromptData object with model-specific configuration."""
    if not model_config:
        raise ValueError("Model configuration not found.")

    prompt_data.model = model_config.get("checkpointName")
    prompt_data.vae = model_config.get("vae")
    prompt_data.steps = model_config.get("steps")
    prompt_data.width = filteredPrompt.width or model_config.get("imageWidth")
    prompt_data.height = filteredPrompt.height or model_config.get("imageHeight")
    default_positive_prompt = model_config.get("defaultPositivePrompt")
    default_negative_prompt = model_config.get("defaultNegativePrompt")
    batch_size = model_config.get("batch_size") or 4

    prompt_data.seed = random.randint(1, 1000000)
    prompt_data.batch_size = batch_size
    prompt_data.positive_prompt = f"{default_positive_prompt}, {filteredPrompt.prompt or ''}"
    prompt_data.negative_prompt = f"nsfw, nude, {default_negative_prompt}, {filteredPrompt.negative_prompt or ''}"
