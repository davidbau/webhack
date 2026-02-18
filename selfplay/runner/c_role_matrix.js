#!/usr/bin/env node
// selfplay/runner/c_role_matrix.js
//
// Run one C NetHack selfplay sample for each of the 13 NetHack roles/classes.
// Useful for class-balanced optimization and holdout evaluation.
//
// Usage examples:
//   node selfplay/runner/c_role_matrix.js --mode=train
//   node selfplay/runner/c_role_matrix.js --mode=holdout
//   node selfplay/runner/c_role_matrix.js --mode=train --seeds=21-33 --turns=1200 --key-delay=0
//   node selfplay/runner/c_role_matrix.js --seeds=31-40 --roles=Wizard,Tourist,Valkyrie

import { spawnSync } from 'child_process';

const ALL_ROLES = [
    'Archeologist',
    'Barbarian',
    'Caveman',
    'Healer',
    'Knight',
    'Monk',
    'Priest',
    'Ranger',
    'Rogue',
    'Samurai',
    'Tourist',
    'Valkyrie',
    'Wizard',
];

const args = process.argv.slice(2);
const opts = {
    mode: 'train',      // train|holdout|custom
    turns: 1200,
    keyDelay: 0,
    quiet: true,
    seeds: null,        // comma list and/or ranges, e.g. 21-33 or 21,22,30-35
    roles: null,        // comma-separated list
    verboseFailures: false,
};

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
        const eq = arg.indexOf('=');
        if (eq !== -1) {
            const k = arg.slice(0, eq);
            const v = arg.slice(eq + 1);
            if (k === '--mode') opts.mode = v;
            else if (k === '--turns') opts.turns = parseInt(v, 10);
            else if (k === '--key-delay') opts.keyDelay = parseInt(v, 10);
            else if (k === '--seeds') opts.seeds = v;
            else if (k === '--roles') opts.roles = v;
            else if (k === '--quiet') opts.quiet = (v !== 'false');
            continue;
        }
    }
    if (arg === '--mode' && args[i + 1]) opts.mode = args[++i];
    else if (arg === '--turns' && args[i + 1]) opts.turns = parseInt(args[++i], 10);
    else if (arg === '--key-delay' && args[i + 1]) opts.keyDelay = parseInt(args[++i], 10);
    else if (arg === '--seeds' && args[i + 1]) opts.seeds = args[++i];
    else if (arg === '--roles' && args[i + 1]) opts.roles = args[++i];
    else if (arg === '--verbose-failures') opts.verboseFailures = true;
    else if (arg === '--quiet') opts.quiet = true;
    else if (arg === '--no-quiet') opts.quiet = false;
    else if (arg === '--help' || arg === '-h') {
        printHelp();
        process.exit(0);
    }
}

const roles = opts.roles ? opts.roles.split(',').map(r => r.trim()).filter(Boolean) : ALL_ROLES.slice();
const seedPool = resolveSeedPool(opts);
if (seedPool.length === 0) {
    console.error('No seeds specified/resolved.');
    process.exit(1);
}

console.log('C NetHack Role Matrix Benchmark');
console.log(`  Mode: ${opts.mode}`);
console.log(`  Turns: ${opts.turns}`);
console.log(`  Key delay: ${opts.keyDelay}`);
console.log(`  Roles (${roles.length}): ${roles.join(', ')}`);
console.log(`  Seed pool (${seedPool.length}): ${seedPool.join(', ')}`);
if (seedPool.length < roles.length) {
    console.log(`  Note: seed pool shorter than role count; cycling seeds to keep one sample per role.`);
}
console.log('');

const assignments = roles.map((role, i) => ({ role, seed: seedPool[i % seedPool.length] }));
const results = [];

