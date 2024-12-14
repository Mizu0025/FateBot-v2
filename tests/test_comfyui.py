import unittest
from unittest.mock import patch, MagicMock
import json
import uuid

import urllib
from src.comfyui import queue_prompt, get_image, get_history, generate_image

class TestImageGeneration(unittest.TestCase):


    @patch('urllib.request.urlopen')
    @patch('uuid.uuid4')
    def test_queue_prompt(self, mock_uuid, mock_urlopen):
        # Mock the UUID to return a fixed value
        fixed_uuid = uuid.UUID('12345678-1234-5678-1234-567812345678')
        mock_uuid.return_value = fixed_uuid
        
        # Prepare mock response
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({"prompt_id": "test-prompt-id"}).encode('utf-8')
        mock_urlopen.return_value = mock_response
        
        # Test queue_prompt function
        prompt = "A beautiful landscape"
        negative_prompt = "No dark clouds"
        response = queue_prompt(prompt, negative_prompt)
        
        # Assert that the function returns the expected prompt ID
        self.assertEqual(response['prompt_id'], "test-prompt-id")
        
        # Check if the URL was called correctly with the fixed client_id
        expected_data = json.dumps({
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "client_id": str(fixed_uuid)  # Use the string representation of the fixed UUID
        }).encode('utf-8')
        
        # Get the request object that was passed to urlopen
        expected_request = urllib.request.Request(
            url='http://127.0.0.1:8188/prompt',
            data=expected_data
        )
        
        # Get the actual request passed to urlopen
        actual_request = mock_urlopen.call_args[0][0]
        
        # Debug: Print out the generated client_id to help track the issue
        print(f"Generated client_id: {actual_request.data}")

        # Assert that the URL in the request is correct
        self.assertEqual(actual_request.full_url, expected_request.full_url)
        
        # Assert that the data in the request is correct
        self.assertEqual(actual_request.data, expected_request.data)

    @patch('urllib.request.urlopen')
    def test_get_image(self, mock_urlopen):
        # Prepare mock response with image data
        mock_response = MagicMock()
        mock_response.read.return_value = b"image_data"
        
        # Mock the context manager behavior of urlopen
        mock_urlopen.return_value.__enter__.return_value = mock_response
        
        # Test get_image function
        filename = "image_1.png"
        subfolder = "folder"
        folder_type = "generated"
        image_data = get_image(filename, subfolder, folder_type)
        
        # Assert that the image data matches the mock data
        self.assertEqual(image_data, b"image_data")
        
        # Check if the URL was called correctly
        mock_urlopen.assert_called_with('http://127.0.0.1:8188/view?filename=image_1.png&subfolder=folder&type=generated')

    @patch('urllib.request.urlopen')
    @patch('src.comfyui.websocket.WebSocket')
    def test_generate_image(self, MockWebSocket, mock_urlopen):
        # Mock websocket
        mock_ws = MagicMock()
        mock_ws.recv.return_value = json.dumps({
            'type': 'executing',
            'data': {'node': None, 'prompt_id': 'test-prompt-id'}
        })
        MockWebSocket.return_value = mock_ws
        
        # Mock queue_prompt response
        mock_urlopen.return_value = MagicMock(read=MagicMock(return_value=json.dumps({
            "prompt_id": "test-prompt-id"
        }).encode('utf-8')))
        
        # Test generate_image function
        prompt_input = "A beautiful landscape"
        images = generate_image(prompt_input)
        
        # Assert that the images are returned
        self.assertIsInstance(images, dict)
        
        # Check if websocket was called correctly
        mock_ws.connect.assert_called_with("ws://127.0.0.1:8188/ws?clientId=" + str(uuid.uuid4()))
        
        # Check if get_image was called during the process
        mock_urlopen.assert_called_with('http://127.0.0.1:8188/view?filename=image_1.png&subfolder=folder&type=generated')

    @patch('urllib.request.urlopen')
    def test_get_history(self, mock_urlopen):
        # Mock response for get_history
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "test-prompt-id": {
                "outputs": {
                    "node-1": {
                        "images": [{"filename": "image_1.png", "subfolder": "folder", "type": "generated"}]
                    }
                }
            }
        }).encode('utf-8')
        mock_urlopen.return_value = mock_response
        
        # Test get_history function
        history = get_history("test-prompt-id")
        
        # Assert the correct history structure is returned
        self.assertIn("test-prompt-id", history)
        self.assertIn("outputs", history["test-prompt-id"])
        self.assertIn("node-1", history["test-prompt-id"]["outputs"])
        self.assertIn("images", history["test-prompt-id"]["outputs"]["node-1"])

    @patch('urllib.request.urlopen')
    def test_get_history_no_images(self, mock_urlopen):
        # Mock response where no images are found
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "test-prompt-id": {
                "outputs": {
                    "node-1": {}
                }
            }
        }).encode('utf-8')
        mock_urlopen.return_value = mock_response
        
        # Test get_history with no images
        history = get_history("test-prompt-id")
        
        # Assert that history exists but no images are found
        self.assertIn("test-prompt-id", history)
        self.assertIn("outputs", history["test-prompt-id"])
        self.assertIn("node-1", history["test-prompt-id"]["outputs"])
        self.assertNotIn("images", history["test-prompt-id"]["outputs"]["node-1"])

if __name__ == '__main__':
    unittest.main()
