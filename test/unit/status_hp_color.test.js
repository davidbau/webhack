import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { HeadlessDisplay } from '../../js/headless_runtime.js';

describe('status HP color', () => {

function makePlayer(hp, hpmax) {
    return {
        name: 'tester',
        level: 1,
        roleIndex: 0,
        gender: 0,
        strDisplay: '10',
        attributes: [0, 10, 10, 10, 10, 10],
        alignment: 0,
        inTutorial: false,
        dungeonLevel: 1,
        gold: 0,
        hp,
        hpmax,
        pw: 1,
        pwmax: 1,
        ac: 10,
        showExp: false,
        showTime: false,
        hunger: 900,
    };
}

test('headless status HP text stays gray by default', () => {
    const display = new HeadlessDisplay();
    const player = makePlayer(2, 20);
    display.flags.hitpointbar = false;
    display.renderStatus(player);
    const row = display.colors[23];
    const hpStart = 'Dlvl:1 $:0 '.length;
    assert.equal(row[hpStart], 7);
});

test('headless status HP text highlights when hitpointbar is enabled', () => {
    const display = new HeadlessDisplay();
    const player = makePlayer(2, 20);
    display.flags.hitpointbar = true;
    display.renderStatus(player);
    const row = display.colors[23];
    const hpStart = 'Dlvl:1 $:0 '.length;
    assert.notEqual(row[hpStart], 7);
});

}); // describe
