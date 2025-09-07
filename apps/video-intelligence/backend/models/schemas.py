from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel


class ProcessingStatus(BaseModel):
    status: str  # "processing", "completed", "failed"
    progress: int  # 0-100
    message: str
    frames_processed: int = 0
    total_frames: int = 0


class FrameData(BaseModel):
    frame_number: int
    timestamp: float
    file_path: str
    description: str
    embedding: List[float]
    metadata: Dict[str, Any]


class VideoMetadata(BaseModel):
    video_id: str
    original_filename: str
    duration: float
    fps: float
    total_frames: int
    width: int
    height: int
    processed_at: Optional[datetime] = None
    status: str
    frontend_path: Optional[str] = None


class SearchQuery(BaseModel):
    query: str
    top_k: int = 5
    video_id: Optional[str] = None
    search_type: Optional[Literal["hybrid", "semantic", "text"]] = "hybrid"


class SearchResult(BaseModel):
    frame_number: int
    timestamp: float
    description: str
    similarity_score: float
    thumbnail_path: str
    metadata: Dict[str, Any]


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total_results: int
    processing_time: float


class UploadResponse(BaseModel):
    video_id: str
    message: str
    metadata: VideoMetadata
