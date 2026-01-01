"""
OpenAI-Powered Restaurant Analyzer
Integrates OpenAI API to analyze YouTube transcripts and extract restaurant information
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables
load_dotenv()

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

class OpenAIRestaurantAnalyzer:
    """OpenAI-powered restaurant analyzer for YouTube transcripts"""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o-mini", test_mode: bool = False):
        """
        Initialize the OpenAI restaurant analyzer
        
        Args:
            api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
            model: OpenAI model to use (default: gpt-4o-mini for cost efficiency)
            test_mode: If True, use mock responses instead of real API calls
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.test_mode = test_mode
        
        if not self.test_mode and not self.api_key:
            raise ValueError("OpenAI API key not found. Set OPENAI_API_KEY environment variable or use test_mode=True.")
        
        if not self.test_mode:
            self.client = OpenAI(api_key=self.api_key)
        else:
            self.client = None
            
        self.model = model
        self.logger = logging.getLogger(__name__)
        
        if self.test_mode:
            self.logger.info(f"🧪 OpenAI Restaurant Analyzer initialized in TEST MODE")
        else:
            self.logger.info(f"🤖 OpenAI Restaurant Analyzer initialized with model: {model}")
    
    def analyze_transcript(self, transcript_data: Dict) -> Dict:
        """
        Analyze YouTube transcript to extract restaurant information using OpenAI
        
        Args:
            transcript_data: Dictionary containing transcript information
            
        Returns:
            Dictionary with structured restaurant data
        """
        self.logger.info("🔍 Starting OpenAI analysis of restaurant mentions...")
        
        transcript_text = transcript_data['transcript']
        video_id = transcript_data['video_id']
        language = transcript_data.get('language', 'he')
        
        # Process transcript in chunks if too long
        if len(transcript_text) > 50000:
            return self._analyze_chunked_transcript(transcript_data)
        else:
            return self._analyze_single_transcript(transcript_data)
    
    def _analyze_single_transcript(self, transcript_data: Dict) -> Dict:
        """Analyze a single transcript chunk"""
        transcript_text = transcript_data['transcript']
        video_id = transcript_data['video_id']
        
        # Test mode: return mock data
        if self.test_mode:
            return self._create_mock_response(transcript_data)
        
        prompt = self._create_analysis_prompt(transcript_text, transcript_data)
        
        try:
            self.logger.info(f"🤖 Sending analysis request to OpenAI ({self.model})...")
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert in analyzing Hebrew food content and extracting structured restaurant information. You understand Hebrew food terminology, restaurant names, and Israeli cuisine culture."
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                temperature=0.1,  # Low temperature for consistent extraction
                max_tokens=4000
            )
            
            analysis_result = response.choices[0].message.content
            self.logger.info("✅ OpenAI analysis completed successfully")
            
            # Parse the structured response
            return self._parse_openai_response(analysis_result, transcript_data)
            
        except Exception as e:
            self.logger.error(f"❌ OpenAI analysis failed: {str(e)}")
            return self._create_fallback_response(transcript_data, str(e))
    
    def _analyze_chunked_transcript(self, transcript_data: Dict) -> Dict:
        """Analyze transcript in chunks for long content"""
        transcript_text = transcript_data['transcript']
        chunk_size = 25000
        overlap = 1000
        
        chunks = self._split_transcript(transcript_text, chunk_size, overlap)
        self.logger.info(f"📑 Processing transcript in {len(chunks)} chunks")
        
        all_restaurants = []
        all_trends = set()
        
        for i, chunk_text in enumerate(chunks, 1):
            self.logger.info(f"🔍 Processing chunk {i}/{len(chunks)}")
            
            chunk_data = transcript_data.copy()
            chunk_data['transcript'] = chunk_text
            
            chunk_result = self._analyze_single_transcript(chunk_data)
            
            if chunk_result and 'restaurants' in chunk_result:
                all_restaurants.extend(chunk_result['restaurants'])
                
            if chunk_result and 'food_trends' in chunk_result:
                all_trends.update(chunk_result['food_trends'])
        
        # Merge and deduplicate results
        merged_result = self._merge_chunk_results(transcript_data, all_restaurants, list(all_trends))
        return merged_result
    
    def _create_analysis_prompt(self, transcript_text: str, transcript_data: Dict) -> str:
        """Create a structured prompt for OpenAI analysis"""
        
        return f"""
Analyze this Hebrew food podcast transcript and extract ALL restaurant information mentioned.

VIDEO INFO:
- Video ID: {transcript_data.get('video_id', 'unknown')}
- Language: {transcript_data.get('language', 'he')}
- URL: {transcript_data.get('video_url', 'unknown')}

TRANSCRIPT:
{transcript_text}

TASK: Extract structured restaurant data in JSON format.

For each restaurant mentioned, provide:
{{
    "name_hebrew": "שם המסעדה בעברית",
    "name_english": "Restaurant Name in English",
    "location": {{
        "city": "עיר",
        "neighborhood": "שכונה (if mentioned)",
        "address": "כתובת מדויקת (if mentioned)",
        "region": "North/Center/South"
    }},
    "cuisine_type": "סוג המטבח",
    "status": "open/closed/unknown",
    "price_range": "budget/mid-range/expensive/unknown", 
    "host_opinion": "positive/negative/neutral/mentioned",
    "host_comments": "ציטוט ישיר מהמנחים",
    "menu_items": ["מנה 1", "מנה 2"],
    "special_features": ["תכונה מיוחדת 1", "תכונה מיוחדת 2"],
    "contact_info": {{
        "hours": "שעות פעילות (if mentioned)",
        "phone": "מספר טלפון (if mentioned)", 
        "website": "אתר אינטרנט (if mentioned)"
    }},
    "business_news": "חדשות עסקיות (if mentioned)",
    "mention_context": "review/recommendation/news/discussion"
}}

ALSO EXTRACT:
- food_trends: ["מגמת אוכל 1", "מגמת אוכל 2"]
- episode_summary: "תקציר הפרק"

Return ONLY valid JSON in this exact format:
{{
    "episode_info": {{
        "video_id": "{transcript_data.get('video_id', 'unknown')}",
        "video_url": "{transcript_data.get('video_url', 'unknown')}",
        "language": "{transcript_data.get('language', 'he')}",
        "analysis_date": "{datetime.now().strftime('%Y-%m-%d')}"
    }},
    "restaurants": [{{restaurant objects}}],
    "food_trends": ["trend1", "trend2"],
    "episode_summary": "תקציר הפרק"
}}

IMPORTANT:
- Extract restaurant names exactly as mentioned in Hebrew
- Be thorough - don't miss any restaurant mentions
- If no specific restaurants mentioned, return empty restaurants array
- Include context and host opinions accurately
- Identify cuisine types from context clues
"""

    def _parse_openai_response(self, response_text: str, transcript_data: Dict) -> Dict:
        """Parse OpenAI response and ensure proper structure"""
        try:
            # Try to extract JSON from response
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_text = response_text[json_start:json_end]
                result = json.loads(json_text)
                
                # Validate structure
                if 'restaurants' in result and 'episode_info' in result:
                    self.logger.info(f"✅ Successfully parsed {len(result['restaurants'])} restaurants")
                    return result
                else:
                    raise ValueError("Missing required fields in response")
            else:
                raise ValueError("No valid JSON found in response")
                
        except Exception as e:
            self.logger.error(f"❌ Failed to parse OpenAI response: {str(e)}")
            self.logger.debug(f"Raw response: {response_text[:500]}...")
            
            # Return fallback structure
            return self._create_fallback_response(transcript_data, f"Parsing error: {str(e)}")
    
    def _create_fallback_response(self, transcript_data: Dict, error_msg: str) -> Dict:
        """Create a fallback response when OpenAI analysis fails"""
        self.logger.info("🔄 Creating fallback response due to API issues")
        
        # Check if it's a quota error and provide informative message
        if "quota" in error_msg.lower():
            self.logger.warning("⚠️  OpenAI quota exceeded - API credits needed for restaurant extraction")
            fallback_restaurants = []  # No mock data for quota issues
            trends = ["נדרש OpenAI API key עם קרדיטים", "ניתוח ידני אפשרי"]
            summary = "נדרש OpenAI API key עם קרדיטים לניתוח מסעדות"
        else:
            # For other errors, provide minimal fallback
            fallback_restaurants = []
            trends = ["שגיאה טכנית", "נדרש ניתוח מתקדם"]
            summary = f"שגיאה טכנית: {error_msg[:100]}..."
            
        return {
            "episode_info": {
                "video_id": transcript_data.get('video_id', 'unknown'),
                "video_url": transcript_data.get('video_url', 'unknown'),
                "language": transcript_data.get('language', 'he'),
                "analysis_date": datetime.now().strftime('%Y-%m-%d'),
                "analysis_status": "fallback",
                "error": error_msg,
                "fallback_reason": "openai_api_unavailable"
            },
            "restaurants": fallback_restaurants,
            "food_trends": trends,
            "episode_summary": summary
        }
    
    def _split_transcript(self, transcript_text: str, chunk_size: int, overlap: int) -> List[str]:
        """Split transcript into overlapping chunks"""
        chunks = []
        start = 0
        
        while start < len(transcript_text):
            end = min(start + chunk_size, len(transcript_text))
            
            # Try to end at sentence boundary
            if end < len(transcript_text):
                search_start = max(start + chunk_size - 500, start)
                sentence_endings = []
                
                for punct in ['. ', '! ', '? ', '\n\n']:
                    pos = transcript_text.rfind(punct, search_start, end)
                    if pos > search_start:
                        sentence_endings.append(pos + len(punct))
                
                if sentence_endings:
                    end = max(sentence_endings)
            
            chunk = transcript_text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            start = max(end - overlap, start + 1)
            
            if end >= len(transcript_text):
                break
        
        return chunks
    
    def _merge_chunk_results(self, transcript_data: Dict, all_restaurants: List[Dict], all_trends: List[str]) -> Dict:
        """Merge and deduplicate results from multiple chunks"""
        
        # Deduplicate restaurants by Hebrew name
        unique_restaurants = {}
        
        for restaurant in all_restaurants:
            name_key = restaurant.get('name_hebrew', 'unknown')
            
            if name_key in unique_restaurants:
                existing = unique_restaurants[name_key]
                
                # Merge menu items
                existing_items = set(existing.get('menu_items', []))
                new_items = set(restaurant.get('menu_items', []))
                existing['menu_items'] = list(existing_items.union(new_items))
                
                # Merge special features
                existing_features = set(existing.get('special_features', []))
                new_features = set(restaurant.get('special_features', []))
                existing['special_features'] = list(existing_features.union(new_features))
                
                # Use longer host comments
                existing_comments = existing.get('host_comments', '')
                new_comments = restaurant.get('host_comments', '')
                if len(new_comments) > len(existing_comments):
                    existing['host_comments'] = new_comments
                
            else:
                unique_restaurants[name_key] = restaurant
        
        # Deduplicate trends
        unique_trends = list(set(all_trends))
        
        return {
            "episode_info": {
                "video_id": transcript_data.get('video_id', 'unknown'),
                "video_url": transcript_data.get('video_url', 'unknown'),
                "language": transcript_data.get('language', 'he'),
                "analysis_date": datetime.now().strftime('%Y-%m-%d'),
                "total_restaurants_found": len(unique_restaurants),
                "processing_method": "openai_chunked"
            },
            "restaurants": list(unique_restaurants.values()),
            "food_trends": unique_trends if unique_trends else ["קולינריה ישראלית", "ביקורות מסעדות"],
            "episode_summary": f"ניתוח מבוסס OpenAI של {len(unique_restaurants)} מסעדות מהסרטון {transcript_data.get('video_id', 'unknown')}"
        }
    
    def save_analysis_results(self, analysis_results: Dict, output_dir: str = "analyses") -> str:
        """Save analysis results to files"""
        os.makedirs(output_dir, exist_ok=True)
        
        video_id = analysis_results['episode_info']['video_id']
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save JSON results
        json_file = os.path.join(output_dir, f"{video_id}_{timestamp}_openai_analysis.json")
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(analysis_results, f, ensure_ascii=False, indent=2)
        
        # Save human-readable results
        md_file = os.path.join(output_dir, f"{video_id}_{timestamp}_openai_analysis.md")
        with open(md_file, 'w', encoding='utf-8') as f:
            f.write(f"# OpenAI Restaurant Analysis Results\n\n")
            f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"**Video ID:** {video_id}\n")
            f.write(f"**Model:** {self.model}\n\n")
            
            f.write(f"## Episode Summary\n")
            f.write(f"{analysis_results.get('episode_summary', 'No summary available')}\n\n")
            
            f.write(f"## Restaurants Found ({len(analysis_results.get('restaurants', []))})\n\n")
            
            for i, restaurant in enumerate(analysis_results.get('restaurants', []), 1):
                f.write(f"### {i}. {restaurant.get('name_hebrew', 'Unknown')} ({restaurant.get('name_english', 'Unknown')})\n\n")
                f.write(f"- **Location:** {restaurant.get('location', {}).get('city', 'Unknown')}")
                if restaurant.get('location', {}).get('neighborhood'):
                    f.write(f", {restaurant['location']['neighborhood']}")
                f.write(f"\n")
                f.write(f"- **Cuisine:** {restaurant.get('cuisine_type', 'Unknown')}\n")
                f.write(f"- **Price Range:** {restaurant.get('price_range', 'Unknown')}\n")
                f.write(f"- **Host Opinion:** {restaurant.get('host_opinion', 'Unknown')}\n")
                f.write(f"- **Comments:** {restaurant.get('host_comments', 'No comments')}\n")
                
                if restaurant.get('menu_items'):
                    f.write(f"- **Menu Items:** {', '.join(restaurant['menu_items'])}\n")
                
                if restaurant.get('special_features'):
                    f.write(f"- **Special Features:** {', '.join(restaurant['special_features'])}\n")
                
                f.write(f"\n")
            
            if analysis_results.get('food_trends'):
                f.write(f"## Food Trends\n\n")
                for trend in analysis_results['food_trends']:
                    f.write(f"- {trend}\n")
        
        self.logger.info(f"✅ Analysis results saved:")
        self.logger.info(f"   JSON: {json_file}")
        self.logger.info(f"   Markdown: {md_file}")
        
        return json_file
    
    def _create_mock_response(self, transcript_data: Dict) -> Dict:
        """Create a mock response for testing purposes"""
        self.logger.info("🧪 Creating mock response for testing")
        
        # Simple pattern matching for demo
        transcript_text = transcript_data['transcript'].lower()
        
        restaurants = []
        
        # Look for common Hebrew restaurant patterns
        if 'טוסקנה' in transcript_text or 'toscana' in transcript_text:
            restaurants.append({
                "name_hebrew": "טוסקנה",
                "name_english": "Toscana", 
                "location": {
                    "city": "תל אביב",
                    "neighborhood": None,
                    "address": None,
                    "region": "Center"
                },
                "cuisine_type": "Italian",
                "status": "open",
                "price_range": "expensive",
                "host_opinion": "positive",
                "host_comments": "מסעדה מעולה עם אוכל איטלקי מעולה",
                "menu_items": ["פסטה"],
                "special_features": ["אווירה מעולה"],
                "contact_info": {
                    "hours": None,
                    "phone": None,
                    "website": None
                },
                "business_news": None,
                "mention_context": "review"
            })
        
        if 'אלגרה' in transcript_text or 'alegra' in transcript_text:
            restaurants.append({
                "name_hebrew": "אלגרה",
                "name_english": "Alegra",
                "location": {
                    "city": "רמת גן",
                    "neighborhood": "רמת אביב",
                    "address": None,
                    "region": "Center"
                },
                "cuisine_type": "Cafe",
                "status": "open", 
                "price_range": "mid-range",
                "host_opinion": "positive",
                "host_comments": "בית קפה עם קפה מעולה ואווירה נעימה",
                "menu_items": ["קפה"],
                "special_features": ["אווירה מעולה"],
                "contact_info": {
                    "hours": None,
                    "phone": None,
                    "website": None
                },
                "business_news": None,
                "mention_context": "review"
            })
        
        return {
            "episode_info": {
                "video_id": transcript_data.get('video_id', 'test'),
                "video_url": transcript_data.get('video_url', 'test'),
                "language": transcript_data.get('language', 'he'),
                "analysis_date": datetime.now().strftime('%Y-%m-%d'),
                "analysis_mode": "mock_test"
            },
            "restaurants": restaurants,
            "food_trends": ["אוכל איטלקי", "בתי קפה בואריים"],
            "episode_summary": "ניתוח מדמה למטרות בדיקה - נמצאו מסעדות ובתי קפה מהתמליל"
        }