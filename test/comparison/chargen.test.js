// test/comparison/chargen.test.js -- Character generation session tests
//
// Loads and tests only chargen-type sessions (90 files, ~10MB)

import { describe } from 'node:test';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runChargenSession } from './session_test_runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SESSIONS_DIR = join(__dirname, 'sessions');
const MAPS_DIR = join(__dirname, 'maps');

// Discover chargen session files by filename pattern (zero parsing during discovery!)
const chargenFiles = [];
for (const [dir, label] of [[SESSIONS_DIR, 'sessions'], [MAPS_DIR, 'maps']]) {
    if (!existsSync(dir)) continue;
    // All chargen sessions have '_chargen_' in their filename
    for (const f of readdirSync(dir).filter(f => f.includes('_chargen_') && f.endsWith('.session.json')).sort()) {
        chargenFiles.push({ file: f, dir });
    }
}

// Run tests for each chargen session (parse one file at a time, not all upfront)
for (const { file, dir } of chargenFiles) {
    const session = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
    describe(`${file}`, () => {
        runChargenSession(file, session);
    });
}
