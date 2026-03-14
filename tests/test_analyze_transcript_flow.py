"""
End-to-end tests for UnifiedRestaurantAnalyzer.analyze_transcript() flow.

Tests the complete pipeline from transcript input to structured output,
covering single-pass analysis, chunking, error handling, and all 3 providers.
"""

import json
import os
import sys
import pytest
from unittest.mock import Mock, MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

MOCK_RESTAURANTS_JSON = json.dumps({
    "restaurants": [
        {
            "name_hebrew": "Taste House",
            "name_english": "Taste House",
            "confidence": "high",
            "location": {
                "city": "Tel Aviv",
                "neighborhood": "Neve Tzedek",
                "address": "10 Shabazi St",
                "region": "Center"
            },
            "cuisine_type": "Italian",
            "establishment_type": "restaurant",
            "status": "open",
            "price_range": "mid-range",
            "host_opinion": "positive",
            "host_recommendation": True,
            "host_comments": "Great place with amazing pasta",
            "engaging_quote": "This pasta is out of this world!",
            "mention_timestamp_seconds": 120,
            "signature_dishes": ["Truffle Pasta"],
            "menu_items": ["Pasta", "Pizza"],
            "special_features": ["Sea view"],
            "chef_name": "Chef Dan",
            "contact_info": {"phone": None, "website": None, "instagram": None},
            "business_news": None,
            "mention_context": "The host visited Taste House in Neve Tzedek",
            "timestamp_hint": "beginning"
        }
    ],
    "extraction_notes": "Clear mention"
})

MOCK_EMPTY_RESTAURANTS_JSON = json.dumps({
    "restaurants": [],
    "extraction_notes": "No restaurants mentioned"
})


def make_analyzer(provider):
    """Create an analyzer via __new__() with mock logger/config/client."""
    from unified_restaurant_analyzer import UnifiedRestaurantAnalyzer

    analyzer = UnifiedRestaurantAnalyzer.__new__(UnifiedRestaurantAnalyzer)
    analyzer.logger = Mock()

    analyzer.config = Mock()
    analyzer.config.provider = provider
    analyzer.config.get_active_model.return_value = {
        'openai': 'gpt-4o-mini',
        'claude': 'claude-sonnet-4-20250514',
        'gemini': 'gemini-2.0-flash',
    }[provider]
    analyzer.config.get_active_max_tokens.return_value = 4096
    analyzer.config.get_active_temperature.return_value = 0.1
    analyzer.config.chunk_size = 30000
    analyzer.config.chunk_overlap = 1000
    analyzer.config.enable_chunking = True

    analyzer.client = Mock()
    return analyzer


def mock_llm_response(analyzer, provider, json_payload):
    """Wire up the correct mock return value for each provider's client method."""
    if provider == 'openai':
        mock_msg = Mock()
        mock_msg.content = json_payload
        mock_choice = Mock()
        mock_choice.message = mock_msg
        mock_resp = Mock()
        mock_resp.choices = [mock_choice]
        analyzer.client.chat.completions.create.return_value = mock_resp

    elif provider == 'claude':
        mock_block = Mock()
        mock_block.text = json_payload
        mock_resp = Mock()
        mock_resp.content = [mock_block]
        analyzer.client.messages.create.return_value = mock_resp

    elif provider == 'gemini':
        mock_resp = Mock()
        mock_resp.text = json_payload
        analyzer.client.models.generate_content.return_value = mock_resp


def assert_valid_analysis(result, expected_count):
    """Validate the full output structure of analyze_transcript."""
    assert isinstance(result, dict)

    # episode_info
    info = result.get('episode_info')
    assert info is not None
    assert 'video_id' in info
    assert 'video_url' in info
    assert 'analysis_date' in info
    assert 'total_restaurants_found' in info
    assert 'llm_provider' in info
    assert info['total_restaurants_found'] == expected_count

    # restaurants
    restaurants = result.get('restaurants')
    assert isinstance(restaurants, list)
    assert len(restaurants) == expected_count

    # food_trends & episode_summary
    assert isinstance(result.get('food_trends'), list)
    assert isinstance(result.get('episode_summary'), str)


# ---------------------------------------------------------------------------
# 1. Single-pass analysis
# ---------------------------------------------------------------------------

