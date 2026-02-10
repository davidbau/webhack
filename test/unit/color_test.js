// Test color option behavior
import { test } from 'node:test';
import assert from 'node:assert';

// Import color constants
const CLR_GRAY = 7;
const CLR_RED = 1;
const CLR_GREEN = 2;
const CLR_BLUE = 4;
const CLR_YELLOW = 10;

// Simulate the color flag logic from display.js setCell()
function applyColorFlag(requestedColor, colorEnabled) {
    // When color=false, all colors become gray
    // When color=true (default), colors are preserved
    const displayColor = (colorEnabled !== false) ? requestedColor : CLR_GRAY;
    return displayColor;
}

test('color option - enabled preserves all colors', () => {
    assert.strictEqual(applyColorFlag(CLR_RED, true), CLR_RED, 'Red should remain red');
    assert.strictEqual(applyColorFlag(CLR_GREEN, true), CLR_GREEN, 'Green should remain green');
    assert.strictEqual(applyColorFlag(CLR_BLUE, true), CLR_BLUE, 'Blue should remain blue');
    assert.strictEqual(applyColorFlag(CLR_YELLOW, true), CLR_YELLOW, 'Yellow should remain yellow');
    assert.strictEqual(applyColorFlag(CLR_GRAY, true), CLR_GRAY, 'Gray should remain gray');
});

test('color option - disabled converts all to gray', () => {
    assert.strictEqual(applyColorFlag(CLR_RED, false), CLR_GRAY, 'Red should become gray');
    assert.strictEqual(applyColorFlag(CLR_GREEN, false), CLR_GRAY, 'Green should become gray');
    assert.strictEqual(applyColorFlag(CLR_BLUE, false), CLR_GRAY, 'Blue should become gray');
    assert.strictEqual(applyColorFlag(CLR_YELLOW, false), CLR_GRAY, 'Yellow should become gray');
    assert.strictEqual(applyColorFlag(CLR_GRAY, false), CLR_GRAY, 'Gray should remain gray');
});

test('color option - default (undefined) enables colors', () => {
    // When color flag is undefined, it should default to enabled
    assert.strictEqual(applyColorFlag(CLR_RED, undefined), CLR_RED,
        'Colors should be enabled by default');
    assert.strictEqual(applyColorFlag(CLR_BLUE, undefined), CLR_BLUE,
        'Colors should be enabled by default');
});

test('color option - explicit true enables colors', () => {
    assert.strictEqual(applyColorFlag(CLR_RED, true), CLR_RED, 'Red with color=true');
    assert.notStrictEqual(applyColorFlag(CLR_RED, true), CLR_GRAY, 'Should not be gray');
});

test('color option - explicit false disables all colors', () => {
    const colors = [CLR_RED, CLR_GREEN, CLR_BLUE, CLR_YELLOW, 1, 2, 3, 4, 5, 6];

    for (const color of colors) {
        if (color !== CLR_GRAY) {
            assert.strictEqual(applyColorFlag(color, false), CLR_GRAY,
                `Color ${color} should become gray when color=false`);
        }
    }
});

test('color option - monochrome mode accessibility', () => {
    // color=false provides monochrome display for accessibility
    const testColors = [CLR_RED, CLR_GREEN, CLR_BLUE, CLR_YELLOW];
    const monochromeResults = testColors.map(c => applyColorFlag(c, false));

    // All colors should be the same (gray) in monochrome mode
    const allSame = monochromeResults.every(c => c === CLR_GRAY);
    assert.ok(allSame, 'All colors should be gray in monochrome mode');
});
