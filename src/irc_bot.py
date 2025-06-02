import json
import irc.bot
from config import IRC_CONFIG
from comfyui import generate_image
from image_grid import generate_image_grid
from text_filter import extract_prompts

class ImageGenBot(irc.bot.SingleServerIRCBot):
    def __init__(self, channel, trigger_word, server_list):
        # The library handles the server connection details
        super().__init__(server_list, IRC_CONFIG["bot_nick"], IRC_CONFIG["bot_user"])
        
        # Your application-specific config
        self.channel = channel
        self.trigger_word = trigger_word

    def on_welcome(self, c, e):
        """Called when the bot has successfully connected to the server."""
        print(f"Successfully connected to {e.source}!")
        print(f"Joining channel: {self.channel}")
        c.join(self.channel)

    def on_pubmsg(self, c, e):
        """Called when a public message is received in a channel."""
        user_nick = e.source.nick
        message = e.arguments[0]

        # Check if the message contains our trigger word
        if self.trigger_word in message:
            print(f"Trigger word received from {user_nick}: {message}")
            self.dispatch_command(c, user_nick, message)

    def dispatch_command(self, c, user, message):
        """Determines which command to execute based on the message."""
        if '--help' in message:
            self.handle_help_request(c, user)
        elif '--models' in message:
            self.handle_models_list(c, user)
        else:
            self.handle_image_generation(c, user, message)

    def handle_models_list(self, c, user):
        try:
            models = self.get_models_list()
                # Use c.notice to send a private message to the user
            c.notice(user, f"Available models: {models}")
        except Exception as e:
            c.notice(user, f"Error getting models: {e}")

    def handle_help_request(self, c, user):
        """Sends a help message to a user via NOTICE."""
        help_messages = [
            f"To generate an image, type: {IRC_CONFIG} <your_prompt>",
            f"Prompt structure: '{self.trigger_word}' <positive_text> --width=<w> --height=<h> --model=<m> --no=<negative_text>",
            "Example: !gen a beautiful landscape --width=1024 --height=768 --model=epicMode --no=ugly, blurry"
        ]
        for msg in help_messages:
            # c.notice sends a private message that avoids triggering other bots
            c.notice(user, msg)

    def get_models_list(self) -> str:
        """Returns a comma-separated list of available models."""
        with open('modelConfiguration.json', 'r') as file:
            data = json.load(file)
            return ', '.join(data.keys())

    def handle_image_generation(self, c, user, message):
        """Handles the image generation process."""
        # Use c.privmsg to send a public message to the channel
        try:
            filtered_prompt = extract_prompts(message)
            api_images = generate_image(filtered_prompt)
            grid_image_info = generate_image_grid(api_images) # Assuming this returns a URL or file path
            
            c.privmsg(self.channel, f"{user}: Your image is ready! {grid_image_info}")

        except Exception as e:
            print(f"ERROR during image generation: {e}")
            c.privmsg(self.channel, f"{user}: An error occurred during image generation: {e}")


if __name__ == "__main__":
    # The server list is a list of tuples: [(server, port), ...]
    server_list = [(IRC_CONFIG["server"], IRC_CONFIG["port"])]
    
    bot = ImageGenBot(
        channel=IRC_CONFIG["channel"],
        trigger_word=IRC_CONFIG['bot_trigger'],
        server_list=server_list
    )
    
    print("Starting bot...")
    # The start() method runs the bot's main loop and handles everything.
    # It will block here until the bot is terminated.
    bot.start()