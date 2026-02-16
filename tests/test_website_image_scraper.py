"""Tests for website_image_scraper module - og:image extraction from restaurant websites."""

import os
import sys
import pytest
from unittest.mock import patch, MagicMock

# Add project paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from website_image_scraper import fetch_og_image


class TestFetchOgImage:
    """Tests for fetch_og_image function."""

    @patch('website_image_scraper.requests.get')
    def test_fetch_og_image_standard_html(self, mock_get):
        """Extract og:image from standard HTML meta tag."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '''
        <html>
        <head>
            <meta property="og:image" content="https://restaurant.com/hero.jpg" />
            <title>My Restaurant</title>
        </head>
        <body></body>
        </html>
        '''
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = fetch_og_image('https://restaurant.com')
        assert result == 'https://restaurant.com/hero.jpg'

    @patch('website_image_scraper.requests.get')
    def test_fetch_og_image_double_quotes(self, mock_get):
        """Extract og:image with double-quoted content attribute."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '<meta property="og:image" content="https://example.com/photo.png">'
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = fetch_og_image('https://example.com')
        assert result == 'https://example.com/photo.png'

    @patch('website_image_scraper.requests.get')
    def test_fetch_og_image_single_quotes(self, mock_get):
        """Extract og:image with single-quoted attributes."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "<meta property='og:image' content='https://example.com/photo.jpg'>"
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = fetch_og_image('https://example.com')
        assert result == 'https://example.com/photo.jpg'

    @patch('website_image_scraper.requests.get')
    def test_fetch_og_image_reversed_attributes(self, mock_get):
        """Extract og:image when content comes before property."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '<meta content="https://example.com/img.jpg" property="og:image">'
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = fetch_og_image('https://example.com')
        assert result == 'https://example.com/img.jpg'

    @patch('website_image_scraper.requests.get')
    def test_fetch_og_image_no_meta_tag(self, mock_get):
        """Return None when no og:image meta tag exists."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '<html><head><title>No OG</title></head><body></body></html>'
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = fetch_og_image('https://example.com')
        assert result is None

    @patch('website_image_scraper.requests.get')
    def test_fetch_og_image_empty_content(self, mock_get):
        """Return None when og:image content is empty."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '<meta property="og:image" content="">'
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = fetch_og_image('https://example.com')
        assert result is None

    @patch('website_image_scraper.requests.get')
    def test_fetch_og_image_timeout(self, mock_get):
        """Return None on request timeout."""
        import requests as req
        mock_get.side_effect = req.Timeout("Connection timed out")

        result = fetch_og_image('https://slow-restaurant.com')
        assert result is None

    @patch('website_image_scraper.requests.get')
    def test_fetch_og_image_connection_error(self, mock_get):
        """Return None on connection error."""
        import requests as req
        mock_get.side_effect = req.ConnectionError("Failed to connect")

        result = fetch_og_image('https://offline-restaurant.com')
        assert result is None

    @patch('website_image_scraper.requests.get')
    def test_fetch_og_image_http_error(self, mock_get):
        """Return None on HTTP error (404, 500, etc.)."""
        import requests as req
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = req.HTTPError("404 Not Found")
        mock_get.return_value = mock_response

        result = fetch_og_image('https://missing-restaurant.com')
        assert result is None

    def test_fetch_og_image_none_url(self):
        """Return None when URL is None."""
        result = fetch_og_image(None)
        assert result is None

    def test_fetch_og_image_empty_url(self):
        """Return None when URL is empty string."""
        result = fetch_og_image('')
        assert result is None

    @patch('website_image_scraper.requests.get')
    def test_fetch_og_image_relative_url_ignored(self, mock_get):
        """Return None for relative og:image URLs (not absolute http/https)."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '<meta property="og:image" content="/images/hero.jpg">'
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = fetch_og_image('https://example.com')
        assert result is None

    @patch('website_image_scraper.requests.get')
    def test_fetch_og_image_uses_timeout(self, mock_get):
        """Verify requests are made with a timeout."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '<meta property="og:image" content="https://example.com/img.jpg">'
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        fetch_og_image('https://example.com')
        mock_get.assert_called_once()
        call_kwargs = mock_get.call_args
        assert call_kwargs.kwargs.get('timeout') == 5 or call_kwargs[1].get('timeout') == 5

    @patch('website_image_scraper.requests.get')
    def test_fetch_og_image_case_insensitive_property(self, mock_get):
        """Extract og:image even with different casing in HTML."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '<META PROPERTY="og:image" CONTENT="https://example.com/img.jpg">'
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = fetch_og_image('https://example.com')
        assert result == 'https://example.com/img.jpg'
