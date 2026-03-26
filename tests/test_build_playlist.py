from pathlib import Path

from tools.build_playlist import load_ignore_file, normalize_extensions, should_skip


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
