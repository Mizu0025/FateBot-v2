import websocket
import uuid
import json
import urllib.request
from urllib.error import URLError
from typing import List, Dict, Optional
from configuration.config import COMFYUI_ADDRESS

CLIENT_ID = str(uuid.uuid4())

def queue_prompt(prompt: Dict) -> Optional[str]:
    """Queues a prompt to the ComfyUI server."""
    if COMFYUI_ADDRESS is None:
        raise ValueError("ComfyUI server address not configured.")

    try:
        p = {"prompt": prompt, "client_id": CLIENT_ID}
        data = json.dumps(p).encode('utf-8')
        req = urllib.request.Request(f"http://{COMFYUI_ADDRESS}/prompt", data=data)
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

def connect_websocket_comfyui() -> Optional[websocket.WebSocket]:
    """Connects to the ComfyUI websocket."""
    try:
        ws = websocket.WebSocket()
        ws.connect(f"ws://{COMFYUI_ADDRESS}/ws?clientId={CLIENT_ID}")
        return ws
    except ConnectionRefusedError as e:
        print(f"Error connecting to ComfyUI server: {e}")
        return None
    except websocket.WebSocketException as e:
        print(f"WebSocket connection error: {e}")
        return None
