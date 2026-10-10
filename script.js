const audioContext = new (window.AudioContext || window.webkitAudioContext)();

let masterVolume = 0.35;
let drumVolume = 0.35;
let waveform = "sine";
let octave = 4;
let sustain = 0.7;
let bpm = 120;
let swing = 0;
let chordMode = "off";

let isPlaying = false;
let isRecording = false;
let isDrumPlaying = false;
let isMetronomeOn = false;
let masterMuted = false;

let recording = [];
let recordingStartTime = 0;
let recordingTimer = null;
let playbackTimer = null;
let playbackIndex = 0;
let playbackStartTime = 0;

let activeNotes = new Map();
let activeChords = new Map();
let activeBassNotes = new Map();
let activeInstrumentVoices = new Map();

let drumStep = 0;
let drumTimer = null;
let metronomeBeat = 0;
let metronomeTimer = null;

let tapTimes = [];
let tapResetTimer = null;

let selectedTrackId = "piano";

const DRUM_STEPS = 16;
const MIN_BPM = 40;
const MAX_BPM = 240;

const trackColours = [
    "#AFFF3E",
    "#B4D44D",
    "#A4E3A4",
    "#FFFA70",
    "#D9DF36",
    "#337738",
    "#4E8839",
    "#B5AD7A"
];

let tracks = [
    {
        id: "piano",
        name: "Piano",
        instrument: "Piano",
        volume: 1,
        muted: false,
        solo: false,
        colour: trackColours[0]
    },
    {
        id: "bass",
        name: "Bass",
        instrument: "Bass",
        volume: 1,
        muted: false,
        solo: false,
        colour: trackColours[1]
    },
    {
        id: "drums",
        name: "Drums",
        instrument: "Drums",
        volume: 1,
        muted: false,
        solo: false,
        colour: trackColours[2]
    }
];

const pianoContainer = document.querySelector(".piano");
const volumeSlider = document.getElementById("volume");
const volumeDisplay = document.getElementById("volumeDisplay");
const waveformSelect = document.getElementById("waveform");
const sustainSlider = document.getElementById("sustain");
const sustainDisplay = document.getElementById("sustainDisplay");
const octaveDisplay = document.getElementById("octaveDisplay");
const octaveDown = document.getElementById("octaveDown");
const octaveUp = document.getElementById("octaveUp");
const chordModeSelect = document.getElementById("chordMode");
const currentNote = document.getElementById("currentNote");
const currentBassNote = document.getElementById("currentBassNote");
const recordingStatus = document.getElementById("recordingStatus");
const recordingDisplay = document.getElementById("recordingDisplay");
const recordingNoteCount = document.getElementById("recordingNoteCount");
const recordingDuration = document.getElementById("recordingDuration");
const recordButton = document.getElementById("recordButton");
const clearButton = document.getElementById("clearButton");
const playButton = document.getElementById("playButton");
const playRecordingButton = document.getElementById("playRecordingButton");
const stopRecordingButton = document.getElementById("stopRecordingButton");
const bpmInput = document.getElementById("bpm");
const bpmDisplay = document.getElementById("bpmDisplay");
const bpmDown = document.getElementById("bpmDown");
const bpmUp = document.getElementById("bpmUp");
const drumPlayButton = document.getElementById("drumPlayButton");
const drumStopButton = document.getElementById("drumStopButton");
const drumClearButton = document.getElementById("drumClearButton");
const drumVolumeSlider = document.getElementById("drumVolume");
const drumVolumeDisplay = document.getElementById("drumVolumeDisplay");
const swingSlider = document.getElementById("swing");
const swingDisplay = document.getElementById("swingDisplay");
const metronomeButton = document.getElementById("metronomeButton");
const tapTempoButton = document.getElementById("tapTempoButton");
const tapTempoDisplay = document.getElementById("tapTempoDisplay");
const masterVolumeSlider = document.getElementById("masterVolume");
const masterVolumeDisplay = document.getElementById("masterVolumeDisplay");
const masterMuteButton = document.getElementById("masterMuteButton");
const saveButton = document.getElementById("saveButton");
const loadButton = document.getElementById("loadButton");
const deleteSaveButton = document.getElementById("deleteSaveButton");
const saveStatus = document.getElementById("saveStatus");
const projectNameInput = document.getElementById("projectName");
const trackList = document.getElementById("trackList");
const arrangementTracks = document.getElementById("arrangementTracks");
const addTrackButton = document.getElementById("addTrackButton");
const selectedTrackDisplay = document.getElementById("selectedTrackDisplay");
const timelinePosition = document.getElementById("timelinePosition");
const drumRows = document.querySelectorAll(".drum-row");

const instrumentSelect = document.getElementById("instrumentSelect");
const synthControls = document.getElementById("synthControls");
const synthWaveform = document.getElementById("synthWaveform");
const synthAttack = document.getElementById("synthAttack");
const synthRelease = document.getElementById("synthRelease");
const synthFilter = document.getElementById("synthFilter");
const synthResonance = document.getElementById("synthResonance");
const synthVolume = document.getElementById("synthVolume");

const chromaticNotes = [
    "C", "C#", "D", "D#", "E", "F",
    "F#", "G", "G#", "A", "A#", "B"
];

const keyboardMap = {
    a: "C", w: "C#", s: "D", e: "D#",
    d: "E", f: "F", t: "F#", g: "G",
    y: "G#", h: "A", u: "A#", j: "B", k: "C"
};

