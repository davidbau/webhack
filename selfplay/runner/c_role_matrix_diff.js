#!/usr/bin/env node
// selfplay/runner/c_role_matrix_diff.js
//
// Compare two JSON artifacts produced by c_role_matrix.js (--json-out).
// Prints summary deltas, per-assignment regressions/improvements, and
// evaluates default selfplay guardrails.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SUMMARY_METRICS = [
    { key: 'survived', label: 'survived', direction: 'higher' },
    { key: 'avgDepth', label: 'avgDepth', direction: 'higher' },
    { key: 'reachedDepthGte3', label: 'depth>=3', direction: 'higher' },
    { key: 'reachedXL2', label: 'XL2+', direction: 'higher' },
    { key: 'reachedXL3', label: 'XL3+', direction: 'higher' },
    { key: 'avgXP600', label: 'avgXP600', direction: 'higher' },
    { key: 'reachedXP10By600', label: 'XP>=10@600', direction: 'higher' },
    { key: 'reachedXP20By600', label: 'XP>=20@600', direction: 'higher' },
    { key: 'avgFailedAdds', label: 'avgFailedAdd', direction: 'lower' },
    { key: 'avgAttackTurns', label: 'avgAttack', direction: 'lower' },
    { key: 'avgFleeTurns', label: 'avgFlee', direction: 'lower' },
    { key: 'avgPetSwaps', label: 'avgPetSwap', direction: 'lower' },
];

const DEFAULT_GUARDRAILS = [
    { key: 'survived', direction: 'higher', label: 'survival must not regress' },
    { key: 'avgDepth', direction: 'higher', label: 'average depth must not regress' },
    { key: 'reachedDepthGte3', direction: 'higher', label: 'depth>=3 count must not regress' },
    { key: 'reachedXL2', direction: 'higher', label: 'XL2+ count must not regress' },
    { key: 'avgXP600', direction: 'higher', label: 'XP@600 must not regress' },
    { key: 'reachedXP10By600', direction: 'higher', label: 'XP>=10@600 count must not regress' },
    { key: 'avgFailedAdds', direction: 'lower', label: 'failedAdd must not increase' },
];

