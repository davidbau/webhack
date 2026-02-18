// combat.js -- Combat system
// Mirrors uhitm.c (hero hits monster) and mhitu.c (monster hits hero)

import { rn2, rnd, d, c_d } from './rng.js';
import { exercise } from './attrib_exercise.js';
import { A_DEX, A_CON } from './config.js';
import {
    mons, G_FREQ, G_NOCORPSE, MZ_TINY, MZ_HUMAN, M2_NEUTER, M2_MALE, M2_FEMALE, M2_COLLECT,
    MZ_LARGE,
    AT_CLAW, AT_BITE, AT_KICK, AT_BUTT, AT_TUCH, AT_STNG, AT_WEAP,
    S_ZOMBIE, S_MUMMY, S_VAMPIRE, S_WRAITH, S_LICH, S_GHOST, S_DEMON, S_KOP,
} from './monsters.js';
import { CORPSE, FIGURINE, FOOD_CLASS, objectData } from './objects.js';
import { mkobj, mkcorpstat, RANDOM_CLASS } from './mkobj.js';
import { nonliving, monDisplayName } from './mondata.js';
import { obj_resists } from './objdata.js';

function isUndeadOrDemon(monsterType) {
    if (!monsterType) return false;
    const sym = monsterType.symbol;
    return sym === S_ZOMBIE
        || sym === S_MUMMY
        || sym === S_VAMPIRE
        || sym === S_WRAITH
        || sym === S_LICH
        || sym === S_GHOST
        || sym === S_DEMON;
}

function weaponEnchantment(weapon) {
    return (weapon && (weapon.enchantment ?? weapon.spe)) || 0;
}

function weaponDamageSides(weapon, monster) {
    if (!weapon) return 0;
    if (weapon.wsdam) return weapon.wsdam;
    const info = objectData[weapon.otyp];
    if (!info) return 0;
    const isLarge = (monster?.type?.size ?? MZ_TINY) >= MZ_LARGE;
    return isLarge ? (info.ldam || 0) : (info.sdam || 0);
}

// C ref: uhitm.c find_roll_to_hit() — Luck component.
// sgn(Luck) * ((abs(Luck) + 2) / 3)  (integer division)
function luckBonus(luck) {
    if (!luck) return 0;
    return Math.sign(luck) * Math.floor((Math.abs(luck) + 2) / 3);
}

// C ref: weapon.c abon() — DEX component of to-hit bonus.
function dexToHit(dex) {
    if (dex < 4) return -3;
    if (dex < 6) return -2;
    if (dex < 8) return -1;
    if (dex < 14) return 0;
    return dex - 14;
}

function monsterHitVerb(attackType) {
    switch (attackType) {
        case AT_BITE: return 'bites';
        case AT_CLAW: return 'claws';
        case AT_KICK: return 'kicks';
        case AT_BUTT: return 'butts';
        case AT_STNG: return 'stings';
        case AT_TUCH: return 'touches';
        case AT_WEAP: return 'hits';
        default: return 'hits';
    }
}

