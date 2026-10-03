const audioContext =
    new (window.AudioContext || window.webkitAudioContext)();

let volume = 0.35;
let waveform = "sine";
let octave = 4;
let sustain = 0.7;

let isRecording = false;
let isPlaying = false;

let recording = [];
let recordingStartTime = 0;
let playbackTimeouts = [];

const activeNotes = new Map();

const baseFrequencies = {
    C: 261.63,
    "C#": 277.18,
    D: 293.66,
    "D#": 311.13,
    E: 329.63,
    F: 349.23,
    "F#": 369.99,
    G: 392.00,
    "G#": 415.30,
    A: 440.00,
    "A#": 466.16,
    B: 493.88
};

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
    j: "B"
};

const whiteNotes = [
    "C",
    "D",
    "E",
    "F",
    "G",
    "A",
    "B",
    "C"
];

const blackNotes = [
    "C#",
    "D#",
    "F#",
    "G#",
    "A#"
];

function getFrequency(note) {
    const name = note.replace(/[0-9]/g, "");
    const noteOctave = parseInt(note.match(/[0-9]+/)[0]);

    const base = baseFrequencies[name];

    return base * Math.pow(2, noteOctave - 4);
}

function createSound(note) {
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    const secondOscillator = audioContext.createOscillator();
    const secondGain = audioContext.createGain();

    const frequency = getFrequency(note);

    oscillator.type = waveform;
    oscillator.frequency.value = frequency;

    secondOscillator.type = waveform;
    secondOscillator.frequency.value = frequency * 2;

    gain.gain.setValueAtTime(
        0.001,
        audioContext.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
        volume,
        audioContext.currentTime + 0.02
    );

    secondGain.gain.setValueAtTime(
        0.001,
        audioContext.currentTime
    );

    secondGain.gain.exponentialRampToValueAtTime(
        volume * 0.08,
        audioContext.currentTime + 0.02
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    secondOscillator.connect(secondGain);
    secondGain.connect(audioContext.destination);

    oscillator.start();
    secondOscillator.start();

    activeNotes.set(note, {
        oscillator,
        gain,
        secondOscillator,
        secondGain
    });

    updateNoteDisplay(note);
}

function releaseSound(note) {
    const sound = activeNotes.get(note);

    if (!sound) return;

    const now = audioContext.currentTime;

    sound.gain.gain.cancelScheduledValues(now);

    sound.gain.gain.setValueAtTime(
        sound.gain.gain.value,
        now
    );

    sound.gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + sustain
    );

    sound.secondGain.gain.cancelScheduledValues(now);

    sound.secondGain.gain.setValueAtTime(
        sound.secondGain.gain.value,
        now
    );

    sound.secondGain.gain.exponentialRampToValueAtTime(
        0.001,
        now + sustain
    );

    sound.oscillator.stop(now + sustain);
    sound.secondOscillator.stop(now + sustain);

    activeNotes.delete(note);

    setTimeout(() => {
        if (activeNotes.size === 0) {
            updateNoteDisplay("—");
        }
    }, sustain * 1000);
}

function updateNoteDisplay(note) {
    const display = document.getElementById("currentNote");

    if (display) {
        display.textContent = note;
    }
}

function getKey(note) {
    return document.querySelector(
        `[data-note="${note}"]`
    );
}

function pressKey(note, shouldRecord = true) {
    const key = getKey(note);

    if (!key) return;

    if (activeNotes.has(note)) return;

    createSound(note);

    key.classList.add("pressed");

    if (shouldRecord && isRecording) {
        recordNote(note);
    }
}

function releaseKey(note) {
    const key = getKey(note);

    if (!key) return;

    releaseSound(note);

    key.classList.remove("pressed");
}

function recordNote(note) {
    const time =
        performance.now() - recordingStartTime;

    recording.push({
        note: note,
        time: time
    });

    updateRecordingDisplay();
}

function updateRecordingDisplay() {
    const display =
        document.getElementById("recordingDisplay");

    if (!display) return;

    if (recording.length === 0) {
        display.textContent = "No notes recorded";
        return;
    }

    display.textContent =
        recording
            .map(note => note.note)
            .join(" → ");
}

function updateRecordingStatus(text) {
    const status =
        document.getElementById("recordingStatus");

    if (status) {
        status.textContent = text;
    }
}

function startRecording() {

    console.log("START RECORDING");

    stopPlayback();

    console.log("stopPlayback worked");

    recording = [];

    recordingStartTime = performance.now();

    isRecording = true;

    console.log("isRecording is now:", isRecording);

    updateRecordingStatus("Recording...");

    updateRecordingDisplay();

    document
        .getElementById("recordButton")
        .classList.add("recording");

    console.log("Recording started successfully");
}

