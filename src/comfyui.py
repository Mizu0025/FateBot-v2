import os
import random
from dotenv import load_dotenv
import websocket
import uuid
import json
import urllib.request
import urllib.parse

# Load environment variables from the .env file
load_dotenv()

# Fetch the server address from the environment variables
server_address = os.getenv('COMFYUI_ADDRESS', '127.0.0.1:8188')
output_address = os.getenv('COMFYUI_OUTPUT', '')
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
                domainUrl = output_address + imageFile
                images_output.append(domainUrl)

    return images_output

# Function to generate and retrieve an image based on a user-provided text prompt
def generate_image(positive_prompt, negative_prompt):
    ws = None

    try:
        # Assign image details
        seed = random.randint(1, 1000000)
        steps = 20
        batch_size = 1
        img_height = 512
        img_width = 512

        # Create the prompt structure for Stable Diffusion
        prompt_json = {
                "3": {
                    "class_type": "KSampler",
                    "inputs": {
                        "cfg": 8,
                        "denoise": 1,
                        "latent_image": [
                            "5",
                            0
                        ],
                        "model": [
                            "4",
                            0
                        ],
                        "negative": [
                            "7",
                            0
                        ],
                        "positive": [
                            "6",
                            0
                        ],
                        "sampler_name": "euler",
                        "scheduler": "normal",
                        "seed": seed,
                        "steps": steps
                    }
                },
                "4": {
                    "class_type": "CheckpointLoaderSimple",
                    "inputs": {
                        "ckpt_name": "MeinaMix_v11.safetensors"
                    }
                },
                "5": {
                    "class_type": "EmptyLatentImage",
                    "inputs": {
                        "batch_size": batch_size,
                        "height": img_height,
                        "width": img_width
                    }
                },
                "6": {
                    "class_type": "CLIPTextEncode",
                    "inputs": {
                        "clip": [
                            "4",
                            1
                        ],
                        "text": positive_prompt
                    }
                },
                "7": {
                    "class_type": "CLIPTextEncode",
                    "inputs": {
                        "clip": [
                            "4",
                            1
                        ],
                        "text": negative_prompt
                    }
                },
                "8": {
                    "class_type": "VAEDecode",
                    "inputs": {
                        "samples": [
                            "3",
                            0
                        ],
                        "vae": [
                            "4",
                            2
                        ]
                    }
                },
                "9": {
                    "class_type": "SaveImage",
                    "inputs": {
                        "filename_prefix": "ComfyUI",
                        "images": [
                            "8",
                            0
                        ]
                    }
                }
        }
        # Connect to the websocket
        ws = websocket.WebSocket()
        ws.connect(f"ws://{server_address}/ws?clientId={client_id}")
        
        # Call the function to retrieve images after sending the prompt
        images = get_images(ws, prompt_json)
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
