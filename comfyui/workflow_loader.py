import json
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

def load_workflow_data(workflow_path: str) -> Optional[Dict]:
    """Loads the ComfyUI workflow data from a JSON file."""
    try:
        with open(workflow_path, 'r') as workflow_file:
            logger.info(f"Loading workflow data from {workflow_path}")
            return json.load(workflow_file)
    except FileNotFoundError:
        logger.exception(f"Error: {workflow_path} not found.")
        raise FileNotFoundError(f"{workflow_path} not found. Please ensure it exists in the current directory.")
    except json.JSONDecodeError as e:
        logger.exception(f"Error: Invalid JSON format in {workflow_path}: {e}")
        raise ValueError(f"Invalid JSON format in {workflow_path}. Please check the file for errors.")