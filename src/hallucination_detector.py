"""
Hallucination Detector for Restaurant Extraction

Detects and rejects false restaurant extractions by:
1. Checking if extracted name matches Google Places result
2. Filtering common Hebrew words that aren't restaurant names
3. Detecting sentence fragments mistakenly extracted as names
4. Validating data completeness
"""

import re
import logging
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class HallucinationResult:
    """Result of hallucination detection"""
    is_hallucination: bool
    confidence: float  # 0.0 = definitely real, 1.0 = definitely hallucination
    reasons: List[str]
    recommendation: str  # "accept", "reject", "review"


# Common Hebrew words that are NOT restaurant names
COMMON_HEBREW_WORDS = {
    # Articles and prepositions
    "של", "את", "על", "עם", "אל", "מן", "כל", "גם", "רק", "עוד", "כבר",
    "אז", "פה", "שם", "כאן", "הנה", "איפה", "למה", "מה", "מי", "איך",
    # Common nouns that aren't names
    "מסעדה", "מקום", "אוכל", "דבר", "יום", "שנה", "זמן", "אדם", "בית",
    "דרך", "עיר", "רחוב", "שוק", "חנות", "קפה", "בר", "פאב",
    "מקומון", "ביסטרו", "שף", "טבח",
    # Common adjectives
    "טוב", "רע", "גדול", "קטן", "חדש", "ישן", "יפה", "טעים", "מעולה",
    # Common verbs (in various forms)
    "היה", "הייתי", "היית", "היינו", "הייתם", "אמר", "אמרתי", "עשה",
    "הלך", "הלכתי", "בא", "באתי", "רוצה", "אוהב", "אוכל", "שותה",
    # Numbers and quantities
    "אחד", "שני", "שלוש", "ארבע", "חמש", "הרבה", "קצת", "כמה",
    # Time words
    "היום", "אתמול", "מחר", "עכשיו", "אחרי", "לפני", "בזמן",
    # Generic food terms (not restaurant names)
    "חומוס", "פלאפל", "שווארמה", "שוארמה", "השוארמות", "פיצה", "סושי", "בורגר", "סלט",
    "בשר", "דג", "עוף", "ירקות", "פירות", "לחם", "אורז",
    # Filler words
    "כאילו", "בעצם", "ממש", "סתם", "בטח", "אולי", "כנראה",
    # Single letters and short words
    "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "כ", "ל", "מ",
    "נ", "ס", "ע", "פ", "צ", "ק", "ר", "ש", "ת",
    # Words that appeared in the hallucinations
    "דיוק", "כלל", "תור", "היפה", "שוק", "עצם", "וד", "רים",
    # Gibberish patterns
    "יע", "על", "יע על",
    # Israeli city names (not restaurant names on their own)
    "תל אביב", "ירושלים", "חיפה", "באר שבע", "אילת", "נתניה",
    "הרצליה", "רעננה", "כפר סבא", "פתח תקווה", "ראשון לציון",
    "חולון", "בת ים", "רמת גן", "גבעתיים", "קיסריה", "עכו", "נהריה",
}

# Patterns that indicate sentence fragments (not names)
SENTENCE_FRAGMENT_PATTERNS = [
    r"^ה?שנה\s+",    # "השנה" / "שנה" at start
    r"^ה?חצי\s+",    # "החצי" / "חצי" at start
    r"^ה?יה\s+",     # "היה" at start
    r"^ה?ייתי\s+",   # "הייתי" at start
    r"^ו?עוד\s+",    # "ועוד" / "עוד"
    r"^ו?גם\s+",     # "וגם" / "גם"
    r"^וד\s+",       # "וד" - truncated word
    r"^ר\s+",        # "ר" - truncated word
    r"\s+של\s*$",    # ends with "של"
    r"\s+ב\s*$",     # ends with "ב"
    r"\s+ל\s*$",     # ends with "ל"
    r"\s+ש\s*$",     # ends with "ש"
    r"\s+א\s*$",     # ends with "א"
    r"^לא\s+",       # starts with "לא"
    r"\s+לא\s+",     # contains "לא" in middle
    r"\s+יותר\s+",   # contains "יותר" (more)
    r"\s+נוכל\s+",   # contains "נוכל" (we can)
    r"\s+לפתוח",     # contains "לפתוח" (to open)
    r"\s+הפכה\s+",   # contains "הפכה" (became)
    r"\s+הייתה\s+",  # contains "הייתה" (was)
    r"משהו",         # contains "משהו" (something)
    r"מזכיר",        # contains "מזכיר" (reminds/mentions)
    r"וזה$",         # ends with "וזה"
    r"^יע\s+",       # truncated gibberish
    r"^רים\s+",      # truncated gibberish
]


