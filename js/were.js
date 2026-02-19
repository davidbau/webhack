// were.js -- Lycanthrope turn-end behavior
// C ref: mon.c m_calcdistress(), were.c were_change()/new_were()

import { rn2 } from './rng.js';
import {
    mons,
    PM_WERERAT,
    PM_WEREJACKAL,
    PM_WEREWOLF,
    PM_HUMAN_WERERAT,
    PM_HUMAN_WEREJACKAL,
    PM_HUMAN_WEREWOLF,
} from './monsters.js';

function counterWere(mndx) {
    switch (mndx) {
    case PM_WEREWOLF:
        return PM_HUMAN_WEREWOLF;
    case PM_HUMAN_WEREWOLF:
        return PM_WEREWOLF;
    case PM_WEREJACKAL:
        return PM_HUMAN_WEREJACKAL;
    case PM_HUMAN_WEREJACKAL:
        return PM_WEREJACKAL;
    case PM_WERERAT:
        return PM_HUMAN_WERERAT;
    case PM_HUMAN_WERERAT:
        return PM_WERERAT;
    default:
        return null;
    }
}

function isHumanWereForm(mndx) {
    return mndx === PM_HUMAN_WERERAT
        || mndx === PM_HUMAN_WEREJACKAL
        || mndx === PM_HUMAN_WEREWOLF;
}

function canSeeMonster(mon, player, fov) {
    if (!mon || !player || !fov?.canSee) return false;
    if (!fov.canSee(mon.mx, mon.my)) return false;
    if (player.blind) return false;
    if (mon.mundetected) return false;
    if (mon.minvis && !player.seeInvisible) return false;
    return true;
}

function wakeNear(map, x, y, dist2max) {
    if (!map?.monsters) return;
    for (const mon of map.monsters) {
        if (!mon || mon.dead) continue;
        const dx = mon.mx - x;
        const dy = mon.my - y;
        // C ref: wake_nearto_core() uses strict "< distance".
        if ((dx * dx + dy * dy) >= dist2max) continue;
        mon.sleeping = false;
        mon.msleeping = false;
    }
}

function applyWereFormChange(mon, newMndx) {
    const data = mons[newMndx];
    if (!data) return;
    mon.mndx = newMndx;
    mon.type = data;
    mon.name = data.name;
    mon.speed = data.speed;
    mon.attacks = data.attacks;

    // C ref: were.c new_were() -- transformation wakes helpless monsters.
    if (mon.sleeping || (mon.mfrozen > 0) || mon.mcanmove === false) {
        mon.sleeping = false;
        mon.msleeping = false;
        mon.mfrozen = 0;
        mon.mcanmove = true;
    }

    // C ref: were.c new_were() -- heal 1/4 of missing HP.
    const hp = mon.mhp ?? 0;
    const hpmax = mon.mhpmax ?? hp;
    const heal = Math.max(0, Math.floor((hpmax - hp) / 4));
    mon.mhp = Math.min(hpmax, hp + heal);
}

// C-faithful subset used during turn-end distress pass.
// Applies were_change() behavior; decide_to_shapeshift() is handled separately.
export function runWereTurnEnd(mon, ctx) {
    if (!mon || mon.dead) return;

    const otherForm = counterWere(mon.mndx);
    if (otherForm == null) {
        return;
    }

    const protectedFromShifters = !!ctx?.player?.protectionFromShapeChangers;

    if (isHumanWereForm(mon.mndx)) {
        // C ref: were.c were_change() human-form daytime/full-moon gate.
        // Current runtime does not model moon phase timing, so keep baseline 50.
        if (protectedFromShifters) return;
        if (rn2(50) !== 0) return;

        applyWereFormChange(mon, otherForm);

        // C ref: were.c -- unseen jackal/wolf change can trigger howl + wake_nearto.
        const deaf = !!ctx?.player?.deaf;
        if (deaf || canSeeMonster(mon, ctx?.player, ctx?.fov)) return;
        let howler = null;
        if (mon.mndx === PM_WEREWOLF) howler = 'wolf';
        if (mon.mndx === PM_WEREJACKAL) howler = 'jackal';
        if (!howler) return;
        ctx?.display?.putstr_message?.(`You hear a ${howler} howling at the moon.`);
        wakeNear(ctx?.map, mon.mx, mon.my, 16);
        return;
    }

    // C ref: were.c were_change() beast-form reversion branch.
    if (rn2(30) === 0 || protectedFromShifters) {
        applyWereFormChange(mon, otherForm);
    }
}
