import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createHeadlessGame } from '../../js/headless_runtime.js';

describe('status hunger satiated', () => {

test('status line shows Satiated when hunger is above satiation threshold', () => {
    const game = createHeadlessGame(1, 11, { wizard: true });
    game.player.hunger = 1201;
    game.renderCurrentScreen();
    const line2 = (game.display.getScreenLines() || [])[23] || '';
    assert.match(line2, /\bSatiated\b/);
});

}); // describe