function stopRecording() {
    isRecording = false;

    updateRecordingStatus(
        recording.length > 0
            ? "Recording complete"
            : "Ready"
    );

    document
        .getElementById("recordButton")
        .classList.remove("recording");
}

function playRecording() {
    if (recording.length === 0) {
        updateRecordingStatus("Nothing to play");
        return;
    }

    stopRecording();
    stopPlayback();

    isPlaying = true;

    updateRecordingStatus("Playing...");

    recording.forEach(noteData => {
        const timeout = setTimeout(() => {
            if (!isPlaying) return;

            pressKey(noteData.note, false);

            const releaseTimeout = setTimeout(() => {
                releaseKey(noteData.note);
            }, 250);

            playbackTimeouts.push(releaseTimeout);
        }, noteData.time);

        playbackTimeouts.push(timeout);
    });

    const endTime =
        recording[recording.length - 1].time + 500;

    const finishTimeout = setTimeout(() => {
        isPlaying = false;
        updateRecordingStatus("Ready");
    }, endTime);

    playbackTimeouts.push(finishTimeout);
}

function stopPlayback() {
    playbackTimeouts.forEach(timeout => {
        clearTimeout(timeout);
    });

    playbackTimeouts = [];

    isPlaying = false;

    activeNotes.forEach((_, note) => {
        releaseKey(note);
    });
}

function clearRecording() {
    stopPlayback();

    recording = [];

    updateRecordingDisplay();
    updateRecordingStatus("Ready");
}

function updateOctave() {
    document.getElementById("octaveDisplay").textContent = octave;

    const whiteKeys = document.querySelectorAll(".white-key");
    const blackKeys = document.querySelectorAll(".black-key");

    const whiteNotes = [
        "C",
        "D",
        "E",
        "F",
        "G",
        "A",
        "B",
        "C"
    ];

    const blackNotes = [
        "C#",
        "D#",
        "F#",
        "G#",
        "A#"
    ];

    whiteKeys.forEach((key, index) => {
        const noteOctave = index === 7
            ? octave + 1
            : octave;

        key.dataset.note =
            whiteNotes[index] + noteOctave;
    });

    blackKeys.forEach((key, index) => {
        key.dataset.note =
            blackNotes[index] + octave;
    });
}

document
    .querySelectorAll(".white-key, .black-key")
    .forEach(key => {

        key.addEventListener("mousedown", () => {
            pressKey(key.dataset.note);
        });

        key.addEventListener("mouseup", () => {
            releaseKey(key.dataset.note);
        });

        key.addEventListener("mouseleave", () => {
            if (activeNotes.has(key.dataset.note)) {
                releaseKey(key.dataset.note);
            }
        });
    });

document.addEventListener("keydown", event => {
    if (event.repeat) return;

    const key = event.key.toLowerCase();

    if (key === "k") {
        pressKey("C" + (octave + 1));
        return;
    }

    const noteName = keyboardMap[key];

    if (!noteName) return;

    pressKey(noteName + octave);
});

document.addEventListener("keyup", event => {
    const key = event.key.toLowerCase();

    if (key === "k") {
        releaseKey("C" + (octave + 1));
        return;
    }

    const noteName = keyboardMap[key];

    if (!noteName) return;

    releaseKey(noteName + octave);
});

document
    .getElementById("volume")
    .addEventListener("input", event => {
        volume = Number(event.target.value);
    });

document
    .getElementById("waveform")
    .addEventListener("change", event => {
        waveform = event.target.value;
    });

document
    .getElementById("sustain")
    .addEventListener("input", event => {
        sustain = Number(event.target.value);
    });

document
    .getElementById("octaveDown")
    .addEventListener("click", () => {
        if (octave > 2) {
            octave--;
            updateOctave();
        }
    });

document
    .getElementById("octaveUp")
    .addEventListener("click", () => {
        if (octave < 6) {
            octave++;
            updateOctave();
        }
    });

document
    .getElementById("recordButton")
    .addEventListener("click", () => {
        console.log("Record button clicked");
        console.log("Recording state before:", isRecording);
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

document
    .getElementById("playButton")
    .addEventListener("click", () => {
        playRecording();
    });

document
    .getElementById("clearButton")
    .addEventListener("click", () => {
        clearRecording();
    });

updateOctave();
updateRecordingDisplay();
updateRecordingStatus("Ready");

