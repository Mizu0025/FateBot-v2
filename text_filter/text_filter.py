import logging
from configuration.config import BOT_TRIGGER

logger = logging.getLogger(__name__)

class FilteredPrompt:
    """Exracted data from the prompt message."""
    def __init__(self, prompt: str, width: int, height: int, model: str, negative_prompt: str):
        self.prompt = prompt
        self.width = width
        self.height = height
        self.model = model
        self.negative_prompt = negative_prompt

    def __str__(self):
        return f"Prompt: {self.prompt}\nWidth: {self.width}\nHeight: {self.height}\nModel: {self.model}\nNegative Prompt: {self.negative_prompt}"

def extract_prompts(message: str) -> FilteredPrompt:
    """
    Extracts the prompt, width, height, model, and negative prompt from the message.
    Assumes the format is:
        !trigger <prompt_text> --width=<width> --height=<height> --model=<model> --no <negative_prompt_text>
    """

    # if message doesn't begin with the bot trigger, raise an error
    if not message.startswith(BOT_TRIGGER):
        logger.error("Prompt trigger is missing or empty!")
        raise ValueError("Prompt trigger is missing or empty!")

    # Default values
    prompt = ""
    width = 1024
    height = 1024
    model = ""
    negative_prompt = ""

    # Remove the !trigger keyword and leading/trailing spaces
    message = message.replace(BOT_TRIGGER, "").strip()

    # Split the message into parts based on known keywords
    parts = message.split("--")

    # The first part is the prompt
    prompt = parts[0].strip()

    # Process each part to extract width, height, model, and negative prompt
    for part in parts[1:]:
        if part.startswith("width="):
            width = int(part[len("width="):].strip())
        elif part.startswith("height="):
            height = int(part[len("height="):].strip())
        elif part.startswith("model="):
            model = part[len("model="):].strip()
        elif part.startswith("no"):
            negative_prompt = part[len("no"):].strip()

    logger.info("Extracted prompt data for image generation")
    return FilteredPrompt(prompt, width, height, model, negative_prompt)