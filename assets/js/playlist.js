window.MediaHorde = window.MediaHorde || {};

(function(ns){
  const { config, utils } = ns;

  function parseMetadata(parts){
    const metadata = {};
    const unknownChunks = [];
    for (let i = 1; i < parts.length; i += 1) {
      const piece = parts[i].trim();
      if (!piece) continue;
      const eqIndex = piece.indexOf("=");
      if (eqIndex === -1) {
        unknownChunks.push(piece);
        continue;
      }
      const key = piece.slice(0, eqIndex).trim().toLowerCase();
      const value = piece.slice(eqIndex + 1).trim();
      if (!key) {
        unknownChunks.push(piece);
        continue;
      }
      metadata[key] = value.replace(/^["']|["']$/g, "");
    }
    return { metadata, unknownChunks };
  }

  function inferArtPath(rawPath, metadata){
    if (metadata.art || metadata.cover) return metadata.art || metadata.cover;
    const baseWithoutExt = utils.stripExtension(rawPath);
    for (const ext of config.artExtensions || []) {
      return `${baseWithoutExt}${ext}`;
    }
    return "";
  }

  function parsePlaylistText(text){
    const lines = String(text || "").split(/\r?\n/);
    const items = [];
    const seen = new Map();
    const diagnostics = {
      malformedLines: [],
      duplicateEntries: [],
      unknownMetadata: [],
      warnings: [],
      errors: []
    };

    lines.forEach((rawLine, index) => {
      const lineNumber = index + 1;
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || line.startsWith(";") || line.startsWith("//")) {
        return;
      }

      const parts = line.split("|").map(part => part.trim());
      const rawPath = utils.normalizePath(parts[0]);
      if (!rawPath) {
        diagnostics.malformedLines.push({ lineNumber, line: rawLine, reason: "Missing media path before metadata." });
        diagnostics.errors.push(`Line ${lineNumber}: missing media path.`);
        return;
      }
      if (rawPath.includes("..")) {
        diagnostics.malformedLines.push({ lineNumber, line: rawLine, reason: "Parent directory segments are not allowed." });
        diagnostics.errors.push(`Line ${lineNumber}: path cannot contain '..'.`);
        return;
      }

      const { metadata, unknownChunks } = parseMetadata(parts);
      if (unknownChunks.length) {
        diagnostics.unknownMetadata.push({ lineNumber, chunks: unknownChunks, line: rawLine });
        diagnostics.warnings.push(`Line ${lineNumber}: ignored malformed metadata chunk(s): ${unknownChunks.join(", ")}`);
      }

      const ext = (metadata.ext || utils.extension(rawPath)).toLowerCase();
      const type = (metadata.type || utils.inferType(ext, config)).toLowerCase();
      const folder = metadata.folder || utils.dirname(rawPath);
      const title = metadata.title || utils.stripExtension(utils.basename(rawPath));
      const sizeText = metadata.size || "";
      const sizeBytes = utils.parseHumanSize(sizeText);
      const artPath = inferArtPath(rawPath, metadata);

      if (!ext) diagnostics.warnings.push(`Line ${lineNumber}: file extension missing for ${rawPath}.`);
      if (!["audio", "video", "html", "image", "other"].includes(type)) {
        diagnostics.warnings.push(`Line ${lineNumber}: unsupported type '${type}', set to 'other'.`);
      }

      const dedupeKey = rawPath.toLowerCase();
      if (seen.has(dedupeKey)) {
        diagnostics.duplicateEntries.push({ lineNumber, duplicateOf: seen.get(dedupeKey), path: rawPath });
        diagnostics.errors.push(`Line ${lineNumber}: duplicate path '${rawPath}' (first seen at line ${seen.get(dedupeKey)}).`);
        return;
      }
      seen.set(dedupeKey, lineNumber);

      items.push({
        id: lineNumber,
        path: rawPath,
        url: utils.encodeUrlPath(rawPath),
        name: utils.basename(rawPath),
        title,
        ext,
        type: ["audio", "video", "html", "image", "other"].includes(type) ? type : "other",
        folder,
        sizeText,
        sizeBytes,
        artPath: artPath ? utils.encodeUrlPath(artPath) : "",
        playlistIndex: items.length + 1,
        addedAt: lineNumber
      });
    });

    return { items, diagnostics };
  }

  async function loadPlaylistFromUrl(url){
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to load ${url} (${response.status})`);
    }
    const text = await response.text();
    const parsed = parsePlaylistText(text);
    return {
      text,
      items: parsed.items,
      diagnostics: parsed.diagnostics,
      source: url
    };
  }

  async function loadPlaylistFromFile(file){
    const text = await file.text();
    const parsed = parsePlaylistText(text);
    return {
      text,
      items: parsed.items,
      diagnostics: parsed.diagnostics,
      source: file.name || "playlist.txt"
    };
  }

  ns.playlist = {
    parsePlaylistText,
    loadPlaylistFromUrl,
    loadPlaylistFromFile
  };
})(window.MediaHorde);
