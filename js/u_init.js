// u_init.js -- Post-level initialization: pet, inventory, attributes, welcome
// Faithful port of the post-mklev portion of C's newgame()
// C ref: allmain.c newgame() — after mklev() and u_on_upstairs()
//
// Sequence:
//   1. makedog()               — pet creation + placement
//   2. u_init_inventory_attrs() — inventory + attribute rolling
//      a. u_init_role()  → ini_inv(Valkyrie) + rn2(6) lamp check
//      b. u_init_race()  → nothing for Human
//      c. init_attr(75)  → distribute 75 pts via weighted rnd_attr
//      d. vary_init_attr → 1/20 chance per attr of rn2(7)-2 variation
//      e. u_init_carry_attr_boost — no RNG
//   3. com_pager("legacy")     — NHCORE_START_NEW_GAME lua shuffle
//   4. welcome(TRUE)           — rndencode + seer_turn

import { rn2, rnd, d } from './rng.js';
import { mksobj } from './mkobj.js';
import { isok, NUM_ATTRS, PM_VALKYRIE, ACCESSIBLE, COLNO, ROWNO } from './config.js';
import {
    SPEAR, DAGGER, SMALL_SHIELD, FOOD_RATION, OIL_LAMP,
    WEAPON_CLASS, ARMOR_CLASS, FOOD_CLASS, TOOL_CLASS,
} from './objects.js';
import { roles } from './player.js';
import { mons, PM_LITTLE_DOG, PM_KITTEN } from './monsters.js';

// ========================================================================
// Pet Creation
// ========================================================================

// C ref: teleport.c collect_coords() — collect positions by ring and shuffle
// In NEW_ENEXTO, called once with maxRadius=3, processes all rings.
// For each ring, collects all isok() positions in row-major order (y outer,
// x inner), matching C's for(y=loy..hiy) for(x=lox..hix) loop.
// Then shuffles with Fisher-Yates from front: swap [i] with [i+rn2(n)], i++, n--.
// Returns the array of shuffled positions (ring 1 first, then ring 2, ring 3).
function collectCoordsShuffle(cx, cy, maxRadius) {
    const allPositions = [];
    for (let radius = 1; radius <= maxRadius; radius++) {
        const ring = [];
        // C ref: teleport.c:671-690 — row-major: y outer loop, x inner loop
        const loy = cy - radius, hiy = cy + radius;
        const lox = cx - radius, hix = cx + radius;
        for (let y = Math.max(loy, 0); y <= hiy; y++) {
            if (y > ROWNO - 1) break;
            for (let x = Math.max(lox, 1); x <= hix; x++) {
                if (x > COLNO - 1) break;
                // C: skip non-edge positions (not on ring boundary)
                if (x !== lox && x !== hix && y !== loy && y !== hiy) continue;
                if (isok(x, y)) ring.push({ x, y });
            }
        }
        // C ref: teleport.c:694-702 — Fisher-Yates from front
        // swap passcc[0] with passcc[rn2(n)], then advance passcc, decrement n
        let start = 0;
        let n = ring.length;
        while (n > 1) {
            const k = rn2(n);
            if (k !== 0) {
                const temp = ring[start];
                ring[start] = ring[start + k];
                ring[start + k] = temp;
            }
            start++;
            n--;
        }
        for (const pos of ring) allPositions.push(pos);
    }
    return allPositions;
}

// C ref: makemon.c adj_lev() — adjust monster level for difficulty
function adj_lev(mlevel, levelDifficulty, ulevel) {
    if (mlevel > 49) return 50;
    let tmp = mlevel;
    let tmp2 = levelDifficulty - tmp;
    if (tmp2 < 0) tmp--;
    else tmp += Math.floor(tmp2 / 5);

    tmp2 = ulevel - mlevel;
    if (tmp2 > 0) tmp += Math.floor(tmp2 / 4);

    const upper = Math.min(Math.floor(3 * mlevel / 2), 49);
    return Math.max(Math.min(tmp, upper), 0);
}

// Display character for monster symbol enum values
// C ref: sym.h MONSYMS_S_ENUM → display characters
const MONSYM_CHARS = {
    4: 'd',   // S_DOG
    6: 'f',   // S_FELINE
};

