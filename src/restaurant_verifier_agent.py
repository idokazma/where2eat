"""
LLM-Based Restaurant Verification Agent

Uses Claude with web search capabilities to verify if extracted
restaurant names are real restaurants in Israel.
"""

import os
import json
import logging
import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from anthropic import Anthropic

logger = logging.getLogger(__name__)


@dataclass
class VerificationResult:
    """Result of LLM-based restaurant verification."""
    is_real: bool
    confidence: float  # 0.0 = definitely fake, 1.0 = definitely real
    verified_name: Optional[str]  # Corrected name if found
    verified_city: Optional[str]  # Verified location
    evidence: List[str]  # Evidence found during verification
    reasoning: str  # LLM's reasoning
    search_queries_used: List[str]


class RestaurantVerifierAgent:
    """
    Agent that uses Claude with web search to verify restaurant extractions.

    This agent:
    1. Takes an extracted restaurant name and context
    2. Searches the web for the restaurant
    3. Verifies if it's a real restaurant in Israel
    4. Returns verification result with evidence
    """

    def __init__(self, api_key: Optional[str] = None):
        """Initialize the verifier agent."""
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY is required")

        self.client = Anthropic(api_key=self.api_key)
        self.model = "claude-sonnet-4-20250514"  # Use Sonnet for cost efficiency

    def verify_restaurant(
        self,
        name_hebrew: str,
        name_english: Optional[str] = None,
        city: Optional[str] = None,
        context: Optional[str] = None,
        episode_title: Optional[str] = None
    ) -> VerificationResult:
        """
        Verify if a restaurant is real using web search.

        Args:
            name_hebrew: Hebrew name of the restaurant
            name_english: English name (if available)
            city: City where restaurant is located
            context: Original context where restaurant was mentioned
            episode_title: Title of the episode (for additional context)

        Returns:
            VerificationResult with verification details
        """
        # Build verification prompt
        prompt = self._build_verification_prompt(
            name_hebrew, name_english, city, context, episode_title
        )

        try:
            # Call Claude with web search tool
            response = self.client.messages.create(
                model=self.model,
                max_tokens=2048,
                tools=[{
                    "type": "web_search_20250305",
                    "name": "web_search",
                    "max_uses": 5
                }],
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )

            # Parse the response
            return self._parse_response(response, name_hebrew)

        except Exception as e:
            logger.error(f"Verification failed for '{name_hebrew}': {e}")
            # Return uncertain result on error
            return VerificationResult(
                is_real=False,
                confidence=0.5,
                verified_name=None,
                verified_city=None,
                evidence=[f"Verification error: {str(e)}"],
                reasoning="Could not complete verification due to error",
                search_queries_used=[]
            )

    def _build_verification_prompt(
        self,
        name_hebrew: str,
        name_english: Optional[str],
        city: Optional[str],
        context: Optional[str],
        episode_title: Optional[str]
    ) -> str:
        """Build the verification prompt for Claude."""
        prompt = f"""You are a restaurant verification agent. Your task is to verify if an extracted restaurant name is a REAL restaurant in Israel.

IMPORTANT: Many extracted names are hallucinations - common Hebrew words, sentence fragments, or gibberish that are NOT real restaurant names. You must be skeptical.

## Restaurant to Verify:
- Hebrew Name: {name_hebrew}
- English Name: {name_english or 'Not provided'}
- Claimed Location: {city or 'Not specified'}
"""

        if context:
            prompt += f"""
## Original Context (where it was mentioned):
{context[:500]}
"""

        if episode_title:
            prompt += f"""
## Episode Title:
{episode_title}
"""

        prompt += """
## Your Task:
1. Search for this restaurant in Israel using web search
2. Look for:
   - Google Maps/Business listings
   - Restaurant review sites (מפה, Rest, Wolt, 10bis)
   - Social media presence
   - News articles or blog posts
3. Determine if this is a REAL restaurant or a hallucination

## Signs of HALLUCINATION (reject these):
- Name is a common Hebrew word (like "דיוק", "כל", "שנה", "יותר")
- Name is a sentence fragment
- Name is gibberish or truncated text
- No search results for a restaurant with this name in Israel
- Search results show a completely different business/place

## Signs of REAL restaurant (accept these):
- Has Google Maps/Business listing as a restaurant
- Has reviews on restaurant sites
- Has social media presence showing it's a restaurant
- Mentioned in food blogs or news as a restaurant

## Response Format:
After your research, respond with a JSON object:
```json
{
    "is_real": true/false,
    "confidence": 0.0-1.0,
    "verified_name": "correct name if found, null otherwise",
    "verified_city": "verified city if found, null otherwise",
    "evidence": ["evidence item 1", "evidence item 2"],
    "reasoning": "Your detailed reasoning for the decision",
    "search_queries_used": ["query 1", "query 2"]
}
```

Be thorough but skeptical. If you can't find clear evidence it's a real restaurant, mark it as not real.
"""
        return prompt

    def _parse_response(self, response, original_name: str) -> VerificationResult:
        """Parse Claude's response into a VerificationResult."""
        # Extract text content from response
        text_content = ""
        search_queries = []

        for block in response.content:
            if hasattr(block, 'text'):
                text_content += block.text
            elif hasattr(block, 'type') and block.type == 'tool_use':
                if hasattr(block, 'input') and 'query' in block.input:
                    search_queries.append(block.input['query'])

        # Try to extract JSON from response
        try:
            # Find JSON in response
            json_match = re.search(r'```json\s*(.*?)\s*```', text_content, re.DOTALL)
            if json_match:
                result_json = json.loads(json_match.group(1))
            else:
                # Try to parse the whole text as JSON
                json_match = re.search(r'\{[^{}]*"is_real"[^{}]*\}', text_content, re.DOTALL)
                if json_match:
                    result_json = json.loads(json_match.group(0))
                else:
                    raise ValueError("No JSON found in response")

            return VerificationResult(
                is_real=result_json.get("is_real", False),
                confidence=float(result_json.get("confidence", 0.5)),
                verified_name=result_json.get("verified_name"),
                verified_city=result_json.get("verified_city"),
                evidence=result_json.get("evidence", []),
                reasoning=result_json.get("reasoning", ""),
                search_queries_used=result_json.get("search_queries_used", search_queries)
            )

        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"Could not parse JSON response for '{original_name}': {e}")

            # Try to infer from text
            is_real = "is_real\": true" in text_content.lower() or "is a real restaurant" in text_content.lower()

            return VerificationResult(
                is_real=is_real,
                confidence=0.5,
                verified_name=None,
                verified_city=None,
                evidence=[text_content[:500] if text_content else "No evidence found"],
                reasoning="Could not parse structured response",
                search_queries_used=search_queries
            )

    def verify_batch(
        self,
        restaurants: List[Dict],
        skip_already_verified: bool = True
    ) -> List[Tuple[Dict, VerificationResult]]:
        """
        Verify a batch of restaurants.

        Args:
            restaurants: List of restaurant dictionaries
            skip_already_verified: Skip restaurants that have _verification field

        Returns:
            List of (restaurant, VerificationResult) tuples
        """
        results = []

        for i, restaurant in enumerate(restaurants):
            name_hebrew = restaurant.get("name_hebrew", "")

            # Skip if already verified
            if skip_already_verified and "_verification" in restaurant:
                logger.info(f"Skipping already verified: {name_hebrew}")
                continue

            logger.info(f"[{i+1}/{len(restaurants)}] Verifying: {name_hebrew}")

            # Get context from restaurant data
            context = None
            if restaurant.get("host_comments"):
                context = restaurant["host_comments"]

            episode_title = restaurant.get("episode_info", {}).get("video_title")

            # Verify
            result = self.verify_restaurant(
                name_hebrew=name_hebrew,
                name_english=restaurant.get("name_english"),
                city=restaurant.get("location", {}).get("city"),
                context=context,
                episode_title=episode_title
            )

            # Add verification to restaurant
            restaurant["_verification"] = asdict(result)

            results.append((restaurant, result))

            logger.info(
                f"  Result: {'✅ REAL' if result.is_real else '❌ FAKE'} "
                f"(confidence: {result.confidence:.2f})"
            )

        return results


