"""
Tactiq Transcript Fetcher
Uses browser automation to fetch YouTube transcripts via Tactiq's free web tool.
"""

import asyncio
import re
import json
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import logging

try:
    from playwright.async_api import async_playwright, Browser, Page, TimeoutError as PlaywrightTimeout
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False


@dataclass
class TranscriptResult:
    """Result of fetching a transcript."""
    video_id: str
    video_url: str
    title: Optional[str]
    transcript: Optional[str]
    language: Optional[str]
    success: bool
    error: Optional[str] = None
    source: str = "tactiq"


class TactiqTranscriptFetcher:
    """
    Fetches YouTube transcripts using Tactiq's free web tool via browser automation.

    Tactiq URL: https://tactiq.io/tools/youtube-transcript
    """

    TACTIQ_URL = "https://tactiq.io/tools/youtube-transcript"

    def __init__(self, headless: bool = True, timeout: int = 30000):
        """
        Initialize the Tactiq fetcher.

        Args:
            headless: Run browser in headless mode (no GUI)
            timeout: Default timeout for operations in milliseconds
        """
        if not PLAYWRIGHT_AVAILABLE:
            raise ImportError(
                "Playwright not installed. Install with: pip install playwright && playwright install chromium"
            )

        self.headless = headless
        self.timeout = timeout
        self.logger = logging.getLogger(__name__)
        self._browser: Optional[Browser] = None
        self._playwright = None

    async def __aenter__(self):
        """Async context manager entry."""
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()

    async def start(self):
        """Start the browser."""
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(headless=self.headless)
        self.logger.info("Browser started")

    async def close(self):
        """Close the browser."""
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        self.logger.info("Browser closed")

    def _extract_video_id(self, url: str) -> Optional[str]:
        """Extract video ID from YouTube URL."""
        patterns = [
            r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
            r'(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})',
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    async def get_transcript(self, video_url: str) -> TranscriptResult:
        """
        Fetch transcript for a YouTube video using Tactiq.

        Args:
            video_url: YouTube video URL

        Returns:
            TranscriptResult with transcript data
        """
        video_id = self._extract_video_id(video_url)
        if not video_id:
            return TranscriptResult(
                video_id="unknown",
                video_url=video_url,
                title=None,
                transcript=None,
                language=None,
                success=False,
                error="Invalid YouTube URL"
            )

        # Normalize URL
        video_url = f"https://www.youtube.com/watch?v={video_id}"

        if not self._browser:
            await self.start()

        page = await self._browser.new_page()

        try:
            self.logger.info(f"Fetching transcript for: {video_id}")

            # Navigate to Tactiq
            await page.goto(self.TACTIQ_URL, timeout=self.timeout)

            # Wait for the input field to be visible
            await page.wait_for_selector('input[type="text"], input[type="url"], input[placeholder*="youtube" i], input[placeholder*="url" i]', timeout=self.timeout)

            # Find and fill the URL input
            # Try multiple selectors for the input field
            input_selectors = [
                'input[placeholder*="youtube" i]',
                'input[placeholder*="url" i]',
                'input[placeholder*="paste" i]',
                'input[type="url"]',
                'input[type="text"]',
            ]

            input_element = None
            for selector in input_selectors:
                try:
                    input_element = await page.query_selector(selector)
                    if input_element:
                        break
                except:
                    continue

            if not input_element:
                return TranscriptResult(
                    video_id=video_id,
                    video_url=video_url,
                    title=None,
                    transcript=None,
                    language=None,
                    success=False,
                    error="Could not find URL input field on Tactiq page"
                )

            # Clear and type the URL
            await input_element.fill("")
            await input_element.type(video_url, delay=50)

            # Find and click the submit button
            button_selectors = [
                'button:has-text("Get")',
                'button:has-text("Transcript")',
                'button:has-text("Generate")',
                'button:has-text("Submit")',
                'button[type="submit"]',
                'form button',
            ]

            button_clicked = False
            for selector in button_selectors:
                try:
                    button = await page.query_selector(selector)
                    if button:
                        await button.click()
                        button_clicked = True
                        break
                except:
                    continue

            if not button_clicked:
                # Try pressing Enter on the input
                await input_element.press("Enter")

            # Wait for transcript to load
            # Look for transcript content area
            transcript_selectors = [
                '[class*="transcript" i]',
                '[id*="transcript" i]',
                'pre',
                '[class*="result" i]',
                '[class*="output" i]',
                'textarea[readonly]',
            ]

            await asyncio.sleep(3)  # Initial wait for processing

            transcript_text = None
            video_title = None

            # Wait up to 30 seconds for transcript
            for attempt in range(10):
                await asyncio.sleep(2)

                # Try to find transcript content
                for selector in transcript_selectors:
                    try:
                        elements = await page.query_selector_all(selector)
                        for element in elements:
                            text = await element.inner_text()
                            if text and len(text) > 100:  # Likely transcript content
                                transcript_text = text
                                break
                    except:
                        continue

                if transcript_text:
                    break

                # Check for error messages
                error_selectors = ['[class*="error" i]', '[class*="alert" i]']
                for selector in error_selectors:
                    try:
                        error_el = await page.query_selector(selector)
                        if error_el:
                            error_text = await error_el.inner_text()
                            if "error" in error_text.lower() or "not available" in error_text.lower():
                                return TranscriptResult(
                                    video_id=video_id,
                                    video_url=video_url,
                                    title=None,
                                    transcript=None,
                                    language=None,
                                    success=False,
                                    error=f"Tactiq error: {error_text[:200]}"
                                )
                    except:
                        continue

            if not transcript_text:
                # Try to get page content as fallback
                content = await page.content()

                # Look for transcript in page source
                # Sometimes it's embedded in JavaScript
                transcript_match = re.search(r'"transcript":\s*"([^"]+)"', content)
                if transcript_match:
                    transcript_text = transcript_match.group(1).replace('\\n', '\n')

            if not transcript_text:
                return TranscriptResult(
                    video_id=video_id,
                    video_url=video_url,
                    title=video_title,
                    transcript=None,
                    language=None,
                    success=False,
                    error="Transcript not found or not available for this video"
                )

            # Try to extract title
            try:
                title_el = await page.query_selector('h1, h2, [class*="title" i]')
                if title_el:
                    video_title = await title_el.inner_text()
            except:
                pass

            return TranscriptResult(
                video_id=video_id,
                video_url=video_url,
                title=video_title,
                transcript=transcript_text.strip(),
                language="en",  # Tactiq currently only supports English
                success=True
            )

        except PlaywrightTimeout as e:
            self.logger.error(f"Timeout fetching transcript for {video_id}: {e}")
            return TranscriptResult(
                video_id=video_id,
                video_url=video_url,
                title=None,
                transcript=None,
                language=None,
                success=False,
                error=f"Timeout: {str(e)}"
            )
        except Exception as e:
            self.logger.error(f"Error fetching transcript for {video_id}: {e}")
            return TranscriptResult(
                video_id=video_id,
                video_url=video_url,
                title=None,
                transcript=None,
                language=None,
                success=False,
                error=str(e)
            )
        finally:
            await page.close()

    async def get_transcripts_batch(
        self,
        video_urls: List[str],
        max_videos: int = 10,
        delay_between: float = 3.0
    ) -> List[TranscriptResult]:
        """
        Fetch transcripts for multiple videos.

        Args:
            video_urls: List of YouTube video URLs
            max_videos: Maximum number of videos to process
            delay_between: Delay between requests in seconds

        Returns:
            List of TranscriptResult objects
        """
        results = []

        for i, url in enumerate(video_urls[:max_videos]):
            self.logger.info(f"Processing video {i+1}/{min(len(video_urls), max_videos)}")
            result = await self.get_transcript(url)
            results.append(result)

            if i < min(len(video_urls), max_videos) - 1:
                await asyncio.sleep(delay_between)

        return results


async def fetch_transcript_with_tactiq(video_url: str, headless: bool = True) -> TranscriptResult:
    """
    Convenience function to fetch a single transcript.

    Args:
        video_url: YouTube video URL
        headless: Run browser in headless mode

    Returns:
        TranscriptResult with transcript data
    """
    async with TactiqTranscriptFetcher(headless=headless) as fetcher:
        return await fetcher.get_transcript(video_url)


async def fetch_transcripts_batch(
    video_urls: List[str],
    max_videos: int = 10,
    headless: bool = True
) -> List[TranscriptResult]:
    """
    Convenience function to fetch multiple transcripts.

    Args:
        video_urls: List of YouTube video URLs
        max_videos: Maximum number of videos to process
        headless: Run browser in headless mode

    Returns:
        List of TranscriptResult objects
    """
    async with TactiqTranscriptFetcher(headless=headless) as fetcher:
        return await fetcher.get_transcripts_batch(video_urls, max_videos)


# Synchronous wrapper for easier use
def get_transcript_sync(video_url: str, headless: bool = True) -> TranscriptResult:
    """
    Synchronous wrapper to fetch a transcript.

    Args:
        video_url: YouTube video URL
        headless: Run browser in headless mode

    Returns:
        TranscriptResult with transcript data
    """
    return asyncio.run(fetch_transcript_with_tactiq(video_url, headless))


def get_transcripts_batch_sync(
    video_urls: List[str],
    max_videos: int = 10,
    headless: bool = True
) -> List[TranscriptResult]:
    """
    Synchronous wrapper to fetch multiple transcripts.

    Args:
        video_urls: List of YouTube video URLs
        max_videos: Maximum number of videos to process
        headless: Run browser in headless mode

    Returns:
        List of TranscriptResult objects
    """
    return asyncio.run(fetch_transcripts_batch(video_urls, max_videos, headless))
