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
folder_path = COMFYUI_CONFIG["folder_path"]
client_id = str(uuid.uuid4())

def save_image_files(images: list[str], seed: str) -> list[str]:
    '''Saves the images to a specified folder.'''
    saved_images = []

    for image in images:
        index = len(saved_images) + 1
        filename = f"{seed}.{index}.png"
        with open(f"{folder_path}/{filename}", "wb") as file:
            file.write(image)
        saved_images.append(f"{folder_path}/{filename}")

    return saved_images

def queue_prompt(prompt):
    p = {"prompt": prompt, "client_id": client_id}
    data = json.dumps(p).encode('utf-8')
    req =  urllib.request.Request("http://{}/prompt".format(server_address), data=data)
    return json.loads(urllib.request.urlopen(req).read())

def get_image(filename, subfolder, folder_type):
    data = {"filename": filename, "subfolder": subfolder, "type": folder_type}
    url_values = urllib.parse.urlencode(data)
    with urllib.request.urlopen("http://{}/view?{}".format(server_address, url_values)) as response:
        return response.read()

def get_history(prompt_id):
    with urllib.request.urlopen("http://{}/history/{}".format(server_address, prompt_id)) as response:
        return json.loads(response.read())

def get_images(ws, prompt):
    prompt_id = queue_prompt(prompt)['prompt_id']
    output_images = {}
    current_node = ""
    while True:
        out = ws.recv()
        if isinstance(out, str):
            message = json.loads(out)
            if message['type'] == 'executing':
                data = message['data']
                if data['prompt_id'] == prompt_id:
                    if data['node'] is None:
                        break #Execution is done
                    else:
                        current_node = data['node']
        else:
            if current_node == 'SaveImageWebsocket':
                images_output = output_images.get(current_node, [])
                images_output.append(out[8:])
                output_images[current_node] = images_output

    return output_images

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
        batch_size = 2
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
        prompt_data.negative_prompt = f"nsfw, nude, {default_negative_prompt}, ${assign_if_not_none(filteredPrompt.negative_prompt, '')}"
        
        # Connect to the websocket
        ws = websocket.WebSocket()
        ws.connect(f"ws://{server_address}/ws?clientId={client_id}")
        
        # Call the function to retrieve images after sending the prompt
        images = get_images(ws, data)
        ws.close()  # Close the websocket connection

        # Save the images
        saved_images = save_image_files(images["SaveImageWebsocket"], seed)

        # Returning images
        return saved_images

    except websocket.WebSocketException as e:
            raise RuntimeError(f"WebSocket error while generating images: {e}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Error decoding JSON response: {e}")
    except Exception as e:
        raise RuntimeError(f"Unexpected error in generate_image: {e}")

    finally:
        if ws:
            ws.close()
