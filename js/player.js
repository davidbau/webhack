// player.js -- Player state and actions
// Mirrors struct you from you.h and player-related globals from decl.h

import { A_STR, A_INT, A_WIS, A_DEX, A_CON, A_CHA, NUM_ATTRS,
         NORMAL_SPEED, A_NEUTRAL, RACE_HUMAN } from './config.js';

// Roles table -- simplified from role.c
// C ref: src/role.c roles[] array
export const roles = [
    { name: 'Archeologist', abbr: 'Arc', str: 7, int: 10, wis: 10, dex: 7, con: 7, cha: 7,
      startingHP: 11, startingPW: 1, enadv: 0, align: A_NEUTRAL, petType: null },  // NON_PM
    { name: 'Barbarian', abbr: 'Bar', str: 16, int: 7, wis: 7, dex: 15, con: 16, cha: 6,
      startingHP: 14, startingPW: 1, enadv: 0, align: A_NEUTRAL, petType: null },  // NON_PM
    { name: 'Caveman', abbr: 'Cav', str: 10, int: 7, wis: 7, dex: 7, con: 8, cha: 6,
      startingHP: 14, startingPW: 1, enadv: 0, align: A_NEUTRAL, petType: 'dog' },
    { name: 'Healer', abbr: 'Hea', str: 7, int: 7, wis: 13, dex: 7, con: 11, cha: 16,
      startingHP: 11, startingPW: 1, enadv: 4, align: A_NEUTRAL, petType: null },  // NON_PM
    { name: 'Knight', abbr: 'Kni', str: 13, int: 7, wis: 14, dex: 8, con: 10, cha: 17,
      startingHP: 14, startingPW: 1, enadv: 4, align: 1, petType: 'pony' },
    { name: 'Monk', abbr: 'Mon', str: 10, int: 7, wis: 8, dex: 8, con: 7, cha: 7,
      startingHP: 12, startingPW: 2, enadv: 2, align: A_NEUTRAL, petType: null },  // NON_PM
    { name: 'Priest', abbr: 'Pri', str: 7, int: 7, wis: 10, dex: 7, con: 7, cha: 7,
      startingHP: 12, startingPW: 4, enadv: 3, align: A_NEUTRAL, petType: null },  // NON_PM
    { name: 'Ranger', abbr: 'Ran', str: 13, int: 13, wis: 13, dex: 9, con: 13, cha: 7,
      startingHP: 13, startingPW: 1, enadv: 0, align: A_NEUTRAL, petType: 'dog' },
    { name: 'Rogue', abbr: 'Rog', str: 7, int: 7, wis: 7, dex: 10, con: 7, cha: 6,
      startingHP: 10, startingPW: 1, enadv: 0, align: -1, petType: null },  // NON_PM
    { name: 'Samurai', abbr: 'Sam', str: 10, int: 8, wis: 7, dex: 10, con: 17, cha: 6,
      startingHP: 13, startingPW: 1, enadv: 0, align: 1, petType: 'dog' },
    { name: 'Tourist', abbr: 'Tou', str: 7, int: 10, wis: 6, dex: 7, con: 7, cha: 10,
      startingHP: 8, startingPW: 1, enadv: 0, align: A_NEUTRAL, petType: null },  // NON_PM
    { name: 'Valkyrie', abbr: 'Val', str: 10, int: 7, wis: 7, dex: 7, con: 10, cha: 7,
      startingHP: 14, startingPW: 1, enadv: 0, align: A_NEUTRAL, petType: null },  // NON_PM
    { name: 'Wizard', abbr: 'Wiz', str: 7, int: 10, wis: 7, dex: 7, con: 7, cha: 7,
      startingHP: 10, startingPW: 4, enadv: 3, align: A_NEUTRAL, petType: 'cat' },
];

