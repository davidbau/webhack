// input.js -- Keyboard input handling (environment-agnostic core)
// Implements an async input queue that replaces C's blocking nhgetch().
// See DECISIONS.md #1 for the rationale.
//
// Phase 2 refactor: This module provides the core input queue and utilities.
// Browser-specific DOM listeners are in browser_input.js.

import { CLR_WHITE } from './display.js';
import { recordKey, isReplayMode, getNextReplayKey } from './keylog.js';

// --- Module-level input queue (used by legacy/browser path) ---
const inputQueue = [];
let inputResolver = null;

// Flags and display references (set by browser adapter or injected)
let _gameFlags = null;
let _gameDisplay = null;

/**
 * Set global flags reference (for number_pad mode, etc.)
 * Called by browser adapter after flags are loaded.
 */
export function setInputFlags(flags) {
    _gameFlags = flags;
}

/**
 * Set global display reference (for message acknowledgement)
 * Called by browser adapter after display is created.
 */
export function setInputDisplay(display) {
    _gameDisplay = display;
}

/**
 * Get current flags (for browser_input.js keydown handler)
 */
export function getInputFlags() {
    return _gameFlags;
}

// --- Legacy browser-specific initialization ---
// This function is DEPRECATED - use browser_input.js createBrowserInput() instead
// Kept for backwards compatibility during Phase 2 transition
export function initInput() {
    // Import browser input dynamically to avoid circular deps
    // This will be removed after browser_bootstrap.js is updated
    if (typeof document !== 'undefined') {
        import('./browser_input.js').then(mod => {
            mod.initBrowserInput();
        });
    }
}

/**
 * Push a key into the input queue.
 * Used by browser adapter and replay system.
 */
export function pushInput(ch) {
    if (inputResolver) {
        const resolve = inputResolver;
        inputResolver = null;
        resolve(ch);
    } else {
        inputQueue.push(ch);
    }
}

/**
 * Get a character of input (async).
 * This is the JS equivalent of C's nhgetch().
 * C ref: winprocs.h win_nhgetch
 */
export function nhgetch() {
    // Clear message acknowledgement flag when user presses a key
    // C ref: win/tty/topl.c - toplin gets set to TOPLINE_EMPTY after keypress
    if (_gameDisplay) {
        _gameDisplay.messageNeedsMore = false;
    }

    // Replay mode: pull from replay buffer
    if (isReplayMode()) {
        const key = getNextReplayKey();
        if (key !== null) {
            recordKey(key);
            return Promise.resolve(key);
        }
        // Replay exhausted — fall through to interactive input
    }

    if (inputQueue.length > 0) {
        const ch = inputQueue.shift();
        recordKey(ch);
        return Promise.resolve(ch);
    }
    return new Promise(resolve => {
        inputResolver = (ch) => {
            recordKey(ch);
            resolve(ch);
        };
    });
}

/**
 * Get a line of input (async).
 * C ref: winprocs.h win_getlin
 */
export async function getlin(prompt, display) {
    let line = '';
    const disp = display || _gameDisplay;

    // Helper to update display
    const updateDisplay = () => {
        if (disp) {
            // Clear the message row and display prompt + current input
            // Don't use putstr_message as it concatenates short messages
            disp.clearRow(0);
            disp.putstr(0, 0, prompt + line, CLR_WHITE);
        }
    };

    // Initial display
    updateDisplay();

    while (true) {
        const ch = await nhgetch();
        if (ch === 13 || ch === 10) { // Enter
            // Clear topMessage to prevent message concatenation issues
            if (disp) disp.topMessage = null;
            return line;
        } else if (ch === 27) { // ESC
            // Clear topMessage to prevent message concatenation issues
            if (disp) disp.topMessage = null;
            return null; // cancelled
        } else if (ch === 8 || ch === 127) { // Backspace
            if (line.length > 0) {
                line = line.slice(0, -1);
                updateDisplay();
            }
        } else if (ch >= 32 && ch < 127) {
            line += String.fromCharCode(ch);
            updateDisplay();
        }
    }
}

/**
 * Yes/no/quit prompt (async).
 * C ref: winprocs.h win_yn_function
 */