// C ref: dog.c makedog() → makemon.c makemon()
// Creates the starting pet and places it on the map.
// Returns the pet monster object. RNG consumption matches C exactly.
function makedog(map, playerX, playerY, depth) {
    // C ref: dog.c:100 pet_type() — Valkyrie has petnum=NON_PM
    // rn2(2): 0 = PM_LITTLE_DOG, 1 = PM_KITTEN
    const petTypeIdx = rn2(2);
    const pmIdx = petTypeIdx === 0 ? PM_LITTLE_DOG : PM_KITTEN;
    const petData = mons[pmIdx];

    // C ref: makemon.c:1180-1186 — enexto_core for byyou placement
    // NEW_ENEXTO calls collect_coords(candy, ux, uy, 3, CC_NO_FLAGS, NULL)
    const positions = collectCoordsShuffle(playerX, playerY, 3);

    // Find first valid position (accessible terrain, no existing monster)
    let petX = playerX + 1, petY = playerY; // fallback
    for (const pos of positions) {
        const loc = map.at(pos.x, pos.y);
        if (loc && ACCESSIBLE(loc.typ) && !map.monsterAt(pos.x, pos.y)
            && !(pos.x === playerX && pos.y === playerY)) {
            petX = pos.x;
            petY = pos.y;
            break;
        }
    }

    // C ref: makemon.c:1252 — mtmp->m_id = next_ident()
    rnd(2);

    // C ref: makemon.c:1018+1043 — newmonhp
    const m_lev = adj_lev(petData.level, depth, 1);
    let mhp;
    if (m_lev === 0) {
        mhp = rnd(4);
    } else {
        mhp = d(m_lev, 8);
    }

    // C ref: makemon.c:1280 — gender
    rn2(2);

    // C ref: makemon.c:1295 — peace_minded(ptr)
    // Neutral align dog: rn2(16 + record) && rn2(2 + abs(mal))
    const peacefulFirst = rn2(16);
    if (peacefulFirst) {
        rn2(2);
    }

    // Create the pet monster object (matches makemon structure)
    const pet = {
        type: petData,
        name: petData.name,
        displayChar: MONSYM_CHARS[petData.symbol] || '?',
        displayColor: petData.color,
        mx: petX,
        my: petY,
        mhp: mhp,
        mhpmax: mhp,
        mlevel: petData.level,
        mac: petData.ac,
        speed: petData.speed,
        movement: 0, // C ref: *mtmp = cg.zeromonst (zero-init)
        attacks: petData.attacks,
        peaceful: true, // pet is peaceful
        tame: true,      // pet is tame
        flee: false,
        confused: false,
        stunned: false,
        blind: false,
        sleeping: false,  // pets don't start sleeping
        dead: false,
        passive: false,
        mtrack: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
        mnum: pmIdx,     // C ref: monst.h — index into mons[]
        // C ref: mextra.h struct edog — pet-specific data
        // C ref: dog.c initedog(mtmp, TRUE) — full initialization
        edog: {
            apport: 0,          // ACURR(A_CHA) — set after attribute init
            hungrytime: 1000,   // svm.moves + 1000 (moves=0 at start)
            droptime: 0,
            dropdist: 10000,
            whistletime: 0,
            ogoal: { x: -1, y: -1 },
            abuse: 0,
            revivals: 0,
            mhpmax_penalty: 0,
            killed_by_u: false,
        },
    };

    // C ref: makemon.c — mtmp->nmon = fmon; fmon = mtmp; (LIFO prepend)
    map.monsters.unshift(pet);
    return pet;
}

// ========================================================================
// Inventory Creation
// ========================================================================

// C ref: u_init.c struct trobj constants
const UNDEF_BLESS = -1;

// Valkyrie starting inventory
// C ref: u_init.c:160-166
const Valkyrie_inv = [
    { otyp: SPEAR, spe: 1, oclass: WEAPON_CLASS, qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: DAGGER, spe: 0, oclass: WEAPON_CLASS, qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: SMALL_SHIELD, spe: 3, oclass: ARMOR_CLASS, qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: FOOD_RATION, spe: 0, oclass: FOOD_CLASS, qmin: 1, qmax: 1, bless: 0 },
];

