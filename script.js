const audioContext =
    new (window.AudioContext || window.webkitAudioContext)();

let volume = 0.35;
let waveform = "sine";
let octave = 4;
let sustain = 0.7;

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

    // Main oscillator
    oscillator.type = waveform;
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(
        0.001,
        audioContext.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
        volume,
        audioContext.currentTime + 0.02
    );

    // Second oscillator adds a subtle harmonic
    secondOscillator.type = waveform;
    secondOscillator.frequency.value = frequency * 2;

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

function pressKey(note) {
    const key = getKey(note);

    if (!key) return;

    if (activeNotes.has(note)) return;

    createSound(note);

    key.classList.add("pressed");
}

function releaseKey(note) {
    const key = getKey(note);

    if (!key) return;

    releaseSound(note);

    key.classList.remove("pressed");
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
        pressKey("C5");
        return;
    }

    const noteName = keyboardMap[key];

    if (!noteName) return;

    pressKey(noteName + octave);
});

document.addEventListener("keyup", event => {
    const key = event.key.toLowerCase();

    if (key === "k") {
        releaseKey("C5");
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

document.addEventListener("mouseup", () => {
    activeNotes.forEach((sound, note) => {
        releaseKey(note);
    });
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
    .querySelectorAll(".white-key, .black-key")
    .forEach(key => {

        key.addEventListener("touchstart", event => {
            event.preventDefault();

            pressKey(key.dataset.note);
        });

        key.addEventListener("touchend", event => {
            event.preventDefault();

            releaseKey(key.dataset.note);
        });
    });

function updateOctave() {
    document.getElementById("octaveDisplay").textContent = octave;
}

