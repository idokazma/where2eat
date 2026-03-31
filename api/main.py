"""
Where2Eat FastAPI Server

A restaurant discovery API that extracts restaurant mentions from YouTube podcasts.
"""

import os
import sys
import asyncio
from datetime import datetime
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add src to path for Python imports
# Handle both local dev (api/main.py) and Railway deployment (/app/main.py or /app/api/main.py)
possible_src_paths = [
    Path("/app/src"),                        # Railway absolute path (highest priority)
    Path(__file__).parent.parent / "src",    # Local: api/../src or /app/api/../src
    Path(__file__).parent / "src",           # Fallback: /app/src if main.py is at /app/
]
for src_path in possible_src_paths:
    if src_path.exists():
        resolved = str(src_path.resolve())
        if resolved not in sys.path:
            # Insert at position 0 to ensure src/models takes priority over api/models
            sys.path.insert(0, resolved)
        print(f"[PATH] Added to sys.path (position 0): {src_path.resolve()}")
        break
else:
    print(f"[PATH] Warning: Could not find src directory. Tried: {[str(p) for p in possible_src_paths]}")

from models.analyze import DEFAULT_VIDEO_URL

# Import routers
from routers import (
    restaurants_router,
    analytics_router,
    analyze_router,
    places_router,
    photos_router,
    health_router,
    admin_router,
    admin_subscriptions_router,
    admin_pipeline_router,
    episodes_router,
)


def get_data_directory() -> Path:
    """Get the data directory, respecting DATABASE_DIR env var for Railway volumes."""
    db_dir = os.getenv('DATABASE_DIR')
    if db_dir:
        return Path(db_dir)

    # Default paths
    default_dir = Path(__file__).parent.parent / "data"
    if default_dir.exists():
        return default_dir

    # Railway fallback
    railway_dir = Path("/app/data")
    if railway_dir.exists():
        return railway_dir

    return default_dir


