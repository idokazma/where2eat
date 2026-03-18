"""
Tests for the Hallucination Detector module.

Tests cover:
1. Detection of common Hebrew words
2. Detection of sentence fragments
3. Name matching with Google Places
4. Hebrew-to-English transliteration matching
5. Data completeness scoring
6. End-to-end filtering
"""

import pytest
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from hallucination_detector import (
    HallucinationDetector,
    HallucinationResult,
    filter_hallucinations,
    COMMON_HEBREW_WORDS,
    SENTENCE_FRAGMENT_PATTERNS,
)


class TestHallucinationDetector:
    """Tests for the HallucinationDetector class."""

    @pytest.fixture
    def detector(self):
        """Create a detector instance for testing."""
        return HallucinationDetector(strict_mode=True)

    # ==================== Real Restaurant Tests ====================

    def test_detect_real_restaurant_with_matching_google_name(self, detector):
        """Real restaurant with matching Google Places data should be accepted."""
        restaurant = {
            "name_hebrew": "צ'קולי",
            "name_english": "Chakoli",
            "google_places": {"google_name": "Chacoli"},
            "location": {"city": "תל אביב", "neighborhood": "נמל"},
            "cuisine_type": "ספרדי",
            "price_range": "יקר",
            "host_opinion": "חיובית מאוד",
            "host_comments": "מסעדה מעולה",
            "menu_items": ["דגים", "פירות ים"],
            "special_features": ["נוף לים"],
        }

        result = detector.detect(restaurant)

        assert result.is_hallucination is False
        assert result.recommendation == "accept"
        assert result.confidence < 0.4

    def test_detect_real_restaurant_hebrew_transliteration_match(self, detector):
        """Hebrew name that transliterates to English Google name should match."""
        restaurant = {
            "name_hebrew": "צפרירים",
            "name_english": "Tzfririm",
            "google_places": {"google_name": "Zafririm 1"},
            "location": {"city": "תל אביב"},
            "cuisine_type": "ישראלי",
            "price_range": "בינוני",
            "host_opinion": "חיובית",
            "host_comments": "טעים",
            "menu_items": ["סלטים"],
            "special_features": [],
        }

        result = detector.detect(restaurant)

        assert result.is_hallucination is False
        assert result.confidence < 0.5

    def test_detect_real_restaurant_geresh_variation(self, detector):
        """ז' and ג' should be treated as equivalent (both are 'j' sound)."""
        restaurant = {
            "name_hebrew": "מיז'נה",
            "name_english": "Mizena",
            "google_places": {"google_name": "מיג'אנה - מסעדת שף"},
            "location": {"city": "חיפה"},
            "cuisine_type": "ערבי",
            "price_range": "בינוני",
            "host_opinion": "חיובית",
            "host_comments": "אותנטי",
            "menu_items": [],
            "special_features": [],
        }

        result = detector.detect(restaurant)

        assert result.is_hallucination is False

    # ==================== Hallucination Detection Tests ====================

    def test_detect_common_word_hallucination(self, detector):
        """Common Hebrew words should be rejected as hallucinations."""
        restaurant = {
            "name_hebrew": "כל",
            "name_english": "Kl",
            "google_places": {"google_name": "Lala Land"},
            "location": {"city": "לא צוין"},
            "cuisine_type": "לא צוין",
            "price_range": "לא צוין",
            "host_opinion": "לא צוין",
            "host_comments": "לא צוין",
            "menu_items": [],
            "special_features": [],
        }

        result = detector.detect(restaurant)

        assert result.is_hallucination is True
        assert result.recommendation == "reject"
        assert any("Common word" in r for r in result.reasons)

    def test_detect_sentence_fragment_hallucination(self, detector):
        """Sentence fragments should be rejected as hallucinations."""
        restaurant = {
            "name_hebrew": "השנה שלי שהיא מסעדה",
            "name_english": "Hshnh Shly",
            "google_places": {"google_name": "HaShuk 34"},
            "location": {"city": "לא צוין"},
            "cuisine_type": "לא צוין",
            "price_range": "לא צוין",
            "host_opinion": "לא צוין",
            "host_comments": "לא צוין",
            "menu_items": [],
            "special_features": [],
        }

        result = detector.detect(restaurant)

        assert result.is_hallucination is True
        assert result.recommendation == "reject"
        assert any("Sentence fragment" in r or "fragment" in r.lower() for r in result.reasons)

    def test_detect_name_mismatch_hallucination(self, detector):
        """Name that doesn't match Google Places should be flagged."""
        restaurant = {
            "name_hebrew": "דיוק",
            "name_english": "Dyvk",
            "google_places": {"google_name": "Kimmel BaGilboa"},
            "location": {"city": "לא צוין"},
            "cuisine_type": "לא צוין",
            "price_range": "לא צוין",
            "host_opinion": "לא צוין",
            "host_comments": "לא צוין",
            "menu_items": [],
            "special_features": [],
        }

        result = detector.detect(restaurant)

        assert result.is_hallucination is True
        assert any("mismatch" in r.lower() for r in result.reasons)

    def test_detect_city_name_hallucination(self, detector):
        """City names alone should be rejected as restaurant names."""
        restaurant = {
            "name_hebrew": "חיפה",
            "name_english": "Haifa",
            "google_places": {"google_name": "Honey Restaurant"},
            "location": {"city": "לא צוין"},
            "cuisine_type": "לא צוין",
            "price_range": "לא צוין",
            "host_opinion": "לא צוין",
            "host_comments": "לא צוין",
            "menu_items": [],
            "special_features": [],
        }

        result = detector.detect(restaurant)

        assert result.is_hallucination is True
        assert any("Common word" in r for r in result.reasons)

    def test_detect_truncated_name_hallucination(self, detector):
        """Names that appear truncated should be flagged."""
        restaurant = {
            "name_hebrew": "מרי פוסה בקיסריה א ש",
            "name_english": "Mari Posa",
            "google_places": {"google_name": "HIBA Restaurant"},
            "location": {"city": "לא צוין"},
            "cuisine_type": "לא צוין",
            "price_range": "לא צוין",
            "host_opinion": "לא צוין",
            "host_comments": "לא צוין",
            "menu_items": [],
            "special_features": [],
        }

        result = detector.detect(restaurant)

        assert result.is_hallucination is True
        assert any("truncated" in r.lower() for r in result.reasons)

    def test_detect_short_name_hallucination(self, detector):
        """Very short names (1-3 chars) should be flagged."""
        restaurant = {
            "name_hebrew": "וד",
            "name_english": "Vd",
            "google_places": {"google_name": "Some Restaurant"},
            "location": {"city": "לא צוין"},
            "cuisine_type": "לא צוין",
            "price_range": "לא צוין",
            "host_opinion": "לא צוין",
            "host_comments": "לא צוין",
            "menu_items": [],
            "special_features": [],
        }

        result = detector.detect(restaurant)

        assert result.confidence >= 0.5  # Should have medium-high confidence of hallucination

    # ==================== Name Matching Tests ====================

    def test_names_similar_exact_match(self, detector):
        """Exact name match should return True."""
        assert detector._names_similar("chakoli", "chakoli") is True

    def test_names_similar_substring_match(self, detector):
        """Substring match should return True."""
        assert detector._names_similar("chakoli", "chakoli restaurant") is True

    def test_names_similar_no_match(self, detector):
        """Completely different names should return False."""
        assert detector._names_similar("chakoli", "mcdonalds") is False

    def test_hebrew_names_match_with_geresh_variation(self, detector):
        """ז' and ג' variations should match."""
        assert detector._hebrew_names_match("מיז'נה", "מיג'אנה") is True

    def test_hebrew_names_match_transliteration(self, detector):
        """Hebrew to English transliteration should match."""
        assert detector._hebrew_names_match("צפרירים", "Zafririm 1") is True

    def test_hebrew_names_match_with_prefix(self, detector):
        """Names with/without ה prefix should match."""
        # The detector removes ה prefix during normalization
        assert detector._hebrew_names_match("הסלון", "סלון") is True

    # ==================== Transliteration Tests ====================

    def test_rough_transliterate_basic(self, detector):
        """Basic Hebrew transliteration should work."""
        result = detector._rough_transliterate("שלום")
        assert "sh" in result or "s" in result  # ש can be sh or s
        assert "l" in result  # ל
        assert "m" in result  # מ

    def test_rough_transliterate_with_geresh(self, detector):
        """Geresh combinations should transliterate correctly."""
        result = detector._rough_transliterate("צ'קולי")
        assert "ch" in result or "c" in result  # צ' is ch

    # ==================== Data Completeness Tests ====================

    def test_data_completeness_full_data(self, detector):
        """Restaurant with complete data should score low on hallucination."""
        restaurant = {
            "name_hebrew": "מסעדה טובה",
            "location": {"city": "תל אביב", "neighborhood": "פלורנטין"},
            "cuisine_type": "איטלקי",
            "price_range": "בינוני",
            "host_opinion": "חיובית",
            "host_comments": "מומלץ מאוד",
            "menu_items": ["פסטה", "פיצה"],
            "special_features": ["טראסה"],
        }

        score, reason = detector._check_data_completeness(restaurant)
        assert score < 0.5  # Low hallucination score for complete data

    def test_data_completeness_sparse_data(self, detector):
        """Restaurant with sparse data should score high on hallucination."""
        restaurant = {
            "name_hebrew": "משהו",
            "location": {"city": "לא צוין", "neighborhood": "לא צוין"},
            "cuisine_type": "לא צוין",
            "price_range": "לא צוין",
            "host_opinion": "לא צוין",
            "host_comments": "לא צוין",
            "menu_items": [],
            "special_features": [],
        }

        score, reason = detector._check_data_completeness(restaurant)
        assert score >= 0.6  # High hallucination score for sparse data

    # ==================== End-to-End Filter Tests ====================

    def test_filter_hallucinations_separates_correctly(self):
        """filter_hallucinations should correctly separate real from fake."""
        restaurants = [
            # Real restaurant
            {
                "name_hebrew": "צ'קולי",
                "name_english": "Chakoli",
                "google_places": {"google_name": "Chacoli"},
                "location": {"city": "תל אביב"},
                "cuisine_type": "ספרדי",
                "price_range": "יקר",
                "host_opinion": "חיובית",
                "host_comments": "מעולה",
                "menu_items": ["דגים"],
                "special_features": ["נוף"],
            },
            # Hallucination - common word
            {
                "name_hebrew": "כל",
                "name_english": "Kl",
                "google_places": {"google_name": "Lala Land"},
                "location": {"city": "לא צוין"},
                "cuisine_type": "לא צוין",
                "price_range": "לא צוין",
                "host_opinion": "לא צוין",
                "host_comments": "לא צוין",
                "menu_items": [],
                "special_features": [],
            },
            # Hallucination - sentence fragment
            {
                "name_hebrew": "השנה שלי שהיא מסעדה",
                "name_english": "Sentence",
                "google_places": {"google_name": "Other Place"},
                "location": {"city": "לא צוין"},
                "cuisine_type": "לא צוין",
                "price_range": "לא צוין",
                "host_opinion": "לא צוין",
                "host_comments": "לא צוין",
                "menu_items": [],
                "special_features": [],
            },
        ]

        accepted, rejected, needs_review = filter_hallucinations(restaurants, strict_mode=True)

        # Real restaurant should be accepted
        assert len(accepted) >= 1
        assert any(r["name_hebrew"] == "צ'קולי" for r in accepted)

        # Hallucinations should be rejected
        assert len(rejected) >= 2
        rejected_names = [r["name_hebrew"] for r in rejected]
        assert "כל" in rejected_names
        assert "השנה שלי שהיא מסעדה" in rejected_names

    def test_filter_adds_hallucination_metadata(self):
        """filter_hallucinations should add _hallucination_check to each restaurant."""
        restaurants = [
            {
                "name_hebrew": "מסעדה",
                "name_english": "Restaurant",
                "google_places": {"google_name": "Restaurant"},
                "location": {"city": "תל אביב"},
                "cuisine_type": "ישראלי",
                "price_range": "בינוני",
                "host_opinion": "חיובית",
                "host_comments": "טוב",
                "menu_items": [],
                "special_features": [],
            }
        ]

        accepted, rejected, needs_review = filter_hallucinations(restaurants)

        all_restaurants = accepted + rejected + needs_review
        for restaurant in all_restaurants:
            assert "_hallucination_check" in restaurant
            check = restaurant["_hallucination_check"]
            assert "is_hallucination" in check
            assert "confidence" in check
            assert "reasons" in check
            assert "recommendation" in check

    # ==================== Edge Cases ====================

    def test_detect_empty_name(self, detector):
        """Empty name should be flagged as hallucination."""
        restaurant = {
            "name_hebrew": "",
            "name_english": "",
            "google_places": {"google_name": "Some Place"},
            "location": {"city": "לא צוין"},
            "cuisine_type": "לא צוין",
            "price_range": "לא צוין",
            "host_opinion": "לא צוין",
            "host_comments": "לא צוין",
            "menu_items": [],
            "special_features": [],
        }

        result = detector.detect(restaurant)
        assert result.confidence >= 0.5

    def test_detect_no_google_places_data(self, detector):
        """Restaurant without Google Places data should get neutral score for that factor."""
        restaurant = {
            "name_hebrew": "מסעדה חדשה",
            "name_english": "New Restaurant",
            "google_places": {},  # No Google data
            "location": {"city": "תל אביב"},
            "cuisine_type": "ישראלי",
            "price_range": "בינוני",
            "host_opinion": "חיובית",
            "host_comments": "טוב",
            "menu_items": ["מנה"],
            "special_features": [],
        }

        result = detector.detect(restaurant)
        # Should not be rejected just because of missing Google data
        assert result.confidence < 0.7


