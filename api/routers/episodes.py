"""Episode API endpoints.

Serves episode data with mention-level grouping (נטעם/הוזכר/reference_only).
"""

import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

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
