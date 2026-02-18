/**
 * Session Tests - Node.js test runner wrapper
 *
 * Runs all sessions in a single parallel pool via runSessionBundle,
 * then groups results by category for reporting.
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

function formatCallStack(stack) {
    if (!stack || stack.length === 0) return '';
    return ' ' + stack.map(s => s.split(' @ ')[0]).reverse().join(' ');
}

function formatRngEntry(raw, stack) {
    if (!raw) return '(missing)';
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

function classifyFailureModes(result) {
    const modes = new Set();
    if (result?.firstDivergence?.channel) modes.add(result.firstDivergence.channel);
    if (result?.firstDivergences) {
        for (const channel of Object.keys(result.firstDivergences)) {
            modes.add(channel);
        }
    }
    if (result?.failedLevels?.length) modes.add('levels');
    if (result?.error) {
        const msg = String(result.error).toLowerCase();
        if (msg.includes('bigint')) modes.add('runtime:bigint');
        else modes.add('error');
    }
    if (modes.size === 0) modes.add('unknown');
    return [...modes];
}

function summarizeRows(rows) {
    const summary = {
        total: rows.length,
        passed: 0,
        failed: 0,
        modes: new Map(),
    };
    for (const row of rows) {
        if (row.passed) {
            summary.passed++;
            continue;
        }
        summary.failed++;
        for (const mode of classifyFailureModes(row)) {
            summary.modes.set(mode, (summary.modes.get(mode) || 0) + 1);
        }
    }
    return summary;
}

function formatFailureModes(modeMap) {
    if (!modeMap || modeMap.size === 0) return '-';
    return [...modeMap.entries()]
        .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
        .map(([mode, count]) => `${mode}:${count}`)
        .join(', ');
}

function padCell(value, width, align = 'left') {
    const text = String(value);
    if (text.length >= width) return text;
    const pad = ' '.repeat(width - text.length);
    return align === 'right' ? `${pad}${text}` : `${text}${pad}`;
}

function formatSummaryTable(rows) {
    const totalModes = new Map();
    let totalPassed = 0;
    let totalFailed = 0;
    let totalCount = 0;
    for (const row of rows) {
        totalPassed += row.passed;
        totalFailed += row.failed;
        totalCount += row.total;
        for (const [mode, count] of row.modes.entries()) {
            totalModes.set(mode, (totalModes.get(mode) || 0) + count);
        }
    }
    const dataRows = [
        ...rows.map((row) => ({
            category: row.type,
            passed: row.passed,
            failed: row.failed,
            total: row.total,
            modes: formatFailureModes(row.modes),
        })),
        {
            category: 'TOTAL',
            passed: totalPassed,
            failed: totalFailed,
            total: totalCount,
            modes: formatFailureModes(totalModes),
        },
    ];

    const headers = {
        category: 'Category',
        passed: 'Passed',
        failed: 'Failed',
        total: 'Total',
        modes: 'Failure Modes',
    };
    const widths = {
        category: Math.max(headers.category.length, ...dataRows.map((r) => String(r.category).length)),
        passed: Math.max(headers.passed.length, ...dataRows.map((r) => String(r.passed).length)),
        failed: Math.max(headers.failed.length, ...dataRows.map((r) => String(r.failed).length)),
        total: Math.max(headers.total.length, ...dataRows.map((r) => String(r.total).length)),
        modes: Math.max(headers.modes.length, ...dataRows.map((r) => String(r.modes).length)),
    };

    const formatRow = (row) => [
        `| ${padCell(row.category, widths.category)}`,
        `| ${padCell(row.passed, widths.passed, 'right')}`,
        `| ${padCell(row.failed, widths.failed, 'right')}`,
        `| ${padCell(row.total, widths.total, 'right')}`,
        `| ${padCell(row.modes, widths.modes)} |`,
    ].join(' ');
    const separator = [
        `|-${'-'.repeat(widths.category)}-`,
        `|-${'-'.repeat(widths.passed)}-`,
        `|-${'-'.repeat(widths.failed)}-`,
        `|-${'-'.repeat(widths.total)}-`,
        `|-${'-'.repeat(widths.modes)}-|`,
    ].join('');

    return [
        formatRow(headers),
        separator,
        ...dataRows.map((row) => formatRow(row)),
    ].join('\n');
}

function indentBlock(text, indent = '  ') {
    return String(text)
        .split('\n')
        .map((line) => `${indent}${line}`)
        .join('\n');
}

function progressBar(done, total, width = 30) {
    const frac = total > 0 ? done / total : 0;
    const filled = Math.round(frac * width);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
    const pct = Math.round(frac * 100);
    return `[${bar}] ${done}/${total} (${pct}%)`;
}

describe('Session Tests', () => {
    test('all session comparisons', async () => {
        const suiteStartMs = Date.now();
        const isTTY = process.stderr.isTTY;

        let bundle;
        try {
            bundle = await runSessionBundle({
                verbose: false,
                useGolden: false,
                onProgress(done, total, result) {
                    if (isTTY) {
                        const elapsed = ((Date.now() - suiteStartMs) / 1000).toFixed(1);
                        const status = result.passed ? 'ok' : 'FAIL';
                        const name = result.session?.replace('.session.json', '') ?? '';
                        const cols = process.stderr.columns || 80;
                        const prefix = `\r${progressBar(done, total)}  ${elapsed}s  `;
                        const label = `${status} ${name}`;
                        const maxLabel = cols - prefix.length + 1 - 1;
                        const truncated = maxLabel > 0 ? label.slice(0, maxLabel) : '';
                        process.stderr.write(`${prefix}${truncated}\x1b[K`);
                    }
                },
            });
        } finally {
            if (isTTY) process.stderr.write('\r\x1b[K');
        }

        const allResults = bundle?.results || [];
        const totalElapsedSec = ((Date.now() - suiteStartMs) / 1000).toFixed(1);
        console.log(`[session] ${allResults.length} sessions completed in ${totalElapsedSec}s`);

        // Group results by type
        const resultsByType = new Map();
        for (const type of TYPE_GROUPS) resultsByType.set(type, []);
        for (const r of allResults) {
            const type = r.type && TYPE_GROUPS.includes(r.type) ? r.type : 'other';
            resultsByType.get(type).push(r);
        }

        const summaryRows = [];
        const failures = [];

        for (const type of TYPE_GROUPS) {
            const rows = resultsByType.get(type);
            const summary = summarizeRows(rows);
            summaryRows.push({ type, ...summary });
            for (const row of rows) {
                if (row.passed) continue;
                failures.push({ type, session: row.session, details: getErrorMessage(row) });
            }
        }

        const table = formatSummaryTable(summaryRows);
        const sortedFailures = failures.sort((a, b) => {
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            return a.session.localeCompare(b.session);
        });

        if (sortedFailures.length > 0) {
            const lines = ['Session failure details (aggregated):'];
            for (const entry of sortedFailures) {
                lines.push(`\n[${entry.type}] ${entry.session}\n${indentBlock(entry.details)}`);
            }
            lines.push('\nSession Summary by Category:');
            lines.push(table);

            const err = new Error(lines.join('\n'));
            err.stack = '';
            throw err;
        }

        console.log('\nSession Summary by Category:');
        console.log(table);
    });
});
