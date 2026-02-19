import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { replaySession } from '../../js/replay_core.js';
import { DEFAULT_FLAGS } from '../../js/storage.js';
import { normalizeSession } from '../comparison/session_loader.js';

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

test('replay defers sparse boundary RNG tail across zero-RNG frames (seed110 step 105)', async () => {
    const raw = JSON.parse(readFileSync('test/comparison/sessions/seed110_samurai_selfplay200.session.json', 'utf8'));
    const session = normalizeSession(raw, {
        file: 'seed110_samurai_selfplay200.session.json',
        dir: 'test/comparison/sessions',
    });

    const prevTags = process.env.RNG_LOG_TAGS;
    process.env.RNG_LOG_TAGS = '1';
    try {
        const replay = await replaySession(session.meta.seed, session.raw, {
            captureScreens: true,
            startupBurstInFirstStep: false,
            flags: { ...DEFAULT_FLAGS, bgcolors: true, customcolors: true },
        });

        const expected105 = comparable(session.steps[105]?.rng || []);
        const actual105 = comparable(replay.steps[105]?.rng || []);
        assert.deepEqual(actual105, expected105);

        const expected108 = comparable(session.steps[108]?.rng || []);
        const actual108 = comparable(replay.steps[108]?.rng || []);
        assert.ok(actual108.length > 0);
        assert.equal(actual108[0], expected108[0]);
    } finally {
        if (prevTags === undefined) delete process.env.RNG_LOG_TAGS;
        else process.env.RNG_LOG_TAGS = prevTags;
    }
});

test('replay accumulates sparse boundary carries targeting the same step (seed5 462->464)', async () => {
    const raw = JSON.parse(readFileSync('test/comparison/sessions/seed5_gnomish_mines_gameplay.session.json', 'utf8'));
    const session = normalizeSession(raw, {
        file: 'seed5_gnomish_mines_gameplay.session.json',
        dir: 'test/comparison/sessions',
    });

    const prevTags = process.env.RNG_LOG_TAGS;
    process.env.RNG_LOG_TAGS = '1';
    try {
        const replay = await replaySession(session.meta.seed, session.raw, {
            captureScreens: true,
            startupBurstInFirstStep: false,
            flags: { ...DEFAULT_FLAGS, bgcolors: true, customcolors: true },
        });

        const expected462 = comparable(session.steps[462]?.rng || []);
        const actual462 = comparable(replay.steps[462]?.rng || []);
        assert.deepEqual(actual462, expected462);

        const expected463 = comparable(session.steps[463]?.rng || []);
        const actual463 = comparable(replay.steps[463]?.rng || []);
        assert.deepEqual(actual463, expected463);

        const expected464 = comparable(session.steps[464]?.rng || []);
        const actual464 = comparable(replay.steps[464]?.rng || []);
        assert.deepEqual(actual464, expected464);
    } finally {
        if (prevTags === undefined) delete process.env.RNG_LOG_TAGS;
        else process.env.RNG_LOG_TAGS = prevTags;
    }
});
