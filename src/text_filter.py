import os
from typing import Tuple

bot_trigger = os.getenv('BOT_TRIGGER', '')

def extract_prompts(message: str) -> Tuple[str, str]:
    """
    Extracts the prompt and negative prompt from the message.
    Assumes the format is:
        !trigger <prompt_text> --no <negative_prompt_text>
    """

    if not bot_trigger:
        raise ValueError("Prompt trigger is missing or empty!")

    # Default values
    prompt = ""
    negative_prompt = ""

    # Remove the !trigger keyword and leading/trailing spaces
    message = message.replace(bot_trigger, "").strip()

    # Split the message into prompt and negative prompt based on "--no"
    parts = message.split("--no")

    # The first part is the prompt
    prompt = parts[0].strip()

    # If there is a negative prompt, it's after the "--no"
    if len(parts) > 1:
        negative_prompt = parts[1].strip()

    return prompt, negative_prompt
