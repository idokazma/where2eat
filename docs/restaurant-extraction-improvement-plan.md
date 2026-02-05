# Restaurant Extraction Pipeline Improvement Plan

## Overview

This plan outlines improvements to the restaurant extraction pipeline to:
1. **Use solely LLM calls** - Remove all hardcoded mock data
2. **Implement agentic verification** - Multi-step reasoning workflow
3. **Web search verification** - Validate extracted restaurants exist

---

## Current State Analysis

### Problems Identified

| Component | Issue | Location |
|-----------|-------|----------|
| `ClaudeRestaurantAnalyzer` | Returns hardcoded mock data instead of calling LLM | `src/claude_restaurant_analyzer.py:511-637` |
| `restaurant_pipeline.py` | Returns prompt string instead of executing analysis | `src/restaurant_pipeline.py:128` |
| No verification | Extracted restaurants are never validated | - |
| No web enrichment | Missing Google/web validation of restaurant existence | - |

### Target Architecture

```
YouTube URL
    |
    v
[1. Transcript Collector]
    |
    v
[2. LLM Extraction Agent] ────────────────────────┐
    |                                              |
    | (extracted restaurants)                      |
    v                                              |
[3. Verification Agent] ◄─────────────────────────┤
    |   - Web search each restaurant              |
    |   - Validate existence                      |
    |   - Enrich with real data                   |
    |                                              |
    v                                              |
[4. Confidence Scoring Agent]                      |
    |   - Cross-reference web results             |
    |   - Assign final confidence                 |
    |   - Flag uncertain extractions              |
    |                                              |
    v                                              |
[5. Final Output]                                  |
    - Verified restaurants with confidence scores  |
    - Sources from web verification               |
    - Enriched location/contact data              |
```

---

## Implementation Plan

### Phase 1: Pure LLM Extraction (Remove Hardcoded Data)

#### 1.1 Fix `ClaudeRestaurantAnalyzer._execute_claude_code_task_tool()`

**Current (lines 511-637):**
```python
def _execute_claude_code_task_tool(self, transcript_text: str) -> str:
    # Returns hardcoded list - NEVER calls LLM
    all_restaurants = [
        {'name_hebrew': 'מרי פוסה', ...},
        # ... 10 more hardcoded restaurants
    ]
    return json.dumps(all_restaurants, ensure_ascii=False)
```

**Required change:** Replace with actual Anthropic API call:
```python
def _execute_claude_code_task_tool(self, transcript_text: str) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

    prompt = self._create_extraction_prompt(transcript_text)

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}]
    )

    return response.content[0].text
```

#### 1.2 Consolidate Analyzers

Create single `AgenticRestaurantAnalyzer` that:
- Uses `UnifiedRestaurantAnalyzer` as the base (it already has proper LLM integration)
- Removes `ClaudeRestaurantAnalyzer` mock data path
- Adds verification pipeline

---

### Phase 2: Agentic Verification Workflow

#### 2.1 New Module: `src/restaurant_verification_agent.py`

```python
class RestaurantVerificationAgent:
    """
    Agentic verification of extracted restaurants using web search.

    Workflow:
    1. Take extracted restaurant from LLM
    2. Search web for restaurant name + location
    3. Analyze search results with LLM to verify
    4. Return verification result with confidence
    """

    def __init__(self):
        self.llm_client = anthropic.Anthropic()

    async def verify_restaurant(self, restaurant: Dict) -> VerificationResult:
        """
        Verify a single restaurant exists using web search.

        Steps:
        1. Construct search query from restaurant name + city
        2. Execute web search
        3. Analyze results with LLM
        4. Return verification with sources
        """
        # Step 1: Build search query
        search_query = self._build_search_query(restaurant)

        # Step 2: Web search
        search_results = await self._web_search(search_query)

        # Step 3: LLM analysis of search results
        verification = await self._analyze_with_llm(restaurant, search_results)

        return verification

    def _build_search_query(self, restaurant: Dict) -> str:
        """Build optimal search query for restaurant verification"""
        name_hebrew = restaurant.get('name_hebrew', '')
        name_english = restaurant.get('name_english', '')
        city = restaurant.get('location', {}).get('city', '')

        # Try both Hebrew and English queries
        queries = []
        if name_hebrew:
            queries.append(f"מסעדת {name_hebrew} {city}")
        if name_english:
            queries.append(f"{name_english} restaurant {city} Israel")

        return queries

    async def _web_search(self, queries: List[str]) -> List[SearchResult]:
        """Execute web search using available tools"""
        # This will use the WebSearch tool available in Claude Code
        pass

    async def _analyze_with_llm(
        self,
        restaurant: Dict,
        search_results: List[SearchResult]
    ) -> VerificationResult:
        """Use LLM to analyze search results and verify restaurant"""

        prompt = f"""Analyze these web search results to verify if this restaurant exists.

RESTAURANT TO VERIFY:
- Hebrew Name: {restaurant.get('name_hebrew')}
- English Name: {restaurant.get('name_english')}
- City: {restaurant.get('location', {}).get('city')}
- Cuisine: {restaurant.get('cuisine_type')}

WEB SEARCH RESULTS:
{self._format_search_results(search_results)}

TASK:
1. Determine if this restaurant actually exists based on the search results
2. Extract verified information (address, phone, website, hours)
3. Assess confidence level

Return JSON:
{{
    "verified": true/false,
    "confidence": "high/medium/low",
    "verification_sources": ["url1", "url2"],
    "verified_data": {{
        "name": "official name from web",
        "address": "verified address",
        "phone": "phone number",
        "website": "official website",
        "google_maps_url": "maps link if found",
        "rating": "rating if found"
    }},
    "verification_notes": "explanation of verification decision"
}}
"""

        response = self.llm_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}]
        )

        return self._parse_verification_response(response.content[0].text)
```

