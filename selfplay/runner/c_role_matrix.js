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
//   node selfplay/runner/c_role_matrix.js --mode=holdout --repeats=3
//   node selfplay/runner/c_role_matrix.js --seeds=31-40 --roles=Wizard,Tourist,Valkyrie
//   node selfplay/runner/c_role_matrix.js --mode=holdout --repeats=2 --json-out=/tmp/holdout.json

import fs from 'fs';
import path from 'path';
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
    exclusive: true,    // prevent concurrent matrix runs
    repeats: 1,         // runs per role/seed assignment
    jsonOut: null,      // optional output path for machine-readable results
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
            else if (k === '--exclusive') opts.exclusive = (v !== 'false');
            else if (k === '--repeats') opts.repeats = parseInt(v, 10);
            else if (k === '--json-out') opts.jsonOut = v;
            else if (k === '--seeds') opts.seeds = v;
            else if (k === '--roles') opts.roles = v;
            else if (k === '--quiet') opts.quiet = (v !== 'false');
            continue;
        }
    }
    if (arg === '--mode' && args[i + 1]) opts.mode = args[++i];
    else if (arg === '--turns' && args[i + 1]) opts.turns = parseInt(args[++i], 10);
    else if (arg === '--key-delay' && args[i + 1]) opts.keyDelay = parseInt(args[++i], 10);
    else if (arg === '--exclusive') opts.exclusive = true;
    else if (arg === '--no-exclusive') opts.exclusive = false;
    else if (arg === '--repeats' && args[i + 1]) opts.repeats = parseInt(args[++i], 10);
    else if (arg === '--json-out' && args[i + 1]) opts.jsonOut = args[++i];
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
if (!Number.isFinite(opts.repeats) || opts.repeats < 1) {
    console.error(`Invalid --repeats value: ${opts.repeats}`);
    process.exit(1);
}
const lockState = acquireExclusiveLock(opts.exclusive);

console.log('C NetHack Role Matrix Benchmark');
console.log(`  Mode: ${opts.mode}`);
console.log(`  Turns: ${opts.turns}`);
console.log(`  Key delay: ${opts.keyDelay}`);
console.log(`  Exclusive lock: ${opts.exclusive ? `on (${lockState.lockPath})` : 'off'}`);
console.log(`  Repeats: ${opts.repeats}`);
console.log(`  Roles (${roles.length}): ${roles.join(', ')}`);
console.log(`  Seed pool (${seedPool.length}): ${seedPool.join(', ')}`);
if (seedPool.length < roles.length) {
    console.log(`  Note: seed pool shorter than role count; cycling seeds to keep one sample per role.`);
}
console.log('');

const assignments = roles.map((role, i) => ({ role, seed: seedPool[i % seedPool.length] }));
const results = [];
const totalRuns = assignments.length * opts.repeats;
let runIndex = 0;