export async function ynFunction(query, choices, def, display) {
    let prompt = query;
    if (choices) {
        prompt += ` [${choices}]`;
    }
    if (def) {
        prompt += ` (${String.fromCharCode(def)})`;
    }
    prompt += ' ';

    const disp = display || _gameDisplay;
    if (disp) disp.putstr_message(prompt);

    while (true) {
        const ch = await nhgetch();
        // Space or Enter returns default
        if ((ch === 32 || ch === 13) && def) {
            return def;
        }
        // ESC returns 'q' or 'n' or default
        if (ch === 27) {
            if (choices && choices.includes('q')) return 'q'.charCodeAt(0);
            if (choices && choices.includes('n')) return 'n'.charCodeAt(0);
            if (def) return def;
            return 27;
        }
        // Check if this is a valid choice
        const c = String.fromCharCode(ch);
        if (!choices || choices.includes(c)) {
            return ch;
        }
    }
}

/**
 * Gather typed digits into a number; return the next non-digit.
 * C ref: cmd.c:4851 get_count()
 * Returns: { count: number, key: number }
 */
export async function getCount(firstKey, maxCount, display) {
    let cnt = 0;
    let key = firstKey || 0;
    let backspaced = false;
    let showzero = true;
    const LARGEST_INT = 32767; // C ref: global.h:133 LARGEST_INT (2^15 - 1)
    const MAX_COUNT = maxCount || LARGEST_INT;
    const ERASE_CHAR = 127; // DEL

    const disp = display || _gameDisplay;

    // If first key is provided and it's a digit, use it
    if (key && isDigit(key)) {
        cnt = key - 48; // '0' = 48
        key = 0; // Clear so we read next key
    }

    while (true) {
        // If we don't have a key yet, read one
        if (!key) {
            key = await nhgetch();
        }

        if (isDigit(key)) {
            const digit = key - 48;
            // cnt = (10 * cnt) + digit
            cnt = (cnt * 10) + digit;
            if (cnt < 0) {
                cnt = 0;
            } else if (cnt > MAX_COUNT) {
                cnt = MAX_COUNT;
            }
            showzero = (key === 48); // '0'
            key = 0; // Read next key
        } else if (key === 8 || key === ERASE_CHAR) { // Backspace
            if (!cnt) {
                break; // No count entered, just cancel
            }
            showzero = false;
            cnt = Math.floor(cnt / 10);
            backspaced = true;
            key = 0; // Read next key
        } else if (key === 27) { // ESC
            cnt = 0;
            break;
        } else {
            // Non-digit, non-backspace, non-ESC: this is the command key
            break;
        }

        // Show "Count: N" when cnt > 9 or after backspace
        // C ref: cmd.c:4911 - shows count when cnt > 9 || backspaced || echoalways
        if (cnt > 9 || backspaced) {
            if (disp) {
                if (backspaced && !cnt && !showzero) {
                    disp.putstr_message('Count: ');
                } else {
                    disp.putstr_message(`Count: ${cnt}`);
                }
            }
            backspaced = false;
        }
    }

    return { count: cnt, key: key };
}

// Helper: check if character code is a digit '0'-'9'
function isDigit(ch) {
    return ch >= 48 && ch <= 57; // '0' = 48, '9' = 57
}

/**
 * Clear the input queue.
 */
export function clearInputQueue() {
    inputQueue.length = 0;
}

// --- Injectable Input Queue Factory ---
// For headless/test environments that need their own isolated input queue

/**
 * Create an isolated input queue for headless/test use.
 * Returns an input adapter with pushKey and nhgetch methods.
 */
export function createInputQueue() {
    const queue = [];
    let resolver = null;

    return {
        /**
         * Push a key into the queue.
         */
        pushKey(ch) {
            if (resolver) {
                const r = resolver;
                resolver = null;
                r(ch);
            } else {
                queue.push(ch);
            }
        },

        /**
         * Get next key from queue (async).
         * Throws if queue is empty (for test environments that should have all keys pre-loaded).
         */
        async nhgetch() {
            if (queue.length > 0) {
                return queue.shift();
            }
            // For headless mode, we might want to wait or throw
            // Default: wait for pushKey (useful for interactive headless)
            return new Promise(resolve => {
                resolver = resolve;
            });
        },

        /**
         * Check if queue has pending input.
         */
        hasInput() {
            return queue.length > 0;
        },

        /**
         * Clear the queue.
         */
        clear() {
            queue.length = 0;
            resolver = null;
        },

        /**
         * Get queue length (for debugging).
         */
        get length() {
            return queue.length;
        }
    };
}
