"""
Channel Batch Processor
Orchestrates batch processing of YouTube channel videos with progress tracking,
error handling, and job management.
"""

import asyncio
import json
import os
import time
import uuid
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import List, Dict, Optional, Callable, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging

from youtube_channel_collector import YouTubeChannelCollector, ChannelNotFoundError, APIQuotaExceededError


class ProcessingStatus(Enum):
    """Enumeration of job processing statuses."""
    PENDING = "pending"
    PROCESSING = "processing" 
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class BatchProcessingError(Exception):
    """Raised when batch processing encounters an error."""
    pass


@dataclass
class BatchProcessingJob:
    """Represents a channel batch processing job with progress tracking."""
    
    job_id: str
    channel_id: str
    channel_title: str
    total_videos: int
    video_batches: List[List[Dict]]
    filters: Dict[str, Any]
    
    # Progress tracking
    status: ProcessingStatus = ProcessingStatus.PENDING
    videos_completed: int = 0
    videos_failed: int = 0
    restaurants_found: int = 0
    
    # Timing
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Error tracking
    failed_videos: List[Dict] = field(default_factory=list)
    error_message: Optional[str] = None
    
    def __post_init__(self):
        """Initialize computed fields after dataclass creation."""
        if self.created_at is None:
            self.created_at = datetime.now()
    
    @property
    def progress_percentage(self) -> float:
        """Calculate progress percentage."""
        if self.total_videos == 0:
            return 100.0
        
        processed = self.videos_completed + self.videos_failed
        return (processed / self.total_videos) * 100.0
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate of processed videos."""
        processed = self.videos_completed + self.videos_failed
        if processed == 0:
            return 0.0
        
        return (self.videos_completed / processed) * 100.0
    
    @property
    def processing_duration_minutes(self) -> Optional[float]:
        """Calculate processing duration in minutes."""
        if not self.started_at:
            return None
        
        end_time = self.completed_at or datetime.now()
        duration = end_time - self.started_at
        return duration.total_seconds() / 60.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert job to dictionary for serialization."""
        result = asdict(self)
        
        # Convert datetime objects to ISO strings
        for field_name in ['created_at', 'started_at', 'completed_at']:
            if result[field_name]:
                result[field_name] = result[field_name].isoformat()
        
        # Convert enum to string
        result['status'] = self.status.value
        
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'BatchProcessingJob':
        """Create job from dictionary."""
        # Convert datetime strings back to datetime objects
        for field_name in ['created_at', 'started_at', 'completed_at']:
            if data.get(field_name):
                data[field_name] = datetime.fromisoformat(data[field_name])
        
        # Convert status string to enum
        if 'status' in data:
            data['status'] = ProcessingStatus(data['status'])
        
        return cls(**data)


