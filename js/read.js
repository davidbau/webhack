// read.js -- Scroll reading mechanics
// cf. read.c — doread, seffects, scroll effects, genocide, punishment, recharging

import { rn2, rn1, rnd } from './rng.js';
import { nhgetch } from './input.js';
import { objectData, SCROLL_CLASS, SPBOOK_CLASS, SPE_BLANK_PAPER, SPE_NOVEL, SPE_BOOK_OF_THE_DEAD } from './objects.js';
import { A_INT, A_WIS } from './config.js';
import { doname } from './mkobj.js';

const SPELL_KEEN = 20000; // cf. spell.c KEEN
const MAX_SPELL_STUDY = 3; // cf. spell.h MAX_SPELL_STUDY


// ============================================================
// 1. Scroll learning
// ============================================================

// TODO: cf. read.c learnscrolltyp() — learn scroll type after reading
// TODO: cf. read.c learnscroll() — wrapper for scroll type learning

// ============================================================
// 2. Enchantment helpers
// ============================================================

// TODO: cf. read.c cap_spe() — cap enchantment at +127
// TODO: cf. read.c stripspe() — strip enchantment from charged item

// ============================================================
// 3. Read validation
// ============================================================

// TODO: cf. read.c read_ok() — validate object is readable

// ============================================================
// 4. Glow messages
// ============================================================

// TODO: cf. read.c p_glow1() — "Your <item> glows <color>" message
// TODO: cf. read.c p_glow2() — "Your <item> glows <color> for a moment" message
// TODO: cf. read.c p_glow3() — "Your <item> briefly glows <color>" (alternate wording)

// ============================================================
// 5. Text display
// ============================================================

// TODO: cf. read.c erode_obj_text() — check if engraved/written text is eroded
// TODO: cf. read.c tshirt_text() — random T-shirt text messages
// TODO: cf. read.c hawaiian_motif() — random Hawaiian shirt motif
// TODO: cf. read.c hawaiian_design() — random Hawaiian shirt design
// TODO: cf. read.c apron_text() — random apron text messages
// TODO: cf. read.c candy_wrapper_text() — candy bar wrapper text
// TODO: cf. read.c assign_candy_wrapper() — assign wrapper text to candy bar

// ============================================================
// 6. Main entry
// ============================================================

// TODO: cf. read.c doread() — main read command entry point (full implementation)

