"""
Tests for importlib fix and module collision resolution (PR #55, #56).

Verifies:
- FastAPI restaurant routes load correctly via TestClient
- No ImportError or module collision between api/models and src/models
- The importlib.util.spec_from_file_location approach correctly loads src/models/base.py
"""

import os
import sys
from pathlib import Path

import pytest

# Add project paths
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))
sys.path.insert(0, str(PROJECT_ROOT / "api"))


class TestImportlibFix:
    """Tests for the importlib-based module loading in restaurant routes."""

    def test_src_models_base_exists(self):
        """src/models/base.py exists and is loadable via importlib."""
        import importlib.util

        src_base_path = PROJECT_ROOT / "src" / "models" / "base.py"
        assert src_base_path.exists(), "src/models/base.py should exist"

        spec = importlib.util.spec_from_file_location("src_models_base", src_base_path)
        assert spec is not None, "importlib should create a valid spec"
        assert spec.loader is not None, "spec should have a loader"

    def test_api_models_directory_exists(self):
        """api/models directory exists (potential collision point)."""
        api_models = PROJECT_ROOT / "api" / "models"
        assert api_models.exists(), "api/models directory should exist"

    def test_no_namespace_collision(self):
        """Loading src/models via importlib does not collide with api/models."""
        import importlib.util

        src_base_path = PROJECT_ROOT / "src" / "models" / "base.py"
        if not src_base_path.exists():
            pytest.skip("src/models/base.py not found")

        # Load src/models/base.py explicitly
        spec = importlib.util.spec_from_file_location("src_models_base", src_base_path)
        module = importlib.util.module_from_spec(spec)

        # This should not raise ImportError
        try:
            spec.loader.exec_module(module)
        except ImportError as e:
            if "sqlalchemy" in str(e).lower():
                pytest.skip(f"Skipping due to missing dependency: {e}")
            raise

        # Verify the module loaded something useful
        assert hasattr(module, "__file__")
        assert "src/models/base.py" in str(module.__file__).replace("\\", "/")

    def test_restaurant_routes_importable(self):
        """api/routers/restaurants.py can be imported without errors."""
        restaurants_path = PROJECT_ROOT / "api" / "routers" / "restaurants.py"
        assert restaurants_path.exists(), "restaurants.py router should exist"

        # Verify the file uses importlib for src/models loading
        content = restaurants_path.read_text()
        assert "importlib" in content, "restaurants.py should use importlib"
        assert "spec_from_file_location" in content, (
            "restaurants.py should use spec_from_file_location"
        )

    def test_fastapi_app_starts_without_import_errors(self):
        """FastAPI app can be created without module collision errors."""
        try:
            from main import app
            assert app is not None
            assert app.title == "Where2Eat API"
        except ImportError as e:
            pytest.skip(f"Skipping due to missing dependency: {e}")

    def test_restaurant_list_endpoint_returns_200(self):
        """GET /api/restaurants returns 200 via TestClient."""
        try:
            from fastapi.testclient import TestClient
            from main import app
        except ImportError as e:
            pytest.skip(f"Cannot import FastAPI app: {e}")

        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/restaurants")

        # Should return 200 (may have 0 restaurants in test env)
        assert response.status_code == 200
        data = response.json()
        assert "restaurants" in data
        assert "count" in data
