"""The transcript upload script reads admin credentials only from the environment."""
import importlib.util
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'upload_transcripts.py'


def load(monkeypatch, **env):
    for k in ('WHERE2EAT_ADMIN_EMAIL', 'WHERE2EAT_ADMIN_PASSWORD', 'W2E_ADMIN_EMAIL', 'W2E_ADMIN_PASSWORD'):
        monkeypatch.delenv(k, raising=False)
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    spec = importlib.util.spec_from_file_location('upload_transcripts', SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_no_password_is_built_in():
    # No credential falls back to a value written in the script.
    import re
    assert not re.search(r'getenv\(\s*"[A-Z0-9_]*(PASSWORD|EMAIL)"\s*,', SCRIPT.read_text())


def test_login_without_credentials_stops_with_a_clear_message(monkeypatch):
    mod = load(monkeypatch)
    with pytest.raises(SystemExit) as e:
        mod.login()
    assert 'WHERE2EAT_ADMIN_EMAIL' in str(e.value)


@pytest.mark.parametrize('prefix', ['WHERE2EAT', 'W2E'])
def test_login_uses_credentials_from_the_environment(monkeypatch, prefix):
    mod = load(monkeypatch, **{f'{prefix}_ADMIN_EMAIL': 'a@example.com', f'{prefix}_ADMIN_PASSWORD': 'secret'})
    sent = {}

    class R:
        def raise_for_status(self):
            pass

        def json(self):
            return {'token': 't'}

    monkeypatch.setattr(mod.requests, 'post', lambda url, json, **kw: sent.update(json) or R())
    assert mod.login() == 't'
    assert sent == {'email': 'a@example.com', 'password': 'secret'}
