// read.js -- Scroll reading mechanics
// cf. read.c — doread, seffects, scroll effects, genocide, punishment, recharging

import { rn2, rn1, rnd, d } from './rng.js';
import { nhgetch } from './input.js';
import {
    objectData, SCROLL_CLASS, SPBOOK_CLASS, WEAPON_CLASS, COIN_CLASS,
    SPE_BLANK_PAPER, SPE_NOVEL, SPE_BOOK_OF_THE_DEAD,
    SCR_ENCHANT_ARMOR, SCR_DESTROY_ARMOR, SCR_CONFUSE_MONSTER,
    SCR_SCARE_MONSTER, SCR_REMOVE_CURSE, SCR_ENCHANT_WEAPON,
    SCR_CREATE_MONSTER, SCR_TAMING, SCR_GENOCIDE, SCR_LIGHT,
    SCR_TELEPORTATION, SCR_GOLD_DETECTION, SCR_FOOD_DETECTION,
    SCR_IDENTIFY, SCR_CHARGING, SCR_MAGIC_MAPPING, SCR_AMNESIA,
    SCR_FIRE, SCR_EARTH, SCR_PUNISHMENT, SCR_STINKING_CLOUD,
    SCR_BLANK_PAPER,
} from './objects.js';
import { A_STR, A_INT, A_WIS, A_CON } from './config.js';
import { doname } from './mkobj.js';
import { exercise } from './attrib_exercise.js';
import { discoverObject, isObjectNameKnown } from './discovery.js';
import { make_confused, make_stunned } from './potion.js';
import { makemon, MM_EDOG, NO_MINVENT, MM_ADJACENTOK } from './makemon.js';
import { mons, PM_ACID_BLOB, PM_YELLOW_LIGHT, PM_BLACK_LIGHT, S_HUMAN } from './monsters.js';
import { resist } from './zap.js';

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
                    // cf. spell.c study_book() — show both messages on one line to match
                    // C TTY behavior where pline() + yn() appear together.
                    display.putstr_message(`You know "${spellName}" quite well already.  Refresh your memory anyway? [yn] (n)`);
                    const ans = await nhgetch();
                    if (String.fromCharCode(ans) !== 'y') {
                        return { moved: false, tookTime: false };
                    }
                    replacePromptMessage();
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
                // cf. read.c doread() — scroll reading
                const consumed = seffects(anyItem, player, display, game);
                if (consumed) {
                    // Scroll was used up inside seffects
                } else {
                    // Scroll still exists — use it up now
                    if (anyItem.quan > 1) {
                        anyItem.quan--;
                    } else {
                        player.removeFromInventory(anyItem);
                    }
                }
                return { moved: false, tookTime: true };
            }
            replacePromptMessage();
            display.putstr_message('That is a silly thing to read.');
            return { moved: false, tookTime: false };
        }
        // Keep waiting for a supported selection.
    }
}

// ============================================================
// 7. Scroll helper functions
// ============================================================

// cf. read.c useup_scroll() — consume a scroll
function useup_scroll(sobj, player) {
    if (sobj.quan > 1) {
        sobj.quan--;
    } else {
        player.removeFromInventory(sobj);
    }
}

// cf. read.c learnscrolltyp() — mark scroll type as discovered
function learnscrolltyp(otyp) {
    discoverObject(otyp, true, true);
}

// cf. read.c cap_spe() — cap enchantment at SPE_LIM (99)
function cap_spe(obj) {
    if (obj.spe > 99) obj.spe = 99;
    if (obj.spe < -99) obj.spe = -99;
}

// cf. C some_armor() — pick a random piece of worn armor
function some_armor(player) {
    const slots = [player.armor, player.cloak, player.shield, player.helmet,
                   player.gloves, player.boots, player.shirt];
    const worn = slots.filter(Boolean);
    if (!worn.length) return null;
    return worn[rn2(worn.length)];
}

// cf. C bcsign(obj)
function bcsign(obj) {
    return obj.cursed ? -1 : obj.blessed ? 1 : 0;
}

