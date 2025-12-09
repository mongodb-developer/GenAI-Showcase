import logging
import os
from pathlib import Path
from typing import List, Union

import voyageai
from PIL import Image

logger = logging.getLogger(__name__)

vo = voyageai.Client(api_key=os.getenv("VOYAGE_API_KEY"))


def get_embedding(content: Union[str, Path], mode: str, input_type: str) -> List[float]:
    """
    Generate embeddings using Voyage AI's multimodal model.

    Args:
        content: Text string or path to image file
        mode (str): Content mode ("image" or "text")
        input_type (str): Type of input ("document" or "query")

    Returns:
        List[float]: Embedding of the content as a list.
    """
    logger.debug(
        f"Generating multimodal embedding: mode={mode}, input_type={input_type}"
    )

    if mode == "image":
        content = Image.open(content)

    result = vo.multimodal_embed(
        inputs=[[content]], model="voyage-multimodal-3", input_type=input_type
    ).embeddings[0]

    logger.debug(f"Generated embedding with {len(result)} dimensions")
    return result


def get_text_embedding(text: str, input_type: str = "document") -> List[float]:
    """
    Generate text embeddings using Voyage AI's voyage-3-large model.

    Args:
        text: Text string to embed
        input_type: Type of input ("document" or "query")

    Returns:
        List[float]: Embedding of the text as a list.
    """
    logger.debug(f"Generating text embedding: input_type={input_type}")

    result = vo.embed(
        texts=[text], model="voyage-3-large", input_type=input_type
    ).embeddings[0]

    logger.debug(f"Generated embedding with {len(result)} dimensions")
    return result
