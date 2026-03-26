window.MediaHorde = window.MediaHorde || {};

(function(ns){
  function createPlayer(elements, callbacks){
    const state = {
      audioCtx: null,
      analyser: null,
      analyserData: null,
      sourceMap: new WeakMap(),
      activeSource: null,
      attachedElement: null,
      rafId: 0,
      idleTick: 0,
      currentItem: null,
      currentMode: "empty"
    };

    function ensureAudioContext(){
      if (state.audioCtx) return;
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      state.audioCtx = new AudioContextCtor();
      state.analyser = state.audioCtx.createAnalyser();
      state.analyser.fftSize = 128;
      state.analyserData = new Uint8Array(state.analyser.frequencyBinCount);
    }

    function buildMeters(){
      elements.meters.innerHTML = "";
      for (let i = 0; i < 10; i += 1) {
        const meter = document.createElement("div");
        meter.className = "meter";
        meter.innerHTML = `
          <div class="meter-bar"><div class="meter-fill" id="meterFill${i}"></div></div>
          <div class="meter-label">${i + 1}</div>
        `;
        elements.meters.appendChild(meter);
      }
    }

    function activeMediaElement(){
      if (state.currentMode === "video") return elements.videoEl;
      if (state.currentMode === "audio") return elements.audioEl;
      return null;
    }

    function connectAnalyser(mediaEl){
      ensureAudioContext();
      if (!state.audioCtx || !mediaEl) return;

      if (state.attachedElement === mediaEl) return;

      try {
        if (state.activeSource) state.activeSource.disconnect();
      } catch (error) {
        // shrug
      }

      try {
        if (!state.sourceMap.has(mediaEl)) {
          state.sourceMap.set(mediaEl, state.audioCtx.createMediaElementSource(mediaEl));
        }
        state.activeSource = state.sourceMap.get(mediaEl);
        state.activeSource.connect(state.analyser);
        state.analyser.connect(state.audioCtx.destination);
        state.attachedElement = mediaEl;
      } catch (error) {
        state.attachedElement = mediaEl;
      }
    }

    function setMode(mode){
      state.currentMode = mode;
      elements.screen.classList.remove("mode-empty", "mode-audio", "mode-video");
      elements.screen.classList.add(`mode-${mode}`);
    }

    function stopCurrentMedia(resetTime){
      [elements.audioEl, elements.videoEl].forEach(media => {
        media.pause();
        if (resetTime) {
          try {
            media.currentTime = 0;
          } catch (error) {
            // not fatal
          }
        }
        media.removeAttribute("src");
        media.load();
      });
    }

    async function loadAudio(item){
      stopCurrentMedia(true);
      setMode("audio");
      state.currentItem = item;

      elements.audioEl.src = item.url;
      elements.audioEl.load();
      elements.emptyOverlay.classList.add("hidden");
      updateFallbackArt(item);

      if (item.artPath) {
        elements.artEl.src = item.artPath;
        elements.artEl.classList.remove("hidden");
        elements.artFallback.classList.add("hidden");
        elements.artEl.onerror = () => {
          elements.artEl.classList.add("hidden");
          elements.artFallback.classList.remove("hidden");
        };
      } else {
        elements.artEl.classList.add("hidden");
        elements.artFallback.classList.remove("hidden");
      }

      connectAnalyser(elements.audioEl);
      try {
        await state.audioCtx?.resume?.();
      } catch (error) {}
      await elements.audioEl.play();
      callbacks.onPlaybackStateChange?.(true);
    }

    async function loadVideo(item){
      stopCurrentMedia(true);
      setMode("video");
      state.currentItem = item;
      elements.emptyOverlay.classList.add("hidden");
      elements.videoEl.src = item.url;
      elements.videoEl.load();
      connectAnalyser(elements.videoEl);
      try {
        await state.audioCtx?.resume?.();
      } catch (error) {}
      await elements.videoEl.play();
      callbacks.onPlaybackStateChange?.(true);
    }

    function loadEmpty(){
      stopCurrentMedia(true);
      state.currentItem = null;
      setMode("empty");
      elements.emptyOverlay.classList.remove("hidden");
      callbacks.onPlaybackStateChange?.(false);
      elements.artEl.classList.add("hidden");
      elements.artFallback.classList.add("hidden");
      elements.videoEl.classList.add("hidden");
    }

    async function loadItem(item, options){
      const opts = options || {};
      if (!item) {
        loadEmpty();
        return;
      }

      if (item.type === "audio") {
        await loadAudio(item);
        return;
      }

      if (item.type === "video") {
        await loadVideo(item);
        return;
      }

      if (item.type === "html") {
        if (opts.openHtml !== false) {
          window.open(item.url, "_blank", "noopener");
        }
        callbacks.onPlaybackStateChange?.(false);
        return;
      }

      window.open(item.url, "_blank", "noopener");
      callbacks.onPlaybackStateChange?.(false);
    }

    function pause(){
      const media = activeMediaElement();
      if (!media) return;
      media.pause();
      callbacks.onPlaybackStateChange?.(false);
    }

    async function resume(){
      const media = activeMediaElement();
      if (!media) return;
      connectAnalyser(media);
      try {
        await state.audioCtx?.resume?.();
      } catch (error) {}
      await media.play();
      callbacks.onPlaybackStateChange?.(true);
    }

    function stop(){
      const media = activeMediaElement();
      if (!media) return;
      media.pause();
      try {
        media.currentTime = 0;
      } catch (error) {}
      callbacks.onPlaybackStateChange?.(false);
    }

    function togglePlayPause(selectedItem){
      const media = activeMediaElement();
      if (!media) {
        if (selectedItem) {
          loadItem(selectedItem);
        }
        return;
      }

      if (media.paused) {
        resume();
      } else {
        pause();
      }
    }

    function setVolume(value){
      const volume = Math.max(0, Math.min(1, value));
      elements.audioEl.volume = volume;
      elements.videoEl.volume = volume;
    }

    function updateFallbackArt(item){
      elements.artFallbackType.textContent = String(item.type || "audio").toUpperCase();
      elements.artFallbackTitle.textContent = item.title || item.name;
      elements.artFallbackFolder.textContent = item.folder || "(root)";
    }

    function syncProgress(){
      const media = activeMediaElement();
      if (!media || !Number.isFinite(media.duration) || media.duration <= 0) {
        callbacks.onTimeUpdate?.(0, 0);
        return;
      }
      callbacks.onTimeUpdate?.(media.currentTime, media.duration);
    }

    function seekTo(ratio){
      const media = activeMediaElement();
      if (!media || !Number.isFinite(media.duration)) return;
      const nextTime = Math.max(0, Math.min(media.duration, media.duration * ratio));
      media.currentTime = nextTime;
      syncProgress();
    }

    function drawIdle(ctx, width, height){
      const t = Date.now() / 550;
      const background = ctx.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, "#06131a");
      background.addColorStop(1, "#080912");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < 34; i += 1) {
        const x = 12 + i * ((width - 24) / 34);
        const wave = (Math.sin(t + i * 0.55) + 1) * 0.5;
        const barHeight = 18 + wave * (height * 0.45);
        const y = height - barHeight - 12;
        const barGrad = ctx.createLinearGradient(0, y, 0, height);
        barGrad.addColorStop(0, "rgba(93,240,255,.75)");
        barGrad.addColorStop(0.55, "rgba(137,255,152,.65)");
        barGrad.addColorStop(1, "rgba(255,87,168,.65)");
        ctx.fillStyle = barGrad;
        ctx.fillRect(x, y, Math.max(6, (width - 50) / 45), barHeight);
      }

      ctx.fillStyle = "rgba(231,227,255,.92)";
      ctx.font = "bold 18px Tahoma, sans-serif";
      ctx.fillText("MEDIA HORDE AMP", 18, 28);
      ctx.fillStyle = "rgba(167,160,216,.95)";
      ctx.font = "12px Tahoma, sans-serif";
      ctx.fillText("Load an audio track or video. HTML items launch in a new tab.", 18, 48);
    }

    function updateMetersFromData(data){
      for (let i = 0; i < 10; i += 1) {
        const fill = document.getElementById(`meterFill${i}`);
        if (!fill) continue;
        const sampleIndex = Math.min(data.length - 1, Math.floor((i / 10) * data.length));
        const value = data[sampleIndex] / 255;
        fill.style.height = `${18 + value * 82}%`;
      }
    }

    function animateIdleMeters(){
      const t = Date.now() / 420;
      for (let i = 0; i < 10; i += 1) {
        const fill = document.getElementById(`meterFill${i}`);
        if (!fill) continue;
        const value = 0.15 + ((Math.sin(t + i * 0.7) + 1) / 2) * 0.5;
        fill.style.height = `${20 + value * 55}%`;
      }
    }

    function resizeCanvasToDisplaySize(canvas){
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(300, Math.floor(rect.width));
      const height = Math.max(180, Math.floor(rect.height));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    }

    function renderVisualizer(){
      cancelAnimationFrame(state.rafId);
      const canvas = elements.visualizer;
      const ctx = canvas.getContext("2d");

      const frame = () => {
        state.rafId = requestAnimationFrame(frame);
        resizeCanvasToDisplaySize(canvas);

        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        const media = activeMediaElement();
        if (state.analyser && state.analyserData && media && !media.paused && state.currentMode !== "video") {
          const background = ctx.createLinearGradient(0, 0, 0, height);
          background.addColorStop(0, "#06131a");
          background.addColorStop(1, "#080912");
          ctx.fillStyle = background;
          ctx.fillRect(0, 0, width, height);

          state.analyser.getByteFrequencyData(state.analyserData);
          const barWidth = Math.max(4, (width / state.analyserData.length) * 0.8);
          let x = 10;

          for (let i = 0; i < state.analyserData.length; i += 1) {
            const value = state.analyserData[i] / 255;
            const barHeight = Math.max(4, value * (height - 40));
            const y = height - barHeight - 10;
            const grad = ctx.createLinearGradient(0, y, 0, height);
            grad.addColorStop(0, "#38bdf8");
            grad.addColorStop(0.55, "#22c55e");
            grad.addColorStop(1, "#60a5fa");
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, barWidth, barHeight);
            x += barWidth + 2;
          }

          updateMetersFromData(state.analyserData);
        } else {
          drawIdle(ctx, width, height);
          animateIdleMeters();
        }

        syncProgress();
      };

      frame();
    }

    function attachMediaEvents(){
      [elements.audioEl, elements.videoEl].forEach(media => {
        media.addEventListener("play", () => callbacks.onPlaybackStateChange?.(true));
        media.addEventListener("pause", () => callbacks.onPlaybackStateChange?.(false));
        media.addEventListener("ended", () => callbacks.onEnded?.(state.currentItem));
        media.addEventListener("timeupdate", syncProgress);
        media.addEventListener("loadedmetadata", syncProgress);
      });
    }

    buildMeters();
    attachMediaEvents();
    renderVisualizer();

    return {
      loadItem,
      pause,
      resume,
      stop,
      togglePlayPause,
      setVolume,
      seekTo,
      getCurrentItem: () => state.currentItem,
      getCurrentMode: () => state.currentMode,
      isPlaying: () => {
        const media = activeMediaElement();
        return Boolean(media && !media.paused);
      }
    };
  }

  ns.player = {
    createPlayer
  };
})(window.MediaHorde);