class HallucinationDetector:
    """
    Detects hallucinated restaurant extractions.

    Uses multiple signals:
    1. Name-to-Google match score
    2. Common word detection
    3. Sentence fragment detection
    4. Data completeness score
    """

    def __init__(self, strict_mode: bool = True):
        """
        Initialize detector.

        Args:
            strict_mode: If True, reject on any suspicion. If False, only reject clear hallucinations.
        """
        self.strict_mode = strict_mode
        self.common_words = COMMON_HEBREW_WORDS
        self.fragment_patterns = [re.compile(p) for p in SENTENCE_FRAGMENT_PATTERNS]

    def detect(self, restaurant: Dict) -> HallucinationResult:
        """
        Detect if a restaurant extraction is a hallucination.

        Args:
            restaurant: Restaurant data dictionary

        Returns:
            HallucinationResult with detection details
        """
        reasons = []
        scores = []  # List of (score, weight) tuples

        name_hebrew = restaurant.get("name_hebrew", "").strip()
        name_english = restaurant.get("name_english", "").strip()
        google_name = restaurant.get("google_places", {}).get("google_name", "")

        # Check 1: Name matches Google Places result
        name_match_score, name_match_reason = self._check_name_match(
            name_hebrew, name_english, google_name
        )
        if name_match_reason:
            reasons.append(name_match_reason)
        scores.append((name_match_score, 0.4))  # 40% weight

        # Check 2: Is it a common word?
        common_word_score, common_word_reason = self._check_common_word(name_hebrew)
        if common_word_reason:
            reasons.append(common_word_reason)
        scores.append((common_word_score, 0.25))  # 25% weight

        # Check 3: Is it a sentence fragment?
        fragment_score, fragment_reason = self._check_sentence_fragment(name_hebrew)
        if fragment_reason:
            reasons.append(fragment_reason)
        scores.append((fragment_score, 0.2))  # 20% weight

        # Check 4: Data completeness
        completeness_score, completeness_reason = self._check_data_completeness(restaurant)
        if completeness_reason:
            reasons.append(completeness_reason)
        scores.append((completeness_score, 0.15))  # 15% weight

        # Calculate weighted confidence score
        total_weight = sum(w for _, w in scores)
        confidence = sum(s * w for s, w in scores) / total_weight

        # Determine recommendation
        if confidence >= 0.7:
            recommendation = "reject"
            is_hallucination = True
        elif confidence >= 0.4:
            recommendation = "review"
            is_hallucination = self.strict_mode
        else:
            recommendation = "accept"
            is_hallucination = False

        return HallucinationResult(
            is_hallucination=is_hallucination,
            confidence=round(confidence, 3),
            reasons=reasons,
            recommendation=recommendation
        )

    def _check_name_match(
        self,
        name_hebrew: str,
        name_english: str,
        google_name: str
    ) -> Tuple[float, Optional[str]]:
        """
        Check if extracted name matches Google Places name.

        Returns:
            (hallucination_score, reason) - score 0=match, 1=no match
        """
        if not google_name:
            # No Google data to compare - neutral
            return 0.5, None

        google_name_lower = google_name.lower().strip()
        name_hebrew_lower = name_hebrew.lower().strip()
        name_english_lower = name_english.lower().strip()

        # Check for Hebrew-specific matching (handles ז'/ג' etc.)
        if self._hebrew_names_match(name_hebrew, google_name):
            return 0.0, None

        # Check for exact or near match
        if self._names_similar(name_hebrew_lower, google_name_lower):
            return 0.0, None
        if self._names_similar(name_english_lower, google_name_lower):
            return 0.0, None

        # Check if one contains the other
        if (name_hebrew_lower in google_name_lower or
            google_name_lower in name_hebrew_lower or
            name_english_lower in google_name_lower or
            google_name_lower in name_english_lower):
            return 0.2, None

        # Names don't match at all
        return 1.0, f"Name mismatch: extracted '{name_hebrew}' but Google found '{google_name}'"

    def _names_similar(self, name1: str, name2: str, threshold: float = 0.5) -> bool:
        """Check if two names are similar using multiple strategies."""
        if not name1 or not name2:
            return False

        # Normalize - remove punctuation, lowercase
        name1_norm = re.sub(r'[^\w\s]', '', name1.lower()).strip()
        name2_norm = re.sub(r'[^\w\s]', '', name2.lower()).strip()

        # Check exact match
        if name1_norm == name2_norm:
            return True

        # Check if one contains the other (substring)
        if name1_norm in name2_norm or name2_norm in name1_norm:
            return True

        # Check word overlap
        words1 = set(name1_norm.split())
        words2 = set(name2_norm.split())
        if words1 & words2:  # Any common words
            return True

        # Check transliteration match (Hebrew to English mapping)
        # צפרירים -> Zafririm, מיג'אנה -> Mijana
        name1_translit = self._rough_transliterate(name1_norm)
        name2_translit = self._rough_transliterate(name2_norm)

        if name1_translit and name2_translit:
            # Check if transliterated versions are similar
            if name1_translit in name2_translit or name2_translit in name1_translit:
                return True
            # Check prefix match (at least 4 chars)
            min_len = min(len(name1_translit), len(name2_translit))
            if min_len >= 4 and name1_translit[:4] == name2_translit[:4]:
                return True

        # Check character-level similarity (Jaccard)
        chars1 = set(name1_norm.replace(' ', ''))
        chars2 = set(name2_norm.replace(' ', ''))
        if not chars1 or not chars2:
            return False

        intersection = len(chars1 & chars2)
        union = len(chars1 | chars2)
        similarity = intersection / union

        return similarity >= threshold

    def _rough_transliterate(self, text: str) -> str:
        """Rough Hebrew to Latin transliteration for comparison."""
        # Simple mapping for comparison purposes
        mapping = {
            'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h',
            'ו': 'v', 'ז': 'z', 'ח': 'h', 'ט': 't', 'י': 'i',
            'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm', 'ם': 'm',
            'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p',
            'ף': 'f', 'צ': 'tz', 'ץ': 'tz', 'ק': 'k', 'ר': 'r',
            'ש': 'sh', 'ת': 't',
            # Common combinations with geresh
            "צ'": 'ch', "ג'": 'j', "ז'": 'j',  # ז' and ג' both sound like 'j'
        }
        result = text.lower()
        for heb, lat in sorted(mapping.items(), key=lambda x: -len(x[0])):
            result = result.replace(heb, lat)
        # Remove remaining non-ascii
        result = re.sub(r'[^a-z]', '', result)
        return result

    def _hebrew_names_match(self, name1: str, name2: str) -> bool:
        """
        Check if two Hebrew names match, accounting for common variations.

        Handles:
        - ז'/ג' confusion (both sound like 'j')
        - ס/ש confusion
        - ט/ת confusion
        - Missing/extra ה at start
        - Hebrew to English transliteration matching
        """
        if not name1 or not name2:
            return False

        # Normalize: remove geresh variations, lowercase
        def normalize_hebrew(s):
            s = s.strip().lower()
            # Remove definite article
            s = re.sub(r'^ה', '', s)
            # Normalize similar-sounding letters
            s = s.replace("ז'", "ג'")  # Both are 'j' sound
            s = s.replace("ש", "ס")    # Can sound similar
            # Remove punctuation
            s = re.sub(r'[^\u0590-\u05ff\s]', '', s)
            return s

        n1 = normalize_hebrew(name1)
        n2 = normalize_hebrew(name2)

        if n1 == n2:
            return True

        # Check if one contains the other
        if len(n1) >= 3 and len(n2) >= 3:
            if n1 in n2 or n2 in n1:
                return True

        # Check if they're similar when removing geresh entirely
        # מיז'נה and מיג'אנה both become similar when normalized
        n1_no_geresh = re.sub(r"[זג]'", 'ג', n1)  # Replace ז' and ג' with ג
        n2_no_geresh = re.sub(r"[זג]'", 'ג', n2)
        if n1_no_geresh == n2_no_geresh:
            return True
        if len(n1_no_geresh) >= 3 and len(n2_no_geresh) >= 3:
            if n1_no_geresh in n2_no_geresh or n2_no_geresh in n1_no_geresh:
                return True
            # Check if they differ by only 1-2 characters (handles מיגנה vs מיגאנה)
            if abs(len(n1_no_geresh) - len(n2_no_geresh)) <= 2:
                # Simple edit distance check
                shorter = n1_no_geresh if len(n1_no_geresh) <= len(n2_no_geresh) else n2_no_geresh
                longer = n2_no_geresh if len(n1_no_geresh) <= len(n2_no_geresh) else n1_no_geresh
                # Check if shorter is subset of longer with 1-2 insertions
                i, j, diffs = 0, 0, 0
                while i < len(shorter) and j < len(longer):
                    if shorter[i] == longer[j]:
                        i += 1
                        j += 1
                    else:
                        j += 1
                        diffs += 1
                        if diffs > 2:
                            break
                if i == len(shorter) and diffs <= 2:
                    return True

        # Check transliteration match (Hebrew name vs English Google name)
        # e.g., צפרירים → Zafririm
        translit1 = self._rough_transliterate(name1)

        # Get English name from name2 (could be mixed Hebrew/English)
        name2_clean = re.sub(r'[^a-zA-Z\s]', '', name2).lower().strip()

        if translit1 and name2_clean:
            # Normalize both for comparison (remove vowels, normalize tz/z/ts)
            def normalize_for_comparison(s):
                s = s.lower()
                s = s.replace('tz', 'z').replace('ts', 'z')  # צ can be tz, ts, or z
                s = s.replace('ch', 'h').replace('kh', 'h')  # ח and כ
                s = s.replace('sh', 's')  # ש
                s = re.sub(r'[aeiou]', '', s)  # Remove vowels for consonant matching
                return s

            norm1 = normalize_for_comparison(translit1)
            norm2 = normalize_for_comparison(name2_clean)

            # Check if normalized versions match or have significant overlap
            if len(norm1) >= 3 and len(norm2) >= 3:
                # Check prefix match
                min_len = min(len(norm1), len(norm2), 5)
                if norm1[:min_len] == norm2[:min_len]:
                    return True
                # Check substring
                if norm1 in norm2 or norm2 in norm1:
                    return True
                # Check edit distance (allow 1-2 differences for longer names)
                if len(norm1) >= 4 and len(norm2) >= 4:
                    differences = sum(1 for a, b in zip(norm1, norm2) if a != b)
                    differences += abs(len(norm1) - len(norm2))
                    if differences <= 2:
                        return True

        return False

    def _check_common_word(self, name_hebrew: str) -> Tuple[float, Optional[str]]:
        """
        Check if name is a common Hebrew word.

        Returns:
            (hallucination_score, reason) - score 0=not common, 1=very common
        """
        name_clean = name_hebrew.strip().lower()

        # Remove common prefixes/suffixes for comparison
        name_normalized = re.sub(r'^[הו]', '', name_clean)  # Remove ה, ו prefix

        # Check if it's a single common word
        if name_clean in self.common_words or name_normalized in self.common_words:
            return 1.0, f"Common word detected: '{name_hebrew}' is not a restaurant name"

        # Check if all words in the name are common words
        words = name_clean.split()
        if words:
            common_count = sum(1 for w in words if w in self.common_words)
            if common_count == len(words) and len(words) > 1:
                return 0.9, f"All words are common: '{name_hebrew}'"
            if common_count / len(words) > 0.7:
                return 0.7, f"Mostly common words: '{name_hebrew}'"

        # Very short names are suspicious (less than 3 chars without spaces)
        name_no_space = name_clean.replace(' ', '')
        if len(name_no_space) <= 3:
            return 0.9, f"Name too short: '{name_hebrew}'"

        # Names that look like truncated words (end with single letter after space)
        if re.search(r'\s[א-ת]$', name_clean):
            return 0.8, f"Appears truncated: '{name_hebrew}'"

        return 0.0, None

    def _check_sentence_fragment(self, name_hebrew: str) -> Tuple[float, Optional[str]]:
        """
        Check if name looks like a sentence fragment.

        Returns:
            (hallucination_score, reason) - score 0=not fragment, 1=clearly fragment
        """
        name_clean = name_hebrew.strip()

        # Check against known fragment patterns
        for pattern in self.fragment_patterns:
            if pattern.search(name_clean):
                return 1.0, f"Sentence fragment detected: '{name_hebrew}'"

        # Check for sentence-like length (too many words)
        words = name_clean.split()
        if len(words) > 5:
            return 0.9, f"Too many words for a name: '{name_hebrew}' ({len(words)} words)"
        if len(words) > 3:
            return 0.5, f"Possibly too long: '{name_hebrew}'"

        # Check for obvious sentence structures
        if any(name_clean.startswith(prefix) for prefix in ["אני ", "הוא ", "היא ", "זה ", "זו "]):
            return 1.0, f"Starts like a sentence: '{name_hebrew}'"

        return 0.0, None

    def _check_data_completeness(self, restaurant: Dict) -> Tuple[float, Optional[str]]:
        """
        Check data completeness - hallucinations usually have sparse data.

        Returns:
            (hallucination_score, reason) - score 0=complete, 1=very sparse
        """
        empty_markers = ["לא צוין", "", None, [], {}]

        fields_to_check = [
            "cuisine_type",
            "city",
            "neighborhood",
            "price_range",
            "host_opinion",
            "host_comments",
            "menu_items",
            "special_features",
        ]

        empty_count = 0
        for field in fields_to_check:
            value = restaurant.get(field)
            if value is None:
                empty_count += 1
            elif isinstance(value, str) and (value.strip() in empty_markers or value.strip() == "לא צוין"):
                empty_count += 1
            elif isinstance(value, (list, dict)) and not value:
                empty_count += 1
            # Check nested location
            elif field in ["city", "neighborhood"]:
                loc = restaurant.get("location", {})
                loc_value = loc.get(field, "")
                if loc_value in empty_markers or loc_value == "לא צוין":
                    empty_count += 1

        completeness_ratio = empty_count / len(fields_to_check)

        if completeness_ratio >= 0.8:
            return 0.9, f"Very sparse data: {empty_count}/{len(fields_to_check)} fields empty"
        elif completeness_ratio >= 0.6:
            return 0.6, f"Sparse data: {empty_count}/{len(fields_to_check)} fields empty"
        elif completeness_ratio >= 0.4:
            return 0.3, None

        return 0.0, None


