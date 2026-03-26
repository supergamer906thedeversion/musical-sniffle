window.MediaHorde = window.MediaHorde || {};

(function(ns){
  const { utils } = ns;

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

    function renderFolders(){
      const counts = new Map();
      state.items.forEach(item => {
        counts.set(item.folder, (counts.get(item.folder) || 0) + 1);
      });

      const fragment = document.createDocumentFragment();
      const allBtn = document.createElement("button");
      allBtn.className = `folder-btn ${state.folderFilter === "all" ? "active" : ""}`;
      allBtn.type = "button";
      allBtn.innerHTML = `<div>All folders</div><small><span>Entire library</span><span>${state.items.length}</span></small>`;
      allBtn.addEventListener("click", () => {
        state.folderFilter = "all";
        actions.refresh();
      });
      fragment.appendChild(allBtn);

      Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([folder, count]) => {
          const button = document.createElement("button");
          button.className = `folder-btn ${state.folderFilter === folder ? "active" : ""}`;
          button.type = "button";
          button.innerHTML = `<div>${folder}</div><small><span>Folder</span><span>${count}</span></small>`;
          button.addEventListener("click", () => {
            state.folderFilter = folder;
            actions.refresh();
          });
          fragment.appendChild(button);
        });

      elements.folderList.innerHTML = "";
      elements.folderList.appendChild(fragment);
    }

    function getFilteredItems(){
      let items = state.items.slice();

      if (state.filter !== "all") {
        if (state.filter === "favorites") {
          items = items.filter(item => state.favorites[item.path]);
        } else if (state.filter === "recent") {
          items = items.filter(item => state.recentMap[item.path]);
        } else {
          items = items.filter(item => item.type === state.filter);
        }
      }

      if (state.folderFilter !== "all") {
        items = items.filter(item => item.folder === state.folderFilter);
      }

      const query = state.searchQuery.trim().toLowerCase();
      if (query) {
        items = items.filter(item => {
          const haystack = [
            item.title,
            item.name,
            item.folder,
            item.ext,
            item.path,
            state.recentMap[item.path] ? "recent" : "",
            state.favorites[item.path] ? "favorite" : ""
          ].join(" ").toLowerCase();
          return haystack.includes(query);
        });
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

    function typeClass(type){
      if (type === "audio") return "type-audio";
      if (type === "video") return "type-video";
      if (type === "html") return "type-html";
      return "type-other";
    }

    function renderTable(filteredItems){
      const fragment = document.createDocumentFragment();

      filteredItems.forEach((item, index) => {
        const row = document.createElement("tr");
        if (state.selectedPath === item.path) row.classList.add("selected");
        if (state.recentMap[item.path]) row.classList.add("recent-row");
        row.dataset.path = item.path;

        const nameLabel = item.title || item.name;
        const recentTag = state.recentMap[item.path] ? '<span class="item-flag">RECENT</span>' : "";
        row.innerHTML = `
          <td><button class="fav-btn ${state.favorites[item.path] ? "on" : ""}" type="button" aria-label="Toggle favorite">${state.favorites[item.path] ? "★" : "☆"}</button></td>
          <td>${index + 1}</td>
          <td title="${item.name}"><div class="item-main">${nameLabel} ${recentTag}</div><div class="item-sub">${item.path}</div></td>
          <td><span class="type-pill ${typeClass(item.type)}">${item.type}</span></td>
          <td title="${item.folder}">${item.folder}</td>
          <td>${item.sizeText || ""}</td>
        `;

        row.addEventListener("click", event => {
          if (event.target.closest(".fav-btn")) {
            actions.toggleFavorite(item.path);
            return;
          }
          state.selectedPath = item.path;
          actions.refresh(false);
        });

        row.addEventListener("dblclick", () => {
          state.selectedPath = item.path;
          actions.openSelected();
        });

        fragment.appendChild(row);
      });

      elements.playlistBody.innerHTML = "";
      elements.playlistBody.appendChild(fragment);
    }

    function renderStats(filteredItems){
      const audioCount = filteredItems.filter(item => item.type === "audio").length;
      const videoCount = filteredItems.filter(item => item.type === "video").length;
      const htmlCount = filteredItems.filter(item => item.type === "html").length;
      const favoriteCount = filteredItems.filter(item => state.favorites[item.path]).length;
      const totalSize = filteredItems.reduce((sum, item) => sum + (Number.isFinite(item.sizeBytes) ? item.sizeBytes : 0), 0);
      const globalFavorites = state.items.filter(item => state.favorites[item.path]).length;
      const recentCount = state.items.filter(item => state.recentMap[item.path]).length;

      elements.statVisible.textContent = String(filteredItems.length);
      elements.statAudio.textContent = String(audioCount);
      elements.statVideo.textContent = String(videoCount);
      elements.statHtml.textContent = String(htmlCount);
      elements.statFavorites.textContent = String(favoriteCount);
      elements.statSize.textContent = utils.humanFileSize(totalSize) || "Unknown";

      const folderLabel = state.folderFilter === "all" ? "all folders" : state.folderFilter;
      elements.libraryBlurb.textContent =
        `${filteredItems.length} visible item(s) from ${folderLabel}. ` +
        `Playlist holds ${state.items.length} total entries, ${globalFavorites} favorite(s), and ${recentCount} recent item(s). ` +
        `Visible size is ${utils.humanFileSize(totalSize) || "unknown unless playlist entries include size metadata"}.`;
    }

    function syncButtons(){
      document.querySelectorAll(".filter-btn").forEach(button => {
        button.classList.toggle("active", button.dataset.filter === state.filter);
      });
    }

    function ensureSelection(filteredItems){
      if (!filteredItems.length) {
        state.selectedPath = "";
        return null;
      }

      const match = filteredItems.find(item => item.path === state.selectedPath);
      if (match) return match;

      state.selectedPath = filteredItems[0].path;
      return filteredItems[0];
    }

    function refresh(updateFolders){
      const shouldRenderFolders = updateFolders !== false;
      const filteredItems = getFilteredItems();
      const selectedItem = ensureSelection(filteredItems);

      if (shouldRenderFolders) renderFolders();
      renderTable(filteredItems);
      renderStats(filteredItems);
      syncButtons();

      if (!selectedItem) {
        setTrackInfo(null, filteredItems.length ? "" : "No items match the current filters.");
      } else if (state.player.getCurrentItem()?.path !== selectedItem.path) {
        setTrackInfo(selectedItem, "Selected");
      }

      setStatus(
        filteredItems.length
          ? `Showing ${filteredItems.length} item(s).`
          : "No visible items. Your filters murdered the list.",
        "Shortcuts: Space play/pause • Enter open • ↑/↓ move selection"
      );

      return { filteredItems, selectedItem };
    }

    function moveSelection(direction){
      const filteredItems = getFilteredItems();
      if (!filteredItems.length) return null;

      let index = filteredItems.findIndex(item => item.path === state.selectedPath);
      if (index === -1) index = 0;
      index = Math.max(0, Math.min(filteredItems.length - 1, index + direction));
      state.selectedPath = filteredItems[index].path;
      refresh(false);
      return filteredItems[index];
    }

    return {
      setStatus,
      setTrackInfo,
      getFilteredItems,
      refresh,
      moveSelection
    };
  }

  ns.ui = {
    createUi
  };
})(window.MediaHorde);