for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i];
    for (let rep = 1; rep <= opts.repeats; rep++) {
        runIndex++;
        const runLabel = `[${runIndex}/${totalRuns}] role=${a.role} seed=${a.seed}` +
            (opts.repeats > 1 ? ` repeat=${rep}/${opts.repeats}` : '');
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
    const attackTurns = extractInt(text, /Action telemetry:\s+attack=(\d+)/);
    const fleeTurns = extractInt(text, /Action telemetry:.*\bflee=(\d+)/);
    const fleeHpEmergencyTurns = extractInt(text, /Flee telemetry:\s+hpEmergency=(\d+)/);
    const fleeDlvl2RetreatTurns = extractInt(text, /Flee telemetry:.*\bdlvl2Retreat=(\d+)/);
    const fleeToUpstairsTurns = extractInt(text, /Flee telemetry:.*\btoUpstairs=(\d+)/);
    const fleeOscillationTurns = extractInt(text, /Flee telemetry:.*\boscillation=(\d+)/);
    const fleeDangerTurns = extractInt(text, /Flee telemetry:.*\bdanger=(\d+)/);
    const fleeOtherTurns = extractInt(text, /Flee telemetry:.*\bother=(\d+)/);
    const xl1AttackTurns = extractInt(text, /Action telemetry:.*\bxl1Attack=(\d+)/);
    const reallyAttackPrompts = extractInt(text, /Action telemetry:.*\breallyAttack=(\d+)/);
    const petSwapCount = extractInt(text, /Action telemetry:.*\bpetSwap=(\d+)/);
    const attackPetClassTurns = extractInt(text, /Attack target telemetry:\s+petClass=(\d+)/);
    const attackPetClassLowXpDlvl1Turns = extractInt(text, /Attack target telemetry:.*\bpetClassLowXpDlvl1=(\d+)/);
    const attackDogTurns = extractInt(text, /Attack target telemetry:.*\bdog=(\d+)/);
    const attackDogLowXpDlvl1Turns = extractInt(text, /Attack target telemetry:.*\bdogLowXpDlvl1=(\d+)/);
    const lowXpDogLoopTurns = extractInt(text, /Dog loop telemetry:\s+lowXpDogLoop=(\d+)/);
    const lowXpDogLoopDoorAdjTurns = extractInt(text, /Dog loop telemetry:.*\bdoorAdj=(\d+)/);
    const attackLowXpDogLoopDoorAdjTurns = extractInt(text, /Dog loop telemetry:.*\battackDoorAdj=(\d+)/);
    const lowXpDogLoopBlockingTurns = extractInt(text, /Dog loop telemetry:.*\bblocking=(\d+)/);
    const lowXpDogLoopNonBlockingTurns = extractInt(text, /Dog loop telemetry:.*\bnonBlocking=(\d+)/);
    const attackLowXpDogLoopBlockingTurns = extractInt(text, /Dog loop telemetry:.*\battackBlocking=(\d+)/);
    const attackLowXpDogLoopNonBlockingTurns = extractInt(text, /Dog loop telemetry:.*\battackNonBlocking=(\d+)/);
    const targetAssign = extractInt(text, /Explore telemetry:.*\bassign=(\d+)/);
    const targetComplete = extractInt(text, /Explore telemetry:.*\bcomplete=(\d+)/);
    const abandonNoProgress = extractInt(text, /Explore telemetry:.*\babandonNoProgress=(\d+)/);
    const failedAdds = extractInt(text, /Explore telemetry:.*\bfailedAdd=(\d+)/);
    const doorOpen = extractInt(text, /Explore telemetry:.*\bdoorOpen=(\d+)/);
    const doorKick = extractInt(text, /Explore telemetry:.*\bdoorKick=(\d+)/);

        const row = {
            role: a.role,
            seed: a.seed,
            repeat: rep,
            depth: Number.isFinite(depth) ? depth : null,
            cause: cause || (out.error ? `spawn_error:${out.error.code || out.error.message}` : 'unknown'),
            maxXL: Number.isFinite(maxXL) ? maxXL : null,
            maxXP: Number.isFinite(maxXP) ? maxXP : null,
            xp100: Number.isFinite(xp100) ? xp100 : null,
            xp200: Number.isFinite(xp200) ? xp200 : null,
            xp400: Number.isFinite(xp400) ? xp400 : null,
            xp600: Number.isFinite(xp600) ? xp600 : null,
            attackTurns: Number.isFinite(attackTurns) ? attackTurns : null,
            fleeTurns: Number.isFinite(fleeTurns) ? fleeTurns : null,
            fleeHpEmergencyTurns: Number.isFinite(fleeHpEmergencyTurns) ? fleeHpEmergencyTurns : null,
            fleeDlvl2RetreatTurns: Number.isFinite(fleeDlvl2RetreatTurns) ? fleeDlvl2RetreatTurns : null,
            fleeToUpstairsTurns: Number.isFinite(fleeToUpstairsTurns) ? fleeToUpstairsTurns : null,
            fleeOscillationTurns: Number.isFinite(fleeOscillationTurns) ? fleeOscillationTurns : null,
            fleeDangerTurns: Number.isFinite(fleeDangerTurns) ? fleeDangerTurns : null,
            fleeOtherTurns: Number.isFinite(fleeOtherTurns) ? fleeOtherTurns : null,
            xl1AttackTurns: Number.isFinite(xl1AttackTurns) ? xl1AttackTurns : null,
            reallyAttackPrompts: Number.isFinite(reallyAttackPrompts) ? reallyAttackPrompts : null,
            petSwapCount: Number.isFinite(petSwapCount) ? petSwapCount : null,
            attackPetClassTurns: Number.isFinite(attackPetClassTurns) ? attackPetClassTurns : null,
            attackPetClassLowXpDlvl1Turns: Number.isFinite(attackPetClassLowXpDlvl1Turns) ? attackPetClassLowXpDlvl1Turns : null,
            attackDogTurns: Number.isFinite(attackDogTurns) ? attackDogTurns : null,
            attackDogLowXpDlvl1Turns: Number.isFinite(attackDogLowXpDlvl1Turns) ? attackDogLowXpDlvl1Turns : null,
            lowXpDogLoopTurns: Number.isFinite(lowXpDogLoopTurns) ? lowXpDogLoopTurns : null,
            lowXpDogLoopDoorAdjTurns: Number.isFinite(lowXpDogLoopDoorAdjTurns) ? lowXpDogLoopDoorAdjTurns : null,
            attackLowXpDogLoopDoorAdjTurns: Number.isFinite(attackLowXpDogLoopDoorAdjTurns) ? attackLowXpDogLoopDoorAdjTurns : null,
            lowXpDogLoopBlockingTurns: Number.isFinite(lowXpDogLoopBlockingTurns) ? lowXpDogLoopBlockingTurns : null,
            lowXpDogLoopNonBlockingTurns: Number.isFinite(lowXpDogLoopNonBlockingTurns) ? lowXpDogLoopNonBlockingTurns : null,
            attackLowXpDogLoopBlockingTurns: Number.isFinite(attackLowXpDogLoopBlockingTurns) ? attackLowXpDogLoopBlockingTurns : null,
            attackLowXpDogLoopNonBlockingTurns: Number.isFinite(attackLowXpDogLoopNonBlockingTurns) ? attackLowXpDogLoopNonBlockingTurns : null,
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

        console.log(`  -> depth=${row.depth ?? 'NA'} cause=${row.cause} maxXL=${row.maxXL ?? 'NA'} maxXP=${row.maxXP ?? 'NA'} xp100=${row.xp100 ?? 'NA'} xp200=${row.xp200 ?? 'NA'} xp400=${row.xp400 ?? 'NA'} xp600=${row.xp600 ?? 'NA'} atk=${row.attackTurns ?? 'NA'} flee=${row.fleeTurns ?? 'NA'} fleeHp=${row.fleeHpEmergencyTurns ?? 'NA'} fleeD2=${row.fleeDlvl2RetreatTurns ?? 'NA'} fleeUp=${row.fleeToUpstairsTurns ?? 'NA'} fleeOsc=${row.fleeOscillationTurns ?? 'NA'} fleeDanger=${row.fleeDangerTurns ?? 'NA'} fleeOther=${row.fleeOtherTurns ?? 'NA'} xl1Atk=${row.xl1AttackTurns ?? 'NA'} reallyAtk=${row.reallyAttackPrompts ?? 'NA'} petSwap=${row.petSwapCount ?? 'NA'} petAtk=${row.attackPetClassTurns ?? 'NA'} petAtkLow=${row.attackPetClassLowXpDlvl1Turns ?? 'NA'} dogAtk=${row.attackDogTurns ?? 'NA'} dogAtkLow=${row.attackDogLowXpDlvl1Turns ?? 'NA'} dogLoop=${row.lowXpDogLoopTurns ?? 'NA'} dogLoopDoorAdj=${row.lowXpDogLoopDoorAdjTurns ?? 'NA'} dogLoopDoorAdjAtk=${row.attackLowXpDogLoopDoorAdjTurns ?? 'NA'} dogLoopBlock=${row.lowXpDogLoopBlockingTurns ?? 'NA'} dogLoopNonBlock=${row.lowXpDogLoopNonBlockingTurns ?? 'NA'} dogLoopAtkBlock=${row.attackLowXpDogLoopBlockingTurns ?? 'NA'} dogLoopAtkNonBlock=${row.attackLowXpDogLoopNonBlockingTurns ?? 'NA'} xl2=${row.xl2} xl3=${row.xl3} assign=${row.targetAssign ?? 'NA'} complete=${row.targetComplete ?? 'NA'} noProg=${row.abandonNoProgress ?? 'NA'} failedAdd=${row.failedAdds ?? 'NA'} doorOpen=${row.doorOpen ?? 'NA'} doorKick=${row.doorKick ?? 'NA'}`);
        if (!row.ok && opts.verboseFailures) {
            console.log(`  status=${out.status} signal=${out.signal || 'none'} error=${out.error ? (out.error.code || out.error.message) : 'none'}`);
            console.log('  stderr/stdout (failure):');
            console.log(text.slice(-4000));
        }
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
const avgAttackTurns = avgOf(results.map(r => r.attackTurns));
const avgFleeTurns = avgOf(results.map(r => r.fleeTurns));
const avgFleeHpEmergencyTurns = avgOf(results.map(r => r.fleeHpEmergencyTurns));
const avgFleeDlvl2RetreatTurns = avgOf(results.map(r => r.fleeDlvl2RetreatTurns));
const avgFleeToUpstairsTurns = avgOf(results.map(r => r.fleeToUpstairsTurns));
const avgFleeOscillationTurns = avgOf(results.map(r => r.fleeOscillationTurns));
const avgFleeDangerTurns = avgOf(results.map(r => r.fleeDangerTurns));
const avgFleeOtherTurns = avgOf(results.map(r => r.fleeOtherTurns));
const avgXl1AttackTurns = avgOf(results.map(r => r.xl1AttackTurns));
const avgReallyAttackPrompts = avgOf(results.map(r => r.reallyAttackPrompts));
const avgPetSwaps = avgOf(results.map(r => r.petSwapCount));
const avgAttackPetClassTurns = avgOf(results.map(r => r.attackPetClassTurns));
const avgAttackPetClassLowXpDlvl1Turns = avgOf(results.map(r => r.attackPetClassLowXpDlvl1Turns));
const avgAttackDogTurns = avgOf(results.map(r => r.attackDogTurns));
const avgAttackDogLowXpDlvl1Turns = avgOf(results.map(r => r.attackDogLowXpDlvl1Turns));
const avgLowXpDogLoopTurns = avgOf(results.map(r => r.lowXpDogLoopTurns));
const avgLowXpDogLoopDoorAdjTurns = avgOf(results.map(r => r.lowXpDogLoopDoorAdjTurns));
const avgAttackLowXpDogLoopDoorAdjTurns = avgOf(results.map(r => r.attackLowXpDogLoopDoorAdjTurns));
const avgLowXpDogLoopBlockingTurns = avgOf(results.map(r => r.lowXpDogLoopBlockingTurns));
const avgLowXpDogLoopNonBlockingTurns = avgOf(results.map(r => r.lowXpDogLoopNonBlockingTurns));
const avgAttackLowXpDogLoopBlockingTurns = avgOf(results.map(r => r.attackLowXpDogLoopBlockingTurns));
const avgAttackLowXpDogLoopNonBlockingTurns = avgOf(results.map(r => r.attackLowXpDogLoopNonBlockingTurns));
const avgAssign = avgOf(results.map(r => r.targetAssign));
const avgComplete = avgOf(results.map(r => r.targetComplete));
const avgNoProg = avgOf(results.map(r => r.abandonNoProgress));
const avgFailedAdds = avgOf(results.map(r => r.failedAdds));
const avgDoorOpen = avgOf(results.map(r => r.doorOpen));
const avgDoorKick = avgOf(results.map(r => r.doorKick));
const groupedAssignments = groupByAssignment(results);
console.log(`  Survived: ${survived}/${results.length}`);
console.log(`  Avg depth: ${Number.isFinite(avgDepth) ? avgDepth.toFixed(3) : 'NA'}`);
console.log(`  Reached depth>=3: ${reached3}/${results.length}`);
console.log(`  Reached XL2+: ${reachedXL2}/${results.length}`);
console.log(`  Reached XL3+: ${reachedXL3}/${results.length}`);
console.log(`  XP avg: maxXP=${fmtAvg(avgMaxXP)} t100=${fmtAvg(avgXP100)} t200=${fmtAvg(avgXP200)} t400=${fmtAvg(avgXP400)} t600=${fmtAvg(avgXP600)}`);
console.log(`  XP by turn 600: >=10 ${reachedXP10By600}/${results.length}, >=20 ${reachedXP20By600}/${results.length}`);
console.log(`  Action avg: attack=${fmtAvg(avgAttackTurns)} flee=${fmtAvg(avgFleeTurns)} xl1Attack=${fmtAvg(avgXl1AttackTurns)} reallyAttack=${fmtAvg(avgReallyAttackPrompts)} petSwap=${fmtAvg(avgPetSwaps)}`);
console.log(`  Flee avg: hpEmergency=${fmtAvg(avgFleeHpEmergencyTurns)} dlvl2Retreat=${fmtAvg(avgFleeDlvl2RetreatTurns)} toUpstairs=${fmtAvg(avgFleeToUpstairsTurns)} oscillation=${fmtAvg(avgFleeOscillationTurns)} danger=${fmtAvg(avgFleeDangerTurns)} other=${fmtAvg(avgFleeOtherTurns)}`);
console.log(`  Attack target avg: petClass=${fmtAvg(avgAttackPetClassTurns)} petClassLowXpDlvl1=${fmtAvg(avgAttackPetClassLowXpDlvl1Turns)} dog=${fmtAvg(avgAttackDogTurns)} dogLowXpDlvl1=${fmtAvg(avgAttackDogLowXpDlvl1Turns)}`);
console.log(`  Dog loop avg: lowXpDogLoop=${fmtAvg(avgLowXpDogLoopTurns)} doorAdj=${fmtAvg(avgLowXpDogLoopDoorAdjTurns)} attackDoorAdj=${fmtAvg(avgAttackLowXpDogLoopDoorAdjTurns)} blocking=${fmtAvg(avgLowXpDogLoopBlockingTurns)} nonBlocking=${fmtAvg(avgLowXpDogLoopNonBlockingTurns)} attackBlocking=${fmtAvg(avgAttackLowXpDogLoopBlockingTurns)} attackNonBlocking=${fmtAvg(avgAttackLowXpDogLoopNonBlockingTurns)}`);
console.log(`  Explore avg: assign=${fmtAvg(avgAssign)} complete=${fmtAvg(avgComplete)} noProg=${fmtAvg(avgNoProg)} failedAdd=${fmtAvg(avgFailedAdds)} doorOpen=${fmtAvg(avgDoorOpen)} doorKick=${fmtAvg(avgDoorKick)}`);
if (opts.repeats > 1) {
    console.log('\nPer-role aggregate results');
    for (const g of groupedAssignments) {
        console.log(`  role=${g.role} seed=${g.seed} runs=${g.runs} survived=${g.survived}/${g.runs} avgDepth=${fmtAvg(g.avgDepth)} avgMaxXP=${fmtAvg(g.avgMaxXP)} avgXP600=${fmtAvg(g.avgXP600)} avgAttack=${fmtAvg(g.avgAttackTurns)} avgFlee=${fmtAvg(g.avgFleeTurns)} avgDogLoop=${fmtAvg(g.avgLowXpDogLoopTurns)} avgFailedAdd=${fmtAvg(g.avgFailedAdds)}`);
    }
    const variable = groupedAssignments.filter(g => g.signatureCount > 1);
    console.log('\nRepeat variance diagnostics');
    console.log(`  Assignments with run-to-run differences: ${variable.length}/${groupedAssignments.length}`);
    for (const g of variable) {
        console.log(`  role=${g.role} seed=${g.seed} signatures=${g.signatureCount} depthRange=${fmtRange(g.minDepth, g.maxDepth)} maxXPRange=${fmtRange(g.minMaxXP, g.maxMaxXP)} xp600Range=${fmtRange(g.minXP600, g.maxXP600)} failedAddRange=${fmtRange(g.minFailedAdds, g.maxFailedAdds)} causes=${g.causeSet.join('|')}`);
    }
    console.log('\nPer-run results');
}
for (const r of results) {
    const repTag = opts.repeats > 1 ? ` repeat=${r.repeat}` : '';
    console.log(`  role=${r.role} seed=${r.seed}${repTag} depth=${r.depth ?? 'NA'} cause=${r.cause} maxXL=${r.maxXL ?? 'NA'} maxXP=${r.maxXP ?? 'NA'} xp100=${r.xp100 ?? 'NA'} xp200=${r.xp200 ?? 'NA'} xp400=${r.xp400 ?? 'NA'} xp600=${r.xp600 ?? 'NA'} atk=${r.attackTurns ?? 'NA'} flee=${r.fleeTurns ?? 'NA'} fleeHp=${r.fleeHpEmergencyTurns ?? 'NA'} fleeD2=${r.fleeDlvl2RetreatTurns ?? 'NA'} fleeUp=${r.fleeToUpstairsTurns ?? 'NA'} fleeOsc=${r.fleeOscillationTurns ?? 'NA'} fleeDanger=${r.fleeDangerTurns ?? 'NA'} fleeOther=${r.fleeOtherTurns ?? 'NA'} xl1Atk=${r.xl1AttackTurns ?? 'NA'} reallyAtk=${r.reallyAttackPrompts ?? 'NA'} petSwap=${r.petSwapCount ?? 'NA'} petAtk=${r.attackPetClassTurns ?? 'NA'} petAtkLow=${r.attackPetClassLowXpDlvl1Turns ?? 'NA'} dogAtk=${r.attackDogTurns ?? 'NA'} dogAtkLow=${r.attackDogLowXpDlvl1Turns ?? 'NA'} dogLoop=${r.lowXpDogLoopTurns ?? 'NA'} dogLoopDoorAdj=${r.lowXpDogLoopDoorAdjTurns ?? 'NA'} dogLoopDoorAdjAtk=${r.attackLowXpDogLoopDoorAdjTurns ?? 'NA'} dogLoopBlock=${r.lowXpDogLoopBlockingTurns ?? 'NA'} dogLoopNonBlock=${r.lowXpDogLoopNonBlockingTurns ?? 'NA'} dogLoopAtkBlock=${r.attackLowXpDogLoopBlockingTurns ?? 'NA'} dogLoopAtkNonBlock=${r.attackLowXpDogLoopNonBlockingTurns ?? 'NA'} xl2=${r.xl2} xl3=${r.xl3} assign=${r.targetAssign ?? 'NA'} complete=${r.targetComplete ?? 'NA'} noProg=${r.abandonNoProgress ?? 'NA'} failedAdd=${r.failedAdds ?? 'NA'} doorOpen=${r.doorOpen ?? 'NA'} doorKick=${r.doorKick ?? 'NA'}`);
}

const summary = {
    survived,
    totalRuns: results.length,
    avgDepth,
    reachedDepthGte3: reached3,
    reachedXL2,
    reachedXL3,
    avgMaxXP,
    avgXP100,
    avgXP200,
    avgXP400,
    avgXP600,
    reachedXP10By600,
    reachedXP20By600,
    avgAttackTurns,
    avgFleeTurns,
    avgFleeHpEmergencyTurns,
    avgFleeDlvl2RetreatTurns,
    avgFleeToUpstairsTurns,
    avgFleeOscillationTurns,
    avgFleeDangerTurns,
    avgFleeOtherTurns,
    avgXl1AttackTurns,
    avgReallyAttackPrompts,
    avgPetSwaps,
    avgAttackPetClassTurns,
    avgAttackPetClassLowXpDlvl1Turns,
    avgAttackDogTurns,
    avgAttackDogLowXpDlvl1Turns,
    avgLowXpDogLoopTurns,
    avgLowXpDogLoopDoorAdjTurns,
    avgAttackLowXpDogLoopDoorAdjTurns,
    avgLowXpDogLoopBlockingTurns,
    avgLowXpDogLoopNonBlockingTurns,
    avgAttackLowXpDogLoopBlockingTurns,
    avgAttackLowXpDogLoopNonBlockingTurns,
    avgAssign,
    avgComplete,
    avgNoProg,
    avgFailedAdds,
    avgDoorOpen,
    avgDoorKick,
};

if (opts.jsonOut) {
    const resolved = writeJsonOut(opts.jsonOut, {
        generatedAt: new Date().toISOString(),
        cwd: process.cwd(),
        pid: process.pid,
        options: opts,
        roles,
        seedPool,
        assignments,
        summary,
        groupedAssignments,
        results,
    });
    console.log(`\nJSON results written: ${resolved}`);
}

lockState.release();

function avgOf(values) {
    const nums = values.filter(v => Number.isFinite(v));
    if (nums.length === 0) return NaN;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function fmtAvg(v) {
    return Number.isFinite(v) ? v.toFixed(2) : 'NA';
}

function fmtRange(minV, maxV) {
    if (!Number.isFinite(minV) || !Number.isFinite(maxV)) return 'NA';
    return `${minV}..${maxV}`;
}

function writeJsonOut(outputPath, payload) {
    const resolved = path.resolve(outputPath);
    const dir = path.dirname(resolved);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(resolved, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return resolved;
}

function groupByAssignment(rows) {
    const groups = new Map();
    for (const r of rows) {
        const key = `${r.role}|${r.seed}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
    }
    const out = [];
    for (const [key, list] of groups.entries()) {
        const [role, seedStr] = key.split('|');
        const signatureSet = new Set(list.map(r => signatureForRow(r)));
        const causeSet = Array.from(new Set(list.map(r => r.cause))).sort();
        out.push({
            role,
            seed: parseInt(seedStr, 10),
            runs: list.length,
            survived: list.filter(r => r.cause === 'survived').length,
            avgDepth: avgOf(list.map(r => r.depth)),
            avgMaxXP: avgOf(list.map(r => r.maxXP)),
            avgXP600: avgOf(list.map(r => r.xp600)),
            avgAttackTurns: avgOf(list.map(r => r.attackTurns)),
            avgFleeTurns: avgOf(list.map(r => r.fleeTurns)),
            avgLowXpDogLoopTurns: avgOf(list.map(r => r.lowXpDogLoopTurns)),
            avgFailedAdds: avgOf(list.map(r => r.failedAdds)),
            minDepth: minOf(list.map(r => r.depth)),
            maxDepth: maxOf(list.map(r => r.depth)),
            minMaxXP: minOf(list.map(r => r.maxXP)),
            maxMaxXP: maxOf(list.map(r => r.maxXP)),
            minXP600: minOf(list.map(r => r.xp600)),
            maxXP600: maxOf(list.map(r => r.xp600)),
            minFailedAdds: minOf(list.map(r => r.failedAdds)),
            maxFailedAdds: maxOf(list.map(r => r.failedAdds)),
            signatureCount: signatureSet.size,
            causeSet,
        });
    }
    out.sort((a, b) => a.seed - b.seed || a.role.localeCompare(b.role));
    return out;
}

function signatureForRow(r) {
    return [
        r.cause ?? 'NA',
        r.depth ?? 'NA',
        r.maxXP ?? 'NA',
        r.xp600 ?? 'NA',
        r.failedAdds ?? 'NA',
        r.lowXpDogLoopTurns ?? 'NA',
    ].join('|');
}

function minOf(values) {
    const nums = values.filter(v => Number.isFinite(v));
    if (nums.length === 0) return NaN;
    return Math.min(...nums);
}

function maxOf(values) {
    const nums = values.filter(v => Number.isFinite(v));
    if (nums.length === 0) return NaN;
    return Math.max(...nums);
}

function acquireExclusiveLock(enabled) {
    const lockPath = '/tmp/c_role_matrix.lock';
    if (!enabled) return { lockPath, release: () => {} };

    const staleInfo = tryAcquireLock(lockPath);
    if (!staleInfo.ok) {
        const stalePid = staleInfo.stalePid;
        const lockError = staleInfo.error;
        if (stalePid && !isPidAlive(stalePid)) {
            try {
                fs.unlinkSync(lockPath);
            } catch {}
            const retry = tryAcquireLock(lockPath);
            if (!retry.ok) {
                console.error(`[LOCK] Unable to acquire matrix lock at ${lockPath}: ${retry.error || 'unknown error'}`);
                process.exit(1);
            }
            return registerLockRelease(lockPath, retry.fd);
        }
        const ownerStr = stalePid ? ` (held by pid ${stalePid})` : '';
        console.error(`[LOCK] Another matrix run appears active${ownerStr}.`);
        console.error(`       Retry with --no-exclusive to bypass (not recommended for accuracy).`);
        if (lockError) console.error(`       lock detail: ${lockError}`);
        process.exit(1);
    }
    return registerLockRelease(lockPath, staleInfo.fd);
}

function tryAcquireLock(lockPath) {
    try {
        const fd = fs.openSync(lockPath, 'wx');
        const payload = `${process.pid}\t${Date.now()}\t${process.cwd()}\n`;
        fs.writeFileSync(fd, payload, { encoding: 'utf8' });
        return { ok: true, fd };
    } catch (err) {
        if (!err || err.code !== 'EEXIST') {
            return { ok: false, error: err ? (err.message || err.code) : 'unknown' };
        }
        const stalePid = readLockPid(lockPath);
        return { ok: false, stalePid, error: 'lock already exists' };
    }
}

function registerLockRelease(lockPath, fd) {
    let released = false;
    const release = () => {
        if (released) return;
        released = true;
        try { fs.closeSync(fd); } catch {}
        try { fs.unlinkSync(lockPath); } catch {}
    };
    process.once('exit', release);
    process.once('SIGINT', () => { release(); process.exit(130); });
    process.once('SIGTERM', () => { release(); process.exit(143); });
    return { lockPath, release };
}

function readLockPid(lockPath) {
    try {
        const text = fs.readFileSync(lockPath, 'utf8').trim();
        const token = text.split(/\s+/)[0];
        const pid = parseInt(token, 10);
        return Number.isFinite(pid) ? pid : null;
    } catch {
        return null;
    }
}

function isPidAlive(pid) {
    if (!Number.isFinite(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (err) {
        if (err && err.code === 'ESRCH') return false;
        return true; // EPERM and other errors treated as "alive/unknown"
    }
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
    console.log('  --exclusive/--no-exclusive    Enable lock to prevent overlapping matrix runs (default: on)');
    console.log('  --repeats=N                   Repeat each role/seed assignment N times (default: 1)');
    console.log('  --json-out=PATH               Write machine-readable results JSON');
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
