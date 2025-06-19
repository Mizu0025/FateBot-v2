import json
from typing import Dict, Optional

def load_workflow_data(workflow_path: str) -> Optional[Dict]:
    """Loads the ComfyUI workflow data from a JSON file."""
    try:
        with open(workflow_path, 'r') as workflow_file:
            return json.load(workflow_file)
    except FileNotFoundError:
        print(f"Error: {workflow_path} not found.")
        return None
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON format in {workflow_path}: {e}")
        return None
