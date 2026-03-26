window.MediaHorde = window.MediaHorde || {};

(function(ns){
  function normalizePath(input){
    return String(input || "")
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/\\/g, "/")
      .replace(/^\.\//, "")
      .replace(/^\/+/, "");
  }

  function encodeUrlPath(path){
    return normalizePath(path)
      .split("/")
      .filter(Boolean)
      .map(encodeURIComponent)
      .join("/");
  }

  function basename(path){
    const parts = normalizePath(path).split("/");
    return parts[parts.length - 1] || "";
  }

  function dirname(path){
    const parts = normalizePath(path).split("/");
    parts.pop();
    return parts.join("/") || "(root)";
  }

  function extension(path){
    const name = basename(path);
    const dot = name.lastIndexOf(".");
    return dot >= 0 ? name.slice(dot).toLowerCase() : "";
  }

  function stripExtension(name){
    const dot = name.lastIndexOf(".");
    return dot >= 0 ? name.slice(0, dot) : name;
  }

  function inferType(ext, config){
    if (config.audioExtensions.includes(ext)) return "audio";
    if (config.videoExtensions.includes(ext)) return "video";
    if (config.htmlExtensions.includes(ext)) return "html";
    if (config.imageExtensions.includes(ext)) return "image";
    return "other";
  }

  function formatDuration(seconds){
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const total = Math.floor(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  }

  function parseHumanSize(sizeText){
    if (!sizeText) return Number.NaN;
    const lower = String(sizeText).trim().toLowerCase();
    const match = lower.match(/^([\d.]+)\s*(bytes?|kb|mb|gb|tb)?$/);
    if (!match) return Number.NaN;
    const value = Number(match[1]);
    const unit = match[2] || "bytes";
    const factors = {
      "byte": 1,
      "bytes": 1,
      "kb": 1024,
      "mb": 1024 ** 2,
      "gb": 1024 ** 3,
      "tb": 1024 ** 4
    };
    return value * (factors[unit] || 1);
  }

  function humanFileSize(bytes){
    if (!Number.isFinite(bytes) || bytes < 1) return "";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index += 1;
    }
    const digits = size >= 10 || index === 0 ? 0 : 1;
    return `${size.toFixed(digits)} ${units[index]}`;
  }

  function storageLoad(key){
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function storageSave(key, value){
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // storage full or blocked. Humanity persists.
    }
  }

  function createElement(tag, className, text){
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (typeof text === "string") el.textContent = text;
    return el;
  }

  function shuffleCopy(items){
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function safeText(value, fallback){
    const text = String(value || "").trim();
    return text || (fallback || "");
  }

  function debounce(fn, waitMs){
    let timeoutId = 0;
    return function debounced(...args){
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => fn.apply(this, args), waitMs);
    };
  }

  ns.utils = {
    normalizePath,
    encodeUrlPath,
    basename,
    dirname,
    extension,
    stripExtension,
    inferType,
    formatDuration,
    parseHumanSize,
    humanFileSize,
    storageLoad,
    storageSave,
    createElement,
    shuffleCopy,
    safeText,
    debounce
  };
})(window.MediaHorde);
