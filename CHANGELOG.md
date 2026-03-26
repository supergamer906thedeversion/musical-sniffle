# Changelog

## 2026-03-26

### Added
- Playlist diagnostics modal with malformed line, warning, and duplicate reporting.
- Drag-and-drop `playlist.txt` loading.
- Table/List/Grid view switching.
- Queue panel (Up Next), repeat mode switcher, multi-select, and bulk actions.
- Pinned folders (right-click folder row to pin/unpin).
- Recently added filter mode.
- Debounced search and large-list render cap for better big-library responsiveness.
- Extended `tools/build_playlist.py` with:
  - configurable extension support (`--extension`, `--extensions`)
  - `--dry-run`
  - `--report` JSON output
  - `--json-output` playlist export
- Tests for playlist parsing and builder path-ignore logic.
- GitHub issue templates and lightweight CI checks.

### Changed
- Replaced playlist-derived `innerHTML` rendering with DOM-node creation / `textContent`.
- Improved playlist parsing validation and duplicate diagnostics.
- Refreshed project messaging around offline-first + static hosting.
