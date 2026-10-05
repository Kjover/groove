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

let bpm = 120;

let drumVolume = 0.35;
let drumPlaying = false;
let currentStep = 0;
let drumInterval = null;

let metronomeEnabled = false;
let metronomeBeat = 0;
let metronomeInterval = null;

let tapTimes = [];
let tapResetTimeout = null;

let hasUnsavedChanges = true;

const activeNotes = new Map();

const activeBassNotes = new Map();

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

const volumeInput =
    document.getElementById("volume");

const waveformInput =
    document.getElementById("waveform");

const sustainInput =
    document.getElementById("sustain");

const octaveDisplay =
    document.getElementById("octaveDisplay");

const currentNoteDisplay =
    document.getElementById("currentNote");

const currentBassNoteDisplay =
    document.getElementById("currentBassNote");

const recordingDisplay =
    document.getElementById("recordingDisplay");

const recordingStatus =
    document.getElementById("recordingStatus");

const recordButton =
    document.getElementById("recordButton");

const playButton =
    document.getElementById("playButton");

const clearButton =
    document.getElementById("clearButton");

const bpmInput =
    document.getElementById("bpm");

const bpmDisplay =
    document.getElementById("bpmDisplay");

const bpmDown =
    document.getElementById("bpmDown");

const bpmUp =
    document.getElementById("bpmUp");

const drumVolumeInput =
    document.getElementById("drumVolume");

const drumVolumeDisplay =
    document.getElementById("drumVolumeDisplay");

const tapTempoButton =
    document.getElementById("tapTempoButton");

const tapTempoDisplay =
    document.getElementById("tapTempoDisplay");

const metronomeButton =
    document.getElementById("metronomeButton");

const saveButton =
    document.getElementById("saveButton");

const loadButton =
    document.getElementById("loadButton");

const deleteSaveButton =
    document.getElementById("deleteSaveButton");

const saveStatus =
    document.getElementById("saveStatus");

function getFrequency(note) {

    const name = note.replace(/[0-9]/g, "");

    const octaveMatch =
        note.match(/[0-9]+/);

    if (!octaveMatch) {
        return 0;
    }

    const noteOctave =
        parseInt(octaveMatch[0]);

    const base =
        baseFrequencies[name];

    if (!base) {
        return 0;
    }

    return base *
        Math.pow(2, noteOctave - 4);
}

function createSound(note) {

    if (audioContext.state === "suspended") {
        audioContext.resume();
    }

    const oscillator =
        audioContext.createOscillator();

    const gain =
        audioContext.createGain();

    const secondOscillator =
        audioContext.createOscillator();

    const secondGain =
        audioContext.createGain();

    const frequency =
        getFrequency(note);

    oscillator.type = waveform;
    oscillator.frequency.value = frequency;

    secondOscillator.type = waveform;
    secondOscillator.frequency.value =
        frequency * 2;

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

    const sound =
        activeNotes.get(note);

    if (!sound) {
        return;
    }

    const now =
        audioContext.currentTime;

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

    sound.oscillator.stop(
        now + sustain
    );

    sound.secondOscillator.stop(
        now + sustain
    );

    activeNotes.delete(note);

    setTimeout(() => {

        if (activeNotes.size === 0) {
            updateNoteDisplay("—");
        }

    }, sustain * 1000);
}

function createBassSound(note) {

    if (audioContext.state === "suspended") {
        audioContext.resume();
    }

    const oscillator =
        audioContext.createOscillator();

    const gain =
        audioContext.createGain();

    const frequency =
        getFrequency(note);

    oscillator.type = "sawtooth";

    oscillator.frequency.value =
        frequency;

    gain.gain.setValueAtTime(
        0.001,
        audioContext.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
        volume * 0.55,
        audioContext.currentTime + 0.03
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();

    activeBassNotes.set(note, {
        oscillator,
        gain
    });

    currentBassNoteDisplay.textContent =
        note;
}

function releaseBassSound(note) {

    const sound =
        activeBassNotes.get(note);

    if (!sound) {
        return;
    }

    const now =
        audioContext.currentTime;

    sound.gain.gain.cancelScheduledValues(now);

    sound.gain.gain.setValueAtTime(
        sound.gain.gain.value,
        now
    );

    sound.gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + sustain
    );

    sound.oscillator.stop(
        now + sustain
    );

    activeBassNotes.delete(note);

    setTimeout(() => {

        if (activeBassNotes.size === 0) {
            currentBassNoteDisplay.textContent =
                "—";
        }

    }, sustain * 1000);
}