// cf. read.c doread() — read a scroll or spellbook (partial)
// Implemented: inventory selection, spellbook study (cf. spell.c study_book).
// TODO: read_ok validation, scroll identification, seffects dispatch
async function handleRead(player, display, game) {
    const readableClasses = new Set([SCROLL_CLASS, SPBOOK_CLASS]);
    const readable = (player.inventory || []).filter((o) => o && readableClasses.has(o.oclass));
    const letters = readable.map((o) => o.invlet).join('');
    const prompt = letters
        ? `What do you want to read? [${letters} or ?*]`
        : 'What do you want to read? [*]';

    // Keep prompt active until explicit cancel, matching tty flow.
    const replacePromptMessage = () => {
        if (typeof display.clearRow === 'function') display.clearRow(0);
        display.topMessage = null;
        display.messageNeedsMore = false;
    };
    const isDismissKey = (code) => code === 27 || code === 10 || code === 13 || code === 32;
    const showReadableHelpList = async () => {
        if (!readable.length) return;
        for (const item of readable) {
            const entry = `${item.invlet} - ${doname(item, player)}.--More--`;
            while (true) {
                replacePromptMessage();
                display.putstr_message(entry);
                const ack = await nhgetch();
                if (isDismissKey(ack)) break;
            }
        }
    };
    while (true) {
        display.putstr_message(prompt);
        const ch = await nhgetch();
        const c = String.fromCharCode(ch);
        if (isDismissKey(ch)) {
            replacePromptMessage();
            display.putstr_message('Never mind.');
            return { moved: false, tookTime: false };
        }
        if (c === '?' || c === '*') {
            // C tty keeps read prompt pending while '?/*' item-list help is
            // acknowledged with modal --More-- screens.
            await showReadableHelpList();
            continue;
        }
        const anyItem = (player.inventory || []).find((o) => o && o.invlet === c);
        if (anyItem) {
            if (anyItem.oclass === SPBOOK_CLASS) {
                replacePromptMessage();
                // cf. spell.c study_book() (partial)
                const od = objectData[anyItem.otyp] || {};
                // cf. read.c doread() — blank paper check
                if (anyItem.otyp === SPE_BLANK_PAPER) {
                    display.putstr_message('This spellbook is all blank.');
                    return { moved: false, tookTime: true };
                }
                // cf. read.c doread() — novel check (not implemented further)
                if (anyItem.otyp === SPE_NOVEL) {
                    display.putstr_message('You read the novel for a while.');
                    return { moved: false, tookTime: true };
                }
                // cf. spell.c study_book():537-558 — calculate study delay
                const ocLevel = od.oc2 || 1;
                const ocDelay = od.delay || 1;
                let delayTurns;
                if (ocLevel <= 2) delayTurns = ocDelay;
                else if (ocLevel <= 4) delayTurns = (ocLevel - 1) * ocDelay;
                else if (ocLevel <= 6) delayTurns = ocLevel * ocDelay;
                else delayTurns = 8 * ocDelay; // level 7

                // cf. spell.c study_book():561-572 — check if spell already known and well-retained
                const spells = player.spells || (player.spells = []);
                const knownEntry = spells.find(s => s.otyp === anyItem.otyp);
                if (knownEntry && knownEntry.sp_know > SPELL_KEEN / 10) {
                    const spellName = String(od.name || 'this spell').toLowerCase();
                    display.putstr_message(`You know "${spellName}" quite well already.`);
                    display.putstr_message('Refresh your memory anyway? [yn] (n)');
                    const ans = await nhgetch();
                    replacePromptMessage();
                    if (String.fromCharCode(ans) !== 'y') {
                        return { moved: false, tookTime: false };
                    }
                }

                // cf. spell.c study_book():577-602 — difficulty check (uncursed, non-BOTD books)
                if (!anyItem.blessed && anyItem.otyp !== SPE_BOOK_OF_THE_DEAD) {
                    if (anyItem.cursed) {
                        // Cursed: too hard (C: cursed_book() + nomul for delay)
                        display.putstr_message("This book is beyond your comprehension.");
                        return { moved: false, tookTime: true };
                    }
                    // Uncursed: roll difficulty
                    const intel = (player.attributes ? player.attributes[A_INT] : 12) || 12;
                    const readAbility = intel + 4 + Math.floor((player.level || 1) / 2) - 2 * ocLevel;
                    if (rnd(20) > readAbility) {
                        display.putstr_message("You can't make heads or tails of this.");
                        return { moved: false, tookTime: true };
                    }
                }

                // cf. spell.c study_book() — start studying
                display.putstr_message('You begin to memorize the runes.');
                const bookRef = anyItem;
                const bookOd = od;
                const bookOcLevel = ocLevel;
                game.occupation = {
                    occtxt: 'studying',
                    delayLeft: delayTurns,
                    fn(g) {
                        if (this.delayLeft > 0) {
                            this.delayLeft--;
                            return true; // still studying
                        }
                        // cf. spell.c learn() — study complete
                        // exercise(A_WIS, TRUE) — no RNG
                        const spellsArr = g.player.spells || (g.player.spells = []);
                        const ent = spellsArr.find(s => s.otyp === bookRef.otyp);
                        const spellName = String(bookOd.name || 'unknown spell').toLowerCase();
                        const studyCount = bookRef.spestudied || 0;
                        if (ent) {
                            // Already known — refresh
                            if (studyCount >= MAX_SPELL_STUDY) {
                                g.display.putstr_message('This spellbook is too faint to be read any more.');
                                bookRef.otyp = SPE_BLANK_PAPER;
                            } else {
                                g.display.putstr_message(
                                    `Your knowledge of "${spellName}" is ${ent.sp_know ? 'keener' : 'restored'}.`);
                                ent.sp_know = SPELL_KEEN + 1; // incrnknow(i, 1)
                                bookRef.spestudied = studyCount + 1;
                            }
                        } else {
                            // New spell
                            if (studyCount >= MAX_SPELL_STUDY) {
                                g.display.putstr_message('This spellbook is too faint to read even once.');
                                bookRef.otyp = SPE_BLANK_PAPER;
                            } else {
                                const spellIdx = spellsArr.length;
                                spellsArr.push({ otyp: bookRef.otyp, sp_lev: bookOcLevel, sp_know: SPELL_KEEN + 1 });
                                bookRef.spestudied = studyCount + 1;
                                if (spellIdx === 0) {
                                    g.display.putstr_message(`You learn "${spellName}".`);
                                } else {
                                    const spellet = spellIdx < 26
                                        ? String.fromCharCode('a'.charCodeAt(0) + spellIdx)
                                        : String.fromCharCode('A'.charCodeAt(0) + spellIdx - 26);
                                    g.display.putstr_message(
                                        `You add "${spellName}" to your repertoire, as '${spellet}'.`);
                                }
                            }
                        }
                        return false; // occupation done
                    },
                };
                return { moved: false, tookTime: true };
            }
            if (anyItem.oclass === SCROLL_CLASS) {
                replacePromptMessage();
                // cf. read.c seffects() — scroll effect dispatch (not yet implemented)
                display.putstr_message("Sorry, I don't know how to read that yet.");
                return { moved: false, tookTime: false };
            }
            replacePromptMessage();
            display.putstr_message('That is a silly thing to read.');
            return { moved: false, tookTime: false };
        }
        // Keep waiting for a supported selection.
    }
}

