"""Offline publication checks. Evidence is recorded by a reviewer, not inferred here.

Never performs paid lookup, downloads, scheduling, or production writes.
"""
import hashlib
import math
import json
import os
import tempfile
import re
from pathlib import Path
from urllib.parse import urlparse

ASSET_PATH = re.compile(r'^/api/venue-images/([0-9a-f]{64})\.jpg$')
ASSET_HOST = 'where2eat-production.up.railway.app'


def _https(value):
    try:
        parsed = urlparse(value)
        return parsed.scheme == 'https' and bool(parsed.hostname) and not parsed.username and not parsed.password
    except (TypeError, ValueError):
        return False


def _number(value):
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def publication_issues(restaurants, segments, video_id, asset_root=None):
    """Return all blockers before *any* episode/restaurant write.

    Metadata is an auditable reviewer assertion, not automated proof of identity,
    rights, or semantic discussion. Timed transcript quotes and local image bytes
    are independently checked. A missing photo must be explicit, never silently
    replaced with a logo, placeholder, unrelated venue or signed social URL.
    """
    issues = []
    if not isinstance(restaurants, list):
        return [{'issues': ['restaurants_must_be_array']}]
    segments = segments if isinstance(segments, list) else []
    valid_segments = [s for s in segments if isinstance(s, dict) and _number(s.get('start'))
                      and isinstance(s.get('text'), str)]
    duration = max((s['start'] + (s.get('duration') if _number(s.get('duration')) else 0)
                    for s in valid_segments), default=0)
    for index, row in enumerate(restaurants):
        if not isinstance(row, dict):
            issues.append({'index': index, 'issues': ['restaurant_must_be_object']})
            continue
        if row.get('verdict') in ('rejected', 'reference_only'):
            continue
        errors = []
        review = row.get('publication_review') or {}
        if not isinstance(review, dict):
            review = {}
        identity = review.get('identity') or {}
        if not isinstance(identity, dict):
            identity = {}
        clues = identity.get('context_clues') or {}
        if (identity.get('status') != 'verified' or not _https(identity.get('source_url'))
                or not isinstance(clues, dict) or not any(clues.get(k) for k in ('city', 'address', 'chef', 'branch'))
                or not identity.get('source_name') or not identity.get('transcript_name')):
            errors.append('identity_context_unverified')
        time = review.get('discussion') or {}
        if not isinstance(time, dict):
            time = {}
        timestamp = row.get('timestamp') or {}
        seconds = row.get('mention_timestamp_seconds', timestamp.get('seconds') if isinstance(timestamp, dict) else None)
        if not _number(seconds) or not valid_segments or seconds > duration:
            errors.append('timestamp_missing_or_out_of_range')
        elif (time.get('kind') != 'discussion' or time.get('selected_seconds') != seconds
              or time.get('video_id') != video_id or not time.get('all_occurrences_reviewed') is True):
            errors.append('discussion_not_reviewed')
        else:
            quote = time.get('quote')
            # Discussion can start before the name, but evidence must be nearby.
            nearby = ' '.join(s['text'] for s in valid_segments if seconds - 10 <= s['start'] <= seconds + 60)
            if not isinstance(quote, str) or len(quote.strip()) < 8 or quote not in nearby:
                errors.append('discussion_quote_not_in_timed_source')
            if not any(abs(s['start'] - seconds) <= 1 for s in valid_segments):
                errors.append('timestamp_not_at_source_segment')
        photo = review.get('photo') or {}
        if not isinstance(photo, dict):
            photo = {}
        gp = row.get('google_places') or {}
        if not isinstance(gp, dict):
            gp = {}
        image = row.get('image_url') or gp.get('photo_url')
        if photo.get('status') == 'unavailable':
            if not photo.get('reason') or image or row.get('photos'):
                errors.append('missing_photo_requires_empty_image_and_reason')
        elif photo.get('status') == 'verified':
            source_kind = photo.get('source_kind')
            if (source_kind not in ('venue_owned', 'venue_booking_listing', 'venue_delivery_listing')
                    or not _https(photo.get('source_url')) or not photo.get('credit')
                    or photo.get('identity_checked') is not True or photo.get('pixels_checked') is not True
                    or photo.get('content_kind') not in ('food', 'interior')):
                errors.append('venue_photo_evidence_missing')
            if not _https(image):
                errors.append('durable_photo_required')
            else:
                parsed = urlparse(image)
                match = ASSET_PATH.fullmatch(parsed.path)
                if (parsed.hostname != ASSET_HOST or parsed.query or parsed.fragment or not match
                        or photo.get('sha256') != (match.group(1) if match else None)):
                    errors.append('durable_photo_required')
                elif asset_root is None:
                    errors.append('local_photo_storage_not_configured')
                else:
                    path = Path(asset_root) / (match.group(1) + '.jpg')
                    if path.is_symlink() or not path.is_file() or path.stat().st_size > 8 * 1024 * 1024 or hashlib.sha256(path.read_bytes()).hexdigest() != match.group(1):
                        errors.append('durable_photo_bytes_missing_or_changed')
        else:
            errors.append('photo_review_missing')
        if errors:
            issues.append({'index': index, 'name': row.get('name_hebrew') or row.get('name_english'), 'issues': errors})
    return issues


def save_review_draft(video_id, restaurants, segments, report, data_root):
    """Keep analysis for manual correction without re-running a paid provider."""
    if not isinstance(video_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', video_id):
        raise ValueError('Invalid review draft video ID')
    root = Path(data_root) / 'publication_reviews'
    root.mkdir(parents=True, exist_ok=True)
    content = {'episode': {'video_id': video_id}, 'restaurants': restaurants,
               'transcript_segments': segments, 'quality_report': report}
    encoded = json.dumps(content, ensure_ascii=False, sort_keys=True, indent=2)
    digest = hashlib.sha256(encoded.encode('utf-8')).hexdigest()[:16]
    path = root / (video_id + '-' + digest + '.json')
    fd, temporary = tempfile.mkstemp(dir=root, prefix='.review-')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as file:
            file.write(encoded)
            file.flush(); os.fsync(file.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return str(path)