// Oil lamp table for the optional Lamp item
const Lamp_inv = [
    { otyp: OIL_LAMP, spe: 1, oclass: TOOL_CLASS, qmin: 1, qmax: 1, bless: 0 },
];

// C ref: u_init.c ini_inv() — create starting inventory from trobj table
function iniInv(player, table) {
    let tropIdx = 0;
    let quan = trquan(table[tropIdx]);

    while (tropIdx < table.length) {
        const trop = table[tropIdx];

        // C ref: u_init.c:1310 — mksobj(otyp, TRUE, FALSE)
        // ini_inv uses mksobj directly (no erosion in C)
        const obj = mksobj(trop.otyp, true, false, /* skipErosion */ true);

        // C ref: u_init.c:1330-1345 — ini_inv_adjust_obj
        obj.known = true;
        obj.dknown = true;
        obj.cursed = false;
        // For WEAPON_CLASS or TOOL_CLASS: re-call trquan
        if (obj.oclass === WEAPON_CLASS || obj.oclass === TOOL_CLASS) {
            obj.quan = trquan(trop);
            quan = 1; // stop flag
        }
        // Override spe
        obj.spe = trop.spe;
        // Override bless/curse
        if (trop.bless !== UNDEF_BLESS) {
            obj.blessed = trop.bless > 0;
            obj.cursed = trop.bless < 0;
        }

        // Add to player inventory
        player.addToInventory(obj);

        if (--quan > 0) continue; // make another identical item
        tropIdx++;
        if (tropIdx < table.length) {
            quan = trquan(table[tropIdx]);
        }
    }
}

// C ref: u_init.c trquan() — randomize quantity
function trquan(trop) {
    if (!trop.qmin) return 1;
    return trop.qmin + rn2(trop.qmax - trop.qmin + 1);
}

// Simulate u_init_role() for Valkyrie
// C ref: u_init.c:758-770
function simulateUInitRole(player) {
    iniInv(player, Valkyrie_inv);
    // C ref: u_init.c:767 — if (!rn2(6)) ini_inv(Lamp)
    if (!rn2(6)) {
        iniInv(player, Lamp_inv);
    }
}

// ========================================================================
// Attribute Rolling
// ========================================================================

// Attribute distribution weights per role index
// C ref: role.c urole.attrdist[]
const ROLE_ATTRDIST = {
    0:  [10, 10, 10, 20, 20, 10], // Archeologist (conservative guess)
    1:  [30, 6, 7, 20, 30, 7],    // Barbarian
    2:  [30, 6, 7, 20, 30, 7],    // Caveman
    3:  [15, 20, 20, 15, 25, 5],   // Healer
    4:  [20, 15, 15, 20, 20, 10],  // Knight
    5:  [25, 10, 20, 20, 15, 10],  // Monk
    6:  [15, 10, 30, 15, 20, 10],  // Priest
    7:  [20, 20, 10, 20, 20, 10],  // Ranger
    8:  [20, 10, 10, 30, 20, 10],  // Rogue
    9:  [30, 10, 8, 30, 14, 8],    // Samurai
    10: [15, 10, 10, 15, 30, 20],  // Tourist
    11: [30, 6, 7, 20, 30, 7],    // Valkyrie
    12: [10, 30, 10, 20, 20, 10],  // Wizard
};

// Human race constants
const HUMAN_ATTRMIN = [3, 3, 3, 3, 3, 3];
const HUMAN_ATTRMAX = [18, 18, 18, 18, 18, 18];

// C ref: attrib.c rnd_attr() — weighted random attribute selection
function rnd_attr(attrdist) {
    let x = rn2(100);
    for (let i = 0; i < NUM_ATTRS; i++) {
        if ((x -= attrdist[i]) < 0) return i;
    }
    return NUM_ATTRS; // A_MAX = failure
}

// C ref: attrib.c init_attr_role_redist()
function init_attr_role_redist(np, addition, attrs, attrdist, attrmin, attrmax) {
    let tryct = 0;
    const adj = addition ? 1 : -1;

    while ((addition ? (np > 0) : (np < 0)) && tryct < 100) {
        const i = rnd_attr(attrdist);

        if (i >= NUM_ATTRS
            || (addition ? (attrs[i] >= attrmax[i])
                         : (attrs[i] <= attrmin[i]))) {
            tryct++;
            continue;
        }
        tryct = 0;
        attrs[i] += adj;
        np -= adj;
    }
    return np;
}