async def fetch_default_video_on_startup():
    """Fetch and analyze the default video on server startup."""
    print(f"\n{'='*60}")
    print(f"Starting up: Initializing restaurant data...")
    print(f"{'='*60}\n")

    # Debug: Show Python path configuration
    print(f"[STARTUP] Python path: {sys.path[:5]}...")
    print(f"[STARTUP] Working directory: {Path.cwd()}")
    print(f"[STARTUP] __file__ location: {Path(__file__).resolve()}")

    import shutil

    # Get data directory (volume-aware)
    base_data_dir = get_data_directory()
    data_dir = base_data_dir / "restaurants"
    db_path = base_data_dir / "where2eat.db"

    # Backup directory - try the seed path first (outside volume mount),
    # then fall back to data path
    backup_dir = Path("/app/seed/restaurants_backup")
    if not backup_dir.exists():
        backup_dir = Path(__file__).parent.parent / "data" / "restaurants_backup"
    if not backup_dir.exists():
        backup_dir = Path("/app/data/restaurants_backup")

    print(f"[STARTUP] DATABASE_DIR env: {os.getenv('DATABASE_DIR', 'not set')}")
    print(f"[STARTUP] Base data directory: {base_data_dir}")
    print(f"[STARTUP] Database path: {db_path}")

    print(f"[STARTUP] Data directory: {data_dir}")
    print(f"[STARTUP] Backup directory: {backup_dir}")
    print(f"[STARTUP] Backup exists: {backup_dir.exists()}")

    # Ensure data directory exists
    data_dir.mkdir(parents=True, exist_ok=True)

    # Check if SQLite database already has restaurant data
    try:
        from database import Database
        db = Database(str(db_path))
        stats = db.get_stats()
        restaurant_count = stats.get('restaurants', 0)

        if restaurant_count > 0:
            print(f"[STARTUP] Database already has {restaurant_count} restaurants")
            print(f"[STARTUP] Database is persistent - skipping initialization")
            print(f"\n{'='*60}")
            print(f"Server ready! {restaurant_count} restaurants in database.")
            print(f"{'='*60}\n")
            return
        else:
            print(f"[STARTUP] Database exists but is empty")
            print(f"[STARTUP] The pipeline will populate it as videos are processed")
    except Exception as db_err:
        print(f"[STARTUP] Could not check database: {db_err}")

    # No seeding from JSON/backup files - only pipeline-processed data is served.
    # If the database is empty, the pipeline scheduler will process queued videos.
    print(f"[STARTUP] No restaurant data yet. Pipeline will populate the database.")
    print(f"\n{'='*60}")
    print(f"Server ready! Waiting for pipeline to process videos.")
    print(f"{'='*60}\n")
    return

    # Fallback: No backup - try to analyze default video
    print(f"[STARTUP] No backup data found, attempting to analyze default video...")
    print(f"[STARTUP] URL: {DEFAULT_VIDEO_URL}")

    try:
        # Import datetime and json first (standard library - always available)
        from datetime import datetime
        import json
        import uuid

        # Try importing src modules - these may not be available if only api/ was deployed
        try:
            from youtube_transcript_collector import YouTubeTranscriptCollector
            from unified_restaurant_analyzer import UnifiedRestaurantAnalyzer
        except ImportError as import_err:
            print(f"[STARTUP] ERROR: Cannot import src modules: {import_err}")
            print(f"[STARTUP] This usually means the 'src/' directory is not deployed.")
            print(f"[STARTUP] Make sure Railway deploys from repo root, not just 'api/'.")
            print(f"[STARTUP] Current sys.path: {sys.path}")

            # Check if src directory exists
            possible_paths = ["/app/src", str(Path(__file__).parent.parent / "src")]
            for p in possible_paths:
                exists = Path(p).exists()
                print(f"[STARTUP]   Path '{p}' exists: {exists}")
                if exists:
                    files = list(Path(p).glob("*.py"))[:5]
                    print(f"[STARTUP]   Files: {[f.name for f in files]}")

            raise  # Re-raise to fall into the outer except block

        collector = YouTubeTranscriptCollector()
        result = collector.get_transcript(DEFAULT_VIDEO_URL, languages=['iw', 'he', 'en'])

        if result:
            print(f"[STARTUP] Successfully fetched transcript for default video")
            print(f"[STARTUP] Video ID: {result.get('video_id')}")
            print(f"[STARTUP] Language: {result.get('language')}")
            print(f"[STARTUP] Segments: {result.get('segment_count', 0)}")
            print(f"[STARTUP] Transcript length: {len(result.get('transcript', ''))} chars")
            print(f"[STARTUP] Cached: {result.get('cached', False)}")

            # Preview first 200 chars of transcript
            transcript_preview = result.get('transcript', '')[:200]
            print(f"[STARTUP] Preview: {transcript_preview}...")

            # Analyze the transcript
            print(f"[STARTUP] Analyzing transcript with LLM...")
            analyzer = UnifiedRestaurantAnalyzer()
            analysis_result = analyzer.analyze_transcript({
                'video_id': result.get('video_id'),
                'video_url': DEFAULT_VIDEO_URL,
                'language': result.get('language', 'he'),
                'transcript': result.get('transcript', '')
            })

            # Save restaurants to JSON files
            restaurants = analysis_result.get('restaurants', [])
            data_dir = Path(__file__).parent.parent / "data" / "restaurants"
            data_dir.mkdir(parents=True, exist_ok=True)

            saved_count = 0
            for restaurant in restaurants:
                restaurant_id = str(uuid.uuid4())
                restaurant_data = {
                    'id': restaurant_id,
                    'name_hebrew': restaurant.get('name_hebrew', ''),
                    'name_english': restaurant.get('name_english', ''),
                    'location': restaurant.get('location', {}),
                    'cuisine_type': restaurant.get('cuisine_type', ''),
                    'status': restaurant.get('status', ''),
                    'price_range': restaurant.get('price_range', ''),
                    'host_opinion': restaurant.get('host_opinion', ''),
                    'host_comments': restaurant.get('host_comments', ''),
                    'menu_items': restaurant.get('menu_items', []),
                    'special_features': restaurant.get('special_features', []),
                    'contact_info': restaurant.get('contact_info', {}),
                    'business_news': restaurant.get('business_news'),
                    'mention_context': restaurant.get('mention_context', ''),
                    'episode_info': analysis_result.get('episode_info', {}),
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }

                file_path = data_dir / f"{restaurant_id}.json"
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(restaurant_data, f, ensure_ascii=False, indent=2)
                saved_count += 1

            print(f"[STARTUP] Analysis complete: found {len(restaurants)} restaurants, saved {saved_count}")
            print(f"\n{'='*60}")
            print(f"Server ready! Default video analyzed and {saved_count} restaurants loaded.")
            print(f"{'='*60}\n")
        else:
            print(f"[STARTUP] Warning: Could not fetch transcript for default video")
            print(f"[STARTUP] Server will continue without preloaded data")

    except Exception as e:
        print(f"[STARTUP] Error analyzing default video: {e}")
        import traceback
        traceback.print_exc()

        # Fallback: import from existing analyses if available
        print(f"[STARTUP] Attempting to import from existing analyses...")
        try:
            analyses_dir = Path(__file__).parent.parent / "analyses"
            data_dir = Path(__file__).parent.parent / "data" / "restaurants"
            data_dir.mkdir(parents=True, exist_ok=True)

            imported = 0
            for analysis_file in analyses_dir.glob('*_analysis.json'):
                if 'test' in analysis_file.name:
                    continue
                try:
                    with open(analysis_file, 'r', encoding='utf-8') as f:
                        analysis = json.load(f)

                    episode_info = analysis.get('episode_info', {})
                    restaurants = analysis.get('restaurants', [])

                    for restaurant in restaurants:
                        restaurant_id = str(uuid.uuid4())
                        restaurant_data = {
                            'id': restaurant_id,
                            'name_hebrew': restaurant.get('name_hebrew', ''),
                            'name_english': restaurant.get('name_english', ''),
                            'location': restaurant.get('location', {}),
                            'cuisine_type': restaurant.get('cuisine_type', ''),
                            'status': restaurant.get('status', ''),
                            'price_range': restaurant.get('price_range', ''),
                            'host_opinion': restaurant.get('host_opinion', ''),
                            'host_comments': restaurant.get('host_comments', ''),
                            'menu_items': restaurant.get('menu_items', []),
                            'special_features': restaurant.get('special_features', []),
                            'contact_info': restaurant.get('contact_info', {}),
                            'business_news': restaurant.get('business_news'),
                            'mention_context': restaurant.get('mention_context', ''),
                            'episode_info': episode_info,
                            'created_at': datetime.now().isoformat(),
                            'updated_at': datetime.now().isoformat()
                        }

                        file_path = data_dir / f'{restaurant_id}.json'
                        with open(file_path, 'w', encoding='utf-8') as f:
                            json.dump(restaurant_data, f, ensure_ascii=False, indent=2)
                        imported += 1
                except Exception as import_err:
                    print(f"[STARTUP] Error importing {analysis_file.name}: {import_err}")

            if imported > 0:
                print(f"[STARTUP] Imported {imported} restaurants from existing analyses")
                print(f"\n{'='*60}")
                print(f"Server ready! {imported} restaurants loaded from cache.")
                print(f"{'='*60}\n")
            else:
                print(f"[STARTUP] No existing analyses found to import")
                print(f"[STARTUP] Server will continue without preloaded data")
        except Exception as fallback_err:
            print(f"[STARTUP] Fallback import failed: {fallback_err}")
            print(f"[STARTUP] Server will continue without preloaded data")


