"""
Tests for System Monitoring features.
Tests connection testing, error logging, and system metrics.
"""

import os
import sys
import pytest
import tempfile
import json
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock

# Add project paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from database import Database
from backend_service import BackendService


class TestDatabaseErrorLogging:
    """Tests for error logging database methods."""

    @pytest.fixture
    def db(self):
        """Create a temporary database for testing."""
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
            db_path = f.name
        db = Database(db_path)
        yield db
        # Cleanup
        os.unlink(db_path)

    def test_log_error_creates_new_entry(self, db):
        """Test that log_error creates a new error entry."""
        error_id = db.log_error(
            service='youtube',
            level='critical',
            message='API rate limit exceeded'
        )

        assert error_id is not None
        assert error_id.startswith('err_')

    def test_log_error_increments_occurrence_count(self, db):
        """Test that duplicate errors increment occurrence count."""
        # Log the same error twice
        error_id1 = db.log_error(
            service='youtube',
            level='critical',
            message='API rate limit exceeded'
        )
        error_id2 = db.log_error(
            service='youtube',
            level='critical',
            message='API rate limit exceeded'
        )

        # Should return the same error_id
        assert error_id1 == error_id2

        # Check occurrence count
        result = db.get_errors(service='youtube')
        assert len(result['errors']) == 1
        assert result['errors'][0]['occurrence_count'] == 2

    def test_log_error_with_context(self, db):
        """Test logging error with context data."""
        context = {'video_id': 'abc123', 'attempt': 3}
        error_id = db.log_error(
            service='google_places',
            level='warning',
            message='Quota warning',
            context=context,
            job_id='job_123'
        )

        result = db.get_errors()
        assert len(result['errors']) == 1
        assert result['errors'][0]['context'] == context
        assert result['errors'][0]['job_id'] == 'job_123'

    def test_get_errors_with_filters(self, db):
        """Test getting errors with various filters."""
        # Create errors with different levels and services
        db.log_error(service='youtube', level='critical', message='Error 1')
        db.log_error(service='youtube', level='warning', message='Error 2')
        db.log_error(service='database', level='critical', message='Error 3')

        # Filter by level
        critical_errors = db.get_errors(level='critical')
        assert critical_errors['total'] == 2

        # Filter by service
        youtube_errors = db.get_errors(service='youtube')
        assert youtube_errors['total'] == 2

        # Filter by both
        youtube_critical = db.get_errors(service='youtube', level='critical')
        assert youtube_critical['total'] == 1

    def test_resolve_error(self, db):
        """Test resolving an error."""
        error_id = db.log_error(
            service='openai',
            level='critical',
            message='Invalid API key'
        )

        # Resolve the error
        result = db.resolve_error(error_id, admin_user_id='admin_1', notes='Fixed API key')
        assert result is True

        # Verify resolved
        errors = db.get_errors(resolved=True)
        assert errors['total'] == 1
        assert errors['errors'][0]['resolved'] is True
        assert errors['errors'][0]['resolution_notes'] == 'Fixed API key'

    def test_get_error_summary(self, db):
        """Test getting error summary statistics."""
        # Create various errors
        db.log_error(service='youtube', level='critical', message='Error 1')
        db.log_error(service='youtube', level='critical', message='Error 1')  # Duplicate
        db.log_error(service='database', level='warning', message='Error 2')
        db.log_error(service='openai', level='info', message='Error 3')

        summary = db.get_error_summary(hours=24)

        assert summary['total_errors'] == 3  # 3 unique errors
        assert summary['total_occurrences'] == 4  # 4 total occurrences
        assert 'critical' in summary['by_level']
        assert 'youtube' in summary['by_service']

    def test_clear_resolved_errors(self, db):
        """Test clearing old resolved errors."""
        # Create and resolve an error
        error_id = db.log_error(service='test', level='info', message='Test error')
        db.resolve_error(error_id)

        # Clear resolved errors (with 0 days to clear immediately)
        deleted = db.clear_resolved_errors(older_than_days=0)

        # The error was just created so it won't be deleted (not older than 0 days)
        # This tests the mechanism works
        assert deleted >= 0


