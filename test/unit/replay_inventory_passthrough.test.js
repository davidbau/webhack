import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { replaySession } from '../../js/replay_core.js';

describe('replay inventory modal handling', () => {
    it('keeps inventory open on non-space keys in replay', async () => {
        const session = {
            version: 3,
            seed: 1,
            options: {
                name: 'Wizard',
                role: 'Valkyrie',
                race: 'human',
                gender: 'female',
                align: 'neutral',
            },
            steps: [
                { key: null, action: 'startup', rng: [], screen: [] },
                { key: 'i', action: 'inventory', rng: [], screen: [] },
                { key: 's', action: 'search', rng: [], screen: [] },
            ],
        };

        const replay = await replaySession(1, session, {
            captureScreens: true,
            startupBurstInFirstStep: false,
        });

        assert.equal(replay.steps.length, 2);
        assert.match((replay.steps[0].screen || [])[0] || '', /Weapons/);
        assert.match((replay.steps[1].screen || [])[0] || '', /Weapons/);
        assert.equal(replay.steps[1].rngCalls || 0, 0);
    });

    it('does not passthrough Enter after dismissing inventory', async () => {
        const session = {
            version: 3,
            seed: 1,
            options: {
                name: 'Wizard',
                role: 'Valkyrie',
                race: 'human',
                gender: 'female',
                align: 'neutral',
            },
            steps: [
                { key: null, action: 'startup', rng: [], screen: [] },
                { key: 'i', action: 'inventory', rng: [], screen: [] },
                { key: '\n', action: 'key-', rng: [], screen: [] },
            ],
        };

        const replay = await replaySession(1, session, {
            captureScreens: true,
            startupBurstInFirstStep: false,
        });

        assert.equal(replay.steps.length, 2);
        assert.equal(replay.steps[1].rngCalls || 0, 0);
        assert.doesNotMatch((replay.steps[1].screen || [])[0] || '', /Unknown command|You see no|Do what|Weapons/);
    });

    it('transitions inventory dismissal to look search prompt on ":"', async () => {
        const session = {
            version: 3,
            seed: 42,
            options: {
                name: 'Wizard',
                role: 'Valkyrie',
                race: 'human',
                gender: 'female',
                align: 'neutral',
            },
            steps: [
                {
                    key: null,
                    action: 'startup',
                    rng: [],
                    screen: ['Map dumped to /tmp/webhack-session-test/dumpmap.txt.'],
                },
                {
                    key: 'i',
                    action: 'inventory',
                    rng: [],
                    screen: ['                     Weapons'],
                },
                {
                    key: ':',
                    action: 'look',
                    rng: [],
                    screen: ['Search for:'],
                },
            ],
        };

        const replay = await replaySession(42, session, {
            captureScreens: true,
            startupBurstInFirstStep: false,
        });

        assert.equal(replay.steps.length, 2);
        assert.match((replay.steps[0].screen || [])[0] || '', /Weapons/);
        assert.equal((replay.steps[1].screen || [])[0] || '', 'Search for:');
        assert.equal(replay.steps[1].rngCalls || 0, 0);
    });
});
