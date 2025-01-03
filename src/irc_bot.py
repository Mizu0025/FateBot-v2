import json
from config import IRC_CONFIG
from comfyui import generate_image
from text_filter import extract_prompts
import socket

class IRCBot:
    def __init__(self, server, port, channel, bot_nick, bot_user, trigger_word):
        self.server = server
        self.port = port
        self.channel = channel
        self.bot_nick = bot_nick
        self.bot_user = bot_user
        self.trigger_word = trigger_word
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    def handle_ping(self, response) -> None:
        """Handle PING messages from the server."""
        if response.startswith("PING"):
            self.socket.sendall(f"PONG {response.split()[1]}\r\n".encode("utf-8"))
            print("PONG sent to server")

    def handle_decode_response(self) -> str:
        """Decode the response from the server."""
        response = self.socket.recv(2048)
        return response.decode("utf-8").strip()
    
    def handle_sendall(self, message) -> None:
        """Send a message to the server."""
        self.socket.sendall(f"{message}\r\n".encode("utf-8"))
        print(f"Sent: {message}")

    def connect(self) -> None:
        """Connect to the IRC server and join the channel."""
        print(f"Connecting to {self.server}:{self.port}...")
        self.socket.connect((self.server, self.port))
        
        # Send NICK and USER in sequence
        self.handle_sendall(f"NICK {self.bot_nick}")
        self.handle_sendall(f"USER {self.bot_user} 0 * :{self.bot_nick}")
        
        # Wait for server welcome message before joining
        while True:
            response = self.handle_decode_response()
            
            # Check for successful registration (numeric 001)
            if f"001 {self.bot_nick}" in response:
                # Now join the channel
                self.handle_sendall(f"JOIN {self.channel}")
                print(f"Joined channel {self.channel}")
                break
            
            # Respond to PINGs during connection
            self.handle_ping(response)

    def listen(self) -> None:
        """Listen for messages in the channel and respond to the trigger word."""
        while True:
            response = self.handle_decode_response()

            # Respond to PINGs while in a channel
            self.handle_ping(response)
            
            # Check for messages containing the trigger word
            if f"PRIVMSG {self.channel}" in response:
                print(f"Received: {response}")
                user = response.split("!")[0][1:]  # Extract the user
                message = response.split(f"PRIVMSG {self.channel} :")[1]  # Extract the message

                # check for both trigger word and --help immediately after in message
                if self.trigger_word and '--help' in message:
                    self.handle_help_request(user)
                elif self.trigger_word and '--models' in message:
                    models = self.get_models_list()
                    self.send_user_message(user, f"The current models are: {models}")
                elif self.trigger_word in message:
                    self.handle_image_generation(user, message)

    def handle_help_request(self, user) -> None:
        """Send a help message to the channel."""
        help_message = f"{user}: To generate an image, type '{self.trigger_word} <prompt>'"
        prompt_help = f"Prompt structure: '{self.trigger_word}' <positive_text> <width> <height> <model> <negative_text>"
        prompt_help_continued = "Most options use the following format: --option=value. <negative_text> is --no."

        for message in [help_message, prompt_help, prompt_help_continued]:
            self.send_user_message(user, message)

    def get_models_list(self) -> str:
        """Return a list of available models."""
        # open modelConfiguration.json and extract the model names from root lvl
        with open('modelConfiguration.json', 'r') as file:
            data = json.load(file)
            model_names = list(data.keys())
            joined_names = ', '.join(model_names)
        
        return joined_names            
    
    def handle_image_generation(self, user, message) -> None:
            """Handle the image generation process."""
            try:
                # Extract the prompt and negative prompt
                filteredPrompt = extract_prompts(message)

                # Generate the image
                webImages = generate_image(filteredPrompt)

                # Handle the trigger (image generation)
                for image in webImages:
                    self.handle_image_reply(user, image)

            except Exception as errorMsg:
                self.handle_image_reply(user, errorMsg)

    def handle_image_reply(self, user, message) -> None:
        """Send a message back to the channel notifying the image request user."""
        response_message = f"{user}: {message}"
        self.send_message(response_message)

    def send_message(self, message) -> None:
        """Send a message to the channel."""
        self.handle_sendall(f"PRIVMSG {self.channel} :{message}")
        print(f"Sent: {message}")

    def send_user_message(self, user, message) -> None:
        """Send a message to a specific user."""
        self.handle_sendall(f"PRIVMSG {user} :{message}")
        print(f"Sent: {message}")

if __name__ == "__main__":
    bot = IRCBot(
        server=IRC_CONFIG["server"],
        port=IRC_CONFIG["port"],
        channel=IRC_CONFIG["channel"],
        bot_nick=IRC_CONFIG["bot_nick"],
        bot_user=IRC_CONFIG["bot_user"],
        trigger_word=IRC_CONFIG['bot_trigger']
    )
    bot.connect()
    bot.listen()
