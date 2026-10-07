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

const chromaticNotes = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B"
];

const keyboardMap = {
    a: "C",
    w: "C#",
    s: "D",
    e: "D#",
    d: "E",
    f: "F",
    t: "F#",
    g: "G",
    y: "G#",
    h: "A",
    u: "A#",
    j: "B",
    k: "C"
};

function ensureAudio() {
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
}

function noteToMidi(note) {
    const match = note.match(/^([A-G]#?)(-?\d+)$/);

    if (!match) {
        return null;
    }

    const noteName = match[1];
    const noteOctave = Number(match[2]);
    const noteIndex = chromaticNotes.indexOf(noteName);

    if (noteIndex === -1) {
        return null;
    }

    return (noteOctave + 1) * 12 + noteIndex;
}

function midiToNote(midi) {
    const noteIndex = ((midi % 12) + 12) % 12;
    const noteOctave = Math.floor(midi / 12) - 1;

    return `${chromaticNotes[noteIndex]}${noteOctave}`;
}

function getNoteFrequency(note) {
    const midi = noteToMidi(note);

    if (midi === null) {
        return 0;
    }

    return 440 * Math.pow(2, (midi - 69) / 12);
}

function getChordNotes(rootNote, mode) {
    if (mode === "off") {
        return [rootNote];
    }

    const rootMidi = noteToMidi(rootNote);

    if (rootMidi === null) {
        return [rootNote];
    }

    let intervals = [];

    if (mode === "major") {
        intervals = [0, 4, 7];
    }

    if (mode === "minor") {
        intervals = [0, 3, 7];
    }

    if (mode === "7th") {
        intervals = [0, 4, 7, 10];
    }

    return intervals.map(interval => midiToNote(rootMidi + interval));
}

function getTrack(trackId) {
    return tracks.find(track => track.id === trackId);
}

function hasSoloTrack() {
    return tracks.some(track => track.solo);
}

function isTrackAudible(trackId) {
    const track = getTrack(trackId);

    if (!track) {
        return true;
    }

    if (masterMuted || track.muted) {
        return false;
    }

    if (hasSoloTrack() && !track.solo) {
        return false;
    }

    return true;
}

function getTrackVolume(trackId) {
    const track = getTrack(trackId);

    if (!track || !isTrackAudible(trackId)) {
        return 0;
    }

    return track.volume;
}

function getEffectiveMasterVolume() {
    return masterMuted ? 0 : masterVolume;
}

function createOscillator(frequency, type, volume, duration = null) {
    ensureAudio();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = type;

    oscillator.frequency.setValueAtTime(
        frequency,
        audioContext.currentTime
    );

    gainNode.gain.setValueAtTime(
        volume,
        audioContext.currentTime
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();

    if (duration !== null) {
        gainNode.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + duration
        );

        oscillator.stop(
            audioContext.currentTime + duration
        );
    }

    return {
        oscillator,
        gainNode
    };
}

function playNote(note, type = waveform, volume = masterVolume) {
    ensureAudio();

    if (!isTrackAudible("piano")) {
        return;
    }

    const frequency = getNoteFrequency(note);

    if (!frequency) {
        return;
    }

    if (activeNotes.has(note)) {
        stopNote(note, 0.03);
    }

    const trackVolume = getTrackVolume("piano");
    const finalVolume = Math.max(
        volume * trackVolume * getEffectiveMasterVolume(),
        0.001
    );

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = type;

    oscillator.frequency.setValueAtTime(
        frequency,
        audioContext.currentTime
    );

    gainNode.gain.setValueAtTime(
        finalVolume,
        audioContext.currentTime
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();

    activeNotes.set(note, {
        oscillator,
        gainNode
    });

    return oscillator;
}

function stopNote(note, releaseTime = sustain) {
    const active = activeNotes.get(note);

    if (!active) {
        return;
    }

    const now = audioContext.currentTime;
    const release = Math.max(releaseTime, 0.03);

    active.gainNode.gain.cancelScheduledValues(now);

    active.gainNode.gain.setValueAtTime(
        Math.max(active.gainNode.gain.value, 0.001),
        now
    );

    active.gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        now + release
    );

    try {
        active.oscillator.stop(now + release + 0.02);
    } catch (error) {
    }

    activeNotes.delete(note);
}

function playChord(rootNote) {
    const notes = getChordNotes(rootNote, chordMode);
    const chordNotes = [];

    notes.forEach(note => {
        playNote(note);
        chordNotes.push(note);
    });

    activeChords.set(rootNote, chordNotes);
}

function stopChord(rootNote) {
    const notes = activeChords.get(rootNote);

    if (!notes) {
        stopNote(rootNote);
        return;
    }

    notes.forEach(note => {
        stopNote(note);
    });

    activeChords.delete(rootNote);
}

function setKeyPressed(keyElement, pressed) {
    if (!keyElement) {
        return;
    }

    keyElement.classList.toggle("pressed", pressed);
}

function findPianoKey(note) {
    if (!pianoContainer) {
        return null;
    }

    return pianoContainer.querySelector(
        `.piano-key[data-note="${note}"]`
    );
}

function renderPiano() {
    if (!pianoContainer) {
        return;
    }

    pianoContainer.innerHTML = "";

    const whiteNotes = [
        `C${octave}`,
        `D${octave}`,
        `E${octave}`,
        `F${octave}`,
        `G${octave}`,
        `A${octave}`,
        `B${octave}`,
        `C${octave + 1}`
    ];

    const whiteKeyboardLabels = [
        "A",
        "S",
        "D",
        "F",
        "G",
        "H",
        "J",
        "K"
    ];

    whiteNotes.forEach((note, index) => {
        const key = document.createElement("button");

        key.className = "piano-key white-key";
        key.dataset.note = note;
        key.dataset.keyboard = whiteKeyboardLabels[index];

        key.innerHTML = `
            <span>${note}</span>
            <small>${whiteKeyboardLabels[index]}</small>
        `;

        pianoContainer.appendChild(key);
    });

    const blackNotes = [
        `C#${octave}`,
        `D#${octave}`,
        `F#${octave}`,
        `G#${octave}`,
        `A#${octave}`
    ];

    const blackKeyboardLabels = [
        "W",
        "E",
        "T",
        "Y",
        "U"
    ];

    const blackPositions = [
        11.25,
        23.75,
        48.75,
        61.25,
        73.75
    ];

    blackNotes.forEach((note, index) => {
        const key = document.createElement("button");

        key.className = `piano-key black-key black-${index + 1}`;
        key.dataset.note = note;
        key.dataset.keyboard = blackKeyboardLabels[index];

        key.style.left = `${blackPositions[index]}%`;

        key.innerHTML = `
            <span>${note}</span>
            <small>${blackKeyboardLabels[index]}</small>
        `;

        pianoContainer.appendChild(key);
    });

    bindPianoEvents();

    if (octaveDisplay) {
        octaveDisplay.textContent = octave;
    }
}

function getRootNoteFromKeyboardKey(key) {
    const lowerKey = key.toLowerCase();
    const noteName = keyboardMap[lowerKey];

    if (!noteName) {
        return null;
    }

    if (lowerKey === "k") {
        return `${noteName}${octave + 1}`;
    }

    return `${noteName}${octave}`;
}

function playPianoKey(note, keyElement) {
    ensureAudio();

    if (chordMode === "off") {
        playNote(note);
    } else {
        playChord(note);
    }

    setKeyPressed(keyElement, true);

    if (currentNote) {
        currentNote.textContent =
            chordMode === "off"
                ? note
                : `${note} ${chordMode}`;
    }

    recordNote(note, "piano");
}

function releasePianoKey(note, keyElement) {
    if (chordMode === "off") {
        stopNote(note);
    } else {
        stopChord(note);
    }

    setKeyPressed(keyElement, false);

    if (currentNote) {
        currentNote.textContent = "—";
    }
}

function bindPianoEvents() {
    const keys = pianoContainer.querySelectorAll(".piano-key");

    keys.forEach(key => {
        key.addEventListener("pointerdown", event => {
            event.preventDefault();

            const note = key.dataset.note;

            playPianoKey(note, key);
        });

        key.addEventListener("pointerup", event => {
            event.preventDefault();

            const note = key.dataset.note;

            releasePianoKey(note, key);
        });

        key.addEventListener("pointercancel", event => {
            event.preventDefault();

            const note = key.dataset.note;

            releasePianoKey(note, key);
        });

        key.addEventListener("pointerleave", event => {
            if (event.buttons === 1) {
                const note = key.dataset.note;

                releasePianoKey(note, key);
            }
        });
    });
}

function recordNote(note, instrument = "piano") {
    if (!isRecording) {
        return;
    }

    if (!isTrackAudible(selectedTrackId)) {
        return;
    }

    const now = performance.now();
    const elapsed = now - recordingStartTime;

    recording.push({
        note,
        instrument,
        trackId: selectedTrackId,
        time: elapsed,
        chord: instrument === "piano" ? chordMode : "off"
    });

    updateRecordingDisplay();
    renderArrangement();
}

function updateRecordingDisplay() {
    if (recordingDisplay) {
        if (recording.length === 0) {
            recordingDisplay.textContent = "No notes recorded yet.";
        } else {
            recordingDisplay.textContent = recording
                .map(item => {
                    const instrument =
                        item.instrument === "bass"
                            ? "Bass"
                            : "Piano";

                    if (item.chord && item.chord !== "off") {
                        return `${instrument}: ${item.note} (${item.chord})`;
                    }

                    return `${instrument}: ${item.note}`;
                })
                .join(" • ");
        }
    }

    if (recordingNoteCount) {
        recordingNoteCount.textContent = recording.length;
    }

    updateRecordingDuration();
}

function updateRecordingDuration() {
    if (!recordingDuration) {
        return;
    }

    if (recording.length === 0) {
        recordingDuration.textContent = "0.0s";
        return;
    }

    let duration = recording[recording.length - 1].time;

    if (isRecording) {
        duration = performance.now() - recordingStartTime;
    }

    recordingDuration.textContent =
        `${Math.max(duration / 1000, 0).toFixed(1)}s`;
}

function startRecording() {
    ensureAudio();

    stopRecordingPlayback();

    recording = [];
    recordingStartTime = performance.now();
    isRecording = true;

    if (recordButton) {
        recordButton.textContent = "Stop Recording";
        recordButton.classList.add("active");
    }

    if (recordingStatus) {
        recordingStatus.textContent =
            `Recording ${getTrack(selectedTrackId)?.name || ""}`;
    }

    updateRecordingDisplay();
    renderArrangement();

    clearInterval(recordingTimer);

    recordingTimer = setInterval(() => {
        updateRecordingDuration();
    }, 100);
}

function stopRecording() {
    if (!isRecording) {
        return;
    }

    updateRecordingDuration();

    isRecording = false;

    clearInterval(recordingTimer);
    recordingTimer = null;

    if (recordButton) {
        recordButton.textContent = "Record";
        recordButton.classList.remove("active");
    }

    if (recordingStatus) {
        recordingStatus.textContent =
            recording.length > 0
                ? "Recording saved"
                : "Ready";
    }

    updateRecordingDisplay();
    renderArrangement();
    markUnsaved();
}

function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function clearRecording() {
    stopRecordingPlayback();

    recording = [];

    if (recordingStatus) {
        recordingStatus.textContent = "Ready";
    }

    updateRecordingDisplay();
    renderArrangement();
    markUnsaved();
}

function playRecording() {
    if (recording.length === 0) {
        if (recordingStatus) {
            recordingStatus.textContent = "Nothing to play";
        }

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

    if (recordingStatus) {
        recordingStatus.textContent = "Playing recording";
    }

    scheduleNextRecordingNote();
}

function scheduleNextRecordingNote() {
    if (!isPlaying || playbackIndex >= recording.length) {
        stopRecordingPlayback();
        return;
    }

    const noteData = recording[playbackIndex];

    const currentElapsed =
        performance.now() - playbackStartTime;

    const delay = Math.max(
        0,
        noteData.time - currentElapsed
    );

    playbackTimer = setTimeout(() => {
        if (!isPlaying) {
            return;
        }

        const note = noteData.note;
        const storedChord = noteData.chord || "off";
        const instrument = noteData.instrument || "piano";

        if (instrument === "bass") {
            if (isTrackAudible(noteData.trackId || "bass")) {
                playBassNote(note);
                setTimeout(() => {
                    stopBassNote(note);
                }, Math.max(100, sustain * 500));
            }
        } else {
            const notes = getChordNotes(
                note,
                storedChord
            );

            notes.forEach(chordNote => {
                playNote(chordNote);
            });

            setTimeout(() => {
                notes.forEach(chordNote => {
                    stopNote(chordNote, 0.12);
                });
            }, Math.max(100, sustain * 500));
        }

        playbackIndex++;

        if (timelinePosition) {
            timelinePosition.textContent =
                `${(noteData.time / 1000).toFixed(1)}s`;
        }

        scheduleNextRecordingNote();
    }, delay);
}

function stopRecordingPlayback() {
    isPlaying = false;

    clearTimeout(playbackTimer);
    playbackTimer = null;

    activeNotes.forEach((_, note) => {
        stopNote(note, 0.05);
    });

    activeBassNotes.forEach((_, note) => {
        stopBassNote(note);
    });

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
        recordingStatus.textContent =
            recording.length > 0
                ? "Recording saved"
                : "Ready";
    }
}

function updateVolume() {
    if (!volumeSlider) {
        return;
    }

    masterVolume = Number(volumeSlider.value);

    if (volumeDisplay) {
        volumeDisplay.textContent =
            `${Math.round(masterVolume * 100)}%`;
    }

    updateMasterVolumeDisplay();
}

function updateMasterVolumeDisplay() {
    if (masterVolumeDisplay) {
        masterVolumeDisplay.textContent =
            `${Math.round(masterVolume * 100)}%`;
    }
}

function updateWaveform() {
    if (!waveformSelect) {
        return;
    }

    waveform = waveformSelect.value;
}

function updateSustain() {
    if (!sustainSlider) {
        return;
    }

    sustain = Number(sustainSlider.value);

    if (sustainDisplay) {
        sustainDisplay.textContent =
            `${sustain.toFixed(1)}s`;
    }
}

function updateChordMode() {
    if (!chordModeSelect) {
        return;
    }

    chordMode = chordModeSelect.value;

    activeChords.forEach((_, rootNote) => {
        stopChord(rootNote);
    });
}

function changeOctave(amount) {
    const newOctave = Math.max(
        2,
        Math.min(5, octave + amount)
    );

    if (newOctave === octave) {
        return;
    }

    activeNotes.forEach((_, note) => {
        stopNote(note, 0.03);
    });

    octave = newOctave;

    renderPiano();
}

function updateBpm(value) {
    let newBpm = Number(value);

    if (!Number.isFinite(newBpm)) {
        newBpm = bpm;
    }

    newBpm = Math.round(
        Math.max(
            MIN_BPM,
            Math.min(MAX_BPM, newBpm)
        )
    );

    bpm = newBpm;

    if (bpmInput) {
        bpmInput.value = bpm;
    }

    if (bpmDisplay) {
        bpmDisplay.textContent = `${bpm} BPM`;
    }

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
    const baseLength = getDrumStepLength();

    if (swing <= 0) {
        return baseLength;
    }

    if (step % 2 === 0) {
        return baseLength * (1 + swing);
    }

    return baseLength * (1 - swing);
}

function playKick() {
    ensureAudio();

    if (!isTrackAudible("drums")) {
        return;
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(
        150,
        audioContext.currentTime
    );

    oscillator.frequency.exponentialRampToValueAtTime(
        45,
        audioContext.currentTime + 0.18
    );

    const finalVolume =
        drumVolume *
        getTrackVolume("drums") *
        getEffectiveMasterVolume();

    gain.gain.setValueAtTime(
        Math.max(finalVolume, 0.001),
        audioContext.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.18
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();

    oscillator.stop(
        audioContext.currentTime + 0.2
    );
}

function playSnare() {
    ensureAudio();

    if (!isTrackAudible("drums")) {
        return;
    }

    const noiseBuffer = audioContext.createBuffer(
        1,
        Math.floor(audioContext.sampleRate * 0.2),
        audioContext.sampleRate
    );

    const data = noiseBuffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = audioContext.createBufferSource();
    const noiseFilter = audioContext.createBiquadFilter();
    const noiseGain = audioContext.createGain();

    noise.buffer = noiseBuffer;

    noiseFilter.type = "highpass";
    noiseFilter.frequency.value = 1200;

    const finalVolume =
        drumVolume *
        0.8 *
        getTrackVolume("drums") *
        getEffectiveMasterVolume();

    noiseGain.gain.setValueAtTime(
        Math.max(finalVolume, 0.001),
        audioContext.currentTime
    );

    noiseGain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.2
    );

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioContext.destination);

    noise.start();
}

function playHiHat() {
    ensureAudio();

    if (!isTrackAudible("drums")) {
        return;
    }

    const noiseBuffer = audioContext.createBuffer(
        1,
        Math.floor(audioContext.sampleRate * 0.08),
        audioContext.sampleRate
    );

    const data = noiseBuffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();

    noise.buffer = noiseBuffer;

    filter.type = "highpass";
    filter.frequency.value = 5000;

    const finalVolume =
        drumVolume *
        0.5 *
        getTrackVolume("drums") *
        getEffectiveMasterVolume();

    gain.gain.setValueAtTime(
        Math.max(finalVolume, 0.001),
        audioContext.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.08
    );

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);

    noise.start();
}

function playDrumSound(type) {
    ensureAudio();

    switch (type) {
        case "kick":
            playKick();
            break;

        case "snare":
            playSnare();
            break;

        case "hihat":
            playHiHat();
            break;
    }
}

function getDrumInstrument(row) {
    const firstStep = row.querySelector(".step");

    if (!firstStep) {
        return null;
    }

    return firstStep.dataset.instrument || null;
}

function playDrumStep() {
    const currentStep = drumStep + 1;

    drumRows.forEach(row => {
        const activeStep = row.querySelector(
            `.step[data-step="${currentStep}"]`
        );

        row.querySelectorAll(".step").forEach(step => {
            step.classList.remove("playing");
        });

        if (!activeStep) {
            return;
        }

        activeStep.classList.add("playing");

        if (activeStep.classList.contains("active")) {
            playDrumSound(
                activeStep.dataset.instrument
            );
        }
    });

    updateBeatIndicators();
}

function scheduleNextDrumStep() {
    if (!isDrumPlaying) {
        return;
    }

    playDrumStep();

    const delay = getDrumStepDelay(drumStep);

    drumStep =
        (drumStep + 1) % DRUM_STEPS;

    drumTimer = setTimeout(
        scheduleNextDrumStep,
        delay
    );
}

function startDrums() {
    ensureAudio();

    if (isDrumPlaying) {
        return;
    }

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
        row.querySelectorAll(".step").forEach(step => {
            step.classList.remove("playing");
        });
    });

    if (drumPlayButton) {
        drumPlayButton.textContent = "Play";
        drumPlayButton.classList.remove("active");
    }
}

