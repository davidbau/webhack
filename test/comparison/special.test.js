// test/comparison/special.test.js -- Special level session tests
//
// Loads and tests only special-type sessions (42 files, ~5MB)

import { describe } from 'node:test';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSpecialLevelSession } from './session_test_runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SESSIONS_DIR = join(__dirname, 'sessions');
const MAPS_DIR = join(__dirname, 'maps');

// Discover special level sessions by filename pattern (zero parsing!)
const specialFiles = [];
for (const [dir, label] of [[SESSIONS_DIR, 'sessions'], [MAPS_DIR, 'maps']]) {
    if (!existsSync(dir)) continue;
    // All special sessions have '_special_' in their filename
    for (const f of readdirSync(dir).filter(f => f.includes('_special_') && f.endsWith('.session.json')).sort()) {
        specialFiles.push({ file: f, dir });
    }
}

// Run tests for each special level session
for (const { file, dir } of specialFiles) {
    const session = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
    describe(`${file}`, () => {
        runSpecialLevelSession(file, session);
    });
}
