import os
import uuid
from typing import List
from configuration.config import COMFYUI_FOLDER_PATH

CLIENT_ID = str(uuid.uuid4())

def save_image_files(images: List[bytes], seed: str) -> List[str]:
    """Saves the provided image byte data to PNG files."""
    if COMFYUI_FOLDER_PATH is None:
        raise ValueError("Image save folder path not configured.")

    saved_images = []

    for index, image_bytes in enumerate(images):
        filename = f"{seed}_{index + 1:03d}.png"
        filepath = os.path.join(COMFYUI_FOLDER_PATH, filename)
        try:
            with open(filepath, "wb") as file:
                file.write(image_bytes)
            saved_images.append(filepath)
        except Exception as e:
            print(f"Error saving image {filename}: {e}")
    return saved_images