def verify_and_filter_restaurants(
    restaurants: List[Dict],
    confidence_threshold: float = 0.6
) -> Tuple[List[Dict], List[Dict]]:
    """
    Verify restaurants using LLM agent and filter out hallucinations.

    Args:
        restaurants: List of restaurant dictionaries
        confidence_threshold: Minimum confidence to accept

    Returns:
        Tuple of (verified_restaurants, rejected_restaurants)
    """
    agent = RestaurantVerifierAgent()

    verified = []
    rejected = []

    results = agent.verify_batch(restaurants)

    for restaurant, result in results:
        if result.is_real and result.confidence >= confidence_threshold:
            # Update restaurant with verified info if available
            if result.verified_name:
                restaurant["name_verified"] = result.verified_name
            if result.verified_city:
                restaurant["location"]["city_verified"] = result.verified_city
            verified.append(restaurant)
        else:
            rejected.append(restaurant)

    logger.info(f"Verification complete: {len(verified)} verified, {len(rejected)} rejected")

    return verified, rejected


# Quick verification for a single restaurant
def quick_verify(name: str, city: Optional[str] = None) -> VerificationResult:
    """
    Quickly verify a single restaurant by name.

    Args:
        name: Restaurant name (Hebrew or English)
        city: Optional city name

    Returns:
        VerificationResult
    """
    agent = RestaurantVerifierAgent()
    return agent.verify_restaurant(name_hebrew=name, city=city)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # Test with some examples
    test_restaurants = [
        {"name_hebrew": "מחניודה", "location": {"city": "ירושלים"}},
        {"name_hebrew": "דיוק", "location": {"city": "לא צוין"}},  # Hallucination
        {"name_hebrew": "כל", "location": {"city": "לא צוין"}},  # Hallucination
    ]

    print("\n" + "="*60)
    print("RESTAURANT VERIFICATION TEST")
    print("="*60)

    for restaurant in test_restaurants:
        print(f"\nVerifying: {restaurant['name_hebrew']}")
        result = quick_verify(
            restaurant["name_hebrew"],
            restaurant.get("location", {}).get("city")
        )
        print(f"  Is Real: {result.is_real}")
        print(f"  Confidence: {result.confidence}")
        print(f"  Reasoning: {result.reasoning[:200]}...")
