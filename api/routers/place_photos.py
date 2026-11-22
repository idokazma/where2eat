"""Stored copies of Google Places photos, served from our own volume.

Owner decision (22.11.2026): copy each place's Google photos once instead of
paying Google for every view through /api/photos. Google's Maps Platform terms
forbid caching Places content; the owner accepted that risk.

These copies are kept apart from the curated venue images (venue_images.py,
which must never hold Google content). Each copy keeps its Google photo name
and photographer credit, and all of them can be removed in one call:
DELETE /api/admin/place-photos.
"""
import hashlib
import io
import os
import re
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError

from cost_ledger import BudgetExceeded, places_request
from database import Database
from routers.venue_images import asset_root, atomic_write, authorize_upload

router = APIRouter(tags=['Place photos'])
ASSET_NAME = re.compile(r'^[0-9a-f]{64}\.jpg$')
PHOTO_NAME = re.compile(r'^places/[A-Za-z0-9_-]+/photos/[A-Za-z0-9_-]+$')
MAX_SIDE = 1200
PLACES = 'https://places.googleapis.com/v1'


def photo_dir() -> Path:
    path = asset_root().parent / 'place_photos'
    path.mkdir(parents=True, exist_ok=True)
    return path


def shrink(raw: bytes):
    """Re-encode as a metadata-free JPEG, at most MAX_SIDE pixels on a side."""
    with Image.open(io.BytesIO(raw)) as image:
        if image.format not in ('JPEG', 'PNG', 'WEBP'):
            raise ValueError('Unsupported image format')
        image.load()
        clean = ImageOps.exif_transpose(image).convert('RGB')
    clean.thumbnail((MAX_SIDE, MAX_SIDE))
    out = io.BytesIO()
    clean.save(out, format='JPEG', quality=82, optimize=True, progressive=True)
    return out.getvalue(), clean.width, clean.height


@router.post('/api/admin/place-photos/store', dependencies=[Depends(authorize_upload)])
def store_place_photos(
    limit: int = Query(20, ge=1, le=100, description='Restaurants to process in this call'),
    per_place: int = Query(5, ge=1, le=10, description='Photos to keep per place'),
    restaurant_id: Optional[str] = Query(None, description='Process only this restaurant'),
    after: int = Query(0, ge=0, description='Continue after this cursor (next_after of the previous call)'),
):
    """Copy Google photos for visible restaurants that have none stored yet.

    Paid, once per place: one Place Details call for fresh photo names (stored
    names expire) plus one media call per photo, all through the cost ledger,
    so the monthly budget can stop a run. Call again with after=next_after to
    continue: places that fail are passed once per run, not retried forever.
    """
    api_key = os.environ.get('GOOGLE_PLACES_API_KEY')
    if not api_key:
        raise HTTPException(503, 'GOOGLE_PLACES_API_KEY is not configured')
    folder = photo_dir()
    db = Database()
    pending_sql = ("FROM restaurants r WHERE r.google_place_id IS NOT NULL AND r.google_place_id != '' "
                   "AND COALESCE(r.is_hidden, 0) = 0 "
                   "AND NOT EXISTS (SELECT 1 FROM place_photos p WHERE p.restaurant_id = r.id)")
    args: list = []
    if restaurant_id:
        pending_sql += ' AND r.id = ?'
        args.append(restaurant_id)
    with db.get_connection() as conn:
        rows = conn.execute(f'SELECT r.rowid AS cursor, r.id, r.google_place_id {pending_sql} '
                            'AND r.rowid > ? ORDER BY r.rowid LIMIT ?', args + [after, limit]).fetchall()

    result = {'processed': 0, 'next_after': after, 'restaurants_done': 0, 'photos_stored': 0,
              'failed': [], 'budget_stopped': False}
    for row in rows:
        rid, place_id = row['id'], row['google_place_id']
        result['processed'] += 1
        result['next_after'] = row['cursor']
        try:
            details = places_request('get', f'{PLACES}/places/{place_id}', timeout=20,
                                     headers={'X-Goog-Api-Key': api_key, 'X-Goog-FieldMask': 'photos'})
        except BudgetExceeded:
            result['budget_stopped'] = True
            break
        if details.status_code != 200:
            result['failed'].append({'restaurant_id': rid, 'reason': f'details {details.status_code}'})
            continue
        stored = []
        for photo in ((details.json() or {}).get('photos') or [])[:per_place]:
            name = photo.get('name') or ''
            if not PHOTO_NAME.fullmatch(name):
                continue
            try:
                media = places_request('get', f'{PLACES}/{name}/media', timeout=30,
                                       params={'maxWidthPx': MAX_SIDE, 'key': api_key})
            except BudgetExceeded:
                result['budget_stopped'] = True
                break
            if media.status_code != 200:
                continue
            try:
                content, width, height = shrink(media.content)
            except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
                continue
            digest = hashlib.sha256(content).hexdigest()
            target = folder / f'{digest}.jpg'
            if not target.exists():
                atomic_write(target, content)
            author = (photo.get('authorAttributions') or [{}])[0]
            stored.append((rid, len(stored), digest, width, height, name,
                           author.get('displayName'), author.get('uri')))
        if stored:
            with db.get_connection() as conn:
                conn.executemany(
                    'INSERT OR IGNORE INTO place_photos (restaurant_id, position, sha256, width, height, '
                    'google_photo_name, author_name, author_uri) VALUES (?,?,?,?,?,?,?,?)', stored)
            result['restaurants_done'] += 1
            result['photos_stored'] += len(stored)
        elif not result['budget_stopped']:
            result['failed'].append({'restaurant_id': rid, 'reason': 'no photo could be stored'})
        if result['budget_stopped']:
            break

    with db.get_connection() as conn:
        result['remaining'] = conn.execute(f'SELECT COUNT(*) {pending_sql}', args).fetchone()[0]
    return result


@router.delete('/api/admin/place-photos', dependencies=[Depends(authorize_upload)])
def delete_place_photos():
    """Remove every stored Google photo copy: rows, files and the proxy's saved copies."""
    db = Database()
    with db.get_connection() as conn:
        deleted_rows = conn.execute('DELETE FROM place_photos').rowcount
    deleted_files = 0
    for path in photo_dir().glob('*.jpg'):
        if ASSET_NAME.fullmatch(path.name) and path.is_file() and not path.is_symlink():
            path.unlink()
            deleted_files += 1
    # The photo proxy's read-through copies (routers/photos.py) go too.
    deleted_cached = 0
    cache = asset_root().parent / 'photo_cache'
    if cache.is_dir():
        for path in cache.iterdir():
            if path.is_file() and not path.is_symlink() and path.suffix in ('.jpg', '.miss'):
                deleted_cached += path.suffix == '.jpg'
                path.unlink()
    return {'deleted_rows': deleted_rows, 'deleted_files': deleted_files, 'deleted_cached': deleted_cached}


@router.get('/api/place-photos/{filename}')
def get_place_photo(filename: str):
    if not ASSET_NAME.fullmatch(filename):
        raise HTTPException(404, 'Image not found')
    path = photo_dir() / filename
    if path.is_symlink() or not path.is_file():
        raise HTTPException(404, 'Image not found')
    # Content-addressed: a file's bytes never change under its name.
    return FileResponse(path, media_type='image/jpeg', headers={
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
    })
