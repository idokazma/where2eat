"""
Quote Fixer for Where2Eat.

Uses Gemini to fix typos in Hebrew host_comments quotes
while preserving the original meaning exactly.
"""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


def fix_quote_typos(text: str) -> str:
    """Fix typos in a Hebrew quote using Gemini.

    Sends the text to Gemini with instructions to only fix typos,
    not change meaning or style. Returns the original text on any failure.

    Args:
        text: The Hebrew quote text to fix.

    Returns:
        The fixed text, or the original if Gemini is unavailable or fails.
    """
    if not text or len(text.strip()) < 5:
        return text

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        logger.debug("No Gemini API key available, returning original quote")
        return text

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")

        response = model.generate_content(
            f"תקן שגיאות כתיב בלבד בציטוט הבא. אל תשנה את התוכן, הסגנון או המשמעות. החזר רק את הטקסט המתוקן, בלי הסברים.\n\n{text}",
            generation_config=genai.GenerationConfig(
                temperature=0.0,
                max_output_tokens=1024,
            ),
        )

        fixed = response.text.strip()

        # Sanity check: if Gemini returned something wildly different length, keep original
        if not fixed or len(fixed) > len(text) * 2 or len(fixed) < len(text) * 0.3:
            logger.warning("Gemini returned suspicious output for quote, keeping original")
            return text

        return fixed

    except ImportError:
        logger.debug("google-generativeai not installed, returning original quote")
        return text
    except Exception as e:
        logger.warning("Gemini quote fix failed: %s", e)
        return text
