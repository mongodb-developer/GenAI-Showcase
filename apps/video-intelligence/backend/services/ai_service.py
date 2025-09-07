import asyncio
import base64
import logging
import os
from io import BytesIO
from typing import Any, Dict, List, Optional

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

    async def process_frame_batch(
        self,
        frames_data: List[Dict[str, Any]],
        batch_size: int = 5,
        progress_callback: Optional[callable] = None,
    ) -> List[Dict[str, Any]]:
        """
        Process a batch of frames to generate descriptions and embeddings

        Args:
            frames_data: List of frame data dictionaries
            batch_size: Number of frames to process concurrently
            progress_callback: Optional callback for progress updates

        Returns:
            Updated frames_data with descriptions and embeddings
        """
        try:
            total_frames = len(frames_data)
            processed_frames = 0

            # Process frames in batches
            for i in range(0, total_frames, batch_size):
                batch = frames_data[i : i + batch_size]

                # Create tasks for concurrent processing
                tasks = []
                for frame_data in batch:
                    task = self._process_single_frame(frame_data)
                    tasks.append(task)

                # Wait for batch completion
                batch_results = await asyncio.gather(*tasks, return_exceptions=True)

                # Update processed frames count
                processed_frames += len(batch)

                # Update progress
                if progress_callback:
                    progress = (
                        95 + (processed_frames / total_frames) * 5
                    )  # Last 5% for AI processing
                    await progress_callback(
                        {
                            "status": "processing",
                            "progress": int(progress),
                            "message": f"Generating descriptions and embeddings... {processed_frames}/{total_frames}",
                            "frames_processed": processed_frames,
                        }
                    )

                # Small delay to prevent rate limiting
                await asyncio.sleep(0.1)

            return frames_data

        except Exception as e:
            logger.error(f"Failed to process frame batch: {e}")
            raise

    async def _process_single_frame(self, frame_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single frame to add description and embedding"""
        try:
            image_path = frame_data["file_path"]

            # Generate description
            description = await self.generate_frame_description(image_path)
            frame_data["description"] = description

            # Generate embedding directly from the image using Voyage AI multimodal model
            embedding = await self.get_voyage_embedding(image_path, "document")
            frame_data["embedding"] = embedding

            # Add additional metadata
            frame_data["metadata"]["has_description"] = True
            frame_data["metadata"]["has_embedding"] = len(embedding) > 0
            frame_data["metadata"]["description_length"] = len(description)

            return frame_data

        except Exception as e:
            logger.error(f"Failed to process single frame: {e}")
            # Add fallback data
            frame_data["description"] = "Frame processing failed"
            frame_data["embedding"] = [0.0] * self.EMBEDDING_DIM_SIZE
            frame_data["metadata"]["has_description"] = False
            frame_data["metadata"]["has_embedding"] = False
            return frame_data

    async def get_query_embedding(self, query_text: str) -> List[float]:
        """Get embedding for search query"""
        try:
            return await self.get_voyage_embedding(query_text, "query")
        except Exception as e:
            logger.error(f"Failed to get query embedding: {e}")
            return [0.0] * self.EMBEDDING_DIM_SIZE


# Global instance
ai_service = AIService()