// cf. C blessorcurse(obj, chance) — randomly bless or curse an uncursed item
function blessorcurse(obj, chance) {
    if (obj.blessed || obj.cursed) return;
    if (!rn2(chance)) {
        if (!rn2(2)) {
            obj.cursed = true;
        } else {
            obj.blessed = true;
        }
    }
}

// cf. C uncurse(obj)
function uncurse(obj) {
    obj.cursed = false;
}


// ============================================================
// 8. Individual scroll effects
// ============================================================

// cf. read.c seffect_blank_paper()
function seffect_blank_paper(sobj, player, display) {
    if (player.blind) {
        display.putstr_message("You don't remember there being any magic words on this scroll.");
    } else {
        display.putstr_message('This scroll seems to be blank.');
    }
}

// cf. read.c seffect_identify()
function seffect_identify(sobj, player, display) {
    const already_known = isObjectNameKnown(sobj.otyp);
    const sblessed = sobj.blessed;
    const scursed = sobj.cursed;
    const confused = !!player.confused;

    // Scroll: use up first, then identify
    useup_scroll(sobj, player);

    if (confused || (scursed && !already_known)) {
        display.putstr_message('You identify this as an identify scroll.');
    } else if (!already_known) {
        display.putstr_message('This is an identify scroll.');
    }
    if (!already_known) {
        learnscrolltyp(SCR_IDENTIFY);
    }
    if (confused || (scursed && !already_known)) {
        return true; // consumed
    }

    // Identify items in inventory
    const inv = player.inventory || [];
    if (inv.length) {
        let cval = 1;
        if (sblessed || (!scursed && !rn2(5))) {
            cval = rn2(5);
            // cval==0 means identify ALL
            if (cval === 1 && sblessed && (player.luck || 0) > 0) {
                ++cval;
            }
        }
        // cf. identify_pack(cval) — identify cval items (0 = all)
        if (cval === 0) {
            // Identify everything
            for (const obj of inv) {
                obj.dknown = true;
                obj.bknown = true;
                obj.known = true;
                discoverObject(obj.otyp, true, true);
            }
        } else {
            // Identify cval items — in C this prompts, simplified: identify first N unknown
            let remaining = cval;
            for (const obj of inv) {
                if (remaining <= 0) break;
                if (!obj.dknown || !obj.bknown) {
                    obj.dknown = true;
                    obj.bknown = true;
                    obj.known = true;
                    discoverObject(obj.otyp, true, true);
                    remaining--;
                }
            }
        }
    } else {
        display.putstr_message("You're not carrying anything else to be identified.");
    }
    return true; // consumed (useup already called)
}

// cf. read.c seffect_charging()
function seffect_charging(sobj, player, display, game) {
    const sblessed = sobj.blessed;
    const scursed = sobj.cursed;
    const confused = !!player.confused;
    const already_known = isObjectNameKnown(sobj.otyp);

    if (confused) {
        if (scursed) {
            display.putstr_message('You feel discharged.');
            player.pw = 0;
        } else {
            display.putstr_message('You feel charged up!');
            player.pw += d(sblessed ? 6 : 4, 4);
            if (player.pw > player.pwmax) {
                player.pwmax = player.pw;
            } else {
                player.pw = player.pwmax;
            }
        }
        return false;
    }

    // Non-confused: identify, then prompt for item to charge
    if (!already_known) {
        display.putstr_message('This is a charging scroll.');
        learnscrolltyp(SCR_CHARGING);
    }
    // Use up scroll before prompting
    useup_scroll(sobj, player);

    // TODO: implement getobj + recharge for non-confused charging
    // For now, the scroll is consumed but no item is charged
    display.putstr_message('You feel as if something is missing.');
    return true; // consumed
}