def filter_hallucinations(
    restaurants: List[Dict],
    strict_mode: bool = True
) -> Tuple[List[Dict], List[Dict], List[Dict]]:
    """
    Filter a list of restaurants, separating real from hallucinated.

    Args:
        restaurants: List of restaurant dictionaries
        strict_mode: If True, reject on any suspicion

    Returns:
        Tuple of (accepted, rejected, needs_review)
    """
    detector = HallucinationDetector(strict_mode=strict_mode)

    accepted = []
    rejected = []
    needs_review = []

    for restaurant in restaurants:
        result = detector.detect(restaurant)

        # Add detection metadata to restaurant
        restaurant["_hallucination_check"] = {
            "is_hallucination": result.is_hallucination,
            "confidence": result.confidence,
            "reasons": result.reasons,
            "recommendation": result.recommendation
        }

        if result.recommendation == "accept":
            accepted.append(restaurant)
            logger.info(f"✅ Accepted: {restaurant.get('name_hebrew', 'Unknown')}")
        elif result.recommendation == "reject":
            rejected.append(restaurant)
            logger.warning(
                f"❌ Rejected: {restaurant.get('name_hebrew', 'Unknown')} - "
                f"Reasons: {', '.join(result.reasons)}"
            )
        else:
            needs_review.append(restaurant)
            logger.info(
                f"⚠️ Needs review: {restaurant.get('name_hebrew', 'Unknown')} - "
                f"Confidence: {result.confidence}"
            )

    logger.info(
        f"Hallucination filter results: "
        f"{len(accepted)} accepted, {len(rejected)} rejected, {len(needs_review)} need review"
    )

    return accepted, rejected, needs_review