function updateNoteDisplay(note) {

    if (currentNoteDisplay) {
        currentNoteDisplay.textContent =
            note;
    }
}

function updateRecordingStatus(text) {

    if (recordingStatus) {
        recordingStatus.textContent =
            text;
    }
}

function updateRecordingDisplay() {

    if (!recordingDisplay) {
        return;
    }

    if (recording.length === 0) {

        recordingDisplay.textContent =
            "No notes recorded";

        return;
    }

    recordingDisplay.textContent =
        recording
            .map(note => {
                return `${note.instrument}: ${note.note}`;
            })
            .join(" → ");
}

function markUnsaved() {

    hasUnsavedChanges = true;

    if (saveStatus) {
        saveStatus.textContent =
            "Unsaved changes";
    }
}

function markSaved() {

    hasUnsavedChanges = false;

    if (saveStatus) {
        saveStatus.textContent =
            "Saved";
    }
}

function getKey(note) {

    return document.querySelector(
        `[data-note="${note}"]`
    );
}

function pressKey(
    note,
    shouldRecord = true
) {

    const key =
        getKey(note);

    if (!key) {
        return;
    }

    if (activeNotes.has(note)) {
        return;
    }

    createSound(note);

    key.classList.add("pressed");

    if (
        shouldRecord &&
        isRecording
    ) {

        recordNote(
            note,
            "piano"
        );
    }

    if (shouldRecord) {
        markUnsaved();
    }
}

function releaseKey(note) {

    const key =
        getKey(note);

    if (!key) {
        return;
    }

    releaseSound(note);

    key.classList.remove("pressed");
}

function getBassKey(note) {

    return document.querySelector(
        `.bass-key[data-note="${note}"]`
    );
}

function pressBassKey(
    note,
    shouldRecord = true
) {

    const key =
        getBassKey(note);

    if (!key) {
        return;
    }

    if (activeBassNotes.has(note)) {
        return;
    }

    createBassSound(note);

    key.classList.add("pressed");

    if (
        shouldRecord &&
        isRecording
    ) {

        recordNote(
            note,
            "bass"
        );
    }

    if (shouldRecord) {
        markUnsaved();
    }
}

function releaseBassKey(note) {

    const key =
        getBassKey(note);

    if (!key) {
        return;
    }

    releaseBassSound(note);

    key.classList.remove("pressed");
}

function recordNote(
    note,
    instrument
) {

    const time =
        performance.now() -
        recordingStartTime;

    recording.push({
        note: note,
        instrument: instrument,
        time: time
    });

    updateRecordingDisplay();
}

function startRecording() {

    stopPlayback();

    recording = [];

    recordingStartTime =
        performance.now();

    isRecording = true;

    updateRecordingStatus(
        "Recording..."
    );

    updateRecordingDisplay();

    recordButton.classList.add(
        "recording"
    );
}

function stopRecording() {

    isRecording = false;

    updateRecordingStatus(
        recording.length > 0
            ? "Recording complete"
            : "Ready"
    );

    recordButton.classList.remove(
        "recording"
    );
}

