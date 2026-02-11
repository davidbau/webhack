// test/comparison/other.test.js -- Other session tests
//
// Loads and tests option_test and selfplay sessions (8 files, ~1MB)

import { describe } from 'node:test';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runGameplaySession } from './session_test_runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SESSIONS_DIR = join(__dirname, 'sessions');
const MAPS_DIR = join(__dirname, 'maps');

// Discover option_test and selfplay sessions by filename pattern (zero parsing!)
const otherFiles = [];
for (const [dir, label] of [[SESSIONS_DIR, 'sessions'], [MAPS_DIR, 'maps']]) {
    if (!existsSync(dir)) continue;
    // option_test sessions have '_option_' in filename, selfplay have '_selfplay_'
    for (const f of readdirSync(dir).filter(f =>
        (f.includes('_option_') || f.includes('_selfplay_')) &&
        f.endsWith('.session.json')
    ).sort()) {
        otherFiles.push({ file: f, dir });
    }
}

// Run tests for each other session (option_test and selfplay use gameplay test logic)
for (const { file, dir } of otherFiles) {
    const session = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
    describe(`${file}`, () => {
        runGameplaySession(file, session);
    });
}