def seed_initial_data():
    """Seed admin user and default subscriptions if the database is empty.

    - Creates a default admin user from ADMIN_EMAIL / ADMIN_PASSWORD env vars
      (only if admin_users.json has no users).
    - Adds the Hebrew Food Podcast playlist subscription if the subscriptions
      table is empty.
    """
    import json
    import uuid
    from pathlib import Path

    # --- 1. Seed admin user ---
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")

    data_dir = get_data_directory()
    admin_db_path = data_dir / "admin_users.json"

    if admin_email and admin_password:
        try:
            existing = {"users": []}
            if admin_db_path.exists():
                with open(admin_db_path, "r") as f:
                    existing = json.load(f)

            from passlib.context import CryptContext
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

            if not existing.get("users"):
                admin_user = {
                    "id": str(uuid.uuid4()),
                    "email": admin_email,
                    "name": "Admin",
                    "role": "super_admin",
                    "password_hash": pwd_context.hash(admin_password),
                    "is_active": True,
                    "created_at": datetime.now().isoformat(),
                }
                existing["users"] = [admin_user]
                data_dir.mkdir(parents=True, exist_ok=True)
                with open(admin_db_path, "w") as f:
                    json.dump(existing, f, indent=2)
                print(f"[SEED] Created default admin user: {admin_email}")
            else:
                # Find or create admin user matching env email
                found = False
                for u in existing["users"]:
                    if u["email"] == admin_email:
                        u["password_hash"] = pwd_context.hash(admin_password)
                        found = True
                if not found:
                    # No user with this email — add one
                    existing["users"].append({
                        "id": str(uuid.uuid4()),
                        "email": admin_email,
                        "name": "Admin",
                        "role": "super_admin",
                        "password_hash": pwd_context.hash(admin_password),
                        "is_active": True,
                        "created_at": datetime.now().isoformat(),
                    })
                data_dir.mkdir(parents=True, exist_ok=True)
                with open(admin_db_path, "w") as f:
                    json.dump(existing, f, indent=2)
                print(f"[SEED] Admin users synced ({len(existing['users'])} users, env user found={found})")
        except Exception as e:
            print(f"[SEED] Failed to seed admin user: {e}")
    else:
        print("[SEED] ADMIN_EMAIL / ADMIN_PASSWORD not set, skipping admin user seed")

    # --- 2. Seed default subscriptions ---
    DEFAULT_SUBSCRIPTIONS = [
        {
            "url": "https://www.youtube.com/playlist?list=PLZPgleW4baxrsrU-metYY1imJ85uH9FNg",
            "name": "Hebrew Food Podcast",
            "priority": 3,
        },
    ]

    try:
        from database import get_database
        from subscription_manager import SubscriptionManager

        db = get_database()
        manager = SubscriptionManager(db)
        subs = manager.list_subscriptions(active_only=False)

        if not subs:
            for sub_info in DEFAULT_SUBSCRIPTIONS:
                try:
                    sub = manager.add_subscription(
                        source_url=sub_info["url"],
                        source_name=sub_info["name"],
                        priority=sub_info["priority"],
                    )
                    print(f"[SEED] Added subscription: {sub_info['name']} ({sub['source_type']}: {sub['source_id']})")
                except ValueError as e:
                    print(f"[SEED] Subscription already exists: {e}")
            print(f"[SEED] Seeded {len(DEFAULT_SUBSCRIPTIONS)} default subscription(s)")
        else:
            print(f"[SEED] Subscriptions already exist ({len(subs)} subscriptions)")
    except Exception as e:
        print(f"[SEED] Failed to seed subscriptions: {e}")
        import traceback
        traceback.print_exc()


def sync_sqlite_to_postgres():
    """Sync data from SQLite (pipeline storage) to PostgreSQL (API storage).

    Reads all episodes and restaurants from the SQLite database on the
    persistent volume and upserts them into PostgreSQL. Runs at every
    startup to catch any new pipeline-processed data.
    """
    if not os.getenv('DATABASE_URL'):
        print("[SYNC] No DATABASE_URL set, skipping SQLite→PostgreSQL sync")
        return

    try:
        from database import get_database
        import importlib.util
        import json

        # Load src/models/base.py explicitly (not api/models/)
        src_base_path = Path(__file__).parent.parent / "src" / "models" / "base.py"
        if not src_base_path.exists():
            src_base_path = Path("/app/src/models/base.py")
        if not src_base_path.exists():
            print("[SYNC] src/models/base.py not found, skipping sync")
            return
        spec = importlib.util.spec_from_file_location("src_models_base", src_base_path)
        src_models_base = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(src_models_base)
        get_db_session = src_models_base.get_db_session

        # Load src/models/restaurant.py explicitly (not api/models/restaurant.py)
        src_restaurant_path = src_base_path.parent / "restaurant.py"
        if not src_restaurant_path.exists():
            print("[SYNC] src/models/restaurant.py not found, skipping sync")
            return

        # Register modules so relative import `from .base import Base` works
        import types
        import sys
        models_package = types.ModuleType("models")
        models_package.__path__ = [str(src_base_path.parent)]
        models_package.__package__ = "models"
        sys.modules["models"] = models_package
        sys.modules["models.base"] = src_models_base
        src_models_base.__package__ = "models"

        spec2 = importlib.util.spec_from_file_location("models.restaurant", src_restaurant_path,
                                                         submodule_search_locations=[])
        src_models_restaurant = importlib.util.module_from_spec(spec2)
        src_models_restaurant.__package__ = "models"
        spec2.loader.exec_module(src_models_restaurant)
        EpisodeModel = src_models_restaurant.Episode
        RestaurantModel = src_models_restaurant.Restaurant

        # Ensure PostgreSQL tables exist
        src_models_base.init_db()

        # Migrate: add published_at columns if missing (for existing PostgreSQL DBs)
        try:
            engine = src_models_base.get_engine()
            from sqlalchemy import text, inspect as sa_inspect
            inspector = sa_inspect(engine)
            with engine.begin() as conn:
                for table_name in ('episodes', 'restaurants'):
                    cols = [c['name'] for c in inspector.get_columns(table_name)]
                    if 'published_at' not in cols:
                        conn.execute(text(
                            f'ALTER TABLE {table_name} ADD COLUMN published_at VARCHAR(50)'
                        ))
                        print(f"[SYNC-MIGRATION] Added published_at to {table_name}")
        except Exception as mig_err:
            print(f"[SYNC-MIGRATION] published_at migration: {mig_err}")

        # Migrate: add is_closing column if missing
        try:
            engine = src_models_base.get_engine()
            from sqlalchemy import text, inspect as sa_inspect
            inspector = sa_inspect(engine)
            cols = [c['name'] for c in inspector.get_columns('restaurants')]
            if 'is_closing' not in cols:
                with engine.begin() as conn:
                    conn.execute(text('ALTER TABLE restaurants ADD COLUMN is_closing BOOLEAN DEFAULT FALSE'))
                    print("[SYNC-MIGRATION] Added is_closing to restaurants")
        except Exception as mig_err:
            print(f"[SYNC-MIGRATION] is_closing migration: {mig_err}")

        sqlite_db = get_database()
        episodes = sqlite_db.get_all_episodes()
        restaurants = sqlite_db.get_all_restaurants(include_episode_info=False)

        if not episodes and not restaurants:
            print("[SYNC] SQLite database is empty, nothing to sync")
            return

        print(f"[SYNC] Found {len(episodes)} episodes and {len(restaurants)} restaurants in SQLite")

        synced_episodes = 0
        synced_restaurants = 0

        with get_db_session() as session:
            # Sync episodes
            for ep in episodes:
                existing = session.query(EpisodeModel).filter_by(video_id=ep['video_id']).first()
                if existing:
                    continue
                episode_model = EpisodeModel(
                    id=ep['id'],
                    video_id=ep['video_id'],
                    video_url=ep['video_url'],
                    channel_id=ep.get('channel_id'),
                    channel_name=ep.get('channel_name'),
                    title=ep.get('title'),
                    language=ep.get('language', 'he'),
                    transcript=ep.get('transcript'),
                    food_trends=ep.get('food_trends'),
                    episode_summary=ep.get('episode_summary'),
                    published_at=ep.get('published_at'),
                )
                if ep.get('analysis_date'):
                    try:
                        episode_model.analysis_date = datetime.fromisoformat(
                            ep['analysis_date'].replace('Z', '+00:00')
                        )
                    except (ValueError, AttributeError):
                        pass
                session.add(episode_model)
                synced_episodes += 1

            # Sync restaurants
            updated_restaurants = 0
            for r in restaurants:
                location = r.get('location', {})
                contact = r.get('contact_info', {})
                rating = r.get('rating', {})
                gp = r.get('google_places', {}) or {}

                lat = r.get('latitude') or location.get('lat')
                lng = r.get('longitude') or location.get('lng')
                place_id = r.get('google_place_id') or gp.get('place_id')
                photos = r.get('photos')
                # Ensure photos is a proper list (not a JSON string)
                if isinstance(photos, str):
                    try:
                        photos = json.loads(photos)
                    except (json.JSONDecodeError, TypeError):
                        photos = []
                image_url = r.get('image_url')

                existing = session.query(RestaurantModel).filter_by(id=r['id']).first()
                if existing:
                    # Update existing records with enrichment data from SQLite
                    changed = False
                    if not existing.latitude and lat:
                        existing.latitude = lat
                        changed = True
                    if not existing.longitude and lng:
                        existing.longitude = lng
                        changed = True
                    if not existing.google_place_id and place_id:
                        existing.google_place_id = place_id
                        changed = True
                    if not existing.image_url and image_url:
                        existing.image_url = image_url
                        changed = True
                    if photos and (not existing.photos or isinstance(existing.photos, str)):
                        existing.photos = photos
                        changed = True
                    if not existing.google_name and gp.get('google_name'):
                        existing.google_name = gp['google_name']
                        changed = True
                    if not existing.google_url and gp.get('google_url'):
                        existing.google_url = gp['google_url']
                        changed = True
                    if not existing.google_rating and rating.get('google_rating'):
                        existing.google_rating = rating['google_rating']
                        changed = True
                    mention_ts = r.get('mention_timestamp') or r.get('mention_timestamp_seconds')
                    if not existing.mention_timestamp and mention_ts:
                        existing.mention_timestamp = mention_ts
                        changed = True
                    if changed:
                        updated_restaurants += 1
                    continue

                restaurant_model = RestaurantModel(
                    id=r['id'],
                    episode_id=r.get('episode_id'),
                    name_hebrew=r.get('name_hebrew', 'Unknown'),
                    name_english=r.get('name_english'),
                    city=location.get('city'),
                    neighborhood=location.get('neighborhood'),
                    address=location.get('address'),
                    region=location.get('region', 'Center'),
                    latitude=lat,
                    longitude=lng,
                    cuisine_type=r.get('cuisine_type'),
                    status=r.get('status', 'open'),
                    price_range=r.get('price_range'),
                    host_opinion=r.get('host_opinion'),
                    host_comments=r.get('host_comments'),
                    menu_items=r.get('menu_items'),
                    special_features=r.get('special_features'),
                    contact_hours=contact.get('hours'),
                    contact_phone=contact.get('phone'),
                    contact_website=contact.get('website'),
                    business_news=r.get('business_news'),
                    is_closing=bool(r.get('is_closing', False)),
                    mention_context=r.get('mention_context'),
                    mention_timestamp=r.get('mention_timestamp') or r.get('mention_timestamp_seconds'),
                    google_place_id=place_id,
                    google_name=gp.get('google_name'),
                    google_url=gp.get('google_url'),
                    google_rating=rating.get('google_rating'),
                    google_user_ratings_total=rating.get('user_ratings_total'),
                    photos=photos,
                    image_url=image_url,
                    published_at=r.get('published_at'),
                )
                session.add(restaurant_model)
                synced_restaurants += 1

            session.commit()

        print(f"[SYNC] Synced {synced_episodes} new episodes and {synced_restaurants} new restaurants to PostgreSQL")
        if updated_restaurants > 0:
            print(f"[SYNC] Updated {updated_restaurants} existing restaurants with enrichment data")

    except Exception as e:
        print(f"[SYNC] SQLite→PostgreSQL sync failed: {e}")
        import traceback
        traceback.print_exc()


