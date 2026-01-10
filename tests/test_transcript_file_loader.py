"""
Tests for TranscriptFileLoader.
TDD: Tests written first - implementation follows.
"""

import os
import sys
import json
import pytest
import tempfile

# Add project paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


class TestTranscriptFileLoaderInit:
    """Test TranscriptFileLoader initialization."""

    def test_loader_can_be_instantiated(self):
        """Test that loader can be created."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()
        assert loader is not None

    def test_loader_has_supported_formats(self):
        """Test that loader defines supported formats."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()
        assert hasattr(loader, 'SUPPORTED_FORMATS')
        assert '.txt' in loader.SUPPORTED_FORMATS
        assert '.json' in loader.SUPPORTED_FORMATS
        assert '.srt' in loader.SUPPORTED_FORMATS
        assert '.vtt' in loader.SUPPORTED_FORMATS


class TestLoadTxtFile:
    """Test loading plain text transcript files."""

    def test_load_txt_file_returns_transcript_data(self):
        """Test loading a simple text file."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("שלום, היום נדבר על מסעדה צ'קולי בתל אביב.\n")
            f.write("זה מקום ספרדי עם אוכל נהדר.")
            temp_path = f.name

        try:
            result = loader.load_file(temp_path)

            assert result['success'] is True
            assert 'transcript' in result
            assert "צ'קולי" in result['transcript']
            assert 'source_file' in result
            assert result['source_file'] == temp_path
        finally:
            os.unlink(temp_path)

    def test_load_txt_file_with_custom_metadata(self):
        """Test loading text file with metadata override."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("Test transcript content")
            temp_path = f.name

        try:
            result = loader.load_file(
                temp_path,
                video_id='custom123',
                language='en',
                title='Custom Title'
            )

            assert result['success'] is True
            assert result['video_id'] == 'custom123'
            assert result['language'] == 'en'
            assert result['title'] == 'Custom Title'
        finally:
            os.unlink(temp_path)

    def test_load_txt_file_generates_video_id_from_filename(self):
        """Test that video_id is generated from filename if not provided."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = os.path.join(temp_dir, 'episode_abc123.txt')
            with open(file_path, 'w') as f:
                f.write("Test content")

            result = loader.load_file(file_path)

            assert result['success'] is True
            assert result['video_id'] == 'episode_abc123'


class TestLoadJsonFile:
    """Test loading JSON transcript files."""

    def test_load_json_file_with_transcript_field(self):
        """Test loading JSON with transcript field."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({
                'transcript': 'מסעדה בתל אביב',
                'video_id': 'vid123',
                'language': 'he'
            }, f, ensure_ascii=False)
            temp_path = f.name

        try:
            result = loader.load_file(temp_path)

            assert result['success'] is True
            assert result['transcript'] == 'מסעדה בתל אביב'
            assert result['video_id'] == 'vid123'
            assert result['language'] == 'he'
        finally:
            os.unlink(temp_path)

    def test_load_json_file_with_segments(self):
        """Test loading JSON with segments array."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({
                'segments': [
                    {'text': 'First segment', 'start': 0.0, 'duration': 3.0},
                    {'text': 'Second segment', 'start': 3.0, 'duration': 3.0}
                ],
                'video_id': 'seg123'
            }, f, ensure_ascii=False)
            temp_path = f.name

        try:
            result = loader.load_file(temp_path)

            assert result['success'] is True
            assert 'First segment' in result['transcript']
            assert 'Second segment' in result['transcript']
            assert len(result['segments']) == 2
        finally:
            os.unlink(temp_path)

    def test_load_json_file_with_text_array(self):
        """Test loading JSON with text array (YouTube format)."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump([
                {'text': 'Line one', 'start': 0.0, 'duration': 2.0},
                {'text': 'Line two', 'start': 2.0, 'duration': 2.0}
            ], f, ensure_ascii=False)
            temp_path = f.name

        try:
            result = loader.load_file(temp_path)

            assert result['success'] is True
            assert 'Line one' in result['transcript']
            assert 'Line two' in result['transcript']
        finally:
            os.unlink(temp_path)


class TestLoadSrtFile:
    """Test loading SRT subtitle files."""

    def test_load_srt_file(self):
        """Test loading SRT format file."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        srt_content = """1
00:00:00,000 --> 00:00:03,000
שלום וברוכים הבאים

2
00:00:03,000 --> 00:00:06,500
היום נדבר על מסעדה צ'קולי

3
00:00:06,500 --> 00:00:10,000
בתל אביב
"""

        with tempfile.NamedTemporaryFile(mode='w', suffix='.srt', delete=False, encoding='utf-8') as f:
            f.write(srt_content)
            temp_path = f.name

        try:
            result = loader.load_file(temp_path)

            assert result['success'] is True
            assert 'שלום' in result['transcript']
            assert "צ'קולי" in result['transcript']
            assert len(result['segments']) == 3
            # Check first segment timing
            assert result['segments'][0]['start'] == 0.0
            assert result['segments'][0]['duration'] == 3.0
        finally:
            os.unlink(temp_path)


class TestLoadVttFile:
    """Test loading WebVTT subtitle files."""

    def test_load_vtt_file(self):
        """Test loading VTT format file."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        vtt_content = """WEBVTT

00:00:00.000 --> 00:00:03.000
שלום וברוכים הבאים

00:00:03.000 --> 00:00:06.500
היום נדבר על מסעדה

