// browser_input.js -- Browser-specific keyboard input handling
// This module handles DOM keyboard events and integrates with the core input queue.
// Phase 2 refactor: Separated from input.js to keep core environment-agnostic.

import { pushInput, getInputFlags } from './input.js';

/**
 * Initialize browser keyboard listener.
 * Sets up DOM event handlers that push keys to the shared input queue.
 * C ref: replaces tty input initialization in win/tty/wintty.c
 */
export function initBrowserInput() {
    document.addEventListener('keydown', handleKeyDown);
}

/**
 * Handle keyboard events and translate to NetHack key codes.
 * Supports: vi keys, arrow keys, numpad, Ctrl/Alt modifiers, etc.
 */
function handleKeyDown(e) {
    // Ignore modifier-only keys
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
        return;
    }

    let ch = null;
    const flags = getInputFlags();

    // Handle numeric keypad in number_pad mode
    // C ref: cmd.c number_pad handling - digits 1-9,0 map to directions + inventory
    // Standard layout: 7=NW 8=N 9=NE 4=W 5=. 6=E 1=SW 2=S 3=SE 0=i
    if (flags?.number_pad && e.location === KeyboardEvent.DOM_KEY_LOCATION_NUMPAD) {
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
    else if (e.key === ' ' && flags?.rest_on_space) {
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

/**
 * Create a browser input adapter that can be passed to deps.input.
 * This sets up DOM listeners and provides the standard input interface.
 */
export function createBrowserInput() {
    // Initialize DOM listeners
    initBrowserInput();

    // Return an adapter interface (for future use when we fully inject input)
    return {
        // Currently the browser uses the shared module-level queue in input.js
        // This adapter interface is for future phases when input is fully injected
        type: 'browser',
    };
}