def start_pipeline_scheduler():
    """Start the auto video fetching pipeline scheduler."""
    try:
        from pipeline_scheduler import PipelineScheduler
        scheduler = PipelineScheduler()
        scheduler.start()
        status = scheduler.get_status()
        if status['running']:
            print(f"[SCHEDULER] Pipeline scheduler started")
            print(f"[SCHEDULER] Poll interval: every {status.get('poll_interval_hours', '?')}h")
            print(f"[SCHEDULER] Process interval: every {status.get('process_interval_minutes', '?')}m")
        else:
            print(f"[SCHEDULER] Pipeline scheduler is disabled via config")
        return scheduler
    except Exception as e:
        print(f"[SCHEDULER] Failed to start pipeline scheduler: {e}")
        import traceback
        traceback.print_exc()
        return None


# Global scheduler reference for health checks
_pipeline_scheduler = None


def backfill_mention_timestamps():
    """Backfill mention_timestamp by fetching YouTube transcripts and matching restaurant names.

    For each episode with restaurants missing timestamps:
    1. Fetch the transcript from YouTube (timed segments)
    2. Search for each restaurant name in the segments
    3. Store the segment start time as mention_timestamp
    """
    try:
        from routers.restaurants import _get_sqlite_db
        import time

        db = _get_sqlite_db()
        if not db:
            return

        with db.get_connection() as conn:
            # Check if any timestamps are already set
            cursor = conn.execute("SELECT COUNT(*) FROM restaurants WHERE mention_timestamp IS NOT NULL")
            if cursor.fetchone()[0] > 0:
                print("[MIGRATION] Timestamps already exist, skipping backfill")
                return

            # Get all episodes that have restaurants without timestamps
            episodes = conn.execute("""
                SELECT DISTINCT e.id, e.video_id, e.video_url
                FROM episodes e
                JOIN restaurants r ON r.episode_id = e.id
                WHERE r.mention_timestamp IS NULL
            """).fetchall()

            if not episodes:
                print("[MIGRATION] No episodes need timestamp backfill")
                return

            # Try importing the transcript collector
            try:
                from youtube_transcript_collector import YouTubeTranscriptCollector
                collector = YouTubeTranscriptCollector()
            except ImportError:
                print("[MIGRATION] YouTubeTranscriptCollector not available, skipping timestamp backfill")
                return

            backfilled = 0
            for ep_id, video_id, video_url in episodes:
                try:
                    # Fetch timed transcript segments
                    result = collector.get_transcript(
                        video_url or f"https://www.youtube.com/watch?v={video_id}",
                        languages=['iw', 'he', 'en']
                    )
                    if not result or not result.get('segments'):
                        continue

                    segments = result['segments']

                    # Get restaurants for this episode
                    restaurants = conn.execute(
                        "SELECT id, name_hebrew FROM restaurants WHERE episode_id = ? AND mention_timestamp IS NULL",
                        (ep_id,),
                    ).fetchall()

                    for r_id, name_hebrew in restaurants:
                        # Search for restaurant name in segments
                        for seg in segments:
                            if name_hebrew in seg.get('text', ''):
                                conn.execute(
                                    "UPDATE restaurants SET mention_timestamp = ? WHERE id = ?",
                                    (seg['start'], r_id),
                                )
                                backfilled += 1
                                break

                    time.sleep(1)  # Rate limit YouTube requests
                except Exception as e:
                    print(f"[MIGRATION] Failed to process {video_id}: {e}")
                    continue

            conn.commit()

        if backfilled > 0:
            print(f"[MIGRATION] Backfilled mention_timestamp for {backfilled} restaurants")
        else:
            print("[MIGRATION] No timestamps could be backfilled from transcripts")
    except Exception as e:
        print(f"[MIGRATION] mention_timestamp backfill failed: {e}")
        import traceback
        traceback.print_exc()


