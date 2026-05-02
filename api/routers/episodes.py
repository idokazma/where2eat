"""Episode API endpoints.

Serves episode data with mention-level grouping (נטעם/הוזכר/reference_only).
"""

import os
import json
import uuid
from pathlib import Path
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, HTTPException, Query, Body

from models.episode import (
    EpisodeMention,
    EpisodeSummary,
    EpisodeSummaryList,
    EpisodeDetail,
)

router = APIRouter(prefix="/api/episodes", tags=["Episodes"])


def _get_data_directory() -> Path:
    """Get the data directory, respecting DATABASE_DIR env var for Railway volumes."""
    db_dir = os.getenv('DATABASE_DIR')
    if db_dir:
        return Path(db_dir)
    default_dir = Path(__file__).parent.parent.parent / "data"
    if default_dir.exists():
        return default_dir
    railway_dir = Path("/app/data")
    if railway_dir.exists():
        return railway_dir
    return default_dir


def _get_sqlite_db():
    """Get a native SQLite Database instance."""
    try:
        from database import Database
        db_path = _get_data_directory() / "where2eat.db"
        if db_path.exists():
            return Database(str(db_path))
    except Exception as e:
        print(f"Warning: Could not open SQLite database: {e}")
    return None


def _youtube_thumbnail(video_id: str) -> str:
    """Get YouTube video thumbnail URL."""
    return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"


@router.get(
    "",
    response_model=EpisodeSummaryList,
    summary="List episodes with mention counts",
    description="Returns all episodes that have restaurant mentions, with count summaries.",
)
async def list_episodes(
    limit: int = Query(50, ge=1, le=200, description="Max episodes to return"),
):
    """Get episodes with mention count summaries."""
    db = _get_sqlite_db()
    if not db:
        return EpisodeSummaryList(episodes=[], count=0)

    episodes = db.get_episodes_with_mention_counts()

    result = []
    for ep in episodes[:limit]:
        result.append(EpisodeSummary(
            id=ep['id'],
            video_id=ep['video_id'],
            title=ep.get('title'),
            channel_name=ep.get('channel_name'),
            published_at=ep.get('published_at'),
            episode_summary=ep.get('episode_summary'),
            thumbnail_url=_youtube_thumbnail(ep['video_id']),
            add_to_page_count=ep.get('add_to_page_count', 0),
            reference_only_count=ep.get('reference_only_count', 0),
            tasted_count=ep.get('tasted_count', 0),
            mentioned_count=ep.get('mentioned_count', 0),
        ))

    return EpisodeSummaryList(episodes=result, count=len(result))


@router.get(
    "/{video_id}",
    response_model=EpisodeDetail,
    summary="Get episode detail with grouped mentions",
    description="Returns full episode info with mentions grouped by level: tasted, mentioned, reference_only.",
)
async def get_episode_detail(video_id: str):
    """Get episode detail with all mentions grouped by level."""
    db = _get_sqlite_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Get episode info
    episodes = db.get_episodes_with_mention_counts()
    episode_data = next((ep for ep in episodes if ep['video_id'] == video_id), None)

    if not episode_data:
        raise HTTPException(status_code=404, detail=f"Episode {video_id} not found")

    episode_summary = EpisodeSummary(
        id=episode_data['id'],
        video_id=episode_data['video_id'],
        title=episode_data.get('title'),
        channel_name=episode_data.get('channel_name'),
        published_at=episode_data.get('published_at'),
        episode_summary=episode_data.get('episode_summary'),
        thumbnail_url=_youtube_thumbnail(video_id),
        add_to_page_count=episode_data.get('add_to_page_count', 0),
        reference_only_count=episode_data.get('reference_only_count', 0),
        tasted_count=episode_data.get('tasted_count', 0),
        mentioned_count=episode_data.get('mentioned_count', 0),
    )

    # Get all mentions for this episode
    mentions = db.get_episode_mentions(video_id)

    # Group by mention level
    tasted = []
    mentioned = []
    reference_only = []

    for m in mentions:
        if m['verdict'] == 'add_to_page':
            if m.get('mention_level') == 'נטעם':
                tasted.append(m)
            else:
                mentioned.append(m)
        elif m['verdict'] == 'reference_only':
            reference_only.append(m)
        # Skip rejected

    return EpisodeDetail(
        episode=episode_summary,
        mentions={
            "tasted": tasted,
            "mentioned": mentioned,
            "reference_only": reference_only,
        },
    )


