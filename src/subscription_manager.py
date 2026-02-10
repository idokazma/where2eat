"""
Subscription manager for Where2Eat.
Handles CRUD operations for YouTube channel and playlist subscriptions
that are monitored for new restaurant content.
"""

import re
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from urllib.parse import urlparse, parse_qs

from database import Database


class SubscriptionManager:
    """Manages YouTube channel and playlist subscriptions."""

    def __init__(self, db: Database):
        """Initialize with a Database instance.

        Args:
            db: Database instance for persistence.
        """
        self.db = db

    def add_subscription(self, source_url: str, source_name: str = None,
                         priority: int = 5, check_interval_hours: int = 12) -> dict:
        """Add a YouTube channel or playlist as a subscription.

        Resolves the URL to extract source_type and source_id.
        Raises ValueError for invalid URLs or duplicates.

        Args:
            source_url: YouTube channel or playlist URL.
            source_name: Optional display name for the subscription.
            priority: Processing priority (1=highest, 10=lowest). Default 5.
            check_interval_hours: Hours between checks for new content. Default 12.

        Returns:
            The created subscription as a dict.

        Raises:
            ValueError: If URL is invalid or a subscription with the same source_id
                        already exists.
        """
        # Resolve URL to source_type and source_id
        resolved = self.resolve_source(source_url)
        source_type = resolved['source_type']
        source_id = resolved['source_id']

        # Check for duplicate source_id
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT id FROM subscriptions WHERE source_id = ?',
                (source_id,)
            )
            if cursor.fetchone():
                raise ValueError(
                    f'Subscription with source_id "{source_id}" already exists'
                )

            # Insert the new subscription
            subscription_id = str(uuid.uuid4())
            now = datetime.now().isoformat()

            cursor.execute('''
                INSERT INTO subscriptions (
                    id, source_type, source_url, source_id, source_name,
                    is_active, priority, check_interval_hours,
                    total_videos_found, total_videos_processed, total_restaurants_found,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                subscription_id,
                source_type,
                source_url,
                source_id,
                source_name,
                1,  # is_active
                priority,
                check_interval_hours,
                0,  # total_videos_found
                0,  # total_videos_processed
                0,  # total_restaurants_found
                now,
                now,
            ))

        # Return the created subscription
        return self.get_subscription(subscription_id)

    def get_subscription(self, subscription_id: str) -> Optional[dict]:
        """Get a subscription by ID.

        Args:
            subscription_id: The subscription UUID.

        Returns:
            Subscription dict or None if not found.
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT * FROM subscriptions WHERE id = ?',
                (subscription_id,)
            )
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None

    def list_subscriptions(self, active_only: bool = True) -> List[dict]:
        """List subscriptions, ordered by priority ASC, last_checked_at ASC.

        Args:
            active_only: If True, only return active subscriptions. Default True.

        Returns:
            List of subscription dicts.
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            if active_only:
                cursor.execute('''
                    SELECT * FROM subscriptions
                    WHERE is_active = 1
                    ORDER BY priority ASC, last_checked_at ASC NULLS FIRST
                ''')
            else:
                cursor.execute('''
                    SELECT * FROM subscriptions
                    ORDER BY priority ASC, last_checked_at ASC NULLS FIRST
                ''')

            return [dict(row) for row in cursor.fetchall()]

    def update_subscription(self, subscription_id: str, **kwargs) -> bool:
        """Update subscription fields.

        Supported fields: is_active, priority, check_interval_hours,
        last_checked_at, last_video_published_at, source_name.

        Args:
            subscription_id: The subscription UUID.
            **kwargs: Fields to update.

        Returns:
            True if the subscription was updated, False otherwise.
        """
        if not kwargs:
            return False

        allowed_fields = {
            'is_active', 'priority', 'check_interval_hours',
            'last_checked_at', 'last_video_published_at', 'source_name'
        }

        # Filter to only allowed fields
        updates = {k: v for k, v in kwargs.items() if k in allowed_fields}
        if not updates:
            return False

        updates['updated_at'] = datetime.now().isoformat()

        set_clause = ', '.join(f'{k} = ?' for k in updates.keys())
        values = list(updates.values()) + [subscription_id]

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f'UPDATE subscriptions SET {set_clause} WHERE id = ?',
                values
            )
            return cursor.rowcount > 0

    def update_stats(self, subscription_id: str, videos_found: int = 0,
                     videos_processed: int = 0, restaurants_found: int = 0) -> bool:
        """Increment subscription stats.

        Args:
            subscription_id: The subscription UUID.
            videos_found: Number of new videos found to add.
            videos_processed: Number of newly processed videos to add.
            restaurants_found: Number of new restaurants found to add.

        Returns:
            True if the subscription was updated, False otherwise.
        """
        now = datetime.now().isoformat()

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE subscriptions SET
                    total_videos_found = total_videos_found + ?,
                    total_videos_processed = total_videos_processed + ?,
                    total_restaurants_found = total_restaurants_found + ?,
                    updated_at = ?
                WHERE id = ?
            ''', (
                videos_found,
                videos_processed,
                restaurants_found,
                now,
                subscription_id,
            ))
            return cursor.rowcount > 0

    def pause_subscription(self, subscription_id: str) -> bool:
        """Set is_active=0 for a subscription.

        Args:
            subscription_id: The subscription UUID.

        Returns:
            True if the subscription was paused, False otherwise.
        """
        return self.update_subscription(subscription_id, is_active=0)

    def resume_subscription(self, subscription_id: str) -> bool:
        """Set is_active=1 for a subscription.

        Args:
            subscription_id: The subscription UUID.

        Returns:
            True if the subscription was resumed, False otherwise.
        """
        return self.update_subscription(subscription_id, is_active=1)

    def delete_subscription(self, subscription_id: str) -> bool:
        """Delete a subscription.

        Args:
            subscription_id: The subscription UUID.

        Returns:
            True if the subscription was deleted, False otherwise.
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'DELETE FROM subscriptions WHERE id = ?',
                (subscription_id,)
            )
            return cursor.rowcount > 0

    @staticmethod
    def resolve_source(url: str) -> dict:
        """Parse a YouTube URL and return source_type and source_id.

        Supported formats:
        - youtube.com/channel/UCxxx        -> channel, UCxxx
        - youtube.com/@handle              -> channel, @handle
        - youtube.com/c/name               -> channel, c/name
        - youtube.com/user/name            -> channel, user/name
        - youtube.com/playlist?list=PLxxx  -> playlist, PLxxx
        - m.youtube.com variants of all the above

        Args:
            url: A YouTube URL string.

        Returns:
            Dict with 'source_type' and 'source_id' keys.

        Raises:
            ValueError: If the URL is not a recognized YouTube URL.
        """
        if not url or not isinstance(url, str):
            raise ValueError(f'Invalid YouTube URL: "{url}"')

        url = url.strip()

        try:
            parsed = urlparse(url)
        except Exception:
            raise ValueError(f'Invalid YouTube URL: "{url}"')

        # Validate hostname is YouTube
        hostname = (parsed.hostname or '').lower()
        valid_hosts = {'youtube.com', 'www.youtube.com', 'm.youtube.com'}
        if hostname not in valid_hosts:
            raise ValueError(
                f'Invalid YouTube URL: "{url}" '
                f'(hostname "{hostname}" is not a recognized YouTube domain)'
            )

        path = parsed.path.rstrip('/')

        # Playlist: /playlist?list=PLxxx
        if path == '/playlist':
            query_params = parse_qs(parsed.query)
            list_ids = query_params.get('list', [])
            if list_ids:
                return {'source_type': 'playlist', 'source_id': list_ids[0]}
            raise ValueError(f'Invalid YouTube URL: "{url}" (playlist URL missing list parameter)')

        # Channel ID: /channel/UCxxx
        channel_match = re.match(r'^/channel/([^/]+)$', path)
        if channel_match:
            return {'source_type': 'channel', 'source_id': channel_match.group(1)}

        # Handle: /@handle
        handle_match = re.match(r'^/@([^/]+)$', path)
        if handle_match:
            return {'source_type': 'channel', 'source_id': f'@{handle_match.group(1)}'}

        # Custom URL: /c/name
        c_match = re.match(r'^/c/([^/]+)$', path)
        if c_match:
            return {'source_type': 'channel', 'source_id': f'c/{c_match.group(1)}'}

        # Legacy user URL: /user/name
        user_match = re.match(r'^/user/([^/]+)$', path)
        if user_match:
            return {'source_type': 'channel', 'source_id': f'user/{user_match.group(1)}'}

        raise ValueError(
            f'Invalid YouTube URL: "{url}" '
            f'(could not determine channel or playlist from path "{path}")'
        )