def backfill_episode_published_at():
    """Backfill published_at on episodes by scraping YouTube video pages."""
    try:
        from routers.restaurants import _get_sqlite_db
        import urllib.request
        import re
        import time

        db = _get_sqlite_db()
        if not db:
            return

        with db.get_connection() as conn:
            # Get episodes missing published_at
            episodes = conn.execute(
                "SELECT id, video_id FROM episodes WHERE published_at IS NULL OR published_at = ''"
            ).fetchall()

            if not episodes:
                return

            backfilled = 0
            for ep_id, video_id in episodes:
                try:
                    url = f"https://www.youtube.com/watch?v={video_id}"
                    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        html = resp.read().decode("utf-8", errors="ignore")

                    # Extract datePublished from JSON-LD embedded in the page
                    match = re.search(r'"datePublished":"([^"]+)"', html)
                    if not match:
                        match = re.search(r'"uploadDate":"([^"]+)"', html)

                    if match:
                        published_at = match.group(1)[:10]  # Take YYYY-MM-DD
                        conn.execute(
                            "UPDATE episodes SET published_at = ? WHERE id = ?",
                            (published_at, ep_id),
                        )
                        conn.execute(
                            "UPDATE restaurants SET published_at = ? WHERE episode_id = ? AND (published_at IS NULL OR published_at = '')",
                            (published_at, ep_id),
                        )
                        backfilled += 1
                        print(f"[MIGRATION] {video_id}: published_at={published_at}")

                    time.sleep(0.5)  # Rate limit
                except Exception as e:
                    print(f"[MIGRATION] Failed to fetch date for {video_id}: {e}")
                    continue

            conn.commit()

        if backfilled > 0:
            print(f"[MIGRATION] Backfilled published_at for {backfilled} episodes")
        else:
            print("[MIGRATION] Could not backfill published_at")
    except Exception as e:
        print(f"[MIGRATION] published_at backfill failed: {e}")


async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    global _pipeline_scheduler
    # Initialize PostgreSQL tables if DATABASE_URL is set
    if os.getenv('DATABASE_URL'):
        try:
            import importlib.util
            src_base_path = Path(__file__).parent.parent / "src" / "models" / "base.py"
            if not src_base_path.exists():
                src_base_path = Path("/app/src/models/base.py")
            if src_base_path.exists():
                spec = importlib.util.spec_from_file_location("src_models_base", src_base_path)
                src_models_base = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(src_models_base)
                src_models_base.init_db()
        except Exception as e:
            print(f"[STARTUP] Database init failed: {e}")
    # Startup: fetch default video
    await fetch_default_video_on_startup()
    # Backfill mention_timestamp from transcripts/JSON
    backfill_mention_timestamps()
    # Backfill published_at from YouTube metadata
    backfill_episode_published_at()
    # Sync SQLite data to PostgreSQL
    sync_sqlite_to_postgres()
    # Seed admin user and subscriptions if empty
    seed_initial_data()
    # Start pipeline scheduler
    _pipeline_scheduler = start_pipeline_scheduler()
    yield
    # Shutdown: stop scheduler and cleanup
    if _pipeline_scheduler:
        print("[SHUTDOWN] Stopping pipeline scheduler...")
        _pipeline_scheduler.stop()
    print("[SHUTDOWN] Server shutting down...")


# Create FastAPI app with metadata for docs
app = FastAPI(
    lifespan=lifespan,
    title="Where2Eat API",
    description="""
## Restaurant Discovery API

Where2Eat extracts restaurant mentions from YouTube food podcasts and presents
location-based recommendations.

### Features

- **Restaurant Search**: Search and filter restaurants by location, cuisine, price range
- **Analytics**: Timeline and trend analytics for restaurant discoveries
- **Video Analysis**: Analyze YouTube videos and channels for restaurant mentions
- **Places Integration**: Google Places API integration for location data
- **Admin Panel**: Manage restaurants, users, and content

### Authentication

Admin endpoints require JWT authentication. Use `/api/admin/auth/login` to obtain a token.

### Quick Start

```bash
# Health check
curl http://localhost:8000/health

# List restaurants
curl http://localhost:8000/api/restaurants

# Search restaurants
curl "http://localhost:8000/api/restaurants/search?location=Tel+Aviv&cuisine=Italian"
```
    """,
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    contact={
        "name": "Where2Eat Team",
    },
    license_info={
        "name": "MIT",
    },
)

# Configure CORS & allowed origins
_default_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3003",
]
_env_origins = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = _default_origins + [o.strip() for o in _env_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Origin gate middleware — block requests not from allowed origins
class OriginGateMiddleware(BaseHTTPMiddleware):
    """Reject requests that don't come from an allowed origin.

    Exempt paths (e.g. /health) are always allowed so Railway health
    checks keep working.  Requests with a valid API key header bypass
    the origin check for server-to-server use.
    """

    EXEMPT_PREFIXES = ("/health", "/docs", "/openapi.json", "/api/photos")

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Always allow CORS preflight requests
        if request.method == "OPTIONS":
            return await call_next(request)

        # Always allow exempt paths
        if any(path.startswith(p) for p in self.EXEMPT_PREFIXES):
            return await call_next(request)

        # Allow requests with a valid API key (server-to-server)
        api_key = os.getenv("API_SECRET_KEY")
        if api_key and request.headers.get("x-api-key") == api_key:
            return await call_next(request)

        # Check Origin header (set by browsers on fetch/XHR)
        origin = request.headers.get("origin")
        referer = request.headers.get("referer")

        if origin:
            if origin.rstrip("/") not in [o.rstrip("/") for o in allowed_origins]:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Origin not allowed"},
                )
        elif referer:
            # Fall back to Referer for same-origin navigations
            from urllib.parse import urlparse
            referer_origin = f"{urlparse(referer).scheme}://{urlparse(referer).netloc}"
            if referer_origin.rstrip("/") not in [o.rstrip("/") for o in allowed_origins]:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Origin not allowed"},
                )
        else:
            # No Origin or Referer — block (not from a browser app)
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=403,
                content={"detail": "Origin required"},
            )

        return await call_next(request)


