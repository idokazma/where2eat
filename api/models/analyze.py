"""Pydantic models for video analysis."""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel

# Default video URL for demo/testing
DEFAULT_VIDEO_URL = "https://youtu.be/wlCpj1zPzEA"


class AnalyzeVideoRequest(BaseModel):
    """Request to analyze a YouTube video."""
    url: Optional[str] = DEFAULT_VIDEO_URL


class AnalyzeChannelRequest(BaseModel):
    """Request to analyze a YouTube channel."""
    channel_url: str
    filters: Optional[Dict[str, Any]] = {}
    processing_options: Optional[Dict[str, Any]] = {}


class AnalyzeResponse(BaseModel):
    """Response for video analysis request."""
    message: str
    status: str
    url: Optional[str] = None
    job_id: Optional[str] = None


class ChannelAnalyzeResponse(BaseModel):
    """Response for channel analysis request."""
    job_id: str
    message: str
    status: str
    channel_url: str
    filters: Dict[str, Any]
    processing_options: Dict[str, Any]
    estimated_duration_minutes: int


class JobProgress(BaseModel):
    """Job progress information."""
    videos_completed: int
    videos_total: int
    videos_failed: int
    restaurants_found: int
    current_video: Optional[Dict[str, Any]] = None


class JobStatus(BaseModel):
    """Job status response."""
    job_id: str
    status: str
    progress: Optional[JobProgress] = None
    estimated_completion: Optional[str] = None
    started_at: Optional[str] = None


class JobResults(BaseModel):
    """Job results response."""
    job_id: str
    status: str
    summary: Dict[str, Any]
    statistics: Dict[str, Any]
    failed_videos: List[Dict[str, Any]]


class Job(BaseModel):
    """Active job information."""
    job_id: str
    status: str
    channel_info: Optional[Dict[str, Any]] = None
    progress: Optional[Dict[str, Any]] = None
    started_at: Optional[str] = None


class JobListResponse(BaseModel):
    """Response for job list."""
    jobs: List[Job]
    count: int
