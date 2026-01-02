"""
Backend service layer for Where2Eat.
Provides a clean API for all backend operations:
- YouTube transcript collection
- Restaurant extraction/analysis
- Data persistence
- Job management

This service is the single source of truth for backend operations.
The Express API should call these functions, and they can also be
tested independently from the frontend.
"""

import os
import sys
from datetime import datetime
from typing import Dict, List, Optional, Any, Callable
import json
import re

# Add project paths
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'src'))
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'scripts'))

from database import Database, get_database


class BackendService:
    """
    Main backend service providing all core functionalities.

    This class is the single entry point for all backend operations.
    It coordinates between:
    - YouTube transcript collection
    - LLM-based restaurant extraction
    - Database persistence
    - Job management
    """

    def __init__(self, db: Database = None, db_path: str = None):
        """Initialize backend service.

        Args:
            db: Optional Database instance (for testing)
            db_path: Optional database path
        """
        self.db = db or get_database(db_path)
        self._transcript_collector = None
        self._analyzer = None

    # ==================== Transcript Collection ====================

    def _get_transcript_collector(self):
        """Lazy load transcript collector."""
        if self._transcript_collector is None:
            try:
                from youtube_transcript_collector import YouTubeTranscriptCollector
                self._transcript_collector = YouTubeTranscriptCollector()
            except ImportError:
                raise ImportError("YouTubeTranscriptCollector not available")
        return self._transcript_collector

    def extract_video_id(self, url: str) -> Optional[str]:
        """Extract video ID from YouTube URL.

        Args:
            url: YouTube URL

        Returns:
            Video ID or None if invalid
        """
        patterns = [
            r'(?:v=|/v/|youtu\.be/)([a-zA-Z0-9_-]{11})',
            r'^([a-zA-Z0-9_-]{11})$'  # Direct video ID
        ]

        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)

        return None

    def fetch_transcript(self, video_url: str, language: str = 'he') -> Dict:
        """Fetch transcript for a YouTube video.

        Args:
            video_url: YouTube video URL
            language: Preferred language code (default: 'he')

        Returns:
            Dict with transcript data or error
        """
        video_id = self.extract_video_id(video_url)
        if not video_id:
            return {
                'success': False,
                'error': 'Invalid YouTube URL',
                'video_url': video_url
            }

        try:
            collector = self._get_transcript_collector()
            transcript_data = collector.get_transcript(video_url, language=language)

            if transcript_data is None:
                # Try auto-generated transcript
                transcript_data = collector.get_transcript_auto(video_url)

            if transcript_data is None:
                return {
                    'success': False,
                    'error': 'Failed to fetch transcript',
                    'video_id': video_id,
                    'video_url': video_url
                }

            return {
                'success': True,
                'video_id': video_id,
                'video_url': video_url,
                'language': transcript_data.get('language', language),
                'transcript': transcript_data.get('transcript', ''),
                'segments': transcript_data.get('segments', []),
                'segment_count': len(transcript_data.get('segments', []))
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'video_id': video_id,
                'video_url': video_url
            }

    # ==================== Restaurant Extraction ====================

    def _get_analyzer(self):
        """Lazy load restaurant analyzer."""
        if self._analyzer is None:
            try:
                from unified_restaurant_analyzer import UnifiedRestaurantAnalyzer
                self._analyzer = UnifiedRestaurantAnalyzer()
            except ImportError:
                try:
                    from claude_restaurant_analyzer import ClaudeRestaurantAnalyzer
                    self._analyzer = ClaudeRestaurantAnalyzer()
                except ImportError:
                    raise ImportError("No restaurant analyzer available")
        return self._analyzer

    def analyze_transcript(self, transcript_data: Dict) -> Dict:
        """Analyze transcript to extract restaurant mentions.

        Args:
            transcript_data: Transcript data from fetch_transcript

        Returns:
            Dict with extracted restaurants and metadata
        """
        if not transcript_data.get('success', False):
            return {
                'success': False,
                'error': 'Invalid transcript data',
                'restaurants': []
            }

        try:
            analyzer = self._get_analyzer()

            analysis_result = analyzer.analyze_transcript(
                transcript_text=transcript_data.get('transcript', ''),
                video_id=transcript_data.get('video_id'),
                video_url=transcript_data.get('video_url'),
                language=transcript_data.get('language', 'he')
            )

            return {
                'success': True,
                'video_id': transcript_data.get('video_id'),
                'video_url': transcript_data.get('video_url'),
                'language': transcript_data.get('language'),
                'restaurants': analysis_result.get('restaurants', []),
                'food_trends': analysis_result.get('food_trends', []),
                'episode_summary': analysis_result.get('episode_summary', '')
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'video_id': transcript_data.get('video_id'),
                'restaurants': []
            }

    # ==================== Full Pipeline ====================

    def process_video(
        self,
        video_url: str,
        language: str = 'he',
        save_to_db: bool = True,
        progress_callback: Callable[[str, float], None] = None
    ) -> Dict:
        """Process a single YouTube video end-to-end.

        This runs the full pipeline:
        1. Fetch transcript
        2. Extract restaurants
        3. Save to database

        Args:
            video_url: YouTube video URL
            language: Preferred language (default: 'he')
            save_to_db: Whether to save results to database
            progress_callback: Optional callback(step, progress)

        Returns:
            Dict with processing results
        """
        result = {
            'success': False,
            'video_url': video_url,
            'video_id': None,
            'restaurants_found': 0,
            'restaurants': [],
            'episode_id': None,
            'steps': {}
        }

        # Step 1: Extract video ID
        video_id = self.extract_video_id(video_url)
        if not video_id:
            result['error'] = 'Invalid YouTube URL'
            return result

        result['video_id'] = video_id
        if progress_callback:
            progress_callback('validating_url', 0.1)

        # Step 2: Fetch transcript
        if progress_callback:
            progress_callback('fetching_transcript', 0.2)

        transcript_result = self.fetch_transcript(video_url, language)
        result['steps']['transcript'] = transcript_result

        if not transcript_result.get('success'):
            result['error'] = transcript_result.get('error', 'Failed to fetch transcript')
            return result

        if progress_callback:
            progress_callback('analyzing_transcript', 0.4)

        # Step 3: Analyze transcript
        analysis_result = self.analyze_transcript(transcript_result)
        result['steps']['analysis'] = analysis_result

        if not analysis_result.get('success'):
            result['error'] = analysis_result.get('error', 'Failed to analyze transcript')
            return result

        restaurants = analysis_result.get('restaurants', [])
        result['restaurants'] = restaurants
        result['restaurants_found'] = len(restaurants)
        result['food_trends'] = analysis_result.get('food_trends', [])
        result['episode_summary'] = analysis_result.get('episode_summary', '')

        if progress_callback:
            progress_callback('saving_results', 0.8)

        # Step 4: Save to database
        if save_to_db and restaurants:
            try:
                # Create episode
                episode_id = self.db.create_episode(
                    video_id=video_id,
                    video_url=video_url,
                    language=transcript_result.get('language', language),
                    transcript=transcript_result.get('transcript'),
                    food_trends=analysis_result.get('food_trends', []),
                    episode_summary=analysis_result.get('episode_summary'),
                    analysis_date=datetime.now().isoformat()
                )
                result['episode_id'] = episode_id

                # Create restaurants
                restaurant_ids = []
                for restaurant_data in restaurants:
                    # Make a copy to avoid modifying the original
                    data_copy = restaurant_data.copy()
                    name_hebrew = data_copy.pop('name_hebrew', 'Unknown')
                    restaurant_id = self.db.create_restaurant(
                        name_hebrew=name_hebrew,
                        episode_id=episode_id,
                        **data_copy
                    )
                    restaurant_ids.append(restaurant_id)

                result['steps']['database'] = {
                    'success': True,
                    'episode_id': episode_id,
                    'restaurant_ids': restaurant_ids
                }

            except Exception as e:
                result['steps']['database'] = {
                    'success': False,
                    'error': str(e)
                }

        if progress_callback:
            progress_callback('completed', 1.0)

        result['success'] = True
        return result

    def process_channel(
        self,
        channel_url: str,
        max_videos: int = 50,
        filters: Dict = None,
        progress_callback: Callable[[str, int, int], None] = None
    ) -> Dict:
        """Process all videos from a YouTube channel.

        Args:
            channel_url: YouTube channel URL
            max_videos: Maximum number of videos to process
            filters: Optional filters (date_from, date_to, min_views, etc.)
            progress_callback: Optional callback(status, current, total)

        Returns:
            Dict with processing results
        """
        filters = filters or {}

        result = {
            'success': False,
            'channel_url': channel_url,
            'videos_processed': 0,
            'videos_failed': 0,
            'restaurants_found': 0,
            'video_results': []
        }

        try:
            # Get channel videos
            from youtube_channel_collector import YouTubeChannelCollector

            collector = YouTubeChannelCollector()
            videos = collector.get_channel_videos(
                channel_url=channel_url,
                max_results=max_videos,
                date_from=filters.get('date_from'),
                date_to=filters.get('date_to'),
                min_views=filters.get('min_views'),
                min_duration_seconds=filters.get('min_duration_seconds')
            )

            if not videos:
                result['error'] = 'No videos found in channel'
                return result

            total_videos = len(videos)

            for i, video in enumerate(videos):
                video_url = video.get('video_url') or f"https://www.youtube.com/watch?v={video.get('video_id')}"

                if progress_callback:
                    progress_callback('processing', i + 1, total_videos)

                video_result = self.process_video(
                    video_url=video_url,
                    save_to_db=True
                )

                result['video_results'].append({
                    'video_id': video.get('video_id'),
                    'title': video.get('title'),
                    'success': video_result.get('success'),
                    'restaurants_found': video_result.get('restaurants_found', 0),
                    'error': video_result.get('error')
                })

                if video_result.get('success'):
                    result['videos_processed'] += 1
                    result['restaurants_found'] += video_result.get('restaurants_found', 0)
                else:
                    result['videos_failed'] += 1

            result['success'] = True

        except ImportError as e:
            result['error'] = f'Channel collector not available: {str(e)}'
        except Exception as e:
            result['error'] = str(e)

        return result

    # ==================== Restaurant CRUD ====================

    def get_all_restaurants(self) -> List[Dict]:
        """Get all restaurants from database."""
        return self.db.get_all_restaurants()

    def search_restaurants(self, **kwargs) -> Dict:
        """Search restaurants with filters.

        Supports: location, cuisine, price_range, status, host_opinion,
                  date_start, date_end, episode_id, sort_by, sort_direction,
                  page, limit
        """
        return self.db.search_restaurants(**kwargs)

    def get_restaurant(self, restaurant_id: str) -> Optional[Dict]:
        """Get single restaurant by ID."""
        return self.db.get_restaurant(restaurant_id)

    def create_restaurant(self, data: Dict) -> str:
        """Create a new restaurant."""
        # Extract name_hebrew to avoid duplicate keyword argument
        name_hebrew = data.pop('name_hebrew', 'Unknown')
        result = self.db.create_restaurant(name_hebrew=name_hebrew, **data)
        # Restore the data dict
        data['name_hebrew'] = name_hebrew
        return result

    def update_restaurant(self, restaurant_id: str, data: Dict) -> bool:
        """Update a restaurant."""
        return self.db.update_restaurant(restaurant_id, **data)

    def delete_restaurant(self, restaurant_id: str) -> bool:
        """Delete a restaurant."""
        return self.db.delete_restaurant(restaurant_id)

    # ==================== Episode Operations ====================

    def get_all_episodes(self) -> List[Dict]:
        """Get all episodes from database."""
        return self.db.get_all_episodes()

    def get_episode(self, episode_id: str = None, video_id: str = None) -> Optional[Dict]:
        """Get single episode by ID or video_id."""
        return self.db.get_episode(episode_id=episode_id, video_id=video_id)

    def search_episodes(
        self,
        date_start: str = None,
        date_end: str = None,
        cuisine_filter: str = None,
        location_filter: str = None,
        min_restaurants: int = 1,
        page: int = 1,
        limit: int = 20
    ) -> Dict:
        """Search episodes with filters."""
        # Get all restaurants with episode info
        all_restaurants = self.db.get_all_restaurants()

        # Group by episode
        episodes = {}
        for restaurant in all_restaurants:
            ep_info = restaurant.get('episode_info', {})
            video_id = ep_info.get('video_id')
            if not video_id:
                continue

            if video_id not in episodes:
                episodes[video_id] = {
                    'episode_info': ep_info,
                    'restaurants': []
                }
            episodes[video_id]['restaurants'].append(restaurant)

        # Apply filters
        filtered = []
        for video_id, episode in episodes.items():
            ep_info = episode['episode_info']
            restaurants = episode['restaurants']

            # Date filtering
            if date_start or date_end:
                analysis_date = ep_info.get('analysis_date')
                if analysis_date:
                    if date_start and analysis_date < date_start:
                        continue
                    if date_end and analysis_date > date_end:
                        continue

            # Cuisine filtering
            if cuisine_filter:
                has_cuisine = any(
                    cuisine_filter.lower() in (r.get('cuisine_type') or '').lower()
                    for r in restaurants
                )
                if not has_cuisine:
                    continue

            # Location filtering
            if location_filter:
                has_location = any(
                    location_filter.lower() in (r.get('location', {}).get('city') or '').lower()
                    for r in restaurants
                )
                if not has_location:
                    continue

            # Min restaurants filter
            if len(restaurants) < min_restaurants:
                continue

            filtered.append({
                **episode,
                'matching_restaurants': len(restaurants)
            })

        # Sort by date
        filtered.sort(
            key=lambda x: x['episode_info'].get('analysis_date') or '',
            reverse=True
        )

        # Pagination
        total = len(filtered)
        start = (page - 1) * limit
        paginated = filtered[start:start + limit]

        total_restaurants = sum(e['matching_restaurants'] for e in filtered)

        return {
            'episodes': paginated,
            'count': total,
            'total_restaurants': total_restaurants
        }

    # ==================== Analytics ====================

    def get_timeline_analytics(
        self,
        date_start: str = None,
        date_end: str = None,
        granularity: str = 'day',
        cuisine_filter: str = None,
        location_filter: str = None
    ) -> Dict:
        """Get timeline analytics for restaurants."""
        all_restaurants = self.db.get_all_restaurants()

        # Filter restaurants
        filtered = []
        for restaurant in all_restaurants:
            ep_info = restaurant.get('episode_info', {})

            if cuisine_filter:
                if cuisine_filter.lower() not in (restaurant.get('cuisine_type') or '').lower():
                    continue

            if location_filter:
                city = restaurant.get('location', {}).get('city') or ''
                if location_filter.lower() not in city.lower():
                    continue

            analysis_date = ep_info.get('analysis_date')
            if analysis_date:
                if date_start and analysis_date < date_start:
                    continue
                if date_end and analysis_date > date_end:
                    continue

            filtered.append(restaurant)

        # Group by time period
        timeline = {}
        for restaurant in filtered:
            analysis_date = restaurant.get('episode_info', {}).get('analysis_date')
            if not analysis_date:
                continue

            # Get date key based on granularity
            try:
                dt = datetime.fromisoformat(analysis_date.replace('Z', '+00:00'))
                if granularity == 'week':
                    # Start of week
                    days_since_monday = dt.weekday()
                    start_of_week = dt.replace(hour=0, minute=0, second=0, microsecond=0)
                    date_key = start_of_week.strftime('%Y-%m-%d')
                elif granularity == 'month':
                    date_key = dt.strftime('%Y-%m')
                else:  # day
                    date_key = dt.strftime('%Y-%m-%d')
            except (ValueError, AttributeError):
                date_key = analysis_date[:10] if analysis_date else 'unknown'

            if date_key not in timeline:
                timeline[date_key] = []

            timeline[date_key].append({
                'name_hebrew': restaurant.get('name_hebrew'),
                'name_english': restaurant.get('name_english'),
                'cuisine_type': restaurant.get('cuisine_type'),
                'location': restaurant.get('location'),
                'host_opinion': restaurant.get('host_opinion'),
                'episode_id': restaurant.get('episode_info', {}).get('video_id')
            })

        # Convert to sorted list
        timeline_list = [
            {'date': date, 'restaurants': rests, 'count': len(rests)}
            for date, rests in timeline.items()
        ]
        timeline_list.sort(key=lambda x: x['date'], reverse=True)

        # Calculate analytics
        analytics = {
            'cuisine_distribution': {},
            'location_distribution': {},
            'opinion_distribution': {},
            'price_distribution': {}
        }

        for restaurant in filtered:
            cuisine = restaurant.get('cuisine_type')
            if cuisine:
                analytics['cuisine_distribution'][cuisine] = \
                    analytics['cuisine_distribution'].get(cuisine, 0) + 1

            city = restaurant.get('location', {}).get('city')
            if city:
                analytics['location_distribution'][city] = \
                    analytics['location_distribution'].get(city, 0) + 1

            opinion = restaurant.get('host_opinion')
            if opinion:
                analytics['opinion_distribution'][opinion] = \
                    analytics['opinion_distribution'].get(opinion, 0) + 1

            price = restaurant.get('price_range')
            if price:
                analytics['price_distribution'][price] = \
                    analytics['price_distribution'].get(price, 0) + 1

        # Get top episodes
        episode_counts = {}
        for restaurant in filtered:
            video_id = restaurant.get('episode_info', {}).get('video_id')
            if video_id:
                if video_id not in episode_counts:
                    episode_counts[video_id] = {
                        'video_id': video_id,
                        'video_url': restaurant.get('episode_info', {}).get('video_url'),
                        'count': 0,
                        'restaurants': []
                    }
                episode_counts[video_id]['count'] += 1
                episode_counts[video_id]['restaurants'].append(restaurant.get('name_hebrew'))

        top_episodes = sorted(
            episode_counts.values(),
            key=lambda x: x['count'],
            reverse=True
        )[:10]

        return {
            'timeline': timeline_list,
            'analytics': {**analytics, 'top_episodes': top_episodes},
            'summary': {
                'total_restaurants': len(filtered),
                'unique_episodes': len(episode_counts)
            }
        }

    def get_trends_analytics(
        self,
        period: str = '3months',
        trending_threshold: int = 3
    ) -> Dict:
        """Get trending analytics."""
        from datetime import timedelta

        all_restaurants = self.db.get_all_restaurants()

        # Calculate period start
        now = datetime.now()
        if period == '1month':
            period_start = now - timedelta(days=30)
        elif period == '6months':
            period_start = now - timedelta(days=180)
        elif period == '1year':
            period_start = now - timedelta(days=365)
        else:  # 3months
            period_start = now - timedelta(days=90)

        period_start_str = period_start.isoformat()

        # Filter by period
        period_restaurants = []
        for restaurant in all_restaurants:
            analysis_date = restaurant.get('episode_info', {}).get('analysis_date')
            if analysis_date and analysis_date >= period_start_str:
                period_restaurants.append(restaurant)

        # Find trending (multiple mentions)
        name_counts = {}
        for restaurant in period_restaurants:
            name = restaurant.get('name_hebrew')
            if name:
                if name not in name_counts:
                    name_counts[name] = []
                name_counts[name].append(restaurant)

        trending = [
            mentions[0] for name, mentions in name_counts.items()
            if len(mentions) >= trending_threshold
        ][:10]

        # Regional patterns
        regional_groups = {
            'North': {'cities': {}, 'total': 0, 'cuisines': {}, 'ratings': []},
            'Center': {'cities': {}, 'total': 0, 'cuisines': {}, 'ratings': []},
            'South': {'cities': {}, 'total': 0, 'cuisines': {}, 'ratings': []}
        }

        for restaurant in period_restaurants:
            region = restaurant.get('location', {}).get('region', 'Center')
            city = restaurant.get('location', {}).get('city')
            cuisine = restaurant.get('cuisine_type')
            rating = restaurant.get('rating', {}).get('google_rating')

            if region in regional_groups:
                regional_groups[region]['total'] += 1
                if city:
                    regional_groups[region]['cities'][city] = \
                        regional_groups[region]['cities'].get(city, 0) + 1
                if cuisine:
                    regional_groups[region]['cuisines'][cuisine] = \
                        regional_groups[region]['cuisines'].get(cuisine, 0) + 1
                if rating:
                    regional_groups[region]['ratings'].append(rating)

        regional_patterns = []
        for region, data in regional_groups.items():
            ratings = data['ratings']
            avg_rating = sum(ratings) / len(ratings) if ratings else 0

            top_city = max(data['cities'].items(), key=lambda x: x[1])[0] if data['cities'] else ''
            top_cuisine = max(data['cuisines'].items(), key=lambda x: x[1])[0] if data['cuisines'] else ''

            regional_patterns.append({
                'region': region,
                'cities': data['cities'],
                'total': data['total'],
                'cuisines': data['cuisines'],
                'average_rating': avg_rating,
                'total_ratings': len(ratings),
                'top_city': top_city,
                'top_cuisine': top_cuisine
            })

        # Most active region
        most_active = max(regional_patterns, key=lambda x: x['total'])['region'] if regional_patterns else ''

        return {
            'trending_restaurants': trending,
            'regional_patterns': regional_patterns,
            'period_summary': {
                'period': period,
                'restaurants_discovered': len(period_restaurants),
                'most_active_region': most_active
            }
        }

    # ==================== Job Management ====================

    def create_job(self, job_type: str, **kwargs) -> str:
        """Create a processing job."""
        return self.db.create_job(job_type, **kwargs)

    def get_job_status(self, job_id: str) -> Optional[Dict]:
        """Get job status."""
        job = self.db.get_job(job_id)
        if not job:
            return None

        return {
            'job_id': job['id'],
            'status': job['status'],
            'progress': {
                'videos_completed': job.get('progress_videos_completed', 0),
                'videos_total': job.get('progress_videos_total', 0),
                'videos_failed': job.get('progress_videos_failed', 0),
                'restaurants_found': job.get('progress_restaurants_found', 0),
                'current_video': {
                    'id': job.get('current_video_id'),
                    'title': job.get('current_video_title'),
                    'step': job.get('current_step')
                }
            },
            'started_at': job.get('started_at'),
            'completed_at': job.get('completed_at'),
            'error_message': job.get('error_message')
        }

    def update_job_progress(self, job_id: str, **kwargs) -> bool:
        """Update job progress."""
        return self.db.update_job_progress(job_id, **kwargs)

    def cancel_job(self, job_id: str) -> bool:
        """Cancel a job."""
        return self.db.update_job_status(job_id, 'cancelled')

    def list_jobs(self, status: str = None) -> List[Dict]:
        """List jobs with optional status filter."""
        jobs = self.db.get_jobs(status)
        return [
            {
                'job_id': job['id'],
                'status': job['status'],
                'job_type': job['job_type'],
                'channel_url': job.get('channel_url'),
                'video_url': job.get('video_url'),
                'progress': {
                    'videos_completed': job.get('progress_videos_completed', 0),
                    'videos_total': job.get('progress_videos_total', 0),
                    'percentage': (
                        job.get('progress_videos_completed', 0) / job.get('progress_videos_total', 1) * 100
                        if job.get('progress_videos_total', 0) > 0 else 0
                    )
                },
                'started_at': job.get('started_at')
            }
            for job in jobs
        ]

    # ==================== Utilities ====================

    def get_stats(self) -> Dict:
        """Get system statistics."""
        return self.db.get_stats()

    def import_json_files(self, data_dir: str) -> Dict:
        """Import data from existing JSON files."""
        return self.db.import_from_json_files(data_dir)

    def health_check(self) -> Dict:
        """Check system health."""
        checks = {
            'database': False,
            'transcript_collector': False,
            'analyzer': False
        }

        try:
            self.db.get_stats()
            checks['database'] = True
        except Exception:
            pass

        try:
            self._get_transcript_collector()
            checks['transcript_collector'] = True
        except Exception:
            pass

        try:
            self._get_analyzer()
            checks['analyzer'] = True
        except Exception:
            pass

        return {
            'status': 'healthy' if all(checks.values()) else 'degraded',
            'checks': checks,
            'timestamp': datetime.now().isoformat()
        }


# Singleton instance
_service_instance = None


def get_backend_service(db_path: str = None) -> BackendService:
    """Get or create backend service instance."""
    global _service_instance
    if _service_instance is None or db_path:
        _service_instance = BackendService(db_path=db_path)
    return _service_instance
