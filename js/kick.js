// kick.js -- Kicking doors, monsters, and objects
// cf. kick.c — dokick() and related functions

import { IS_DOOR, D_LOCKED, D_CLOSED, D_ISOPEN, D_BROKEN, D_NODOOR,
         IRONBARS, TREE, THRONE, ALTAR, FOUNTAIN, GRAVE, SINK,
         IS_WALL, A_STR, A_DEX, A_CON } from './config.js';
import { rn2, rnd, rnl } from './rng.js';
import { exercise } from './attrib_exercise.js';
import { monDisplayName } from './mondata.js';
import { mondead } from './monutil.js';
import { nhgetch } from './input.js';
import { DIRECTION_KEYS } from './dothrow.js';

// Handle kicking
// C ref: dokick.c dokick()
export async function handleKick(player, map, display, game) {
    display.putstr_message('In what direction?');
    const dirCh = await nhgetch();
    // Prompt should not concatenate with outcome message.
    display.topMessage = null;
    const c = String.fromCharCode(dirCh);
    const dir = DIRECTION_KEYS[c];
    if (!dir) {
        if (game.flags.verbose) {
            display.putstr_message("Never mind.");
        }
        return { moved: false, tookTime: false };
    }

    const nx = player.x + dir[0];
    const ny = player.y + dir[1];
    player.kickedloc = { x: nx, y: ny };
    const loc = map.at(nx, ny);

    if (!loc) return { moved: false, tookTime: false };

    // Kick a monster
    const mon = map.monsterAt(nx, ny);
    if (mon) {
        display.putstr_message(`You kick the ${monDisplayName(mon)}!`);
        const damage = rnd(4) + player.strDamage;
        mon.mhp -= Math.max(1, damage);
        if (mon.mhp <= 0) {
            mondead(mon, map, player);
            display.putstr_message(`The ${monDisplayName(mon)} dies!`);
            map.removeMonster(mon);
        }
        return { moved: false, tookTime: true };
    }

    // Kick a locked door
    if (IS_DOOR(loc.typ) && (loc.flags & D_LOCKED)) {
        exercise(player, A_DEX, true);
        const str = player.attributes ? player.attributes[A_STR] : 18;
        const dex = player.attributes ? player.attributes[A_DEX] : 11;
        const con = player.attributes ? player.attributes[A_CON] : 18;
        const avrgAttrib = Math.floor((str + dex + con) / 3);
        const kickedOpen = rnl(35) < avrgAttrib;
        if (kickedOpen) {
            if (str > 18 && rn2(5) === 0) {
                display.putstr_message("As you kick the door, it shatters to pieces!");
                loc.flags = D_NODOOR;
            } else {
                display.putstr_message("As you kick the door, it crashes open!");
                loc.flags = D_BROKEN;
            }
            exercise(player, A_STR, true);
        } else {
            // We do not model Deaf yet; keep C's rn2(3) branch split for RNG parity.
            exercise(player, A_STR, true);
            display.putstr_message(rn2(3) ? "Whammm!!" : "Thwack!!");
        }
        return { moved: false, tookTime: true };
    }

    // Kick a closed door
    if (IS_DOOR(loc.typ) && (loc.flags & D_CLOSED)) {
        exercise(player, A_STR, true);
        loc.flags = D_ISOPEN;
        display.putstr_message("The door crashes open!");
        return { moved: false, tookTime: true };
    }

    // C ref: dokick.c kick_ouch() for hard non-door terrain.
    if (IS_WALL(loc.typ)
        || loc.typ === IRONBARS
        || loc.typ === TREE
        || loc.typ === THRONE
        || loc.typ === ALTAR
        || loc.typ === FOUNTAIN
        || loc.typ === GRAVE
        || loc.typ === SINK) {
        display.putstr_message("Ouch!  That hurts!");
        // C ref: exercise(A_DEX, FALSE), exercise(A_STR, FALSE)
        exercise(player, A_DEX, false);
        exercise(player, A_STR, false);
        // C ref: if (!rn2(3)) set_wounded_legs(..., 5 + rnd(5))
        if (rn2(3) === 0) {
            const timeout = 5 + rnd(5);
            const alreadyWounded = (player.woundedLegsTimeout || 0) > 0;
            player.woundedLegsTimeout = timeout;
            if (!alreadyWounded && player.attributes) {
                player.attributes[A_DEX] = Math.max(1, player.attributes[A_DEX] - 1);
            }
        }
        // C ref: dmg = rnd(ACURR(A_CON) > 15 ? 3 : 5)
        const con = player.attributes?.[A_CON] || 10;
        const dmg = rnd(con > 15 ? 3 : 5);
        player.hp = Math.max(1, (player.hp || player.hpmax || 1) - Math.max(1, dmg));
        return { moved: false, tookTime: true };
    }

    // C ref: dokick.c kick_dumb() for kicking empty/non-solid space.
    exercise(player, A_DEX, false);
    const dex = player.attributes?.[A_DEX] || 10;
    if (dex >= 16 || rn2(3) !== 0) {
        display.putstr_message("You kick at empty space.");
    } else {
        display.putstr_message("Dumb move!  You strain a muscle.");
        exercise(player, A_STR, false);
        rnd(5); // set_wounded_legs timeout component
    }
    return { moved: false, tookTime: true };
}
