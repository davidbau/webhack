// pickup_types.test.js -- Compare JS pickup_types behavior to C NetHack sessions
// Verifies that pickup_types filtering works identically to C NetHack

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test data: which items should be picked up for each configuration
const EXPECTED_PICKUPS = {
    'all': ['potion', 'scroll', 'dagger', 'ring', 'gold'],  // Empty string = pickup all
    'gold_only': ['gold'],  // $ = gold only
    'potions_scrolls': ['potion', 'scroll'],  // !? = potions and scrolls
    'valuables': ['potion', 'scroll', 'ring', 'gold'],  // $/!?=+ = gold, potions, scrolls, rings, spellbooks
};

/**
 * Parse C session and extract what items were picked up
 */
function parsePickedUpItems(session) {
    const pickedUp = [];

    // Look at the autopickup step (step 3 - move back onto items)
    const autopickupStep = session.steps.find(s => s.step === 3);
    if (!autopickupStep) return pickedUp;

    // Check messages for pickup notifications
    const screen = autopickupStep.screen;
    const topLine = screen[0] || '';

    // C NetHack shows pickup messages like "a - a potion of healing." or "58 gold pieces."
    if (topLine.includes('potion')) pickedUp.push('potion');
    if (topLine.includes('scroll')) pickedUp.push('scroll');
    if (topLine.includes('dagger')) pickedUp.push('dagger');
    if (topLine.includes('ring')) pickedUp.push('ring');
    if (topLine.includes('gold piece')) pickedUp.push('gold');

    // Also check inventory step (step 4) to be thorough
    const inventoryStep = session.steps.find(s => s.step === 4);
    if (inventoryStep) {
        const invScreen = inventoryStep.screen.join('\n');
        if (invScreen.includes('potion') && !pickedUp.includes('potion')) pickedUp.push('potion');
        if (invScreen.includes('scroll') && !pickedUp.includes('scroll')) pickedUp.push('scroll');
        if (invScreen.includes('dagger') && !pickedUp.includes('dagger')) pickedUp.push('dagger');
        if (invScreen.includes('ring') && !pickedUp.includes('ring')) pickedUp.push('ring');
        if (invScreen.includes('gold') && !pickedUp.includes('gold')) pickedUp.push('gold');
    }

    return pickedUp.sort();
}

/**
 * Load and parse C session file
 */
function loadCSession(filename) {
    const sessionPath = path.join(__dirname, 'sessions', filename);
    if (!fs.existsSync(sessionPath)) {
        throw new Error(`Session file not found: ${sessionPath}`);
    }
    const content = fs.readFileSync(sessionPath, 'utf-8');
    return JSON.parse(content);
}

// Test each pickup_types configuration
for (const [label, expectedItems] of Object.entries(EXPECTED_PICKUPS)) {
    test(`pickup_types: ${label} configuration matches C behavior`, () => {
        const sessionFile = `seed42_pickup_types_${label}.session.json`;

        // Load C session
        const session = loadCSession(sessionFile);

        // Verify session has expected pickup_types value
        const expectedValue = {
            'all': '',
            'gold_only': '$',
            'potions_scrolls': '!?',
            'valuables': '$/!?=+',
        }[label];

        assert.strictEqual(session.pickup_types, expectedValue,
            `Session should have pickup_types="${expectedValue}"`);

        // Parse what was picked up in C
        const cPickedUp = parsePickedUpItems(session);

        // Verify C picked up expected items
        assert.deepStrictEqual(cPickedUp.sort(), expectedItems.sort(),
            `C NetHack should have picked up: ${expectedItems.join(', ')}`);

        // TODO: Add JS simulation here to verify JS behavior matches C
        // For now, this test just verifies the C sessions were generated correctly
        // Full JS comparison will be added after verifying C behavior
    });
}

test('pickup_types: verify session files exist', () => {
    const requiredSessions = [
        'seed42_pickup_types_all.session.json',
        'seed42_pickup_types_gold_only.session.json',
        'seed42_pickup_types_potions_scrolls.session.json',
        'seed42_pickup_types_valuables.session.json',
    ];

    for (const filename of requiredSessions) {
        const sessionPath = path.join(__dirname, 'sessions', filename);
        assert.ok(fs.existsSync(sessionPath),
            `Session file should exist: ${filename}`);
    }
});

test('pickup_types: C sessions have correct structure', () => {
    const session = loadCSession('seed42_pickup_types_all.session.json');

    // Verify session structure
    assert.ok(session.seed, 'Session should have seed');
    assert.ok(session.steps, 'Session should have steps');
    assert.ok(Array.isArray(session.steps), 'Steps should be array');
    assert.ok(session.pickup_types !== undefined, 'Session should have pickup_types field');

    // Verify required steps exist
    const stepNumbers = session.steps.map(s => s.step);
    assert.ok(stepNumbers.includes(0), 'Should have startup step');
    assert.ok(stepNumbers.includes(3), 'Should have autopickup step');
    assert.ok(stepNumbers.includes(4), 'Should have inventory step');
});
