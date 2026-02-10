// Test safe_pet option behavior
import { test } from 'node:test';
import assert from 'node:assert';

// Simulate safe_pet check logic
function canAttackMonster(mon, safe_pet, forceFight) {
    // Safe pet check - prevent attacking tame monsters when safe_pet enabled
    if (mon.tame && safe_pet) {
        return { allowed: false, reason: 'Cannot attack your pet!' };
    }

    // Otherwise attack is allowed
    return { allowed: true };
}

test('safe_pet - disabled allows attacking pets', () => {
    const pet = { tame: true, name: 'dog' };
    const result = canAttackMonster(pet, false, false);

    assert.ok(result.allowed, 'Should allow attacking pets when safe_pet=false');
});

test('safe_pet - enabled prevents attacking pets', () => {
    const pet = { tame: true, name: 'dog' };
    const result = canAttackMonster(pet, true, false);

    assert.ok(!result.allowed, 'Should prevent attacking pets when safe_pet=true');
    assert.match(result.reason, /pet/, 'Should mention pet in error message');
});

test('safe_pet - does not affect non-pets', () => {
    const hostile = { tame: false, peaceful: false, name: 'orc' };
    const resultOn = canAttackMonster(hostile, true, false);
    const resultOff = canAttackMonster(hostile, false, false);

    assert.ok(resultOn.allowed, 'Should allow attacking hostiles with safe_pet=true');
    assert.ok(resultOff.allowed, 'Should allow attacking hostiles with safe_pet=false');
});

test('safe_pet - prevents even with forceFight', () => {
    const pet = { tame: true, name: 'cat' };
    const result = canAttackMonster(pet, true, true);

    // safe_pet should override forceFight
    assert.ok(!result.allowed, 'Should prevent attacking pets even with forceFight');
});

test('safe_pet - allows attacking peaceful non-pets', () => {
    const peaceful = { tame: false, peaceful: true, name: 'shopkeeper' };
    const result = canAttackMonster(peaceful, true, false);

    assert.ok(result.allowed, 'Should allow attacking peaceful non-pets');
});

test('safe_pet - protection only for tame monsters', () => {
    const tame = { tame: true, peaceful: true, name: 'dog' };
    const peaceful = { tame: false, peaceful: true, name: 'shopkeeper' };
    const hostile = { tame: false, peaceful: false, name: 'orc' };

    const tameResult = canAttackMonster(tame, true, false);
    const peacefulResult = canAttackMonster(peaceful, true, false);
    const hostileResult = canAttackMonster(hostile, true, false);

    assert.ok(!tameResult.allowed, 'Tame monster should be protected');
    assert.ok(peacefulResult.allowed, 'Peaceful non-pet should not be protected');
    assert.ok(hostileResult.allowed, 'Hostile should not be protected');
});
