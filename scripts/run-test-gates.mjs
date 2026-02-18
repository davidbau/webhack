#!/usr/bin/env node

/**
 * Unified test runner for unit + session tests.
 *
 * Shows a single progress bar across both suites, then prints
 * a combined summary table with failure details.
 *
 * Usage:
 *   node scripts/run-test-gates.mjs [--e2e] [--verbose]
 */

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const isTTY = process.stderr.isTTY;
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

// ── ANSI color helpers ────────────────────────────────────────

const c = useColor ? {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    brightRed: '\x1b[91m',
    brightGreen: '\x1b[92m',
} : { reset: '', bold: '', dim: '', red: '', green: '', yellow: '', cyan: '', gray: '', brightRed: '', brightGreen: '' };

// ── Progress bar ──────────────────────────────────────────────

function progressBar(done, total, width = 30) {
    const frac = total > 0 ? done / total : 0;
    const filled = Math.round(frac * width);
    const bar = `${c.green}\u2588`.repeat(filled) + `${c.gray}\u2591`.repeat(width - filled) + c.reset;
    const pct = Math.round(frac * 100);
    return `[${bar}] ${c.bold}${done}/${total}${c.reset} ${c.dim}(${pct}%)${c.reset}`;
}

const startMs = Date.now();
let globalDone = 0;
let globalTotal = 0;