function clearDrums() {
    drumRows.forEach(row => {
        row.querySelectorAll(".step").forEach(step => {
            step.classList.remove("active");
            step.classList.remove("playing");
        });
    });
}

function updateDrumVolume() {
    if (!drumVolumeSlider) {
        return;
    }

    drumVolume = Number(drumVolumeSlider.value);

    if (drumVolumeDisplay) {
        drumVolumeDisplay.textContent =
            `${Math.round(drumVolume * 100)}%`;
    }
}

function updateSwing() {
    if (!swingSlider) {
        return;
    }

    swing = Number(swingSlider.value) / 100;

    if (swingDisplay) {
        swingDisplay.textContent =
            `${Math.round(swing * 100)}%`;
    }
}

function toggleDrumStep(stepElement) {
    stepElement.classList.toggle("active");
}

function setDrumPattern(pattern) {
    const rows = {
        kick: pattern.kick || [],
        snare: pattern.snare || [],
        hihat: pattern.hihat || []
    };

    drumRows.forEach(row => {
        const type = getDrumInstrument(row);

        if (!type) {
            return;
        }

        const activeSteps = rows[type] || [];

        row.querySelectorAll(".step").forEach(
            (step, index) => {
                step.classList.toggle(
                    "active",
                    activeSteps.includes(index + 1)
                );
            }
        );
    });
}

