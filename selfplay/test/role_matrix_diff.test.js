import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { compareRoleMatrix } from '../runner/c_role_matrix_diff.js';

function makeData(overrides = {}) {
    return {
        summary: {
            survived: 10,
            avgDepth: 1.5,
            reachedDepthGte3: 2,
            reachedXL2: 2,
            reachedXL3: 0,
            avgXP600: 8,
            reachedXP10By600: 4,
            reachedXP20By600: 1,
            avgFailedAdds: 30,
            avgAttackTurns: 100,
            avgFleeTurns: 20,
            avgPetSwaps: 25,
            ...overrides.summary,
        },
        groupedAssignments: overrides.groupedAssignments || [
            {
                role: 'Samurai',
                seed: 40,
                runs: 1,
                survived: 1,
                avgDepth: 1,
                avgXP600: 2,
                avgFailedAdds: 40,
            },
            {
                role: 'Wizard',
                seed: 43,
                runs: 1,
                survived: 1,
                avgDepth: 3,
                avgXP600: 20,
                avgFailedAdds: 10,
            },
        ],
        results: overrides.results || [
            {
                role: 'Samurai', seed: 40, repeat: 1,
                depth: 1, cause: 'survived', maxXP: 2, xp600: 2,
                attackTurns: 200, fleeTurns: 5, failedAdds: 40,
            },
            {
                role: 'Wizard', seed: 43, repeat: 1,
                depth: 3, cause: 'survived', maxXP: 20, xp600: 20,
                attackTurns: 10, fleeTurns: 25, failedAdds: 10,
            },
        ],
    };
}

describe('compareRoleMatrix', () => {
    it('passes guardrails when candidate is non-regressive', () => {
        const baseline = makeData();
        const candidate = makeData({
            summary: {
                survived: 10,
                avgDepth: 1.6,
                reachedDepthGte3: 2,
                reachedXL2: 2,
                avgXP600: 8.5,
                reachedXP10By600: 5,
                avgFailedAdds: 29,
            },
            groupedAssignments: [
                {
                    role: 'Samurai', seed: 40, runs: 1, survived: 1,
                    avgDepth: 1, avgXP600: 3, avgFailedAdds: 35,
                },
                {
                    role: 'Wizard', seed: 43, runs: 1, survived: 1,
                    avgDepth: 3, avgXP600: 20, avgFailedAdds: 10,
                },
            ],
            results: [
                {
                    role: 'Samurai', seed: 40, repeat: 1,
                    depth: 1, cause: 'survived', maxXP: 3, xp600: 3,
                    attackTurns: 180, fleeTurns: 10, failedAdds: 35,
                },
                {
                    role: 'Wizard', seed: 43, repeat: 1,
                    depth: 3, cause: 'survived', maxXP: 20, xp600: 20,
                    attackTurns: 10, fleeTurns: 25, failedAdds: 10,
                },
            ],
        });

        const out = compareRoleMatrix(baseline, candidate, { top: 3 });
        assert.equal(out.passed, true);
        assert.equal(out.guardrails.every(g => g.pass), true);
        assert.equal(out.runDiff.changedRuns, 1);
    });

    it('fails guardrails when candidate regresses depth/xp', () => {
        const baseline = makeData();
        const candidate = makeData({
            summary: {
                survived: 9,
                avgDepth: 1.2,
                reachedDepthGte3: 1,
                reachedXL2: 1,
                avgXP600: 6,
                reachedXP10By600: 2,
                avgFailedAdds: 40,
            },
        });

        const out = compareRoleMatrix(baseline, candidate);
        assert.equal(out.passed, false);
        const failing = out.guardrails.filter(g => !g.pass).map(g => g.key);
        assert.ok(failing.includes('survived'));
        assert.ok(failing.includes('avgDepth'));
        assert.ok(failing.includes('avgXP600'));
        assert.ok(failing.includes('avgFailedAdds'));
    });

    it('fails comparability guardrail when assignment sets differ', () => {
        const baseline = makeData();
        const candidate = makeData({
            groupedAssignments: [
                {
                    role: 'Samurai', seed: 40, runs: 1, survived: 1,
                    avgDepth: 1, avgXP600: 2, avgFailedAdds: 40,
                },
            ],
            results: [
                {
                    role: 'Samurai', seed: 40, repeat: 1,
                    depth: 1, cause: 'survived', maxXP: 2, xp600: 2,
                    attackTurns: 200, fleeTurns: 5, failedAdds: 40,
                },
            ],
        });

        const out = compareRoleMatrix(baseline, candidate);
        assert.equal(out.passed, false);
        const comparableGuard = out.guardrails.find(g => g.key === '__comparable');
        assert.ok(comparableGuard);
        assert.equal(comparableGuard.pass, false);
    });

    it('supports overlap-only comparisons for subset triage', () => {
        const baseline = makeData();
        const candidate = makeData({
            groupedAssignments: [
                {
                    role: 'Samurai', seed: 40, runs: 1, survived: 1,
                    avgDepth: 1, avgXP600: 3, avgFailedAdds: 35,
                },
            ],
            results: [
                {
                    role: 'Samurai', seed: 40, repeat: 1,
                    depth: 1, cause: 'survived', maxXP: 3, xp600: 3,
                    attackTurns: 180, fleeTurns: 10, failedAdds: 35,
                },
            ],
        });

        const out = compareRoleMatrix(baseline, candidate, { overlapOnly: true });
        assert.equal(out.passed, true);
        assert.equal(out.comparability.overlapAssignmentCount, 1);
        assert.equal(out.comparability.baselineAssignmentCount, 1);
        assert.equal(out.comparability.candidateAssignmentCount, 1);
        const comparableGuard = out.guardrails.find(g => g.key === '__comparable');
        assert.ok(comparableGuard);
        assert.equal(comparableGuard.pass, true);
        const xpGuard = out.guardrails.find(g => g.key === 'avgXP600');
        assert.ok(xpGuard);
        assert.equal(xpGuard.pass, true);
    });

    it('optionally fails on action-mix regression guardrails', () => {
        const baseline = makeData({
            summary: {
                avgAttackTurns: 100,
                avgFleeTurns: 20,
            },
        });
        const candidate = makeData({
            summary: {
                avgAttackTurns: 95,
                avgFleeTurns: 35, // regression
            },
        });

        const out = compareRoleMatrix(baseline, candidate, { includeActionGuardrails: true });
        assert.equal(out.passed, false);
        const fleeGuard = out.guardrails.find(g => g.key === 'avgFleeTurns');
        assert.ok(fleeGuard);
        assert.equal(fleeGuard.pass, false);
    });
});