export class Player {
    constructor() {
        // Position
        // C ref: you.h u.ux, u.uy
        this.x = 0;
        this.y = 0;

        // Identity
        this.name = 'Adventurer';
        this.roleIndex = 0;
        this.race = RACE_HUMAN;
        this.gender = 0;
        this.alignment = A_NEUTRAL;

        // Vital stats
        // C ref: you.h u.uhp, u.uhpmax, u.uen, u.uenmax
        this.hp = 12;
        this.hpmax = 12;
        this.pw = 1;     // power (mana)
        this.pwmax = 1;
        this.ac = 10;    // armor class (lower is better)
        this.level = 1;  // experience level
        this.exp = 0;    // experience points
        this.score = 0;

        // Attributes [STR, INT, WIS, DEX, CON, CHA]
        // C ref: attrib.h, you.h acurr/abon/amax/atemp etc.
        this.attributes = [10, 10, 10, 10, 10, 10];

        // Dungeon position
        this.dungeonLevel = 1;
        this.maxDungeonLevel = 1;

        // Resources
        this.gold = 0;

        // Hunger: 900 = normal starting value
        // C ref: you.h u.uhunger (starts at 900)
        this.hunger = 900;
        this.nutrition = 900;

        // Movement
        this.movement = NORMAL_SPEED;
        this.speed = NORMAL_SPEED;
        this.moved = false;

        // Luck
        // C ref: you.h u.uluck, u.moreluck
        this.luck = 0;
        this.moreluck = 0;

        // Status effects
        this.blind = false;
        this.confused = false;
        this.stunned = false;
        this.hallucinating = false;
        this.sick = false;
        this.foodpoisoned = false;

        // Inventory
        // C ref: decl.h invent (linked list in C, array in JS)
        this.inventory = [];

        // Equipment slots
        // C ref: decl.h uarm, uarmc, uarmh, etc.
        this.weapon = null;
        this.armor = null;
        this.shield = null;
        this.helmet = null;
        this.gloves = null;
        this.boots = null;
        this.cloak = null;
        this.amulet = null;
        this.leftRing = null;
        this.rightRing = null;

        // Turns
        this.turns = 0;

        // Display options
        this.showExp = true;
    }

    // Initialize player for a new game with a given role
    // C ref: u_init.c u_init()
    initRole(roleIndex) {
        this.roleIndex = roleIndex;
        const role = roles[roleIndex];
        if (!role) return;

        this.attributes[A_STR] = role.str;
        this.attributes[A_INT] = role.int;
        this.attributes[A_WIS] = role.wis;
        this.attributes[A_DEX] = role.dex;
        this.attributes[A_CON] = role.con;
        this.attributes[A_CHA] = role.cha;

        this.hp = role.startingHP;
        this.hpmax = role.startingHP;
        this.pw = role.startingPW;
        this.pwmax = role.startingPW;
        this.alignment = role.align;

        // Starting AC depends on role; default 10 = unarmored
        this.ac = 10;
    }

    // Get the role name
    get roleName() {
        return roles[this.roleIndex]?.name || 'Adventurer';
    }

    // Get strength display string (handles 18/xx notation)
    // C ref: attrib.c str_string()
    get strDisplay() {
        const s = this.attributes[A_STR];
        if (s <= 18) return String(s);
        if (s <= 21) return `18/${String((s - 18) * 25).padStart(2, '0')}`;
        if (s < 25) return '18/**';
        return String(s);
    }

    // Get to-hit bonus from strength
    // C ref: attrib.c abon()
    get strToHit() {
        const s = this.attributes[A_STR];
        if (s < 6) return -2;
        if (s < 8) return -1;
        if (s < 17) return 0;
        if (s <= 18) return 1;
        if (s <= 20) return 2;
        return 3;
    }

    // Get damage bonus from strength
    // C ref: attrib.c dbon()
    get strDamage() {
        const s = this.attributes[A_STR];
        if (s < 6) return -1;
        if (s < 16) return 0;
        if (s < 18) return 1;
        if (s === 18) return 2;
        if (s <= 20) return 3;
        if (s <= 22) return 4;
        return 6;
    }

    // Get AC bonus from dexterity
    get dexAC() {
        const d = this.attributes[A_DEX];
        if (d < 4) return 3;
        if (d < 6) return 2;
        if (d < 8) return 1;
        if (d < 14) return 0;
        if (d < 18) return -1;
        if (d <= 20) return -2;
        return -3;
    }

    // Add an item to inventory, assigning an inventory letter
    // C ref: invent.c addinv()
    addToInventory(obj) {
        // Find first unused inventory letter
        const usedLetters = new Set(this.inventory.map(o => o.invlet));
        const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (const letter of letters) {
            if (!usedLetters.has(letter)) {
                obj.invlet = letter;
                break;
            }
        }
        this.inventory.push(obj);
        return obj;
    }

    // Remove item from inventory
    removeFromInventory(obj) {
        const idx = this.inventory.indexOf(obj);
        if (idx >= 0) {
            this.inventory.splice(idx, 1);
        }
    }

    // Get the effective AC (including dexterity bonus)
    get effectiveAC() {
        return this.ac + this.dexAC;
    }

    // Check if player is dead
    get isDead() {
        return this.hp <= 0;
    }

    // Take damage
    takeDamage(amount, source) {
        this.hp -= amount;
        if (this.hp < 0) this.hp = 0;
        return this.hp <= 0;
    }

    // Heal
    heal(amount) {
        this.hp = Math.min(this.hp + amount, this.hpmax);
    }

}
