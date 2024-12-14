import os
import random
import websocket
import uuid
import json
import urllib.request
import urllib.parse

from config import COMFYUI_CONFIG
from json_section_mapper import SectionMapper

# Fetch the server address from the environment variables
server_address = COMFYUI_CONFIG["address"]
image_domain = COMFYUI_CONFIG["domain"]
image_folder = COMFYUI_CONFIG["image_folder"]
client_id = str(uuid.uuid4())

# Function to queue the prompt to the API
def queue_prompt(prompt):
    p = {"prompt": prompt, "client_id": client_id}
    data = json.dumps(p).encode('utf-8')
    req = urllib.request.Request("http://{}/prompt".format(server_address), data=data)
    return json.loads(urllib.request.urlopen(req).read())

# Function to get the image data from the API
def get_image(filename, subfolder, folder_type):
    data = {"filename": filename, "subfolder": subfolder, "type": folder_type}
    url_values = urllib.parse.urlencode(data)
    with urllib.request.urlopen("http://{}/view?{}".format(server_address, url_values)) as response:
        return response.url

# Function to get history of the prompt execution
def get_history(prompt_id):
    with urllib.request.urlopen("http://{}/history/{}".format(server_address, prompt_id)) as response:
        return json.loads(response.read())

# Main function to handle prompt sending and image retrieval via websocket
def get_images(ws, prompt):
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

# Function to generate and retrieve an image based on a user-provided text prompt
def generate_image(positive_prompt, negative_prompt):
    ws = None

    try:
        # load json prompt from file
        with open('workflows/paSanctuary_v4.json', 'r') as file:
            data = json.load(file)
            mapper = SectionMapper(data)

        # Assign image details
        seed = random.randint(1, 1000000)
        steps = 20
        batch_size = 1
        img_height = 1024
        img_width = 1024
        default_positive_prompt = "masterpiece, best quality"
        default_negative_prompt = "lowres, worst quality, low quality, bad anatomy, bad proportions, simple background"

        # Create the prompt structure for Stable Diffusion
        mapper.ksampler.seed = seed
        mapper.ksampler.steps = steps
        mapper.latent_image.width = img_width
        mapper.latent_image.height = img_height
        mapper.latent_image.batch_size = batch_size
        mapper.positive_prompt.text = f"{default_positive_prompt}, {positive_prompt}"
        mapper.negative_prompt.text = f"{default_negative_prompt}, {negative_prompt}"
        
        # Connect to the websocket
        ws = websocket.WebSocket()
        ws.connect(f"ws://{server_address}/ws?clientId={client_id}")
        
        # Call the function to retrieve images after sending the prompt
        images = get_images(ws, data)
        ws.close()  # Close the websocket connection

        # Returning images (or you can process them further here)
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

if __name__ == "__main__":
    test_pos_prompt = '1girl, casual clothes, short hair, smiling, green eyes, loli, flat chest, city streets'
    test_neg_prompt = 'nsfw, nude, poor quality'
    print('Connecting to ' + server_address)

    result = generate_image(test_pos_prompt, test_neg_prompt)
    print(result)
