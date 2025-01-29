class PromptData:
    """Class to handle the prompt data."""
    def __init__(self, data):
        self.data = data

    @property
    def model(self) -> str:
        """Get the model name."""
        return self.data["Checkpoint"]["inputs"]["ckpt_name"]
    
    @model.setter
    def model(self, value) -> str:
        """Set the model name."""
        self.data["Checkpoint"]["inputs"]["ckpt_name"] = value

    @property
    def vae(self) -> str:
        """Get the VAE name."""
        return self.data["VAELoader"]["inputs"]["vae_name"]
    
    @vae.setter
    def vae(self, value) -> str:
        """Set the VAE name."""
        self.data["VAELoader"]["inputs"]["vae_name"] = value

    @property
    def seed(self) -> int:
        """Get the seed."""
        return self.data["KSampler"]["inputs"]["seed"]
    
    @seed.setter
    def seed(self, value) -> int:
        """Set the seed."""
        self.data["KSampler"]["inputs"]["seed"] = value

    @property
    def steps(self) -> int:
        """Get the number of steps."""
        return self.data["KSampler"]["inputs"]["steps"]

    @steps.setter
    def steps(self, value) -> int:
        """Set the number of steps."""
        self.data["KSampler"]["inputs"]["steps"] = value

    @property
    def width(self) -> int:
        """Get the width of the image."""
        return self.data["EmptyLatentImage"]["inputs"]["width"]

    @width.setter
    def width(self, value) -> int:
        """Set the width of the image."""
        self.data["EmptyLatentImage"]["inputs"]["width"] = value

    @property
    def height(self) -> int:
        """Get the height of the image."""
        return self.data["EmptyLatentImage"]["inputs"]["height"]

    @height.setter
    def height(self, value) -> int:
        """Set the height of the image."""
        self.data["EmptyLatentImage"]["inputs"]["height"] = value

    @property
    def batch_size(self) -> int:
        """Get the batch size."""
        return self.data["EmptyLatentImage"]["inputs"]["batch_size"]

    @batch_size.setter
    def batch_size(self, value) -> int:
        """Set the batch size."""
        self.data["EmptyLatentImage"]["inputs"]["batch_size"] = value

    @property
    def positive_prompt(self) -> str:
        """Get the positive prompt."""
        return self.data["PositivePrompt"]["inputs"]["text"]

    @positive_prompt.setter
    def positive_prompt(self, value) -> str:
        """Set the positive prompt."""
        self.data["PositivePrompt"]["inputs"]["text"] = value

    @property
    def negative_prompt(self) -> str:
        """Get the negative prompt."""
        return self.data["NegativePrompt"]["inputs"]["text"]

    @negative_prompt.setter
    def negative_prompt(self, value) -> str:
        """Set the negative prompt."""
        self.data["NegativePrompt"]["inputs"]["text"] = value

    @property
    def filename(self) -> str:
        """Get the filename."""
        return self.data["SaveImage"]["inputs"]["filename_prefix"]
    
    @filename.setter
    def filename(self, value) -> str:
        """Set the filename."""
        self.data["SaveImage"]["inputs"]["filename_prefix"] = value

    @property
    def grid_filename(self) -> str:
        """Get the grid filename."""
        return self.data["SaveGridImage"]["inputs"]["filename_prefix"]
    
    @grid_filename.setter
    def grid_filename(self, value) -> str:
        """Set the grid filename."""
        self.data["SaveGridImage"]["inputs"]["filename_prefix"] = value