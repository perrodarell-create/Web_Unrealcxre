document.addEventListener("DOMContentLoaded", () => {
    const PLAY_ICON = "▶";
    const PAUSE_ICON = "||";
    const BOOT_DURATION = 4000;

    // 0. Breakcore world loading sequence
    const worldLoader = document.getElementById("world-loader");
    const loaderBar = worldLoader?.querySelector(".loader-progress span");
    const loaderPercent = worldLoader?.querySelector(".loader-percent");
    const loaderStatus = worldLoader?.querySelector(".loader-status");
    const loaderMessages = [
        "generating amen breaks...",
        "loading corrupted chunks...",
        "planting digital flowers...",
        "distorting archive textures...",
        "spawning unreal world..."
    ];
    const bootStartedAt = performance.now();

    const runWorldLoader = () => {
        const elapsed = performance.now() - bootStartedAt;
        const rawProgress = Math.min(1, elapsed / BOOT_DURATION);
        const displayedProgress = Math.round((1 - Math.pow(1 - rawProgress, 1.55)) * 100);
        const messageIndex = Math.min(
            loaderMessages.length - 1,
            Math.floor(rawProgress * loaderMessages.length)
        );

        if (loaderBar) loaderBar.style.width = `${displayedProgress}%`;
        if (loaderPercent) loaderPercent.textContent = `${displayedProgress}%`;
        if (loaderStatus) loaderStatus.textContent = loaderMessages[messageIndex];

        if (rawProgress < 1) {
            requestAnimationFrame(runWorldLoader);
            return;
        }

        if (loaderBar) loaderBar.style.width = "100%";
        if (loaderPercent) loaderPercent.textContent = "100%";
        if (loaderStatus) loaderStatus.textContent = "world loaded // 175 bpm";
        worldLoader?.classList.add("is-complete");
        document.body.classList.remove("is-booting");
        window.setTimeout(() => worldLoader?.remove(), 700);
        window.dispatchEvent(new CustomEvent("unreal:boot-complete"));
    };

    requestAnimationFrame(runWorldLoader);

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
        bgAudio?.pause();
        if (bgAudio) bgAudio.currentTime = 0;
        setBgButtonState(false);
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
    const volumeRange = sitePlayer.querySelector('.volume-range');

    let isBgPlaying = false;
    let currentTrackItem = null;
    let playerVolume = 0.8;
    let audioContext = null;
    let analyser = null;
    let visualizerAnimation = null;
    let visualizerSources = [];
    let introAudioWanted = true;
    let uiAudioContext = null;

    const getUiAudioContext = () => {
        if (!uiAudioContext) {
            uiAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (uiAudioContext.state === "suspended") {
            uiAudioContext.resume().catch(() => {});
        }
        return uiAudioContext;
    };

    const playUiClick = (target) => {
        const context = getUiAudioContext();
        const now = context.currentTime;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const isEntry = target.closest(".entry-choice");
        const isTrack = target.closest(".play-btn, .track-item, #player-toggle");
        const isUtility = target.closest(".translate-btn, .tracklist-toggle-btn");

        oscillator.type = isEntry ? "sawtooth" : "square";
        oscillator.frequency.setValueAtTime(isEntry ? 118 : isTrack ? 176 : isUtility ? 245 : 210, now);
        oscillator.frequency.exponentialRampToValueAtTime(isEntry ? 72 : 92, now + 0.075);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(isEntry ? 0.075 : 0.045, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
    };

    const attemptIntroAudio = () => {
        if (!introAudioWanted || entryScreen?.classList.contains("hidden")) return;
        bgAudio.volume = playerVolume;
        bgAudio.play()
            .then(() => setBgButtonState(true))
            .catch(() => {
                setBgButtonState(false);
            });
    };

    window.addEventListener("unreal:boot-complete", attemptIntroAudio, { once: true });

    const unlockIntroAudio = () => {
        attemptIntroAudio();
        document.removeEventListener("pointerdown", unlockIntroAudio, true);
        document.removeEventListener("keydown", unlockIntroAudio, true);
    };

    document.addEventListener("pointerdown", unlockIntroAudio, true);
    document.addEventListener("keydown", unlockIntroAudio, true);

    document.addEventListener("pointerdown", event => {
        const interactive = event.target.closest("button, a, .track-item, input[type='range']");
        if (!interactive) return;
        playUiClick(interactive);
    }, true);

    document.addEventListener("click", event => {
        if (event.detail !== 0) return;
        const interactive = event.target.closest("button, a, .track-item");
        if (interactive) playUiClick(interactive);
    });

    const setBgButtonState = (isPlaying) => {
        isBgPlaying = isPlaying;
        playToggleBtn.innerHTML = `<span class="icon">${isPlaying ? "PAUSE AUDIO" : "PLAY AUDIO"}</span>`;
        playToggleBtn.setAttribute("aria-pressed", String(isPlaying));
    };

    const setVolume = (nextVolume) => {
        playerVolume = Math.min(1, Math.max(0, Number(nextVolume.toFixed(2))));
        bgAudio.volume = playerVolume;
        trackAudio.volume = playerVolume;
        const volumePercent = Math.round(playerVolume * 100);
        if (volumeReadout) {
            volumeReadout.textContent = `${volumePercent}%`;
        }
        if (volumeRange) {
            volumeRange.value = volumePercent;
            volumeRange.style.setProperty("--range-progress", `${volumePercent}%`);
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
        progressBar.style.setProperty("--range-progress", "0%");
        currTimeEl.textContent = "0:00";
        totTimeEl.textContent = "0:00";
        playerToggle.textContent = PLAY_ICON;
        playerToggle.setAttribute("aria-label", "Play current track");
        sitePlayer.classList.remove("is-playing");
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
        sitePlayer.classList.toggle("is-playing", isPlaying);

        document.querySelectorAll(".album-disc").forEach(disc => {
            disc.classList.remove("is-playing");
        });

        if (isPlaying && currentTrackItem) {
            currentTrackItem.closest(".disco-card")?.querySelector(".album-disc")?.classList.add("is-playing");
        }
    };

    const playTrackAudio = (item) => {
        const playRequest = trackAudio.play();
        if (!playRequest) return;

        playRequest.catch(error => {
            console.error("Error reproduciendo track:", error);
            item?.classList.remove("playing");
            item?.classList.add("paused");
            setTrackButtonState(item, false);
            setPlayerPlaybackState(false);
        });
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

                ctx.fillStyle = index % 5 === 0 ? "#e0e0e0" : "#FF003C";
                ctx.fillRect(x, y, Math.max(1, barWidth - 2), barHeight);
            });

            ctx.strokeStyle = "rgba(255, 0, 60, 0.65)";
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
        introAudioWanted = !entryScreen?.classList.contains("hidden");
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
                    playTrackAudio(this);
                    activateAudioEngine();
                    this.classList.remove("paused");
                    this.classList.add("playing");
                    setTrackButtonState(this, true);
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
            progressBar.style.setProperty("--range-progress", "0%");
            setPlayerTrack(this);

            trackAudio.src = src;
            currentTrackItem = this;
            playTrackAudio(this);
            activateAudioEngine();

            // Visual feedback
            clearTrackState();
            this.classList.add("playing");
            setTrackButtonState(this, true);
        });
    });

    trackAudio.addEventListener('timeupdate', () => {
        if (trackAudio.duration) {
            const progress = (trackAudio.currentTime / trackAudio.duration) * 100;
            progressBar.value = progress;
            progressBar.style.setProperty("--range-progress", `${progress}%`);
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
        setPlayerPlaybackState(false);
        resetProgress();
    });

    trackAudio.addEventListener("play", () => setPlayerPlaybackState(true));
    trackAudio.addEventListener("pause", () => setPlayerPlaybackState(false));
    trackAudio.addEventListener("waiting", () => {
        if (!trackAudio.paused) sitePlayer.classList.add("is-buffering");
    });
    trackAudio.addEventListener("playing", () => {
        sitePlayer.classList.remove("is-buffering");
        setPlayerPlaybackState(true);
    });
    trackAudio.addEventListener("canplay", () => {
        sitePlayer.classList.remove("is-buffering");
    });
    trackAudio.addEventListener("error", () => {
        sitePlayer.classList.remove("is-buffering");
        setPlayerPlaybackState(false);
        if (currentTrackItem) {
            currentTrackItem.classList.remove("playing");
            currentTrackItem.classList.add("paused");
            setTrackButtonState(currentTrackItem, false);
        }
    });

    progressBar.addEventListener('input', (e) => {
        if (!trackAudio.duration) return;
        trackAudio.currentTime = (e.target.value / 100) * trackAudio.duration;
        progressBar.style.setProperty("--range-progress", `${e.target.value}%`);
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
    volumeRange?.addEventListener("input", event => {
        setVolume(Number(event.target.value) / 100);
    });

    playerToggle.addEventListener("click", () => {
        if (!currentTrackItem) return;

        if (trackAudio.paused) {
            bgAudio.pause();
            setBgButtonState(false);
            if (trackAudio.ended) {
                trackAudio.currentTime = 0;
            }
            playTrackAudio(currentTrackItem);
            activateAudioEngine();
            currentTrackItem.classList.remove("paused");
            currentTrackItem.classList.add("playing");
            setTrackButtonState(currentTrackItem, true);
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

    // 7. Interactive archive covers: 3D flip, pointer glow and tactile click feedback
    const archiveCards = document.querySelectorAll(".disco-card");

    archiveCards.forEach((card, index) => {
        const cover = card.querySelector(".card-image-wrapper");
        const title = card.querySelector(".album-title")?.textContent.trim() || "Unknown archive";
        const meta = card.querySelector(".album-meta")?.textContent.trim() || "Unrealcxre archive";
        const type = card.querySelector(".release-type")?.textContent.trim() || "Release";
        const tracks = card.querySelectorAll(".track-item").length;

        if (cover) {
            const back = document.createElement("div");
            back.className = "card-back";
            back.setAttribute("aria-hidden", "true");
            back.innerHTML = `
                <span class="card-back-code">FILE_${String(index + 1).padStart(2, "0")} // ${type}</span>
                <strong class="card-back-title">${title}</strong>
                <div class="card-back-stats">
                    <span>${tracks || "--"} TRACKS</span>
                    <span>175 SIGNAL</span>
                </div>
                <span class="card-back-hint">${meta}<br>click to return</span>
            `;
            cover.append(back);
            cover.setAttribute("role", "button");
            cover.setAttribute("tabindex", "0");
            cover.setAttribute("aria-label", `Flip ${title} cover`);
            cover.setAttribute("aria-pressed", "false");

            const flipCover = () => {
                const isFlipped = cover.classList.toggle("is-flipped");
                cover.setAttribute("aria-pressed", String(isFlipped));
                back.setAttribute("aria-hidden", String(!isFlipped));
            };

            cover.addEventListener("click", flipCover);
            cover.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    flipCover();
                }
            });
        }

        card.addEventListener("pointermove", event => {
            if (event.pointerType === "touch") return;

            const bounds = card.getBoundingClientRect();
            const x = event.clientX - bounds.left;
            const y = event.clientY - bounds.top;
            const normalizedX = x / bounds.width - 0.5;
            const normalizedY = y / bounds.height - 0.5;

            card.style.setProperty("--pointer-x", `${x}px`);
            card.style.setProperty("--pointer-y", `${y}px`);
            card.style.setProperty("--tilt-x", `${normalizedY * -3.5}deg`);
            card.style.setProperty("--tilt-y", `${normalizedX * 4.5}deg`);
        });

        card.addEventListener("pointerleave", () => {
            card.style.setProperty("--tilt-x", "0deg");
            card.style.setProperty("--tilt-y", "0deg");
        });
    });

    const revealTargets = document.querySelectorAll(
        ".section-title, .smart-link, .disco-card, .collab-card, .art-card"
    );

    if ("IntersectionObserver" in window) {
        revealTargets.forEach(target => target.classList.add("reveal-ready"));
        const revealObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });

        revealTargets.forEach(target => revealObserver.observe(target));
    }

    document.addEventListener("pointerdown", event => {
        if (!event.target.closest("button, a, .card-image-wrapper, .track-item")) return;

        const burst = document.createElement("span");
        burst.className = "click-burst";
        burst.style.left = `${event.clientX}px`;
        burst.style.top = `${event.clientY}px`;
        document.body.append(burst);
        burst.addEventListener("animationend", () => burst.remove(), { once: true });
    });
});
