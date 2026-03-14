"""
Unified Restaurant Analyzer
Uses configurable LLM providers (OpenAI/Claude) for Hebrew restaurant extraction
"""

import os
import json
import re
import logging
from datetime import datetime
from typing import Dict, List, Optional, Union
from dataclasses import dataclass, asdict

from llm_config import get_config, LLMProvider

@dataclass
class RestaurantInfo:
    """Data structure for restaurant information"""
    name_hebrew: str
    name_english: str
    city: str
    neighborhood: Optional[str]
    address: Optional[str]
    region: str
    cuisine_type: str
    status: str
    price_range: str
    host_opinion: str
    host_comments: str
    menu_items: List[str]
    special_features: List[str]
    contact_info: Dict[str, Optional[str]]
    business_news: Optional[str]
    mention_context: str

class UnifiedRestaurantAnalyzer:
    """LLM-powered restaurant analyzer using configurable providers"""
    
    def __init__(self):
        """Initialize the analyzer with LLM configuration"""
        self.config = get_config()
        self.logger = logging.getLogger(__name__)
        
        # Set up logging
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)
        
        # Initialize the appropriate LLM client
        if self.config.provider == "openai":
            self._init_openai_client()
        elif self.config.provider == "gemini":
            self._init_gemini_client()
        else:
            self._init_claude_client()

    def _init_openai_client(self):
        """Initialize OpenAI client"""
        try:
            import openai
            self.client = openai.OpenAI(api_key=self.config.get_active_api_key())
            self.logger.info(f"Initialized OpenAI client with model: {self.config.get_active_model()}")
        except ImportError:
            raise ImportError("OpenAI package not installed. Run: pip install openai")
        except Exception as e:
            raise ValueError(f"Failed to initialize OpenAI client: {str(e)}")

    def _init_claude_client(self):
        """Initialize Claude/Anthropic client"""
        try:
            import anthropic
            self.client = anthropic.Anthropic(api_key=self.config.get_active_api_key())
            self.logger.info(f"Initialized Claude client with model: {self.config.get_active_model()}")
        except ImportError:
            raise ImportError("Anthropic package not installed. Run: pip install anthropic")
        except Exception as e:
            raise ValueError(f"Failed to initialize Claude client: {str(e)}")

    def _init_gemini_client(self):
        """Initialize Google Gemini client"""
        try:
            from google import genai
            self.client = genai.Client(api_key=self.config.get_active_api_key())
            self.logger.info(f"Initialized Gemini client with model: {self.config.get_active_model()}")
        except ImportError:
            raise ImportError("Google GenAI package not installed. Run: pip install google-genai")
        except Exception as e:
            raise ValueError(f"Failed to initialize Gemini client: {str(e)}")
    
    def _format_timestamped_transcript(self, transcript_data: Dict) -> str:
        """Format transcript with inline timestamp markers from segments.

        If segments with start times are available, produces text like:
            [00:00] first segment text [00:15] second segment text ...
        This lets the LLM accurately extract mention_timestamp_seconds.

        Falls back to plain transcript text if no segments are available.
        """
        segments = transcript_data.get('segments', [])
        if not segments or not isinstance(segments, list):
            return transcript_data.get('transcript', '')

        # Check if segments have start times
        if not segments[0].get('start') and segments[0].get('start') != 0:
            return transcript_data.get('transcript', '')

        parts = []
        for seg in segments:
            start = seg.get('start', 0)
            text = seg.get('text', '').strip()
            if not text:
                continue
            # Format as [MM:SS]
            mins = int(start) // 60
            secs = int(start) % 60
            parts.append(f"[{mins:02d}:{secs:02d}] {text}")

        return ' '.join(parts)

    def analyze_transcript(self, transcript_data: Dict) -> Dict:
        """
        Analyze a YouTube transcript to extract restaurant information

        Args:
            transcript_data: Dictionary containing video_id, video_url, language, and transcript

        Returns:
            Dictionary containing episode_info, restaurants, food_trends, and episode_summary
        """
        try:
            # Use timestamped transcript if segments are available
            transcript_text = self._format_timestamped_transcript(transcript_data)
            # Store the formatted text back so chunks and prompts use it
            transcript_data = transcript_data.copy()
            transcript_data['transcript'] = transcript_text

            video_id = transcript_data.get('video_id', 'unknown')

            self.logger.info(f"═══════════════════════════════════════════════════════════")
            self.logger.info(f"Starting analysis for video: {video_id}")
            self.logger.info(f"Transcript length: {len(transcript_text):,} characters")
            self.logger.info(f"Chunk size threshold: {self.config.chunk_size:,} characters")

            # Process transcript in chunks if it's too long
            if self.config.enable_chunking and len(transcript_text) > self.config.chunk_size:
                num_chunks = (len(transcript_text) // self.config.chunk_size) + 1
                self.logger.info(f"Chunking enabled: transcript will be split into ~{num_chunks} chunks")
                return self._analyze_chunked_transcript(transcript_data)
            else:
                self.logger.info(f"Single-pass analysis (transcript fits in one chunk)")
                return self._analyze_single_transcript(transcript_data)

        except Exception as e:
            self.logger.error(f"Error analyzing transcript: {str(e)}")
            return self._create_error_analysis(transcript_data, str(e))

    def _analyze_single_transcript(self, transcript_data: Dict) -> Dict:
        """Analyze a single transcript using a two-stage LLM pipeline.

        Stage 1: Identify restaurants and extract details (no quotes).
        Stage 2: Extract verbatim quotes from the transcript for each restaurant.
        """

        transcript_text = transcript_data['transcript']
        video_id = transcript_data.get('video_id', 'unknown')

        # ── Stage 1: Restaurant identification & detail extraction ──
        self.logger.info(f"  [Stage 1] Identifying restaurants...")
        prompt = self._create_analysis_prompt(transcript_text)

        self.logger.info(f"    ├─ Model: {self.config.get_active_model()}")
        self.logger.info(f"    ├─ Prompt size: {len(prompt):,} characters")
        self.logger.info(f"    └─ Max response tokens: {self.config.get_active_max_tokens():,}")

        try:
            restaurants = self._call_llm(prompt, self._get_system_prompt())
            self.logger.info(f"  [Stage 1] Found {len(restaurants)} restaurant(s)")

            if not restaurants:
                return self._build_result(transcript_data, [])

            # Validate and process results
            validated_restaurants = []
            for restaurant in restaurants:
                validated_restaurants.append(self._ensure_english_name(restaurant))

            # ── Stage 2: Verbatim quote extraction ──
            restaurant_names = [
                r.get('name_hebrew', '') for r in validated_restaurants if r.get('name_hebrew')
            ]
            self.logger.info(f"  [Stage 2] Extracting verbatim quotes for {len(restaurant_names)} restaurants...")

            quote_prompt = self._create_quote_extraction_prompt(transcript_text, restaurant_names)
            self.logger.info(f"    ├─ Quote prompt size: {len(quote_prompt):,} characters")

            quotes_result = self._call_llm(quote_prompt, self._get_quote_extraction_prompt())
            self.logger.info(f"  [Stage 2] Got {len(quotes_result)} quote(s)")

            # Build a lookup from restaurant name → quotes
            quotes_map = {}
            for q in quotes_result:
                name = q.get('restaurant_name', '').strip()
                if name:
                    quotes_map[self._normalize_hebrew_name(name)] = q

            # Merge quotes into restaurant data
            for restaurant in validated_restaurants:
                name = restaurant.get('name_hebrew', '')
                norm_name = self._normalize_hebrew_name(name)
                quote_data = quotes_map.get(norm_name)

                # Try partial matching if exact match fails
                if not quote_data:
                    for qname, qdata in quotes_map.items():
                        if norm_name and qname and (norm_name in qname or qname in norm_name):
                            quote_data = qdata
                            break

                if quote_data:
                    restaurant['engaging_quote'] = quote_data.get('engaging_quote', 'לא נמצא ציטוט ישיר')
                    # Only override host_comments if Stage 2 provided a transcript-based one
                    stage2_comments = quote_data.get('host_comments', '')
                    if stage2_comments and stage2_comments != 'לא נמצא ציטוט ישיר':
                        restaurant['host_comments'] = stage2_comments
                else:
                    restaurant['engaging_quote'] = 'לא נמצא ציטוט ישיר'

            return self._build_result(transcript_data, validated_restaurants)

        except Exception as e:
            self.logger.error(f"{self.config.provider.upper()} analysis failed: {str(e)}")
            raise e

    def _call_llm(self, prompt: str, system_prompt: str = None) -> List[Dict]:
        """Call the configured LLM provider with the given prompt and system prompt."""
        if self.config.provider == "openai":
            return self._call_openai(prompt, system_prompt)
        elif self.config.provider == "gemini":
            return self._call_gemini(prompt, system_prompt)
        else:
            return self._call_claude(prompt, system_prompt)

    def _build_result(self, transcript_data: Dict, restaurants: List[Dict]) -> Dict:
        """Build the standard analysis result dictionary."""
        return {
            'episode_info': {
                'video_id': transcript_data['video_id'],
                'video_url': transcript_data['video_url'],
                'language': transcript_data.get('language', 'he'),
                'analysis_date': datetime.now().strftime('%Y-%m-%d'),
                'total_restaurants_found': len(restaurants),
                'processing_method': f'{self.config.provider}_{self.config.get_active_model()}',
                'llm_provider': self.config.provider
            },
            'restaurants': restaurants,
            'food_trends': self._extract_food_trends(restaurants),
            'episode_summary': f"ניתוח {self.config.provider.upper()} של {len(restaurants)} מסעדות מהסרטון {transcript_data['video_id']}"
        }

    def _analyze_chunked_transcript(self, transcript_data: Dict) -> Dict:
        """Analyze transcript in chunks for comprehensive coverage"""

        transcript_text = transcript_data['transcript']
        video_id = transcript_data.get('video_id', 'unknown')

        # Split into chunks
        chunks = self._create_chunks(transcript_text, self.config.chunk_size, self.config.chunk_overlap)

        self.logger.info(f"───────────────────────────────────────────────────────────")
        self.logger.info(f"Chunked Analysis: {len(chunks)} chunks to process")
        self.logger.info(f"Chunk overlap: {self.config.chunk_overlap:,} characters")

        all_restaurants = []
        all_trends = []

        for i, chunk in enumerate(chunks):
            chunk_start = i * (self.config.chunk_size - self.config.chunk_overlap)
            self.logger.info(f"")
            self.logger.info(f"[Chunk {i+1}/{len(chunks)}] Processing...")
            self.logger.info(f"  ├─ Size: {len(chunk):,} characters")
            self.logger.info(f"  ├─ Position: chars {chunk_start:,}-{chunk_start + len(chunk):,}")

            chunk_data = transcript_data.copy()
            chunk_data['transcript'] = chunk

            # Analyze each chunk
            chunk_result = self._analyze_single_transcript(chunk_data)

            chunk_restaurants = chunk_result.get('restaurants', [])
            all_restaurants.extend(chunk_restaurants)
            all_trends.extend(chunk_result.get('food_trends', []))

            # Log restaurants found in this chunk
            self.logger.info(f"  └─ Found {len(chunk_restaurants)} restaurant(s) in this chunk")
            for r in chunk_restaurants[:5]:  # Show first 5
                self.logger.info(f"      • {r.get('name_hebrew', 'Unknown')}")
            if len(chunk_restaurants) > 5:
                self.logger.info(f"      ... and {len(chunk_restaurants) - 5} more")

        # Deduplicate restaurants
        self.logger.info(f"")
        self.logger.info(f"───────────────────────────────────────────────────────────")
        self.logger.info(f"Merging results from all chunks...")
        self.logger.info(f"  ├─ Total raw mentions: {len(all_restaurants)}")

        unique_restaurants = self._deduplicate_restaurants(all_restaurants)
        unique_trends = list(set(all_trends))

        duplicates_merged = len(all_restaurants) - len(unique_restaurants)
        self.logger.info(f"  ├─ Duplicates merged: {duplicates_merged}")
        self.logger.info(f"  └─ Unique restaurants: {len(unique_restaurants)}")

        self.logger.info(f"")
        self.logger.info(f"═══════════════════════════════════════════════════════════")
        self.logger.info(f"Analysis complete for {video_id}")
        self.logger.info(f"  ├─ Chunks processed: {len(chunks)}")
        self.logger.info(f"  ├─ Restaurants found: {len(unique_restaurants)}")
        self.logger.info(f"  └─ Food trends: {len(unique_trends)}")
        self.logger.info(f"═══════════════════════════════════════════════════════════")

        return {
            'episode_info': {
                'video_id': transcript_data['video_id'],
                'video_url': transcript_data['video_url'],
                'language': transcript_data.get('language', 'he'),
                'analysis_date': datetime.now().strftime('%Y-%m-%d'),
                'total_restaurants_found': len(unique_restaurants),
                'processing_method': f'{self.config.provider}_chunked',
                'llm_provider': self.config.provider,
                'chunks_processed': len(chunks)
            },
            'restaurants': unique_restaurants,
            'food_trends': unique_trends,
            'episode_summary': f"ניתוח מבוסס {self.config.provider.upper()} של {len(unique_restaurants)} מסעדות מהסרטון {transcript_data['video_id']} ב-{len(chunks)} חלקים"
        }

    def _create_chunks(self, text: str, chunk_size: int, overlap: int) -> List[str]:
        """Split text into overlapping chunks at sentence boundaries"""
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + chunk_size
            
            if end >= len(text):
                chunks.append(text[start:])
                break
            
            # Find sentence boundary
            chunk_end = self._find_sentence_boundary(text, end, start + chunk_size // 2)
            chunks.append(text[start:chunk_end])
            start = chunk_end - overlap
        
        return chunks

    def _find_sentence_boundary(self, text: str, preferred_end: int, min_end: int) -> int:
        """Find the best sentence boundary near the preferred end position"""
        sentence_endings = ['.', '!', '?', '׃', '׀']
        
        # Look backwards from preferred_end for sentence ending
        for i in range(preferred_end, min_end - 1, -1):
            if i < len(text) and text[i] in sentence_endings:
                return i + 1
        
        # If no sentence boundary found, use preferred_end
        return min(preferred_end, len(text))

    def _get_system_prompt(self) -> str:
        """Get the system prompt for Stage 1: restaurant identification and detail extraction"""
        return """You are an expert Hebrew food podcast analyst. Your job is to extract restaurants that the hosts ACTUALLY DISCUSS IN DEPTH — not every place they name-drop.

CRITICAL DISTINCTION — DISCUSSED vs MENTIONED:
- DISCUSSED = The hosts talk about the restaurant for at least a few sentences. They share opinions, describe dishes, tell a story, give a recommendation, or debate its quality. This is what you extract.
- MENTIONED = The hosts say the name in passing, as a comparison, as part of a list, or as quick context. "זה כמו ששמעתם על מסעדת X" or "בנוסף ל-Y" — these are NOT extracted.

If a restaurant appears only as a brief reference, comparison, or aside — DO NOT EXTRACT IT.

EXTRACTION RULES:
1. Extract ONLY restaurants the hosts substantively discuss — they share an opinion, describe a dish, tell a personal experience, or dedicate meaningful airtime.
2. Each restaurant MUST have at least one concrete detail: a dish described, an opinion given, an experience shared.
3. If you're unsure whether a restaurant was truly discussed vs just mentioned, DO NOT extract it. Err on the side of fewer, higher-quality extractions.
4. DO NOT extract:
   - Restaurants mentioned only in a list without individual discussion
   - Restaurants used as comparisons ("זה כמו X")
   - Generic food terms, dish names, brands, supermarkets
   - Chef names without their restaurant
   - Vague references

DEDUPLICATION:
- If the same restaurant appears multiple times, consolidate into ONE entry.
- Watch for spelling variants: "צ'קולי" and "צקולי" are the same place.
- Merge all details, dishes, and quotes into a single rich entry.

Hebrew transliteration: Provide accurate English transliteration (e.g., "צ'קולי" → "Chakoli", not "Tzkoli")

Always respond with valid JSON only. No markdown formatting or additional text."""

    def _get_quote_extraction_prompt(self) -> str:
        """Get the system prompt for Stage 2: verbatim quote extraction"""
        return """You are a quote extraction specialist. You will receive a Hebrew podcast transcript and a list of restaurant names.

YOUR ONLY JOB: Find the most interesting, vivid sentence the host said about each restaurant and COPY IT EXACTLY from the transcript.

ABSOLUTE RULES:
1. Every quote MUST appear WORD FOR WORD in the transcript. Copy-paste only.
2. First person only. The host says "אכלתי", "טעמתי", "הלכתי" — these are their own words.
3. NEVER write in third person ("המנחה אמר", "הוא ציין", "אמית סיפר").
4. NEVER summarize or paraphrase. If the host said "אחי זה היה מטורף", write exactly that.
5. Pick the most engaging/emotional/descriptive quote you can find for each restaurant.
6. If you truly cannot find a direct quote for a restaurant, write "לא נמצא ציטוט ישיר".

VERIFICATION: Before returning each quote, mentally check — can you point to the exact location in the transcript where these words appear? If not, it's not a real quote.

Always respond with valid JSON only. No markdown formatting or additional text."""

    def _call_openai(self, prompt: str, system_prompt: str = None) -> List[Dict]:
        """Call OpenAI API to analyze transcript"""

        self.logger.info(f"Calling OpenAI API ({self.config.get_active_model()})")

        try:
            response = self.client.chat.completions.create(
                model=self.config.get_active_model(),
                messages=[
                    {"role": "system", "content": system_prompt or self._get_system_prompt()},
                    {"role": "user", "content": prompt}
                ],
                temperature=self.config.get_active_temperature(),
                max_tokens=self.config.get_active_max_tokens(),
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            result = json.loads(content)
            
            # Ensure we get a list
            if isinstance(result, dict) and 'restaurants' in result:
                return result['restaurants']
            elif isinstance(result, dict) and 'quotes' in result:
                return result['quotes']
            elif isinstance(result, list):
                return result
            else:
                self.logger.warning(f"Unexpected OpenAI response format: {type(result)}")
                return []
                
        except Exception as e:
            self.logger.error(f"OpenAI API call failed: {str(e)}")
            raise e

    def _call_claude(self, prompt: str, system_prompt: str = None) -> List[Dict]:
        """Call Claude API to analyze transcript"""

        self.logger.info(f"Calling Claude API ({self.config.get_active_model()})")

        try:
            response = self.client.messages.create(
                model=self.config.get_active_model(),
                max_tokens=self.config.get_active_max_tokens(),
                temperature=self.config.get_active_temperature(),
                system=system_prompt or self._get_system_prompt(),
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            content = response.content[0].text

            # Clean up potential markdown formatting
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0].strip()
            elif '```' in content:
                content = content.split('```')[1].split('```')[0].strip()

            # Use safe JSON parsing to handle truncated responses
            return self._safe_parse_json(content)

        except Exception as e:
            self.logger.error(f"Claude API call failed: {str(e)}")
            raise e

    def _call_gemini(self, prompt: str, system_prompt: str = None) -> List[Dict]:
        """Call Google Gemini API to analyze transcript"""

        self.logger.info(f"Calling Gemini API ({self.config.get_active_model()})")

        try:
            from google.genai import types

            full_prompt = (system_prompt or self._get_system_prompt()) + "\n\n" + prompt

            response = self.client.models.generate_content(
                model=self.config.get_active_model(),
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    temperature=self.config.get_active_temperature(),
                    max_output_tokens=self.config.get_active_max_tokens(),
                    response_mime_type="application/json",
                ),
            )

            content = response.text

            # Use safe JSON parsing to handle truncated responses
            return self._safe_parse_json(content)

        except Exception as e:
            self.logger.error(f"Gemini API call failed: {str(e)}")
            raise e

    def _safe_parse_json(self, content: str) -> List[Dict]:
        """
        Safely parse JSON response, handling truncated or malformed responses.

        This handles common issues with LLM responses:
        - Unterminated strings (e.g., when response is cut off mid-string)
        - Missing closing brackets/braces
        - Trailing commas
        - Non-JSON responses

        Args:
            content: The raw response content to parse

        Returns:
            List of restaurant dictionaries (empty list if parsing fails completely)
        """
        if not content or not content.strip():
            self.logger.warning("Empty response received")
            return []

        content = content.strip()

        # First, try standard JSON parsing
        try:
            result = json.loads(content)
            if isinstance(result, dict) and 'restaurants' in result:
                return result['restaurants']
            elif isinstance(result, dict) and 'quotes' in result:
                return result['quotes']
            elif isinstance(result, list):
                return result
            else:
                self.logger.warning(f"Unexpected JSON format: {type(result)}")
                return []
        except json.JSONDecodeError:
            pass  # Continue to repair attempts

        # If standard parsing failed, try to repair the JSON
        self.logger.warning("JSON parsing failed, attempting repair...")

        repaired_content = self._repair_truncated_json(content)

        try:
            result = json.loads(repaired_content)
            if isinstance(result, dict) and 'restaurants' in result:
                restaurants = result['restaurants']
                self.logger.info(f"Successfully repaired JSON, extracted {len(restaurants)} items")
                return restaurants
            elif isinstance(result, dict) and 'quotes' in result:
                quotes = result['quotes']
                self.logger.info(f"Successfully repaired JSON, extracted {len(quotes)} quotes")
                return quotes
            elif isinstance(result, list):
                self.logger.info(f"Successfully repaired JSON array, extracted {len(result)} restaurants")
                return result
            else:
                return []
        except json.JSONDecodeError as e:
            self.logger.warning(f"JSON repair failed: {str(e)}")

            # Last resort: try to extract complete restaurant objects using regex
            return self._extract_restaurants_by_regex(content)

    def _repair_truncated_json(self, content: str) -> str:
        """
        Attempt to repair truncated JSON by fixing common issues.

        Args:
            content: The malformed JSON string

        Returns:
            Repaired JSON string (may still be invalid)
        """
        repaired = content

        # Remove any trailing incomplete string (find last complete quote pair)
        # This handles: "key": "truncated value...
        in_string = False
        last_complete_pos = 0
        i = 0
        while i < len(repaired):
            char = repaired[i]
            if char == '\\' and i + 1 < len(repaired):
                i += 2  # Skip escaped character
                continue
            if char == '"':
                if in_string:
                    last_complete_pos = i + 1
                in_string = not in_string
            elif not in_string and char in '{}[],':
                last_complete_pos = i + 1
            i += 1

        # If we ended inside a string, truncate to the last complete position
        if in_string:
            repaired = repaired[:last_complete_pos]

        # Remove any trailing incomplete key-value pairs
        # Pattern: remove trailing comma and incomplete content
        repaired = re.sub(r',\s*"[^"]*"?\s*:?\s*$', '', repaired)
        repaired = re.sub(r',\s*$', '', repaired)

        # Count and fix mismatched brackets
        open_braces = repaired.count('{') - repaired.count('}')
        open_brackets = repaired.count('[') - repaired.count(']')

        # Add missing closing brackets/braces
        repaired += ']' * max(0, open_brackets)
        repaired += '}' * max(0, open_braces)

        return repaired

    def _extract_restaurants_by_regex(self, content: str) -> List[Dict]:
        """
        Last-resort extraction: find complete restaurant objects using regex.

        Args:
            content: The raw content to search

        Returns:
            List of successfully parsed restaurant dictionaries
        """
        restaurants = []

        # Pattern to find complete restaurant objects (balanced braces)
        # This is a simplified approach that looks for objects with name_hebrew
        pattern = r'\{[^{}]*"name_hebrew"\s*:\s*"[^"]+(?:"[^{}]*)*\}'

        # Try to find restaurant-like objects
        matches = re.findall(pattern, content)

        for match in matches:
            try:
                # Attempt to parse each potential restaurant object
                obj = json.loads(match)
                if isinstance(obj, dict) and obj.get('name_hebrew'):
                    restaurants.append(obj)
            except json.JSONDecodeError:
                continue

        if restaurants:
            self.logger.info(f"Regex extraction recovered {len(restaurants)} restaurants")
        else:
            self.logger.warning("Could not extract any restaurants from malformed response")

        return restaurants

    def _create_analysis_prompt(self, transcript_text: str) -> str:
        """Create the Stage 1 prompt: identify restaurants and extract details (no quotes)"""

        max_transcript_length = self.config.chunk_size
        truncated_transcript = transcript_text[:max_transcript_length]
        if len(transcript_text) > max_transcript_length:
            truncated_transcript += "..."

        return f"""Analyze this Hebrew food podcast transcript. Extract ONLY restaurants that the hosts SUBSTANTIVELY DISCUSS — not ones they merely name-drop or reference in passing.

TRANSCRIPT:
{truncated_transcript}

WHAT TO EXTRACT:
A restaurant qualifies ONLY if the hosts dedicate real airtime to it — sharing opinions, describing dishes they ate, telling a story about their visit, or giving a recommendation. If a restaurant is just mentioned by name without substantive discussion, SKIP IT.

WHAT TO SKIP:
- Restaurants mentioned in a quick list without individual discussion
- Restaurants used only as comparisons ("זה כמו X", "מזכיר את X")
- Generic food terms, dish names, brands, supermarkets
- Vague references ("מסעדה אחת", "מקום מסוים")
- Chef names without their restaurant

OUTPUT FORMAT - Return a JSON object:
{{
    "restaurants": [
        {{
            "name_hebrew": "שם המסעדה בעברית",
            "name_english": "Accurate English Transliteration",
            "location": {{
                "city": "עיר",
                "neighborhood": "שכונה (אם מוזכרת)",
                "address": "כתובת (אם מוזכרת)",
                "region": "צפון/מרכז/דרום/ירושלים/שרון"
            }},
            "cuisine_type": "סוג מטבח",
            "status": "פתוח/סגור/חדש/עומד להיפתח",
            "price_range": "זול/בינוני/יקר/יוקרתי",
            "host_opinion": "חיובית מאוד/חיובית/ניטרלית/שלילית/מעורבת",
            "host_comments": "תקציר קצר של מה שהמנחים אמרו על המסעדה — כתוב בגוף ראשון כאילו המנחה מדבר",
            "mention_timestamp_seconds": 0,
            "signature_dishes": ["מנות שהמנחים ציינו כמומלצות"],
            "menu_items": ["מנות שהוזכרו"],
            "special_features": ["מה שמייחד את המקום"],
            "chef_name": "שם השף אם מוזכר",
            "business_news": "פתיחה/סגירה/שינויים (אם יש)",
            "is_closing": false
        }}
    ]
}}

TIMESTAMPS:
The transcript may contain [MM:SS] timestamp markers. Use these to set mention_timestamp_seconds accurately.
For example, if a restaurant is first discussed after [05:23], set mention_timestamp_seconds to 323 (5*60+23).
If no timestamps are present, set mention_timestamp_seconds to 0.

IMPORTANT RULES:
1. Do NOT include an engaging_quote field — quotes will be extracted separately.
2. is_closing = true ONLY if the podcast explicitly says the restaurant is shutting down permanently.
3. Use null for unknown fields, never "לא צוין".
4. If the same restaurant is discussed multiple times, consolidate into ONE entry with merged details.
5. Quality over quantity — 5 well-extracted restaurants are better than 15 with half being noise."""

    def _create_quote_extraction_prompt(self, transcript_text: str, restaurant_names: List[str]) -> str:
        """Create the Stage 2 prompt: extract verbatim quotes for identified restaurants"""

        max_transcript_length = self.config.chunk_size
        truncated_transcript = transcript_text[:max_transcript_length]
        if len(transcript_text) > max_transcript_length:
            truncated_transcript += "..."

        names_list = "\n".join(f"- {name}" for name in restaurant_names)

        return f"""Below is a Hebrew podcast transcript. I need you to find EXACT VERBATIM QUOTES from the hosts about each of the following restaurants.

RESTAURANTS TO FIND QUOTES FOR:
{names_list}

TRANSCRIPT:
{truncated_transcript}

YOUR TASK:
For each restaurant, scan the transcript and find the most interesting, vivid, or emotional sentence the host said about it. COPY THE EXACT WORDS from the transcript — do not change a single word.

OUTPUT FORMAT - Return a JSON object:
{{
    "quotes": [
        {{
            "restaurant_name": "שם המסעדה",
            "engaging_quote": "המשפט המדויק מהתמליל, מילה במילה, בגוף ראשון",
            "host_comments": "עוד משפט או שניים מהתמליל שמתארים את חוויית המנחה"
        }}
    ]
}}

CRITICAL RULES:
1. COPY-PASTE ONLY. Every word in engaging_quote must appear in the transcript above in the same order.
2. First person only: "אכלתי", "טעמתי", "הזמנתי" — NOT "הוא אכל", "המנחה טעם".
3. Pick the most colorful, emotional, or descriptive quote — excitement, surprise, criticism, humor.
4. If you cannot find any direct quote for a restaurant, set engaging_quote to "לא נמצא ציטוט ישיר".
5. host_comments should also be taken from the transcript — a brief passage describing the host's experience."""

    def _ensure_english_name(self, restaurant: Dict) -> Dict:
        """Ensure restaurant has a proper English name"""
        hebrew_name = restaurant.get('name_hebrew', '').strip()
        english_name = restaurant.get('name_english', '').strip()
        
        # If no English name provided, create transliteration
        if not english_name and hebrew_name:
            english_name = self._transliterate_hebrew_name(hebrew_name)
            restaurant['name_english'] = english_name
        
        # If English name is placeholder text, replace it
        if english_name.lower() in ['לא צוין', 'unknown', 'restaurant name in english', '']:
            english_name = self._transliterate_hebrew_name(hebrew_name)
            restaurant['name_english'] = english_name
            
        return restaurant

    def _transliterate_hebrew_name(self, hebrew_name: str) -> str:
        """Basic Hebrew to English transliteration for restaurant names"""
        if not hebrew_name:
            return "Unknown Restaurant"
            
        # Common transliteration mappings for restaurant names
        transliteration_map = {
            "צ'": 'Ch', 'צ': 'Tz', 'ח': 'H', 'כ': 'K', 'ק': 'K',
            'ש': 'Sh', 'ת': 'T', 'ב': 'B', 'ג': 'G', 'ד': 'D',
            'ה': 'H', 'ו': 'V', 'ז': 'Z', 'ט': 'T', 'י': 'Y',
            'ל': 'L', 'מ': 'M', 'נ': 'N', 'ס': 'S', 'ע': 'A',
            'פ': 'P', 'ר': 'R', 'א': 'A'
        }
        
        # Simple transliteration
        result = hebrew_name
        for hebrew, english in transliteration_map.items():
            result = result.replace(hebrew, english)
            
        # Clean up and capitalize properly
        result = ''.join(c if c.isalnum() or c.isspace() else '' for c in result)
        result = ' '.join(word.capitalize() for word in result.split() if word)
        
        return result if result else "Restaurant"

    def _normalize_hebrew_name(self, name: str) -> str:
        """Normalize Hebrew restaurant name for dedup comparison."""
        if not name:
            return ""
        n = name.strip().lower()
        # Remove common prefixes
        for prefix in ["מסעדת ", "מסעדה ", "ביסטרו ", "בית קפה ", "בר ", "קפה ", "ה"]:
            if n.startswith(prefix):
                n = n[len(prefix):]
        # Normalize geresh variants
        n = n.replace("ז'", "ג'")
        n = n.replace("צ'", "צ")
        # Remove punctuation
        n = re.sub(r'[^\u0590-\u05ffa-z0-9\s]', '', n)
        n = re.sub(r'\s+', ' ', n).strip()
        return n

    def _deduplicate_restaurants(self, restaurants: List[Dict]) -> List[Dict]:
        """
        Remove duplicate restaurants and merge data from multiple mentions.

        Uses aggressive Hebrew name normalization to catch variants like
        "מסעדת צ'קולי" and "צקולי" as the same place.
        """
        merged = {}  # normalized identifier -> merged restaurant data

        for restaurant in restaurants:
            # Ensure English name is present and valid
            restaurant = self._ensure_english_name(restaurant)

            name_hebrew = restaurant.get('name_hebrew', '').strip()
            name_english = restaurant.get('name_english', '').strip()

            # Skip empty entries
            if not name_hebrew and not name_english:
                continue

            # Normalize for comparison
            norm_hebrew = self._normalize_hebrew_name(name_hebrew)
            norm_english = name_english.lower().strip()
            identifier = norm_hebrew if norm_hebrew else norm_english

            # Check if any existing entry matches
            matched_key = None
            for existing_key in merged:
                if identifier == existing_key:
                    matched_key = existing_key
                    break
                # Also check if one contains the other (partial match)
                if len(identifier) >= 3 and len(existing_key) >= 3:
                    if identifier in existing_key or existing_key in identifier:
                        matched_key = existing_key
                        break

            if matched_key is None:
                merged[identifier] = restaurant.copy()
            else:
                self._merge_restaurant_data(merged[matched_key], restaurant)

        return list(merged.values())

    def _merge_restaurant_data(self, existing: Dict, new: Dict) -> None:
        """
        Merge new restaurant data into existing entry (modifies existing in place).

        Strategy:
        - Lists (menu_items, special_features): combine unique values
        - Strings: keep longer/more detailed version
        - Nested dicts (location, contact_info): merge recursively
        """
        # Merge list fields - combine unique values
        for list_field in ['menu_items', 'special_features']:
            existing_list = existing.get(list_field) or []
            new_list = new.get(list_field) or []
            # Combine and deduplicate while preserving order
            combined = list(existing_list)
            for item in new_list:
                if item and item not in combined and item != 'לא צוין':
                    combined.append(item)
            if combined:
                existing[list_field] = combined

        # Merge string fields - prefer longer/more detailed content
        for str_field in ['host_comments', 'mention_context', 'business_news']:
            existing_val = existing.get(str_field) or ''
            new_val = new.get(str_field) or ''
            # Keep the longer value (more detail), but skip placeholder text
            if new_val and new_val != 'לא צוין':
                if not existing_val or existing_val == 'לא צוין' or len(new_val) > len(existing_val):
                    existing[str_field] = new_val

        # Merge location dict - fill in missing fields
        existing_loc = existing.get('location') or {}
        new_loc = new.get('location') or {}
        for loc_field in ['city', 'neighborhood', 'address', 'region']:
            if not existing_loc.get(loc_field) or existing_loc.get(loc_field) == 'לא צוין':
                if new_loc.get(loc_field) and new_loc.get(loc_field) != 'לא צוין':
                    existing_loc[loc_field] = new_loc[loc_field]
        if existing_loc:
            existing['location'] = existing_loc

        # Merge contact_info dict - fill in missing fields
        existing_contact = existing.get('contact_info') or {}
        new_contact = new.get('contact_info') or {}
        for contact_field in ['phone', 'website', 'social_media', 'hours']:
            if not existing_contact.get(contact_field):
                if new_contact.get(contact_field):
                    existing_contact[contact_field] = new_contact[contact_field]
        if existing_contact:
            existing['contact_info'] = existing_contact

    def _extract_food_trends(self, restaurants: List[Dict]) -> List[str]:
        """Extract food trends from restaurant data"""
        trends = []
        cuisines = [r.get('cuisine_type', '') for r in restaurants if r.get('cuisine_type')]
        locations = [r.get('location', {}).get('city', '') for r in restaurants if r.get('location', {}).get('city')]
        
        # Add cuisine trends
        unique_cuisines = list(set(cuisines))
        for cuisine in unique_cuisines[:3]:  # Top 3 cuisines
            if cuisine and cuisine != 'לא צוין':
                trends.append(f"{cuisine} פופולרי")
        
        # Add location trends
        unique_cities = list(set(locations))
        for city in unique_cities[:2]:  # Top 2 cities
            if city and city != 'לא צוין':
                trends.append(f"מסעדות ב{city}")
        
        # Default trends if none found
        if not trends:
            trends = ["קולינריה ישראלית", "ביקורות מסעדות", "אוכל ים תיכוני"]
            
        return trends

    def _create_error_analysis(self, transcript_data: Dict, error_message: str) -> Dict:
        """Create error analysis result"""
        return {
            'episode_info': {
                'video_id': transcript_data['video_id'],
                'video_url': transcript_data['video_url'],
                'language': transcript_data.get('language', 'he'),
                'analysis_date': datetime.now().strftime('%Y-%m-%d'),
                'total_restaurants_found': 0,
                'processing_method': f'{self.config.provider}_error',
                'llm_provider': self.config.provider
            },
            'restaurants': [],
            'food_trends': [
                "שגיאה בניתוח",
                f"שגיאה: {error_message}"
            ],
            'episode_summary': f"שגיאה בניתוח {self.config.provider.upper()} של הסרטון {transcript_data['video_id']}: {error_message}"
        }

    def save_analysis(self, analysis_result: Dict, output_dir: str = "analyses") -> tuple[str, str]:
        """
        Save analysis results to JSON and Markdown files
        
        Returns:
            tuple: (json_file_path, md_file_path)
        """
        os.makedirs(output_dir, exist_ok=True)
        
        video_id = analysis_result['episode_info']['video_id']
        provider = analysis_result['episode_info']['llm_provider']
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Save JSON
        json_filename = f"{video_id}_{timestamp}_{provider}_analysis.json"
        json_path = os.path.join(output_dir, json_filename)
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(analysis_result, f, ensure_ascii=False, indent=2)
        
        # Save Markdown
        md_filename = f"{video_id}_{timestamp}_{provider}_analysis.md"
        md_path = os.path.join(output_dir, md_filename)
        
        md_content = self._generate_markdown_report(analysis_result)
        
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        self.logger.info(f"✅ Analysis saved to: {json_path} and {md_path}")
        
        return json_path, md_path

    def _generate_markdown_report(self, analysis_result: Dict) -> str:
        """Generate a markdown report from analysis results"""
        
        episode_info = analysis_result['episode_info']
        restaurants = analysis_result['restaurants']
        trends = analysis_result['food_trends']
        summary = analysis_result['episode_summary']
        
        md_content = f"""# {episode_info['llm_provider'].upper()} Restaurant Analysis Results

**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**Video ID:** {episode_info['video_id']}
**LLM Provider:** {episode_info['llm_provider']} ({episode_info.get('processing_method', 'unknown')})
**Model:** {self.config.get_active_model()}

## Episode Summary
{summary}

## Restaurants Found ({len(restaurants)})

"""
        
        for i, restaurant in enumerate(restaurants, 1):
            location = restaurant.get('location', {})
            md_content += f"""### {i}. {restaurant.get('name_hebrew', 'לא צוין')} ({restaurant.get('name_english', 'Unknown')})

**Location:** {location.get('city', 'לא צוין')}, {location.get('neighborhood', 'לא צוין')}
**Region:** {location.get('region', 'לא צוין')}
**Cuisine:** {restaurant.get('cuisine_type', 'לא צוין')}
**Price Range:** {restaurant.get('price_range', 'לא צוין')}
**Host Opinion:** {restaurant.get('host_opinion', 'לא צוין')}

**Host Comments:** {restaurant.get('host_comments', 'לא צוין')}

**Menu Items:** {', '.join(restaurant.get('menu_items', [])) if restaurant.get('menu_items') else 'לא צוינו'}

**Special Features:** {', '.join(restaurant.get('special_features', [])) if restaurant.get('special_features') else 'לא צוינו'}

**Context:** "{restaurant.get('mention_context', 'לא צוין')}"

---

"""
        
        md_content += f"""## Food Trends

{chr(10).join(f'- {trend}' for trend in trends)}

"""
        
        return md_content