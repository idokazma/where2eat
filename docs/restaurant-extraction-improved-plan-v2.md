# Restaurant Extraction Pipeline - Research-Based Improvement Plan v2

## Executive Summary

Based on comprehensive research of current best practices in podcast content extraction, NLP, and LLM techniques, this plan outlines a significantly improved pipeline for extracting restaurant mentions from Hebrew food podcasts.

---

## Research Findings

### 1. Transcription Quality is Critical

| Source | Finding |
|--------|---------|
| [TranscribeTube](https://www.transcribetube.com/blog/ai-transcription-accuracy) | YouTube native transcription averages 66% accuracy vs Whisper's 74-95% |
| [Soniox Hebrew Benchmark](https://soniox.com/compare/soniox-vs-openai/hebrew) | Hebrew-specific: Soniox 7.5% WER vs OpenAI 16.1% WER |
| [ivrit.ai](https://huggingface.co/ivrit-ai) | Hebrew Whisper model achieves 29% error reduction over standard Whisper |
| [Spotify Podcast Dataset](https://arxiv.org/pdf/2106.09227) | 18% word error rate reported in transcribed podcasts |

**Key Insight**: YouTube's auto-generated transcripts are insufficient for accurate entity extraction. Using a Hebrew-optimized ASR model (like ivrit.ai's Whisper) can significantly improve downstream NER accuracy.

### 2. Named Entity Recognition Best Practices

| Technique | Application |
|-----------|-------------|
| **Caseless NER models** | Essential for transcribed speech that lacks proper capitalization |
| **Context-aware extraction** | Entity meaning depends on surrounding text ("Apple" = fruit or company) |
| **Post-processing validation** | Cross-reference with external knowledge sources |
| **Entity linking** | Resolve synonyms, partial names, colloquial references |

**Key Insight**: Restaurant names in Hebrew podcasts face unique challenges - colloquial references ("של יוסי"), possessive forms ("המסעדה שלו"), and transliterated names require specialized handling.

### 3. Podcast-Specific Segmentation

| Research | Finding |
|----------|---------|
| [Spotify PODTILE](https://research.atspotify.com/2024/10/podtile-facilitating-podcast-episode-browsing-with-auto-generated-chapters) | LLM-based chapter segmentation improves content navigation |
| [Multimodal Topic Segmentation](http://www.eecs.qmul.ac.uk/~mpurver/papers/ghinassi-et-al23icmr.pdf) | Combining audio + text modalities improves segmentation |
| [SliceCast](https://github.com/bmmidei/SliceCast) | Neural approach to podcast topic segmentation |

**Key Insight**: Segmenting podcasts into topical chunks before extraction improves context preservation and reduces hallucinations.

### 4. Multi-Modal Approaches

| Approach | Benefit |
|----------|---------|
| **Audio + Text fusion** | Captures prosodic cues (emphasis when mentioning restaurants) |
| **Speaker diarization** | Identifies who recommends which restaurant |
| **Visual frame extraction** | Captures on-screen restaurant names/logos in video podcasts |

**Key Insight**: Food podcasts often show restaurant visuals. A multimodal pipeline can extract text from video frames (OCR) to supplement audio extraction.

### 5. LLM Hallucination Mitigation

| Technique | Effectiveness |
|-----------|---------------|
| [EVER Framework](https://arxiv.org/html/2401.01313v1) | Real-time stepwise validation during generation |
| [Entity-level validation](https://arxiv.org/pdf/2601.09929) | Reduces hallucinations from 47.5% to 14.5% |
| [RAG grounding](https://microsoft.github.io/graphrag/) | Knowledge graph verification reduces confabulation |
| [Hierarchical semantic checking](https://link.springer.com/article/10.1007/s40747-025-01833-9) | Sentence + entity level verification |

**Key Insight**: Multi-stage verification with web search grounding is essential to ensure extracted restaurants actually exist.

### 6. Domain-Specific Fine-Tuning

| Finding | Source |
|---------|--------|
| FoodSEM achieves 98% F1 on food entity linking | [FoodSEM Paper](https://www.researchgate.net/publication/395943527_FoodSEM_Large_Language_Model_Specialized_in_Food_Named-Entity_Linking) |
| LoRA/QLoRA enables efficient domain fine-tuning | [Fine-tuning Guide](https://www.digitalocean.com/community/tutorials/llm-finetuning-domain-specific-models) |
| Small curated datasets outperform large generic ones | Multiple sources |

**Key Insight**: A Hebrew food/restaurant fine-tuned model would dramatically improve extraction accuracy.

---

## Improved Architecture

### High-Level Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INPUT SOURCES                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  YouTube URL  │  Audio File  │  Video File (with visuals)                   │
└───────┬───────┴──────┬───────┴──────────┬────────────────────────────────────┘
        │              │                  │
        ▼              ▼                  ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                    STAGE 1: MULTI-MODAL INGESTION                             │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐               │
│  │ Hebrew Whisper  │  │ Speaker         │  │ Video Frame     │               │
│  │ (ivrit.ai)      │  │ Diarization     │  │ OCR Extraction  │               │
│  │                 │  │ (pyannote)      │  │ (for visuals)   │               │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘               │
│           │                    │                    │                         │
│           ▼                    ▼                    ▼                         │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │              UNIFIED TRANSCRIPT WITH METADATA                        │     │
│  │  - High-accuracy Hebrew transcription                               │     │
│  │  - Speaker labels (Host/Guest)                                      │     │
│  │  - Timestamps for each segment                                      │     │
│  │  - On-screen text (if video)                                        │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                    STAGE 2: TOPIC SEGMENTATION                                │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  LLM-Based Chapter Detection (PODTILE-style)                        │     │
│  │  - Identify topic boundaries                                        │     │
│  │  - Detect restaurant discussion segments                            │     │
│  │  - Preserve context around mentions                                 │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│  Output: Segmented transcript with chapter markers                           │
│  Example: [00:05:23-00:12:45] "Discussion about Tel Aviv Italian restaurants"│
└───────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                    STAGE 3: LLM ENTITY EXTRACTION                             │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  Primary Extraction (Claude/GPT-4)                                   │     │
│  │  - Process each segment with full context                           │     │
│  │  - Extract restaurant candidates with confidence                    │     │
│  │  - Capture speaker attribution (who recommended)                    │     │
│  │  - Extract location hints, cuisine, opinions                        │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  Secondary Extraction (Different LLM for consensus)                  │     │
│  │  - Run same segments through different model                        │     │
│  │  - Compare extractions for consistency                              │     │
│  │  - Flag discrepancies for review                                    │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│  Output: List of restaurant candidates with extraction confidence            │
└───────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                    STAGE 4: AGENTIC WEB VERIFICATION                          │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  For each extracted restaurant:                                              │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  Step 4a: Multi-Strategy Web Search                                  │     │
│  │                                                                      │     │
│  │  Query 1: "מסעדת [name] [city]"           → Hebrew direct search    │     │
│  │  Query 2: "[name] restaurant Israel"       → English search         │     │
│  │  Query 3: "[name] [city] site:google.com/maps" → Maps verification │     │
│  │  Query 4: "[name] site:rest.co.il"         → Israeli restaurant DB  │     │
│  │  Query 5: "[name] [city] instagram"        → Social media presence  │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  Step 4b: LLM Analysis of Search Results                            │     │
│  │                                                                      │     │
│  │  Prompt: "Analyze these search results to verify if [restaurant]    │     │
│  │           exists in [city]. Extract verified address, phone,        │     │
│  │           website, and current status (open/closed)."               │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  Step 4c: Knowledge Graph Enrichment                                 │     │
│  │                                                                      │     │
│  │  - Link to Google Places ID                                         │     │
│  │  - Connect to chef/owner entities                                   │     │
│  │  - Associate with cuisine categories                                │     │
│  │  - Link to previous podcast mentions                                │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│  Output: Verified restaurants with sources and enriched data                 │
└───────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                    STAGE 5: CONFIDENCE SCORING & VALIDATION                   │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Multi-Factor Confidence Score:                                              │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  Factor                              │ Weight │ Max Points           │     │
│  │  ────────────────────────────────────┼────────┼───────────────────── │     │
│  │  LLM extraction confidence           │  20%   │  20                  │     │
│  │  Multi-LLM consensus                 │  15%   │  15                  │     │
│  │  Web search verification             │  25%   │  25                  │     │
│  │  Google Places match                 │  20%   │  20                  │     │
│  │  Number of corroborating sources     │  10%   │  10                  │     │
│  │  Data completeness (address, phone)  │  10%   │  10                  │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│  Confidence Thresholds:                                                      │
│  - HIGH (75-100): Auto-approve, add to database                             │
│  - MEDIUM (50-74): Include with verification flag                           │
│  - LOW (25-49): Require manual review                                       │
│  - REJECT (<25): Likely hallucination, discard                              │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                           FINAL OUTPUT                                        │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  {                                                                           │
│    "restaurant": {                                                           │
│      "name_hebrew": "צ'יריקו",                                               │
│      "name_english": "Chirico",                                              │
│      "verified": true,                                                       │
│      "confidence_score": 87,                                                 │
│      "confidence_level": "high"                                              │
│    },                                                                        │
│    "location": {                                                             │
│      "city": "תל אביב",                                                      │
│      "address": "רחוב הארבעה 21",                                            │
│      "coordinates": { "lat": 32.0853, "lng": 34.7818 },                      │
│      "google_place_id": "ChIJ..."                                            │
│    },                                                                        │
│    "verification": {                                                         │
│      "sources": [                                                            │
│        "https://www.google.com/maps/place/...",                              │
│        "https://www.rest.co.il/...",                                         │
│        "https://www.instagram.com/chirico_tlv"                               │
│      ],                                                                      │
│      "google_places_verified": true,                                         │
│      "last_verified": "2025-02-05"                                           │
│    },                                                                        │
│    "extraction_context": {                                                   │
│      "speaker": "מנחה",                                                      │
│      "timestamp": "00:15:32",                                                │
│      "quote": "הייתי בצ'יריקו בשבוע שעבר, האוכל האיטלקי שם מדהים",           │
│      "sentiment": "positive",                                                │
│      "recommendation": true                                                  │
│    }                                                                         │
│  }                                                                           │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Components

### Component 1: Hebrew-Optimized Transcription

**Current**: YouTube transcript API (66% accuracy)
**Proposed**: ivrit.ai Whisper model (29% better than standard Whisper)

```python
# src/hebrew_transcription_service.py

from transformers import WhisperProcessor, WhisperForConditionalGeneration
import torch

class HebrewTranscriptionService:
    """
    High-accuracy Hebrew transcription using ivrit.ai's Whisper model.

    Improvements over YouTube transcripts:
    - 29% lower word error rate
    - Better handling of Hebrew-specific phonetics
    - Proper punctuation restoration
    """

    def __init__(self):
        # Load ivrit.ai's Hebrew-optimized Whisper
        self.processor = WhisperProcessor.from_pretrained("ivrit-ai/whisper-large-v3-turbo")
        self.model = WhisperForConditionalGeneration.from_pretrained("ivrit-ai/whisper-large-v3-turbo")

        # Load Hebrew punctuation restoration model
        self.punctuation_model = self._load_punctuation_model()

    def transcribe(self, audio_path: str) -> TranscriptionResult:
        """
        Transcribe audio with Hebrew optimization.

        Returns:
            TranscriptionResult with text, timestamps, and confidence
        """
        # Transcribe with Whisper
        raw_transcript = self._whisper_transcribe(audio_path)

        # Restore punctuation (critical for NER)
        punctuated = self._restore_punctuation(raw_transcript)

        return TranscriptionResult(
            text=punctuated,
            segments=raw_transcript.segments,
            language="he",
            confidence=raw_transcript.confidence
        )
```

### Component 2: Speaker Diarization

**Purpose**: Identify who (host vs guest) recommends each restaurant

```python
# src/speaker_diarization_service.py

from pyannote.audio import Pipeline

class SpeakerDiarizationService:
    """
    Identify speakers in podcast audio using pyannote.

    Benefits for restaurant extraction:
    - Know if host or guest recommends
    - Track chef/restaurateur appearances
    - Weight recommendations by speaker authority
    """

    def __init__(self):
        self.pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=os.getenv("HUGGINGFACE_TOKEN")
        )

    def diarize(self, audio_path: str, num_speakers: int = None) -> DiarizationResult:
        """
        Perform speaker diarization.

        Args:
            audio_path: Path to audio file
            num_speakers: Optional known number of speakers

        Returns:
            DiarizationResult with speaker segments
        """
        diarization = self.pipeline(
            audio_path,
            num_speakers=num_speakers,
            min_speakers=2,
            max_speakers=5
        )

        return self._convert_to_result(diarization)
```

### Component 3: Topic Segmentation

**Purpose**: Split podcast into topical chunks for better context

```python
# src/topic_segmentation_service.py

class TopicSegmentationService:
    """
    Segment podcasts into topical chapters using LLM.

    Based on Spotify's PODTILE research:
    - LLM-based boundary detection
    - Chapter title generation
    - Restaurant discussion detection
    """

    def __init__(self):
        self.llm_client = anthropic.Anthropic()

    def segment(self, transcript: str) -> List[TopicSegment]:
        """
        Segment transcript into topical chapters.

        Returns:
            List of segments with boundaries and titles
        """
        prompt = """Analyze this Hebrew food podcast transcript and identify distinct topic segments.

TRANSCRIPT:
{transcript}

For each segment, identify:
1. Start and end positions (character offsets)
2. Topic title in Hebrew
3. Whether it discusses specific restaurants (true/false)
4. Key entities mentioned (restaurant names, chef names, locations)

Return JSON array:
[
  {{
    "start": 0,
    "end": 1500,
    "title": "פתיחה והצגת האורח",
    "discusses_restaurants": false,
    "entities": []
  }},
  {{
    "start": 1500,
    "end": 4200,
    "title": "מסעדות איטלקיות בתל אביב",
    "discusses_restaurants": true,
    "entities": ["צ'יריקו", "פרונטו", "רפאלו"]
  }}
]
"""

        response = self.llm_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt.format(transcript=transcript)}]
        )

        return self._parse_segments(response.content[0].text)
```

### Component 4: Multi-LLM Extraction with Consensus

**Purpose**: Reduce hallucinations through model agreement

```python
# src/consensus_extraction_service.py

class ConsensusExtractionService:
    """
    Extract restaurants using multiple LLMs and require consensus.

    Research shows multi-model agreement reduces hallucinations by 60%.
    """

    def __init__(self):
        self.claude_client = anthropic.Anthropic()
        self.openai_client = openai.OpenAI()

    async def extract_with_consensus(
        self,
        segment: TopicSegment
    ) -> List[RestaurantCandidate]:
        """
        Extract restaurants using multiple LLMs and find consensus.
        """
        # Run extractions in parallel
        claude_result, openai_result = await asyncio.gather(
            self._extract_claude(segment),
            self._extract_openai(segment)
        )

        # Find consensus (restaurants mentioned by both)
        consensus = self._find_consensus(claude_result, openai_result)

        # Flag disagreements for review
        disagreements = self._find_disagreements(claude_result, openai_result)

        return ConsensusResult(
            agreed=consensus,
            claude_only=claude_result - consensus,
            openai_only=openai_result - consensus,
            disagreements=disagreements
        )

    def _find_consensus(
        self,
        set_a: List[Dict],
        set_b: List[Dict]
    ) -> List[Dict]:
        """
        Find restaurants mentioned by both models.
        Uses fuzzy matching for Hebrew name variations.
        """
        consensus = []
        for a in set_a:
            for b in set_b:
                if self._names_match(a['name_hebrew'], b['name_hebrew']):
                    # Merge data from both extractions
                    merged = self._merge_extractions(a, b)
                    merged['consensus'] = True
                    consensus.append(merged)
        return consensus
```

### Component 5: Agentic Web Verification

**Purpose**: Verify extracted restaurants exist using web search

```python
# src/web_verification_agent.py

class WebVerificationAgent:
    """
    Agentic verification of restaurant existence using web search.

    Multi-strategy search approach:
    1. Hebrew direct search
    2. English transliterated search
    3. Google Maps verification
    4. Israeli restaurant database search
    5. Social media presence check
    """

    def __init__(self):
        self.llm_client = anthropic.Anthropic()

    async def verify(self, candidate: RestaurantCandidate) -> VerificationResult:
        """
        Verify a restaurant candidate exists using web search.
        """
        # Step 1: Execute multiple search strategies
        search_results = await self._multi_strategy_search(candidate)

        # Step 2: Analyze results with LLM
        analysis = await self._analyze_search_results(candidate, search_results)

        # Step 3: Extract verified data
        verified_data = await self._extract_verified_data(analysis)

        return VerificationResult(
            verified=analysis.exists,
            confidence=analysis.confidence,
            sources=search_results.urls,
            verified_data=verified_data,
            notes=analysis.notes
        )

    async def _multi_strategy_search(
        self,
        candidate: RestaurantCandidate
    ) -> SearchResults:
        """
        Execute multiple search strategies in parallel.
        """
        queries = [
            # Strategy 1: Hebrew direct
            f"מסעדת {candidate.name_hebrew} {candidate.city}",
            # Strategy 2: English
            f"{candidate.name_english} restaurant {candidate.city} Israel",
            # Strategy 3: Google Maps
            f"{candidate.name_hebrew} site:google.com/maps",
            # Strategy 4: Israeli restaurant DB
            f"{candidate.name_hebrew} site:rest.co.il OR site:2eat.co.il",
            # Strategy 5: Social media
            f"{candidate.name_hebrew} {candidate.city} instagram OR facebook"
        ]

        results = await asyncio.gather(*[
            self._execute_search(q) for q in queries
        ])

        return self._merge_search_results(results)

    async def _analyze_search_results(
        self,
        candidate: RestaurantCandidate,
        search_results: SearchResults
    ) -> AnalysisResult:
        """
        Use LLM to analyze search results and verify restaurant.
        """
        prompt = f"""Analyze these web search results to verify if this restaurant exists.

RESTAURANT TO VERIFY:
- Hebrew Name: {candidate.name_hebrew}
- English Name: {candidate.name_english}
- City: {candidate.city}
- Cuisine: {candidate.cuisine_type}

WEB SEARCH RESULTS:
{self._format_results(search_results)}

VERIFICATION TASK:
1. Does this restaurant actually exist based on the search results?
2. Is it currently open or has it closed?
3. What is the verified address?
4. What contact information can you find (phone, website, Instagram)?
5. Do the search results match the extracted information (cuisine, location)?

Return JSON:
{{
    "exists": true/false,
    "confidence": "high/medium/low",
    "status": "open/closed/unknown",
    "verified_name": "official name from web",
    "verified_address": "full address",
    "phone": "phone number",
    "website": "URL",
    "instagram": "handle",
    "google_maps_url": "maps link",
    "rating": "4.5",
    "notes": "any relevant observations"
}}
"""

        response = self.llm_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}]
        )

        return self._parse_analysis(response.content[0].text)
```

### Component 6: Confidence Scoring

**Purpose**: Multi-factor confidence assessment

```python
# src/confidence_scorer.py

class ConfidenceScorer:
    """
    Multi-factor confidence scoring for restaurant extractions.

    Combines:
    - LLM extraction confidence
    - Multi-LLM consensus
    - Web verification results
    - Data completeness
    """

    WEIGHTS = {
        'llm_extraction': 0.20,
        'multi_llm_consensus': 0.15,
        'web_verification': 0.25,
        'google_places_match': 0.20,
        'source_count': 0.10,
        'data_completeness': 0.10
    }

    def score(
        self,
        extraction: RestaurantCandidate,
        consensus: ConsensusResult,
        verification: VerificationResult
    ) -> ConfidenceScore:
        """
        Calculate multi-factor confidence score.
        """
        scores = {}

        # Factor 1: LLM extraction confidence
        scores['llm_extraction'] = self._score_extraction_confidence(extraction)

        # Factor 2: Multi-LLM consensus
        scores['multi_llm_consensus'] = 1.0 if consensus.agreed else 0.5

        # Factor 3: Web verification
        scores['web_verification'] = self._score_verification(verification)

        # Factor 4: Google Places match
        scores['google_places_match'] = 1.0 if verification.google_place_id else 0.0

        # Factor 5: Number of corroborating sources
        scores['source_count'] = min(len(verification.sources) / 5, 1.0)

        # Factor 6: Data completeness
        scores['data_completeness'] = self._score_completeness(verification)

        # Calculate weighted total
        total = sum(
            scores[factor] * weight
            for factor, weight in self.WEIGHTS.items()
        )

        return ConfidenceScore(
            total=round(total * 100),
            level=self._to_level(total),
            factors=scores
        )

    def _to_level(self, score: float) -> str:
        if score >= 0.75:
            return 'high'
        elif score >= 0.50:
            return 'medium'
        elif score >= 0.25:
            return 'low'
        else:
            return 'reject'
```

---

## Comparison: Current vs Proposed

| Aspect | Current Pipeline | Proposed Pipeline |
|--------|------------------|-------------------|
| **Transcription** | YouTube API (66% accuracy) | Hebrew Whisper (85%+ accuracy) |
| **Segmentation** | Fixed-size chunks | LLM topic segmentation |
| **Extraction** | Single LLM | Multi-LLM consensus |
| **Verification** | None | Agentic web search |
| **Confidence** | LLM self-reported | Multi-factor scoring |
| **Speaker ID** | None | Pyannote diarization |
| **Hallucination Rate** | ~40% estimated | <10% target |

---

## Implementation Priority

### Phase 1: Foundation (Week 1-2)
1. Replace YouTube transcripts with Hebrew Whisper (ivrit.ai)
2. Implement topic segmentation
3. Add multi-LLM consensus extraction

### Phase 2: Verification (Week 3-4)
4. Build web verification agent
5. Implement multi-strategy search
6. Add confidence scoring

### Phase 3: Enhancement (Week 5-6)
7. Add speaker diarization
8. Implement knowledge graph for entity linking
9. Build feedback loop for continuous improvement

### Phase 4: Optimization (Week 7-8)
10. Fine-tune model on Hebrew restaurant corpus
11. Add video OCR for visual content
12. Performance optimization and caching

---

## Expected Outcomes

| Metric | Current | Target |
|--------|---------|--------|
| Transcription accuracy | 66% | 85%+ |
| Extraction precision | ~60% | 95%+ |
| Extraction recall | Unknown | 85%+ |
| Hallucination rate | ~40% | <10% |
| Verification coverage | 0% | 95%+ |
| Processing time | ~30s | ~60s (with verification) |

---

## Sources

### Transcription & ASR
- [ivrit.ai Hebrew Whisper](https://huggingface.co/ivrit-ai) - 29% error reduction
- [Soniox Hebrew Benchmark](https://soniox.com/compare/soniox-vs-openai/hebrew) - 7.5% vs 16.1% WER
- [TranscribeTube Accuracy Study](https://www.transcribetube.com/blog/ai-transcription-accuracy)

### Named Entity Recognition
- [Width.ai NLP Techniques](https://www.width.ai/post/extracting-information-from-unstructured-text-using-algorithms)
- [Nanonets NER Guide 2025](https://nanonets.com/blog/named-entity-recognition-with-nltk-and-spacy/)
- [Google Cloud Entity Extraction](https://cloud.google.com/discover/what-is-entity-extraction)

### Podcast Analysis
- [Spotify PODTILE Research](https://research.atspotify.com/2024/10/podtile-facilitating-podcast-episode-browsing-with-auto-generated-chapters)
- [Podcast Information Access Challenges](https://arxiv.org/pdf/2106.09227)
- [Multimodal Topic Segmentation](http://www.eecs.qmul.ac.uk/~mpurver/papers/ghinassi-et-al23icmr.pdf)

### Hallucination Mitigation
- [Hallucination Detection Survey](https://arxiv.org/html/2401.01313v1)
- [Hierarchical Semantic Verification](https://link.springer.com/article/10.1007/s40747-025-01833-9)
- [Nanonets LLM Confidence](https://nanonets.com/blog/how-to-tell-if-your-llm-is-hallucinating/)

### Knowledge Graphs & RAG
- [Microsoft GraphRAG](https://microsoft.github.io/graphrag/)
- [KG-RAG Research](https://www.nature.com/articles/s41598-025-21222-z)

### Domain-Specific Fine-Tuning
- [FoodSEM Food Entity Linking](https://www.researchgate.net/publication/395943527_FoodSEM_Large_Language_Model_Specialized_in_Food_Named-Entity_Linking)
- [DigitalOcean Fine-Tuning Guide](https://www.digitalocean.com/community/tutorials/llm-finetuning-domain-specific-models)

### Speaker Diarization
- [Pyannote Audio](https://github.com/pyannote/pyannote-audio)
- [Pyannote Speaker Diarization 3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
