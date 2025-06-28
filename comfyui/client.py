import logging
import websocket
import uuid
import json
import urllib.request
from urllib.error import URLError
from typing import List, Dict, Optional
from configuration.config import COMFYUI_ADDRESS

CLIENT_ID = str(uuid.uuid4())
logger = logging.getLogger(__name__)

def queue_prompt(prompt: Dict) -> Optional[str]:
    """Queues a prompt to the ComfyUI server."""
    if COMFYUI_ADDRESS is None:
        logger.error("ComfyUI server address is not configured.")
        raise ValueError("ComfyUI server address not configured.")

    try:
        p = {"prompt": prompt, "client_id": CLIENT_ID}
        data = json.dumps(p).encode('utf-8')
        req = urllib.request.Request(f"http://{COMFYUI_ADDRESS}/prompt", data=data)
        response = urllib.request.urlopen(req)

        logger.info("Prompt queued successfully.")
        return json.loads(response.read())['prompt_id']
    except URLError as e:
        logger.exception(f"Error queuing prompt: {e}")
        return None
    except json.JSONDecodeError as e:
        logger.exception(f"Error decoding prompt queue response: {e}")
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
            logger.exception("Websocket timeout during image retrieval.")
            raise websocket.WebSocketTimeoutException("Websocket timeout while waiting for images.")
        except websocket.WebSocketException as e:
            logger.exception(f"Websocket error during image retrieval: {e}")
            raise websocket.WebSocketException(f"Websocket error: {e}")
        except json.JSONDecodeError as e:
            logger.exception(f"Error decoding websocket message: {e}")
            raise ValueError(f"Error decoding websocket message: {e}")
        except Exception as e:
            logger.exception(f"Unexpected error during websocket communication: {e}")
            raise Exception(f"Unexpected error during websocket communication: {e}")

    logger.info("Image retrieval complete.")
    return output_images

def connect_websocket_comfyui() -> Optional[websocket.WebSocket]:
    """Connects to the ComfyUI websocket."""
    try:
        ws = websocket.WebSocket()
        ws.connect(f"ws://{COMFYUI_ADDRESS}/ws?clientId={CLIENT_ID}")

        logger.info(f"Connected to ComfyUI server at {COMFYUI_ADDRESS}")
        return ws
    except ConnectionRefusedError as e:
        logger.exception(f"Error connecting to ComfyUI server: {e}")
        raise ConnectionRefusedError(f"Could not connect to ComfyUI server at {COMFYUI_ADDRESS}. Is the server running?")
    except websocket.WebSocketException as e:
        logger.exception(f"WebSocket connection error: {e}")
        raise websocket.WebSocketException(f"WebSocket connection error: {e}")
