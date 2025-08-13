	
        :root {
            --step-size: 30px;
            --selection-bg-color: rgba(50, 150, 255, 0.3);
            --selection-border-color: #3296ff;
            --selection-glow-color: rgba(50, 150, 255, 0.7);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            color: white;
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 100%;
            margin: 0 auto;
        }

		.header {
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			gap: 20px;
			margin-bottom: 20px;
			padding: 20px;
			background: rgba(0, 0, 0, 0.3);
			border-radius: 15px;
			backdrop-filter: blur(10px);
			flex-wrap: wrap;
		}

        .logo {
            font-size: 30px;
            font-weight: bold;
            color: #00ff88;
        }

        .controls {
            display: flex;
            align-items: center;
            gap: 15px;
            flex-wrap: wrap;
        }

        .bpm-control {
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(255, 255, 255, 0.1);
            padding: 8px 16px;
            border-radius: 8px;
        }

        .bpm-input {
            background: transparent;
            border: none;
            color: white;
            font-size: 16px;
            width: 60px;
            text-align: center;
        }

        .btn {
            background: linear-gradient(135deg, #00ff88 0%, #00cc66 100%);
            border: none;
            color: white;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s ease;
            font-size: 14px;
        }

        .btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 255, 136, 0.3);
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        .btn.active, .btn.toggled {
			background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
			box-shadow: 0 0 10px rgba(243, 156, 18, 0.5);
        }


        .btn.warning {
            background: linear-gradient(135deg, #ffc107 0%, #ffa000 100%);
        }

        .btn.warning:hover:not(:disabled) {
            box-shadow: 0 5px 15px rgba(255, 193, 7, 0.4);
        }

        .btn.action-btn {
            background: linear-gradient(135deg, #33aaff 0%, #0088cc 100%);
        }
        .btn.action-btn:hover:not(:disabled) {
            box-shadow: 0 5px 15px rgba(51, 170, 255, 0.3);
        }
        .btn.action-btn.toggled {
            background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%);
            box-shadow: 0 0 10px rgba(255, 153, 0, 0.5);
        }


        .control-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin: 10px 0;
            padding: 6px 15px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 10px;
            backdrop-filter: blur(10px);
            flex-wrap: wrap;
            gap: 15px;
        }

        .mode-controls {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .mode-btn {
            background: rgba(255, 255, 255, 0.1);
            border: 2px solid transparent;
            color: white;
            padding: 6px 15px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .mode-btn.active {
            border-color: #00ff88;
            background: rgba(0, 255, 136, 0.2);
        }

        .beat-setting-controls {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            align-items: center;
        }

        .beat-setting-label {
            color: #00ff88;
            font-weight: bold;
            margin-right: 10px;
        }

        .beat-setting-btn {
            background: rgba(255, 255, 255, 0.1);
            border: 2px solid transparent;
            color: white;
            padding: 8px 16px;
            font-size: 12px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .beat-setting-btn.active {
            border-color: #00ff88;
            background: rgba(0, 255, 136, 0.2);
        }

        .expand-controls {
            display: flex;
            align-items: center;
            gap: 10px;
        }

		.expand-btn {
			background: rgba(255, 255, 255, 0.1);
			border: 2px solid #00ff88;
			color: #00ff88;
			width: 34px;
			height: 34px;
			padding: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 8px;
			cursor: pointer;
			font-size: 18px;
			font-weight: bold;
			transition: all 0.3s ease;
		}

        .expand-btn:hover {
            background: rgba(0, 255, 136, 0.2);
        }

        .expand-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .expand-btn.reduce {
            border-color: #ff4444;
            color: #ff4444;
        }
        
        .expand-btn.reduce-start {
            border-color: #ff8c00;
            color: #ff8c00;
        }

        .expand-btn.reduce:hover {
            background: rgba(255, 68, 68, 0.2);
        }
        
        .expand-btn.reduce-start:hover {
            background: rgba(255, 140, 0, 0.2);
        }


        .beats-info {
            color: #00ff88;
            font-weight: bold;
        }

        .sequencer {
            background: rgba(0, 0, 0, 0.4);
            border-radius: 15px;
            padding: 10px;
            backdrop-filter: blur(10px);
            position: relative;
            display: flex;
            height: auto;
        }

		.tracks-controls {
			width: 350px;
			flex-shrink: 0;
			background: rgba(0, 0, 0, 0.5);
			border-radius: 10px;
			padding: 8px;
			margin-right: 10px;
			margin-top: 20px;
			overflow-y: auto;
			border: 2px solid rgba(0, 255, 136, 0.3);
			transition: width 0.3s ease, padding 0.3s ease;
			position: relative;
            display: flex;
            flex-direction: column;
		}

        #trackControls {
            flex-grow: 1;
        }

		.tracks-controls.collapsed {
			width: 60px;
			padding: 8px 4px;
		}

		.collapse-btn {
			background: rgba(0, 255, 136, 0.2);
			border: 1px solid #00ff88;
			color: #00ff88;
			width: 32px;
			height: 32px;
			border-radius: 4px;
			cursor: pointer;
			font-size: 12px;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: all 0.3s ease;
			z-index: 10;
            flex-shrink: 0;
            margin: 8px 0 0 auto;
		}

		.collapse-btn:hover {
			background: rgba(0, 255, 136, 0.4);
		}

		.tracks-controls.collapsed .collapse-btn {
			width: 32px;
			height: 32px;
            margin-top: 5px;
			margin-left: auto;
			margin-right: auto;
		}

        .tracks-sequencer {
            flex: 1;
            overflow-x: auto;
            overflow-y: hidden;
            position: relative;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 10px;
            padding: 10px;
        }

        .track-control-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 5px 8px;
            margin-bottom: 5px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            min-height: 42px;
			transition: all 0.3s ease;
        }

		.tracks-controls.collapsed .track-control-item {
			padding: 5px 4px;
			margin-bottom: 5px;
			min-height: 42px;
			justify-content: center;
			align-items: center;
		}

		.tracks-controls.collapsed .drum-select,
		.tracks-controls.collapsed .track-controls,
		.tracks-controls.collapsed .volume-control {
			display: none;
		}

		.tracks-controls.collapsed .track-number {
			width: 32px;
			height: 32px;
			font-size: 14px;
			line-height: 32px;
			text-align: center;
			flex-shrink: 0;
		}

        .track-control-item.current-playing {
            background: rgba(0, 255, 136, 0.15);
            border: 1px solid rgba(0, 255, 136, 0.3);
        }

		.track-steps.disabled {
			opacity: 0.3;
			background: rgba(128, 128, 128, 0.1) !important;
			pointer-events: none;
		}

		.track-steps.disabled .track-cell {
			background: rgba(128, 128, 128, 0.1) !important;
			border-color: rgba(128, 128, 128, 0.2) !important;
		}

		.track-steps.disabled .track-cell.active {
			background: rgba(128, 128, 128, 0.2) !important;
		}

		.track-steps.disabled .track-label {
			color: rgba(128, 128, 128, 0.6) !important;
		}

		.track-steps.disabled .step.beat-marker {
			border-color: rgba(255, 68, 68, 0.3) !important;
		}

        .track-number {
			width: 32px;
			height: 32px;
			font-size: 14px;
			line-height: 32px;
			text-align: center;
			flex-shrink: 0;
			background: rgba(0, 255, 136, 0.2);
			border: 1px solid #00ff88;
			color: #00ff88;
			border-radius: 4px;
			font-weight: bold;
        }

		.drum-select {
			flex: 1;
			min-width: 80px;
			padding: 4px 8px;
			background: rgba(0, 0, 0, 0.7);
			color: #00ff88;
			border: 1px solid rgba(0, 255, 136, 0.3);
			border-radius: 4px;
			font-size: 12px;
		}

        .track-controls {
            display: flex;
            gap: 4px;
            align-items: center;
        }

        .track-control-btn {
            width: 28px;
            height: 28px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            background: rgba(255, 255, 255, 0.1);
            border-radius: 5px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            font-size: 11px;
            flex-shrink: 0;
        }

        .track-control-btn.active {
            border-color: #00ff88;
            background: rgba(0, 255, 136, 0.3);
            color: #00ff88;
        }

		.volume-control {
			flex: 0 0 50px;
		}

		.volume-slider {
			width: 100%;
			height: 4px;
			background: rgba(255, 255, 255, 0.2);
			outline: none;
			border-radius: 2px;
			cursor: pointer;
		}

        .volume-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 12px;
            height: 12px;
            background: #00ff88;
            border-radius: 50%;
            cursor: pointer;
        }

        .volume-slider::-moz-range-thumb {
            width: 12px;
            height: 12px;
            background: #00ff88;
            border-radius: 50%;
            cursor: pointer;
            border: none;
        }

        .track-steps {
            display: flex;
            align-items: center;
            min-height: 42px;
            padding: 2px 0;
            margin-bottom: 5px;
        }

        .steps {
            display: flex;
            gap: 1px;
            min-width: fit-content;
            align-items: center;
        }

        .step {
            width: var(--step-size);
            height: var(--step-size);
            background: rgba(255, 255, 255, 0.1);
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            position: relative;
            font-size: 10px;
            flex-shrink: 0;
        }

        .step.active {
            background: linear-gradient(135deg, #00ff88 0%, #00cc66 100%);
            border-color: #00ff88;
            transform: scale(1.05);
        }

        .step.beat-marker {
            border-color: #ff4444;
        }

        .step.selected {
            background-color: var(--selection-bg-color) !important;
            border-color: var(--selection-border-color) !important;
            box-shadow: 0 0 8px var(--selection-glow-color);
            z-index: 2;
        }

        .step.step-highlighted {
            background-color: rgba(255, 255, 0, 0.25) !important;
            border-color: #f1c40f !important;
        }

        .step.playing {
            animation: pulse 0.2s ease;
            box-shadow: 0 0 20px #00ff88;
            z-index: 3;
        }

        .position-indicator {
            height: 10px;
            margin-bottom: 10px;
            position: relative;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            min-width: fit-content;
			cursor: pointer;
        }

		.position-line {
			position: absolute;
			top: 0;
			width: var(--step-size);
			height: 100%;
			background: #ff4444;
			border-radius: 1px;
			transition: left 0.1s linear;
			pointer-events: none;
			z-index: 5;
		}

        .file-controls {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .file-input {
            display: none;
        }

		.sound-panel-overlay {
			display: none;
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.7);
			backdrop-filter: blur(5px);
			z-index: 1000;
			justify-content: center;
			align-items: center;
			padding: 20px;
		}

		.sound-panel {
			background: #1a1a1a;
			padding: 30px;
			border-radius: 15px;
			color: white;
			width: 100%;
			max-width: 1200px;
			height: 100%;
			overflow-y: auto;
			border: 1px solid #00ff88;
			box-shadow: 0 10px 40px rgba(0, 255, 136, 0.25);
			display: flex;
			flex-direction: column;
		}

        .sound-controls-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 10px;
            margin-bottom: 10px;
        }


        .sound-control-item {
            padding: 15px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
        }

        .sound-control-item h4 {
            color: #00ff88;
            margin-bottom: 10px;
            font-size: 16px;
        }

        .sound-mode-selector {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            padding-bottom: 15px;
        }
        .sound-mode-selector label {
            cursor: pointer;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 12px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            transition: all 0.3s ease;
        }
        .sound-mode-selector input {
            display: none;
        }
        .sound-mode-selector input:checked + span {
            color: #1a1a1a;
            background-color: #00ff88;
            border-color: #00ff88;
            font-weight: bold;
        }
        .sound-mode-selector label.disabled span {
            opacity: 0.5;
            cursor: not-allowed;
            background-color: rgba(128, 128, 128, 0.2);
            color: rgba(255, 255, 255, 0.4);
            border-color: rgba(128, 128, 128, 0.3);
        }
        .loading-indicator::after {
            content: ' (載入中...)';
            color: #ffc107;
            font-size: 10px;
        }

        .unified-sound-params {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 12px 15px;
            margin-top: 15px;
        }

        .unified-sound-params label {
            font-size: 12px;
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        .unified-sound-params label.disabled {
            opacity: 0.4;
            pointer-events: none;
        }

        .unified-sound-params input[type="range"],
        .unified-sound-params select {
            width: 100%;
            padding: 0;
            margin-top: 4px;
        }
        .unified-sound-params select {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: none;
            padding: 4px;
            border-radius: 4px;
        }

        .param-value-display {
            font-weight: bold;
            color: #00ff88;
            font-size: 11px;
            min-width: 30px;
            text-align: right;
        }
        .param-label-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .sample-controls {
            margin-top: 15px;
        }

        .sample-controls .btn-small {
            padding: 6px 12px;
            font-size: 12px;
            margin-right: 5px;
        }

        .sample-file-name {
            font-size: 12px;
            color: #00ff88;
            margin-top: 8px;
            display: inline-block;
            max-width: 150px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            vertical-align: middle;
        }

        .test-btn {
            background: linear-gradient(135deg, #00ff88 0%, #00cc66 100%);
            border: none;
            color: white;
            padding: 5px 10px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
            transition: all 0.3s ease;
        }

        .test-btn:hover {
            transform: translateY(-1px);
        }

        .panel-buttons {
            text-align: center;
            display: flex;
            gap: 15px;
            justify-content: center;
        }

        @keyframes pulse {
            0% { transform: scale(1.05); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1.05); }
        }


		@media (max-width: 1200px) {
			.sound-controls-grid {
				grid-template-columns: 1fr 1fr;
			}
		}

        @media (max-width: 992px) {
            .tracks-controls {
                width: 290px;
            }
            .sound-controls-grid {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 1000px) {
            .sequencer {
                flex-direction: column;
                height: auto;
            }

            .tracks-controls {
                width: 100%;
                margin-right: 0;
                margin-bottom: 15px;
                max-height: 350px;
            }

            .tracks-sequencer {
                height: 400px;
            }
        }

		@media (max-width: 800px) {
            .step {
                font-size: 8px;
            }
        }

		.btn.loading {
            cursor: wait;
            background: linear-gradient(135deg, #555 0%, #333 100%);
            box-shadow: none;
            transform: none;
        }

		.author-credit {
			text-align: center;
			margin-top: 20px;
			color: rgba(255, 255, 255, 0.5);
			font-size: 14px;
		}

        @media (min-width: 801px) {
            .steps {
                gap: 2px;
            }
        }

		.modal-overlay {
			display: none;
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.7);
			backdrop-filter: blur(5px);
			z-index: 2000;
			justify-content: center;
			align-items: center;
		}

		.modal-content {
			background: #1a1a1a;
			border: 1px solid #00ff88;
			border-radius: 15px;
			width: 80vw;
			height: 85vh;
			max-width: 1000px;
			box-shadow: 0 10px 40px rgba(0, 255, 136, 0.25);
			display: flex;
			flex-direction: column;
			overflow: hidden;
			color: #e0e0e0;
		}
        
        #notationModal .modal-content {
            max-width: 95vw;
            width: 1200px;
            --vf-font-size: 38;
        }
        #notationModal .modal-body {
            padding: 20px 30px;
            overflow-y: auto;
            background: #fff;
            color: #000;
        }
        .notation-track-title {
            font-size: 20px;
            color: #000;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .notation-debug-text {
            background-color: #f0f0f0;
            border: 1px solid #ccc;
            padding: 15px;
            margin: 20px 0;
            font-family: 'Courier New', Courier, monospace;
            font-size: 14px;
            color: #333;
            border-radius: 5px;
        }
        .notation-debug-text h3 {
            margin-top: 0;
            color: #000;
        }
        .vexflow-container {
            margin-bottom: 20px;
        }


		.modal-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 15px 25px;
			border-bottom: 1px solid rgba(0, 255, 136, 0.3);
			color: #00ff88;
			background: rgba(0, 0, 0, 0.3);
		}

		.modal-header h3 {
			margin: 0;
			font-size: 20px;
		}

		.close-btn {
			background: none;
			border: none;
			color: white;
			font-size: 30px;
			font-weight: bold;
			cursor: pointer;
			opacity: 0.7;
			transition: opacity 0.2s;
		}

		.close-btn:hover {
			opacity: 1;
		}

		.modal-body {
			flex-grow: 1;
			padding: 0;
			overflow: hidden;
		}

		#helpFrame {
			width: 100%;
			height: 100%;
			border: none;
		}

		.beats-info-container {
			display: flex;
			align-items: center;
		}

		.beats-info-container .beat-setting-label {
			margin-right: 5px;
		}

		.btn.btn-info {
			background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%);
		}
		.btn.btn-info:hover:not(:disabled) {
			box-shadow: 0 5px 15px rgba(155, 89, 182, 0.4);
		}

		.btn.btn-special {
			background: linear-gradient(135deg, #1abc9c 0%, #16a085 100%);
		}
		.btn.btn-special:hover:not(:disabled) {
			box-shadow: 0 5px 15px rgba(26, 188, 156, 0.4);
		}

		.btn.btn-marking {
			background: linear-gradient(135deg, #26c6da 0%, #00acc1 100%);
		}
		.btn.btn-marking:hover:not(:disabled) {
			box-shadow: 0 5px 15px rgba(38, 198, 218, 0.4);
		}

		.btn.btn-marking.toggled {
			background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
			box-shadow: 0 0 10px rgba(255, 152, 0, 0.5);
		}

		.controls {
			display: flex;
			align-items: center;
			gap: 20px;
			flex-wrap: wrap;
		}

		.control-group {
			display: flex;
			align-items: center;
			gap: 10px;
			flex-wrap: wrap;
		}

		.btn.btn-danger {
			background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
		}
		.btn.btn-danger:hover:not(:disabled) {
			box-shadow: 0 5px 15px rgba(231, 76, 60, 0.4);
		}

		.btn.btn-secondary {
			background: linear-gradient(135deg, #bdc3c7 0%, #95a5a6 100%);
		}
		.btn.btn-secondary:hover:not(:disabled) {
			box-shadow: 0 5px 15px rgba(189, 195, 199, 0.4);
		}

		.btn.btn-help {
			background: linear-gradient(135deg, #e91e63 0%, #c2185b 100%);
		}
		.btn.btn-help:hover:not(:disabled) {
			box-shadow: 0 5px 15px rgba(233, 30, 99, 0.4);
		}


		.tracks-footer-controls {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin-top: 8px;
            flex-shrink: 0;
        }

        .tracks-controls.collapsed .tracks-footer-controls {
            flex-direction: column;
            gap: 5px;
        }

        .tracks-controls.collapsed #addTrackBtn {
            display: none;
        }


        .marker-controls {
            display: flex;
            gap: 10px;
            background: rgba(0, 0, 0, 0.4);
            padding: 5px 10px;
            border-radius: 8px;
            border: 1px solid #ff9900;
        }

        .marker-btn {
            background: transparent;
            border: 1px solid #ff9900;
            color: rgba(255, 255, 255, 0.6);
            width: 36px;
            height: 36px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }

		.marker-controls #clearBtn {
			background: transparent;
			border: 2px solid #e74c3c;
			color: #e74c3c;
			padding: 0 12px;
			height: 36px;
			font-size: 14px;
			font-weight: bold;
			border-radius: 8px;
			transition: all 0.2s ease;
			cursor: pointer;
		}

		.marker-controls #clearBtn:hover {
			background: rgba(231, 76, 60, 0.2);
			color: #ff6b5a;
			border-color: #ff6b5a;
		}

        .marker-btn.active {
            background: rgba(0, 255, 136, 0.2);
            border-color: #00ff88;
            color: #00ff88;
            transform: scale(1.1);
        }
        .marker-btn.active svg {
            stroke: #00ff88;
        }

        .marker-btn:not(.active):hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: #fff;
            color: #fff;
        }
        .marker-btn:not(.active):hover svg {
             stroke: #fff;
        }

        .step .marker-text {
            font-size: 18px;
            font-weight: bold;
            color: #ffc107;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            text-shadow: 0 0 5px black;
        }
        
        .step .rest-marker {
            font-size: 24px;
            font-weight: bold;
            color: black;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            text-shadow: 0 0 3px white, 0 0 5px white;
        }

        .step.active .marker-text {
            opacity: 0.85;
        }

        .step .marker-text {
            display: none;
        }

        .container.markers-visible .step .marker-text {
            display: block;
        }
		
		.step .rest-marker {
            display: block;
        }

        .container.markers-visible .step:not(:empty) .marker-text {
            font-size: 12px;
            top: 5px;
            left: auto;
            right: 4px;
            transform: none;
        }

		 .track-number input {
            width: 100%;
            height: 100%;
            background: transparent;
            border: 1px dotted #00ff88;
            color: #00ff88;
            text-align: center;
            font-size: 14px;
            font-weight: bold;
            padding: 0;
            outline: none;
            box-sizing: border-box;
        }

        .selection-controls {
            display: flex;
            gap: 10px;
            background: rgba(0, 0, 0, 0.4);
            padding: 5px 10px;
            border-radius: 8px;
            border: 1px solid #ff9900;
        }

        .selection-btn {
            background: transparent;
            border: 2px solid rgba(255, 153, 0, 0.6);
            color: rgba(255, 153, 0, 0.8);
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.2s ease;
        }

        .selection-btn:hover:not(:disabled) {
            background: rgba(255, 153, 0, 0.2);
            color: #ff9900;
            border-color: #ff9900;
        }

		.step .accent-marker {
			font-size: 14px;
			font-weight: bold;
			color: black;
			position: absolute;
			bottom: 2px;
			left: 4px;
			pointer-events: none;
			text-shadow: 0 0 2px white, 0 0 4px white;
		}

		.step .accent-marker {
			display: none;
		}

		.container.accents-visible .step .accent-marker {
			display: block;
		}

		.step.active .accent-marker {
			text-shadow: 0 0 3px #00ff88, 0 0 5px #00ff88;
		}
		
		.global-accent-controls {
			background: rgba(0, 0, 0, 0.3);
			border: 1px solid rgba(0, 255, 136, 0.3);
			border-radius: 10px;
			padding: 15px 25px;
			margin-bottom: 25px;
		}
		
		.global-accent-controls {
			background: rgba(0, 0, 0, 0.3);
			border: 1px solid rgba(0, 255, 136, 0.3);
			border-radius: 10px;
			padding: 15px 25px;
			margin-bottom: 25px;
		}

		.accent-controls-wrapper {
			display: flex;
			justify-content: space-around;
			align-items: center;
			gap: 30px;
			flex-wrap: wrap;
		}

		.accent-slider-container {
			display: flex;
			align-items: center;
			gap: 10px;
			flex-grow: 1;
			min-width: 250px;
		}

		.accent-slider-container label {
			flex-shrink: 0;
			font-size: 14px;
			color: #e0e0e0;
			width: 150px;
		}

		.accent-slider-container span {
			color: #00ff88;
			font-weight: bold;
			display: inline-block;
			width: 35px;
		}

		.accent-slider-container input[type="range"] {
			width: 100%;
		}		
		.step.active.step-dimmed {
				opacity: 0.65;
		}
	
