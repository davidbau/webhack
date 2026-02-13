import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    generateStartupWithRng,
    replaySession,
    compareRng,
} from '../comparison/session_helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sessionPath = join(__dirname, '../comparison/sessions/seed3_gameplay.session.json');
const session = existsSync(sessionPath)
    ? JSON.parse(readFileSync(sessionPath, 'utf-8'))
    : null;

describe('C gameplay replay: seed3 priest', { skip: !session }, () => {
    if (!session) return;

    it('fixture uses a distinct class (Priest)', () => {
        assert.equal(session.character?.role, 'Priest');
        assert.equal(session.character?.name, 'clara');
    });

    it('startup RNG matches C trace', () => {
        const startup = generateStartupWithRng(session.seed, session);
        assert.equal(startup.rngCalls, session.startup.rngCalls,
            `startup rngCalls JS=${startup.rngCalls} session=${session.startup.rngCalls}`);
        const divergence = compareRng(startup.rng, session.startup.rng);
        assert.equal(divergence.index, -1,
            `startup RNG diverges at ${divergence.index}: JS="${divergence.js}" session="${divergence.session}"`);
    });

    it('step RNG matches C trace for full session', async () => {
        const replay = await replaySession(session.seed, session);
        for (let i = 0; i < session.steps.length; i++) {
            const jsStep = replay.steps[i];
            const cStep = session.steps[i];
            assert.ok(jsStep, `Replay missing step ${i}`);
            const divergence = compareRng(jsStep.rng, cStep.rng);
            assert.equal(divergence.index, -1,
                `step ${i} (${cStep.action}) diverges at ${divergence.index}: JS="${divergence.js}" session="${divergence.session}"`);
        }
    });
});
