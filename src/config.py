from dotenv import load_dotenv
import os

# Load the .env file
load_dotenv()

# Access the variables
IRC_CONFIG = {
    "server": os.getenv("SERVER"),
    "port": int(os.getenv("PORT", 6667)),  # Default to 6667 if PORT is not set
    "channel": os.getenv("CHANNEL"),
    "bot_nick": os.getenv("BOT_NICK"),
    "bot_user": os.getenv("BOT_USER"),
    "bot_trigger": os.getenv("BOT_TRIGGER")
}