00:00:06.500 --> 00:00:10.000
בירושלים
"""

        with tempfile.NamedTemporaryFile(mode='w', suffix='.vtt', delete=False, encoding='utf-8') as f:
            f.write(vtt_content)
            temp_path = f.name

        try:
            result = loader.load_file(temp_path)

            assert result['success'] is True
            assert 'שלום' in result['transcript']
            assert 'ירושלים' in result['transcript']
            assert len(result['segments']) == 3
        finally:
            os.unlink(temp_path)


class TestLoadFolder:
    """Test loading multiple transcript files from a folder."""

    def test_load_folder_returns_list_of_transcripts(self):
        """Test loading all transcripts from a folder."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        with tempfile.TemporaryDirectory() as temp_dir:
            # Create multiple transcript files
            with open(os.path.join(temp_dir, 'ep1.txt'), 'w') as f:
                f.write("Episode 1 content")

            with open(os.path.join(temp_dir, 'ep2.txt'), 'w') as f:
                f.write("Episode 2 content")

            with open(os.path.join(temp_dir, 'ep3.json'), 'w') as f:
                json.dump({'transcript': 'Episode 3 content'}, f)

            results = loader.load_folder(temp_dir)

            assert len(results) == 3
            assert all(r['success'] for r in results)

    def test_load_folder_skips_unsupported_files(self):
        """Test that unsupported file types are skipped."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        with tempfile.TemporaryDirectory() as temp_dir:
            with open(os.path.join(temp_dir, 'valid.txt'), 'w') as f:
                f.write("Valid content")

            with open(os.path.join(temp_dir, 'image.png'), 'w') as f:
                f.write("Not a transcript")

            with open(os.path.join(temp_dir, 'readme.md'), 'w') as f:
                f.write("Also not a transcript")

            results = loader.load_folder(temp_dir)

            assert len(results) == 1
            assert results[0]['video_id'] == 'valid'

    def test_load_folder_handles_recursive_option(self):
        """Test recursive folder loading."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        with tempfile.TemporaryDirectory() as temp_dir:
            # Create nested structure
            subdir = os.path.join(temp_dir, 'subdir')
            os.makedirs(subdir)

            with open(os.path.join(temp_dir, 'root.txt'), 'w') as f:
                f.write("Root content")

            with open(os.path.join(subdir, 'nested.txt'), 'w') as f:
                f.write("Nested content")

            # Non-recursive
            results = loader.load_folder(temp_dir, recursive=False)
            assert len(results) == 1

            # Recursive
            results = loader.load_folder(temp_dir, recursive=True)
            assert len(results) == 2

    def test_load_folder_returns_empty_for_empty_folder(self):
        """Test loading from empty folder."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        with tempfile.TemporaryDirectory() as temp_dir:
            results = loader.load_folder(temp_dir)
            assert results == []

    def test_load_folder_handles_nonexistent_path(self):
        """Test error handling for non-existent folder."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        with pytest.raises(FileNotFoundError):
            loader.load_folder('/nonexistent/path')


class TestErrorHandling:
    """Test error handling in file loading."""

    def test_load_nonexistent_file(self):
        """Test loading non-existent file returns error."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        result = loader.load_file('/nonexistent/file.txt')

        assert result['success'] is False
        assert 'error' in result

    def test_load_unsupported_format(self):
        """Test loading unsupported file format."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        with tempfile.NamedTemporaryFile(mode='w', suffix='.xyz', delete=False) as f:
            f.write("Some content")
            temp_path = f.name

        try:
            result = loader.load_file(temp_path)

            assert result['success'] is False
            assert 'unsupported' in result['error'].lower()
        finally:
            os.unlink(temp_path)

    def test_load_malformed_json(self):
        """Test loading malformed JSON file."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            f.write("{invalid json content")
            temp_path = f.name

        try:
            result = loader.load_file(temp_path)

            assert result['success'] is False
            assert 'error' in result
        finally:
            os.unlink(temp_path)

    def test_load_empty_file(self):
        """Test loading empty file."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            temp_path = f.name

        try:
            result = loader.load_file(temp_path)

            assert result['success'] is False
            assert 'empty' in result['error'].lower()
        finally:
            os.unlink(temp_path)


class TestTimestampParsing:
    """Test timestamp parsing for SRT/VTT formats."""

    def test_parse_srt_timestamp(self):
        """Test parsing SRT timestamp format."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        # SRT format: 00:01:30,500
        seconds = loader._parse_timestamp('00:01:30,500')
        assert seconds == 90.5

    def test_parse_vtt_timestamp(self):
        """Test parsing VTT timestamp format."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        # VTT format: 00:01:30.500
        seconds = loader._parse_timestamp('00:01:30.500')
        assert seconds == 90.5

    def test_parse_short_timestamp(self):
        """Test parsing short timestamp format (MM:SS)."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        seconds = loader._parse_timestamp('01:30.500')
        assert seconds == 90.5


class TestMetadataExtraction:
    """Test metadata extraction from filenames."""

    def test_extract_video_id_from_youtube_format(self):
        """Test extracting video ID from YouTube-style filename."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        # Common YouTube transcript filename patterns
        assert loader._extract_video_id_from_filename('6jvskRWvQkg.txt') == '6jvskRWvQkg'
        assert loader._extract_video_id_from_filename('transcript_6jvskRWvQkg.json') == '6jvskRWvQkg'
        assert loader._extract_video_id_from_filename('6jvskRWvQkg_hebrew.srt') == '6jvskRWvQkg'

    def test_extract_video_id_from_generic_filename(self):
        """Test video ID from generic filename."""
        from transcript_file_loader import TranscriptFileLoader

        loader = TranscriptFileLoader()

        assert loader._extract_video_id_from_filename('episode_one.txt') == 'episode_one'
        assert loader._extract_video_id_from_filename('my podcast.txt') == 'my_podcast'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
