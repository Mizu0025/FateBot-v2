import random
import websocket
import uuid
import json
import urllib.request
import urllib.parse

from config import COMFYUI_CONFIG
from promp_data import PromptData
from text_filter import FilteredPrompt

server_address = COMFYUI_CONFIG["address"]
image_domain = COMFYUI_CONFIG["domain"]
image_folder = COMFYUI_CONFIG["image_folder"]
client_id = str(uuid.uuid4())

def queue_prompt(prompt: str) -> dict:
    """Queue the prompt to the API."""
    p = {"prompt": prompt, "client_id": client_id}
    data = json.dumps(p).encode('utf-8')
    req = urllib.request.Request("http://{}/prompt".format(server_address), data=data)
    return json.loads(urllib.request.urlopen(req).read())

def get_image(filename, subfolder, folder_type) -> str:
    """Get the image data from the API."""
    data = {"filename": filename, "subfolder": subfolder, "type": folder_type}
    url_values = urllib.parse.urlencode(data)
    with urllib.request.urlopen("http://{}/view?{}".format(server_address, url_values)) as response:
        return response.url

def get_history(prompt_id) -> dict:
    """Get the history of the prompt execution"""
    with urllib.request.urlopen("http://{}/history/{}".format(server_address, prompt_id)) as response:
        return json.loads(response.read())

def get_images(ws: websocket, prompt: str) -> list:
    """Send the prompt to the websocket and retrieve the images."""
    prompt_id = queue_prompt(prompt)['prompt_id']
    images_output = []

    while True:
        out = ws.recv()
        if isinstance(out, str):
            message = json.loads(out)
            if message['type'] == 'executing':
                data = message['data']
                if data['node'] is None and data['prompt_id'] == prompt_id:
                    break  # Execution is done
        else:
            continue  # Skip binary data

    history = get_history(prompt_id)[prompt_id]
    for node_id in history['outputs']:
        node_output = history['outputs'][node_id]
        if 'images' in node_output:
            for image in node_output['images']:
                imageFile = image['filename']
                domainUrl = f"{image_domain}/{image_folder}/{imageFile}"
                images_output.append(domainUrl)

    return images_output

def assign_if_not_none(value, default) -> any:
    """Assign value if not None, otherwise assign default value."""
    return value if value not in (None, '') else default

def generate_image(filteredPrompt: FilteredPrompt) -> list:
    """Generate one or more images based on the given prompts."""
    ws = None

    try:
        # load json prompt from file
        with open('workflows/SDXL.json', 'r') as file:
            data: dict = json.load(file)
            prompt_data = PromptData(data)

        # Assign image details
        seed = random.randint(1, 1000000)
        batch_size = 1
        model = assign_if_not_none(filteredPrompt.model, 'paSanctuary')

        # Load default prompts from modelConfiguration.json
        with open('modelConfiguration.json', 'r') as config_file:
            config_data = json.load(config_file)
            checkpoint_data = config_data.get(model)

            prompt_data.model = checkpoint_data.get("checkpointName")
            prompt_data.vae = checkpoint_data.get("vae")
            prompt_data.steps = checkpoint_data.get("steps")
            prompt_data.width = assign_if_not_none(filteredPrompt.width, checkpoint_data.get("imageWidth"))
            prompt_data.height = assign_if_not_none(filteredPrompt.height, checkpoint_data.get("imageHeight"))
            default_positive_prompt = checkpoint_data.get("defaultPositivePrompt")
            default_negative_prompt = checkpoint_data.get("defaultNegativePrompt")

        # Create the prompt structure for Stable Diffusion
        prompt_data.seed = seed
        prompt_data.batch_size = batch_size
        prompt_data.positive_prompt = f"{default_positive_prompt}, {filteredPrompt.prompt}"
        prompt_data.negative_prompt = f"{default_negative_prompt}, ${assign_if_not_none(filteredPrompt.negative_prompt, '')}"
        
        # Connect to the websocket
        ws = websocket.WebSocket()
        ws.connect(f"ws://{server_address}/ws?clientId={client_id}")
        
        # Call the function to retrieve images after sending the prompt
        images = get_images(ws, data)
        ws.close()  # Close the websocket connection

        # Returning images
        return images

    except websocket.WebSocketException as e:
            raise RuntimeError(f"WebSocket error while generating images: {e}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Error decoding JSON response: {e}")
    except Exception as e:
        raise RuntimeError(f"Unexpected error in generate_image: {e}")

    finally:
        if ws:
            ws.close()