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
    viewMode: "table",
    favorites: {},
    recentMap: {},
    pinnedFolders: {},
    multiSelected: {},
    queue: [],
    repeatMode: "off",
    playlistDiagnostics: { errors: [], warnings: [], duplicateEntries: [] },
    volume: config.defaultVolume,
    player: null
  };

  const elements = {
    searchInput: document.getElementById("searchInput"),
    sortSelect: document.getElementById("sortSelect"),
    folderList: document.getElementById("folderList"),
    playlistBody: document.getElementById("playlistBody"),
    playlistTableWrap: document.getElementById("playlistTableWrap"),
    listContainer: document.getElementById("listContainer"),
    gridContainer: document.getElementById("gridContainer"),
    renderNotice: document.getElementById("renderNotice"),
    reloadPlaylistBtn: document.getElementById("reloadPlaylistBtn"),
    downloadSelectedBtn: document.getElementById("downloadSelectedBtn"),
    clearSearchBtn: document.getElementById("clearSearchBtn"),
    clearRecentsBtn: document.getElementById("clearRecentsBtn"),
    clearFavoritesBtn: document.getElementById("clearFavoritesBtn"),
    playlistFileInput: document.getElementById("playlistFileInput"),
    openSelectedBtn: document.getElementById("openSelectedBtn"),
    playFirstVisibleBtn: document.getElementById("playFirstVisibleBtn"),
    shuffleVisibleBtn: document.getElementById("shuffleVisibleBtn"),
    repeatModeBtn: document.getElementById("repeatModeBtn"),
    clearSelectionBtn: document.getElementById("clearSelectionBtn"),
    bulkQueueBtn: document.getElementById("bulkQueueBtn"),
    bulkFavoriteBtn: document.getElementById("bulkFavoriteBtn"),
    queueList: document.getElementById("queueList"),
    queueCount: document.getElementById("queueCount"),
    clearQueueBtn: document.getElementById("clearQueueBtn"),
    multiCount: document.getElementById("multiCount"),
    diagnosticsBtn: document.getElementById("diagnosticsBtn"),
    diagnosticsModal: document.getElementById("diagnosticsModal"),
    closeDiagnosticsBtn: document.getElementById("closeDiagnosticsBtn"),
    diagSummary: document.getElementById("diagSummary"),
    diagList: document.getElementById("diagList"),
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
  Object.assign(state, {
    favorites: persisted.favorites || {},
    recentMap: persisted.recentMap || {},
    pinnedFolders: persisted.pinnedFolders || {},
    multiSelected: persisted.multiSelected || {},
    queue: Array.isArray(persisted.queue) ? persisted.queue : [],
    volume: typeof persisted.volume === "number" ? persisted.volume : config.defaultVolume,
    filter: persisted.uiPrefs?.filter || "all",
    folderFilter: persisted.uiPrefs?.folderFilter || "all",
    searchQuery: persisted.uiPrefs?.searchQuery || "",
    sort: persisted.uiPrefs?.sort || "playlist",
    viewMode: persisted.uiPrefs?.viewMode || "table",
    repeatMode: persisted.uiPrefs?.repeatMode || "off"
  });
  elements.volumeBar.value = String(Math.round(state.volume * 100));
  elements.searchInput.value = state.searchQuery;
  elements.sortSelect.value = state.sort;

  const appUi = ui.createUi(elements, state, { refresh, toggleFavorite, openSelected, togglePinnedFolder, queueItem, toggleSelect, removeQueueItem, clearQueue, moveQueueItem, reorderQueue });

  state.player = player.createPlayer(elements, {
    onPlaybackStateChange(isPlaying){ elements.playPauseBtn.textContent = isPlaying ? "⏸" : "▶"; },
    onTimeUpdate(currentTime, duration){
      elements.currentTime.textContent = utils.formatDuration(currentTime);
      elements.durationTime.textContent = utils.formatDuration(duration);
      elements.seekBar.value = String(Math.max(0, Math.min(1000, Math.round((duration > 0 ? currentTime / duration : 0) * 1000))));
    },
    onEnded(){
      if (state.repeatMode === "one") return openSelected();
      if (state.queue.length) {
        const next = state.queue.shift();
        state.selectedPath = next.path;
        refresh(false);
        return openSelected();
      }
      if (state.repeatMode === "all") return playRelative(1);
      return;
    }
  });
  state.player.setVolume(state.volume);

  function pruneRecentMap(){
    state.recentMap = Object.fromEntries(Object.entries(state.recentMap)
      .filter(([, value]) => Number.isFinite(value) && value > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, config.recentLimit));
  }

  function saveState(){
    pruneRecentMap();
    utils.storageSave(config.localStorageKey, {
      favorites: state.favorites,
      recentMap: state.recentMap,
      pinnedFolders: state.pinnedFolders,
      multiSelected: state.multiSelected,
      queue: state.queue.map(item => typeof item === "string" ? item : item.path).filter(Boolean),
      volume: state.volume,
      uiPrefs: {
        filter: state.filter,
        folderFilter: state.folderFilter,
        searchQuery: state.searchQuery,
        sort: state.sort,
        viewMode: state.viewMode,
        repeatMode: state.repeatMode
      }
    });
  }

  function selectedItem(){ return state.items.find(item => item.path === state.selectedPath) || null; }
  function refresh(renderFolders){ saveState(); return appUi.refresh(renderFolders); }
  function toggleFavorite(path){ state.favorites[path] = !state.favorites[path]; if (!state.favorites[path]) delete state.favorites[path]; refresh(false); }
  function toggleSelect(path){ state.multiSelected[path] ? delete state.multiSelected[path] : state.multiSelected[path] = true; refresh(false); }
  function queueItem(path){ const item = state.items.find(x => x.path === path); if (item) state.queue.push(item); refresh(false); }
  function removeQueueItem(index){ if (index < 0 || index >= state.queue.length) return; state.queue.splice(index, 1); refresh(false); }
  function clearQueue(){ state.queue = []; refresh(false); }
  function moveQueueItem(index, direction){
    const nextIndex = index + direction;
    if (index < 0 || index >= state.queue.length || nextIndex < 0 || nextIndex >= state.queue.length) return;
    const [item] = state.queue.splice(index, 1);
    state.queue.splice(nextIndex, 0, item);
    refresh(false);
  }
  function reorderQueue(from, to){
    if (from === to || from < 0 || to < 0 || from >= state.queue.length || to >= state.queue.length) return;
    const [item] = state.queue.splice(from, 1);
    state.queue.splice(to, 0, item);
    refresh(false);
  }
  function togglePinnedFolder(folder){ state.pinnedFolders[folder] ? delete state.pinnedFolders[folder] : state.pinnedFolders[folder] = true; refresh(true); }

  function markRecentlyOpened(item){ if (item?.path) state.recentMap[item.path] = Date.now(); }
  function setSelection(item){ if (item) { state.selectedPath = item.path; refresh(false); } }

  function triggerDownload(item){
    if (!item) return;
    const link = document.createElement("a");
    link.href = item.url;
    link.download = item.name || "";
    link.rel = "noopener";
    document.body.append(link);
    link.click();
    link.remove();
    appUi.setStatus(`Started download for ${item.name}.`, "Browser may open file instead.");
  }

  async function openSelected(){
    const item = selectedItem();
    if (!item) return;
    markRecentlyOpened(item);
    refresh(false);
    appUi.setTrackInfo(item, "Opening");
    try {
      await state.player.loadItem(item);
      appUi.setTrackInfo(item, item.type === "html" ? "Opened in new tab" : "Playing");
    } catch (error) {
      appUi.setStatus(`Could not open ${item.name}.`, error.message || "Playback failed.");
      appUi.setTrackInfo(item, "Error");
    }
  }

  function playFirstVisible(){ const first = appUi.getFilteredItems().find(item => ["audio", "video", "html"].includes(item.type)); if (first) { setSelection(first); openSelected(); } }
  function shuffleVisible(){ const playable = appUi.getFilteredItems().filter(item => ["audio", "video", "html"].includes(item.type)); if (playable.length) { setSelection(utils.shuffleCopy(playable)[0]); openSelected(); } }
  function playRelative(step){ const f = appUi.getFilteredItems(); if (!f.length) return; let i = f.findIndex(item => item.path === state.selectedPath); i = (i < 0 ? 0 : i); i = (i + step + f.length) % f.length; state.selectedPath = f[i].path; refresh(false); openSelected(); }

  async function tryLoadDefaultPlaylist(){
    appUi.setStatus(`Loading ${config.playlistFilename}...`, "Looking for playlist.txt next to index.html.");
    try { const result = await playlist.loadPlaylistFromUrl(config.playlistFilename); afterPlaylistLoaded(result); return true; }
    catch { appUi.setStatus(`Could not auto-load ${config.playlistFilename}.`, "Use Load playlist.txt or run a local server."); return false; }
  }

  function afterPlaylistLoaded(result){
    state.items = result.items;
    state.playlistDiagnostics = result.diagnostics || { errors: [], warnings: [], duplicateEntries: [] };
    state.queue = state.queue
      .map(entry => typeof entry === "string" ? entry : entry?.path)
      .map(path => state.items.find(item => item.path === path) || null)
      .filter(Boolean);
    state.multiSelected = Object.fromEntries(
      Object.entries(state.multiSelected).filter(([path, isSelected]) => isSelected && state.items.some(item => item.path === path))
    );
    state.folderFilter = "all";
    if (!state.items.length) return appUi.setStatus(`Loaded ${result.source}, but it was empty.`, "Add relative paths to playlist.txt.");
    if (!state.selectedPath || !state.items.some(item => item.path === state.selectedPath)) state.selectedPath = state.items[0].path;
    refresh(true);
    const diag = state.playlistDiagnostics;
    const right = diag.errors.length
      ? `${diag.errors.length} error(s), ${diag.warnings.length} warning(s). Open diagnostics panel.`
      : "Double-click a row, press Enter, or download selected.";
    appUi.setStatus(`Loaded ${state.items.length} item(s) from ${result.source}.`, right);
  }

  function bindEvents(){
    document.querySelectorAll(".filter-btn").forEach(button => button.addEventListener("click", () => { state.filter = button.dataset.filter; refresh(false); }));
    document.querySelectorAll(".view-btn").forEach(button => button.addEventListener("click", () => { state.viewMode = button.dataset.view; refresh(false); }));
    const debouncedSearch = utils.debounce(value => { state.searchQuery = value; refresh(false); }, config.searchDebounceMs);
    elements.searchInput.addEventListener("input", event => debouncedSearch(event.target.value || ""));
    elements.sortSelect.addEventListener("change", event => { state.sort = event.target.value || "playlist"; refresh(false); });
    elements.reloadPlaylistBtn.addEventListener("click", async () => tryLoadDefaultPlaylist());
    elements.downloadSelectedBtn.addEventListener("click", () => triggerDownload(selectedItem()));

    elements.playlistFileInput.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      afterPlaylistLoaded(await playlist.loadPlaylistFromFile(file));
      event.target.value = "";
    });

    ["dragenter", "dragover"].forEach(type => window.addEventListener(type, event => { event.preventDefault(); document.body.classList.add("drag-over"); }));
    ["dragleave", "drop"].forEach(type => window.addEventListener(type, event => { event.preventDefault(); document.body.classList.remove("drag-over"); }));
    window.addEventListener("drop", async event => {
      const file = Array.from(event.dataTransfer?.files || []).find(f => /playlist\.txt$/i.test(f.name));
      if (!file) return appUi.setStatus("Drop ignored.", "Drag and drop a playlist.txt file.");
      afterPlaylistLoaded(await playlist.loadPlaylistFromFile(file));
    });

    elements.clearSearchBtn.addEventListener("click", () => { state.searchQuery = ""; elements.searchInput.value = ""; refresh(false); });
    elements.clearRecentsBtn.addEventListener("click", () => { state.recentMap = {}; refresh(false); });
    elements.clearFavoritesBtn.addEventListener("click", () => { state.favorites = {}; refresh(false); });
    elements.repeatModeBtn.addEventListener("click", () => { state.repeatMode = state.repeatMode === "off" ? "one" : (state.repeatMode === "one" ? "all" : "off"); refresh(false); });
    elements.clearSelectionBtn.addEventListener("click", () => { state.multiSelected = {}; refresh(false); });
    elements.clearQueueBtn.addEventListener("click", () => clearQueue());
    elements.bulkQueueBtn.addEventListener("click", () => { Object.keys(state.multiSelected).forEach(path => queueItem(path)); });
    elements.bulkFavoriteBtn.addEventListener("click", () => { Object.keys(state.multiSelected).forEach(path => state.favorites[path] = true); refresh(false); });
    elements.diagnosticsBtn.addEventListener("click", () => elements.diagnosticsModal.showModal());
    elements.closeDiagnosticsBtn.addEventListener("click", () => elements.diagnosticsModal.close());

    elements.openSelectedBtn.addEventListener("click", openSelected);
    elements.playFirstVisibleBtn.addEventListener("click", playFirstVisible);
    elements.shuffleVisibleBtn.addEventListener("click", shuffleVisible);
    elements.playPauseBtn.addEventListener("click", () => state.player.togglePlayPause(selectedItem()));
    elements.stopBtn.addEventListener("click", () => state.player.stop());
    elements.prevBtn.addEventListener("click", () => playRelative(-1));
    elements.nextBtn.addEventListener("click", () => playRelative(1));
    elements.seekBar.addEventListener("input", event => state.player.seekTo(Number(event.target.value || 0) / 1000));
    elements.volumeBar.addEventListener("input", event => { state.volume = Math.max(0, Math.min(1, Number(event.target.value || 0) / 100)); state.player.setVolume(state.volume); saveState(); });

    window.addEventListener("keydown", event => {
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(event.target?.tagName) || event.target?.isContentEditable;
      if (typing) return;
      if (event.key === "ArrowDown") { event.preventDefault(); appUi.moveSelection(1); }
      else if (event.key === "ArrowUp") { event.preventDefault(); appUi.moveSelection(-1); }
      else if (event.key === "Enter") { event.preventDefault(); openSelected(); }
      else if (event.key === " ") { event.preventDefault(); state.player.togglePlayPause(selectedItem()); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { event.preventDefault(); triggerDownload(selectedItem()); }
      else if (event.key === "/") { event.preventDefault(); elements.searchInput.focus(); }
      else if (event.key === "Escape") { state.searchQuery = ""; elements.searchInput.value = ""; refresh(false); }
    });
  }

  appUi.bindQueueControls({ removeQueueItem, moveQueueItem, reorderQueue });
  bindEvents();
  refresh(true);
  tryLoadDefaultPlaylist();
})(window.MediaHorde);
