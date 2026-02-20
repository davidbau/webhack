import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { getSessionScreenAnsiLines, normalizeSession } from '../comparison/session_loader.js';

describe('session loader rngCalls', () => {

test('normalizeSession does not synthesize rngCalls from explicit rng traces', () => {
    const normalized = normalizeSession({
        version: 3,
        seed: 1,
        steps: [
            { key: null, action: 'startup', rng: [], screen: '' },
            { key: 's', action: 'search', rng: [], screen: '' },
            { key: 'h', action: 'move-west', rng: ['rn2(5)=1'], screen: '' },
        ],
    }, { file: 'tmp.session.json', dir: '.' });

    assert.equal(normalized.startup?.rngCalls, null);
    assert.equal(normalized.steps[0]?.rngCalls, null);
    assert.equal(normalized.steps[1]?.rngCalls, null);
});

test('normalizeSession preserves explicit rngCalls values', () => {
    const normalized = normalizeSession({
        version: 3,
        seed: 1,
        startup: { rngCalls: 0, screen: '' },
        steps: [
            { key: 's', action: 'search', rngCalls: 2, screen: '' },
        ],
    }, { file: 'tmp.session.json', dir: '.' });

    assert.equal(normalized.startup?.rngCalls, 0);
    assert.equal(normalized.steps[0]?.rngCalls, 2);
});

test('getSessionScreenAnsiLines prefers explicit screenAnsi over plain screen', () => {
    const lines = getSessionScreenAnsiLines({
        screen: ['plain-line'],
        screenAnsi: ['\u001b[31mred-line\u001b[0m'],
    });
    assert.deepEqual(lines, ['\u001b[31mred-line\u001b[0m']);
});

}); // describe