export function compareRoleMatrix(baselineData, candidateData, options = {}) {
    const eps = Number.isFinite(options.epsilon) ? options.epsilon : 1e-9;
    const top = Number.isFinite(options.top) ? Math.max(1, options.top) : 8;
    const overlapOnly = options.overlapOnly === true;

    const fullBaselineRows = baselineData?.results || [];
    const fullCandidateRows = candidateData?.results || [];
    const fullBaselineAssignments = indexAssignments(resolveGroupedAssignments(baselineData));
    const fullCandidateAssignments = indexAssignments(resolveGroupedAssignments(candidateData));
    const baselineOnly = [...fullBaselineAssignments.keys()].filter(k => !fullCandidateAssignments.has(k));
    const candidateOnly = [...fullCandidateAssignments.keys()].filter(k => !fullBaselineAssignments.has(k));
    const overlapKeys = new Set([...fullBaselineAssignments.keys()].filter(k => fullCandidateAssignments.has(k)));

    const scopedBaselineRows = overlapOnly
        ? filterRowsByAssignmentKeys(fullBaselineRows, overlapKeys)
        : fullBaselineRows;
    const scopedCandidateRows = overlapOnly
        ? filterRowsByAssignmentKeys(fullCandidateRows, overlapKeys)
        : fullCandidateRows;

    const baselineAssignments = indexAssignments(groupByAssignment(scopedBaselineRows));
    const candidateAssignments = indexAssignments(groupByAssignment(scopedCandidateRows));
    const baselineSummary = overlapOnly
        ? buildSummaryFromRows(scopedBaselineRows)
        : (baselineData?.summary || buildSummaryFromRows(scopedBaselineRows));
    const candidateSummary = overlapOnly
        ? buildSummaryFromRows(scopedCandidateRows)
        : (candidateData?.summary || buildSummaryFromRows(scopedCandidateRows));

    const summaryDeltas = SUMMARY_METRICS
        .map(m => {
            const baseline = toNumberOrNaN(baselineSummary[m.key]);
            const candidate = toNumberOrNaN(candidateSummary[m.key]);
            const delta = (Number.isFinite(baseline) && Number.isFinite(candidate))
                ? (candidate - baseline)
                : NaN;
            return {
                key: m.key,
                label: m.label,
                direction: m.direction,
                baseline,
                candidate,
                delta,
            };
        });

    const baselineRuns = toNumberOrNaN(baselineSummary.totalRuns);
    const candidateRuns = toNumberOrNaN(candidateSummary.totalRuns);
    const runCountsComparable = (!Number.isFinite(baselineRuns) || !Number.isFinite(candidateRuns))
        ? true
        : baselineRuns === candidateRuns;
    const assignmentsComparable = overlapOnly
        ? overlapKeys.size > 0
        : (baselineOnly.length === 0 && candidateOnly.length === 0);
    const comparable = assignmentsComparable && runCountsComparable;

    const guardrails = [];
    guardrails.push({
        key: '__comparable',
        label: overlapOnly
            ? 'baseline/candidate overlap scope must be non-empty and run-count aligned'
            : 'baseline/candidate assignment sets must match',
        direction: 'equal',
        baseline: baselineAssignments.size,
        candidate: candidateAssignments.size,
        delta: candidateAssignments.size - baselineAssignments.size,
        pass: comparable,
    });

    for (const g of DEFAULT_GUARDRAILS) {
        const baseline = toNumberOrNaN(baselineSummary[g.key]);
        const candidate = toNumberOrNaN(candidateSummary[g.key]);
        const delta = (Number.isFinite(baseline) && Number.isFinite(candidate))
            ? (candidate - baseline)
            : NaN;
        const pass = passesDirection(delta, g.direction, eps);
        guardrails.push({
            key: g.key,
            label: g.label,
            direction: g.direction,
            baseline,
            candidate,
            delta,
            pass,
        });
    }

    const passed = guardrails.every(g => g.pass);

    const assignmentKeys = new Set([...baselineAssignments.keys(), ...candidateAssignments.keys()]);
    const assignmentDeltas = [];
    for (const key of assignmentKeys) {
        const b = baselineAssignments.get(key);
        const c = candidateAssignments.get(key);
        if (!b || !c) continue;
        assignmentDeltas.push({
            key,
            role: b.role,
            seed: b.seed,
            depthDelta: deltaNum(b.avgDepth, c.avgDepth),
            xp600Delta: deltaNum(b.avgXP600, c.avgXP600),
            failedAddDelta: deltaNum(b.avgFailedAdds, c.avgFailedAdds),
            survivedDelta: deltaNum(b.survived, c.survived),
            baseline: b,
            candidate: c,
        });
    }

    const scoredAssignments = assignmentDeltas
        .filter(a => Number.isFinite(a.xp600Delta) || Number.isFinite(a.depthDelta) || Number.isFinite(a.failedAddDelta))
        .map(a => {
            const regression = regressionScore(a);
            const improvement = improvementScore(a);
            return { ...a, regressionScore: regression, improvementScore: improvement };
        });

    const regressions = [...scoredAssignments]
        .filter(a => a.regressionScore > eps && a.regressionScore > a.improvementScore)
        .sort((a, b) => b.regressionScore - a.regressionScore)
        .slice(0, top);

    const improvements = [...scoredAssignments]
        .filter(a => a.improvementScore > eps && a.improvementScore > a.regressionScore)
        .sort((a, b) => b.improvementScore - a.improvementScore)
        .slice(0, top);

    const runDiff = diffRuns(scopedBaselineRows, scopedCandidateRows);

    return {
        passed,
        summaryDeltas,
        guardrails,
        comparable,
        comparability: {
            overlapOnly,
            assignmentsComparable,
            runCountsComparable,
            baselineAssignmentCount: baselineAssignments.size,
            candidateAssignmentCount: candidateAssignments.size,
            overlapAssignmentCount: overlapKeys.size,
            baselineOnly,
            candidateOnly,
            baselineRuns,
            candidateRuns,
        },
        assignmentDeltas,
        regressions,
        improvements,
        runDiff,
    };
}

function regressionScore(row) {
    const xpPenalty = Number.isFinite(row.xp600Delta) ? Math.max(0, -row.xp600Delta) : 0;
    const depthPenalty = Number.isFinite(row.depthDelta) ? Math.max(0, -row.depthDelta) * 2 : 0;
    const failedPenalty = Number.isFinite(row.failedAddDelta) ? Math.max(0, row.failedAddDelta) * 0.5 : 0;
    return xpPenalty + depthPenalty + failedPenalty;
}

function improvementScore(row) {
    const xpGain = Number.isFinite(row.xp600Delta) ? Math.max(0, row.xp600Delta) : 0;
    const depthGain = Number.isFinite(row.depthDelta) ? Math.max(0, row.depthDelta) * 2 : 0;
    const failedGain = Number.isFinite(row.failedAddDelta) ? Math.max(0, -row.failedAddDelta) * 0.5 : 0;
    return xpGain + depthGain + failedGain;
}

