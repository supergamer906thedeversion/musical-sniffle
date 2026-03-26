window.MediaHorde = window.MediaHorde || {};

(function(ns){
  const { config, utils } = ns;

  function parseMetadata(parts){
    const metadata = {};
    for (let i = 1; i < parts.length; i += 1) {
      const piece = parts[i].trim();
      if (!piece) continue;
      const eqIndex = piece.indexOf("=");
      if (eqIndex === -1) continue;
      const key = piece.slice(0, eqIndex).trim().toLowerCase();
      const value = piece.slice(eqIndex + 1).trim();
      metadata[key] = value.replace(/^["']|["']$/g, "");
    }
    return metadata;
  }

  function parsePlaylistText(text){
    const lines = String(text || "").split(/\r?\n/);
    const items = [];
    const seen = new Set();

    lines.forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || line.startsWith(";") || line.startsWith("//")) {
        return;
      }

      const parts = line.split("|").map(part => part.trim());
      const rawPath = utils.normalizePath(parts[0]);
      if (!rawPath) return;

      const metadata = parseMetadata(parts);
      const ext = (metadata.ext || utils.extension(rawPath)).toLowerCase();
      const type = (metadata.type || utils.inferType(ext, config)).toLowerCase();
      const folder = metadata.folder || utils.dirname(rawPath);
      const title = metadata.title || utils.stripExtension(utils.basename(rawPath));
      const sizeText = metadata.size || "";
      const sizeBytes = utils.parseHumanSize(sizeText);
      const artPath = metadata.art || metadata.cover || "";

      const dedupeKey = `${rawPath}::${title}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);

      items.push({
        id: index + 1,
        path: rawPath,
        url: utils.encodeUrlPath(rawPath),
        name: utils.basename(rawPath),
        title,
        ext,
        type,
        folder,
        sizeText,
        sizeBytes,
        artPath: artPath ? utils.encodeUrlPath(artPath) : "",
        playlistIndex: items.length + 1
      });
    });

    return items;
  }

  async function loadPlaylistFromUrl(url){
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to load ${url} (${response.status})`);
    }
    const text = await response.text();
    return {
      text,
      items: parsePlaylistText(text),
      source: url
    };
  }

  async function loadPlaylistFromFile(file){
    const text = await file.text();
    return {
      text,
      items: parsePlaylistText(text),
      source: file.name || "playlist.txt"
    };
  }

  ns.playlist = {
    parsePlaylistText,
    loadPlaylistFromUrl,
    loadPlaylistFromFile
  };
})(window.MediaHorde);
