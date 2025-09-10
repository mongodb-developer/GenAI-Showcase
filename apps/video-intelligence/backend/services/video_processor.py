import asyncio
import logging
import os
import shutil
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import cv2
from PIL import Image

logger = logging.getLogger(__name__)


class VideoProcessor:
    def __init__(self):
        self.upload_dir = Path(os.getenv("UPLOAD_DIR", "uploads"))
        self.frames_dir = Path(os.getenv("FRAMES_DIR", "frames"))
        self.frontend_videos_dir = Path(
            os.getenv("FRONTEND_VIDEOS_DIR", "../frontend/public/videos")
        )
        self.frame_interval = float(os.getenv("FRAME_EXTRACTION_INTERVAL", "2.0"))

        # Ensure directories exist
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.frames_dir.mkdir(parents=True, exist_ok=True)
        self.frontend_videos_dir.mkdir(parents=True, exist_ok=True)

    async def process_video(
        self,
        video_path: str,
        video_id: str,
        progress_callback: Optional[Callable] = None,
        mongodb_service=None,
        ai_service=None,
    ) -> Dict[str, Any]:
        """
        Process video: extract frames, generate descriptions and embeddings
        """
        try:
            video_path = Path(video_path)
            if not video_path.exists():
                raise FileNotFoundError(f"Video file not found: {video_path}")

            # Get video metadata
            cap = cv2.VideoCapture(str(video_path))
            if not cap.isOpened():
                raise ValueError("Unable to open video file")

            fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = total_frames / fps if fps > 0 else 0
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

            video_metadata = {
                "video_id": video_id,
                "original_filename": video_path.name,
                "duration": duration,
                "fps": fps,
                "total_frames": total_frames,
                "width": width,
                "height": height,
                "status": "processing",
            }

            if progress_callback:
                await progress_callback(
                    {
                        "status": "processing",
                        "progress": 5,
                        "message": f"Video loaded: {duration:.1f}s, {fps:.1f} FPS",
                        "total_frames": total_frames,
                    }
                )

            # Copy video to frontend directory for playback
            frontend_video_path = (
                self.frontend_videos_dir / f"{video_id}{video_path.suffix}"
            )
            shutil.copy2(str(video_path), str(frontend_video_path))
            logger.info(f"Copied video to frontend: {frontend_video_path}")

            # Update video metadata with frontend path
            video_metadata["frontend_path"] = f"/videos/{video_id}{video_path.suffix}"

            if progress_callback:
                await progress_callback(
                    {
                        "status": "processing",
                        "progress": 10,
                        "message": "Video copied for playback, extracting frames...",
                        "total_frames": total_frames,
                    }
                )

            # Extract frames with progressive ingestion
            frames_data = await self._extract_frames_with_progress(
                cap, video_id, fps, progress_callback, mongodb_service, ai_service
            )

            cap.release()

            if progress_callback:
                await progress_callback(
                    {
                        "status": "completed",
                        "progress": 100,
                        "message": f"Processing complete! Extracted {len(frames_data)} frames",
                        "frames_processed": len(frames_data),
                    }
                )

            # Log the video metadata being returned
            logger.info(f"Video processor returning metadata: {video_metadata}")
            logger.info(f"Video processor returning {len(frames_data)} frames")

            return {"video_metadata": video_metadata, "frames_data": frames_data}

        except Exception as e:
            logger.error(f"Video processing failed: {e}")
            if progress_callback:
                await progress_callback(
                    {
                        "status": "failed",
                        "progress": 0,
                        "message": f"Processing failed: {e!s}",
                    }
                )
            raise

    async def _extract_frames_with_progress(
        self,
        cap: cv2.VideoCapture,
        video_id: str,
        fps: float,
        progress_callback: Optional[Callable] = None,
        mongodb_service=None,
        ai_service=None,
    ) -> List[Dict[str, Any]]:
        """Extract frames from video with progress updates and progressive ingestion"""
        frames_data = []
        pending_frames = []  # Batch for progressive insertion
        frame_interval_frames = int(fps * self.frame_interval)
        current_frame = 0
        extracted_frames = 0
        BATCH_SIZE = 5  # Insert every 5 frames to preserve progress

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        # Calculate maximum frames we can extract based on frame interval
        max_possible_frames = total_frames // int(fps * self.frame_interval)

        # Tip: When testing, set MAX_FRAMES_FOR_TESTING to limit extraction
        # Set to None or a large number to extract all available frames
        MAX_FRAMES_FOR_TESTING = max_possible_frames  # Extract all available frames

        video_frames_dir = self.frames_dir / video_id
        video_frames_dir.mkdir(exist_ok=True)

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # Stop after extracting MAX_FRAMES_FOR_TESTING frames (if limit is set)
            if (
                MAX_FRAMES_FOR_TESTING is not None
                and extracted_frames >= MAX_FRAMES_FOR_TESTING
            ):
                break

            if current_frame % frame_interval_frames == 0:
                timestamp = current_frame / fps
                frame_filename = f"frame_{extracted_frames:06d}.jpg"
                frame_path = video_frames_dir / frame_filename

                # Save frame as image
                cv2.imwrite(str(frame_path), frame)

                # Convert to PIL Image for processing
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(frame_rgb)

                # Generate thumbnail (smaller version for UI)
                thumbnail = pil_image.copy()
                thumbnail.thumbnail((320, 240), Image.Resampling.LANCZOS)
                thumbnail_path = video_frames_dir / f"thumb_{extracted_frames:06d}.jpg"
                thumbnail.save(thumbnail_path, "JPEG", quality=85)

                frame_data = {
                    "frame_number": extracted_frames,
                    "timestamp": timestamp,
                    "file_path": str(frame_path),
                    "thumbnail_path": str(thumbnail_path),
                    "metadata": {
                        "width": frame.shape[1],
                        "height": frame.shape[0],
                        "original_frame_number": current_frame,
                    },
                }

                frames_data.append(frame_data)
                pending_frames.append(frame_data.copy())  # Add to pending batch
                extracted_frames += 1

                # Progressive insertion: save frames in batches to preserve progress
                if mongodb_service and ai_service and len(pending_frames) >= BATCH_SIZE:
                    await self._process_and_save_frame_batch(
                        pending_frames, video_id, mongodb_service, ai_service
                    )
                    pending_frames.clear()

                # Progress update after each frame extraction
                if progress_callback:
                    progress = min(95, 10 + (current_frame / total_frames) * 80)
                    await progress_callback(
                        {
                            "status": "processing",
                            "progress": int(progress),
                            "message": f"Extracting frames... {extracted_frames} frames extracted"
                            + (
                                f" (max {MAX_FRAMES_FOR_TESTING})"
                                if MAX_FRAMES_FOR_TESTING
                                else ""
                            ),
                            "frames_processed": extracted_frames,
                        }
                    )

            current_frame += 1

            # Additional progress updates every 100 frames processed (even if not extracted)
            if progress_callback and current_frame % 100 == 0:
                progress = min(95, 10 + (current_frame / total_frames) * 80)
                await progress_callback(
                    {
                        "status": "processing",
                        "progress": int(progress),
                        "message": f"Processing video... {extracted_frames} frames extracted so far",
                        "frames_processed": extracted_frames,
                    }
                )

        # Process any remaining frames in the pending batch
        if mongodb_service and ai_service and pending_frames:
            await self._process_and_save_frame_batch(
                pending_frames, video_id, mongodb_service, ai_service
            )

        return frames_data

    async def _process_single_frame(self, frame, ai_service):
        """Process a single frame to generate description and embedding"""
        try:
            frame_path = frame["file_path"]

            # Generate description and embedding concurrently
            description_task = ai_service.generate_frame_description(frame_path)
            embedding_task = ai_service.get_voyage_embedding(frame_path)

            # Wait for both to complete
            description, embedding = await asyncio.gather(
                description_task, embedding_task
            )

            return {
                **frame,
                "description": description,
                "embedding": embedding,
            }
        except Exception as e:
            logger.error(
                f"Failed to process single frame {frame.get('frame_number', '?')}: {e}"
            )
            # Return frame with fallback data
            return {
                **frame,
                "description": "Frame processing failed",
                "embedding": [0.0] * 1024,  # Fallback embedding
            }

    async def _process_and_save_frame_batch(
        self, frames_batch, video_id, mongodb_service, ai_service
    ):
        """Process a batch of frames concurrently with AI descriptions and embeddings, then save to database"""
        try:
            # Process all frames in the batch concurrently
            frame_tasks = [
                self._process_single_frame(frame, ai_service) for frame in frames_batch
            ]

            # Wait for all frames to be processed
            batch_with_ai = await asyncio.gather(*frame_tasks)

            # Insert batch to database
            await mongodb_service.insert_frame_batch(video_id, batch_with_ai)

            logger.info(
                f"Saved batch of {len(batch_with_ai)} frames for video {video_id}."
            )

            # Small delay between batches to respect rate limits
            await asyncio.sleep(1.0)

        except Exception as e:
            logger.error(f"Failed to save frame batch: {e}")
            # Continue processing - some frames missing is better than crashing entire video

    async def cleanup_video_files(self, video_id: str):
        """Clean up video files and extracted frames"""
        try:
            # Remove frames directory
            video_frames_dir = self.frames_dir / video_id
            if video_frames_dir.exists():
                shutil.rmtree(video_frames_dir)
                logger.info(f"Cleaned up frames for video {video_id}")

            # Remove uploaded video file
            for video_file in self.upload_dir.glob(f"{video_id}.*"):
                video_file.unlink()
                logger.info(f"Cleaned up video file: {video_file}")

            # Remove frontend video file
            for frontend_video_file in self.frontend_videos_dir.glob(f"{video_id}.*"):
                frontend_video_file.unlink()
                logger.info(f"Cleaned up frontend video file: {frontend_video_file}")

        except Exception as e:
            logger.error(f"Failed to cleanup video files: {e}")


# Global instance
video_processor = VideoProcessor()
