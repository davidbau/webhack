import test from 'node:test';
import assert from 'node:assert/strict';

import { DOOR, D_CLOSED, ROOM } from '../../js/config.js';
import { HeadlessDisplay } from '../../js/headless_runtime.js';
import { GameMap } from '../../js/map.js';

test('headless renderMap keeps remembered terrain color', () => {
    const display = new HeadlessDisplay();
    const map = new GameMap();
    const x = 5;
    const y = 5;
    const row = y + 1; // map rows start at 1 when msg_window is disabled

    const loc = map.at(x, y);
    loc.typ = DOOR;
    loc.flags = D_CLOSED;
    loc.seenv = 0xff;

    const fov = { canSee: () => false };
    display.renderMap(map, null, fov, { msg_window: false, DECgraphics: false, color: true });

    assert.equal(display.grid[row][x], '+');
    assert.equal(display.colors[row][x], 3);
});

test('headless remembered room floors use NO_COLOR tone', () => {
    const display = new HeadlessDisplay();
    const map = new GameMap();
    const x = 6;
    const y = 6;
    const row = y + 1;

    const loc = map.at(x, y);
    loc.typ = ROOM;
    loc.seenv = 0xff;

    const fov = { canSee: () => false };
    display.renderMap(map, null, fov, { msg_window: false, DECgraphics: true, color: true });

    assert.equal(display.grid[row][x], '·');
    assert.equal(display.colors[row][x], 8);
    assert.match(display.getScreenAnsiLines()[row], /\u001b\[0;90;40m/);
});
