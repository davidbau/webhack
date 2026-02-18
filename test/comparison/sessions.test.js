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

function formatCallStack(stack) {
    if (!stack || stack.length === 0) return '';
    // Format: >innermost >outer >outermost (reverse order for display)
    return ' ' + stack.map(s => s.split(' @ ')[0]).reverse().join(' ');
}

function formatRngEntry(raw, stack) {
    if (!raw) return '(missing)';
    // Append call stack to the raw entry: rn2(5)=3 @ foo.c:32 >inner >outer
    const stackStr = formatCallStack(stack);
    return raw + stackStr;
}

function stringifyFirstDivergence(first) {
    if (!first) return null;
    if (first.channel === 'rng') {
        const header = `rng divergence at step=${first.step ?? 'n/a'} index=${first.index ?? 'n/a'}`;
        const jsVal = formatRngEntry(first.jsRaw || first.js || first.actual, first.jsStack);
        const sessionVal = formatRngEntry(first.sessionRaw || first.session || first.expected, first.sessionStack);
        return `${header}\n  js:      ${jsVal}\n  session: ${sessionVal}`;
    }
    if (first.channel === 'screen') {
        return `screen divergence at step=${first.step ?? 'n/a'} row=${first.row ?? 'n/a'}\n  js:      ${JSON.stringify(first.js ?? '')}\n  session: ${JSON.stringify(first.session ?? '')}`;
    }
    if (first.channel === 'color') {
        return `color divergence at step=${first.step ?? 'n/a'} row=${first.row ?? 'n/a'} col=${first.col ?? 'n/a'}\n  js:      ${JSON.stringify(first.js ?? {})}\n  session: ${JSON.stringify(first.session ?? {})}`;
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
