import asyncio
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv
from fastapi import (
    FastAPI,
    File,
    HTTPException,
    Request,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from models.schemas import (
    ProcessingStatus,
    SearchQuery,
    SearchResponse,
    SearchResult,
    UploadResponse,
    VideoMetadata,
)
from services.ai_service import ai_service
from services.mongodb_service import mongodb_service
from services.video_processor import video_processor

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan events"""
    # Startup
    try:
        await mongodb_service.connect()
        logger.info("Application startup completed")
    except Exception as e:
        logger.warning(f"MongoDB connection failed during startup: {e}")
        logger.info(
            "App will continue but database features won't work until MongoDB is available"
        )

    yield

    # Shutdown
    try:
        await mongodb_service.disconnect()
        logger.info("Application shutdown completed")
    except Exception as e:
        logger.warning(f"Shutdown warning: {e}")


# Initialize FastAPI app
app = FastAPI(
    title="Video Intelligence API",
    description="AI-powered video search system",
    version="1.0.0",
    lifespan=lifespan,
)


# Custom exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    try:
        body = await request.body()
        logger.error(
            f"Validation error for request {request.method} {request.url}: {exc.errors()}"
        )
        logger.error(f"Request body: {body}")
        return JSONResponse(
            status_code=422,
            content={"detail": exc.errors(), "body": body.decode() if body else None},
        )
    except Exception as e:
        logger.error(f"Error in validation exception handler: {e}")
        return JSONResponse(status_code=422, content={"detail": exc.errors()})


# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files (frames and thumbnails)
frames_dir = Path(os.getenv("FRAMES_DIR", "frames"))
if frames_dir.exists():
    app.mount("/frames", StaticFiles(directory=frames_dir), name="frames")

# Serve videos from frontend directory
frontend_videos_dir = Path(
    os.getenv("FRONTEND_VIDEOS_DIR", "../frontend/public/videos")
)
if frontend_videos_dir.exists():
    app.mount("/api/videos", StaticFiles(directory=frontend_videos_dir), name="videos")


# Global connection manager for WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, video_id: str):
        await websocket.accept()
        self.active_connections[video_id] = websocket

    def disconnect(self, video_id: str):
        if video_id in self.active_connections:
            del self.active_connections[video_id]

    async def send_progress(self, video_id: str, data: dict):
        if video_id in self.active_connections:
            try:
                await self.active_connections[video_id].send_json(data)
            except:
                self.disconnect(video_id)


manager = ConnectionManager()


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Video Intelligence API is running", "version": "1.0.0"}


@app.post("/debug-search")
async def debug_search(request: Request):
    """Debug endpoint to see what's being sent"""
    try:
        body = await request.body()
        headers = dict(request.headers)
        logger.info(f"Debug - Request body: {body}")
        logger.info(f"Debug - Request headers: {headers}")
        return {
            "body": body.decode() if body else None,
            "headers": headers,
            "content_type": request.headers.get("content-type"),
        }
    except Exception as e:
        logger.error(f"Debug endpoint error: {e}")
        return {"error": str(e)}


@app.post("/upload", response_model=UploadResponse)
async def upload_video(file: UploadFile = File(...)):
    """Upload and process a video file"""
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file selected")

        # Check file size (note: file.size may not always be available during upload)
        max_size_mb = int(os.getenv("MAX_FILE_SIZE_MB", "500"))
        max_size_bytes = max_size_mb * 1024 * 1024

        # We'll check size after reading the content
        logger.info(
            f"Uploading file: {file.filename}, content-type: {file.content_type}"
        )

        # Generate video ID
        video_id = str(uuid.uuid4())

        # Save uploaded file
        upload_dir = Path(os.getenv("UPLOAD_DIR", "uploads"))
        upload_dir.mkdir(parents=True, exist_ok=True)

        file_extension = Path(file.filename).suffix.lower()
        video_path = upload_dir / f"{video_id}{file_extension}"

        # Read and validate file content
        content = await file.read()

        # Check file size after reading
        if len(content) > max_size_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"File too large ({len(content) / (1024*1024):.1f}MB). Maximum size: {max_size_mb}MB",
            )

        # Write file
        with open(video_path, "wb") as buffer:
            buffer.write(content)

        logger.info(
            f"Video uploaded: {video_id}, size: {len(content)} bytes ({len(content) / (1024*1024):.1f}MB)"
        )

        # Return immediately, processing will happen via WebSocket
        return UploadResponse(
            video_id=video_id,
            message="Video uploaded successfully. Processing will begin shortly.",
            metadata=VideoMetadata(
                video_id=video_id,
                original_filename=file.filename,
                duration=0,
                fps=0,
                total_frames=0,
                width=0,
                height=0,
                processed_at=None,
                status="uploaded",
            ),
        )

    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/{video_id}")
