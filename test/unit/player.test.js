// test/unit/player.test.js -- Tests for player creation and attributes
// C ref: you.h, role.c -- verifies player initialization and role data

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Player, roles, races, initialAlignmentRecordForRole } from '../../js/player.js';
import { initRng } from '../../js/rng.js';
import { M2_HUMAN, M2_ELF, M2_DWARF, M2_GNOME, M2_ORC } from '../../js/monsters.js';

describe('Player', () => {
    it('creates a player with default values', () => {
        const p = new Player();
        assert.equal(typeof p.x, 'number');
        assert.equal(typeof p.y, 'number');
        assert.ok(p.hp > 0);
        assert.ok(p.hpmax > 0);
        assert.equal(p.level, 1);
        assert.equal(p.exp, 0);
        assert.ok(Array.isArray(p.inventory));
        assert.equal(p.inventory.length, 0);
    });

    it('has 13 roles defined', () => {
        assert.equal(roles.length, 13);
        // Verify known roles
        const roleNames = roles.map(r => r.name);
        assert.ok(roleNames.includes('Archeologist'));
        assert.ok(roleNames.includes('Wizard'));
        assert.ok(roleNames.includes('Valkyrie'));
        assert.ok(roleNames.includes('Samurai'));
    });

    it('race masks match C love/hostility tables', () => {
        const [human, elf, dwarf, gnome, orc] = races;
        assert.equal(human.selfmask, M2_HUMAN);
        assert.equal(human.lovemask, 0);
        assert.equal(human.hatemask, M2_GNOME | M2_ORC);
        assert.equal(elf.selfmask, M2_ELF);
        assert.equal(elf.lovemask, M2_ELF);
        assert.equal(elf.hatemask, M2_ORC);
        assert.equal(dwarf.lovemask, M2_DWARF | M2_GNOME);
        assert.equal(gnome.hatemask, M2_HUMAN);
        assert.equal(orc.hatemask, M2_HUMAN | M2_ELF | M2_DWARF);
    });

    it('initRole sets role-specific stats', () => {
        const p = new Player();
        p.initRole(0); // Archeologist
        assert.equal(p.roleIndex, 0);
        assert.ok(p.hp > 0);
        assert.ok(p.hpmax > 0);
        assert.equal(p.hp, p.hpmax);
    });

    it('initialAlignmentRecordForRole matches C role initrecord groups', () => {
        assert.equal(initialAlignmentRecordForRole(0), 10);  // Archeologist
        assert.equal(initialAlignmentRecordForRole(7), 10);  // Rogue
        assert.equal(initialAlignmentRecordForRole(11), 0);  // Valkyrie
        assert.equal(initialAlignmentRecordForRole(12), 0);  // Wizard
    });

    it('initRole applies alignment record and resets alignment abuse', () => {
        const p = new Player();
        p.alignmentAbuse = 99;
        p.initRole(9); // Samurai
        assert.equal(p.alignmentRecord, 10);
        assert.equal(p.alignmentAbuse, 0);
    });

    it('each role has valid base stats', () => {
        for (let i = 0; i < roles.length; i++) {
            const p = new Player();
            p.initRole(i);
            assert.ok(p.hp > 0, `${roles[i].name} should have positive HP`);
            assert.ok(p.hpmax > 0, `${roles[i].name} should have positive max HP`);
            assert.ok(p.ac <= 10, `${roles[i].name} AC should be <= 10`);
        }
    });

    it('has six attributes', () => {
        const p = new Player();
        p.initRole(0);
        assert.ok(Array.isArray(p.attributes));
        assert.equal(p.attributes.length, 6);
        for (const attr of p.attributes) {
            assert.ok(attr >= 3 && attr <= 25, `Attribute ${attr} out of range`);
        }
    });

    it('has hunger system', () => {
        const p = new Player();
        assert.ok(p.hunger > 0, 'Player should start with hunger');
    });

    it('addToInventory adds items', () => {
        const p = new Player();
        const item = { name: 'dagger', oc_class: 0 };
        p.addToInventory(item);
        assert.equal(p.inventory.length, 1);
        assert.equal(p.inventory[0].name, 'dagger');
        assert.ok(item.invlet, 'Item should get an inventory letter');
    });

    it('addToInventory assigns sequential letters', () => {
        const p = new Player();
        p.addToInventory({ name: 'dagger', oc_class: 0 });
        p.addToInventory({ name: 'arrow', oc_class: 0 });
        p.addToInventory({ name: 'armor', oc_class: 1 });
        assert.equal(p.inventory[0].invlet, 'a');
        assert.equal(p.inventory[1].invlet, 'b');
        assert.equal(p.inventory[2].invlet, 'c');
    });

    it('removeFromInventory removes items', () => {
        const p = new Player();
        const item = { name: 'dagger', oc_class: 0 };
        p.addToInventory(item);
        p.removeFromInventory(item);
        assert.equal(p.inventory.length, 0);
    });

    it('takeDamage reduces HP and tracks death', () => {
        const p = new Player();
        p.initRole(0);
        const startHp = p.hp;
        p.takeDamage(1);
        assert.equal(p.hp, startHp - 1);
        assert.ok(!p.isDead);

        // Kill the player
        p.takeDamage(p.hp + 10);
        assert.ok(p.isDead || p.hp <= 0);
    });

    it('heal increases HP up to max', () => {
        const p = new Player();
        p.initRole(0);
        p.hp = 1;
        p.heal(100);
        assert.equal(p.hp, p.hpmax, 'Heal should not exceed max HP');
    });
});