// cf. read.c seffect_light()
function seffect_light(sobj, player, display, game) {
    const sblessed = sobj.blessed;
    const scursed = sobj.cursed;
    const confused = !!player.confused;
    const map = game?.map;

    if (!confused) {
        // cf. litroom(!scursed, sobj) — light or darken current room
        if (!player.blind) {
            if (!scursed) {
                display.putstr_message('A lit field surrounds you!');
            } else {
                display.putstr_message('Darkness surrounds you.');
            }
        }
        // TODO: implement litroom() for actual map lighting changes
        return false;
    }

    // Confused: create tame lights around player
    const pm = scursed ? PM_BLACK_LIGHT : PM_YELLOW_LIGHT;
    const numlights = rn1(2, 3) + (sblessed ? 2 : 0);
    let sawlights = false;
    const depth = player.dungeonLevel || 1;

    for (let i = 0; i < numlights; i++) {
        if (map) {
            const mon = makemon(mons[pm], player.x, player.y,
                                MM_EDOG | NO_MINVENT, depth, map);
            if (mon) {
                mon.msleeping = 0;
                mon.mcan = true; // cancelled — won't explode
                mon.tame = true;
                sawlights = true;
            }
        }
    }
    if (sawlights) {
        display.putstr_message('Lights appear all around you!');
    }
    return false;
}

// cf. read.c seffect_confuse_monster()
function seffect_confuse_monster(sobj, player, display) {
    const sblessed = sobj.blessed;
    const scursed = sobj.cursed;
    const confused = !!player.confused;
    const isHuman = (player.monsterType?.mlet === S_HUMAN) || !player.monsterType;

    if (!isHuman || scursed) {
        if (!player.confused) {
            display.putstr_message('You feel confused.');
        }
        make_confused(player, (player.getPropTimeout
            ? (player.getPropTimeout(13 /*CONFUSION*/) || 0) : 0) + rnd(100), false);
        return false;
    }

    if (confused) {
        if (!sblessed) {
            display.putstr_message('Your hands begin to glow purple.');
            make_confused(player, (player.getPropTimeout
                ? (player.getPropTimeout(13) || 0) : 0) + rnd(100), false);
        } else {
            display.putstr_message('A red glow surrounds your head.');
            make_confused(player, 0, true);
        }
    } else {
        // Touch-of-confusion effect
        let incr = 3; // scroll class incr
        if (!sblessed) {
            if (!(player.umconf || 0)) {
                display.putstr_message('Your hands begin to glow red.');
            } else {
                display.putstr_message('The red glow of your hands intensifies.');
            }
            incr += rnd(2);
        } else {
            display.putstr_message(
                `Your hands glow ${(player.umconf || 0) ? 'an even more' : 'a'} brilliant red.`);
            incr += rn1(8, 2);
        }
        if ((player.umconf || 0) >= 40) incr = 1;
        player.umconf = (player.umconf || 0) + incr;
    }
    return false;
}

// cf. read.c seffect_scare_monster()
function seffect_scare_monster(sobj, player, display, game) {
    const scursed = sobj.cursed;
    const confused = !!player.confused;
    const map = game?.map;
    const fov = game?.fov;
    let ct = 0;

    if (map) {
        for (const mtmp of (map.monsters || [])) {
            if (mtmp.dead || (mtmp.mhp != null && mtmp.mhp <= 0)) continue;
            // C: cansee(mtmp->mx, mtmp->my) — only affects visible monsters
            const canSee = fov?.canSee
                ? fov.canSee(mtmp.mx, mtmp.my)
                : true; // default visible if no fov
            if (!canSee) continue;

            if (confused || scursed) {
                mtmp.mflee = false;
                mtmp.mfrozen = 0;
                mtmp.msleeping = 0;
                mtmp.mcanmove = true;
            } else if (!resist(mtmp, SCROLL_CLASS)) {
                // cf. monflee(mtmp, 0, FALSE, FALSE)
                mtmp.mflee = true;
                mtmp.mfleetim = 0;
            }
            if (!mtmp.tame) ct++;
        }
    }

    if (confused || scursed) {
        display.putstr_message(
            `You hear sad wailing ${!ct ? 'in the distance' : 'close by'}.`);
    } else {
        display.putstr_message(
            `You hear maniacal laughter ${!ct ? 'in the distance' : 'close by'}.`);
    }
    return false;
}