#### 2.2 Verification Result Schema

```python
@dataclass
class VerificationResult:
    """Result of restaurant verification"""
    original_extraction: Dict          # What the LLM extracted
    verified: bool                     # Whether restaurant was confirmed to exist
    confidence: str                    # high/medium/low
    verification_sources: List[str]   # URLs that confirm existence
    verified_data: Dict               # Enriched data from verification
    verification_notes: str           # Explanation of decision
    search_queries_used: List[str]    # Queries that were searched
```

---

### Phase 3: Web Search Integration

#### 3.1 Search Strategies

| Strategy | Query Pattern | Use Case |
|----------|---------------|----------|
| Hebrew direct | `מסעדת [name] [city]` | Primary search for Hebrew names |
| English direct | `[name] restaurant [city] Israel` | Fallback for transliterated names |
| Google Maps | `[name] [city] site:google.com/maps` | Location verification |
| Instagram | `[name] [city] site:instagram.com` | Social media presence |
| TripAdvisor | `[name] [city] site:tripadvisor.com` | Review verification |

#### 3.2 Web Search Implementation

```python
async def search_for_restaurant(self, restaurant: Dict) -> List[SearchResult]:
    """
    Multi-strategy web search for restaurant verification.
    Uses WebSearch tool from Claude Code environment.
    """
    results = []

    # Strategy 1: Hebrew name search
    if restaurant.get('name_hebrew'):
        hebrew_query = f"מסעדת {restaurant['name_hebrew']} {restaurant.get('location', {}).get('city', '')}"
        hebrew_results = await self._execute_web_search(hebrew_query)
        results.extend(hebrew_results)

    # Strategy 2: English name search
    if restaurant.get('name_english'):
        english_query = f"{restaurant['name_english']} restaurant Israel"
        english_results = await self._execute_web_search(english_query)
        results.extend(english_results)

    # Strategy 3: Google Maps search
    maps_query = f"{restaurant.get('name_hebrew', restaurant.get('name_english'))} מסעדה"
    maps_results = await self._execute_web_search(maps_query)
    results.extend(maps_results)

    return self._deduplicate_results(results)
```

---

### Phase 4: Confidence Scoring

#### 4.1 Multi-Factor Confidence Assessment

```python
def calculate_confidence(
    self,
    extraction: Dict,
    verification: VerificationResult
) -> str:
    """
    Calculate final confidence based on multiple factors.

    Factors:
    1. LLM extraction confidence (from initial extraction)
    2. Web search match quality
    3. Number of corroborating sources
    4. Data consistency across sources
    """
    score = 0.0

    # Factor 1: Initial extraction confidence
    extraction_confidence = extraction.get('confidence', 'low')
    score += {'high': 0.3, 'medium': 0.2, 'low': 0.1}[extraction_confidence]

    # Factor 2: Verification result
    if verification.verified:
        score += 0.3

    # Factor 3: Number of sources
    num_sources = len(verification.verification_sources)
    score += min(num_sources * 0.1, 0.3)  # Max 0.3 from sources

    # Factor 4: Data richness (address, phone, etc.)
    verified_fields = sum(1 for v in verification.verified_data.values() if v)
    score += min(verified_fields * 0.02, 0.1)

    # Convert to confidence level
    if score >= 0.7:
        return 'high'
    elif score >= 0.4:
        return 'medium'
    else:
        return 'low'
```