for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i];
    const runLabel = `[${i + 1}/${assignments.length}] role=${a.role} seed=${a.seed}`;
    console.log(runLabel);

    const cmdArgs = [
        'selfplay/runner/c_runner.js',
        `--seed=${a.seed}`,
        `--turns=${opts.turns}`,
        `--role=${a.role}`,
        `--key-delay=${opts.keyDelay}`,
        opts.quiet ? '--quiet' : '--verbose',
    ];

    const out = spawnSync('node', cmdArgs, {
        encoding: 'utf-8',
        maxBuffer: 64 * 1024 * 1024,
    });
    const text = `${out.stdout || ''}\n${out.stderr || ''}`;

    const depth = extractInt(text, /Max depth reached:\s+(\d+)/);
    const cause = extractString(text, /Death cause:\s+(.+)/) || (out.status === 0 ? 'survived' : 'error');
    const maxXL = extractInt(text, /XP progression:\s+maxXL=(\d+)/);
    const maxXP = extractInt(text, /XP progression:\s+maxXL=\d+\s+maxXP=(\d+)/);
    const xl2 = extractString(text, /XP progression:.*XL2_turn=([^\s]+)/);
    const xl3 = extractString(text, /XP progression:.*XL3_turn=([^\s]+)/);
    const xp100 = extractInt(text, /XP checkpoints:\s+t100=(\d+)/);
    const xp200 = extractInt(text, /XP checkpoints:\s+t100=\d+\s+t200=(\d+)/);
    const xp400 = extractInt(text, /XP checkpoints:\s+t100=\d+\s+t200=\d+\s+t400=(\d+)/);
    const xp600 = extractInt(text, /XP checkpoints:\s+t100=\d+\s+t200=\d+\s+t400=\d+\s+t600=(\d+)/);
    const targetAssign = extractInt(text, /Explore telemetry:.*\bassign=(\d+)/);
    const targetComplete = extractInt(text, /Explore telemetry:.*\bcomplete=(\d+)/);
    const abandonNoProgress = extractInt(text, /Explore telemetry:.*\babandonNoProgress=(\d+)/);
    const failedAdds = extractInt(text, /Explore telemetry:.*\bfailedAdd=(\d+)/);
    const doorOpen = extractInt(text, /Explore telemetry:.*\bdoorOpen=(\d+)/);
    const doorKick = extractInt(text, /Explore telemetry:.*\bdoorKick=(\d+)/);

    const row = {
        role: a.role,
        seed: a.seed,
        depth: Number.isFinite(depth) ? depth : null,
        cause: cause || (out.error ? `spawn_error:${out.error.code || out.error.message}` : 'unknown'),
        maxXL: Number.isFinite(maxXL) ? maxXL : null,
        maxXP: Number.isFinite(maxXP) ? maxXP : null,
        xp100: Number.isFinite(xp100) ? xp100 : null,
        xp200: Number.isFinite(xp200) ? xp200 : null,
        xp400: Number.isFinite(xp400) ? xp400 : null,
        xp600: Number.isFinite(xp600) ? xp600 : null,
        xl2: xl2 || 'never',
        xl3: xl3 || 'never',
        targetAssign: Number.isFinite(targetAssign) ? targetAssign : null,
        targetComplete: Number.isFinite(targetComplete) ? targetComplete : null,
        abandonNoProgress: Number.isFinite(abandonNoProgress) ? abandonNoProgress : null,
        failedAdds: Number.isFinite(failedAdds) ? failedAdds : null,
        doorOpen: Number.isFinite(doorOpen) ? doorOpen : null,
        doorKick: Number.isFinite(doorKick) ? doorKick : null,
        ok: out.status === 0,
    };
    results.push(row);

    console.log(`  -> depth=${row.depth ?? 'NA'} cause=${row.cause} maxXL=${row.maxXL ?? 'NA'} maxXP=${row.maxXP ?? 'NA'} xp100=${row.xp100 ?? 'NA'} xp200=${row.xp200 ?? 'NA'} xp400=${row.xp400 ?? 'NA'} xp600=${row.xp600 ?? 'NA'} xl2=${row.xl2} xl3=${row.xl3} assign=${row.targetAssign ?? 'NA'} complete=${row.targetComplete ?? 'NA'} noProg=${row.abandonNoProgress ?? 'NA'} failedAdd=${row.failedAdds ?? 'NA'} doorOpen=${row.doorOpen ?? 'NA'} doorKick=${row.doorKick ?? 'NA'}`);
    if (!row.ok && opts.verboseFailures) {
        console.log(`  status=${out.status} signal=${out.signal || 'none'} error=${out.error ? (out.error.code || out.error.message) : 'none'}`);
        console.log('  stderr/stdout (failure):');
        console.log(text.slice(-4000));
    }
}

