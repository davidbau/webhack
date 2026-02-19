// bones.js -- Bones file management
// Mirrors bones.c from the C source.
// Handles saving bones on death and loading bones on level entry.
//
// C ref hierarchy:
//   savebones() — full pipeline on player death
//     ├─ can_make_bones()   — depth/probability check
//     ├─ drop_upon_death()  — move inventory to floor
//     │   └─ give_to_nearby_mon() — reservoir sampling item gift
//     ├─ resetobjs(save)    — cancel objects, clear timers
//     ├─ remove_mon_from_bones() — strip tame/unique/shopkeep
//     ├─ saveLev()          — serialize level
//     └─ saveBones()        — write to localStorage
//
//   getbones() — full pipeline on level entry
//     ├─ rn2(3)             — 1-in-3 chance to attempt load
//     ├─ loadBones()        — read from localStorage
//     ├─ restLev()          — deserialize level
//     ├─ set_ghostly_objlist() — mark objects ghostly
//     ├─ resetobjs(restore) — rebuild displayChar
//     ├─ sanitize ghost     — fix ghost name/stats
//     └─ deleteBones()      — remove used bones

import { rn2 } from './rng.js';
import { ACCESSIBLE } from './config.js';
import { CLASS_SYMBOLS } from './objects.js';
import { mons, PM_GHOST, S_GHOST } from './monsters.js';
import { def_monsyms } from './symbols.js';
import {
    saveLev, restLev, saveObjChn,
    saveBones, loadBones, deleteBones,
} from './storage.js';

// ========================================================================
// can_make_bones — C ref: bones.c can_make_bones()
// ========================================================================

// Check if bones can be saved at this depth.
// C ref: bones.c:61 — depth check + rn2(1+(depth>>2)) ghost probability
export function can_make_bones(game) {
    const depth = game.player.dungeonLevel;
    // C ref: bones.c:70 — can't make bones on level 1
    if (depth <= 1) return false;
    // C ref: bones.c:88 — ghost probability: rn2(1 + (depth >> 2))
    // Returns true if ghost should appear (0 = yes)
    if (rn2(1 + (depth >> 2)) !== 0) return false;
    return true;
}

// ========================================================================
// resetobjs — C ref: bones.c resetobjs()
// ========================================================================

// Process objects for bones save or restore.
// save mode: cancel objects, clear corpse timers, randomize containers
// restore mode: rebuild displayChar
export function resetobjs(list, restore) {
    for (const obj of list) {
        if (restore) {
            // C ref: bones.c:127 — rebuild display on restore
            obj.displayChar = CLASS_SYMBOLS[obj.oclass] || '?';
        } else {
            // C ref: bones.c:108 — cancel objects on save
            // Clear enchantment knowledge, timers
            if (obj.timed) obj.timed = false;
        }
        // Recurse into containers
        if (obj.contents && obj.contents.length > 0) {
            resetobjs(obj.contents, restore);
        }
    }
}

// ========================================================================
// drop_upon_death — C ref: bones.c drop_upon_death()
// ========================================================================

// Move player inventory to floor at death position.
// C ref: bones.c:319 — iterate invent, curse with rn2(5), give with rn2(8)
export function drop_upon_death(game) {
    const { player, map } = game;
    const x = player.x;
    const y = player.y;
    const toRemove = [];
    for (const obj of player.inventory) {
        // C ref: bones.c:347 — rn2(5) chance to curse each item
        if (!rn2(5)) {
            obj.cursed = true;
            obj.blessed = false;
        }
        // C ref: bones.c:356 — rn2(8) chance to give item to nearby monster
        if (!rn2(8)) {
            if (give_to_nearby_mon(map, obj, x, y)) {
                toRemove.push(obj);
                continue;
            }
        }
        // Drop on floor
        obj.ox = x;
        obj.oy = y;
        map.objects.push(obj);
        toRemove.push(obj);
    }
    // Clear inventory (all items distributed)
    for (const obj of toRemove) {
        const idx = player.inventory.indexOf(obj);
        if (idx >= 0) player.inventory.splice(idx, 1);
    }
    // Unequip everything
    player.weapon = null;
    player.armor = null;
    player.shield = null;
    player.helmet = null;
    player.gloves = null;
    player.boots = null;
    player.cloak = null;
    player.amulet = null;
    player.leftRing = null;
    player.rightRing = null;
}

// ========================================================================
// give_to_nearby_mon — C ref: bones.c give_to_nearby_mon()
// ========================================================================

// Give an item to a random nearby monster using reservoir sampling.
// C ref: bones.c:286 — rn2(++nmon) reservoir sampling
export function give_to_nearby_mon(map, otmp, x, y) {
    let nmon = 0;
    let chosen = null;
    for (const mon of map.monsters) {
        if (mon.dead) continue;
        // Check if monster is nearby (within 1 square)
        const dx = Math.abs(mon.mx - x);
        const dy = Math.abs(mon.my - y);
        if (dx > 1 || dy > 1) continue;
        // C ref: reservoir sampling — rn2(++nmon) === 0
        nmon++;
        if (!rn2(nmon)) {
            chosen = mon;
        }
    }
    if (chosen) {
        if (!chosen.minvent) chosen.minvent = [];
        chosen.minvent.push(otmp);
        return true;
    }
    return false;
}

