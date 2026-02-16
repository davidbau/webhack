// keylog.js -- Keystroke recording and replay for reproducible game sessions
// Records every key processed by nhgetch() along with PRNG seed and options diff.
// The resulting keylog JSON can replay the game identically in JS or drive C NetHack.

import { DEFAULT_FLAGS } from './storage.js';

// --- Recording state ---
let recording = false;
let keys = [];
let gameSeed = 0;
let optionsDiff = {};

// --- Replay state ---
let replayMode = false;
let replayKeys = [];
let replayIndex = 0;

// Compute options diff: only flags differing from DEFAULT_FLAGS
function computeOptionsDiff(flags) {
    const diff = {};
    for (const [key, value] of Object.entries(flags)) {
        if (key in DEFAULT_FLAGS && value !== DEFAULT_FLAGS[key]) {
            diff[key] = value;
        }
    }
    return diff;
}

// Start recording keystrokes for a new game
export function startRecording(seed, flags) {
    gameSeed = seed;
    optionsDiff = computeOptionsDiff(flags);
    keys = [];
    recording = true;
}

// Record a single key (char code as returned by nhgetch, post all key mapping)
export function recordKey(ch) {
    if (recording) {
        keys.push(ch);
    }
}

// Build and return the keylog object
export function getKeylog() {
    const keylog = {
        version: 1,
        seed: gameSeed,
        options: { ...optionsDiff },
        keys: [...keys],
        metadata: {
            date: new Date().toISOString(),
            source: 'menace-js',
        },
    };
    // Add turn count from game instance if available
    if (typeof window !== 'undefined' && window.gameInstance) {
        keylog.metadata.turns = window.gameInstance.turnCount;
    }
    return keylog;
}

// Check if we're in replay mode
export function isReplayMode() {
    return replayMode;
}

// Get the next replay key, or null when exhausted
export function getNextReplayKey() {
    if (replayIndex < replayKeys.length) {
        return replayKeys[replayIndex++];
    }
    // Replay exhausted
    replayMode = false;
    return null;
}

// Start replay: store data in sessionStorage and navigate with seed + options in URL
export function startReplay(data) {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem('menace-replay', JSON.stringify(data));
    // Build URL with seed and option params
    const url = new URL(window.location.href);
    // Clear existing params
    for (const key of [...url.searchParams.keys()]) {
        url.searchParams.delete(key);
    }
    url.searchParams.set('seed', data.seed);
    if (data.options) {
        for (const [key, value] of Object.entries(data.options)) {
            url.searchParams.set(key, value);
        }
    }
    window.location.href = url.toString();
}

// Save keylog as a downloadable JSON file
export function saveKeylog() {
    const keylog = getKeylog();
    const name = keylog.options.name || 'unknown';
    const filename = `keylog_${name}_${keylog.seed}.json`;
    const json = JSON.stringify(keylog, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

// --- Module init: check sessionStorage for pending replay ---
if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    try {
        const replayData = sessionStorage.getItem('menace-replay');
        if (replayData) {
            const data = JSON.parse(replayData);
            replayMode = true;
            replayKeys = data.keys || [];
            replayIndex = 0;
            sessionStorage.removeItem('menace-replay');
            window.SKIP_ANIMATION_DELAYS = true;
        }
    } catch (e) {
        // Ignore parse errors
    }
}
