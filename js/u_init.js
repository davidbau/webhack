// u_init.js -- Post-level initialization: pet, inventory, attributes, welcome
// Faithful port of the post-mklev portion of C's newgame()
// C ref: allmain.c newgame() — after mklev() and u_on_upstairs()
//
// Sequence:
//   1. makedog()               — pet creation + placement
//   2. u_init_inventory_attrs() — inventory + attribute rolling
//      a. u_init_role()  → ini_inv(role_table) + conditional extras
//      b. u_init_race()  → race-specific items (instruments, food, subs)
//      c. init_attr(75)  → distribute 75 pts via weighted rnd_attr
//      d. vary_init_attr → 1/20 chance per attr of rn2(7)-2 variation
//      e. u_init_carry_attr_boost — no RNG
//   3. com_pager("legacy")     — NHCORE_START_NEW_GAME lua shuffle
//   4. welcome(TRUE)           — rndencode + seer_turn

import { rn2, rnd, rn1, rne, d, getRngLog } from './rng.js';
import { mksobj, mkobj } from './mkobj.js';
import { isok, NUM_ATTRS,
         PM_ARCHEOLOGIST, PM_BARBARIAN, PM_CAVEMAN, PM_HEALER,
         PM_KNIGHT, PM_MONK, PM_PRIEST, PM_RANGER, PM_ROGUE,
         PM_SAMURAI, PM_TOURIST, PM_VALKYRIE, PM_WIZARD,
         ACCESSIBLE, COLNO, ROWNO,
         RACE_HUMAN, RACE_ELF, RACE_DWARF, RACE_GNOME, RACE_ORC } from './config.js';
import {
    // Weapons
    LONG_SWORD, LANCE, SPEAR, DAGGER, SHORT_SWORD, AXE, BULLWHIP,
    TWO_HANDED_SWORD, BATTLE_AXE, CLUB, SLING, KATANA, YUMI, YA,
    BOW, ARROW, DART, MACE, QUARTERSTAFF, SCALPEL,
    // Armor
    RING_MAIL, HELMET, SMALL_SHIELD, LEATHER_GLOVES, LEATHER_JACKET,
    FEDORA, LEATHER_ARMOR, ROBE, CLOAK_OF_DISPLACEMENT,
    CLOAK_OF_MAGIC_RESISTANCE, SPLINT_MAIL, HAWAIIAN_SHIRT,
    // Food
    APPLE, CARROT, FOOD_RATION, CRAM_RATION, ORANGE, FORTUNE_COOKIE,
    CLOVE_OF_GARLIC, SPRIG_OF_WOLFSBANE,
    // Potions
    POT_HEALING, POT_EXTRA_HEALING, POT_SICKNESS, POT_WATER,
    // Scrolls
    SCR_MAGIC_MAPPING,
    // Spellbooks
    SPE_HEALING, SPE_EXTRA_HEALING, SPE_STONE_TO_FLESH,
    SPE_FORCE_BOLT, SPE_PROTECTION, SPE_CONFUSE_MONSTER,
    // Wands
    WAN_SLEEP,
    // Tools
    SADDLE, OIL_LAMP, PICK_AXE, TINNING_KIT, STETHOSCOPE,
    EXPENSIVE_CAMERA, CREDIT_CARD, TIN_OPENER, LOCK_PICK,
    BLINDFOLD, MAGIC_MARKER, LEASH, TOWEL, SACK,
    // Gems
    TOUCHSTONE, FLINT, ROCK,
    // Race-specific items (Elf)
    ELVEN_DAGGER, ELVEN_SPEAR, ELVEN_SHORT_SWORD, ELVEN_BOW, ELVEN_ARROW,
    ELVEN_LEATHER_HELM, ELVEN_CLOAK, LEMBAS_WAFER,
    // Race-specific items (Dwarf)
    DWARVISH_SPEAR, DWARVISH_SHORT_SWORD, DWARVISH_IRON_HELM,
    // Race-specific items (Gnome)
    CROSSBOW, CROSSBOW_BOLT,
    // Race-specific items (Orc)
    ORCISH_DAGGER, ORCISH_SPEAR, ORCISH_SHORT_SWORD, ORCISH_BOW,
    ORCISH_ARROW, ORCISH_HELM, ORCISH_SHIELD, ORCISH_RING_MAIL,
    ORCISH_CHAIN_MAIL, TRIPE_RATION,
    // Instruments (Elf Cleric/Wizard)
    WOODEN_FLUTE, TOOLED_HORN, WOODEN_HARP, BELL, BUGLE, LEATHER_DRUM,
    CHAIN_MAIL,
    // Classes
    WEAPON_CLASS, ARMOR_CLASS, FOOD_CLASS, TOOL_CLASS,
    RING_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS,
    WAND_CLASS, GEM_CLASS,
    // Filter exclusions
    WAN_WISHING, WAN_NOTHING, RIN_LEVITATION, RIN_AGGRAVATE_MONSTER,
    RIN_HUNGER, POT_HALLUCINATION, POT_ACID, SCR_AMNESIA, SCR_FIRE,
    SCR_BLANK_PAPER, SPE_BLANK_PAPER, SPE_NOVEL, SCR_ENCHANT_WEAPON,
    // Polymorph nocreate tracking
    WAN_POLYMORPH, RIN_POLYMORPH, RIN_POLYMORPH_CONTROL,
    POT_POLYMORPH, SPE_POLYMORPH,
    // Object data for level/charged checks
    objectData,
} from './objects.js';
import { roles } from './player.js';
import { mons, PM_LITTLE_DOG, PM_KITTEN, PM_PONY } from './monsters.js';

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
    21: 'u',  // S_UNICORN (includes ponies/horses)
};

