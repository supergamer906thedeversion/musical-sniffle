#!/usr/bin/env python3
"""Build playlist.txt (and optional JSON/report output) for Media Horde AMP."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

DEFAULT_EXTENSIONS = {
    ".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".opus",
    ".mp4", ".webm", ".mov", ".mkv", ".m4v",
    ".html", ".htm",
}

DEFAULT_EXCLUDES = {".git", "__pycache__", "node_modules", ".venv", "venv"}


def normalize_extensions(extensions: list[str] | None) -> set[str]:
    if not extensions:
        return set(DEFAULT_EXTENSIONS)
    cleaned = set()
    for ext in extensions:
        ext = ext.strip().lower()
        if not ext:
            continue
        cleaned.add(ext if ext.startswith(".") else f".{ext}")
    return cleaned or set(DEFAULT_EXTENSIONS)


def should_skip(path: Path, root: Path, excludes: set[str]) -> bool:
    try:
        relative_parts = path.relative_to(root).parts
    except ValueError:
        return True
    return any(part in excludes for part in relative_parts)


def load_ignore_file(ignore_file: Path) -> set[str]:
    if not ignore_file.is_file():
        return set()
    entries: set[str] = set()
    for raw_line in ignore_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if line and not line.startswith("#"):
            entries.add(line.strip("/\\"))
    return entries


def discover_media(root: Path, excludes: set[str], extensions: set[str]) -> list[Path]:
    results: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file() or should_skip(path, root, excludes):
            continue
        if path.suffix.lower() in extensions:
            results.append(path)
    return sorted(results, key=lambda p: str(p.relative_to(root)).lower())


def human_size(num_bytes: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(num_bytes)
    unit_index = 0
    while size >= 1024 and unit_index < len(units) - 1:
        size /= 1024
        unit_index += 1
    return f"{size:.0f} {units[unit_index]}" if unit_index == 0 or size >= 10 else f"{size:.1f} {units[unit_index]}"


def build_entry(file_path: Path, playlist_dir: Path, include_size: bool) -> str:
    relative = Path(os.path.relpath(file_path, playlist_dir)).as_posix()
    return f"{relative} | size={human_size(file_path.stat().st_size)}" if include_size else relative


def build_report(media_files: list[Path], root: Path, excludes: set[str], extensions: set[str]) -> dict:
    by_ext: dict[str, int] = {}
    total_bytes = 0
    for path in media_files:
        by_ext[path.suffix.lower()] = by_ext.get(path.suffix.lower(), 0) + 1
        total_bytes += path.stat().st_size
    return {
        "scan_root": str(root),
        "count": len(media_files),
        "total_bytes": total_bytes,
        "total_size_human": human_size(total_bytes) if total_bytes else "0 B",
        "extensions": dict(sorted(by_ext.items())),
        "excludes": sorted(excludes),
        "supported_extensions": sorted(extensions),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate playlist.txt for Media Horde AMP.")
    parser.add_argument("--scan-root", "--root", dest="scan_root", default=".")
    parser.add_argument("--output", default="playlist.txt")
    parser.add_argument("--paths-relative-to", default=None)
    parser.add_argument("--ignore-file", default=".mediahordeignore")
    parser.add_argument("--exclude", action="append", default=[])
    parser.add_argument("--extension", action="append", default=[], help="Allowed extension, repeatable (e.g. --extension .mp3)")
    parser.add_argument("--extensions", default="", help="Comma-separated allowed extensions.")
    parser.add_argument("--no-size", action="store_true")
    parser.add_argument("--dry-run", action="store_true", help="Preview output without writing playlist file.")
    parser.add_argument("--report", default="", help="Write scan report JSON to this path.")
    parser.add_argument("--json-output", default="", help="Write playlist entries to JSON in addition to text output.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    scan_root = Path(args.scan_root).resolve()
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    playlist_dir = Path(args.paths_relative_to).resolve() if args.paths_relative_to else output.parent.resolve()

    ignore_file = Path(args.ignore_file)
    if not ignore_file.is_absolute():
        ignore_file = scan_root / ignore_file

    raw_extensions = list(args.extension)
    if args.extensions:
        raw_extensions.extend([piece.strip() for piece in args.extensions.split(",") if piece.strip()])
    supported_extensions = normalize_extensions(raw_extensions)
    excludes = DEFAULT_EXCLUDES | load_ignore_file(ignore_file) | set(args.exclude)

    media_files = discover_media(scan_root, excludes, supported_extensions)
    output_target = output.resolve()
    index_target = (playlist_dir / "index.html").resolve()

    lines = [
        "# Media Horde AMP playlist",
        "# One path per line, relative to the folder that contains index.html and playlist.txt",
        "# Optional metadata example:",
        "# music/song.mp3 | title=Custom Title | art=covers/song.jpg | size=3.5 MB",
        "",
    ]

    entries = []
    written = 0
    for file_path in media_files:
        resolved_path = file_path.resolve()
        if resolved_path == output_target or resolved_path == index_target:
            continue
        entry = build_entry(file_path, playlist_dir, include_size=not args.no_size)
        entries.append(entry)
        lines.append(entry)
        written += 1

    if args.dry_run:
        print(f"Dry run: would write {written} entries to {output}")
    else:
        output.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"Wrote {written} entries to {output}")

    if args.json_output:
        json_target = Path(args.json_output).resolve()
        json_target.parent.mkdir(parents=True, exist_ok=True)
        json_target.write_text(json.dumps({"entries": entries}, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote JSON playlist to {json_target}")

    report = build_report(media_files, scan_root, excludes, supported_extensions)
    if args.report:
        report_target = Path(args.report).resolve()
        report_target.parent.mkdir(parents=True, exist_ok=True)
        report_target.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote report to {report_target}")
    else:
        print(f"Report: {json.dumps(report)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
