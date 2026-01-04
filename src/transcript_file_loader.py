"""
Transcript File Loader for Where2Eat.

Loads transcript files from disk in various formats:
- .txt - Plain text transcripts
- .json - JSON format (YouTube API format or custom)
- .srt - SubRip subtitle format
- .vtt - WebVTT subtitle format

This allows manual upload of transcripts when the YouTube API
rate limits or blocks automatic fetching.
"""

import os
import re
import json
from typing import Dict, List, Optional, Any


class TranscriptFileLoader:
    """
    Load transcript files from disk in various formats.

    Supported formats:
    - .txt: Plain text (full transcript as single block)
    - .json: JSON with 'transcript' field or 'segments' array
    - .srt: SubRip subtitle format
    - .vtt: WebVTT subtitle format
    """

    SUPPORTED_FORMATS = ['.txt', '.json', '.srt', '.vtt']

    def __init__(self):
        """Initialize the transcript file loader."""
        pass

    def load_file(
        self,
        file_path: str,
        video_id: Optional[str] = None,
        language: str = 'he',
        title: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Load a transcript file and return standardized transcript data.

        Args:
            file_path: Path to the transcript file
            video_id: Optional video ID (extracted from filename if not provided)
            language: Language code (default: 'he')
            title: Optional episode title

        Returns:
            Dict with keys:
                - success: bool
                - transcript: str (full text)
                - segments: List[Dict] (timestamped segments if available)
                - video_id: str
                - language: str
                - title: str (optional)
                - source_file: str
                - error: str (if success is False)
        """
        # Check if file exists
        if not os.path.exists(file_path):
            return {
                'success': False,
                'error': f'File not found: {file_path}',
                'source_file': file_path
            }

        # Check file extension
        ext = os.path.splitext(file_path)[1].lower()
        if ext not in self.SUPPORTED_FORMATS:
            return {
                'success': False,
                'error': f'Unsupported file format: {ext}. Supported: {", ".join(self.SUPPORTED_FORMATS)}',
                'source_file': file_path
            }

        # Generate video_id from filename if not provided
        if not video_id:
            video_id = self._extract_video_id_from_filename(os.path.basename(file_path))

        # Load based on format
        try:
            if ext == '.txt':
                result = self._load_txt_file(file_path)
            elif ext == '.json':
                result = self._load_json_file(file_path)
            elif ext == '.srt':
                result = self._load_srt_file(file_path)
            elif ext == '.vtt':
                result = self._load_vtt_file(file_path)
            else:
                return {
                    'success': False,
                    'error': f'Unsupported format: {ext}',
                    'source_file': file_path
                }

            # Check for empty content
            if not result.get('transcript', '').strip():
                return {
                    'success': False,
                    'error': 'Empty transcript file',
                    'source_file': file_path
                }

            # Merge with metadata (preserve values from file if present)
            result['success'] = True
            if 'video_id' not in result or not result['video_id']:
                result['video_id'] = video_id
            if 'language' not in result or not result['language']:
                result['language'] = language
            result['source_file'] = file_path

            if title:
                result['title'] = title

            return result

        except json.JSONDecodeError as e:
            return {
                'success': False,
                'error': f'Invalid JSON: {str(e)}',
                'source_file': file_path
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Error loading file: {str(e)}',
                'source_file': file_path
            }

    def load_folder(
        self,
        folder_path: str,
        recursive: bool = False,
        language: str = 'he'
    ) -> List[Dict[str, Any]]:
        """
        Load all transcript files from a folder.

        Args:
            folder_path: Path to folder containing transcript files
            recursive: Whether to search subdirectories
            language: Default language for all files

        Returns:
            List of transcript data dicts (same format as load_file)

        Raises:
            FileNotFoundError: If folder doesn't exist
        """
        if not os.path.exists(folder_path):
            raise FileNotFoundError(f'Folder not found: {folder_path}')

        if not os.path.isdir(folder_path):
            raise FileNotFoundError(f'Not a directory: {folder_path}')

        results = []

        if recursive:
            for root, dirs, files in os.walk(folder_path):
                for filename in files:
                    if self._is_supported_file(filename):
                        file_path = os.path.join(root, filename)
                        result = self.load_file(file_path, language=language)
                        if result['success']:
                            results.append(result)
        else:
            for filename in os.listdir(folder_path):
                if self._is_supported_file(filename):
                    file_path = os.path.join(folder_path, filename)
                    if os.path.isfile(file_path):
                        result = self.load_file(file_path, language=language)
                        if result['success']:
                            results.append(result)

        return results

    def _is_supported_file(self, filename: str) -> bool:
        """Check if a filename has a supported extension."""
        ext = os.path.splitext(filename)[1].lower()
        return ext in self.SUPPORTED_FORMATS

    def _load_txt_file(self, file_path: str) -> Dict[str, Any]:
        """Load plain text transcript file."""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        return {
            'transcript': content,
            'segments': []
        }

    def _load_json_file(self, file_path: str) -> Dict[str, Any]:
        """Load JSON format transcript file."""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Handle array format (YouTube API style)
        if isinstance(data, list):
            segments = data
            transcript = ' '.join(seg.get('text', '') for seg in segments)
            return {
                'transcript': transcript,
                'segments': segments
            }

        # Handle object format
        if isinstance(data, dict):
            result = {}

            # Check for segments array
            if 'segments' in data:
                segments = data['segments']
                transcript = ' '.join(seg.get('text', '') for seg in segments)
                result['segments'] = segments
                result['transcript'] = data.get('transcript', transcript)
            elif 'transcript' in data:
                result['transcript'] = data['transcript']
                result['segments'] = []
            else:
                # Try to use any 'text' field
                result['transcript'] = data.get('text', '')
                result['segments'] = []

            # Preserve other metadata from JSON
            for key in ['video_id', 'language', 'title', 'video_url']:
                if key in data:
                    result[key] = data[key]

            return result

        return {
            'transcript': str(data),
            'segments': []
        }

    def _load_srt_file(self, file_path: str) -> Dict[str, Any]:
        """Load SRT subtitle file."""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        segments = []
        transcript_parts = []

        # SRT format:
        # 1
        # 00:00:00,000 --> 00:00:03,000
        # Text line 1
        # Text line 2
        #
        # 2
        # ...

        blocks = re.split(r'\n\s*\n', content.strip())

        for block in blocks:
            lines = block.strip().split('\n')
            if len(lines) >= 3:
                # First line is sequence number
                # Second line is timestamp
                # Rest is text
                timestamp_line = lines[1]
                text_lines = lines[2:]

                # Parse timestamps
                match = re.match(
                    r'(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})',
                    timestamp_line
                )

                if match:
                    start_time = self._parse_timestamp(match.group(1))
                    end_time = self._parse_timestamp(match.group(2))
                    text = ' '.join(text_lines)

                    segments.append({
                        'text': text,
                        'start': start_time,
                        'duration': end_time - start_time
                    })
                    transcript_parts.append(text)

        return {
            'transcript': ' '.join(transcript_parts),
            'segments': segments
        }

    def _load_vtt_file(self, file_path: str) -> Dict[str, Any]:
        """Load WebVTT subtitle file."""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        segments = []
        transcript_parts = []

        # Remove WEBVTT header and any metadata
        lines = content.split('\n')
        start_idx = 0
        for i, line in enumerate(lines):
            if line.strip() == 'WEBVTT' or line.startswith('NOTE') or line.startswith('STYLE'):
                start_idx = i + 1
                continue
            if line.strip() and '-->' in line:
                start_idx = i
                break
            if line.strip() and not line.startswith('WEBVTT'):
                break

        content = '\n'.join(lines[start_idx:])
        blocks = re.split(r'\n\s*\n', content.strip())

        for block in blocks:
            lines = block.strip().split('\n')
            if not lines:
                continue

            # Find timestamp line
            timestamp_line = None
            text_start = 0

            for i, line in enumerate(lines):
                if '-->' in line:
                    timestamp_line = line
                    text_start = i + 1
                    break

            if timestamp_line and text_start < len(lines):
                text_lines = lines[text_start:]

                # Parse timestamps
                match = re.match(
                    r'(\d{2}:\d{2}:\d{2}[.,]\d{3}|\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3}|\d{2}:\d{2}[.,]\d{3})',
                    timestamp_line
                )

                if match:
                    start_time = self._parse_timestamp(match.group(1))
                    end_time = self._parse_timestamp(match.group(2))
                    text = ' '.join(line for line in text_lines if line.strip())

                    # Remove VTT formatting tags
                    text = re.sub(r'<[^>]+>', '', text)

                    if text.strip():
                        segments.append({
                            'text': text,
                            'start': start_time,
                            'duration': end_time - start_time
                        })
                        transcript_parts.append(text)

        return {
            'transcript': ' '.join(transcript_parts),
            'segments': segments
        }

    def _parse_timestamp(self, timestamp: str) -> float:
        """
        Parse SRT/VTT timestamp to seconds.

        Formats:
        - SRT: 00:01:30,500
        - VTT: 00:01:30.500 or 01:30.500
        """
        # Normalize separator
        timestamp = timestamp.replace(',', '.')

        parts = timestamp.split(':')

        if len(parts) == 3:
            hours, minutes, seconds = parts
            return int(hours) * 3600 + int(minutes) * 60 + float(seconds)
        elif len(parts) == 2:
            minutes, seconds = parts
            return int(minutes) * 60 + float(seconds)
        else:
            return float(timestamp)

    def _extract_video_id_from_filename(self, filename: str) -> str:
        """
        Extract video ID from filename.

        Handles patterns like:
        - 6jvskRWvQkg.txt
        - transcript_6jvskRWvQkg.json
        - 6jvskRWvQkg_hebrew.srt
        - episode_one.txt
        """
        # Remove extension
        name = os.path.splitext(filename)[0]

        # Try to find YouTube video ID pattern (11 alphanumeric + _ + -)
        youtube_pattern = r'([a-zA-Z0-9_-]{11})'
        matches = re.findall(youtube_pattern, name)

        if matches:
            # Return the first 11-character match that looks like a YouTube ID
            for match in matches:
                # Verify it has mixed case/numbers (typical of YouTube IDs)
                if any(c.isdigit() for c in match) or any(c.isupper() for c in match):
                    return match

        # Fall back to cleaned filename
        # Replace spaces and special chars with underscore
        clean_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name)
        clean_name = re.sub(r'_+', '_', clean_name)
        clean_name = clean_name.strip('_')

        return clean_name if clean_name else 'unknown'
