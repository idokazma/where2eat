"""
Instagram Enricher for Where2Eat.

Discovers Instagram profile URLs for restaurants by:
1. Scraping the restaurant's website for Instagram links
2. Falling back to a Google search if no website or no link found
"""

import logging
import re
import time
from typing import Optional
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

logger = logging.getLogger(__name__)

# Match instagram.com profile URLs (not /p/ posts, /reel/, etc.)
INSTAGRAM_PROFILE_RE = re.compile(
    r'https?://(?:www\.)?instagram\.com/([a-zA-Z0-9_.]+)/?(?:\?[^"\']*)?',
)

# URLs to ignore (not actual restaurant profiles)
INSTAGRAM_IGNORE = {'instagram.com', 'explore', 'p', 'reel', 'stories', 'accounts', 'about', 'developer', 'legal'}

USER_AGENT = 'Where2Eat/1.0 (restaurant discovery)'


def _fetch_url(url: str, timeout: int = 15) -> Optional[str]:
    """Fetch URL content as string. Returns None on failure."""
    try:
        req = Request(url, headers={'User-Agent': USER_AGENT})
        with urlopen(req, timeout=timeout) as resp:
            content_type = resp.headers.get('Content-Type', '')
            if 'text/html' not in content_type and 'text/plain' not in content_type:
                return None
            return resp.read(500_000).decode('utf-8', errors='ignore')
    except (URLError, HTTPError, OSError, UnicodeDecodeError) as e:
        logger.debug("Failed to fetch %s: %s", url, e)
        return None


def _extract_instagram_from_html(html: str) -> Optional[str]:
    """Extract the first Instagram profile URL from HTML content."""
    matches = INSTAGRAM_PROFILE_RE.findall(html)
    for handle in matches:
        handle_lower = handle.lower().rstrip('/')
        if handle_lower in INSTAGRAM_IGNORE:
            continue
        # Skip common non-profile patterns
        if handle_lower.startswith(('p/', 'reel/', 'stories/')):
            continue
        return f'https://www.instagram.com/{handle}/'
    return None


def discover_instagram_from_website(website_url: str) -> Optional[str]:
    """Scrape a restaurant website for Instagram profile links.

    Args:
        website_url: The restaurant's website URL.

    Returns:
        Instagram profile URL or None.
    """
    if not website_url:
        return None

    # Normalize URL
    if not website_url.startswith('http'):
        website_url = 'https://' + website_url

    html = _fetch_url(website_url)
    if not html:
        return None

    return _extract_instagram_from_html(html)


def discover_instagram_from_google(
    name_hebrew: str,
    name_english: Optional[str] = None,
    city: Optional[str] = None,
) -> Optional[str]:
    """Search Google for the restaurant's Instagram page.

    Uses a simple Google search and parses the results page for Instagram links.
    This is a fallback when the restaurant website doesn't link to Instagram.

    Args:
        name_hebrew: Restaurant name in Hebrew.
        name_english: Restaurant name in English (optional).
        city: City name for disambiguation (optional).

    Returns:
        Instagram profile URL or None.
    """
    # Build search query — prefer English name for Google, add city
    name = name_english or name_hebrew
    query_parts = [f'"{name}"', 'instagram']
    if city:
        query_parts.append(city)
    query = ' '.join(query_parts)

    search_url = f'https://www.google.com/search?q={_url_encode(query)}&num=5'

    html = _fetch_url(search_url)
    if not html:
        return None

    return _extract_instagram_from_html(html)


def discover_instagram(
    name_hebrew: str,
    name_english: Optional[str] = None,
    website_url: Optional[str] = None,
    city: Optional[str] = None,
    google_name: Optional[str] = None,
) -> Optional[str]:
    """Discover Instagram profile URL using all available strategies.

    Strategy order:
    1. Scrape restaurant website for Instagram links (most reliable)
    2. Google search fallback

    Args:
        name_hebrew: Restaurant name in Hebrew.
        name_english: Restaurant name in English.
        website_url: Restaurant website URL (from Google Places).
        city: City name for disambiguation.
        google_name: Google Places business name.

    Returns:
        Instagram profile URL or None.
    """
    # Strategy 1: Website scraping
    if website_url:
        result = discover_instagram_from_website(website_url)
        if result:
            logger.info("Found Instagram for %s via website: %s", name_hebrew, result)
            return result

    # Strategy 2: Google search
    result = discover_instagram_from_google(
        name_hebrew=name_hebrew,
        name_english=name_english or google_name,
        city=city,
    )
    if result:
        logger.info("Found Instagram for %s via Google: %s", name_hebrew, result)
        return result

    logger.info("No Instagram found for %s", name_hebrew)
    return None


def _url_encode(s: str) -> str:
    """Simple URL encoding for search queries."""
    from urllib.parse import quote_plus
    return quote_plus(s)
