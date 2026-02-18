import test from 'node:test';
import assert from 'node:assert/strict';

import { HeadlessDisplay } from '../../js/headless_runtime.js';

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
