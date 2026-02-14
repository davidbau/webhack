// combat.js -- Combat system
// Mirrors uhitm.c (hero hits monster) and mhitu.c (monster hits hero)

import { rn2, rnd, d, c_d, rne, rnz } from './rng.js';
import { rndmonnum } from './makemon.js';
import {
    mons, G_FREQ, MZ_TINY, M2_NEUTER, M2_MALE, M2_FEMALE,
    MZ_LARGE,
    AT_CLAW, AT_BITE, AT_KICK, AT_BUTT, AT_TUCH, AT_STNG, AT_WEAP,
    S_ZOMBIE, S_MUMMY, S_VAMPIRE, S_WRAITH, S_LICH, S_GHOST, S_DEMON,
} from './monsters.js';
import { CORPSE, FOOD_CLASS, FLESH, objectData } from './objects.js';

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
    // C ref: uhitm.c find_roll_to_hit() -- tmp = 1 + abon + find_mac(mtmp) + level
    // then mhit = (tmp > rnd(20)); lower AC = better defense
    const dieRoll = rnd(20);
    const toHit = 1 + player.strToHit + monster.mac + player.level + weaponEnchantment(player.weapon);

    if (toHit <= dieRoll || dieRoll === 20) {
        // Miss
        // C ref: uhitm.c -- "You miss the <monster>"
        display.putstr_message(`You miss the ${monster.name}.`);
        // C ref: uhitm.c:5997 passive() — rn2(3) when monster alive after attack
        rn2(3);
        return false;
    }

    // C ref: uhitm.c:742 exercise(A_DEX, TRUE) on successful hit
    rn2(19); // exercise(A_DEX, TRUE)

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
        display.putstr_message(`You kill the ${monster.name}!`);
        monster.dead = true;

        // Award experience
        // C ref: exper.c experience() -- roughly monster level * level
        const exp = (monster.mlevel + 1) * (monster.mlevel + 1);
        player.exp += exp;
        player.score += exp;

        // Check for level-up
        checkLevelUp(player, display);

        // C ref: mon.c:3581 xkilled() — "illogical but traditional" treasure drop
        rn2(6); // 1 in 6 chance of random treasure (result not used for RNG alignment)

        // C ref: mon.c:3243 corpse_chance() — decide whether to create corpse
        const mdat = monster.type || {};
        const gfreq = (mdat.geno || 0) & G_FREQ;
        const verysmall = (mdat.size || 0) === MZ_TINY;
        const corpsetmp = 2 + (gfreq < 2 ? 1 : 0) + (verysmall ? 1 : 0);
        const createCorpse = !rn2(corpsetmp);

        if (createCorpse) {
            // C ref: mkobj.c:521 next_ident — assign object ID
            rnd(2);

            // C ref: mkobj.c:1210 mksobj(CORPSE, TRUE) — init=TRUE calls rndmonnum
            // even though mkcorpstat overrides corpsenm afterward
            const rndmndx = rndmonnum(1);

            // C ref: mkobj.c:1218 sex determination for the randomly selected monster
            // rn2(2) consumed unless monster is neuter, male, or female
            if (rndmndx >= 0) {
                const rndmon = mons[rndmndx];
                const f2 = rndmon ? rndmon.flags2 || 0 : 0;
                if (!(f2 & M2_NEUTER) && !(f2 & M2_FEMALE) && !(f2 & M2_MALE)) {
                    rn2(2); // sex
                }
            }

            // C ref: mkobj.c:1409 start_corpse_timeout — corpse rot timer
            // Fox is not lizard/lichen, not rider, not troll
            rnz(10); // rnz internally calls rn2(1000), rne(4), rn2(2)

            // Place corpse on the map so pets can find it
            if (map) {
                const corpse = {
                    otyp: CORPSE,
                    oclass: FOOD_CLASS,
                    material: FLESH,
                    corpsenm: monster.mndx || 0,
                    name: `${monster.name} corpse`,
                    displayChar: '%',
                    displayColor: 7,
                    ox: monster.mx,
                    oy: monster.my,
                    cursed: false,
                    blessed: false,
                    oartifact: 0,
                };
                map.objects.push(corpse);
            }
        }

        // C ref: uhitm.c:5997 passive() — SKIPPED when monster is killed
        return true; // monster is dead
    } else {
        // C ref: uhitm.c -- various hit messages
        if (dieRoll >= 18) {
            display.putstr_message(`You smite the ${monster.name}!`);
        } else {
            display.putstr_message(`You hit the ${monster.name}.`);
        }
        // C ref: uhitm.c:5997 passive() — rn2(3) when monster alive after hit
        rn2(3);
        return false;
    }
}

// Monster attacks the player
// C ref: mhitu.c mattacku() -> mattackm core
export function monsterAttackPlayer(monster, player, display) {
    if (!monster.attacks || monster.attacks.length === 0) return;
    if (monster.passive) return; // passive monsters don't initiate attacks

    for (let i = 0; i < monster.attacks.length; i++) {
        const attack = monster.attacks[i];
        // To-hit calculation for monster
        // C ref: mhitu.c:707-708 — tmp = AC_VALUE(u.uac) + 10 + mtmp->m_lev
        // C ref: mhitu.c:804 — rnd(20+i) where i is attack index
        const dieRoll = rnd(20 + i);
        // AC_VALUE(ac) = ac when ac >= 0 (randomized when negative)
        const acValue = player.effectiveAC >= 0 ? player.effectiveAC : 0;
        const toHit = acValue + 10 + monster.mlevel;

        if (toHit <= dieRoll) {
            // Miss — C ref: mhitu.c:811 missmu()
            display.putstr_message(`The ${monster.name} misses!`);
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
            const died = player.takeDamage(damage, monster.name);
            const wizardSaved = died && player.wizard;
            if (!wizardSaved) {
                const verb = monsterHitVerb(attack.type);
                display.putstr_message(`The ${monster.name} ${verb}!`);
                if (attack.damage === 6) {
                    display.putstr_message('You get zapped!');
                }
            }

            // C ref: uhitm.c:5236-5247 knockback after monster hits hero
            // rn2(3) distance + rn2(6) chance, for physical attacks
            rn2(3);
            rn2(6);

            if (died) {
                if (player.wizard) {
                    player.hp = 1;
                    display.putstr_message('You survived that attempt on your life.');
                } else {
                    player.deathCause = `killed by a ${monster.name}`;
                    display.putstr_message('You die...');
                }
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
            display.putstr_message(`You are frozen by the ${monster.name}'s gaze!`);
            // In full implementation, this would set multi = -rnd(5)
            break;

        case 'blind':
            // C ref: mhitu.c AD_BLND -- blinding attack
            if (!player.blind) {
                display.putstr_message(`You are blinded by the ${monster.name}!`);
                player.blind = true;
            }
            break;

        case 'stick':
            // C ref: mhitu.c -- lichen sticking (holds you in place)
            display.putstr_message(`The ${monster.name} grabs you!`);
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
