import os
from dotenv import load_dotenv

# Load the base .env file
load_dotenv()

# load env specific values
environment = os.getenv("ENVIRONMENT", 'development')
load_dotenv(f'.env.{environment}', override=True)

# Configuration for the IRC bot
IRC_SERVER = os.getenv("SERVER", 'hayate')
IRC_PORT = int(os.getenv("PORT", 6667))
CHANNEL = os.getenv("CHANNEL", '#fatebot')
BOT_NICK = os.getenv("BOT_NICK", 'FateBot')
BOT_USER = os.getenv("BOT_USER", 'Fate Testarossa')
BOT_TRIGGER = os.getenv("BOT_TRIGGER", '!trigger')

# Configuration for ComfyUI
COMFYUI_ADDRESS = os.getenv("COMFYUI_ADDRESS", 'http://hayate:8188')
COMFYUI_DOMAIN_PATH = os.getenv("COMFYUI_DOMAIN_PATH", 'mock_domain_path')
COMFYUI_FOLDER_PATH = os.getenv("COMFYUI_FOLDER_PATH", 'mock_folder_path')
