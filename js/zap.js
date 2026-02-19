// zap.js -- Wand zapping and beam effects
// C ref: zap.c — dozap(), weffects(), dobuzz(), zhitm(), zap_hit()
// C ref: trap.c — burnarmor()
// C ref: mon.c — xkilled(), corpse_chance()

import { rn2, rnd, d, c_d, rne, rnz } from './rng.js';
import { isok, ACCESSIBLE, IS_WALL, IS_DOOR, COLNO, ROWNO, A_STR } from './config.js';
import { exercise } from './attrib_exercise.js';
import { objectData, WAND_CLASS, WAN_FIRE, WAN_COLD, WAN_LIGHTNING,
         WAN_SLEEP, WAN_DEATH, WAN_MAGIC_MISSILE, WAN_STRIKING,
         WAN_DIGGING, WAN_NOTHING,
         CORPSE, FOOD_CLASS, FLESH } from './objects.js';
import { mons, G_FREQ, MZ_TINY, M2_NEUTER, M2_MALE, M2_FEMALE,
         MR_FIRE, MR_COLD, MR_SLEEP, MR_ELEC,
         PM_LIZARD, PM_LICHEN, S_TROLL } from './monsters.js';
import { rndmonnum } from './makemon.js';
import { next_ident } from './mkobj.js';
import { checkLevelUp } from './combat.js';
import { nhgetch } from './input.js';
import { nonliving, monDisplayName } from './mondata.js';

// Direction vectors matching commands.js DIRECTION_KEYS
const DIRECTION_KEYS = {
    'h': [-1,  0],  'j': [ 0,  1],  'k': [ 0, -1],  'l': [ 1,  0],
    'y': [-1, -1],  'u': [ 1, -1],  'b': [-1,  1],  'n': [ 1,  1],
    '.': [ 0,  0],  // self
};

// Beam types (C ref: zap.c AD_* / ZT_*)
const ZT_MAGIC_MISSILE = 0;
const ZT_FIRE = 1;
const ZT_COLD = 2;
const ZT_SLEEP = 3;
const ZT_DEATH = 4;
const ZT_LIGHTNING = 5;

// Map wand otyp to beam type
function wandToBeamType(otyp) {
    switch (otyp) {
        case WAN_MAGIC_MISSILE: return ZT_MAGIC_MISSILE;
        case WAN_FIRE:          return ZT_FIRE;
        case WAN_COLD:          return ZT_COLD;
        case WAN_SLEEP:         return ZT_SLEEP;
        case WAN_DEATH:         return ZT_DEATH;
        case WAN_LIGHTNING:     return ZT_LIGHTNING;
        default:                return -1;
    }
}

// Beam damage dice (C ref: zap.c bzap array — damage die per type)
function beamDamageDice(type) {
    switch (type) {
        case ZT_MAGIC_MISSILE: return [2, 6];  // 2d6
        case ZT_FIRE:          return [6, 6];  // 6d6
        case ZT_COLD:          return [6, 6];  // 6d6
        case ZT_SLEEP:         return [0, 0];  // sleep has no HP damage
        case ZT_DEATH:         return [0, 0];  // instant death
        case ZT_LIGHTNING:     return [6, 6];  // 6d6
        default:               return [0, 0];
    }
}

// C ref: zap.c:6070 resist() — magic resistance saving throw
// Returns true if monster resists (damage halved by caller).
// Consumes one rn2() call.
function resist(mon, oclass) {
    const mdat = mons[mon.mndx];
    // C ref: zap.c:6081-6103 — attack level based on object class
    let alev;
    if (oclass === WAND_CLASS) alev = 12;
    else alev = 10; // TOOL_CLASS/WEAPON_CLASS default

    // C ref: zap.c:6104-6109 — defense level
    let dlev = mon.mlevel || 0;
    if (dlev > 50) dlev = 50;
    else if (dlev < 1) dlev = 1;

    // C ref: zap.c:6111 — rn2(100 + alev - dlev) < mr
    const mr = mdat.mr || 0;
    return rn2(100 + alev - dlev) < mr;
}