console.log('\nSummary');
const survived = results.filter(r => r.cause === 'survived').length;
const validDepths = results.filter(r => Number.isFinite(r.depth)).map(r => r.depth);
const avgDepth = validDepths.length > 0 ? (validDepths.reduce((a, b) => a + b, 0) / validDepths.length) : NaN;
const reached3 = results.filter(r => (r.depth || 0) >= 3).length;
const reachedXL2 = results.filter(r => (r.maxXL || 0) >= 2).length;
const reachedXL3 = results.filter(r => (r.maxXL || 0) >= 3).length;
const avgMaxXP = avgOf(results.map(r => r.maxXP));
const avgXP100 = avgOf(results.map(r => r.xp100));
const avgXP200 = avgOf(results.map(r => r.xp200));
const avgXP400 = avgOf(results.map(r => r.xp400));
const avgXP600 = avgOf(results.map(r => r.xp600));
const reachedXP10By600 = results.filter(r => (r.xp600 || 0) >= 10).length;
const reachedXP20By600 = results.filter(r => (r.xp600 || 0) >= 20).length;
const avgAssign = avgOf(results.map(r => r.targetAssign));
const avgComplete = avgOf(results.map(r => r.targetComplete));
const avgNoProg = avgOf(results.map(r => r.abandonNoProgress));
const avgFailedAdds = avgOf(results.map(r => r.failedAdds));
const avgDoorOpen = avgOf(results.map(r => r.doorOpen));
const avgDoorKick = avgOf(results.map(r => r.doorKick));
console.log(`  Survived: ${survived}/${results.length}`);
console.log(`  Avg depth: ${Number.isFinite(avgDepth) ? avgDepth.toFixed(3) : 'NA'}`);
console.log(`  Reached depth>=3: ${reached3}/${results.length}`);
console.log(`  Reached XL2+: ${reachedXL2}/${results.length}`);
console.log(`  Reached XL3+: ${reachedXL3}/${results.length}`);
console.log(`  XP avg: maxXP=${fmtAvg(avgMaxXP)} t100=${fmtAvg(avgXP100)} t200=${fmtAvg(avgXP200)} t400=${fmtAvg(avgXP400)} t600=${fmtAvg(avgXP600)}`);
console.log(`  XP by turn 600: >=10 ${reachedXP10By600}/${results.length}, >=20 ${reachedXP20By600}/${results.length}`);
console.log(`  Explore avg: assign=${fmtAvg(avgAssign)} complete=${fmtAvg(avgComplete)} noProg=${fmtAvg(avgNoProg)} failedAdd=${fmtAvg(avgFailedAdds)} doorOpen=${fmtAvg(avgDoorOpen)} doorKick=${fmtAvg(avgDoorKick)}`);
console.log('\nPer-role results');
for (const r of results) {
    console.log(`  role=${r.role} seed=${r.seed} depth=${r.depth ?? 'NA'} cause=${r.cause} maxXL=${r.maxXL ?? 'NA'} maxXP=${r.maxXP ?? 'NA'} xp100=${r.xp100 ?? 'NA'} xp200=${r.xp200 ?? 'NA'} xp400=${r.xp400 ?? 'NA'} xp600=${r.xp600 ?? 'NA'} xl2=${r.xl2} xl3=${r.xl3} assign=${r.targetAssign ?? 'NA'} complete=${r.targetComplete ?? 'NA'} noProg=${r.abandonNoProgress ?? 'NA'} failedAdd=${r.failedAdds ?? 'NA'} doorOpen=${r.doorOpen ?? 'NA'} doorKick=${r.doorKick ?? 'NA'}`);
}

function avgOf(values) {
    const nums = values.filter(v => Number.isFinite(v));
    if (nums.length === 0) return NaN;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function fmtAvg(v) {
    return Number.isFinite(v) ? v.toFixed(2) : 'NA';
}

function resolveSeedPool(options) {
    if (options.seeds) return parseSeedSpec(options.seeds);
    if (options.mode === 'train') return parseSeedSpec('21-33');
    if (options.mode === 'holdout') return parseSeedSpec('31-43');
    return [];
}

function parseSeedSpec(spec) {
    const out = [];
    for (const tokenRaw of spec.split(',')) {
        const token = tokenRaw.trim();
        if (!token) continue;
        const m = token.match(/^(\d+)-(\d+)$/);
        if (m) {
            const a = parseInt(m[1], 10);
            const b = parseInt(m[2], 10);
            const step = a <= b ? 1 : -1;
            for (let x = a; step > 0 ? x <= b : x >= b; x += step) out.push(x);
        } else {
            const n = parseInt(token, 10);
            if (Number.isFinite(n)) out.push(n);
        }
    }
    return out;
}

function extractInt(text, re) {
    const m = text.match(re);
    if (!m) return NaN;
    return parseInt(m[1], 10);
}

function extractString(text, re) {
    const m = text.match(re);
    return m ? m[1].trim() : '';
}

function printHelp() {
    console.log('Usage: node selfplay/runner/c_role_matrix.js [options]');
    console.log('Options:');
    console.log('  --mode=train|holdout|custom   Seed pool mode (default: train)');
    console.log('  --seeds=SPEC                  Seed list/ranges, e.g. 21-30 or 21,22,30-35');
    console.log('  --roles=R1,R2,...             Override role list (default: all 13 roles)');
    console.log('  --turns=N                     Max turns per run (default: 1200)');
    console.log('  --key-delay=MS                Key delay (default: 0)');
    console.log('  --quiet / --no-quiet          Pass quiet/verbose through to c_runner');
    console.log('  --verbose-failures            Print tail output for failed runs');
    console.log('');
    console.log('Default seed pools:');
    console.log('  train:   21-33');
    console.log('  holdout: 31-43');
    console.log('');
    console.log('Note: if seed pool has fewer items than roles, seeds are cycled so');
    console.log('each role still gets one sample.');
}
