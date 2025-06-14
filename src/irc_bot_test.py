import unittest
from unittest.mock import patch, MagicMock
from irc_bot import ImageGenBot
from config import IRC_CONFIG  # Import to access IRC_CONFIG

class TestImageGenBotDispatch(unittest.TestCase):
    def setUp(self):
        # Mock dependencies
        self.mock_irc_channel = MagicMock()
        self.mock_user = "test_user"
        self.mock_bot = ImageGenBot(
            channel=IRC_CONFIG["channel"], 
            trigger_word=IRC_CONFIG['bot_trigger'], 
            server_list=[])  # Dummy server list

    # --- Help Command Tests ---
    @patch('irc_bot.ImageGenBot.handle_help_request')
    def test_dispatch_help(self, mock_handle_help_request):
        """Test dispatch_command with --help."""
        message = "--help"
        self.mock_bot.dispatch_command(self.mock_irc_channel, self.mock_user, message)
        mock_handle_help_request.assert_called_once_with(self.mock_irc_channel, self.mock_user)

    @patch('irc_bot.ImageGenBot.handle_help_request')
    def test_handle_help_request_success(self, mock_handle_help_request):
        """Test handle_help_request with a successful help message generation."""
        mock_handle_help_request.return_value = None  # Help messages are sent via c.notice, so no return value
        self.mock_bot.handle_help_request(self.mock_irc_channel, self.mock_user)
        mock_handle_help_request.assert_called_once_with(self.mock_irc_channel, self.mock_user)

    # --- Models Command Tests ---
    @patch('irc_bot.ImageGenBot.handle_models_list')
    def test_dispatch_models(self, mock_handle_models_list):
        """Test dispatch_command with --models."""
        message = "--models"
        self.mock_bot.dispatch_command(self.mock_irc_channel, self.mock_user, message)
        mock_handle_models_list.assert_called_once_with(self.mock_irc_channel, self.mock_user)

    @patch('irc_bot.ImageGenBot.handle_models_list')
    def test_handle_models_list_success(self, mock_handle_models_list):
        """Test handle_models_list with a successful model list retrieval."""
        mock_handle_models_list.return_value = None  # Models list is sent via c.notice, so no return value
        self.mock_bot.handle_models_list(self.mock_irc_channel, self.mock_user)
        mock_handle_models_list.assert_called_once_with(self.mock_irc_channel, self.mock_user)

    # --- Image Generation Command Tests ---
    @patch('irc_bot.ImageGenBot.handle_image_generation')
    def test_dispatch_image_generation(self, mock_handle_image_generation):
        """Test dispatch_command with a default message."""
        message = "some random message"
        self.mock_bot.dispatch_command(self.mock_irc_channel, self.mock_user, message)
        mock_handle_image_generation.assert_called_once_with(self.mock_irc_channel, self.mock_user, message)

    @patch('irc_bot.ImageGenBot.handle_image_generation')
    def test_handle_image_generation_success(self, mock_handle_image_generation):
        """Test handle_image_generation with a successful image generation."""
        message = "test prompt"
        mock_handle_image_generation.return_value = None  # Image URL/path is sent via c.privmsg, so no return value
        self.mock_bot.handle_image_generation(self.mock_irc_channel, self.mock_user, message)
        mock_handle_image_generation.assert_called_once_with(self.mock_irc_channel, self.mock_user, message)

if __name__ == '__main__':
    unittest.main(verbosity=2)