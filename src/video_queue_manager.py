"""
VideoQueueManager - manages the video processing queue for Where2Eat.

Handles enqueue, dequeue, retry logic with exponential backoff,
and queue monitoring operations.
"""

import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict

from database import Database
from config import (
    PIPELINE_PROCESS_INTERVAL_MINUTES,
    PIPELINE_MAX_RETRY_ATTEMPTS,
    PIPELINE_MAX_VIDEO_AGE_DAYS,
    PIPELINE_STALE_TIMEOUT_HOURS,
)


class VideoQueueManager:
    """Manages the video processing queue.

    Coordinates the lifecycle of videos from discovery through processing:
    queued -> processing -> completed/failed/skipped.
    """

    def __init__(self, db: Database):
        self.db = db

    def enqueue(
        self,
        video_id: str,
        video_url: str,
        subscription_id: str = None,
        video_title: str = None,
        channel_name: str = None,
        published_at: str = None,
        priority: int = 5,
    ) -> dict:
        """Add a video to the processing queue.

        - Checks episodes table first; if video_id exists, marks as 'skipped'
        - Raises ValueError if video_id already in queue
        - Calculates scheduled_for based on last scheduled item + PROCESS_INTERVAL_MINUTES
        - Returns the created queue entry dict
        """
        queue_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        # Check if video_id already exists in the queue
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id FROM video_queue WHERE video_id = ?", (video_id,)
            )
            if cursor.fetchone():
                raise ValueError(
                    f"Video {video_id} is already in the queue"
                )

        # Check if video was already processed (exists in episodes table)
        episode = self.db.get_episode(video_id=video_id)
        if episode is not None:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO video_queue
                        (id, subscription_id, video_id, video_url, video_title,
                         channel_name, published_at, discovered_at, status,
                         priority, scheduled_for)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'skipped', ?, ?)
                    """,
                    (
                        queue_id,
                        subscription_id,
                        video_id,
                        video_url,
                        video_title,
                        channel_name,
                        published_at,
                        now,
                        priority,
                        now,
                    ),
                )
            return self.get_video(queue_id)

        # Inherit priority from subscription when no explicit priority was given
        if subscription_id and priority == 5:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT priority FROM subscriptions WHERE id = ?",
                    (subscription_id,),
                )
                row = cursor.fetchone()
                if row:
                    priority = row["priority"]

        scheduled_for = self._calculate_next_slot()

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO video_queue
                    (id, subscription_id, video_id, video_url, video_title,
                     channel_name, published_at, discovered_at, status,
                     priority, scheduled_for)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)
                """,
                (
                    queue_id,
                    subscription_id,
                    video_id,
                    video_url,
                    video_title,
                    channel_name,
                    published_at,
                    now,
                    priority,
                    scheduled_for,
                ),
            )

        return self.get_video(queue_id)

    def dequeue(self) -> Optional[dict]:
        """Get the next video to process.

        Returns the highest-priority queued video whose scheduled_for <= now.
        Updates status to 'processing' and sets processing_started_at.
        Returns None if nothing is ready.
        """
        now = datetime.utcnow().isoformat()

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM video_queue
                WHERE status = 'queued' AND scheduled_for <= ?
                ORDER BY priority ASC, scheduled_for ASC
                LIMIT 1
                """,
                (now,),
            )
            row = cursor.fetchone()
            if not row:
                return None

            queue_id = row["id"]

            cursor.execute(
                """
                UPDATE video_queue
                SET status = 'processing', processing_started_at = ?
                WHERE id = ?
                """,
                (now, queue_id),
            )

        return self.get_video(queue_id)

    def mark_completed(
        self,
        queue_id: str,
        restaurants_found: int = 0,
        episode_id: str = None,
    ) -> bool:
        """Mark a video as successfully processed."""
        now = datetime.utcnow().isoformat()

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE video_queue
                SET status = 'completed',
                    processing_completed_at = ?,
                    restaurants_found = ?,
                    episode_id = ?
                WHERE id = ?
                """,
                (now, restaurants_found, episode_id, queue_id),
            )
            return cursor.rowcount > 0

    # Error patterns that indicate permanent failures (no point retrying)
    PERMANENT_FAILURE_PATTERNS = [
        "Transcript not available",
        "Video unavailable",
        "Private video",
        "Sign in to confirm your age",
    ]

    def mark_failed(self, queue_id: str, error_message: str) -> bool:
        """Mark a video as failed.

        If the error_message matches a permanent failure pattern, the video
        is immediately marked as 'skipped' regardless of attempt count.
        Otherwise, if attempt_count < max_attempts: requeue with exponential backoff.
        Otherwise: permanently mark as 'failed'.
        Appends to error_log JSON array.
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM video_queue WHERE id = ?", (queue_id,)
            )
            row = cursor.fetchone()
            if not row:
                return False

            entry = dict(row)
            current_attempt_count = entry["attempt_count"]
            max_attempts = entry["max_attempts"]

            # Parse existing error_log or start fresh
            error_log_raw = entry.get("error_log")
            if error_log_raw:
                try:
                    error_log = json.loads(error_log_raw)
                except (json.JSONDecodeError, TypeError):
                    error_log = []
            else:
                error_log = []

            # Append this failure to the error log
            error_log.append(
                {
                    "message": error_message,
                    "timestamp": datetime.utcnow().isoformat(),
                    "attempt": current_attempt_count + 1,
                }
            )

            new_attempt_count = current_attempt_count + 1

            # Check for permanent failure patterns - skip immediately
            is_permanent = any(
                pattern in error_message
                for pattern in self.PERMANENT_FAILURE_PATTERNS
            )
            if is_permanent:
                cursor.execute(
                    """
                    UPDATE video_queue
                    SET status = 'skipped',
                        attempt_count = ?,
                        error_message = ?,
                        error_log = ?,
                        processing_completed_at = ?
                    WHERE id = ?
                    """,
                    (
                        new_attempt_count,
                        error_message,
                        json.dumps(error_log),
                        datetime.utcnow().isoformat(),
                        queue_id,
                    ),
                )
                return True

            if new_attempt_count < max_attempts:
                # Requeue with exponential backoff
                # Backoff: PROCESS_INTERVAL * 2^(current_attempt_count)
                # Yields: 1h, 2h, 4h, 8h, ...
                backoff_minutes = PIPELINE_PROCESS_INTERVAL_MINUTES * (
                    2 ** current_attempt_count
                )
                scheduled_for = (
                    datetime.utcnow() + timedelta(minutes=backoff_minutes)
                ).isoformat()

                cursor.execute(
                    """
                    UPDATE video_queue
                    SET status = 'queued',
                        attempt_count = ?,
                        scheduled_for = ?,
                        error_message = ?,
                        error_log = ?
                    WHERE id = ?
                    """,
                    (
                        new_attempt_count,
                        scheduled_for,
                        error_message,
                        json.dumps(error_log),
                        queue_id,
                    ),
                )
            else:
                # Permanently failed -- max retries exhausted
                cursor.execute(
                    """
                    UPDATE video_queue
                    SET status = 'failed',
                        attempt_count = ?,
                        error_message = ?,
                        error_log = ?,
                        processing_completed_at = ?
                    WHERE id = ?
                    """,
                    (
                        new_attempt_count,
                        error_message,
                        json.dumps(error_log),
                        datetime.utcnow().isoformat(),
                        queue_id,
                    ),
                )

            return True

    def enqueue_as_skipped(
        self,
        video_id: str,
        video_url: str,
        subscription_id: str = None,
        video_title: str = None,
        channel_name: str = None,
        published_at: str = None,
        reason: str = None,
    ) -> Optional[dict]:
        """Add a video directly as 'skipped' for admin visibility.

        Used for videos that are too old to analyze but should still
        appear in the admin queue view so admins can see they were skipped.

        Returns the created queue entry, or None if the video already exists.
        """
        # Check if video_id already exists in the queue
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id FROM video_queue WHERE video_id = ?", (video_id,)
            )
            if cursor.fetchone():
                return None

        # Also skip silently if already in episodes
        episode = self.db.get_episode(video_id=video_id)
        if episode is not None:
            return None

        queue_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO video_queue
                    (id, subscription_id, video_id, video_url, video_title,
                     channel_name, published_at, discovered_at, status,
                     priority, scheduled_for, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'skipped', 5, ?, ?)
                """,
                (
                    queue_id,
                    subscription_id,
                    video_id,
                    video_url,
                    video_title,
                    channel_name,
                    published_at,
                    now,
                    now,
                    reason,
                ),
            )

        return self.get_video(queue_id)

    def skip_video(self, queue_id: str) -> bool:
        """Mark a video as skipped."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE video_queue SET status = 'skipped' WHERE id = ?",
                (queue_id,),
            )
            return cursor.rowcount > 0

    def retry_all_failed(self) -> dict:
        """Reset all failed videos back to queued status.

        Resets attempt_count to 0, clears error_message, and schedules
        them for immediate processing.

        Returns:
            Dict with 'count' of retried videos.
        """
        now = datetime.utcnow().isoformat()

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE video_queue
                SET status = 'queued',
                    attempt_count = 0,
                    error_message = NULL,
                    processing_started_at = NULL,
                    processing_completed_at = NULL,
                    scheduled_for = ?
                WHERE status = 'failed'
                """,
                (now,),
            )
            count = cursor.rowcount

        return {"count": count}

    def prioritize(self, queue_id: str) -> bool:
        """Move a video to front of queue (priority=0, scheduled_for=now)."""
        now = datetime.utcnow().isoformat()

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE video_queue
                SET priority = 0, scheduled_for = ?
                WHERE id = ?
                """,
                (now, queue_id),
            )
            return cursor.rowcount > 0

    def remove(self, queue_id: str) -> bool:
        """Remove a video from the queue."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM video_queue WHERE id = ?", (queue_id,)
            )
            return cursor.rowcount > 0

    def get_queue_depth(self) -> int:
        """Count of videos with status='queued'."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT COUNT(*) as cnt FROM video_queue WHERE status = 'queued'"
            )
            return cursor.fetchone()["cnt"]

    def get_queue(self, page: int = 1, limit: int = 20) -> dict:
        """Get paginated queue items. Returns {items: [...], total: int}.

        Excludes videos older than PIPELINE_MAX_VIDEO_AGE_DAYS and videos
        without a published_at date.
        """
        offset = (page - 1) * limit
        cutoff = (
            datetime.utcnow() - timedelta(days=PIPELINE_MAX_VIDEO_AGE_DAYS)
        ).isoformat()

        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """SELECT COUNT(*) as cnt FROM video_queue
                   WHERE status = 'queued'
                     AND published_at IS NOT NULL
                     AND published_at >= ?""",
                (cutoff,),
            )
            total = cursor.fetchone()["cnt"]

            cursor.execute(
                """
                SELECT * FROM video_queue
                WHERE status = 'queued'
                  AND published_at IS NOT NULL
                  AND published_at >= ?
                ORDER BY discovered_at DESC
                LIMIT ? OFFSET ?
                """,
                (cutoff, limit, offset),
            )
            items = [dict(row) for row in cursor.fetchall()]

        return {"items": items, "total": total}

    def get_processing(self) -> List[dict]:
        """Get videos currently being processed."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM video_queue
                WHERE status = 'processing'
                ORDER BY processing_started_at ASC
                """
            )
            return [dict(row) for row in cursor.fetchall()]

    def get_history(self, page: int = 1, limit: int = 20) -> dict:
        """Get completed+failed videos. Returns {items: [...], total: int}.

        Excludes videos older than PIPELINE_MAX_VIDEO_AGE_DAYS.
        """
        offset = (page - 1) * limit
        cutoff = (
            datetime.utcnow() - timedelta(days=PIPELINE_MAX_VIDEO_AGE_DAYS)
        ).isoformat()

        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """SELECT COUNT(*) as cnt FROM video_queue
                   WHERE status IN ('completed', 'failed')
                     AND (published_at IS NULL OR published_at >= ?)""",
                (cutoff,),
            )
            total = cursor.fetchone()["cnt"]

            cursor.execute(
                """
                SELECT * FROM video_queue
                WHERE status IN ('completed', 'failed')
                  AND (published_at IS NULL OR published_at >= ?)
                ORDER BY processing_completed_at DESC
                LIMIT ? OFFSET ?
                """,
                (cutoff, limit, offset),
            )
            items = [dict(row) for row in cursor.fetchall()]

        return {"items": items, "total": total}

    # Columns returned by get_all_videos for the unified view.
    _ALL_VIDEOS_UNION = """
        SELECT
            vq.id, vq.subscription_id, vq.video_id, vq.video_url,
            vq.video_title, vq.channel_name, vq.published_at,
            vq.discovered_at, vq.status, vq.priority,
            vq.attempt_count, vq.max_attempts, vq.scheduled_for,
            vq.processing_started_at, vq.processing_completed_at,
            vq.restaurants_found, vq.error_message, vq.error_log,
            vq.episode_id
        FROM video_queue vq

        UNION ALL

        SELECT
            e.id           AS id,
            NULL           AS subscription_id,
            e.video_id     AS video_id,
            e.video_url    AS video_url,
            e.title        AS video_title,
            e.channel_name AS channel_name,
            e.published_at AS published_at,
            e.created_at   AS discovered_at,
            'completed'    AS status,
            0              AS priority,
            0              AS attempt_count,
            0              AS max_attempts,
            NULL           AS scheduled_for,
            NULL           AS processing_started_at,
            e.analysis_date AS processing_completed_at,
            (SELECT COUNT(*) FROM restaurants r WHERE r.episode_id = e.id)
                           AS restaurants_found,
            NULL           AS error_message,
            NULL           AS error_log,
            e.id           AS episode_id
        FROM episodes e
        WHERE e.video_id NOT IN (SELECT video_id FROM video_queue)
    """

    def get_all_videos(
        self,
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> dict:
        """Get all videos regardless of status, with optional filtering.

        Merges video_queue entries with episodes that were processed outside
        the queue (e.g. via direct analysis). Episodes not in video_queue
        appear as 'completed'.

        Returns {items: [...], total: int, status_summary: {queued: N, ...}}.
        Applies PIPELINE_MAX_VIDEO_AGE_DAYS cutoff on published_at.
        """
        offset = (page - 1) * limit
        cutoff = (
            datetime.utcnow() - timedelta(days=PIPELINE_MAX_VIDEO_AGE_DAYS)
        ).isoformat()

        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            base = f"({self._ALL_VIDEOS_UNION}) AS av"

            # Build WHERE clause
            conditions = [
                "(published_at IS NULL OR published_at >= ?)"
            ]
            params: list = [cutoff]

            if status:
                conditions.append("status = ?")
                params.append(status)

            if search:
                conditions.append(
                    "(video_title LIKE ? OR channel_name LIKE ?)"
                )
                search_pattern = f"%{search}%"
                params.extend([search_pattern, search_pattern])

            where = " AND ".join(conditions)

            # Status summary (always unfiltered by status/search, only age cutoff)
            cursor.execute(
                f"""SELECT status, COUNT(*) as cnt FROM {base}
                    WHERE (published_at IS NULL OR published_at >= ?)
                    GROUP BY status""",
                (cutoff,),
            )
            status_summary: Dict[str, int] = {}
            for row in cursor.fetchall():
                status_summary[row["status"]] = row["cnt"]

            # Total count for filtered results
            cursor.execute(
                f"SELECT COUNT(*) as cnt FROM {base} WHERE {where}",
                params,
            )
            total = cursor.fetchone()["cnt"]

            # Paginated items
            cursor.execute(
                f"""SELECT * FROM {base}
                    WHERE {where}
                    ORDER BY discovered_at DESC
                    LIMIT ? OFFSET ?""",
                params + [limit, offset],
            )
            items = [dict(row) for row in cursor.fetchall()]

        return {
            "items": items,
            "total": total,
            "status_summary": status_summary,
        }

    def get_video(self, queue_id: str) -> Optional[dict]:
        """Get a single queue entry."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM video_queue WHERE id = ?", (queue_id,)
            )
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None

    def cleanup_stale(self) -> int:
        """Mark videos stuck in 'processing' for > STALE_TIMEOUT_HOURS as 'failed'.
        Returns count of cleaned up videos.
        """
        cutoff = (
            datetime.utcnow() - timedelta(hours=PIPELINE_STALE_TIMEOUT_HOURS)
        ).isoformat()
        now = datetime.utcnow().isoformat()

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE video_queue
                SET status = 'failed',
                    error_message = 'Stale processing timeout',
                    processing_completed_at = ?
                WHERE status = 'processing'
                  AND processing_started_at < ?
                """,
                (now, cutoff),
            )
            return cursor.rowcount

    def cleanup_old_videos(self) -> int:
        """Delete queue entries for videos older than PIPELINE_MAX_VIDEO_AGE_DAYS.

        Removes queued, skipped, and failed entries. Completed entries are kept
        but hidden by get_history's age filter.

        Returns count of deleted entries.
        """
        cutoff = (
            datetime.utcnow() - timedelta(days=PIPELINE_MAX_VIDEO_AGE_DAYS)
        ).isoformat()

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                DELETE FROM video_queue
                WHERE status IN ('queued', 'skipped', 'failed')
                  AND (published_at IS NULL OR published_at < ?)
                """,
                (cutoff,),
            )
            return cursor.rowcount

    def _calculate_next_slot(self) -> str:
        """Calculate the next available processing slot.

        Finds the latest scheduled_for in the queue, adds PROCESS_INTERVAL_MINUTES.
        If nothing is scheduled, returns now().
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT MAX(scheduled_for) as latest
                FROM video_queue
                WHERE status = 'queued'
                """
            )
            row = cursor.fetchone()
            latest = row["latest"] if row else None

        if latest:
            latest_dt = datetime.fromisoformat(latest)
            next_slot = latest_dt + timedelta(
                minutes=PIPELINE_PROCESS_INTERVAL_MINUTES
            )
            # If the calculated slot is in the past, use now instead
            now = datetime.utcnow()
            if next_slot < now:
                return now.isoformat()
            return next_slot.isoformat()
        else:
            return datetime.utcnow().isoformat()
