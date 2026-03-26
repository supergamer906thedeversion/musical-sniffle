from pathlib import Path
import json
import subprocess
import sys

from tools.build_playlist import build_entry, build_report, human_size, load_ignore_file, normalize_extensions, should_skip


def test_normalize_extensions_defaults():
    exts = normalize_extensions([])
    assert ".mp3" in exts
    assert ".mp4" in exts


def test_normalize_extensions_custom_values():
    exts = normalize_extensions(["mp3", ".MKV", " "])
    assert exts == {".mp3", ".mkv"}


def test_load_ignore_file(tmp_path: Path):
    ignore = tmp_path / ".mediahordeignore"
    ignore.write_text("# comment\ntemp\n/cache\n\n", encoding="utf-8")
    entries = load_ignore_file(ignore)
    assert entries == {"temp", "cache"}


def test_should_skip_folder(tmp_path: Path):
    root = tmp_path
    path = root / "music" / "track.mp3"
    path.parent.mkdir()
    path.write_text("x", encoding="utf-8")
    assert not should_skip(path, root, {"node_modules"})
    assert should_skip(path, root, {"music"})


def test_build_entry_includes_added_and_size(tmp_path: Path):
    media = tmp_path / "song.mp3"
    media.write_bytes(b"x" * 1536)
    entry = build_entry(media, tmp_path, include_size=True)
    assert "size=1.5 KB" in entry
    assert "| added=" in entry


def test_human_size_edge_cases():
    assert human_size(0) == "0 B"
    assert human_size(1024) == "1.0 KB"
    assert human_size(10 * 1024) == "10 KB"


def test_build_report_structure(tmp_path: Path):
    media = tmp_path / "a.mp3"
    media.write_bytes(b"abc")
    report = build_report([media], tmp_path, {"temp"}, {".mp3"})
    payload = json.dumps(report)
    assert '"count": 1' in payload
    assert report["extensions"][".mp3"] == 1


def test_nested_exclusion_behavior(tmp_path: Path):
    root = tmp_path
    target = root / "nested" / "ignoreme" / "a.mp3"
    target.parent.mkdir(parents=True)
    target.write_text("x", encoding="utf-8")
    assert should_skip(target, root, {"ignoreme"})


def test_cli_dry_run_report_and_json_output(tmp_path: Path):
    scan_root = tmp_path / "lib"
    scan_root.mkdir()
    (scan_root / "track.mp3").write_bytes(b"x" * 2048)
    out_playlist = tmp_path / "playlist.txt"
    out_json = tmp_path / "playlist.json"
    out_report = tmp_path / "report.json"

    result = subprocess.run(
        [
            sys.executable,
            "tools/build_playlist.py",
            "--scan-root",
            str(scan_root),
            "--output",
            str(out_playlist),
            "--dry-run",
            "--json-output",
            str(out_json),
            "--report",
            str(out_report),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    assert "Dry run: would write 1 entries" in result.stdout
    assert not out_playlist.exists()
    assert out_json.exists()
    assert out_report.exists()