function getDrumPattern() {
    const pattern = {
        kick: [],
        snare: [],
        hihat: []
    };

    drumRows.forEach(row => {
        const type = getDrumInstrument(row);

        if (!type || !pattern[type]) {
            return;
        }

        row.querySelectorAll(".step").forEach(
            (step, index) => {
                if (step.classList.contains("active")) {
                    pattern[type].push(index + 1);
                }
            }
        );
    });

    return pattern;
}

function updateBeatIndicators() {
    const indicators =
        document.querySelectorAll(".beat");

    indicators.forEach((indicator, index) => {
        indicator.classList.toggle(
            "active",
            index === drumStep % 4
        );
    });
}

function playMetronomeClick() {
    ensureAudio();

    if (masterMuted) {
        return;
    }

    const oscillator =
        audioContext.createOscillator();

    const gainNode =
        audioContext.createGain();

    oscillator.type = "square";

    const accent = metronomeBeat === 0;

    oscillator.frequency.setValueAtTime(
        accent ? 1200 : 800,
        audioContext.currentTime
    );

    gainNode.gain.setValueAtTime(
        (accent ? 0.2 : 0.1) * getEffectiveMasterVolume(),
        audioContext.currentTime
    );

    gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.05
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();

    oscillator.stop(
        audioContext.currentTime + 0.06
    );

    metronomeBeat =
        (metronomeBeat + 1) % 4;

    updateBeatIndicators();
}

