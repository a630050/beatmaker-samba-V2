     const NOTE_NAMES = {
			12: "附點4分", 8: "4分", 6: "附點8分", 4: "8分",
			3: "附點16分", 2: "16分", 1: "32分"
		};

        // 內建預設腳本清單（beats/ 資料夾），離線時也能列出並載入
        // 之後若在 beats/ 新增 .json 檔案，記得同步更新此清單
        const LOCAL_PRESET_BEATS = [
            'Antü Gira Break 2.json',
            'Antü Gira 主節奏.json',
            'Antü Gira 前奏.json',
            'Break 2.json',
            'Break 3.json',
            'Break 4.json',
            'Break 5.json'
        ];
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
				this.minTracks = 4;				this.isPlaying = false;
				this.colorHintMode = null;
				this.maxSub = 1;              // 全曲最大子格數（播放 tick 基準）
				this.currentTick = 0;         // 播放用全域 tick（= 粗格 index * maxSub + 子格偏移）
				this.currentSub = 0;          // 目前掃到的子格（依 tick 動態算出）
				this.stepSizeMultiplier = 1;  // 格寬解析度：1 / 1.5 / 2（不記憶，重新整理一律回到 1×）
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
                this.maxHistory = 20;
				this.lastNotationRenderArgs = null;
				this.notationMarkerMode = 'lr'; // 新增：單軌轉譜記號模式（'lr' 或 'accent'）
				this.soundTestCanPlay = true;
				this.isSingleTrackNotationMode = false; // 需求1-a
                this.singleTrackNotationIndex = -1;   // 需求1-a
                this.playSelectionMode = false; // 需求(B)-1
                this.playSelectionRange = { startTrack: 0, endTrack: 0, startStep: 0, endStep: 0 }; // 需求(B)-1
				this.metronome = {
                    enabled: true,
                    mode: 'sequential',
                    visualStyle: 'classic',
                    color: '#00ff88',
                    sound: 'tick',
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
				  this.percussionTest = new PercussionTestModule(this);
				document.querySelector('.container').classList.toggle('accents-visible', this.showAccents);
				document.addEventListener('visibilitychange', () => {
					if (document.visibilityState === 'visible' && this.audioContext && this.audioContext.state === 'suspended') {
						this.audioContext.resume().catch(e => console.warn('Failed to resume audio on visibility change:', e));
					}
				});
            }
			
			_updatePlayButtons(isPlaying) {
                const mainPlayBtn = document.getElementById('playBtn');
                const notationPlayBtn = document.getElementById('notationPlayBtn');
                const expandedPlayBtn = document.getElementById('expandedPlayBtn');
                const text = isPlaying ? '⏸ 暫停' : '▶ 播放';

                if (mainPlayBtn) {
                    mainPlayBtn.textContent = text;
                    mainPlayBtn.classList.toggle('active', isPlaying);
                }
                if (notationPlayBtn) {
                    notationPlayBtn.textContent = text;
                    notationPlayBtn.classList.toggle('active', isPlaying);
                }
                if (expandedPlayBtn) {
                    expandedPlayBtn.textContent = text;
                    expandedPlayBtn.classList.toggle('active', isPlaying);
                }
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
                    'tick': { type: 'synth', wave: 'sine', freq: 4000, release: 0.05, pitchBend: 0.1 },
                    'tock': { type: 'synth', wave: 'square', freq: 1200, release: 0.08, pitchBend: 0.2 },
                    'woodblock': { type: 'synth', wave: 'triangle', freq: 2000, release: 0.1, pitchBend: 0.8 },
                    'cowbell': { type: 'synth-multi', oscillators: [ [380, 'square'], [570, 'square'] ], release: 0.15 },
                    'shaker': { type: 'noise', filterType: 'bandpass', filterFreq: 3000, filterQ: 2, release: 0.07 },
                    'none': { }
                };
            }		


            saveState(force = false) {
                const currentState = JSON.stringify({
                    tracks: this.tracks.map(track => ({
					    id: track.id,
						label: track.label,
                        drumType: track.drumType,
                        steps: track.steps.map(s => s ? 1 : 0),
                        markers: track.markers,
                        subdivisions: track.subdivisions ? track.subdivisions.map(sd => sd ? { count: sd.count, notes: sd.notes.map(n => n ? 1 : 0), markers: sd.markers } : null) : null,
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
                this.stepsPerBeat = state.stepsPerBeat;				this.tracks = state.tracks.map((trackData, index) => ({
                    ...trackData,
					label: trackData.label || this.defaultTrackLabels[index],
                    steps: trackData.steps.map(s => s === 1 || s === true),
                    markers: trackData.markers || Array(this.totalBeats * this.stepsPerBeat).fill({}),
                    subdivisions: this.normalizeSubdivisions(trackData.subdivisions, this.totalBeats * this.stepsPerBeat)
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
					subdivisions: Array(this.totalBeats * this.stepsPerBeat).fill(null),
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
                    drumType: this.defaultDrums[newTrackIndex] || 'agogo',					steps: Array(this.totalBeats * this.stepsPerBeat).fill(false),
					markers: Array.from({ length: this.totalBeats * this.stepsPerBeat }, () => ({})),
					subdivisions: Array(this.totalBeats * this.stepsPerBeat).fill(null),
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
                });				this.renderTracks();
				this.saveState();
				return true;
			}

			// 將 subdivisions 正規化為指定長度（缺省補 null，舊資料相容）
			normalizeSubdivisions(subdivisions, length) {
				const result = Array(length).fill(null);
				const source = subdivisions || [];
				for (let i = 0; i < length && i < source.length; i++) {
					const sd = source[i];
					if (!sd) continue;
					const count = Math.max(2, Math.min(64, sd.count | 0));
					result[i] = {
						count,
						notes: Array.from({ length: count }, (_, j) => !!(sd.notes && (sd.notes[j] === 1 || sd.notes[j] === true))),
						markers: Array.from({ length: count }, (_, j) => (sd.markers && sd.markers[j]) ? { ...sd.markers[j] } : {})
					};
				}
				return result;
			}

			// 全曲最大的子格數（無分割 = 1）
			computeMaxSubdivision() {
				let max = 1;
				this.tracks.forEach(track => {
					(track.subdivisions || []).forEach(sd => {
						if (sd && sd.count > max) max = sd.count;
					});
				});
				return max;
			}

			// 任一軌道是否已有音符（綠格或子格）
			hasAnyNotes() {
				return this.tracks.some(track =>
					track.steps.some(s => s) ||
					(track.subdivisions || []).some(sd => sd && sd.notes.some(n => n))
				);
			}

			// 依「是否已有音符」鎖定/解鎖「一拍 2/4/8 格」切換按鈕
			updateBeatSettingLock() {
				const locked = this.hasAnyNotes();
				document.querySelectorAll('.beat-setting-btn[data-beat-setting]').forEach(btn => {
					btn.disabled = locked;
					btn.title = locked ? '已有音符（綠格），為避免鼓譜錯亂，請先清除或重設後再切換' : '';
				});
			}			initUI() {
                this.renderTracks();
                const stepZoomSelect = document.getElementById('stepZoomSelect');
                if (stepZoomSelect) stepZoomSelect.value = String(this.stepSizeMultiplier);
                this.updateStepSize();
                this.initSoundAdjustPanel();
                this.bindEvents();
                this.updateExpandButton();
                this.initScrollPosition();
                this.updateStepSize();
				this.updateBeatNumbers();
                this.saveState(true);

                const style = document.createElement('style');
                style.textContent = `
                    .track-control-item.dragging { opacity: 0.4; background: #3498db; }
                    .track-control-item.drag-over { border-top: 2px solid #f39c12; }
                `;
                document.head.appendChild(style);
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

                        <div class="sound-control-buttons" style="margin-top: 15px; display: flex; gap: 10px; justify-content: center;">
                            <button class="btn btn-small action-btn preview-sound-btn" data-drum="${key}">試聽</button>
                            <button class="btn btn-small warning reset-sound-btn" data-drum="${key}">重置</button>
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
                    controlElement.dataset.trackIndex = trackIndex;
                    controlElement.draggable = true;

					const drumOptions = Object.keys(this.drumSounds).map(key =>
						`<option value="${key}" ${track.drumType === key ? 'selected' : ''}>${this.drumSounds[key].name}</option>`
					).join('');

					controlElement.innerHTML = `
					<div class="track-number" data-track-index="${trackIndex}">${track.label}</div>
					<select class="drum-select" data-track="${trackIndex}">${drumOptions}</select>
					<div class="track-controls">
                        <div class="track-control-btn test-btn" data-track="${trackIndex}" title="打擊測試">🥁</div>
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
						const sub = (track.subdivisions || [])[stepIndex];
						const beatClass = stepIndex % this.stepsPerBeat === 0 ? ' beat-marker' : '';

						// 已分割的格子：在原本一格的範圍內顯示多個子格長條（留空隙）
						if (sub) {
							const bars = sub.notes.map((subActive, subIndex) => {
								const m = sub.markers[subIndex] || {};
								const handHTML = m.hand && this.showMarkers ? `<span class="sub-marker-text">${m.hand}</span>` : '';
								const accentHTML = m.accent ? `<span class="sub-marker-text sub-accent-marker">${m.accent}</span>` : '';
								const restHTML = m.rest ? `<span class="sub-marker-text sub-rest-marker">${m.rest}</span>` : '';
								return `<div class="sub-step ${subActive ? 'active' : ''}" data-track="${trackIndex}" data-step="${stepIndex}" data-sub="${subIndex}">${handHTML}${accentHTML}${restHTML}</div>`;
							}).join('');
							return `<div class="step split${beatClass}" data-track="${trackIndex}" data-step="${stepIndex}">${bars}</div>`;
						}

						const marker = track.markers[stepIndex] || {};
						
						const handMarkerHTML = marker.hand ? `<span class="marker-text">${marker.hand}</span>` : '';
						const accentMarkerHTML = marker.accent ? `<span class="accent-marker">${marker.accent}</span>` : '';
                        const restMarkerHTML = marker.rest ? `<span class="rest-marker">${marker.rest}</span>` : '';

						let numberHTML = '';
						if (this.showNumbers && active) {
							const beatNumber = Math.floor(stepIndex / this.stepsPerBeat) + 1;
							numberHTML = `<span class="beat-number-text">${beatNumber}</span>`;
						}

						return `<div class="step ${active ? 'active' : ''}${beatClass}" data-track="${trackIndex}" data-step="${stepIndex}">${numberHTML}${handMarkerHTML}${accentMarkerHTML}${restMarkerHTML}</div>`;
					}).join('');

					stepsElement.innerHTML = `<div class="steps">${steps}</div>`;
					trackStepsContainer.appendChild(stepsElement);
				});
				this.updateColorHints();
				this.updateBeatSettingLock();
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
				
				document.getElementById('playBtn').addEventListener('click', (e) => this.togglePlay(e));
				document.getElementById('clearBtn').addEventListener('click', () => this.clearAll());
				document.getElementById('resetBtn').addEventListener('click', () => this.resetAll());
				document.getElementById('undoBtn').addEventListener('click', () => this.undo());
				document.getElementById('redoBtn').addEventListener('click', () => this.redo());

				document.getElementById('exportBtn').addEventListener('click', () => this.exportPattern());
				document.getElementById('exportMp3Btn').addEventListener('click', () => this.exportMP3());
				document.getElementById('fileInput').addEventListener('change', (e) => {
					this.importPattern(e.target.files[0]);
					const modal = document.getElementById('loadModal');
					if(modal && modal.style.display === 'flex') this.toggleLoadModal();
				});
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

				const stepZoomSelect = document.getElementById('stepZoomSelect');
				if (stepZoomSelect) {
					stepZoomSelect.value = String(this.stepSizeMultiplier);
					stepZoomSelect.addEventListener('change', (e) => {
						const zoom = parseFloat(e.target.value);
						this.stepSizeMultiplier = zoom;
						this.updateStepSize();
					});
				}

				document.getElementById('expandBtn').addEventListener('click', () => this.expandBeats());
                document.getElementById('reduceStartBtn').addEventListener('click', () => this.reduceBeatsFromStart());
				document.getElementById('reduceEndBtn').addEventListener('click', () => this.reduceBeatsFromEnd());

				document.getElementById('positionIndicator').addEventListener('click', (e) => this.handleSeek(e));

				const toggleRowBtn = document.getElementById('toggleControlRowBtn');
				if (toggleRowBtn) {
					toggleRowBtn.addEventListener('click', () => {
						const controlRow = document.querySelector('.control-row');
						if (controlRow) {
							controlRow.classList.toggle('collapsed');
							const isCollapsed = controlRow.classList.contains('collapsed');
							toggleRowBtn.textContent = isCollapsed ? '▼' : '▲';
							setTimeout(() => {
								this.updateStepSize();
								this.updateBeatNumbers();
							}, 100);
						}
					});
				}

				document.getElementById('selectBtn').addEventListener('click', () => this.toggleSelectionMode());
				document.getElementById('markBtn').addEventListener('click', () => this.toggleMarkingMode());

				document.getElementById('copySelectionBtn').addEventListener('click', () => this.copySelection());
				document.getElementById('pasteSelectionBtn').addEventListener('click', () => this.pasteSelection());
				document.getElementById('savePatternBtn').addEventListener('click', () => this.saveSelectionAsPattern());
				document.getElementById('loadPatternBtn').addEventListener('click', () => document.getElementById('patternFileInput').click());
				document.getElementById('patternFileInput').addEventListener('change', (e) => {
					this.loadPatternToClipboard(e.target.files[0]);
					e.target.value = '';
				});				document.getElementById('convertNotationBtn').addEventListener('click', () => this.convertSelectionToNotation());
				document.getElementById('splitStepBtn').addEventListener('click', () => this.splitSelection());
				document.getElementById('mergeStepBtn').addEventListener('click', () => this.mergeSelection());

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
					
					if (e.target.classList.contains('test-btn')) { // <-- START: 新增區塊
						const trackIndex = parseInt(e.target.dataset.track);
						this.percussionTest.openTest(trackIndex);
						return;
					} 
					if (e.target.classList.contains('notation-btn')) {
						const trackIndex = parseInt(e.target.dataset.track);
						this.convertSingleTrackToNotation(trackIndex);
						return;
					}
					if (e.target.classList.contains('step')) {
						this.handleStepClick(e.target);
					}
					if (e.target.classList.contains('sub-step')) {
						const trackIndex = parseInt(e.target.dataset.track);
						const stepIndex = parseInt(e.target.dataset.step);
						const subIndex = parseInt(e.target.dataset.sub);
						this.handleSubStepClick(e.target, trackIndex, stepIndex, subIndex);
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
				});				sequencer.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (e.target.classList.contains('step')) {
                        const trackIndex = parseInt(e.target.dataset.track);
                        const stepIndex = parseInt(e.target.dataset.step);
                        this.applyRestMarker(trackIndex, stepIndex, e.target);
                    }
                    if (e.target.classList.contains('sub-step')) {
                        const trackIndex = parseInt(e.target.dataset.track);
                        const stepIndex = parseInt(e.target.dataset.step);
                        const subIndex = parseInt(e.target.dataset.sub);
                        this.applySubRestMarker(trackIndex, stepIndex, subIndex);
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
				
				this.setupModalEvents('metronomeModal', 'metronomeBtn', 'closeMetronomeModal');
                this.bindMetronomePanelEvents();
                this.initDraggableMetronome();
                this.bindMetronomeExpandedEvents();
				
				
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
				
				document.getElementById('showBeatHintCheckbox').addEventListener('change', () => {
                    if (!this.lastNotationRenderArgs) return;

                    if (this.lastNotationRenderArgs.type === 'stacked') {
                        this.convertRangeToNotationStacked(...this.lastNotationRenderArgs.args);
                    } else {
                        this.convertRangeToNotation(...this.lastNotationRenderArgs.args);
                    }
                });
                
				document.getElementById('notationPlayBtn').addEventListener('click', () => {
					this.toggleNotationPlayback();
				});
				
				document.getElementById('notationPrintBtn').addEventListener('click', () => {
					this.printNotation();
				});


                this.bindDragAndDropEvents();
			}

            bindDragAndDropEvents() {
                const trackControlsContainer = document.getElementById('trackControls');
                let draggedTrackOriginalIndex = null;

                trackControlsContainer.addEventListener('dragstart', e => {
                    const target = e.target.closest('.track-control-item');
                    if (target) {
                        draggedTrackOriginalIndex = parseInt(target.dataset.trackIndex);
                        e.dataTransfer.effectAllowed = 'move';
                        setTimeout(() => target.classList.add('dragging'), 0);
                    }
                });

                trackControlsContainer.addEventListener('dragend', e => {
                    const target = e.target.closest('.track-control-item');
                    if (target) {
                        target.classList.remove('dragging');
                    }
                    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
                });

                trackControlsContainer.addEventListener('dragover', e => {
                    e.preventDefault();
                    const target = e.target.closest('.track-control-item');
                    
                    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
                    
                    if (target) {
                        target.classList.add('drag-over');
                    }
                });

                trackControlsContainer.addEventListener('drop', e => {
                    e.preventDefault();
                    const dropTarget = e.target.closest('.track-control-item');
                    
                    if (dropTarget && draggedTrackOriginalIndex !== null) {
                        const droppedOnIndex = parseInt(dropTarget.dataset.trackIndex);
                        
                        if (draggedTrackOriginalIndex === droppedOnIndex) {
                            return;
                        }

                        const [draggedItem] = this.tracks.splice(draggedTrackOriginalIndex, 1);
                        this.tracks.splice(droppedOnIndex, 0, draggedItem);
                        
                        this.tracks.forEach((track, index) => {
                            track.id = index;
                        });
                        
                        draggedTrackOriginalIndex = null;
                        this.renderTracks();
                        this.saveState();
                    }
                });
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
                );				if (targetStep >= 0) {
                    this.currentStep = targetStep;
                    this.currentTick = targetStep * this.maxSub;
                    this.currentOffsetInCell = 0;
                    this.updateSeekHighlight(this.currentStep);
                    this.updateBeatNumbers();
                    this.snapScrollToCurrentStep(); // 寬格時讓點選的位置滾進可視範圍
                }
            }

            updateSeekHighlight(stepIndex) {
                document.querySelectorAll('.step.step-highlighted').forEach(el => el.classList.remove('step-highlighted'));

                if (stepIndex === null || this.isPlaying) return;

                document.querySelectorAll(`.step[data-step="${stepIndex}"]`).forEach(el => el.classList.add('step-highlighted'));
            }

            findNoteElementsForTrackStep(trackIndex, stepIndex) {
                const possibleElements = [];
                
                const directId = document.getElementById(`vf-note-${trackIndex}-${stepIndex}`);
                if (directId) {
                    possibleElements.push(directId);
                }
                
                const allNoteElements = document.querySelectorAll('[id^="vf-note-"], [data-note-id^="vf-note-"]');
                
                allNoteElements.forEach(element => {
                    const id = element.id || element.getAttribute('data-note-id') || '';
                    const idParts = id.split('-');
                    
                    if (idParts.length >= 4 && idParts[0] === 'vf' && idParts[1] === 'note') {
                        const noteTrackIndex = parseInt(idParts[2]);
                        const noteStepIndex = parseInt(idParts[3]);
                        
                        if (noteTrackIndex === trackIndex) {
                            if (noteStepIndex === stepIndex) {
                                if (!possibleElements.includes(element)) {
                                    possibleElements.push(element);
                                }
                            } else if (noteStepIndex < stepIndex) {
                                let isLongNote = true;
                                for (let checkStep = noteStepIndex + 1; checkStep <= stepIndex; checkStep++) {
                                    const nextNoteId = document.getElementById(`vf-note-${trackIndex}-${checkStep}`);
                                    if (nextNoteId && nextNoteId !== element) {
                                        isLongNote = false;
                                        break;
                                    }
                                }
                                if (isLongNote && !possibleElements.includes(element)) {
                                    possibleElements.push(element);
                                }
                            }
                        }
                    }
                });
                
                const dataElements = document.querySelectorAll(`[data-track="${trackIndex}"][data-step="${stepIndex}"]`);
                dataElements.forEach(element => {
                    const noteElement = element.closest('[id^="vf-note-"]') || element;
                    if (!possibleElements.includes(noteElement)) {
                        possibleElements.push(noteElement);
                    }
                });
                
                return possibleElements;
            }

            scrollToNoteInModal(noteEl) {
                if (!noteEl) return;

                const modalBody = document.getElementById('notationContent');
                if (!modalBody) return;

                try {
                    const noteRect = noteEl.getBoundingClientRect();
                    const bodyRect = modalBody.getBoundingClientRect();
                    
                    const buffer = 50;
                    const isAbove = noteRect.top < (bodyRect.top + buffer);
                    const isBelow = noteRect.bottom > (bodyRect.bottom - buffer);
                    
                    if (isAbove || isBelow) {
                        const modalBodyRect = modalBody.getBoundingClientRect();
                        const noteAbsoluteTop = noteRect.top - modalBodyRect.top + modalBody.scrollTop;
                        
                        const viewportHeight = modalBody.clientHeight;
                        const targetScrollTop = noteAbsoluteTop - (viewportHeight * 0.3);
                        
                        const finalScrollTop = Math.max(0, targetScrollTop);
                        
                        modalBody.scrollTo({
                            top: finalScrollTop,
                            behavior: 'smooth'
                        });
                    }
                } catch (error) {
                    console.warn('捲動到音符位置時發生錯誤:', error);
                    if (noteEl.scrollIntoView) {
                        noteEl.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center',
                            inline: 'nearest'
                        });
                    }
                }
            }

            ensureTrackVisible(trackIndex, startTrack) {
                const modal = document.getElementById('notationModal');
                if (!modal) return;

                const modalBody = modal.querySelector('.modal-body');
                if (!modalBody) return;

                // 樂譜佈局常數
                const STAVE_H = 52;
                const STAVE_GAP = 10;
                const LINE_GAP = 46;
                const TOP_MARGIN = 24;				// 計算每行可容納的小節數（有分割時有效一拍格數變多，需較寬）
                const espbForLayout = this.stepsPerBeat * this.computeMaxSubdivision();
                const FIXED_MEASURE_W = (espbForLayout >= 8) ? 440 : 380;
                const modalBodyWidth = modalBody.clientWidth || 960;
                const LEFT_MARGIN = 8, RIGHT_MARGIN = 12, LEFT_LABEL_W = 90;
                const available = Math.max(320, modalBodyWidth - (LEFT_MARGIN + RIGHT_MARGIN + LEFT_LABEL_W));
                const measuresPerLine = Math.max(1, Math.floor(available / FIXED_MEASURE_W));
                
                // 計算當前播放位置所在的段落（大行）
                const currentMeasure = Math.floor(this.currentStep / (4 * this.stepsPerBeat));
                const currentLine = Math.floor(currentMeasure / measuresPerLine);
                
                // 計算顯示的軌道數量
                const tracksInDisplay = this.lastNotationRenderArgs ? 
                    (this.lastNotationRenderArgs.args[1] - this.lastNotationRenderArgs.args[0] + 1) : 1;
                
                // 計算該段落第一個軌道的Y位置
                const sectionFirstTrackY = TOP_MARGIN + currentLine * (tracksInDisplay * (STAVE_H + STAVE_GAP) + LINE_GAP);
                
                // 計算該段落所有軌道的總高度
                const sectionTotalHeight = tracksInDisplay * (STAVE_H + STAVE_GAP);
                
                // 獲取視窗高度
                const viewportHeight = modalBody.clientHeight;
                const currentScrollTop = modalBody.scrollTop;
                
                // 檢查該段落是否完全在可視範圍內
                const sectionTop = sectionFirstTrackY;
                const sectionBottom = sectionFirstTrackY + sectionTotalHeight;
                const viewportTop = currentScrollTop;
                const viewportBottom = currentScrollTop + viewportHeight;
                
                // 判斷是否需要滾動
                let needScroll = false;
                let targetScrollTop = currentScrollTop;
                
                if (sectionTop < viewportTop) {
                    // 段落頂部被遮住，需要向上滾動
                    needScroll = true;
                    targetScrollTop = sectionTop - 20; // 留一點邊距
                } else if (sectionBottom > viewportBottom) {
                    // 段落底部被遮住，需要向下滾動
                    needScroll = true;
                    
                    // 如果段落高度小於視窗高度，將段落頂部移到視窗頂部
                    if (sectionTotalHeight <= viewportHeight - 40) {
                        targetScrollTop = sectionTop - 20;
                    } else {
                        // 如果段落高度大於視窗高度，滾動到能看到更多內容的位置
                        targetScrollTop = sectionBottom - viewportHeight + 20;
                    }
                }
                
                // 確保不會滾動超出範圍
                const maxScrollTop = modalBody.scrollHeight - viewportHeight;
                targetScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
                
                if (needScroll) {
                    modalBody.scrollTo({ 
                        top: targetScrollTop, 
                        behavior: 'smooth' 
                    });
                }
            }

            printNotation() {
                const notationContent = document.getElementById('notationContent');
                if (!notationContent) {
                    alert('找不到樂譜內容');
                    return;
                }

                // 獲取當前樂譜的SVG元素
                const svgElement = notationContent.querySelector('svg');
                if (!svgElement) {
                    alert('找不到樂譜SVG');
                    return;
                }

                // 創建新的視窗用於列印
                const printWindow = window.open('', '_blank');
                if (!printWindow) {
                    alert('無法開啟列印視窗，請檢查瀏覽器彈出視窗設定');
                    return;
                }

                // 獲取樂譜資訊
                let title = '樂譜';
                if (this.lastNotationRenderArgs) {
                    if (this.lastNotationRenderArgs.type === 'stacked') {
                        const [startTrack, endTrack, startStep, endStep] = this.lastNotationRenderArgs.args;
                        const startBeat = Math.floor(startStep / this.stepsPerBeat) + 1;
                        const endBeat = Math.floor(endStep / this.stepsPerBeat) + 1;
                        title = `多軌樂譜 (軌道 ${startTrack + 1}-${endTrack + 1}, 第${startBeat}拍到第${endBeat}拍)`;
                    } else {
                        const [startTrack, endTrack, startStep, endStep] = this.lastNotationRenderArgs.args;
                        const startBeat = Math.floor(startStep / this.stepsPerBeat) + 1;
                        const endBeat = Math.floor(endStep / this.stepsPerBeat) + 1;
                        title = `單軌樂譜 (軌道 ${startTrack + 1}, 第${startBeat}拍到第${endBeat}拍)`;
                    }
                }

                // 克隆SVG元素
                const svgClone = svgElement.cloneNode(true);
                
				// 設置SVG的尺寸以適應列印
				// 移除固定的高度設定，讓瀏覽器自動處理分頁
				// 將寬度設為100%，以填滿頁面寬度
				svgClone.setAttribute('width', '100%');
				svgClone.removeAttribute('height');

                // 建立列印頁面的HTML
                const printHTML = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>${title}</title>
                        <style>
                            @page {
                                size: A4;
                                margin: 0.8cm;
                            }
                            body {
                                margin: 0;
                                padding: 10px;
                                font-family: Arial, sans-serif;
                                background: white;
                                line-height: 1.2;
                            }
                            .header {
                                text-align: center;
                                margin-bottom: 10px;
                                border-bottom: 1px solid #ccc;
                                padding-bottom: 8px;
                            }
                            .header h1 {
                                font-size: 16px;
                                margin: 0 0 5px 0;
                                font-weight: bold;
                            }
                            .header p {
                                font-size: 11px;
                                margin: 0;
                                color: #666;
                            }
                            .notation-container {
                                text-align: left;
                                margin-top: 5px;
                            }
                            svg {
                                max-width: 100%;
                                height: auto !important; /* 確保覆蓋所有行內樣式 */
                                display: block;
                                margin: 0 auto;
                            }
                            .footer {
                                margin-top: 10px;
                                text-align: center;
                                font-size: 10px;
                                color: #999;
                                page-break-inside: avoid;
                            }
                            @media print {
                                body { 
                                    -webkit-print-color-adjust: exact;
                                    print-color-adjust: exact;
                                }
                                .header {
                                    page-break-after: avoid;
                                }
                                .notation-container {
                                    page-break-before: avoid;
                                }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1>${title}</h1>
                            <p>產生時間: ${new Date().toLocaleString('zh-TW')}</p>
                        </div>
                        <div class="notation-container">
                            ${svgClone.outerHTML}
                        </div>
                        <div class="footer">
                            <p>由 Beat Maker 產生</p>
                        </div>
                    </body>
                    </html>
                `;

                // 寫入列印視窗並執行列印
                printWindow.document.write(printHTML);
                printWindow.document.close();

                // 等待內容載入完成後執行列印
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        // 列印完成後關閉視窗
                        printWindow.onafterprint = () => {
                            printWindow.close();
                        };
                    }, 500);
                };
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
			
            bindMetronomePanelEvents() {
                const modal = document.getElementById('metronomeModal');
                
                modal.querySelectorAll('input[name="metronome-enabled"]').forEach(radio => {
                    radio.addEventListener('change', (e) => {
                        this.metronome.enabled = e.target.value === 'true';
                    });
                });

                modal.querySelectorAll('input[name="metronome-mode"]').forEach(radio => {
                    radio.addEventListener('change', (e) => {
                        this.metronome.mode = e.target.value;
                    });
                });

                modal.querySelectorAll('input[name="metronome-visual"]').forEach(radio => {
                    radio.addEventListener('change', (e) => {
                        this.metronome.visualStyle = e.target.value;
                        this.updateMetronomeDisplay();
                    });
                });

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

                document.getElementById('metronomeSoundSelect').addEventListener('change', (e) => {
                    this.metronome.sound = e.target.value;
                });

                document.getElementById('metronomeVolumeSlider').addEventListener('input', (e) => {
                    this.metronome.volume = parseFloat(e.target.value);
                });

                const resetPosBtn = document.getElementById('resetMetronomePosBtn');
                if (resetPosBtn) {
                    resetPosBtn.addEventListener('click', () => {
                        const wrapper = document.getElementById('metronomeDisplayWrapper');
                        if (wrapper) {
                            localStorage.removeItem('metronome_panel_position');
                            wrapper.style.left = '';
                            wrapper.style.top = '';
                            wrapper.style.right = '';
                            wrapper.style.bottom = '';
                            wrapper.style.transform = '';
                        }
                    });
                }
            }

            updateMetronomeUI() {
                document.querySelector(`input[name="metronome-enabled"][value="${this.metronome.enabled}"]`).checked = true;
                
                const modeRadio = document.querySelector(`input[name="metronome-mode"][value="${this.metronome.mode}"]`);
                if (modeRadio) modeRadio.checked = true;

                const visualRadio = document.querySelector(`input[name="metronome-visual"][value="${this.metronome.visualStyle}"]`);
                if (visualRadio) visualRadio.checked = true;
                
                this.updateMetronomeDisplay();

                const color = this.metronome.color;
                document.getElementById('metronomeColorPicker').value = color;
                document.documentElement.style.setProperty('--metronome-light-color', color);
                document.querySelectorAll('.color-preset-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.color === color);
                });

                document.getElementById('metronomeSoundSelect').value = this.metronome.sound;
                document.getElementById('metronomeVolumeSlider').value = this.metronome.volume;
            }

            updateMetronomeDisplay() {
                const classicLights = document.getElementById('metronomeLightsContainer');
                const footprintIndicator = document.getElementById('footprintIndicatorContainer');
                const expandedLights = document.getElementById('expandedMetronomeLights');
                const expandedFootprints = document.getElementById('expandedFootprintIndicator');

                const isFootprints = this.metronome.visualStyle === 'footprints';

                if (classicLights && footprintIndicator) {
                    classicLights.style.display = isFootprints ? 'none' : 'flex';
                    footprintIndicator.style.display = isFootprints ? 'flex' : 'none';
                }

                if (expandedLights && expandedFootprints) {
                    expandedLights.style.display = isFootprints ? 'none' : 'flex';
                    expandedFootprints.style.display = isFootprints ? 'flex' : 'none';
                }

                // 同步全屏控制组按扭激活状态
                const classicBtn = document.getElementById('expandedVisualClassicBtn');
                const footprintsBtn = document.getElementById('expandedVisualFootprintsBtn');
                if (classicBtn && footprintsBtn) {
                    classicBtn.classList.toggle('active', !isFootprints);
                    footprintsBtn.classList.toggle('active', isFootprints);
                }

                // 同步设置弹窗中的 radio 选中状态
                const visualRadio = document.querySelector(`input[name="metronome-visual"][value="${this.metronome.visualStyle}"]`);
                if (visualRadio) visualRadio.checked = true;
            }

            /**
             * 初始化可拖拽的节拍器面板
             */
            initDraggableMetronome() {
                const wrapper = document.getElementById('metronomeDisplayWrapper');
                if (!wrapper) return;

                let isDragging = false;
                let startX = 0;
                let startY = 0;
                let initialLeft = 0;
                let initialTop = 0;
                let hasMoved = false;

                // 从 localStorage 恢复保存的位置（如果存在）
                const savedPos = localStorage.getItem('metronome_panel_position');
                if (savedPos) {
                    try {
                        const { left, top } = JSON.parse(savedPos);
                        const maxLeft = Math.max(0, window.innerWidth - wrapper.offsetWidth);
                        const maxTop = Math.max(0, window.innerHeight - wrapper.offsetHeight);
                        const clampLeft = Math.min(Math.max(0, left), maxLeft);
                        const clampTop = Math.min(Math.max(0, top), maxTop);
                        wrapper.style.left = clampLeft + 'px';
                        wrapper.style.top = clampTop + 'px';
                        wrapper.style.right = 'auto';
                        wrapper.style.bottom = 'auto';
                        wrapper.style.transform = 'none';
                    } catch (e) {
                        console.warn('解析节拍器面板位置失败:', e);
                    }
                }

                // 重置浮动面板位置
                const resetPosition = () => {
                    localStorage.removeItem('metronome_panel_position');
                    wrapper.style.left = '';
                    wrapper.style.top = '';
                    wrapper.style.right = '';
                    wrapper.style.bottom = '';
                    wrapper.style.transform = '';
                };

                // 右键点击直接重置面板位置
                wrapper.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    resetPosition();
                });

                let longPressTimer = null;

                const onPointerDown = (e) => {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') {
                        return;
                    }
                    isDragging = true;
                    hasMoved = false;

                    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

                    startX = clientX;
                    startY = clientY;

                    const rect = wrapper.getBoundingClientRect();
                    initialLeft = rect.left;
                    initialTop = rect.top;

                    wrapper.classList.add('dragging');

                    // 移动端长按 600ms 重置位置
                    longPressTimer = setTimeout(() => {
                        if (!hasMoved) {
                            resetPosition();
                        }
                    }, 600);
                };

                const onPointerMove = (e) => {
                    if (!isDragging) return;

                    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

                    const deltaX = clientX - startX;
                    const deltaY = clientY - startY;

                    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                        hasMoved = true;
                        if (longPressTimer) clearTimeout(longPressTimer);
                    }

                    if (hasMoved) {
                        if (e.cancelable) e.preventDefault();

                        let newLeft = initialLeft + deltaX;
                        let newTop = initialTop + deltaY;

                        const maxLeft = Math.max(0, window.innerWidth - wrapper.offsetWidth);
                        const maxTop = Math.max(0, window.innerHeight - wrapper.offsetHeight);

                        newLeft = Math.min(Math.max(0, newLeft), maxLeft);
                        newTop = Math.min(Math.max(0, newTop), maxTop);

                        wrapper.style.left = newLeft + 'px';
                        wrapper.style.top = newTop + 'px';
                        wrapper.style.right = 'auto';
                        wrapper.style.bottom = 'auto';
                        wrapper.style.transform = 'none';
                    }
                };

                let lastClickTime = 0;

                const onPointerUp = () => {
                    if (longPressTimer) clearTimeout(longPressTimer);
                    if (!isDragging) return;
                    isDragging = false;
                    wrapper.classList.remove('dragging');

                    if (hasMoved) {
                        const rect = wrapper.getBoundingClientRect();
                        localStorage.setItem('metronome_panel_position', JSON.stringify({
                            left: rect.left,
                            top: rect.top
                        }));
                    } else {
                        // 如果没有移动，进行双击/双点按检测（350ms 内连续点击两次）
                        const now = Date.now();
                        if (now - lastClickTime < 350) {
                            const overlay = document.getElementById('metronomeExpandedOverlay');
                            const bpmDisplay = document.getElementById('expandedBpmDisplay');
                            if (overlay) {
                                overlay.style.display = 'flex';
                                if (bpmDisplay) bpmDisplay.textContent = `BPM: ${this.bpm}`;
                                this.updateMetronomeDisplay();
                            }
                            lastClickTime = 0;
                        } else {
                            lastClickTime = now;
                        }
                    }
                };

                // 鼠标事件
                wrapper.addEventListener('mousedown', onPointerDown);
                window.addEventListener('mousemove', onPointerMove);
                window.addEventListener('mouseup', onPointerUp);

                // 触摸屏 / 手机事件
                wrapper.addEventListener('touchstart', onPointerDown, { passive: false });
                window.addEventListener('touchmove', onPointerMove, { passive: false });
                window.addEventListener('touchend', onPointerUp);
                window.addEventListener('touchcancel', onPointerUp);

                // 窗口改变或转屏时，校正面板位置避免越界
                window.addEventListener('resize', () => {
                    if (wrapper.style.left) {
                        const rect = wrapper.getBoundingClientRect();
                        const maxLeft = Math.max(0, window.innerWidth - wrapper.offsetWidth);
                        const maxTop = Math.max(0, window.innerHeight - wrapper.offsetHeight);
                        if (rect.left > maxLeft || rect.top > maxTop) {
                            const clampLeft = Math.min(Math.max(0, rect.left), maxLeft);
                            const clampTop = Math.min(Math.max(0, rect.top), maxTop);
                            wrapper.style.left = clampLeft + 'px';
                            wrapper.style.top = clampTop + 'px';
                        }
                    }
                });
            }

            /**
             * 绑定全屏大节拍器弹窗相关事件
             */
            bindMetronomeExpandedEvents() {
                const wrapper = document.getElementById('metronomeDisplayWrapper');
                const overlay = document.getElementById('metronomeExpandedOverlay');
                const closeBtn = document.getElementById('closeMetronomeExpandedModal');
                const expandedPlayBtn = document.getElementById('expandedPlayBtn');
                const bpmMinusBtn = document.getElementById('expandedBpmMinus');
                const bpmPlusBtn = document.getElementById('expandedBpmPlus');
                const bpmDisplay = document.getElementById('expandedBpmDisplay');
                const classicBtn = document.getElementById('expandedVisualClassicBtn');
                const footprintsBtn = document.getElementById('expandedVisualFootprintsBtn');
                const beatNumbersCheckbox = document.getElementById('expandedShowBeatNumbersCheckbox');
                const visualContainer = document.getElementById('expandedVisualContainer');

                if (!wrapper || !overlay) return;

                // 打开全屏大节拍器弹窗
                const openExpandedModal = () => {
                    overlay.style.display = 'flex';
                    if (bpmDisplay) bpmDisplay.textContent = `BPM: ${this.bpm}`;
                    this._updatePlayButtons(this.isPlaying);
                    this.updateMetronomeDisplay();
                };

                // 播放/暂停控制
                if (expandedPlayBtn) {
                    expandedPlayBtn.addEventListener('click', (e) => {
                        this.togglePlay(e);
                    });
                }

                // 原生 dblclick 双击监听作为备用
                wrapper.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    openExpandedModal();
                });

                // 关闭全屏弹窗
                const closeExpandedModal = () => {
                    overlay.style.display = 'none';
                };

                if (closeBtn) closeBtn.addEventListener('click', closeExpandedModal);
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) closeExpandedModal();
                });

                // 1. BPM 速度调节 (- / +)
                const updateBpm = (delta) => {
                    const newBpm = Math.min(200, Math.max(40, this.bpm + delta));
                    if (newBpm !== this.bpm) {
                        this.bpm = newBpm;
                        document.getElementById('bpmInput').value = this.bpm;
                        if (bpmDisplay) bpmDisplay.textContent = `BPM: ${this.bpm}`;
                        if (this.isPlaying) {
                            clearInterval(this.stepInterval);
                            const stepDuration = (60 / this.bpm) / this.stepsPerBeat * 1000;
                            this.stepInterval = setInterval(() => {
                                this.updateStep();
                                this.currentStep = (this.currentStep + 1);
                                const totalSteps = this.totalBeats * this.stepsPerBeat;
                                if (this.playSelectionMode) {
                                    if (this.currentStep > this.playSelectionRange.endStep) {
                                        this.currentStep = this.playSelectionRange.startStep;
                                    }
                                } else if (this.currentStep >= totalSteps) {
                                    this.currentStep = 0;
                                    this.scrollToBeginning();
                                    if (this.mode === 'sequential') {
                                        this.currentTrack = this.getNextEnabledTrack();
                                    }
                                }
                            }, stepDuration);
                        }
                        this.saveState();
                    }
                };

                if (bpmMinusBtn) bpmMinusBtn.addEventListener('click', () => updateBpm(-1));
                if (bpmPlusBtn) bpmPlusBtn.addEventListener('click', () => updateBpm(1));

                // 2. 模式二选一切换 (灯号 / 脚步)
                if (classicBtn) {
                    classicBtn.addEventListener('click', () => {
                        this.metronome.visualStyle = 'classic';
                        this.updateMetronomeDisplay();
                    });
                }
                if (footprintsBtn) {
                    footprintsBtn.addEventListener('click', () => {
                        this.metronome.visualStyle = 'footprints';
                        this.updateMetronomeDisplay();
                    });
                }

                // 3. 拍数显示复选框
                if (beatNumbersCheckbox && visualContainer) {
                    beatNumbersCheckbox.addEventListener('change', (e) => {
                        visualContainer.classList.toggle('show-beat-numbers', e.target.checked);
                    });
                }
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
						
                        if (modalId === 'notationModal') {
							
							if (this.isPlaying) {
								this.stop();
							}
							this.clearSelection();
                            document.querySelectorAll('.vf-note-playing').forEach(el => el.classList.remove('vf-note-playing'));
                            this.isSingleTrackNotationMode = false; // 需求1-d
                            this.singleTrackNotationIndex = -1;   // 需求1-d
                        }
                    });
                }
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.style.display = 'none';
						 if (modalId === 'notationModal') {
							if (this.isPlaying) {
								this.stop();
							}
							this.clearSelection(); 
                            document.querySelectorAll('.vf-note-playing').forEach(el => el.classList.remove('vf-note-playing'));
                            this.isSingleTrackNotationMode = false; // 需求1-d
                            this.singleTrackNotationIndex = -1;   // 需求1-d
                        }
                    }
                });
            }


            bindSoundPanelEvents() {
                 const soundPanel = document.getElementById('soundAdjustPanel');
                 
                 soundPanel.addEventListener('input', (e) => {
                    const controlItem = e.target.closest('.sound-control-item');
                    if (!controlItem) return;
                    const drumKey = controlItem.dataset.drum;

                    if (e.target.matches('input[type="range"][data-param]')) {
                        const param = e.target.dataset.param;
                        let value = parseFloat(e.target.value);
                        this.drumSounds[drumKey][param] = value;

                        const display = e.target.previousElementSibling.querySelector('.param-value-display');
                        if(display) display.textContent = value;

                        if (this.soundTestCanPlay) {
                            this.testSound(drumKey);
                            this.soundTestCanPlay = false;
                            setTimeout(() => { this.soundTestCanPlay = true; }, 100);
                        }
                    }
                });

                soundPanel.addEventListener('change', (e) => {
                     const controlItem = e.target.closest('.sound-control-item');
                    if (!controlItem) return;
                    const drumKey = controlItem.dataset.drum;

                    if (e.target.matches('select[data-param]')) {
                        this.drumSounds[drumKey][e.target.dataset.param] = e.target.value;
                        this.testSound(drumKey);
                    }
                    
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
                    if (e.target.classList.contains('preview-sound-btn')) {
                        this.testSound(drumKey);
                    }
                    if (e.target.classList.contains('reset-sound-btn')) {
                        this.resetSingleSound(drumKey);
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
                const baseStepSize = Math.max(MIN_STEP_SIZE, Math.min(MAX_STEP_SIZE, idealStepSize));
                const finalStepSize = baseStepSize * this.stepSizeMultiplier;
                // 高度固定基準大小；寬度 = 基準 × 解析度倍率（只動寬度）
                document.documentElement.style.setProperty('--step-size', `${baseStepSize}px`);
                document.documentElement.style.setProperty('--step-width', `${finalStepSize}px`);
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
                // 只要有任何音符（綠格）就禁止切換，避免鼓譜錯亂
                if (this.hasAnyNotes()) {
                    alert('目前已有音符（綠格），為避免鼓譜錯亂，請先「重設」清除所有音符後再切換「一拍長度」。');
                    document.querySelectorAll('.beat-setting-btn[data-beat-setting]').forEach(btn => {
                        btn.classList.toggle('active', parseInt(btn.dataset.beatSetting) === this.stepsPerBeat);
                    });
                    return;
                }

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
                    // 切換一拍長度時一併清除所有分割（避免資料錯亂）
                    track.subdivisions = Array(this.totalBeats * this.stepsPerBeat).fill(null);
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

			togglePlay(e) {
				
				const notationModal = document.getElementById('notationModal');
				if (notationModal.style.display === 'flex') {
					this.toggleNotationPlayback();
					return; // 直接結束，交由新函式處理
				}
				
                if (this.selectionMode) this.toggleSelectionMode();
                if (this.isPlaying) {
                    this.pause();
                } else {
                    this.play();
                }
            }
			
			toggleNotationPlayback() {
				if (this.isPlaying) {
					this.pause();
					return;
				}

				if (!this.lastNotationRenderArgs) {
					console.warn("找不到樂譜渲染資訊，執行一般播放");
					this.play();
					return;
				}

				const args = this.lastNotationRenderArgs.args;
				let startTrack, endTrack, startStep, endStep;

				if (this.lastNotationRenderArgs.type === 'stacked') {
					[startTrack, endTrack, startStep, endStep] = args;
				} else { // 'single'
					[startTrack, endTrack, startStep, endStep] = args;
				}
				
				// 啟用選區播放模式
				this.playSelectionMode = true;
				
				// 設定播放範圍
				this.playSelectionRange = {
					startTrack: startTrack,
					endTrack: endTrack,
					startStep: startStep,
					endStep: endStep
				};

				// 從選區的開頭開始播放
				this.currentStep = startStep;
				
				this.play();
			}
            
            playFromBeginning(e) {
                // 'b' 鍵功能：回到開頭繼續播放
                if (e && e.key === 'b' && this.isSelectionActive()) {
                    e.preventDefault();
                    this.playSelectionMode = true;
                    this.captureSelectionRange();
                    if (this.isPlaying) this.stop();
                    this.currentStep = this.playSelectionRange.startStep;
                    this.play();
                    return;
                }
                
                // 一般情況：回到開頭播放
                if (this.isPlaying) this.stop();
                this.currentStep = 0;
                this.play();
            }

			async play() {
				if (!this.audioContext) await this.initAudio();
				if (this.audioContext && this.audioContext.state === 'suspended') {
					try { await this.audioContext.resume(); } catch (e) { console.warn('Failed to resume audio context on play:', e); }
				}

                this.isPlaying = true;
				this.updateSeekHighlight(null);
                this._updatePlayButtons(true);
				
                if (this.mode === 'sequential' && !this.playSelectionMode) {
                    this.currentTrack = this.getFirstEnabledTrack();
                }

				this.snapScrollToCurrentStep();

                const stepDuration = (60 / this.bpm) / this.stepsPerBeat * 1000;
                // 播放引擎改為「tick 制」：全曲以最大子格數為基準切成細 tick，
                // 讓分割格內的每個子格都能在正確的時機發聲並依序高亮
                this.maxSub = this.computeMaxSubdivision();
                const tickDuration = stepDuration / this.maxSub;
                const totalSteps = this.totalBeats * this.stepsPerBeat;
                const totalTicks = totalSteps * this.maxSub;

                this.currentTick = this.currentStep * this.maxSub;

                this.updateStep();

                this.currentTick = (this.currentTick + 1); // 暫時不取餘數，讓 updateStep 判斷
                
                if (!this.playSelectionMode && this.currentTick >= totalTicks) {
                    this.currentTick = 0;
                    if (this.mode === 'sequential') this.currentTrack = this.getNextEnabledTrack();
                }


				this.stepInterval = setInterval(() => {
					this.updateStep();
					this.currentTick = (this.currentTick + 1);
					
					// === START: 新增的循環邏輯（tick 制） ===
					if (this.playSelectionMode) {
						if (this.currentTick > (this.playSelectionRange.endStep + 1) * this.maxSub - 1) {
							this.currentTick = this.playSelectionRange.startStep * this.maxSub;
						}
					} 
					// === END: 新增的循環邏輯 ===
					else if (!this.playSelectionMode && this.currentTick >= totalTicks) { // 將 if 改為 else if
						this.currentTick = 0;
						this.scrollToBeginning();
						if (this.mode === 'sequential') {
							this.currentTrack = this.getNextEnabledTrack();
						}
					}
				}, tickDuration);
            }
			
			
			pause() {
                this.isPlaying = false;
                this._updatePlayButtons(false);
                if (this.stepInterval) clearInterval(this.stepInterval);
                this.stepInterval = null;
                document.querySelectorAll('.playing').forEach(el => el.classList.remove('playing'));
                document.querySelectorAll('.sub-step.playing').forEach(el => el.classList.remove('playing'));
            }

			stop() {
                this.isPlaying = false;
                this._updatePlayButtons(false);
                if (this.stepInterval) clearInterval(this.stepInterval);
                this.stepInterval = null;
                this.currentStep = 0;
                this.currentTick = 0;
                this.currentTrack = 0;
                this.scrollToBeginning();
                document.querySelectorAll('.playing').forEach(el => el.classList.remove('playing'));
                document.querySelectorAll('.sub-step.playing').forEach(el => el.classList.remove('playing'));
                
                document.querySelectorAll('.vf-note-playing').forEach(el => el.classList.remove('vf-note-playing'));

				this.updateSeekHighlight(null);
                this.updateBeatNumbers();

                // 需求(B)-5: 結束播放時重置框選模式
                this.playSelectionMode = false;
                this.playSelectionRange = { startTrack: 0, endTrack: 0, startStep: 0, endStep: 0 };
            }

            // 某一格目前的子格 index（依該格自己的分割數與目前 tick 偏移換算）
            getSubIndexForCell(track, stepIndex) {
                if (!track) return 0;
                const cell = track.subdivisions && track.subdivisions[stepIndex];
                if (!cell) return 0;
                const offsetInCell = this.currentTick % this.maxSub;
                return Math.min(cell.count - 1, Math.floor(offsetInCell * cell.count / this.maxSub));
            }

            // 判斷某一格在目前 tick 偏移下是否該發聲（支援分割格）
            isNoteAt(track, stepIndex, offsetInCell) {
                if (!track) return false;
                const cell = track.subdivisions && track.subdivisions[stepIndex];
                if (cell) {
                    const j = Math.min(cell.count - 1, Math.floor(offsetInCell * cell.count / this.maxSub));
                    const startOffset = Math.round(j * this.maxSub / cell.count);
                    return startOffset === offsetInCell && cell.notes[j] && !(cell.markers[j] && cell.markers[j].rest);
                }
                return offsetInCell === 0 && !!track.steps[stepIndex] && !(track.markers[stepIndex] && track.markers[stepIndex].rest);
            }

            // 在目前 tick 對指定軌道與粗格播放該發聲的音符（支援分割格子格）
            playStepSounds(track, stepIndex) {
                if (!track || !track.enabled || !track.soundEnabled) return;
                const cell = track.subdivisions && track.subdivisions[stepIndex];
                const offsetInCell = this.currentOffsetInCell;

                if (cell) {
                    for (let j = 0; j < cell.count; j++) {
                        const startOffset = Math.round(j * this.maxSub / cell.count);
                        if (startOffset === offsetInCell && cell.notes[j] && !(cell.markers[j] && cell.markers[j].rest)) {
                            const m = cell.markers[j] || {};
                            let v = 1.0;
                            if (m.accent === '>') v = this.accentVolumeMultiplier;
                            else if (m.accent === '•') v = this.ghostVolumeMultiplier;
                            this.playSound(track.drumType, track.soundEnabled, track.volume * v);
                        }
                    }
                } else if (offsetInCell === 0 && track.steps[stepIndex] && !(track.markers[stepIndex] && track.markers[stepIndex].rest)) {
                    const m = track.markers[stepIndex] || {};
                    let v = 1.0;
                    if (m.accent === '>') v = this.accentVolumeMultiplier;
                    else if (m.accent === '•') v = this.ghostVolumeMultiplier;
                    this.playSound(track.drumType, track.soundEnabled, track.volume * v);
                }
            }

            updateStep() {
                // tick 制：由 currentTick 推導目前所在的粗格與子格偏移
                const totalSteps = this.totalBeats * this.stepsPerBeat;
                this.currentStep = Math.min(totalSteps - 1, Math.max(0, Math.floor(this.currentTick / this.maxSub)));
                this.currentOffsetInCell = this.currentTick % this.maxSub;
                this.currentSub = this.getSubIndexForCell(this.tracks[this.currentTrack] || this.tracks[0], this.currentStep);

                // 需求(B)-3: 框選播放模式的邏輯
                if (this.playSelectionMode) {
                    const { startTrack, endTrack } = this.playSelectionRange;
                    
                    this.updateBeatNumbers();
                    this.autoScroll();

                    // 只播放被框選軌道範圍內的聲音
                    for (let t = startTrack; t <= endTrack; t++) {
                        this.playStepSounds(this.tracks[t], this.currentStep);
                    }
                }

                // 需求1-c: 單軌轉譜播放模式的邏輯
                else if (this.isSingleTrackNotationMode && this.singleTrackNotationIndex !== -1) {
                    this.updateBeatNumbers();
                    this.autoScroll();
                    this.playStepSounds(this.tracks[this.singleTrackNotationIndex], this.currentStep);
                } else if (this.mode === 'ensemble') { // 原本的合奏邏輯
                    this.updateBeatNumbers();
                    this.autoScroll();
                    this.tracks.forEach((track) => this.playStepSounds(track, this.currentStep));
                } else if (this.mode === 'sequential') { // 原本的輪奏邏輯
                    this.updateBeatNumbers();
                    this.autoScroll();
                    this.playStepSounds(this.tracks[this.currentTrack], this.currentStep);
                }

                // 節拍器和樂譜高亮邏輯（對所有模式通用）
				if (this.metronome.enabled) {
					if (this.metronome.mode === 'conductor') {
						// 在指揮模式下，每一格都要檢查指揮軌
						const conductorTrack = this.tracks[this.tracks.length - 1];
						if (conductorTrack && conductorTrack.enabled && this.isNoteAt(conductorTrack, this.currentStep, this.currentOffsetInCell)) {
							// 只有當指揮軌在當前音格有音符時，才觸發燈號
							this.triggerMetronome();
						}
					} else {
						// 對於'sequential'和'single'模式，維持原本的邏輯，只在每拍開頭觸發（子格偏移 0 時）
						if (this.currentOffsetInCell === 0 && this.currentStep % this.stepsPerBeat === 0) {
							this.triggerMetronome();
						}
					}
				}
                
                const notationModal = document.getElementById('notationModal');
                if (notationModal.style.display === 'flex') {
                    document.querySelectorAll('.vf-note-playing').forEach(el => el.classList.remove('vf-note-playing'));
                    
                    let tracksToHighlight = [];
                    if (this.isSingleTrackNotationMode) {
                        tracksToHighlight.push(this.singleTrackNotationIndex);
                    } else if (this.playSelectionMode) {
                        for(let i = this.playSelectionRange.startTrack; i <= this.playSelectionRange.endTrack; i++) {
                            tracksToHighlight.push(i);
                        }
                    } else if (this.lastNotationRenderArgs && this.lastNotationRenderArgs.type === 'stacked') {
                        // 多軌轉譜模式：高亮所有在樂譜中顯示的軌道
                        const [startTrack, endTrack] = this.lastNotationRenderArgs.args;
                        for(let i = startTrack; i <= endTrack; i++) {
                            tracksToHighlight.push(i);
                        }
                    } else if (this.mode === 'ensemble') {
                        this.tracks.forEach((t, i) => tracksToHighlight.push(i));
                    } else { // sequential
                        tracksToHighlight.push(this.currentTrack);
                    }

                    let bottomMostNote = null;
					tracksToHighlight.forEach(trackIndex => {
						const hlTrack = this.tracks[trackIndex];
						if (hlTrack && hlTrack.enabled && this.isNoteAt(hlTrack, this.currentStep, this.currentOffsetInCell)) {
							// 有分割時，用展開後的有效 index 找到對應的 32 分音符
							const effIdx = this.getEffectiveIndexForTrack(hlTrack, this.currentStep);
							const possibleNoteElements = this.findNoteElementsForTrackStep(trackIndex, effIdx);
							if (possibleNoteElements.length > 0) {
								possibleNoteElements.forEach(noteEl => {
									noteEl.classList.add('vf-note-playing'); // 應用外層光暈效果
									const children = noteEl.querySelectorAll('*');
									children.forEach(child => {
										// 檢查該元素是否在一個 'vf-annotation' 群組內
										// 如果不是，才給它上色
										if (!child.closest('.vf-annotation')) {
											child.classList.add('vf-note-playing');
										}
									});
									if (!bottomMostNote || trackIndex > (bottomMostNote.trackIndex || -1)) {
										bottomMostNote = { element: noteEl, trackIndex: trackIndex };
									}
								});
							}
						}
					});

                    if (bottomMostNote) {
                        setTimeout(() => this.scrollToNoteInModal(bottomMostNote.element), 100);
                    } else if (this.lastNotationRenderArgs && this.lastNotationRenderArgs.type === 'stacked') {
                        // 多軌轉譜模式下，確保視窗能看到當前播放的軌道範圍
                        const [startTrack, endTrack] = this.lastNotationRenderArgs.args;
                        const playingTracks = tracksToHighlight.filter(t => t >= startTrack && t <= endTrack);
                        if (playingTracks.length > 0) {
                            const lastPlayingTrack = Math.max(...playingTracks);
                            this.ensureTrackVisible(lastPlayingTrack, startTrack);
                        }
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
                this.playMetronomeSound();

                const beatInMeasure = Math.floor(this.currentStep / this.stepsPerBeat) % 4;

                if (this.metronome.visualStyle === 'footprints') {
                    document.querySelectorAll('.foot-icon').forEach(icon => icon.classList.remove('active'));

                    const seq = ['right-outer', 'right-inner', 'left-outer', 'left-inner'];
                    const currentIconClass = seq[beatInMeasure];
                    document.querySelectorAll(`.foot-icon.${currentIconClass}`).forEach(activeIcon => {
                        activeIcon.classList.add('active');
                    });
                    return;
                }

                document.querySelectorAll('.metronome-lights').forEach(container => {
                    const lights = container.querySelectorAll('.metronome-light');
                    lights.forEach(light => light.classList.remove('active'));

                    if (this.metronome.mode === 'conductor') {
                        lights.forEach(light => light.classList.add('active'));
                    } else if (this.metronome.mode === 'sequential') {
                        if (lights[beatInMeasure]) {
                            lights[beatInMeasure].classList.add('active');
                        }
                    } else { // 'single' 模式
                        lights.forEach(light => light.classList.add('active'));
                    }
                });

                setTimeout(() => {
                    document.querySelectorAll('.metronome-light').forEach(light => light.classList.remove('active'));
                }, 100);
			}

			playMetronomeSound() {
                if (!this.audioContext || this.metronome.sound === 'none') return;

                const soundInfo = this.metronomeSounds[this.metronome.sound];
                if (!soundInfo || (soundInfo.sound !== 'none' && !soundInfo.type)) return;
                
                if (soundInfo.sound === 'none') return;

                const time = this.audioContext.currentTime;
                const finalVolume = this.metronome.volume;

                const gainNode = this.audioContext.createGain();
                gainNode.gain.setValueAtTime(0, time);
                gainNode.gain.linearRampToValueAtTime(finalVolume, time + 0.005);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, time + soundInfo.release);
                
                let lastNode = gainNode;

                if (soundInfo.type === 'noise') {
                    const filter = this.audioContext.createBiquadFilter();
                    filter.type = soundInfo.filterType;
                    filter.frequency.value = soundInfo.filterFreq;
                    filter.Q.value = soundInfo.filterQ;
                    gainNode.connect(filter);
                    lastNode = filter;
                }
                
                lastNode.connect(this.audioContext.destination);
                
                if (soundInfo.type === 'synth') {
                    const osc = this.audioContext.createOscillator();
                    osc.type = soundInfo.wave;
                    osc.frequency.setValueAtTime(soundInfo.freq, time);
                    if (soundInfo.pitchBend) {
                        osc.frequency.exponentialRampToValueAtTime(soundInfo.freq * soundInfo.pitchBend, time + soundInfo.release);
                    }
                    osc.connect(gainNode);
                    osc.start(time);
                    osc.stop(time + soundInfo.release + 0.05);
                } else if (soundInfo.type === 'synth-multi') {
                    soundInfo.oscillators.forEach(oscData => {
                        const osc = this.audioContext.createOscillator();
                        osc.frequency.setValueAtTime(oscData[0], time);
                        osc.type = oscData[1];
                        osc.connect(gainNode);
                        osc.start(time);
                        osc.stop(time + soundInfo.release + 0.05);
                    });
                } else if (soundInfo.type === 'noise') {
                    const bufferSize = this.audioContext.sampleRate * soundInfo.release;
                    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
                    const output = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) {
                        output[i] = Math.random() * 2 - 1;
                    }
                    const noiseSource = this.audioContext.createBufferSource();
                    noiseSource.buffer = buffer;
                    noiseSource.connect(gainNode);
                    noiseSource.start(time);
                }
            }


			updateBeatNumbers() {
				const positionLine = document.getElementById('positionLine');
				const trackStepsContainer = document.getElementById('trackSteps');
				if (!trackStepsContainer) return;

				const firstStep = trackStepsContainer.querySelector('.step');

				if (firstStep) {
					const stepWidth = firstStep.offsetWidth;
					const gap = parseFloat(getComputedStyle(firstStep.parentElement).gap) || 2;
					const totalStepWidth = stepWidth + gap;
					// 播放中：位置線隨子格在格內平滑前進，讓使用者知道目前掃到格內哪個位置
					let lineLeft = this.currentStep * totalStepWidth;
					if (this.isPlaying && this.maxSub > 1) {
						lineLeft += (this.currentOffsetInCell / this.maxSub) * stepWidth;
					}
					positionLine.style.left = `${lineLeft}px`;
					// 注意：不把量到的寬度寫回 --step-width。格子寬度只由 updateStepSize() 控制，
					// 否則播放中（0.2s transition 未跑完時量測）會把寬度鎖在錯誤值（例如 2× 卡住回不去 1×）
				}

				document.querySelectorAll('.step.playing, .sub-step.playing').forEach(el => el.classList.remove('playing'));

				if (this.isPlaying) {
					if (this.mode === 'ensemble' || this.playSelectionMode || this.isSingleTrackNotationMode) {
						this.tracks.forEach((track, t) => this.highlightCell(track, t, this.currentStep));
					} else {
						this.highlightCell(this.tracks[this.currentTrack], this.currentTrack, this.currentStep);
					}
				}
			}

			// 對某一格加上播放高亮：分割格亮子格，未分割格亮整格
			highlightCell(track, trackIndex, stepIndex) {
				if (!track) return;
				const cell = track.subdivisions && track.subdivisions[stepIndex];
				if (cell) {
					const subIdx = Math.min(cell.count - 1, Math.floor(this.currentOffsetInCell * cell.count / this.maxSub));
					document.querySelectorAll(`.sub-step[data-track="${trackIndex}"][data-step="${stepIndex}"][data-sub="${subIdx}"]`).forEach(el => el.classList.add('playing'));
				} else {
					document.querySelectorAll(`.step[data-track="${trackIndex}"][data-step="${stepIndex}"]`).forEach(el => el.classList.add('playing'));
				}
			}
			
			
			updateColorHints() {
                document.querySelectorAll('.step.active.step-dimmed').forEach(el => el.classList.remove('step-dimmed'));
                document.querySelectorAll('.sub-step.active.sub-step-dimmed').forEach(el => el.classList.remove('sub-step-dimmed'));

                if (!this.colorHintMode) return;

                const shouldDim = (marker) => {
                    if (!marker) return false;
                    if (this.colorHintMode === 'lr' && marker.hand === 'L') return true;
                    if (this.colorHintMode === 'accent' && marker.accent === '•') return true;
                    return false;
                };

                this.tracks.forEach((track, trackIndex) => {
                    track.steps.forEach((isActive, stepIndex) => {
                        if (!isActive) return;
                        if (shouldDim(track.markers[stepIndex])) {
                            const stepEl = document.querySelector(`.step[data-track="${trackIndex}"][data-step="${stepIndex}"]`);
                            if (stepEl) stepEl.classList.add('step-dimmed');
                        }
                    });
                    // 子格色差
                    (track.subdivisions || []).forEach((cell, stepIndex) => {
                        if (!cell) return;
                        cell.notes.forEach((subActive, subIndex) => {
                            if (!subActive) return;
                            if (shouldDim(cell.markers[subIndex])) {
                                const subEl = document.querySelector(`.sub-step[data-track="${trackIndex}"][data-step="${stepIndex}"][data-sub="${subIndex}"]`);
                                if (subEl) subEl.classList.add('sub-step-dimmed');
                            }
                        });
                    });
                });
            }

            scrollToBeginning() {
                document.querySelector('.tracks-sequencer').scrollTo({ left: 0, behavior: 'smooth' });
                
                const notationModal = document.getElementById('notationModal');
                if (notationModal && notationModal.style.display === 'flex') {
                    const modalBody = document.getElementById('notationContent');
                    if (modalBody) {
                        modalBody.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                }
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
            }				autoScroll() {
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

					// 往前：播放軸超過可視區 80% 時跟著捲
					if (playheadPosition > scrollTriggerPoint && (scrollLeft + clientWidth) < sequencer.scrollWidth) {
						const newScrollLeft = playheadPosition - (clientWidth * 0.1);
						sequencer.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
					}
					// 往後：播放軸跑到可視區左側之外時，捲回來讓它可見（格寬放大時尤其需要）
					else if (playheadPosition < scrollLeft) {
						const newScrollLeft = Math.max(0, playheadPosition - (clientWidth * 0.1));
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
					track.subdivisions.push(...Array(beatsToAdd * this.stepsPerBeat).fill(null));
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
					track.subdivisions.length = this.totalBeats * this.stepsPerBeat;
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
                this.totalBeats -= beatsToRemove;				this.tracks.forEach(track => {
                    track.steps.splice(0, stepsToRemove);
                    track.markers.splice(0, stepsToRemove);
                    track.subdivisions.splice(0, stepsToRemove);
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

                if (currentMarker.rest) {
                    delete currentMarker.rest;
                } else {
                    currentMarker.rest = '-';
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

                    const isErasing = this.currentMarker === 'eraser';
                    
                    if (this.currentMarker === 'rest') {
                        if (markerObj.rest) {
                            delete markerObj.rest;
                        } else {
                            markerObj = { rest: '-' };
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

			handleSubStepClick(el, trackIndex, stepIndex, subIndex) {
				const track = this.tracks[trackIndex];
				const sub = track && track.subdivisions ? track.subdivisions[stepIndex] : null;
				if (!sub) return;

				if (this.markingMode) {
					let markerObj = sub.markers[subIndex] || {};
					const isErasing = this.currentMarker === 'eraser';

					if (this.currentMarker === 'rest') {
						if (markerObj.rest) {
							delete markerObj.rest;
						} else {
							markerObj = { rest: '-' };
							if (sub.notes[subIndex]) sub.notes[subIndex] = false;
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

					sub.markers[subIndex] = markerObj;
					this.renderTracks();
					this.saveState();
					return;
				}

				if (this.selectionMode) {
					// 子格點擊視為選取該粗格（與點擊整格相同）
					const container = document.querySelector(`.step[data-track="${trackIndex}"][data-step="${stepIndex}"]`);
					if (container) this.handleStepClick(container);
					return;
				}

				this.toggleSubStep(trackIndex, stepIndex, subIndex);
			}

			toggleSubStep(trackIndex, stepIndex, subIndex) {
				const track = this.tracks[trackIndex];
				const sub = track.subdivisions[stepIndex];
				if (!sub) return;
				if (sub.markers[subIndex] && sub.markers[subIndex].rest) {
					delete sub.markers[subIndex].rest;
				}
				sub.notes[subIndex] = !sub.notes[subIndex];
				this.renderTracks();
				this.saveState();
			}

			applySubRestMarker(trackIndex, stepIndex, subIndex) {
				const track = this.tracks[trackIndex];
				if (!track) return;
				const sub = track.subdivisions[stepIndex];
				if (!sub) return;
				const currentMarker = sub.markers[subIndex] || {};

				if (currentMarker.rest) {
					delete currentMarker.rest;
				} else {
					currentMarker.rest = '-';
					if (sub.notes[subIndex]) sub.notes[subIndex] = false;
				}

				sub.markers[subIndex] = currentMarker;
				this.renderTracks();
				this.saveState();
			}

			// 將某一格細分一層（1→2→4→8…），最深到 64 分音符（3 條線）。不回存，由呼叫端統一回存。
			splitStep(trackIndex, stepIndex) {
				const track = this.tracks[trackIndex];
				if (!track || stepIndex >= track.steps.length) return false;
				const current = track.subdivisions[stepIndex];
				const newCount = current ? current.count * 2 : 2;
				// 最深以 64 分音符為限：子格時值 = 1/(stepsPerBeat × count) 拍，
				// 64 分 = 1/16 拍 → count 上限 = 16 / stepsPerBeat
				const maxCount = Math.max(2, Math.floor(16 / this.stepsPerBeat));
				if (newCount > maxCount) {
					alert('已達最小顆粒度（64 分音符），無法再分割。');
					return false;
				}

				// 依需求：第一次分割時，清除原本格子的音符與標記；再分割則保留既有子格內容
				if (!current) {
					track.steps[stepIndex] = false;
					track.markers[stepIndex] = {};
				}
				const notes = current ? [...current.notes, ...Array(newCount - current.count).fill(false)] : Array(newCount).fill(false);
				const markers = current ? [...current.markers.map(m => ({ ...m })), ...Array.from({ length: newCount - current.count }, () => ({}))] : Array.from({ length: newCount }, () => ({}));
				track.subdivisions[stepIndex] = { count: newCount, notes, markers };
				return true;
			}

			// 將某一格合併一層（…8→4→2→1）。不回存，由呼叫端統一回存。
			mergeStep(trackIndex, stepIndex) {
				const track = this.tracks[trackIndex];
				if (!track || stepIndex >= track.steps.length) return false;
				const sub = track.subdivisions[stepIndex];
				if (!sub || sub.count < 2) return false;
				const newCount = sub.count / 2;

				if (newCount === 1) {
					// 合併回未分割：任一子格有音 → 粗格有音；標記取第一個子格
					const hasNote = sub.notes.some(n => n);
					const firstMarker = (sub.markers[0] && Object.keys(sub.markers[0]).length > 0) ? { ...sub.markers[0] } : {};
					track.steps[stepIndex] = hasNote;
					track.markers[stepIndex] = firstMarker;
					if (track.markers[stepIndex].rest) {
						track.steps[stepIndex] = false; // 休止符與音符互斥
					}
					track.subdivisions[stepIndex] = null;
				} else {
					// 兩兩合併：音符 OR，標記取每對的第一個
					const notes = [], markers = [];
					for (let j = 0; j < newCount; j++) {
						notes.push(sub.notes[j * 2] || sub.notes[j * 2 + 1]);
						const m0 = sub.markers[j * 2] || {};
						const m1 = sub.markers[j * 2 + 1] || {};
						markers.push(Object.keys(m0).length > 0 ? { ...m0 } : (Object.keys(m1).length > 0 ? { ...m1 } : {}));
					}
					track.subdivisions[stepIndex] = { count: newCount, notes, markers };
				}
				return true;
			}

			// 對選取範圍（單格或矩形）執行分割
			splitSelection() {
				if (!this.selectionMode || this.selection.startTrack === null || this.selection.endTrack === null) {
					alert('請先進入編輯模式（E），點選要分割的格子，再按「分割」。');
					return;
				}
				const startTrack = Math.min(this.selection.startTrack, this.selection.endTrack);
				const endTrack = Math.max(this.selection.startTrack, this.selection.endTrack);
				const startStep = Math.min(this.selection.startStep, this.selection.endStep);
				const endStep = Math.max(this.selection.startStep, this.selection.endStep);

				let changed = false;
				for (let t = startTrack; t <= endTrack; t++) {
					for (let s = startStep; s <= endStep; s++) {
						if (this.splitStep(t, s)) changed = true;
					}
				}
				if (!changed) return;

				this.renderTracks();
				this.saveState();
				this.updateSelectionUI();
			}

			// 對選取範圍（單格或矩形）執行合併
			mergeSelection() {
				if (!this.selectionMode || this.selection.startTrack === null || this.selection.endTrack === null) {
					alert('請先進入編輯模式（E），點選要合併的格子，再按「合併」。');
					return;
				}
				const startTrack = Math.min(this.selection.startTrack, this.selection.endTrack);
				const endTrack = Math.max(this.selection.startTrack, this.selection.endTrack);
				const startStep = Math.min(this.selection.startStep, this.selection.endStep);
				const endStep = Math.max(this.selection.startStep, this.selection.endStep);

				let changed = false;
				for (let t = startTrack; t <= endTrack; t++) {
					for (let s = startStep; s <= endStep; s++) {
						if (this.mergeStep(t, s)) changed = true;
					}
				}
				if (!changed) return;

				this.renderTracks();
				this.saveState();
				this.updateSelectionUI();
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
					markers: [],
					subdivisions: []
				};

				for (let t = startTrack; t <= endTrack; t++) {
					patternData.steps.push(this.tracks[t].steps.slice(startStep, endStep + 1));
					patternData.markers.push(this.tracks[t].markers.slice(startStep, endStep + 1));
					patternData.subdivisions.push((this.tracks[t].subdivisions || []).slice(startStep, endStep + 1).map(sd => sd ? { count: sd.count, notes: sd.notes.slice(), markers: sd.markers.map(m => ({ ...m })) } : null));
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
				}					for (let t = 0; t < patternHeight; t++) {
						const targetTrackIndex = pasteStartTrack + t;
						if (this.tracks[targetTrackIndex]) {
							for (let s = 0; s < patternWidth; s++) {
								const targetStepIndex = pasteStartStep + s;
								if (targetStepIndex < this.tracks[targetTrackIndex].steps.length) {
									this.tracks[targetTrackIndex].steps[targetStepIndex] = this.clipboard.pattern.steps[t][s];
									this.tracks[targetTrackIndex].markers[targetStepIndex] = { ...this.clipboard.pattern.markers[t][s] };
									// 貼上分割資料（舊樣式檔無此欄位 → 視為未分割）
									const srcSub = this.clipboard.pattern.subdivisions && this.clipboard.pattern.subdivisions[t] ? this.clipboard.pattern.subdivisions[t][s] : null;
									if (!this.tracks[targetTrackIndex].subdivisions) this.tracks[targetTrackIndex].subdivisions = Array(this.tracks[targetTrackIndex].steps.length).fill(null);
									this.tracks[targetTrackIndex].subdivisions[targetStepIndex] = srcSub ? { count: srcSub.count, notes: srcSub.notes.slice(), markers: srcSub.markers.map(m => ({ ...m })) } : null;
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

                // 更新所有參數顯示值
                const paramInputs = itemContainer.querySelectorAll('input[type="range"][data-param]');
                paramInputs.forEach(input => {
                    const param = input.dataset.param;
                    if (sound[param] !== undefined) {
                        input.value = sound[param];
                        const display = input.previousElementSibling.querySelector('.param-value-display');
                        if (display) display.textContent = sound[param];
                    }
                });

                // 更新波形選擇器
                const synthTypeSelect = itemContainer.querySelector('select[data-param="synthType"]');
                if (synthTypeSelect) {
                    synthTypeSelect.value = sound.synthType;
                }
            }

            resetSounds() {
                if (!window.confirm('確定要重設所有音色為預設值嗎？這將會移除所有您匯入的聲音取樣，並將音源模式與參數重設。')) return;

                this.initDrumSounds();
                this.loadDefaultSamples();

                alert('音色已重設。');
            }

            resetSingleSound(drumKey) {
                if (!drumKey || !this.drumSounds[drumKey]) return;

                const soundName = this.drumSounds[drumKey].name;
                if (!window.confirm(`確定要重設 "${soundName}" 音色為預設值嗎？這將會移除匯入的聲音取樣，並將音源模式與參數重設。`)) return;

                // 保存原始的預設值
                const originalDefaults = this.getOriginalSoundDefaults(drumKey);
                
                // 重設音色參數
                Object.assign(this.drumSounds[drumKey], originalDefaults);

                // 重新載入預設取樣（如果有的話）
                if (originalDefaults.defaultSampleUrl && this.audioContext) {
                    this.loadSingleDefaultSample(drumKey);
                }

                // 更新UI
                this.updateSoundControlUI(drumKey);
                
                alert(`音色 "${soundName}" 已重設為預設值。`);
            }

            getOriginalSoundDefaults(drumKey) {
                // 返回每個音色的原始預設值
                const originalDefaults = {
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

                return originalDefaults[drumKey] || this.getDefaultSoundParams();
            }

            async loadSingleDefaultSample(drumKey) {
                const sound = this.drumSounds[drumKey];
                if (!sound.defaultSampleUrl || !this.audioContext) return;

                sound.isLoadingDefault = true;
                this.updateSoundControlUI(drumKey);

                const buffer = await this.audioCache.getSample(sound.defaultSampleUrl, this.audioContext);

                if (buffer) {
                    sound.defaultSampleBuffer = buffer;
                    sound.mode = 'system';
                } else {
                    sound.defaultSampleBuffer = null;
                    sound.mode = 'synth';
                }
                
                sound.isLoadingDefault = false;
                this.updateSoundControlUI(drumKey);
            }


			clearAll() {
				if (!window.confirm('您確定要清除所有 R/L 標記嗎？此操作將被記錄，可以復原。')) {
					return;
				}

				this.tracks.forEach(track => {
					track.markers = Array.from({ length: track.markers.length }, () => ({}));
					// 子格標記一併清除
					(track.subdivisions || []).forEach(sd => { if (sd) sd.markers = Array.from({ length: sd.count }, () => ({})); });
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
					track.subdivisions = Array(track.steps.length).fill(null);
				});

				this.currentStep = 0;
				this.currentTrack = 0;

				this.renderTracks();
				this.initScrollPosition();
				this.updateColorHints();

				this.saveState(true);
			}

            toggleLoadModal() {
                const modal = document.getElementById('loadModal');
                if (modal.style.display === 'flex') {
                    modal.style.display = 'none';
                } else {
                    modal.style.display = 'flex';
                    this.fetchPresetBeats();
                }
            }

            async fetchPresetBeats() {
                const select = document.getElementById('presetBeatsSelect');
                select.innerHTML = '<option value="">載入中...</option>';

                // 1) 離線優先：立即列出內建 beats/ 資料夾的腳本（相對路徑，不等待網路）
                //    之後若在 beats/ 新增 .json 檔案，記得同步更新 LOCAL_PRESET_BEATS
                const localBeats = LOCAL_PRESET_BEATS;
                if (localBeats.length === 0) {
                    select.innerHTML = '<option value="">沒有找到預設腳本</option>';
                } else {
                    select.innerHTML = '<option value="">-- 請選擇預設腳本 --</option>';
                    localBeats.forEach(name => {
                        const option = document.createElement('option');
                        // beats/ 實際檔名是 NFD 編碼（如 Antu%CC%88），先 normalize('NFD') 再 encode，避免 NFC（Antu%C3%BC）產生 404
                        option.value = 'beats/' + encodeURIComponent(name.normalize('NFD'));
                        option.textContent = name.replace(/\.json$/i, '');
                        option.dataset.source = 'local';
                        select.appendChild(option);
                    });
                }

                // 2) 線上備援（不阻塞）：背景嘗試抓 GitHub API 清單，只補上內建清單沒有的新腳本
                try {
                    const response = await fetch('https://api.github.com/repos/a630050/beatmaker-samba-V2/contents/beats');
                    if (!response.ok) throw new Error('Network response was not ok');
                    const files = await response.json();

                    // 用 NFC 正規化比對，避免 precomposed（ü）與 combining（u+¨）形式的同檔名被當成不同腳本
                    const toLabel = name => name.replace(/\.json$/i, '').normalize('NFC');
                    const localLabels = new Set(localBeats.map(toLabel));
                    const remoteOnly = files
                        .filter(f => f.name.toLowerCase().endsWith('.json'))
                        .map(f => ({ label: toLabel(f.name), value: f.download_url }))
                        .filter(opt => !localLabels.has(opt.label));

                    if (remoteOnly.length === 0) return;

                    if (select.options.length <= 1) {
                        // 本機清單為空時，改用線上清單當主要內容
                        select.innerHTML = '<option value="">-- 請選擇預設腳本 --</option>';
                    }
                    remoteOnly.forEach(opt => {
                        const option = document.createElement('option');
                        option.value = opt.value;
                        option.textContent = opt.label + '（線上）';
                        option.dataset.source = 'remote';
                        select.appendChild(option);
                    });
                } catch (error) {
                    // 備援失敗沒關係，本機清單已經顯示
                    console.warn('GitHub API 備援抓取失敗，僅顯示內建腳本:', error);
                }
            }

            async loadPresetBeat() {
                const select = document.getElementById('presetBeatsSelect');
                const downloadUrl = select.value;
                if (!downloadUrl) {
                    alert('請先選擇一個預設腳本');
                    return;
                }

                const btn = document.querySelector('#loadModal .btn-primary');
                const oldText = btn.textContent;
                btn.textContent = '載入中...';
                btn.disabled = true;

                try {
                    const response = await fetch(downloadUrl);
                    if (!response.ok) throw new Error('Network response was not ok');
                    const text = await response.text();

                    const file = new File([text], 'preset.json', { type: 'application/json' });

                    // importPattern 會彈確認框，這裡自動同意；用 finally 確保失敗時也能還原
                    const originalConfirm = window.confirm;
                    window.confirm = () => true;
                    try {
                        await this.importPattern(file);
                    } finally {
                        window.confirm = originalConfirm;
                    }

                    this.toggleLoadModal();
                } catch (error) {
                    console.error('Error loading preset beat:', error);
                    let message = '載入腳本時發生錯誤。';
                    if (window.location.protocol === 'file:') {
                        message = '以 file:// 開啟時，瀏覽器會封鎖讀取內建腳本。\n請改用「從本機選擇檔案」，或用本地伺服器（如 VS Code Live Server）開啟本資料夾。';
                    }
                    alert(message);
                } finally {
                    btn.textContent = oldText;
                    btn.disabled = false;
                }
            }
            randomizeTracks() {
                // Save state for undo
                this.saveState();
                
                // We define the 3 possible patterns for a 4-step beat
                const patterns = [
                    [true, false, false, false], // Quarter note
                    [true, false, true, false],  // Eighth notes
                    [true, true, true, true]     // Sixteenth notes
                ];
                
                // Target the first 4 tracks
                for (let trackIdx = 0; trackIdx < 4 && trackIdx < this.tracks.length; trackIdx++) {
                    const track = this.tracks[trackIdx];
                    
                    // Generate a random 4-beat sequence (1 measure)
                    const measurePattern = [];
                    for (let beat = 0; beat < 4; beat++) {
                        const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
                        measurePattern.push(...randomPattern);
                    }
                    
                    // Apply this 4-beat pattern to the first 8 beats (2 measures)
                    // Each beat has this.stepsPerBeat steps (which should be 4 in 4-step mode)
                    // Total steps to fill = 8 beats * this.stepsPerBeat
                    const totalStepsToFill = Math.min(track.steps.length, 8 * this.stepsPerBeat);
                    
                    for (let i = 0; i < totalStepsToFill; i++) {
                        // Using modulo 16 to loop the 16-step (4-beat) measurePattern
                        const stepInMeasure = i % (4 * this.stepsPerBeat);
                        // If stepsPerBeat isn't 4, we might read out of bounds of measurePattern (length 16)
                        // but the user's specific use case sets 1拍=4格.
                        // To be safe against weird configs, just take step modulo 16.
                        track.steps[i] = measurePattern[stepInMeasure % 16];						// Also clear any markers in these steps to avoid confusion
						if (track.markers) {
							track.markers[i] = null;
						}
					}
					// 隨機化時一併清除分割，避免狀態混亂
					track.subdivisions = Array(track.steps.length).fill(null);
				}

				this.renderTracks();
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
					metronome: this.metronome,						tracks: this.tracks.map(track => ({
						label: track.label,
                        drumType: track.drumType,
                        steps: track.steps,
						markers: track.markers,
                        subdivisions: track.subdivisions ? track.subdivisions.map(sd => sd ? { count: sd.count, notes: sd.notes.map(n => n ? 1 : 0), markers: sd.markers } : null) : null,
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
								
								// --- START: 新增的相容性轉換邏輯 ---
								if (m && m.accent === '()') {
									m.accent = '•';
								}
								// --- END: 新增的相容性轉換邏輯 ---

								return m || {};
							});
						}

						return {
							id: index,
							label: trackData.label || this.defaultTrackLabels[index] || `T${index + 1}`,
							drumType: trackData.drumType || this.defaultDrums[index] || 'agogo',
							steps: trackData.steps || Array(this.totalBeats * this.stepsPerBeat).fill(false),
							markers: newMarkers,
							subdivisions: this.normalizeSubdivisions(trackData.subdivisions, this.totalBeats * this.stepsPerBeat),
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
									this.scheduleStepSounds(offlineContext, track, step, loopStartTime + step * stepDurationInSeconds, stepDurationInSeconds);
								});
							}
						}
					} else {
						let timeOffset = 0;
						for (let loop = 0; loop < loopCount; loop++) {
							for (const track of enabledTracks) {
								for (let step = 0; step < stepsInOneLoop; step++) {
									this.scheduleStepSounds(offlineContext, track, step, timeOffset + step * stepDurationInSeconds, stepDurationInSeconds);
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

			// MP3 離線匯出用：排程某一格（含子格）應發出的聲音
			scheduleStepSounds(offlineContext, track, step, timeBase, stepDurationInSeconds) {
				if (!track || !track.enabled || !track.soundEnabled) return;
				const cell = track.subdivisions && track.subdivisions[step];
				if (cell) {
					for (let j = 0; j < cell.count; j++) {
						if (cell.notes[j] && !(cell.markers[j] && cell.markers[j].rest)) {
							const time = timeBase + (j / cell.count) * stepDurationInSeconds;
							const m = cell.markers[j] || {};
							let v = 1.0;
							if (m.accent === '>') v = this.accentVolumeMultiplier;
							else if (m.accent === '•') v = this.ghostVolumeMultiplier;
							this.scheduleSound(offlineContext, time, track.drumType, track.soundEnabled, track.volume * v);
						}
					}
				} else if (track.steps[step] && !(track.markers[step] && track.markers[step].rest)) {
					const m = track.markers[step] || {};
					let v = 1.0;
					if (m.accent === '>') v = this.accentVolumeMultiplier;
					else if (m.accent === '•') v = this.ghostVolumeMultiplier;
					this.scheduleSound(offlineContext, timeBase, track.drumType, track.soundEnabled, track.volume * v);
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
					// --- START OF FIX ---
					// 如果焦點在輸入框或下拉選單上
					if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
						if (e.key === 'Escape') {
							// 如果是 Escape 鍵，先取消焦點，然後讓事件繼續傳遞下去
							e.target.blur();
						} else {
							// 如果是其他按鍵 (例如 'p', 's', 'b')，則直接返回，不觸發快捷鍵
							return;
						}
					}
					// --- END OF FIX ---

					if (e.ctrlKey || e.metaKey) {
						switch(e.key.toLowerCase()) {
							case 's': e.preventDefault(); this.exportPattern(); break;
							case 'z': e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); break;
							case 'y': e.preventDefault(); this.redo(); break;
							case 'c': if(this.selectionMode) { e.preventDefault(); this.copySelection(); } break;
							case 'v': if(this.selectionMode) { e.preventDefault(); this.pasteSelection(); } break;
                            case 'a': // 需求3
                                e.preventDefault();
                                if (!this.selectionMode) this.toggleSelectionMode();
                                this.selection.startTrack = 0;
                                this.selection.startStep = 0;
                                this.selection.endTrack = this.tracks.length - 1;
                                this.selection.endStep = this.totalBeats * this.stepsPerBeat - 1;
                                this.updateSelectionUI();
                                break;
						}
					} else {
						if (this.markingMode) {
							let buttonSelector = null;
							switch(e.key.toLowerCase()) {
								case 'r': buttonSelector = '.marker-btn[data-marker="R"]'; break;
                                case 'l': buttonSelector = '.marker-btn[data-marker="L"]'; break;
                                case 'x': buttonSelector = '.marker-btn[data-marker="eraser"]'; break;
                                case '>': buttonSelector = '.marker-btn[data-marker="accent"][data-value=">"]'; break;
                                case '.': buttonSelector = '.marker-btn[data-marker="accent"][data-value="•"]'; break;
							}
                            if (buttonSelector) {
                                e.preventDefault();
                                const targetButton = document.querySelector(buttonSelector);
                                if (targetButton) targetButton.click();
                                return;
                            }
						}

						switch(e.key.toLowerCase()) {
							case ' ': e.preventDefault(); this.togglePlay(e); break;
							case 'p': e.preventDefault(); this.togglePlay(e); break;
							case 's': e.preventDefault(); this.stop(); break;
							case 'r': e.preventDefault(); this.resetAll(); break;
							case 'b': e.preventDefault(); this.playFromBeginning(e); break;
							case 'e': e.preventDefault(); document.getElementById('selectBtn').click(); break;
							case 'm': e.preventDefault(); document.getElementById('markBtn').click(); break;
                            case 'd': // 需求2
                                e.preventDefault();
                                if (this.selectionMode && this.isSelectionValidForNotation().valid) {
                                    this.convertSelectionToNotation();
                                }
                                break;
							case 'escape':
								const openModal = document.querySelector('.modal-overlay[style*="display: flex"]');
								if (openModal) {
									openModal.style.display = 'none';
									if (openModal.id === 'notationModal') {
										document.querySelectorAll('.vf-note-playing').forEach(el => el.classList.remove('vf-note-playing'));
										this.isSingleTrackNotationMode = false;
										this.singleTrackNotationIndex = -1;
									}
									break;
								}

								if (this.selectionMode) this.toggleSelectionMode();
								if (this.markingMode) this.toggleMarkingMode();
								if (document.querySelectorAll('.step.step-highlighted').length > 0) {
									this.updateSeekHighlight(null);
								}
								break;
							case 'arrowup': e.preventDefault(); this.adjustGlobalVolume(1); break;
							case 'arrowdown': e.preventDefault(); this.adjustGlobalVolume(-1); break;
							case 'arrowright': e.preventDefault(); this.adjustBPM(1); break;
							case 'arrowleft': e.preventDefault(); this.adjustBPM(-1); break;
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
			
            // 需求(B)-4: 輔助函式
            isSelectionActive() {
                return this.selectionMode && this.selection.startTrack !== null && this.selection.endTrack !== null;
            }

            captureSelectionRange() {
                if (!this.isSelectionActive()) return;
                this.playSelectionRange = {
                    startTrack: Math.min(this.selection.startTrack, this.selection.endTrack),
                    endTrack: Math.max(this.selection.startTrack, this.selection.endTrack),
                    startStep: Math.min(this.selection.startStep, this.selection.endStep),
                    endStep: Math.max(this.selection.startStep, this.selection.endStep)
                };
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

            // 新增：依最後一次參數重繪樂譜
            rerenderLastNotation() {
                const info = this.lastNotationRenderArgs;
                if (!info) return;
                if (info.type === 'single') {
                    this.convertRangeToNotation(...info.args);
                } else if (info.type === 'stacked') {
                    this.convertRangeToNotationStacked(...info.args);
                }
            }

			convertRangeToNotation(startTrack, endTrack, startStep, endStep) {
                this.lastNotationRenderArgs = { type: 'single', args: [startTrack, endTrack, startStep, endStep] };
                const showHints = document.getElementById('showBeatHintCheckbox').checked;
                const markerMode = this.notationMarkerMode; // 'lr' or 'accent'

                try {
                    const notationContent = document.getElementById('notationContent');
                    notationContent.innerHTML = '';

			// 新增：建立風格一致的「左右 / 強弱」切換鈕 (只建立一次)
			const header = document.querySelector('#notationModal .notation-controls');
			if (header && !document.getElementById('notationMarkerToggle')) {
				const wrap = document.createElement('div');
				wrap.id = 'notationMarkerToggle';
				// 復用主介面的 class 來確保樣式一致
				wrap.className = 'beat-setting-controls';
				wrap.style.marginLeft = '15px'; // 添加一些左邊距

				wrap.innerHTML = `
					<span class="beat-setting-label">記號顯示:</span>
					<button class="beat-setting-btn ${this.notationMarkerMode === 'lr' ? 'active' : ''}" data-mode="lr">左右</button>
					<button class="beat-setting-btn ${this.notationMarkerMode === 'accent' ? 'active' : ''}" data-mode="accent">強弱</button>
				`;

				// 插入到「列印」按鈕之後，「拍號提示」之前
				header.insertBefore(wrap, header.querySelector('#showBeatHintCheckbox'));

				wrap.querySelectorAll('.beat-setting-btn').forEach(btn => {
					btn.addEventListener('click', (e) => {
						const clickedBtn = e.currentTarget;
						if (clickedBtn.classList.contains('active')) return; // 如果已啟用則不動作

						this.notationMarkerMode = clickedBtn.dataset.mode;

						// 更新按鈕的啟用狀態
						wrap.querySelectorAll('.beat-setting-btn').forEach(b => b.classList.remove('active'));
						clickedBtn.classList.add('active');

						// 根據新模式重繪樂譜
						this.rerenderLastNotation();
					});
				});
			}


                    // 有分割時：把每軌展開成「有效細格」（每粗格 × 全曲最大子格數），
                    // 使 32 分音符（甚至更深）能正確顯示在樂譜上
                    const maxSub = this.computeMaxSubdivision();
                    const espb = this.stepsPerBeat * maxSub;

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
                        
                        const slicedSteps = track.steps.slice(startStep, endStep + 1);
                        const slicedMarkers = track.markers.slice(startStep, endStep + 1);
                        const slicedSubs = (track.subdivisions || []).slice(startStep, endStep + 1);
                        const expanded = this.expandSteps(slicedSteps, slicedMarkers, slicedSubs, maxSub);
                        const measures = this.parseTrackToMeasures(expanded.steps, expanded.markers, espb);
                        
                        this.renderMeasuresWithVexFlow(vexflowContainer, measures, showHints, markerMode, startStep * maxSub, t, expanded.markers, espb);
                    }
                    
                    document.getElementById('notationModal').style.display = 'flex';
                    

                } catch (error) {
                    console.error('轉譜錯誤:', error);
                    alert('轉譜過程發生錯誤：' + error.message);
                }
			}

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

                if (endTrack > startTrack) {
                    const modal = document.getElementById('notationModal');
                    if (modal) modal.style.display = 'flex';
                    this.convertRangeToNotationStacked(startTrack, endTrack, startStep, endStep);
                } else {
				    this.convertRangeToNotation(startTrack, endTrack, startStep, endStep);
                }
			}

			convertSingleTrackToNotation(trackIndex) { // 需求1-b
				const startTrack = trackIndex;
				const endTrack = trackIndex;
				const startStep = 0;
				const endStep = (this.totalBeats * this.stepsPerBeat) - 1;

				if (endStep < 0) {
					alert("音軌為空，無法轉譜。");
					return;
				}
                
                this.isSingleTrackNotationMode = true;
                this.singleTrackNotationIndex = trackIndex;

				this.convertRangeToNotation(startTrack, endTrack, startStep, endStep);
			}

			// 將（可能含分割的）steps/markers/subdivisions 展開為「有效細格」陣列，供樂譜解析
			// 分割格：每個子格只佔「1 個有效細格」，空隙標記為休止符，
			// 讓樂譜正確顯示 32/64 分音符，不會被 sustain 合併成較長音符
			expandSteps(steps, markers, subdivisions, maxSub) {
					const outSteps = [], outMarkers = [];
					steps.forEach((active, i) => {
						const cell = subdivisions && subdivisions[i];
						if (cell) {
							// 每個子格跨 maxSub/count 個單位
							const span = maxSub / cell.count;
							for (let k = 0; k < maxSub; k++) {
								const j = Math.round(k * cell.count / maxSub);
								const isSubStart = (k === Math.round(j * maxSub / cell.count));
								if (isSubStart) {
									const hasNote = !!cell.notes[j];
									outSteps.push(hasNote);
									const subMarker = (cell.markers[j] && { ...cell.markers[j] }) || {};
									// _subNote = 此子格到「格界」剩餘的單位數：子格音符在格子範圍內 sustain
									// （例：一拍4格、2 分割、只敲子格 0 → 16 分音符 1 條線；兩子格都敲 → 仍兩個 32 分）
									// 空子格也標記（不加休止），讓前一格的 sustain 在格界停住
									subMarker._subNote = span * (cell.count - j);
									outMarkers.push(subMarker);
								} else {
									// 子格內部：留空（不標休止），讓子格音符能在格內 sustain 到格界
									outSteps.push(false);
									outMarkers.push({});
								}
							}
						} else {
							// 未分割格維持原本 sustain 語意（舊鼓譜轉譜不變）
							for (let k = 0; k < maxSub; k++) {
								outSteps.push(k === 0 ? !!active : false);
								outMarkers.push(k === 0 ? ((markers[i] && { ...markers[i] }) || {}) : {});
							}
						}
					});
					return { steps: outSteps, markers: outMarkers };
				}

			// 播放高亮用：把 (粗格, 目前子格) 換算成樂譜展開後的有效 index
			getEffectiveIndexForTrack(track, stepIndex) {
				const cell = track.subdivisions && track.subdivisions[stepIndex];
				const off = this.currentOffsetInCell;
				if (cell) {
					const j = Math.min(cell.count - 1, Math.floor(off * cell.count / this.maxSub));
					return stepIndex * this.maxSub + Math.round(j * this.maxSub / cell.count);
				}
				return stepIndex * this.maxSub + off;
			}

			parseTrackToMeasures(steps, markers, espb) {
				// espb = 有效一拍格數（含子格展開後）；未指定時用目前的 stepsPerBeat
				const effectiveSpb = espb || this.stepsPerBeat;
				const measures = [];
				const stepsPerMeasure = 4 * effectiveSpb;

				for (let i = 0; i < steps.length; i += stepsPerMeasure) {
					const measureSteps = steps.slice(i, i + stepsPerMeasure);
					const measureMarkers = markers.slice(i, i + stepsPerMeasure);
					measures.push(this.parseMeasure(measureSteps, measureMarkers, effectiveSpb));
				}
				return measures;
			}

			parseMeasure(measureSteps, measureMarkers, espb) {
				const effectiveSpb = espb || this.stepsPerBeat;
				const symbols = [];
				let i = 0;
				
				while (i < measureSteps.length) {					if (measureSteps[i] && !(measureMarkers[i] && measureMarkers[i].rest)) {
						let duration = 1;
						// 子格音符：_subNote = 到格界剩餘單位數，音符在「格子範圍內」sustain 到格界或下一個音符
						// （例：一拍4格、2 分割、只敲子格 0 → 16 分音符 1 條線）
						const subCap = (measureMarkers[i] && typeof measureMarkers[i]._subNote === 'number') ? measureMarkers[i]._subNote : 0;
						// 未分割音符：維持原本跨格 sustain，但在分割格邊界（_subNote 標記）停住
						while (i + duration < measureSteps.length &&
						   !measureSteps[i + duration] &&
						   !(measureMarkers[i + duration] && measureMarkers[i + duration].rest) &&
						   (subCap ? (duration < subCap) : !(measureMarkers[i + duration] && measureMarkers[i + duration]._subNote))) {
							duration++;
						}
						symbols.push({ type: 'note', duration, marker: measureMarkers[i] });
						i += duration;					} else {
						let duration = 1;
						while (i + duration < measureSteps.length && 
						   (!measureSteps[i + duration] || (measureMarkers[i + duration] && measureMarkers[i + duration].rest)) &&
						   !(measureMarkers[i + duration] && measureMarkers[i + duration]._subNote)) {
							duration++;
						}
						
						const beatsInDuration = duration / effectiveSpb;
						const wholeBeatRests = Math.floor(beatsInDuration);
						const remainingSteps = duration % effectiveSpb;
						
						for (let b = 0; b < wholeBeatRests; b++) {
							symbols.push({ type: 'rest', duration: effectiveSpb });
						}
						
						if (remainingSteps > 0) {
							symbols.push({ type: 'rest', duration: remainingSteps });
						}
						
						i += duration;
					}
				}
				
				return symbols;
			}

			getVexFlowDuration(duration, espb) {
				const totalValue = duration / (espb || this.stepsPerBeat);

				if (totalValue === 3)    return { duration: "h",  dot: true };
				if (totalValue === 1.5)  return { duration: "q",  dot: true };
				if (totalValue === 0.75) return { duration: "8",  dot: true };
				if (totalValue === 0.375)return { duration: "16", dot: true };
				if (totalValue === 0.1875)return { duration: "32", dot: true };

				const durationMap = { 4: "w", 2: "h", 1: "q", 0.5: "8", 0.25: "16", 0.125: "32", 0.0625: "64" };

				return { duration: durationMap[totalValue] || "q", dot: false };
			}

			renderMeasuresWithVexFlow(container, measures, showHints, markerMode, selectionStartStep = 0, trackIndex = 0, trackMarkers = [], espb) {
				const VF = Vex.Flow;
				container.innerHTML = '';

				const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
				const context = renderer.getContext();
				
				// espb = 有效一拍格數（有分割時為 stepsPerBeat × maxSub，格子更細需更多寬度）
				const effectiveSpb = espb || this.stepsPerBeat;
				const measuresPerLine = effectiveSpb >= 8 ? 3 : 4;
				const LEFT_MARGIN = 10, RIGHT_MARGIN = 20;
				let currentX = LEFT_MARGIN, currentY = 20;
				const MIN_MEASURE_WIDTH = (effectiveSpb >= 8) ? 360 : 300;
				const visibleWidth =  (container.getBoundingClientRect?.().width) || container.clientWidth || 960;
				const canvasWidth = Math.max(visibleWidth, MIN_MEASURE_WIDTH * measuresPerLine + LEFT_MARGIN + RIGHT_MARGIN);
				const staveWidth = Math.max(MIN_MEASURE_WIDTH, (visibleWidth - LEFT_MARGIN - RIGHT_MARGIN) / measuresPerLine);

				measures.forEach((measure, measureIndex) => {
					if (measureIndex > 0 && (currentX + staveWidth > visibleWidth - RIGHT_MARGIN)) {
					  currentX = LEFT_MARGIN;
					  currentY += 120;
					}

				    const stave = new VF.Stave(currentX, currentY, staveWidth);
					if (measureIndex === 0) stave.addClef('percussion').addTimeSignature("4/4");
					if (measureIndex === measures.length - 1) stave.setEndBarType(VF.Barline.type.END);
					stave.setContext(context).draw();

					const notes = [];
					const allBeams = [];
					let notesInCurrentBeat = [];
					let stepsInCurrentBeat = 0;
                    let stepCounter = 0;
					
					const measureStartStep = measureIndex * 4 * effectiveSpb;

					measure.forEach(symbol => {
						const vexData = this.getVexFlowDuration(symbol.duration, effectiveSpb);
						if (!vexData || !vexData.duration) return;

						const note = new VF.StaveNote({ keys: ["b/4"], duration: vexData.duration + (symbol.type === 'rest' ? 'r' : ''), clef: "percussion" });
						// 只有 8/16/32/64 分音符才能加 Beam（避免長音符造成 VexFlow 錯誤）
						note._canBeam = symbol.type !== 'rest' && ['8', '16', '32', '64'].includes(vexData.duration);

                        // 修改：依「左右 / 強弱」模式選擇顯示哪一種
                        if (symbol.type === 'note') {
                            const globalStepIndex = selectionStartStep + measureStartStep + stepCounter;

                            if (markerMode === 'lr' && symbol.marker && symbol.marker.hand) {
                                note.addModifier(
                                new VF.Annotation(symbol.marker.hand)
                                    .setFont('Arial', 10)
                                    .setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM),
                                0
                                );
                            } else if (markerMode === 'accent' && symbol.marker && symbol.marker.accent) {
                                note.addModifier(
                                new VF.Annotation(symbol.marker.accent) // '>' 或 '•'
                                    .setFont('Arial', 10)
                                    .setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM),
                                0
                                );
                            }

                            // 維持既有：給 SVG note 標上 track/step 方便播放高亮
                            setTimeout(() => {
                                let noteElement = (note.attrs && note.attrs.el) || (note.getSVGElement && note.getSVGElement());
                                if (noteElement) {
                                    noteElement.id = `vf-note-${trackIndex}-${globalStepIndex}`;
                                    const children = noteElement.querySelectorAll('*');
                                    children.forEach(child => {
                                        child.setAttribute('data-track', trackIndex);
                                        child.setAttribute('data-step', globalStepIndex);
                                    });
                                }
                            }, 50);
                        }
						
						if (vexData.dot) {
						  if (typeof note.addDotToAll === 'function') note.addDotToAll();
						  else if (typeof note.addDot === 'function') note.addDot(0);
						}

						notes.push(note);
						if (symbol.type !== 'rest') notesInCurrentBeat.push(note);
						
						stepsInCurrentBeat += symbol.duration;
                        stepCounter += symbol.duration;

						if (stepsInCurrentBeat >= effectiveSpb) {
						  const beamableNotes = notesInCurrentBeat.filter(n => n._canBeam);
						  if (beamableNotes.length > 1) allBeams.push(new VF.Beam(beamableNotes));
						  notesInCurrentBeat = [];
						  stepsInCurrentBeat = 0;
						}
					});

					if (notes.length > 0) {
						const voice = new VF.Voice({ num_beats: 4, beat_value: 4 }).setMode(VF.Voice.Mode.SOFT);
						voice.addTickables(notes);
						new VF.Formatter().joinVoices([voice]).formatToStave([voice], stave, { align_rests: false });
						voice.draw(context, stave);
						allBeams.forEach(beam => beam.setContext(context).draw());

						if (showHints) {
							const beatsInMeasure = 4;
							const boxHeight = 14;
							const boxY = stave.getYForTopText() - boxHeight - 6;
							const pieceInfos = [];
							let accSteps = 0;
							for (let i = 0; i < measure.length; i++) {
							  const sym = measure[i];
							  const n = notes[i];
							  if (!n) continue;
							  const bb = n.getBoundingBox();
							  const cx = n.getAbsoluteX();
							  const w  = n.getWidth();
							  const left  = bb ? bb.getX() : (cx - w / 2);
							  const right = bb ? (bb.getX() + bb.getW()) : (cx + w / 2);
							  pieceInfos.push({ start: accSteps, end: accSteps + sym.duration, left, right });
							  accSteps += sym.duration;
							}
							const boundaryX = [];
							for (let k = 0; k <= beatsInMeasure; k++) {
							  const target = k * effectiveSpb;
							  let r = pieceInfos.find(p => target <= p.end) || pieceInfos[pieceInfos.length - 1];
							  let x;
							  if (!r) x = 0;
                              else if (target <= r.start) x = r.left;
							  else if (target >= r.end) x = r.right;
							  else x = r.left + ((target - r.start) / (r.end - r.start)) * (r.right - r.left);
							  boundaryX.push(x);
							}
							for (let i = 0; i < beatsInMeasure; i++) {
							  const x1 = boundaryX[i], x2 = boundaryX[i + 1];
							  const midY = boxY + boxHeight / 2;
							  context.save();
							  context.setStrokeStyle('#7e7e7e');
							  context.setLineWidth(3);
							  context.beginPath(); context.moveTo(x1, midY); context.lineTo(x2, midY); context.stroke();
							  const vH = boxHeight * 0.6, vOff = (boxHeight - vH) / 2;
							  context.beginPath();
							  context.moveTo(x1, boxY + vOff); context.lineTo(x1, boxY + vOff + vH);
							  context.moveTo(x2, boxY + vOff); context.lineTo(x2, boxY + vOff + vH);
							  context.stroke();
							  context.restore();
							  context.save();
							  context.setFont('10px Arial');
							  context.fillText(String(i + 1), x1 + (x2 - x1) / 2 - 3, boxY - 2);
							  context.restore();
							}
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

// === Begin: Multi-Track Wrap (no horizontal scroll) Patch ===
(function(){
  if (typeof window === 'undefined' || typeof Vex === 'undefined' || !Vex.Flow) return;
  const VF = Vex.Flow;

  Beatmaker.prototype.convertRangeToNotationStacked = function(startTrack, endTrack, startStep, endStep) {
    this.lastNotationRenderArgs = { type: 'stacked', args: [startTrack, endTrack, startStep, endStep] };
    const showHints = document.getElementById('showBeatHintCheckbox').checked;

    const notationContent = document.getElementById('notationContent');
    if (!notationContent) { alert('找不到 notationContent 容器'); return; }
    notationContent.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'vexflow-container system';
    notationContent.appendChild(container);

    const maxSub = this.computeMaxSubdivision();
    const espb = this.stepsPerBeat * maxSub;
    const measuresByTrack = [];
    const trackInfos = [];
    for (let t = startTrack; t <= endTrack; t++) {
      const track = this.tracks[t];
      const steps   = track.steps.slice(startStep, endStep + 1);
      const markers = track.markers.slice(startStep, endStep + 1);
      const subs    = (track.subdivisions || []).slice(startStep, endStep + 1);
      if (typeof this.parseTrackToMeasures !== 'function') {
        alert('缺少 parseTrackToMeasures 方法，無法轉譜。');
        return;
      }
      const expanded = this.expandSteps(steps, markers, subs, maxSub);
      measuresByTrack.push(this.parseTrackToMeasures(expanded.steps, expanded.markers, espb));
      const snd = (this.drumSounds && this.drumSounds[track.drumType]) || {};
      trackInfos.push({ label: track.label, drumName: snd.name || track.drumType });
    }

    this.renderAlignedMeasuresNoHScroll(container, measuresByTrack, trackInfos, showHints, startStep * maxSub, startTrack, espb);
  };

  const RULER_MODE = 'maxAcrossTracks';

  Beatmaker.prototype.renderAlignedMeasuresNoHScroll = function(container, measuresByTrack, trackInfos, showHints, selectionStartStep = 0, startTrack = 0, espb) {
    const effectiveSpb = espb || this.stepsPerBeat;
    container.innerHTML = '';
    const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
    const context  = renderer.getContext();

    const tracksCount  = measuresByTrack.length;
    const measureCount = measuresByTrack[0]?.length || 0;
    if (measureCount === 0) { alert('沒有可轉譜的小節'); return; }

    const LEFT_MARGIN  = 8;
    const RIGHT_MARGIN = 12;
    const LEFT_LABEL_W = 90;

    const NUM_STAVE_LINES = 1;
    const STAVE_H   = 52;
    const STAVE_GAP = 10;
    const LINE_GAP  = 46;

    const FIXED_MEASURE_W = (this.stepsPerBeat === 8) ? 440 : 380;

    const root = document.querySelector('#notationModal .modal-content') || container.parentElement || container;
    const targetWidth = root.clientWidth || (root.getBoundingClientRect && root.getBoundingClientRect().width) || window.innerWidth || 960;

    const available = Math.max(320, targetWidth - (LEFT_MARGIN + RIGHT_MARGIN + LEFT_LABEL_W));

    let measuresPerLine = Math.max(1, Math.floor(available / FIXED_MEASURE_W));
    let STAVE_W = Math.floor(available / measuresPerLine);

    const canvasWidth = targetWidth;

    const RULER_BOX_H   = 12;
    const RULER_LINE_W  = 1.2;
    const RULER_TICK_W  = 1;

    const drawBeatRuler = (ctx, stave, boundaryX) => {
      const beatsInMeasure = 4;
      const boxH = RULER_BOX_H;
      const boxY = stave.getYForTopText() - boxH - 6;

      for (let i = 0; i < beatsInMeasure; i++) {
        const x1 = boundaryX[i], x2 = boundaryX[i + 1];
        const midY = boxY + boxH / 2;

        ctx.save();
        ctx.setLineWidth && ctx.setLineWidth(RULER_LINE_W);
        ctx.beginPath(); ctx.moveTo(x1, midY); ctx.lineTo(x2, midY); ctx.stroke();
        ctx.restore();

        const vH = boxH * 0.6, vOff = (boxH - vH) / 2;
        ctx.save();
        ctx.setLineWidth && ctx.setLineWidth(RULER_TICK_W);
        ctx.beginPath();
        ctx.moveTo(x1, boxY + vOff); ctx.lineTo(x1, boxY + vOff + vH);
        ctx.moveTo(x2, boxY + vOff); ctx.lineTo(x2, boxY + vOff + vH);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.setFont && ctx.setFont('10px Arial');
        ctx.fillText && ctx.fillText(String(i + 1), x1 + (x2 - x1) / 2 - 3, boxY - 2);
        ctx.restore();
      }
    };

    let col = 0;
    let yTop = 24;

    for (let m = 0; m < measureCount; m++) {
      if (col >= measuresPerLine) {
        col = 0;
        yTop += tracksCount * (STAVE_H + STAVE_GAP) + LINE_GAP;
      }

      const xBase = LEFT_MARGIN + LEFT_LABEL_W + col * STAVE_W;

      const staves = [];
      for (let t = 0; t < tracksCount; t++) {
        const y = yTop + t * (STAVE_H + STAVE_GAP);
        const stave = new VF.Stave(xBase, y, STAVE_W);
        (stave.setNumLines ? stave.setNumLines(NUM_STAVE_LINES) : (stave.options.num_lines = NUM_STAVE_LINES));

        if (m === measureCount - 1 && col === measuresPerLine - 1) {
          stave.setEndBarType(VF.Barline.type.END);
        }

        stave.setContext(context).draw();

        if (col === 0 && trackInfos[t]) {
          const label = `${trackInfos[t].label} (${trackInfos[t].drumName})`;
          const labelX = LEFT_MARGIN;
          const labelY = y + STAVE_H / 2;
          context.save();
          context.textBaseline && (context.textBaseline = 'middle');
          context.setFont && context.setFont('12px Arial');
          context.fillText && context.fillText(label, labelX, labelY);
          context.restore();
        }

        staves.push(stave);
      }

      const tracksNotes = [];
      const tracksBeams = [];
      const allNoteStepMaps = [];

      for (let t = 0; t < tracksCount; t++) {
        const symbols = measuresByTrack[t][m] || [];
        const notes = [];
        const beams = [];
        const noteStepMap = [];
        let notesInBeat = [];
        let stepsInBeat = 0;
        let stepCounter = 0;

        for (const sym of symbols) {
          const vex = this.getVexFlowDuration ? this.getVexFlowDuration(sym.duration, effectiveSpb) : null;
          if (!vex || !vex.duration) continue;

          const note = new VF.StaveNote({
            keys: ['b/4'],
            duration: vex.duration + (sym.type === 'rest' ? 'r' : ''),
            clef: 'percussion'
          });
          note._canBeam = sym.type !== 'rest' && ['8', '16', '32', '64'].includes(vex.duration);

          if (sym.type === 'note') {
            const globalStepIndex = selectionStartStep + m * 4 * effectiveSpb + stepCounter;
            noteStepMap.push({ note, track: startTrack + t, step: globalStepIndex });
          }
          stepCounter += sym.duration;

          if (vex.dot) {
            if (typeof note.addDotToAll === 'function') note.addDotToAll();
            else if (typeof note.addDot === 'function') note.addDot(0);
            else if (VF.Dot && VF.Dot.buildAndAttach) VF.Dot.buildAndAttach([note], { index: 0 });
          }

          notes.push(note);
          if (sym.type !== 'rest') notesInBeat.push(note);

          stepsInBeat += sym.duration;
          if (stepsInBeat >= effectiveSpb) {
            const beamableNotes = notesInBeat.filter(n => n._canBeam);
            if (beamableNotes.length > 1) beams.push(new VF.Beam(beamableNotes));
            notesInBeat = [];
            stepsInBeat = 0;
          }
        }

        tracksNotes.push(notes);
        tracksBeams.push(beams);
        allNoteStepMaps.push(noteStepMap);
      }

      const voices = tracksNotes.map(ns =>
        new VF.Voice({ num_beats: 4, beat_value: 4 }).setMode(VF.Voice.Mode.SOFT).addTickables(ns)
      );
      const formatter = new VF.Formatter();
      formatter.format(voices, STAVE_W - 30);

      for (let t = 0; t < tracksCount; t++) {
        voices[t].draw(context, staves[t]);
        tracksBeams[t].forEach(b => b.setContext(context).draw());
      }

      // 設置音符元素的ID和數據屬性，用於高亮功能
      setTimeout(() => {
        allNoteStepMaps.forEach(trackMap => {
          trackMap.forEach(item => {
            let noteElement = (item.note.attrs && item.note.attrs.el) || (item.note.getSVGElement && item.note.getSVGElement());
            if (noteElement) {
              noteElement.id = `vf-note-${item.track}-${item.step}`;
              const children = noteElement.querySelectorAll('*');
              children.forEach(child => {
                child.setAttribute('data-note-id', `vf-note-${item.track}-${item.step}`);
                child.setAttribute('data-track', item.track);
                child.setAttribute('data-step', item.step);
              });
            }
          });
        });
      }, 100);

      const startX = staves[0].getNoteStartX ? staves[0].getNoteStartX() : (staves[0].getX() + 10);
      const endX   = staves[0].getNoteEndX   ? staves[0].getNoteEndX()   : (staves[0].getX() + STAVE_W - 10);

      const boundaryFromTrack = (notes, symbols) => {
        const pieceInfos = [];
        let acc = 0;
        for (let i = 0; i < symbols.length; i++) {
          const sym = symbols[i];
          const n = notes[i];
          if (!n) {
            pieceInfos.push({
              start: acc, end: acc + sym.duration,
              left:  startX + (acc / (4 * effectiveSpb)) * (endX - startX),
              right: startX + ((acc + sym.duration) / (4 * effectiveSpb)) * (endX - startX),
            });
            acc += sym.duration;
            continue;
          }
          const bb = (typeof n.getBoundingBox === 'function') ? n.getBoundingBox() : null;
          const cx = n.getAbsoluteX ? n.getAbsoluteX() : 0;
          const w  = (typeof n.getWidth === 'function') ? n.getWidth() : 10;
          const left  = (bb && bb.getX) ? bb.getX() : (cx - w / 2);
          const right = (bb && bb.getX && bb.getW()) ? (bb.getX() + bb.getW()) : (cx + w / 2);
          pieceInfos.push({ start: acc, end: acc + sym.duration, left, right });
          acc += sym.duration;
        }
        const res = [startX];
        for (let k = 1; k < 4; k++) {
          const target = k * effectiveSpb;
          let seg = pieceInfos.find(p => target <= p.end) || pieceInfos[pieceInfos.length - 1];
          let xk;
          if (!seg) xk = startX + (endX - startX) * (k / 4);
          else if (target <= seg.start) xk = seg.left;
          else if (target >= seg.end)  xk = seg.right;
          else {
            const r = (target - seg.start) / (seg.end - seg.start);
            xk = seg.left + r * (seg.right - seg.left);
          }
          res.push(xk);
        }
        res.push(endX);
        return res;
      };

      let boundaryX;
      if (RULER_MODE === 'uniform') {
        boundaryX = [];
        for (let k = 0; k <= 4; k++) boundaryX.push(startX + (endX - startX) * (k / 4));
      } else {
        const perTrack = tracksNotes.map((notes, t) => boundaryFromTrack(notes, measuresByTrack[t][m] || []));
        boundaryX = [];
        for (let k = 0; k <= 4; k++) {
          boundaryX[k] = Math.max(...perTrack.map(b => b[k]));
          if (k > 0 && boundaryX[k] < boundaryX[k - 1] + 1) boundaryX[k] = boundaryX[k - 1] + 1;
          if (boundaryX[k] > endX) boundaryX[k] = endX;
          if (boundaryX[k] < startX) boundaryX[k] = startX;
        }
      }

      if (showHints) {
        for (let t = 0; t < tracksCount; t++) drawBeatRuler(context, staves[t], boundaryX);
      }

      col++;
    }

    const totalHeight = yTop + tracksCount * (STAVE_H + STAVE_GAP) + 120;
    renderer.resize(canvasWidth, totalHeight);
  };
})();