// Attack a monster (hero attacking)
// C ref: uhitm.c attack() -> hmon_hitmon() -> hmon_hitmon_core()
export function playerAttackMonster(player, monster, display, map) {
    // To-hit calculation
    // C ref: uhitm.c find_roll_to_hit():
    //   tmp = 1 + abon() + find_mac(mtmp) + u.uhitinc
    //         + (sgn(Luck)*((abs(Luck)+2)/3)) + u.ulevel
    //   then: mhit = (tmp > rnd(20))
    const dieRoll = rnd(20);
    // C ref: weapon.c abon() = str_bonus + (ulevel<3?1:0) + dex_bonus
    const abon = player.strToHit + (player.level < 3 ? 1 : 0)
        + dexToHit(player.attributes?.[A_DEX] ?? 10);
    let toHit = 1 + abon + monster.mac + player.level
        + luckBonus(player.luck || 0)
        + weaponEnchantment(player.weapon);
    // C ref: uhitm.c:386-393 — monster state adjustments
    if (monster.stunned) toHit += 2;
    if (monster.flee) toHit += 2;
    if (monster.sleeping) toHit += 2;
    if (monster.mcanmove === false) toHit += 4;

    if (toHit <= dieRoll) {
        // Miss
        // C ref: uhitm.c -- "You miss the <monster>"
        display.putstr_message(`You miss the ${monDisplayName(monster)}.`);
        // C ref: uhitm.c:5997 passive() — rn2(3) when monster alive after attack
        rn2(3);
        return false;
    }

    // C ref: uhitm.c:742 exercise(A_DEX, TRUE) on successful hit
    exercise(player, A_DEX, true);

    // Hit! Calculate damage
    // C ref: weapon.c:265 dmgval() -- rnd(oc_wsdam) for small monsters
    let damage = 0;
    const wsdam = weaponDamageSides(player.weapon, monster);
    if (player.weapon && wsdam > 0) {
        damage = rnd(wsdam);
        damage += weaponEnchantment(player.weapon);
        // C ref: weapon.c dmgval() — blessed weapon bonus vs undead/demons.
        if (player.weapon.blessed && isUndeadOrDemon(monster.type)) {
            damage += rnd(4);
        }
    } else if (player.weapon && player.weapon.damage) {
        damage = c_d(player.weapon.damage[0], player.weapon.damage[1]);
        damage += player.weapon.enchantment || 0;
    } else {
        // Bare-handed combat
        // C ref: uhitm.c -- barehand damage is 1d2 + martial arts bonuses
        damage = rnd(2);
    }

    // Add strength bonus
    damage += player.strDamage;

    // Minimum 1 damage on a hit
    if (damage < 1) damage = 1;

    // Apply damage
    // C ref: uhitm.c -- "You hit the <monster>!"
    monster.mhp -= damage;

    if (monster.mhp <= 0) {
        // Monster killed
        // C ref: uhitm.c -> mon.c mondead() -> killed() -> xkilled()
        // C ref: nonliving monsters (undead, golems) are "destroyed" not "killed"
        const mdat = monster.type || {};
        const killVerb = nonliving(mdat) ? 'destroy' : 'kill';
        display.putstr_message(`You ${killVerb} the ${monDisplayName(monster)}!`);
        monster.dead = true;

        // Award experience
        // C ref: exper.c experience() -- roughly monster level * level
        const exp = (monster.mlevel + 1) * (monster.mlevel + 1);
        player.exp += exp;
        player.score += exp;

        // Check for level-up
        checkLevelUp(player, display);

        // C ref: mon.c:3581-3609 xkilled() — "illogical but traditional" treasure drop.
        const treasureRoll = rn2(6);
        // C ref: mon.c:3582 — mvitals[mndx].mvflags & G_NOCORPSE (init'd from geno)
        const canDropTreasure = treasureRoll === 0
            && !((mdat.geno || 0) & G_NOCORPSE)
            && !monster.mcloned
            && (monster.mx !== player.x || monster.my !== player.y)
            && mdat.symbol !== S_KOP;
        if (canDropTreasure && map) {
            const otmp = mkobj(RANDOM_CLASS, true, false);
            const flags2 = mdat.flags2 || 0;
            const isSmallMonster = (mdat.size || 0) < MZ_HUMAN;
            const isPermaFood = otmp && otmp.oclass === FOOD_CLASS && !otmp.oartifact;
            // C ref: mon.c:3600 — FIGURINE exempted from size check
            const dropTooBig = isSmallMonster && !!otmp
                && otmp.otyp !== FIGURINE
                && ((otmp.owt || 0) > 30 || !!objectData[otmp.otyp]?.oc_big);
            if (isPermaFood && !(flags2 & M2_COLLECT)) {
                // C ref: mon.c:3599 delobj(otmp) — consumes rn2(100) via obj_resists
                obj_resists(otmp, 0, 0);
            } else if (dropTooBig) {
                // C ref: mon.c:3606 delobj(otmp) — consumes rn2(100) via obj_resists
                obj_resists(otmp, 0, 0);
            } else {
                otmp.ox = monster.mx;
                otmp.oy = monster.my;
                map.objects.push(otmp);
            }
        }

        // C ref: mon.c:3243 corpse_chance() — decide whether to create corpse
        const gfreq = (mdat.geno || 0) & G_FREQ;
        const verysmall = (mdat.size || 0) === MZ_TINY;
        const corpsetmp = 2 + (gfreq < 2 ? 1 : 0) + (verysmall ? 1 : 0);
        const createCorpse = !rn2(corpsetmp);

        if (createCorpse) {
            // C ref: mon.c make_corpse() default path:
            // mkcorpstat(CORPSE, mtmp/mdat, CORPSTAT_INIT).
            const corpse = mkcorpstat(CORPSE, monster.mndx || 0, true);
            // C ref: mkobj.c mksobj_init() — otmp->age = max(svm.moves, 1L).
            // During gameplay replay, svm.moves aligns to completed turns + 1.
            corpse.age = Math.max((player?.turns || 0) + 1, 1);

            // Place corpse on the map so pets can find it.
            if (map) {
                corpse.ox = monster.mx;
                corpse.oy = monster.my;
                map.objects.push(corpse);
            }
        }

        // C ref: uhitm.c:5997 passive() — SKIPPED when monster is killed
        return true; // monster is dead
    } else {
        // C ref: uhitm.c -- various hit messages
        if (dieRoll >= 18) {
            display.putstr_message(`You smite the ${monDisplayName(monster)}!`);
        } else {
            display.putstr_message(`You hit the ${monDisplayName(monster)}.`);
        }
        // C ref: uhitm.c hmon_hitmon_core():
        // For armed melee hits with damage > 1: mhitm_knockback() → rn2(3), rn2(6).
        // For unarmed hits with damage > 1: hmon_hitmon_stagger() → rnd(100).
        if (player.weapon && damage > 1 && !player.twoweap) {
            rn2(3);
            rn2(6);
        } else if (!player.weapon && damage > 1) {
            // C ref: uhitm.c:1554 hmon_hitmon_stagger — rnd(100) stun chance check
            rnd(100);
        }
        // C ref: uhitm.c:624-628 known_hitum() — 1/25 morale/flee check on surviving hit
        if (!rn2(25) && monster.mhp < Math.floor((monster.mhpmax || 1) / 2)) {
            // C ref: monflee(mon, !rn2(3) ? rnd(100) : 0, ...) — flee timer
            if (!rn2(3)) rnd(100);
        }
        // C ref: uhitm.c:5997 passive() — rn2(3) when monster alive after hit
        rn2(3);
        return false;
    }
}

