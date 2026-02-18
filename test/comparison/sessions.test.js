/**
 * Session Tests - Node.js test runner wrapper
 *
 * Runs session_test_runner.js via runSessionBundle and reports
 * one subtest per session with detailed divergence output.
 */

import { describe, test } from 'node:test';
import { runSessionBundle } from './session_test_runner.js';

const TYPE_GROUPS = [
    'chargen',
    'interface',
    'map',
    'gameplay',
    'special',
    'other',
];

const resultsByType = new Map();
const errorsByType = new Map();

async function loadTypeResults(type) {
    if (resultsByType.has(type) || errorsByType.has(type)) return;
    try {
        const bundle = await runSessionBundle({
            verbose: false,
            useGolden: false,
            typeFilter: type,
        });
        const rows = (bundle?.results || []).filter((r) => (r.type || 'other') === type);
        resultsByType.set(type, rows);
    } catch (e) {
        errorsByType.set(type, e);
    }
}

function formatContext(contextBefore, contextAfter, jsVal, sessionVal) {
    const lines = [];
    // Show context before (last 3 matching calls)
    if (contextBefore?.js?.length > 0) {
        const before = contextBefore.js.slice(-3);
        lines.push(`  before: ${before.join(' → ')}`);
    }
    // Show the divergence point
    lines.push(`  js:      ${jsVal || '(missing)'}`);
    lines.push(`  session: ${sessionVal || '(missing)'}`);
    // Show context after (next 3 calls)
    if (contextAfter?.js?.length > 0) {
        const after = contextAfter.js.slice(0, 3);
        lines.push(`  after:  ${after.join(' → ')}`);
    }
    return lines.join('\n');
}

function stringifyFirstDivergence(first) {
    if (!first) return null;
    if (first.channel === 'rng') {
        const header = `rng divergence at step=${first.step ?? 'n/a'} index=${first.index ?? 'n/a'}`;
        if (first.contextBefore || first.contextAfter) {
            return `${header}\n${formatContext(first.contextBefore, first.contextAfter, first.js ?? first.actual, first.session ?? first.expected)}`;
        }
        return `${header}: js=${first.js ?? first.actual ?? ''} session=${first.session ?? first.expected ?? ''}`;
    }
    if (first.channel === 'screen') {
        return `screen divergence at step=${first.step ?? 'n/a'} row=${first.row ?? 'n/a'}\n  js:      ${JSON.stringify(first.js ?? '')}\n  session: ${JSON.stringify(first.session ?? '')}`;
    }
    if (first.channel === 'grid') {
        return `grid divergence at depth=${first.depth ?? 'n/a'} (${first.x ?? 'n/a'},${first.y ?? 'n/a'}): js=${first.js ?? ''} session=${first.session ?? ''}`;
    }
    return JSON.stringify(first);
}

function getErrorMessage(r) {
    const parts = [];
    if (r.error) parts.push(`error: ${r.error}`);
    if (r.firstDivergence) parts.push(stringifyFirstDivergence(r.firstDivergence));
    if (r.firstDivergences) {
        for (const [channel, value] of Object.entries(r.firstDivergences)) {
            if (channel === r.firstDivergence?.channel) continue;
            parts.push(stringifyFirstDivergence({ channel, ...value }));
        }
    }
    if (r.failedLevels) parts.push(`failed levels: ${r.failedLevels.join(', ')}`);
    parts.push(`metrics: ${JSON.stringify(r.metrics || {})}`);
    return parts.filter(Boolean).join('\n');
}

describe('Session Tests', () => {
    for (const type of TYPE_GROUPS) {
        describe(`${type} sessions`, () => {
            test(`${type} tests`, async (t) => {
                await loadTypeResults(type);
                if (errorsByType.has(type)) throw errorsByType.get(type);
                const rows = resultsByType.get(type) || [];
                if (rows.length === 0) return t.skip(`No ${type} sessions`);

                for (const r of rows) {
                    await t.test(r.session, () => {
                        if (!r.passed) {
                            const err = new Error(getErrorMessage(r));
                            err.stack = ''; // Suppress useless stack trace
                            throw err;
                        }
                    });
                }
            });
        });
    }
});
