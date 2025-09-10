import asyncio
import base64
import logging
import os
from typing import List

import openai
import voyageai
from PIL import Image

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self):
        self.voyage_client = None
        self.openai_client = None
        self._clients_initialized = False

        # Get embedding dimensions from environment variable
        self.EMBEDDING_DIM_SIZE = int(os.getenv("EMBEDDING_DIM_SIZE", "1024"))
        logger.info(
            f"AI service initialized with embedding dimensions: {self.EMBEDDING_DIM_SIZE}"
        )

    def _initialize_clients(self):
        """Initialize AI service clients (lazy loading)"""
        if self._clients_initialized:
            return

        try:
            # Initialize Voyage AI client
            voyage_api_key = os.getenv("VOYAGE_AI_API_KEY")
            if voyage_api_key and voyage_api_key != "your_voyage_ai_api_key_here":
                self.voyage_client = voyageai.Client(api_key=voyage_api_key)
                logger.info("Voyage AI client initialized")
            else:
                logger.warning("VOYAGE_AI_API_KEY not found or using placeholder value")

            # Initialize OpenAI client
            openai_api_key = os.getenv("OPENAI_API_KEY")
            if openai_api_key and openai_api_key != "your_openai_api_key_here":
                self.openai_client = openai.OpenAI(api_key=openai_api_key)
                logger.info("OpenAI client initialized")
            else:
                logger.warning("OPENAI_API_KEY not found or using placeholder value")

            self._clients_initialized = True

        except Exception as e:
            logger.error(f"Failed to initialize AI clients: {e}")

    async def get_voyage_embedding(
        self, data, input_type: str = "document"
    ) -> List[float]:
        """
        Get Voyage AI multimodal embeddings for images and text.

        Args:
            data: PIL Image object, image file path, or text string
            input_type: "document" or "query"

        Returns:
            List of embeddings
        """
        try:
            # Initialize clients if not done yet
            self._initialize_clients()

            if not self.voyage_client:
                raise ValueError("Voyage AI client not initialized")

            # Handle different input types
            if isinstance(data, str) and data.endswith(
                (".jpg", ".jpeg", ".png", ".gif", ".bmp")
            ):
                # For image file paths, load the image with PIL
                image = Image.open(data)
                embed_data = image
            elif hasattr(data, "mode"):  # PIL Image object
                # Already a PIL Image
                embed_data = data
            else:
                # Text data
                embed_data = data

            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: self.voyage_client.multimodal_embed(
                    inputs=[[embed_data]],
                    model="voyage-multimodal-3",
                    input_type=input_type,
                ),
            )

            return result.embeddings[0]

        except Exception as e:
            logger.error(f"Failed to get Voyage embedding: {e}")
            # Return dummy embedding for development/testing
            return [0.0] * self.EMBEDDING_DIM_SIZE

    async def generate_frame_description(self, image_path: str) -> str:
        """
        Generate detailed description of a video frame using GPT-4 Vision

        Args:
            image_path: Path to the frame image

        Returns:
            Detailed description of the frame
        """
        try:
            # Initialize clients if not done yet
            self._initialize_clients()

            if not self.openai_client:
                logger.warning(
                    "OpenAI client not available, using placeholder description"
                )
                return "Frame description unavailable - OpenAI API key not configured"

            # Convert image to base64
            with open(image_path, "rb") as image_file:
                image_data = base64.b64encode(image_file.read()).decode()

            prompt = """Analyze this video frame and provide a detailed description including:
1. Main subjects or people in the scene
2. Actions or activities taking place
3. Setting/environment (indoor/outdoor, location type)
4. Objects, props, or notable elements
5. Overall mood or atmosphere
6. Any text or graphics visible

Keep the description concise but informative, around 2-3 sentences."""

            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{image_data}",
                                        "detail": "low",
                                    },
                                },
                            ],
                        }
                    ],
                    max_tokens=300,
                ),
            )

            description = response.choices[0].message.content.strip()
            return description

        except Exception as e:
            logger.error(f"Failed to generate frame description: {e}")
            return f"Frame at {image_path} - description generation failed"

    async def get_query_embedding(self, query_text: str) -> List[float]:
        """Get embedding for search query"""
        try:
            return await self.get_voyage_embedding(query_text, "query")
        except Exception as e:
            logger.error(f"Failed to get query embedding: {e}")
            return [0.0] * self.EMBEDDING_DIM_SIZE


# Global instance
ai_service = AIService()
