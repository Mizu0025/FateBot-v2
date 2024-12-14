from typing import Any, Dict

class SectionMapper:
    def __init__(self, data: Dict[str, Any]):
        self._data = data

    @property
    def ksampler(self) -> "KSampler":
        """Access the 'KSampler' section."""
        return KSampler(self._data["3"]["inputs"])

    @property
    def checkpoint(self) -> "Checkpoint":
        """Access the 'Checkpoint' section."""
        return Checkpoint(self._data["4"]["inputs"])

    @property
    def latent_image(self) -> "LatentImage":
        """Access the 'LatentImage' section."""
        return LatentImage(self._data["5"]["inputs"])

    @property
    def positive_prompt(self) -> "Prompt":
        """Access the 'Positive Prompt' section."""
        return Prompt(self._data["6"]["inputs"])

    @property
    def negative_prompt(self) -> "Prompt":
        """Access the 'Negative Prompt' section."""
        return Prompt(self._data["7"]["inputs"])

    @property
    def vae_decode(self) -> "VAEDecode":
        """Access the 'VAE Decode' section."""
        return VAEDecode(self._data["8"]["inputs"])

    @property
    def save_image(self) -> "SaveImage":
        """Access the 'Save Image' section."""
        return SaveImage(self._data["9"]["inputs"])

    @property
    def vae_loader(self) -> "VAELoader":
        """Access the 'VAE Loader' section."""
        return VAELoader(self._data["10"]["inputs"])


class KSampler:
    def __init__(self, data: Dict[str, Any]):
        self._data = data

    @property
    def seed(self) -> int:
        return self._data["seed"]

    @seed.setter
    def seed(self, value: int):
        self._data["seed"] = value

    @property
    def steps(self) -> int:
        return self._data["steps"]

    @steps.setter
    def steps(self, value: int):
        self._data["steps"] = value

class Checkpoint:
    def __init__(self, data: Dict[str, Any]):
        self._data = data

    @property
    def ckpt_name(self) -> str:
        return self._data["ckpt_name"]

    @ckpt_name.setter
    def ckpt_name(self, value: str):
        self._data["ckpt_name"] = value


class LatentImage:
    def __init__(self, data: Dict[str, Any]):
        self._data = data

    @property
    def width(self) -> int:
        return self._data["width"]

    @width.setter
    def width(self, value: int):
        self._data["width"] = value

    @property
    def height(self) -> int:
        return self._data["height"]

    @height.setter
    def height(self, value: int):
        self._data["height"] = value

    @property
    def batch_size(self) -> int:
        return self._data["batch_size"]

    @batch_size.setter
    def batch_size(self, value: int):
        self._data["batch_size"] = value


class Prompt:
    def __init__(self, data: Dict[str, Any]):
        self._data = data

    @property
    def text(self) -> str:
        return self._data["text"]

    @text.setter
    def text(self, value: str):
        self._data["text"] = value


class VAEDecode:
    def __init__(self, data: Dict[str, Any]):
        self._data = data

    @property
    def samples(self) -> Any:
        return self._data["samples"]

    @samples.setter
    def samples(self, value: Any):
        self._data["samples"] = value


class SaveImage:
    def __init__(self, data: Dict[str, Any]):
        self._data = data

    @property
    def filename_prefix(self) -> str:
        return self._data["filename_prefix"]

    @filename_prefix.setter
    def filename_prefix(self, value: str):
        self._data["filename_prefix"] = value


class VAELoader:
    def __init__(self, data: Dict[str, Any]):
        self._data = data

    @property
    def vae_name(self) -> str:
        return self._data["vae_name"]

    @vae_name.setter
    def vae_name(self, value: str):
        self._data["vae_name"] = value
