// test/comparison/gameplay.test.js -- Gameplay session tests
//
// Loads and tests only gameplay-type sessions (12 files, ~2MB)

import { describe } from 'node:test';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runGameplaySession } from './session_test_runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SESSIONS_DIR = join(__dirname, 'sessions');
const MAPS_DIR = join(__dirname, 'maps');

// Discover gameplay sessions by filename pattern (zero parsing!)
const gameplayFiles = [];
for (const [dir, label] of [[SESSIONS_DIR, 'sessions'], [MAPS_DIR, 'maps']]) {
    if (!existsSync(dir)) continue;
    // All gameplay sessions have '_gameplay.session.json' in their filename
    for (const f of readdirSync(dir).filter(f => f.includes('_gameplay.session.json')).sort()) {
        gameplayFiles.push({ file: f, dir });
    }
}

// Run tests for each gameplay session
for (const { file, dir } of gameplayFiles) {
    const session = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
    describe(`${file}`, () => {
        runGameplaySession(file, session);
    });
}