// C ref: trap.c:88 burnarmor() — check if monster's armor burns
// While loop picks random armor slot; case 1 (body armor) always returns TRUE.
// Other cases continue if monster has no armor in that slot.
function burnarmor(mon) {
    // C ref: trap.c:112-156 — while(1) switch(rn2(5))
    while (true) {
        const slot = rn2(5);
        if (slot === 1) {
            // Case 1: cloak/body/shirt — always returns TRUE even if no armor
            return true;
        }
        // Cases 0, 2, 3, 4: if monster has no armor (typical), continue loop
        // For monsters with armor we'd check erode_obj, but for simplicity
        // assume no armor (most early monsters) → continue
    }
}

// C ref: zap.c:4646 zap_hit() — determine if beam hits a monster
function zap_hit(ac, type) {
    // C ref: zap.c:4650 — rn2(20) chance check
    const chance = rn2(20);
    if (!chance) {
        // C ref: zap.c:4655 — small chance for naked target to dodge
        return rnd(10) < ac;
    }
    return (3 - chance < ac);
}

// C ref: zap.c:4224 zhitm() — apply beam damage to a monster
// Returns damage dealt
function zhitm(mon, type, nd, map) {
    const mdat = mons[mon.mndx];
    let tmp = 0;

    if (type === ZT_FIRE) {
        // C ref: zap.c:4247 — resists_fire check (no RNG)
        if (mdat.mr1 & MR_FIRE) {
            // resistant — no damage
        } else {
            // C ref: zap.c:4251 — c_d(nd, 6) for fire damage
            tmp = c_d(nd, 6);

            // C ref: zap.c:4257 — burnarmor, then conditional rn2(3)
            if (burnarmor(mon)) {
                if (!rn2(3)) {
                    // destroy_items — stub, no items to destroy on most monsters
                }
            }
        }
    } else if (type === ZT_COLD) {
        if (mdat.mr1 & MR_COLD) {
            // resistant
        } else {
            tmp = c_d(nd, 6);
            if (!rn2(3)) {
                // destroy_items
            }
        }
    } else if (type === ZT_LIGHTNING) {
        tmp = c_d(nd, 6);
        if (mdat.mr1 & MR_ELEC) {
            tmp = 0; // resistant, but still rolls damage for RNG
        }
        if (!rn2(3)) {
            // destroy_items
        }
    } else if (type === ZT_MAGIC_MISSILE) {
        tmp = c_d(nd, 6);
    } else if (type === ZT_SLEEP) {
        // sleep effect, no HP damage
    } else if (type === ZT_DEATH) {
        // instant kill for non-resistant
        tmp = mon.mhp + 1;
        type = -1; // no saving throw
    }

    // C ref: zap.c:4375-4377 — resist halves damage
    if (tmp > 0 && type >= 0 && resist(mon, WAND_CLASS)) {
        tmp = Math.floor(tmp / 2);
    }

    return tmp;
}

// C ref: mon.c:3243 corpse_chance() — probability of leaving a corpse
function corpse_chance(mon) {
    const mdat = mons[mon.mndx] || {};
    const gfreq = (mdat.geno || 0) & G_FREQ;
    const verysmall = (mdat.size || 0) === MZ_TINY;
    const corpsetmp = 2 + (gfreq < 2 ? 1 : 0) + (verysmall ? 1 : 0);
    return !rn2(corpsetmp);
}

// C ref: mon.c:3581 xkilled() — handle monster death
// Creates corpse, awards XP
function xkilled(mon, map, player, display) {
    // Award experience
    const exp = (mon.mlevel + 1) * (mon.mlevel + 1);
    player.exp += exp;
    player.score += exp;
    checkLevelUp(player, display);

    // C ref: mon.c:3581 — "illogical but traditional" treasure drop
    rn2(6);

    // C ref: mon.c:3243 — corpse_chance
    const createCorpse = corpse_chance(mon);

    if (createCorpse) {
        // C ref: mksobj(CORPSE, TRUE, FALSE) — newobj() consumes next_ident().
        const o_id = next_ident();

        // C ref: mksobj_init → rndmonnum for corpse init
        const rndmndx = rndmonnum(1);

        // C ref: mksobj_postinit → gender for random monster
        if (rndmndx >= 0) {
            const rndmon = mons[rndmndx];
            const f2 = rndmon ? rndmon.flags2 || 0 : 0;
            if (!(f2 & M2_NEUTER) && !(f2 & M2_FEMALE) && !(f2 & M2_MALE)) {
                rn2(2); // sex
            }
        }

        // C ref: set_corpsenm → start_corpse_timeout for the RANDOM monster
        // (lichen/lizard skip is checked against random monster, not actual monster)
        if (rndmndx !== PM_LIZARD && rndmndx !== PM_LICHEN
            && mons[rndmndx] && mons[rndmndx].symbol !== S_TROLL) {
            // Normal rot timeout: rnz(10) during gameplay, rnz(25) during mklev
            rnz(10);
        }

        // Place corpse on the map
        if (map) {
            const corpse = {
                otyp: CORPSE,
                oclass: FOOD_CLASS,
                material: FLESH,
                o_id,
                corpsenm: mon.mndx || 0,
                displayChar: '%',
                displayColor: 7,
                ox: mon.mx,
                oy: mon.my,
                cursed: false,
                blessed: false,
                oartifact: 0,
                // C ref: mkobj.c set_corpsenm() stamps corpse age with monstermoves.
                age: (player?.turns || 0) + 1,
            };
            map.objects.push(corpse);
        }
    }
}

