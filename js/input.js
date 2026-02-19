// input.js -- Runtime-agnostic input primitives.
// Provides an async input queue plus module-level wrappers used by game code.

import { CLR_GRAY } from './display.js';
import { recordKey, isReplayMode, getNextReplayKey } from './keylog.js';

/**
 * Display contract used by input helpers.
 * @typedef {Object} InputDisplay
 * @property {boolean} [messageNeedsMore]
 * @property {string|null} [topMessage]
 * @property {(row:number) => void} [clearRow]
 * @property {(x:number, y:number, text:string, color?:number) => void} [putstr]
 * @property {(msg:string) => void} [putstr_message]
 */

/**
 * Input runtime contract.
 * @typedef {Object} InputRuntime
 * @property {(ch:number) => void} pushInput
 * @property {() => Promise<number>} nhgetch
 * @property {() => void} [clearInputQueue]
 * @property {() => InputDisplay|null} [getDisplay]
 */

/**
 * Create an in-memory async input queue.
 * Useful for both browser and headless test adapters.
 * @returns {InputRuntime}
 */
export function createInputQueue() {
    const inputQueue = [];
    let inputResolver = null;

    return {
        pushInput(ch) {
            if (inputResolver) {
                const resolve = inputResolver;
                inputResolver = null;
                resolve(ch);
            } else {
                inputQueue.push(ch);
            }
        },
        nhgetch() {
            if (inputQueue.length > 0) {
                return Promise.resolve(inputQueue.shift());
            }
            return new Promise((resolve) => {
                inputResolver = resolve;
            });
        },
        clearInputQueue() {
            inputQueue.length = 0;
        },
        getDisplay() {
            return null;
        },
    };
}

const defaultInputRuntime = createInputQueue();
let activeInputRuntime = defaultInputRuntime;

export function setInputRuntime(runtime) {
    activeInputRuntime = runtime || defaultInputRuntime;
}

export function getInputRuntime() {
    return activeInputRuntime;
}

export function pushInput(ch) {
    activeInputRuntime.pushInput(ch);
}

export function clearInputQueue() {
    if (typeof activeInputRuntime.clearInputQueue === 'function') {
        activeInputRuntime.clearInputQueue();
    }
}

// Get a character of input (async)
// This is the JS equivalent of C's nhgetch().
// C ref: winprocs.h win_nhgetch
export function nhgetch() {
    const display = getRuntimeDisplay();

    // Clear message acknowledgement flag when user presses a key.
    // C ref: win/tty/topl.c - toplin gets set to TOPLINE_EMPTY after keypress
    if (display) {
        display.messageNeedsMore = false;
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

    return Promise.resolve(activeInputRuntime.nhgetch()).then((ch) => {
        recordKey(ch);
        return ch;
    });
}

// Get a line of input (async)
// C ref: winprocs.h win_getlin
export async function getlin(prompt, display) {
    const runtimeDisplay = getRuntimeDisplay();
    const disp = display || runtimeDisplay;
    let line = '';

    // Helper to update display
    const updateDisplay = () => {
        if (disp) {
            // Clear the message row and display prompt + current input.
            // Don't use putstr_message as it concatenates short messages.
            disp.clearRow(0);
            disp.putstr(0, 0, prompt + line, CLR_GRAY);
        }
    };

    // Initial display
    updateDisplay();

    while (true) {
        const ch = await nhgetch();
        if (ch === 13 || ch === 10) { // Enter
            // C-style prompt cleanup after accepting typed input.
            if (disp) {
                disp.topMessage = null;
                if (typeof disp.clearRow === 'function') {
                    disp.clearRow(0);
                }
            }
            return line;
        } else if (ch === 27) { // ESC
            if (disp) {
                disp.topMessage = null;
                if (typeof disp.clearRow === 'function') {
                    disp.clearRow(0);
                }
            }
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

// Yes/no/quit prompt (async)
// C ref: winprocs.h win_yn_function
export async function ynFunction(query, choices, def, display) {
    const runtimeDisplay = getRuntimeDisplay();
    const disp = display || runtimeDisplay;
    let prompt = query;
    if (choices) {
        prompt += ` [${choices}]`;
    }
    if (def) {
        prompt += ` (${String.fromCharCode(def)})`;
    }
    prompt += ' ';

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

// Gather typed digits into a number; return the next non-digit
// C ref: cmd.c:4851 get_count()
// Returns: { count: number, key: number }
export async function getCount(firstKey, maxCount, display) {
    const runtimeDisplay = getRuntimeDisplay();
    const disp = display || runtimeDisplay;
    let cnt = 0;
    let key = firstKey || 0;
    let backspaced = false;
    let showzero = true;
    const LARGEST_INT = 32767; // C ref: global.h:133 LARGEST_INT (2^15 - 1)
    const MAX_COUNT = maxCount || LARGEST_INT;
    const ERASE_CHAR = 127; // DEL

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

function getRuntimeDisplay() {
    if (typeof activeInputRuntime.getDisplay === 'function') {
        return activeInputRuntime.getDisplay();
    }
    return null;
}