// cf. read.c seffect_remove_curse()
function seffect_remove_curse(sobj, player, display) {
    const sblessed = sobj.blessed;
    const scursed = sobj.cursed;
    const confused = !!player.confused;

    if (!player.hallucinating) {
        display.putstr_message(
            !confused ? 'You feel like someone is helping you.'
                      : 'You feel like you need some help.');
    } else {
        display.putstr_message(
            !confused ? 'You feel in touch with the Universal Oneness.'
                      : 'You feel the power of the Force against you!');
    }

    if (scursed) {
        display.putstr_message('The scroll disintegrates.');
        return false;
    }

    // Iterate inventory and uncurse/blessorcurse items
    const inv = player.inventory || [];
    for (const obj of inv) {
        if (obj === sobj && (obj.quan || 1) === 1) continue; // skip self
        if (obj.oclass === COIN_CLASS) continue;

        // C: wornmask check — simplified: check if worn/wielded or blessed scroll
        const isWorn = (obj === player.weapon || obj === player.armor
            || obj === player.shield || obj === player.helmet
            || obj === player.gloves || obj === player.boots
            || obj === player.cloak || obj === player.shirt
            || obj === player.amulet || obj === player.leftRing
            || obj === player.rightRing);

        if (sblessed || isWorn) {
            if (confused) {
                blessorcurse(obj, 2);
                obj.bknown = false;
            } else if (obj.cursed) {
                uncurse(obj);
                if (obj.bknown) {
                    learnscrolltyp(SCR_REMOVE_CURSE);
                }
            }
        }
    }
    return false;
}

// cf. read.c seffect_enchant_weapon()
function seffect_enchant_weapon(sobj, player, display) {
    const sblessed = sobj.blessed;
    const scursed = sobj.cursed;
    const confused = !!player.confused;
    const uwep = player.weapon;

    // Confused + have weapon: erodeproofing/de-proofing
    if (confused && uwep) {
        const old_erodeproof = !!uwep.oerodeproof;
        const new_erodeproof = !scursed;
        uwep.oerodeproof = false; // for messages
        if (player.blind) {
            display.putstr_message('Your weapon feels warm for a moment.');
        } else {
            display.putstr_message(
                `${doname(uwep, player)} ${scursed ? 'is' : 'is'} covered by a ${scursed ? 'mottled purple' : 'shimmering golden'} ${scursed ? 'glow' : 'shield'}!`);
        }
        if (new_erodeproof && (uwep.oeroded || uwep.oeroded2)) {
            uwep.oeroded = 0;
            uwep.oeroded2 = 0;
            display.putstr_message(
                `${doname(uwep, player)} ${player.blind ? 'feels' : 'looks'} as good as new!`);
        }
        uwep.oerodeproof = new_erodeproof;
        return false;
    }

    // Non-confused: enchant/disenchant weapon
    // cf. chwepon(sobj, amount) — change weapon enchantment
    let amount;
    if (scursed) {
        amount = -1;
    } else if (!uwep) {
        amount = 1;
    } else if (uwep.spe >= 9) {
        amount = !rn2(uwep.spe) ? 1 : 0;
    } else if (sblessed) {
        amount = rnd(Math.max(1, 3 - Math.floor(uwep.spe / 3)));
    } else {
        amount = 1;
    }

    if (!uwep) {
        // No weapon wielded
        display.putstr_message("You feel a strange vibration.");
        return false;
    }

    if (amount === 0 && uwep.spe >= 9) {
        // Evaporate — weapon too highly enchanted
        display.putstr_message(`${doname(uwep, player)} violently glows then evaporates!`);
        // C: remove and destroy weapon — simplified
        player.weapon = null;
        player.removeFromInventory(uwep);
        return false;
    }

    uwep.spe += amount;
    cap_spe(uwep);

    if (amount > 0) {
        if (player.blind) {
            display.putstr_message('Your weapon feels warm for a moment.');
        } else {
            display.putstr_message(`${doname(uwep, player)} glows silver for a moment.`);
        }
    } else if (amount < 0) {
        if (player.blind) {
            display.putstr_message('Your weapon feels cold for a moment.');
        } else {
            display.putstr_message(`${doname(uwep, player)} glows black for a moment.`);
        }
        if (!uwep.cursed) {
            uwep.cursed = true;
        }
    }
    return false;
}

