/**
 * Hallucination Filter for Restaurant Data
 *
 * JavaScript port of the Python hallucination detector.
 * Filters out false restaurant extractions before serving to frontend.
 */

// Common Hebrew words that are NOT restaurant names
const COMMON_HEBREW_WORDS = new Set([
  // Articles and prepositions
  "של", "את", "על", "עם", "אל", "מן", "כל", "גם", "רק", "עוד", "כבר",
  "אז", "פה", "שם", "כאן", "הנה", "איפה", "למה", "מה", "מי", "איך",
  // Common nouns that aren't names
  "מסעדה", "מקום", "אוכל", "דבר", "יום", "שנה", "זמן", "אדם", "בית",
  "דרך", "עיר", "רחוב", "שוק", "חנות", "קפה", "בר", "פאב",
  "מקומון", "ביסטרו", "שף", "טבח",
  // Common adjectives
  "טוב", "רע", "גדול", "קטן", "חדש", "ישן", "יפה", "טעים", "מעולה",
  // Common verbs
  "היה", "הייתי", "היית", "היינו", "הייתם", "אמר", "אמרתי", "עשה",
  "הלך", "הלכתי", "בא", "באתי", "רוצה", "אוהב", "אוכל", "שותה",
  // Numbers and quantities
  "אחד", "שני", "שלוש", "ארבע", "חמש", "הרבה", "קצת", "כמה",
  // Time words
  "היום", "אתמול", "מחר", "עכשיו", "אחרי", "לפני", "בזמן",
  // Generic food terms
  "חומוס", "פלאפל", "שווארמה", "שוארמה", "השוארמות", "פיצה", "סושי", "בורגר", "סלט",
  "בשר", "דג", "עוף", "ירקות", "פירות", "לחם", "אורז",
  // Filler words
  "כאילו", "בעצם", "ממש", "סתם", "בטח", "אולי", "כנראה",
  // Words that appeared in hallucinations
  "דיוק", "כלל", "תור", "היפה", "עצם", "וד", "רים", "יע",
  // Cities (not restaurant names on their own)
  "תל אביב", "ירושלים", "חיפה", "באר שבע", "אילת", "נתניה",
  "הרצליה", "רעננה", "כפר סבא", "פתח תקווה", "ראשון לציון",
]);

// Sentence fragment patterns (regex)
const SENTENCE_FRAGMENT_PATTERNS = [
  /^ה?שנה\s+/,    // "השנה" at start
  /^ה?חצי\s+/,    // "החצי" at start
  /^ה?יה\s+/,     // "היה" at start
  /^ה?ייתי\s+/,   // "הייתי" at start
  /^ו?עוד\s+/,    // "ועוד"
  /^ו?גם\s+/,     // "וגם"
  /^וד\s+/,       // truncated word
  /^ר\s+/,        // truncated word
  /\s+של\s*$/,    // ends with "של"
  /\s+ב\s*$/,     // ends with "ב"
  /\s+ל\s*$/,     // ends with "ל"
  /^לא\s+/,       // starts with "לא"
  /משהו/,         // contains "משהו"
  /מזכיר/,        // contains "מזכיר"
  /^יע\s+/,       // truncated gibberish
];

/**
 * Check if a restaurant extraction is likely a hallucination.
 *
 * @param {Object} restaurant - Restaurant data object
 * @returns {Object} - { isHallucination: boolean, reasons: string[], confidence: number }
 */