function playRecording() {

    if (recording.length === 0) {

        updateRecordingStatus(
            "Nothing to play"
        );

        return;
    }

    stopRecording();

    stopPlayback();

    isPlaying = true;

    playButton.textContent =
        "Stop";

    updateRecordingStatus(
        "Playing..."
    );

    recording.forEach(noteData => {

        const timeout =
            setTimeout(() => {

                if (!isPlaying) {
                    return;
                }

                if (
                    noteData.instrument ===
                    "bass"
                ) {

                    pressBassKey(
                        noteData.note,
                        false
                    );

                    const releaseTimeout =
                        setTimeout(() => {

                            releaseBassKey(
                                noteData.note
                            );

                        }, 250);

                    playbackTimeouts.push(
                        releaseTimeout
                    );

                } else {

                    pressKey(
                        noteData.note,
                        false
                    );

                    const releaseTimeout =
                        setTimeout(() => {

                            releaseKey(
                                noteData.note
                            );

                        }, 250);

                    playbackTimeouts.push(
                        releaseTimeout
                    );
                }

            }, noteData.time);

        playbackTimeouts.push(timeout);

    });

    const endTime =
        recording[
            recording.length - 1
        ].time + 600;

    const finishTimeout =
        setTimeout(() => {

            isPlaying = false;

            playButton.textContent =
                "Play";

            updateRecordingStatus(
                "Ready"
            );

        }, endTime);

    playbackTimeouts.push(
        finishTimeout
    );
}

function stopPlayback() {

    playbackTimeouts.forEach(
        timeout => {
            clearTimeout(timeout);
        }
    );

    playbackTimeouts = [];

    isPlaying = false;

    activeNotes.forEach(
        (_, note) => {
            releaseKey(note);
        }
    );

    activeBassNotes.forEach(
        (_, note) => {
            releaseBassKey(note);
        }
    );

    playButton.textContent =
        "Play";
}

function clearRecording() {

    stopPlayback();

    recording = [];

    updateRecordingDisplay();

    updateRecordingStatus(
        "Ready"
    );

    markUnsaved();
}

function updateOctave() {

    octaveDisplay.textContent =
        octave;

    const whiteKeys =
        document.querySelectorAll(
            ".white-key"
        );

    const blackKeys =
        document.querySelectorAll(
            ".black-key"
        );

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

    whiteKeys.forEach(
        (key, index) => {

            const noteOctave =
                index === 7
                    ? octave + 1
                    : octave;

            key.dataset.note =
                whiteNotes[index] +
                noteOctave;
        }
    );

    blackKeys.forEach(
        (key, index) => {

            key.dataset.note =
                blackNotes[index] +
                octave;
        }
    );
}

document
    .querySelectorAll(
        ".white-key, .black-key"
    )
    .forEach(key => {

        key.addEventListener(
            "mousedown",
            () => {

                pressKey(
                    key.dataset.note
                );

            }
        );

        key.addEventListener(
            "mouseup",
            () => {

                releaseKey(
                    key.dataset.note
                );

            }
        );

        key.addEventListener(
            "mouseleave",
            () => {

                if (
                    activeNotes.has(
                        key.dataset.note
                    )
                ) {

                    releaseKey(
                        key.dataset.note
                    );
                }

            }
        );

    });

document
    .querySelectorAll(".bass-key")
    .forEach(key => {

        key.addEventListener(
            "mousedown",
            () => {

                pressBassKey(
                    key.dataset.note
                );

            }
        );

        key.addEventListener(
            "mouseup",
            () => {

                releaseBassKey(
                    key.dataset.note
                );

            }
        );

        key.addEventListener(
            "mouseleave",
            () => {

                if (
                    activeBassNotes.has(
                        key.dataset.note
                    )
                ) {

                    releaseBassKey(
                        key.dataset.note
                    );
                }

            }
        );

    });

document.addEventListener(
    "keydown",
    event => {

        if (event.repeat) {
            return;
        }

        const key =
            event.key.toLowerCase();

        if (key === "k") {

            pressKey(
                "C" + (octave + 1)
            );

            return;
        }

        const noteName =
            keyboardMap[key];

        if (!noteName) {
            return;
        }

        pressKey(
            noteName + octave
        );

    }
);

