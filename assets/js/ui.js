window.MediaHorde = window.MediaHorde || {};

(function(ns){
  const { utils, config } = ns;

  function textCell(text, className){
    const td = document.createElement("td");
    if (className) td.className = className;
    td.textContent = text || "";
    return td;
  }

  function createUi(elements, state, actions){
    function setStatus(left, right){
      if (left) elements.statusLeft.textContent = left;
      if (right) elements.statusRight.textContent = right;
    }

    function setTrackInfo(item, detail){
      if (!item) {
        elements.trackName.textContent = "No item selected";
        elements.trackMeta.textContent = detail || "Load playlist.txt to begin.";
        if (elements.artFallbackBadge) elements.artFallbackBadge.classList.add("hidden");
        return;
      }

      elements.trackName.textContent = item.title || item.name;
      const parts = [item.folder, item.type];
      if (item.sizeText) parts.push(item.sizeText);
      if (state.recentMap[item.path]) parts.push("recent");
      if (detail) parts.push(detail);
      elements.trackMeta.textContent = parts.filter(Boolean).join(" • ");

      if (elements.artFallbackBadge) {
        elements.artFallbackBadge.classList.toggle("hidden", !state.recentMap[item.path]);
      }
    }

    function folderButton(labelTop, labelBottomLeft, labelBottomRight, active, onClick, pinTarget){
      const button = document.createElement("button");
      button.className = `folder-btn ${active ? "active" : ""}`;
      button.type = "button";

      const title = document.createElement("div");
      title.textContent = labelTop;
      const small = document.createElement("small");
      const left = document.createElement("span");
      left.textContent = labelBottomLeft;
      const right = document.createElement("span");
      right.textContent = String(labelBottomRight);
      small.append(left, right);
      button.append(title, small);

      const pin = document.createElement("span");
      pin.className = "pin-indicator";
      pin.textContent = pinTarget && state.pinnedFolders[pinTarget] ? "📌" : "";
      button.appendChild(pin);

      button.addEventListener("click", onClick);
      button.addEventListener("contextmenu", event => {
        event.preventDefault();
        if (!pinTarget) return;
        actions.togglePinnedFolder(pinTarget);
      });

      return button;
    }

    function renderFolders(){
      const counts = new Map();
      state.items.forEach(item => counts.set(item.folder, (counts.get(item.folder) || 0) + 1));

      const fragment = document.createDocumentFragment();
      fragment.appendChild(folderButton(
        "All folders",
        "Entire library",
        state.items.length,
        state.folderFilter === "all",
        () => {
          state.folderFilter = "all";
          actions.refresh();
        },
        null
      ));

      const entries = Array.from(counts.entries()).sort((a, b) => {
        const pinA = state.pinnedFolders[a[0]] ? 1 : 0;
        const pinB = state.pinnedFolders[b[0]] ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;
        return a[0].localeCompare(b[0]);
      });
      entries.forEach(([folder, count]) => {
        fragment.appendChild(folderButton(
          folder,
          "Folder",
          count,
          state.folderFilter === folder,
          () => {
            state.folderFilter = folder;
            actions.refresh();
          },
          folder
        ));
      });

      elements.folderList.replaceChildren(fragment);
    }

    function getFilteredItems(){
      let items = state.items.slice();

      if (state.filter !== "all") {
        if (state.filter === "favorites") items = items.filter(item => state.favorites[item.path]);
        else if (state.filter === "recent") items = items.filter(item => state.recentMap[item.path]);
        else if (state.filter === "recently-added") items = items.filter(item => Number.isFinite(item.addedAt) && item.addedAt > 0).sort((a, b) => b.addedAt - a.addedAt).slice(0, 250);
        else items = items.filter(item => item.type === state.filter);
      }

      if (state.folderFilter !== "all") items = items.filter(item => item.folder === state.folderFilter);

      const query = state.searchQuery.trim().toLowerCase();
      if (query) {
        items = items.filter(item => [item.title, item.name, item.folder, item.ext, item.path].join(" ").toLowerCase().includes(query));
      }

      items.sort((a, b) => {
        if (state.sort === "playlist") return a.playlistIndex - b.playlistIndex;
        if (state.sort === "name") return a.title.localeCompare(b.title);
        if (state.sort === "folder") return a.folder.localeCompare(b.folder) || a.title.localeCompare(b.title);
        if (state.sort === "type") return a.type.localeCompare(b.type) || a.title.localeCompare(b.title);
        if (state.sort === "recent") return (state.recentMap[b.path] || 0) - (state.recentMap[a.path] || 0) || a.title.localeCompare(b.title);
        return 0;
      });
      return items;
    }

    function typeClass(type){ return `type-pill type-${type}`; }

    function commonRowHandlers(row, item){
      row.addEventListener("click", event => {
        if (event.target.closest(".fav-btn")) return actions.toggleFavorite(item.path);
        if (event.target.closest(".queue-btn")) return actions.queueItem(item.path);
        if (event.target.closest(".row-checkbox")) return actions.toggleSelect(item.path);
        state.selectedPath = item.path;
        actions.refresh(false);
      });
      row.addEventListener("dblclick", () => {
        state.selectedPath = item.path;
        actions.openSelected();
      });
    }

    function renderTable(filteredItems){
      const limited = filteredItems.slice(0, config.maxVisibleRows);
      const fragment = document.createDocumentFragment();

      limited.forEach((item, index) => {
        const row = document.createElement("tr");
        if (state.selectedPath === item.path) row.classList.add("selected");
        if (state.multiSelected[item.path]) row.classList.add("multi-selected");
        row.dataset.path = item.path;

        const selectionTd = document.createElement("td");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "row-checkbox";
        checkbox.checked = Boolean(state.multiSelected[item.path]);
        selectionTd.appendChild(checkbox);

        const favTd = document.createElement("td");
        const favBtn = document.createElement("button");
        favBtn.className = `fav-btn ${state.favorites[item.path] ? "on" : ""}`;
        favBtn.type = "button";
        favBtn.textContent = state.favorites[item.path] ? "★" : "☆";
        favTd.appendChild(favBtn);

        const queueTd = document.createElement("td");
        const queueBtn = document.createElement("button");
        queueBtn.className = "queue-btn";
        queueBtn.type = "button";
        queueBtn.textContent = "+Q";
        queueTd.appendChild(queueBtn);

        const nameTd = textCell(item.title || item.name);
        nameTd.title = item.path;

        row.append(
          selectionTd,
          favTd,
          queueTd,
          textCell(String(index + 1), "col-index"),
          nameTd,
          textCell(item.type),
          textCell(item.folder),
          textCell(item.sizeText || "")
        );
        commonRowHandlers(row, item);
        fragment.appendChild(row);
      });

      elements.playlistBody.replaceChildren(fragment);
      elements.listContainer.classList.toggle("hidden", state.viewMode !== "list");
      elements.gridContainer.classList.toggle("hidden", state.viewMode !== "grid");
      elements.playlistTableWrap.classList.toggle("hidden", state.viewMode !== "table");
      if (state.viewMode === "list") renderList(limited);
      if (state.viewMode === "grid") renderGrid(limited);

      elements.renderNotice.textContent = filteredItems.length > config.maxVisibleRows
        ? `Rendering first ${config.maxVisibleRows.toLocaleString()} of ${filteredItems.length.toLocaleString()} items for performance.`
        : "";
    }

    function renderList(items){
      const fragment = document.createDocumentFragment();
      items.forEach(item => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = `list-row ${state.selectedPath === item.path ? "selected" : ""}`;
        row.textContent = `${item.title || item.name} — ${item.folder}`;
        row.addEventListener("click", () => {
          state.selectedPath = item.path;
          actions.refresh(false);
        });
        fragment.appendChild(row);
      });
      elements.listContainer.replaceChildren(fragment);
    }

    function renderGrid(items){
      const fragment = document.createDocumentFragment();
      items.forEach(item => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = `grid-card ${state.selectedPath === item.path ? "selected" : ""}`;
        const title = document.createElement("strong");
        title.textContent = item.title || item.name;
        const meta = document.createElement("span");
        meta.textContent = `${item.type} • ${item.folder}`;
        card.append(title, meta);
        card.addEventListener("click", () => {
          state.selectedPath = item.path;
          actions.refresh(false);
        });
        fragment.appendChild(card);
      });
      elements.gridContainer.replaceChildren(fragment);
    }

    function renderQueue(){
      const fragment = document.createDocumentFragment();
      state.queue.forEach((entry, i) => {
        const li = document.createElement("li");
        li.className = "queue-row";
        li.draggable = true;
        li.dataset.index = String(i);
        const label = document.createElement("span");
        label.textContent = `${i + 1}. ${entry.title || entry.name || entry.path || "(missing)"}`;
        const controls = document.createElement("span");
        controls.className = "queue-controls";
        controls.innerHTML = `<button class="queue-move-up" data-index="${i}" type="button" aria-label="Move up">↑</button>
          <button class="queue-move-down" data-index="${i}" type="button" aria-label="Move down">↓</button>
          <button class="queue-remove" data-index="${i}" type="button" aria-label="Remove from queue">✕</button>`;
        li.append(label, controls);
        fragment.appendChild(li);
      });
      elements.queueList.replaceChildren(fragment);
      elements.queueCount.textContent = String(state.queue.length);
    }

    function renderDiagnostics(){
      const d = state.playlistDiagnostics;
      elements.diagSummary.textContent = `Errors: ${d.errors.length} • Warnings: ${d.warnings.length} • Duplicates: ${d.duplicateEntries.length}`;
      const lines = [...d.errors, ...d.warnings].slice(0, 100);
      const fragment = document.createDocumentFragment();
      lines.forEach(line => {
        const li = document.createElement("li");
        li.textContent = line;
        fragment.appendChild(li);
      });
      elements.diagList.replaceChildren(fragment);
    }

    function renderStats(filteredItems){
      const audioCount = filteredItems.filter(item => item.type === "audio").length;
      const videoCount = filteredItems.filter(item => item.type === "video").length;
      const htmlCount = filteredItems.filter(item => item.type === "html").length;
      const favoriteCount = filteredItems.filter(item => state.favorites[item.path]).length;
      const totalSize = filteredItems.reduce((sum, item) => sum + (Number.isFinite(item.sizeBytes) ? item.sizeBytes : 0), 0);
      elements.statVisible.textContent = String(filteredItems.length);
      elements.statAudio.textContent = String(audioCount);
      elements.statVideo.textContent = String(videoCount);
      elements.statHtml.textContent = String(htmlCount);
      elements.statFavorites.textContent = String(favoriteCount);
      elements.statSize.textContent = utils.humanFileSize(totalSize) || "Unknown";
      elements.libraryBlurb.textContent = `${filteredItems.length} visible item(s). Queue has ${state.queue.length} entries.`;
    }

    function syncButtons(){
      document.querySelectorAll(".filter-btn").forEach(button => button.classList.toggle("active", button.dataset.filter === state.filter));
      document.querySelectorAll(".view-btn").forEach(button => button.classList.toggle("active", button.dataset.view === state.viewMode));
      elements.repeatModeBtn.textContent = `Repeat: ${state.repeatMode}`;
      elements.multiCount.textContent = String(Object.keys(state.multiSelected).length);
    }

    function ensureSelection(filteredItems){
      if (!filteredItems.length) return null;
      return filteredItems.find(item => item.path === state.selectedPath) || filteredItems[0];
    }

    function refresh(updateFolders){
      const filteredItems = getFilteredItems();
      const selectedItem = ensureSelection(filteredItems);
      if (selectedItem) state.selectedPath = selectedItem.path;
      if (updateFolders !== false) renderFolders();
      renderTable(filteredItems);
      renderStats(filteredItems);
      renderQueue();
      renderDiagnostics();
      syncButtons();
      if (!selectedItem) setTrackInfo(null, filteredItems.length ? "" : "No items match current filters.");
      else if (state.player.getCurrentItem()?.path !== selectedItem.path) setTrackInfo(selectedItem, "Selected");
      setStatus(filteredItems.length ? `Showing ${filteredItems.length} item(s).` : "No visible items.", "Shortcuts: / search • Enter open");
      return { filteredItems, selectedItem };
    }

    function moveSelection(direction){
      const filteredItems = getFilteredItems();
      if (!filteredItems.length) return null;
      let index = filteredItems.findIndex(item => item.path === state.selectedPath);
      index = Math.max(0, Math.min(filteredItems.length - 1, (index === -1 ? 0 : index) + direction));
      state.selectedPath = filteredItems[index].path;
      refresh(false);
      return filteredItems[index];
    }

    function bindQueueControls(actions){
      elements.queueList.addEventListener("click", event => {
        const index = Number(event.target?.dataset?.index);
        if (!Number.isInteger(index)) return;
        if (event.target.closest(".queue-remove")) return actions.removeQueueItem(index);
        if (event.target.closest(".queue-move-up")) return actions.moveQueueItem(index, -1);
        if (event.target.closest(".queue-move-down")) return actions.moveQueueItem(index, 1);
      });

      let dragIndex = -1;
      elements.queueList.addEventListener("dragstart", event => {
        const li = event.target.closest(".queue-row");
        if (!li) return;
        dragIndex = Number(li.dataset.index);
      });
      elements.queueList.addEventListener("dragover", event => event.preventDefault());
      elements.queueList.addEventListener("drop", event => {
        event.preventDefault();
        const li = event.target.closest(".queue-row");
        if (!li || dragIndex < 0) return;
        const dropIndex = Number(li.dataset.index);
        actions.reorderQueue(dragIndex, dropIndex);
        dragIndex = -1;
      });
      elements.queueList.addEventListener("dragend", () => { dragIndex = -1; });
    }

    return { setStatus, setTrackInfo, getFilteredItems, refresh, moveSelection, bindQueueControls };
  }

  ns.ui = { createUi };
})(window.MediaHorde);
