"""
Tests for UnifiedRestaurantAnalyzer - specifically JSON parsing robustness
"""

import pytest
import json
from unittest.mock import Mock, patch, MagicMock


class TestJSONParsingRobustness:
    """Test suite for robust JSON parsing that handles truncated responses"""

    def test_parse_truncated_json_with_unterminated_string(self):
        """Test that truncated JSON with unterminated string is handled gracefully"""
        # This is the exact error scenario from the bug report:
        # "Unterminated string starting at: line 285 column 17 (char 10738)"

        truncated_json = '''{"restaurants": [
            {
                "name_hebrew": "מסעדת טעם",
                "name_english": "Taste Restaurant",
                "location": {"city": "תל אביב", "neighborhood": "נמל"},
                "cuisine_type": "איטלקי",
                "status": "פתוח",
                "price_range": "בינוני",
                "host_opinion": "חיובית",
                "host_comments": "המקום מעולה עם אוכל'''  # Truncated mid-string!

        from unified_restaurant_analyzer import UnifiedRestaurantAnalyzer

        # The analyzer should have a method to safely parse JSON
        analyzer = UnifiedRestaurantAnalyzer.__new__(UnifiedRestaurantAnalyzer)
        analyzer.logger = Mock()

        # Should not raise an exception, should return partial data or empty list
        result = analyzer._safe_parse_json(truncated_json)

        # Should return a list (possibly empty or with partial data)
        assert isinstance(result, list)

    def test_parse_truncated_json_with_missing_closing_brace(self):
        """Test that truncated JSON with missing closing braces is handled"""
        truncated_json = '''{"restaurants": [
            {
                "name_hebrew": "קפה נחת",
                "name_english": "Cafe Nachat",
                "location": {"city": "ירושלים"},
                "cuisine_type": "קפה"
            }'''  # Missing ] and }

        from unified_restaurant_analyzer import UnifiedRestaurantAnalyzer

        analyzer = UnifiedRestaurantAnalyzer.__new__(UnifiedRestaurantAnalyzer)
        analyzer.logger = Mock()

        result = analyzer._safe_parse_json(truncated_json)

        # Should extract what it can
        assert isinstance(result, list)
        if len(result) > 0:
            assert result[0].get('name_hebrew') == 'קפה נחת'

    def test_parse_truncated_json_mid_array(self):
        """Test JSON truncated in the middle of an array"""
        truncated_json = '''{"restaurants": [
            {
                "name_hebrew": "מסעדה א",
                "name_english": "Restaurant A",
                "location": {"city": "תל אביב"}
            },
            {
                "name_hebrew": "מסעדה ב",
                "name_english": "Restaura'''  # Truncated mid-word

        from unified_restaurant_analyzer import UnifiedRestaurantAnalyzer

        analyzer = UnifiedRestaurantAnalyzer.__new__(UnifiedRestaurantAnalyzer)
        analyzer.logger = Mock()

        result = analyzer._safe_parse_json(truncated_json)

        assert isinstance(result, list)
        # Should recover at least the first complete restaurant
        if len(result) > 0:
            assert result[0].get('name_hebrew') == 'מסעדה א'

    def test_parse_valid_json_unchanged(self):
        """Test that valid JSON is parsed correctly"""
        valid_json = '''{"restaurants": [
            {
                "name_hebrew": "מסעדת שף",
                "name_english": "Chef Restaurant",
                "location": {"city": "חיפה"}
            }
        ]}'''

        from unified_restaurant_analyzer import UnifiedRestaurantAnalyzer

        analyzer = UnifiedRestaurantAnalyzer.__new__(UnifiedRestaurantAnalyzer)
        analyzer.logger = Mock()

        result = analyzer._safe_parse_json(valid_json)

        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]['name_hebrew'] == 'מסעדת שף'

    def test_parse_json_array_directly(self):
        """Test parsing JSON that's already an array (not wrapped in object)"""
        json_array = '''[
            {
                "name_hebrew": "ביסטרו",
                "name_english": "Bistro"
            }
        ]'''

        from unified_restaurant_analyzer import UnifiedRestaurantAnalyzer

        analyzer = UnifiedRestaurantAnalyzer.__new__(UnifiedRestaurantAnalyzer)
        analyzer.logger = Mock()

        result = analyzer._safe_parse_json(json_array)

        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]['name_hebrew'] == 'ביסטרו'

    def test_parse_empty_response(self):
        """Test handling of empty or whitespace-only response"""
        from unified_restaurant_analyzer import UnifiedRestaurantAnalyzer

        analyzer = UnifiedRestaurantAnalyzer.__new__(UnifiedRestaurantAnalyzer)
        analyzer.logger = Mock()

        result = analyzer._safe_parse_json('')
        assert isinstance(result, list)
        assert len(result) == 0

        result = analyzer._safe_parse_json('   ')
        assert isinstance(result, list)
        assert len(result) == 0

    def test_parse_non_json_response(self):
        """Test handling of responses that aren't JSON at all"""
        from unified_restaurant_analyzer import UnifiedRestaurantAnalyzer

        analyzer = UnifiedRestaurantAnalyzer.__new__(UnifiedRestaurantAnalyzer)
        analyzer.logger = Mock()

        result = analyzer._safe_parse_json('This is not JSON, just text.')
        assert isinstance(result, list)
        assert len(result) == 0


class TestCallClaudeWithRobustParsing:
    """Test that _call_claude uses robust JSON parsing"""

    def test_call_claude_handles_truncated_response(self):
        """Test that _call_claude handles truncated JSON responses gracefully"""
        from unified_restaurant_analyzer import UnifiedRestaurantAnalyzer

        # Create analyzer without full initialization
        analyzer = UnifiedRestaurantAnalyzer.__new__(UnifiedRestaurantAnalyzer)
        analyzer.logger = Mock()

        # Mock the config
        analyzer.config = Mock()
        analyzer.config.provider = 'claude'
        analyzer.config.get_active_model.return_value = 'claude-sonnet-4-20250514'
        analyzer.config.get_active_max_tokens.return_value = 4096
        analyzer.config.get_active_temperature.return_value = 0.1

        # Mock the client
        analyzer.client = Mock()

        # Mock truncated response (simulating max_tokens cutoff)
        mock_response = Mock()
        mock_response.content = [Mock()]
        mock_response.content[0].text = '''{"restaurants": [
            {
                "name_hebrew": "מסעדת הים",
                "name_english": "Sea Restaurant",
                "location": {"city": "תל אביב"},
                "cuisine_type": "דגים",
                "host_comments": "מקום מדהים עם'''  # Truncated!

        analyzer.client.messages.create.return_value = mock_response

        # Should not raise, should return empty list or partial results
        result = analyzer._call_claude("test prompt")

        assert isinstance(result, list)
