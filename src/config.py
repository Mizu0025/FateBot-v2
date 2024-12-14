from dotenv import load_dotenv
import os

# Load the base .env file
load_dotenv()

# load env specific values
environment = os.getenv("ENVIRONMENT", 'development')
load_dotenv(f'.env.{environment}')

# Access the variables
IRC_CONFIG = {
    "server": os.getenv("SERVER"),
    "port": int(os.getenv("PORT", 6667)),  # Default to 6667 if PORT is not set
    "channel": os.getenv("CHANNEL"),
    "bot_nick": os.getenv("BOT_NICK"),
    "bot_user": os.getenv("BOT_USER"),
    "bot_trigger": os.getenv("BOT_TRIGGER")
}

COMFYUI_CONFIG = {
    "address": os.getenv("COMFYUI_ADDRESS"),
    "domain": os.getenv("COMFYUI_DOMAIN"),
    "image_folder": os.getenv("COMFYUI_OUTPUT")
}