async def websocket_endpoint(websocket: WebSocket, video_id: str):
    """WebSocket endpoint for real-time processing updates"""
    await manager.connect(websocket, video_id)

    try:
        # Start processing the video
        await process_video_async(video_id)

        # Keep connection alive for any additional messages
        while True:
            try:
                await websocket.receive_text()
            except WebSocketDisconnect:
                break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await manager.send_progress(
            video_id,
            {
                "status": "failed",
                "progress": 0,
                "message": f"Processing failed: {e!s}",
            },
        )
    finally:
        manager.disconnect(video_id)


async def process_video_async(video_id: str):
    """Process video asynchronously with progress updates"""
    try:
        # Find the video file
        upload_dir = Path(os.getenv("UPLOAD_DIR", "uploads"))
        video_files = list(upload_dir.glob(f"{video_id}.*"))

        if not video_files:
            raise FileNotFoundError(f"Video file not found for ID: {video_id}")

        video_path = video_files[0]

        # Progress callback
        async def progress_callback(data):
            await manager.send_progress(video_id, data)

        # Process video (extract frames)
        await manager.send_progress(
            video_id,
            {
                "status": "processing",
                "progress": 0,
                "message": "Starting video processing...",
            },
        )

        result = await video_processor.process_video(
            str(video_path), video_id, progress_callback, mongodb_service, ai_service
        )

        # Check how many frames were already processed progressively
        already_saved_count = await mongodb_service.get_video_frame_count(video_id)
        total_frames = len(result["frames_data"])

        if already_saved_count < total_frames:
            # Some frames still need AI processing (fallback for any that weren't processed progressively)
            await manager.send_progress(
                video_id,
                {
                    "status": "processing",
                    "progress": 90,
                    "message": f"Processing remaining {total_frames - already_saved_count} frames...",
                },
            )

            # Only process frames that weren't saved progressively
            remaining_frames = (
                result["frames_data"][already_saved_count:]
                if already_saved_count > 0
                else result["frames_data"]
            )

            if remaining_frames:
                frames_with_ai = await ai_service.process_frame_batch(
                    remaining_frames, batch_size=3, progress_callback=progress_callback
                )

                # Insert remaining frame data
                await mongodb_service.insert_frame_data(video_id, frames_with_ai)
        else:
            logger.info(
                f"All {already_saved_count} frames were already processed progressively"
            )

        # Save video metadata
        await manager.send_progress(
            video_id,
            {
                "status": "processing",
                "progress": 98,
                "message": "Finalizing video metadata...",
            },
        )

        # Insert video metadata
        logger.info(f"Attempting to insert video metadata for video {video_id}")
        logger.info(f"Video metadata: {result['video_metadata']}")

        # Insert metadata with completed status directly
        from datetime import datetime

        result["video_metadata"]["status"] = "completed"
        result["video_metadata"]["processed_at"] = datetime.utcnow()
        await mongodb_service.insert_video_metadata(result["video_metadata"])

        # No need to update status separately since it's included in metadata
        logger.info(f"Video metadata inserted successfully for video {video_id}")

        # Cleanup video file (keep frames)
        video_path.unlink()

        # Final success message
        await manager.send_progress(
            video_id,
            {
                "status": "completed",
                "progress": 100,
                "message": f"Processing complete! {len(frames_with_ai)} frames processed and ready for search.",
                "frames_processed": len(frames_with_ai),
            },
        )

    except Exception as e:
        logger.error(f"Async processing failed: {e}")
        await manager.send_progress(
            video_id,
            {
                "status": "failed",
                "progress": 0,
                "message": f"Processing failed: {e!s}",
            },
        )


