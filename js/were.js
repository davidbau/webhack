// were.js -- Lycanthropy mechanics
// cf. were.c — lycanthrope form changes, summoning, and player lycanthropy

import { rn2 } from './rng.js';
import {
    mons,
    PM_WERERAT,
    PM_WEREJACKAL,
    PM_WEREWOLF,
    PM_HUMAN_WERERAT,
    PM_HUMAN_WEREJACKAL,
    PM_HUMAN_WEREWOLF,
    PM_SEWER_RAT,
    PM_GIANT_RAT,
    PM_RABID_RAT,
    PM_JACKAL,
    PM_FOX,
    PM_COYOTE,
    PM_WOLF,
    PM_WARG,
    PM_WINTER_WOLF,
    PM_WINTER_WOLF_CUB,
} from './monsters.js';

// cf. were.c:48 — map lycanthrope to its alternate form
export function counter_were(pm) {
    switch (pm) {
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

// cf. were.c:70 — convert monsters similar to werecritters into appropriate werebeast
export function were_beastie(pm) {
    switch (pm) {
    case PM_WERERAT:
    case PM_SEWER_RAT:
    case PM_GIANT_RAT:
    case PM_RABID_RAT:
        return PM_WERERAT;
    case PM_WEREJACKAL:
    case PM_JACKAL:
    case PM_FOX:
    case PM_COYOTE:
        return PM_WEREJACKAL;
    case PM_WEREWOLF:
    case PM_WOLF:
    case PM_WARG:
    case PM_WINTER_WOLF:
    case PM_WINTER_WOLF_CUB:
        return PM_WEREWOLF;
    default:
        return null;
    }
}

// Helper: check if mndx is a human were form (not in C; derived from counter_were logic)
function isHumanWereForm(mndx) {
    return mndx === PM_HUMAN_WERERAT
        || mndx === PM_HUMAN_WEREJACKAL
        || mndx === PM_HUMAN_WEREWOLF;
}

// Helper: simplified canseemon check (cf. mon.c canseemon macro)
function canSeeMonster(mon, player, fov) {
    if (!mon || !player || !fov?.canSee) return false;
    if (!fov.canSee(mon.mx, mon.my)) return false;
    if (player.blind) return false;
    if (mon.mundetected) return false;
    if (mon.minvis && !player.seeInvisible) return false;
    return true;
}

// Helper: wake monsters near a location (cf. mon.c:4369 wake_nearto_core)
function wakeNear(map, x, y, dist2max) {
    if (!map?.monsters) return;
    for (const mon of map.monsters) {
        if (!mon || mon.dead) continue;
        const dx = mon.mx - x;
        const dy = mon.my - y;
        if ((dx * dx + dy * dy) >= dist2max) continue;
        mon.sleeping = false;
        mon.msleeping = false;
    }
}

// cf. were.c:96 — apply lycanthrope form change (wake, heal, update data)
export function new_were(mon, newMndx) {
    const data = mons[newMndx];
    if (!data) return;
    mon.mndx = newMndx;
    mon.type = data;
    mon.name = data.name;
    mon.speed = data.speed;
    mon.attacks = data.attacks;

    // Transformation wakes helpless monsters
    if (mon.sleeping || (mon.mfrozen > 0) || mon.mcanmove === false) {
        mon.sleeping = false;
        mon.msleeping = false;
        mon.mfrozen = 0;
        mon.mcanmove = true;
    }

    // Heal 1/4 of missing HP
    const hp = mon.mhp ?? 0;
    const hpmax = mon.mhpmax ?? hp;
    const heal = Math.max(0, Math.floor((hpmax - hp) / 4));
    mon.mhp = Math.min(hpmax, hp + heal);
}

// cf. were.c:9 — turn-end lycanthrope form change check
export function were_change(mon, ctx) {
    if (!mon || mon.dead) return;

    const otherForm = counter_were(mon.mndx);
    if (otherForm == null) {
        return;
    }

    const protectedFromShifters = !!ctx?.player?.protectionFromShapeChangers;

    if (isHumanWereForm(mon.mndx)) {
        // Human form: chance to change into animal form
        // Full implementation would use night() and flags.moonphase
        if (protectedFromShifters) return;
        if (rn2(50) !== 0) return;

        new_were(mon, otherForm);

        // Unseen jackal/wolf change can trigger howl + wake_nearto
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

    // Beast form: chance to revert to human form
    if (rn2(30) === 0 || protectedFromShifters) {
        new_were(mon, otherForm);
    }
}

// TODO: were.c:142 — were_summon(): summon a horde of were-associated creatures (needs makemon)
// TODO: were.c:192 — you_were(): player changes to lycanthrope beast form (needs polymon)
// TODO: were.c:213 — you_unwere(): player reverts from beast form or gets cured (needs rehumanize)

// cf. were.c:232 — set/clear player lycanthropy type
export function set_ulycn(player, which) {
    if (!player) return;
    player.ulycn = which;
    // TODO: call set_uasmon() to update innate intrinsics (Drain_resistance)
}