const instrumentSettings = {
    "Piano": {
        attack: 0.008, release: 0.18, filter: 9000,
        resonance: 0.7, volume: 0.8,
        layers: [
            { type: "triangle", ratio: 1, gain: 0.8 },
            { type: "sine", ratio: 2, gain: 0.12 }
        ]
    },
    "Bass": {
        attack: 0.015, release: 0.15, filter: 1800,
        resonance: 1, volume: 0.55,
        layers: [
            { type: "sawtooth", ratio: 1, gain: 0.8 },
            { type: "sine", ratio: 0.5, gain: 0.25 }
        ]
    },
    "Synth": {
        attack: 0.05, release: 0.3, filter: 6000,
        resonance: 1, volume: 0.7,
        layers: [
            { type: "sawtooth", ratio: 1, gain: 0.8 },
            { type: "sine", ratio: 2, gain: 0.15 }
        ]
    },
    "Organ": {
        attack: 0.01, release: 0.12, filter: 10000,
        resonance: 0.5, volume: 0.65,
        layers: [
            { type: "sine", ratio: 1, gain: 0.5 },
            { type: "sine", ratio: 2, gain: 0.3 },
            { type: "sine", ratio: 3, gain: 0.18 },
            { type: "sine", ratio: 4, gain: 0.1 },
            { type: "sine", ratio: 6, gain: 0.06 },
            { type: "triangle", ratio: 1, gain: 0.12 }
        ]
    },
    "Strings": {
        attack: 0.35, release: 0.8, filter: 4500,
        resonance: 0.8, volume: 0.55,
        layers: [
            { type: "sawtooth", ratio: 0.997, gain: 0.35 },
            { type: "sawtooth", ratio: 1.003, gain: 0.35 },
            { type: "triangle", ratio: 1, gain: 0.3 }
        ]
    },
    "Electric Piano": {
        attack: 0.005, release: 0.35, filter: 6500,
        resonance: 0.8, volume: 0.7,
        layers: [
            { type: "sine", ratio: 1, gain: 0.7 },
            { type: "sine", ratio: 2.01, gain: 0.22 },
            { type: "sine", ratio: 3.9, gain: 0.08 }
        ]
    }
};

function ensureAudio() {
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
}