// C ref: zap.c:4763 dobuzz() — fire a beam across the map
// sx, sy: starting position; dx, dy: direction
function dobuzz(player, map, display, type, nd, dx, dy, sx, sy) {
    const range = 7 + (player.level >> 1); // C ref: zap.c rnd(7+mcastu) typical
    let x = sx;
    let y = sy;

    // C ref: zap.c:4763 — beam wander check at start
    rn2(7);

    for (let i = 0; i < range; i++) {
        x += dx;
        y += dy;

        if (!isok(x, y)) break;
        const loc = map.at(x, y);
        if (!loc) break;

        // Check for monster hit
        const mon = map.monsterAt(x, y);
        if (mon && !mon.dead) {
            // C ref: zap.c:4812 — zap_hit with monster AC
            const mac = mon.mac || 10;
            zap_hit(mac, 0);

            // C ref: zap.c:4825 — zhitm
            const damage = zhitm(mon, type, nd, map);

            // Apply damage
            mon.mhp -= damage;
            if (mon.mhp <= 0) {
                mon.dead = true;
                // C ref: nonliving monsters (undead, golems) are "destroyed" not "killed"
                const mdat = mon.type || {};
                const killVerb = nonliving(mdat) ? 'destroy' : 'kill';
                display.putstr_message(`You ${killVerb} the ${monDisplayName(mon)}!`);
                map.removeMonster(mon);
                xkilled(mon, map, player, display);
            }
            // Beam continues through dead monsters
            continue;
        }

        // Check for wall/boundary — beam stops or bounces
        if (IS_WALL(loc.typ) || loc.typ === 0) {
            // C ref: zap.c:4963 — beam bounce
            // rn2(75) for each direction component to determine bounce
            if (dx) rn2(75);
            if (dy) rn2(75);
            display.putstr_message('The bolt of fire bounces!');
            break;
        }
    }
}

// Main zap handler — called from commands.js
// C ref: zap.c dozap()
export async function handleZap(player, map, display, game) {
    // Read item letter
    const itemCh = await nhgetch();
    const itemChar = String.fromCharCode(itemCh);

    if (itemCh === 27) { // ESC
        if (game.flags.verbose) {
            display.putstr_message('Never mind.');
        }
        return { moved: false, tookTime: false };
    }

    // Find the wand in inventory
    const wand = player.inventory.find(o => o.invlet === itemChar);
    if (!wand || wand.oclass !== WAND_CLASS) {
        display.putstr_message("That's not a wand!");
        return { moved: false, tookTime: false };
    }

    // Read direction
    const dirCh = await nhgetch();
    const dirChar = String.fromCharCode(dirCh);
    const dir = DIRECTION_KEYS[dirChar];

    if (!dir) {
        if (game.flags.verbose) {
            display.putstr_message('Never mind.');
        }
        return { moved: false, tookTime: false };
    }

    // Determine beam type
    const beamType = wandToBeamType(wand.otyp);
    if (beamType < 0) {
        // Non-beam wand (digging, polymorph, etc.) — stub
        display.putstr_message('Nothing happens.');
        return { moved: false, tookTime: true };
    }

    // C ref: attrib.c:506 — exercise(A_STR, TRUE) before zapping
    exercise(player, A_STR, true);

    // Decrease charges
    if (wand.spe > 0) wand.spe--;

    // C ref: zap.c — nd (number of dice) = 6 for wand beams
    const nd = 6;

    // Fire the beam
    dobuzz(player, map, display, beamType, nd, dir[0], dir[1], player.x, player.y);

    return { moved: false, tookTime: true };
}
