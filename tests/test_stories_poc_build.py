"""Build script for the stories prototype (docs/plans/stories-poc). No network."""
import importlib.util
from pathlib import Path

import pytest

_PATH = Path(__file__).resolve().parents[1] / 'docs' / 'plans' / 'stories-poc' / 'build_stories_poc.py'
spec = importlib.util.spec_from_file_location('build_stories_poc', _PATH)
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)

PROXY = 'https://where2eat-production.up.railway.app/api/photos/places/X/photos/Y'
STORED = 'https://where2eat-production.up.railway.app/api/venue-images/' + 'a' * 64 + '.jpg'
GOOGLE = 'https://lh3.googleusercontent.com/grass-cs/abc'


def test_excerpt_keeps_two_sentences_and_200_chars():
    assert b.excerpt('אחת. שתיים. שלוש.') == 'אחת. שתיים.'
    long = b.excerpt('מילה ' * 100)
    assert len(long) <= 200 and long.endswith('…')
    assert b.excerpt('   ') is None


@pytest.mark.parametrize('row,expected', [
    ({}, True), ({'is_hidden': True}, False), ({'is_closing': True}, False),
    ({'status': 'closed'}, False), ({'status': 'סגור'}, False),
])
def test_is_listed_matches_the_site_rule(row, expected):
    assert b.is_listed(row) is expected


def test_pick_image_never_uses_paid_proxy_or_dead_links():
    alive = {STORED}
    assert b.pick_image({'image_url': STORED}, alive) == STORED
    assert b.pick_image({'image_url': PROXY}, alive) is None
    assert b.pick_image({'image_url': GOOGLE}, alive) is None          # dead (not in alive)
    assert b.pick_image({'image_url': '', 'photos': [{'photo_reference': 'places/X/photos/Y'}]}, alive) is None
    assert b.pick_image({'image_url': GOOGLE}, None) == GOOGLE         # no liveness check requested


def test_render_html_fills_data_and_optional_photo_block():
    template = '<script>\n/*__IMGS__*/\n</script><script>\nconst DATA = __DATA__;\n</script>'
    html = b.render_html(template, {'restaurants': [{'id': 'r1', 'n': '</script>'}]}, None)
    assert '__DATA__' not in html and '<\\/script>' in html and 'IMGS_EMBEDDED' not in html
    html = b.render_html(template, {'restaurants': []}, {'i0': 'QUJD'})
    assert 'const IMGS_EMBEDDED = {\n"i0":"QUJD"\n};' in html


def test_template_has_the_placeholders_the_script_fills():
    t = (_PATH.parent / 'stories.template.html').read_text(encoding='utf-8')
    assert t.count('__DATA__') == 1 and t.count('/*__IMGS__*/') == 1