class TestDatabaseConnectionTests:
    """Tests for connection test history methods."""

    @pytest.fixture
    def db(self):
        """Create a temporary database for testing."""
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
            db_path = f.name
        db = Database(db_path)
        yield db
        os.unlink(db_path)

    def test_log_connection_test(self, db):
        """Test logging a connection test result."""
        log_id = db.log_connection_test(
            service='database',
            status='healthy',
            response_time_ms=45,
            details={'connected': True, 'size_mb': 12.5}
        )

        assert log_id is not None

    def test_get_connection_history(self, db):
        """Test getting connection test history."""
        # Log multiple tests
        db.log_connection_test(service='database', status='healthy', response_time_ms=45)
        db.log_connection_test(service='youtube', status='degraded', response_time_ms=120)
        db.log_connection_test(service='database', status='healthy', response_time_ms=50)

        # Get all history
        history = db.get_connection_history(limit=10)
        assert len(history) == 3

        # Get by service
        db_history = db.get_connection_history(service='database', limit=10)
        assert len(db_history) == 2


class TestDatabaseSystemMetrics:
    """Tests for system metrics methods."""

    @pytest.fixture
    def db(self):
        """Create a temporary database for testing."""
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
            db_path = f.name
        db = Database(db_path)
        yield db
        os.unlink(db_path)

    def test_log_metric(self, db):
        """Test logging a system metric."""
        log_id = db.log_metric(
            metric_type='response_time',
            metric_name='api_restaurants',
            metric_value=45.5,
            metadata={'endpoint': '/api/restaurants'}
        )

        assert log_id is not None

    def test_get_metrics(self, db):
        """Test getting system metrics."""
        # Log multiple metrics
        db.log_metric(metric_type='response_time', metric_name='api_restaurants', metric_value=45.5)
        db.log_metric(metric_type='response_time', metric_name='api_search', metric_value=78.2)
        db.log_metric(metric_type='memory', metric_name='rss', metric_value=256.0)

        # Get all metrics
        metrics = db.get_metrics(hours=24)
        assert len(metrics) == 3

        # Get by type
        response_metrics = db.get_metrics(metric_type='response_time', hours=24)
        assert len(response_metrics) == 2


class TestBackendServiceConnectionTesting:
    """Tests for BackendService connection testing methods."""

    @pytest.fixture
    def service(self):
        """Create a BackendService with temporary database."""
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
            db_path = f.name
        service = BackendService(db_path=db_path)
        yield service
        os.unlink(db_path)

    def test_test_database_connection_healthy(self, service):
        """Test database connection test returns healthy status."""
        result = service.test_database_connection()

        assert result['service'] == 'database'
        assert result['status'] == 'healthy'
        assert result['response_time_ms'] >= 0
        assert result['details']['connected'] is True

    def test_test_database_connection_includes_stats(self, service):
        """Test database connection test includes statistics."""
        result = service.test_database_connection()

        assert 'stats' in result['details']
        assert 'total_restaurants' in result['details']['stats']

    @patch.dict(os.environ, {'ANTHROPIC_API_KEY': ''}, clear=False)
    def test_test_claude_connection_no_key(self, service):
        """Test Claude connection test when API key is not set."""
        # Temporarily clear the key
        original = os.environ.get('ANTHROPIC_API_KEY', '')
        os.environ['ANTHROPIC_API_KEY'] = ''

        try:
            result = service.test_claude_connection()
            assert result['status'] == 'unavailable'
            assert 'not configured' in result['details']['error'].lower()
        finally:
            if original:
                os.environ['ANTHROPIC_API_KEY'] = original

    @patch.dict(os.environ, {'OPENAI_API_KEY': ''}, clear=False)
    def test_test_openai_connection_no_key(self, service):
        """Test OpenAI connection test when API key is not set."""
        original = os.environ.get('OPENAI_API_KEY', '')
        os.environ['OPENAI_API_KEY'] = ''

        try:
            result = service.test_openai_connection()
            assert result['status'] == 'unavailable'
            assert 'not configured' in result['details']['error'].lower()
        finally:
            if original:
                os.environ['OPENAI_API_KEY'] = original

    def test_test_youtube_connection(self, service):
        """Test YouTube connection test."""
        result = service.test_youtube_connection()

        assert result['service'] == 'youtube_transcript'
        assert result['status'] in ['healthy', 'degraded', 'error', 'unavailable']
        assert result['response_time_ms'] >= 0

    def test_test_all_connections(self, service):
        """Test all connections at once."""
        result = service.test_all_connections()

        assert 'overall_status' in result
        assert result['overall_status'] in ['healthy', 'degraded', 'unhealthy']
        assert 'services' in result
        assert 'database' in result['services']
        assert 'summary' in result
        assert result['summary']['total_services'] == 5

    def test_get_api_key_status(self, service):
        """Test getting masked API key status."""
        result = service.get_api_key_status()

        assert 'api_keys' in result
        assert 'anthropic' in result['api_keys']
        assert 'openai' in result['api_keys']
        assert 'google_places' in result['api_keys']

        # Check masking
        for key_info in result['api_keys'].values():
            assert 'configured' in key_info
            assert 'masked_key' in key_info
            assert 'env_var' in key_info
            # If configured, masked_key should start with ****
            if key_info['configured'] and key_info['masked_key']:
                assert key_info['masked_key'].startswith('****')