function diffRuns(baseRows, candRows) {
    const base = new Map(baseRows.map(r => [runKey(r), r]));
    const cand = new Map(candRows.map(r => [runKey(r), r]));
    let changed = 0;
    const changedKeys = [];
    const fields = ['depth', 'cause', 'maxXP', 'xp600', 'attackTurns', 'fleeTurns', 'failedAdds'];
    for (const [key, b] of base.entries()) {
        const c = cand.get(key);
        if (!c) continue;
        const differs = fields.some(f => (b?.[f] ?? null) !== (c?.[f] ?? null));
        if (differs) {
            changed++;
            if (changedKeys.length < 12) changedKeys.push(key);
        }
    }
    return {
        baselineRuns: base.size,
        candidateRuns: cand.size,
        changedRuns: changed,
        sampleChangedRunKeys: changedKeys,
    };
}

function runKey(r) {
    return `${r.role}|${r.seed}|${r.repeat || 1}`;
}

function resolveGroupedAssignments(data) {
    if (Array.isArray(data?.groupedAssignments) && data.groupedAssignments.length > 0) {
        return data.groupedAssignments;
    }
    return groupByAssignment(data?.results || []);
}

function groupByAssignment(rows) {
    const m = new Map();
    for (const r of rows) {
        const key = `${r.role}|${r.seed}`;
        if (!m.has(key)) m.set(key, []);
        m.get(key).push(r);
    }
    const out = [];
    for (const [key, list] of m.entries()) {
        const [role, seedStr] = key.split('|');
        out.push({
            role,
            seed: parseInt(seedStr, 10),
            runs: list.length,
            survived: list.filter(r => r.cause === 'survived').length,
            avgDepth: avgOf(list.map(r => r.depth)),
            avgXP600: avgOf(list.map(r => r.xp600)),
            avgFailedAdds: avgOf(list.map(r => r.failedAdds)),
        });
    }
    return out;
}

function avgOf(values) {
    const nums = values.filter(v => Number.isFinite(v));
    if (nums.length === 0) return NaN;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function filterRowsByAssignmentKeys(rows, keySet) {
    if (!(keySet instanceof Set) || keySet.size === 0) return [];
    return rows.filter(r => keySet.has(`${r.role}|${r.seed}`));
}

function indexAssignments(rows) {
    const idx = new Map();
    for (const r of rows) {
        idx.set(`${r.role}|${r.seed}`, r);
    }
    return idx;
}

function buildSummaryFromRows(rows) {
    const survived = rows.filter(r => r.cause === 'survived').length;
    const totalRuns = rows.length;
    return {
        survived,
        totalRuns,
        avgDepth: avgOf(rows.map(r => r.depth)),
        reachedDepthGte3: rows.filter(r => (r.depth || 0) >= 3).length,
        reachedXL2: rows.filter(r => (r.maxXL || 0) >= 2).length,
        reachedXL3: rows.filter(r => (r.maxXL || 0) >= 3).length,
        avgXP600: avgOf(rows.map(r => r.xp600)),
        reachedXP10By600: rows.filter(r => (r.xp600 || 0) >= 10).length,
        reachedXP20By600: rows.filter(r => (r.xp600 || 0) >= 20).length,
        avgFailedAdds: avgOf(rows.map(r => r.failedAdds)),
        avgAttackTurns: avgOf(rows.map(r => r.attackTurns)),
        avgFleeTurns: avgOf(rows.map(r => r.fleeTurns)),
        avgPetSwaps: avgOf(rows.map(r => r.petSwapCount)),
    };
}

function deltaNum(a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
    return b - a;
}

function toNumberOrNaN(v) {
    return Number.isFinite(v) ? v : Number(v);
}

function passesDirection(delta, direction, eps) {
    if (!Number.isFinite(delta)) return false;
    if (direction === 'higher') return delta >= -eps;
    if (direction === 'lower') return delta <= eps;
    return false;
}

function fmtNum(v, digits = 3) {
    return Number.isFinite(v) ? v.toFixed(digits) : 'NA';
}

function parseArgs(argv) {
    const opts = {
        baseline: null,
        candidate: null,
        top: 8,
        jsonOut: null,
        overlapOnly: false,
    };
    const args = argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--baseline' && args[i + 1]) opts.baseline = args[++i];
        else if (arg === '--candidate' && args[i + 1]) opts.candidate = args[++i];
        else if (arg === '--top' && args[i + 1]) opts.top = parseInt(args[++i], 10);
        else if (arg === '--json-out' && args[i + 1]) opts.jsonOut = args[++i];
        else if (arg === '--overlap-only') opts.overlapOnly = true;
        else if (arg.startsWith('--baseline=')) opts.baseline = arg.slice('--baseline='.length);
        else if (arg.startsWith('--candidate=')) opts.candidate = arg.slice('--candidate='.length);
        else if (arg.startsWith('--top=')) opts.top = parseInt(arg.slice('--top='.length), 10);
        else if (arg.startsWith('--json-out=')) opts.jsonOut = arg.slice('--json-out='.length);
        else if (arg === '--no-overlap-only') opts.overlapOnly = false;
        else if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        }
    }
    if (!opts.baseline || !opts.candidate) {
        printHelp();
        process.exit(1);
    }
    return opts;
}

