import os
from PIL import Image
import math

# generate a grid of images based off filepaths passed in as a list
# and save the grid to a file
def generate_image_grid(filepaths: list[str]) -> str:
    '''Generates a grid of images based on the filepaths provided.'''
    # Open all images
    images = [Image.open(filepath) for filepath in filepaths]

    # Get the dimensions of each image
    widths, heights = zip(*(image.size for image in images))

    # Determine grid layout based on the number of images
    num_images = len(images)
    cols = math.ceil(math.sqrt(num_images))
    rows = math.ceil(num_images / cols)

    # Determine grid dimensions
    max_width = max(widths)
    max_height = max(heights)
    grid_width = cols * max_width
    grid_height = rows * max_height

    # Create a blank canvas for the grid
    grid = Image.new('RGBA', (grid_width, grid_height), (255, 255, 255, 0))

    # Paste each image into the grid
    for index, image in enumerate(images):
        row = index // cols
        col = index % cols
        x_offset = col * max_width
        y_offset = row * max_height
        grid.paste(image, (x_offset, y_offset))

    # Save the grid to a file
    grid_filename = generate_grid_filename(filepaths)
    grid.save(grid_filename)

    return grid_filename

def generate_grid_filename(filepaths: list[str]) -> str:
    '''Generates a filename for the grid based on the shared name from the list.'''
    image_uuid = filepaths[0].split('.')[0]
    grid_filename = f"{image_uuid}.00000.png"

    return grid_filename