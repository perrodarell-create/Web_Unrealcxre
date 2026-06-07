document.addEventListener("DOMContentLoaded", () => {
    const PLAY_ICON = "▶";
    const PAUSE_ICON = "||";

    // 1. Entry portal and page switching
    const entryScreen = document.getElementById("entry-screen");
    const entryChoices = document.querySelectorAll("[data-entry-target]");
    const siteSwitches = document.querySelectorAll("[data-view-target]");
    const pagePanels = document.querySelectorAll("[data-page]");
    const entryVideo = entryScreen?.querySelector("video");

    document.body.classList.add("entry-open");

    const showPage = (target) => {
        pagePanels.forEach(panel => {
            const isActive = panel.dataset.page === target;
            panel.hidden = !isActive;
            panel.classList.toggle("active", isActive);
        });

        siteSwitches.forEach(button => {
            const isActive = button.dataset.viewTarget === target;
            button.classList.toggle("active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });
    };

    const closeEntry = (target = "unrealcxre") => {
        showPage(target);
        document.body.classList.remove("entry-open");
        entryScreen?.classList.add("hidden");
        entryScreen?.setAttribute("aria-hidden", "true");
        entryVideo?.pause();
    };

    entryChoices.forEach(button => {
        button.addEventListener("click", () => {
            closeEntry(button.dataset.entryTarget);
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });

    siteSwitches.forEach(button => {
        button.setAttribute("aria-pressed", String(button.classList.contains("active")));
        button.addEventListener("click", () => {
            const target = button.dataset.viewTarget;
            showPage(target);
            if (!entryScreen?.classList.contains("hidden")) {
                closeEntry(target);
            }
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });

    // 2. Audio Setup & Variables
    const bgAudio = document.getElementById('bg-audio');
    const trackAudio = document.getElementById('track-audio');
    const playToggleBtn = document.getElementById('audio-toggle');
    const trackItems = document.querySelectorAll('.track-item');
    const visualizer = document.getElementById("visualizer");
    const sitePlayer = document.getElementById("site-player");
    const playerCover = document.getElementById("player-cover");
    const playerTitle = document.getElementById("player-title");
    const playerToggle = document.getElementById("player-toggle");
    const progressBar = sitePlayer.querySelector('.track-progress');
    const currTimeEl = sitePlayer.querySelector('.curr-time');
    const totTimeEl = sitePlayer.querySelector('.tot-time');
    const seekBackBtn = sitePlayer.querySelector('.seek-back');
    const seekForwardBtn = sitePlayer.querySelector('.seek-forward');
    const volumeDownBtn = sitePlayer.querySelector('.volume-down');
    const volumeUpBtn = sitePlayer.querySelector('.volume-up');
    const volumeReadout = sitePlayer.querySelector('.volume-readout');

    let isBgPlaying = false;
    let currentTrackItem = null;
    let playerVolume = 0.8;
    let audioContext = null;
    let analyser = null;
    let visualizerAnimation = null;
    let visualizerSources = [];

    const setBgButtonState = (isPlaying) => {
        isBgPlaying = isPlaying;
        playToggleBtn.innerHTML = `<span class="icon">${isPlaying ? "PAUSE AUDIO" : "PLAY AUDIO"}</span>`;
        playToggleBtn.setAttribute("aria-pressed", String(isPlaying));
    };

    const setVolume = (nextVolume) => {
        playerVolume = Math.min(1, Math.max(0, Number(nextVolume.toFixed(2))));
        bgAudio.volume = playerVolume;
        trackAudio.volume = playerVolume;
        if (volumeReadout) {
            volumeReadout.textContent = `${Math.round(playerVolume * 100)}%`;
        }
    };

    setVolume(playerVolume);

    const getTrackButton = (item) => item?.querySelector(".play-btn");

    const setTrackButtonState = (item, isPlaying) => {
        const button = getTrackButton(item);
        if (!button) return;

        button.textContent = isPlaying ? PAUSE_ICON : PLAY_ICON;
        button.setAttribute("aria-label", `${isPlaying ? "Pause" : "Play"} ${getTrackTitle(item)}`);
    };

    const getTrackTitle = (item) => {
        if (!item) return "track";

        const clone = item.cloneNode(true);
        clone.querySelector(".play-btn")?.remove();
        const text = clone.textContent || "track";
        return text.replace(/^\s*\d+\.\s*/, "").trim();
    };

    trackItems.forEach(item => {
        const button = getTrackButton(item);
        const title = getTrackTitle(item);
        const titleEl = document.createElement("span");
        titleEl.className = "track-title";
        titleEl.textContent = title;

        item.textContent = "";
        item.append(button, titleEl);
    });

    const clearTrackState = () => {
        trackItems.forEach(item => {
            item.classList.remove("playing", "paused");
            setTrackButtonState(item, false);
        });
    };

    const resetProgress = () => {
        progressBar.value = 0;
        currTimeEl.textContent = "0:00";
        totTimeEl.textContent = "0:00";
        playerToggle.textContent = PLAY_ICON;
        playerToggle.setAttribute("aria-label", "Play current track");
    };

    const setPlayerTrack = (item) => {
        const title = getTrackTitle(item);
        const cover = item.closest(".disco-card")?.querySelector(".card-img")?.getAttribute("src");

        playerTitle.textContent = title;
        if (cover) playerCover.src = cover;
        playerCover.alt = `${title} cover`;
        sitePlayer.classList.add("active");
        sitePlayer.setAttribute("aria-hidden", "false");
    };

    const setPlayerPlaybackState = (isPlaying) => {
        playerToggle.textContent = isPlaying ? PAUSE_ICON : PLAY_ICON;
        playerToggle.setAttribute("aria-label", isPlaying ? "Pause current track" : "Play current track");
    };

    const setupVisualizer = () => {
        if (!visualizer || audioContext) return;
        if (!bgAudio.captureStream || !trackAudio.captureStream) {
            console.warn("Visualizer disabled: captureStream is not supported in this browser.");
            return;
        }

        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 128;

            const bgSource = audioContext.createMediaStreamSource(bgAudio.captureStream());
            const trackSource = audioContext.createMediaStreamSource(trackAudio.captureStream());

            bgSource.connect(analyser);
            trackSource.connect(analyser);
            visualizerSources = [bgSource, trackSource];
        } catch (error) {
            console.warn("Visualizer disabled so audio can keep playing:", error);
            audioContext = null;
            analyser = null;
            visualizerSources = [];
        }
    };

    const startVisualizer = () => {
        if (!visualizer) return;

        const ctx = visualizer.getContext("2d");
        const data = new Uint8Array(analyser?.frequencyBinCount || 64);

        const draw = () => {
            const width = visualizer.clientWidth;
            const height = visualizer.clientHeight;
            const dpr = window.devicePixelRatio || 1;

            if (visualizer.width !== width * dpr || visualizer.height !== height * dpr) {
                visualizer.width = width * dpr;
                visualizer.height = height * dpr;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }

            const activeAudio = !trackAudio.paused ? trackAudio : bgAudio;
            const hasLiveAudio = analyser && !activeAudio.paused;

            if (hasLiveAudio) {
                analyser.getByteFrequencyData(data);
            } else {
                const time = activeAudio.currentTime || performance.now() / 1000;
                data.forEach((_, index) => {
                    const wave = Math.sin(time * 7 + index * 0.45);
                    const pulse = Math.sin(time * 13 + index * 0.18);
                    data[index] = 18 + Math.abs(wave * 82) + Math.abs(pulse * 42);
                });
            }

            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
            ctx.fillRect(0, 0, width, height);

            const barWidth = width / data.length;
            data.forEach((value, index) => {
                const barHeight = Math.max(3, (value / 255) * height);
                const x = index * barWidth;
                const y = height - barHeight;

                ctx.fillStyle = index % 5 === 0 ? "#ffffff" : "#B22222";
                ctx.fillRect(x, y, Math.max(1, barWidth - 2), barHeight);
            });

            ctx.strokeStyle = "rgba(178, 34, 34, 0.65)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, height - 1);
            ctx.lineTo(width, height - 1);
            ctx.stroke();

            visualizerAnimation = requestAnimationFrame(draw);
        };

        if (!visualizerAnimation) draw();
    };

    const activateAudioEngine = () => {
        setupVisualizer();
        if (audioContext?.state === "suspended") {
            audioContext.resume().catch(error => {
                console.warn("AudioContext resume failed:", error);
            });
        }
        startVisualizer();
    };

    const formatTime = (time) => {
        if (isNaN(time)) return "0:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // Lógica Fondo Principal
    playToggleBtn.addEventListener('click', () => {
        if (isBgPlaying) {
            bgAudio.pause();
            setBgButtonState(false);
        } else {
            trackAudio.pause(); // Prevenir colisión
            if (currentTrackItem) {
                currentTrackItem.classList.remove("playing");
                currentTrackItem.classList.add("paused");
                setTrackButtonState(currentTrackItem, false);
                setPlayerPlaybackState(false);
            }
            bgAudio.play().catch(e => console.error("Error reproduciendo fondo:", e));
            activateAudioEngine();
            setBgButtonState(true);
        }
    });

    // Lógica Listas de Canciones
    trackItems.forEach(item => {
        item.addEventListener('click', function (e) {
            if (e.target.tagName.toLowerCase() === 'input') return;

            const src = this.getAttribute('data-src');

            if (currentTrackItem === this) {
                if (trackAudio.paused) {
                    trackAudio.play().catch(e => console.error("Error reproduciendo track:", e));
                    activateAudioEngine();
                    this.classList.remove("paused");
                    this.classList.add("playing");
                    setTrackButtonState(this, true);
                    setPlayerPlaybackState(true);
                } else {
                    trackAudio.pause();
                    this.classList.remove("playing");
                    this.classList.add("paused");
                    setTrackButtonState(this, false);
                    setPlayerPlaybackState(false);
                }
                return;
            }

            bgAudio.pause();
            setBgButtonState(false);

            currTimeEl.textContent = "0:00";
            totTimeEl.textContent = "0:00";
            progressBar.value = 0;
            setPlayerTrack(this);

            trackAudio.src = src;
            trackAudio.play().catch(e => console.error("Error reproduciendo track:", e));
            activateAudioEngine();
            currentTrackItem = this;

            // Visual feedback
            clearTrackState();
            this.classList.add("playing");
            setTrackButtonState(this, true);
            setPlayerPlaybackState(true);
        });
    });

    trackAudio.addEventListener('timeupdate', () => {
        if (trackAudio.duration) {
            progressBar.value = (trackAudio.currentTime / trackAudio.duration) * 100;
            currTimeEl.textContent = formatTime(trackAudio.currentTime);
        }
    });

    trackAudio.addEventListener('loadedmetadata', () => {
        totTimeEl.textContent = formatTime(trackAudio.duration);
    });

    trackAudio.addEventListener('ended', () => {
        if (currentTrackItem) {
            currentTrackItem.classList.remove("playing", "paused");
            setTrackButtonState(currentTrackItem, false);
        }
        resetProgress();
    });

    progressBar.addEventListener('input', (e) => {
        if (!trackAudio.duration) return;
        trackAudio.currentTime = (e.target.value / 100) * trackAudio.duration;
    });

    sitePlayer.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    sitePlayer.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
    });

    const seekBy = (seconds) => {
        if (!trackAudio.duration) return;
        trackAudio.currentTime = Math.min(trackAudio.duration, Math.max(0, trackAudio.currentTime + seconds));
    };

    seekBackBtn.addEventListener("click", () => seekBy(-10));
    seekForwardBtn.addEventListener("click", () => seekBy(10));
    volumeDownBtn?.addEventListener("click", () => setVolume(playerVolume - 0.1));
    volumeUpBtn?.addEventListener("click", () => setVolume(playerVolume + 0.1));

    playerToggle.addEventListener("click", () => {
        if (!currentTrackItem) return;

        if (trackAudio.paused) {
            bgAudio.pause();
            setBgButtonState(false);
            if (trackAudio.ended) {
                trackAudio.currentTime = 0;
            }
            trackAudio.play().catch(e => console.error("Error reproduciendo track:", e));
            activateAudioEngine();
            currentTrackItem.classList.remove("paused");
            currentTrackItem.classList.add("playing");
            setTrackButtonState(currentTrackItem, true);
            setPlayerPlaybackState(true);
        } else {
            trackAudio.pause();
            currentTrackItem.classList.remove("playing");
            currentTrackItem.classList.add("paused");
            setTrackButtonState(currentTrackItem, false);
            setPlayerPlaybackState(false);
        }
    });

    // 3. Tracklist Toggle
    const tracklistToggles = document.querySelectorAll(".tracklist-toggle-btn");
    tracklistToggles.forEach(btn => {
        btn.addEventListener("click", () => {
            const list = btn.nextElementSibling;
            if (list.classList.contains("active")) {
                list.classList.remove("active");
                btn.textContent = "View Tracklist";
                btn.setAttribute("aria-expanded", "false");
            } else {
                list.classList.add("active");
                btn.textContent = "Hide Tracklist";
                btn.setAttribute("aria-expanded", "true");
            }
        });
    });

    // 5. TikTok Style Translation Toggle
    const translateButtons = document.querySelectorAll(".translate-btn");
    document.querySelectorAll(".album-desc").forEach(desc => {
        desc.textContent = desc.getAttribute("data-en");
        desc.dataset.currentLang = "en";
    });

    translateButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            const block = e.target.closest(".translation-block");
            const desc = block.querySelector(".album-desc");
            const isEnglish = desc.dataset.currentLang !== "es";

            if (isEnglish) {
                desc.textContent = desc.getAttribute("data-es");
                btn.textContent = "See original";
                desc.dataset.currentLang = "es";
            } else {
                desc.textContent = desc.getAttribute("data-en");
                btn.textContent = "See translation";
                desc.dataset.currentLang = "en";
            }
        });
    });

    // 6. Production Hub Mini-Playlist
    const hubButtons = document.querySelectorAll(".hub-logo-btn");
    const miniPlaylist = document.getElementById("mini-playlist");

    const setMiniPlaylistState = (isOpen) => {
        miniPlaylist.hidden = !isOpen;
        miniPlaylist.classList.toggle("active", isOpen);
        miniPlaylist.setAttribute("aria-hidden", String(!isOpen));
    };

    hubButtons.forEach(button => {
        button.addEventListener("click", (e) => {
            e.stopPropagation();
            setMiniPlaylistState(!miniPlaylist.classList.contains("active"));
        });
    });

    // Close mini-playlist when clicking outside
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".production-hub")) {
            setMiniPlaylistState(false);
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            setMiniPlaylistState(false);
        }
    });

    // Smooth scroll from mini cards
    const miniCards = document.querySelectorAll(".mini-card");
    miniCards.forEach(card => {
        card.addEventListener("click", () => {
            const targetId = card.getAttribute("data-target");
            showPage("unrealcxre");
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: "smooth" });
                setMiniPlaylistState(false);
            }
        });
    });
});
