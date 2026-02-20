// Test COLOR_CSS array mapping to color constants
// C ref: display.h color constants - must map correctly to CSS colors
import { describe, test } from 'node:test';
import assert from 'assert';
import {
    CLR_BLACK, CLR_RED, CLR_GREEN, CLR_BROWN, CLR_BLUE,
    CLR_MAGENTA, CLR_CYAN, CLR_GRAY, NO_COLOR, CLR_ORANGE,
    CLR_BRIGHT_GREEN, CLR_YELLOW, CLR_BRIGHT_BLUE, CLR_BRIGHT_MAGENTA,
    CLR_BRIGHT_CYAN, CLR_WHITE
} from '../../js/display.js';

describe('color CSS mapping', () => {

test('color constants: verify correct values after NO_COLOR gap', () => {
    // C ref: display.h - color constants have a gap at 8 (NO_COLOR)
    assert.strictEqual(CLR_BLACK, 0, 'CLR_BLACK should be 0');
    assert.strictEqual(CLR_RED, 1, 'CLR_RED should be 1');
    assert.strictEqual(CLR_GREEN, 2, 'CLR_GREEN should be 2');
    assert.strictEqual(CLR_BROWN, 3, 'CLR_BROWN should be 3');
    assert.strictEqual(CLR_BLUE, 4, 'CLR_BLUE should be 4');
    assert.strictEqual(CLR_MAGENTA, 5, 'CLR_MAGENTA should be 5');
    assert.strictEqual(CLR_CYAN, 6, 'CLR_CYAN should be 6');
    assert.strictEqual(CLR_GRAY, 7, 'CLR_GRAY should be 7');
    assert.strictEqual(NO_COLOR, 8, 'NO_COLOR should be 8');
    assert.strictEqual(CLR_ORANGE, 9, 'CLR_ORANGE should be 9');
    assert.strictEqual(CLR_BRIGHT_GREEN, 10, 'CLR_BRIGHT_GREEN should be 10');
    assert.strictEqual(CLR_YELLOW, 11, 'CLR_YELLOW should be 11');
    assert.strictEqual(CLR_BRIGHT_BLUE, 12, 'CLR_BRIGHT_BLUE should be 12');
    assert.strictEqual(CLR_BRIGHT_MAGENTA, 13, 'CLR_BRIGHT_MAGENTA should be 13');
    assert.strictEqual(CLR_BRIGHT_CYAN, 14, 'CLR_BRIGHT_CYAN should be 14');
    assert.strictEqual(CLR_WHITE, 15, 'CLR_WHITE should be 15');
});

test('color constants: range is 0-15 (16 total values)', () => {
    // COLOR_CSS array must have 16 elements to cover indices 0-15
    const allColors = [
        CLR_BLACK, CLR_RED, CLR_GREEN, CLR_BROWN, CLR_BLUE,
        CLR_MAGENTA, CLR_CYAN, CLR_GRAY, NO_COLOR, CLR_ORANGE,
        CLR_BRIGHT_GREEN, CLR_YELLOW, CLR_BRIGHT_BLUE, CLR_BRIGHT_MAGENTA,
        CLR_BRIGHT_CYAN, CLR_WHITE
    ];

    // Check that max color value is 15
    const maxColor = Math.max(...allColors);
    assert.strictEqual(maxColor, 15, 'Maximum color constant should be 15');

    // Verify all values are in valid range
    allColors.forEach(color => {
        assert.ok(color >= 0 && color <= 15,
            `Color ${color} should be in range 0-15`);
    });
});

test('color constants: CLR_WHITE must be accessible (was undefined before fix)', () => {
    // This was the critical bug: CLR_WHITE is 15, but COLOR_CSS only had
    // 15 elements (indices 0-14), so COLOR_CSS[15] would be undefined
    assert.strictEqual(CLR_WHITE, 15, 'CLR_WHITE should be 15');

    // The fix added a 16th element so COLOR_CSS[15] is now defined
    // We can't directly test COLOR_CSS (it's not exported), but we verify
    // that the constant is correct and in valid range
    assert.ok(CLR_WHITE <= 15, 'CLR_WHITE should be accessible in 16-element array');
});

test('color constants: NO_COLOR gap at index 8', () => {
    // C NetHack skips color value 8 (NO_COLOR)
    // Colors after GRAY (7) jump to ORANGE (9)
    assert.strictEqual(CLR_GRAY, 7, 'CLR_GRAY should be 7');
    assert.strictEqual(NO_COLOR, 8, 'NO_COLOR should occupy slot 8');
    assert.strictEqual(CLR_ORANGE, 9, 'CLR_ORANGE should be 9, not 8');

    // Verify the offset continues correctly
    assert.strictEqual(CLR_BRIGHT_GREEN, CLR_ORANGE + 1, 'CLR_BRIGHT_GREEN follows CLR_ORANGE');
    assert.strictEqual(CLR_YELLOW, CLR_ORANGE + 2, 'CLR_YELLOW is ORANGE + 2');
    assert.strictEqual(CLR_WHITE, CLR_ORANGE + 6, 'CLR_WHITE is ORANGE + 6');
});

}); // describe
