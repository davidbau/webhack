#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const projectRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const unitDir = join(projectRoot, 'test', 'unit');
const SKIP_SESSION_FILE_BASENAMES = new Set([
    // Legacy replay fixture names that are intentionally covered by test:session
    'replay_sparse_boundary_seed110.test.js',
    'replay_sparse_boundary_seed208.test.js',
    'monster_throw_message_naming.test.js',
    'monster_throw_no_spurious_you_kill_seed110.test.js',
    'monster_throw_overflow_message_seed206.test.js',
    'pet_combat_message_seed3.test.js',
    'screen_compare.test.js',
]);

const SESSION_MARKERS = [
    /\breplaySession\b/s,
    /\bloadAllSessions\b/s,
    /sessionPath\s*:\s*['"]/,
    /test\/comparison\/sessions\//,
];

const isSessionFixture = (name, contents) => {
    if (SKIP_SESSION_FILE_BASENAMES.has(name)) return true;

    if (name.startsWith('replay_') && name.endsWith('.test.js')) return true;
    if (name.match(/^monster_throw_.*\.test\.js$/)) return true;
    if (name === 'pet_combat_message_seed3.test.js') return true;

    return SESSION_MARKERS.some((re) => re.test(contents));
};

const files = readdirSync(unitDir)
    .filter((name) => name.endsWith('.test.js'))
    .filter((name) => {
        const contents = readFileSync(join(unitDir, name), 'utf8');
        return !isSessionFixture(name, contents);
    })
    .map((name) => join('test', 'unit', name));

if (files.length === 0) {
    console.error('No unit test files selected.');
    process.exit(1);
}

console.log(`[test:unit] running ${files.length} non-session unit test files`);
const skipped = readdirSync(unitDir)
    .filter((name) => name.endsWith('.test.js'))
    .filter((name) => !files.includes(join('test', 'unit', name)));
if (skipped.length > 0) {
    console.log(`[test:unit] skipping ${skipped.length} session fixture files: ${skipped.join(', ')}`);
}

const result = spawnSync(process.execPath, [
    '--test',
    '--test-timeout=1000',
    ...files,
], {
    cwd: projectRoot,
    stdio: 'inherit',
    encoding: 'utf8',
});

process.exit(result.status ?? 0);