// ============================================================
// 7. Scroll effects (22)
// ============================================================

// TODO: cf. read.c seffect_enchant_armor() — enchant armor scroll effect
// TODO: cf. read.c seffect_destroy_armor() — destroy armor scroll effect
// TODO: cf. read.c seffect_confuse_monster() — confuse monster scroll effect
// TODO: cf. read.c seffect_scare_monster() — scare monster scroll effect
// TODO: cf. read.c seffect_remove_curse() — remove curse scroll effect
// TODO: cf. read.c seffect_create_monster() — create monster scroll effect
// TODO: cf. read.c seffect_enchant_weapon() — enchant weapon scroll effect
// TODO: cf. read.c seffect_taming() — taming scroll effect
// TODO: cf. read.c seffect_genocide() — genocide scroll effect
// TODO: cf. read.c seffect_light() — light scroll effect
// TODO: cf. read.c seffect_charging() — charging scroll effect
// TODO: cf. read.c seffect_amnesia() — amnesia scroll effect
// TODO: cf. read.c seffect_fire() — fire scroll effect
// TODO: cf. read.c seffect_earth() — earth scroll effect
// TODO: cf. read.c seffect_punishment() — punishment scroll effect
// TODO: cf. read.c seffect_stinking_cloud() — stinking cloud scroll effect
// TODO: cf. read.c seffect_blank_paper() — blank paper scroll effect
// TODO: cf. read.c seffect_teleportation() — teleportation scroll effect
// TODO: cf. read.c seffect_gold_detection() — gold detection scroll effect
// TODO: cf. read.c seffect_food_detection() — food detection scroll effect
// TODO: cf. read.c seffect_identify() — identify scroll effect
// TODO: cf. read.c seffect_magic_mapping() — magic mapping scroll effect

// ============================================================
// 8. Effect dispatcher
// ============================================================

// TODO: cf. read.c seffects() — dispatch scroll effects by scroll type

// ============================================================
// 9. Amnesia
// ============================================================

// TODO: cf. read.c forget() — cause amnesia (forget spells, map, etc.)

// ============================================================
// 10. Taming
// ============================================================

// TODO: cf. read.c maybe_tame() — attempt to tame a monster

// ============================================================
// 11. Stinking cloud
// ============================================================

// TODO: cf. read.c valid_cloud_pos() — check if position is valid for stinking cloud
// TODO: cf. read.c can_center_cloud() — check if hero can center a cloud at position
// TODO: cf. read.c display_stinking_cloud_positions() — show valid cloud positions
// TODO: cf. read.c do_stinking_cloud() — create stinking cloud at position

// ============================================================
// 12. Boulders
// ============================================================

// TODO: cf. read.c drop_boulder_on_player() — drop boulder on hero (scroll of earth)
// TODO: cf. read.c drop_boulder_on_monster() — drop boulder on monster (scroll of earth)

// ============================================================
// 13. Wand recharging
// ============================================================

// TODO: cf. read.c charge_ok() — check if object can be recharged
// TODO: cf. read.c recharge() — recharge a wand or tool
// TODO: cf. read.c wand_explode() — explode an overcharged wand

// ============================================================
// 14. Lighting
// ============================================================

// TODO: cf. read.c set_lit() — set room lit/unlit state
// TODO: cf. read.c litroom() — light/darken the current room

// ============================================================
// 15. Genocide
// ============================================================

// TODO: cf. read.c do_class_genocide() — genocide an entire monster class
// TODO: cf. read.c do_genocide() — genocide a specific monster type

// ============================================================
// 16. Punishment
// ============================================================

// TODO: cf. read.c punish() — apply punishment (iron ball + chain)
// TODO: cf. read.c unpunish() — remove punishment

// ============================================================
// 17. Monster creation
// ============================================================

// TODO: cf. read.c cant_revive() — check if monster type cannot be revived
// TODO: cf. read.c create_particular_parse() — parse monster name for create_particular
// TODO: cf. read.c create_particular_creation() — create specific monster from parsed input
// TODO: cf. read.c create_particular() — create a particular monster (blessed scroll of create monster)

export { handleRead };
