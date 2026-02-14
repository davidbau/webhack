#!/usr/bin/env node
// selfplay/runner/keylog_to_replay.js
//
// Convert C keylog JSONL into compact replay JSON for JS reproducibility tests.

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

function parseArgs(argv) {
    const opts = { in: null, out: null };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--in=')) opts.in = a.slice(5);
        else if (a.startsWith('--out=')) opts.out = a.slice(6);
    }
    return opts;
}

function usage() {
    console.log('Usage: node selfplay/runner/keylog_to_replay.js --in=trace.jsonl [--out=replay.json]');
}

function main() {
    const opts = parseArgs(process.argv);
    if (!opts.in) {
        usage();
        process.exit(2);
    }

    const inputPath = resolve(opts.in);
    const lines = readFileSync(inputPath, 'utf8')
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

    const events = [];
    for (const line of lines) {
        try {
            const e = JSON.parse(line);
            if (typeof e.key === 'number') events.push(e);
        } catch {
            // Skip malformed lines.
        }
    }

    if (events.length === 0) {
        throw new Error(`No key events found in ${inputPath}`);
    }

    const seed = events[0].seed || null;
    const replay = {
        format: 'nethack-c-keylog-v1',
        seed,
        totalEvents: events.length,
        keys: events.map(e => e.key),
        events: events.map(e => ({
            seq: e.seq,
            key: e.key,
            moves: e.moves,
            x: e.x,
            y: e.y,
            dnum: e.dnum,
            dlevel: e.dlevel,
            in_getlin: e.in_getlin,
            in_moveloop: e.in_moveloop,
        })),
    };

    const outJson = JSON.stringify(replay, null, 2);
    if (opts.out) {
        const outPath = resolve(opts.out);
        writeFileSync(outPath, outJson);
        console.log(`Wrote ${outPath} (${events.length} events)`);
    } else {
        process.stdout.write(outJson + '\n');
    }
}

try {
    main();
} catch (err) {
    console.error(err?.stack || String(err));
    process.exit(1);
}