class ChannelBatchProcessor:
    """
    Orchestrates batch processing of YouTube channel videos.
    
    Provides job management, progress tracking, error handling, and
    concurrent processing capabilities for channel analysis.
    """
    
    def __init__(
        self,
        batch_size: int = 5,
        max_concurrent_jobs: int = 3,
        output_dir: Optional[str] = None
    ):
        """
        Initialize the batch processor.
        
        Args:
            batch_size: Number of videos to process in each batch
            max_concurrent_jobs: Maximum number of concurrent processing jobs
            output_dir: Directory to save job results (defaults to 'batch_jobs')
        """
        self.batch_size = batch_size
        self.max_concurrent_jobs = max_concurrent_jobs
        self.output_dir = output_dir or 'batch_jobs'
        
        # Job tracking
        self.active_jobs: Dict[str, BatchProcessingJob] = {}
        self.completed_jobs: List[BatchProcessingJob] = []
        
        # Progress callback
        self.progress_callback: Optional[Callable] = None
        
        # Logging
        self.logger = logging.getLogger(__name__)
        
        # Ensure output directory exists
        os.makedirs(self.output_dir, exist_ok=True)
    
    def start_channel_processing(
        self,
        channel_url: str,
        api_key: str,
        filters: Optional[Dict[str, Any]] = None
    ) -> BatchProcessingJob:
        """
        Start processing a YouTube channel.
        
        Args:
            channel_url: YouTube channel URL to process
            api_key: YouTube Data API key
            filters: Optional filters for video selection
        
        Returns:
            BatchProcessingJob instance
        
        Raises:
            BatchProcessingError: If processing cannot be started
        """
        filters = filters or {}
        
        # Check concurrent job limit
        if len(self.active_jobs) >= self.max_concurrent_jobs:
            raise BatchProcessingError(
                f"Maximum concurrent jobs ({self.max_concurrent_jobs}) reached. "
                f"Wait for existing jobs to complete or cancel them."
            )
        
        try:
            # Initialize channel collector
            collector = YouTubeChannelCollector(api_key=api_key)
            channel_id = collector.extract_channel_id(channel_url)
            
            if not channel_id:
                raise BatchProcessingError(f"Invalid channel URL: {channel_url}")
            
            # Check for duplicate processing
            if any(job.channel_id == channel_id for job in self.active_jobs.values()):
                raise BatchProcessingError(
                    f"Channel {channel_id} is already being processed"
                )
            
            # Get channel information
            channel_info = collector.get_channel_info(channel_id)
            
            # Get channel videos with filters
            videos = collector.get_channel_videos(channel_id, **filters)
            
            # Create video batches
            video_batches = self._create_video_batches(videos, self.batch_size)
            
            # Create job
            job = BatchProcessingJob(
                job_id=str(uuid.uuid4()),
                channel_id=channel_id,
                channel_title=channel_info['title'],
                total_videos=len(videos),
                video_batches=video_batches,
                filters=filters
            )
            
            # Add to active jobs
            self.active_jobs[job.job_id] = job
            
            self.logger.info(
                f"Started processing job {job.job_id} for channel '{job.channel_title}' "
                f"({job.total_videos} videos in {len(video_batches)} batches)"
            )
            
            return job
            
        except (ChannelNotFoundError, APIQuotaExceededError) as e:
            raise BatchProcessingError(f"Channel processing failed: {str(e)}")
        except Exception as e:
            self.logger.error(f"Unexpected error starting channel processing: {str(e)}")
            raise BatchProcessingError(f"Failed to start processing: {str(e)}")
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get current status of a processing job.
        
        Args:
            job_id: Job identifier
        
        Returns:
            Job status dictionary or None if job not found
        """
        job = self.active_jobs.get(job_id)
        if not job:
            # Check completed jobs
            for completed_job in self.completed_jobs:
                if completed_job.job_id == job_id:
                    job = completed_job
                    break
        
        if not job:
            return None
        
        return {
            'job_id': job.job_id,
            'status': job.status,
            'channel_info': {
                'channel_id': job.channel_id,
                'channel_title': job.channel_title
            },
            'progress': {
                'videos_completed': job.videos_completed,
                'videos_failed': job.videos_failed,
                'videos_total': job.total_videos,
                'percentage': job.progress_percentage,
                'restaurants_found': job.restaurants_found
            },
            'timing': {
                'created_at': job.created_at.isoformat() if job.created_at else None,
                'started_at': job.started_at.isoformat() if job.started_at else None,
                'completed_at': job.completed_at.isoformat() if job.completed_at else None,
                'duration_minutes': job.processing_duration_minutes
            },
            'estimated_completion': self._estimate_completion_time(job) if job.status == ProcessingStatus.PROCESSING else None
        }
    
    def cancel_job(self, job_id: str) -> bool:
        """
        Cancel an active processing job.
        
        Args:
            job_id: Job identifier
        
        Returns:
            True if job was cancelled, False if job not found
        """
        job = self.active_jobs.get(job_id)
        if not job:
            return False
        
        job.status = ProcessingStatus.CANCELLED
        job.completed_at = datetime.now()
        
        # Move to completed jobs
        self.completed_jobs.append(job)
        del self.active_jobs[job_id]
        
        self.logger.info(f"Cancelled job {job_id}")
        return True
    
    async def _process_video_batch(
        self,
        job: BatchProcessingJob,
        video_batch: List[Dict],
        batch_index: int
    ) -> List[Dict[str, Any]]:
        """
        Process a batch of videos.
        
        Args:
            job: Processing job
            video_batch: List of videos to process
            batch_index: Index of the current batch
        
        Returns:
            List of processing results
        """
        results = []
        
        # Import here to avoid circular imports
        from scripts.main import RestaurantPodcastAnalyzer
        
        try:
            analyzer = RestaurantPodcastAnalyzer()
            
            for video in video_batch:
                try:
                    # Create video URL if not present
                    video_url = video.get('video_url', f"https://www.youtube.com/watch?v={video['video_id']}")
                    
                    # Process the video
                    result = analyzer.process_single_podcast(video_url)
                    results.append(result)
                    
                    # Update job progress
                    if result.get('success'):
                        job.videos_completed += 1
                        # Count restaurants found (simplified)
                        job.restaurants_found += len(result.get('files_generated', []))
                    else:
                        job.videos_failed += 1
                        job.failed_videos.append({
                            'video_id': video['video_id'],
                            'title': video.get('title', ''),
                            'error': result.get('error', 'Unknown error')
                        })
                    
                    # Trigger progress callback
                    self._update_job_progress(job)
                    
                except Exception as e:
                    self.logger.error(f"Error processing video {video['video_id']}: {str(e)}")
                    job.videos_failed += 1
                    job.failed_videos.append({
                        'video_id': video['video_id'],
                        'title': video.get('title', ''),
                        'error': str(e)
                    })
                    results.append({
                        'success': False,
                        'video_id': video['video_id'],
                        'error': str(e)
                    })
        
        except Exception as e:
            self.logger.error(f"Error processing batch {batch_index}: {str(e)}")
            # Mark all videos in batch as failed
            for video in video_batch:
                job.videos_failed += 1
                job.failed_videos.append({
                    'video_id': video['video_id'],
                    'title': video.get('title', ''),
                    'error': f"Batch processing error: {str(e)}"
                })
        
        return results
    
    def _create_video_batches(self, videos: List[Dict], batch_size: int) -> List[List[Dict]]:
        """
        Split videos into processing batches.
        
        Args:
            videos: List of video dictionaries
            batch_size: Size of each batch
        
        Returns:
            List of video batches
        """
        if not videos:
            return []
        
        batches = []
        for i in range(0, len(videos), batch_size):
            batch = videos[i:i + batch_size]
            batches.append(batch)
        
        return batches
    
    def _update_job_progress(self, job: BatchProcessingJob, **updates):
        """
        Update job progress and trigger callbacks.
        
        Args:
            job: Job to update
            **updates: Additional fields to update
        """
        # Update job fields
        for key, value in updates.items():
            if hasattr(job, key):
                setattr(job, key, value)
        
        # Trigger progress callback
        if self.progress_callback:
            progress_info = {
                'videos_completed': job.videos_completed,
                'videos_failed': job.videos_failed,
                'videos_total': job.total_videos,
                'percentage': job.progress_percentage,
                'restaurants_found': job.restaurants_found,
                'status': job.status.value
            }
            self.progress_callback(job.job_id, progress_info)
    
    def _estimate_completion_time(self, job: BatchProcessingJob) -> Optional[str]:
        """
        Estimate completion time for a processing job.
        
        Args:
            job: Job to estimate completion for
        
        Returns:
            Estimated completion time as ISO string or None
        """
        if not job.started_at or job.videos_completed == 0:
            return None
        
        # Calculate average processing time per video
        elapsed = datetime.now() - job.started_at
        avg_time_per_video = elapsed.total_seconds() / job.videos_completed
        
        # Estimate remaining time
        remaining_videos = job.total_videos - job.videos_completed - job.videos_failed
        estimated_remaining_seconds = remaining_videos * avg_time_per_video
        
        estimated_completion = datetime.now() + timedelta(seconds=estimated_remaining_seconds)
        return estimated_completion.isoformat()
    
    def generate_job_summary(self, job: BatchProcessingJob) -> Dict[str, Any]:
        """
        Generate comprehensive job summary.
        
        Args:
            job: Job to summarize
        
        Returns:
            Detailed job summary dictionary
        """
        return {
            'job_id': job.job_id,
            'channel_info': {
                'channel_id': job.channel_id,
                'channel_title': job.channel_title
            },
            'summary': {
                'videos_processed': job.videos_completed,
                'videos_failed': job.videos_failed,
                'videos_total': job.total_videos,
                'restaurants_found': job.restaurants_found,
                'success_rate': job.success_rate
            },
            'timing': {
                'created_at': job.created_at.isoformat() if job.created_at else None,
                'started_at': job.started_at.isoformat() if job.started_at else None,
                'completed_at': job.completed_at.isoformat() if job.completed_at else None
            },
            'processing_duration_minutes': job.processing_duration_minutes,
            'filters_applied': job.filters,
            'failed_videos': job.failed_videos,
            'status': job.status.value,
            'error_message': job.error_message
        }
    
    def save_job_results(self, job: BatchProcessingJob) -> str:
        """
        Save job results to file.
        
        Args:
            job: Job to save
        
        Returns:
            Path to saved file
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"job_{job.job_id}_{timestamp}.json"
        filepath = os.path.join(self.output_dir, filename)
        
        summary = self.generate_job_summary(job)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        
        self.logger.info(f"Saved job results to {filepath}")
        return filepath
    
    def get_active_jobs(self) -> List[Dict[str, Any]]:
        """
        Get list of all active jobs.
        
        Returns:
            List of active job status dictionaries
        """
        return [self.get_job_status(job_id) for job_id in self.active_jobs.keys()]
    
    def get_completed_jobs(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Get list of completed jobs.
        
        Args:
            limit: Maximum number of jobs to return
        
        Returns:
            List of completed job summaries
        """
        recent_jobs = sorted(
            self.completed_jobs, 
            key=lambda j: j.completed_at or datetime.min, 
            reverse=True
        )[:limit]
        
        return [self.generate_job_summary(job) for job in recent_jobs]
    
    def cleanup_old_jobs(self, max_age_days: int = 7):
        """
        Clean up old completed jobs.
        
        Args:
            max_age_days: Maximum age of jobs to keep in days
        """
        cutoff_date = datetime.now() - timedelta(days=max_age_days)
        
        self.completed_jobs = [
            job for job in self.completed_jobs
            if not job.completed_at or job.completed_at > cutoff_date
        ]
        
        self.logger.info(f"Cleaned up jobs older than {max_age_days} days")
    
    def estimate_processing_time(self, video_count: int) -> float:
        """
        Estimate processing time based on historical data.
        
        Args:
            video_count: Number of videos to process
        
        Returns:
            Estimated processing time in minutes
        """
        # Calculate average from completed jobs
        if self.completed_jobs:
            valid_jobs = [
                job for job in self.completed_jobs 
                if job.processing_duration_minutes and job.videos_completed > 0
            ]
            
            if valid_jobs:
                avg_minutes_per_video = sum(
                    job.processing_duration_minutes / job.videos_completed 
                    for job in valid_jobs
                ) / len(valid_jobs)
                
                return video_count * avg_minutes_per_video
        
        # Default estimate: 2 minutes per video
        return video_count * 2.0
    
    def save_job_state(self, job: BatchProcessingJob):
        """
        Save job state for persistence.
        
        Args:
            job: Job to save
        """
        state_file = os.path.join(self.output_dir, f"job_state_{job.job_id}.json")
        
        with open(state_file, 'w', encoding='utf-8') as f:
            json.dump(job.to_dict(), f, ensure_ascii=False, indent=2)
    
    def load_job_state(self, job_id: str) -> Optional[BatchProcessingJob]:
        """
        Load job state from persistence.
        
        Args:
            job_id: Job identifier
        
        Returns:
            Loaded job or None if not found
        """
        state_file = os.path.join(self.output_dir, f"job_state_{job_id}.json")
        
        if not os.path.exists(state_file):
            return None
        
        try:
            with open(state_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            return BatchProcessingJob.from_dict(data)
        
        except Exception as e:
            self.logger.error(f"Error loading job state for {job_id}: {str(e)}")
            return None
    
    def set_progress_callback(self, callback: Callable[[str, Dict], None]):
        """
        Set progress callback function.
        
        Args:
            callback: Function to call with (job_id, progress_info)
        """
        self.progress_callback = callback