#!/usr/bin/env node
// selfplay/runner/trace_capturer.js -- Capture gameplay traces from C NetHack
//
// Runs the selfplay agent against C NetHack and captures detailed traces
// of interesting gameplay situations for JS implementation improvement.

import { Agent } from '../agent.js';
import { TmuxAdapter } from '../interface/tmux_adapter.js';
import fs from 'fs';
import path from 'path';

/**
 * Capture a gameplay trace
 */
async function captureTrace(options = {}) {
    const seed = options.seed || Math.floor(Math.random() * 100000);
    const maxTurns = options.maxTurns || 100;
    const role = options.role || 'Valkyrie';
    const outputDir = options.outputDir || 'traces/captured';

    console.log(`Capturing trace: seed=${seed}, role=${role}, maxTurns=${maxTurns}`);

    const adapter = new TmuxAdapter({ keyDelay: 40 });
    const trace = {
        metadata: {
            seed,
            role,
            captureDate: new Date().toISOString(),
            maxTurns,
        },
        turns: [],
        interesting: [], // Notable events
    };

    try {
        await adapter.start({ seed, role, race: 'human', name: 'Agent' });

        const agent = new Agent(adapter, {
            maxTurns,
            onTurn: (info) => {
                // Capture turn data
                const turnData = {
                    turn: info.turn,
                    hp: info.hp,
                    hpmax: info.hpmax,
                    dlvl: info.dlvl,
                    position: info.position,
                    action: {
                        type: info.action?.type,
                        key: info.action?.key,
                        reason: info.action?.reason,
                    },
                };

                // Detect interesting events
                if (info.action?.type === 'attack') {
                    trace.interesting.push({
                        turn: info.turn,
                        event: 'combat',
                        detail: info.action.reason,
                    });
                }
                if (info.action?.type === 'quaff') {
                    trace.interesting.push({
                        turn: info.turn,
                        event: 'item_usage',
                        detail: 'healing potion',
                    });
                }
                if (info.action?.type === 'pray') {
                    trace.interesting.push({
                        turn: info.turn,
                        event: 'prayer',
                        detail: info.action.reason,
                    });
                }
                if (info.hp < info.hpmax * 0.5) {
                    if (!trace.interesting.some(e => e.turn === info.turn && e.event === 'low_hp')) {
                        trace.interesting.push({
                            turn: info.turn,
                            event: 'low_hp',
                            detail: `${info.hp}/${info.hpmax}`,
                        });
                    }
                }

                trace.turns.push(turnData);

                if (info.turn % 20 === 0) {
                    console.log(`  Turn ${info.turn}: HP=${info.hp}/${info.hpmax} Dlvl=${info.dlvl} ${info.action?.type || '?'}`);
                }
            },
        });

        const stats = await agent.run();
        trace.metadata.finalStats = stats;

        // Determine interestingness score
        const score = calculateInterestingness(trace);
        trace.metadata.interestingness = score;

        // Save trace if interesting
        if (score > 10 || options.saveAll) {
            const filename = `trace_${seed}_${role.toLowerCase()}_score${score}.json`;
            const filepath = path.join(outputDir, filename);

            // Ensure directory exists
            fs.mkdirSync(outputDir, { recursive: true });

            fs.writeFileSync(filepath, JSON.stringify(trace, null, 2));
            console.log(`\nSaved trace: ${filepath}`);
            console.log(`  Interestingness score: ${score}`);
            console.log(`  Notable events: ${trace.interesting.length}`);
            console.log(`  Final: Dlvl ${stats.maxDepth}, ${stats.turns} turns`);

            return { filepath, score, trace };
        } else {
            console.log(`\nTrace not interesting enough (score ${score}), skipping save`);
            return null;
        }

    } catch (err) {
        console.error('Error capturing trace:', err.message);
        throw err;
    } finally {
        await adapter.stop();
    }
}

/**
 * Calculate how interesting a trace is
 * Higher scores = more interesting gameplay situations
 */
function calculateInterestingness(trace) {
    let score = 0;

    // Combat encounters
    const combatEvents = trace.interesting.filter(e => e.event === 'combat').length;
    score += combatEvents * 3;

    // Item usage (potions, prayer)
    const itemEvents = trace.interesting.filter(e => e.event === 'item_usage').length;
    score += itemEvents * 5;

    const prayerEvents = trace.interesting.filter(e => e.event === 'prayer').length;
    score += prayerEvents * 10;

    // Low HP situations (danger)
    const lowHPEvents = trace.interesting.filter(e => e.event === 'low_hp').length;
    score += lowHPEvents * 2;

    // Deeper dungeon = more interesting
    score += (trace.metadata.finalStats?.maxDepth || 1) * 5;

    // Longer games = more gameplay
    score += Math.min(trace.turns.length / 10, 10);

    return Math.floor(score);
}

/**
 * Capture multiple traces with different seeds
 */
async function captureMultiple(count, options = {}) {
    const results = [];

    for (let i = 0; i < count; i++) {
        console.log(`\n=== Capturing trace ${i + 1}/${count} ===`);
        try {
            const result = await captureTrace({
                ...options,
                seed: options.baseSeed ? options.baseSeed + i : Math.floor(Math.random() * 100000),
            });

            if (result) {
                results.push(result);
            }
        } catch (err) {
            console.error(`Failed to capture trace ${i + 1}:`, err.message);
        }
    }

    // Sort by interestingness
    results.sort((a, b) => b.score - a.score);

    console.log('\n=== Capture Summary ===');
    console.log(`Captured ${results.length} interesting traces`);
    if (results.length > 0) {
        console.log('\nTop traces:');
        results.slice(0, 5).forEach((r, i) => {
            console.log(`  ${i + 1}. ${path.basename(r.filepath)} (score: ${r.score})`);
        });
    }

    return results;
}

// CLI
const args = process.argv.slice(2);
const opts = {
    count: 5,
    maxTurns: 100,
    seed: null,
    role: 'Valkyrie',
    saveAll: false,
    outputDir: 'traces/captured',
};

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
        const eqIndex = arg.indexOf('=');
        if (eqIndex !== -1) {
            const key = arg.slice(2, eqIndex);
            const value = arg.slice(eqIndex + 1);
            if (key === 'count') opts.count = parseInt(value);
            else if (key === 'turns') opts.maxTurns = parseInt(value);
            else if (key === 'seed') opts.seed = parseInt(value);
            else if (key === 'role') opts.role = value;
            else if (key === 'output') opts.outputDir = value;
        } else if (arg === '--save-all') {
            opts.saveAll = true;
        } else if (arg === '--help') {
            console.log('Usage: trace_capturer.js [options]');
            console.log('  --count=N       Capture N traces (default: 5)');
            console.log('  --turns=N       Max turns per trace (default: 100)');
            console.log('  --seed=N        Use specific seed (default: random)');
            console.log('  --role=ROLE     Character role (default: Valkyrie)');
            console.log('  --output=DIR    Output directory (default: traces/captured)');
            console.log('  --save-all      Save all traces, not just interesting ones');
            process.exit(0);
        }
    }
}

console.log('NetHack Trace Capturer');
console.log(`  Capturing ${opts.count} traces`);
console.log(`  Max turns: ${opts.maxTurns}`);
console.log(`  Output: ${opts.outputDir}`);
console.log('');

captureMultiple(opts.count, opts)
    .then(results => {
        console.log('\nDone!');
        process.exit(0);
    })
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
