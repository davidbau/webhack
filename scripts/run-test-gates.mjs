#!/usr/bin/env node

import { spawn } from 'node:child_process';

const includeE2E = process.argv.includes('--e2e');
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const gates = [
    'test:unit',
    'test:session',
    ...(includeE2E ? ['test:e2e'] : []),
];

function runGate(gate) {
    return new Promise((resolve) => {
        console.log(`\n=== Running ${gate} ===`);
        const child = spawn(npmBin, ['run', gate], {
            stdio: 'inherit',
            env: process.env,
        });
        child.on('close', (code, signal) => {
            resolve({
                gate,
                code: typeof code === 'number' ? code : 1,
                signal: signal || null,
            });
        });
    });
}

const results = [];
for (const gate of gates) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await runGate(gate));
}

console.log('\n=== Test Gate Summary ===');
let failed = false;
for (const r of results) {
    const ok = r.code === 0 && !r.signal;
    const status = ok ? 'PASS' : 'FAIL';
    const suffix = r.signal ? ` (signal=${r.signal})` : ` (exit=${r.code})`;
    console.log(`${status}  ${r.gate}${suffix}`);
    if (!ok) failed = true;
}

process.exit(failed ? 1 : 0);
