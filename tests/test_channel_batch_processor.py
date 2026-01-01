"""
Tests for ChannelBatchProcessor - Orchestrates batch processing of YouTube channel videos.
Following TDD principles - tests written first before implementation.
"""

import pytest
import unittest.mock as mock
import json
import tempfile
import os
from datetime import datetime, timedelta
from unittest.mock import AsyncMock
from src.channel_batch_processor import (
    ChannelBatchProcessor, 
    BatchProcessingJob,
    ProcessingStatus,
    BatchProcessingError
)


class TestChannelBatchProcessor:
    """Test suite for Channel Batch Processor following TDD methodology."""

    def setup_method(self):
        """Set up test fixtures before each test method."""
        # Create temporary directory for test files
        self.temp_dir = tempfile.mkdtemp()
        
        self.processor = ChannelBatchProcessor(
            output_dir=self.temp_dir,
            batch_size=3,
            max_concurrent_jobs=2
        )

    def teardown_method(self):
        """Clean up after each test method."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_init_default_values(self):
        """Test initialization with default values."""
        processor = ChannelBatchProcessor()
        assert processor.batch_size == 5
        assert processor.max_concurrent_jobs == 3
        assert processor.output_dir is not None
        assert processor.active_jobs == {}
        assert processor.completed_jobs == []

    def test_init_custom_values(self):
        """Test initialization with custom values."""
        import tempfile
        temp_dir = tempfile.mkdtemp()
        
        processor = ChannelBatchProcessor(
            batch_size=10,
            max_concurrent_jobs=5,
            output_dir=temp_dir
        )
        assert processor.batch_size == 10
        assert processor.max_concurrent_jobs == 5
        assert processor.output_dir == temp_dir

    @mock.patch('src.channel_batch_processor.YouTubeChannelCollector')
    def test_start_channel_processing_success(self, mock_collector_class):
        """Test starting channel processing with valid channel."""
        # Mock channel collector
        mock_collector = mock.MagicMock()
        mock_collector_class.return_value = mock_collector
        
        # Mock extract_channel_id to return the channel ID
        mock_collector.extract_channel_id.return_value = 'UCtest123'
        
        # Mock channel info
        mock_collector.get_channel_info.return_value = {
            'channel_id': 'UCtest123',
            'title': 'Test Channel',
            'video_count': 100
        }
        
        # Mock videos
        mock_videos = [
            {'video_id': 'video1', 'title': 'Video 1'},
            {'video_id': 'video2', 'title': 'Video 2'},
            {'video_id': 'video3', 'title': 'Video 3'},
        ]
        mock_collector.get_channel_videos.return_value = mock_videos
        
        # Start processing
        job = self.processor.start_channel_processing(
            channel_url="https://youtube.com/channel/UCtest123",
            api_key="test_key",
            filters={'max_results': 10}
        )
        
        assert job is not None
        assert job.channel_id == 'UCtest123'
        assert job.total_videos == 3
        assert job.status == ProcessingStatus.PENDING
        assert len(job.video_batches) == 1  # 3 videos in 1 batch (batch_size=3)

    @mock.patch('src.channel_batch_processor.YouTubeChannelCollector')
    def test_start_channel_processing_invalid_channel(self, mock_collector_class):
        """Test starting processing with invalid channel raises error."""
        mock_collector = mock.MagicMock()
        mock_collector_class.return_value = mock_collector
        
        # Mock channel not found
        from src.youtube_channel_collector import ChannelNotFoundError
        mock_collector.get_channel_info.side_effect = ChannelNotFoundError("Channel not found")
        
        with pytest.raises(BatchProcessingError, match="Channel not found"):
            self.processor.start_channel_processing(
                channel_url="https://youtube.com/channel/UCinvalid",
                api_key="test_key"
            )

    def test_get_job_status_existing_job(self):
        """Test getting status of existing job."""
        # Create a mock job
        job = BatchProcessingJob(
            job_id="test_job_123",
            channel_id="UCtest123",
            channel_title="Test Channel",
            total_videos=10,
            video_batches=[],
            filters={}
        )
        job.videos_completed = 5
        job.videos_failed = 1
        job.status = ProcessingStatus.PROCESSING
        
        self.processor.active_jobs["test_job_123"] = job
        
        status = self.processor.get_job_status("test_job_123")
        
        assert status['job_id'] == "test_job_123"
        assert status['status'] == ProcessingStatus.PROCESSING
        assert status['progress']['videos_completed'] == 5
        assert status['progress']['videos_failed'] == 1
        assert status['progress']['videos_total'] == 10
        assert status['progress']['percentage'] == 50.0

    def test_get_job_status_nonexistent_job(self):
        """Test getting status of non-existent job returns None."""
        status = self.processor.get_job_status("nonexistent_job")
        assert status is None

    def test_cancel_job_success(self):
        """Test canceling an active job."""
        job = BatchProcessingJob(
            job_id="test_job_123",
            channel_id="UCtest123",
            channel_title="Test Channel",
            total_videos=10,
            video_batches=[],
            filters={}
        )
        job.status = ProcessingStatus.PROCESSING
        
        self.processor.active_jobs["test_job_123"] = job
        
        success = self.processor.cancel_job("test_job_123")
        
        assert success is True
        assert job.status == ProcessingStatus.CANCELLED
        assert "test_job_123" not in self.processor.active_jobs

    def test_cancel_job_not_found(self):
        """Test canceling non-existent job returns False."""
        success = self.processor.cancel_job("nonexistent_job")
        assert success is False

    @mock.patch('src.channel_batch_processor.RestaurantPodcastAnalyzer')
    async def test_process_video_batch_success(self, mock_analyzer_class):
        """Test processing a batch of videos successfully."""
        # Mock analyzer
        mock_analyzer = mock.MagicMock()
        mock_analyzer_class.return_value = mock_analyzer
        mock_analyzer.process_single_podcast.return_value = {
            'success': True,
            'video_id': 'video123',
            'files_generated': ['file1.json']
        }
        
        # Create test job
        job = BatchProcessingJob(
            job_id="test_job",
            channel_id="UCtest123",
            channel_title="Test Channel",
            total_videos=2,
            video_batches=[],
            filters={}
        )
        
        # Test batch
        video_batch = [
            {'video_id': 'video1', 'title': 'Video 1', 'video_url': 'https://youtube.com/watch?v=video1'},
            {'video_id': 'video2', 'title': 'Video 2', 'video_url': 'https://youtube.com/watch?v=video2'},
        ]
        
        results = await self.processor._process_video_batch(job, video_batch, 0)
        
        assert len(results) == 2
        assert all(result['success'] for result in results)
        assert job.videos_completed == 2
        assert job.videos_failed == 0

    @mock.patch('src.channel_batch_processor.RestaurantPodcastAnalyzer')
    async def test_process_video_batch_partial_failure(self, mock_analyzer_class):
        """Test processing batch with some failures."""
        mock_analyzer = mock.MagicMock()
        mock_analyzer_class.return_value = mock_analyzer
        
        # Mock mixed results
        mock_analyzer.process_single_podcast.side_effect = [
            {'success': True, 'video_id': 'video1'},
            {'success': False, 'video_id': 'video2', 'error': 'Transcript not available'}
        ]
        
        job = BatchProcessingJob(
            job_id="test_job",
            channel_id="UCtest123", 
            channel_title="Test Channel",
            total_videos=2,
            video_batches=[],
            filters={}
        )
        
        video_batch = [
            {'video_id': 'video1', 'title': 'Video 1', 'video_url': 'https://youtube.com/watch?v=video1'},
            {'video_id': 'video2', 'title': 'Video 2', 'video_url': 'https://youtube.com/watch?v=video2'},
        ]
        
        results = await self.processor._process_video_batch(job, video_batch, 0)
        
        assert len(results) == 2
        assert results[0]['success'] is True
        assert results[1]['success'] is False
        assert job.videos_completed == 1
        assert job.videos_failed == 1

    def test_create_video_batches(self):
        """Test splitting videos into batches."""
        videos = [
            {'video_id': f'video{i}', 'title': f'Video {i}'} 
            for i in range(1, 8)  # 7 videos
        ]
        
        batches = self.processor._create_video_batches(videos, batch_size=3)
        
        assert len(batches) == 3  # [3, 3, 1]
        assert len(batches[0]) == 3
        assert len(batches[1]) == 3
        assert len(batches[2]) == 1
        assert batches[0][0]['video_id'] == 'video1'
        assert batches[2][0]['video_id'] == 'video7'

    def test_create_video_batches_empty(self):
        """Test creating batches from empty video list."""
        batches = self.processor._create_video_batches([], batch_size=3)
        assert batches == []

    def test_generate_job_summary(self):
        """Test generating comprehensive job summary."""
        job = BatchProcessingJob(
            job_id="test_job",
            channel_id="UCtest123",
            channel_title="Test Channel",
            total_videos=10,
            video_batches=[],
            filters={'max_results': 20}
        )
        
        job.videos_completed = 8
        job.videos_failed = 2
        job.restaurants_found = 25
        job.status = ProcessingStatus.COMPLETED
        job.started_at = datetime.now() - timedelta(minutes=30)
        job.completed_at = datetime.now()
        job.failed_videos = [
            {'video_id': 'video1', 'error': 'No transcript'},
            {'video_id': 'video2', 'error': 'API error'}
        ]
        
        summary = self.processor.generate_job_summary(job)
        
        assert summary['job_id'] == "test_job"
        assert summary['channel_info']['channel_id'] == "UCtest123"
        assert summary['summary']['videos_processed'] == 8
        assert summary['summary']['videos_failed'] == 2
        assert summary['summary']['restaurants_found'] == 25
        assert summary['summary']['success_rate'] == 80.0
        assert summary['processing_duration_minutes'] == 30
        assert len(summary['failed_videos']) == 2

    def test_save_job_results(self):
        """Test saving job results to file."""
        job = BatchProcessingJob(
            job_id="test_job",
            channel_id="UCtest123",
            channel_title="Test Channel",
            total_videos=5,
            video_batches=[],
            filters={}
        )
        job.status = ProcessingStatus.COMPLETED
        job.videos_completed = 5
        job.restaurants_found = 12
        
        filepath = self.processor.save_job_results(job)
        
        assert os.path.exists(filepath)
        assert "test_job" in filepath
        assert filepath.endswith('.json')
        
        # Verify file contents
        with open(filepath, 'r') as f:
            data = json.load(f)
            assert data['job_id'] == "test_job"
            assert data['summary']['videos_processed'] == 5

    def test_get_active_jobs(self):
        """Test getting list of active jobs."""
        # Add some test jobs
        job1 = BatchProcessingJob("job1", "UC1", "Channel 1", 10, [], {})
        job2 = BatchProcessingJob("job2", "UC2", "Channel 2", 20, [], {})
        
        self.processor.active_jobs["job1"] = job1
        self.processor.active_jobs["job2"] = job2
        
        active_jobs = self.processor.get_active_jobs()
        
        assert len(active_jobs) == 2
        assert any(job['job_id'] == 'job1' for job in active_jobs)
        assert any(job['job_id'] == 'job2' for job in active_jobs)

    def test_get_completed_jobs(self):
        """Test getting list of completed jobs."""
        # Add completed jobs
        job1 = BatchProcessingJob("job1", "UC1", "Channel 1", 10, [], {})
        job1.status = ProcessingStatus.COMPLETED
        job2 = BatchProcessingJob("job2", "UC2", "Channel 2", 20, [], {})
        job2.status = ProcessingStatus.COMPLETED
        
        self.processor.completed_jobs = [job1, job2]
        
        completed_jobs = self.processor.get_completed_jobs()
        
        assert len(completed_jobs) == 2
        assert all(job['status'] == ProcessingStatus.COMPLETED for job in completed_jobs)

    def test_cleanup_old_jobs(self):
        """Test cleaning up old completed jobs."""
        # Create old completed job
        old_job = BatchProcessingJob("old_job", "UC1", "Channel 1", 5, [], {})
        old_job.completed_at = datetime.now() - timedelta(days=8)
        old_job.status = ProcessingStatus.COMPLETED
        
        # Create recent completed job
        recent_job = BatchProcessingJob("recent_job", "UC2", "Channel 2", 10, [], {})
        recent_job.completed_at = datetime.now() - timedelta(days=3)
        recent_job.status = ProcessingStatus.COMPLETED
        
        self.processor.completed_jobs = [old_job, recent_job]
        
        # Cleanup jobs older than 7 days
        self.processor.cleanup_old_jobs(max_age_days=7)
        
        assert len(self.processor.completed_jobs) == 1
        assert self.processor.completed_jobs[0].job_id == "recent_job"

    def test_estimate_processing_time(self):
        """Test estimating processing time based on video count."""
        # Test with no historical data (use default)
        estimate = self.processor.estimate_processing_time(50)
        assert estimate > 0
        
        # Add historical data
        job1 = BatchProcessingJob("job1", "UC1", "Channel 1", 10, [], {})
        job1.started_at = datetime.now() - timedelta(minutes=20)
        job1.completed_at = datetime.now()
        job1.videos_completed = 10
        job1.status = ProcessingStatus.COMPLETED
        
        self.processor.completed_jobs = [job1]
        
        # Estimate based on historical data (2 minutes per video)
        estimate = self.processor.estimate_processing_time(25)
        assert estimate == pytest.approx(50, rel=0.1)  # 25 videos * 2 min/video

    @mock.patch('src.channel_batch_processor.YouTubeChannelCollector')
    def test_duplicate_prevention(self, mock_collector_class):
        """Test preventing duplicate processing of same channel."""
        mock_collector = mock.MagicMock()
        mock_collector_class.return_value = mock_collector
        
        mock_collector.extract_channel_id.return_value = 'UCtest123'
        mock_collector.get_channel_info.return_value = {
            'channel_id': 'UCtest123',
            'title': 'Test Channel',
            'video_count': 50
        }
        
        mock_collector.get_channel_videos.return_value = []
        
        # Start first job
        job1 = self.processor.start_channel_processing(
            channel_url="https://youtube.com/channel/UCtest123",
            api_key="test_key"
        )
        
        # Try to start duplicate job
        with pytest.raises(BatchProcessingError, match="already being processed"):
            self.processor.start_channel_processing(
                channel_url="https://youtube.com/channel/UCtest123",
                api_key="test_key"
            )

    def test_max_concurrent_jobs_limit(self):
        """Test enforcement of maximum concurrent jobs limit."""
        # Set low limit for testing
        self.processor.max_concurrent_jobs = 2
        
        # Add mock jobs to reach limit
        for i in range(2):
            job = BatchProcessingJob(f"job{i}", f"UC{i}", f"Channel {i}", 10, [], {})
            job.status = ProcessingStatus.PROCESSING
            self.processor.active_jobs[f"job{i}"] = job
        
        # Try to add one more job
        with pytest.raises(BatchProcessingError, match="Maximum concurrent jobs"):
            with mock.patch('src.channel_batch_processor.YouTubeChannelCollector'):
                self.processor.start_channel_processing(
                    channel_url="https://youtube.com/channel/UCnew",
                    api_key="test_key"
                )

    def test_job_persistence(self):
        """Test saving and loading job state."""
        job = BatchProcessingJob(
            job_id="test_job",
            channel_id="UCtest123",
            channel_title="Test Channel", 
            total_videos=10,
            video_batches=[],
            filters={}
        )
        job.videos_completed = 5
        job.status = ProcessingStatus.PROCESSING
        
        # Save job state
        self.processor.save_job_state(job)
        
        # Load job state
        loaded_job = self.processor.load_job_state("test_job")
        
        assert loaded_job is not None
        assert loaded_job.job_id == "test_job"
        assert loaded_job.videos_completed == 5
        assert loaded_job.status == ProcessingStatus.PROCESSING

    def test_progress_callbacks(self):
        """Test progress callback functionality."""
        callback_calls = []
        
        def progress_callback(job_id, progress):
            callback_calls.append((job_id, progress))
        
        # Set callback
        self.processor.set_progress_callback(progress_callback)
        
        # Create job and update progress
        job = BatchProcessingJob("test_job", "UC123", "Test", 10, [], {})
        self.processor.active_jobs["test_job"] = job
        
        # Simulate progress update
        self.processor._update_job_progress(job, videos_completed=3)
        
        assert len(callback_calls) == 1
        assert callback_calls[0][0] == "test_job"
        assert callback_calls[0][1]['videos_completed'] == 3


class TestBatchProcessingJob:
    """Test suite for BatchProcessingJob data class."""

    def test_job_initialization(self):
        """Test job initialization with required fields."""
        job = BatchProcessingJob(
            job_id="test123",
            channel_id="UCabc",
            channel_title="Test Channel",
            total_videos=50,
            video_batches=[],
            filters={'max_results': 100}
        )
        
        assert job.job_id == "test123"
        assert job.channel_id == "UCabc" 
        assert job.channel_title == "Test Channel"
        assert job.total_videos == 50
        assert job.status == ProcessingStatus.PENDING
        assert job.videos_completed == 0
        assert job.videos_failed == 0
        assert job.restaurants_found == 0

    def test_job_progress_calculation(self):
        """Test job progress percentage calculation."""
        job = BatchProcessingJob("test", "UC123", "Test", 20, [], {})
        
        # No progress
        assert job.progress_percentage == 0.0
        
        # Partial progress
        job.videos_completed = 8
        job.videos_failed = 2
        assert job.progress_percentage == 50.0  # (8+2)/20 * 100
        
        # Complete
        job.videos_completed = 18
        job.videos_failed = 2
        assert job.progress_percentage == 100.0

    def test_job_success_rate(self):
        """Test job success rate calculation."""
        job = BatchProcessingJob("test", "UC123", "Test", 20, [], {})
        
        # No videos processed
        assert job.success_rate == 0.0
        
        # Some processed
        job.videos_completed = 8
        job.videos_failed = 2
        assert job.success_rate == 80.0  # 8/(8+2) * 100

    def test_job_serialization(self):
        """Test job serialization for persistence."""
        job = BatchProcessingJob("test", "UC123", "Test Channel", 10, [], {})
        job.videos_completed = 5
        job.restaurants_found = 15
        job.started_at = datetime.now()
        
        # Convert to dict
        job_dict = job.to_dict()
        
        assert job_dict['job_id'] == "test"
        assert job_dict['videos_completed'] == 5
        assert job_dict['restaurants_found'] == 15
        assert 'started_at' in job_dict
        
        # Convert back from dict
        restored_job = BatchProcessingJob.from_dict(job_dict)
        
        assert restored_job.job_id == job.job_id
        assert restored_job.videos_completed == job.videos_completed
        assert restored_job.restaurants_found == job.restaurants_found


class TestProcessingStatus:
    """Test suite for ProcessingStatus enum."""
    
    def test_status_values(self):
        """Test all status values are correctly defined."""
        assert ProcessingStatus.PENDING == "pending"
        assert ProcessingStatus.PROCESSING == "processing"
        assert ProcessingStatus.COMPLETED == "completed"
        assert ProcessingStatus.FAILED == "failed"
        assert ProcessingStatus.CANCELLED == "cancelled"

    def test_status_transitions(self):
        """Test valid status transitions."""
        job = BatchProcessingJob("test", "UC123", "Test", 10, [], {})
        
        # Valid transitions
        assert job.status == ProcessingStatus.PENDING
        job.status = ProcessingStatus.PROCESSING
        assert job.status == ProcessingStatus.PROCESSING
        job.status = ProcessingStatus.COMPLETED
        assert job.status == ProcessingStatus.COMPLETED