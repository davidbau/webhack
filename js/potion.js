// potion.js -- Potion mechanics
// cf. potion.c — dodrink, peffects, healup, potionhit, dodip, status effects

import { rn2, rn1, rnd, c_d } from './rng.js';
import { nhgetch } from './input.js';
import { POTION_CLASS, POT_WATER } from './objects.js';
import { FOUNTAIN, A_CON, A_STR, A_WIS } from './config.js';
import { exercise } from './attrib_exercise.js';
import { drinkfountain } from './commands.js';


// ============================================================
// 1. Intrinsic timeouts
// ============================================================

// TODO: cf. potion.c itimeout() — return remaining intrinsic timeout
// TODO: cf. potion.c itimeout_incr() — increment intrinsic timeout safely
// TODO: cf. potion.c set_itimeout() — set intrinsic timeout to specific value
// TODO: cf. potion.c incr_itimeout() — increment timeout with overflow protection

// ============================================================
// 2. Status effects
// ============================================================

// TODO: cf. potion.c make_confused() — set/extend confusion
// TODO: cf. potion.c make_stunned() — set/extend stun
// TODO: cf. potion.c make_sick() — apply sickness (food poisoning or illness)
// TODO: cf. potion.c make_slimed() — begin sliming countdown
// TODO: cf. potion.c make_stoned() — begin stoning countdown
// TODO: cf. potion.c make_vomiting() — set/extend vomiting
// TODO: cf. potion.c make_blinded() — set/extend blindness
// TODO: cf. potion.c toggle_blindness() — toggle blind state and update vision
// TODO: cf. potion.c make_hallucinated() — set/extend hallucination
// TODO: cf. potion.c make_deaf() — set/extend deafness
// TODO: cf. potion.c make_glib() — set/extend slippery fingers

// ============================================================
// 3. Quaff mechanics
// ============================================================

// TODO: cf. potion.c self_invis_message() — "you can't see yourself" message
// TODO: cf. potion.c ghost_from_bottle() — release ghost from smoky potion
// TODO: cf. potion.c drink_ok() — validate object is drinkable

// cf. potion.c dodrink() — quaff a potion (partial)
// Implemented: fountain check, inventory selection, healing effects.
// TODO: unkn/otmp bookkeeping, BUC message path, potion identification, peffects dispatch
async function handleQuaff(player, map, display) {
    const bcsign = (obj) => (obj?.blessed ? 1 : (obj?.cursed ? -1 : 0));

    // cf. potion.c healup() — overflow healing can increase max HP (partial)
    // TODO: cure blindness, sickness, hallucination when appropriate
    const healup = (nhp, nxtra = 0) => {
        if (!Number.isFinite(nhp) || nhp <= 0) return;
        player.hp += nhp;
        if (player.hp > player.hpmax) {
            const extra = Math.max(0, Number(nxtra) || 0);
            player.hpmax += extra;
            player.hp = player.hpmax;
        }
    };

    // cf. potion.c dodrink():540-550 — check for fountain first
    const loc = map.at(player.x, player.y);
    if (loc && loc.typ === FOUNTAIN) {
        display.putstr_message('Drink from the fountain?');
        const ans = await nhgetch();
        display.topMessage = null;
        if (String.fromCharCode(ans) === 'y') {
            drinkfountain(player, map, display);
            return { moved: false, tookTime: true };
        }
    }

    // cf. potion.c dodrink() / drink_ok() — inventory selection (partial)
    const potions = player.inventory.filter(o => o.oclass === 7); // POTION_CLASS
    if (potions.length === 0) {
        display.putstr_message("You don't have anything to drink.");
        return { moved: false, tookTime: false };
    }

    display.putstr_message(`What do you want to drink? [${potions.map(p => p.invlet).join('')} or ?*]`);
    const ch = await nhgetch();
    const c = String.fromCharCode(ch);
    const replacePromptMessage = () => {
        if (typeof display.clearRow === 'function') display.clearRow(0);
        display.topMessage = null;
        display.messageNeedsMore = false;
    };

    if (ch === 27 || ch === 10 || ch === 13 || c === ' ') {
        replacePromptMessage();
        display.putstr_message('Never mind.');
        return { moved: false, tookTime: false };
    }

    // cf. potion.c drink_ok() — non-potion rejection (partial)
    const selected = player.inventory.find((obj) => obj.invlet === c);
    if (selected && selected.oclass !== 7) {
        replacePromptMessage();
        display.putstr_message('That is a silly thing to drink.');
        return { moved: false, tookTime: false };
    }

    const item = potions.find(p => p.invlet === c);
    if (item) {
        player.removeFromInventory(item);
        const potionName = String(item.name || '').toLowerCase();
        // Simple potion effects
        // cf. potion.c peffect_full_healing() (partial)
        if (potionName.includes('full healing')) {
            replacePromptMessage();
            healup(400, 4 + 4 * bcsign(item));
            exercise(player, A_CON, true);
            exercise(player, A_STR, true);
            display.putstr_message('You feel completely healed.');
        // cf. potion.c peffect_extra_healing() (partial)
        } else if (potionName.includes('extra healing')) {
            replacePromptMessage();
            const heal = 16 + c_d(4 + (2 * bcsign(item)), 8);
            const nxtra = item.blessed ? 5 : (!item.cursed ? 2 : 0);
            healup(heal, nxtra);
            exercise(player, A_CON, true);
            exercise(player, A_STR, true);
            display.putstr_message('You feel much better.');
        // cf. potion.c peffect_healing() (partial)
        } else if (potionName.includes('healing')) {
            replacePromptMessage();
            const heal = 8 + c_d(4 + (2 * bcsign(item)), 4);
            healup(heal, !item.cursed ? 1 : 0);
            exercise(player, A_CON, true);
            display.putstr_message('You feel better.');
        // cf. potion.c peffect_gain_level() — gain (or lose) an experience level
        // pluslvl(FALSE): increments u.ulevel; for blessed also sets u.uexp = rndexp(TRUE).
        // RNG note: newhp() is 0 for Archeologist below xlev; newpw()'s rn1() and rndexp()
        // appear in a different step's delta due to harness timing, so JS emits no RNG here.
        } else if (potionName.includes('gain level')) {
            replacePromptMessage();
            if (item.cursed) {
                if (player.level > 1) player.level -= 1;
                display.putstr_message('You feel less experienced.');
            } else {
                player.level += 1;
                display.putstr_message('You feel more experienced.');
            }
        } else {
            replacePromptMessage();
            display.putstr_message("Hmm, that tasted like water.");
        }
        return { moved: false, tookTime: true };
    }

    replacePromptMessage();
    display.putstr_message("Never mind.");
    return { moved: false, tookTime: false };
}