// Strip ANSI codes for length calculation
function stripAnsi(s) {
    return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function showProgress(label) {
    if (!isTTY) return;
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    const cols = process.stderr.columns || 80;
    const bar = progressBar(globalDone, globalTotal);
    const prefix = `${bar}  ${c.dim}${elapsed}s${c.reset}  `;
    const visLen = stripAnsi(prefix).length;
    const maxLabel = cols - visLen - 1;
    const truncated = maxLabel > 0 ? label.slice(0, maxLabel) : '';
    process.stderr.write(`\r${prefix}${truncated}\x1b[K`);
}

function clearProgress() {
    if (isTTY) process.stderr.write('\r\x1b[K');
}

// ── Unit tests (via TAP parser) ───────────────────────────────

function parseTapLine(line, state) {
    // Track nesting depth for subtests
    const indent = line.match(/^(\s*)/)[1].length;
    const depth = indent / 4;

    // "ok N - name" or "not ok N - name" at depth > 0 are individual tests
    const okMatch = line.match(/^\s*(not )?ok \d+ - (.+)/);
    if (okMatch && depth > 0) {
        const failed = !!okMatch[1];
        const name = okMatch[2].replace(/\s*\([\d.]+ms\)\s*$/, '');
        if (failed) {
            state.failed++;
            state.currentFailure = { test: name, file: state.currentFile, lines: [] };
            state.failures.push(state.currentFailure);
            state.inFailureBlock = true;
        } else {
            state.passed++;
            state.inFailureBlock = false;
            state.currentFailure = null;
        }
        globalDone++;
        const status = failed ? `${c.red}FAIL${c.reset}` : `${c.green}ok${c.reset}`;
        showProgress(`${c.cyan}unit${c.reset} ${status} ${c.dim}${name.slice(0, 50)}${c.reset}`);
        return;
    }

    // Track which file or suite we're in
    const subtestMatch = line.match(/^# Subtest: (.+)$/);
    if (subtestMatch) {
        const name = subtestMatch[1];
        if (name.endsWith('.test.js')) {
            state.currentFile = name.replace(/^.*\/test\/unit\//, '').replace('.test.js', '');
        }
        return;
    }

    // File-level "not ok" means some subtests failed (already counted individually)
    const fileOkMatch = line.match(/^(not )?ok \d+ - (.+)/);
    if (fileOkMatch) {
        if (fileOkMatch[1]) state.filesFailed++;
        else state.filesPassed++;
        state.inFailureBlock = false;
        state.currentFailure = null;
        return;
    }

    // Capture error details for the current failure
    if (state.inFailureBlock && state.currentFailure) {
        const trimmed = line.replace(/^\s+/, '');
        // Extract file from location field
        if (trimmed.startsWith('location:')) {
            const locMatch = trimmed.match(/test\/unit\/([^:]+\.test\.js)/);
            if (locMatch) state.currentFailure.file = locMatch[1].replace('.test.js', '');
            return;
        }
        // Skip YAML markers and metadata
        if (trimmed === '---' || trimmed === '...' || trimmed.startsWith('duration_ms:')
            || trimmed.startsWith("type:") || trimmed.startsWith('failureType:')
            || trimmed.startsWith('code:') || trimmed.startsWith('name:')
            || trimmed.startsWith('expected:') || trimmed.startsWith('actual:')
            || trimmed.startsWith('operator:') || trimmed.startsWith('stack:')) return;
        if (trimmed.startsWith('error:')) {
            state.currentFailure.lines.push(trimmed.replace(/^error:\s*\|-?\s*/, ''));
        } else if (state.currentFailure.lines.length > 0 && state.currentFailure.lines.length < 6) {
            state.currentFailure.lines.push(trimmed);
        }
    }

    // "# tests N" gives us total count
    const totalMatch = line.match(/^# tests (\d+)/);
    if (totalMatch) {
        state.totalReported = parseInt(totalMatch[1]);
    }
}

async function runUnitTests() {
    const state = {
        passed: 0, failed: 0, failures: [],
        filesPassed: 0, filesFailed: 0,
        currentFile: '', currentFailure: null,
        inFailureBlock: false, totalReported: 0,
    };

    const { globSync } = await import('node:fs');
    const unitFiles = globSync('test/unit/*.test.js', { cwd: projectRoot });
    globalTotal += unitFiles.length * 15; // rough estimate: ~15 tests per file

    return new Promise((resolve) => {
        const child = spawn(
            process.execPath,
            ['--test', '--test-reporter=tap', ...unitFiles],
            { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] }
        );

        const rl = createInterface({ input: child.stdout });
        let firstLine = true;

        rl.on('line', (line) => {
            // On first real test line, estimate total from file count
            if (firstLine && line.startsWith('TAP')) {
                firstLine = false;
                return;
            }
            parseTapLine(line, state);
        });

        child.on('close', () => resolve(state));
    });
}

// ── Session tests ─────────────────────────────────────────────

async function runSessionTests() {
    const { runSessionBundle } = await import(
        join(projectRoot, 'test', 'comparison', 'session_test_runner.js')
    );

    const bundle = await runSessionBundle({
        verbose: false,
        useGolden: false,
        onProgress(done, total, result) {
            if (done === 1) globalTotal += total;
            globalDone++;
            const status = result.passed ? `${c.green}ok${c.reset}` : `${c.red}FAIL${c.reset}`;
            const name = result.session?.replace('.session.json', '') ?? '';
            showProgress(`${c.cyan}session${c.reset} ${status} ${c.dim}${name}${c.reset}`);
        },
    });

    return bundle?.results || [];
}

// ── Summary table ─────────────────────────────────────────────

function padCell(value, width, align = 'left') {
    const text = String(value);
    if (text.length >= width) return text;
    const pad = ' '.repeat(width - text.length);
    return align === 'right' ? `${pad}${text}` : `${text}${pad}`;
}

function formatTable(rows) {
    const headers = { category: 'Category', passed: 'Passed', failed: 'Failed', total: 'Total', detail: 'Details' };
    const widths = {};
    for (const key of Object.keys(headers)) {
        widths[key] = Math.max(
            headers[key].length,
            ...rows.map(r => String(r[key] ?? '').length),
        );
    }

    const fmtHeaderRow = (r) => [
        `| ${c.bold}${padCell(r.category, widths.category)}${c.reset}`,
        `| ${c.bold}${padCell(r.passed, widths.passed, 'right')}${c.reset}`,
        `| ${c.bold}${padCell(r.failed, widths.failed, 'right')}${c.reset}`,
        `| ${c.bold}${padCell(r.total, widths.total, 'right')}${c.reset}`,
        `| ${c.bold}${padCell(r.detail ?? '-', widths.detail)}${c.reset} |`,
    ].join(' ');

    const fmtRow = (r) => {
        const isTotal = r.category === 'TOTAL';
        const b = isTotal ? c.bold : '';
        const passColor = r.passed > 0 ? c.green : '';
        const failColor = r.failed > 0 ? c.red : c.dim;
        const detailColor = r.detail && r.detail !== '-' ? c.yellow : c.dim;
        return [
            `| ${b}${padCell(r.category, widths.category)}${c.reset}`,
            `| ${passColor}${padCell(r.passed, widths.passed, 'right')}${c.reset}`,
            `| ${failColor}${padCell(r.failed, widths.failed, 'right')}${c.reset}`,
            `| ${b}${padCell(r.total, widths.total, 'right')}${c.reset}`,
            `| ${detailColor}${padCell(r.detail ?? '-', widths.detail)}${c.reset} |`,
        ].join(' ');
    };

    const sep = `${c.dim}${[
        `|-${'-'.repeat(widths.category)}-`,
        `|-${'-'.repeat(widths.passed)}-`,
        `|-${'-'.repeat(widths.failed)}-`,
        `|-${'-'.repeat(widths.total)}-`,
        `|-${'-'.repeat(widths.detail)}-|`,
    ].join('')}${c.reset}`;

    return [fmtHeaderRow(headers), sep, ...rows.map(fmtRow)].join('\n');
}

function classifyFailureModes(result) {
    const modes = new Set();
    if (result?.firstDivergence?.channel) modes.add(result.firstDivergence.channel);
    if (result?.firstDivergences) {
        for (const ch of Object.keys(result.firstDivergences)) modes.add(ch);
    }
    if (result?.failedLevels?.length) modes.add('levels');
    if (result?.error) {
        const msg = String(result.error).toLowerCase();
        modes.add(msg.includes('bigint') ? 'runtime:bigint' : 'error');
    }
    if (modes.size === 0) modes.add('unknown');
    return [...modes];
}

function formatModes(modeMap) {
    if (!modeMap || modeMap.size === 0) return '-';
    return [...modeMap.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([m, c]) => `${m}:${c}`)
        .join(', ');
}

function indentBlock(text, indent = '    ') {
    return String(text).split('\n').map(l => indent + l).join('\n');
}

// ── Format divergence details ─────────────────────────────────

function formatCallStack(stack) {
    if (!stack || stack.length === 0) return '';
    return ' ' + stack.map(s => s.split(' @ ')[0]).reverse().join(' ');
}

function formatRngEntry(raw, stack) {
    if (!raw) return '(missing)';
    return raw + formatCallStack(stack);
}

function stringifyFirstDivergence(first) {
    if (!first) return null;
    if (first.channel === 'rng') {
        const header = `rng divergence at step=${first.step ?? 'n/a'} index=${first.index ?? 'n/a'}`;
        return `${header}\n  js:      ${formatRngEntry(first.jsRaw || first.js || first.actual, first.jsStack)}\n  session: ${formatRngEntry(first.sessionRaw || first.session || first.expected, first.sessionStack)}`;
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

function getSessionErrorMessage(r) {
    const parts = [];
    if (r.error) parts.push(`error: ${r.error}`);
    if (r.firstDivergence) parts.push(stringifyFirstDivergence(r.firstDivergence));
    if (r.firstDivergences) {
        for (const [ch, val] of Object.entries(r.firstDivergences)) {
            if (ch === r.firstDivergence?.channel) continue;
            parts.push(stringifyFirstDivergence({ channel: ch, ...val }));
        }
    }
    if (r.failedLevels) parts.push(`failed levels: ${r.failedLevels.join(', ')}`);
    parts.push(`metrics: ${JSON.stringify(r.metrics || {})}`);
    return parts.filter(Boolean).join('\n');
}

// ── Main ──────────────────────────────────────────────────────

const SESSION_TYPES = ['chargen', 'interface', 'map', 'gameplay', 'special', 'other'];

async function main() {
    try {
        // 1. Unit tests (estimate file count for progress)
        const unitResults = await runUnitTests();

        // 2. Session tests
        const sessionResults = await runSessionTests();

        clearProgress();

        const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
        const totalTests = unitResults.passed + unitResults.failed + sessionResults.length;
        console.log(`\n${c.bold}${totalTests} tests completed in ${elapsed}s${c.reset}\n`);

        // 3. Collect failure details
        const failureLines = [];

        for (const f of unitResults.failures) {
            const loc = f.file || '?';
            const errMsg = f.lines.length > 0 ? f.lines.join('\n') : 'unknown error';
            failureLines.push(`${c.red}[unit]${c.reset} ${c.bold}${f.test}${c.reset} ${c.dim}(${loc})${c.reset}\n${indentBlock(errMsg)}`);
        }

        const sessionByType = new Map();
        for (const type of SESSION_TYPES) sessionByType.set(type, []);
        for (const r of sessionResults) {
            const type = r.type && SESSION_TYPES.includes(r.type) ? r.type : 'other';
            sessionByType.get(type).push(r);
        }

        for (const type of SESSION_TYPES) {
            for (const r of sessionByType.get(type)) {
                if (r.passed) continue;
                failureLines.push(`${c.red}[${type}]${c.reset} ${c.bold}${r.session}${c.reset}\n${indentBlock(getSessionErrorMessage(r))}`);
            }
        }

        if (failureLines.length > 0) {
            console.log(`${c.red}${c.bold}Failure details:${c.reset}\n`);
            console.log(failureLines.join('\n\n'));
            console.log('');
        }

        // 4. Build summary table
        const tableRows = [];

        tableRows.push({
            category: 'unit',
            passed: unitResults.passed,
            failed: unitResults.failed,
            total: unitResults.passed + unitResults.failed,
            detail: unitResults.failures.length > 0
                ? `${unitResults.failures.length} test(s) in ${unitResults.filesFailed} file(s)`
                : '-',
        });

        let sessTotalPassed = 0, sessTotalFailed = 0;
        const sessTotalModes = new Map();

        for (const type of SESSION_TYPES) {
            const rows = sessionByType.get(type);
            if (rows.length === 0) continue;
            let p = 0, f = 0;
            const modes = new Map();
            for (const r of rows) {
                if (r.passed) { p++; } else {
                    f++;
                    for (const m of classifyFailureModes(r)) {
                        modes.set(m, (modes.get(m) || 0) + 1);
                        sessTotalModes.set(m, (sessTotalModes.get(m) || 0) + 1);
                    }
                }
            }
            sessTotalPassed += p;
            sessTotalFailed += f;
            tableRows.push({
                category: type,
                passed: p,
                failed: f,
                total: rows.length,
                detail: formatModes(modes),
            });
        }

        tableRows.push({
            category: 'TOTAL',
            passed: unitResults.passed + sessTotalPassed,
            failed: unitResults.failed + sessTotalFailed,
            total: unitResults.passed + unitResults.failed + sessTotalPassed + sessTotalFailed,
            detail: formatModes(sessTotalModes),
        });

        console.log(`${c.bold}Test Summary:${c.reset}`);
        console.log(formatTable(tableRows));

        const anyFailed = unitResults.failed > 0 || sessTotalFailed > 0;
        process.exit(anyFailed ? 1 : 0);
    } catch (err) {
        clearProgress();
        console.error('Test runner error:', err);
        process.exit(1);
    }
}

main();
