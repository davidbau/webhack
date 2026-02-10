// Test confirm option behavior
import { test } from 'node:test';
import assert from 'node:assert';

// Simulate confirm check logic
function shouldConfirmAttack(mon, confirm) {
    // Confirm attacking peaceful (non-pet) monsters when confirm enabled
    if (mon.peaceful && !mon.tame && confirm) {
        return { needsConfirm: true, prompt: `Really attack ${mon.name}?` };
    }

    return { needsConfirm: false };
}

test('confirm - disabled does not prompt', () => {
    const peaceful = { tame: false, peaceful: true, name: 'shopkeeper' };
    const result = shouldConfirmAttack(peaceful, false);

    assert.ok(!result.needsConfirm, 'Should not prompt when confirm=false');
});

test('confirm - enabled prompts for peaceful monsters', () => {
    const peaceful = { tame: false, peaceful: true, name: 'shopkeeper' };
    const result = shouldConfirmAttack(peaceful, true);

    assert.ok(result.needsConfirm, 'Should prompt when confirm=true');
    assert.ok(result.prompt, 'Should provide confirmation prompt');
    assert.match(result.prompt, /Really attack/, 'Prompt should ask for confirmation');
    assert.match(result.prompt, /shopkeeper/, 'Prompt should include monster name');
});

test('confirm - does not prompt for hostile monsters', () => {
    const hostile = { tame: false, peaceful: false, name: 'orc' };
    const result = shouldConfirmAttack(hostile, true);

    assert.ok(!result.needsConfirm, 'Should not prompt for hostile monsters');
});

test('confirm - does not prompt for pets', () => {
    const pet = { tame: true, peaceful: true, name: 'dog' };
    const result = shouldConfirmAttack(pet, true);

    assert.ok(!result.needsConfirm, 'Should not prompt for pets (handled by safe_pet)');
});

test('confirm - prompt includes monster name', () => {
    const monsters = [
        { tame: false, peaceful: true, name: 'shopkeeper' },
        { tame: false, peaceful: true, name: 'guard' },
        { tame: false, peaceful: true, name: 'priest' }
    ];

    for (const mon of monsters) {
        const result = shouldConfirmAttack(mon, true);
        assert.ok(result.needsConfirm, `Should prompt for ${mon.name}`);
        assert.match(result.prompt, new RegExp(mon.name),
            `Prompt should mention ${mon.name}`);
    }
});

test('confirm - only affects peaceful non-pets', () => {
    const testCases = [
        { mon: { tame: true, peaceful: true, name: 'dog' }, shouldPrompt: false, desc: 'pet' },
        { mon: { tame: false, peaceful: true, name: 'shopkeeper' }, shouldPrompt: true, desc: 'peaceful' },
        { mon: { tame: false, peaceful: false, name: 'orc' }, shouldPrompt: false, desc: 'hostile' }
    ];

    for (const { mon, shouldPrompt, desc } of testCases) {
        const result = shouldConfirmAttack(mon, true);
        if (shouldPrompt) {
            assert.ok(result.needsConfirm, `Should prompt for ${desc}`);
        } else {
            assert.ok(!result.needsConfirm, `Should not prompt for ${desc}`);
        }
    }
});
