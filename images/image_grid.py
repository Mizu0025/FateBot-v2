from PIL import Image
import math

from configuration.config import COMFYUI_DOMAIN_PATH, COMFYUI_FOLDER_PATH

def open_images(filepaths: list[str]) -> list[Image.Image]:
    '''Opens all images from the provided filepaths.'''
    return [Image.open(filepath) for filepath in filepaths]

def get_image_dimensions(images: list[Image.Image]) -> tuple[tuple[int, int], tuple[int, int]]:
    '''Gets the dimensions of each image.'''
    widths, heights = zip(*(image.size for image in images))
    return widths, heights

def determine_grid_layout(num_images: int) -> tuple[int, int]:
    '''Determines the grid layout based on the number of images.'''
    cols = math.ceil(math.sqrt(num_images))
    rows = math.ceil(num_images / cols)
    return cols, rows

def create_blank_canvas(cols: int, rows: int, max_width: int, max_height: int) -> Image.Image:
    '''Creates a blank canvas for the grid.'''
    grid_width = cols * max_width
    grid_height = rows * max_height
    return Image.new('RGBA', (grid_width, grid_height), (255, 255, 255, 0))

def paste_images_to_grid(images: list[Image.Image], grid: Image.Image, cols: int, max_width: int, max_height: int):
    '''Pastes each image into the grid.'''
    for index, image in enumerate(images):
        row = index // cols
        col = index % cols
        x_offset = col * max_width
        y_offset = row * max_height
        grid.paste(image, (x_offset, y_offset))

def save_grid(grid: Image.Image, seed: str) -> str:
    '''Saves the grid to a file.'''
    grid_filename = f"{seed}.0.png"
    grid_path = f"{COMFYUI_FOLDER_PATH}/{grid_filename}"
    grid.save(grid_path)

    return grid_path

def get_domain_path(grid_path: str) -> str:
    '''Returns the domain path of the grid.'''
    if COMFYUI_DOMAIN_PATH is None:
        raise ValueError("Domain path is not set in the configuration.")
    if COMFYUI_FOLDER_PATH is None:
        raise ValueError("Folder path is not set in the configuration.")

    path = grid_path.replace(COMFYUI_FOLDER_PATH, COMFYUI_DOMAIN_PATH)

    return path

def generate_image_grid(filepaths: list[str]) -> str:
    '''Generates a grid of images based on the filepaths provided.'''
    seed = filepaths[0].split('/')[-1].split('.')[0]
    images = open_images(filepaths)
    widths, heights = get_image_dimensions(images)
    num_images = len(images)
    cols, rows = determine_grid_layout(num_images)
    max_width = max(widths)
    max_height = max(heights)
    grid = create_blank_canvas(cols, rows, max_width, max_height)
    paste_images_to_grid(images, grid, cols, max_width, max_height)
    grid_path = save_grid(grid, seed)
    domain_path = get_domain_path(grid_path)

    return domain_path