// C ref: dog.c:90-101 pet_type() — determine starting pet monster index
function pet_type(roleIndex) {
    const role = roles[roleIndex];
    // C ref: dog.c:100 — ALWAYS calls rn2(2) even for predetermined pet types
    // This maintains RNG alignment across all roles
    const roll = rn2(2);
    if (role.petType === 'pony') return PM_PONY;
    if (role.petType === 'cat') return PM_KITTEN;
    if (role.petType === 'dog') return PM_LITTLE_DOG;
    // null / NON_PM → random: use roll result
    return roll ? PM_KITTEN : PM_LITTLE_DOG;
}

// C ref: dog.c makedog() → makemon.c makemon()
// Creates the starting pet and places it on the map.
// Returns the pet monster object. RNG consumption matches C exactly.
function makedog(map, player, depth) {
    const pmIdx = pet_type(player.roleIndex);
    const petData = mons[pmIdx];

    // C ref: makemon.c:1180-1186 — enexto_core for byyou placement
    // NEW_ENEXTO calls collect_coords(candy, ux, uy, 3, CC_NO_FLAGS, NULL)
    const positions = collectCoordsShuffle(player.x, player.y, 3);

    // Find first valid position (accessible terrain, no existing monster)
    let petX = player.x + 1, petY = player.y; // fallback
    for (const pos of positions) {
        const loc = map.at(pos.x, pos.y);
        if (loc && ACCESSIBLE(loc.typ) && !map.monsterAt(pos.x, pos.y)
            && !(pos.x === player.x && pos.y === player.y)) {
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
    // peace_minded() consumes RNG when it reaches the alignment check.
    // For neutral-aligned players, it calls rn2(16+record) && rn2(2+abs(mal)).
    // For lawful/chaotic players, it returns early (race_peaceful) with no RNG.
    // Knight/pony is a special case: also no peace_minded (pony handling).
    const playerAlign = player.alignment;
    if (pmIdx !== PM_PONY && playerAlign === 0) {
        // Neutral align: rn2(16 + record) && rn2(2 + abs(dominated_alignment))
        const peacefulFirst = rn2(16);
        if (peacefulFirst) {
            rn2(2);
        }
    }

    // C ref: dog.c:264-267 — put_saddle_on_mon(NULL, mtmp) for pony
    // Creates a saddle and adds to pony's minvent
    let saddleObj = null;
    if (pmIdx === PM_PONY) {
        saddleObj = mksobj(SADDLE, true, false);
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
        mndx: pmIdx,     // C ref: monst.h — index into mons[] (also set mnum for compat)
        mnum: pmIdx,     // Alias for mndx - some code uses mnum, some uses mndx
        minvent: saddleObj ? [saddleObj] : [],
        // C ref: mextra.h struct edog — pet-specific data
        // C ref: dog.c initedog(mtmp, TRUE) — full initialization
        edog: {
            apport: 0,          // ACURR(A_CHA) — set after attribute init
            hungrytime: 1000,   // svm.moves + 1000 (moves=0 at start)
            droptime: 0,
            dropdist: 10000,
            whistletime: 0,
            ogoal: { x: 0, y: 0 },
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
const UNDEF_BLESS = -1;  // C: UNDEF_BLESS = 2; keep mksobj default
const UNDEF_SPE = 127;   // C: UNDEF_SPE = '\177'; keep mksobj default
const UNDEF_TYP = 0;     // C: UNDEF_TYP = 0; random from class

// Module-level nocreate state — persists across ini_inv calls within u_init_role
let nocreate = 0, nocreate2 = 0, nocreate3 = 0, nocreate4 = 0;

// ---- Role Inventory Tables ----
// C ref: u_init.c — each role's trobj array
// Fields: otyp (0=UNDEF_TYP=random), spe (127=UNDEF_SPE), oclass, qmin, qmax, bless (-1=UNDEF)

// Archeologist: u_init.c:42-53
const Archeologist_inv = [
    { otyp: BULLWHIP,      spe: 2,         oclass: WEAPON_CLASS, qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: LEATHER_JACKET, spe: 0,        oclass: ARMOR_CLASS,  qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: FEDORA,         spe: 0,        oclass: ARMOR_CLASS,  qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: FOOD_RATION,    spe: 0,        oclass: FOOD_CLASS,   qmin: 3,  qmax: 3,  bless: 0 },
    { otyp: PICK_AXE,       spe: UNDEF_SPE, oclass: TOOL_CLASS,  qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: TINNING_KIT,    spe: UNDEF_SPE, oclass: TOOL_CLASS,  qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: TOUCHSTONE,     spe: 0,        oclass: GEM_CLASS,    qmin: 1,  qmax: 1,  bless: 0 },
    { otyp: SACK,           spe: 0,        oclass: TOOL_CLASS,   qmin: 1,  qmax: 1,  bless: 0 },
];

// Barbarian weapon set 0 (rn2(100) >= 50): u_init.c:54-60
const Barbarian_0_inv = [
    { otyp: TWO_HANDED_SWORD, spe: 0, oclass: WEAPON_CLASS, qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: AXE,              spe: 0, oclass: WEAPON_CLASS, qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: RING_MAIL,        spe: 0, oclass: ARMOR_CLASS,  qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: FOOD_RATION,      spe: 0, oclass: FOOD_CLASS,   qmin: 1, qmax: 1, bless: 0 },
];

// Barbarian weapon set 1 (rn2(100) < 50): u_init.c:61-67
const Barbarian_1_inv = [
    { otyp: BATTLE_AXE,   spe: 0, oclass: WEAPON_CLASS, qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: SHORT_SWORD,  spe: 0, oclass: WEAPON_CLASS, qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: RING_MAIL,    spe: 0, oclass: ARMOR_CLASS,  qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: FOOD_RATION,  spe: 0, oclass: FOOD_CLASS,   qmin: 1, qmax: 1, bless: 0 },
];

// Caveman: u_init.c:68-75
const Caveman_inv = [
    { otyp: CLUB,           spe: 1, oclass: WEAPON_CLASS, qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: SLING,          spe: 2, oclass: WEAPON_CLASS, qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: FLINT,          spe: 0, oclass: GEM_CLASS,    qmin: 10, qmax: 20, bless: UNDEF_BLESS },
    { otyp: ROCK,           spe: 0, oclass: GEM_CLASS,    qmin: 3,  qmax: 3,  bless: 0 },
    { otyp: LEATHER_ARMOR,  spe: 0, oclass: ARMOR_CLASS,  qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
];

// Healer: u_init.c:76-89
const Healer_inv = [
    { otyp: SCALPEL,           spe: 0,         oclass: WEAPON_CLASS, qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: LEATHER_GLOVES,    spe: 1,         oclass: ARMOR_CLASS,  qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: STETHOSCOPE,       spe: 0,         oclass: TOOL_CLASS,   qmin: 1, qmax: 1, bless: 0 },
    { otyp: POT_HEALING,       spe: 0,         oclass: POTION_CLASS, qmin: 4, qmax: 4, bless: UNDEF_BLESS },
    { otyp: POT_EXTRA_HEALING, spe: 0,         oclass: POTION_CLASS, qmin: 4, qmax: 4, bless: UNDEF_BLESS },
    { otyp: WAN_SLEEP,         spe: UNDEF_SPE, oclass: WAND_CLASS,   qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: SPE_HEALING,       spe: 0,         oclass: SPBOOK_CLASS, qmin: 1, qmax: 1, bless: 1 },
    { otyp: SPE_EXTRA_HEALING, spe: 0,         oclass: SPBOOK_CLASS, qmin: 1, qmax: 1, bless: 1 },
    { otyp: SPE_STONE_TO_FLESH, spe: 0,        oclass: SPBOOK_CLASS, qmin: 1, qmax: 1, bless: 1 },
    { otyp: APPLE,             spe: 0,         oclass: FOOD_CLASS,   qmin: 5, qmax: 5, bless: 0 },
];

// Knight: u_init.c:90-100
const Knight_inv = [
    { otyp: LONG_SWORD,      spe: 1, oclass: WEAPON_CLASS, qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: LANCE,            spe: 1, oclass: WEAPON_CLASS, qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: RING_MAIL,        spe: 1, oclass: ARMOR_CLASS,  qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: HELMET,           spe: 0, oclass: ARMOR_CLASS,  qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: SMALL_SHIELD,     spe: 0, oclass: ARMOR_CLASS,  qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: LEATHER_GLOVES,   spe: 0, oclass: ARMOR_CLASS,  qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: APPLE,            spe: 0, oclass: FOOD_CLASS,   qmin: 10, qmax: 10, bless: 0 },
    { otyp: CARROT,           spe: 0, oclass: FOOD_CLASS,   qmin: 10, qmax: 10, bless: 0 },
];

// Monk: u_init.c:101-113
const Monk_inv = [
    { otyp: LEATHER_GLOVES,  spe: 2,         oclass: ARMOR_CLASS,  qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: ROBE,            spe: 1,         oclass: ARMOR_CLASS,  qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: UNDEF_TYP,      spe: UNDEF_SPE, oclass: SCROLL_CLASS, qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: POT_HEALING,    spe: 0,         oclass: POTION_CLASS, qmin: 3, qmax: 3, bless: UNDEF_BLESS },
    { otyp: FOOD_RATION,    spe: 0,         oclass: FOOD_CLASS,   qmin: 3, qmax: 3, bless: 0 },
    { otyp: APPLE,           spe: 0,         oclass: FOOD_CLASS,   qmin: 5, qmax: 5, bless: UNDEF_BLESS },
    { otyp: ORANGE,          spe: 0,         oclass: FOOD_CLASS,   qmin: 5, qmax: 5, bless: UNDEF_BLESS },
    { otyp: FORTUNE_COOKIE,  spe: 0,         oclass: FOOD_CLASS,   qmin: 3, qmax: 3, bless: UNDEF_BLESS },
];

// Priest: u_init.c:114-123
const Priest_inv = [
    { otyp: MACE,               spe: 1,         oclass: WEAPON_CLASS, qmin: 1, qmax: 1, bless: 1 },
    { otyp: ROBE,               spe: 0,         oclass: ARMOR_CLASS,  qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: SMALL_SHIELD,       spe: 0,         oclass: ARMOR_CLASS,  qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: POT_WATER,          spe: 0,         oclass: POTION_CLASS, qmin: 4, qmax: 4, bless: 1 },
    { otyp: CLOVE_OF_GARLIC,    spe: 0,         oclass: FOOD_CLASS,   qmin: 1, qmax: 1, bless: 0 },
    { otyp: SPRIG_OF_WOLFSBANE, spe: 0,         oclass: FOOD_CLASS,   qmin: 1, qmax: 1, bless: 0 },
    { otyp: UNDEF_TYP,          spe: UNDEF_SPE, oclass: SPBOOK_CLASS, qmin: 2, qmax: 2, bless: UNDEF_BLESS },
];

// Ranger: u_init.c:124-132
const Ranger_inv = [
    { otyp: DAGGER,               spe: 1, oclass: WEAPON_CLASS, qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: BOW,                  spe: 1, oclass: WEAPON_CLASS, qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: ARROW,                spe: 2, oclass: WEAPON_CLASS, qmin: 50, qmax: 59, bless: UNDEF_BLESS },
    { otyp: ARROW,                spe: 0, oclass: WEAPON_CLASS, qmin: 30, qmax: 39, bless: UNDEF_BLESS },
    { otyp: CLOAK_OF_DISPLACEMENT, spe: 2, oclass: ARMOR_CLASS, qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: CRAM_RATION,          spe: 0, oclass: FOOD_CLASS,   qmin: 4,  qmax: 4,  bless: 0 },
];

// Rogue: u_init.c:133-141
const Rogue_inv = [
    { otyp: SHORT_SWORD,    spe: 0, oclass: WEAPON_CLASS, qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: DAGGER,          spe: 0, oclass: WEAPON_CLASS, qmin: 6,  qmax: 15, bless: 0 },
    { otyp: LEATHER_ARMOR,   spe: 1, oclass: ARMOR_CLASS,  qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: POT_SICKNESS,    spe: 0, oclass: POTION_CLASS, qmin: 1,  qmax: 1,  bless: 0 },
    { otyp: LOCK_PICK,       spe: 0, oclass: TOOL_CLASS,   qmin: 1,  qmax: 1,  bless: 0 },
    { otyp: SACK,            spe: 0, oclass: TOOL_CLASS,   qmin: 1,  qmax: 1,  bless: 0 },
];

// Samurai: u_init.c:142-149
const Samurai_inv = [
    { otyp: KATANA,       spe: 0, oclass: WEAPON_CLASS, qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: SHORT_SWORD,  spe: 0, oclass: WEAPON_CLASS, qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: YUMI,         spe: 0, oclass: WEAPON_CLASS, qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: YA,           spe: 0, oclass: WEAPON_CLASS, qmin: 26, qmax: 45, bless: UNDEF_BLESS },
    { otyp: SPLINT_MAIL,  spe: 0, oclass: ARMOR_CLASS,  qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
];

// Tourist: u_init.c:150-159
const Tourist_inv = [
    { otyp: DART,              spe: 2,         oclass: WEAPON_CLASS, qmin: 21, qmax: 40, bless: UNDEF_BLESS },
    { otyp: UNDEF_TYP,        spe: UNDEF_SPE, oclass: FOOD_CLASS,   qmin: 10, qmax: 10, bless: 0 },
    { otyp: POT_EXTRA_HEALING, spe: 0,         oclass: POTION_CLASS, qmin: 2,  qmax: 2,  bless: UNDEF_BLESS },
    { otyp: SCR_MAGIC_MAPPING, spe: 0,         oclass: SCROLL_CLASS, qmin: 4,  qmax: 4,  bless: UNDEF_BLESS },
    { otyp: HAWAIIAN_SHIRT,    spe: 0,         oclass: ARMOR_CLASS,  qmin: 1,  qmax: 1,  bless: UNDEF_BLESS },
    { otyp: EXPENSIVE_CAMERA,  spe: UNDEF_SPE, oclass: TOOL_CLASS,   qmin: 1,  qmax: 1,  bless: 0 },
    { otyp: CREDIT_CARD,       spe: 0,         oclass: TOOL_CLASS,   qmin: 1,  qmax: 1,  bless: 0 },
];

// Valkyrie: u_init.c:160-166
const Valkyrie_inv = [
    { otyp: SPEAR,        spe: 1, oclass: WEAPON_CLASS, qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: DAGGER,       spe: 0, oclass: WEAPON_CLASS, qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: SMALL_SHIELD, spe: 3, oclass: ARMOR_CLASS,  qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: FOOD_RATION,  spe: 0, oclass: FOOD_CLASS,   qmin: 1, qmax: 1, bless: 0 },
];

// Wizard: u_init.c:167-178
const Wizard_inv = [
    { otyp: QUARTERSTAFF,             spe: 1,         oclass: WEAPON_CLASS, qmin: 1, qmax: 1, bless: 1 },
    { otyp: CLOAK_OF_MAGIC_RESISTANCE, spe: 0,        oclass: ARMOR_CLASS,  qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: UNDEF_TYP,                spe: UNDEF_SPE, oclass: WAND_CLASS,   qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: UNDEF_TYP,                spe: UNDEF_SPE, oclass: RING_CLASS,   qmin: 2, qmax: 2, bless: UNDEF_BLESS },
    { otyp: UNDEF_TYP,                spe: UNDEF_SPE, oclass: POTION_CLASS, qmin: 3, qmax: 3, bless: UNDEF_BLESS },
    { otyp: UNDEF_TYP,                spe: UNDEF_SPE, oclass: SCROLL_CLASS, qmin: 3, qmax: 3, bless: UNDEF_BLESS },
    { otyp: SPE_FORCE_BOLT,            spe: 0,        oclass: SPBOOK_CLASS, qmin: 1, qmax: 1, bless: 1 },
    { otyp: UNDEF_TYP,                spe: UNDEF_SPE, oclass: SPBOOK_CLASS, qmin: 1, qmax: 1, bless: UNDEF_BLESS },
    { otyp: MAGIC_MARKER,              spe: 19,       oclass: TOOL_CLASS,   qmin: 1, qmax: 1, bless: 0 },
];

// ---- Shared Optional Item Tables ----
// C ref: u_init.c:184-219

const Tinopener_inv = [
    { otyp: TIN_OPENER, spe: 0, oclass: TOOL_CLASS, qmin: 1, qmax: 1, bless: 0 },
];
const Lamp_inv = [
    { otyp: OIL_LAMP, spe: 1, oclass: TOOL_CLASS, qmin: 1, qmax: 1, bless: 0 },
];
const Magicmarker_inv = [
    { otyp: MAGIC_MARKER, spe: 19, oclass: TOOL_CLASS, qmin: 1, qmax: 1, bless: 0 },
];
const Blindfold_inv = [
    { otyp: BLINDFOLD, spe: 0, oclass: TOOL_CLASS, qmin: 1, qmax: 1, bless: 0 },
];
const Leash_inv = [
    { otyp: LEASH, spe: 0, oclass: TOOL_CLASS, qmin: 1, qmax: 1, bless: 0 },
];
const Towel_inv = [
    { otyp: TOWEL, spe: 0, oclass: TOOL_CLASS, qmin: 1, qmax: 1, bless: 0 },
];

// Monk spellbook options
const Healing_book = [
    { otyp: SPE_HEALING, spe: UNDEF_SPE, oclass: SPBOOK_CLASS, qmin: 1, qmax: 1, bless: 1 },
];
const Protection_book = [
    { otyp: SPE_PROTECTION, spe: UNDEF_SPE, oclass: SPBOOK_CLASS, qmin: 1, qmax: 1, bless: 1 },
];
const Confuse_monster_book = [
    { otyp: SPE_CONFUSE_MONSTER, spe: UNDEF_SPE, oclass: SPBOOK_CLASS, qmin: 1, qmax: 1, bless: 1 },
];
const M_spell = [Healing_book, Protection_book, Confuse_monster_book];

// ---- UNDEF_TYP Item Filter ----
// C ref: u_init.c ini_inv_mkobj_filter() — create random object, reject dangerous items
function iniInvMkobjFilter(oclass, gotSp1, roleIndex) {
    let trycnt = 0;
    while (true) {
        if (++trycnt > 1000) break; // fallback (shouldn't happen)
        const obj = mkobj(oclass, false, /* skipErosion */ true);
        const otyp = obj.otyp;
        // C ref: u_init.c:1115-1175 — filter conditions
        if (otyp === WAN_WISHING || otyp === nocreate
            || otyp === nocreate2 || otyp === nocreate3
            || otyp === nocreate4 || otyp === RIN_LEVITATION
            || otyp === POT_HALLUCINATION || otyp === POT_ACID
            || otyp === SCR_AMNESIA || otyp === SCR_FIRE
            || otyp === SCR_BLANK_PAPER || otyp === SPE_BLANK_PAPER
            || otyp === RIN_AGGRAVATE_MONSTER || otyp === RIN_HUNGER
            || otyp === WAN_NOTHING
            || (otyp === SCR_ENCHANT_WEAPON && roleIndex === PM_MONK)
            || (otyp === SPE_FORCE_BOLT && roleIndex === PM_WIZARD)
            || (oclass === SPBOOK_CLASS
                && ((objectData[otyp].oc2 || 0) > (gotSp1 ? 3 : 1)))
            || otyp === SPE_NOVEL) {
            continue; // reject, try again
        }
        return obj;
    }
    // Fallback: shouldn't reach here
    return mksobj(FOOD_RATION, true, false, true);
}

// ---- ini_inv: Create starting inventory from trobj table ----
// C ref: u_init.c ini_inv() — processes table entries, handles UNDEF_TYP
function iniInv(player, table) {
    let tropIdx = 0;
    let quan = trquan(table[tropIdx]);
    let gotSp1 = false;

    while (tropIdx < table.length) {
        const trop = table[tropIdx];
        let obj, otyp;

        if (trop.otyp !== UNDEF_TYP) {
            // Fixed item: mksobj directly (no erosion for ini_inv)
            obj = mksobj(trop.otyp, true, false, /* skipErosion */ true);
            otyp = trop.otyp;
        } else {
            // Random item: mkobj with filter
            obj = iniInvMkobjFilter(trop.oclass, gotSp1, player.roleIndex);
            otyp = obj.otyp;
            // C ref: u_init.c:1318-1337 — nocreate tracking
            switch (otyp) {
                case WAN_POLYMORPH:
                case RIN_POLYMORPH:
                case POT_POLYMORPH:
                    nocreate = RIN_POLYMORPH_CONTROL;
                    break;
                case RIN_POLYMORPH_CONTROL:
                    nocreate = RIN_POLYMORPH;
                    nocreate2 = SPE_POLYMORPH;
                    nocreate3 = POT_POLYMORPH;
                    break;
            }
            if (obj.oclass === RING_CLASS || obj.oclass === SPBOOK_CLASS) {
                nocreate4 = otyp;
            }
        }

        // C ref: u_init.c ini_inv_obj_substitution() — race-specific item swaps
        if (player.race !== RACE_HUMAN) {
            for (const [race, from, to] of INV_SUBS) {
                if (race === player.race && obj.otyp === from) {
                    obj.otyp = to;
                    otyp = to;
                    break;
                }
            }
        }

        // C ref: u_init.c ini_inv_adjust_obj()
        obj.known = true;
        obj.dknown = true;
        obj.bknown = true;
        obj.cursed = false;
        if (obj.oclass === WEAPON_CLASS || obj.oclass === TOOL_CLASS) {
            obj.quan = trquan(trop);
            quan = 1; // stop flag
        } else if (obj.oclass === GEM_CLASS && otyp !== FLINT) {
            // Graystone (touchstone) gets quantity 1
            // C ref: is_graystone check — for simplicity, TOUCHSTONE and similar
            if (otyp === TOUCHSTONE) obj.quan = 1;
        }

        // C ref: u_init.c:1231-1240 — spe handling
        if (trop.spe !== UNDEF_SPE) {
            obj.spe = trop.spe;
            // Magic marker: add rn2(4) to spe if < 96
            if (trop.otyp === MAGIC_MARKER && obj.spe < 96) {
                obj.spe += rn2(4);
            }
        } else {
            // UNDEF_SPE: keep mksobj default, but fix rings with spe <= 0
            if (obj.oclass === RING_CLASS
                && objectData[otyp].charged && obj.spe <= 0) {
                obj.spe = rne(3);
            }
        }

        // C ref: u_init.c:1243-1244 — bless handling
        if (trop.bless !== UNDEF_BLESS) {
            obj.blessed = trop.bless > 0;
            obj.cursed = trop.bless < 0;
        }

        // Add to player inventory
        player.addToInventory(obj);

        // Track level-1 spellbooks for filter
        if (obj.oclass === SPBOOK_CLASS && (objectData[otyp].oc2 || 0) === 1) {
            gotSp1 = true;
        }

        if (--quan > 0) continue; // make another of same entry
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

// C ref: u_init.c u_init_role() — role-specific starting inventory
function u_init_role(player) {
    // Reset nocreate state for this role
    nocreate = nocreate2 = nocreate3 = nocreate4 = 0;

    switch (player.roleIndex) {
        case PM_ARCHEOLOGIST:
            iniInv(player, Archeologist_inv);
            if (!rn2(10)) iniInv(player, Tinopener_inv);
            else if (!rn2(4)) iniInv(player, Lamp_inv);
            else if (!rn2(5)) iniInv(player, Magicmarker_inv);
            break;
        case PM_BARBARIAN:
            if (rn2(100) >= 50) {
                iniInv(player, Barbarian_0_inv);
            } else {
                iniInv(player, Barbarian_1_inv);
            }
            if (!rn2(6)) iniInv(player, Lamp_inv);
            break;
        case PM_CAVEMAN:
            iniInv(player, Caveman_inv);
            break;
        case PM_HEALER:
            rn1(1000, 1001); // u.umoney0 = rn1(1000, 1001)
            iniInv(player, Healer_inv);
            if (!rn2(25)) iniInv(player, Lamp_inv);
            break;
        case PM_KNIGHT:
            iniInv(player, Knight_inv);
            break;
        case PM_MONK:
            iniInv(player, Monk_inv);
            iniInv(player, M_spell[Math.floor(rn2(90) / 30)]);
            if (!rn2(4)) iniInv(player, Magicmarker_inv);
            else if (!rn2(10)) iniInv(player, Lamp_inv);
            break;
        case PM_PRIEST:
            iniInv(player, Priest_inv);
            if (!rn2(5)) iniInv(player, Magicmarker_inv);
            else if (!rn2(10)) iniInv(player, Lamp_inv);
            break;
        case PM_RANGER:
            iniInv(player, Ranger_inv);
            break;
        case PM_ROGUE:
            // u.umoney0 = 0 (no RNG)
            iniInv(player, Rogue_inv);
            if (!rn2(5)) iniInv(player, Blindfold_inv);
            break;
        case PM_SAMURAI:
            iniInv(player, Samurai_inv);
            if (!rn2(5)) iniInv(player, Blindfold_inv);
            break;
        case PM_TOURIST:
            rnd(1000); // u.umoney0 = rnd(1000)
            iniInv(player, Tourist_inv);
            if (!rn2(25)) iniInv(player, Tinopener_inv);
            else if (!rn2(25)) iniInv(player, Leash_inv);
            else if (!rn2(25)) iniInv(player, Towel_inv);
            else if (!rn2(20)) iniInv(player, Magicmarker_inv);
            break;
        case PM_VALKYRIE:
            iniInv(player, Valkyrie_inv);
            if (!rn2(6)) iniInv(player, Lamp_inv);
            break;
        case PM_WIZARD:
            iniInv(player, Wizard_inv);
            if (!rn2(5)) iniInv(player, Blindfold_inv);
            break;
        default:
            // Unknown role — use Valkyrie as fallback
            iniInv(player, Valkyrie_inv);
            if (!rn2(6)) iniInv(player, Lamp_inv);
            break;
    }
}

// C ref: u_init.c u_init_race() — race-specific starting inventory
function u_init_race(player) {
    switch (player.race) {
        case RACE_HUMAN:
            break;
        case RACE_ELF:
            // Elf Cleric/Wizard gets a random instrument
            if (player.roleIndex === PM_PRIEST || player.roleIndex === PM_WIZARD) {
                const instruments = [WOODEN_FLUTE, TOOLED_HORN, WOODEN_HARP,
                                     BELL, BUGLE, LEATHER_DRUM];
                const instrTyp = instruments[rn2(6)];
                const Instrument_inv = [
                    { otyp: instrTyp, spe: 0, oclass: TOOL_CLASS, qmin: 1, qmax: 1, bless: 0 },
                ];
                iniInv(player, Instrument_inv);
            }
            break;
        case RACE_DWARF:
            break;
        case RACE_GNOME:
            break;
        case RACE_ORC:
            // Compensate for generally inferior equipment
            if (player.roleIndex !== PM_WIZARD) {
                iniInv(player, Xtra_food);
            }
            break;
    }
}

// ========================================================================
// Attribute Rolling
// ========================================================================

// Attribute distribution weights per role index
// C ref: role.c urole.attrdist[]
const ROLE_ATTRDIST = {
    0:  [20, 20, 20, 10, 20, 10], // Archeologist
    1:  [30, 6, 7, 20, 30, 7],    // Barbarian
    2:  [30, 6, 7, 20, 30, 7],    // Caveman
    3:  [15, 20, 20, 15, 25, 5],   // Healer
    4:  [30, 15, 15, 10, 20, 10],  // Knight
    5:  [25, 10, 20, 20, 15, 10],  // Monk
    6:  [15, 10, 30, 15, 20, 10],  // Priest
    7:  [30, 10, 10, 20, 20, 10],  // Ranger
    8:  [20, 10, 10, 30, 20, 10],  // Rogue
    9:  [30, 10, 8, 30, 14, 8],    // Samurai
    10: [15, 10, 10, 15, 30, 20],  // Tourist
    11: [30, 6, 7, 20, 30, 7],    // Valkyrie
    12: [10, 30, 10, 20, 20, 10],  // Wizard
};

// Race attribute bounds
// C ref: role.c races[].attrmin/attrmax
// STR uses STR18(x) = 18+x encoding (18/xx strength), so STR18(100) = 118
const RACE_ATTRMIN = [3, 3, 3, 3, 3, 3]; // Same for all races
const RACE_ATTRMAX = {
    [RACE_HUMAN]: [118, 18, 18, 18, 18, 18],  // STR18(100)
    [RACE_ELF]:   [18, 20, 20, 18, 16, 18],
    [RACE_DWARF]: [118, 16, 16, 20, 20, 16],   // STR18(100)
    [RACE_GNOME]: [68, 19, 18, 18, 18, 18],    // STR18(50)
    [RACE_ORC]:   [68, 16, 16, 18, 18, 16],    // STR18(50)
};

// Race HP/PW init bonuses
// C ref: role.c races[].hpadv.infix (HP init), races[].enadv.infix (PW init)
const RACE_HP = { [RACE_HUMAN]: 2, [RACE_ELF]: 1, [RACE_DWARF]: 4, [RACE_GNOME]: 1, [RACE_ORC]: 1 };
const RACE_PW = { [RACE_HUMAN]: 1, [RACE_ELF]: 2, [RACE_DWARF]: 0, [RACE_GNOME]: 2, [RACE_ORC]: 1 };

// Race-specific inventory substitutions
// C ref: u_init.c inv_subs[] — applied per item in iniInv
const INV_SUBS = [
    [RACE_ELF, DAGGER, ELVEN_DAGGER],
    [RACE_ELF, SPEAR, ELVEN_SPEAR],
    [RACE_ELF, SHORT_SWORD, ELVEN_SHORT_SWORD],
    [RACE_ELF, BOW, ELVEN_BOW],
    [RACE_ELF, ARROW, ELVEN_ARROW],
    [RACE_ELF, HELMET, ELVEN_LEATHER_HELM],
    [RACE_ELF, CLOAK_OF_DISPLACEMENT, ELVEN_CLOAK],
    [RACE_ELF, CRAM_RATION, LEMBAS_WAFER],
    [RACE_ORC, DAGGER, ORCISH_DAGGER],
    [RACE_ORC, SPEAR, ORCISH_SPEAR],
    [RACE_ORC, SHORT_SWORD, ORCISH_SHORT_SWORD],
    [RACE_ORC, BOW, ORCISH_BOW],
    [RACE_ORC, ARROW, ORCISH_ARROW],
    [RACE_ORC, HELMET, ORCISH_HELM],
    [RACE_ORC, SMALL_SHIELD, ORCISH_SHIELD],
    [RACE_ORC, RING_MAIL, ORCISH_RING_MAIL],
    [RACE_ORC, CHAIN_MAIL, ORCISH_CHAIN_MAIL],
    [RACE_ORC, CRAM_RATION, TRIPE_RATION],
    [RACE_ORC, LEMBAS_WAFER, TRIPE_RATION],
    [RACE_DWARF, SPEAR, DWARVISH_SPEAR],
    [RACE_DWARF, SHORT_SWORD, DWARVISH_SHORT_SWORD],
    [RACE_DWARF, HELMET, DWARVISH_IRON_HELM],
    [RACE_DWARF, LEMBAS_WAFER, CRAM_RATION],
    [RACE_GNOME, BOW, CROSSBOW],
    [RACE_GNOME, ARROW, CROSSBOW_BOLT],
];

// Orc extra food (non-Wizard)
// C ref: u_init.c Xtra_food[] — UNDEF_TYP food, qty 2
const Xtra_food = [
    { otyp: UNDEF_TYP, spe: UNDEF_SPE, oclass: FOOD_CLASS, qmin: 2, qmax: 2, bless: 0 },
];

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
    const attrmin = RACE_ATTRMIN;
    const attrmax = RACE_ATTRMAX[player.race] || RACE_ATTRMAX[RACE_HUMAN];

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

    // Helper to safely get RNG log length (returns 0 if logging disabled)
    const getRngCount = () => getRngLog()?.length ?? 0;

    // 1. makedog() — pet creation (actually places pet on map)
    let rngBefore = getRngCount();
    const pet = makedog(map, player, depth || 1);
    console.log(`makedog: ${getRngCount() - rngBefore} RNG calls`);

    // C ref: dog.c initedog() — apport = ACURR(A_CHA)
    // Called inside makedog() BEFORE init_attr(), and u.acurr is still zeroed.
    // acurr() computes max(u.abon + u.atemp + u.acurr, 3) = 3 at this point.
    if (pet && pet.edog) {
        pet.edog.apport = 3;
    }

    // 2. u_init_inventory_attrs()
    //    a. u_init_role() → role-specific inventory
    rngBefore = getRngCount();
    u_init_role(player);
    console.log(`u_init_role: ${getRngCount() - rngBefore} RNG calls`);
    //    b. u_init_race() → race-specific inventory (instruments, food)
    rngBefore = getRngCount();
    u_init_race(player);
    console.log(`u_init_race: ${getRngCount() - rngBefore} RNG calls`);
    //    c+d. init_attr(75) + vary_init_attr()
    rngBefore = getRngCount();
    initAttributes(player);
    console.log(`initAttributes: ${getRngCount() - rngBefore} RNG calls`);
    //    e. u_init_carry_attr_boost() — no RNG

    // Set HP/PW from role + race
    // C ref: u_init.c u_init_misc() — newhp() = role_hp + race_hp
    const raceHP = RACE_HP[player.race] ?? 2;
    const racePW = RACE_PW[player.race] ?? 1;
    player.hp = role.startingHP + raceHP;
    player.hpmax = player.hp;
    player.pw = role.startingPW + racePW;
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