function startMetronome() {
    if (isMetronomeOn) {
        return;
    }

    ensureAudio();

    isMetronomeOn = true;
    metronomeBeat = 0;

    if (metronomeButton) {
        metronomeButton.textContent =
            "Metronome On";

        metronomeButton.classList.add("active");
    }

    playMetronomeClick();

    const interval =
        (60 / bpm) * 1000;

    metronomeTimer = setInterval(
        playMetronomeClick,
        interval
    );
}

function stopMetronome() {
    isMetronomeOn = false;

    clearInterval(metronomeTimer);
    metronomeTimer = null;

    if (metronomeButton) {
        metronomeButton.textContent =
            "Metronome: Off";

        metronomeButton.classList.remove("active");
    }
}

function tapTempo() {
    const now = performance.now();

    if (
        tapTimes.length > 0 &&
        now - tapTimes[tapTimes.length - 1] > 2000
    ) {
        tapTimes = [];
    }

    tapTimes.push(now);

    if (tapTimes.length > 6) {
        tapTimes.shift();
    }

    clearTimeout(tapResetTimer);

    tapResetTimer = setTimeout(() => {
        tapTimes = [];

        if (tapTempoDisplay) {
            tapTempoDisplay.textContent = "0 taps";
        }
    }, 2000);

    if (tapTimes.length >= 2) {
        let total = 0;

        for (let i = 1; i < tapTimes.length; i++) {
            total +=
                tapTimes[i] - tapTimes[i - 1];
        }

        const average =
            total / (tapTimes.length - 1);

        const calculatedBpm =
            60000 / average;

        updateBpm(calculatedBpm);

        if (tapTempoDisplay) {
            tapTempoDisplay.textContent =
                `${Math.round(bpm)} BPM`;
        }
    } else if (tapTempoDisplay) {
        tapTempoDisplay.textContent =
            "Tap again";
    }
}

