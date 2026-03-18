"""Tests for data_normalizer module."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

import pytest
from data_normalizer import (
    normalize_price_range, normalize_status,
    normalize_host_opinion, normalize_menu_items,
    normalize_restaurant,
)


class TestNormalizePriceRange:
    def test_hebrew_budget(self):
        assert normalize_price_range('זול') == 'budget'
        assert normalize_price_range('תקציבי') == 'budget'

    def test_hebrew_mid_range(self):
        assert normalize_price_range('בינוני') == 'mid-range'
        assert normalize_price_range('בינוני-יקר') == 'mid-range'

    def test_hebrew_expensive(self):
        assert normalize_price_range('יקר') == 'expensive'
        assert normalize_price_range('יוקרתי') == 'expensive'

    def test_passthrough(self):
        assert normalize_price_range('budget') == 'budget'
        assert normalize_price_range('mid-range') == 'mid-range'
        assert normalize_price_range('expensive') == 'expensive'

    def test_null(self):
        assert normalize_price_range(None) is None
        assert normalize_price_range('') is None


class TestNormalizeStatus:
    def test_hebrew_open(self):
        assert normalize_status('פתוח') == 'open'

    def test_hebrew_closed(self):
        assert normalize_status('סגור') == 'closed'

    def test_new_opening(self):
        assert normalize_status('חדש') == 'new_opening'
        assert normalize_status('פתיחה חדשה') == 'new_opening'

    def test_passthrough(self):
        assert normalize_status('open') == 'open'

    def test_not_specified(self):
        assert normalize_status('לא צוין') is None

    def test_null(self):
        assert normalize_status(None) is None


class TestNormalizeHostOpinion:
    def test_hebrew_positive(self):
        assert normalize_host_opinion('חיובית') == 'positive'
        assert normalize_host_opinion('חיובית מאוד') == 'positive'

    def test_hebrew_negative(self):
        assert normalize_host_opinion('שלילית') == 'negative'

    def test_hebrew_mixed(self):
        assert normalize_host_opinion('מעורבת') == 'mixed'

    def test_passthrough(self):
        assert normalize_host_opinion('positive') == 'positive'

    def test_null(self):
        assert normalize_host_opinion(None) is None


class TestNormalizeMenuItems:
    def test_strings_to_objects(self):
        result = normalize_menu_items(['pizza', 'pasta'])
        assert len(result) == 2
        assert result[0]['item_name'] == 'pizza'
        assert result[0]['recommendation_level'] == 'mentioned'

    def test_objects_passthrough(self):
        items = [{'item_name': 'pizza', 'price': '50'}]
        result = normalize_menu_items(items)
        assert result == items

    def test_empty(self):
        assert normalize_menu_items([]) == []
        assert normalize_menu_items(None) == []


class TestNormalizeRestaurant:
    def test_full_normalization(self):
        data = {
            'name_hebrew': 'טסט',
            'price_range': 'בינוני',
            'status': 'פתוח',
            'host_opinion': 'חיובית',
            'menu_items': ['item1'],
            'photos': [{'photo_reference': 'abc', 'photo_url': 'http://bad'}],
        }
        result = normalize_restaurant(data)
        assert result['price_range'] == 'mid-range'
        assert result['status'] == 'open'
        assert result['host_opinion'] == 'positive'
        assert result['menu_items'][0]['item_name'] == 'item1'
        assert 'photo_url' not in result['photos'][0]
