// trap.js -- Trap mechanics
// C ref: trap.c — m_harmless_trap(), floor_trigger(), mintrap(), check_in_air()
//
// INCOMPLETE / MISSING vs C trap.c:
// - mintrap: only PIT/SPIKED_PIT, TELEP_TRAP, MAGIC_TRAP handled
// - Missing: ARROW_TRAP, DART_TRAP, ROCKTRAP, SQKY_BOARD, LANDMINE, ROLLING_BOULDER
// - Missing: LEVEL_TELEP, POLY_TRAP, VIBRATING_SQUARE effects
// - No dotrap (player trap handling)
// - No launch_obj (launched object mechanics)
// - m_harmless_trap: no resists_magm check for ANTI_MAGIC

import { COLNO, ROWNO, ACCESSIBLE, isok } from './config.js';
import { rn2, rnd } from './rng.js';
import { is_mindless } from './mondata.js';
import { mon_knows_traps, mon_learns_traps } from './mondata.js';
import { mondead } from './monutil.js';
import { mons,
         PM_IRON_GOLEM,
         M1_FLY, M1_AMORPHOUS, M1_CLING,
         MR_FIRE, MR_SLEEP,
         MZ_SMALL,
         S_EYE, S_LIGHT, S_PIERCER } from './monsters.js';
import { STATUE_TRAP, MAGIC_TRAP, VIBRATING_SQUARE, RUST_TRAP, FIRE_TRAP,
         SLP_GAS_TRAP, BEAR_TRAP, PIT, SPIKED_PIT, HOLE, TRAPDOOR,
         TELEP_TRAP, WEB, ANTI_MAGIC } from './symbols.js';

// Trap result constants
const Trap_Effect_Finished = 0;
const Trap_Caught_Mon = 1;
const Trap_Killed_Mon = 2;
const Trap_Moved_Mon = 3;

// C ref: trap.c m_harmless_trap()
// Returns true if the trap is harmless to this monster (no avoidance needed).
export function m_harmless_trap(mon, trap) {
    const mdat = mons[mon.mndx] || {};
    const flags1 = mdat.flags1 || 0;
    const mr1 = mdat.mr1 || 0;
    const msize = mdat.size || 0;

    // C ref: floor_trigger + check_in_air — flyers avoid floor traps
    const isFloor = trap.ttyp >= 1 && trap.ttyp <= TRAPDOOR; // ARROW..TRAPDOOR
    if (isFloor && (flags1 & M1_FLY)) return true;

    switch (trap.ttyp) {
    case STATUE_TRAP:
    case MAGIC_TRAP:
    case VIBRATING_SQUARE:
        return true;
    case RUST_TRAP:
        return mon.mndx !== PM_IRON_GOLEM;
    case FIRE_TRAP:
        return !!(mr1 & MR_FIRE);
    case SLP_GAS_TRAP:
        return !!(mr1 & MR_SLEEP);
    case BEAR_TRAP:
        return msize <= MZ_SMALL || !!(flags1 & M1_AMORPHOUS);
    case PIT: case SPIKED_PIT: case HOLE: case TRAPDOOR:
        return !!(flags1 & M1_CLING);
    case WEB:
        return !!(flags1 & M1_AMORPHOUS);
    case ANTI_MAGIC:
        return false;
    default:
        return false;
    }
}

// C ref: trap.c floor_trigger() — traps triggered by touching floor.
export function floor_trigger(ttyp) {
    return ttyp >= 1 && ttyp <= TRAPDOOR;
}

// C ref: trap.c check_in_air() subset for monsters.
function mon_check_in_air(mon) {
    const mdat = mon?.type || {};
    const mlet = mdat.symbol ?? -1;
    const flags1 = mdat.flags1 || 0;
    const isFloater = (mlet === S_EYE || mlet === S_LIGHT);
    const isFlyer = !!(flags1 & M1_FLY);
    return isFloater || isFlyer;
}

export function mintrap_postmove(mon, map, player) {
    const trap = map.trapAt(mon.mx, mon.my);
    if (!trap) {
        mon.mtrapped = 0;
        return Trap_Effect_Finished;
    }

    if (mon.mtrapped) {
        if (!rn2(40)) {
            mon.mtrapped = 0;
            return Trap_Effect_Finished;
        }
        return Trap_Caught_Mon;
    }

    const tt = trap.ttyp;
    const already_seen = mon_knows_traps(mon, tt)
        || (tt === HOLE && !is_mindless(mon.type || {}));

    if (floor_trigger(tt) && mon_check_in_air(mon)) {
        return Trap_Effect_Finished;
    }
    if (already_seen && rn2(4)) {
        return Trap_Effect_Finished;
    }

    mon_learns_traps(mon, tt);

    if (m_harmless_trap(mon, trap)) {
        return Trap_Effect_Finished;
    }

    switch (trap.ttyp) {
    case PIT:
    case SPIKED_PIT: {
        mon.mtrapped = 1;
        const dmg = rnd(trap.ttyp === PIT ? 6 : 10);
        mon.mhp -= Math.max(0, dmg);
        if (mon.mhp <= 0) {
            mondead(mon, map);
            map.removeMonster(mon);
            return Trap_Killed_Mon;
        }
        return Trap_Caught_Mon;
    }
    case TELEP_TRAP: {
        if (map.flags && map.flags.noteleport) return Trap_Effect_Finished;
        for (let tries = 0; tries < 50; tries++) {
            const nx = rnd(COLNO - 1);
            const ny = rn2(ROWNO);
            const loc = map.at(nx, ny);
            if (!loc || !ACCESSIBLE(loc.typ)) continue;
            if (map.monsterAt(nx, ny)) continue;
            if (player && nx === player.x && ny === player.y) continue;
            if (nx === mon.mx && ny === mon.my) continue;
            mon.mx = nx;
            mon.my = ny;
            return Trap_Moved_Mon;
        }
        return Trap_Moved_Mon;
    }
    case MAGIC_TRAP:
        rn2(21);
        return Trap_Effect_Finished;
    default:
        return Trap_Effect_Finished;
    }
}
