import unittest
from src.text_filter import extract_prompts

class TestExtractPrompts(unittest.TestCase):
    def test_basic_prompt(self):
        # Arrange
        message = "!trigger happy landscape"
        
        # Act
        prompt, negative_prompt = extract_prompts(message)
        
        # Assert
        self.assertEqual(prompt, "happy landscape")
        self.assertEqual(negative_prompt, "")

    def test_prompt_with_negative_prompt(self):
        # Arrange
        message = "!trigger happy landscape --no dark gloomy"
        
        # Act
        prompt, negative_prompt = extract_prompts(message)
        
        # Assert
        self.assertEqual(prompt, "happy landscape")
        self.assertEqual(negative_prompt, "dark gloomy")

    def test_negative_prompt_only(self):
        # Arrange
        message = "!trigger --no dark gloomy"
        
        # Act
        prompt, negative_prompt = extract_prompts(message)
        
        # Assert
        self.assertEqual(prompt, "")
        self.assertEqual(negative_prompt, "dark gloomy")

    def test_empty_prompt(self):
        # Arrange
        message = "!trigger"
        
        # Act
        prompt, negative_prompt = extract_prompts(message)
        
        # Assert
        self.assertEqual(prompt, "")
        self.assertEqual(negative_prompt, "")

    def test_prompt_with_extra_spaces(self):
        # Arrange
        message = "!trigger  happy landscape   --no   dark gloomy   "
        
        # Act
        prompt, negative_prompt = extract_prompts(message)
        
        # Assert
        self.assertEqual(prompt, "happy landscape")
        self.assertEqual(negative_prompt, "dark gloomy")

    def test_no_negative_prompt(self):
        # Arrange
        message = "!trigger only positive"
        
        # Act
        prompt, negative_prompt = extract_prompts(message)
        
        # Assert
        self.assertEqual(prompt, "only positive")
        self.assertEqual(negative_prompt, "")

if __name__ == "__main__":
    unittest.main()