class TestCommonHebrewWords:
    """Tests for the COMMON_HEBREW_WORDS set."""

    def test_common_words_contains_basic_words(self):
        """Common words set should contain basic Hebrew words."""
        assert "של" in COMMON_HEBREW_WORDS
        assert "כל" in COMMON_HEBREW_WORDS
        assert "על" in COMMON_HEBREW_WORDS

    def test_common_words_contains_city_names(self):
        """Common words set should contain Israeli city names."""
        assert "תל אביב" in COMMON_HEBREW_WORDS
        assert "ירושלים" in COMMON_HEBREW_WORDS
        assert "חיפה" in COMMON_HEBREW_WORDS

    def test_common_words_contains_food_terms(self):
        """Common words set should contain generic food terms."""
        assert "חומוס" in COMMON_HEBREW_WORDS
        assert "פלאפל" in COMMON_HEBREW_WORDS
        assert "שווארמה" in COMMON_HEBREW_WORDS


class TestSentenceFragmentPatterns:
    """Tests for sentence fragment detection patterns."""

    def test_patterns_detect_year_fragments(self):
        """Patterns should detect 'השנה' fragments."""
        import re
        test_text = "השנה שלי"
        matches = any(re.search(p, test_text) for p in SENTENCE_FRAGMENT_PATTERNS)
        assert matches is True

    def test_patterns_detect_truncated_endings(self):
        """Patterns should detect truncated endings like 'ב' at end."""
        import re
        test_text = "מסעדה ב"
        matches = any(re.search(p, test_text) for p in SENTENCE_FRAGMENT_PATTERNS)
        assert matches is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