function detectHallucination(restaurant) {
  const reasons = [];
  let score = 0;

  const nameHebrew = (restaurant.name_hebrew || '').trim().toLowerCase();
  const googleName = restaurant.google_places?.google_name || '';

  // Check 1: Is it a common word?
  const nameNormalized = nameHebrew.replace(/^[הו]/, ''); // Remove prefix
  if (COMMON_HEBREW_WORDS.has(nameHebrew) || COMMON_HEBREW_WORDS.has(nameNormalized)) {
    reasons.push(`Common word: "${restaurant.name_hebrew}"`);
    score += 0.4;
  }

  // Check if all words are common
  const words = nameHebrew.split(/\s+/).filter(w => w);
  if (words.length > 1) {
    const commonCount = words.filter(w => COMMON_HEBREW_WORDS.has(w)).length;
    if (commonCount === words.length) {
      reasons.push(`All words are common: "${restaurant.name_hebrew}"`);
      score += 0.3;
    }
  }

  // Check 2: Is it a sentence fragment?
  for (const pattern of SENTENCE_FRAGMENT_PATTERNS) {
    if (pattern.test(nameHebrew)) {
      reasons.push(`Sentence fragment: "${restaurant.name_hebrew}"`);
      score += 0.35;
      break;
    }
  }

  // Check 3: Too short (less than 3 chars)
  const nameNoSpace = nameHebrew.replace(/\s+/g, '');
  if (nameNoSpace.length <= 2) {
    reasons.push(`Name too short: "${restaurant.name_hebrew}"`);
    score += 0.3;
  }

  // Check 4: Too long (more than 5 words)
  if (words.length > 5) {
    reasons.push(`Too many words: ${words.length}`);
    score += 0.3;
  }

  // Check 5: Name doesn't match Google Places
  if (googleName && !namesMatch(nameHebrew, googleName)) {
    reasons.push(`Name mismatch: "${restaurant.name_hebrew}" vs "${googleName}"`);
    score += 0.25;
  }

  // Check 6: Sparse data (many empty fields)
  const emptyFields = countEmptyFields(restaurant);
  if (emptyFields >= 6) {
    reasons.push(`Very sparse data: ${emptyFields} empty fields`);
    score += 0.2;
  }

  // Cap score at 1.0
  score = Math.min(score, 1.0);

  return {
    isHallucination: score >= 0.5,
    reasons,
    confidence: score,
    recommendation: score >= 0.7 ? 'reject' : score >= 0.4 ? 'review' : 'accept'
  };
}

/**
 * Check if two names are similar (accounting for Hebrew variations).
 */
function namesMatch(name1, name2) {
  if (!name1 || !name2) return false;

  const n1 = normalizeHebrew(name1);
  const n2 = normalizeHebrew(name2);

  // Exact match
  if (n1 === n2) return true;

  // One contains the other
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // Word overlap
  const words1 = new Set(n1.split(/\s+/));
  const words2 = new Set(n2.split(/\s+/));
  const intersection = [...words1].filter(w => words2.has(w));
  if (intersection.length > 0) return true;

  return false;
}

/**
 * Normalize Hebrew text for comparison.
 */
function normalizeHebrew(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/^ה/, '')  // Remove definite article
    .replace(/[ז]'/g, "ג'")  // Normalize geresh
    .replace(/[^\u0590-\u05ff\s\w]/g, '');  // Remove punctuation
}

/**
 * Count empty/placeholder fields.
 */
function countEmptyFields(restaurant) {
  const emptyMarkers = ['לא צוין', '', null, undefined];
  const fieldsToCheck = [
    restaurant.cuisine_type,
    restaurant.location?.city,
    restaurant.location?.neighborhood,
    restaurant.price_range,
    restaurant.host_opinion,
    restaurant.host_comments,
    restaurant.menu_items,
    restaurant.special_features,
  ];

  return fieldsToCheck.filter(v => {
    if (v === null || v === undefined || v === '') return true;
    if (typeof v === 'string' && emptyMarkers.includes(v.trim())) return true;
    if (Array.isArray(v) && v.length === 0) return true;
    return false;
  }).length;
}

/**
 * Filter a list of restaurants, removing hallucinations.
 *
 * @param {Array} restaurants - Array of restaurant objects
 * @param {Object} options - { strictMode: boolean }
 * @returns {Array} - Filtered restaurants
 */
function filterHallucinations(restaurants, options = { strictMode: true }) {
  return restaurants.filter(restaurant => {
    const result = detectHallucination(restaurant);

    // In strict mode, reject anything with confidence >= 0.4
    // In non-strict mode, only reject confidence >= 0.7
    const threshold = options.strictMode ? 0.4 : 0.7;

    if (result.confidence >= threshold) {
      console.log(`[Hallucination Filter] Rejecting "${restaurant.name_hebrew}": ${result.reasons.join(', ')}`);
      return false;
    }

    return true;
  });
}

module.exports = {
  detectHallucination,
  filterHallucinations,
  COMMON_HEBREW_WORDS,
};
