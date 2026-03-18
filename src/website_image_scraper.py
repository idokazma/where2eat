"""
Scrape og:image meta tags from restaurant websites.
Used as a high-quality image source in the multi-source image priority system.
"""

import re
import logging
from typing import Optional

import requests

logger = logging.getLogger(__name__)

# Match <meta property="og:image" content="..."> in either attribute order
_OG_IMAGE_PATTERN = re.compile(
    r'<meta\s+'
    r'(?:'
    r'property=["\']og:image["\']\s+content=["\']([^"\']+)["\']'
    r'|'
    r'content=["\']([^"\']+)["\']\s+property=["\']og:image["\']'
    r')',
    re.IGNORECASE,
)


def fetch_og_image(website_url: Optional[str]) -> Optional[str]:
    """Fetch the og:image URL from a restaurant website.

    Args:
        website_url: The restaurant's website URL.

    Returns:
        Absolute image URL if found, None otherwise.
    """
    if not website_url:
        return None

    try:
        response = requests.get(
            website_url,
            timeout=5,
            headers={'User-Agent': 'Where2EatBot/1.0'},
            allow_redirects=True,
        )
        response.raise_for_status()

        match = _OG_IMAGE_PATTERN.search(response.text)
        if not match:
            return None

        # Either group 1 or group 2 will have the URL depending on attribute order
        image_url = match.group(1) or match.group(2)
        if not image_url:
            return None

        # Only accept absolute URLs
        if not image_url.startswith(('http://', 'https://')):
            return None

        return image_url

    except requests.RequestException:
        logger.debug(f"Failed to fetch og:image from {website_url}")
        return None
    except Exception:
        logger.debug(f"Unexpected error fetching og:image from {website_url}")
        return None
