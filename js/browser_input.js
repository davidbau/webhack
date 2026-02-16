// browser_input.js -- Browser adapter for keyboard input.
// Wires DOM keydown events into the runtime-agnostic input queue.

import { createInputQueue, setInputRuntime } from './input.js';

/**
 * Convert a browser KeyboardEvent to NetHack char code.
 * Returns null when the key should be ignored.
 */
export function mapBrowserKeyToNhCode(e, flags = {}) {
    // Ignore modifier-only keys
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
        return null;
    }

    // Handle numeric keypad in number_pad mode
    // C ref: cmd.c number_pad handling - digits 1-9,0 map to directions + inventory
    // Standard layout: 7=NW 8=N 9=NE 4=W 5=. 6=E 1=SW 2=S 3=SE 0=i
    const DOM_KEY_LOCATION_NUMPAD = (typeof KeyboardEvent !== 'undefined')
        ? KeyboardEvent.DOM_KEY_LOCATION_NUMPAD
        : 3;
    if (flags?.number_pad && e.location === DOM_KEY_LOCATION_NUMPAD) {
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
            return numpadMap[e.key];
        }
    }

    // Handle Ctrl+key combinations
    // C ref: cmd.c uses C('x') which is (x & 0x1f)
    if (e.ctrlKey && !e.altKey && !e.metaKey) {
        const code = e.key.toLowerCase().charCodeAt(0);
        if (code >= 97 && code <= 122) { // a-z
            return code - 96; // Ctrl+A = 1, Ctrl+Z = 26
        }
    }
    // Handle Meta (Alt) key combinations
    // C ref: cmd.c uses M('x') which is (x | 0x80)
    else if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key.length === 1) {
            return e.key.charCodeAt(0) | 0x80;
        }
    }
    // Handle Escape
    else if (e.key === 'Escape') {
        return 27; // ESC
    }
    // Handle Enter
    else if (e.key === 'Enter') {
        return 13; // CR
    }
    // Handle Backspace
    else if (e.key === 'Backspace') {
        return 8;
    }
    // Handle space bar with rest_on_space option
    // C ref: flag.h flags.rest_on_space - space triggers rest/wait command
    else if (e.key === ' ' && flags?.rest_on_space) {
        return '.'.charCodeAt(0); // Convert space to period (rest)
    }
    // Handle regular character keys
    else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        return e.key.charCodeAt(0);
    }
    // Handle arrow keys -> vi movement keys
    else if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        switch (e.key) {
            case 'ArrowLeft':  return 'h'.charCodeAt(0);
            case 'ArrowDown':  return 'j'.charCodeAt(0);
            case 'ArrowUp':    return 'k'.charCodeAt(0);
            case 'ArrowRight': return 'l'.charCodeAt(0);
            case 'Home':       return 'y'.charCodeAt(0);
            case 'End':        return 'b'.charCodeAt(0);
            case 'PageUp':     return 'K'.charCodeAt(0); // run up
            case 'PageDown':   return 'J'.charCodeAt(0); // run down
        }
    }

    return null;
}

export function createBrowserInput({ getFlags, getDisplay } = {}) {
    const runtime = createInputQueue();
    runtime.getDisplay = () => (typeof getDisplay === 'function' ? getDisplay() : null);

    const flagsGetter = (typeof getFlags === 'function') ? getFlags : (() => null);
    const keydownHandler = (e) => {
        const ch = mapBrowserKeyToNhCode(e, flagsGetter() || {});
        if (ch !== null) {
            e.preventDefault();
            runtime.pushInput(ch);
        }
    };

    return {
        ...runtime,
        install() {
            document.addEventListener('keydown', keydownHandler);
        },
        uninstall() {
            document.removeEventListener('keydown', keydownHandler);
        },
    };
}

let browserRuntime = null;
let browserInstalled = false;

export function initBrowserInput(opts = {}) {
    if (!browserRuntime) {
        browserRuntime = createBrowserInput(opts);
    }
    if (!browserInstalled) {
        browserRuntime.install();
        browserInstalled = true;
    }
    setInputRuntime(browserRuntime);
    return browserRuntime;
}
