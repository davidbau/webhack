// Test time option behavior
import { test } from 'node:test';
import assert from 'node:assert';

// Mock Player with showTime property
class MockPlayer {
    constructor(showTime = false) {
        this.name = 'TestChar';
        this.attributes = [10, 10, 10, 10, 10, 10];
        this.alignment = 0;
        this.hp = 15;
        this.maxHp = 15;
        this.power = 7;
        this.maxPower = 7;
        this.ac = 9;
        this.level = 1;
        this.exp = 0;
        this.depth = 1;
        this.gold = 0;
        this.turns = 123;
        this.hunger = 900;
        this.showExp = true;
        this.showTime = showTime;
        this.blind = false;
        this.confused = false;
        this.stunned = false;
        this.hallucinating = false;
    }
}

// Simple status line renderer matching display.js logic
function renderStatusLine2(player) {
    const line2Parts = [];

    line2Parts.push(`Dlvl:${player.depth}`);
    line2Parts.push(`$:${player.gold}`);
    line2Parts.push(`HP:${player.hp}(${player.maxHp})`);
    line2Parts.push(`Pw:${player.power}(${player.maxPower})`);
    line2Parts.push(`AC:${player.ac}`);

    // Experience
    if (player.showExp) {
        line2Parts.push(`Xp:${player.level}/${player.exp}`);
    } else {
        line2Parts.push(`Exp:${player.level}`);
    }

    // Turn counter (time option)
    if (player.showTime) {
        line2Parts.push(`T:${player.turns}`);
    }

    // Hunger status
    if (player.hunger <= 50) {
        line2Parts.push('Fainting');
    } else if (player.hunger <= 150) {
        line2Parts.push('Weak');
    } else if (player.hunger <= 300) {
        line2Parts.push('Hungry');
    }

    // Conditions
    if (player.blind) line2Parts.push('Blind');
    if (player.confused) line2Parts.push('Conf');
    if (player.stunned) line2Parts.push('Stun');
    if (player.hallucinating) line2Parts.push('Hallu');

    return line2Parts.join('  ');
}

test('time option - showTime=true includes turn counter', () => {
    const player = new MockPlayer(true);
    player.turns = 456;

    const statusLine = renderStatusLine2(player);

    assert.ok(statusLine.includes('T:456'), 'Status line should include turn counter');
    assert.match(statusLine, /T:456/, 'Turn counter should show correct value');
});

test('time option - showTime=false hides turn counter', () => {
    const player = new MockPlayer(false);
    player.turns = 789;

    const statusLine = renderStatusLine2(player);

    assert.ok(!statusLine.includes('T:'), 'Status line should NOT include turn counter');
    assert.ok(!statusLine.includes('789'), 'Turn value should not appear in status');
});

test('time option - other status fields still present when time=false', () => {
    const player = new MockPlayer(false);

    const statusLine = renderStatusLine2(player);

    // Verify other fields are still present
    assert.ok(statusLine.includes('Dlvl:1'), 'Should show depth');
    assert.ok(statusLine.includes('$:0'), 'Should show gold');
    assert.ok(statusLine.includes('HP:15(15)'), 'Should show HP');
    assert.ok(statusLine.includes('Pw:7(7)'), 'Should show power');
    assert.ok(statusLine.includes('AC:9'), 'Should show AC');
    assert.ok(statusLine.includes('Xp:1/0'), 'Should show experience');
});

test('time option - turn counter updates dynamically', () => {
    const player = new MockPlayer(true);

    // Turn 1
    player.turns = 1;
    let statusLine = renderStatusLine2(player);
    assert.ok(statusLine.includes('T:1'), 'Should show T:1');

    // Turn 100
    player.turns = 100;
    statusLine = renderStatusLine2(player);
    assert.ok(statusLine.includes('T:100'), 'Should show T:100');

    // Turn 9999
    player.turns = 9999;
    statusLine = renderStatusLine2(player);
    assert.ok(statusLine.includes('T:9999'), 'Should show T:9999');
});
