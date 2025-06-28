import json
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

def load_model_configuration(model_name: str) -> Optional[Dict]:
    """Loads the configuration for a specific model."""
    try:
        with open('modelConfiguration.json', 'r') as config_file:
            config_data: Dict = json.load(config_file)
            return config_data.get(model_name)
    except FileNotFoundError:
        logger.exception("Error: modelConfiguration.json not found.")
        raise FileNotFoundError("modelConfiguration.json not found. Please ensure it exists in the current directory.")
    except json.JSONDecodeError:
        logger.exception("Error: Invalid JSON format in modelConfiguration.json.")
        raise ValueError("Invalid JSON format in modelConfiguration.json. Please check the file for errors.")