// ========================================================================
// set_ghostly_objlist — C ref: bones.c set_ghostly_objlist()
// ========================================================================

// Mark objects as ghostly (from bones level).
// C ref: bones.c:134
export function set_ghostly_objlist(list) {
    for (const obj of list) {
        obj.ghostly = true;
        if (obj.contents && obj.contents.length > 0) {
            set_ghostly_objlist(obj.contents);
        }
    }
}

// ========================================================================
// remove_mon_from_bones — C ref: bones.c remove_mon_from_bones()
// ========================================================================

// Strip tame, shopkeepers, temple priests, unique monsters, Izchak from bones.
// C ref: bones.c:154
export function remove_mon_from_bones(map) {
    map.monsters = map.monsters.filter(mon => {
        if (mon.dead) return false;
        // C ref: bones.c:167 — remove tame monsters
        if (mon.tame) return false;
        // C ref: bones.c:169 — remove shopkeepers (isshk)
        if (mon.isshk) return false;
        // C ref: bones.c:171 — remove temple priests (ispriest)
        if (mon.ispriest) return false;
        // C ref: bones.c:180 — remove unique monsters
        if (mon.type && (mon.type.geno & 0x8000)) return false; // G_UNIQ
        return true;
    });
}

// ========================================================================
// sanitize_name — C ref: bones.c sanitize_name()
// ========================================================================

// Replace non-printable chars in a name.
// C ref: bones.c:42
export function sanitize_name(name) {
    if (!name) return 'anonymous';
    return name.replace(/[^ -~]/g, '_');
}

// TODO: bones.c:18 — no_bones_level(): check if this level forbids bones
//   (e.g. special levels, quest levels, vibrating square level, astral)
// TODO: bones.c:42 — goodfruit(): check if a fruit id is usable on a bones level
// TODO: bones.c:308 — fixuporacle(): restore oracle monster after bones load

// ========================================================================
// savebones — C ref: bones.c savebones()
// ========================================================================

// Full bones save pipeline on player death.
// C ref: bones.c:399
export function savebones(game) {
    const { player, map } = game;
    if (!map) return;
    const depth = player.dungeonLevel;

    // C ref: bones.c:407 — can_make_bones check (RNG consumed)
    // Note: can_make_bones consumes rn2 even if it returns false
    const canMake = can_make_bones(game);

    // Drop inventory onto the floor (always, even if not saving bones)
    // C ref: bones.c:451 — drop_upon_death
    drop_upon_death(game);

    if (!canMake) return;

    // C ref: bones.c:460 — resetobjs(fobj, FALSE) for save
    resetobjs(map.objects, false);

    // C ref: bones.c:464 — remove_mon_from_bones
    remove_mon_from_bones(map);

    // C ref: bones.c:480 — create ghost at player position
    const ghostType = mons[PM_GHOST];
    const symEntry = def_monsyms[ghostType.symbol];
    const ghost = {
        mndx: PM_GHOST,
        type: ghostType,
        name: 'Ghost of ' + sanitize_name(player.name),
        displayChar: symEntry ? symEntry.sym : ' ',
        displayColor: ghostType.color,
        mx: player.x, my: player.y,
        mhp: player.level * 10,
        mhpmax: player.level * 10,
        mlevel: player.level,
        mac: ghostType.ac,
        speed: ghostType.speed,
        movement: 0,
        attacks: ghostType.attacks,
        peaceful: false, tame: false,
        flee: false, confused: false, stunned: false,
        blind: false, sleeping: false, dead: false,
        passive: false,
        mtrack: [{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}],
        minvent: [],
    };
    map.monsters.push(ghost);

    // C ref: bones.c:503 — cemetery metadata
    map.cemetery = {
        who: sanitize_name(player.name),
        when: Date.now(),
        frpg: player.roleName || 'Unknown',
        hp: player.hp,
        maxhp: player.hpmax,
        death: game.gameOverReason || 'killed',
    };

    // C ref: bones.c:519 — savelev + saveBones
    const mapData = saveLev(map);
    mapData.isBones = true;
    saveBones(depth, mapData, player.name,
              player.x, player.y, player.level, []);
}

// ========================================================================
// getbones — C ref: bones.c getbones()
// ========================================================================

// Full bones load pipeline on level entry.
// Returns a GameMap on success or null (bones not found / rn2(3) check failed).
// C ref: bones.c:533
export function getbones(game, depth) {
    // C ref: bones.c:545 — rn2(3), only attempt load if 0
    const bonesRoll = rn2(3);
    if (bonesRoll !== 0) return null;

    const bonesData = loadBones(depth);
    if (!bonesData || !bonesData.map) return null;

    // C ref: bones.c:560 — delete bones file (single-use)
    deleteBones(depth);

    // C ref: bones.c:563 — restLev (getlev)
    const bonesMap = restLev(bonesData.map);
    bonesMap.isBones = true;

    // C ref: bones.c:572 — set_ghostly_objlist
    set_ghostly_objlist(bonesMap.objects);

    // C ref: bones.c:575 — resetobjs(fobj, TRUE) for restore
    resetobjs(bonesMap.objects, true);

    // C ref: bones.c:580 — sanitize ghost name/stats
    for (const mon of bonesMap.monsters) {
        if (mon.mndx === PM_GHOST) {
            mon.name = sanitize_name(mon.name);
        }
    }

    return bonesMap;
}