class TestAnalyzeTranscriptSinglePass:
    """Test the full analyze_transcript flow with a single LLM call."""

    def test_analyze_transcript_openai_valid_response_returns_structured_result(
        self, full_transcript_data
    ):
        analyzer = make_analyzer('openai')
        mock_llm_response(analyzer, 'openai', MOCK_RESTAURANTS_JSON)

        result = analyzer.analyze_transcript(full_transcript_data)

        assert_valid_analysis(result, 1)
        assert result['episode_info']['llm_provider'] == 'openai'
        analyzer.client.chat.completions.create.assert_called_once()

    def test_analyze_transcript_claude_valid_response_returns_structured_result(
        self, full_transcript_data
    ):
        """Also verifies markdown-wrapped JSON cleanup."""
        analyzer = make_analyzer('claude')
        # Wrap in markdown fences like Claude sometimes does
        wrapped = f"```json\n{MOCK_RESTAURANTS_JSON}\n```"
        mock_llm_response(analyzer, 'claude', wrapped)

        result = analyzer.analyze_transcript(full_transcript_data)

        assert_valid_analysis(result, 1)
        assert result['episode_info']['llm_provider'] == 'claude'

    def test_analyze_transcript_gemini_valid_response_returns_structured_result(
        self, full_transcript_data
    ):
        analyzer = make_analyzer('gemini')
        mock_llm_response(analyzer, 'gemini', MOCK_RESTAURANTS_JSON)

        mock_types = MagicMock()
        with patch.dict('sys.modules', {
            'google': MagicMock(),
            'google.genai': MagicMock(),
            'google.genai.types': mock_types,
        }):
            with patch(
                'unified_restaurant_analyzer.UnifiedRestaurantAnalyzer._get_system_prompt',
                return_value="system prompt",
            ):
                result = analyzer.analyze_transcript(full_transcript_data)

        assert_valid_analysis(result, 1)
        assert result['episode_info']['llm_provider'] == 'gemini'

    def test_analyze_transcript_propagates_video_metadata_to_episode_info(
        self, full_transcript_data
    ):
        analyzer = make_analyzer('openai')
        mock_llm_response(analyzer, 'openai', MOCK_RESTAURANTS_JSON)

        result = analyzer.analyze_transcript(full_transcript_data)

        assert result['episode_info']['video_id'] == full_transcript_data['video_id']
        assert result['episode_info']['video_url'] == full_transcript_data['video_url']

    def test_analyze_transcript_empty_restaurants_returns_zero_count(
        self, full_transcript_data
    ):
        analyzer = make_analyzer('openai')
        mock_llm_response(analyzer, 'openai', MOCK_EMPTY_RESTAURANTS_JSON)

        result = analyzer.analyze_transcript(full_transcript_data)

        assert_valid_analysis(result, 0)


# ---------------------------------------------------------------------------
# 2. Chunking
# ---------------------------------------------------------------------------