document.addEventListener(
    "keyup",
    event => {

        const key =
            event.key.toLowerCase();

        if (key === "k") {

            releaseKey(
                "C" + (octave + 1)
            );

            return;
        }

        const noteName =
            keyboardMap[key];

        if (!noteName) {
            return;
        }

        releaseKey(
            noteName + octave
        );

    }
);

volumeInput.addEventListener(
    "input",
    event => {

        volume =
            Number(event.target.value);

        markUnsaved();
    }
);

waveformInput.addEventListener(
    "change",
    event => {

        waveform =
            event.target.value;

        markUnsaved();
    }
);

sustainInput.addEventListener(
    "input",
    event => {

        sustain =
            Number(event.target.value);

        markUnsaved();
    }
);

document
    .getElementById("octaveDown")
    .addEventListener(
        "click",
        () => {

            if (octave > 2) {

                octave--;

                updateOctave();

                markUnsaved();
            }

        }
    );

document
    .getElementById("octaveUp")
    .addEventListener(
        "click",
        () => {

            if (octave < 6) {

                octave++;

                updateOctave();

                markUnsaved();
            }

        }
    );

recordButton.addEventListener(
    "click",
    () => {

        if (isRecording) {

            stopRecording();

        } else {

            startRecording();

        }

    }
);

playButton.addEventListener(
    "click",
    () => {

        if (isPlaying) {

            stopPlayback();

            stopDrumSequencer();
            stopMetronome();

            updateRecordingStatus(
                "Ready"
            );

            return;
        }

        if (recording.length > 0) {
            playRecording();
        }

        if (drumPlaying) {

            stopDrumSequencer();

        } else {

            startDrumSequencer();

        }

        if (metronomeEnabled) {
            startMetronome();
        }

    }
);

clearButton.addEventListener(
    "click",
    () => {

        clearRecording();

        document
            .querySelectorAll(".step")
            .forEach(step => {

                step.classList.remove(
                    "active"
                );

            });

        stopDrumSequencer();

        stopMetronome();

        markUnsaved();

    }
);

const drumSteps =
    document.querySelectorAll(
        ".step"
    );

drumSteps.forEach(step => {

    step.addEventListener(
        "click",
        () => {

            step.classList.toggle(
                "active"
            );

            const instrument =
                step.dataset.instrument;

            playDrum(instrument);

            markUnsaved();

        }
    );

});

drumVolumeInput.addEventListener(
    "input",
    () => {

        drumVolume =
            Number(
                drumVolumeInput.value
            );

        drumVolumeDisplay.textContent =
            Math.round(
                drumVolume * 100
            ) + "%";

        markUnsaved();
    }
);

const drumSounds = {
    kick: 0.35,
    snare: 0.25,
    hihat: 0.15
};

function playKick() {

    const oscillator =
        audioContext.createOscillator();

    const gain =
        audioContext.createGain();

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
        drumVolume *
        drumSounds.kick,
        audioContext.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.15
    );

    oscillator.connect(gain);

    gain.connect(
        audioContext.destination
    );

    oscillator.start();

    oscillator.stop(
        audioContext.currentTime + 0.15
    );
}

function playSnare() {

    const oscillator =
        audioContext.createOscillator();

    const gain =
        audioContext.createGain();

    oscillator.type =
        "triangle";

    oscillator.frequency.value =
        180;

    gain.gain.setValueAtTime(
        drumVolume *
        drumSounds.snare,
        audioContext.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.12
    );

    oscillator.connect(gain);

    gain.connect(
        audioContext.destination
    );

    oscillator.start();

    oscillator.stop(
        audioContext.currentTime + 0.12
    );

    const noiseBuffer =
        audioContext.createBuffer(
            1,
            audioContext.sampleRate * 0.12,
            audioContext.sampleRate
        );

    const noiseData =
        noiseBuffer.getChannelData(0);

    for (
        let i = 0;
        i < noiseData.length;
        i++
    ) {

        noiseData[i] =
            Math.random() * 2 - 1;
    }

    const noise =
        audioContext.createBufferSource();

    const noiseGain =
        audioContext.createGain();

    noise.buffer =
        noiseBuffer;

    noiseGain.gain.setValueAtTime(
        drumVolume *
        drumSounds.snare,
        audioContext.currentTime
    );

    noiseGain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.12
    );

    noise.connect(noiseGain);

    noiseGain.connect(
        audioContext.destination
    );

    noise.start();
}