@app.post("/search", response_model=SearchResponse)
async def search_frames(query: SearchQuery):
    """Search for frames using natural language queries"""
    try:
        logger.info(f"🔍 Received search request with query: {query}")
        logger.info(
            f"🔍 Search type: {query.search_type}, Query: '{query.query}', Top K: {query.top_k}, Video ID: {query.video_id}"
        )
        start_time = time.time()

        # Ensure search_type has a default value
        search_type = query.search_type or "hybrid"
        logger.info(
            f"🔍 Search request: '{query.query}' (type={search_type}, top_k={query.top_k})"
        )

        # Generate query embedding only if needed (not for pure text search)
        query_embedding = None
        if search_type != "text":
            query_embedding = await ai_service.get_query_embedding(query.query)
            logger.info(
                f"📊 Generated query embedding: {len(query_embedding)} dimensions"
            )

        # Perform search based on specified type
        video_filter = getattr(query, "video_id", None)
        if search_type == "semantic":
            search_results = await mongodb_service.semantic_search(
                query_embedding, query.top_k, video_filter=video_filter
            )
            logger.info(f"🧠 Semantic search returned {len(search_results)} results")
        elif search_type == "text":
            search_results = await mongodb_service.text_search(
                query.query, query.top_k, video_filter=video_filter
            )
            logger.info(f"📝 Text search returned {len(search_results)} results")
        else:  # hybrid
            search_results = await mongodb_service.hybrid_search(
                query.query, query_embedding, query.top_k, video_filter=video_filter
            )
            logger.info(f"🔀 Hybrid search returned {len(search_results)} results")

        # Convert to response format with normalized similarity scores
        results = []
        max_score = (
            max([r.get("similarity_score", 0.0) for r in search_results])
            if search_results
            else 1.0
        )
        logger.info(
            f"📊 Score normalization: max_score={max_score}, normalizing={max_score > 1.0}"
        )

        for result in search_results:
            # Generate thumbnail path for frontend
            thumbnail_path = result.get("file_path", "").replace("frame_", "thumb_")
            if not os.path.exists(thumbnail_path):
                thumbnail_path = result.get("file_path", "")

            # Normalize similarity score to 0-1 range
            raw_score = result.get("similarity_score", 0.0)
            if max_score > 1.0:
                # Scale down scores that are > 1.0 to 0-1 range
                normalized_score = min(raw_score / max_score, 1.0)
            else:
                # Keep scores that are already in 0-1 range
                normalized_score = min(raw_score, 1.0)

            search_result = SearchResult(
                frame_number=result.get("frame_number", 0),
                timestamp=result.get("timestamp", 0.0),
                description=result.get("description", "No description available"),
                similarity_score=round(
                    normalized_score, 3
                ),  # Round to 3 decimal places
                thumbnail_path=thumbnail_path.replace(str(frames_dir), "/frames"),
                metadata=result.get("metadata", {}),
            )
            results.append(search_result)

        processing_time = time.time() - start_time

        return SearchResponse(
            query=query.query,
            results=results,
            total_results=len(results),
            processing_time=processing_time,
        )

    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/videos")
async def get_uploaded_videos():
    """Get list of all uploaded videos"""
    try:
        videos = await mongodb_service.get_all_videos()
        return {"videos": videos}
    except Exception as e:
        logger.error(f"Failed to get uploaded videos: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/video/{video_id}/metadata")
async def get_video_metadata(video_id: str):
    """Get metadata for a specific video"""
    try:
        metadata = await mongodb_service.get_video_metadata(video_id)
        if not metadata:
            raise HTTPException(status_code=404, detail="Video not found")
        return metadata
    except Exception as e:
        logger.error(f"Failed to get video metadata: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/video/{video_id}")
async def delete_video(video_id: str):
    """Delete a video and all associated data"""
    try:
        # Cleanup database
        await mongodb_service.cleanup_video_data(video_id)

        # Cleanup files
        await video_processor.cleanup_video_files(video_id)

        return {"message": f"Video {video_id} deleted successfully"}

    except Exception as e:
        logger.error(f"Failed to delete video: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/frames/{video_id}/{frame_name}")
async def get_frame(video_id: str, frame_name: str):
    """Serve frame images"""
    try:
        frame_path = frames_dir / video_id / frame_name
        if not frame_path.exists():
            raise HTTPException(status_code=404, detail="Frame not found")

        return FileResponse(frame_path)

    except Exception as e:
        logger.error(f"Failed to serve frame: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
