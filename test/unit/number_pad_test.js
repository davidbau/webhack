// Test number_pad option behavior
import { test } from 'node:test';
import assert from 'node:assert';

// Simulate the numpad handling logic from input.js
function handleNumpadKey(key, number_pad, isNumpad = true) {
    // Set global flag like the game does
    globalThis.window = { gameFlags: { number_pad } };

    let ch = null;

    // Handle numeric keypad in number_pad mode
    // C ref: cmd.c number_pad handling - digits 1-9,0 map to directions + inventory
    // Standard layout: 7=NW 8=N 9=NE 4=W 5=. 6=E 1=SW 2=S 3=SE 0=i
    if (window.gameFlags?.number_pad && isNumpad) {
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
        if (key in numpadMap) {
            ch = numpadMap[key];
            return ch;
        }
    }

    // Regular digit handling (when number_pad is off or not from numpad)
    if (key.length === 1) {
        ch = key.charCodeAt(0);
    }

    return ch;
}

test('number_pad - movement keys mapped correctly', () => {
    // Northwest, north, northeast
    assert.strictEqual(String.fromCharCode(handleNumpadKey('7', true)), 'y', 'Numpad 7 → y (NW)');
    assert.strictEqual(String.fromCharCode(handleNumpadKey('8', true)), 'k', 'Numpad 8 → k (N)');
    assert.strictEqual(String.fromCharCode(handleNumpadKey('9', true)), 'u', 'Numpad 9 → u (NE)');

    // West, rest, east
    assert.strictEqual(String.fromCharCode(handleNumpadKey('4', true)), 'h', 'Numpad 4 → h (W)');
    assert.strictEqual(String.fromCharCode(handleNumpadKey('5', true)), '.', 'Numpad 5 → . (rest)');
    assert.strictEqual(String.fromCharCode(handleNumpadKey('6', true)), 'l', 'Numpad 6 → l (E)');

    // Southwest, south, southeast
    assert.strictEqual(String.fromCharCode(handleNumpadKey('1', true)), 'b', 'Numpad 1 → b (SW)');
    assert.strictEqual(String.fromCharCode(handleNumpadKey('2', true)), 'j', 'Numpad 2 → j (S)');
    assert.strictEqual(String.fromCharCode(handleNumpadKey('3', true)), 'n', 'Numpad 3 → n (SE)');
});

test('number_pad - inventory key mapped', () => {
    assert.strictEqual(String.fromCharCode(handleNumpadKey('0', true)), 'i',
        'Numpad 0 → i (inventory)');
});

test('number_pad - disabled does not map keys', () => {
    // When number_pad is off, numpad keys should remain digits
    assert.strictEqual(String.fromCharCode(handleNumpadKey('7', false)), '7',
        'Numpad 7 stays 7 when disabled');
    assert.strictEqual(String.fromCharCode(handleNumpadKey('5', false)), '5',
        'Numpad 5 stays 5 when disabled');
    assert.strictEqual(String.fromCharCode(handleNumpadKey('0', false)), '0',
        'Numpad 0 stays 0 when disabled');
});

test('number_pad - regular digit keys unaffected', () => {
    // Regular keyboard digits should not be affected by number_pad option
    assert.strictEqual(String.fromCharCode(handleNumpadKey('7', true, false)), '7',
        'Regular 7 stays 7 even when number_pad enabled');
    assert.strictEqual(String.fromCharCode(handleNumpadKey('5', true, false)), '5',
        'Regular 5 stays 5 even when number_pad enabled');
});

test('number_pad - complete directional coverage', () => {
    // Verify all 8 directions are covered
    const directions = {
        '7': 'y', // NW
        '8': 'k', // N
        '9': 'u', // NE
        '4': 'h', // W
        '6': 'l', // E
        '1': 'b', // SW
        '2': 'j', // S
        '3': 'n', // SE
    };

    for (const [numpadKey, viKey] of Object.entries(directions)) {
        const result = String.fromCharCode(handleNumpadKey(numpadKey, true));
        assert.strictEqual(result, viKey,
            `Numpad ${numpadKey} should map to ${viKey}`);
    }
});

test('number_pad - standard NetHack numpad layout', () => {
    // Verify this matches standard NetHack numpad layout:
    //   7 8 9
    //   4 5 6
    //   1 2 3
    //     0
    //
    // Maps to:
    //   y k u
    //   h . l
    //   b j n
    //     i

    const layout = [
        ['7', 'y'], ['8', 'k'], ['9', 'u'],
        ['4', 'h'], ['5', '.'], ['6', 'l'],
        ['1', 'b'], ['2', 'j'], ['3', 'n'],
        ['0', 'i']
    ];

    for (const [num, cmd] of layout) {
        assert.strictEqual(String.fromCharCode(handleNumpadKey(num, true)), cmd,
            `Numpad layout: ${num} → ${cmd}`);
    }
});