class TestAnalyzeTranscriptChunking:
    """Test chunked transcript analysis."""

    def _make_long_transcript_data(self, full_transcript_data, length=500):
        """Build transcript data with a long transcript string."""
        data = full_transcript_data.copy()
        data['transcript'] = "A" * length
        return data

    def test_analyze_transcript_long_transcript_triggers_chunking(
        self, full_transcript_data
    ):
        analyzer = make_analyzer('openai')
        analyzer.config.chunk_size = 100
        analyzer.config.chunk_overlap = 20

        data = self._make_long_transcript_data(full_transcript_data, length=500)
        mock_llm_response(analyzer, 'openai', MOCK_RESTAURANTS_JSON)

        result = analyzer.analyze_transcript(data)

        assert_valid_analysis(result, 1)
        assert 'chunks_processed' in result['episode_info']
        assert result['episode_info']['chunks_processed'] > 1
        # Multiple LLM calls should have been made
        assert analyzer.client.chat.completions.create.call_count > 1

    def test_analyze_transcript_chunking_deduplicates_restaurants(
        self, full_transcript_data
    ):
        """Same restaurant returned by multiple chunks should appear once."""
        analyzer = make_analyzer('openai')
        analyzer.config.chunk_size = 100
        analyzer.config.chunk_overlap = 20

        data = self._make_long_transcript_data(full_transcript_data, length=300)
        mock_llm_response(analyzer, 'openai', MOCK_RESTAURANTS_JSON)

        result = analyzer.analyze_transcript(data)

        # Even though multiple chunks each return the same restaurant,
        # deduplication should collapse them to 1.
        assert len(result['restaurants']) == 1

    def test_analyze_transcript_chunking_merges_menu_items(
        self, full_transcript_data
    ):
        """Same restaurant with different menu_items across chunks -> combined."""
        analyzer = make_analyzer('openai')
        analyzer.config.chunk_size = 100
        analyzer.config.chunk_overlap = 20

        data = self._make_long_transcript_data(full_transcript_data, length=300)

        # First chunk returns restaurant with menu_items A
        resp_a = json.dumps({
            "restaurants": [{
                "name_hebrew": "Taste House",
                "name_english": "Taste House",
                "location": {"city": "Tel Aviv"},
                "menu_items": ["Pasta", "Pizza"],
            }]
        })
        # Second chunk returns same restaurant with menu_items B
        resp_b = json.dumps({
            "restaurants": [{
                "name_hebrew": "Taste House",
                "name_english": "Taste House",
                "location": {"city": "Tel Aviv"},
                "menu_items": ["Salad", "Pizza"],
            }]
        })

        mock_msg_a = Mock()
        mock_msg_a.content = resp_a
        mock_choice_a = Mock()
        mock_choice_a.message = mock_msg_a
        mock_resp_a = Mock()
        mock_resp_a.choices = [mock_choice_a]

        mock_msg_b = Mock()
        mock_msg_b.content = resp_b
        mock_choice_b = Mock()
        mock_choice_b.message = mock_msg_b
        mock_resp_b = Mock()
        mock_resp_b.choices = [mock_choice_b]

        analyzer.client.chat.completions.create.side_effect = [
            mock_resp_a, mock_resp_b, mock_resp_a, mock_resp_b,
            mock_resp_a, mock_resp_b, mock_resp_a, mock_resp_b,
        ]

        result = analyzer.analyze_transcript(data)

        assert len(result['restaurants']) == 1
        menu = result['restaurants'][0].get('menu_items', [])
        assert 'Pasta' in menu
        assert 'Pizza' in menu
        assert 'Salad' in menu

    def test_analyze_transcript_chunking_disabled_processes_as_single(
        self, full_transcript_data
    ):
        """enable_chunking=False -> single LLM call even for long transcripts."""
        analyzer = make_analyzer('openai')
        analyzer.config.enable_chunking = False
        analyzer.config.chunk_size = 100

        data = self._make_long_transcript_data(full_transcript_data, length=500)
        mock_llm_response(analyzer, 'openai', MOCK_RESTAURANTS_JSON)

        result = analyzer.analyze_transcript(data)

        assert_valid_analysis(result, 1)
        assert 'chunks_processed' not in result['episode_info']
        analyzer.client.chat.completions.create.assert_called_once()


# ---------------------------------------------------------------------------
# 3. Error handling
# ---------------------------------------------------------------------------

class TestAnalyzeTranscriptErrorHandling:
    """Test error paths in analyze_transcript."""

    def test_analyze_transcript_api_failure_returns_error_analysis(
        self, full_transcript_data
    ):
        analyzer = make_analyzer('openai')
        analyzer.client.chat.completions.create.side_effect = Exception("API timeout")

        result = analyzer.analyze_transcript(full_transcript_data)

        assert isinstance(result, dict)
        assert result['restaurants'] == []
        assert result['episode_info']['total_restaurants_found'] == 0
        assert 'error' in result['episode_info'].get('processing_method', '').lower() or \
               'error' in result.get('episode_summary', '').lower()

    def test_analyze_transcript_malformed_response_returns_empty(
        self, full_transcript_data
    ):
        """Non-JSON LLM response -> valid structure, 0 restaurants."""
        analyzer = make_analyzer('openai')

        # OpenAI response with non-JSON content
        mock_msg = Mock()
        mock_msg.content = "Sorry, I cannot process this transcript."
        mock_choice = Mock()
        mock_choice.message = mock_msg
        mock_resp = Mock()
        mock_resp.choices = [mock_choice]
        analyzer.client.chat.completions.create.return_value = mock_resp

        # _call_openai does json.loads which will raise -> propagates as error
        result = analyzer.analyze_transcript(full_transcript_data)

        assert isinstance(result, dict)
        assert result['restaurants'] == []
        assert result['episode_info']['total_restaurants_found'] == 0

    def test_analyze_transcript_missing_transcript_key_returns_error(self):
        """Missing 'transcript' key -> error analysis."""
        analyzer = make_analyzer('openai')

        bad_data = {
            'video_id': 'test123',
            'video_url': 'https://youtube.com/watch?v=test123',
            # no 'transcript' key
        }

        result = analyzer.analyze_transcript(bad_data)

        assert isinstance(result, dict)
        assert result['restaurants'] == []
        assert result['episode_info']['total_restaurants_found'] == 0


# ---------------------------------------------------------------------------
# 4. Parametrized across providers
# ---------------------------------------------------------------------------

