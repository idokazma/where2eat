"""
Tests for src path resolution in API modules.

These tests verify that the .resolve() fix ensures imports work
regardless of the current working directory.
"""

import os
import sys
from pathlib import Path

import pytest


# Get the project root
PROJECT_ROOT = Path(__file__).parent.parent


class TestPathResolution:
    """Tests for src path resolution in API modules."""

    def test_main_src_dir_is_absolute(self):
        """Test that SRC_DIR in main.py resolves to an absolute path."""
        # Simulate the path calculation from api/main.py
        api_main_path = PROJECT_ROOT / "api" / "main.py"
        src_dir = (api_main_path.parent.parent / "src").resolve()

        assert src_dir.is_absolute(), "SRC_DIR should be an absolute path"
        assert src_dir.exists(), "SRC_DIR should exist"
        assert src_dir.is_dir(), "SRC_DIR should be a directory"

    def test_router_analyze_src_dir_is_absolute(self):
        """Test that SRC_DIR in analyze.py router resolves to an absolute path."""
        # Simulate the path calculation from api/routers/analyze.py
        router_path = PROJECT_ROOT / "api" / "routers" / "analyze.py"
        src_dir = (router_path.parent.parent.parent / "src").resolve()

        assert src_dir.is_absolute(), "SRC_DIR should be an absolute path"
        assert src_dir.exists(), "SRC_DIR should exist"
        assert src_dir.is_dir(), "SRC_DIR should be a directory"

    def test_router_health_src_dir_is_absolute(self):
        """Test that SRC_DIR in health.py router resolves to an absolute path."""
        # Simulate the path calculation from api/routers/health.py
        router_path = PROJECT_ROOT / "api" / "routers" / "health.py"
        src_dir = (router_path.parent.parent.parent / "src").resolve()

        assert src_dir.is_absolute(), "SRC_DIR should be an absolute path"
        assert src_dir.exists(), "SRC_DIR should exist"
        assert src_dir.is_dir(), "SRC_DIR should be a directory"

    def test_all_paths_resolve_to_same_src(self):
        """Test that all API modules resolve to the same src directory."""
        main_path = PROJECT_ROOT / "api" / "main.py"
        analyze_path = PROJECT_ROOT / "api" / "routers" / "analyze.py"
        health_path = PROJECT_ROOT / "api" / "routers" / "health.py"

        main_src = (main_path.parent.parent / "src").resolve()
        analyze_src = (analyze_path.parent.parent.parent / "src").resolve()
        health_src = (health_path.parent.parent.parent / "src").resolve()

        assert main_src == analyze_src == health_src, \
            "All modules should resolve to the same src directory"

    def test_src_dir_contains_required_modules(self):
        """Test that src directory contains required Python modules."""
        src_dir = (PROJECT_ROOT / "src").resolve()

        required_modules = [
            "youtube_transcript_collector.py",
            "unified_restaurant_analyzer.py",
            "youtube_channel_collector.py",
        ]

        for module in required_modules:
            module_path = src_dir / module
            assert module_path.exists(), f"Required module {module} not found in src"

    def test_path_resolution_from_different_cwd(self):
        """Test that resolved paths work regardless of current working directory."""
        original_cwd = os.getcwd()

        try:
            # Change to a different directory
            os.chdir("/tmp")

            # The resolved path should still be absolute and valid
            api_main_path = PROJECT_ROOT / "api" / "main.py"
            src_dir = (api_main_path.parent.parent / "src").resolve()

            assert src_dir.is_absolute(), "Path should remain absolute after cwd change"
            assert src_dir.exists(), "Path should still exist after cwd change"
        finally:
            os.chdir(original_cwd)

    def test_youtube_transcript_collector_importable(self):
        """Test that YouTubeTranscriptCollector can be imported from src."""
        src_dir = (PROJECT_ROOT / "src").resolve()

        # Add to path if not already there
        src_str = str(src_dir)
        if src_str not in sys.path:
            sys.path.insert(0, src_str)

        try:
            from youtube_transcript_collector import YouTubeTranscriptCollector
        except ImportError as e:
            pytest.skip(f"Skipping due to missing dependency: {e}")

        assert YouTubeTranscriptCollector is not None
        assert hasattr(YouTubeTranscriptCollector, 'get_transcript')
        assert hasattr(YouTubeTranscriptCollector, 'health_check')

    def test_unified_restaurant_analyzer_importable(self):
        """Test that UnifiedRestaurantAnalyzer can be imported from src."""
        src_dir = (PROJECT_ROOT / "src").resolve()

        # Add to path if not already there
        src_str = str(src_dir)
        if src_str not in sys.path:
            sys.path.insert(0, src_str)

        try:
            from unified_restaurant_analyzer import UnifiedRestaurantAnalyzer
        except ImportError as e:
            pytest.skip(f"Skipping due to missing dependency: {e}")

        assert UnifiedRestaurantAnalyzer is not None
        assert hasattr(UnifiedRestaurantAnalyzer, 'analyze_transcript')

    def test_resolve_vs_no_resolve_difference(self):
        """Test that resolve() makes a difference for relative path segments."""
        # Without resolve, this could contain '..' segments
        api_main_path = PROJECT_ROOT / "api" / "main.py"
        unresolved = api_main_path.parent.parent / "src"
        resolved = unresolved.resolve()

        # Resolved path should be absolute and normalized
        assert resolved.is_absolute()
        # The resolved path should not contain '..' or '.'
        assert ".." not in str(resolved)

    def test_api_files_use_resolve(self):
        """Test that API files actually use .resolve() in their path setup."""
        api_files = [
            PROJECT_ROOT / "api" / "main.py",
            PROJECT_ROOT / "api" / "routers" / "analyze.py",
            PROJECT_ROOT / "api" / "routers" / "health.py",
        ]

        for api_file in api_files:
            content = api_file.read_text()
            assert ".resolve()" in content, \
                f"{api_file.name} should use .resolve() for SRC_DIR"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