// cf. read.c seffect_enchant_armor()
function seffect_enchant_armor(sobj, player, display) {
    const sblessed = sobj.blessed;
    const scursed = sobj.cursed;
    const confused = !!player.confused;
    const otmp = some_armor(player);

    if (!otmp) {
        // No armor worn
        if (!player.blind) {
            display.putstr_message('Your skin glows then fades.');
        } else {
            display.putstr_message('Your skin feels warm for a moment.');
        }
        // cf. strange_feeling -> useup
        useup_scroll(sobj, player);
        exercise(player, A_CON, !scursed);
        exercise(player, A_STR, !scursed);
        return true; // consumed
    }

    if (confused) {
        // Erodeproofing
        const old_erodeproof = !!otmp.oerodeproof;
        const new_erodeproof = !scursed;
        otmp.oerodeproof = false;
        if (player.blind) {
            display.putstr_message(`${doname(otmp, player)} feels warm for a moment.`);
        } else {
            display.putstr_message(
                `${doname(otmp, player)} is covered by a ${scursed ? 'mottled black' : 'shimmering golden'} ${scursed ? 'glow' : 'shield'}!`);
        }
        if (new_erodeproof && (otmp.oeroded || otmp.oeroded2)) {
            otmp.oeroded = 0;
            otmp.oeroded2 = 0;
            display.putstr_message(
                `${doname(otmp, player)} ${player.blind ? 'feels' : 'looks'} as good as new!`);
        }
        otmp.oerodeproof = new_erodeproof;
        return false;
    }

    // cf. C seffect_enchant_armor normal path
    const od = objectData[otmp.otyp] || {};
    const special_armor = false; // simplified: no elven armor check
    let s = scursed ? -(otmp.spe || 0) : (otmp.spe || 0);

    // Evaporation check for high enchantment
    if (s > (special_armor ? 5 : 3) && rn2(s)) {
        display.putstr_message(
            `${doname(otmp, player)} violently ${player.blind ? 'vibrates' : 'glows'} for a while, then evaporates.`);
        // Remove worn armor
        const slots = ['armor', 'cloak', 'shield', 'helmet', 'gloves', 'boots', 'shirt'];
        for (const slot of slots) {
            if (player[slot] === otmp) player[slot] = null;
        }
        player.removeFromInventory(otmp);
        return false;
    }
    if (s < -100) s = -100;

    // Calculate enchantment power: (4 - s) / 2
    s = Math.floor((4 - s) / 2);
    if (special_armor) ++s;
    if (!od.magic) ++s;
    if (sblessed) ++s;

    if (s <= 0) {
        s = 0;
        if ((otmp.spe || 0) > 0 && !rn2(otmp.spe)) s = 1;
    } else {
        s = rnd(s);
    }
    if (s > 11) s = 11;

    if (scursed) s = -s;

    // Apply enchantment
    display.putstr_message(
        `${doname(otmp, player)} ${s === 0 ? 'violently ' : ''}${player.blind ? 'vibrates' : 'glows'}${(!player.blind) ? (scursed ? ' black' : ' silver') : ''} for a ${(s * s > 1) ? 'while' : 'moment'}.`);

    if (scursed && !otmp.cursed) {
        otmp.cursed = true;
    } else if (sblessed && !otmp.blessed) {
        otmp.blessed = true;
    } else if (!scursed && otmp.cursed) {
        uncurse(otmp);
    }

    if (s) {
        otmp.spe = (otmp.spe || 0) + s;
        cap_spe(otmp);
    }

    // Vibration warning
    if ((otmp.spe || 0) > (special_armor ? 5 : 3)
        && (special_armor || !rn2(7))) {
        display.putstr_message(
            `${doname(otmp, player)} suddenly vibrates ${player.blind ? 'again' : 'unexpectedly'}.`);
    }
    return false;
}