# Quick test function
def test_detector():
    """Test the hallucination detector with sample data."""

    test_cases = [
        # Real restaurant
        {
            "name_hebrew": "צ'קולי",
            "name_english": "Chakoli",
            "google_places": {"google_name": "Chacoli"},
            "location": {"city": "תל אביב", "neighborhood": "נמל"},
            "cuisine_type": "ספרדי ים תיכוני",
            "price_range": "יקר",
            "host_opinion": "חיובית מאוד",
            "host_comments": "מסעדת השנה",
            "menu_items": ["דגים", "פירות ים"],
            "special_features": ["נוף לים"],
        },
        # Hallucination - sentence fragment
        {
            "name_hebrew": "השנה שלי שהיא מסעדה",
            "name_english": "Hshnh Shly Shhya Msadh",
            "google_places": {"google_name": "HaShuk 34"},
            "location": {"city": "לא צוין", "neighborhood": "לא צוין"},
            "cuisine_type": "לא צוין",
            "price_range": "לא צוין",
            "host_opinion": "לא צוין",
            "host_comments": "לא צוין",
            "menu_items": [],
            "special_features": [],
        },
        # Hallucination - common word
        {
            "name_hebrew": "כל",
            "name_english": "Kl",
            "google_places": {"google_name": "Lala Land"},
            "location": {"city": "לא צוין", "neighborhood": "לא צוין"},
            "cuisine_type": "לא צוין",
            "price_range": "לא צוין",
            "host_opinion": "לא צוין",
            "host_comments": "לא צוין",
            "menu_items": [],
            "special_features": [],
        },
        # Hallucination - common word
        {
            "name_hebrew": "דיוק",
            "name_english": "Dyvk",
            "google_places": {"google_name": "Kimmel BaGilboa"},
            "location": {"city": "לא צוין", "neighborhood": "לא צוין"},
            "cuisine_type": "לא צוין",
            "price_range": "לא צוין",
            "host_opinion": "לא צוין",
            "host_comments": "לא צוין",
            "menu_items": [],
            "special_features": [],
        },
    ]

    detector = HallucinationDetector(strict_mode=True)

    print("\n" + "="*60)
    print("HALLUCINATION DETECTOR TEST")
    print("="*60)

    for restaurant in test_cases:
        result = detector.detect(restaurant)

        status = "❌ HALLUCINATION" if result.is_hallucination else "✅ REAL"
        print(f"\n{status}: {restaurant['name_hebrew']}")
        print(f"  Confidence: {result.confidence}")
        print(f"  Recommendation: {result.recommendation}")
        if result.reasons:
            print(f"  Reasons:")
            for reason in result.reasons:
                print(f"    - {reason}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    test_detector()
