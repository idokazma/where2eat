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
        """
        if db_path is None:
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

            # Create indexes for common queries
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_restaurants_city ON restaurants(city)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine ON restaurants(cuisine_type)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_restaurants_episode ON restaurants(episode_id)')
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
                    title, language, analysis_date, transcript, food_trends, episode_summary)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(video_id) DO UPDATE SET
                    video_url = excluded.video_url,
                    channel_id = COALESCE(excluded.channel_id, episodes.channel_id),
                    channel_name = COALESCE(excluded.channel_name, episodes.channel_name),
                    title = COALESCE(excluded.title, episodes.title),
                    language = COALESCE(excluded.language, episodes.language),
                    analysis_date = COALESCE(excluded.analysis_date, episodes.analysis_date),
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

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO restaurants (
                    id, episode_id, name_hebrew, name_english, city, neighborhood,
                    address, region, cuisine_type, status, price_range, host_opinion,
                    host_comments, menu_items, special_features, contact_hours,
                    contact_phone, contact_website, business_news, mention_context,
                    mention_timestamp, google_place_id, google_rating,
                    google_user_ratings_total, latitude, longitude, image_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                kwargs.get('mention_timestamp'),
                kwargs.get('google_place_id'),
                google_rating,
                google_user_ratings_total,
                kwargs.get('latitude'),
                kwargs.get('longitude'),
                kwargs.get('image_url')
            ))

            return restaurant_id

    def get_restaurant(self, restaurant_id: str) -> Optional[Dict]:
        """Get restaurant by ID."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM restaurants WHERE id = ?', (restaurant_id,))
            row = cursor.fetchone()
            if row:
                return self._row_to_restaurant(row)
            return None

    def _row_to_restaurant(self, row: sqlite3.Row) -> Dict:
        """Convert database row to restaurant dict with nested structures."""
        restaurant = dict(row)

        # Reconstruct nested location
        restaurant['location'] = {
            'city': restaurant.pop('city', None),
            'neighborhood': restaurant.pop('neighborhood', None),
            'address': restaurant.pop('address', None),
            'region': restaurant.pop('region', 'Center')
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

        # Parse JSON fields
        restaurant['menu_items'] = json.loads(restaurant.get('menu_items') or '[]')
        restaurant['special_features'] = json.loads(restaurant.get('special_features') or '[]')

        return restaurant

    def get_all_restaurants(self, include_episode_info: bool = True) -> List[Dict]:
        """Get all restaurants with optional episode info."""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            if include_episode_info:
                cursor.execute('''
                    SELECT r.*, e.video_id, e.video_url, e.channel_name, e.title as episode_title,
                           e.analysis_date, e.food_trends as episode_food_trends
                    FROM restaurants r
                    LEFT JOIN episodes e ON r.episode_id = e.id
                    ORDER BY r.created_at DESC
                ''')
            else:
                cursor.execute('SELECT * FROM restaurants ORDER BY created_at DESC')

            restaurants = []
            for row in cursor.fetchall():
                restaurant = self._row_to_restaurant(row)

                if include_episode_info and 'video_id' in restaurant:
                    restaurant['episode_info'] = {
                        'video_id': restaurant.pop('video_id', None),
                        'video_url': restaurant.pop('video_url', None),
                        'channel_name': restaurant.pop('channel_name', None),
                        'title': restaurant.pop('episode_title', None),
                        'analysis_date': restaurant.pop('analysis_date', None)
                    }
                    restaurant.pop('episode_food_trends', None)

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
        sort_by: str = 'analysis_date',
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
                conditions.append("e.analysis_date >= ?")
                params.append(date_start)

            if date_end:
                conditions.append("e.analysis_date <= ?")
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
                    DATE(e.analysis_date) as analysis_day
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
                'analysis_date': 'e.analysis_date'
            }.get(sort_by, 'e.analysis_date')

            sort_dir = 'DESC' if sort_direction.lower() == 'desc' else 'ASC'

            # Get paginated results
            offset = (page - 1) * limit
            query = f'''
                SELECT r.*, e.video_id, e.video_url, e.channel_name,
                       e.title as episode_title, e.analysis_date
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
                    'analysis_date': restaurant.pop('analysis_date', None)
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
                'address': loc.get('address'),
                'region': loc.get('region')
            })

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

        # Handle JSON fields
        if 'menu_items' in kwargs:
            kwargs['menu_items'] = json.dumps(kwargs['menu_items'])
        if 'special_features' in kwargs:
            kwargs['special_features'] = json.dumps(kwargs['special_features'])

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


# Singleton instance for convenience
_db_instance = None

def get_database(db_path: str = None) -> Database:
    """Get or create database instance."""
    global _db_instance
    if _db_instance is None or db_path:
        _db_instance = Database(db_path)
    return _db_instance
