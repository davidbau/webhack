import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { replaySession } from '../../js/replay_core.js';
import { DEFAULT_FLAGS } from '../../js/storage.js';
import { loadAllSessions } from '../comparison/session_loader.js';

describe('monster throw no spurious you kill seed110', () => {

test('seed110 throw topline does not claim player killed pet', async () => {
    const session = loadAllSessions({
        sessionPath: 'test/comparison/sessions/seed110_samurai_selfplay200.session.json',
    })[0];

    const replayFlags = { ...DEFAULT_FLAGS };
    replayFlags.color = session.meta.options?.color !== false;
    replayFlags.verbose = (session.meta.options?.verbose === true);
    if (session.meta.options?.autopickup === false) replayFlags.pickup = false;
    if (session.meta.options?.symset === 'DECgraphics') replayFlags.DECgraphics = true;
    replayFlags.bgcolors = true;
    replayFlags.customcolors = true;
    replayFlags.customsymbols = true;
    if (replayFlags.DECgraphics) {
        replayFlags.symset = 'DECgraphics, active, handler=DEC';
    }

    const replay = await replaySession(session.meta.seed, session.raw, {
        captureScreens: true,
        startupBurstInFirstStep: false,
        flags: replayFlags,
    });

    const step = 105;
    assert.equal(replay.steps[step].screen[0], session.steps[step].screen[0]);
    assert.equal(replay.steps[step].screen[0].includes('You kill the Hachi!'), false);
});

}); // describe
