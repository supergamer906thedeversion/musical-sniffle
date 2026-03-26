#!/usr/bin/env python3
"""
Build playlist.txt for Media Horde AMP.

Usage:
    python tools/build_playlist.py
    python tools/build_playlist.py --root . --output playlist.txt
    python tools/build_playlist.py --exclude covers --exclude temp
"""

from __future__ import annotations

import argparse
from pathlib import Path

SUPPORTED_EXTENSIONS = {
    ".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".opus",
    ".mp4", ".webm", ".mov", ".mkv", ".m4v",
    ".html", ".htm",
}

DEFAULT_EXCLUDES = {
    ".git",
    "__pycache__",
    "assets",
    "tools",
    "node_modules",
    ".venv",
    "venv",
}


def should_skip(path: Path, root: Path, excludes: set[str]) -> bool:
    try:
        relative_parts = path.relative_to(root).parts
    except ValueError:
        return True
    return any(part in excludes for part in relative_parts)


def discover_media(root: Path, excludes: set[str]) -> list[Path]:
    results: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if should_skip(path, root, excludes):
            continue
        if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        results.append(path)
    return sorted(results, key=lambda p: str(p.relative_to(root)).lower())


def human_size(num_bytes: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(num_bytes)
    unit_index = 0
    while size >= 1024 and unit_index < len(units) - 1:
        size /= 1024
        unit_index += 1
    if unit_index == 0 or size >= 10:
        return f"{size:.0f} {units[unit_index]}"
    return f"{size:.1f} {units[unit_index]}"


def build_entry(file_path: Path, root: Path, include_size: bool) -> str:
    relative = file_path.relative_to(root).as_posix()
    if not include_size:
        return relative

    size_text = human_size(file_path.stat().st_size)
    return f"{relative} | size={size_text}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate playlist.txt for Media Horde AMP.")
    parser.add_argument("--root", default=".", help="Library root to scan. Default: current directory")
    parser.add_argument("--output", default="playlist.txt", help="Output playlist file. Default: playlist.txt")
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        help="Extra folder name to exclude. Can be used multiple times."
    )
    parser.add_argument(
        "--no-size",
        action="store_true",
        help="Do not include size= metadata in playlist entries."
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()
    output = Path(args.output).resolve()
    excludes = DEFAULT_EXCLUDES | set(args.exclude)

    media_files = discover_media(root, excludes)

    lines = [
        "# Media Horde AMP playlist",
        "# One path per line, relative to the folder that contains index.html and playlist.txt",
        "# Optional metadata example:",
        "# music/song.mp3 | title=Custom Title | art=covers/song.jpg | size=3.5 MB",
        "",
    ]

    written = 0
    for file_path in media_files:
        relative = file_path.relative_to(root).as_posix()
        if relative == output.name or relative == "index.html":
            continue
        lines.append(build_entry(file_path, root, include_size=not args.no_size))
        written += 1

    output.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {written} entries to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
