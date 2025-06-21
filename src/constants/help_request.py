from config import IRC_CONFIG

bot_trigger = IRC_CONFIG["bot_trigger"]

imageGenerationHelp = f"To generate an image, type: {bot_trigger} <your_prompt>"

promptStructureHelp = f"Prompt structure: '{bot_trigger}' <positive_text> --width=<w> --height=<h> --model=<m> --no=<negative_text>"

promptExampleHelp = "Example:  a beautiful landscape --width=1024 --height=768 --model=epicMode --no=ugly, blurry"