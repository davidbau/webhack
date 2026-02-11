// input.js -- Keyboard input handling
// Implements an async input queue that replaces the C's blocking nhgetch().
// See DECISIONS.md #1 for the rationale.

import { CLR_WHITE } from './display.js';

const inputQueue = [];
let inputResolver = null;

// Initialize keyboard listener
// C ref: replaces tty input initialization in win/tty/wintty.c
export function initInput() {
    document.addEventListener('keydown', handleKeyDown);
}

function handleKeyDown(e) {
    // Ignore modifier-only keys
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
        return;
    }

    let ch = null;

    // Handle numeric keypad in number_pad mode
    // C ref: cmd.c number_pad handling - digits 1-9,0 map to directions + inventory
    // Standard layout: 7=NW 8=N 9=NE 4=W 5=. 6=E 1=SW 2=S 3=SE 0=i
    if (window.gameFlags?.number_pad && e.location === KeyboardEvent.DOM_KEY_LOCATION_NUMPAD) {
        const numpadMap = {
            '0': 'i'.charCodeAt(0),  // inventory
            '1': 'b'.charCodeAt(0),  // southwest
            '2': 'j'.charCodeAt(0),  // south
            '3': 'n'.charCodeAt(0),  // southeast
            '4': 'h'.charCodeAt(0),  // west
            '5': '.'.charCodeAt(0),  // wait/rest
            '6': 'l'.charCodeAt(0),  // east
            '7': 'y'.charCodeAt(0),  // northwest
            '8': 'k'.charCodeAt(0),  // north
            '9': 'u'.charCodeAt(0),  // northeast
        };
        if (e.key in numpadMap) {
            ch = numpadMap[e.key];
            e.preventDefault();
            pushInput(ch);
            return;
        }
    }

    // Handle Ctrl+key combinations
    // C ref: cmd.c uses C('x') which is (x & 0x1f)
    if (e.ctrlKey && !e.altKey && !e.metaKey) {
        const code = e.key.toLowerCase().charCodeAt(0);
        if (code >= 97 && code <= 122) { // a-z
            ch = code - 96; // Ctrl+A = 1, Ctrl+Z = 26
            e.preventDefault();
        }
    }
    // Handle Meta (Alt) key combinations
    // C ref: cmd.c uses M('x') which is (x | 0x80)
    else if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key.length === 1) {
            ch = e.key.charCodeAt(0) | 0x80;
            e.preventDefault();
        }
    }
    // Handle Escape
    else if (e.key === 'Escape') {
        ch = 27; // ESC
        e.preventDefault();
    }
    // Handle Enter
    else if (e.key === 'Enter') {
        ch = 13; // CR
        e.preventDefault();
    }
    // Handle Backspace
    else if (e.key === 'Backspace') {
        ch = 8;
        e.preventDefault();
    }
    // Handle space bar with rest_on_space option
    // C ref: flag.h flags.rest_on_space - space triggers rest/wait command
    else if (e.key === ' ' && window.gameFlags?.rest_on_space) {
        ch = '.'.charCodeAt(0); // Convert space to period (rest)
        e.preventDefault();
    }
    // Handle regular character keys
    else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        ch = e.key.charCodeAt(0);
    }
    // Handle arrow keys -> vi movement keys
    else if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        switch (e.key) {
            case 'ArrowLeft':  ch = 'h'.charCodeAt(0); break;
            case 'ArrowDown':  ch = 'j'.charCodeAt(0); break;
            case 'ArrowUp':    ch = 'k'.charCodeAt(0); break;
            case 'ArrowRight': ch = 'l'.charCodeAt(0); break;
            case 'Home':       ch = 'y'.charCodeAt(0); break;
            case 'End':        ch = 'b'.charCodeAt(0); break;
            case 'PageUp':     ch = 'K'.charCodeAt(0); break; // run up
            case 'PageDown':   ch = 'J'.charCodeAt(0); break; // run down
        }
        if (ch !== null) e.preventDefault();
    }

    if (ch !== null) {
        pushInput(ch);
    }
}

export function pushInput(ch) {
    if (inputResolver) {
        const resolve = inputResolver;
        inputResolver = null;
        resolve(ch);
    } else {
        inputQueue.push(ch);
    }
}

// Get a character of input (async)
// This is the JS equivalent of C's nhgetch()
// C ref: winprocs.h win_nhgetch
export function nhgetch() {
    // Clear message acknowledgement flag when user presses a key
    // C ref: win/tty/topl.c - toplin gets set to TOPLINE_EMPTY after keypress
    if (window.gameDisplay) {
        window.gameDisplay.messageNeedsMore = false;
    }

    if (inputQueue.length > 0) {
        return Promise.resolve(inputQueue.shift());
    }
    return new Promise(resolve => {
        inputResolver = resolve;
    });
}

// Get a line of input (async)
// C ref: winprocs.h win_getlin
export async function getlin(prompt, display) {
    let line = '';

    // Helper to update display
    const updateDisplay = () => {
        if (display) {
            // Clear the message row and display prompt + current input
            // Don't use putstr_message as it concatenates short messages
            display.clearRow(0);
            display.putstr(0, 0, prompt + line, CLR_WHITE);
        }
    };

    // Initial display
    updateDisplay();

    while (true) {
        const ch = await nhgetch();
        if (ch === 13 || ch === 10) { // Enter
            // Clear topMessage to prevent message concatenation issues
            if (display) display.topMessage = null;
            return line;
        } else if (ch === 27) { // ESC
            // Clear topMessage to prevent message concatenation issues
            if (display) display.topMessage = null;
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
    let prompt = query;
    if (choices) {
        prompt += ` [${choices}]`;
    }
    if (def) {
        prompt += ` (${String.fromCharCode(def)})`;
    }
    prompt += ' ';

    if (display) display.putstr_message(prompt);

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
            if (display) {
                if (backspaced && !cnt && !showzero) {
                    display.putstr_message('Count: ');
                } else {
                    display.putstr_message(`Count: ${cnt}`);
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

// Clear the input queue
export function clearInputQueue() {
    inputQueue.length = 0;
}