// ============================================================
// 4. Potion effects (peffect_*)
// ============================================================

// TODO: cf. potion.c peffect_restore_ability() — restore lost attributes
// TODO: cf. potion.c peffect_hallucination() — cause/cure hallucination
// TODO: cf. potion.c peffect_water() — holy/unholy water effects
// TODO: cf. potion.c peffect_booze() — confusion from booze
// TODO: cf. potion.c peffect_enlightenment() — show enlightenment info
// TODO: cf. potion.c peffect_invisibility() — grant invisibility
// TODO: cf. potion.c peffect_see_invisible() — grant see invisible
// TODO: cf. potion.c peffect_paralysis() — paralyze the hero
// TODO: cf. potion.c peffect_sleeping() — put hero to sleep
// TODO: cf. potion.c peffect_monster_detection() — detect monsters
// TODO: cf. potion.c peffect_object_detection() — detect objects
// TODO: cf. potion.c peffect_sickness() — cause sickness
// TODO: cf. potion.c peffect_confusion() — cause confusion
// TODO: cf. potion.c peffect_gain_ability() — increase an attribute
// TODO: cf. potion.c peffect_speed() — grant speed
// TODO: cf. potion.c peffect_blindness() — cause blindness
// TODO: cf. potion.c peffect_gain_level() — gain an experience level
// TODO: cf. potion.c peffect_healing() — heal HP (minor)
// TODO: cf. potion.c peffect_extra_healing() — heal HP (major)
// TODO: cf. potion.c peffect_full_healing() — heal HP (full)
// TODO: cf. potion.c peffect_levitation() — grant levitation
// TODO: cf. potion.c peffect_gain_energy() — restore/boost magical energy
// TODO: cf. potion.c peffect_oil() — oil lamp refuel / grease
// TODO: cf. potion.c peffect_acid() — acid damage
// TODO: cf. potion.c peffect_polymorph() — polymorph the hero

// ============================================================
// 5. Effect dispatcher
// ============================================================

// TODO: cf. potion.c peffects() — dispatch potion type to peffect_* handler

// ============================================================
// 6. Healing / support
// ============================================================

// TODO: cf. potion.c healup() — full healup with blindness/sickness cure
// TODO: cf. potion.c strange_feeling() — "strange feeling" for unIDed potions
// TODO: cf. potion.c bottlename() — return potion container name

// ============================================================
// 7. Dipping (water)
// ============================================================

// TODO: cf. potion.c H2Opotion_dip() — dip item into water (bless/curse/dilute)

// ============================================================
// 8. Throwing / projectile
// ============================================================

// TODO: cf. potion.c impact_arti_light() — artifact light on potion impact
// TODO: cf. potion.c potionhit() — potion hits a monster or hero

// ============================================================
// 9. Vapor / gas
// ============================================================

// TODO: cf. potion.c potionbreathe() — breathe potion vapors

// ============================================================
// 10. Mixing
// ============================================================

// TODO: cf. potion.c mixtype() — determine result of mixing two potions

// ============================================================
// 11. Dipping mechanics
// ============================================================

// TODO: cf. potion.c dip_ok() — validate dip target
// TODO: cf. potion.c dip_hands_ok() — check if hands are free for dipping
// TODO: cf. potion.c hold_potion() — handle holding the potion during dip
// TODO: cf. potion.c dodip() — dip command entry point
// TODO: cf. potion.c dip_into() — dip object into potion
// TODO: cf. potion.c poof() — potion disappears in a poof
// TODO: cf. potion.c dip_potion_explosion() — potion explodes on dip
// TODO: cf. potion.c potion_dip() — dip potion into another potion (mix)

// ============================================================
// 12. Djinni / split
// ============================================================

// TODO: cf. potion.c mongrantswish() — monster grants a wish
// TODO: cf. potion.c djinni_from_bottle() — release djinni from smoky potion
// TODO: cf. potion.c split_mon() — split a monster (eg. pudding)

// ============================================================
// 13. Speed
// ============================================================

// TODO: cf. potion.c speed_up() — increase hero movement speed


export { handleQuaff };