function playBassNote(note, keyElement = null) {
    ensureAudio();

    if (!isTrackAudible("bass")) {
        return;
    }

    const frequency =
        getNoteFrequency(note);

    if (!frequency) {
        return;
    }

    if (activeBassNotes.has(note)) {
        stopBassNote(
            note,
            keyElement
        );
    }

    const oscillator =
        audioContext.createOscillator();

    const gainNode =
        audioContext.createGain();

    oscillator.type = "sawtooth";

    oscillator.frequency.setValueAtTime(
        frequency,
        audioContext.currentTime
    );

    const finalVolume =
        masterVolume *
        0.45 *
        getTrackVolume("bass") *
        getEffectiveMasterVolume();

    gainNode.gain.setValueAtTime(
        Math.max(finalVolume, 0.001),
        audioContext.currentTime
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();

    activeBassNotes.set(note, {
        oscillator,
        gainNode
    });

    if (keyElement) {
        keyElement.classList.add("pressed");
    }

    if (currentBassNote) {
        currentBassNote.textContent = note;
    }

    if (isRecording && keyElement) {
        recordNote(note, "bass");
    }
}

function stopBassNote(note, keyElement = null) {
    const active =
        activeBassNotes.get(note);

    if (active) {
        const now =
            audioContext.currentTime;

        active.gainNode.gain.cancelScheduledValues(now);

        active.gainNode.gain.setValueAtTime(
            Math.max(
                active.gainNode.gain.value,
                0.001
            ),
            now
        );

        active.gainNode.gain.exponentialRampToValueAtTime(
            0.001,
            now + 0.15
        );

        try {
            active.oscillator.stop(
                now + 0.17
            );
        } catch (error) {
        }

        activeBassNotes.delete(note);
    }

    if (keyElement) {
        keyElement.classList.remove("pressed");
    }

    if (currentBassNote) {
        currentBassNote.textContent = "—";
    }
}

function bindBassEvents() {
    const bassKeys =
        document.querySelectorAll(".bass-key");

    bassKeys.forEach(key => {
        const note = key.dataset.note;

        if (!note) {
            return;
        }

        key.addEventListener(
            "pointerdown",
            event => {
                event.preventDefault();

                playBassNote(
                    note,
                    key
                );
            }
        );

        key.addEventListener(
            "pointerup",
            event => {
                event.preventDefault();

                stopBassNote(
                    note,
                    key
                );
            }
        );

        key.addEventListener(
            "pointercancel",
            event => {
                event.preventDefault();

                stopBassNote(
                    note,
                    key
                );
            }
        );

        key.addEventListener(
            "pointerleave",
            event => {
                if (event.buttons === 1) {
                    stopBassNote(
                        note,
                        key
                    );
                }
            }
        );
    });
}

function createTrack() {
    const number =
        tracks.length + 1;

    const id =
        `track-${Date.now()}`;

    tracks.push({
        id,
        name: `Track ${number}`,
        instrument: "Piano",
        volume: 1,
        muted: false,
        solo: false,
        colour:
            trackColours[
                tracks.length % trackColours.length
            ]
    });

    selectedTrackId = id;

    renderTracks();
    renderArrangement();
    markUnsaved();
}

function renameTrack(trackId) {
    const track = getTrack(trackId);

    if (!track) {
        return;
    }

    const newName =
        prompt("Track name:", track.name);

    if (!newName) {
        return;
    }

    track.name =
        newName.trim().slice(0, 30) ||
        track.name;

    renderTracks();
    renderArrangement();
    markUnsaved();
}

function deleteTrack(trackId) {
    if (
        trackId === "piano" ||
        trackId === "bass" ||
        trackId === "drums"
    ) {
        if (tracks.length <= 3) {
            alert("The main Groove tracks cannot all be removed.");
            return;
        }
    }

    const index =
        tracks.findIndex(
            track => track.id === trackId
        );

    if (index === -1) {
        return;
    }

    const track =
        tracks[index];

    if (
        !confirm(
            `Delete "${track.name}"?`
        )
    ) {
        return;
    }

    tracks.splice(index, 1);

    recording =
        recording.filter(
            item => item.trackId !== trackId
        );

    if (selectedTrackId === trackId) {
        selectedTrackId =
            tracks[0]?.id || null;
    }

    renderTracks();
    renderArrangement();
    updateRecordingDisplay();
    markUnsaved();
}

function selectTrack(trackId) {
    if (!getTrack(trackId)) {
        return;
    }

    selectedTrackId = trackId;

    const track =
        getTrack(trackId);

    if (selectedTrackDisplay) {
        selectedTrackDisplay.textContent =
            `${track.name} selected`;
    }

    renderTracks();
    renderArrangement();
}

function toggleTrackMute(trackId) {
    const track =
        getTrack(trackId);

    if (!track) {
        return;
    }

    track.muted =
        !track.muted;

    renderTracks();
    markUnsaved();
}

function toggleTrackSolo(trackId) {
    const track =
        getTrack(trackId);

    if (!track) {
        return;
    }

    track.solo =
        !track.solo;

    renderTracks();
    markUnsaved();
}

function updateTrackVolume(trackId, value) {
    const track =
        getTrack(trackId);

    if (!track) {
        return;
    }

    track.volume =
        Number(value);

    markUnsaved();
}

function cycleTrackColour(trackId) {
    const track =
        getTrack(trackId);

    if (!track) {
        return;
    }

    const currentIndex =
        trackColours.indexOf(track.colour);

    const nextIndex =
        currentIndex === -1
            ? 0
            : (currentIndex + 1) % trackColours.length;

    track.colour =
        trackColours[nextIndex];

    renderTracks();
    renderArrangement();
    markUnsaved();
}

function renderTracks() {
    if (!trackList) {
        return;
    }

    trackList.innerHTML = "";

    tracks.forEach((track, index) => {
        const item =
            document.createElement("div");

        item.className =
            "track-item";

        if (track.id === selectedTrackId) {
            item.classList.add("selected");
        }

        if (track.muted) {
            item.classList.add("muted");
        }

        if (track.solo) {
            item.classList.add("solo");
        }

        item.addEventListener(
            "click",
            () => selectTrack(track.id)
        );

        const top =
            document.createElement("div");

        top.className =
            "track-top";

        const number =
            document.createElement("span");

        number.className =
            "track-number";

        number.textContent =
            String(index + 1).padStart(2, "0");

        const colour =
            document.createElement("span");

        colour.className =
            "track-colour";

        colour.style.background =
            track.colour;

        colour.title =
            "Change track colour";

        colour.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                cycleTrackColour(
                    track.id
                );
            }
        );

        const name =
            document.createElement("div");

        name.className =
            "track-name";

        name.innerHTML = `
            <strong>${escapeHtml(track.name)}</strong>
            <span>${escapeHtml(track.instrument)}</span>
        `;

        name.addEventListener(
            "dblclick",
            event => {
                event.stopPropagation();

                renameTrack(
                    track.id
                );
            }
        );

        top.appendChild(number);
        top.appendChild(colour);
        top.appendChild(name);

        const volume =
            document.createElement("input");

        volume.type = "range";
        volume.className = "track-volume";
        volume.min = "0";
        volume.max = "1";
        volume.step = "0.01";
        volume.value = track.volume;

        volume.addEventListener(
            "click",
            event => {
                event.stopPropagation();
            }
        );

        volume.addEventListener(
            "input",
            event => {
                updateTrackVolume(
                    track.id,
                    event.target.value
                );
            }
        );

        const actions =
            document.createElement("div");

        actions.className =
            "track-actions";

        const rename =
            document.createElement("button");

        rename.textContent =
            "Rename";

        rename.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                renameTrack(
                    track.id
                );
            }
        );

        const mute =
            document.createElement("button");

        mute.textContent =
            track.muted
                ? "Unmute"
                : "Mute";

        mute.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                toggleTrackMute(
                    track.id
                );
            }
        );

        const solo =
            document.createElement("button");

        solo.textContent =
            track.solo
                ? "Unsolo"
                : "Solo";

        solo.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                toggleTrackSolo(
                    track.id
                );
            }
        );

        const deleteButton =
            document.createElement("button");

        deleteButton.textContent =
            "Delete";

        deleteButton.className =
            "delete-track";

        deleteButton.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                deleteTrack(
                    track.id
                );
            }
        );

        actions.appendChild(rename);
        actions.appendChild(mute);
        actions.appendChild(solo);
        actions.appendChild(deleteButton);

        item.appendChild(top);
        item.appendChild(volume);
        item.appendChild(actions);

        trackList.appendChild(item);
    });

    const selected =
        getTrack(selectedTrackId);

    if (selected && selectedTrackDisplay) {
        selectedTrackDisplay.textContent =
            `${selected.name} selected`;
    }
}