---

### Phase 5: Updated Pipeline

#### 5.1 New `AgenticRestaurantPipeline`

```python
class AgenticRestaurantPipeline:
    """
    Complete agentic pipeline for restaurant extraction and verification.

    Flow:
    1. Fetch transcript
    2. Extract restaurants with LLM (no hardcoded data)
    3. Verify each restaurant with web search
    4. Score confidence
    5. Return verified results
    """

    def __init__(self):
        self.transcript_collector = YouTubeTranscriptCollector()
        self.extractor = UnifiedRestaurantAnalyzer()
        self.verifier = RestaurantVerificationAgent()

    async def process_video(self, video_url: str) -> PipelineResult:
        """Process a YouTube video through the complete pipeline."""

        # Step 1: Fetch transcript
        transcript = await self.transcript_collector.get_transcript(video_url)

        # Step 2: Extract restaurants with LLM
        extraction_result = self.extractor.analyze_transcript({
            'video_id': transcript['video_id'],
            'video_url': video_url,
            'language': transcript['language'],
            'transcript': transcript['transcript']
        })

        # Step 3: Verify each restaurant
        verified_restaurants = []
        for restaurant in extraction_result['restaurants']:
            verification = await self.verifier.verify_restaurant(restaurant)

            # Merge extraction with verification
            verified_restaurant = {
                **restaurant,
                'verification': {
                    'verified': verification.verified,
                    'confidence': verification.confidence,
                    'sources': verification.verification_sources,
                    'verified_data': verification.verified_data,
                    'notes': verification.verification_notes
                }
            }
            verified_restaurants.append(verified_restaurant)

        # Step 4: Filter and rank by confidence
        high_confidence = [r for r in verified_restaurants
                          if r['verification']['confidence'] == 'high']
        medium_confidence = [r for r in verified_restaurants
                            if r['verification']['confidence'] == 'medium']

        return PipelineResult(
            video_id=transcript['video_id'],
            restaurants=verified_restaurants,
            high_confidence_count=len(high_confidence),
            medium_confidence_count=len(medium_confidence),
            verification_stats={
                'total_extracted': len(extraction_result['restaurants']),
                'verified': sum(1 for r in verified_restaurants
                               if r['verification']['verified']),
                'unverified': sum(1 for r in verified_restaurants
                                 if not r['verification']['verified'])
            }
        )
```

---

## File Changes Required

### Files to Modify

| File | Changes |
|------|---------|
| `src/claude_restaurant_analyzer.py` | Remove hardcoded data in `_execute_claude_code_task_tool()`, add actual API call |
| `src/restaurant_pipeline.py` | Replace prompt return with actual execution |
| `src/unified_restaurant_analyzer.py` | Keep as-is (already uses LLM properly) |
| `src/backend_service.py` | Fix analyzer call signature (lines 183-188) |

### New Files to Create

| File | Purpose |
|------|---------|
| `src/restaurant_verification_agent.py` | Agentic verification with web search |
| `src/agentic_restaurant_pipeline.py` | Complete agentic pipeline orchestrator |
| `tests/test_restaurant_verification.py` | Tests for verification agent |

---

## Implementation Sequence

```
Week 1: Core LLM Integration
├── Day 1-2: Fix ClaudeRestaurantAnalyzer to use actual API
├── Day 3-4: Fix BackendService signature mismatch
└── Day 5: Test LLM extraction end-to-end

Week 2: Verification Agent
├── Day 1-2: Create RestaurantVerificationAgent
├── Day 3-4: Implement web search strategies
└── Day 5: Integrate LLM analysis of search results

Week 3: Pipeline Integration
├── Day 1-2: Create AgenticRestaurantPipeline
├── Day 3-4: Add confidence scoring
└── Day 5: End-to-end testing

Week 4: Testing & Refinement
├── Day 1-2: Write comprehensive tests
├── Day 3-4: Performance optimization
└── Day 5: Documentation
```

---

## Expected Outcomes

### Before (Current State)
- Returns hardcoded restaurant data
- No verification of extracted names
- ~60% accuracy (based on hardcoded matching)

### After (Target State)
- Pure LLM extraction from transcripts
- Web search verification for each restaurant
- Confidence scoring based on verification
- Expected 90%+ precision on high-confidence extractions
- Sources provided for each verified restaurant

---

## Success Metrics

| Metric | Target |
|--------|--------|
| High-confidence precision | > 95% |
| Overall recall | > 80% |
| Verification coverage | > 90% of extractions searched |
| False positive rate | < 5% for high-confidence |
| Average verification time | < 5s per restaurant |
