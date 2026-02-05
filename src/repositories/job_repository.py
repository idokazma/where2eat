"""
Job repository for background job operations.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc

from models import Job
from .base import BaseRepository


class JobRepository(BaseRepository[Job]):
    """
    Repository for Job operations.
    """

    def __init__(self, db: Session):
        super().__init__(Job, db)

    def get_pending(self, limit: int = 10) -> List[Job]:
        """Get pending jobs."""
        return self.db.query(Job)\
            .filter(Job.status == 'pending')\
            .order_by(Job.created_at)\
            .limit(limit)\
            .all()

    def get_running(self) -> List[Job]:
        """Get currently running jobs."""
        return self.db.query(Job)\
            .filter(Job.status == 'running')\
            .order_by(Job.started_at)\
            .all()

    def get_completed(self, limit: int = 20) -> List[Job]:
        """Get completed jobs."""
        return self.db.query(Job)\
            .filter(Job.status == 'completed')\
            .order_by(desc(Job.completed_at))\
            .limit(limit)\
            .all()

    def get_failed(self, limit: int = 20) -> List[Job]:
        """Get failed jobs."""
        return self.db.query(Job)\
            .filter(Job.status == 'failed')\
            .order_by(desc(Job.created_at))\
            .limit(limit)\
            .all()

    def get_by_status(self, status: str, limit: int = 50) -> List[Job]:
        """Get jobs by status."""
        return self.db.query(Job)\
            .filter(Job.status == status)\
            .order_by(desc(Job.created_at))\
            .limit(limit)\
            .all()

    def start_job(self, job_id: str) -> Optional[Job]:
        """Mark a job as started."""
        job = self.get_by_id(job_id)
        if not job:
            return None

        job.status = 'running'
        job.started_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(job)
        return job

    def complete_job(self, job_id: str) -> Optional[Job]:
        """Mark a job as completed."""
        job = self.get_by_id(job_id)
        if not job:
            return None

        job.status = 'completed'
        job.completed_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(job)
        return job

    def fail_job(self, job_id: str, error_message: str) -> Optional[Job]:
        """Mark a job as failed with error message."""
        job = self.get_by_id(job_id)
        if not job:
            return None

        job.status = 'failed'
        job.error_message = error_message
        job.completed_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(job)
        return job

    def update_progress(
        self,
        job_id: str,
        videos_completed: Optional[int] = None,
        videos_total: Optional[int] = None,
        videos_failed: Optional[int] = None,
        restaurants_found: Optional[int] = None,
        current_video_id: Optional[str] = None,
        current_video_title: Optional[str] = None,
        current_step: Optional[str] = None,
    ) -> Optional[Job]:
        """Update job progress."""
        job = self.get_by_id(job_id)
        if not job:
            return None

        if videos_completed is not None:
            job.progress_videos_completed = videos_completed
        if videos_total is not None:
            job.progress_videos_total = videos_total
        if videos_failed is not None:
            job.progress_videos_failed = videos_failed
        if restaurants_found is not None:
            job.progress_restaurants_found = restaurants_found
        if current_video_id is not None:
            job.current_video_id = current_video_id
        if current_video_title is not None:
            job.current_video_title = current_video_title
        if current_step is not None:
            job.current_step = current_step

        self.db.commit()
        self.db.refresh(job)
        return job

    def create_video_job(self, video_url: str, **options) -> Job:
        """Create a new video analysis job."""
        return self.create(
            job_type='video',
            video_url=video_url,
            processing_options=options,
        )

    def create_channel_job(
        self,
        channel_url: str,
        filters: Optional[Dict] = None,
        **options
    ) -> Job:
        """Create a new channel analysis job."""
        return self.create(
            job_type='channel',
            channel_url=channel_url,
            filters=filters,
            processing_options=options,
        )

    def get_stats(self) -> Dict[str, Any]:
        """Get job statistics."""
        total = self.count()

        by_status = {}
        for status in ['pending', 'running', 'completed', 'failed']:
            count = self.db.query(Job).filter(Job.status == status).count()
            by_status[status] = count

        by_type = {}
        for job_type in ['video', 'channel']:
            count = self.db.query(Job).filter(Job.job_type == job_type).count()
            by_type[job_type] = count

        return {
            'total': total,
            'by_status': by_status,
            'by_type': by_type,
        }

    def cleanup_old_jobs(self, days: int = 30) -> int:
        """Delete completed/failed jobs older than specified days."""
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=days)

        deleted = self.db.query(Job)\
            .filter(
                Job.status.in_(['completed', 'failed']),
                Job.created_at < cutoff
            )\
            .delete(synchronize_session=False)

        self.db.commit()
        return deleted