function noteToMidi(note) {
    const match = note.match(/^([A-G]#?)(-?\d+)$/);
    if (!match) return null;

    const index = chromaticNotes.indexOf(match[1]);
    if (index < 0) return null;

    return (Number(match[2]) + 1) * 12 + index;
}

function midiToNote(midi) {
    return `${chromaticNotes[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function getNoteFrequency(note) {
    const midi = noteToMidi(note);
    return midi === null ? 0 : 440 * Math.pow(2, (midi - 69) / 12);
}

function getChordNotes(rootNote, mode) {
    const root = noteToMidi(rootNote);
    if (root === null || mode === "off") return [rootNote];

    const intervals = {
        major: [0, 4, 7],
        minor: [0, 3, 7],
        "7th": [0, 4, 7, 10]
    };

    return (intervals[mode] || [0]).map(i => midiToNote(root + i));
}

function getTrack(trackId) {
    return tracks.find(track => track.id === trackId);
}

function hasSoloTrack() {
    return tracks.some(track => track.solo);
}

function isTrackAudible(trackId) {
    const track = getTrack(trackId);
    if (!track) return false;
    if (masterMuted || track.muted) return false;
    return !hasSoloTrack() || track.solo;
}

function getTrackVolume(trackId) {
    const track = getTrack(trackId);
    return track && isTrackAudible(trackId) ? track.volume : 0;
}

function getEffectiveMasterVolume() {
    return masterMuted ? 0 : masterVolume;
}

function getInstrumentForTrack(trackId) {
    const track = getTrack(trackId);
    return track && instrumentSettings[track.instrument]
        ? track.instrument
        : "Piano";
}

function getSelectedInstrument() {
    return getInstrumentForTrack(selectedTrackId);
}

function getInstrumentSettings(instrument) {
    const defaults = instrumentSettings[instrument] || instrumentSettings.Piano;

    if (instrument !== "Synth") return defaults;

    return {
        ...defaults,
        attack: Number(synthAttack?.value ?? defaults.attack),
        release: Number(synthRelease?.value ?? defaults.release),
        filter: Number(synthFilter?.value ?? defaults.filter),
        resonance: Number(synthResonance?.value ?? defaults.resonance),
        volume: Number(synthVolume?.value ?? defaults.volume),
        layers: [
            { type: synthWaveform?.value || "sawtooth", ratio: 1, gain: 0.8 },
            { type: "sine", ratio: 2, gain: 0.15 }
        ]
    };
}

function voiceKey(note, trackId) {
    return `${trackId}:${note}`;
}

function stopInstrumentNote(note, trackId, releaseOverride = null) {
    const key = voiceKey(note, trackId);
    const voice = activeInstrumentVoices.get(key);
    if (!voice) return;

    const now = audioContext.currentTime;
    const release = Math.max(0.03, releaseOverride ?? voice.release);

    voice.gains.forEach(gain => {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0, now, Math.max(0.01, release / 4));
    });

    voice.oscillators.forEach(oscillator => {
        try {
            oscillator.stop(now + release + 0.08);
        } catch (_) {}
    });

    activeInstrumentVoices.delete(key);
}

function playNote(note, instrument = null, volume = 1, trackId = selectedTrackId) {
    ensureAudio();

    const track = getTrack(trackId);
    if (!track || !isTrackAudible(trackId)) return;

    const selectedInstrument = instrument || getInstrumentForTrack(trackId);
    const settings = getInstrumentSettings(selectedInstrument);
    const frequency = getNoteFrequency(note);
    if (!frequency) return;

    stopInstrumentNote(note, trackId, 0.025);

    const now = audioContext.currentTime;
    const oscillators = [];
    const gains = [];

    const level = masterVolume *
        track.volume *
        settings.volume *
        Math.max(0, Math.min(1, volume)) *
        getEffectiveMasterVolume();

    settings.layers.forEach(layer => {
        const oscillator = audioContext.createOscillator();
        const filter = audioContext.createBiquadFilter();
        const gain = audioContext.createGain();

        oscillator.type = layer.type;
        oscillator.frequency.setValueAtTime(frequency * layer.ratio, now);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(settings.filter, now);
        filter.Q.setValueAtTime(settings.resonance, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(
            Math.max(0.0001, level * layer.gain),
            now + settings.attack
        );

        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(now);

        oscillators.push(oscillator);
        gains.push(gain);
    });

    activeInstrumentVoices.set(voiceKey(note, trackId), {
        oscillators,
        gains,
        release: settings.release,
        instrument: selectedInstrument
    });
}

function stopNote(note, releaseTime = null, trackId = selectedTrackId) {
    stopInstrumentNote(note, trackId, releaseTime);
}

function playChord(rootNote, instrument = getSelectedInstrument(), trackId = selectedTrackId) {
    const notes = getChordNotes(rootNote, chordMode);
    notes.forEach(note => playNote(note, instrument, 1, trackId));
    activeChords.set(`${trackId}:${rootNote}`, notes);
}

function stopChord(rootNote, trackId = selectedTrackId) {
    const key = `${trackId}:${rootNote}`;
    const notes = activeChords.get(key) || [rootNote];
    notes.forEach(note => stopNote(note, null, trackId));
    activeChords.delete(key);
}

function setKeyPressed(element, pressed) {
    if (element) element.classList.toggle("pressed", pressed);
}

function findPianoKey(note) {
    return pianoContainer?.querySelector(`.piano-key[data-note="${note}"]`) || null;
}

function renderPiano() {
    if (!pianoContainer) return;

    pianoContainer.innerHTML = "";

    const whiteNotes = [
        `C${octave}`, `D${octave}`, `E${octave}`, `F${octave}`,
        `G${octave}`, `A${octave}`, `B${octave}`, `C${octave + 1}`
    ];

    const whiteLabels = ["A", "S", "D", "F", "G", "H", "J", "K"];

    whiteNotes.forEach((note, index) => {
        const key = document.createElement("button");
        key.className = "piano-key white-key";
        key.dataset.note = note;
        key.dataset.keyboard = whiteLabels[index];
        key.innerHTML = `<span>${note}</span><small>${whiteLabels[index]}</small>`;
        pianoContainer.appendChild(key);
    });

    const blackNotes = [
        `C#${octave}`, `D#${octave}`, `F#${octave}`,
        `G#${octave}`, `A#${octave}`
    ];

    const blackLabels = ["W", "E", "T", "Y", "U"];
    const positions = [11.25, 23.75, 48.75, 61.25, 73.75];

    blackNotes.forEach((note, index) => {
        const key = document.createElement("button");
        key.className = `piano-key black-key black-${index + 1}`;
        key.dataset.note = note;
        key.dataset.keyboard = blackLabels[index];
        key.style.left = `${positions[index]}%`;
        key.innerHTML = `<span>${note}</span><small>${blackLabels[index]}</small>`;
        pianoContainer.appendChild(key);
    });

    bindPianoEvents();
    if (octaveDisplay) octaveDisplay.textContent = octave;
}

function getRootNoteFromKeyboardKey(key) {
    const lower = key.toLowerCase();
    const note = keyboardMap[lower];
    if (!note) return null;
    return `${note}${lower === "k" ? octave + 1 : octave}`;
}

function playPianoKey(note, keyElement) {
    ensureAudio();

    const instrument = getSelectedInstrument();

    if (chordMode === "off") {
        playNote(note, instrument, 1, selectedTrackId);
    } else {
        playChord(note, instrument, selectedTrackId);
    }

    setKeyPressed(keyElement, true);

    if (currentNote) {
        currentNote.textContent = chordMode === "off" ? note : `${note} ${chordMode}`;
    }

    recordNote(note, instrument, selectedTrackId);
}

function releasePianoKey(note, keyElement) {
    const instrument = getSelectedInstrument();

    if (chordMode === "off") {
        stopNote(note, null, selectedTrackId);
    } else {
        stopChord(note, selectedTrackId);
    }

    setKeyPressed(keyElement, false);
    if (currentNote) currentNote.textContent = "—";
}

function bindPianoEvents() {
    if (!pianoContainer) return;

    pianoContainer.querySelectorAll(".piano-key").forEach(key => {
        const note = key.dataset.note;

        key.addEventListener("pointerdown", event => {
            event.preventDefault();
            playPianoKey(note, key);
        });

        ["pointerup", "pointercancel"].forEach(type => {
            key.addEventListener(type, event => {
                event.preventDefault();
                releasePianoKey(note, key);
            });
        });

        key.addEventListener("pointerleave", event => {
            if (event.buttons === 1) releasePianoKey(note, key);
        });
    });
}

function recordNote(note, instrument = null, trackId = selectedTrackId) {
    if (!isRecording || !getTrack(trackId)) return;

    const now = performance.now();
    const trackInstrument = instrument || getInstrumentForTrack(trackId);

    recording.push({
        note,
        instrument: trackInstrument,
        trackId,
        time: now - recordingStartTime,
        chord: ["Piano", "Electric Piano"].includes(trackInstrument)
            ? chordMode
            : "off"
    });

    recording.sort((a, b) => a.time - b.time);
    updateRecordingDisplay();
    renderArrangement();
    markUnsaved();
}

function updateRecordingDisplay() {
    if (recordingDisplay) {
        recordingDisplay.textContent = recording.length
            ? recording.map(item => {
                const track = getTrack(item.trackId);
                const name = track?.name || item.instrument || "Instrument";
                return `${name}: ${item.note}${item.chord && item.chord !== "off" ? ` (${item.chord})` : ""}`;
            }).join(" • ")
            : "No notes recorded yet.";
    }

    if (recordingNoteCount) recordingNoteCount.textContent = recording.length;
    updateRecordingDuration();
}

function updateRecordingDuration() {
    if (!recordingDuration) return;

    let duration = recording.length
        ? Math.max(...recording.map(item => item.time))
        : 0;

    if (isRecording) duration = performance.now() - recordingStartTime;

    recordingDuration.textContent = `${Math.max(duration / 1000, 0).toFixed(1)}s`;
}

function startRecording() {
    ensureAudio();

    if (isRecording) return;

    stopRecordingPlayback();

    // Do not clear recording here. Each take adds notes to the existing project.
    recordingStartTime = performance.now();
    isRecording = true;

    if (recordButton) {
        recordButton.textContent = "Stop Recording";
        recordButton.classList.add("active");
    }

    if (recordingStatus) {
        recordingStatus.textContent = `Recording ${getTrack(selectedTrackId)?.name || ""}`;
    }

    updateRecordingDisplay();
    renderArrangement();

    clearInterval(recordingTimer);
    recordingTimer = setInterval(updateRecordingDuration, 100);
}

function stopRecording() {
    if (!isRecording) return;

    isRecording = false;
    clearInterval(recordingTimer);
    recordingTimer = null;

    if (recordButton) {
        recordButton.textContent = "Record";
        recordButton.classList.remove("active");
    }

    if (recordingStatus) {
        recordingStatus.textContent = recording.length ? "Recording saved" : "Ready";
    }

    updateRecordingDisplay();
    renderArrangement();
    markUnsaved();
}

function toggleRecording() {
    if (isRecording) stopRecording();
    else startRecording();
}

function clearRecording() {
    stopRecordingPlayback();
    recording = [];

    if (recordingStatus) recordingStatus.textContent = "Ready";

    updateRecordingDisplay();
    renderArrangement();
    markUnsaved();
}

function playRecording() {
    if (!recording.length) {
        if (recordingStatus) recordingStatus.textContent = "Nothing to play";
        return;
    }

    ensureAudio();
    stopRecordingPlayback();

    isPlaying = true;
    playbackIndex = 0;
    playbackStartTime = performance.now();

    if (playButton) {
        playButton.textContent = "Stop";
        playButton.classList.add("active");
    }

    if (playRecordingButton) {
        playRecordingButton.textContent = "Playing...";
        playRecordingButton.classList.add("active");
    }

    if (recordingStatus) recordingStatus.textContent = "Playing recording";

    scheduleNextRecordingNote();
}

function scheduleNextRecordingNote() {
    if (!isPlaying || playbackIndex >= recording.length) {
        stopRecordingPlayback();
        return;
    }

    const noteData = recording[playbackIndex];
    const elapsed = performance.now() - playbackStartTime;
    const delay = Math.max(0, noteData.time - elapsed);

    playbackTimer = setTimeout(() => {
        if (!isPlaying) return;

        const trackId = noteData.trackId || "piano";
        const track = getTrack(trackId);
        const instrument = noteData.instrument || getInstrumentForTrack(trackId);

        if (track && isTrackAudible(trackId)) {
            const notes = getChordNotes(
                noteData.note,
                noteData.chord || "off"
            );

            notes.forEach(note => playNote(note, instrument, 1, trackId));

            const release = instrumentSettings[instrument]?.release ?? 0.15;
            setTimeout(() => {
                notes.forEach(note => stopNote(note, release, trackId));
            }, Math.max(100, sustain * 500));
        }

        playbackIndex++;

        if (timelinePosition) {
            timelinePosition.textContent = `${(noteData.time / 1000).toFixed(1)}s`;
        }

        scheduleNextRecordingNote();
    }, delay);
}

function stopRecordingPlayback() {
    isPlaying = false;
    clearTimeout(playbackTimer);
    playbackTimer = null;

    activeInstrumentVoices.forEach((voice, key) => {
        const split = key.indexOf(":");
        const trackId = key.slice(0, split);
        const note = key.slice(split + 1);
        stopNote(note, 0.05, trackId);
    });

    activeNotes.forEach((_, note) => stopNote(note, 0.05));
    activeBassNotes.forEach((_, note) => stopBassNote(note));
    activeChords.clear();

    if (playButton) {
        playButton.textContent = "Play";
        playButton.classList.remove("active");
    }

    if (playRecordingButton) {
        playRecordingButton.textContent = "Play Recording";
        playRecordingButton.classList.remove("active");
    }

    if (recordingStatus && !isRecording) {
        recordingStatus.textContent = recording.length ? "Recording saved" : "Ready";
    }
}

function updateVolume() {
    if (volumeSlider) masterVolume = Number(volumeSlider.value);
    if (volumeDisplay) volumeDisplay.textContent = `${Math.round(masterVolume * 100)}%`;
    updateMasterVolumeDisplay();
}

function updateMasterVolumeDisplay() {
    if (masterVolumeDisplay) {
        masterVolumeDisplay.textContent = `${Math.round(masterVolume * 100)}%`;
    }
}

function updateWaveform() {
    if (waveformSelect) waveform = waveformSelect.value;
}

function updateSustain() {
    if (!sustainSlider) return;
    sustain = Number(sustainSlider.value);
    if (sustainDisplay) sustainDisplay.textContent = `${sustain.toFixed(1)}s`;
}

function updateChordMode() {
    if (!chordModeSelect) return;
    chordMode = chordModeSelect.value;

    activeChords.forEach((_, key) => {
        const split = key.indexOf(":");
        stopChord(key.slice(split + 1), key.slice(0, split));
    });
}

function changeOctave(amount) {
    const next = Math.max(2, Math.min(5, octave + amount));
    if (next === octave) return;

    activeInstrumentVoices.forEach((voice, key) => {
        const split = key.indexOf(":");
        stopNote(key.slice(split + 1), 0.03, key.slice(0, split));
    });

    octave = next;
    renderPiano();
}

function updateBpm(value) {
    let next = Number(value);
    if (!Number.isFinite(next)) next = bpm;
    bpm = Math.round(Math.max(MIN_BPM, Math.min(MAX_BPM, next)));

    if (bpmInput) bpmInput.value = bpm;
    if (bpmDisplay) bpmDisplay.textContent = `${bpm} BPM`;

    if (isDrumPlaying) {
        stopDrums();
        startDrums();
    }

    if (isMetronomeOn) {
        stopMetronome();
        startMetronome();
    }
}

function getDrumStepLength() {
    return (60 / bpm) * 250;
}

function getDrumStepDelay(step) {
    const length = getDrumStepLength();
    return swing <= 0 ? length : length * (step % 2 === 0 ? 1 + swing : 1 - swing);
}

function playKick() {
    ensureAudio();
    if (!isTrackAudible("drums")) return;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(150, now);
    oscillator.frequency.exponentialRampToValueAtTime(45, now + 0.18);

    const level = drumVolume * getTrackVolume("drums") * getEffectiveMasterVolume();
    gain.gain.setValueAtTime(Math.max(level, 0.001), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
}

function playNoiseHit(duration, filterType, frequency, level) {
    ensureAudio();
    if (!isTrackAudible("drums")) return;

    const length = Math.floor(audioContext.sampleRate * duration);
    const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;

    source.buffer = buffer;
    filter.type = filterType;
    filter.frequency.value = frequency;

    const volume = drumVolume * level * getTrackVolume("drums") * getEffectiveMasterVolume();
    gain.gain.setValueAtTime(Math.max(volume, 0.001), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    source.start(now);
}

function playSnare() {
    playNoiseHit(0.2, "highpass", 1200, 0.8);
}

function playHiHat() {
    playNoiseHit(0.08, "highpass", 5000, 0.5);
}

function playDrumSound(type) {
    if (type === "kick") playKick();
    if (type === "snare") playSnare();
    if (type === "hihat") playHiHat();
}

function getDrumInstrument(row) {
    return row.querySelector(".step")?.dataset.instrument || null;
}

function playDrumStep() {
    const currentStep = drumStep + 1;

    drumRows.forEach(row => {
        row.querySelectorAll(".step").forEach(step => step.classList.remove("playing"));

        const step = row.querySelector(`.step[data-step="${currentStep}"]`);
        if (!step) return;

        step.classList.add("playing");
        if (step.classList.contains("active")) playDrumSound(step.dataset.instrument);
    });

    updateBeatIndicators();
}

function scheduleNextDrumStep() {
    if (!isDrumPlaying) return;
    playDrumStep();
    const delay = getDrumStepDelay(drumStep);
    drumStep = (drumStep + 1) % DRUM_STEPS;
    drumTimer = setTimeout(scheduleNextDrumStep, delay);
}

function startDrums() {
    ensureAudio();
    if (isDrumPlaying) return;

    isDrumPlaying = true;
    drumStep = 0;

    if (drumPlayButton) {
        drumPlayButton.textContent = "Playing";
        drumPlayButton.classList.add("active");
    }

    scheduleNextDrumStep();
}

function stopDrums() {
    isDrumPlaying = false;
    clearTimeout(drumTimer);
    drumTimer = null;

    drumRows.forEach(row => {
        row.querySelectorAll(".step").forEach(step => step.classList.remove("playing"));
    });

    if (drumPlayButton) {
        drumPlayButton.textContent = "Play";
        drumPlayButton.classList.remove("active");
    }
}

function clearDrums() {
    drumRows.forEach(row => {
        row.querySelectorAll(".step").forEach(step => {
            step.classList.remove("active", "playing");
        });
    });
}

function updateDrumVolume() {
    if (!drumVolumeSlider) return;
    drumVolume = Number(drumVolumeSlider.value);
    if (drumVolumeDisplay) drumVolumeDisplay.textContent = `${Math.round(drumVolume * 100)}%`;
}

function updateSwing() {
    if (!swingSlider) return;
    swing = Number(swingSlider.value) / 100;
    if (swingDisplay) swingDisplay.textContent = `${Math.round(swing * 100)}%`;
}

function toggleDrumStep(element) {
    element.classList.toggle("active");
}

function setDrumPattern(pattern) {
    const rows = {
        kick: pattern.kick || [],
        snare: pattern.snare || [],
        hihat: pattern.hihat || []
    };

    drumRows.forEach(row => {
        const type = getDrumInstrument(row);
        if (!type) return;

        row.querySelectorAll(".step").forEach((step, index) => {
            step.classList.toggle("active", (rows[type] || []).includes(index + 1));
        });
    });
}

function getDrumPattern() {
    const pattern = { kick: [], snare: [], hihat: [] };

    drumRows.forEach(row => {
        const type = getDrumInstrument(row);
        if (!type || !pattern[type]) return;

        row.querySelectorAll(".step").forEach((step, index) => {
            if (step.classList.contains("active")) pattern[type].push(index + 1);
        });
    });

    return pattern;
}

function updateBeatIndicators() {
    document.querySelectorAll(".beat").forEach((beat, index) => {
        beat.classList.toggle("active", index === drumStep % 4);
    });
}

function playMetronomeClick() {
    ensureAudio();
    if (masterMuted) return;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    const accent = metronomeBeat === 0;

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(accent ? 1200 : 800, now);
    gain.gain.setValueAtTime((accent ? 0.2 : 0.1) * getEffectiveMasterVolume(), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.06);

    metronomeBeat = (metronomeBeat + 1) % 4;
    updateBeatIndicators();
}

function startMetronome() {
    if (isMetronomeOn) return;

    ensureAudio();
    isMetronomeOn = true;
    metronomeBeat = 0;

    if (metronomeButton) {
        metronomeButton.textContent = "Metronome On";
        metronomeButton.classList.add("active");
    }

    playMetronomeClick();
    metronomeTimer = setInterval(playMetronomeClick, (60 / bpm) * 1000);
}

function stopMetronome() {
    isMetronomeOn = false;
    clearInterval(metronomeTimer);
    metronomeTimer = null;

    if (metronomeButton) {
        metronomeButton.textContent = "Metronome: Off";
        metronomeButton.classList.remove("active");
    }
}

function tapTempo() {
    const now = performance.now();

    if (tapTimes.length && now - tapTimes[tapTimes.length - 1] > 2000) {
        tapTimes = [];
    }

    tapTimes.push(now);
    if (tapTimes.length > 6) tapTimes.shift();

    clearTimeout(tapResetTimer);
    tapResetTimer = setTimeout(() => {
        tapTimes = [];
        if (tapTempoDisplay) tapTempoDisplay.textContent = "0 taps";
    }, 2000);

    if (tapTimes.length >= 2) {
        let total = 0;
        for (let i = 1; i < tapTimes.length; i++) total += tapTimes[i] - tapTimes[i - 1];

        updateBpm(60000 / (total / (tapTimes.length - 1)));
        if (tapTempoDisplay) tapTempoDisplay.textContent = `${bpm} BPM`;
    } else if (tapTempoDisplay) {
        tapTempoDisplay.textContent = "Tap again";
    }
}

function playBassNote(note, keyElement = null) {
    if (!getTrack("bass")) return;

    playNote(note, getInstrumentForTrack("bass"), 0.8, "bass");

    if (keyElement) keyElement.classList.add("pressed");
    if (currentBassNote) currentBassNote.textContent = note;

    if (isRecording && keyElement) {
        recordNote(note, getInstrumentForTrack("bass"), "bass");
    }
}

function stopBassNote(note, keyElement = null) {
    stopNote(note, null, "bass");
    if (keyElement) keyElement.classList.remove("pressed");
    if (currentBassNote) currentBassNote.textContent = "—";
}

function bindBassEvents() {
    document.querySelectorAll(".bass-key").forEach(key => {
        const note = key.dataset.note;
        if (!note) return;

        key.addEventListener("pointerdown", event => {
            event.preventDefault();
            playBassNote(note, key);
        });

        ["pointerup", "pointercancel"].forEach(type => {
            key.addEventListener(type, event => {
                event.preventDefault();
                stopBassNote(note, key);
            });
        });

        key.addEventListener("pointerleave", event => {
            if (event.buttons === 1) stopBassNote(note, key);
        });
    });
}

function createTrack() {
    const id = `track-${Date.now()}`;

    tracks.push({
        id,
        name: `Track ${tracks.length + 1}`,
        instrument: "Piano",
        volume: 1,
        muted: false,
        solo: false,
        colour: trackColours[tracks.length % trackColours.length]
    });

    selectedTrackId = id;
    renderTracks();
    updateInstrumentSelector();
    renderArrangement();
    markUnsaved();
}

function renameTrack(trackId) {
    const track = getTrack(trackId);
    if (!track) return;

    const name = prompt("Track name:", track.name);
    if (!name) return;

    track.name = name.trim().slice(0, 30) || track.name;
    renderTracks();
    renderArrangement();
    markUnsaved();
}

function deleteTrack(trackId) {
    if (["piano", "bass", "drums"].includes(trackId) && tracks.length <= 3) {
        alert("The main Groove tracks cannot all be removed.");
        return;
    }

    const index = tracks.findIndex(track => track.id === trackId);
    if (index < 0) return;

    if (!confirm(`Delete "${tracks[index].name}"?`)) return;

    tracks.splice(index, 1);
    recording = recording.filter(item => item.trackId !== trackId);

    activeInstrumentVoices.forEach((voice, key) => {
        if (key.startsWith(`${trackId}:`)) {
            const note = key.slice(trackId.length + 1);
            stopNote(note, 0.03, trackId);
        }
    });

    if (selectedTrackId === trackId) selectedTrackId = tracks[0]?.id || null;

    renderTracks();
    updateInstrumentSelector();
    renderArrangement();
    updateRecordingDisplay();
    markUnsaved();
}

function selectTrack(trackId) {
    if (!getTrack(trackId)) return;

    selectedTrackId = trackId;
    updateInstrumentSelector();

    const track = getTrack(trackId);
    if (selectedTrackDisplay) selectedTrackDisplay.textContent = `${track.name} selected`;

    renderTracks();
    renderArrangement();
}

function toggleTrackMute(trackId) {
    const track = getTrack(trackId);
    if (!track) return;

    track.muted = !track.muted;
    renderTracks();
    markUnsaved();
}

function toggleTrackSolo(trackId) {
    const track = getTrack(trackId);
    if (!track) return;

    track.solo = !track.solo;
    renderTracks();
    markUnsaved();
}

function updateTrackVolume(trackId, value) {
    const track = getTrack(trackId);
    if (!track) return;

    track.volume = Number(value);
    markUnsaved();
}

function cycleTrackColour(trackId) {
    const track = getTrack(trackId);
    if (!track) return;

    const index = trackColours.indexOf(track.colour);
    track.colour = trackColours[index < 0 ? 0 : (index + 1) % trackColours.length];

    renderTracks();
    renderArrangement();
    markUnsaved();
}

function renderTracks() {
    if (!trackList) return;
    trackList.innerHTML = "";

    tracks.forEach((track, index) => {
        const item = document.createElement("div");
        item.className = "track-item";

        if (track.id === selectedTrackId) item.classList.add("selected");
        if (track.muted) item.classList.add("muted");
        if (track.solo) item.classList.add("solo");

        item.addEventListener("click", () => selectTrack(track.id));

        const top = document.createElement("div");
        top.className = "track-top";

        const number = document.createElement("span");
        number.className = "track-number";
        number.textContent = String(index + 1).padStart(2, "0");

        const colour = document.createElement("span");
        colour.className = "track-colour";
        colour.style.background = track.colour;
        colour.title = "Change track colour";
        colour.addEventListener("click", event => {
            event.stopPropagation();
            cycleTrackColour(track.id);
        });

        const name = document.createElement("div");
        name.className = "track-name";
        name.innerHTML = `<strong>${escapeHtml(track.name)}</strong><span>${escapeHtml(track.instrument)}</span>`;
        name.addEventListener("dblclick", event => {
            event.stopPropagation();
            renameTrack(track.id);
        });

        top.append(number, colour, name);

        const volume = document.createElement("input");
        volume.type = "range";
        volume.className = "track-volume";
        volume.min = "0";
        volume.max = "1";
        volume.step = "0.01";
        volume.value = track.volume;
        volume.addEventListener("click", event => event.stopPropagation());
        volume.addEventListener("input", event => updateTrackVolume(track.id, event.target.value));

        const actions = document.createElement("div");
        actions.className = "track-actions";

        [
            ["Rename", () => renameTrack(track.id)],
            [track.muted ? "Unmute" : "Mute", () => toggleTrackMute(track.id)],
            [track.solo ? "Unsolo" : "Solo", () => toggleTrackSolo(track.id)]
        ].forEach(([label, action]) => {
            const button = document.createElement("button");
            button.textContent = label;
            button.addEventListener("click", event => {
                event.stopPropagation();
                action();
            });
            actions.appendChild(button);
        });

        const remove = document.createElement("button");
        remove.textContent = "Delete";
        remove.className = "delete-track";
        remove.addEventListener("click", event => {
            event.stopPropagation();
            deleteTrack(track.id);
        });
        actions.appendChild(remove);

        item.append(top, volume, actions);
        trackList.appendChild(item);
    });

    const selected = getTrack(selectedTrackId);
    if (selected && selectedTrackDisplay) {
        selectedTrackDisplay.textContent = `${selected.name} selected`;
    }
}

function renderArrangement() {
    if (!arrangementTracks) return;
    arrangementTracks.innerHTML = "";

    tracks.forEach(track => {
        const row = document.createElement("div");
        row.className = "arrangement-row";

        const name = document.createElement("div");
        name.className = "arrangement-track-name";
        name.innerHTML = `<span class="track-colour" style="background:${track.colour}"></span><span>${escapeHtml(track.name)}</span>`;

        const lane = document.createElement("div");
        lane.className = "arrangement-lane";
        if (track.id === selectedTrackId) lane.classList.add("selected");
        lane.addEventListener("click", () => selectTrack(track.id));

        const notes = recording
            .filter(item => (item.trackId || "piano") === track.id)
            .sort((a, b) => a.time - b.time);

        if (notes.length) {
            const first = notes[0].time;
            const last = notes[notes.length - 1].time;
            const duration = Math.max(1000, last - first + 1000);
            const timeline = Math.max(duration, 16000);

            const clip = document.createElement("div");
            clip.className = "clip recording-clip";
            clip.style.left = `${Math.min((first / timeline) * 100, 95)}%`;
            clip.style.width = `${Math.min((duration / timeline) * 100, 100)}%`;
            clip.style.background = track.colour;
            clip.textContent = `${track.name} Recording`;
            lane.appendChild(clip);
        }

        if (track.id === "drums") {
            const pattern = getDrumPattern();
            const count = pattern.kick.length + pattern.snare.length + pattern.hihat.length;

            if (count) {
                const clip = document.createElement("div");
                clip.className = "clip";
                clip.style.left = "0%";
                clip.style.width = "100%";
                clip.style.background = track.colour;
                clip.textContent = `${count} drum steps`;
                lane.appendChild(clip);
            }
        }

        row.append(name, lane);
        arrangementTracks.appendChild(row);
    });
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getSaveData() {
    return {
        version: "1.9",
        projectName: projectNameInput?.value || "Untitled Groove",
        bpm,
        octave,
        masterVolume,
        masterMuted,
        drumVolume,
        waveform,
        sustain,
        swing,
        chordMode,
        recording,
        drumPattern: getDrumPattern(),
        tracks,
        selectedTrackId
    };
}

function markUnsaved() {
    if (saveStatus) saveStatus.textContent = "Unsaved changes";
}

function saveProject() {
    localStorage.setItem("grooveProject", JSON.stringify(getSaveData()));
    if (saveStatus) saveStatus.textContent = "Project saved";
}

function loadProject() {
    const saved = localStorage.getItem("grooveProject");

    if (!saved) {
        if (saveStatus) saveStatus.textContent = "No saved project";
        return;
    }

    try {
        const data = JSON.parse(saved);

        if (data.projectName && projectNameInput) projectNameInput.value = data.projectName;
        if (data.bpm !== undefined) updateBpm(data.bpm);

        if (data.octave !== undefined) {
            octave = Math.max(2, Math.min(5, Number(data.octave)));
            renderPiano();
        }

        if (data.masterVolume !== undefined) {
            masterVolume = Number(data.masterVolume);
            if (masterVolumeSlider) masterVolumeSlider.value = masterVolume;
            if (volumeSlider) volumeSlider.value = masterVolume;
            updateVolume();
        }

        if (data.masterMuted !== undefined) {
            masterMuted = Boolean(data.masterMuted);
            updateMasterMuteButton();
        }

        if (data.drumVolume !== undefined) {
            drumVolume = Number(data.drumVolume);
            if (drumVolumeSlider) drumVolumeSlider.value = drumVolume;
            updateDrumVolume();
        }

        if (data.waveform !== undefined) {
            waveform = data.waveform;
            if (waveformSelect) waveformSelect.value = waveform;
        }

        if (data.sustain !== undefined) {
            sustain = Number(data.sustain);
            if (sustainSlider) sustainSlider.value = sustain;
            updateSustain();
        }

        if (data.swing !== undefined) {
            swing = Number(data.swing);
            if (swingSlider) swingSlider.value = swing * 100;
            updateSwing();
        }

        if (data.chordMode !== undefined) {
            chordMode = data.chordMode;
            if (chordModeSelect) chordModeSelect.value = chordMode;
        }

        recording = Array.isArray(data.recording) ? data.recording : [];

        if (Array.isArray(data.tracks) && data.tracks.length) {
            tracks = data.tracks.map(track => ({
                volume: 1,
                muted: false,
                solo: false,
                colour: trackColours[0],
                ...track
            }));
        }

        if (data.selectedTrackId && getTrack(data.selectedTrackId)) {
            selectedTrackId = data.selectedTrackId;
        }

        if (data.drumPattern) setDrumPattern(data.drumPattern);

        updateInstrumentSelector();
        renderTracks();
        renderArrangement();
        updateRecordingDisplay();

        if (saveStatus) saveStatus.textContent = "Project loaded";
    } catch (error) {
        console.error(error);
        if (saveStatus) saveStatus.textContent = "Could not load project";
    }
}

function deleteSavedProject() {
    localStorage.removeItem("grooveProject");
    if (saveStatus) saveStatus.textContent = "Saved project deleted";
}

function updateMasterMuteButton() {
    if (!masterMuteButton) return;

    masterMuteButton.textContent = masterMuted ? "Master Muted" : "Master Mute";
    masterMuteButton.classList.toggle("active", masterMuted);
}

function toggleMasterMute() {
    masterMuted = !masterMuted;
    updateMasterMuteButton();
    markUnsaved();
}

function updateInstrumentSelector() {
    const track = getTrack(selectedTrackId);
    if (!track || !instrumentSelect) return;

    if (!instrumentSettings[track.instrument]) track.instrument = "Piano";
    instrumentSelect.value = track.instrument;

    if (synthControls) synthControls.hidden = track.instrument !== "Synth";

    renderTracks();
    renderArrangement();
}

function changeSelectedTrackInstrument(instrument) {
    const track = getTrack(selectedTrackId);
    if (!track || !instrumentSettings[instrument]) return;

    track.instrument = instrument;
    updateInstrumentSelector();
    markUnsaved();
}

function handleKeyboardDown(event) {
    const key = event.key.toLowerCase();
    if (event.repeat) return;

    const active = document.activeElement;
    if (active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) return;

    if (key === " ") {
        event.preventDefault();
        isPlaying ? stopRecordingPlayback() : playRecording();
        return;
    }

    if (key === "r") {
        toggleRecording();
        return;
    }

    if (key === "m") {
        isMetronomeOn ? stopMetronome() : startMetronome();
        return;
    }

    if (key === "z") {
        changeOctave(-1);
        return;
    }

    if (key === "x") {
        changeOctave(1);
        return;
    }

    const note = getRootNoteFromKeyboardKey(key);
    if (!note) return;

    const keyElement = findPianoKey(note);
    if (!keyElement) return;

    event.preventDefault();
    playPianoKey(note, keyElement);
}

function handleKeyboardUp(event) {
    const note = getRootNoteFromKeyboardKey(event.key.toLowerCase());
    if (!note) return;

    const keyElement = findPianoKey(note);
    if (keyElement) releasePianoKey(note, keyElement);
}

document.addEventListener("keydown", handleKeyboardDown);
document.addEventListener("keyup", handleKeyboardUp);

volumeSlider?.addEventListener("input", () => {
    masterVolume = Number(volumeSlider.value);
    if (masterVolumeSlider) masterVolumeSlider.value = masterVolume;
    updateVolume();
    markUnsaved();
});

masterVolumeSlider?.addEventListener("input", () => {
    masterVolume = Number(masterVolumeSlider.value);
    if (volumeSlider) volumeSlider.value = masterVolume;
    updateVolume();
    markUnsaved();
});

masterMuteButton?.addEventListener("click", toggleMasterMute);

waveformSelect?.addEventListener("change", () => {
    updateWaveform();
    waveformSelect.blur();
    markUnsaved();
});

sustainSlider?.addEventListener("input", () => {
    updateSustain();
    markUnsaved();
});

chordModeSelect?.addEventListener("change", () => {
    updateChordMode();
    markUnsaved();
});

octaveDown?.addEventListener("click", () => {
    changeOctave(-1);
    markUnsaved();
});

octaveUp?.addEventListener("click", () => {
    changeOctave(1);
    markUnsaved();
});

recordButton?.addEventListener("click", toggleRecording);
clearButton?.addEventListener("click", clearRecording);

playButton?.addEventListener("click", () => {
    isPlaying ? stopRecordingPlayback() : playRecording();
});

playRecordingButton?.addEventListener("click", () => {
    isPlaying ? stopRecordingPlayback() : playRecording();
});

stopRecordingButton?.addEventListener("click", stopRecordingPlayback);

bpmInput?.addEventListener("change", () => {
    updateBpm(bpmInput.value);
    markUnsaved();
});

bpmDown?.addEventListener("click", () => {
    updateBpm(bpm - 5);
    markUnsaved();
});

bpmUp?.addEventListener("click", () => {
    updateBpm(bpm + 5);
    markUnsaved();
});

drumPlayButton?.addEventListener("click", startDrums);
drumStopButton?.addEventListener("click", stopDrums);

drumClearButton?.addEventListener("click", () => {
    clearDrums();
    renderArrangement();
    markUnsaved();
});

drumVolumeSlider?.addEventListener("input", () => {
    updateDrumVolume();
    markUnsaved();
});

swingSlider?.addEventListener("input", () => {
    updateSwing();
    markUnsaved();
});

drumRows.forEach(row => {
    row.querySelectorAll(".step").forEach(step => {
        step.addEventListener("click", () => {
            toggleDrumStep(step);
            playDrumSound(step.dataset.instrument);
            renderArrangement();
            markUnsaved();
        });
    });
});

metronomeButton?.addEventListener("click", () => {
    isMetronomeOn ? stopMetronome() : startMetronome();
});

tapTempoButton?.addEventListener("click", tapTempo);
saveButton?.addEventListener("click", saveProject);
loadButton?.addEventListener("click", loadProject);
deleteSaveButton?.addEventListener("click", deleteSavedProject);
addTrackButton?.addEventListener("click", createTrack);
projectNameInput?.addEventListener("input", markUnsaved);

instrumentSelect?.addEventListener("change", () => {
    changeSelectedTrackInstrument(instrumentSelect.value);
});

[
    synthWaveform,
    synthAttack,
    synthRelease,
    synthFilter,
    synthResonance,
    synthVolume
].forEach(control => {
    control?.addEventListener("input", markUnsaved);
});

function playOrganTest() {
    playNote(`C${octave}`, "Organ", 1, selectedTrackId);
}

renderPiano();
bindBassEvents();
updateVolume();
updateSustain();
updateDrumVolume();
updateSwing();
updateBpm(bpm);
updateRecordingDisplay();
updateMasterMuteButton();
renderTracks();
updateInstrumentSelector();
renderArrangement();

window.addEventListener("beforeunload", () => {
    stopDrums();
    stopMetronome();
    stopRecordingPlayback();

    activeInstrumentVoices.forEach((voice, key) => {
        const split = key.indexOf(":");
        stopNote(key.slice(split + 1), 0.01, key.slice(0, split));
    });
});