# Security headers middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses (equivalent to Express Helmet)."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        return response


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(OriginGateMiddleware)

# Include routers
app.include_router(health_router)
app.include_router(restaurants_router)
app.include_router(analytics_router)
app.include_router(analyze_router)
app.include_router(places_router)
app.include_router(photos_router)
app.include_router(admin_router)
app.include_router(admin_subscriptions_router)
app.include_router(admin_pipeline_router)
app.include_router(episodes_router)


@app.get("/api/subscriptions")
async def public_subscriptions():
    """Public read-only list of subscriptions for admin dashboard."""
    try:
        from database import get_database
        from subscription_manager import SubscriptionManager
        db = get_database()
        mgr = SubscriptionManager(db)
        subs = mgr.list_subscriptions(active_only=False)
        return {"subscriptions": subs}
    except Exception as e:
        return {"subscriptions": [], "error": str(e)}


@app.get("/api/debug/pipeline")
async def debug_pipeline():
    """Temporary debug endpoint to diagnose pipeline polling issues."""
    import traceback
    result = {
        "scheduler": None,
        "config": {},
        "subscriptions": [],
        "poll_test": None,
        "queue": [],
        "recent_logs": [],
    }

    try:
        from config import (
            PIPELINE_POLL_INTERVAL_HOURS,
            PIPELINE_PROCESS_INTERVAL_MINUTES,
            PIPELINE_SCHEDULER_ENABLED,
            PIPELINE_MAX_VIDEO_AGE_DAYS,
            PIPELINE_MAX_RECENT_VIDEOS,
        )
        result["config"] = {
            "poll_interval_hours": PIPELINE_POLL_INTERVAL_HOURS,
            "process_interval_minutes": PIPELINE_PROCESS_INTERVAL_MINUTES,
            "scheduler_enabled": PIPELINE_SCHEDULER_ENABLED,
            "max_video_age_days": PIPELINE_MAX_VIDEO_AGE_DAYS,
            "max_recent_videos": PIPELINE_MAX_RECENT_VIDEOS,
            "env_poll_interval": os.getenv("PIPELINE_POLL_INTERVAL_HOURS", "not set"),
            "env_scheduler_enabled": os.getenv("PIPELINE_SCHEDULER_ENABLED", "not set"),
        }
    except Exception as e:
        result["config"] = {"error": str(e)}

    try:
        if _pipeline_scheduler:
            result["scheduler"] = _pipeline_scheduler.get_status()
    except Exception as e:
        result["scheduler"] = {"error": str(e)}

    try:
        from database import get_database
        from subscription_manager import SubscriptionManager
        db = get_database()
        mgr = SubscriptionManager(db)
        subs = mgr.list_subscriptions(active_only=False)
        result["subscriptions"] = [
            {
                "id": s["id"],
                "source_name": s.get("source_name"),
                "source_url": s.get("source_url"),
                "source_type": s.get("source_type"),
                "source_id": s.get("source_id"),
                "is_active": s.get("is_active"),
                "last_checked_at": s.get("last_checked_at"),
                "total_videos_found": s.get("total_videos_found"),
            }
            for s in subs
        ]
    except Exception as e:
        result["subscriptions"] = [{"error": str(e)}]

    # Try fetching videos from the first subscription
    try:
        if result["subscriptions"] and not result["subscriptions"][0].get("error"):
            from database import get_database
            from pipeline_scheduler import PipelineScheduler
            db = get_database()
            scheduler = PipelineScheduler(db=db)

            subs_raw = scheduler.sub_manager.list_subscriptions(active_only=True)
            if subs_raw:
                sub = subs_raw[0]
                try:
                    videos = scheduler._fetch_channel_videos(sub)
                    filtered = scheduler._filter_by_age(videos)
                    sorted_vids = scheduler._sort_videos_by_date(filtered)

                    # Check which are already known
                    existing_ids = set()
                    with db.get_connection() as conn:
                        cursor = conn.cursor()
                        cursor.execute("SELECT video_id FROM episodes")
                        existing_ids = {row["video_id"] for row in cursor.fetchall()}
                        cursor.execute("SELECT video_id FROM video_queue")
                        existing_ids |= {row["video_id"] for row in cursor.fetchall()}

                    new_videos = [v for v in sorted_vids if v.get("video_id") not in existing_ids]

                    result["poll_test"] = {
                        "subscription": sub.get("source_name"),
                        "raw_videos_fetched": len(videos),
                        "after_age_filter": len(filtered),
                        "sample_raw": videos[:3] if videos else [],
                        "new_videos": len(new_videos),
                        "sample_new": new_videos[:3] if new_videos else [],
                        "existing_episode_count": len(existing_ids),
                    }
                except Exception as e:
                    result["poll_test"] = {"error": str(e), "traceback": traceback.format_exc()}
    except Exception as e:
        result["poll_test"] = {"error": str(e)}

    # Recent pipeline logs
    try:
        from database import get_database
        from pipeline_logger import PipelineLogger
        db = get_database()
        pl = PipelineLogger(db)
        logs = pl.get_logs(limit=10)
        result["recent_logs"] = logs.get("items", [])[:10]
    except Exception as e:
        result["recent_logs"] = [{"error": str(e)}]

    # Queue items
    try:
        from database import get_database
        from video_queue_manager import VideoQueueManager
        db = get_database()
        qm = VideoQueueManager(db)
        queue = qm.get_queue(page=1, limit=5)
        result["queue"] = queue.get("items", [])
    except Exception as e:
        result["queue"] = [{"error": str(e)}]

    return result