function loadJson(p) {
    const text = fs.readFileSync(p, 'utf8');
    return JSON.parse(text);
}

function writeJsonOut(outPath, payload) {
    const resolved = path.resolve(outPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return resolved;
}

export function runCli(argv = process.argv) {
    const opts = parseArgs(argv);
    const baseline = loadJson(opts.baseline);
    const candidate = loadJson(opts.candidate);
    const result = compareRoleMatrix(baseline, candidate, { top: opts.top, overlapOnly: opts.overlapOnly });

    console.log('C Role Matrix JSON Diff');
    console.log(`  baseline:  ${path.resolve(opts.baseline)}`);
    console.log(`  candidate: ${path.resolve(opts.candidate)}`);
    console.log(`  overlap-only: ${opts.overlapOnly ? 'on' : 'off'}`);
    console.log('');

    console.log('Summary deltas (candidate - baseline)');
    for (const row of result.summaryDeltas) {
        console.log(`  ${row.label}: ${fmtNum(row.baseline)} -> ${fmtNum(row.candidate)} (delta ${fmtNum(row.delta)})`);
    }

    console.log(''); 
    console.log(`Guardrails: ${result.passed ? 'PASS' : 'FAIL'}`);
    for (const g of result.guardrails) {
        console.log(`  [${g.pass ? 'ok' : '!!'}] ${g.label}: ${fmtNum(g.baseline)} -> ${fmtNum(g.candidate)} (delta ${fmtNum(g.delta)})`);
    }
    if (!result.comparable) {
        console.log('  [!!] assignment/run mismatch details:');
        console.log(`       baseline assignments=${result.comparability.baselineAssignmentCount}, candidate assignments=${result.comparability.candidateAssignmentCount}`);
        console.log(`       baseline runs=${fmtNum(result.comparability.baselineRuns, 0)}, candidate runs=${fmtNum(result.comparability.candidateRuns, 0)}`);
        console.log(`       overlap assignments=${result.comparability.overlapAssignmentCount}`);
        if (result.comparability.baselineOnly.length > 0) {
            console.log(`       baseline-only keys: ${result.comparability.baselineOnly.slice(0, 10).join(', ')}`);
        }
        if (result.comparability.candidateOnly.length > 0) {
            console.log(`       candidate-only keys: ${result.comparability.candidateOnly.slice(0, 10).join(', ')}`);
        }
    }

    console.log('');
    console.log(`Run-level changed rows: ${result.runDiff.changedRuns}/${result.runDiff.baselineRuns}`);
    if (result.runDiff.sampleChangedRunKeys.length > 0) {
        console.log(`  sample: ${result.runDiff.sampleChangedRunKeys.join(', ')}`);
    }

    console.log('');
    console.log(`Top regressions (${Math.min(opts.top, result.regressions.length)})`);
    for (const r of result.regressions) {
        console.log(`  role=${r.role} seed=${r.seed} dDepth=${fmtNum(r.depthDelta)} dXP600=${fmtNum(r.xp600Delta)} dFailedAdd=${fmtNum(r.failedAddDelta)} dSurvived=${fmtNum(r.survivedDelta)}`);
    }

    console.log('');
    console.log(`Top improvements (${Math.min(opts.top, result.improvements.length)})`);
    for (const r of result.improvements) {
        console.log(`  role=${r.role} seed=${r.seed} dDepth=${fmtNum(r.depthDelta)} dXP600=${fmtNum(r.xp600Delta)} dFailedAdd=${fmtNum(r.failedAddDelta)} dSurvived=${fmtNum(r.survivedDelta)}`);
    }

    if (opts.jsonOut) {
        const resolved = writeJsonOut(opts.jsonOut, {
            generatedAt: new Date().toISOString(),
            baselinePath: path.resolve(opts.baseline),
            candidatePath: path.resolve(opts.candidate),
            ...result,
        });
        console.log('');
        console.log(`JSON diff written: ${resolved}`);
    }

    process.exit(result.passed ? 0 : 2);
}

function printHelp() {
    console.log('Usage: node selfplay/runner/c_role_matrix_diff.js --baseline=FILE --candidate=FILE [options]');
    console.log('Options:');
    console.log('  --baseline=FILE      Baseline JSON artifact from c_role_matrix --json-out');
    console.log('  --candidate=FILE     Candidate JSON artifact from c_role_matrix --json-out');
    console.log('  --top=N              Number of top regression/improvement rows (default: 8)');
    console.log('  --json-out=FILE      Optional path to write machine-readable diff output');
    console.log('  --overlap-only       Compare only assignment overlap (useful for triage subsets)');
    console.log('Exit codes:');
    console.log('  0 = guardrails pass');
    console.log('  2 = guardrails fail');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) runCli(process.argv);