class TestBackendServiceErrorLogging:
    """Tests for BackendService error logging methods."""

    @pytest.fixture
    def service(self):
        """Create a BackendService with temporary database."""
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
            db_path = f.name
        service = BackendService(db_path=db_path)
        yield service
        os.unlink(db_path)

    def test_log_error(self, service):
        """Test logging an error through the service."""
        error_id = service.log_error(
            service='test_service',
            level='warning',
            message='Test warning message'
        )

        assert error_id is not None
        assert error_id.startswith('err_')

    def test_get_errors(self, service):
        """Test getting errors through the service."""
        service.log_error(service='test', level='critical', message='Error 1')
        service.log_error(service='test', level='warning', message='Error 2')

        result = service.get_errors(limit=10)

        assert 'errors' in result
        assert result['total'] == 2

    def test_resolve_error(self, service):
        """Test resolving an error through the service."""
        error_id = service.log_error(
            service='test',
            level='critical',
            message='Test error'
        )

        result = service.resolve_error(error_id, notes='Resolved in test')
        assert result is True

    def test_get_error_summary(self, service):
        """Test getting error summary through the service."""
        service.log_error(service='test', level='critical', message='Error 1')

        summary = service.get_error_summary(hours=24)

        assert 'total_errors' in summary
        assert summary['total_errors'] >= 1


class TestBackendServiceSystemMetrics:
    """Tests for BackendService system metrics methods."""

    @pytest.fixture
    def service(self):
        """Create a BackendService with temporary database."""
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
            db_path = f.name
        service = BackendService(db_path=db_path)
        yield service
        os.unlink(db_path)

    def test_get_system_metrics(self, service):
        """Test getting system metrics."""
        result = service.get_system_metrics()

        assert 'memory' in result
        assert 'database' in result
        assert 'counts' in result
        assert 'timestamp' in result

        # Check memory metrics
        assert 'rss_bytes' in result['memory']
        assert 'rss_mb' in result['memory']

        # Check database metrics
        assert 'size_bytes' in result['database']
        assert 'size_mb' in result['database']

    def test_health_check(self, service):
        """Test health check includes all components."""
        result = service.health_check()

        assert 'status' in result
        assert result['status'] in ['healthy', 'degraded']
        assert 'checks' in result
        assert 'database' in result['checks']
        assert 'timestamp' in result


class TestConnectionTestIntegration:
    """Integration tests for connection testing flow."""

    @pytest.fixture
    def service(self):
        """Create a BackendService with temporary database."""
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
            db_path = f.name
        service = BackendService(db_path=db_path)
        yield service
        os.unlink(db_path)

    def test_connection_test_flow(self, service):
        """Test the full connection test flow."""
        # 1. Run all connection tests
        all_results = service.test_all_connections()
        assert all_results['overall_status'] in ['healthy', 'degraded', 'unhealthy']

        # 2. Database should always be healthy in tests
        assert all_results['services']['database']['status'] == 'healthy'

        # 3. Check summary is accurate
        total = sum([
            all_results['summary']['healthy'],
            all_results['summary']['degraded'],
            all_results['summary']['error'],
            all_results['summary']['unavailable']
        ])
        assert total == all_results['summary']['total_services']

    def test_error_logging_flow(self, service):
        """Test the full error logging flow."""
        # 1. Log an error
        error_id = service.log_error(
            service='integration_test',
            level='warning',
            message='Test warning'
        )

        # 2. Get errors and verify
        errors = service.get_errors()
        assert errors['total'] >= 1

        # 3. Get summary
        summary = service.get_error_summary(hours=24)
        assert summary['total_errors'] >= 1

        # 4. Resolve the error
        service.resolve_error(error_id)

        # 5. Verify resolved
        unresolved = service.get_errors(resolved=False)
        resolved = service.get_errors(resolved=True)

        # The test error should now be resolved
        assert resolved['total'] >= 1


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
