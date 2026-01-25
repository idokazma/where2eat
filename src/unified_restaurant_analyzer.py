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
        else:
            self._init_claude_client()
    
    def _init_openai_client(self):
        """Initialize OpenAI client"""
        try:
            import openai
            self.client = openai.OpenAI(api_key=self.config.get_active_api_key())
            self.logger.info(f"✅ Initialized OpenAI client with model: {self.config.get_active_model()}")
        except ImportError:
            raise ImportError("OpenAI package not installed. Run: pip install openai")
        except Exception as e:
            raise ValueError(f"Failed to initialize OpenAI client: {str(e)}")
    
    def _init_claude_client(self):
        """Initialize Claude/Anthropic client"""
        try:
            import anthropic
            self.client = anthropic.Anthropic(api_key=self.config.get_active_api_key())
            self.logger.info(f"✅ Initialized Claude client with model: {self.config.get_active_model()}")
        except ImportError:
            raise ImportError("Anthropic package not installed. Run: pip install anthropic")
        except Exception as e:
            raise ValueError(f"Failed to initialize Claude client: {str(e)}")
    
    def analyze_transcript(self, transcript_data: Dict) -> Dict:
        """
        Analyze a YouTube transcript to extract restaurant information
        
        Args:
            transcript_data: Dictionary containing video_id, video_url, language, and transcript
            
        Returns:
            Dictionary containing episode_info, restaurants, food_trends, and episode_summary
        """
        try:
            # Process transcript in chunks if it's too long
            transcript_text = transcript_data['transcript']
            
            if self.config.enable_chunking and len(transcript_text) > self.config.chunk_size:
                return self._analyze_chunked_transcript(transcript_data)
            else:
                return self._analyze_single_transcript(transcript_data)
                
        except Exception as e:
            self.logger.error(f"Error analyzing transcript: {str(e)}")
            return self._create_error_analysis(transcript_data, str(e))

    def _analyze_single_transcript(self, transcript_data: Dict) -> Dict:
        """Analyze a single transcript using the configured LLM"""
        
        transcript_text = transcript_data['transcript']
        
        # Create analysis prompt
        prompt = self._create_analysis_prompt(transcript_text)
        
        try:
            # Call the appropriate LLM
            if self.config.provider == "openai":
                restaurants = self._call_openai(prompt)
            else:
                restaurants = self._call_claude(prompt)
            
            # Validate and process results
            validated_restaurants = []
            for restaurant in restaurants:
                validated_restaurant = self._ensure_english_name(restaurant)
                validated_restaurants.append(validated_restaurant)
            
            return {
                'episode_info': {
                    'video_id': transcript_data['video_id'],
                    'video_url': transcript_data['video_url'],
                    'language': transcript_data.get('language', 'he'),
                    'analysis_date': datetime.now().strftime('%Y-%m-%d'),
                    'total_restaurants_found': len(validated_restaurants),
                    'processing_method': f'{self.config.provider}_{self.config.get_active_model()}',
                    'llm_provider': self.config.provider
                },
                'restaurants': validated_restaurants,
                'food_trends': self._extract_food_trends(validated_restaurants),
                'episode_summary': f"ניתוח {self.config.provider.upper()} של {len(validated_restaurants)} מסעדות מהסרטון {transcript_data['video_id']}"
            }
            
        except Exception as e:
            self.logger.error(f"{self.config.provider.upper()} analysis failed: {str(e)}")
            raise e

    def _analyze_chunked_transcript(self, transcript_data: Dict) -> Dict:
        """Analyze transcript in chunks for comprehensive coverage"""
        
        transcript_text = transcript_data['transcript']
        
        # Split into chunks
        chunks = self._create_chunks(transcript_text, self.config.chunk_size, self.config.chunk_overlap)
        
        all_restaurants = []
        all_trends = []
        
        for i, chunk in enumerate(chunks):
            self.logger.info(f"Analyzing chunk {i+1}/{len(chunks)} with {self.config.provider}")
            
            chunk_data = transcript_data.copy()
            chunk_data['transcript'] = chunk
            
            # Analyze each chunk
            chunk_result = self._analyze_single_transcript(chunk_data)
            
            # Collect results
            all_restaurants.extend(chunk_result.get('restaurants', []))
            all_trends.extend(chunk_result.get('food_trends', []))
        
        # Deduplicate restaurants
        unique_restaurants = self._deduplicate_restaurants(all_restaurants)
        unique_trends = list(set(all_trends))
        
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

    def _call_openai(self, prompt: str) -> List[Dict]:
        """Call OpenAI API to analyze transcript"""
        
        self.logger.info(f"🤖 Calling OpenAI API ({self.config.get_active_model()})")
        
        try:
            response = self.client.chat.completions.create(
                model=self.config.get_active_model(),
                messages=[
                    {"role": "system", "content": "You are a Hebrew food podcast expert specializing in restaurant extraction from Israeli podcast transcripts. You understand Hebrew cuisine, Israeli geography, and food culture. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                temperature=self.config.get_active_temperature(),
                max_tokens=self.config.get_active_max_tokens(),
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            result = json.loads(content)
            
            # Ensure we get a list of restaurants
            if isinstance(result, dict) and 'restaurants' in result:
                return result['restaurants']
            elif isinstance(result, list):
                return result
            else:
                self.logger.warning(f"Unexpected OpenAI response format: {type(result)}")
                return []
                
        except Exception as e:
            self.logger.error(f"OpenAI API call failed: {str(e)}")
            raise e

    def _call_claude(self, prompt: str) -> List[Dict]:
        """Call Claude API to analyze transcript"""
        
        self.logger.info(f"🤖 Calling Claude API ({self.config.get_active_model()})")
        
        try:
            response = self.client.messages.create(
                model=self.config.get_active_model(),
                max_tokens=self.config.get_active_max_tokens(),
                temperature=self.config.get_active_temperature(),
                messages=[
                    {
                        "role": "user", 
                        "content": f"{prompt}\n\nIMPORTANT: Respond with valid JSON only. No additional text or formatting."
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
                self.logger.info(f"Successfully repaired JSON, extracted {len(restaurants)} restaurants")
                return restaurants
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
        """Create the analysis prompt for the LLM"""

        # Use chunk_size from config to ensure we analyze the full transcript
        # Previous bug: truncated to 8000 chars which missed most restaurants
        max_transcript_length = self.config.chunk_size
        truncated_transcript = transcript_text[:max_transcript_length]
        if len(transcript_text) > max_transcript_length:
            truncated_transcript += "..."
        
        return f"""
Analyze this Hebrew food podcast transcript and extract ALL restaurants mentioned by name.

TRANSCRIPT:
{truncated_transcript}

TASK: Extract every restaurant, café, bistro, food truck, or dining establishment mentioned by its actual name in this Hebrew text.

REQUIREMENTS:
1. Extract ONLY actual establishment names, not generic food terms
2. Look for patterns like "במסעדת [name]", "מסעדת [name]", "[name] בתל אביב", etc.
3. Include context about location, cuisine type, and host opinions if mentioned
4. Provide both Hebrew name and English transliteration

OUTPUT FORMAT: Return a JSON object with "restaurants" array:
{{
    "restaurants": [
        {{
            "name_hebrew": "שם המסעדה בעברית",
            "name_english": "Restaurant Name in English",
            "location": {{
                "city": "עיר", 
                "neighborhood": "שכונה אם מוזכרת", 
                "address": "כתובת אם מוזכרת",
                "region": "אזור (צפון/מרכז/דרום/ירושלים)"
            }},
            "cuisine_type": "סוג מטבח",
            "status": "סטטוס (פתוח/סגור/חדש)",
            "price_range": "טווח מחירים (זול/בינוני/יקר)",
            "host_opinion": "דעת המנחה (חיובית/שלילית/מעורבת)",
            "host_comments": "הערות המנחה",
            "menu_items": ["מנה1", "מנה2"],
            "special_features": ["תכונה מיוחדת"],
            "contact_info": {{
                "phone": "טלפון אם מוזכר",
                "website": "אתר אם מוזכר", 
                "social_media": "רשתות חברתיות אם מוזכרות"
            }},
            "business_news": "חדשות עסקיות אם מוזכרות",
            "mention_context": "ההקשר שבו הוזכר המקום"
        }}
    ]
}}

Be precise and thorough. Extract ALL restaurants mentioned. Use "לא צוין" for missing information.
"""

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

    def _deduplicate_restaurants(self, restaurants: List[Dict]) -> List[Dict]:
        """
        Remove duplicate restaurants and merge data from multiple mentions.

        When a restaurant appears in multiple chunks, we merge the data:
        - Keep all unique menu items and special features
        - Use the most detailed comments/context
        - Preserve location info from first mention with location
        """
        merged = {}  # identifier -> merged restaurant data

        for restaurant in restaurants:
            # Ensure English name is present and valid
            restaurant = self._ensure_english_name(restaurant)

            # Create identifier from Hebrew name (primary) with fallback to English
            name_hebrew = restaurant.get('name_hebrew', '').strip().lower()
            name_english = restaurant.get('name_english', '').strip().lower()

            # Skip empty entries
            if not name_hebrew and not name_english:
                continue

            # Use Hebrew name as primary identifier, fallback to English
            identifier = name_hebrew if name_hebrew else name_english

            if identifier not in merged:
                # First occurrence - store it
                merged[identifier] = restaurant.copy()
            else:
                # Merge with existing entry
                existing = merged[identifier]
                self._merge_restaurant_data(existing, restaurant)

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