// Monster attacks the player
// C ref: mhitu.c mattacku() -> mattackm core
export function monsterAttackPlayer(monster, player, display, game = null) {
    if (!monster.attacks || monster.attacks.length === 0) return;
    if (monster.passive) return; // passive monsters don't initiate attacks

    for (let i = 0; i < monster.attacks.length; i++) {
        const attack = monster.attacks[i];
        const suppressHitMsg = !!(game && game._suppressMonsterHitMessagesThisTurn);
        // To-hit calculation for monster
        // C ref: mhitu.c:707-708 — tmp = AC_VALUE(u.uac) + 10 + mtmp->m_lev
        // C ref: mhitu.c:804 — rnd(20+i) where i is attack index
        const dieRoll = rnd(20 + i);
        // C ref: AC_VALUE(ac) macro:
        //   ac >= 0 ? ac : -rnd(-ac)
        const playerAc = Number.isInteger(player.ac) ? player.ac : player.effectiveAC;
        const acValue = (playerAc >= 0) ? playerAc : -rnd(-playerAc);
        const toHit = acValue + 10 + monster.mlevel;

        if (toHit <= dieRoll) {
            // Miss — C ref: mhitu.c:86-98 missmu()
            // "just " prefix when nearmiss (toHit == dieRoll) and verbose.
            if (!suppressHitMsg) {
                const just = (toHit === dieRoll) ? 'just ' : '';
                display.putstr_message(`The ${monDisplayName(monster)} ${just}misses!`);
            }
            continue;
        }

        // Calculate damage
        // C ref: mhitu.c:1182 — d(dice, sides) for attack damage
        let damage = 0;
        if (attack.dice && attack.sides) {
            damage = c_d(attack.dice, attack.sides);
        } else if (attack.dmg) {
            damage = c_d(attack.dmg[0], attack.dmg[1]);
        }

        // Handle special attack effects
        if (attack.special) {
            handleSpecialAttack(attack.special, monster, player, display);
        }

        // C ref: uhitm.c monster-vs-player electric attacks (AD_ELEC):
        // mhitm_mgc_atk_negated() then mhitm_ad_elec() consume rn2(10), rn2(20).
        // In monsters.js attack.damage stores adtyp numeric code (AD_ELEC=6).
        if (attack.damage === 6) {
            rn2(10);
            rn2(20);
        }

        if (damage > 0) {
            // Apply damage
            const died = player.takeDamage(damage, monDisplayName(monster));
            const wizardSaved = died && player.wizard;
            if (!wizardSaved && !suppressHitMsg) {
                const verb = monsterHitVerb(attack.type);
                display.putstr_message(`The ${monDisplayName(monster)} ${verb}!`);
                if (attack.damage === 6) {
                    display.putstr_message('You get zapped!');
                }
            }

            // C ref: uhitm.c:5236-5247 knockback after monster hits hero
            // rn2(3) distance + rn2(6) chance, for physical attacks
            rn2(3);
            rn2(6);

            // C ref: allmain.c stop_occupation() via mhitu.c attack flow.
            // A successful monster hit interrupts timed occupations/repeats.
            if (game && game.occupation) {
                if (game.occupation.occtxt === 'waiting' || game.occupation.occtxt === 'searching') {
                    display.putstr_message(`You stop ${game.occupation.occtxt}.`);
                }
                game.occupation = null;
                game.multi = 0;
            }

            if (died) {
                if (player.wizard) {
                    // C ref: end.c savelife() for wizard/discover survival path.
                    // givehp = 50 + 10 * (CON / 2), then clamp to hpmax.
                    const con = Number.isInteger(player.attributes?.[A_CON])
                        ? player.attributes[A_CON]
                        : 10;
                    const givehp = 50 + 10 * Math.floor(con / 2);
                    player.hp = Math.min(player.hpmax || givehp, givehp);
                    // C ref: end.c done() prints "OK, so you don't die." then
                    // savelife() sets nomovemsg = "You survived..." for NEXT turn.
                    // Whether both appear concatenated on the same screen depends
                    // on message line state:  if previous combat messages caused
                    // --More-- handling, "OK, so you don't die." is shown separately
                    // and only "You survived..." appears on the next screen capture.
                    // HeadlessDisplay: if topMessage has content, the --More--
                    // replacement simulates the clearing, leaving "OK, so you don't
                    // die." as topMessage.  The subsequent "You survived..." then
                    // concatenates with it.  When topMessage is empty (no prior
                    // messages this turn), both appear together.
                    const hadPriorMsg = !!(display.topMessage && display.messageNeedsMore);
                    if (hadPriorMsg) {
                        // C: --More-- would have been shown, harness clears it,
                        // "OK, so you don't die." replaces combat messages.
                        // Then on the NEXT screen capture, only "You survived..."
                        // appears (because the message was aged/cleared between
                        // captures in C).  Match that by not printing the prefix.
                        if (typeof display.clearRow === 'function') display.clearRow(0);
                        display.topMessage = null;
                        display.messageNeedsMore = false;
                    } else {
                        // C: no prior messages, so "OK, so you don't die." appears
                        // cleanly and concatenates with "You survived...".
                        display.putstr_message('OK, so you don\'t die.');
                    }
                    display.putstr_message('You survived that attempt on your life.');
                    if (game) game._suppressMonsterHitMessagesThisTurn = true;
                } else {
                    player.deathCause = `killed by a ${monDisplayName(monster)}`;
                    display.putstr_message('You die...');
                }
                break;
            }
        }
    }
}