function renderArrangement() {
    if (!arrangementTracks) {
        return;
    }

    arrangementTracks.innerHTML = "";

    tracks.forEach(track => {
        const row =
            document.createElement("div");

        row.className =
            "arrangement-row";

        const name =
            document.createElement("div");

        name.className =
            "arrangement-track-name";

        name.innerHTML = `
            <span
                class="track-colour"
                style="background:${track.colour}"
            ></span>
            <span>${escapeHtml(track.name)}</span>
        `;

        const lane =
            document.createElement("div");

        lane.className =
            "arrangement-lane";

        if (track.id === selectedTrackId) {
            lane.classList.add("selected");
        }

        lane.addEventListener(
            "click",
            () => selectTrack(track.id)
        );

        const trackRecording =
            recording.filter(
                item =>
                    (item.trackId || "piano") === track.id
            );

        if (trackRecording.length > 0) {
            const lastNote =
                trackRecording[
                    trackRecording.length - 1
                ];

            const firstNote =
                trackRecording[0];

            const duration =
                Math.max(
                    1000,
                    lastNote.time - firstNote.time + 1000
                );

            const totalTimeline =
                Math.max(
                    duration,
                    16000
                );

            const left =
                (firstNote.time / totalTimeline) * 100;

            const width =
                Math.max(
                    4,
                    (duration / totalTimeline) * 100
                );

            const clip =
                document.createElement("div");

            clip.className =
                "clip recording-clip";

            clip.style.left =
                `${Math.min(left, 95)}%`;

            clip.style.width =
                `${Math.min(width, 100 - left)}%`;

            clip.style.background =
                track.colour;

            clip.textContent =
                `${track.name} Recording`;

            lane.appendChild(clip);
        }

        if (track.id === "drums") {
            const pattern =
                getDrumPattern();

            const activeCount =
                pattern.kick.length +
                pattern.snare.length +
                pattern.hihat.length;

            if (activeCount > 0) {
                const clip =
                    document.createElement("div");

                clip.className =
                    "clip";

                clip.style.left =
                    "0%";

                clip.style.width =
                    "100%";

                clip.style.background =
                    track.colour;

                clip.textContent =
                    `${activeCount} drum steps`;

                lane.appendChild(clip);
            }
        }

        row.appendChild(name);
        row.appendChild(lane);

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
        version: "1.8",
        projectName:
            projectNameInput?.value ||
            "Untitled Groove",
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
    if (saveStatus) {
        saveStatus.textContent =
            "Unsaved changes";
    }
}

function saveProject() {
    const data =
        getSaveData();

    localStorage.setItem(
        "grooveProject",
        JSON.stringify(data)
    );

    if (saveStatus) {
        saveStatus.textContent =
            "Project saved";
    }
}

function loadProject() {
    const saved =
        localStorage.getItem(
            "grooveProject"
        );

    if (!saved) {
        if (saveStatus) {
            saveStatus.textContent =
                "No saved project";
        }

        return;
    }

    try {
        const data =
            JSON.parse(saved);

        if (data.projectName && projectNameInput) {
            projectNameInput.value =
                data.projectName;
        }

        if (data.bpm !== undefined) {
            updateBpm(data.bpm);
        }

        if (data.octave !== undefined) {
            octave = Math.max(
                2,
                Math.min(
                    5,
                    Number(data.octave)
                )
            );

            renderPiano();
        }

        if (data.masterVolume !== undefined) {
            masterVolume =
                Number(data.masterVolume);

            if (masterVolumeSlider) {
                masterVolumeSlider.value =
                    masterVolume;
            }

            if (volumeSlider) {
                volumeSlider.value =
                    masterVolume;
            }

            updateVolume();
        }

        if (data.masterMuted !== undefined) {
            masterMuted =
                Boolean(data.masterMuted);

            updateMasterMuteButton();
        }

        if (data.drumVolume !== undefined) {
            drumVolume =
                Number(data.drumVolume);

            if (drumVolumeSlider) {
                drumVolumeSlider.value =
                    drumVolume;
            }

            updateDrumVolume();
        }

        if (data.waveform !== undefined) {
            waveform =
                data.waveform;

            if (waveformSelect) {
                waveformSelect.value =
                    waveform;
            }
        }

        if (data.sustain !== undefined) {
            sustain =
                Number(data.sustain);

            if (sustainSlider) {
                sustainSlider.value =
                    sustain;
            }

            updateSustain();
        }

        if (data.swing !== undefined) {
            swing =
                Number(data.swing);

            if (swingSlider) {
                swingSlider.value =
                    swing * 100;
            }

            updateSwing();
        }

        if (data.chordMode !== undefined) {
            chordMode =
                data.chordMode;

            if (chordModeSelect) {
                chordModeSelect.value =
                    chordMode;
            }
        }

        recording =
            Array.isArray(data.recording)
                ? data.recording
                : [];

        if (
            Array.isArray(data.tracks) &&
            data.tracks.length > 0
        ) {
            tracks =
                data.tracks;
        }

        if (
            data.selectedTrackId &&
            getTrack(data.selectedTrackId)
        ) {
            selectedTrackId =
                data.selectedTrackId;
        }

        if (data.drumPattern) {
            setDrumPattern(
                data.drumPattern
            );
        }

        renderTracks();
        renderArrangement();
        updateRecordingDisplay();

        if (saveStatus) {
            saveStatus.textContent =
                "Project loaded";
        }
    } catch (error) {
        console.error(error);

        if (saveStatus) {
            saveStatus.textContent =
                "Could not load project";
        }
    }
}

function deleteSavedProject() {
    localStorage.removeItem(
        "grooveProject"
    );

    if (saveStatus) {
        saveStatus.textContent =
            "Saved project deleted";
    }
}

function updateMasterMuteButton() {
    if (!masterMuteButton) {
        return;
    }

    masterMuteButton.textContent =
        masterMuted
            ? "Master Muted"
            : "Master Mute";

    masterMuteButton.classList.toggle(
        "active",
        masterMuted
    );
}

function toggleMasterMute() {
    masterMuted =
        !masterMuted;

    updateMasterMuteButton();
    markUnsaved();
}

function handleKeyboardDown(event) {
    const key = event.key.toLowerCase();

    if (event.repeat) {
        return;
    }

    const activeElement = document.activeElement;

    if (
        activeElement &&
        (
            activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA"
        )
    ) {
        return;
    }

    if (key === " ") {
        event.preventDefault();

        if (isPlaying) {
            stopRecordingPlayback();
        } else {
            playRecording();
        }

        return;
    }

    if (key === "r") {
        toggleRecording();
        return;
    }

    if (key === "m") {
        if (isMetronomeOn) {
            stopMetronome();
        } else {
            startMetronome();
        }
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

    if (!note) {
        return;
    }

    const pianoKey = findPianoKey(note);

    if (!pianoKey) {
        return;
    }

    event.preventDefault();

    playPianoKey(note, pianoKey);

    pianoKey.dataset.keyboardPressed = "true";
}

function handleKeyboardUp(event) {
    const key =
        event.key.toLowerCase();

    const note =
        getRootNoteFromKeyboardKey(key);

    if (!note) {
        return;
    }

    const pianoKey =
        findPianoKey(note);

    if (!pianoKey) {
        return;
    }

    releasePianoKey(
        note,
        pianoKey
    );

    delete pianoKey.dataset.keyboardPressed;
}

document.addEventListener(
    "keydown",
    handleKeyboardDown
);

document.addEventListener(
    "keyup",
    handleKeyboardUp
);

if (volumeSlider) {
    volumeSlider.addEventListener(
        "input",
        () => {
            masterVolume =
                Number(volumeSlider.value);

            updateVolume();

            if (masterVolumeSlider) {
                masterVolumeSlider.value =
                    masterVolume;
            }

            markUnsaved();
        }
    );
}

if (masterVolumeSlider) {
    masterVolumeSlider.addEventListener(
        "input",
        () => {
            masterVolume =
                Number(masterVolumeSlider.value);

            updateMasterVolumeDisplay();

            if (volumeSlider) {
                volumeSlider.value =
                    masterVolume;
            }

            updateVolume();
            markUnsaved();
        }
    );
}

if (masterMuteButton) {
    masterMuteButton.addEventListener(
        "click",
        toggleMasterMute
    );
}

if (waveformSelect) {
    waveformSelect.addEventListener(
        "change",
        () => {
            updateWaveform();
            markUnsaved();
        }
    );
}

if (sustainSlider) {
    sustainSlider.addEventListener(
        "input",
        () => {
            updateSustain();
            markUnsaved();
        }
    );
}

if (chordModeSelect) {
    chordModeSelect.addEventListener(
        "change",
        () => {
            updateChordMode();
            markUnsaved();
        }
    );
}

if (octaveDown) {
    octaveDown.addEventListener(
        "click",
        () => {
            changeOctave(-1);
            markUnsaved();
        }
    );
}

if (octaveUp) {
    octaveUp.addEventListener(
        "click",
        () => {
            changeOctave(1);
            markUnsaved();
        }
    );
}

if (recordButton) {
    recordButton.addEventListener(
        "click",
        toggleRecording
    );
}

if (clearButton) {
    clearButton.addEventListener(
        "click",
        clearRecording
    );
}

if (playButton) {
    playButton.addEventListener(
        "click",
        () => {
            if (isPlaying) {
                stopRecordingPlayback();
            } else {
                playRecording();
            }
        }
    );
}

if (playRecordingButton) {
    playRecordingButton.addEventListener(
        "click",
        () => {
            if (isPlaying) {
                stopRecordingPlayback();
            } else {
                playRecording();
            }
        }
    );
}

if (stopRecordingButton) {
    stopRecordingButton.addEventListener(
        "click",
        stopRecordingPlayback
    );
}

if (bpmInput) {
    bpmInput.addEventListener(
        "change",
        () => {
            updateBpm(
                bpmInput.value
            );

            markUnsaved();
        }
    );
}

if (bpmDown) {
    bpmDown.addEventListener(
        "click",
        () => {
            updateBpm(
                bpm - 5
            );

            markUnsaved();
        }
    );
}

if (bpmUp) {
    bpmUp.addEventListener(
        "click",
        () => {
            updateBpm(
                bpm + 5
            );

            markUnsaved();
        }
    );
}

if (drumPlayButton) {
    drumPlayButton.addEventListener(
        "click",
        startDrums
    );
}

if (drumStopButton) {
    drumStopButton.addEventListener(
        "click",
        stopDrums
    );
}

if (drumClearButton) {
    drumClearButton.addEventListener(
        "click",
        () => {
            clearDrums();
            renderArrangement();
            markUnsaved();
        }
    );
}

if (drumVolumeSlider) {
    drumVolumeSlider.addEventListener(
        "input",
        () => {
            updateDrumVolume();
            markUnsaved();
        }
    );
}

if (swingSlider) {
    swingSlider.addEventListener(
        "input",
        () => {
            updateSwing();
            markUnsaved();
        }
    );
}

drumRows.forEach(row => {
    row.querySelectorAll(".step").forEach(
        step => {
            step.addEventListener(
                "click",
                () => {
                    toggleDrumStep(step);

                    playDrumSound(
                        step.dataset.instrument
                    );

                    renderArrangement();
                    markUnsaved();
                }
            );
        }
    );
});

if (metronomeButton) {
    metronomeButton.addEventListener(
        "click",
        () => {
            if (isMetronomeOn) {
                stopMetronome();
            } else {
                startMetronome();
            }
        }
    );
}

if (tapTempoButton) {
    tapTempoButton.addEventListener(
        "click",
        tapTempo
    );
}

if (saveButton) {
    saveButton.addEventListener(
        "click",
        saveProject
    );
}

if (loadButton) {
    loadButton.addEventListener(
        "click",
        loadProject
    );
}

if (deleteSaveButton) {
    deleteSaveButton.addEventListener(
        "click",
        deleteSavedProject
    );
}

if (addTrackButton) {
    addTrackButton.addEventListener(
        "click",
        createTrack
    );
}

if (projectNameInput) {
    projectNameInput.addEventListener(
        "input",
        markUnsaved
    );
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
renderArrangement();

window.addEventListener(
    "beforeunload",
    () => {
        stopDrums();
        stopMetronome();
        stopRecordingPlayback();

        activeNotes.forEach(
            (_, note) => {
                stopNote(
                    note,
                    0.01
                );
            }
        );

        activeBassNotes.forEach(
            (_, note) => {
                stopBassNote(note);
            }
        );
    }
);


















