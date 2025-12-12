import logging
from pathlib import Path

import voyageai
from PIL import Image

from app.config import IMAGE_SIZE, VOYAGE_API_KEY, VOYAGE_MULTIMODAL_MODEL, VOYAGE_TEXT_MODEL

logger = logging.getLogger(__name__)

vo = voyageai.Client(api_key=VOYAGE_API_KEY)


def get_multimodal_embedding(content: str | Path, mode: str, input_type: str) -> list[float]:
    """
    Generate embeddings using Voyage AI's multimodal model.

    Args:
        content: Text string or path to image file
        mode (str): Content mode ("image" or "text")
        input_type (str): Type of input ("document" or "query")

    Returns:
        list[float]: Embedding of the content as a list.
    """
    logger.info(f"Generating multimodal embedding: mode={mode}, input_type={input_type}")

    if mode == "image":
        img = Image.open(content)
        content = img.resize(IMAGE_SIZE, Image.Resampling.LANCZOS)

    result = vo.multimodal_embed(
        inputs=[[content]], model=VOYAGE_MULTIMODAL_MODEL, input_type=input_type
    ).embeddings[0]

    logger.debug(f"Generated {len(result)}-dim embedding")
    return result


def get_text_embedding(text: str, input_type: str = "document") -> list[float]:
    """
    Generate text embeddings using Voyage AI's voyage-3-large model.

    Args:
        text: Text string to embed
        input_type: Type of input ("document" or "query")

    Returns:
        list[float]: Embedding of the text as a list.
    """
    logger.info(f"Generating text embedding: input_type={input_type}")

    result = vo.embed(
        texts=[text], model=VOYAGE_TEXT_MODEL, input_type=input_type
    ).embeddings[0]

    logger.debug(f"Generated {len(result)}-dim embedding")
    return result
