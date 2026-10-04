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
        if (drumPlaying) {
        stopDrumSequencer();
    } else {
        startDrumSequencer();
    }
    });

document
    .getElementById("clearButton")
    .addEventListener("click", () => {
        clearRecording();
        document
        .querySelectorAll(".step")
        .forEach(step => {
            step.classList.remove("active");
        });

    stopDrumSequencer();
    });

updateOctave();
updateRecordingDisplay();
updateRecordingStatus("Ready");

const drumSteps = document.querySelectorAll(".step");

drumSteps.forEach(step => {
    step.addEventListener("click", () => {
        step.classList.toggle("active");

        const instrument = step.dataset.instrument;

        playDrum(instrument);
    });
});


let drumVolume = 0.35;

const drumVolumeInput =
    document.getElementById("drumVolume");

const drumVolumeDisplay =
    document.getElementById("drumVolumeDisplay");

drumVolumeInput.addEventListener("input", () => {
    drumVolume = Number(drumVolumeInput.value);

    drumVolumeDisplay.textContent =
        Math.round(drumVolume * 100) + "%";
});

const drumSounds = {
    kick: 0.35,
    snare: 0.25,
    hihat: 0.15
};

function playKick() {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(
        150,
        audioContext.currentTime
    );

    oscillator.frequency.exponentialRampToValueAtTime(
        50,
        audioContext.currentTime + 0.15
    );

    gain.gain.setValueAtTime(
        drumVolume * drumSounds.kick,
        audioContext.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.15
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(
        audioContext.currentTime + 0.15
    );
}

function playSnare() {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.value = 180;

    gain.gain.setValueAtTime(
        drumVolume * drumSounds.snare,
        audioContext.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.12
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(
        audioContext.currentTime + 0.12
    );

    const noiseBuffer = audioContext.createBuffer(
        1,
        audioContext.sampleRate * 0.12,
        audioContext.sampleRate
    );

    const noiseData = noiseBuffer.getChannelData(0);

    for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = Math.random() * 2 - 1;
    }

    const noise = audioContext.createBufferSource();
    const noiseGain = audioContext.createGain();

    noise.buffer = noiseBuffer;

    noiseGain.gain.setValueAtTime(
        drumVolume * drumSounds.snare,
        audioContext.currentTime
    );

    noiseGain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.12
    );

    noise.connect(noiseGain);
    noiseGain.connect(audioContext.destination);

    noise.start();
}

function playHiHat() {
    const bufferSize =
        audioContext.sampleRate * 0.08;

    const noiseBuffer = audioContext.createBuffer(
        1,
        bufferSize,
        audioContext.sampleRate
    );

    const noiseData = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        noiseData[i] = Math.random() * 2 - 1;
    }

    const noise = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();

    noise.buffer = noiseBuffer;

    filter.type = "highpass";
    filter.frequency.value = 5000;

    gain.gain.setValueAtTime(
        drumVolume * drumSounds.hihat,
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

function playDrum(instrument) {
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }

    if (instrument === "kick") {
        playKick();
    }

    if (instrument === "snare") {
        playSnare();
    }

    if (instrument === "hihat") {
        playHiHat();
    }
}

let drumPlaying = false;
let currentStep = 0;
let drumInterval = null;

function playDrumStep() {
    const steps = document.querySelectorAll(".step");

    steps.forEach(step => {
        step.classList.remove("playing");
    });

    const instruments = [
        "kick",
        "snare",
        "hihat"
    ];

    instruments.forEach(instrument => {
        const step = document.querySelector(
            `.step[data-instrument="${instrument}"][data-step="${currentStep + 1}"]`
        );

        if (!step) return;

        if (step.classList.contains("active")) {
            playDrum(instrument);
        }
    });

    const currentButtons = document.querySelectorAll(
        `.step[data-step="${currentStep + 1}"]`
    );

    currentButtons.forEach(step => {
        step.classList.add("playing");
    });

    currentStep++;

    if (currentStep >= 8) {
        currentStep = 0;
    }
}

function startDrumSequencer() {
    if (drumPlaying) return;

    drumPlaying = true;
    currentStep = 0;

    const beatLength = 60000 / bpm;
    const stepLength = beatLength / 2;

    playDrumStep();

    drumInterval = setInterval(() => {
        playDrumStep();
    }, stepLength);
}

function stopDrumSequencer() {
    drumPlaying = false;

    clearInterval(drumInterval);

    drumInterval = null;
    currentStep = 0;

    document.querySelectorAll(".step").forEach(step => {
        step.classList.remove("playing");
    });
}

let bpm = 120;

const bpmInput = document.getElementById("bpm");
const bpmDisplay = document.getElementById("bpmDisplay");

bpmInput.addEventListener("input", () => {
    bpm = Number(bpmInput.value);
    bpmDisplay.textContent = bpm + " BPM";
});

document
    .getElementById("drumPlayButton")
    .addEventListener("click", () => {
        startDrumSequencer();
    });

document
    .getElementById("drumStopButton")
    .addEventListener("click", () => {
        stopDrumSequencer();
    });
document
    .getElementById("drumClearButton")
    .addEventListener("click", () => {
        document
            .querySelectorAll(".step")
            .forEach(step => {
                step.classList.remove("active");
            });
    });


