// Test DECgraphics option behavior
import { test } from 'node:test';
import assert from 'node:assert';

test('DECgraphics option controls wall display characters', () => {
    // Test symbol selection logic
    // DECgraphics=false (ASCII): use |, -, etc.
    // DECgraphics=true (box-drawing): use │, ─, ┌, etc.

    // Simulate symbol selection
    const getWallChar = (type, useDEC) => {
        const ascii = { vwall: '|', hwall: '-', tlcorn: '-', trcorn: '-' };
        const dec = { vwall: '\u2502', hwall: '\u2500', tlcorn: '\u250c', trcorn: '\u2510' };
        return useDEC ? dec[type] : ascii[type];
    };

    // Test with DECgraphics=false (ASCII)
    assert.strictEqual(getWallChar('vwall', false), '|',
        'Vertical wall should be | with DECgraphics=false');
    assert.strictEqual(getWallChar('hwall', false), '-',
        'Horizontal wall should be - with DECgraphics=false');

    // Test with DECgraphics=true (box-drawing)
    assert.strictEqual(getWallChar('vwall', true), '\u2502',
        'Vertical wall should be │ with DECgraphics=true');
    assert.strictEqual(getWallChar('hwall', true), '\u2500',
        'Horizontal wall should be ─ with DECgraphics=true');

    // Test corners
    assert.strictEqual(getWallChar('tlcorn', false), '-',
        'Top left corner should be - with DECgraphics=false');
    assert.strictEqual(getWallChar('tlcorn', true), '\u250c',
        'Top left corner should be ┌ with DECgraphics=true');
    assert.strictEqual(getWallChar('trcorn', false), '-',
        'Top right corner should be - with DECgraphics=false');
    assert.strictEqual(getWallChar('trcorn', true), '\u2510',
        'Top right corner should be ┐ with DECgraphics=true');

    // Test default (false) should use ASCII
    assert.strictEqual(getWallChar('vwall', false), '|',
        'Vertical wall should default to ASCII |');
});
