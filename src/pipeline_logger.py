"""
Structured pipeline logger for Where2Eat.
Provides event logging, querying, rotation, and statistics for pipeline operations.
Logs are stored in the pipeline_logs SQLite table.
"""

import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from database import Database
from config import PIPELINE_LOG_RETENTION_DAYS


class PipelineLogger:
    """Structured logger for pipeline events, backed by SQLite."""

    def __init__(self, db: Database):
        """Initialize the pipeline logger.

        Args:
            db: Database instance for persistence.
        """
        self.db = db

    def log(self, level: str, event_type: str, message: str,
            subscription_id: str = None, video_queue_id: str = None,
            details: dict = None) -> str:
        """Create a pipeline log entry.

        Args:
            level: Log level ('info', 'warning', or 'error').
            event_type: Category of the event (e.g. 'video_processed').
            message: Human-readable log message.
            subscription_id: Optional reference to a subscription.
            video_queue_id: Optional reference to a video queue item.
            details: Optional dict of additional structured data (stored as JSON).

        Returns:
            The ID of the created log entry.
        """
        log_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat()
        details_json = json.dumps(details) if details is not None else None

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO pipeline_logs
                    (id, timestamp, level, event_type, subscription_id,
                     video_queue_id, message, details)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                log_id,
                timestamp,
                level,
                event_type,
                subscription_id,
                video_queue_id,
                message,
                details_json,
            ))

        return log_id

    def info(self, event_type: str, message: str, **kwargs) -> str:
        """Shorthand for log with level='info'."""
        return self.log('info', event_type, message, **kwargs)

    def warning(self, event_type: str, message: str, **kwargs) -> str:
        """Shorthand for log with level='warning'."""
        return self.log('warning', event_type, message, **kwargs)

    def error(self, event_type: str, message: str, **kwargs) -> str:
        """Shorthand for log with level='error'."""
        return self.log('error', event_type, message, **kwargs)

    def get_logs(self, level: str = None, event_type: str = None,
                 subscription_id: str = None, start_date: str = None,
                 end_date: str = None, page: int = 1, limit: int = 50) -> dict:
        """Get paginated, filtered logs.

        Args:
            level: Filter by log level.
            event_type: Filter by event type.
            subscription_id: Filter by subscription ID.
            start_date: Filter logs on or after this date (ISO format or YYYY-MM-DD).
            end_date: Filter logs on or before this date (ISO format or YYYY-MM-DD).
            page: Page number (1-based).
            limit: Number of results per page.

        Returns:
            Dict with keys: items (list of log dicts), total (int),
            page (int), limit (int).
        """
        conditions = []
        params = []

        if level is not None:
            conditions.append("level = ?")
            params.append(level)

        if event_type is not None:
            conditions.append("event_type = ?")
            params.append(event_type)

        if subscription_id is not None:
            conditions.append("subscription_id = ?")
            params.append(subscription_id)

        if start_date is not None:
            conditions.append("timestamp >= ?")
            params.append(start_date)

        if end_date is not None:
            # If only a date is provided (no time component), include the entire day
            effective_end = end_date
            if 'T' not in end_date:
                effective_end = end_date + 'T23:59:59'
            conditions.append("timestamp <= ?")
            params.append(effective_end)

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            # Get total count for the filter
            cursor.execute(
                f"SELECT COUNT(*) as total FROM pipeline_logs WHERE {where_clause}",
                params
            )
            total = cursor.fetchone()['total']

            # Get paginated results, most recent first
            offset = (page - 1) * limit
            cursor.execute(
                f"SELECT * FROM pipeline_logs WHERE {where_clause} "
                f"ORDER BY timestamp DESC LIMIT ? OFFSET ?",
                params + [limit, offset]
            )

            items = [dict(row) for row in cursor.fetchall()]

        return {
            'items': items,
            'total': total,
            'page': page,
            'limit': limit,
        }

    def cleanup(self, retention_days: int = None) -> int:
        """Delete logs older than retention_days.

        Args:
            retention_days: Number of days to retain. Defaults to
                PIPELINE_LOG_RETENTION_DAYS from config.

        Returns:
            The number of log entries deleted.
        """
        if retention_days is None:
            retention_days = PIPELINE_LOG_RETENTION_DAYS

        cutoff = (datetime.utcnow() - timedelta(days=retention_days)).isoformat()

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM pipeline_logs WHERE timestamp < ?",
                (cutoff,)
            )
            return cursor.rowcount

    def get_event_counts(self, days: int = 7) -> dict:
        """Count log entries by event_type in the last N days.

        Args:
            days: Number of days to look back (default 7).

        Returns:
            Dict mapping event_type to count, e.g. {'video_processed': 3, ...}.
        """
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT event_type, COUNT(*) as count "
                "FROM pipeline_logs "
                "WHERE timestamp >= ? "
                "GROUP BY event_type",
                (cutoff,)
            )

            return {row['event_type']: row['count'] for row in cursor.fetchall()}
