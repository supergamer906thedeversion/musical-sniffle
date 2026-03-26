window.MediaHorde = window.MediaHorde || {};

window.MediaHorde.config = {
  playlistFilename: "playlist.txt",
  localStorageKey: "media-horde-amp-state-v3",
  audioExtensions: [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".opus"],
  videoExtensions: [".mp4", ".webm", ".mov", ".mkv", ".m4v"],
  htmlExtensions: [".html", ".htm"],
  imageExtensions: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"],
  artExtensions: [".jpg", ".jpeg", ".png", ".webp"],
  excludedPaths: ["assets/", "tools/", ".git/", "__pycache__/"],
  defaultVolume: 0.85,
  recentLimit: 100,
  searchDebounceMs: 120,
  maxVisibleRows: 1500
};
