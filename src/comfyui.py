import os
import random
import websocket
import uuid
import json
import urllib.request
from urllib.error import URLError
from typing import List, Dict, Optional

from config import COMFYUI_CONFIG
from promp_data import PromptData
from text_filter import FilteredPrompt, extract_prompts

SERVER_ADDRESS = COMFYUI_CONFIG.get("address")
FOLDER_PATH = COMFYUI_CONFIG.get("folder_path")
CLIENT_ID = str(uuid.uuid4())

def save_image_files(images: List[bytes], seed: str) -> List[str]:
    """Saves the provided image byte data to PNG files."""
    if FOLDER_PATH is None:
        raise ValueError("Image save folder path not configured.")

    saved_images = []

    for index, image_bytes in enumerate(images):
        filename = f"{seed}.{index + 1:03d}.png"
        filepath = os.path.join(FOLDER_PATH, filename)
        try:
            with open(filepath, "wb") as file:
                file.write(image_bytes)
            saved_images.append(filepath)
        except Exception as e:
            print(f"Error saving image {filename}: {e}")
    return saved_images

def queue_prompt(prompt: Dict) -> Optional[str]:
    """Queues a prompt to the ComfyUI server."""
    if SERVER_ADDRESS is None:
        raise ValueError("ComfyUI server address not configured.")

    try:
        p = {"prompt": prompt, "client_id": CLIENT_ID}
        data = json.dumps(p).encode('utf-8')
        req = urllib.request.Request(f"http://{SERVER_ADDRESS}/prompt", data=data)
        response = urllib.request.urlopen(req)
        return json.loads(response.read())['prompt_id']
    except URLError as e:
        print(f"Error queuing prompt: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error decoding prompt queue response: {e}")
        return None

def get_images_from_websocket(ws: websocket.WebSocket, prompt_id: str) -> Dict[str, List[bytes]]:
    """Retrieves generated images from the websocket connection."""
    output_images: Dict[str, List[bytes]] = {}
    current_node: str = ""
    while True:
        try:
            out = ws.recv()
            if isinstance(out, str):
                message = json.loads(out)
                if message['type'] == 'executing':
                    data = message['data']
                    if data['prompt_id'] == prompt_id:
                        if data['node'] is None:
                            break  # Execution is done
                        else:
                            current_node = data['node']
            else:
                if current_node == 'SaveImageWebsocket':
                    images_output = output_images.get(current_node, [])
                    images_output.append(out[8:])
                    output_images[current_node] = images_output
        except websocket.WebSocketTimeoutException:
            print("Websocket timeout during image retrieval.")
            break
        except websocket.WebSocketException as e:
            print(f"Websocket error during image retrieval: {e}")
            break
        except json.JSONDecodeError as e:
            print(f"Error decoding websocket message: {e}")
            break
        except Exception as e:
            print(f"Unexpected error during websocket communication: {e}")
            break
    return output_images

def load_model_configuration(model_name: str) -> Optional[Dict]:
    """Loads the configuration for a specific model."""
    try:
        with open('modelConfiguration.json', 'r') as config_file:
            config_data: Dict = json.load(config_file)
            return config_data.get(model_name)
    except FileNotFoundError:
        print("Error: modelConfiguration.json not found.")
        return None
    except json.JSONDecodeError:
        print("Error: Invalid JSON format in modelConfiguration.json.")
        return None

def load_workflow_data(workflow_path: str) -> Optional[Dict]:
    """Loads the ComfyUI workflow data from a JSON file."""
    try:
        with open(workflow_path, 'r') as workflow_file:
            return json.load(workflow_file)
    except FileNotFoundError:
        print(f"Error: {workflow_path} not found.")
        return None
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON format in {workflow_path}: {e}")
        return None

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

def connect_websocket_comfyui() -> Optional[websocket.WebSocket]:
    """Connects to the ComfyUI websocket."""
    try:
        ws = websocket.WebSocket()
        ws.connect(f"ws://{SERVER_ADDRESS}/ws?clientId={CLIENT_ID}")
        return ws
    except ConnectionRefusedError as e:
        print(f"Error connecting to ComfyUI server: {e}")
        return None
    except websocket.WebSocketException as e:
        print(f"WebSocket connection error: {e}")
        return None

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
    prompt = "1girl, fubuki (kancolle), casual, barefoot, smiling, simple background"
    filteredPrompt = extract_prompts(prompt)
    
    result = generate_image(filteredPrompt)
    print(result)
