// test/comparison/map.test.js -- Map generation session tests
//
// Loads and tests only map-type sessions (5 files, ~1MB)

import { describe } from 'node:test';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runMapSession } from './session_test_runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SESSIONS_DIR = join(__dirname, 'sessions');
const MAPS_DIR = join(__dirname, 'maps');

// Discover map sessions by filename pattern (zero parsing!)
const mapFiles = [];
for (const [dir, label] of [[SESSIONS_DIR, 'sessions'], [MAPS_DIR, 'maps']]) {
    if (!existsSync(dir)) continue;
    // All map sessions have '_map.session.json' in their filename
    for (const f of readdirSync(dir).filter(f => f.includes('_map.session.json')).sort()) {
        mapFiles.push({ file: f, dir });
    }
}

// Run tests for each map session
for (const { file, dir } of mapFiles) {
    const session = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
    describe(`${file}`, () => {
        runMapSession(file, session);
    });
}
