"""Curated venue assets only. Never fetch URLs or host Google Places content."""
import hashlib
import hmac
import io
import json
import os
import re
import tempfile
import warnings
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from PIL import Image, ImageOps, UnidentifiedImageError

router = APIRouter(tags=['Venue images'])
bearer = HTTPBearer(auto_error=False)
MAX_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 16_000_000
ASSET_NAME = re.compile(r'^[0-9a-f]{64}\.jpg$')


def asset_root() -> Path:
    # In Railway fail closed unless DATABASE_DIR really lies on the mounted volume.
    data = Path(os.environ.get('DATABASE_DIR', str(Path(__file__).resolve().parents[2] / 'data'))).resolve()
    if os.environ.get('RAILWAY_ENVIRONMENT_ID'):
        mount = os.environ.get('RAILWAY_VOLUME_MOUNT_PATH')
        if not mount or not data.is_relative_to(Path(mount).resolve()):
            raise HTTPException(503, 'Persistent image storage is not configured')
    return data / 'venue_images'


async def authorize_upload(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    # Do not inherit the legacy admin JWT's development-default signing secret.
    secret = os.environ.get('API_SECRET_KEY', '')
    if len(secret) < 32:
        raise HTTPException(503, 'Image upload authentication is not configured')
    if not credentials or not hmac.compare_digest(credentials.credentials, secret):
        raise HTTPException(401, 'Not authenticated', headers={'WWW-Authenticate': 'Bearer'})


def atomic_write(path: Path, content: bytes):
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix='.upload-')
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


@router.post('/api/admin/venue-images', dependencies=[Depends(authorize_upload)])
async def upload_image(
    request: Request,
    restaurant_id: UUID = Query(...),
    source_url: str = Query(..., max_length=2000),
    credit: str = Query(..., min_length=1, max_length=300),
):
    """Return an asset path for review. Does not update any restaurant record."""
    if not source_url.startswith('https://'):
        raise HTTPException(422, 'An HTTPS source URL is required')
    raw = bytearray()
    async for chunk in request.stream():
        if len(raw) + len(chunk) > MAX_BYTES:
            raise HTTPException(413, 'Image exceeds 5 MiB')
        raw.extend(chunk)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as image:
                if image.format not in ('JPEG', 'PNG', 'WEBP'):
                    raise ValueError('Unsupported image format')
                if image.width * image.height > MAX_PIXELS or getattr(image, 'n_frames', 1) != 1:
                    raise ValueError('Image dimensions or animation not supported')
                image.load()
                clean = ImageOps.exif_transpose(image).convert('RGB')
                clean.thumbnail((1600, 1600))
                output = io.BytesIO()
                clean.save(output, format='JPEG', quality=88, optimize=True)
                content = output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombWarning, Image.DecompressionBombError):
        raise HTTPException(422, 'Invalid or unsupported image')
    digest = hashlib.sha256(content).hexdigest()
    root = asset_root()
    root.mkdir(parents=True, exist_ok=True)
    asset = root / (digest + '.jpg')
    atomic_write(asset, content)
    # Separate private provenance files, never mounted or returned by the public route.
    provenance = root / 'provenance'
    provenance.mkdir(exist_ok=True)
    record = {'restaurant_id': str(restaurant_id), 'source_url': source_url, 'credit': credit,
              'sha256': digest, 'uploaded_at': datetime.now(timezone.utc).isoformat()}
    atomic_write(provenance / (str(restaurant_id) + '-' + digest + '.json'),
                 json.dumps(record, ensure_ascii=False, indent=2).encode())
    return {'asset_path': '/api/venue-images/' + asset.name, 'sha256': digest,
            'bytes': len(content), 'restaurant_id': str(restaurant_id)}


@router.get('/api/venue-images/{filename}')
async def get_image(filename: str):
    if not ASSET_NAME.fullmatch(filename):
        raise HTTPException(404, 'Image not found')
    path = asset_root() / filename
    if path.is_symlink() or not path.is_file():
        raise HTTPException(404, 'Image not found')
    return FileResponse(path, media_type='image/jpeg', headers={
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
    })
