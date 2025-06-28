import websocket
from typing import List, Optional

from comfyui.client import connect_websocket_comfyui, get_images_from_websocket, queue_prompt
from comfyui.model_loader import load_model_configuration
from comfyui.prompt_processing import create_prompt_data, update_prompt_with_model_config
from comfyui.workflow_loader import load_workflow_data
from images.file_management import save_image_files
from text_filter.text_filter import FilteredPrompt

def generate_image(filteredPrompt: FilteredPrompt) -> List[str]:
    """Generates one or more images based on the given filtered prompt."""
    ws: Optional[websocket.WebSocket] = None
    saved_image_paths: List[str] = []

    workflow_data = load_workflow_data('workflows/SDXL.json')
    if not workflow_data:
        raise ValueError("Failed to load workflow data.")

    prompt_data = create_prompt_data(workflow_data)
    model_name = filteredPrompt.model or 'paSanctuary'
    model_config = load_model_configuration(model_name)
    update_prompt_with_model_config(prompt_data, model_config, filteredPrompt)

    ws = connect_websocket_comfyui()
    if not ws:
        raise ValueError("Failed to connect to ComfyUI server.")

    prompt_id = queue_prompt(prompt_data.data)
    if not prompt_id:
        if ws.connected:
            ws.close()
        raise ValueError("Failed to queue prompt.")

    images = get_images_from_websocket(ws, prompt_id)
    if ws.connected:
        ws.close()

    if "SaveImageWebsocket" in images:
        saved_image_paths = save_image_files(images["SaveImageWebsocket"], str(prompt_data.seed))

    return saved_image_paths

if __name__ == "__main__":
    prompt: FilteredPrompt = FilteredPrompt("1girl, fubuki (kancolle), blue skin, blue hair, slime girl, casual, barefoot, smiling, simple background", 1024, 1024, "", "")
    
    result = generate_image(prompt)
    print(result)