// cf. read.c seffect_destroy_armor()
function seffect_destroy_armor(sobj, player, display) {
    const scursed = sobj.cursed;
    const confused = !!player.confused;
    const otmp = some_armor(player);

    if (confused) {
        if (!otmp) {
            display.putstr_message('Your bones itch.');
            useup_scroll(sobj, player);
            exercise(player, A_STR, false);
            exercise(player, A_CON, false);
            return true; // consumed
        }
        // Confused: erodeproofing
        const new_erodeproof = !!scursed;
        display.putstr_message(`${doname(otmp, player)} glows purple for a moment.`);
        otmp.oerodeproof = new_erodeproof;
        return false;
    }

    if (!scursed || !otmp || !otmp.cursed) {
        // Destroy a piece of armor
        if (!otmp) {
            display.putstr_message('Your skin itches.');
            useup_scroll(sobj, player);
            exercise(player, A_STR, false);
            exercise(player, A_CON, false);
            return true; // consumed
        }
        // cf. destroy_arm(otmp)
        display.putstr_message(`${doname(otmp, player)} crumbles and turns to dust!`);
        const slots = ['armor', 'cloak', 'shield', 'helmet', 'gloves', 'boots', 'shirt'];
        for (const slot of slots) {
            if (player[slot] === otmp) player[slot] = null;
        }
        player.removeFromInventory(otmp);
    } else {
        // Both armor and scroll cursed: degrade
        display.putstr_message(`${doname(otmp, player)} vibrates.`);
        if ((otmp.spe || 0) >= -6) {
            otmp.spe = (otmp.spe || 0) - 1;
        }
        make_stunned(player,
            (player.getPropTimeout ? (player.getPropTimeout(14 /*STUNNED*/) || 0) : 0)
            + rn1(10, 10), true);
    }
    return false;
}

// cf. read.c seffect_create_monster()
function seffect_create_monster(sobj, player, display, game) {
    const sblessed = sobj.blessed;
    const scursed = sobj.cursed;
    const confused = !!player.confused;
    const map = game?.map;
    const depth = player.dungeonLevel || 1;

    // cf. create_critters(count, ptr, FALSE)
    const baseCount = 1 + ((confused || scursed) ? 12 : 0);
    const extraCount = (sblessed || rn2(73)) ? 0 : rnd(4);
    const count = baseCount + extraCount;
    const monType = confused ? mons[PM_ACID_BLOB] : null;

    let created = 0;
    if (map) {
        for (let i = 0; i < count; i++) {
            const mon = makemon(monType, player.x, player.y,
                                MM_ADJACENTOK, depth, map);
            if (mon) created++;
        }
    }
    if (!created) {
        display.putstr_message('You feel as if nothing combative is near.');
    }
    return false;
}

// cf. read.c seffect_teleportation()
function seffect_teleportation(sobj, player, display, game) {
    const scursed = sobj.cursed;
    const confused = !!player.confused;

    if (confused || scursed) {
        // cf. level_tele() — level teleport
        // TODO: implement level teleportation
        display.putstr_message('You feel very disoriented for a moment.');
    } else {
        // cf. scrolltele(sobj) — normal teleport
        // TODO: implement scrolltele
        display.putstr_message('You feel very disoriented for a moment.');
    }
    return false;
}

// cf. read.c seffect_gold_detection()
function seffect_gold_detection(sobj, player, display, game) {
    const scursed = sobj.cursed;
    const confused = !!player.confused;

    if (confused || scursed) {
        // cf. trap_detect(sobj) — detect traps
        // TODO: implement trap_detect
        display.putstr_message('You feel very greedy.');
    } else {
        // cf. gold_detect(sobj)
        // TODO: implement gold_detect
        display.putstr_message('You feel very greedy.');
    }
    return false;
}

// cf. read.c seffect_food_detection()
function seffect_food_detection(sobj, player, display, game) {
    // cf. food_detect(sobj)
    // TODO: implement food_detect
    display.putstr_message('You feel hungry.');
    return false;
}

// cf. read.c seffect_magic_mapping()
function seffect_magic_mapping(sobj, player, display, game) {
    const sblessed = sobj.blessed;
    const scursed = sobj.cursed;
    const confused = !!player.confused;

    // TODO: implement nommap level check

    if (sblessed) {
        // Blessed: also reveals secret doors (before do_mapping)
        // TODO: cvt_sdoor_to_door for all SDOOR tiles
    }

    display.putstr_message('A map coalesces in your mind!');
    const cval = scursed && !confused;
    if (cval) {
        // Temporarily confuse to screw up map
        // C: HConfusion = 1
    }
    // cf. do_mapping()
    // TODO: implement do_mapping to reveal level map
    if (cval) {
        display.putstr_message("Unfortunately, you can't grasp the details.");
    }
    return false;
}