@router.delete(
    "/reset",
    summary="Reset all episode data",
    description="Deletes all episodes, mentions, and restaurants. Use with caution.",
)
async def reset_all_data():
    """Delete all episodes, mentions, and restaurants."""
    db = _get_sqlite_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM episode_mentions")
        cursor.execute("DELETE FROM restaurants")
        cursor.execute("DELETE FROM episodes")
        conn.commit()
        r_count = cursor.execute("SELECT COUNT(*) FROM restaurants").fetchone()[0]
        e_count = cursor.execute("SELECT COUNT(*) FROM episodes").fetchone()[0]
        m_count = cursor.execute("SELECT COUNT(*) FROM episode_mentions").fetchone()[0]
    return {"status": "reset", "restaurants": r_count, "episodes": e_count, "mentions": m_count}


@router.post(
    "/seed",
    summary="Seed an episode extraction",
    description="Accepts a full extraction JSON and creates episode + mentions in DB.",
)
async def seed_extraction(extraction: Dict[str, Any] = Body(...)):
    """Seed episode data from an extraction JSON."""
    db = _get_sqlite_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    ep = extraction.get('episode', {})
    video_id = ep.get('video_id')
    if not video_id:
        raise HTTPException(status_code=400, detail="Missing episode.video_id")

    episode_id = ep.get('episode_id') or str(uuid.uuid4())

    # Create episode
    try:
        db.create_episode(
            video_id=video_id,
            video_url=ep.get('video_url', f'https://www.youtube.com/watch?v={video_id}'),
            title=ep.get('title', ''),
            channel_name=ep.get('channel_name', ''),
            published_at=ep.get('published_at'),
            episode_summary=ep.get('summary', ''),
            id=episode_id,
        )
    except Exception:
        # Episode exists — look up its ID
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM episodes WHERE video_id = ?", (video_id,))
            row = cursor.fetchone()
            if row:
                episode_id = row['id']
            else:
                raise HTTPException(status_code=500, detail="Could not create or find episode")

    # Save mentions
    mentions_added = 0
    restaurants = extraction.get('restaurants', [])
    for r in restaurants:
        verdict = r.get('verdict', '')
        if verdict == 'rejected':
            continue

        location = r.get('location', {}) or {}
        gp = r.get('google_places', {}) or {}
        production_db = r.get('production_db', {}) or {}
        timestamp = r.get('timestamp', {}) or {}

        # Ignore production_db.id — always look up fresh to avoid stale references
        restaurant_id = None

        # Find or create the restaurant (for both add_to_page and reference_only)
        with db.get_connection() as conn:
            cursor = conn.cursor()
            if gp.get('place_id'):
                cursor.execute("SELECT id FROM restaurants WHERE google_place_id = ?", (gp['place_id'],))
            else:
                cursor.execute("SELECT id FROM restaurants WHERE name_hebrew = ? AND video_id = ?",
                               (r.get('name_hebrew', ''), video_id))
            row = cursor.fetchone()
            if row:
                restaurant_id = row['id']

        # Create restaurant if not found
        if not restaurant_id:
            try:
                def _map_price(p):
                    return {'$':'זול','$$':'בינוני','$$$':'יקר','$$$$':'יקר מאוד'}.get(p, p)
                def _map_opinion(o):
                    return {'very_positive':'חיובית מאוד','positive':'חיובית','negative':'שלילית','mixed':'מעורבת','neutral':'ניטרלית'}.get(o, o)
                def _map_status(s):
                    return {'open':'פתוח','new':'חדש','closed':'נסגר'}.get(s, s)

                import json as _json
                is_hidden = verdict == 'reference_only'
                restaurant_id = db.create_restaurant(
                    name_hebrew=r.get('name_hebrew', ''),
                    episode_id=episode_id,
                    name_english=r.get('name_english'),
                    city=location.get('city'),
                    neighborhood=location.get('neighborhood'),
                    address=location.get('address'),
                    region=location.get('region'),
                    cuisine_type=r.get('cuisine_type'),
                    status=_map_status(r.get('status', 'open')),
                    price_range=_map_price(r.get('price_range', '')),
                    host_opinion=_map_opinion(r.get('host_opinion', '')),
                    host_comments=r.get('host_comments'),
                    menu_items=_json.dumps(r.get('dishes_mentioned', []), ensure_ascii=False) if r.get('dishes_mentioned') else None,
                    special_features=_json.dumps(r.get('special_features', []), ensure_ascii=False) if r.get('special_features') else None,
                    mention_context=r.get('mention_context'),
                    mention_timestamp=timestamp.get('seconds'),
                    google_place_id=gp.get('place_id'),
                    google_name=r.get('google_name'),
                    google_rating=gp.get('rating'),
                    google_user_ratings_total=gp.get('review_count'),
                    google_url=gp.get('google_url'),
                    latitude=location.get('latitude'),
                    longitude=location.get('longitude'),
                    image_url=gp.get('photo_url'),
                    video_url=ep.get('video_url', f'https://www.youtube.com/watch?v={video_id}'),
                    video_id=video_id,
                    channel_name=ep.get('channel_name'),
                    country='Israel',
                    engaging_quote=(r.get('host_quotes', []) or [None])[0],
                    contact_phone=gp.get('phone'),
                    contact_website=gp.get('website'),
                    instagram_url=gp.get('instagram_url'),
                    mention_level=r.get('sub_tag'),
                    published_at=ep.get('published_at'),
                    is_hidden=is_hidden,
                )
            except Exception as e:
                print(f"[SEED] Failed to create restaurant {r.get('name_hebrew', '?')}: {e}")

        try:
            db.save_episode_mention({
                'episode_id': episode_id,
                'restaurant_id': restaurant_id,
                'video_id': video_id,
                'name_hebrew': r.get('name_hebrew', ''),
                'name_english': r.get('name_english'),
                'verdict': verdict,
                'mention_level': r.get('sub_tag') or r.get('mention_level'),
                'status': r.get('status'),
                'timestamp_seconds': timestamp.get('seconds'),
                'timestamp_display': timestamp.get('display'),
                'speaker': r.get('speaker'),
                'host_quotes': r.get('host_quotes'),
                'host_comments': r.get('host_comments'),
                'dishes_mentioned': r.get('dishes_mentioned'),
                'mention_context': r.get('mention_context'),
                'skip_reason': r.get('skip_reason'),
                'city': location.get('city'),
                'cuisine_type': r.get('cuisine_type'),
                'host_opinion': r.get('host_opinion'),
                'google_place_id': gp.get('place_id'),
                'latitude': location.get('latitude'),
                'longitude': location.get('longitude'),
            })
            mentions_added += 1
        except Exception as e:
            print(f"[SEED] Failed to save mention {r.get('name_hebrew', '?')}: {e}")
            continue

    # Backfill mention_level on restaurants
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE restaurants SET mention_level = (
                SELECT em.mention_level FROM episode_mentions em
                WHERE em.restaurant_id = restaurants.id
                AND em.mention_level IS NOT NULL
                ORDER BY em.created_at DESC LIMIT 1
            )
            WHERE id IN (
                SELECT DISTINCT restaurant_id FROM episode_mentions
                WHERE restaurant_id IS NOT NULL AND mention_level IS NOT NULL
            )
        ''')
        conn.commit()

    return {"status": "ok", "episode_id": episode_id, "mentions_added": mentions_added}
