#!/usr/bin/env python3
"""Validate a reviewed extraction locally, without network or production writes."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from publication_quality import publication_issues


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('extraction', type=Path)
    parser.add_argument('--data-dir', type=Path, default=Path('data'))
    args = parser.parse_args()
    data = json.loads(args.extraction.read_text(encoding='utf-8'))
    blockers = publication_issues(data.get('restaurants', []), data.get('transcript_segments', []),
                                  data.get('episode', {}).get('video_id'), args.data_dir / 'venue_images')
    print(json.dumps({'passed': not blockers, 'blockers': blockers}, ensure_ascii=False, indent=2))
    return 1 if blockers else 0


if __name__ == '__main__':
    raise SystemExit(main())
