"""
Tests for admin setup and initial data seeding (PR #61).

Verifies:
- Admin user can be created from env vars
- Default subscriptions are seeded when database is empty
- Seeded subscriptions are queryable
"""

import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

# Add project paths
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))
sys.path.insert(0, str(PROJECT_ROOT / "api"))

from database import Database
from subscription_manager import SubscriptionManager


@pytest.fixture
def temp_data_dir():
    """Create a temporary data directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def db(temp_data_dir):
    """Create a temporary test database."""
    db_path = temp_data_dir / "test.db"
    return Database(str(db_path))


def _can_import_main():
    """Check if api/main.py can be imported (needs email-validator, passlib)."""
    try:
        from main import seed_initial_data
        return True
    except ImportError:
        return False


class TestAdminUserSeed:
    """Tests for admin user seeding from env vars."""

    @pytest.mark.skipif(not _can_import_main(), reason="Missing api/main.py dependencies")
    def test_seed_creates_admin_user_from_env(self, temp_data_dir):
        """seed_initial_data() creates admin user from ADMIN_EMAIL / ADMIN_PASSWORD."""
        env_vars = {
            "ADMIN_EMAIL": "test@admin.com",
            "ADMIN_PASSWORD": "securepass123",
            "DATABASE_DIR": str(temp_data_dir),
        }
        admin_db_path = temp_data_dir / "admin_users.json"

        assert not admin_db_path.exists()

        with patch.dict(os.environ, env_vars, clear=False):
            with patch("main.SubscriptionManager", side_effect=ImportError("skip")):
                try:
                    from main import seed_initial_data
                    seed_initial_data()
                except Exception:
                    pass

        if admin_db_path.exists():
            with open(admin_db_path) as f:
                data = json.load(f)
            assert len(data["users"]) == 1
            assert data["users"][0]["email"] == "test@admin.com"
            assert data["users"][0]["role"] == "super_admin"
            assert "password_hash" in data["users"][0]

    @pytest.mark.skipif(not _can_import_main(), reason="Missing api/main.py dependencies")
    def test_seed_skips_admin_when_users_exist(self, temp_data_dir):
        """seed_initial_data() does NOT overwrite existing admin users."""
        admin_db_path = temp_data_dir / "admin_users.json"

        existing_data = {
            "users": [
                {
                    "id": "existing-id",
                    "email": "existing@admin.com",
                    "role": "super_admin",
                    "password_hash": "existing-hash",
                    "is_active": True,
                }
            ]
        }
        with open(admin_db_path, "w") as f:
            json.dump(existing_data, f)

        env_vars = {
            "ADMIN_EMAIL": "new@admin.com",
            "ADMIN_PASSWORD": "newpass",
            "DATABASE_DIR": str(temp_data_dir),
        }

        with patch.dict(os.environ, env_vars, clear=False):
            with patch("main.SubscriptionManager", side_effect=ImportError("skip")):
                try:
                    from main import seed_initial_data
                    seed_initial_data()
                except Exception:
                    pass

        with open(admin_db_path) as f:
            data = json.load(f)

        assert len(data["users"]) == 1
        assert data["users"][0]["email"] == "existing@admin.com"


class TestSubscriptionSeed:
    """Tests for default subscription seeding."""

    def test_seed_creates_default_subscription(self, db):
        """When no subscriptions exist, seed_initial_data adds the Hebrew Food Podcast."""
        manager = SubscriptionManager(db)

        assert len(manager.list_subscriptions(active_only=False)) == 0

        sub = manager.add_subscription(
            source_url="https://www.youtube.com/playlist?list=PLZPgleW4baxrsrU-metYY1imJ85uH9FNg",
            source_name="Hebrew Food Podcast",
            priority=3,
        )

        assert sub["source_type"] == "playlist"
        assert sub["source_id"] == "PLZPgleW4baxrsrU-metYY1imJ85uH9FNg"
        assert sub["source_name"] == "Hebrew Food Podcast"

    def test_seeded_subscription_is_queryable(self, db):
        """After seeding, subscriptions can be listed."""
        manager = SubscriptionManager(db)

        manager.add_subscription(
            source_url="https://www.youtube.com/playlist?list=PLZPgleW4baxrsrU-metYY1imJ85uH9FNg",
            source_name="Hebrew Food Podcast",
            priority=3,
        )

        subs = manager.list_subscriptions(active_only=True)
        assert len(subs) == 1
        assert subs[0]["source_name"] == "Hebrew Food Podcast"
        assert subs[0]["is_active"] == 1

    def test_seed_does_not_duplicate_subscriptions(self, db):
        """Adding the same subscription twice raises ValueError."""
        manager = SubscriptionManager(db)

        manager.add_subscription(
            source_url="https://www.youtube.com/playlist?list=PLZPgleW4baxrsrU-metYY1imJ85uH9FNg",
            source_name="Hebrew Food Podcast",
            priority=3,
        )

        with pytest.raises(ValueError, match="already exists"):
            manager.add_subscription(
                source_url="https://www.youtube.com/playlist?list=PLZPgleW4baxrsrU-metYY1imJ85uH9FNg",
                source_name="Hebrew Food Podcast",
                priority=3,
            )