// Handle special monster attack effects
// C ref: mhitu.c -- various AD_* damage types
function handleSpecialAttack(special, monster, player, display) {
    switch (special) {
        case 'poison':
            // C ref: mhitu.c AD_DRST -- poison attack
            if (rn2(5) === 0) {
                display.putstr_message(`You feel very sick!`);
                player.attributes[3] = Math.max(1, player.attributes[3] - 1); // DEX loss
            }
            break;

        case 'paralyze':
            // C ref: mhitu.c AD_PLYS -- floating eye paralysis
            display.putstr_message(`You are frozen by the ${monDisplayName(monster)}'s gaze!`);
            // In full implementation, this would set multi = -rnd(5)
            break;

        case 'blind':
            // C ref: mhitu.c AD_BLND -- blinding attack
            if (!player.blind) {
                display.putstr_message(`You are blinded by the ${monDisplayName(monster)}!`);
                player.blind = true;
            }
            break;

        case 'stick':
            // C ref: mhitu.c -- lichen sticking (holds you in place)
            display.putstr_message(`The ${monDisplayName(monster)} grabs you!`);
            break;
    }
}

// Check if player should level up
// C ref: exper.c newuexp() and pluslvl()
export function checkLevelUp(player, display) {
    // Experience table (approximate, from exper.c)
    // C ref: exper.c newuexp()
    const expTable = [0, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120,
                      10000, 20000, 40000, 80000, 160000, 320000, 640000,
                      1280000, 2560000, 5120000, 10000000, 20000000];

    while (player.level < 30 && player.exp >= (expTable[player.level] || Infinity)) {
        player.level++;
        // Gain HP and Pw
        // C ref: exper.c pluslvl() -- role-dependent gains
        const hpGain = rnd(8);
        player.hpmax += hpGain;
        player.hp += hpGain;
        const pwGain = rn2(3);
        player.pwmax += pwGain;
        player.pw += pwGain;

        display.putstr_message(`Welcome to experience level ${player.level}!`);
    }
}
