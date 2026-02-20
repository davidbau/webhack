import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { STAIRS } from '../../js/config.js';
import { HeadlessDisplay } from '../../js/headless_runtime.js';
import { GameMap } from '../../js/map.js';

describe('stairs color', () => {

test('headless stairs colors match C capture convention', () => {
    const display = new HeadlessDisplay();
    const map = new GameMap();
    const fov = { canSee: () => true };

    const up = map.at(10, 5);
    up.typ = STAIRS;
    up.flags = 1;

    const down = map.at(12, 5);
    down.typ = STAIRS;
    down.flags = 0;

    display.renderMap(map, null, fov, { msg_window: false, DECgraphics: false, color: true });

    const row = 6; // map row offset (y + 1)
    assert.equal(display.grid[row][9], '<');
    assert.equal(display.colors[row][9], 11);
    assert.equal(display.grid[row][11], '>');
    assert.equal(display.colors[row][11], 7);
});

}); // describe
