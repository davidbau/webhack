import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { HeadlessDisplay } from '../../js/headless_runtime.js';

describe('headless overlay header attr', () => {

test('headless overlay menu renders first header line in inverse video', () => {
    const display = new HeadlessDisplay();
    const offx = display.renderOverlayMenu([
        ' Weapons',
        'a - a weapon',
        ' Armor',
        'b - an armor piece',
    ]);

    assert.equal(display.attrs[0][offx], 0);
    assert.equal(display.attrs[0][offx + 1], 1);
    assert.equal(display.attrs[1][offx], 0);
    assert.equal(display.attrs[2][offx], 0);
    assert.equal(display.attrs[2][offx + 1], 1);
});

test('headless overlay menu caps right-side offset at C tty max column', () => {
    const display = new HeadlessDisplay();
    const offx = display.renderOverlayMenu([
        'Coins',
        '$ - 33 gold pieces',
        'Weapons',
        'a - 10 darts (weapon in right hand)',
        '(end)',
    ]);

    assert.equal(offx, 41);
    assert.equal(display.grid[0][41], 'C');
});

}); // describe
