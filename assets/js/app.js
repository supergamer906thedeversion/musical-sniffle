window.MediaHorde = window.MediaHorde || {};

(function(ns){
  const { config, utils, playlist, player, ui } = ns;

  const state = {
    items: [],
    selectedPath: "",
    filter: "all",
    folderFilter: "all",
    searchQuery: "",
    sort: "playlist",
    favorites: {},
    recentMap: {},
    volume: config.defaultVolume,
    player: null
  };

  const elements = {
    searchInput: document.getElementById("searchInput"),
    sortSelect: document.getElementById("sortSelect"),
    folderList: document.getElementById("folderList"),
    playlistBody: document.getElementById("playlistBody"),
    reloadPlaylistBtn: document.getElementById("reloadPlaylistBtn"),
    downloadSelectedBtn: document.getElementById("downloadSelectedBtn"),
    playlistFileInput: document.getElementById("playlistFileInput"),
    openSelectedBtn: document.getElementById("openSelectedBtn"),
    playFirstVisibleBtn: document.getElementById("playFirstVisibleBtn"),
    shuffleVisibleBtn: document.getElementById("shuffleVisibleBtn"),
    playPauseBtn: document.getElementById("playPauseBtn"),
    stopBtn: document.getElementById("stopBtn"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    seekBar: document.getElementById("seekBar"),
    volumeBar: document.getElementById("volumeBar"),
    currentTime: document.getElementById("currentTime"),
    durationTime: document.getElementById("durationTime"),
    statusLeft: document.getElementById("statusLeft"),
    statusRight: document.getElementById("statusRight"),
    trackName: document.getElementById("trackName"),
    trackMeta: document.getElementById("trackMeta"),
    statVisible: document.getElementById("statVisible"),
    statAudio: document.getElementById("statAudio"),
    statVideo: document.getElementById("statVideo"),
    statHtml: document.getElementById("statHtml"),
    statFavorites: document.getElementById("statFavorites"),
    statSize: document.getElementById("statSize"),
    libraryBlurb: document.getElementById("libraryBlurb"),
    meters: document.getElementById("meters"),
    screen: document.getElementById("screen"),
    visualizer: document.getElementById("visualizer"),
    audioEl: document.getElementById("audioEl"),
    videoEl: document.getElementById("videoEl"),
    artEl: document.getElementById("artEl"),
    artFallback: document.getElementById("artFallback"),
    artFallbackType: document.getElementById("artFallbackType"),
    artFallbackTitle: document.getElementById("artFallbackTitle"),
    artFallbackFolder: document.getElementById("artFallbackFolder"),
    artFallbackBadge: document.getElementById("artFallbackBadge"),
    emptyOverlay: document.getElementById("emptyOverlay")
  };

  const persisted = utils.storageLoad(config.localStorageKey);
  state.favorites = persisted.favorites || {};
  state.recentMap = persisted.recentMap || {};
  state.volume = typeof persisted.volume === "number" ? persisted.volume : config.defaultVolume;
  elements.volumeBar.value = String(Math.round(state.volume * 100));

  const appUi = ui.createUi(elements, state, {
    refresh,
    toggleFavorite,
    openSelected
  });

  state.player = player.createPlayer(elements, {
    onPlaybackStateChange(isPlaying){
      elements.playPauseBtn.textContent = isPlaying ? "⏸" : "▶";
    },
    onTimeUpdate(currentTime, duration){
      elements.currentTime.textContent = utils.formatDuration(currentTime);
      elements.durationTime.textContent = utils.formatDuration(duration);
      const ratio = duration > 0 ? currentTime / duration : 0;
      elements.seekBar.value = String(Math.max(0, Math.min(1000, Math.round(ratio * 1000))));
    },
    onEnded(){
      playRelative(1);
    }
  });
  state.player.setVolume(state.volume);

  function pruneRecentMap(){
    const entries = Object.entries(state.recentMap)
      .filter(([, value]) => Number.isFinite(value) && value > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, config.recentLimit);

    state.recentMap = Object.fromEntries(entries);
  }

  function saveState(){
    pruneRecentMap();
    utils.storageSave(config.localStorageKey, {
      favorites: state.favorites,
      recentMap: state.recentMap,
      volume: state.volume
    });
  }

  function selectedItem(){
    return state.items.find(item => item.path === state.selectedPath) || null;
  }

  function refresh(renderFolders){
    return appUi.refresh(renderFolders);
  }

  function toggleFavorite(path){
    state.favorites[path] = !state.favorites[path];
    if (!state.favorites[path]) delete state.favorites[path];
    saveState();
    refresh(false);
  }

  function markRecentlyOpened(item){
    if (!item?.path) return;
    state.recentMap[item.path] = Date.now();
    saveState();
  }

  function setSelection(item){
    if (!item) return;
    state.selectedPath = item.path;
    refresh(false);
  }

  function triggerDownload(item){
    if (!item) return;
    const link = document.createElement("a");
    link.href = item.url;
    link.download = item.name || "";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    appUi.setStatus(`Started download for ${item.name}.`, "If the browser ignores download mode, it will open the file instead.");
  }

  async function openSelected(){
    const item = selectedItem();
    if (!item) return;
    markRecentlyOpened(item);
    refresh(false);
    appUi.setTrackInfo(item, "Opening");
    try {
      await state.player.loadItem(item);
      if (item.type === "html") {
        appUi.setTrackInfo(item, "Opened in new tab");
      } else {
        appUi.setTrackInfo(item, "Playing");
      }
    } catch (error) {
      appUi.setStatus(`Could not open ${item.name}.`, error.message || "Playback failed.");
      appUi.setTrackInfo(item, "Error");
    }
  }

  function playFirstVisible(){
    const filtered = appUi.getFilteredItems();
    const firstPlayable = filtered.find(item => item.type === "audio" || item.type === "video" || item.type === "html");
    if (!firstPlayable) {
      appUi.setStatus("No visible items to play.", "Check your playlist or filters.");
      return;
    }
    setSelection(firstPlayable);
    openSelected();
  }

  function shuffleVisible(){
    const filtered = appUi.getFilteredItems();
    const playable = filtered.filter(item => item.type === "audio" || item.type === "video" || item.type === "html");
    if (!playable.length) {
      appUi.setStatus("Nothing visible to shuffle.", "Your library is being very dramatic.");
      return;
    }
    const picked = utils.shuffleCopy(playable)[0];
    setSelection(picked);
    openSelected();
  }

  function playRelative(step){
    const filtered = appUi.getFilteredItems();
    if (!filtered.length) return;
    let index = filtered.findIndex(item => item.path === state.selectedPath);
    if (index === -1) index = 0;
    index = (index + step + filtered.length) % filtered.length;
    state.selectedPath = filtered[index].path;
    refresh(false);
    openSelected();
  }

  async function tryLoadDefaultPlaylist(){
    appUi.setStatus(`Loading ${config.playlistFilename}...`, "Looking for playlist.txt next to index.html.");
    try {
      const result = await playlist.loadPlaylistFromUrl(config.playlistFilename);
      state.items = result.items;
      afterPlaylistLoaded(result.source);
      return true;
    } catch (error) {
      appUi.setStatus(
        `Could not auto-load ${config.playlistFilename}.`,
        "Use the Load playlist.txt button or run a local server if you're opening the file directly."
      );
      return false;
    }
  }

  function afterPlaylistLoaded(sourceLabel){
    refresh(true);

    if (!state.items.length) {
      appUi.setStatus(`Loaded ${sourceLabel}, but it was empty.`, "Add relative paths to playlist.txt.");
      appUi.setTrackInfo(null, "Playlist loaded, zero entries found.");
      return;
    }

    if (!state.selectedPath || !state.items.some(item => item.path === state.selectedPath)) {
      state.selectedPath = state.items[0].path;
    }

    refresh(true);
    const current = selectedItem();
    if (current) appUi.setTrackInfo(current, "Selected");
    appUi.setStatus(`Loaded ${state.items.length} item(s) from ${sourceLabel}.`, "Double-click a row, press Enter, or download the selected file.");
  }

  function bindEvents(){
    document.querySelectorAll(".filter-btn").forEach(button => {
      button.addEventListener("click", () => {
        state.filter = button.dataset.filter;
        refresh(false);
      });
    });

    elements.searchInput.addEventListener("input", event => {
      state.searchQuery = event.target.value || "";
      refresh(false);
    });

    elements.sortSelect.addEventListener("change", event => {
      state.sort = event.target.value || "playlist";
      refresh(false);
    });

    elements.reloadPlaylistBtn.addEventListener("click", async () => {
      await tryLoadDefaultPlaylist();
    });

    elements.downloadSelectedBtn.addEventListener("click", () => {
      const item = selectedItem();
      if (!item) {
        appUi.setStatus("Nothing selected to download.", "Pick a row first.");
        return;
      }
      triggerDownload(item);
    });

    elements.playlistFileInput.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      const result = await playlist.loadPlaylistFromFile(file);
      state.items = result.items;
      state.folderFilter = "all";
      state.filter = "all";
      afterPlaylistLoaded(result.source);
      event.target.value = "";
    });

    elements.openSelectedBtn.addEventListener("click", openSelected);
    elements.playFirstVisibleBtn.addEventListener("click", playFirstVisible);
    elements.shuffleVisibleBtn.addEventListener("click", shuffleVisible);

    elements.playPauseBtn.addEventListener("click", () => {
      state.player.togglePlayPause(selectedItem());
    });

    elements.stopBtn.addEventListener("click", () => {
      state.player.stop();
    });

    elements.prevBtn.addEventListener("click", () => playRelative(-1));
    elements.nextBtn.addEventListener("click", () => playRelative(1));

    elements.seekBar.addEventListener("input", event => {
      const value = Number(event.target.value || 0) / 1000;
      state.player.seekTo(value);
    });

    elements.volumeBar.addEventListener("input", event => {
      state.volume = Math.max(0, Math.min(1, Number(event.target.value || 0) / 100));
      state.player.setVolume(state.volume);
      saveState();
    });

    window.addEventListener("keydown", event => {
      const target = event.target;
      const typing = target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      );

      if (typing) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        appUi.moveSelection(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        appUi.moveSelection(-1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        openSelected();
      } else if (event.key === " ") {
        event.preventDefault();
        state.player.togglePlayPause(selectedItem());
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        const item = selectedItem();
        if (item) triggerDownload(item);
      }
    });
  }

  bindEvents();
  refresh(true);
  tryLoadDefaultPlaylist();
})(window.MediaHorde);
