"""Normalize all restaurant data files to match frontend type expectations."""
import json
import glob
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
from data_normalizer import normalize_restaurant

def main():
    dirs = ['data/restaurants', 'data/restaurants_backup']
    total_changed = 0

    for dir_path in dirs:
        pattern = os.path.join(dir_path, '*.json')
        files = glob.glob(pattern)
        if not files:
            print(f"No files in {dir_path}")
            continue

        print(f"\nProcessing {dir_path}/ ({len(files)} files)")
        for filepath in sorted(files):
            with open(filepath, 'r', encoding='utf-8') as f:
                original = f.read()
                data = json.loads(original)

            normalized = normalize_restaurant(data)
            new_content = json.dumps(normalized, indent=2, ensure_ascii=False)

            if new_content != original:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"  Updated: {os.path.basename(filepath)}")
                total_changed += 1
            else:
                print(f"  No change: {os.path.basename(filepath)}")

    print(f"\nDone. {total_changed} files updated.")

if __name__ == '__main__':
    main()
