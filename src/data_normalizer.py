"""
Data normalizer for Where2Eat restaurant data.
Converts Hebrew AI analyzer output values to English enum values
expected by the frontend TypeScript types.
"""

PRICE_RANGE_MAP = {
    'זול': 'budget', 'תקציבי': 'budget',
    'בינוני': 'mid-range', 'בינוני-יקר': 'mid-range',
    'יקר': 'expensive', 'יוקרתי': 'expensive',
    'לא צוין': 'not_mentioned',
    # English passthrough
    'budget': 'budget', 'mid-range': 'mid-range', 'expensive': 'expensive',
    'not_mentioned': 'not_mentioned',
}

STATUS_MAP = {
    'פתוח': 'open', 'open': 'open',
    'סגור': 'closed', 'closed': 'closed',
    'חדש': 'new_opening', 'פתיחה חדשה': 'new_opening', 'new_opening': 'new_opening',
    'נסגר בקרוב': 'closing_soon', 'closing_soon': 'closing_soon',
    'נפתח מחדש': 'reopening', 'reopening': 'reopening',
    'לא צוין': None,
}

OPINION_MAP = {
    'חיובית מאוד': 'positive', 'חיובית': 'positive', 'positive': 'positive',
    'שלילית': 'negative', 'negative': 'negative',
    'מעורבת': 'mixed', 'mixed': 'mixed',
    'ניטרלית': 'neutral', 'neutral': 'neutral',
    'לא צוין': 'neutral',
}


def normalize_price_range(value):
    if not value:
        return None
    return PRICE_RANGE_MAP.get(value, value)


def normalize_status(value):
    if not value:
        return None
    return STATUS_MAP.get(value, value)


def normalize_host_opinion(value):
    if not value:
        return None
    return OPINION_MAP.get(value, value)


def normalize_menu_items(items):
    """Convert string items to MenuItem objects."""
    if not items:
        return []
    result = []
    for item in items:
        if isinstance(item, str):
            result.append({
                'item_name': item,
                'description': '',
                'price': None,
                'recommendation_level': 'mentioned'
            })
        elif isinstance(item, dict):
            result.append(item)
    return result


def normalize_restaurant(data):
    """Normalize all fields of a restaurant dict."""
    data['price_range'] = normalize_price_range(data.get('price_range'))
    data['status'] = normalize_status(data.get('status'))
    data['host_opinion'] = normalize_host_opinion(data.get('host_opinion'))
    data['menu_items'] = normalize_menu_items(data.get('menu_items', []))
    # Remove photo_url from photos (use photo_reference via proxy)
    for photo in data.get('photos', []):
        photo.pop('photo_url', None)
    return data
