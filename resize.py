#!/usr/bin/env python3
"""
resize.py
Rewrites images in place to a maximum dimension of 1600px wide, JPEG quality 80,
optimizing file sizes for fast mobile performance without quality loss.
"""
import os
import sys
from PIL import Image

MAX_WIDTH = 1600
QUALITY = 80
TARGET_DIRS = ['images', os.path.join('videos', 'posters')]

def process_image(filepath):
    try:
        with Image.open(filepath) as img:
            w, h = img.size
            if w > MAX_WIDTH:
                new_h = int(h * (MAX_WIDTH / float(w)))
                img = img.resize((MAX_WIDTH, new_h), Image.Resampling.LANCZOS)
                img.save(filepath, format='JPEG', quality=QUALITY, optimize=True)
                print(f"[RESIZED] {filepath}: {w}x{h} -> {MAX_WIDTH}x{new_h}")
            else:
                print(f"[OK] {filepath}: already {w}x{h}")
    except Exception as e:
        print(f"[ERROR] {filepath}: {e}", file=sys.stderr)

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    for d in TARGET_DIRS:
        full_dir = os.path.join(base_dir, d)
        if not os.path.isdir(full_dir):
            continue
        for fname in os.listdir(full_dir):
            if fname.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                process_image(os.path.join(full_dir, fname))

if __name__ == '__main__':
    main()