class TestAnalyzeTranscriptParameterized:
    """Verify consistent behavior across all 3 providers."""

    @pytest.mark.parametrize("provider", ["openai", "claude", "gemini"])
    def test_analyze_transcript_all_providers_produce_valid_structure(
        self, full_transcript_data, provider
    ):
        analyzer = make_analyzer(provider)
        mock_llm_response(analyzer, provider, MOCK_RESTAURANTS_JSON)

        ctx_managers = []
        if provider == 'gemini':
            ctx_managers.append(
                patch.dict('sys.modules', {
                    'google': MagicMock(),
                    'google.genai': MagicMock(),
                    'google.genai.types': MagicMock(),
                })
            )
            ctx_managers.append(
                patch(
                    'unified_restaurant_analyzer.UnifiedRestaurantAnalyzer._get_system_prompt',
                    return_value="system prompt",
                )
            )

        # Enter all context managers
        for cm in ctx_managers:
            cm.__enter__()
        try:
            result = analyzer.analyze_transcript(full_transcript_data)
        finally:
            for cm in reversed(ctx_managers):
                cm.__exit__(None, None, None)

        assert_valid_analysis(result, 1)

    @pytest.mark.parametrize("provider", ["openai", "claude", "gemini"])
    def test_analyze_transcript_all_providers_set_correct_llm_provider(
        self, full_transcript_data, provider
    ):
        analyzer = make_analyzer(provider)
        mock_llm_response(analyzer, provider, MOCK_RESTAURANTS_JSON)

        ctx_managers = []
        if provider == 'gemini':
            ctx_managers.append(
                patch.dict('sys.modules', {
                    'google': MagicMock(),
                    'google.genai': MagicMock(),
                    'google.genai.types': MagicMock(),
                })
            )
            ctx_managers.append(
                patch(
                    'unified_restaurant_analyzer.UnifiedRestaurantAnalyzer._get_system_prompt',
                    return_value="system prompt",
                )
            )

        for cm in ctx_managers:
            cm.__enter__()
        try:
            result = analyzer.analyze_transcript(full_transcript_data)
        finally:
            for cm in reversed(ctx_managers):
                cm.__exit__(None, None, None)

        assert result['episode_info']['llm_provider'] == provider


# ---------------------------------------------------------------------------
# 5. Integration tests (real API calls, skipped without keys)
# ---------------------------------------------------------------------------

@pytest.mark.network
class TestAnalyzeTranscriptIntegration:
    """Real API calls - require API keys and network access."""

    def _get_real_analyzer(self, provider):
        """Create a real analyzer with the given provider."""
        from llm_config import LLMConfig, _config
        import llm_config

        config = LLMConfig(
            provider=provider,
            openai_api_key=os.getenv('OPENAI_API_KEY'),
            claude_api_key=os.getenv('ANTHROPIC_API_KEY') or os.getenv('CLAUDE_API_KEY'),
            gemini_api_key=os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY'),
            chunk_size=30000,
            enable_chunking=True,
        )

        old_config = llm_config._config
        try:
            llm_config._config = config
            from unified_restaurant_analyzer import UnifiedRestaurantAnalyzer
            analyzer = UnifiedRestaurantAnalyzer()
            return analyzer
        finally:
            llm_config._config = old_config

    def test_analyze_transcript_real_gemini_api_returns_valid_structure(
        self, full_transcript_data
    ):
        api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
        if not api_key:
            pytest.skip("GEMINI_API_KEY not set")

        analyzer = self._get_real_analyzer('gemini')
        result = analyzer.analyze_transcript(full_transcript_data)

        assert isinstance(result, dict)
        assert 'episode_info' in result
        assert 'restaurants' in result
        assert isinstance(result['restaurants'], list)

    def test_analyze_transcript_real_claude_api_returns_valid_structure(
        self, full_transcript_data
    ):
        api_key = os.getenv('ANTHROPIC_API_KEY') or os.getenv('CLAUDE_API_KEY')
        if not api_key:
            pytest.skip("ANTHROPIC_API_KEY not set")

        analyzer = self._get_real_analyzer('claude')
        result = analyzer.analyze_transcript(full_transcript_data)

        assert isinstance(result, dict)
        assert 'episode_info' in result
        assert 'restaurants' in result
        assert isinstance(result['restaurants'], list)

    def test_analyze_transcript_real_openai_api_returns_valid_structure(
        self, full_transcript_data
    ):
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            pytest.skip("OPENAI_API_KEY not set")

        analyzer = self._get_real_analyzer('openai')
        result = analyzer.analyze_transcript(full_transcript_data)

        assert isinstance(result, dict)
        assert 'episode_info' in result
        assert 'restaurants' in result
        assert isinstance(result['restaurants'], list)