@app.post("/api/debug/clear-and-repoll")
async def debug_clear_and_repoll():
    """Temporary: Clear queue and re-poll. Remove after debugging."""
    try:
        from database import get_database
        from video_queue_manager import VideoQueueManager
        from pipeline_scheduler import PipelineScheduler

        db = get_database()
        queue_manager = VideoQueueManager(db)

        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as count FROM video_queue WHERE status = 'queued'")
            cleared = cursor.fetchone()["count"]
            cursor.execute("DELETE FROM video_queue WHERE status = 'queued'")

        scheduler = PipelineScheduler(db=db)
        scheduler.poll_subscriptions()

        depth = queue_manager.get_queue_depth()

        return {
            "success": True,
            "cleared": cleared,
            "new_queue_depth": depth,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/deepdive/episodes")
async def deepdive_episodes(
    search: str = None,
    status: str = None,
    page: int = 1,
    limit: int = 20,
):
    """List episodes with pipeline status. Supports search, status filter, and pagination."""
    from database import Database

    db = Database()
    page = max(1, page)
    limit = max(1, min(100, limit))
    offset = (page - 1) * limit

    conditions = []
    params = []

    if search:
        conditions.append("(e.title LIKE ? OR e.channel_name LIKE ?)")
        like = f"%{search}%"
        params.extend([like, like])

    if status:
        conditions.append("vq.status = ?")
        params.append(status)

    where_sql = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    base_sql = f"""
        SELECT e.id, e.video_id, e.video_url, e.title, e.channel_name, e.language,
               e.analysis_date, e.created_at, e.published_at,
               vq.status as queue_status, vq.priority as queue_priority,
               vq.attempt_count, vq.error_message, vq.restaurants_found,
               vq.processing_started_at, vq.processing_completed_at,
               vq.published_at as queue_published_at,
               vq.video_title
        FROM episodes e
        LEFT JOIN video_queue vq ON e.video_id = vq.video_id
        {where_sql}
    """

    with db.get_connection() as conn:
        cursor = conn.cursor()

        count_cursor = conn.cursor()
        count_cursor.execute(f"SELECT COUNT(*) FROM ({base_sql}) sub", params)
        total = count_cursor.fetchone()[0]

        cursor.execute(
            base_sql
            + " ORDER BY COALESCE(e.published_at, vq.published_at, e.analysis_date, e.created_at) DESC LIMIT ? OFFSET ?",
            params + [limit, offset],
        )
        rows = cursor.fetchall()

    episodes = [dict(row) for row in rows]
    total_pages = (total + limit - 1) // limit

    return {
        "episodes": episodes,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": total_pages,
        },
    }


@app.get("/api/deepdive/episodes/{video_id}")
async def deepdive_episode_detail(video_id: str):
    """Full episode deep dive: episode, restaurants, queue info, and pipeline logs."""
    from database import Database

    db = Database()

    with db.get_connection() as conn:
        cursor = conn.cursor()

        # Episode
        cursor.execute("SELECT * FROM episodes WHERE video_id = ?", (video_id,))
        episode_row = cursor.fetchone()
        if not episode_row:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Episode not found")
        episode = dict(episode_row)

        # Restaurants linked to this episode
        cursor.execute(
            "SELECT * FROM restaurants WHERE episode_id = ? ORDER BY id",
            (episode_row["id"],),
        )
        restaurants = [dict(r) for r in cursor.fetchall()]

        # Queue info
        cursor.execute("SELECT * FROM video_queue WHERE video_id = ?", (video_id,))
        queue_row = cursor.fetchone()
        queue_info = dict(queue_row) if queue_row else None

        # Pipeline logs (keyed on queue id if available)
        pipeline_logs = []
        if queue_info:
            cursor.execute(
                "SELECT * FROM pipeline_logs WHERE video_queue_id = ? ORDER BY timestamp DESC",
                (queue_info["id"],),
            )
            pipeline_logs = [dict(l) for l in cursor.fetchall()]

    return {
        "episode": episode,
        "restaurants": restaurants,
        "queue_info": queue_info,
        "pipeline_logs": pipeline_logs,
    }


@app.get("/api/deepdive/restaurants/{restaurant_id}")
async def deepdive_restaurant_detail(restaurant_id: str):
    """Restaurant deep dive: restaurant record, related episode, and queue info."""
    from database import Database

    db = Database()

    with db.get_connection() as conn:
        cursor = conn.cursor()

        # Restaurant
        cursor.execute("SELECT * FROM restaurants WHERE id = ?", (restaurant_id,))
        restaurant_row = cursor.fetchone()
        if not restaurant_row:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Restaurant not found")
        restaurant = dict(restaurant_row)

        # Related episode
        episode = None
        queue_info = None
        episode_id = restaurant.get("episode_id")
        if episode_id:
            cursor.execute("SELECT * FROM episodes WHERE id = ?", (episode_id,))
            episode_row = cursor.fetchone()
            if episode_row:
                episode = dict(episode_row)
                video_id = episode.get("video_id")
                if video_id:
                    cursor.execute(
                        "SELECT * FROM video_queue WHERE video_id = ?", (video_id,)
                    )
                    queue_row = cursor.fetchone()
                    queue_info = dict(queue_row) if queue_row else None

    return {
        "restaurant": restaurant,
        "episode": episode,
        "queue_info": queue_info,
    }


