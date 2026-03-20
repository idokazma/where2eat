"""
Database layer for Where2Eat using SQLite.
Provides persistence for restaurants, episodes, and processing jobs.
"""

import os
import json
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional, Any
from contextlib import contextmanager
import uuid


class Database:
    """SQLite database manager for Where2Eat."""

    def __init__(self, db_path: str = None):
        """Initialize database connection.

        Args:
            db_path: Path to SQLite database file. Defaults to data/where2eat.db
                     Can be overridden via DATABASE_DIR or DATABASE_PATH env vars.
        """
        if db_path is None:
            # Check for explicit database path env var
            db_path = os.getenv('DATABASE_PATH')

            if not db_path:
                # Check for DATABASE_DIR env var (Railway volume mount point)
                db_dir = os.getenv('DATABASE_DIR')
                if db_dir:
                    db_path = os.path.join(db_dir, 'where2eat.db')
                else:
                    # Default: project_root/data/where2eat.db
                    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                    db_path = os.path.join(project_root, 'data', 'where2eat.db')

        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._init_schema()

    @contextmanager
    def get_connection(self):
        """Get a database connection with automatic cleanup."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_schema(self):
        """Initialize database schema."""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Episodes table (YouTube videos)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS episodes (
                    id TEXT PRIMARY KEY,
                    video_id TEXT UNIQUE NOT NULL,
                    video_url TEXT NOT NULL,
                    channel_id TEXT,
                    channel_name TEXT,
                    title TEXT,
                    language TEXT DEFAULT 'he',
                    analysis_date TEXT,
                    published_at TEXT,
                    transcript TEXT,
                    food_trends TEXT,
                    episode_summary TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Restaurants table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS restaurants (
                    id TEXT PRIMARY KEY,
                    episode_id TEXT,
                    name_hebrew TEXT NOT NULL,
                    name_english TEXT,
                    city TEXT,
                    neighborhood TEXT,
                    address TEXT,
                    region TEXT DEFAULT 'Center',
                    cuisine_type TEXT,
                    status TEXT DEFAULT 'open',
                    price_range TEXT,
                    host_opinion TEXT,
                    host_comments TEXT,
                    menu_items TEXT,
                    special_features TEXT,
                    contact_hours TEXT,
                    contact_phone TEXT,
                    contact_website TEXT,
                    business_news TEXT,
                    mention_context TEXT,
                    mention_timestamp REAL,
                    google_place_id TEXT,
                    google_rating REAL,
                    google_user_ratings_total INTEGER,
                    latitude REAL,
                    longitude REAL,
                    image_url TEXT,
                    is_hidden INTEGER DEFAULT 0,
                    is_closing INTEGER DEFAULT 0,
                    video_url TEXT,
                    video_id TEXT,
                    channel_name TEXT,
                    google_url TEXT,
                    engaging_quote TEXT,
                    country TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (episode_id) REFERENCES episodes(id)
                )
            ''')

            # Processing jobs table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    job_type TEXT NOT NULL,
                    status TEXT DEFAULT 'pending',
                    channel_url TEXT,
                    video_url TEXT,
                    filters TEXT,
                    processing_options TEXT,
                    progress_videos_completed INTEGER DEFAULT 0,
                    progress_videos_total INTEGER DEFAULT 0,
                    progress_videos_failed INTEGER DEFAULT 0,
                    progress_restaurants_found INTEGER DEFAULT 0,
                    current_video_id TEXT,
                    current_video_title TEXT,
                    current_step TEXT,
                    error_message TEXT,
                    started_at TEXT,
                    completed_at TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Admin users table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS admin_users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    name TEXT NOT NULL,
                    role TEXT NOT NULL CHECK(role IN ('super_admin', 'admin', 'editor', 'viewer')),
                    is_active INTEGER DEFAULT 1,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    last_login TEXT
                )
            ''')

            # Admin sessions table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS admin_sessions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    token_hash TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    ip_address TEXT,
                    user_agent TEXT,
                    FOREIGN KEY (user_id) REFERENCES admin_users(id)
                )
            ''')

            # Restaurant edit history table (audit log)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS restaurant_edits (
                    id TEXT PRIMARY KEY,
                    restaurant_name TEXT NOT NULL,
                    restaurant_id TEXT,
                    admin_user_id TEXT NOT NULL,
                    edit_type TEXT NOT NULL CHECK(edit_type IN ('create', 'update', 'delete', 'approve', 'reject')),
                    changes TEXT,
                    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id),
                    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
                )
            ''')

            # System settings table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_by TEXT,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (updated_by) REFERENCES admin_users(id)
                )
            ''')

            # Articles table for CMS
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS articles (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    slug TEXT UNIQUE NOT NULL,
                    excerpt TEXT,
                    content TEXT NOT NULL,
                    featured_image TEXT,
                    status TEXT NOT NULL CHECK(status IN ('draft', 'published', 'scheduled', 'archived')) DEFAULT 'draft',
                    author_id TEXT NOT NULL,
                    category TEXT,
                    tags TEXT,
                    seo_title TEXT,
                    seo_description TEXT,
                    seo_keywords TEXT,
                    published_at TEXT,
                    scheduled_for TEXT,
                    view_count INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (author_id) REFERENCES admin_users(id)
                )
            ''')

            # Error logs table for system monitoring
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS error_logs (
                    id TEXT PRIMARY KEY,
                    error_id TEXT UNIQUE NOT NULL,
                    level TEXT NOT NULL CHECK(level IN ('critical', 'warning', 'info', 'debug')),
                    service TEXT NOT NULL,
                    message TEXT NOT NULL,
                    stack_trace TEXT,
                    context TEXT,
                    job_id TEXT,
                    video_id TEXT,
                    first_occurred TEXT DEFAULT CURRENT_TIMESTAMP,
                    last_occurred TEXT DEFAULT CURRENT_TIMESTAMP,
                    occurrence_count INTEGER DEFAULT 1,
                    resolved INTEGER DEFAULT 0,
                    resolved_at TEXT,
                    resolved_by TEXT,
                    resolution_notes TEXT,
                    FOREIGN KEY (resolved_by) REFERENCES admin_users(id)
                )
            ''')

            # Connection test history table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS connection_tests (
                    id TEXT PRIMARY KEY,
                    service TEXT NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('healthy', 'degraded', 'error', 'unavailable', 'timeout')),
                    response_time_ms INTEGER,
                    error_message TEXT,
                    details TEXT,
                    tested_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    tested_by TEXT,
                    FOREIGN KEY (tested_by) REFERENCES admin_users(id)
                )
            ''')

            # System metrics table for historical tracking
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS system_metrics (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                    metric_type TEXT NOT NULL,
                    metric_name TEXT NOT NULL,
                    metric_value REAL NOT NULL,
                    metadata TEXT
                )
            ''')

            # Monitored channels table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS monitored_channels (
                    id TEXT PRIMARY KEY,
                    channel_id TEXT UNIQUE NOT NULL,
                    channel_url TEXT NOT NULL,
                    channel_name TEXT,
                    playlist_id TEXT,
                    playlist_url TEXT,
                    enabled INTEGER DEFAULT 1,
                    poll_interval_minutes INTEGER DEFAULT 360,
                    last_polled_at TEXT,
                    last_video_found_at TEXT,
                    total_videos_found INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Subscriptions table (monitored YouTube channels/playlists)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id TEXT PRIMARY KEY,
                    source_type TEXT NOT NULL CHECK(source_type IN ('channel', 'playlist')),
                    source_url TEXT NOT NULL,
                    source_id TEXT UNIQUE NOT NULL,
                    source_name TEXT,
                    is_active INTEGER DEFAULT 1,
                    priority INTEGER DEFAULT 5,
                    check_interval_hours INTEGER DEFAULT 12,
                    last_checked_at TEXT,
                    last_video_published_at TEXT,
                    total_videos_found INTEGER DEFAULT 0,
                    total_videos_processed INTEGER DEFAULT 0,
                    total_restaurants_found INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Video queue table (videos waiting to be processed)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS video_queue (
                    id TEXT PRIMARY KEY,
                    subscription_id TEXT,
                    video_id TEXT UNIQUE NOT NULL,
                    video_url TEXT NOT NULL,
                    video_title TEXT,
                    channel_name TEXT,
                    published_at TEXT,
                    discovered_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    status TEXT DEFAULT 'queued' CHECK(status IN ('queued', 'processing', 'completed', 'failed', 'skipped')),
                    priority INTEGER DEFAULT 5,
                    attempt_count INTEGER DEFAULT 0,
                    max_attempts INTEGER DEFAULT 3,
                    scheduled_for TEXT,
                    processing_started_at TEXT,
                    processing_completed_at TEXT,
                    restaurants_found INTEGER DEFAULT 0,
                    error_message TEXT,
                    error_log TEXT,
                    episode_id TEXT,
                    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
                    FOREIGN KEY (episode_id) REFERENCES episodes(id)
                )
            ''')

            # Pipeline logs table (structured event log)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS pipeline_logs (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                    level TEXT NOT NULL CHECK(level IN ('info', 'warning', 'error')),
                    event_type TEXT NOT NULL,
                    subscription_id TEXT,
                    video_queue_id TEXT,
                    message TEXT NOT NULL,
                    details TEXT,
                    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
                    FOREIGN KEY (video_queue_id) REFERENCES video_queue(id)
                )
            ''')

            # Schema migrations - add new columns gracefully
            try:
                cursor.execute('ALTER TABLE restaurants ADD COLUMN photos TEXT')
            except sqlite3.OperationalError:
                pass  # Column already exists

            try:
                cursor.execute('ALTER TABLE restaurants ADD COLUMN google_name TEXT')
            except sqlite3.OperationalError:
                pass  # Column already exists

            try:
                cursor.execute('ALTER TABLE restaurants ADD COLUMN published_at TEXT')
            except sqlite3.OperationalError:
                pass  # Column already exists

            try:
                cursor.execute('ALTER TABLE restaurants ADD COLUMN og_image_url TEXT')
            except sqlite3.OperationalError:
                pass  # Column already exists

            try:
                cursor.execute('ALTER TABLE restaurants ADD COLUMN is_hidden INTEGER DEFAULT 0')
            except sqlite3.OperationalError:
                pass  # Column already exists

            for col, col_type in [
                ('is_closing', 'INTEGER DEFAULT 0'),
                ('video_url', 'TEXT'),
                ('video_id', 'TEXT'),
                ('channel_name', 'TEXT'),
                ('google_url', 'TEXT'),
                ('engaging_quote', 'TEXT'),
                ('country', 'TEXT'),
                ('instagram_url', 'TEXT'),
            ]:
                try:
                    cursor.execute(f'ALTER TABLE restaurants ADD COLUMN {col} {col_type}')
                except sqlite3.OperationalError:
                    pass  # Column already exists

            # Backfill restaurants.published_at from episodes
            try:
                cursor.execute('''
                    UPDATE restaurants SET published_at = (
                        SELECT COALESCE(e.published_at, e.analysis_date)
                        FROM episodes e WHERE e.id = restaurants.episode_id
                    ) WHERE published_at IS NULL AND episode_id IS NOT NULL
                ''')
            except sqlite3.OperationalError:
                pass

            try:
                cursor.execute('ALTER TABLE episodes ADD COLUMN published_at TEXT')
            except sqlite3.OperationalError:
                pass  # Column already exists

            # Backfill published_at from video_queue where available
            try:
                cursor.execute('''
                    UPDATE episodes SET published_at = (
                        SELECT vq.published_at FROM video_queue vq
                        WHERE vq.video_id = episodes.video_id AND vq.published_at IS NOT NULL
                    ) WHERE published_at IS NULL
                ''')
            except sqlite3.OperationalError:
                pass  # video_queue table may not exist yet

            # Add processing_steps column to video_queue
            try:
                cursor.execute('ALTER TABLE video_queue ADD COLUMN processing_steps TEXT')
            except sqlite3.OperationalError:
                pass  # Column already exists

            # Backfill restaurants.video_url, video_id, channel_name from episodes
            try:
                cursor.execute('''
                    UPDATE restaurants SET
                        video_url = (SELECT e.video_url FROM episodes e WHERE e.id = restaurants.episode_id),
                        video_id = (SELECT e.video_id FROM episodes e WHERE e.id = restaurants.episode_id),
                        channel_name = (SELECT e.channel_name FROM episodes e WHERE e.id = restaurants.episode_id)
                    WHERE episode_id IS NOT NULL AND video_url IS NULL
                ''')
            except sqlite3.OperationalError:
                pass

            # Create indexes for common queries
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_restaurants_city ON restaurants(city)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine ON restaurants(cuisine_type)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_restaurants_episode ON restaurants(episode_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_restaurants_published_at ON restaurants(published_at)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_episodes_video_id ON episodes(video_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id ON admin_sessions(user_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_restaurant_edits_restaurant_id ON restaurant_edits(restaurant_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_restaurant_edits_admin_user_id ON restaurant_edits(admin_user_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_articles_author_id ON articles(author_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(level)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_error_logs_service ON error_logs(service)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_error_logs_first_occurred ON error_logs(first_occurred)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_connection_tests_service ON connection_tests(service)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metrics(metric_type)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_monitored_channels_channel_id ON monitored_channels(channel_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_monitored_channels_enabled ON monitored_channels(enabled)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_subscriptions_is_active ON subscriptions(is_active)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_subscriptions_source_id ON subscriptions(source_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_video_queue_status ON video_queue(status)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_video_queue_video_id ON video_queue(video_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_video_queue_subscription_id ON video_queue(subscription_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_video_queue_scheduled_for ON video_queue(scheduled_for)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_pipeline_logs_timestamp ON pipeline_logs(timestamp)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_pipeline_logs_level ON pipeline_logs(level)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_pipeline_logs_event_type ON pipeline_logs(event_type)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_pipeline_logs_subscription_id ON pipeline_logs(subscription_id)')

    # ==================== Episode Operations ====================

    def create_episode(self, video_id: str, video_url: str, **kwargs) -> str:
        """Create a new episode record.

        Args:
            video_id: YouTube video ID
            video_url: Full YouTube URL
            **kwargs: Additional episode fields

        Returns:
            Episode ID
        """
        episode_id = kwargs.get('id', str(uuid.uuid4()))

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO episodes (id, video_id, video_url, channel_id, channel_name,
                    title, language, analysis_date, published_at, transcript, food_trends, episode_summary)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(video_id) DO UPDATE SET
                    video_url = excluded.video_url,
                    channel_id = COALESCE(excluded.channel_id, episodes.channel_id),
                    channel_name = COALESCE(excluded.channel_name, episodes.channel_name),
                    title = COALESCE(excluded.title, episodes.title),
                    language = COALESCE(excluded.language, episodes.language),
                    analysis_date = COALESCE(excluded.analysis_date, episodes.analysis_date),
                    published_at = COALESCE(excluded.published_at, episodes.published_at),
                    transcript = COALESCE(excluded.transcript, episodes.transcript),
                    food_trends = COALESCE(excluded.food_trends, episodes.food_trends),
                    episode_summary = COALESCE(excluded.episode_summary, episodes.episode_summary),
                    updated_at = CURRENT_TIMESTAMP
            ''', (
                episode_id,
                video_id,
                video_url,
                kwargs.get('channel_id'),
                kwargs.get('channel_name'),
                kwargs.get('title'),
                kwargs.get('language', 'he'),
                kwargs.get('analysis_date', datetime.now().isoformat()),
                kwargs.get('published_at'),
                kwargs.get('transcript'),
                json.dumps(kwargs.get('food_trends', [])),
                kwargs.get('episode_summary')
            ))

            # Get the actual ID (in case of conflict)
            cursor.execute('SELECT id FROM episodes WHERE video_id = ?', (video_id,))
            row = cursor.fetchone()
            return row['id'] if row else episode_id

    def get_episode(self, episode_id: str = None, video_id: str = None) -> Optional[Dict]:
        """Get episode by ID or video_id."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if episode_id:
                cursor.execute('SELECT * FROM episodes WHERE id = ?', (episode_id,))
            elif video_id:
                cursor.execute('SELECT * FROM episodes WHERE video_id = ?', (video_id,))
            else:
                return None

            row = cursor.fetchone()
            if row:
                episode = dict(row)
                episode['food_trends'] = json.loads(episode.get('food_trends') or '[]')
                return episode
            return None

    def get_all_episodes(self) -> List[Dict]:
        """Get all episodes."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM episodes ORDER BY analysis_date DESC')
            episodes = []
            for row in cursor.fetchall():
                episode = dict(row)
                episode['food_trends'] = json.loads(episode.get('food_trends') or '[]')
                episodes.append(episode)
            return episodes

    # ==================== Restaurant Operations ====================

    def create_restaurant(self, name_hebrew: str, episode_id: str = None, **kwargs) -> str:
        """Create a new restaurant record.

        Args:
            name_hebrew: Hebrew name of the restaurant
            episode_id: Optional reference to source episode
            **kwargs: Additional restaurant fields

        Returns:
            Restaurant ID
        """
        restaurant_id = kwargs.get('id', str(uuid.uuid4()))

        # Handle nested location dict
        location = kwargs.get('location', {})
        city = kwargs.get('city') or location.get('city')
        neighborhood = kwargs.get('neighborhood') or location.get('neighborhood')
        address = kwargs.get('address') or location.get('address')
        region = kwargs.get('region') or location.get('region', 'Center')

        # Handle nested contact_info dict
        contact_info = kwargs.get('contact_info', {})
        contact_hours = kwargs.get('contact_hours') or contact_info.get('hours')
        contact_phone = kwargs.get('contact_phone') or contact_info.get('phone')
        contact_website = kwargs.get('contact_website') or contact_info.get('website')

        # Handle nested rating dict
        rating = kwargs.get('rating', {})
        google_rating = kwargs.get('google_rating') or rating.get('google_rating')
        google_user_ratings_total = kwargs.get('google_user_ratings_total') or rating.get('user_ratings_total')

        # Handle google_name from google_places dict or direct kwarg
        google_places = kwargs.get('google_places', {}) or {}
        google_name = kwargs.get('google_name') or google_places.get('google_name')
        google_place_id = kwargs.get('google_place_id') or google_places.get('place_id')
        google_url = kwargs.get('google_url') or google_places.get('google_url')

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO restaurants (
                    id, episode_id, name_hebrew, name_english, city, neighborhood,
                    address, region, cuisine_type, status, price_range, host_opinion,
                    host_comments, menu_items, special_features, contact_hours,
                    contact_phone, contact_website, business_news, mention_context,
                    mention_timestamp, google_place_id, google_rating,
                    google_user_ratings_total, latitude, longitude, image_url, photos,
                    google_name, published_at, og_image_url,
                    video_url, video_id, channel_name, google_url, engaging_quote,
                    is_closing, country
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                restaurant_id,
                episode_id,
                name_hebrew,
                kwargs.get('name_english'),
                city,
                neighborhood,
                address,
                region,
                kwargs.get('cuisine_type'),
                kwargs.get('status', 'open'),
                kwargs.get('price_range'),
                kwargs.get('host_opinion'),
                kwargs.get('host_comments'),
                json.dumps(kwargs.get('menu_items', [])),
                json.dumps(kwargs.get('special_features', [])),
                contact_hours,
                contact_phone,
                contact_website,
                kwargs.get('business_news'),
                kwargs.get('mention_context'),
                kwargs.get('mention_timestamp') or kwargs.get('mention_timestamp_seconds'),
                google_place_id,
                google_rating,
                google_user_ratings_total,
                kwargs.get('latitude'),
                kwargs.get('longitude'),
                kwargs.get('image_url'),
                json.dumps(kwargs.get('photos', [])),
                google_name,
                kwargs.get('published_at'),
                kwargs.get('og_image_url'),
                kwargs.get('video_url'),
                kwargs.get('video_id'),
                kwargs.get('channel_name'),
                google_url,
                kwargs.get('engaging_quote'),
                1 if kwargs.get('is_closing') else 0,
                kwargs.get('country'),
            ))

            return restaurant_id

    def get_restaurant(self, restaurant_id: str) -> Optional[Dict]:
        """Get restaurant by ID or Google Place ID."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM restaurants WHERE id = ?', (restaurant_id,))
            row = cursor.fetchone()
            if row:
                return self._row_to_restaurant(row)
            # Fallback: search by google_place_id (used when navigating from map)
            cursor.execute('SELECT * FROM restaurants WHERE google_place_id = ?', (restaurant_id,))
            row = cursor.fetchone()
            if row:
                return self._row_to_restaurant(row)
            return None

    def _row_to_restaurant(self, row: sqlite3.Row) -> Dict:
        """Convert database row to restaurant dict with nested structures."""
        restaurant = dict(row)

        # Reconstruct nested location (include lat/lng for API Location model)
        restaurant['location'] = {
            'city': restaurant.pop('city', None),
            'neighborhood': restaurant.pop('neighborhood', None),
            'address': restaurant.pop('address', None),
            'region': restaurant.pop('region', 'Center'),
            'lat': restaurant.get('latitude'),
            'lng': restaurant.get('longitude'),
        }

        # Reconstruct nested contact_info
        restaurant['contact_info'] = {
            'hours': restaurant.pop('contact_hours', None),
            'phone': restaurant.pop('contact_phone', None),
            'website': restaurant.pop('contact_website', None)
        }

        # Reconstruct nested rating
        restaurant['rating'] = {
            'google_rating': restaurant.pop('google_rating', None),
            'user_ratings_total': restaurant.pop('google_user_ratings_total', None)
        }

        # Reconstruct google_places object
        google_url = restaurant.pop('google_url', None)
        restaurant['google_places'] = {
            'place_id': restaurant.get('google_place_id'),
            'google_name': restaurant.pop('google_name', None),
            'google_url': google_url,
        }

        # Map mention_timestamp column to mention_timestamp_seconds (frontend field name)
        if 'mention_timestamp' in restaurant:
            ts = restaurant.pop('mention_timestamp')
            restaurant['mention_timestamp_seconds'] = int(ts) if ts else None

        # Build self-contained episode_info from denormalized columns
        video_url = restaurant.get('video_url')
        video_id = restaurant.get('video_id')
        if video_url or video_id:
            restaurant['episode_info'] = {
                'video_id': video_id,
                'video_url': video_url,
                'channel_name': restaurant.get('channel_name'),
                'published_at': restaurant.get('published_at'),
            }

        # Build timestamped YouTube link
        ts_val = restaurant.get('mention_timestamp_seconds')
        if video_url and ts_val:
            restaurant['youtube_timestamped_url'] = f"{video_url}&t={ts_val}s"
        elif video_url:
            restaurant['youtube_timestamped_url'] = video_url

        # Parse JSON fields
        restaurant['menu_items'] = json.loads(restaurant.get('menu_items') or '[]')
        restaurant['special_features'] = json.loads(restaurant.get('special_features') or '[]')
        restaurant['photos'] = json.loads(restaurant.get('photos') or '[]')
        # Handle double-encoded JSON (string inside JSON)
        if isinstance(restaurant['photos'], str):
            restaurant['photos'] = json.loads(restaurant['photos'])

        return restaurant

    def get_all_restaurants(self, include_episode_info: bool = True) -> List[Dict]:
        """Get all restaurants with optional episode info."""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            if include_episode_info:
                cursor.execute('''
                    SELECT r.*,
                           e.video_id AS ep_video_id, e.video_url AS ep_video_url,
                           e.channel_name AS ep_channel_name, e.title AS episode_title,
                           e.analysis_date AS ep_analysis_date,
                           e.published_at AS episode_published_at
                    FROM restaurants r
                    LEFT JOIN episodes e ON r.episode_id = e.id
                    ORDER BY COALESCE(r.published_at, e.published_at, e.analysis_date) DESC
                ''')
            else:
                cursor.execute('SELECT * FROM restaurants ORDER BY created_at DESC')

            restaurants = []
            for row in cursor.fetchall():
                restaurant = self._row_to_restaurant(row)

                # Fill episode_info from join if not already set by denormalized columns
                if include_episode_info:
                    ep_video_id = restaurant.pop('ep_video_id', None)
                    ep_video_url = restaurant.pop('ep_video_url', None)
                    ep_channel_name = restaurant.pop('ep_channel_name', None)
                    ep_title = restaurant.pop('episode_title', None)
                    ep_analysis_date = restaurant.pop('ep_analysis_date', None)
                    ep_published_at = restaurant.pop('episode_published_at', None)

                    if not restaurant.get('episode_info'):
                        if ep_video_id or ep_video_url:
                            restaurant['episode_info'] = {
                                'video_id': ep_video_id,
                                'video_url': ep_video_url,
                                'channel_name': ep_channel_name,
                                'title': ep_title,
                                'analysis_date': ep_analysis_date,
                                'published_at': ep_published_at,
                            }
                    else:
                        # Merge in title/analysis_date from episode join
                        restaurant['episode_info'].setdefault('title', ep_title)
                        restaurant['episode_info'].setdefault('analysis_date', ep_analysis_date)

                restaurants.append(restaurant)

            return restaurants

    def search_restaurants(
        self,
        location: str = None,
        cuisine: str = None,
        price_range: str = None,
        status: str = None,
        host_opinion: str = None,
        date_start: str = None,
        date_end: str = None,
        episode_id: str = None,
        sort_by: str = 'published_at',
        sort_direction: str = 'desc',
        page: int = 1,
        limit: int = 20
    ) -> Dict:
        """Search restaurants with filtering, sorting, and pagination.

        Returns:
            Dict with restaurants, pagination info, and analytics
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Build WHERE clause
            conditions = []
            params = []

            if location:
                conditions.append("r.city LIKE ?")
                params.append(f"%{location}%")

            if cuisine:
                conditions.append("r.cuisine_type LIKE ?")
                params.append(f"%{cuisine}%")

            if price_range:
                conditions.append("r.price_range = ?")
                params.append(price_range)

            if status:
                conditions.append("r.status = ?")
                params.append(status)

            if host_opinion:
                conditions.append("r.host_opinion = ?")
                params.append(host_opinion)

            if episode_id:
                conditions.append("e.video_id = ?")
                params.append(episode_id)

            if date_start:
                conditions.append("COALESCE(r.published_at, e.published_at, e.analysis_date) >= ?")
                params.append(date_start)

            if date_end:
                conditions.append("COALESCE(r.published_at, e.published_at, e.analysis_date) <= ?")
                params.append(date_end)

            where_clause = " AND ".join(conditions) if conditions else "1=1"

            # Count total matching records
            count_query = f'''
                SELECT COUNT(*) as total
                FROM restaurants r
                LEFT JOIN episodes e ON r.episode_id = e.id
                WHERE {where_clause}
            '''
            cursor.execute(count_query, params)
            total_count = cursor.fetchone()['total']

            # Get analytics on filtered set
            analytics_query = f'''
                SELECT
                    r.cuisine_type,
                    r.city,
                    r.price_range,
                    r.host_opinion,
                    DATE(COALESCE(r.published_at, e.published_at, e.analysis_date)) as analysis_day
                FROM restaurants r
                LEFT JOIN episodes e ON r.episode_id = e.id
                WHERE {where_clause}
            '''
            cursor.execute(analytics_query, params)

            filter_counts = {
                'cuisine': {},
                'location': {},
                'price_range': {},
                'host_opinion': {}
            }
            date_distribution = {}

            for row in cursor.fetchall():
                if row['cuisine_type']:
                    filter_counts['cuisine'][row['cuisine_type']] = \
                        filter_counts['cuisine'].get(row['cuisine_type'], 0) + 1
                if row['city']:
                    filter_counts['location'][row['city']] = \
                        filter_counts['location'].get(row['city'], 0) + 1
                if row['price_range']:
                    filter_counts['price_range'][row['price_range']] = \
                        filter_counts['price_range'].get(row['price_range'], 0) + 1
                if row['host_opinion']:
                    filter_counts['host_opinion'][row['host_opinion']] = \
                        filter_counts['host_opinion'].get(row['host_opinion'], 0) + 1
                if row['analysis_day']:
                    date_distribution[row['analysis_day']] = \
                        date_distribution.get(row['analysis_day'], 0) + 1

            # Build sort clause
            sort_column = {
                'name': 'r.name_hebrew',
                'location': 'r.city',
                'cuisine': 'r.cuisine_type',
                'rating': 'r.google_rating',
                'analysis_date': 'e.analysis_date',
                'published_at': 'COALESCE(r.published_at, e.published_at, e.analysis_date)'
            }.get(sort_by, 'COALESCE(r.published_at, e.published_at, e.analysis_date)')

            sort_dir = 'DESC' if sort_direction.lower() == 'desc' else 'ASC'

            # Get paginated results
            offset = (page - 1) * limit
            query = f'''
                SELECT r.*, e.video_id, e.video_url, e.channel_name,
                       e.title as episode_title, e.analysis_date,
                       e.published_at as episode_published_at
                FROM restaurants r
                LEFT JOIN episodes e ON r.episode_id = e.id
                WHERE {where_clause}
                ORDER BY {sort_column} {sort_dir}
                LIMIT ? OFFSET ?
            '''
            cursor.execute(query, params + [limit, offset])

            restaurants = []
            for row in cursor.fetchall():
                restaurant = self._row_to_restaurant(row)
                restaurant['episode_info'] = {
                    'video_id': restaurant.pop('video_id', None),
                    'video_url': restaurant.pop('video_url', None),
                    'channel_name': restaurant.pop('channel_name', None),
                    'title': restaurant.pop('episode_title', None),
                    'analysis_date': restaurant.pop('analysis_date', None),
                    'published_at': restaurant.pop('episode_published_at', None)
                }
                restaurants.append(restaurant)

            return {
                'restaurants': restaurants,
                'analytics': {
                    'total_count': total_count,
                    'page': page,
                    'limit': limit,
                    'total_pages': (total_count + limit - 1) // limit,
                    'filter_counts': filter_counts,
                    'date_distribution': date_distribution
                }
            }

    def update_restaurant(self, restaurant_id: str, **kwargs) -> bool:
        """Update a restaurant record."""
        if not kwargs:
            return False

        # Handle nested structures
        if 'location' in kwargs:
            loc = kwargs.pop('location')
            kwargs.update({
                'city': loc.get('city'),
                'neighborhood': loc.get('neighborhood'),
                'address': loc.get('address') or loc.get('full_address'),
                'region': loc.get('region'),
            })
            # Flatten coordinates from nested location
            coords = loc.get('coordinates', {})
            if coords:
                kwargs['latitude'] = coords.get('latitude')
                kwargs['longitude'] = coords.get('longitude')

        if 'contact_info' in kwargs:
            contact = kwargs.pop('contact_info')
            kwargs.update({
                'contact_hours': contact.get('hours'),
                'contact_phone': contact.get('phone'),
                'contact_website': contact.get('website')
            })

        if 'rating' in kwargs:
            rating = kwargs.pop('rating')
            kwargs.update({
                'google_rating': rating.get('google_rating'),
                'google_user_ratings_total': rating.get('user_ratings_total')
            })

        if 'google_places' in kwargs:
            gp = kwargs.pop('google_places')
            if gp:
                kwargs['google_place_id'] = gp.get('place_id')
                if gp.get('google_name'):
                    kwargs['google_name'] = gp['google_name']

        # Handle JSON fields
        if 'menu_items' in kwargs:
            kwargs['menu_items'] = json.dumps(kwargs['menu_items'])
        if 'special_features' in kwargs:
            kwargs['special_features'] = json.dumps(kwargs['special_features'])
        if 'photos' in kwargs:
            kwargs['photos'] = json.dumps(kwargs['photos'])

        # Build UPDATE query
        set_clause = ', '.join(f"{k} = ?" for k in kwargs.keys())
        kwargs['updated_at'] = datetime.now().isoformat()
        set_clause += ', updated_at = ?'

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f'UPDATE restaurants SET {set_clause} WHERE id = ?',
                list(kwargs.values()) + [restaurant_id]
            )
            return cursor.rowcount > 0

    def delete_restaurant(self, restaurant_id: str) -> bool:
        """Delete a restaurant record."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM restaurants WHERE id = ?', (restaurant_id,))
            return cursor.rowcount > 0

    def log_restaurant_edit(
        self,
        restaurant_id: str,
        restaurant_name: str,
        admin_user_id: str,
        edit_type: str,
        changes: str = None
    ) -> str:
        """Log a restaurant edit action.

        Args:
            restaurant_id: ID of the restaurant
            restaurant_name: Name of the restaurant
            admin_user_id: ID of the admin user making the edit
            edit_type: Type of edit ('create', 'update', 'delete', 'approve', 'reject')
            changes: JSON string of changes made

        Returns:
            Edit log ID
        """
        log_id = str(uuid.uuid4())

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO restaurant_edits (
                    id, restaurant_id, restaurant_name, admin_user_id,
                    edit_type, changes
                ) VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                log_id,
                restaurant_id,
                restaurant_name,
                admin_user_id,
                edit_type,
                changes
            ))

            return log_id

    def get_restaurant_edit_history(
        self,
        restaurant_id: str = None,
        admin_user_id: str = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get restaurant edit history.

        Args:
            restaurant_id: Filter by restaurant ID
            admin_user_id: Filter by admin user ID
            limit: Maximum number of records to return

        Returns:
            List of edit history records
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            if restaurant_id:
                cursor.execute('''
                    SELECT e.*, u.name as admin_name, u.email as admin_email
                    FROM restaurant_edits e
                    LEFT JOIN admin_users u ON e.admin_user_id = u.id
                    WHERE e.restaurant_id = ?
                    ORDER BY e.timestamp DESC
                    LIMIT ?
                ''', (restaurant_id, limit))
            elif admin_user_id:
                cursor.execute('''
                    SELECT e.*, u.name as admin_name, u.email as admin_email
                    FROM restaurant_edits e
                    LEFT JOIN admin_users u ON e.admin_user_id = u.id
                    WHERE e.admin_user_id = ?
                    ORDER BY e.timestamp DESC
                    LIMIT ?
                ''', (admin_user_id, limit))
            else:
                cursor.execute('''
                    SELECT e.*, u.name as admin_name, u.email as admin_email
                    FROM restaurant_edits e
                    LEFT JOIN admin_users u ON e.admin_user_id = u.id
                    ORDER BY e.timestamp DESC
                    LIMIT ?
                ''', (limit,))

            return [dict(row) for row in cursor.fetchall()]

    # ==================== Job Operations ====================

    def create_job(self, job_type: str, **kwargs) -> str:
        """Create a new processing job.

        Args:
            job_type: Type of job ('video', 'channel', 'batch')
            **kwargs: Additional job fields

        Returns:
            Job ID
        """
        job_id = str(uuid.uuid4())

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO jobs (
                    id, job_type, status, channel_url, video_url,
                    filters, processing_options, started_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                job_id,
                job_type,
                'pending',
                kwargs.get('channel_url'),
                kwargs.get('video_url'),
                json.dumps(kwargs.get('filters', {})),
                json.dumps(kwargs.get('processing_options', {})),
                datetime.now().isoformat()
            ))

            return job_id

    def update_job_status(self, job_id: str, status: str, **kwargs) -> bool:
        """Update job status and progress."""
        updates = {'status': status}
        updates.update(kwargs)

        if status in ('completed', 'failed', 'cancelled'):
            updates['completed_at'] = datetime.now().isoformat()

        set_clause = ', '.join(f"{k} = ?" for k in updates.keys())

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f'UPDATE jobs SET {set_clause} WHERE id = ?',
                list(updates.values()) + [job_id]
            )
            return cursor.rowcount > 0

    def update_job_progress(
        self,
        job_id: str,
        videos_completed: int = None,
        videos_total: int = None,
        videos_failed: int = None,
        restaurants_found: int = None,
        current_video_id: str = None,
        current_video_title: str = None,
        current_step: str = None
    ) -> bool:
        """Update job progress."""
        updates = {}
        if videos_completed is not None:
            updates['progress_videos_completed'] = videos_completed
        if videos_total is not None:
            updates['progress_videos_total'] = videos_total
        if videos_failed is not None:
            updates['progress_videos_failed'] = videos_failed
        if restaurants_found is not None:
            updates['progress_restaurants_found'] = restaurants_found
        if current_video_id is not None:
            updates['current_video_id'] = current_video_id
        if current_video_title is not None:
            updates['current_video_title'] = current_video_title
        if current_step is not None:
            updates['current_step'] = current_step

        if not updates:
            return False

        set_clause = ', '.join(f"{k} = ?" for k in updates.keys())

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f'UPDATE jobs SET {set_clause} WHERE id = ?',
                list(updates.values()) + [job_id]
            )
            return cursor.rowcount > 0

    def get_job(self, job_id: str) -> Optional[Dict]:
        """Get job by ID."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM jobs WHERE id = ?', (job_id,))
            row = cursor.fetchone()
            if row:
                job = dict(row)
                job['filters'] = json.loads(job.get('filters') or '{}')
                job['processing_options'] = json.loads(job.get('processing_options') or '{}')
                return job
            return None

    def get_jobs(self, status: str = None) -> List[Dict]:
        """Get jobs with optional status filter."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if status:
                cursor.execute(
                    'SELECT * FROM jobs WHERE status = ? ORDER BY created_at DESC',
                    (status,)
                )
            else:
                cursor.execute('SELECT * FROM jobs ORDER BY created_at DESC')

            jobs = []
            for row in cursor.fetchall():
                job = dict(row)
                job['filters'] = json.loads(job.get('filters') or '{}')
                job['processing_options'] = json.loads(job.get('processing_options') or '{}')
                jobs.append(job)

            return jobs

    # ==================== Utility Operations ====================

    def get_stats(self) -> Dict:
        """Get database statistics."""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute('SELECT COUNT(*) as count FROM restaurants')
            restaurant_count = cursor.fetchone()['count']

            cursor.execute('SELECT COUNT(*) as count FROM episodes')
            episode_count = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(*) as count FROM jobs WHERE status = 'processing'")
            active_jobs = cursor.fetchone()['count']

            cursor.execute('SELECT COUNT(DISTINCT city) as count FROM restaurants WHERE city IS NOT NULL')
            unique_cities = cursor.fetchone()['count']

            cursor.execute('SELECT COUNT(DISTINCT cuisine_type) as count FROM restaurants WHERE cuisine_type IS NOT NULL')
            unique_cuisines = cursor.fetchone()['count']

            return {
                'restaurants': restaurant_count,
                'episodes': episode_count,
                'active_jobs': active_jobs,
                'unique_cities': unique_cities,
                'unique_cuisines': unique_cuisines
            }

    def import_from_json_files(self, data_dir: str) -> Dict:
        """Import restaurant data from existing JSON files.

        Args:
            data_dir: Directory containing restaurant JSON files

        Returns:
            Import statistics
        """
        imported = 0
        failed = 0
        errors = []

        if not os.path.exists(data_dir):
            return {'imported': 0, 'failed': 0, 'errors': ['Directory not found']}

        for filename in os.listdir(data_dir):
            if not filename.endswith('.json'):
                continue

            try:
                filepath = os.path.join(data_dir, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                # Create episode if episode_info exists
                episode_id = None
                if 'episode_info' in data:
                    ep_info = data['episode_info']
                    if ep_info.get('video_id'):
                        episode_id = self.create_episode(
                            video_id=ep_info.get('video_id'),
                            video_url=ep_info.get('video_url', ''),
                            channel_name=ep_info.get('channel_name'),
                            title=ep_info.get('title'),
                            language=ep_info.get('language', 'he'),
                            analysis_date=ep_info.get('analysis_date')
                        )

                # Create restaurant - extract name_hebrew to avoid duplicate argument
                name_hebrew = data.pop('name_hebrew', 'Unknown')
                self.create_restaurant(
                    name_hebrew=name_hebrew,
                    episode_id=episode_id,
                    **data
                )
                imported += 1

            except Exception as e:
                failed += 1
                errors.append(f"{filename}: {str(e)}")

        return {
            'imported': imported,
            'failed': failed,
            'errors': errors[:10]  # Limit error messages
        }

    # ==================== Article Operations ====================

    def create_article(self, title: str, slug: str, content: str, author_id: str, **kwargs) -> str:
        """Create a new article.

        Args:
            title: Article title
            slug: URL-friendly slug
            content: Article HTML content
            author_id: ID of the admin user creating the article
            **kwargs: Additional article fields (excerpt, status, category, tags, seo fields, etc.)

        Returns:
            str: Article ID
        """
        article_id = str(uuid.uuid4())

        fields = {
            'id': article_id,
            'title': title,
            'slug': slug,
            'content': content,
            'author_id': author_id,
            'excerpt': kwargs.get('excerpt', ''),
            'featured_image': kwargs.get('featured_image'),
            'status': kwargs.get('status', 'draft'),
            'category': kwargs.get('category'),
            'tags': json.dumps(kwargs.get('tags', [])) if isinstance(kwargs.get('tags'), list) else kwargs.get('tags'),
            'seo_title': kwargs.get('seo_title'),
            'seo_description': kwargs.get('seo_description'),
            'seo_keywords': kwargs.get('seo_keywords'),
            'published_at': kwargs.get('published_at'),
            'scheduled_for': kwargs.get('scheduled_for'),
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }

        with self.get_connection() as conn:
            cursor = conn.cursor()
            columns = ', '.join(fields.keys())
            placeholders = ', '.join(['?' for _ in fields])
            cursor.execute(
                f'INSERT INTO articles ({columns}) VALUES ({placeholders})',
                list(fields.values())
            )

        return article_id

    def get_article(self, article_id: str = None, slug: str = None) -> Optional[Dict]:
        """Get article by ID or slug."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if article_id:
                cursor.execute('SELECT * FROM articles WHERE id = ?', (article_id,))
            elif slug:
                cursor.execute('SELECT * FROM articles WHERE slug = ?', (slug,))
            else:
                return None

            row = cursor.fetchone()
            if row:
                article = dict(row)
                if article.get('tags'):
                    try:
                        article['tags'] = json.loads(article['tags'])
                    except:
                        article['tags'] = []
                return article
            return None

    def list_articles(self, status: str = None, author_id: str = None,
                     limit: int = 50, offset: int = 0, order_by: str = 'created_at DESC') -> List[Dict]:
        """List articles with optional filtering."""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            query = 'SELECT * FROM articles WHERE 1=1'
            params = []

            if status:
                query += ' AND status = ?'
                params.append(status)

            if author_id:
                query += ' AND author_id = ?'
                params.append(author_id)

            query += f' ORDER BY {order_by} LIMIT ? OFFSET ?'
            params.extend([limit, offset])

            cursor.execute(query, params)
            articles = [dict(row) for row in cursor.fetchall()]

            # Parse tags JSON
            for article in articles:
                if article.get('tags'):
                    try:
                        article['tags'] = json.loads(article['tags'])
                    except:
                        article['tags'] = []

            return articles

    def update_article(self, article_id: str, **kwargs) -> bool:
        """Update an article."""
        if not kwargs:
            return False

        kwargs['updated_at'] = datetime.now().isoformat()

        # Convert tags list to JSON string if needed
        if 'tags' in kwargs and isinstance(kwargs['tags'], list):
            kwargs['tags'] = json.dumps(kwargs['tags'])

        with self.get_connection() as conn:
            cursor = conn.cursor()
            set_clause = ', '.join([f'{key} = ?' for key in kwargs.keys()])
            cursor.execute(
                f'UPDATE articles SET {set_clause} WHERE id = ?',
                list(kwargs.values()) + [article_id]
            )
            return cursor.rowcount > 0

    def delete_article(self, article_id: str) -> bool:
        """Delete an article."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM articles WHERE id = ?', (article_id,))
            return cursor.rowcount > 0

    def count_articles(self, status: str = None) -> int:
        """Count articles with optional status filter."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if status:
                cursor.execute('SELECT COUNT(*) FROM articles WHERE status = ?', (status,))
            else:
                cursor.execute('SELECT COUNT(*) FROM articles')
            return cursor.fetchone()[0]

    # ==================== Error Logging Operations ====================

    @property
    def conn(self):
        """Get a connection for direct queries (used by backend_service)."""
        return sqlite3.connect(self.db_path)

    def log_error(
        self,
        service: str,
        level: str,
        message: str,
        stack_trace: str = None,
        context: Dict = None,
        job_id: str = None,
        video_id: str = None
    ) -> str:
        """Log an error to the database.

        If an identical error (same service + message) exists and is unresolved,
        increment its occurrence count instead of creating a new entry.

        Args:
            service: Service name (youtube, google_places, claude, openai, database, etc.)
            level: Error level (critical, warning, info, debug)
            message: Error message
            stack_trace: Optional stack trace
            context: Optional context dict
            job_id: Optional related job ID
            video_id: Optional related video ID

        Returns:
            Error ID
        """
        import hashlib

        # Create a hash of service + message for deduplication
        error_hash = hashlib.md5(f"{service}:{message}".encode()).hexdigest()[:16]
        error_id = f"err_{error_hash}"

        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Check if this error already exists and is unresolved
            cursor.execute('''
                SELECT id, occurrence_count FROM error_logs
                WHERE error_id = ? AND resolved = 0
            ''', (error_id,))
            existing = cursor.fetchone()

            if existing:
                # Update existing error
                cursor.execute('''
                    UPDATE error_logs SET
                        occurrence_count = occurrence_count + 1,
                        last_occurred = CURRENT_TIMESTAMP,
                        stack_trace = COALESCE(?, stack_trace),
                        context = COALESCE(?, context),
                        job_id = COALESCE(?, job_id),
                        video_id = COALESCE(?, video_id)
                    WHERE id = ?
                ''', (
                    stack_trace,
                    json.dumps(context) if context else None,
                    job_id,
                    video_id,
                    existing['id']
                ))
                return error_id
            else:
                # Create new error entry
                log_id = str(uuid.uuid4())
                cursor.execute('''
                    INSERT INTO error_logs (
                        id, error_id, level, service, message, stack_trace,
                        context, job_id, video_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    log_id,
                    error_id,
                    level,
                    service,
                    message,
                    stack_trace,
                    json.dumps(context) if context else None,
                    job_id,
                    video_id
                ))
                return error_id

    def get_errors(
        self,
        level: str = None,
        service: str = None,
        resolved: bool = None,
        limit: int = 100,
        offset: int = 0
    ) -> Dict:
        """Get error logs with filters.

        Args:
            level: Filter by level (critical, warning, info, debug)
            service: Filter by service name
            resolved: Filter by resolved status (True/False/None for all)
            limit: Max results
            offset: Pagination offset

        Returns:
            Dict with errors, pagination info, and counts
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Build WHERE clause
            conditions = []
            params = []

            if level:
                conditions.append("level = ?")
                params.append(level)

            if service:
                conditions.append("service = ?")
                params.append(service)

            if resolved is not None:
                conditions.append("resolved = ?")
                params.append(1 if resolved else 0)

            where_clause = " AND ".join(conditions) if conditions else "1=1"

            # Count total
            cursor.execute(f'SELECT COUNT(*) as total FROM error_logs WHERE {where_clause}', params)
            total = cursor.fetchone()['total']

            # Get errors
            cursor.execute(f'''
                SELECT e.*, u.name as resolved_by_name
                FROM error_logs e
                LEFT JOIN admin_users u ON e.resolved_by = u.id
                WHERE {where_clause}
                ORDER BY e.last_occurred DESC
                LIMIT ? OFFSET ?
            ''', params + [limit, offset])

            errors = []
            for row in cursor.fetchall():
                error = dict(row)
                if error.get('context'):
                    try:
                        error['context'] = json.loads(error['context'])
                    except:
                        pass
                error['resolved'] = bool(error['resolved'])
                errors.append(error)

            return {
                'errors': errors,
                'total': total,
                'limit': limit,
                'offset': offset,
                'total_pages': (total + limit - 1) // limit if limit > 0 else 1
            }

    def resolve_error(self, error_id: str, admin_user_id: str = None, notes: str = None) -> bool:
        """Mark an error as resolved.

        Args:
            error_id: Error ID to resolve
            admin_user_id: ID of admin resolving the error
            notes: Optional resolution notes

        Returns:
            True if successful
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE error_logs SET
                    resolved = 1,
                    resolved_at = CURRENT_TIMESTAMP,
                    resolved_by = ?,
                    resolution_notes = ?
                WHERE error_id = ?
            ''', (admin_user_id, notes, error_id))
            return cursor.rowcount > 0

    def get_error_summary(self, hours: int = 24) -> Dict:
        """Get error summary statistics.

        Args:
            hours: Number of hours to look back

        Returns:
            Dict with error counts by level and service
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Calculate time threshold
            cursor.execute(f'''
                SELECT datetime('now', '-{hours} hours') as threshold
            ''')
            threshold = cursor.fetchone()['threshold']

            # Get counts by level
            cursor.execute('''
                SELECT level, COUNT(*) as count, SUM(occurrence_count) as total_occurrences
                FROM error_logs
                WHERE first_occurred >= ? OR last_occurred >= ?
                GROUP BY level
            ''', (threshold, threshold))
            by_level = {row['level']: {'count': row['count'], 'occurrences': row['total_occurrences']}
                       for row in cursor.fetchall()}

            # Get counts by service
            cursor.execute('''
                SELECT service, COUNT(*) as count, SUM(occurrence_count) as total_occurrences
                FROM error_logs
                WHERE first_occurred >= ? OR last_occurred >= ?
                GROUP BY service
            ''', (threshold, threshold))
            by_service = {row['service']: {'count': row['count'], 'occurrences': row['total_occurrences']}
                         for row in cursor.fetchall()}

            # Get unresolved count
            cursor.execute('''
                SELECT COUNT(*) as count FROM error_logs WHERE resolved = 0
            ''')
            unresolved = cursor.fetchone()['count']

            # Get total in period
            cursor.execute('''
                SELECT COUNT(*) as count, SUM(occurrence_count) as total_occurrences
                FROM error_logs
                WHERE first_occurred >= ? OR last_occurred >= ?
            ''', (threshold, threshold))
            totals = cursor.fetchone()

            return {
                'period_hours': hours,
                'total_errors': totals['count'] or 0,
                'total_occurrences': totals['total_occurrences'] or 0,
                'unresolved': unresolved,
                'by_level': by_level,
                'by_service': by_service
            }

    def clear_resolved_errors(self, older_than_days: int = 30) -> int:
        """Delete resolved errors older than specified days.

        Args:
            older_than_days: Delete resolved errors older than this many days

        Returns:
            Number of deleted records
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f'''
                DELETE FROM error_logs
                WHERE resolved = 1
                AND resolved_at < datetime('now', '-{older_than_days} days')
            ''')
            return cursor.rowcount

    # ==================== Connection Test History ====================

    def log_connection_test(
        self,
        service: str,
        status: str,
        response_time_ms: int,
        error_message: str = None,
        details: Dict = None,
        tested_by: str = None
    ) -> str:
        """Log a connection test result.

        Args:
            service: Service name
            status: Test status (healthy, degraded, error, unavailable, timeout)
            response_time_ms: Response time in milliseconds
            error_message: Optional error message
            details: Optional details dict
            tested_by: Optional admin user ID

        Returns:
            Test log ID
        """
        log_id = str(uuid.uuid4())

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO connection_tests (
                    id, service, status, response_time_ms, error_message, details, tested_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                log_id,
                service,
                status,
                response_time_ms,
                error_message,
                json.dumps(details) if details else None,
                tested_by
            ))

            return log_id

    def get_connection_history(
        self,
        service: str = None,
        limit: int = 100,
        hours: int = 24
    ) -> List[Dict]:
        """Get connection test history.

        Args:
            service: Filter by service name
            limit: Max results
            hours: Look back hours

        Returns:
            List of connection test records
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            if service:
                cursor.execute('''
                    SELECT * FROM connection_tests
                    WHERE service = ? AND tested_at >= datetime('now', '-' || ? || ' hours')
                    ORDER BY tested_at DESC
                    LIMIT ?
                ''', (service, hours, limit))
            else:
                cursor.execute('''
                    SELECT * FROM connection_tests
                    WHERE tested_at >= datetime('now', '-' || ? || ' hours')
                    ORDER BY tested_at DESC
                    LIMIT ?
                ''', (hours, limit))

            tests = []
            for row in cursor.fetchall():
                test = dict(row)
                if test.get('details'):
                    try:
                        test['details'] = json.loads(test['details'])
                    except:
                        pass
                tests.append(test)

            return tests

    # ==================== System Metrics ====================

    def log_metric(
        self,
        metric_type: str,
        metric_name: str,
        metric_value: float,
        metadata: Dict = None
    ) -> str:
        """Log a system metric.

        Args:
            metric_type: Type of metric (response_time, memory, db_size, etc.)
            metric_name: Name of the metric
            metric_value: Numeric value
            metadata: Optional metadata dict

        Returns:
            Metric log ID
        """
        log_id = str(uuid.uuid4())

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO system_metrics (id, metric_type, metric_name, metric_value, metadata)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                log_id,
                metric_type,
                metric_name,
                metric_value,
                json.dumps(metadata) if metadata else None
            ))

            return log_id

    def get_metrics(
        self,
        metric_type: str = None,
        metric_name: str = None,
        hours: int = 24,
        limit: int = 1000
    ) -> List[Dict]:
        """Get system metrics.

        Args:
            metric_type: Filter by type
            metric_name: Filter by name
            hours: Look back hours
            limit: Max results

        Returns:
            List of metric records
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            conditions = ["timestamp >= datetime('now', '-' || ? || ' hours')"]
            params = [hours]

            if metric_type:
                conditions.append("metric_type = ?")
                params.append(metric_type)

            if metric_name:
                conditions.append("metric_name = ?")
                params.append(metric_name)

            where_clause = " AND ".join(conditions)
            params.append(limit)

            cursor.execute(f'''
                SELECT * FROM system_metrics
                WHERE {where_clause}
                ORDER BY timestamp DESC
                LIMIT ?
            ''', params)

            metrics = []
            for row in cursor.fetchall():
                metric = dict(row)
                if metric.get('metadata'):
                    try:
                        metric['metadata'] = json.loads(metric['metadata'])
                    except:
                        pass
                metrics.append(metric)

            return metrics

    # ==================== Monitored Channels ====================

    def create_monitored_channel(self, channel_id, channel_url, channel_name=None,
                                playlist_id=None, playlist_url=None, poll_interval_minutes=360):
        """Create a new monitored channel."""
        mc_id = str(uuid.uuid4())
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO monitored_channels (id, channel_id, channel_url, channel_name,
                    playlist_id, playlist_url, poll_interval_minutes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (mc_id, channel_id, channel_url, channel_name, playlist_id, playlist_url, poll_interval_minutes))
        return mc_id

    def get_monitored_channel(self, mc_id):
        """Get a monitored channel by ID."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM monitored_channels WHERE id = ?', (mc_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_monitored_channel_by_channel_id(self, channel_id):
        """Get a monitored channel by YouTube channel ID."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM monitored_channels WHERE channel_id = ?', (channel_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def list_monitored_channels(self, enabled_only=False):
        """List all monitored channels."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if enabled_only:
                cursor.execute('SELECT * FROM monitored_channels WHERE enabled = 1 ORDER BY created_at DESC')
            else:
                cursor.execute('SELECT * FROM monitored_channels ORDER BY created_at DESC')
            return [dict(row) for row in cursor.fetchall()]

    def update_monitored_channel(self, mc_id, **kwargs):
        """Update a monitored channel."""
        allowed = {'channel_name', 'playlist_id', 'playlist_url', 'enabled',
                   'poll_interval_minutes', 'last_polled_at', 'last_video_found_at', 'total_videos_found'}
        updates = {k: v for k, v in kwargs.items() if k in allowed}
        if not updates:
            return False
        updates['updated_at'] = datetime.now().isoformat()
        set_clause = ', '.join(f'{k} = ?' for k in updates.keys())
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f'UPDATE monitored_channels SET {set_clause} WHERE id = ?',
                          (*updates.values(), mc_id))
            return cursor.rowcount > 0

    def delete_monitored_channel(self, mc_id):
        """Delete a monitored channel."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM monitored_channels WHERE id = ?', (mc_id,))
            return cursor.rowcount > 0

    def get_channels_due_for_polling(self):
        """Get channels that are due for polling based on their interval."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM monitored_channels
                WHERE enabled = 1
                AND (last_polled_at IS NULL
                     OR datetime(last_polled_at, '+' || poll_interval_minutes || ' minutes') <= datetime('now'))
                ORDER BY last_polled_at ASC NULLS FIRST
            ''')
            return [dict(row) for row in cursor.fetchall()]

    def update_channel_poll_result(self, mc_id, videos_found_count=0):
        """Update channel after a poll."""
        now = datetime.now().isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if videos_found_count > 0:
                cursor.execute('''
                    UPDATE monitored_channels
                    SET last_polled_at = ?, last_video_found_at = ?,
                        total_videos_found = total_videos_found + ?, updated_at = ?
                    WHERE id = ?
                ''', (now, now, videos_found_count, now, mc_id))
            else:
                cursor.execute('''
                    UPDATE monitored_channels
                    SET last_polled_at = ?, updated_at = ?
                    WHERE id = ?
                ''', (now, now, mc_id))
            return cursor.rowcount > 0

    # ==================== Queue Helpers ====================

    def get_pending_job(self):
        """Get the oldest pending job."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM jobs WHERE status = 'pending'
                ORDER BY created_at ASC LIMIT 1
            ''')
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_queue_stats(self):
        """Get job queue statistics."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT status, COUNT(*) as count FROM jobs GROUP BY status
            ''')
            stats = {'pending': 0, 'processing': 0, 'completed': 0, 'failed': 0}
            for row in cursor.fetchall():
                stats[row['status']] = row['count']
            stats['total'] = sum(stats.values())
            return stats



# Singleton instance for convenience
_db_instance = None

def get_database(db_path: str = None) -> Database:
    """Get or create database instance."""
    global _db_instance
    if _db_instance is None or db_path:
        _db_instance = Database(db_path)
    return _db_instance
