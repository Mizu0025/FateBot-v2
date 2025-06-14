import os
import unittest
from text_filter import extract_prompts, FilteredPrompt
from config import IRC_CONFIG

bot_trigger = IRC_CONFIG['bot_trigger']

class TestTextFilter(unittest.TestCase):
    """Unit tests for the text_filter module."""

    def test_extract_prompts_basic(self):
        """Test extracting prompts with basic parameters."""
        message = f"{bot_trigger} pokemon plush --width=512 --height=512 --model=mymodel --no badprompt"
        expected_prompt = FilteredPrompt(prompt="pokemon plush", width=512, height=512, model="mymodel", negative_prompt="badprompt")
        actual_prompt = extract_prompts(message)
        self.assertEqual(actual_prompt.prompt, expected_prompt.prompt)
        self.assertEqual(actual_prompt.width, expected_prompt.width)
        self.assertEqual(actual_prompt.height, expected_prompt.height)
        self.assertEqual(actual_prompt.model, expected_prompt.model)
        self.assertEqual(actual_prompt.negative_prompt, expected_prompt.negative_prompt)

    def test_extract_prompts_defaults(self):
        """Test extracting prompts with only the prompt provided."""
        message = f"{bot_trigger} pokemon plush"
        expected_prompt = FilteredPrompt(prompt="pokemon plush", width=1024, height=1024, model="", negative_prompt="")
        actual_prompt = extract_prompts(message)
        self.assertEqual(actual_prompt.prompt, expected_prompt.prompt)
        self.assertEqual(actual_prompt.width, expected_prompt.width)
        self.assertEqual(actual_prompt.height, expected_prompt.height)
        self.assertEqual(actual_prompt.model, expected_prompt.model)
        self.assertEqual(actual_prompt.negative_prompt, expected_prompt.negative_prompt)

    def test_extract_prompts_no_trigger(self):
        """Test extracting prompts with missing trigger."""
        message = "pokemon plush --width=512 --height=512 --model=mymodel --no badprompt"
        with self.assertRaises(ValueError):
            extract_prompts(message)

if __name__ == '__main__':
    unittest.main()