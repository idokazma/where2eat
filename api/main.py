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

from fastapi import FastAPI, Request
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
    health_router,
    admin_router,
    admin_subscriptions_router,
    admin_pipeline_router,
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
        result = collector.get_transcript(DEFAULT_VIDEO_URL, languages=['he', 'iw', 'en'])

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

            if not existing.get("users"):
                from passlib.context import CryptContext
                pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
                print(f"[SEED] Admin users already exist ({len(existing['users'])} users)")
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
        spec2 = importlib.util.spec_from_file_location("src_models_restaurant", src_restaurant_path)
        src_models_restaurant = importlib.util.module_from_spec(spec2)
        spec2.loader.exec_module(src_models_restaurant)
        EpisodeModel = src_models_restaurant.Episode
        RestaurantModel = src_models_restaurant.Restaurant

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
            for r in restaurants:
                existing = session.query(RestaurantModel).filter_by(id=r['id']).first()
                if existing:
                    continue
                location = r.get('location', {})
                contact = r.get('contact_info', {})
                rating = r.get('rating', {})
                restaurant_model = RestaurantModel(
                    id=r['id'],
                    episode_id=r.get('episode_id'),
                    name_hebrew=r.get('name_hebrew', 'Unknown'),
                    name_english=r.get('name_english'),
                    city=location.get('city'),
                    neighborhood=location.get('neighborhood'),
                    address=location.get('address'),
                    region=location.get('region', 'Center'),
                    latitude=r.get('latitude'),
                    longitude=r.get('longitude'),
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
                    mention_context=r.get('mention_context'),
                    mention_timestamp=r.get('mention_timestamp'),
                    google_place_id=r.get('google_place_id'),
                    google_rating=rating.get('google_rating'),
                    google_user_ratings_total=rating.get('user_ratings_total'),
                    image_url=r.get('image_url'),
                )
                session.add(restaurant_model)
                synced_restaurants += 1

            session.commit()

        print(f"[SYNC] Synced {synced_episodes} new episodes and {synced_restaurants} new restaurants to PostgreSQL")

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


@asynccontextmanager
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

# Configure CORS
allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",") if os.getenv("ALLOWED_ORIGINS") else [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://where2eat.vercel.app",
    "https://where2eat-delta.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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

# Include routers
app.include_router(health_router)
app.include_router(restaurants_router)
app.include_router(analytics_router)
app.include_router(analyze_router)
app.include_router(places_router)
app.include_router(admin_router)
app.include_router(admin_subscriptions_router)
app.include_router(admin_pipeline_router)


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