// cf. read.c seffect_amnesia()
function seffect_amnesia(sobj, player, display) {
    const sblessed = sobj.blessed;

    // cf. forget(!sblessed ? ALL_SPELLS : 0)
    if (!sblessed) {
        // Forget all spells
        const spells = player.spells || [];
        for (const spell of spells) {
            spell.sp_know = 0;
        }
    }

    if (player.hallucinating) {
        display.putstr_message('Your mind releases itself from mundane concerns.');
    } else if (rn2(2)) {
        display.putstr_message('Who was that Maud person anyway?');
    } else {
        display.putstr_message('Thinking of Maud you forget everything else.');
    }
    exercise(player, A_WIS, false);
    return false;
}

// cf. read.c seffect_taming()
function seffect_taming(sobj, player, display, game) {
    const confused = !!player.confused;
    const map = game?.map;
    const bd = confused ? 5 : 1;
    let candidates = 0, results = 0;

    if (map) {
        for (const mtmp of (map.monsters || [])) {
            if (mtmp.dead || (mtmp.mhp != null && mtmp.mhp <= 0)) continue;
            const dx = Math.abs(mtmp.mx - player.x);
            const dy = Math.abs(mtmp.my - player.y);
            if (dx <= bd && dy <= bd) {
                candidates++;
                // cf. maybe_tame(mtmp, sobj)
                // Simplified: tame if not resistant
                if (!mtmp.tame) {
                    mtmp.tame = true;
                    mtmp.mpeaceful = true;
                    results++;
                }
            }
        }
    }
    if (!results) {
        display.putstr_message(
            `Nothing interesting ${!candidates ? 'happens' : 'seems to happen'}.`);
    } else {
        display.putstr_message(`The neighborhood is ${results > 0 ? '' : 'un'}friendlier.`);
    }
    return false;
}

// cf. read.c seffect_genocide()
function seffect_genocide(sobj, player, display) {
    const sblessed = sobj.blessed;
    const scursed = sobj.cursed;
    const already_known = isObjectNameKnown(sobj.otyp);

    if (!already_known) {
        display.putstr_message('You have found a scroll of genocide!');
    }
    // TODO: implement do_genocide / do_class_genocide prompts
    display.putstr_message('A sad feeling comes over you.');
    return false;
}

// cf. read.c seffect_fire()
function seffect_fire(sobj, player, display, game) {
    const sblessed = sobj.blessed;
    const confused = !!player.confused;
    const already_known = isObjectNameKnown(sobj.otyp);
    const cval = bcsign(sobj);
    const dam = Math.floor((2 * (rn1(3, 3) + 2 * cval) + 1) / 3);

    // Use up scroll first
    useup_scroll(sobj, player);

    if (!already_known) {
        learnscrolltyp(SCR_FIRE);
    }

    if (confused) {
        // Confused: minor self-burn
        display.putstr_message('The scroll catches fire and you burn your hands.');
        // cf. losehp(1, ...) simplified: take 1 damage
        player.hp = Math.max(0, (player.hp || 0) - 1);
        return true; // consumed
    }

    // Non-confused: explosion
    if (sblessed) {
        // TODO: blessed lets you aim the explosion
        display.putstr_message('The scroll erupts in a tower of flame!');
    } else {
        display.putstr_message('The scroll erupts in a tower of flame!');
    }
    // TODO: explode(x, y, ZT_SPELL_O_FIRE, dam, SCROLL_CLASS, EXPL_FIERY)
    // Simplified: take damage
    player.hp = Math.max(0, (player.hp || 0) - dam);
    return true; // consumed
}

