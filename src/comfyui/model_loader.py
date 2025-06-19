import json
from typing import Dict, Optional

def load_model_configuration(model_name: str) -> Optional[Dict]:
    """Loads the configuration for a specific model."""
    try:
        with open('modelConfiguration.json', 'r') as config_file:
            config_data: Dict = json.load(config_file)
            return config_data.get(model_name)
    except FileNotFoundError:
        print("Error: modelConfiguration.json not found.")
        return None
    except json.JSONDecodeError:
        print("Error: Invalid JSON format in modelConfiguration.json.")
        return None
