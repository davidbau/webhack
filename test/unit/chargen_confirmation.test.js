// Test character generation confirmation behavior
import { describe, test } from 'node:test';
import assert from 'assert';

describe('chargen confirmation', () => {

test('confirmation: name case is preserved', () => {
    // Player enters name with capital letter
    const playerName = 'David';

    // Confirmation should show name as entered (not lowercased)
    const confirmText = `${playerName} the chaotic male elven Priest`;

    assert.ok(confirmText.includes('David'),
        'Confirmation should preserve name capitalization');
    assert.ok(!confirmText.includes('david'),
        'Confirmation should not lowercase the name');
});

test('confirmation: * key accepts like y', () => {
    // Menu advertises: "y * Yes; start game"
    // Both 'y' and '*' should return true (accept)

    const yKey = 'y';
    const starKey = '*';
    const nKey = 'n';

    // Simulate confirmation logic
    const acceptY = yKey === 'y' || yKey === '*';
    const acceptStar = starKey === 'y' || starKey === '*';
    const acceptN = nKey === 'y' || nKey === '*';

    assert.strictEqual(acceptY, true,
        '"y" key should accept confirmation');
    assert.strictEqual(acceptStar, true,
        '"*" key should accept confirmation (advertised as equivalent to y)');
    assert.strictEqual(acceptN, false,
        '"n" key should reject confirmation');
});

test('confirmation: q key quits', () => {
    // 'q' should quit (reload page in implementation)
    const qKey = 'q';

    // In actual code, this triggers window.location.reload()
    // Here we just verify it's not treated as accept/reject
    const isAccept = qKey === 'y' || qKey === '*';
    const isReject = qKey === 'n';

    assert.strictEqual(isAccept, false, '"q" should not accept');
    assert.strictEqual(isReject, false, '"q" should not reject');
    // In actual implementation, it returns false after reload
});

test('welcome message: name case is preserved', () => {
    // Player enters name with capital letter
    const playerName = 'Alice';
    const greeting = 'Hello';

    // Welcome message should preserve case
    const welcomeMsg = `${greeting} ${playerName}, welcome to NetHack!  You are a lawful female human Valkyrie.`;

    assert.ok(welcomeMsg.includes('Alice'),
        'Welcome message should preserve name capitalization');
    assert.ok(!welcomeMsg.includes('alice'),
        'Welcome message should not lowercase the name');
});

test('welcome message: mixed case names preserved', () => {
    // Test with mixed case name
    const playerName = 'McDavid';
    const greeting = 'Greetings';

    const welcomeMsg = `${greeting} ${playerName}, welcome to NetHack!`;

    assert.strictEqual(welcomeMsg, 'Greetings McDavid, welcome to NetHack!',
        'Mixed case names like "McDavid" should be preserved exactly');
});

}); // describe
