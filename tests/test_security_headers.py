"""
Tests for FastAPI security headers middleware (PR #57).

Verifies that SecurityHeadersMiddleware adds the correct security headers
to all API responses, equivalent to Express Helmet.
"""

import os
import sys
from pathlib import Path

import pytest

# Add paths for imports
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))
sys.path.insert(0, str(PROJECT_ROOT / "api"))


EXPECTED_SECURITY_HEADERS = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "x-xss-protection": "1; mode=block",
    "referrer-policy": "strict-origin-when-cross-origin",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
}


@pytest.fixture(scope="module")
def client():
    """Create a FastAPI TestClient for the Where2Eat API."""
    try:
        from fastapi.testclient import TestClient
        from main import app
    except ImportError as e:
        pytest.skip(f"Cannot import FastAPI app: {e}")

    return TestClient(app, raise_server_exceptions=False)


class TestSecurityHeaders:
    """Verify security headers are present on all responses."""

    def test_health_endpoint_returns_security_headers(self, client):
        """GET /health includes all 5 security headers."""
        response = client.get("/health")
        assert response.status_code == 200

        for header_name, expected_value in EXPECTED_SECURITY_HEADERS.items():
            actual = response.headers.get(header_name)
            assert actual == expected_value, (
                f"Header {header_name}: expected '{expected_value}', got '{actual}'"
            )

    def test_api_restaurants_endpoint_returns_security_headers(self, client):
        """GET /api/restaurants includes all security headers."""
        response = client.get("/api/restaurants")
        # Accept 200 or any status - we only care about headers
        for header_name, expected_value in EXPECTED_SECURITY_HEADERS.items():
            actual = response.headers.get(header_name)
            assert actual == expected_value, (
                f"Header {header_name}: expected '{expected_value}', got '{actual}'"
            )

    def test_404_response_includes_security_headers(self, client):
        """Even error responses should include security headers."""
        response = client.get("/nonexistent-path")
        assert response.status_code in (404, 405)

        for header_name, expected_value in EXPECTED_SECURITY_HEADERS.items():
            actual = response.headers.get(header_name)
            assert actual == expected_value, (
                f"Header {header_name}: expected '{expected_value}', got '{actual}'"
            )