@app.patch("/api/deepdive/restaurants/{restaurant_id}/visibility")
async def toggle_restaurant_visibility(restaurant_id: str, request: Request):
    """Toggle restaurant visibility (hide/unhide)."""
    from database import Database

    body = await request.json()
    is_hidden = body.get("is_hidden", False)

    db = Database()
    restaurant = db.get_restaurant(restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    # Convert truthy values to integer for SQLite
    hidden_val = 1 if is_hidden else 0
    success = db.update_restaurant(restaurant_id, is_hidden=hidden_val)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update visibility")

    updated = db.get_restaurant(restaurant_id)
    return updated


@app.post("/api/admin/deepdive/{video_id}/reprocess")
@app.post("/api/deepdive/{video_id}/reprocess")
async def reprocess_episode(video_id: str):
    """Re-queue a video for full pipeline reprocessing."""
    from database import Database

    db = Database()
    with db.get_connection() as conn:
        cursor = conn.cursor()

        # Look up the episode
        cursor.execute('SELECT * FROM episodes WHERE video_id = ?', (video_id,))
        episode_row = cursor.fetchone()
        if not episode_row:
            raise HTTPException(status_code=404, detail="Episode not found")

        episode = dict(episode_row)

        # Check existing queue entry
        cursor.execute('SELECT * FROM video_queue WHERE video_id = ?', (video_id,))
        queue_row = cursor.fetchone()
        if queue_row:
            queue_item = dict(queue_row)
            if queue_item['status'] in ('queued', 'processing'):
                return {"success": False, "error": f"Video is already {queue_item['status']}"}
            # Re-queue existing entry
            cursor.execute('''
                UPDATE video_queue
                SET status = 'queued', error_message = NULL,
                    attempt_count = attempt_count + 1,
                    updated_at = datetime('now')
                WHERE video_id = ?
            ''', (video_id,))
        else:
            # Insert new queue entry
            cursor.execute('''
                INSERT INTO video_queue (video_id, video_url, title, channel_name, status, priority, attempt_count, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'queued', 0, 1, datetime('now'), datetime('now'))
            ''', (video_id, episode.get('video_url', ''), episode.get('title', ''), episode.get('channel_name', '')))
        conn.commit()

    return {"success": True, "message": "Video queued for reprocessing"}


@app.post("/api/deepdive/fix-data")
async def fix_data():
    """One-time fix: resolve raw photo references to URLs and fix wrong published_at dates."""
    import requests as http_requests
    from database import Database

    db = Database()
    api_key = os.getenv('GOOGLE_PLACES_API_KEY', '')
    fixes = {'photo_fixes': 0, 'date_fixes': 0, 'errors': []}

    with db.get_connection() as conn:
        cursor = conn.cursor()

        # Fix 1: Resolve raw photo references in image_url
        cursor.execute("SELECT id, image_url, name_hebrew FROM restaurants WHERE image_url LIKE 'places/%'")
        raw_photo_rows = cursor.fetchall()

        for row in raw_photo_rows:
            rid = row['id']
            ref = row['image_url']
            name = row['name_hebrew']
            try:
                url = f"https://places.googleapis.com/v1/{ref}/media"
                params = {'maxWidthPx': '800', 'skipHttpRedirect': 'true', 'key': api_key}
                resp = http_requests.get(url, params=params)
                resp.raise_for_status()
                photo_uri = resp.json().get('photoUri')
                if photo_uri:
                    cursor.execute("UPDATE restaurants SET image_url = ? WHERE id = ?", (photo_uri, rid))
                    fixes['photo_fixes'] += 1
                else:
                    fixes['errors'].append(f"No photoUri for {name} ({rid})")
            except Exception as e:
                fixes['errors'].append(f"Photo fix error for {name}: {str(e)}")

        # Fix 2: Fix restaurants with wrong published_at (using episode's video_queue published_at)
        cursor.execute("""
            SELECT r.id, r.name_hebrew, r.published_at as r_pub, r.episode_id,
                   e.video_id, e.published_at as e_pub,
                   vq.published_at as vq_pub
            FROM restaurants r
            LEFT JOIN episodes e ON r.episode_id = e.id
            LEFT JOIN video_queue vq ON e.video_id = vq.video_id
            WHERE vq.published_at IS NOT NULL
              AND vq.published_at != ''
              AND (r.published_at IS NULL
                   OR r.published_at = ''
                   OR r.published_at != vq.published_at)
        """)
        date_rows = cursor.fetchall()

        for row in date_rows:
            rid = row['id']
            correct_date = row['vq_pub']
            name = row['name_hebrew']
            try:
                cursor.execute("UPDATE restaurants SET published_at = ? WHERE id = ?", (correct_date, rid))
                cursor.execute(
                    "UPDATE episodes SET published_at = ? WHERE id = ? AND (published_at IS NULL OR published_at = '' OR published_at != ?)",
                    (correct_date, row['episode_id'], correct_date)
                )
                fixes['date_fixes'] += 1
            except Exception as e:
                fixes['errors'].append(f"Date fix error for {name}: {str(e)}")

        # Fix 3: For episodes without video_queue published_at, try yt-dlp
        cursor.execute("""
            SELECT DISTINCT e.id as episode_id, e.video_id, e.published_at as e_pub
            FROM episodes e
            LEFT JOIN video_queue vq ON e.video_id = vq.video_id
            WHERE (vq.published_at IS NULL OR vq.published_at = '')
        """)
        missing_date_episodes = cursor.fetchall()

        for ep in missing_date_episodes:
            video_id = ep['video_id']
            try:
                import subprocess
                result = subprocess.run(
                    ['yt-dlp', '--skip-download', '--print', '%(upload_date)s', f'https://www.youtube.com/watch?v={video_id}'],
                    capture_output=True, text=True, timeout=30
                )
                upload_date = result.stdout.strip()
                if upload_date and len(upload_date) == 8:
                    # Format: YYYYMMDD -> YYYY-MM-DD
                    formatted = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}"
                    cursor.execute("UPDATE episodes SET published_at = ? WHERE id = ?", (formatted, ep['episode_id']))
                    cursor.execute("UPDATE restaurants SET published_at = ? WHERE episode_id = ?", (formatted, ep['episode_id']))
                    # Also update video_queue if it exists
                    cursor.execute("UPDATE video_queue SET published_at = ? WHERE video_id = ? AND (published_at IS NULL OR published_at = '')", (formatted, video_id))
                    fixes['date_fixes'] += 1
                    fixes.setdefault('yt_dlp_fixes', []).append(f"{video_id}: {formatted}")
            except Exception as e:
                fixes['errors'].append(f"yt-dlp date fix error for {video_id}: {str(e)}")

        # Fix 4: Backfill denormalized video/google columns from episodes
        try:
            cursor.execute("""
                UPDATE restaurants SET
                    video_url = (SELECT e.video_url FROM episodes e WHERE e.id = restaurants.episode_id),
                    video_id = (SELECT e.video_id FROM episodes e WHERE e.id = restaurants.episode_id),
                    channel_name = (SELECT e.channel_name FROM episodes e WHERE e.id = restaurants.episode_id)
                WHERE episode_id IS NOT NULL AND (video_url IS NULL OR video_url = '')
            """)
            fixes['backfill_video'] = cursor.rowcount
        except Exception as e:
            fixes['errors'].append(f"Backfill video error: {str(e)}")

        # Fix 5: Backfill google_url from google_place_id
        cursor.execute("SELECT id, google_place_id FROM restaurants WHERE google_place_id IS NOT NULL AND (google_url IS NULL OR google_url = '')")
        no_url_rows = cursor.fetchall()
        google_url_fixes = 0
        for row in no_url_rows:
            gurl = f"https://www.google.com/maps/place/?q=place_id:{row['google_place_id']}"
            cursor.execute("UPDATE restaurants SET google_url = ? WHERE id = ?", (gurl, row['id']))
            google_url_fixes += 1
        fixes['google_url_fixes'] = google_url_fixes

        conn.commit()

    return {"success": True, **fixes}


@app.get("/", include_in_schema=False)
async def root():
    """Root endpoint - redirects to docs."""
    return {
        "message": "Where2Eat API",
        "version": "2.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
    )
