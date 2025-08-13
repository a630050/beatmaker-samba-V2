       const NOTE_NAMES = {
			12: "附點4分", 8: "4分", 6: "附點8分", 4: "8分",
			3: "附點16分", 2: "16分", 1: "32分"
		};

        class AudioCache {
            constructor() { this.cache = new Map(); }
            async getSample(url, audioContext) {
                if (this.cache.has(url)) { return this.cache.get(url); }
                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const arrayBuffer = await response.arrayBuffer();
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    this.cache.set(url, audioBuffer);
                    return audioBuffer;
                } catch (error) {
                    console.error(`Failed to load or decode audio from ${url}:`, error);
                    return null;
                }
            }
        }

        class Beatmaker {
            constructor() {
				this.audioCache = new AudioCache();
			    this.maxTracks = 16;
				this.minTracks = 4;
                this.isPlaying = false;
				this.colorHintMode = null;
                this.currentStep = 0;
                this.currentTrack = 0;
                this.bpm = 65;
				this.globalVolume = 0.8;
				this.accentVolumeMultiplier = 5.0;
				this.ghostVolumeMultiplier = 0.3;
                this.mode = 'ensemble';
                this.showNumbers = false;
				this.showMarkers = false;
				this.showAccents = true;
				this.stepInterval = null;
                this.tracks = [];
                this.totalBeats = 8;
                this.minBeats = 4;
                this.stepsPerBeat = 4;
                this.selectionMode = false;
				this.selection = { startTrack: null, startStep: null, endTrack: null, endStep: null };
                this.clipboard = { pattern: null };
				this.markingMode = false;
				this.currentMarker = 'eraser';
				this.currentAccent = null;
                this.history = [];
                this.historyIndex = -1;
                this.maxHistory = 50;
				this.metronome = {
                    enabled: false,
                    mode: 'sequential', // 'sequential' 或 'single'
                    color: '#00ff88',
                    sound: 'click1', // 'click1', 'click2', 'beep', 'none'
                    volume: 0.7
                };
                this.metronomeSounds = {};
                this.defaultTrackLabels  = ['S1', 'S2', 'S3', 'C', 'C', 'R', 'R', 'A'];
                this.defaultDrums = ['surdo1', 'surdo2', 'surdo3', 'caixa', 'caixa', 'repinique', 'repinique', 'agogo'];
                this.initDrumSounds();
				this.initMetronomeSounds();
                this.audioContext = null;
                this.initAudio().then(() => { this.loadDefaultSamples(); });
                this.initTracks();
                this.initUI();
				document.querySelector('.container').classList.toggle('accents-visible', this.showAccents);
				document.addEventListener('visibilitychange', () => {
					if (document.visibilityState === 'visible' && this.audioContext && this.audioContext.state === 'suspended') {
						this.audioContext.resume().catch(e => console.warn('Failed to resume audio on visibility change:', e));
					}
				});
            }

            getDefaultSoundParams() {
                 return { gain: 0.8, pan: 0, detune: 0, attack: 0.01, release: 0.4, filterFreq: 12000, filterQ: 1, synthType: 'triangle', synthBaseFreq: 100, mode: 'synth', defaultSampleUrl: '', defaultSampleBuffer: null, isLoadingDefault: false, userSampleBuffer: null, userSampleFileName: '' };
            }

			initDrumSounds() {
                this.drumSounds = {
                    'surdo1': { name: 'Surdo 1', gain: 1, pan: 0, detune: 0, attack: 0.01, release: 0.8, filterFreq: 12000, filterQ: 1, synthType: "triangle", synthBaseFreq: 55, mode: "system", defaultSampleUrl: "https://a630050.github.io/beatmaker-samba-V2/sounds/Surdo.mp3", defaultSampleBuffer: null, isLoadingDefault: false, userSampleBuffer: null, userSampleFileName: "" },
                    'surdo2': { name: 'Surdo 2', gain: 0.9, pan: 0, detune: 100, attack: 0.01, release: 0.7, filterFreq: 12000, filterQ: 1, synthType: "triangle", synthBaseFreq: 65, mode: "system", defaultSampleUrl: "https://a630050.github.io/beatmaker-samba-V2/sounds/Surdo.mp3", defaultSampleBuffer: null, isLoadingDefault: false, userSampleBuffer: null, userSampleFileName: "" },
                    'surdo3': { name: 'Surdo 3', gain: 0.8, pan: 0, detune: 300, attack: 0.01, release: 0.6, filterFreq: 12000, filterQ: 1, synthType: "triangle", synthBaseFreq: 75, mode: "system", defaultSampleUrl: "https://a630050.github.io/beatmaker-samba-V2/sounds/Surdo.mp3", defaultSampleBuffer: null, isLoadingDefault: false, userSampleBuffer: null, userSampleFileName: "" },
                    'caixa': { name: 'Caixa', gain: 0.6, pan: 0, detune: 0, attack: 0.01, release: 0.2, filterFreq: 12000, filterQ: 1, synthType: "square", synthBaseFreq: 250, mode: "system", defaultSampleUrl: "https://a630050.github.io/beatmaker-samba-V2/sounds/Caixa.mp3", defaultSampleBuffer: null, isLoadingDefault: false, userSampleBuffer: null, userSampleFileName: "" },
                    'caixa-drag': { name: 'Caixa (拖拍)', gain: 0.7, pan: 0, detune: 0, attack: 0.01, release: 0.4, filterFreq: 12000, filterQ: 1, synthType: "square", synthBaseFreq: 250, mode: "synth", defaultSampleUrl: "", defaultSampleBuffer: null, isLoadingDefault: false, userSampleBuffer: null, userSampleFileName: "", dragBounces: 5, dragDuration: 0.15, dragGainDecay: 0.5, dragTimeStretch: 1.4 },
                    'repinique': { name: 'Repinique', gain: 0.7, pan: 0, detune: 0, attack: 0.01, release: 0.4, filterFreq: 12000, filterQ: 1, synthType: "triangle", synthBaseFreq: 220, mode: "system", defaultSampleUrl: "https://a630050.github.io/beatmaker-samba-V2/sounds/Repinique.mp3", defaultSampleBuffer: null, isLoadingDefault: false, userSampleBuffer: null, userSampleFileName: "" },
                    'repinique-drag': { name: 'Repinique (拖拍)', gain: 0.6, pan: 0, detune: 0, attack: 0.01, release: 0.3, filterFreq: 11000, filterQ: 1.2, synthType: "triangle", synthBaseFreq: 300, mode: "synth", defaultSampleUrl: "", defaultSampleBuffer: null, isLoadingDefault: false, userSampleBuffer: null, userSampleFileName: "", dragBounces: 6, dragDuration: 0.12, dragGainDecay: 0.6, dragTimeStretch: 1.3 },
                    'tamborim': { name: 'Tamborim', gain: 0.4, pan: 0, detune: 0, attack: 0.01, release: 0.15, filterFreq: 12000, filterQ: 1, synthType: "square", synthBaseFreq: 400, mode: "synth", defaultSampleUrl: "", defaultSampleBuffer: null, isLoadingDefault: false, userSampleBuffer: null, userSampleFileName: "" },
                    'agogo': { name: 'Agogô', gain: 1, pan: 0, detune: 0, attack: 0.001, release: 0.34, filterFreq: 1470, filterQ: 0.1, synthType: "sine", synthBaseFreq: 800, mode: "synth", defaultSampleUrl: "", defaultSampleBuffer: null, isLoadingDefault: false, userSampleBuffer: null, userSampleFileName: "" },
                    'pandeiro': { name: 'Pandeiro', gain: 0.5, pan: 0, detune: 0, attack: 0.01, release: 0.3, filterFreq: 12000, filterQ: 1, synthType: "triangle", synthBaseFreq: 300, mode: "synth", defaultSampleUrl: "", defaultSampleBuffer: null, isLoadingDefault: false, userSampleBuffer: null, userSampleFileName: "" },
                    'cuica': { name: 'Cuíca', gain: 0.5, pan: 0, detune: 0, attack: 0.01, release: 0.4, filterFreq: 12000, filterQ: 1, synthType: "sawtooth", synthBaseFreq: 180, mode: "synth", defaultSampleUrl: "", defaultSampleBuffer: null, isLoadingDefault: false, userSampleBuffer: null, userSampleFileName: "" }
                };
            }
			
            initMetronomeSounds() {
                this.metronomeSounds = {
                    'click1': { url: 'https://a630050.github.io/beatmaker-samba-V2/sounds/metronome-click.mp3', buffer: null },
                    'click2': { url: 'https://a630050.github.io/beatmaker-samba-V2/sounds/metronome-clave.mp3', buffer: null },
                    'beep': { type: 'synth', freq: 1000, wave: 'sine', release: 0.1 }
                };
            }			


            saveState(force = false) {
                const currentState = JSON.stringify({
                    tracks: this.tracks.map(track => ({
					    id: track.id,
						label: track.label,
                        drumType: track.drumType,
                        steps: track.steps,
                        markers: track.markers,
                        enabled: track.enabled,
                        soundEnabled: track.soundEnabled,
                        volume: track.volume
                    })),
                    totalBeats: this.totalBeats,
                    stepsPerBeat: this.stepsPerBeat
                });

                if (!force && this.history.length > 0 && currentState === this.history[this.historyIndex]) {
                    return;
                }

                if (this.historyIndex < this.history.length - 1) {
                    this.history.splice(this.historyIndex + 1);
                }

                this.history.push(currentState);
                this.historyIndex++;

                if (this.history.length > this.maxHistory) {
                    this.history.shift();
                    this.historyIndex--;
                }

                this.updateUndoRedoButtons();
            }

            loadState(stateString) {
                if (!stateString) return;
                const state = JSON.parse(stateString);

                this.totalBeats = state.totalBeats;
                this.stepsPerBeat = state.stepsPerBeat;

                this.tracks = state.tracks.map((trackData, index) => ({
                    ...trackData,
					label: trackData.label || this.defaultTrackLabels[index],
                    markers: trackData.markers || Array(this.totalBeats * this.stepsPerBeat).fill({})
                }));

                this.updateExpandButton();
                document.querySelectorAll('.beat-setting-btn[data-beat-setting]').forEach(btn => {
                    btn.classList.toggle('active', parseInt(btn.dataset.beatSetting) === this.stepsPerBeat);
                });
                this.renderTracks();
                this.updateStepSize();
                this.updateUndoRedoButtons();
            }

            undo() {
                if (this.historyIndex > 0) {
                    this.historyIndex--;
                    this.loadState(this.history[this.historyIndex]);
                }
            }

            redo() {
                if (this.historyIndex < this.history.length - 1) {
                    this.historyIndex++;
                    this.loadState(this.history[this.historyIndex]);
                }
            }

            updateUndoRedoButtons() {
                document.getElementById('undoBtn').disabled = this.historyIndex <= 0;
                document.getElementById('redoBtn').disabled = this.historyIndex >= this.history.length - 1;
            }

			async initAudio() {
				try {
					this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
					if (this.audioContext.state === 'suspended') {
						this.setupAudioContextResume();
					}
				} catch (e) {
					console.warn('Web Audio API not supported');
				}
			}

				async loadDefaultSamples() {
					for (const key in this.drumSounds) {
						const sound = this.drumSounds[key];
						if (sound.defaultSampleUrl && this.audioContext) {
							sound.isLoadingDefault = true;
							this.updateSoundControlUI(key);

							const buffer = await this.audioCache.getSample(sound.defaultSampleUrl, this.audioContext);

							if (buffer) {
								sound.defaultSampleBuffer = buffer;
								sound.mode = 'system';
							} else {
								sound.defaultSampleBuffer = null;
								sound.mode = 'synth';
							}
							sound.isLoadingDefault = false;
							this.updateSoundControlUI(key);
						} else {
							sound.mode = 'synth';
						}
					}
					
					if (this.audioContext) {
                        for (const key in this.metronomeSounds) {
                            const sound = this.metronomeSounds[key];
                            if (sound.url) {
                                sound.buffer = await this.audioCache.getSample(sound.url, this.audioContext);
                            }
                        }
                    }
					
					
					this.initSoundAdjustPanel();
				}

            setupAudioContextResume() {
                const resumeAudio = async () => {
                    if (this.audioContext && this.audioContext.state === 'suspended') {
                        try {
                            await this.audioContext.resume();
                        } catch (e) {
                            console.warn('Failed to resume audio context:', e);
                        }
                    }
                };
                const events = ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'];
                const resumeOnce = async () => {
                    await resumeAudio();
                    events.forEach(event => {
                        document.removeEventListener(event, resumeOnce);
                    });
                };
                events.forEach(event => {
                    document.addEventListener(event, resumeOnce, { once: true });
                });
            }

			initTracks() {
				const initialTrackCount = 8;
				this.tracks = Array(initialTrackCount).fill().map((_, i) => ({
					id: i,
					label: this.defaultTrackLabels[i] || `T${i + 1}`,
					drumType: this.defaultDrums[i] || 'agogo',
					steps: Array(this.totalBeats * this.stepsPerBeat).fill(false),
					markers: Array.from({ length: this.totalBeats * this.stepsPerBeat }, () => ({})),
					enabled: true,
					soundEnabled: true,
					volume: 0.8
				}));
			}

			addTrack() {
                if (this.tracks.length >= this.maxTracks) {
                    alert(`最多隻能有 ${this.maxTracks} 個軌道`);
                    return false;
                }

                if (this.isPlaying) this.stop();

                const newTrackIndex = this.tracks.length;
                const newTrack = {
                    id: newTrackIndex,
                    label: 'UN',
                    drumType: this.defaultDrums[newTrackIndex] || 'agogo',
                    steps: Array(this.totalBeats * this.stepsPerBeat).fill(false),
                    markers: Array.from({ length: this.totalBeats * this.stepsPerBeat }, () => ({})),
                    enabled: true,
                    soundEnabled: true,
                    volume: 0.8
                };

                this.tracks.push(newTrack);
                this.renderTracks();
                this.saveState();
                return true;
            }

            removeTrack(trackIndex) {
                if (this.tracks.length <= this.minTracks) {
                    alert(`最少需要保留 ${this.minTracks} 個軌道`);
                    return false;
                }

                if (!window.confirm(`確定要刪除軌道 "${this.tracks[trackIndex].label}" 嗎？`)) {
                    return false;
                }

                if (this.isPlaying) this.stop();

                this.tracks.splice(trackIndex, 1);

                this.tracks.forEach((track, index) => {
                    track.id = index;
                });

                this.renderTracks();
                this.saveState();
                return true;
            }

            initUI() {
                this.renderTracks();
                this.initSoundAdjustPanel();
                this.bindEvents();
                this.updateExpandButton();
                this.initScrollPosition();
                this.updateStepSize();
				this.updateBeatNumbers();
                this.saveState(true);
            }

            initScrollPosition() {
                const sequencer = document.querySelector('.tracks-sequencer');
                sequencer.scrollLeft = 0;
            }

			initSoundAdjustPanel() {
				const drumKeys = Object.keys(this.drumSounds);
				const container = document.getElementById('soundControlsContainer');

				container.innerHTML = '';

				drumKeys.forEach(key => {
					container.insertAdjacentHTML('beforeend', this.createSoundControlHTML(key));
				});

				this.bindSoundPanelEvents();
			}

            createSoundControlHTML(key) {
                const sound = this.drumSounds[key];
                const isSystemAvailable = !!sound.defaultSampleBuffer;
                const isSystemLoading = sound.isLoadingDefault;
                const isUserSampleLoaded = !!sound.userSampleBuffer;
				const isDragInstrument = key.includes('-drag');

                return `
                    <div class="sound-control-item" id="sound-control-item-${key}" data-drum="${key}">
                        <h4>${sound.name}</h4>

                        <div class="sound-mode-selector">
                            <label class="${!isSystemAvailable && !isSystemLoading ? 'disabled' : ''} ${isSystemLoading ? 'loading-indicator' : ''}">
                                <input type="radio" name="sound-mode-${key}" class="sound-mode-radio" value="system" ${sound.mode === 'system' ? 'checked' : ''} ${!isSystemAvailable ? 'disabled' : ''}>
                                <span>系統預設</span>
                            </label>
                            <label>
                                <input type="radio" name="sound-mode-${key}" class="sound-mode-radio" value="user" ${sound.mode === 'user' ? 'checked' : ''}>
                                <span>匯入音檔</span>
                            </label>
                            <label>
                                <input type="radio" name="sound-mode-${key}" class="sound-mode-radio" value="synth" ${sound.mode === 'synth' ? 'checked' : ''}>
                                <span>合成音效</span>
                            </label>
                        </div>

                        <div class="sample-controls" style="display: ${sound.mode === 'user' ? 'block' : 'none'}">
                            <input type="file" id="sample-input-${key}" class="file-input sample-input" data-drum="${key}" accept=".mp3,.wav,.ogg">
                            <button class="btn btn-small action-btn upload-sample-btn">匯入取樣</button>
                            <button class="btn btn-small warning remove-sample-btn" style="display: ${isUserSampleLoaded ? 'inline-block' : 'none'};">移除</button>
                            <span class="sample-file-name">${sound.userSampleFileName}</span>
                        </div>

                        <div class="unified-sound-params">
                            <label>
                                <div class="param-label-container"><span>音高 (Pitch)</span><span class="param-value-display">${sound.detune}</span></div>
                                <input type="range" min="-2400" max="2400" step="50" value="${sound.detune}" data-param="detune">
                            </label>
                             <label>
                                <div class="param-label-container"><span>聲像 (Pan)</span><span class="param-value-display">${sound.pan}</span></div>
                                <input type="range" min="-1" max="1" step="0.1" value="${sound.pan}" data-param="pan">
                            </label>
                            <label>
                                <div class="param-label-container"><span>增益 (Gain)</span><span class="param-value-display">${sound.gain}</span></div>
                                <input type="range" min="0" max="1.5" step="0.05" value="${sound.gain}" data-param="gain">
                            </label>
                             <label>
                                <div class="param-label-container"><span>起音 (Atk)</span><span class="param-value-display">${sound.attack}</span></div>
                                <input type="range" min="0.001" max="0.5" step="0.001" value="${sound.attack}" data-param="attack">
                            </label>
                            <label>
                                <div class="param-label-container"><span>釋放 (Rel)</span><span class="param-value-display">${sound.release}</span></div>
                                <input type="range" min="0.05" max="2" step="0.01" value="${sound.release}" data-param="release">
                            </label>
                            <label>
                                <div class="param-label-container"><span>濾波 (Freq)</span><span class="param-value-display">${sound.filterFreq}</span></div>
                                <input type="range" min="40" max="18000" step="10" value="${sound.filterFreq}" data-param="filterFreq">
                            </label>
                            <label>
                                <div class="param-label-container"><span>共振 (Q)</span><span class="param-value-display">${sound.filterQ}</span></div>
                                <input type="range" min="0.1" max="20" step="0.1" value="${sound.filterQ}" data-param="filterQ">
                            </label>
                            <label class="waveform-selector-label ${sound.mode !== 'synth' ? 'disabled' : ''}">
                                <span>波形 (Wave)</span>
                                <select data-param="synthType" ${sound.mode !== 'synth' ? 'disabled' : ''}>
                                    <option value="sine" ${sound.synthType === 'sine' ? 'selected' : ''}>正弦波</option>
                                    <option value="square" ${sound.synthType === 'square' ? 'selected' : ''}>方波</option>
                                    <option value="triangle" ${sound.synthType === 'triangle' ? 'selected' : ''}>三角波</option>
                                    <option value="sawtooth" ${sound.synthType === 'sawtooth' ? 'selected' : ''}>鋸齒波</option>
                                </select>
                            </label>
                        </div>

                        <div class="unified-sound-params drag-params" style="display: ${isDragInstrument ? 'grid' : 'none'}; border-top: 1px solid rgba(255,255,255,0.2); margin-top: 15px; padding-top: 15px;">
                             <label>
                                <div class="param-label-container"><span>彈跳次數</span><span class="param-value-display">${sound.dragBounces}</span></div>
                                <input type="range" min="2" max="15" step="1" value="${sound.dragBounces}" data-param="dragBounces">
                            </label>
                             <label>
                                <div class="param-label-container"><span>總時長</span><span class="param-value-display">${sound.dragDuration}</span></div>
                                <input type="range" min="0.05" max="0.5" step="0.01" value="${sound.dragDuration}" data-param="dragDuration">
                            </label>
                             <label>
                                <div class="param-label-container"><span>音量衰減</span><span class="param-value-display">${sound.dragGainDecay}</span></div>
                                <input type="range" min="0.2" max="0.9" step="0.05" value="${sound.dragGainDecay}" data-param="dragGainDecay">
                            </label>
                             <label>
                                <div class="param-label-container"><span>間隔拉伸</span><span class="param-value-display">${sound.dragTimeStretch}</span></div>
                                <input type="range" min="1.0" max="2.5" step="0.05" value="${sound.dragTimeStretch}" data-param="dragTimeStretch">
                            </label>
                        </div>

                        <div style="text-align: right; margin-top: 15px;">
                             <button class="test-btn">試聽</button>
                        </div>
                    </div>
                `;
            }


			renderTracks() {
				const trackControlsContainer = document.getElementById('trackControls');
				const trackStepsContainer = document.getElementById('trackSteps');

				if (!trackControlsContainer || !trackStepsContainer) {
					console.error("致命錯誤：找不到 'trackControls' 或 'trackSteps' 容器！");
					return;
				}

				trackControlsContainer.innerHTML = '';
				trackStepsContainer.innerHTML = '';

				this.tracks.forEach((track, trackIndex) => {
					const controlElement = document.createElement('div');
					controlElement.className = 'track-control-item';

					const drumOptions = Object.keys(this.drumSounds).map(key =>
						`<option value="${key}" ${track.drumType === key ? 'selected' : ''}>${this.drumSounds[key].name}</option>`
					).join('');

					controlElement.innerHTML = `
						<div class="track-number" data-track-index="${trackIndex}">${track.label}</div>
						<select class="drum-select" data-track="${trackIndex}">${drumOptions}</select>
						<div class="track-controls">
							<div class="track-control-btn notation-btn" data-track="${trackIndex}" title="將此軌道轉為樂譜">♫</div>
							<div class="track-control-btn enable-btn ${track.enabled ? 'active' : ''}" data-track="${trackIndex}" data-type="enable">●</div>
							<div class="track-control-btn sound-btn ${track.soundEnabled ? 'active' : ''}" data-track="${trackIndex}" data-type="sound">🔊</div>
							${this.tracks.length > this.minTracks ? `<div class="track-control-btn remove-btn" data-track="${trackIndex}" data-type="remove" title="刪除軌道" style="color:#e74c3c;">✖</div>` : ''}
						</div>
						<div class="volume-control">
							<input type="range" class="volume-slider" min="0" max="1" step="0.1" value="${track.volume}" data-track="${trackIndex}">
						</div>
					`;

					trackControlsContainer.appendChild(controlElement);

					const stepsElement = document.createElement('div');
					stepsElement.className = `track-steps ${!track.enabled ? 'disabled' : ''}`;

					const steps = track.steps.map((active, stepIndex) => {
						const marker = track.markers[stepIndex] || {};
						
						const handMarkerHTML = marker.hand ? `<span class="marker-text">${marker.hand}</span>` : '';
						const accentMarkerHTML = marker.accent ? `<span class="accent-marker">${marker.accent}</span>` : '';
                        const restMarkerHTML = marker.rest ? `<span class="rest-marker">${marker.rest}</span>` : '';

						let numberHTML = '';
						if (this.showNumbers && active) {
							const beatNumber = Math.floor(stepIndex / this.stepsPerBeat) + 1;
							numberHTML = beatNumber;
						}

						return `<div class="step ${active ? 'active' : ''} ${stepIndex % this.stepsPerBeat === 0 ? 'beat-marker' : ''}" data-track="${trackIndex}" data-step="${stepIndex}">${numberHTML}${handMarkerHTML}${accentMarkerHTML}${restMarkerHTML}</div>`;
					}).join('');

					stepsElement.innerHTML = `<div class="steps">${steps}</div>`;
					trackStepsContainer.appendChild(stepsElement);
				});
				this.updateColorHints();
			}

            updateExpandButton() {
                document.getElementById('reduceStartBtn').disabled = this.totalBeats <= this.minBeats;
                document.getElementById('reduceEndBtn').disabled = this.totalBeats <= this.minBeats;
                document.getElementById('beatsInfo').textContent = `${this.totalBeats}拍`;
            }

			bindEvents() {
			
				const accentSlider = document.getElementById('accentVolumeSlider');
				const accentDisplay = document.getElementById('accentVolumeDisplay');
				accentSlider.addEventListener('input', (e) => {
					const value = parseInt(e.target.value);
					this.accentVolumeMultiplier = value / 100;
					accentDisplay.textContent = value;
				});

				const ghostSlider = document.getElementById('ghostVolumeSlider');
				const ghostDisplay = document.getElementById('ghostVolumeDisplay');
				ghostSlider.addEventListener('input', (e) => {
					const value = parseInt(e.target.value);
					this.ghostVolumeMultiplier = value / 100;
					ghostDisplay.textContent = value;
				});
				
				document.getElementById('playBtn').addEventListener('click', () => this.togglePlay());
				document.getElementById('clearBtn').addEventListener('click', () => this.clearAll());
				document.getElementById('resetBtn').addEventListener('click', () => this.resetAll());
				document.getElementById('undoBtn').addEventListener('click', () => this.undo());
				document.getElementById('redoBtn').addEventListener('click', () => this.redo());

				document.getElementById('exportBtn').addEventListener('click', () => this.exportPattern());
				document.getElementById('importBtn').addEventListener('click', () => document.getElementById('fileInput').click());
				document.getElementById('exportMp3Btn').addEventListener('click', () => this.exportMP3());
				document.getElementById('fileInput').addEventListener('change', (e) => this.importPattern(e.target.files[0]));
				document.getElementById('addTrackBtn').addEventListener('click', () => this.addTrack());

				document.getElementById('collapseBtn').addEventListener('click', () => this.toggleControlsCollapse());

				document.getElementById('bpmInput').addEventListener('change', (e) => {
					this.bpm = parseInt(e.target.value);
					if (this.isPlaying) { this.stop(); this.play(); }
				});

				document.getElementById('globalVolumeInput').addEventListener('change', (e) => {
					const volumeValue = Math.max(0, Math.min(100, parseInt(e.target.value)));
					e.target.value = volumeValue;
					this.globalVolume = volumeValue / 100;
				});

				document.getElementById('showNumbers').addEventListener('change', (e) => {
					this.showNumbers = e.target.checked;
					this.renderTracks();
				});
				document.getElementById('showMarkersCheckbox').addEventListener('change', (e) => {
					this.showMarkers = e.target.checked;
					document.querySelector('.container').classList.toggle('markers-visible', this.showMarkers);
				});
				
				document.getElementById('showAccentsCheckbox').addEventListener('change', (e) => {
					this.showAccents = e.target.checked;
					document.querySelector('.container').classList.toggle('accents-visible', this.showAccents);
				});
				
				document.querySelectorAll('.mode-btn').forEach(btn => btn.addEventListener('click', (e) => this.handleModeChange(e)));
				
				document.querySelectorAll('.beat-setting-btn[data-beat-setting]').forEach(btn => btn.addEventListener('click', (e) => {
					document.querySelectorAll('.beat-setting-btn[data-beat-setting]').forEach(b => b.classList.remove('active'));
					e.target.classList.add('active');
					this.changeBeatSetting(parseInt(e.target.dataset.beatSetting));
				}));

				document.getElementById('expandBtn').addEventListener('click', () => this.expandBeats());
                document.getElementById('reduceStartBtn').addEventListener('click', () => this.reduceBeatsFromStart());
				document.getElementById('reduceEndBtn').addEventListener('click', () => this.reduceBeatsFromEnd());

				document.getElementById('positionIndicator').addEventListener('click', (e) => this.handleSeek(e));

				document.getElementById('selectBtn').addEventListener('click', () => this.toggleSelectionMode());
				document.getElementById('markBtn').addEventListener('click', () => this.toggleMarkingMode());

				document.getElementById('copySelectionBtn').addEventListener('click', () => this.copySelection());
				document.getElementById('pasteSelectionBtn').addEventListener('click', () => this.pasteSelection());
				document.getElementById('savePatternBtn').addEventListener('click', () => this.saveSelectionAsPattern());
				document.getElementById('loadPatternBtn').addEventListener('click', () => document.getElementById('patternFileInput').click());
				document.getElementById('patternFileInput').addEventListener('change', (e) => {
					this.loadPatternToClipboard(e.target.files[0]);
					e.target.value = '';
				});
                document.getElementById('convertNotationBtn').addEventListener('click', () => this.convertSelectionToNotation());

				document.getElementById('markerControls').addEventListener('click', (e) => {
					const btn = e.target.closest('.marker-btn');
					if (btn) {
						document.querySelectorAll('#markerControls .marker-btn.active').forEach(b => b.classList.remove('active'));
						btn.classList.add('active');

						if (btn.dataset.marker === 'eraser') {
							this.currentMarker = 'eraser';
							this.currentAccent = null;
						} else if (btn.dataset.marker === 'accent') {
							this.currentMarker = 'accent';
							this.currentAccent = btn.dataset.value;
						} else if (btn.dataset.marker === 'rest') {
                            this.currentMarker = 'rest';
                            this.currentAccent = null;
                        } else {
							this.currentMarker = btn.dataset.marker;
							this.currentAccent = null;
						}
					}
				});

				const sequencer = document.querySelector('.sequencer');
				sequencer.addEventListener('click', (e) => {
					if (e.target.classList.contains('notation-btn')) {
						const trackIndex = parseInt(e.target.dataset.track);
						this.convertSingleTrackToNotation(trackIndex);
						return; // 處理完畢，提前返回
					}
					if (e.target.classList.contains('step')) {
						this.handleStepClick(e.target);
					}
					if (e.target.classList.contains('track-control-btn')) {
						const trackIndex = parseInt(e.target.dataset.track);
						const type = e.target.dataset.type;
						if (type === 'remove') {
							this.removeTrack(trackIndex);
						} else {
							this.toggleTrackControl(trackIndex, type);
						}
					}
				});
                
                sequencer.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (e.target.classList.contains('step')) {
                        const trackIndex = parseInt(e.target.dataset.track);
                        const stepIndex = parseInt(e.target.dataset.step);
                        this.applyRestMarker(trackIndex, stepIndex, e.target);
                    }
                });

				sequencer.addEventListener('change', (e) => {
					let stateChanged = false;
					if (e.target.classList.contains('drum-select')) {
						this.tracks[parseInt(e.target.dataset.track)].drumType = e.target.value;
						stateChanged = true;
					}
					if (e.target.classList.contains('volume-slider')) {
						this.tracks[parseInt(e.target.dataset.track)].volume = parseFloat(e.target.value);
						stateChanged = true;
					}
					if (stateChanged) this.saveState();
				});

				sequencer.addEventListener('dblclick', (e) => {
					if (e.target.classList.contains('track-number')) {
						this.handleLabelDoubleClick(e.target);
					}
				});

				this.setupModalEvents('helpModal', 'helpBtn', 'closeHelpModal');
				this.setupModalEvents('soundPanelOverlay', 'soundAdjustBtn', 'closeSoundPanel');
                this.setupModalEvents('notationModal', null, 'closeNotationModal');
				
				// START: 新增節拍器 Modal 事件綁定
				this.setupModalEvents('metronomeModal', 'metronomeBtn', 'closeMetronomeModal');
                this.bindMetronomePanelEvents();
				
				
				document.getElementById('resetSounds').addEventListener('click', () => this.resetSounds());
				this.bindSoundPanelEvents();

				window.addEventListener('resize', () => {
					this.updateStepSize();
					setTimeout(() => this.updateBeatNumbers(), 50);
				});
				
                document.querySelectorAll('.color-hint-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const clickedBtn = e.currentTarget;
                        const hintMode = clickedBtn.dataset.hintMode;

                        if (clickedBtn.classList.contains('active')) {
                            clickedBtn.classList.remove('active');
                            this.colorHintMode = null;
                        } else {
                            document.querySelectorAll('.color-hint-btn').forEach(b => b.classList.remove('active'));
                            clickedBtn.classList.add('active');
                            this.colorHintMode = hintMode;
                        }
                        
                        this.updateColorHints();
                    });
                });
                
				this.setupKeyboardShortcuts();
			}

            handleSeek(event) {
                if (this.isPlaying) return;

                if (this.mode === 'sequential') {
                    const ensembleBtn = document.querySelector('.mode-btn[data-mode="ensemble"]');
                    if (ensembleBtn) ensembleBtn.click();
                }

                const indicator = event.currentTarget;
                const clickX = event.offsetX;
                
                const firstStepElement = document.querySelector('.step');
                if (!firstStepElement) return;

                const stepWidth = firstStepElement.offsetWidth;
                const gap = parseFloat(getComputedStyle(firstStepElement.parentElement).gap) || 2;
                const fullStepWidth = stepWidth + gap;

                const targetStep = Math.min(
                    Math.floor(clickX / fullStepWidth),
                    (this.totalBeats * this.stepsPerBeat) - 1
                );
                
                if (targetStep >= 0) {
                    this.currentStep = targetStep;
                    this.updateSeekHighlight(this.currentStep);
                    this.updateBeatNumbers();
                }
            }

            updateSeekHighlight(stepIndex) {
                document.querySelectorAll('.step.step-highlighted').forEach(el => el.classList.remove('step-highlighted'));

                if (stepIndex === null || this.isPlaying) return;

                document.querySelectorAll(`.step[data-step="${stepIndex}"]`).forEach(el => el.classList.add('step-highlighted'));
            }

            handleModeChange(event) {
                this.updateSeekHighlight(null);
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                event.target.classList.add('active');
                this.mode = event.target.dataset.mode;
                if (this.isPlaying) {
                    this.stop();
                    this.play();
                }
            }

            handleTrackParamChange(target) {
                const trackIndex = parseInt(target.dataset.track);
                if (target.classList.contains('drum-select')) {
                    this.tracks[trackIndex].drumType = target.value;
                } else if (target.classList.contains('volume-slider')) {
                    this.tracks[trackIndex].volume = parseFloat(target.value);
                }
                this.saveState();
            }

			toggleMarkingMode() {
				this.markingMode = !this.markingMode;

				if (this.markingMode && this.selectionMode) {
					this.toggleSelectionMode();
				}

				document.getElementById('markBtn').classList.toggle('toggled', this.markingMode);
				document.getElementById('markerControls').style.display = this.markingMode ? 'flex' : 'none';

				if (this.markingMode) {
					this.showMarkers = true;
					document.getElementById('showMarkersCheckbox').checked = true;
					document.querySelector('.container').classList.add('markers-visible');
				}
			}

            handleMarkerToolChange(btn) {
                document.querySelectorAll('#markerControls .marker-btn.active').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentMarker = btn.dataset.marker;
            }

            handleLabelDoubleClick(trackLabelDiv) {
                const trackIndex = parseInt(trackLabelDiv.dataset.trackIndex);
                const originalLabel = this.tracks[trackIndex].label;

                const input = document.createElement('input');
                input.type = 'text';
                input.value = originalLabel;
                input.maxLength = 2;

                trackLabelDiv.innerHTML = '';
                trackLabelDiv.appendChild(input);
                input.focus();
                input.select();

                const saveLabel = () => {
                    const newLabel = input.value.trim().toUpperCase();
                    trackLabelDiv.textContent = newLabel === '' ? originalLabel : newLabel;
                    if (newLabel !== '') {
                        this.tracks[trackIndex].label = newLabel;
                        this.saveState();
                    }
                    input.removeEventListener('blur', saveLabel);
                    input.removeEventListener('keydown', handleKeydown);
                };

                const handleKeydown = (evt) => {
                    if (evt.key === 'Enter') input.blur();
                    else if (evt.key === 'Escape') {
                        trackLabelDiv.textContent = originalLabel;
                        input.removeEventListener('blur', saveLabel);
                        input.removeEventListener('keydown', handleKeydown);
                    }
                };

                input.addEventListener('blur', saveLabel);
                input.addEventListener('keydown', handleKeydown);
            }
			
			// START: 新增 bindMetronomePanelEvents 方法
            bindMetronomePanelEvents() {
                const modal = document.getElementById('metronomeModal');
                
                // 啟用/停用
                modal.querySelectorAll('input[name="metronome-enabled"]').forEach(radio => {
                    radio.addEventListener('change', (e) => {
                        this.metronome.enabled = e.target.value === 'true';
                    });
                });

                // 模式
                modal.querySelectorAll('input[name="metronome-mode"]').forEach(radio => {
                    radio.addEventListener('change', (e) => {
                        this.metronome.mode = e.target.value;
                    });
                });

                // 顏色
                const colorPicker = document.getElementById('metronomeColorPicker');
                const presetBtns = modal.querySelectorAll('.color-preset-btn');
                
                const updateColor = (color) => {
                    this.metronome.color = color;
                    colorPicker.value = color;
                    document.documentElement.style.setProperty('--metronome-light-color', color);
                    presetBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.color === color));
                };

                presetBtns.forEach(btn => {
                    btn.addEventListener('click', () => updateColor(btn.dataset.color));
                });
                colorPicker.addEventListener('input', (e) => updateColor(e.target.value));

                // 聲音
                document.getElementById('metronomeSoundSelect').addEventListener('change', (e) => {
                    this.metronome.sound = e.target.value;
                });

                // 音量
                document.getElementById('metronomeVolumeSlider').addEventListener('input', (e) => {
                    this.metronome.volume = parseFloat(e.target.value);
                });
            }
            // END: 新增 bindMetronomePanelEvents 方法

            // START: 新增 updateMetronomeUI 方法
            updateMetronomeUI() {
                document.querySelector(`input[name="metronome-enabled"][value="${this.metronome.enabled}"]`).checked = true;
                document.querySelector(`input[name="metronome-mode"][value="${this.metronome.mode}"]`).checked = true;
                
                const color = this.metronome.color;
                document.getElementById('metronomeColorPicker').value = color;
                document.documentElement.style.setProperty('--metronome-light-color', color);
                document.querySelectorAll('.color-preset-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.color === color);
                });

                document.getElementById('metronomeSoundSelect').value = this.metronome.sound;
                document.getElementById('metronomeVolumeSlider').value = this.metronome.volume;
            }

            setupModalEvents(modalId, openBtnId, closeBtnId) {
                const modal = document.getElementById(modalId);
                if (!modal) return;
                
                const openBtn = openBtnId ? document.getElementById(openBtnId) : null;
                const closeBtn = closeBtnId ? document.getElementById(closeBtnId) : null;

                if (openBtn) {
                    openBtn.addEventListener('click', () => {
                        modal.style.display = 'flex';
                    });
                }
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        modal.style.display = 'none';
                    });
                }
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.style.display = 'none';
                    }
                });
            }


            bindSoundPanelEvents() {
                 const soundPanel = document.getElementById('soundAdjustPanel');
                 soundPanel.addEventListener('input', (e) => {
                    const controlItem = e.target.closest('.sound-control-item');
                    if (!controlItem) return;
                    const drumKey = controlItem.dataset.drum;

                    if (e.target.matches('[data-param]')) {
                        const param = e.target.dataset.param;
                        let value = e.target.type === 'range' ? parseFloat(e.target.value) : e.target.value;
                        this.drumSounds[drumKey][param] = value;

                        const display = e.target.previousElementSibling.querySelector('.param-value-display');
                        if(display) display.textContent = value;
                    }
                });

                soundPanel.addEventListener('change', (e) => {
                     const controlItem = e.target.closest('.sound-control-item');
                    if (!controlItem) return;
                    const drumKey = controlItem.dataset.drum;

                    if (e.target.classList.contains('sound-mode-radio')) {
                        this.handleSoundModeChange(drumKey, e.target.value);
                    }
                    if (e.target.classList.contains('sample-input')) {
                        this.handleSampleUpload(drumKey, e.target.files[0]);
                        e.target.value = '';
                    }
                });

                soundPanel.addEventListener('click', (e) => {
                    const controlItem = e.target.closest('.sound-control-item');
                    if (!controlItem) return;
                    const drumKey = controlItem.dataset.drum;

                    if (e.target.classList.contains('upload-sample-btn')) {
                        controlItem.querySelector('.sample-input').click();
                    }
                    if (e.target.classList.contains('remove-sample-btn')) {
                        this.removeSample(drumKey);
                    }
                    if (e.target.classList.contains('test-btn')) {
                        this.testSound(drumKey);
                    }
                });
            }

            updateStepSize() {
                const sequencer = document.querySelector('.tracks-sequencer');
                if (!sequencer) return;
                const styles = window.getComputedStyle(sequencer);
                const paddingX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
                const contentWidth = sequencer.clientWidth - paddingX;
                const isSmallScreen = window.innerWidth < 800;

                const MIN_STEP_SIZE = isSmallScreen ? 14 : 20;
                const MAX_STEP_SIZE = isSmallScreen ? 22 : 35;
                const STEP_GAP = isSmallScreen ? 1 : 2;
                const stepsToFit = 8 * this.stepsPerBeat;
                const totalGapWidth = (stepsToFit - 1) * STEP_GAP;
                const idealStepSize = (contentWidth - totalGapWidth) / stepsToFit;
                const finalStepSize = Math.max(MIN_STEP_SIZE, Math.min(MAX_STEP_SIZE, idealStepSize));
                document.documentElement.style.setProperty('--step-size', `${finalStepSize}px`);
            }

			toggleControlsCollapse() {
				const tracksControls = document.getElementById('tracksControls');
				const collapseBtn = document.getElementById('collapseBtn');
				tracksControls.classList.toggle('collapsed');

				if (tracksControls.classList.contains('collapsed')) {
					collapseBtn.textContent = '▶';
					collapseBtn.title = '展開控製麵板';
				} else {
					collapseBtn.textContent = '◀';
					collapseBtn.title = '摺疊控製麵板';
				}
                setTimeout(() => {
					this.updateStepSize();
					this.updateBeatNumbers();
				}, 300);
			}

            changeBeatSetting(newStepsPerBeat) {
                if (this.isPlaying) this.stop();
                this.clearSelection();
                const oldStepsPerBeat = this.stepsPerBeat;
                this.stepsPerBeat = newStepsPerBeat;

                this.tracks.forEach(track => {
                    const newSteps = Array(this.totalBeats * this.stepsPerBeat).fill(false);
                    if (track.steps.length > 0) {
                        for (let beat = 0; beat < this.totalBeats; beat++) {
                            if ((beat * oldStepsPerBeat) < track.steps.length) {
                                newSteps[beat * this.stepsPerBeat] = track.steps[beat * oldStepsPerBeat];
                            }
                        }
                    }
                    track.steps = newSteps;
                });
				
				this.currentStep = 0;
                this.renderTracks();
                this.updateStepSize();
				this.updateBeatNumbers();
                this.saveState();
            }

			toggleStep(trackIndex, stepIndex) {
                const track = this.tracks[trackIndex];
                const isBecomingActive = !track.steps[stepIndex];

                if (isBecomingActive) {
                    if (track.markers[stepIndex] && track.markers[stepIndex].rest) {
                        delete track.markers[stepIndex].rest;
                    }
                }

                track.steps[stepIndex] = isBecomingActive;
                
                this.renderTracks(); 
                this.saveState();
            }

            toggleTrackControl(trackIndex, type) {
                const track = this.tracks[trackIndex];
                const controlBtn = document.querySelector(`.track-control-btn[data-track="${trackIndex}"][data-type="${type}"]`);
                const stepsElement = document.querySelectorAll('.track-steps')[trackIndex];

                if (type === 'enable') {
                    track.enabled = !track.enabled;
                    controlBtn.classList.toggle('active', track.enabled);
                    stepsElement.classList.toggle('disabled', !track.enabled);
                } else if (type === 'sound') {
                    track.soundEnabled = !track.soundEnabled;
                    controlBtn.classList.toggle('active', track.soundEnabled);
                }
                this.saveState();
            }

			togglePlay() {
                if (this.selectionMode) this.toggleSelectionMode();
                if (this.isPlaying) {
                    this.pause();
                } else {
                    this.play();
                }
            }

            async play() {
				if (!this.audioContext) await this.initAudio();
				if (this.audioContext && this.audioContext.state === 'suspended') {
					try { await this.audioContext.resume(); } catch (e) { console.warn('Failed to resume audio context on play:', e); }
				}

                this.isPlaying = true;
				this.updateSeekHighlight(null);
                document.getElementById('playBtn').classList.add('active');
                document.getElementById('playBtn').textContent = '⏸ 暫停';
				
                if (this.mode === 'sequential') {
                    this.currentTrack = this.getFirstEnabledTrack();
                }

				this.snapScrollToCurrentStep();

                const stepDuration = (60 / this.bpm) / this.stepsPerBeat * 1000;

                this.updateStep();

                const totalSteps = this.totalBeats * this.stepsPerBeat;
                this.currentStep = (this.currentStep + 1) % totalSteps;
				if (this.currentStep === 0) {
					if (this.mode === 'sequential') this.currentTrack = this.getNextEnabledTrack();
				}

                this.stepInterval = setInterval(() => {
					this.updateStep();
					this.currentStep = (this.currentStep + 1) % totalSteps;
                    
					if (this.currentStep === 0) {
                        this.scrollToBeginning();
                        if (this.mode === 'sequential') {
                            this.currentTrack = this.getNextEnabledTrack();
                        }
                    }
                }, stepDuration);
            }
			
			
			pause() {
                this.isPlaying = false;
                document.getElementById('playBtn').classList.remove('active');
                document.getElementById('playBtn').textContent = '▶ 播放';
                if (this.stepInterval) clearInterval(this.stepInterval);
                this.stepInterval = null;
                document.querySelectorAll('.playing').forEach(el => el.classList.remove('playing'));
            }

			stop() {
                this.isPlaying = false;
                document.getElementById('playBtn').classList.remove('active');
                document.getElementById('playBtn').textContent = '▶ 播放';
                if (this.stepInterval) clearInterval(this.stepInterval);
                this.stepInterval = null;
                this.currentStep = 0;
                this.currentTrack = 0;
                this.scrollToBeginning();
                document.querySelectorAll('.playing').forEach(el => el.classList.remove('playing'));
				this.updateSeekHighlight(null);
                this.updateBeatNumbers();
            }

            updateStep() {
                this.updateBeatNumbers();
                this.autoScroll();
				
				if (this.currentStep % this.stepsPerBeat === 0) {
                    if (this.metronome.enabled) {
                        this.triggerMetronome();
                    }
                }
				
                if (this.mode === 'ensemble') {
                    this.tracks.forEach((track) => {
                        if (track.enabled && track.steps[this.currentStep] && !(track.markers[this.currentStep] && track.markers[this.currentStep].rest)) {
                            const marker = track.markers[this.currentStep] || {};
                            let volumeMultiplier = 1.0;
                            if (marker.accent === '>') {
                                volumeMultiplier = this.accentVolumeMultiplier;
                            } else if (marker.accent === '()') {
                                volumeMultiplier = this.ghostVolumeMultiplier;
                            }
                            this.playSound(track.drumType, track.soundEnabled, track.volume * volumeMultiplier);
                        }
                    });
                } else if (this.mode === 'sequential') {
                    const track = this.tracks[this.currentTrack];
                    if (track && track.enabled && track.steps[this.currentStep] && !(track.markers[this.currentStep] && track.markers[this.currentStep].rest)) {
						const marker = track.markers[this.currentStep] || {};
						let volumeMultiplier = 1.0;
						if (marker.accent === '>') {
							volumeMultiplier =  this.accentVolumeMultiplier;
						} else if (marker.accent === '()') {
							volumeMultiplier = this.ghostVolumeMultiplier;
						}
						this.playSound(track.drumType, track.soundEnabled, track.volume * volumeMultiplier);
                    }
                }
            }

            getFirstEnabledTrack() {
                const firstEnabled = this.tracks.findIndex(t => t.enabled);
                return firstEnabled !== -1 ? firstEnabled : 0;
            }

            getNextEnabledTrack() {
                let nextTrack = this.currentTrack;
                for (let i = 0; i < this.tracks.length; i++) {
                    nextTrack = (nextTrack + 1) % this.tracks.length;
                    if (this.tracks[nextTrack].enabled) return nextTrack;
                }
                return this.getFirstEnabledTrack();
            }
			
			triggerMetronome() {
                const lights = document.querySelectorAll('.metronome-light');
                if (!lights.length) return;
                
                this.playMetronomeSound();

                const beatInMeasure = Math.floor(this.currentStep / this.stepsPerBeat) % 4;

                lights.forEach(light => light.classList.remove('active'));

                if (this.metronome.mode === 'sequential') {
                    if (lights[beatInMeasure]) {
                        lights[beatInMeasure].classList.add('active');
                    }
                } else { // 'single' mode
                    lights.forEach(light => light.classList.add('active'));
                }

                setTimeout(() => {
                    lights.forEach(light => light.classList.remove('active'));
                }, 100);
            }
            // END: 新增 triggerMetronome 方法

            // START: 新增 playMetronomeSound 方法
            playMetronomeSound() {
                if (!this.audioContext || this.metronome.sound === 'none') return;
                
                const soundInfo = this.metronomeSounds[this.metronome.sound];
                if (!soundInfo) return;

                const time = this.audioContext.currentTime;
                
                if (soundInfo.buffer) { // 播放音檔
                    const source = this.audioContext.createBufferSource();
                    source.buffer = soundInfo.buffer;
                    const gainNode = this.audioContext.createGain();
                    gainNode.gain.value = this.metronome.volume;
                    source.connect(gainNode).connect(this.audioContext.destination);
                    source.start(time);
                } else if (soundInfo.type === 'synth') { // 播放合成音
                    const osc = this.audioContext.createOscillator();
                    const gainNode = this.audioContext.createGain();

                    osc.type = soundInfo.wave;
                    osc.frequency.setValueAtTime(soundInfo.freq, time);
                    
                    gainNode.gain.setValueAtTime(0, time);
                    gainNode.gain.linearRampToValueAtTime(this.metronome.volume, time + 0.01);
                    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + soundInfo.release);

                    osc.connect(gainNode).connect(this.audioContext.destination);
                    osc.start(time);
                    osc.stop(time + soundInfo.release);
                }
            }
            // END: 新增 playMetronomeSound 方法


			updateBeatNumbers() {
				const positionLine = document.getElementById('positionLine');
				const trackStepsContainer = document.getElementById('trackSteps');
				if (!trackStepsContainer) return;

				const firstStep = trackStepsContainer.querySelector('.step');

				if (firstStep) {
					const stepWidth = firstStep.offsetWidth;
					const gap = parseFloat(getComputedStyle(firstStep.parentElement).gap) || 2;
					const totalStepWidth = stepWidth + gap;
					positionLine.style.left = `${this.currentStep * totalStepWidth}px`;
					document.documentElement.style.setProperty('--step-size', `${stepWidth}px`);
				}

				document.querySelectorAll('.step.playing').forEach(el => el.classList.remove('playing'));

				if (this.isPlaying) {
					if (this.mode === 'ensemble') {
						document.querySelectorAll(`.step[data-step="${this.currentStep}"]`).forEach(el => el.classList.add('playing'));
					} else {
						document.querySelectorAll(`.step[data-track="${this.currentTrack}"][data-step="${this.currentStep}"]`).forEach(el => el.classList.add('playing'));
					}
				}
			}
			
			
			updateColorHints() {
                document.querySelectorAll('.step.active.step-dimmed').forEach(el => el.classList.remove('step-dimmed'));

                if (!this.colorHintMode) return;

                this.tracks.forEach((track, trackIndex) => {
                    track.steps.forEach((isActive, stepIndex) => {
                        if (!isActive) return;

                        const marker = track.markers[stepIndex] || {};
                        let shouldDim = false;

                        if (this.colorHintMode === 'lr' && marker.hand === 'L') {
                            shouldDim = true;
                        } else if (this.colorHintMode === 'accent' && marker.accent === '()') {
                            shouldDim = true;
                        }

                        if (shouldDim) {
                            const stepEl = document.querySelector(`.step[data-track="${trackIndex}"][data-step="${stepIndex}"]`);
                            if (stepEl) stepEl.classList.add('step-dimmed');
                        }
                    });
                });
            }

            scrollToBeginning() {
                document.querySelector('.tracks-sequencer').scrollTo({ left: 0, behavior: 'smooth' });
            }

            snapScrollToCurrentStep() {
                const sequencer = document.querySelector('.tracks-sequencer');
                const firstStep = document.querySelector('.step');
                if (!firstStep || !sequencer) return;

                const stepWidth = firstStep.offsetWidth;
                const gap = parseFloat(getComputedStyle(firstStep.parentElement).gap) || 2;
                const fullStepWidth = stepWidth + gap;

                const scrollTarget = this.currentStep * fullStepWidth;
                const scrollOffset = sequencer.clientWidth / 4;
                
                sequencer.scrollTo({ 
                    left: scrollTarget - scrollOffset, 
                    behavior: 'smooth' 
                });
            }

			autoScroll() {
				const sequencer = document.querySelector('.tracks-sequencer');
				const trackStepsContainer = document.getElementById('trackSteps');
				const firstStep = trackStepsContainer ? trackStepsContainer.querySelector('.step') : null;

				if (!firstStep || !sequencer) return;

				const stepWidth = firstStep.offsetWidth;
				const gap = parseFloat(getComputedStyle(firstStep.parentElement).gap) || 2;
				const fullStepWidth = stepWidth + gap;
				const scrollLeft = sequencer.scrollLeft;
				const clientWidth = sequencer.clientWidth;
				const playheadPosition = this.currentStep * fullStepWidth;
				const scrollTriggerPoint = scrollLeft + (clientWidth * 0.8);

				if (playheadPosition > scrollTriggerPoint && (scrollLeft + clientWidth) < sequencer.scrollWidth) {
					const newScrollLeft = playheadPosition - (clientWidth * 0.1);
					sequencer.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
				}
			}

			scrollToBeats(startBeat) {
				const sequencer = document.querySelector('.tracks-sequencer');
				const trackStepsContainer = document.getElementById('trackSteps');
				const firstStep = trackStepsContainer ? trackStepsContainer.querySelector('.step') : null;

				if (!firstStep || !sequencer) return;

				const stepWidth = firstStep.offsetWidth;
				const gap = parseFloat(getComputedStyle(firstStep.parentElement).gap) || 2;
				const fullStepWidth = stepWidth + gap;
				const scrollTarget = (startBeat - 1) * this.stepsPerBeat * fullStepWidth;
				sequencer.scrollTo({ left: scrollTarget, behavior: 'smooth' });
			}

			expandBeats(beatsToAdd = 4) {
				if (this.isPlaying) this.stop();
				const oldBeats = this.totalBeats;
				this.totalBeats += beatsToAdd;
				this.tracks.forEach(track => {
					track.steps.push(...Array(beatsToAdd * this.stepsPerBeat).fill(false));
					track.markers.push(...Array.from({ length: beatsToAdd * this.stepsPerBeat }, () => ({})));
				});
				this.renderTracks();
				this.updateExpandButton();
				this.updateSelectionUI();
				setTimeout(() => this.scrollToBeats(oldBeats + 1), 100);
				this.saveState();
			}

			reduceBeatsFromEnd() {
				if (this.totalBeats <= this.minBeats) return;
				if (this.isPlaying) this.stop();
				this.clearSelection();

				const beatsToRemove = 4;
				this.totalBeats -= beatsToRemove;
				this.tracks.forEach(track => {
					track.steps.length = this.totalBeats * this.stepsPerBeat;
					track.markers.length = this.totalBeats * this.stepsPerBeat;
				});

				if (this.currentStep >= this.totalBeats * this.stepsPerBeat) {
					this.currentStep = 0;
					this.updateBeatNumbers();
				}
				
				this.renderTracks();
				this.updateExpandButton();
				setTimeout(() => {
					const sequencer = document.querySelector('.tracks-sequencer');
					const maxScroll = sequencer.scrollWidth - sequencer.clientWidth;
					if (sequencer.scrollLeft > maxScroll) {
						sequencer.scrollTo({ left: maxScroll, behavior: 'smooth' });
					}
				}, 100);
				this.saveState();
			}
            
            reduceBeatsFromStart() {
                if (this.totalBeats <= this.minBeats) return;
                if (this.isPlaying) this.stop();
                this.clearSelection();

                const beatsToRemove = 4;
                const stepsToRemove = beatsToRemove * this.stepsPerBeat;
                this.totalBeats -= beatsToRemove;

                this.tracks.forEach(track => {
                    track.steps.splice(0, stepsToRemove);
                    track.markers.splice(0, stepsToRemove);
                });
                
                this.currentStep = 0;
                this.updateBeatNumbers();
                this.renderTracks();
                this.updateExpandButton();
                this.saveState();
            }

            testSound(drumType) {
                this.playSound(drumType, true, 0.8);
            }

            async playSound(drumType, soundEnabled = true, volume = 0.8) {
                if (!soundEnabled) return;
                if (!this.audioContext) await this.initAudio();
                 if (this.audioContext.state === 'suspended') {
                    try { await this.audioContext.resume(); } catch (e) { console.warn('Failed to resume audio context in playSound:', e); return; }
                }
                if (this.audioContext.state !== 'running') return;

                const now = this.audioContext.currentTime;
                this.scheduleSound(this.audioContext, now, drumType, soundEnabled, volume);
            }
            
            applyRestMarker(trackIndex, stepIndex, stepElement) {
                const track = this.tracks[trackIndex];
                if (!track) return;
                
                const currentMarker = track.markers[stepIndex] || {};

                // Toggle rest marker
                if (currentMarker.rest) {
                    delete currentMarker.rest;
                } else {
                    currentMarker.rest = '-';
                    // If the step is active, deactivate it
                    if (track.steps[stepIndex]) {
                        track.steps[stepIndex] = false;
                    }
                }

                track.markers[stepIndex] = currentMarker;
                
                this.renderTracks();
                this.saveState();
            }

			handleStepClick(stepElement) {
				const trackIndex = parseInt(stepElement.dataset.track);
				const stepIndex = parseInt(stepElement.dataset.step);

                if (this.markingMode) {
                    let markerObj = this.tracks[trackIndex].markers[stepIndex] || {};

                    // Clear all other markers if placing a new one
                    const isErasing = this.currentMarker === 'eraser';
                    
                    if (this.currentMarker === 'rest') {
                        if (markerObj.rest) {
                            delete markerObj.rest;
                        } else {
                            markerObj = { rest: '-' }; // Reset object to only have rest
                            if (this.tracks[trackIndex].steps[stepIndex]) {
                                this.tracks[trackIndex].steps[stepIndex] = false;
                            }
                        }
                    } else if (this.currentMarker === 'accent') {
                        if (markerObj.accent === this.currentAccent) {
                             delete markerObj.accent;
                        } else {
                            delete markerObj.rest;
                            markerObj.accent = this.currentAccent;
                        }
                    } else if (this.currentMarker === 'R' || this.currentMarker === 'L') {
                         if (markerObj.hand === this.currentMarker) {
                             delete markerObj.hand;
                        } else {
                            delete markerObj.rest;
                            markerObj.hand = this.currentMarker;
                        }
                    } else if (isErasing) {
                        markerObj = {};
                    }

                    this.tracks[trackIndex].markers[stepIndex] = markerObj;
                    this.renderTracks();
                    this.saveState();
                    return;
                }

				if (this.selectionMode) {
					const isSelectionMade = this.selection.startTrack !== null &&
										  (this.selection.startTrack !== this.selection.endTrack ||
										   this.selection.startStep !== this.selection.endStep);

					if (isSelectionMade) {
						this.clearSelection();
					}

					if (this.selection.startTrack === null) {
						this.selection.startTrack = trackIndex;
						this.selection.startStep = stepIndex;
						this.selection.endTrack = trackIndex;
						this.selection.endStep = stepIndex;
					} else {
						this.selection.endTrack = trackIndex;
						this.selection.endStep = stepIndex;
					}
					this.updateSelectionUI();
				} else {
					this.toggleStep(trackIndex, stepIndex);
				}
			}



            toggleSelectionMode() {
                this.selectionMode = !this.selectionMode;

				if (this.selectionMode && this.markingMode) {
					this.toggleMarkingMode();
				}

                document.getElementById('selectBtn').classList.toggle('toggled', this.selectionMode);
                document.getElementById('selectionControls').style.display = this.selectionMode ? 'flex' : 'none';

                if (!this.selectionMode) {
                    this.clearSelection();
                } else {
                    this.clearSelection();
                }
            }

            clearSelection() {
                this.selection.startTrack = null;
                this.selection.startStep = null;
                this.selection.endTrack = null;
                this.selection.endStep = null;
                this.updateSelectionUI();
            }

            updateSelectionUI() {
                document.querySelectorAll('.step.selected').forEach(el => el.classList.remove('selected'));
                if (this.selection.startTrack === null) return;

                const startTrack = Math.min(this.selection.startTrack, this.selection.endTrack);
                const endTrack = Math.max(this.selection.startTrack, this.selection.endTrack);
                const startStep = Math.min(this.selection.startStep, this.selection.endStep);
                const endStep = Math.max(this.selection.startStep, this.selection.endStep);

                for (let t = startTrack; t <= endTrack; t++) {
                    for (let s = startStep; s <= endStep; s++) {
                        const el = document.querySelector(`.step[data-track="${t}"][data-step="${s}"]`);
                        if (el) el.classList.add('selected');
                    }
                }
            }

			copySelection() {
				if (this.selection.startTrack === null || this.selection.endTrack === null) {
					alert('請先點擊兩個格子來框選一個區域！');
					return;
				}

				const startTrack = Math.min(this.selection.startTrack, this.selection.endTrack);
				const endTrack = Math.max(this.selection.startTrack, this.selection.endTrack);
				const startStep = Math.min(this.selection.startStep, this.selection.endStep);
				const endStep = Math.max(this.selection.startStep, this.selection.endStep);

				const patternData = {
					steps: [],
					markers: []
				};

				for (let t = startTrack; t <= endTrack; t++) {
					patternData.steps.push(this.tracks[t].steps.slice(startStep, endStep + 1));
					patternData.markers.push(this.tracks[t].markers.slice(startStep, endStep + 1));
				}

				this.clipboard.pattern = patternData;
				alert(`已複製 ${endTrack - startTrack + 1} 軌 x ${endStep - startStep + 1} 格的樣式！`);
			}

			async pasteSelection() {
				if (!this.clipboard.pattern) {
					alert('剪貼簿是空的！請先複製或載入一個樣式。');
					return;
				}
				if (this.selection.startTrack === null ||
					this.selection.startTrack !== this.selection.endTrack ||
					this.selection.startStep !== this.selection.endStep) {
					alert('請先在目標音軌【單次點擊】一個儲存格作為貼上的左上角起點。');
					return;
				}

				const pasteStartTrack = this.selection.startTrack;
				const pasteStartStep = this.selection.startStep;

				const patternHeight = this.clipboard.pattern.steps.length;
				const patternWidth = this.clipboard.pattern.steps[0].length;
				const tracksNeeded = (pasteStartTrack + patternHeight) - this.tracks.length;

				if (tracksNeeded > 0) {
					if ((this.tracks.length + tracksNeeded) > this.maxTracks) {
						alert(`貼上需要 ${tracksNeeded} 個新音軌，已超過 ${this.maxTracks} 軌的數量上限，無法執行貼上。`);
						return;
					}
					for (let i = 0; i < tracksNeeded; i++) this.addTrack();
				}

				const pasteEndStep = pasteStartStep + patternWidth - 1;

				if (pasteEndStep >= this.totalBeats * this.stepsPerBeat) {
					const stepsNeeded = pasteEndStep - (this.totalBeats * this.stepsPerBeat) + 1;
					const beatsNeeded = Math.ceil(stepsNeeded / this.stepsPerBeat);
					const beatsToAdd = Math.ceil(beatsNeeded / 4) * 4;
					this.expandBeats(beatsToAdd);
				}

				for (let t = 0; t < patternHeight; t++) {
					const targetTrackIndex = pasteStartTrack + t;
					if (this.tracks[targetTrackIndex]) {
						for (let s = 0; s < patternWidth; s++) {
							const targetStepIndex = pasteStartStep + s;
							if (targetStepIndex < this.tracks[targetTrackIndex].steps.length) {
								this.tracks[targetTrackIndex].steps[targetStepIndex] = this.clipboard.pattern.steps[t][s];
								this.tracks[targetTrackIndex].markers[targetStepIndex] = { ...this.clipboard.pattern.markers[t][s] };
							}
						}
					}
				}

				this.renderTracks();
				this.saveState();

				this.clearSelection();
			}

            saveSelectionAsPattern() {
                if (this.selection.startTrack === null || this.selection.endTrack === null) {
                    alert('請先點擊兩個格子來框選一個區域！');
                    return;
                }
                this.copySelection();
                if (!this.clipboard.pattern) return;

                const dataStr = JSON.stringify(this.clipboard.pattern, null, 2);
                const dataBlob = new Blob([dataStr], {type: 'application/json'});
                const link = document.createElement('a');
                link.href = URL.createObjectURL(dataBlob);
                link.download = `beatmaker-style-${new Date().toISOString().slice(0, 10)}.pa`;
                link.click();
            }

            async loadPatternToClipboard(file) {
                if (!file) return;
                try {
                    const text = await file.text();
                    const patternData = JSON.parse(text);

                    if (!patternData.steps || !patternData.markers || !Array.isArray(patternData.steps)) {
                         throw new Error('無效的 .pa 檔案格式');
                    }

                    this.clipboard.pattern = patternData;
                    alert('樣式已成功載入到剪貼簿！現在可以選擇一個起始點並貼上。');
                } catch (error) {
                    alert('載入樣式失敗：' + error.message);
                }
            }


            handleSoundModeChange(drumKey, newMode) {
                if (drumKey && newMode) {
                    this.drumSounds[drumKey].mode = newMode;
                    this.updateSoundControlUI(drumKey);
                }
            }

			async handleSampleUpload(drumKey, file) {
                if (!file || !drumKey) return;

                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

                    const cacheKey = `user_${file.name}_${file.size}`;
                    this.audioCache.cache.set(cacheKey, audioBuffer);

                    this.drumSounds[drumKey].userSampleBuffer = audioBuffer;
                    this.drumSounds[drumKey].userSampleFileName = file.name;
                    this.drumSounds[drumKey].mode = 'user';

                    this.updateSoundControlUI(drumKey);
                    alert(`樂器 "${this.drumSounds[drumKey].name}" 的取樣 "${file.name}" 已成功載入！`);

                } catch (error) {
                    console.error(`Error loading sample for ${drumKey}:`, error);
                    alert(`載入取樣失敗，請確認檔案格式是否為支援的音訊檔 (MP3, WAV, OGG)。\n錯誤訊息: ${error.message}`);
                }
            }

            removeSample(drumKey) {
                if (!drumKey || !this.drumSounds[drumKey]) return;

                const sound = this.drumSounds[drumKey];
                sound.userSampleBuffer = null;
                sound.userSampleFileName = '';
                sound.mode = sound.defaultSampleBuffer ? 'system' : 'synth';
                this.updateSoundControlUI(drumKey);
                alert(`樂器 "${sound.name}" 的匯入取樣已被移除。`);
            }

            updateSoundControlUI(drumKey) {
                const sound = this.drumSounds[drumKey];
                const itemContainer = document.getElementById(`sound-control-item-${drumKey}`);
                if (!itemContainer) return;

                const radioToCheck = itemContainer.querySelector(`input[name="sound-mode-${drumKey}"][value="${sound.mode}"]`);
                if(radioToCheck) radioToCheck.checked = true;

				const systemInput = itemContainer.querySelector('input[value="system"]');
				const systemLabel = systemInput ? systemInput.closest('label') : null;
                if (systemLabel && systemInput) {
                    const isSystemAvailable = !!sound.defaultSampleBuffer;
                    systemLabel.classList.toggle('disabled', !isSystemAvailable && !sound.isLoadingDefault);
                    systemLabel.classList.toggle('loading-indicator', sound.isLoadingDefault);
                    systemInput.disabled = !isSystemAvailable;
                }

                itemContainer.querySelector('.sample-controls').style.display = sound.mode === 'user' ? 'block' : 'none';
                itemContainer.querySelector('.remove-sample-btn').style.display = !!sound.userSampleBuffer ? 'inline-block' : 'none';
                itemContainer.querySelector('.sample-file-name').textContent = sound.userSampleFileName;

                const waveformLabel = itemContainer.querySelector('.waveform-selector-label');
                const waveformSelect = waveformLabel.querySelector('select');
                waveformLabel.classList.toggle('disabled', sound.mode !== 'synth');
                waveformSelect.disabled = sound.mode !== 'synth';
            }

            resetSounds() {
                if (!window.confirm('確定要重設所有音色為預設值嗎？這將會移除所有您匯入的聲音取樣，並將音源模式與參數重設。')) return;

                this.initDrumSounds();
                this.loadDefaultSamples();

                alert('音色已重設。');
            }


			clearAll() {
				if (!window.confirm('您確定要清除所有 R/L 標記嗎？此操作將被記錄，可以復原。')) {
					return;
				}

				this.tracks.forEach(track => {
					track.markers = Array.from({ length: track.markers.length }, () => ({}));
				});

				this.renderTracks();
				if (this.selectionMode) this.toggleSelectionMode();
				this.saveState();
			}

			resetAll() {
				if (!window.confirm('您確定要重設所有節拍點與 R/L 標記嗎？\n此操作將保留您的總拍數、音量與音色設定。')) {
					return;
				}

				if (this.isPlaying) this.stop();
				if (this.selectionMode) this.toggleSelectionMode();


				this.tracks.forEach(track => {
					track.steps.fill(false);
					track.markers = Array.from({ length: track.markers.length }, () => ({}));
				});

				this.currentStep = 0;
				this.currentTrack = 0;

				this.renderTracks();
				this.initScrollPosition();
				this.updateColorHints();

				this.saveState(true);
			}

            exportPattern() {
                const pattern = {
					version: '2.5-markers-obj',
					trackCount: this.tracks.length,
                    totalBeats: this.totalBeats,
                    bpm: this.bpm,
					globalVolume: this.globalVolume,
					accentVolumeMultiplier: this.accentVolumeMultiplier,
					ghostVolumeMultiplier: this.ghostVolumeMultiplier,
                    mode: this.mode,
                    showNumbers: this.showNumbers,
					showMarkers: this.showMarkers,
                    stepsPerBeat: this.stepsPerBeat,
					metronome: this.metronome,
                    tracks: this.tracks.map(track => ({
						label: track.label,
                        drumType: track.drumType,
                        steps: track.steps,
						markers: track.markers,
                        enabled: track.enabled,
                        soundEnabled: track.soundEnabled,
                        volume: track.volume
                    })),
                    drumSounds: Object.fromEntries(Object.entries(this.drumSounds).map(([key, value]) => {
                         const { defaultSampleBuffer, userSampleBuffer, isLoadingDefault, ...rest } = value;
                         return [key, rest];
                    })),
                    exportDate: new Date().toISOString()
                };
                const dataStr = JSON.stringify(pattern, null, 2);
                const dataBlob = new Blob([dataStr], {type: 'application/json'});
                const link = document.createElement('a');
                link.href = URL.createObjectURL(dataBlob);
                link.download = `beatmaker-pattern-${new Date().toISOString().slice(0, 10)}.json`;
                link.click();
            }

			async importPattern(file) {
				if (!file) return;
				if (!window.confirm('匯入新鼓譜將會覆蓋目前的內容，確定要繼續嗎？')) {
					document.getElementById('fileInput').value = '';
					return;
				}

				try {
					const text = await file.text();
					const pattern = JSON.parse(text);

					if (!pattern.version || !pattern.tracks) {
						throw new Error('無效的檔案格式或檔案已損壞');
					}
					if (this.isPlaying) this.stop();

					this.totalBeats = pattern.totalBeats || 8;
					this.bpm = pattern.bpm || 65;
					this.globalVolume = pattern.globalVolume ?? 0.8;
					this.mode = pattern.mode || 'ensemble';
					this.showNumbers = pattern.showNumbers || false;
					this.showMarkers = pattern.showMarkers || false;
					this.stepsPerBeat = pattern.stepsPerBeat || 4;
						if (pattern.metronome) {
							this.metronome = { ...this.metronome, ...pattern.metronome };
						}
					this.accentVolumeMultiplier = pattern.accentVolumeMultiplier ?? 5.0;
					this.ghostVolumeMultiplier = pattern.ghostVolumeMultiplier ?? 0.3;

					this.tracks = [];
					this.tracks = pattern.tracks.map((trackData, index) => {
						let newMarkers = Array(this.totalBeats * this.stepsPerBeat).fill({}).map(() => ({}));
						if (trackData.markers) {
							newMarkers = trackData.markers.map(m => {
								if (typeof m === 'string') {
									return m ? { hand: m } : {};
								}
								return m || {};
							});
						}

						return {
							id: index,
							label: trackData.label || this.defaultTrackLabels[index] || `T${index + 1}`,
							drumType: trackData.drumType || this.defaultDrums[index] || 'agogo',
							steps: trackData.steps || Array(this.totalBeats * this.stepsPerBeat).fill(false),
							markers: newMarkers,
							enabled: trackData.enabled !== undefined ? trackData.enabled : true,
							soundEnabled: trackData.soundEnabled !== undefined ? trackData.soundEnabled : true,
							volume: trackData.volume !== undefined ? trackData.volume : 0.8
						};
					});

					if (!pattern.trackCount && this.tracks.length < this.minTracks) {
						while (this.tracks.length < this.minTracks) { this.addTrack(); }
					}
					if (pattern.drumSounds) {
						 Object.keys(pattern.drumSounds).forEach(key => {
							if (this.drumSounds[key]) {
								const defaults = this.getDefaultSoundParams();
								const imported = pattern.drumSounds[key];
								this.drumSounds[key] = { ...defaults, ...this.drumSounds[key], ...imported };
								this.drumSounds[key].userSampleBuffer = null;
								this.drumSounds[key].userSampleFileName = imported.userSampleFileName || '';
							}
						});
						this.initSoundAdjustPanel();
					}
					
					this.currentStep = 0;
					document.getElementById('bpmInput').value = this.bpm;
					document.getElementById('globalVolumeInput').value = Math.round(this.globalVolume * 100);
					document.getElementById('showNumbers').checked = this.showNumbers;
					document.getElementById('showMarkersCheckbox').checked = this.showMarkers;
					document.querySelector('.container').classList.toggle('markers-visible', this.showMarkers);
					document.querySelectorAll('.mode-btn').forEach(btn => {
						btn.classList.toggle('active', btn.dataset.mode === this.mode);
					});
					document.querySelectorAll('.beat-setting-btn[data-beat-setting]').forEach(btn => {
						btn.classList.toggle('active', parseInt(btn.dataset.beatSetting) === this.stepsPerBeat);
					});

					this.updateExpandButton();
					this.renderTracks();
					this.initScrollPosition();
					this.updateStepSize();
					this.updateBeatNumbers();
					this.clearSelection();
					this.updateMetronomeUI(); 
					this.saveState(true);
					document.getElementById('accentVolumeSlider').value = this.accentVolumeMultiplier * 100;
					document.getElementById('accentVolumeDisplay').textContent = this.accentVolumeMultiplier * 100;
					document.getElementById('ghostVolumeSlider').value = this.ghostVolumeMultiplier * 100;
					document.getElementById('ghostVolumeDisplay').textContent = this.ghostVolumeMultiplier * 100;
					alert('鼓譜匯入成功！');
				} catch (error) {
					alert('匯入失敗：' + error.message);
				}
				document.getElementById('fileInput').value = '';
			}

	        async exportMP3() {
				const loopCountSelect = document.getElementById('loopCountSelect');
				let loopCount = parseInt(loopCountSelect.value) || 1;

                if (typeof lamejs === 'undefined') {
                    alert('MP3 編碼函式庫 (lame.min.js) 載入失敗！請檢查您的網路連線或 CDN 連結是否正確。');
                    return;
                }

                if (this.isPlaying) this.stop();

                const exportBtn = document.getElementById('exportMp3Btn');
                const originalText = exportBtn.textContent;
                exportBtn.textContent = '處理中...';
                exportBtn.disabled = true;
                exportBtn.classList.add('loading');

				try {
					const sampleRate = 44100;
					const stepsInOneLoop = this.totalBeats * this.stepsPerBeat;
					const durationOfOneLoop = stepsInOneLoop * ((60 / this.bpm) / this.stepsPerBeat);

					let totalDuration;
                    const enabledTracks = this.tracks.filter(t => t.enabled);

					if (this.mode === 'ensemble') {
						totalDuration = durationOfOneLoop * loopCount;
					} else {
						if (enabledTracks.length === 0) {
                            throw new Error("在輪奏模式下，沒有啟用的音軌可供匯出。");
                        }
						totalDuration = durationOfOneLoop * enabledTracks.length * loopCount;
					}

					if (totalDuration <= 0) {
						alert("無法匯出時長為零的音訊。請確保有設定拍子。");
						throw new Error("Calculated total duration is zero or less.");
					}
					totalDuration += 1.0;

					const offlineContext = new OfflineAudioContext(2, Math.ceil(sampleRate * totalDuration), sampleRate);
					const stepDurationInSeconds = (60 / this.bpm) / this.stepsPerBeat;

					if (this.mode === 'ensemble') {
						for (let loop = 0; loop < loopCount; loop++) {
							const loopStartTime = loop * durationOfOneLoop;
							for (let step = 0; step < stepsInOneLoop; step++) {
								this.tracks.forEach(track => {
                                    if (track.enabled && track.steps[step] && !(track.markers[step] && track.markers[step].rest)) {
										const time = loopStartTime + step * stepDurationInSeconds;
										const marker = track.markers[step] || {};
										let volumeMultiplier = 1.0;
										if (marker.accent === '>') {
											volumeMultiplier = this.accentVolumeMultiplier;
										} else if (marker.accent === '()') {
											volumeMultiplier = this.ghostVolumeMultiplier;
										}
										this.scheduleSound(offlineContext, time, track.drumType, track.soundEnabled, track.volume * volumeMultiplier);
									}
								});
							}
						}
					} else {
						let timeOffset = 0;
						for (let loop = 0; loop < loopCount; loop++) {
							for (const track of enabledTracks) {
								for (let step = 0; step < stepsInOneLoop; step++) {
                                    if (track.steps[step] && !(track.markers[step] && track.markers[step].rest)) {
										const time = timeOffset + step * stepDurationInSeconds;
                                        const marker = track.markers[step] || {};
                                        let volumeMultiplier = 1.0;
                                        if (marker.accent === '>') {
                                            volumeMultiplier = this.accentVolumeMultiplier;
                                        } else if (marker.accent === '()') {
                                            volumeMultiplier = this.ghostVolumeMultiplier;
                                        }
                                        this.scheduleSound(offlineContext, time, track.drumType, track.soundEnabled, track.volume * volumeMultiplier);
									}
								}
								timeOffset += durationOfOneLoop;
							}
						}
					}

                    const renderedBuffer = await offlineContext.startRendering();
					const mp3encoder = new lamejs.Mp3Encoder(2, sampleRate, 128);
                    const leftFloat = renderedBuffer.getChannelData(0);
                    const rightFloat = renderedBuffer.getChannelData(1);
                    const leftInt16 = new Int16Array(leftFloat.length);
                    const rightInt16 = new Int16Array(rightFloat.length);

                    for (let i = 0; i < leftFloat.length; i++) {
                        leftInt16[i] = Math.max(-1, Math.min(1, leftFloat[i])) * 32767;
                        rightInt16[i] = Math.max(-1, Math.min(1, rightFloat[i])) * 32767;
                    }

                    const mp3Data = [];
                    const bufferSize = 1152;

                    for (let i = 0; i < leftInt16.length; i += bufferSize) {
                        const leftChunk = leftInt16.subarray(i, i + bufferSize);
                        const rightChunk = rightInt16.subarray(i, i + bufferSize);
                        const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
                        if (mp3buf.length > 0) mp3Data.push(mp3buf);
                    }
                    const flush_buffer = mp3encoder.flush();
                    if (flush_buffer.length > 0) mp3Data.push(flush_buffer);

                    const blob = new Blob(mp3Data, { type: 'audio/mp3' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `beatmaker-${new Date().toISOString().slice(0,10)}.mp3`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);

                } catch (error) {
                    console.error('MP3 匯出失敗:', error);
                    alert('匯出 MP3 時發生錯誤: ' + error.message);
                } finally {
                    exportBtn.textContent = originalText;
                    exportBtn.disabled = false;
                    exportBtn.classList.remove('loading');
                }
            }

			scheduleSound(context, time, drumType, soundEnabled = true, trackVolume = 1.0) {
				if (!soundEnabled) return;
				const sound = this.drumSounds[drumType];
				if (!sound) return;

				if (drumType.includes('-drag')) {
					this.scheduleDrumRoll(context, time, drumType, soundEnabled, trackVolume);
					return;
				}

				let source;
				let bufferToPlay = null;

				if (sound.mode === 'system' && sound.defaultSampleBuffer) {
					bufferToPlay = sound.defaultSampleBuffer;
				} else if (sound.mode === 'user' && sound.userSampleBuffer) {
					bufferToPlay = sound.userSampleBuffer;
				}

				if (bufferToPlay) {
					source = context.createBufferSource();
					source.buffer = bufferToPlay;
					const playbackRate = Math.pow(2, sound.detune / 1200);
					source.playbackRate.setValueAtTime(playbackRate, time);
				} else {
					source = context.createOscillator();
					source.type = sound.synthType;
					source.frequency.setValueAtTime(sound.synthBaseFreq, time);
					source.detune.setValueAtTime(sound.detune, time);
					 if (drumType === 'cuica') source.frequency.exponentialRampToValueAtTime(sound.synthBaseFreq * 0.5, time + sound.release);
					 if (drumType === 'pandeiro') source.frequency.exponentialRampToValueAtTime(sound.synthBaseFreq * 0.7, time + sound.release * 0.5);
				}

				let finalGain = sound.gain * trackVolume;
				if (context === this.audioContext) {
					finalGain *= this.globalVolume;
				}

				const envelopeGain = context.createGain();
				envelopeGain.gain.setValueAtTime(0, time);
				envelopeGain.gain.linearRampToValueAtTime(finalGain, time + sound.attack);
				envelopeGain.gain.linearRampToValueAtTime(0, time + sound.attack + sound.release);

				const panner = new StereoPannerNode(context, { pan: sound.pan });
				const filter = context.createBiquadFilter();
				filter.type = "lowpass";
				filter.frequency.setValueAtTime(sound.filterFreq, time);
				filter.Q.setValueAtTime(sound.filterQ, time);

				source.connect(filter).connect(panner).connect(envelopeGain).connect(context.destination);
				source.start(time);
				if (source.constructor.name === "OscillatorNode") {
					source.stop(time + sound.attack + sound.release + 0.1);
				}
			}


			scheduleDrumRoll(context, time, drumType, soundEnabled = true, trackVolume = 1.0) {
				if (!soundEnabled) return;
				const sound = this.drumSounds[drumType];
				if (!sound) return;

				const numBounces = sound.dragBounces || 5;
				const rollDuration = sound.dragDuration || 0.15;
				const gainDecay = sound.dragGainDecay || 0.5;
				const timeStretch = sound.dragTimeStretch || 1.4;

				let currentTimeOffset = 0;
				let currentGain = sound.gain * trackVolume;
				if (context === this.audioContext) {
					currentGain *= this.globalVolume;
				}

				let currentInterval = rollDuration / (numBounces * 1.5);

				if (!this.whiteNoiseBuffer) {
					const bufferSize = context.sampleRate * 2;
					const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
					let output = buffer.getChannelData(0);
					for (let i = 0; i < bufferSize; i++) {
						output[i] = Math.random() * 2 - 1;
					}
					this.whiteNoiseBuffer = buffer;
				}

				for (let i = 0; i < numBounces; i++) {
					const bounceTime = time + currentTimeOffset;

					const osc = context.createOscillator();
					osc.type = sound.synthType;
					const baseFreq = sound.synthBaseFreq * (i === 0 ? 1 : 0.9);
					osc.frequency.setValueAtTime(baseFreq, bounceTime);
					osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, bounceTime + 0.05);

					const noiseSource = context.createBufferSource();
					noiseSource.buffer = this.whiteNoiseBuffer;

					const envelope = context.createGain();
					envelope.gain.setValueAtTime(0, bounceTime);
					envelope.gain.linearRampToValueAtTime(currentGain, bounceTime + 0.01);
					envelope.gain.linearRampToValueAtTime(0, bounceTime + 0.04);

					const filter = context.createBiquadFilter();
					filter.type = "lowpass";
					filter.frequency.setValueAtTime(sound.filterFreq, bounceTime);
					filter.Q.setValueAtTime(sound.filterQ, time);

					const panner = new StereoPannerNode(context, { pan: sound.pan });

					osc.connect(envelope);
					noiseSource.connect(envelope);
					envelope.connect(filter).connect(panner).connect(context.destination);

					osc.start(bounceTime);
					noiseSource.start(bounceTime);
					osc.stop(bounceTime + 0.1);
					noiseSource.stop(bounceTime + 0.1);

					currentGain *= gainDecay;
					currentTimeOffset += currentInterval;
					currentInterval *= timeStretch;
				}
			}


			setupKeyboardShortcuts() {
				document.addEventListener('keydown', (e) => {
					if (e.target.tagName === 'INPUT') {
						 if (e.key === 'Escape' || e.key === 'Enter') e.target.blur();
						return;
					}

					if (e.ctrlKey || e.metaKey) {
						switch(e.key.toLowerCase()) {
							case 's': e.preventDefault(); this.exportPattern(); break;
							case 'z': e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); break;
							case 'y': e.preventDefault(); this.redo(); break;
							case 'c': if(this.selectionMode) { e.preventDefault(); this.copySelection(); } break;
							case 'v': if(this.selectionMode) { e.preventDefault(); this.pasteSelection(); } break;
						}
					} else {
						if (this.markingMode) {
							let buttonSelector = null;
							switch(e.key.toLowerCase()) {
								case 'r':
                                    buttonSelector = '.marker-btn[data-marker="R"]';
                                    break;
                                case 'l':
                                    buttonSelector = '.marker-btn[data-marker="L"]';
                                    break;
                                case 'x':
                                    buttonSelector = '.marker-btn[data-marker="eraser"]';
                                    break;
                                case '.':
                                    buttonSelector = '.marker-btn[data-marker="accent"][data-value=">"]';
                                    break;
                                case 'o':
                                    buttonSelector = '.marker-btn[data-marker="accent"][data-value="()"]';
                                    break;
							}
                            if (buttonSelector) {
                                e.preventDefault();
                                const targetButton = document.querySelector(buttonSelector);
                                if (targetButton) {
                                    targetButton.click();
                                }
                                return;
                            }
						}

						switch(e.key) {
							case ' ': e.preventDefault(); this.togglePlay(); break;
							case 'p': e.preventDefault(); this.togglePlay(); break;
							case 's':
								e.preventDefault();
								this.stop();
								break;
							case 'r': 
								e.preventDefault();
								this.resetAll();
								break;
							case 'b':
								e.preventDefault();
								if (this.isPlaying) {
									this.stop();
								}
								this.play();
								break;
							case 'e':
								e.preventDefault();
								document.getElementById('selectBtn').click();
								break;
							case 'm':
								e.preventDefault();
								document.getElementById('markBtn').click();
								break;
							case 'Escape':
								// 新增：檢查是否有任何彈出視窗是開啟的，若有則關閉
								const openModal = document.querySelector('.modal-overlay[style*="display: flex"]');
								if (openModal) {
									openModal.style.display = 'none';
									break; // 優先處理關閉視窗，然後結束
								}
								// --- 新增結束 ---

								if (this.selectionMode) this.toggleSelectionMode();
								if (this.markingMode) document.getElementById('markBtn').click();
								if (document.querySelectorAll('.step.step-highlighted').length > 0) {
									this.updateSeekHighlight(null);
								}
								break;
							case 'ArrowUp': e.preventDefault(); this.adjustGlobalVolume(1); break;
							case 'ArrowDown': e.preventDefault(); this.adjustGlobalVolume(-1); break;
							case 'ArrowRight': e.preventDefault(); this.adjustBPM(1); break;
							case 'ArrowLeft': e.preventDefault(); this.adjustBPM(-1); break;
						}
					}
				});
			}

            adjustBPM(delta) {
                const bpmInput = document.getElementById('bpmInput');
                let newBPM = parseInt(bpmInput.value) + delta;
                newBPM = Math.max(40, Math.min(200, newBPM));

                this.bpm = newBPM;
                bpmInput.value = newBPM;

                if (this.isPlaying) {
                    this.stop();
                    this.play();
                }
            }

			adjustGlobalVolume(delta) {
				const volumeInput = document.getElementById('globalVolumeInput');
				let newVolume = parseInt(volumeInput.value) + delta;
				newVolume = Math.max(0, Math.min(100, newVolume));

				this.globalVolume = newVolume / 100;
				volumeInput.value = newVolume;
			}
			
			
			
			isSelectionValidForNotation() {
				if (this.selection.startTrack === null || this.selection.endTrack === null) {
					return { valid: false, message: '請先框選一個區域。' };
				}
				
				const startStep = Math.min(this.selection.startStep, this.selection.endStep);
				const endStep = Math.max(this.selection.startStep, this.selection.endStep);
				const totalSelectedSteps = endStep - startStep + 1;
				const stepsPerMeasure = 4 * this.stepsPerBeat;

				if (startStep % this.stepsPerBeat !== 0) {
					return { valid: false, message: '框選範圍必須從某一拍的第一格開始。' };
				}

				if (totalSelectedSteps % stepsPerMeasure !== 0) {
					return { valid: false, message: '框選範圍的長度必須是4拍 (一小節) 的倍數。' };
				}

				return { valid: true };
			}	


			convertRangeToNotation(startTrack, endTrack, startStep, endStep) {
				try {
                    const notationContent = document.getElementById('notationContent');
                    notationContent.innerHTML = '';

                    for (let t = startTrack; t <= endTrack; t++) {
                        const track = this.tracks[t];
                        const trackContainer = document.createElement('div');
                        
                        const title = document.createElement('div');
                        title.className = 'notation-track-title';
                        title.textContent = `${track.label} (${this.drumSounds[track.drumType].name})`;
                        trackContainer.appendChild(title);
                        
                        const vexflowContainer = document.createElement('div');
                        vexflowContainer.className = 'vexflow-container';
                        trackContainer.appendChild(vexflowContainer);

                        notationContent.appendChild(trackContainer);
                        
                        const trackSteps = track.steps.slice(startStep, endStep + 1);
                        const trackMarkers = track.markers.slice(startStep, endStep + 1);
                        const measures = this.parseTrackToMeasures(trackSteps, trackMarkers);
                        
                        this.renderMeasuresWithVexFlow(vexflowContainer, measures);
                    }
                    
                    document.getElementById('notationModal').style.display = 'flex';
                } catch (error) {
                    console.error('轉譜錯誤:', error);
                    alert('轉譜過程發生錯誤：' + error.message);
                }
			}

			// 修改後的函數：處理「選取模式」下的轉譜按鈕
			convertSelectionToNotation() {
				const validation = this.isSelectionValidForNotation();
				if (!validation.valid) {
					alert(validation.message);
					return;
				}

				const startTrack = Math.min(this.selection.startTrack, this.selection.endTrack);
				const endTrack = Math.max(this.selection.startTrack, this.selection.endTrack);
				const startStep = Math.min(this.selection.startStep, this.selection.endStep);
				const endStep = Math.max(this.selection.startStep, this.selection.endStep);

				this.convertRangeToNotation(startTrack, endTrack, startStep, endStep);
			}

			// 新增的函數：處理「單一音軌」的轉譜按鈕
			convertSingleTrackToNotation(trackIndex) {
				const startTrack = trackIndex;
				const endTrack = trackIndex;
				const startStep = 0;
				const endStep = (this.totalBeats * this.stepsPerBeat) - 1;

				if (endStep < 0) {
					alert("音軌為空，無法轉譜。");
					return;
				}

				this.convertRangeToNotation(startTrack, endTrack, startStep, endStep);
			}

			parseTrackToMeasures(steps, markers) {
				const measures = [];
				const stepsPerMeasure = 4 * this.stepsPerBeat; // 一個小節固定為4拍

				for (let i = 0; i < steps.length; i += stepsPerMeasure) {
					const measureSteps = steps.slice(i, i + stepsPerMeasure);
					const measureMarkers = markers.slice(i, i + stepsPerMeasure);
					measures.push(this.parseMeasure(measureSteps, measureMarkers));
				}
				return measures;
			}

			parseMeasure(measureSteps, measureMarkers) {
				const symbols = [];
				let i = 0;
				
				while (i < measureSteps.length) {
					if (measureSteps[i] && !measureMarkers[i]?.rest) {
						// 處理音符
						let duration = 1;
						while (i + duration < measureSteps.length && 
							   !measureSteps[i + duration] && 
							   !measureMarkers[i + duration]?.rest) {
							duration++;
						}
						symbols.push({ type: 'note', duration });
						i += duration;
					} else {
						// 處理休止符
						let duration = 1;
						while (i + duration < measureSteps.length && 
							   (!measureSteps[i + duration] || measureMarkers[i + duration]?.rest)) {
							duration++;
						}
						symbols.push({ type: 'rest', duration });
						i += duration;
					}
				}
				
				return symbols;
			}

			getVexFlowDuration(duration) {
				const totalValue = duration / this.stepsPerBeat;

				// 處理附點音符 (已修正邏輯)
				if (totalValue === 3)    return { duration: "h",  dot: true };  // 附點2分（=3拍）
				if (totalValue === 1.5)  return { duration: "q",  dot: true };  // 附點4分（=1.5拍）
				if (totalValue === 0.75) return { duration: "8",  dot: true };  // 附點8分（=0.75拍）
				if (totalValue === 0.375)return { duration: "16", dot: true };  // 附點16分
				if (totalValue === 0.1875)return { duration: "32", dot: true }; // 附點32分

				// 處理一般音符
				const durationMap = {
					4: "w",     // 全音符
					2: "h",     // 2分音符
					1: "q",     // 4分音符
					0.5: "8",   // 8分音符
					0.25: "16", // 16分音符
					0.125: "32", // 32分音符
					0.0625: "64" // 64分音符 (為8格/拍模式準備)
				};

				return { duration: durationMap[totalValue] || "q", dot: false };
			}

			renderMeasuresWithVexFlow(container, measures) {
				const VF = Vex.Flow;
				container.innerHTML = '';

				const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
				const context = renderer.getContext();
				
				const measuresPerLine = this.stepsPerBeat === 8 ? 3 : 4;

				const LEFT_MARGIN = 10;
				const RIGHT_MARGIN = 20;

				let currentX = LEFT_MARGIN;
				let currentY = 20;

				const MIN_MEASURE_WIDTH = (this.stepsPerBeat === 8) ? 360 : 300;

				// ▶ 可視寬度（真正眼睛看得到的寬度，拿來做「放不下就換行」的判斷）
				const visibleWidth =  (container.getBoundingClientRect?.().width) || container.clientWidth || 960; //container.clientWidth || 960;

				// ▶ Renderer 畫布寬度（給 SVG 畫布用，至少要能容納一整行我們預估的小節）
				const canvasWidth = Math.max(visibleWidth, MIN_MEASURE_WIDTH * measuresPerLine + LEFT_MARGIN + RIGHT_MARGIN);

				// ▶ 小節實際寬度：至少 MIN_MEASURE_WIDTH；若 visibleWidth 很寬，就平均分
				const staveWidth = Math.max(
				  MIN_MEASURE_WIDTH,
				  (visibleWidth - LEFT_MARGIN - RIGHT_MARGIN) / measuresPerLine
				);
				//const canvasWidth = Math.max(container.clientWidth, 950);
				//const staveWidth = (canvasWidth - 40) / measuresPerLine; 

				measures.forEach((measure, index) => {
					if (index > 0 && (currentX + staveWidth > visibleWidth - RIGHT_MARGIN)) {
					  currentX = LEFT_MARGIN;
					  currentY += 120;
					}

				  const stave = new VF.Stave(currentX, currentY, staveWidth);

					if (index === 0) {
						stave.addClef('percussion').addTimeSignature("4/4");
					}

					if (index === measures.length - 1) {
						stave.setEndBarType(VF.Barline.type.END);
					}

					stave.setContext(context).draw();

					const notes = [];
					const allBeams = [];
					let notesInCurrentBeat = [];
					let stepsInCurrentBeat = 0;
					
					// === 新增：每拍的音符群組（用 notes 的 index 範圍表示） ===
					const beatGroups = [];      // 例如 [{start: 0, end: 2}, {start: 3, end: 5}, ...]
					let currentGroupStart = 0;  // 目前這一拍在 notes 陣列的起始 index	

					measure.forEach(symbol => {
						const vexData = this.getVexFlowDuration(symbol.duration);
						if (!vexData || !vexData.duration) return;
						const note = new VF.StaveNote({
							keys: ["b/4"],
							duration: vexData.duration + (symbol.type === 'rest' ? 'r' : ''),
							clef: "percussion"
						});
						if (vexData.dot) {
						  // 依版本可用性，優先使用現有 API
						  if (typeof note.addDotToAll === 'function') {
							note.addDotToAll();               // 舊版鏈式 API
						  } else if (typeof note.addDot === 'function') {
							// 你的打擊聲部是單鍵 "b/4"，因此加在 index 0 即可
							note.addDot(0);
						  } else if (VF.Dot && typeof VF.Dot.buildAndAttach === 'function') {
							VF.Dot.buildAndAttach([note], { index: 0 }); // VexFlow v4 的寫法
						  }
						}
						notes.push(note);
						if (symbol.type !== 'rest') notesInCurrentBeat.push(note);
						stepsInCurrentBeat += symbol.duration;
						if (stepsInCurrentBeat >= this.stepsPerBeat) {
						  // === 新增：記下這一拍在 notes[] 的範圍 ===
						  const groupEnd = notes.length - 1; // 目前已經 push 的最後一顆音符（含休止）
						  if (groupEnd >= currentGroupStart) {
							beatGroups.push({ start: currentGroupStart, end: groupEnd });
						  }
						  currentGroupStart = notes.length; // 下一拍從下一個 note 開始
						  // === 原本就有的連桿處理 ===
						  if (notesInCurrentBeat.length > 1) allBeams.push(new VF.Beam(notesInCurrentBeat));
						  notesInCurrentBeat = [];
						  stepsInCurrentBeat = 0;
						}
					});

					if (notes.length > 0) {
						const voice = new VF.Voice({ num_beats: 4, beat_value: 4 }).setMode(VF.Voice.Mode.SOFT);
						voice.addTickables(notes);

						const formatter = new VF.Formatter();
						formatter.joinVoices([voice]).formatToStave([voice], stave, { align_rests: false });

						voice.draw(context, stave);
						allBeams.forEach(beam => beam.setContext(context).draw());
						
						// === 用時間軸插值，計出每一拍的 X 邊界 ===
						const beatsInMeasure = 4;                 // 4/4
						const boxHeight = 14;
						const boxY = stave.getYForTopText() - boxHeight - 6; // 畫在譜上方

						// 1) 蒐集本小節每個符號(含休止)的：時間區間[start, end) 與 畫面左右邊界[left, right]
						const pieceInfos = [];
						let accSteps = 0; // 小節內的 step 累積位置
						for (let i = 0; i < measure.length; i++) {
						  const sym = measure[i];
						  const n = notes[i];
						  if (!n) continue;

						  const bb = (typeof n.getBoundingBox === 'function') ? n.getBoundingBox() : null;
						  const cx = n.getAbsoluteX ? n.getAbsoluteX() : 0;
						  const w  = (typeof n.getWidth === 'function') ? n.getWidth() : 10;

						  const left  = (bb && bb.getX) ? bb.getX() : (cx - w / 2);
						  const right = (bb && bb.getX && bb.getW) ? (bb.getX() + bb.getW()) : (cx + w / 2);

						  pieceInfos.push({ start: accSteps, end: accSteps + sym.duration, left, right });
						  accSteps += sym.duration;
						}

						// 2) 計算 0～4 拍的「時間邊界」對應的畫面 X（用線性插值）
						const boundaryX = [];
						for (let k = 0; k <= beatsInMeasure; k++) {
						  const target = k * this.stepsPerBeat;

						  // 找到 target 時間落在哪個符號區間
						  let r = null;
						  for (let j = 0; j < pieceInfos.length; j++) {
							const seg = pieceInfos[j];
							if (target < seg.end || (k === beatsInMeasure && target === seg.end)) {
							  r = seg; break;
							}
						  }
						  if (!r) r = pieceInfos[pieceInfos.length - 1];

						  let x;
						  if (target <= r.start) {
							x = r.left;
						  } else if (target >= r.end) {
							x = r.right;
						  } else {
							// 線性插值：在同一顆（可能是長音/休止）內，按時間比例取 X
							const ratio = (target - r.start) / (r.end - r.start);
							x = r.left + ratio * (r.right - r.left);
						  }
						  boundaryX.push(x);
						}

						// 3) 依相鄰兩個邊界畫出拍框（橫線＋左右短豎線＋拍號）
						for (let i = 0; i < beatsInMeasure; i++) {
						  const x1 = boundaryX[i];
						  const x2 = boundaryX[i + 1];
						  const midY = boxY + boxHeight / 2;

						  context.save();
						  context.setStrokeStyle && context.setStrokeStyle('#7e7e7e');
						  context.setLineWidth && context.setLineWidth(3);

						  // 中間橫線
						  context.beginPath();
						  context.moveTo(x1, midY);
						  context.lineTo(x2, midY);
						  context.stroke();

						  // 左右短豎線
						  const verticalHeight = boxHeight * 0.6;
						  const vOff = (boxHeight - verticalHeight) / 2;
						  context.beginPath();
						  context.moveTo(x1, boxY + vOff);
						  context.lineTo(x1, boxY + vOff + verticalHeight);
						  context.moveTo(x2, boxY + vOff);
						  context.lineTo(x2, boxY + vOff + verticalHeight);
						  context.stroke();

						  context.restore();

						  // 拍號文字（1~4）
						  context.save();
						  context.setFont && context.setFont('10px Arial');
						  context.fillText && context.fillText(String(i + 1), x1 + (x2 - x1) / 2 - 3, boxY - 2);
						  context.restore();
						}
						
						
					}

					currentX += stave.getWidth();
				});

				renderer.resize(canvasWidth, currentY + 150);
			}

        }

        let beatmaker;
        document.addEventListener('DOMContentLoaded', () => {
            beatmaker = new Beatmaker();
        });
