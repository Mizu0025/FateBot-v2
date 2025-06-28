import json
import irc.bot
from comfyui.image_generation import generate_image
from images.image_grid import generate_image_grid
from text_filter.text_filter import extract_prompts
from constants.help_request import imageGenerationHelp, promptStructureHelp, promptExampleHelp

class ImageGenBot(irc.bot.SingleServerIRCBot):
    def __init__(self, bot_nick: str, bot_user: str, channel: str, trigger_word: str, server_list: list[tuple[str, int]]):
        super().__init__(server_list, bot_nick, bot_user)
        
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
            c.notice(user, f"Available models: {models}")
        except Exception as e:
            c.notice(user, f"Error getting models: {e}")

    def handle_help_request(self, c, user):
        """Sends a help message to a user via NOTICE."""
        help_messages = [imageGenerationHelp, promptStructureHelp, promptExampleHelp]
        for msg in help_messages:
            c.notice(user, msg)

    def get_models_list(self) -> str:
        """Returns a comma-separated list of available models."""
        with open('modelConfiguration.json', 'r') as file:
            data = json.load(file)
            return ', '.join(data.keys())

    def handle_image_generation(self, c, user, message):
        """Handles the image generation process."""
        try:
            filtered_prompt = extract_prompts(message)
            api_images = generate_image(filtered_prompt)
            grid_image_info = generate_image_grid(api_images)
            
            c.privmsg(self.channel, f"{user}: Your image is ready! {grid_image_info}")

        except Exception as e:
            print(f"ERROR during image generation: {e}")
            c.privmsg(self.channel, f"{user}: An error occurred during image generation: {e}")