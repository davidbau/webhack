#!/usr/bin/env node
/**
 * Analyze C oracle RNG trace to understand generation phases
 * Identifies patterns and phase boundaries for deferred execution implementation
 */

import fs from 'fs';

const trace = JSON.parse(fs.readFileSync('./test/comparison/traces/oracle_seed42_c.json', 'utf8'));
const log = trace.rngLog;

console.log('=== C Oracle RNG Trace Phase Analysis (seed 42) ===\n');
console.log(`Total RNG calls: ${log.length}\n`);

// Identify phase boundaries by function patterns
const phases = [];
let currentPhase = null;

for (let i = 0; i < log.length; i++) {
    const call = log[i];
    const caller = call.caller || '';

    let phaseType = null;
    if (caller.includes('build_room') || caller.includes('create_room') || caller.includes('litstate_rnd') || caller.includes('rnd_rect') || caller.includes('nhl_rn2')) {
        phaseType = 'room_creation';
    } else if (caller.includes('dig_corridor') || caller.includes('corridor')) {
        phaseType = 'corridor_generation';
    } else if (caller.includes('mkobj') || caller.includes('mksobj') || caller.includes('next_ident') || caller.includes('blessorcurse')) {
        phaseType = 'object_placement';
    } else if (caller.includes('makemon') || caller.includes('rndmonst')) {
        phaseType = 'monster_placement';
    } else if (caller.includes('trap') || caller.includes('maketrap')) {
        phaseType = 'trap_placement';
    } else {
        phaseType = 'other';
    }

    if (!currentPhase || currentPhase.type !== phaseType) {
        if (currentPhase) {
            currentPhase.endCall = i;
            phases.push(currentPhase);
        }
        currentPhase = {
            type: phaseType,
            startCall: i + 1,
            endCall: null,
            count: 0
        };
    }
    currentPhase.count++;
}
if (currentPhase) {
    currentPhase.endCall = log.length;
    phases.push(currentPhase);
}

// Merge adjacent phases of same type
const mergedPhases = [];
for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    if (mergedPhases.length > 0 && mergedPhases[mergedPhases.length - 1].type === phase.type) {
        mergedPhases[mergedPhases.length - 1].endCall = phase.endCall;
        mergedPhases[mergedPhases.length - 1].count += phase.count;
    } else {
        mergedPhases.push(phase);
    }
}

console.log('Phase Breakdown:\n');
for (const phase of mergedPhases) {
    console.log(`${phase.type.padEnd(25)} calls ${phase.startCall.toString().padStart(4)}-${phase.endCall.toString().padEnd(4)} (${phase.count} calls)`);
    if (phase.startCall <= 3) {
        const firstCall = log[phase.startCall - 1];
        console.log(`  First: ${firstCall.func}(${firstCall.args}) = ${firstCall.result} @ ${firstCall.caller}`);
    }
}

// Find key transitions
console.log('\n=== Key Phase Transitions ===\n');

const roomPhase = mergedPhases.find(p => p.type === 'room_creation');
const corridorPhase = mergedPhases.find(p => p.type === 'corridor_generation');
const objectPhase = mergedPhases.find(p => p.type === 'object_placement');
const monsterPhase = mergedPhases.find(p => p.type === 'monster_placement');

if (roomPhase) {
    console.log(`Room Creation: calls ${roomPhase.startCall}-${roomPhase.endCall} (${roomPhase.count} calls)`);
    const sample = log[roomPhase.startCall - 1];
    console.log(`  Start: ${sample.func}(${sample.args}) @ ${sample.caller}`);
}

if (corridorPhase) {
    console.log(`\nCorridor Generation: calls ${corridorPhase.startCall}-${corridorPhase.endCall} (${corridorPhase.count} calls)`);
    const sample = log[corridorPhase.startCall - 1];
    console.log(`  Start: ${sample.func}(${sample.args}) @ ${sample.caller}`);
}

if (objectPhase) {
    console.log(`\nObject Placement: calls ${objectPhase.startCall}-${objectPhase.endCall} (${objectPhase.count} calls)`);
    const sample = log[objectPhase.startCall - 1];
    console.log(`  Start: ${sample.func}(${sample.args}) @ ${sample.caller}`);
    console.log(`  ☆ This is where JS diverges! JS does this FIRST, C does this AFTER corridors.`);
}

if (monsterPhase) {
    console.log(`\nMonster Placement: calls ${monsterPhase.startCall}-${monsterPhase.endCall} (${monsterPhase.count} calls)`);
    const sample = log[monsterPhase.startCall - 1];
    console.log(`  Start: ${sample.func}(${sample.args}) @ ${sample.caller}`);
}

// Sample room creation calls
console.log('\n=== Sample Room Creation Calls ===\n');
for (let i = 0; i < Math.min(20, log.length); i++) {
    const call = log[i];
    console.log(`${(i+1).toString().padStart(4)}: ${call.func}(${call.args}) = ${call.result} @ ${call.caller}`);
}

console.log('\n=== Sample Corridor Generation Calls ===\n');
if (corridorPhase) {
    const start = corridorPhase.startCall - 1;
    for (let i = start; i < Math.min(start + 20, log.length); i++) {
        const call = log[i];
        console.log(`${(i+1).toString().padStart(4)}: ${call.func}(${call.args}) = ${call.result} @ ${call.caller}`);
    }
}

console.log('\n=== Sample Object Placement Calls ===\n');
if (objectPhase) {
    const start = objectPhase.startCall - 1;
    for (let i = start; i < Math.min(start + 20, log.length); i++) {
        const call = log[i];
        console.log(`${(i+1).toString().padStart(4)}: ${call.func}(${call.args}) = ${call.result} @ ${call.caller}`);
    }
}