function playHiHat() {

    const bufferSize =
        audioContext.sampleRate * 0.08;

    const noiseBuffer =
        audioContext.createBuffer(
            1,
            bufferSize,
            audioContext.sampleRate
        );

    const noiseData =
        noiseBuffer.getChannelData(0);

    for (
        let i = 0;
        i < bufferSize;
        i++
    ) {

        noiseData[i] =
            Math.random() * 2 - 1;
    }

    const noise =
        audioContext.createBufferSource();

    const filter =
        audioContext.createBiquadFilter();

    const gain =
        audioContext.createGain();

    noise.buffer =
        noiseBuffer;

    filter.type =
        "highpass";

    filter.frequency.value =
        5000;

    gain.gain.setValueAtTime(
        drumVolume *
        drumSounds.hihat,
        audioContext.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.08
    );

    noise.connect(filter);

    filter.connect(gain);

    gain.connect(
        audioContext.destination
    );

    noise.start();
}

function playDrum(instrument) {

    if (
        audioContext.state ===
        "suspended"
    ) {

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

function playDrumStep() {

    const steps =
        document.querySelectorAll(
            ".step"
        );

    steps.forEach(step => {

        step.classList.remove(
            "playing"
        );

    });

    const instruments = [
        "kick",
        "snare",
        "hihat"
    ];

    instruments.forEach(
        instrument => {

            const step =
                document.querySelector(
                    `.step[data-instrument="${instrument}"][data-step="${currentStep + 1}"]`
                );

            if (!step) {
                return;
            }

            if (
                step.classList.contains(
                    "active"
                )
            ) {

                playDrum(
                    instrument
                );
            }

        }
    );

    const currentButtons =
        document.querySelectorAll(
            `.step[data-step="${currentStep + 1}"]`
        );

    currentButtons.forEach(
        step => {

            step.classList.add(
                "playing"
            );

        }
    );

    updateMetronomeVisual();

    currentStep++;

    if (currentStep >= 8) {
        currentStep = 0;
    }
}

function startDrumSequencer() {

    if (drumPlaying) {
        return;
    }

    drumPlaying = true;

    currentStep = 0;

    const beatLength =
        60000 / bpm;

    const stepLength =
        beatLength / 2;

    playDrumStep();

    drumInterval =
        setInterval(
            () => {

                playDrumStep();

            },
            stepLength
        );
}

function stopDrumSequencer() {

    drumPlaying = false;

    clearInterval(
        drumInterval
    );

    drumInterval = null;

    currentStep = 0;

    document
        .querySelectorAll(".step")
        .forEach(step => {

            step.classList.remove(
                "playing"
            );

        });
}

document
    .getElementById("drumPlayButton")
    .addEventListener(
        "click",
        () => {

            startDrumSequencer();

            if (metronomeEnabled) {
                startMetronome();
            }

        }
    );

document
    .getElementById("drumStopButton")
    .addEventListener(
        "click",
        () => {

            stopDrumSequencer();

            stopMetronome();

        }
    );

document
    .getElementById("drumClearButton")
    .addEventListener(
        "click",
        () => {

            document
                .querySelectorAll(".step")
                .forEach(step => {

                    step.classList.remove(
                        "active"
                    );

                });

            markUnsaved();

        }
    );

function updateBPM(value) {

    bpm =
        Math.min(
            240,
            Math.max(
                40,
                Math.round(value)
            )
        );

    bpmInput.value =
        bpm;

    bpmDisplay.textContent =
        bpm + " BPM";

    if (drumPlaying) {

        stopDrumSequencer();

        startDrumSequencer();

    }

    if (metronomeEnabled) {

        startMetronome();

    }

    markUnsaved();
}

bpmInput.addEventListener(
    "input",
    () => {

        const value =
            Number(
                bpmInput.value
            );

        if (
            !Number.isFinite(value)
        ) {
            return;
        }

        updateBPM(value);

    }
);

bpmDown.addEventListener(
    "click",
    () => {

        updateBPM(
            bpm - 5
        );

    }
);

bpmUp.addEventListener(
    "click",
    () => {

        updateBPM(
            bpm + 5
        );

    }
);

function registerTap() {

    const now =
        performance.now();

    if (
        tapTimes.length > 0 &&
        now - tapTimes[
            tapTimes.length - 1
        ] > 2000
    ) {

        tapTimes = [];
    }

    tapTimes.push(now);

    clearTimeout(
        tapResetTimeout
    );

    tapResetTimeout =
        setTimeout(
            () => {

                tapTimes = [];

                tapTempoDisplay.textContent =
                    "0 taps";

                tapTempoButton.classList.remove(
                    "active"
                );

            },
            2000
        );

    tapTempoDisplay.textContent =
        tapTimes.length +
        " taps";

    tapTempoButton.classList.add(
        "active"
    );

    if (tapTimes.length >= 2) {

        let intervals = [];

        for (
            let i = 1;
            i < tapTimes.length;
            i++
        ) {

            intervals.push(
                tapTimes[i] -
                tapTimes[i - 1]
            );
        }

        const averageInterval =
            intervals.reduce(
                (total, interval) =>
                    total + interval,
                0
            ) / intervals.length;

        const calculatedBPM =
            60000 /
            averageInterval;

        updateBPM(
            calculatedBPM
        );
    }
}

tapTempoButton.addEventListener(
    "click",
    registerTap
);

function playMetronomeClick(
    isFirstBeat = false
) {

    if (!metronomeEnabled) {
        return;
    }

    if (
        audioContext.state ===
        "suspended"
    ) {

        audioContext.resume();
    }

    const oscillator =
        audioContext.createOscillator();

    const gain =
        audioContext.createGain();

    oscillator.type =
        "square";

    oscillator.frequency.value =
        isFirstBeat
            ? 1200
            : 800;

    gain.gain.setValueAtTime(
        0.15,
        audioContext.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.06
    );

    oscillator.connect(gain);

    gain.connect(
        audioContext.destination
    );

    oscillator.start();

    oscillator.stop(
        audioContext.currentTime + 0.06
    );
}

function startMetronome() {

    if (!metronomeEnabled) {
        return;
    }

    stopMetronome();

    metronomeBeat = 0;

    playMetronomeClick(true);

    updateMetronomeVisual();

    const beatLength =
        60000 / bpm;

    metronomeInterval =
        setInterval(
            () => {

                metronomeBeat++;

                if (
                    metronomeBeat >= 4
                ) {

                    metronomeBeat = 0;
                }

                playMetronomeClick(
                    metronomeBeat === 0
                );

                updateMetronomeVisual();

            },
            beatLength
        );
}

function stopMetronome() {

    clearInterval(
        metronomeInterval
    );

    metronomeInterval = null;

    metronomeBeat = 0;

    updateMetronomeVisual();
}

function updateMetronomeVisual() {

    const beats =
        document.querySelectorAll(
            "#metronomeBeatDisplay span"
        );

    beats.forEach(
        (beat, index) => {

            beat.classList.toggle(
                "active",
                metronomeEnabled &&
                index === metronomeBeat
            );

        }
    );
}

metronomeButton.addEventListener(
    "click",
    () => {

        metronomeEnabled =
            !metronomeEnabled;

        if (metronomeEnabled) {

            metronomeButton.textContent =
                "Metronome: On";

            metronomeButton.classList.add(
                "active"
            );

            if (drumPlaying) {
                startMetronome();
            } else {
                startMetronome();
            }

        } else {

            metronomeButton.textContent =
                "Metronome: Off";

            metronomeButton.classList.remove(
                "active"
            );

            stopMetronome();

        }

        markUnsaved();
    }
);

const SAVE_KEY =
    "grooveProject";

function getProjectData() {

    const drumPattern = [];

    document
        .querySelectorAll(".step")
        .forEach(step => {

            drumPattern.push({
                instrument:
                    step.dataset.instrument,

                step:
                    Number(
                        step.dataset.step
                    ),

                active:
                    step.classList.contains(
                        "active"
                    )
            });

        });

    return {

        version: "1.6",

        recording: recording,

        settings: {
            volume: volume,
            waveform: waveform,
            octave: octave,
            sustain: sustain,
            bpm: bpm,
            drumVolume: drumVolume,
            metronomeEnabled:
                metronomeEnabled
        },

        drumPattern: drumPattern

    };
}

function saveProject() {

    const project =
        getProjectData();

    localStorage.setItem(
        SAVE_KEY,
        JSON.stringify(project)
    );

    markSaved();

    saveStatus.textContent =
        "Saved just now";
}

function loadProject() {

    const saved =
        localStorage.getItem(
            SAVE_KEY
        );

    if (!saved) {

        saveStatus.textContent =
            "No saved project";

        return;
    }

    try {

        const project =
            JSON.parse(saved);

        stopPlayback();

        stopDrumSequencer();

        stopMetronome();

        recording =
            project.recording || [];

        const settings =
            project.settings || {};

        volume =
            settings.volume ?? 0.35;

        waveform =
            settings.waveform ?? "sine";

        octave =
            settings.octave ?? 4;

        sustain =
            settings.sustain ?? 0.7;

        bpm =
            settings.bpm ?? 120;

        drumVolume =
            settings.drumVolume ?? 0.35;

        metronomeEnabled =
            settings.metronomeEnabled ?? false;

        volumeInput.value =
            volume;

        waveformInput.value =
            waveform;

        sustainInput.value =
            sustain;

        bpmInput.value =
            bpm;

        bpmDisplay.textContent =
            bpm + " BPM";

        drumVolumeInput.value =
            drumVolume;

        drumVolumeDisplay.textContent =
            Math.round(
                drumVolume * 100
            ) + "%";

        octaveDisplay.textContent =
            octave;

        updateOctave();

        document
            .querySelectorAll(".step")
            .forEach(step => {

                step.classList.remove(
                    "active"
                );

            });

        if (project.drumPattern) {

            project.drumPattern.forEach(
                savedStep => {

                    if (
                        savedStep.active
                    ) {

                        const step =
                            document.querySelector(
                                `.step[data-instrument="${savedStep.instrument}"][data-step="${savedStep.step}"]`
                            );

                        if (step) {

                            step.classList.add(
                                "active"
                            );
                        }
                    }

                }
            );
        }

        updateRecordingDisplay();

        updateRecordingStatus(
            recording.length > 0
                ? "Recording loaded"
                : "Ready"
        );

        metronomeButton.classList.toggle(
            "active",
            metronomeEnabled
        );

        metronomeButton.textContent =
            metronomeEnabled
                ? "Metronome: On"
                : "Metronome: Off";

        markSaved();

        saveStatus.textContent =
            "Loaded";

    } catch (error) {

        console.error(
            "Could not load project:",
            error
        );

        saveStatus.textContent =
            "Load failed";
    }
}

function deleteSavedProject() {

    const confirmed =
        confirm(
            "Delete the saved Groove project?"
        );

    if (!confirmed) {
        return;
    }

    localStorage.removeItem(
        SAVE_KEY
    );

    saveStatus.textContent =
        "Save deleted";

    markUnsaved();
}

saveButton.addEventListener(
    "click",
    saveProject
);

loadButton.addEventListener(
    "click",
    loadProject
);

deleteSaveButton.addEventListener(
    "click",
    deleteSavedProject
);

updateOctave();

updateRecordingDisplay();

updateRecordingStatus(
    "Ready"
);

bpmDisplay.textContent =
    bpm + " BPM";

drumVolumeDisplay.textContent =
    Math.round(
        drumVolume * 100
    ) + "%";

markUnsaved();