// cf. read.c seffect_earth()
function seffect_earth(sobj, player, display, game) {
    const sblessed = sobj.blessed;
    const scursed = sobj.cursed;
    const confused = !!player.confused;

    // cf. C: check has_ceiling, not rogue level, not endgame
    display.putstr_message(
        `The ${sblessed ? 'ceiling rumbles around' : 'ceiling rumbles above'} you!`);

    // TODO: implement boulder dropping (drop_boulder_on_monster, drop_boulder_on_player)
    // Simplified: take some damage for non-blessed
    if (!sblessed) {
        const dam = rnd(20);
        player.hp = Math.max(0, (player.hp || 0) - dam);
        display.putstr_message(`You are hit by a boulder!`);
    }
    return false;
}

// cf. read.c seffect_punishment()
function seffect_punishment(sobj, player, display) {
    const sblessed = sobj.blessed;
    const confused = !!player.confused;

    if (confused || sblessed) {
        display.putstr_message('You feel guilty.');
        return false;
    }
    // cf. punish(sobj) — apply iron ball + chain
    // TODO: implement punish() for full ball-and-chain mechanics
    display.putstr_message('You are being punished for your misbehavior!');
    return false;
}

// cf. read.c seffect_stinking_cloud()
function seffect_stinking_cloud(sobj, player, display) {
    const already_known = isObjectNameKnown(sobj.otyp);

    if (!already_known) {
        display.putstr_message('You have found a scroll of stinking cloud!');
    }
    // cf. do_stinking_cloud(sobj, already_known)
    // TODO: implement stinking cloud positioning and creation
    display.putstr_message('A noxious cloud billows from the scroll.');
    return false;
}


// ============================================================
// 9. Effect dispatcher
// ============================================================

// cf. read.c seffects() — dispatch scroll effects by scroll type
// Returns true if scroll was consumed (useup'd) inside the handler
function seffects(sobj, player, display, game) {
    const otyp = sobj.otyp;
    const od = objectData[otyp] || {};

    // cf. read.c:2147 — exercise wisdom for reading any magical scroll
    if (od.magic) {
        exercise(player, A_WIS, true);
    }

    switch (otyp) {
    case SCR_ENCHANT_ARMOR:
        return seffect_enchant_armor(sobj, player, display);
    case SCR_DESTROY_ARMOR:
        return seffect_destroy_armor(sobj, player, display);
    case SCR_CONFUSE_MONSTER:
        return seffect_confuse_monster(sobj, player, display);
    case SCR_SCARE_MONSTER:
        return seffect_scare_monster(sobj, player, display, game);
    case SCR_BLANK_PAPER:
        return seffect_blank_paper(sobj, player, display);
    case SCR_REMOVE_CURSE:
        return seffect_remove_curse(sobj, player, display);
    case SCR_CREATE_MONSTER:
        return seffect_create_monster(sobj, player, display, game);
    case SCR_ENCHANT_WEAPON:
        return seffect_enchant_weapon(sobj, player, display);
    case SCR_TAMING:
        return seffect_taming(sobj, player, display, game);
    case SCR_GENOCIDE:
        return seffect_genocide(sobj, player, display);
    case SCR_LIGHT:
        return seffect_light(sobj, player, display, game);
    case SCR_TELEPORTATION:
        return seffect_teleportation(sobj, player, display, game);
    case SCR_GOLD_DETECTION:
        return seffect_gold_detection(sobj, player, display, game);
    case SCR_FOOD_DETECTION:
        return seffect_food_detection(sobj, player, display, game);
    case SCR_IDENTIFY:
        return seffect_identify(sobj, player, display);
    case SCR_CHARGING:
        return seffect_charging(sobj, player, display, game);
    case SCR_MAGIC_MAPPING:
        return seffect_magic_mapping(sobj, player, display, game);
    case SCR_AMNESIA:
        return seffect_amnesia(sobj, player, display);
    case SCR_FIRE:
        return seffect_fire(sobj, player, display, game);
    case SCR_EARTH:
        return seffect_earth(sobj, player, display, game);
    case SCR_PUNISHMENT:
        return seffect_punishment(sobj, player, display);
    case SCR_STINKING_CLOUD:
        return seffect_stinking_cloud(sobj, player, display);
    default:
        display.putstr_message(`What weird effect is this? (${otyp})`);
        return false;
    }
}

export { handleRead };
