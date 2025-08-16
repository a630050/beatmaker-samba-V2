class PercussionTestModule {
    constructor(beatmaker) {
        this.beatmaker = beatmaker;
        this.active = false;
        this.currentTrackIndex = -1;
        this.testData = {};
        this.userHits = [];
        this.testStartTime = 0;
        this.playbackInterval = null;
        this.currentPlaybackStep = 0;
        this.isHighPrecision = false;
        // this.isExpandedView = false; // 已移除
        this.previousResult = null;
        this.HIT_OFFSET_MS = -50;

        this.dom = {
            modal: document.getElementById('testModal'),
            modalTitle: document.getElementById('testModalTitle'),
            closeBtn: document.getElementById('closeTestModal'),
            startBtn: document.getElementById('startTestBtn'),
            repeatBtn: document.getElementById('repeatTestBtn'),
            stopBtn: document.getElementById('stopTestBtn'),
            targetGrid: document.getElementById('targetGrid'),
            recordGrid: document.getElementById('recordGrid'),
            targetGridWrapper: document.querySelector('#targetGrid').parentElement,
            recordGridWrapper: document.querySelector('#recordGrid').parentElement,
            scoreDisplay: document.getElementById('scoreDisplay'),
            statusDisplay: document.getElementById('testStatus'),
            highPrecisionToggle: document.getElementById('highPrecisionToggle'),
            // expandToggleBtn: document.getElementById('expandToggleBtn'), // 已移除
            // expandBtnText: document.getElementById('expandBtnText'),       // 已移除
            perfectCount: document.getElementById('perfectCount'),
            earlyCount: document.getElementById('earlyCount'),
            lateCount: document.getElementById('lateCount'),
            missedCount: document.getElementById('missedCount'),
            handAccuracyDisplay: document.getElementById('handAccuracyDisplay'),
        };
        
        this.bindEvents();
    }

    bindEvents() {
        this.dom.closeBtn.addEventListener('click', () => this.confirmClose());
        this.dom.modal.addEventListener('click', (e) => {
            if (e.target === this.dom.modal) this.confirmClose();
        });
        this.dom.startBtn.addEventListener('click', () => this.startTest());
        this.dom.repeatBtn.addEventListener('click', () => this.startTest(true));
        this.dom.stopBtn.addEventListener('click', () => this.stopTest());

        this.dom.highPrecisionToggle.addEventListener('change', (e) => {
            this.isHighPrecision = e.target.checked;
            this.renderGrids();
            // 如果結果已經顯示，則立即用新精度重繪結果
            if (this.testData.results) {
                this.visualizeResults(this.testData.results);
            }
        });
        
        this.dom.targetGridWrapper.addEventListener('scroll', () => {
            this.dom.recordGridWrapper.scrollLeft = this.dom.targetGridWrapper.scrollLeft;
        });
        this.dom.recordGridWrapper.addEventListener('scroll', () => {
            this.dom.targetGridWrapper.scrollLeft = this.dom.recordGridWrapper.scrollLeft;
        });
    }

    openTest(trackIndex) {
        if (this.beatmaker.isPlaying) {
            alert("請先停止播放再開始測試。");
            return;
        }
        this.currentTrackIndex = trackIndex;
        const track = this.beatmaker.tracks[this.currentTrackIndex];
        
        this.dom.modalTitle.textContent = `打擊音軌測試: ${track.label}`;
        this.prepareTestData();
        this.resetUI(true);
        this.renderGrids();
        this.dom.modal.style.display = 'flex';
        this.active = true;
    }
    
    confirmClose() {
        if (this.active && this.testStartTime > 0) {
            if (!confirm("測試正在進行中，確定要放棄嗎？")) {
                return;
            }
        }
        this.closeTest();
    }

    closeTest() {
        clearInterval(this.playbackInterval);
        document.removeEventListener('keydown', this.boundHandleKeyDown);
        this.active = false;
        this.testStartTime = 0;
        this.previousResult = null;
        this.dom.modal.style.display = 'none';
    }

    resetUI(isNewTest = false) {
        this.dom.startBtn.style.display = 'inline-block';
        this.dom.startBtn.disabled = false;
        this.dom.repeatBtn.style.display = 'none';
        this.dom.stopBtn.style.display = 'none';
        this.dom.scoreDisplay.textContent = '--';
        this.dom.statusDisplay.innerHTML = '使用 <kbd>Z</kbd> (左手) 和 <kbd>/</kbd> (右手) 進行打擊<br>請點擊下方按鈕開始';
        this.dom.perfectCount.textContent = '0';
        this.dom.earlyCount.textContent = '0';
        this.dom.lateCount.textContent = '0';
        this.dom.missedCount.textContent = '0';
        if (this.dom.handAccuracyDisplay) this.dom.handAccuracyDisplay.textContent = '--%';
        
        this.dom.targetGridWrapper.scrollLeft = 0;
        this.dom.recordGridWrapper.scrollLeft = 0;

        if (isNewTest) {
             this.isHighPrecision = false;
             this.dom.highPrecisionToggle.checked = false;
        }
    }

    prepareTestData() {
        const track = this.beatmaker.tracks[this.currentTrackIndex];
        const bpm = this.beatmaker.bpm;
        const stepsPerBeat = this.beatmaker.stepsPerBeat;
        const totalSteps = this.beatmaker.totalBeats * stepsPerBeat;

        const microStepDuration = (60 / bpm) / (stepsPerBeat * 2) * 1000;
        const targetHits = [];
        track.steps.forEach((step, index) => {
            if (step) {
                const marker = track.markers[index] || {};
                targetHits.push({
                    time: (index * 2) * microStepDuration,
                    hand: marker.hand || null
                });
            }
        });

        this.testData = {
            track,
            bpm,
            stepsPerBeat,
            totalSteps,
            totalDuration: totalSteps * 2 * microStepDuration,
            microStepDuration,
            targetHits
        };
    }
    
    renderGrids() {
        const precision = this.isHighPrecision ? 8 : 4;
        const steps = this.testData.totalSteps * (precision / 4);
        const precisionClass = precision === 8 ? 'high-precision' : '';
        
        this.dom.targetGrid.className = `test-grid ${precisionClass}`;
        this.dom.recordGrid.className = `test-grid ${precisionClass}`;

        this.dom.targetGrid.innerHTML = '';
        this.dom.recordGrid.innerHTML = '';
        
        const track = this.testData.track;

        for (let i = 0; i < steps; i++) {
            const targetCell = document.createElement('div');
            targetCell.className = 'test-cell';
            
            let isActive = false;
            let markerText = '';
            
            const originalStepIndex = Math.floor(i / (precision / 4));

            if (track.steps[originalStepIndex]) {
                if ((precision === 8 && i % 2 === 0) || precision === 4) {
                    isActive = true;
                    const marker = track.markers[originalStepIndex] || {};
                    if (marker.hand) markerText = marker.hand;
                }
            }
            if(isActive) targetCell.classList.add('active');
            if(markerText) targetCell.textContent = markerText;

            this.dom.targetGrid.appendChild(targetCell);

            const recordCell = document.createElement('div');
            recordCell.className = 'test-cell';
            recordCell.dataset.index = i;
            this.dom.recordGrid.appendChild(recordCell);
        }
    }

    startTest(isRepeat = false) {
        if (!isRepeat) {
            this.previousResult = null;
        } else {
            this.previousResult = this.testData.results;
        }

        this.resetUI();
        this.renderGrids();
        this.userHits = [];
        this.dom.startBtn.style.display = 'none';
        this.dom.stopBtn.style.display = 'inline-block';
        this.dom.statusDisplay.textContent = '準備...';

        const prepCells = this.dom.modal.querySelectorAll('.prep-cell');
        prepCells.forEach(c => c.className = 'test-cell prep-cell');
        ['預', '備', '音', '格'].forEach((text, i) => { if(prepCells[i]) prepCells[i].textContent = text; });

        const precisionMultiplier = this.isHighPrecision ? 2 : 1;
        const stepDuration = ((60 / this.beatmaker.bpm) / this.testData.stepsPerBeat) * 1000 / precisionMultiplier;
        
        this.currentPlaybackStep = -4 * this.testData.stepsPerBeat * precisionMultiplier;
        
        this.playbackInterval = setInterval(() => {
            const totalSteps = this.testData.totalSteps * precisionMultiplier;

            if (this.currentPlaybackStep < 0) {
                const prepBeat = Math.floor(this.currentPlaybackStep / (this.testData.stepsPerBeat * precisionMultiplier)) + 4;
                
                if (this.currentPlaybackStep % (this.testData.stepsPerBeat * precisionMultiplier) === 0) {
                    this.beatmaker.playMetronomeSound();
                    prepCells.forEach(c => c.classList.remove('countdown'));
                    if(prepCells[prepBeat]) prepCells[prepBeat].classList.add('countdown');
                }
                
                if (this.currentPlaybackStep === -1) {
                    this.beginRecording();
                    prepCells.forEach(c => {c.classList.remove('countdown'); c.classList.add('go');});
                }
            } 
            else {
                this.dom.targetGrid.querySelectorAll('.playback-head').forEach(el => el.classList.remove('playback-head'));
                if (this.currentPlaybackStep < totalSteps) {
                    const currentCell = this.dom.targetGrid.children[this.currentPlaybackStep];
                    if (currentCell) {
                        currentCell.classList.add('playback-head');
                        this.autoScrollView(currentCell);

                        if (currentCell.classList.contains('active')) {
                            const track = this.testData.track;
                            this.beatmaker.playSound(track.drumType, track.soundEnabled, track.volume);
                        }
                    }
                } else {
                    clearInterval(this.playbackInterval);
                    this.processResults();
                }
            }
            
            this.currentPlaybackStep++;

        }, stepDuration);
    }
    
    beginRecording() {
        this.dom.statusDisplay.textContent = '開始!';
        this.testStartTime = performance.now();
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        document.addEventListener('keydown', this.boundHandleKeyDown);
    }

    handleKeyDown(e) {
        if (e.repeat) return;
        let hand = null;
        if (e.code === 'KeyZ') hand = 'L';
        if (e.code === 'Slash') hand = 'R';

        if (hand) {
            e.preventDefault();
            const hitTime = performance.now();
            if (hitTime < this.testStartTime) {
                this.dom.statusDisplay.textContent = '請在預備拍結束後敲擊！';
                setTimeout(() => this.dom.statusDisplay.textContent = '進行中...', 1000);
                return;
            }
            
            const elapsedTime = (hitTime - this.testStartTime) + this.HIT_OFFSET_MS;
            const hitData = { time: elapsedTime, hand: hand };
            this.userHits.push(hitData);
            this.visualizeSingleHit(hitData);
        }
    }

    processResults() {
        clearInterval(this.playbackInterval);
        document.removeEventListener('keydown', this.boundHandleKeyDown);
        this.dom.statusDisplay.textContent = '測試結束，正在計算分數...';
        
        const results = [];
        const hits = [...this.userHits];
        const microStep = this.testData.microStepDuration;
        const T = microStep * 2;
        
        this.testData.targetHits.forEach((target, index) => {
            let closestHit = null;
            let minDiff = Infinity;
            
            hits.forEach(hit => {
                const diff = Math.abs(hit.time - target.time);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestHit = hit;
                }
            });

            const result = { targetTime: target.time, targetHand: target.hand, targetIndex: index };
            if (closestHit && minDiff < T) {
                result.hitTime = closestHit.time;
                result.hitHand = closestHit.hand;
                result.delta = closestHit.time - target.time;
                
                const timeScore = Math.max(0, 100 - (Math.abs(result.delta) / T) * 100);
                const handCorrect = !target.hand || target.hand === closestHit.hand;
                const handScore = handCorrect ? 100 : 0;
                
                result.score = (timeScore * 0.7) + (handScore * 0.3);
                result.handCorrect = handCorrect;

                hits.splice(hits.indexOf(closestHit), 1);
            } else {
                result.score = 0;
            }
            results.push(result);
        });

        const extraHits = hits.map(hit => ({ hitTime: hit.time, hitHand: hit.hand }));
        this.testData.results = { matched: results, extra: extraHits };
        
        this.visualizeResults(this.testData.results);

        this.dom.startBtn.style.display = 'none';
        this.dom.repeatBtn.style.display = 'inline-block';
        this.dom.stopBtn.style.display = 'none';
        this.dom.statusDisplay.textContent = '測試完成！';
    }

    visualizeSingleHit(hitData) {
        const microStep = this.testData.microStepDuration;
        const currentPrecision = this.isHighPrecision ? 8 : 4;
        
        const hitStepIndex = Math.round(hitData.time / (this.isHighPrecision ? microStep : microStep * 2));
        
        const displayIndex = hitStepIndex;
        
        const cell = this.dom.recordGrid.querySelector(`.test-cell[data-index="${displayIndex}"]`);
        
        if (cell) {
            cell.innerHTML = ''; 
            cell.className = 'test-cell';
            
            let closestTarget = null;
            let minDiff = Infinity;
            this.testData.targetHits.forEach(target => {
                const diff = Math.abs(hitData.time - target.time);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestTarget = target;
                }
            });

            let hitClass = 'hit-extra';
            let handCorrect = true;
            
            if (closestTarget && minDiff < microStep * 2) {
                const deviationRatio = minDiff / (microStep * 2);
                if (deviationRatio < 0.25) hitClass = 'hit-perfect';
                else if (deviationRatio < 0.5) hitClass = 'hit-ok';
                else hitClass = 'hit-bad';

                if(closestTarget.hand && closestTarget.hand !== hitData.hand) {
                    handCorrect = false;
                }
            }
            
            cell.classList.add(hitClass);
            const handSpan = document.createElement('span');
            handSpan.className = 'hand-indicator';
            handSpan.textContent = hitData.hand;
            if (!handCorrect) handSpan.classList.add('wrong');
            cell.appendChild(handSpan);
        }
    }

    visualizeResults(results) {
        if (!results) return;

        this.renderGrids();
        
        let totalScore = 0, perfect = 0, early = 0, late = 0, handCorrectCount = 0;
        const microStep = this.testData.microStepDuration;
        const currentPrecision = this.isHighPrecision ? 8 : 4;

        results.matched.forEach(result => {
            totalScore += result.score;
            if (result.hitTime === undefined) return;
            
            const deviationRatio = Math.abs(result.delta) / (microStep * 2);
            
            let hitClass = 'hit-bad';
            if (deviationRatio < 0.25) { hitClass = 'hit-perfect'; perfect++; }
            else if (deviationRatio < 0.5) { hitClass = 'hit-ok'; }

            if (result.delta < -microStep/4) early++; else if (result.delta > microStep/4) late++;

            const hitStepIndex = Math.round(result.hitTime / (this.isHighPrecision ? microStep : microStep * 2));
            
            const displayIndex = hitStepIndex;
            const cell = this.dom.recordGrid.querySelector(`.test-cell[data-index="${displayIndex}"]`);
            
            if(cell) {
                cell.innerHTML = '';
                cell.className = 'test-cell';
                cell.classList.add(hitClass);
                const handSpan = document.createElement('span');
                handSpan.className = 'hand-indicator';
                handSpan.textContent = result.hitHand;
                if (!result.handCorrect) handSpan.classList.add('wrong');
                cell.appendChild(handSpan);
            }
            
            if(result.handCorrect) handCorrectCount++;
        });
        
        results.extra.forEach(extra => {
             const hitStepIndex = Math.round(extra.hitTime / (this.isHighPrecision ? microStep : microStep * 2));
             const displayIndex = hitStepIndex;
             const cell = this.dom.recordGrid.querySelector(`.test-cell[data-index="${displayIndex}"]`);
             if (cell) {
                cell.innerHTML = '';
                cell.className = 'test-cell';
                cell.classList.add('hit-extra');
                const handSpan = document.createElement('span');
                handSpan.className = 'hand-indicator';
                handSpan.textContent = extra.hitHand;
                cell.appendChild(handSpan);
             }
        });

        const avgScore = results.matched.length > 0 ? (totalScore / results.matched.length) : 0;
        const missed = results.matched.filter(r => r.hitTime === undefined).length;
        const totalHandJudged = results.matched.filter(r => r.hitTime !== undefined && r.targetHand).length;
        const handAccuracy = totalHandJudged > 0 ? (handCorrectCount / totalHandJudged) * 100 : 100;

        this.dom.scoreDisplay.textContent = avgScore.toFixed(1);
        this.dom.perfectCount.textContent = perfect;
        this.dom.earlyCount.textContent = early;
        this.dom.lateCount.textContent = late;
        this.dom.missedCount.textContent = missed + results.extra.length;
        if (this.dom.handAccuracyDisplay) {
            this.dom.handAccuracyDisplay.textContent = `${handAccuracy.toFixed(0)}%`;
        }
    }
    
    autoScrollView(cellElement) {
        const wrapper = this.dom.targetGrid.parentElement;
        const cellRect = cellElement.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();

        const scrollTriggerPoint = wrapperRect.left + wrapperRect.width * 0.4;

        if (cellRect.left > scrollTriggerPoint || cellRect.left < wrapperRect.left) {
             const scrollAmount = cellRect.left - wrapperRect.left - (wrapperRect.width * 0.1);
             wrapper.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    }
	
	stopTest() {
		clearInterval(this.playbackInterval);
		document.removeEventListener('keydown', this.boundHandleKeyDown);
		this.testStartTime = 0;
		
		this.resetUI();
		this.renderGrids();
		
		const prepCells = this.dom.modal.querySelectorAll('.prep-cell');
		prepCells.forEach(c => c.className = 'test-cell prep-cell');
	}
}
