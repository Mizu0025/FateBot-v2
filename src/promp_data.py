class PromptData:
    """Class to handle the prompt data."""
    def __init__(self, data):
        self.data = data

    @property
    def model(self) -> str:
        """Get the model name."""
        return self.data["Checkpoint"]["inputs"]["ckpt_name"]
    
    @model.setter
    def model(self, value) -> None:
        """Set the model name."""
        self.data["Checkpoint"]["inputs"]["ckpt_name"] = value

    @property
    def vae(self) -> str:
        """Get the VAE name."""
        return self.data["VAELoader"]["inputs"]["vae_name"]
    
    @vae.setter
    def vae(self, value) -> None:
        """Set the VAE name."""
        self.data["VAELoader"]["inputs"]["vae_name"] = value

    @property
    def seed(self) -> int:
        """Get the seed."""
        return self.data["KSampler"]["inputs"]["seed"]
    
    @seed.setter
    def seed(self, value) -> None:
        """Set the seed."""
        self.data["KSampler"]["inputs"]["seed"] = value

    @property
    def steps(self) -> int:
        """Get the number of steps."""
        return self.data["KSampler"]["inputs"]["steps"]

    @steps.setter
    def steps(self, value) -> None:
        """Set the number of steps."""
        self.data["KSampler"]["inputs"]["steps"] = value

    @property
    def width(self) -> int:
        """Get the width of the image."""
        return self.data["EmptyLatentImage"]["inputs"]["width"]

    @width.setter
    def width(self, value) -> None:
        """Set the width of the image."""
        self.data["EmptyLatentImage"]["inputs"]["width"] = value

    @property
    def height(self) -> int:
        """Get the height of the image."""
        return self.data["EmptyLatentImage"]["inputs"]["height"]

    @height.setter
    def height(self, value) -> None:
        """Set the height of the image."""
        self.data["EmptyLatentImage"]["inputs"]["height"] = value

    @property
    def batch_size(self) -> int:
        """Get the batch size."""
        return self.data["EmptyLatentImage"]["inputs"]["batch_size"]

    @batch_size.setter
    def batch_size(self, value) -> None:
        """Set the batch size."""
        self.data["EmptyLatentImage"]["inputs"]["batch_size"] = value

    @property
    def positive_prompt(self) -> str:
        """Get the positive prompt."""
        return self.data["PositivePrompt"]["inputs"]["text"]

    @positive_prompt.setter
    def positive_prompt(self, value) -> None:
        """Set the positive prompt."""
        self.data["PositivePrompt"]["inputs"]["text"] = value

    @property
    def negative_prompt(self) -> str:
        """Get the negative prompt."""
        return self.data["NegativePrompt"]["inputs"]["text"]

    @negative_prompt.setter
    def negative_prompt(self, value) -> None:
        """Set the negative prompt."""
        self.data["NegativePrompt"]["inputs"]["text"] = value

    # add cfg
    @property
    def cfg(self) -> float:
        """Get the cfg."""
        return self.data["KSampler"]["inputs"]["cfg"]
    
    @cfg.setter
    def cfg(self, value) -> None:
        """Set the cfg."""
        self.data["KSampler"]["inputs"]["cfg"] = value

    # add sampler
    @property
    def sampler(self) -> str:
        """Get the sampler."""
        return self.data["KSampler"]["inputs"]["sampler_name"]
    
    @sampler.setter
    def sampler(self, value) -> None:
        """Set the sampler."""
        self.data["KSampler"]["inputs"]["sampler_name"] = value