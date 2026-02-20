import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { replaySession } from '../../js/replay_core.js';
import { DEFAULT_FLAGS } from '../../js/storage.js';
import { normalizeSession } from '../comparison/session_loader.js';

describe('replay sparse boundary seed208', () => {

function comparable(entries) {
    const out = [];
    for (const raw of (entries || [])) {
        if (typeof raw !== 'string') continue;
        const at = raw.indexOf(' @ ');
        const norm = at >= 0 ? raw.slice(0, at) : raw;
        if (!norm || norm.startsWith('>') || norm.startsWith('<') || norm.startsWith('~')) continue;
        if (norm.startsWith('rne(') || norm.startsWith('rnz(') || norm.startsWith('d(')) continue;
        out.push(norm.replace(/=\d+$/, ''));
    }
    return out;
}

function normalizeRow(line) {
    return String(line || '').replace(/[\x00-\x1f\x7f]/g, '');
}

test('replay keeps sparse stop_occupation boundary frame state (seed208 step 263)', async () => {
    const raw = JSON.parse(readFileSync('test/comparison/sessions/seed208_ranger_wizard.session.json', 'utf8'));
    const session = normalizeSession(raw, {
        file: 'seed208_ranger_wizard.session.json',
        dir: 'test/comparison/sessions',
    });

    const replay = await replaySession(session.meta.seed, session.raw, {
        captureScreens: true,
        startupBurstInFirstStep: false,
        maxSteps: 264,
        flags: { ...DEFAULT_FLAGS, bgcolors: true, customcolors: true, customsymbols: true },
    });

    // normalizeSession strips startup, so raw step 263 maps to session/replay index 262.
    const expected263 = session.steps[262];
    const actual263 = replay.steps[262];

    assert.deepEqual(comparable(actual263?.rng || []), comparable(expected263?.rng || []));
    assert.equal(
        normalizeRow(actual263?.screen?.[6] || ''),
        normalizeRow(expected263?.screen?.[6] || ''),
    );
});

}); // describe