// C ref: attrib.c vary_init_attr()
function varyInitAttr(attrs, attrmin, attrmax) {
    for (let i = 0; i < NUM_ATTRS; i++) {
        if (!rn2(20)) {
            const xd = rn2(7) - 2; // biased variation
            attrs[i] = Math.max(attrmin[i], Math.min(attrmax[i], attrs[i] + xd));
        }
    }
}

// C ref: attrib.c init_attr(75) + vary_init_attr()
function initAttributes(player) {
    const attrdist = ROLE_ATTRDIST[player.roleIndex] || [17, 17, 17, 17, 16, 16];
    const role = roles[player.roleIndex];
    const attrbase = [role.str, role.int, role.wis, role.dex, role.con, role.cha];
    const attrmin = HUMAN_ATTRMIN;
    const attrmax = HUMAN_ATTRMAX;

    // C ref: attrib.c init_attr(75)
    let np = 75;
    for (let i = 0; i < NUM_ATTRS; i++) {
        player.attributes[i] = attrbase[i];
        np -= attrbase[i];
    }

    // Distribute leftover points
    np = init_attr_role_redist(np, true, player.attributes, attrdist, attrmin, attrmax);
    // Remove excess (shouldn't happen normally)
    np = init_attr_role_redist(np, false, player.attributes, attrdist, attrmin, attrmax);

    // C ref: attrib.c vary_init_attr()
    varyInitAttr(player.attributes, attrmin, attrmax);

    // C ref: u_init.c u_init_carry_attr_boost() — no RNG, deterministic
    // Boost STR/CON until can carry inventory — omitted for now
}

// ========================================================================
// Main Entry Point
// ========================================================================

// Simulate the full post-level initialization sequence.
// Must be called after level generation and player placement.
// C ref: allmain.c newgame() — makedog through welcome
export function simulatePostLevelInit(player, map, depth) {
    const role = roles[player.roleIndex];

    // 1. makedog() — pet creation (actually places pet on map)
    const pet = makedog(map, player.x, player.y, depth || 1);

    // C ref: dog.c initedog() — apport = ACURR(A_CHA)
    // Called inside makedog() BEFORE init_attr(), and u.acurr is still zeroed.
    // acurr() computes max(u.abon + u.atemp + u.acurr, 3) = 3 at this point.
    if (pet && pet.edog) {
        pet.edog.apport = 3;
    }

    // 2. u_init_inventory_attrs()
    //    a. u_init_role() → ini_inv(Valkyrie) + rn2(6) lamp check
    simulateUInitRole(player);
    //    b. u_init_race() → Human: nothing (no RNG)
    //    c+d. init_attr(75) + vary_init_attr()
    initAttributes(player);
    //    e. u_init_carry_attr_boost() — no RNG

    // Set HP/PW from role + race
    // C ref: u_init.c u_init_misc() — newhp() = role_hp + race_hp
    // Valkyrie: 14, Human: +2 = 16 HP; Valkyrie: 1, Human: +1 = 2 PW
    player.hp = role.startingHP + 2; // Human race HP bonus
    player.hpmax = player.hp;
    player.pw = role.startingPW + 1; // Human race PW bonus
    player.pwmax = player.pw;

    // Set AC from equipment
    // Base AC = 10, SMALL_SHIELD ARM_BONUS = base(1) + enchantment(3) = 4
    // C ref: do_wear.c find_ac()
    player.ac = 10;
    for (const item of player.inventory) {
        if (item.oclass === ARMOR_CLASS) {
            const baseAC = 1; // SMALL_SHIELD base AC contribution
            player.ac -= (baseAC + item.spe);
        }
    }

    // 3. com_pager("legacy") — Book of Odin
    // C ref: nhlua.c NHCORE_START_NEW_GAME triggers shuffle
    rn2(3); rn2(2);

    // 4. welcome(TRUE) — timing init
    // C ref: allmain.c:74 rnd(9000) for rndencode
    // C ref: allmain.c:81 rnd(30) for seer_turn
    rnd(9000);
    const seerTurn = rnd(30);

    return { seerTurn };
}
