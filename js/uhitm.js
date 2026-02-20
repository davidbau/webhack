// uhitm.js -- Hero-vs-monster combat
// cf. uhitm.c — attack validation, to-hit/damage, damage-type handlers,
// engulfment, passive defense, mimic discovery, light attacks

import { rn2, rnd, d, c_d } from './rng.js';
import { exercise } from './attrib_exercise.js';
import { A_DEX } from './config.js';
import {
    G_FREQ, G_NOCORPSE, MZ_TINY, MZ_HUMAN, MZ_LARGE, M2_COLLECT,
    S_ZOMBIE, S_MUMMY, S_VAMPIRE, S_WRAITH, S_LICH, S_GHOST, S_DEMON, S_KOP,
    PM_SHADE,
} from './monsters.js';
import {
    CORPSE, FIGURINE, FOOD_CLASS, objectData,
    POTION_CLASS, POT_HEALING, POT_EXTRA_HEALING, POT_FULL_HEALING,
    POT_RESTORE_ABILITY, POT_GAIN_ABILITY,
} from './objects.js';
import { mkobj, mkcorpstat, RANDOM_CLASS, next_ident, xname } from './mkobj.js';
import { nonliving, monDisplayName } from './mondata.js';
import { obj_resists } from './objdata.js';
import { newexplevel } from './exper.js';
import { applyMonflee } from './mhitu.js';
import { mondead } from './monutil.js';


// ============================================================================
// 1. Magic negation
// ============================================================================

// cf. uhitm.c:74 — mhitm_mgc_atk_negated(magr, mattk, mdef, mhm):
//   Check if a magical attack is negated by target's magic resistance/cancellation.
//   Returns negation level (0 = not negated).
// TODO: uhitm.c:74 — mhitm_mgc_atk_negated()


// ============================================================================
// 2. Attack validation
// ============================================================================

// cf. uhitm.c:103 — dynamic_multi_reason(mon, verb, by_gaze):
//   Build reason string for multi-turn delay after special attacks.
// TODO: uhitm.c:103 — dynamic_multi_reason()

// cf. uhitm.c:125 — erode_armor(mdef, hurt):
//   Erode target's armor from acid/rust/fire damage.
// TODO: uhitm.c:125 — erode_armor()

// cf. uhitm.c:188 — attack_checks(mtmp, wep):
//   Pre-attack validation: peaceful/tame checks, displacement, invisibility.
// TODO: uhitm.c:188 — attack_checks()

// cf. uhitm.c:330 — check_caitiff(mtmp):
//   Alignment penalty for attacking a fleeing monster.
// TODO: uhitm.c:330 — check_caitiff()

// cf. uhitm.c:350 — mon_maybe_unparalyze(mtmp):
//   Wake up paralyzed monster on being attacked.
// TODO: uhitm.c:350 — mon_maybe_unparalyze()

// cf. uhitm.c:364 — find_roll_to_hit(mtmp, aatyp, weapon, attknum):
//   Compute to-hit roll including level, luck, DEX, enchantment, monster state.
//   Partially implemented in playerAttackMonster() below.
// TODO: uhitm.c:364 — find_roll_to_hit(): full implementation

// cf. uhitm.c:431 — force_attack(mtmp, pets_too):
//   Force attack on a monster in the way (e.g. 'F' prefix).
// TODO: uhitm.c:431 — force_attack()

// cf. uhitm.c:447 — do_attack(mtmp):
//   Top-level attack dispatcher: checks, weapon selection, special cases.
//   Partially implemented via playerAttackMonster() below.
// TODO: uhitm.c:447 — do_attack(): full implementation


// ============================================================================
// 3. Core hit mechanics
// ============================================================================

// cf. uhitm.c:586 — known_hitum(mon, weapon, uattk, aression, roleession, mhit, rollneeded, dieroll):
//   Handle known-hit path: exercise, cleave, flee check after hit.
//   Flee/morale check partially implemented in playerAttackMonster() below.
// TODO: uhitm.c:586 — known_hitum(): full implementation

// cf. uhitm.c:650 — hitum_cleave(target, uattk):
//   Cleaving attack: hit adjacent monsters with two-handed weapon.
// TODO: uhitm.c:650 — hitum_cleave()

// cf. uhitm.c:735 — double_punch():
//   Check for martial arts double punch chance.
// TODO: uhitm.c:735 — double_punch()

// cf. uhitm.c:757 — hitum(mon, uattk):
//   Main melee hit routine: roll to-hit, call known_hitum or miss.
// TODO: uhitm.c:757 — hitum()

// cf. uhitm.c:818 — hmon(mon, obj, thrown, dieroll):
//   Wrapper for hmon_hitmon: applies object damage to monster.
// TODO: uhitm.c:818 — hmon()

// cf. uhitm.c:837 — hmon_hitmon_barehands(hmd, mon):
//   Bare-handed damage: martial arts, 1d2 base, skill bonuses.
// TODO: uhitm.c:837 — hmon_hitmon_barehands()

// cf. uhitm.c:884 — hmon_hitmon_weapon_ranged(hmd, mon, obj):
//   Ranged weapon used in melee: rnd(2) base damage.
// TODO: uhitm.c:884 — hmon_hitmon_weapon_ranged()

// cf. uhitm.c:919 — hmon_hitmon_weapon_melee(hmd, mon, obj):
//   Melee weapon damage: dmgval, enchantment, blessed vs undead, silver, etc.
// TODO: uhitm.c:919 — hmon_hitmon_weapon_melee()

// cf. uhitm.c:1048 — hmon_hitmon_weapon(hmd, mon, obj):
//   Dispatch weapon hit to ranged or melee sub-handler.
// TODO: uhitm.c:1048 — hmon_hitmon_weapon()

// cf. uhitm.c:1073 — hmon_hitmon_potion(hmd, mon, obj):
//   Potion used as melee weapon: potionhit() then 1 damage (0 vs shade).
//   Partially implemented in hitMonsterWithPotion() below.
// TODO: uhitm.c:1073 — hmon_hitmon_potion(): full implementation

// cf. uhitm.c:1097 — hmon_hitmon_misc_obj(hmd, mon, obj):
//   Miscellaneous object as weapon: cockatrice corpse, cream pie, etc.
// TODO: uhitm.c:1097 — hmon_hitmon_misc_obj()

// cf. uhitm.c:1365 — hmon_hitmon_do_hit(hmd, mon, obj):
//   Apply computed damage: subtract HP, handle death, generate messages.
// TODO: uhitm.c:1365 — hmon_hitmon_do_hit()

// cf. uhitm.c:1414 — hmon_hitmon_dmg_recalc(hmd, obj):
//   Recalculate damage after enchantment/bonus adjustments.
// TODO: uhitm.c:1414 — hmon_hitmon_dmg_recalc()

// cf. uhitm.c:1488 — hmon_hitmon_poison(hmd, mon, obj):
//   Apply poison from poisoned weapon to monster.
// TODO: uhitm.c:1488 — hmon_hitmon_poison()

// cf. uhitm.c:1519 — hmon_hitmon_jousting(hmd, mon, obj):
//   Jousting bonus damage with lance while riding.
// TODO: uhitm.c:1519 — hmon_hitmon_jousting()

// cf. uhitm.c:1548 — hmon_hitmon_stagger(hmd, mon, obj):
//   Stagger chance after strong unarmed hit (rnd(100)).
// TODO: uhitm.c:1548 — hmon_hitmon_stagger()

// cf. uhitm.c:1566 — hmon_hitmon_pet(hmd, mon, obj):
//   Adjust behavior when hitting a pet.
// TODO: uhitm.c:1566 — hmon_hitmon_pet()

// cf. uhitm.c:1582 — hmon_hitmon_splitmon(hmd, mon, obj):
//   Handle pudding splitting on hit.
// TODO: uhitm.c:1582 — hmon_hitmon_splitmon()

// cf. uhitm.c:1615 — hmon_hitmon_msg_hit(hmd, mon, obj):
//   Generate hit message ("You hit the <monster>").
// TODO: uhitm.c:1615 — hmon_hitmon_msg_hit()

// cf. uhitm.c:1641 — hmon_hitmon_msg_silver(hmd, mon, obj):
//   Silver damage message ("The silver sears the <monster>!").
// TODO: uhitm.c:1641 — hmon_hitmon_msg_silver()

// cf. uhitm.c:1680 — hmon_hitmon_msg_lightobj(hmd, mon, obj):
//   Light-source weapon message (burning undead, etc).
// TODO: uhitm.c:1680 — hmon_hitmon_msg_lightobj()

// cf. uhitm.c:1732 — hmon_hitmon(mon, obj, thrown, dieroll):
//   Core hit-monster dispatcher: calls barehands/weapon/potion/misc, then
//   do_hit, dmg_recalc, poison, jousting, stagger, pet, splitmon, messages.
//   Partially implemented in playerAttackMonster() below.
// TODO: uhitm.c:1732 — hmon_hitmon(): full implementation


// ============================================================================
// 4. Special hit mechanics
// ============================================================================

// cf. uhitm.c:1920 — mhurtle_to_doom(mtmp, tmp, xd, yd, range):
//   Monster hurtle to death (knockback into hazard).
// TODO: uhitm.c:1920 — mhurtle_to_doom()

// cf. uhitm.c:1941 — first_weapon_hit(weapon):
//   Check if this is the first hit with a weapon (for artifact effects).
// TODO: uhitm.c:1941 — first_weapon_hit()

// cf. uhitm.c:1970 — shade_aware(obj):
//   Check if object can affect a shade (silver, blessed, artifact).
// TODO: uhitm.c:1970 — shade_aware()

// cf. uhitm.c:1994 — shade_miss(magr, mdef, obj, thrown, verbose):
//   Miss message when attacking shade with non-effective weapon.
// TODO: uhitm.c:1994 — shade_miss()

// cf. uhitm.c:2034 — m_slips_free(mdef, mattk):
//   Monster slips free from grabbing attack.
// TODO: uhitm.c:2034 — m_slips_free()

// cf. uhitm.c:2076 — joust(mon, obj):
//   Jousting check: lance + riding + skill → bonus damage or lance break.
// TODO: uhitm.c:2076 — joust()

// cf. uhitm.c:2111 — demonpet():
//   Demon summoning when hero is a demon and attacks.
// TODO: uhitm.c:2111 — demonpet()

// cf. uhitm.c:2126 — theft_petrifies(otmp):
//   Check if stealing an object would petrify the thief.
// TODO: uhitm.c:2126 — theft_petrifies()

// cf. uhitm.c:2152 — steal_it(mdef, mattk):
//   Hero steal-attack (nymph polymorph form, etc).
// TODO: uhitm.c:2152 — steal_it()


// ============================================================================
// 5. Damage-type handlers (mhitm_ad_*)
// ============================================================================

// cf. uhitm.c:2259 — mhitm_ad_rust(magr, mattk, mdef, mhm):
//   Rust damage type handler.
// TODO: uhitm.c:2259 — mhitm_ad_rust()

// cf. uhitm.c:2316 — mhitm_ad_corr(magr, mattk, mdef, mhm):
//   Corrosion damage type handler.
// TODO: uhitm.c:2316 — mhitm_ad_corr()

// cf. uhitm.c:2341 — mhitm_ad_dcay(magr, mattk, mdef, mhm):
//   Decay damage type handler.
// TODO: uhitm.c:2341 — mhitm_ad_dcay()

// cf. uhitm.c:2396 — mhitm_ad_dren(magr, mattk, mdef, mhm):
//   Energy drain damage type handler.
// TODO: uhitm.c:2396 — mhitm_ad_dren()

// cf. uhitm.c:2423 — mhitm_ad_drli(magr, mattk, mdef, mhm):
//   Level drain damage type handler.
// TODO: uhitm.c:2423 — mhitm_ad_drli()

// cf. uhitm.c:2499 — mhitm_ad_fire(magr, mattk, mdef, mhm):
//   Fire damage type handler.
// TODO: uhitm.c:2499 — mhitm_ad_fire()

// cf. uhitm.c:2604 — mhitm_ad_cold(magr, mattk, mdef, mhm):
//   Cold damage type handler.
// TODO: uhitm.c:2604 — mhitm_ad_cold()

// cf. uhitm.c:2662 — mhitm_ad_elec(magr, mattk, mdef, mhm):
//   Electric damage type handler.
// TODO: uhitm.c:2662 — mhitm_ad_elec()

// cf. uhitm.c:2720 — mhitm_ad_acid(magr, mattk, mdef, mhm):
//   Acid damage type handler.
// TODO: uhitm.c:2720 — mhitm_ad_acid()

// cf. uhitm.c:2768 — mhitm_ad_sgld(magr, mattk, mdef, mhm):
//   Steal gold damage type handler.
// TODO: uhitm.c:2768 — mhitm_ad_sgld()

// cf. uhitm.c:2837 — mhitm_ad_tlpt(magr, mattk, mdef, mhm):
//   Teleport damage type handler.
// TODO: uhitm.c:2837 — mhitm_ad_tlpt()

// cf. uhitm.c:2936 — mhitm_ad_blnd(magr, mattk, mdef, mhm):
//   Blinding damage type handler.
// TODO: uhitm.c:2936 — mhitm_ad_blnd()

// cf. uhitm.c:2993 — mhitm_ad_curs(magr, mattk, mdef, mhm):
//   Curse items damage type handler.
// TODO: uhitm.c:2993 — mhitm_ad_curs()

// cf. uhitm.c:3082 — mhitm_really_poison(magr, mattk, mdef, mhm):
//   Helper: apply actual poison effects (strength loss, instadeath check).
// TODO: uhitm.c:3082 — mhitm_really_poison()

// cf. uhitm.c:3100 — mhitm_ad_drst(magr, mattk, mdef, mhm):
//   Poison damage type handler (strength drain).
// TODO: uhitm.c:3100 — mhitm_ad_drst()

// cf. uhitm.c:3146 — mhitm_ad_drin(magr, mattk, mdef, mhm):
//   Brain drain damage type handler (intelligence drain).
// TODO: uhitm.c:3146 — mhitm_ad_drin()

// cf. uhitm.c:3284 — mhitm_ad_stck(magr, mattk, mdef, mhm):
//   Sticking damage type handler (grab/hold).
// TODO: uhitm.c:3284 — mhitm_ad_stck()

// cf. uhitm.c:3315 — mhitm_ad_wrap(magr, mattk, mdef, mhm):
//   Wrap/constriction damage type handler.
// TODO: uhitm.c:3315 — mhitm_ad_wrap()

// cf. uhitm.c:3409 — mhitm_ad_plys(magr, mattk, mdef, mhm):
//   Paralysis damage type handler.
// TODO: uhitm.c:3409 — mhitm_ad_plys()

// cf. uhitm.c:3457 — mhitm_ad_slee(magr, mattk, mdef, mhm):
//   Sleep damage type handler.
// TODO: uhitm.c:3457 — mhitm_ad_slee()

// cf. uhitm.c:3504 — mhitm_ad_slim(magr, mattk, mdef, mhm):
//   Slime damage type handler (green slime transformation).
// TODO: uhitm.c:3504 — mhitm_ad_slim()

// cf. uhitm.c:3581 — mhitm_ad_ench(magr, mattk, mdef, mhm):
//   Enchantment drain damage type handler.
// TODO: uhitm.c:3581 — mhitm_ad_ench()

// cf. uhitm.c:3630 — mhitm_ad_slow(magr, mattk, mdef, mhm):
//   Slow damage type handler.
// TODO: uhitm.c:3630 — mhitm_ad_slow()

// cf. uhitm.c:3668 — mhitm_ad_conf(magr, mattk, mdef, mhm):
//   Confusion damage type handler.
// TODO: uhitm.c:3668 — mhitm_ad_conf()

// cf. uhitm.c:3707 — mhitm_ad_poly(magr, mattk, mdef, mhm):
//   Polymorph damage type handler.
// TODO: uhitm.c:3707 — mhitm_ad_poly()

// cf. uhitm.c:3755 — mhitm_ad_famn(magr, mattk, mdef, mhm):
//   Famine (hunger) damage type handler.
// TODO: uhitm.c:3755 — mhitm_ad_famn()

// cf. uhitm.c:3786 — mhitm_ad_pest(magr, mattk, mdef, mhm):
//   Pestilence damage type handler.
// TODO: uhitm.c:3786 — mhitm_ad_pest()

// cf. uhitm.c:3815 — mhitm_ad_deth(magr, mattk, mdef, mhm):
//   Death touch damage type handler.
// TODO: uhitm.c:3815 — mhitm_ad_deth()

// cf. uhitm.c:3875 — mhitm_ad_halu(magr, mattk, mdef, mhm):
//   Hallucination damage type handler.
// TODO: uhitm.c:3875 — mhitm_ad_halu()

// cf. uhitm.c:3902 — do_stone_u(mtmp):
//   Hero turned to stone by monster touch.
// TODO: uhitm.c:3902 — do_stone_u()

// cf. uhitm.c:3923 — do_stone_mon(magr, mdef, mattk, mhm):
//   Monster turned to stone by hero touch.
// TODO: uhitm.c:3923 — do_stone_mon()

// cf. uhitm.c:3959 — mhitm_ad_phys(magr, mattk, mdef, mhm):
//   Physical damage type handler (base melee damage).
// TODO: uhitm.c:3959 — mhitm_ad_phys()

// cf. uhitm.c:4181 — mhitm_ad_ston(magr, mattk, mdef, mhm):
//   Stoning damage type handler (cockatrice, etc).
// TODO: uhitm.c:4181 — mhitm_ad_ston()

// cf. uhitm.c:4243 — mhitm_ad_were(magr, mattk, mdef, mhm):
//   Lycanthropy damage type handler.
// TODO: uhitm.c:4243 — mhitm_ad_were()

// cf. uhitm.c:4274 — mhitm_ad_heal(magr, mattk, mdef, mhm):
//   Healing damage type handler (nurse healing touch).
// TODO: uhitm.c:4274 — mhitm_ad_heal()

// cf. uhitm.c:4366 — mhitm_ad_stun(magr, mattk, mdef, mhm):
//   Stun damage type handler.
// TODO: uhitm.c:4366 — mhitm_ad_stun()

// cf. uhitm.c:4403 — mhitm_ad_legs(magr, mattk, mdef, mhm):
//   Leg wound damage type handler.
// TODO: uhitm.c:4403 — mhitm_ad_legs()

// cf. uhitm.c:4470 — mhitm_ad_dgst(magr, mattk, mdef, mhm):
//   Digestion damage type handler (engulfing digest).
// TODO: uhitm.c:4470 — mhitm_ad_dgst()

// cf. uhitm.c:4548 — mhitm_ad_samu(magr, mattk, mdef, mhm):
//   Steal amulet damage type handler (quest nemesis).
// TODO: uhitm.c:4548 — mhitm_ad_samu()

// cf. uhitm.c:4571 — mhitm_ad_dise(magr, mattk, mdef, mhm):
//   Disease damage type handler.
// TODO: uhitm.c:4571 — mhitm_ad_dise()

// cf. uhitm.c:4601 — mhitm_ad_sedu(magr, mattk, mdef, mhm):
//   Seduction damage type handler (item theft).
// TODO: uhitm.c:4601 — mhitm_ad_sedu()

// cf. uhitm.c:4729 — mhitm_ad_ssex(magr, mattk, mdef, mhm):
//   Succubus/incubus seduction damage type handler.
// TODO: uhitm.c:4729 — mhitm_ad_ssex()

// cf. uhitm.c:4760 — mhitm_adtyping(magr, mattk, mdef, mhm):
//   Dispatch to specific mhitm_ad_* handler based on attack damage type.
// TODO: uhitm.c:4760 — mhitm_adtyping()


// ============================================================================
// 6. Engulfment
// ============================================================================

// cf. uhitm.c:4813 — damageum(mdef, mattk, specialdmg):
//   Apply hero's attack damage to monster (used by polymorphed hero attacks).
// TODO: uhitm.c:4813 — damageum()

// cf. uhitm.c:4869 — explum(mdef, mattk):
//   Exploding attack (hero polymorphed into exploding monster).
// TODO: uhitm.c:4869 — explum()

// cf. uhitm.c:4909 — start_engulf(mdef):
//   Start engulfing animation/state.
// TODO: uhitm.c:4909 — start_engulf()

// cf. uhitm.c:4927 — end_engulf():
//   End engulfing animation/state.
// TODO: uhitm.c:4927 — end_engulf()

// cf. uhitm.c:4936 — gulpum(mdef, mattk):
//   Hero engulf attack (polymorphed into engulfer).
// TODO: uhitm.c:4936 — gulpum()


// ============================================================================
// 7. Miss / defense / knockback
// ============================================================================

// cf. uhitm.c:5176 — missum(mdef, uattk, can_see):
//   Hero misses monster: print miss message, exercise DEX.
// TODO: uhitm.c:5176 — missum()

// cf. uhitm.c:5196 — m_is_steadfast(mtmp):
//   Check if monster resists knockback (heavy, clinging, etc).
// TODO: uhitm.c:5196 — m_is_steadfast()

// cf. uhitm.c:5225 — mhitm_knockback(magr, mdef, mattk, mhm, dieroll):
//   Knockback effect on hit: push monster back, possibly into hazard.
// TODO: uhitm.c:5225 — mhitm_knockback()


// ============================================================================
// 8. Polymorphed hero attacks
// ============================================================================

// cf. uhitm.c:5402 — hmonas(mon):
//   Hero attacks as polymorphed monster (use monster attack list).
// TODO: uhitm.c:5402 — hmonas()


// ============================================================================
// 9. Passive defense
// ============================================================================

// cf. uhitm.c:5843 — passive(mon, mhit, malive, AT_type, wep_was_destroyed):
//   Monster's passive defense: damage hero on contact (acid blob, etc).
//   rn2(3) gate partially consumed in playerAttackMonster() below.
// TODO: uhitm.c:5843 — passive(): full implementation

// cf. uhitm.c:6105 — passive_obj(mon, obj, mattk):
//   Passive defense damages hero's weapon/armor.
// TODO: uhitm.c:6105 — passive_obj()


// ============================================================================
// 10. Mimic discovery
// ============================================================================

// cf. uhitm.c:6179 — that_is_a_mimic(mtmp):
//   Reveal that a hidden monster is actually a mimic.
// TODO: uhitm.c:6179 — that_is_a_mimic()

// cf. uhitm.c:6260 — stumble_onto_mimic(mtmp):
//   Hero stumbles onto a hidden mimic while moving.
// TODO: uhitm.c:6260 — stumble_onto_mimic()

// cf. uhitm.c:6278 — disguised_as_non_mon(mtmp):
//   Check if monster is disguised as a non-monster object/feature.
// TODO: uhitm.c:6278 — disguised_as_non_mon()

// cf. uhitm.c:6286 — disguised_as_mon(mtmp):
//   Check if monster is disguised as another monster.
// TODO: uhitm.c:6286 — disguised_as_mon()


// ============================================================================
// 11. Light attacks
// ============================================================================

// cf. uhitm.c:6293 — nohandglow(mon):
//   Suppress hand-glow message when inappropriate (e.g., not wielding light source).
// TODO: uhitm.c:6293 — nohandglow()

// cf. uhitm.c:6319 — flash_hits_mon(mtmp, otmp):
//   Flash of light hits a monster (camera, wand of light, etc).
// TODO: uhitm.c:6319 — flash_hits_mon()

// cf. uhitm.c:6403 — light_hits_gremlin(mon, dmg):
//   Light damage specifically to gremlins.
// TODO: uhitm.c:6403 — light_hits_gremlin()


// ============================================================================
// Implemented functions (moved from mhitu.js)
// ============================================================================

// cf. uhitm.c find_roll_to_hit() — luck component (partial)
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

export function weaponEnchantment(weapon) {
    return (weapon && (weapon.enchantment ?? weapon.spe)) || 0;
}

export function weaponDamageSides(weapon, monster) {
    if (!weapon) return 0;
    if (weapon.wsdam) return weapon.wsdam;
    const info = objectData[weapon.otyp];
    if (!info) return 0;
    const isLarge = (monster?.type?.size ?? MZ_TINY) >= MZ_LARGE;
    return isLarge ? (info.ldam || 0) : (info.sdam || 0);
}

// cf. uhitm.c hmon_hitmon_weapon() — ranged weapon used in melee check
function usesRangedMeleeDamage(weapon) {
    if (!weapon) return false;
    const sub = objectData[weapon.otyp]?.sub;
    if (!Number.isInteger(sub)) return false;
    const isLauncher = sub >= 20 && sub <= 22;      // P_BOW..P_CROSSBOW
    const isAmmoOrMissile = sub <= -20 && sub >= -24; // -P_BOW..-P_SHURIKEN
    return isLauncher || isAmmoOrMissile;
}

// cf. uhitm.c find_roll_to_hit() — Luck component.
// sgn(Luck) * ((abs(Luck) + 2) / 3)  (integer division)
function luckBonus(luck) {
    if (!luck) return 0;
    return Math.sign(luck) * Math.floor((Math.abs(luck) + 2) / 3);
}

// cf. weapon.c abon() — DEX component of to-hit bonus.
function dexToHit(dex) {
    if (dex < 4) return -3;
    if (dex < 6) return -2;
    if (dex < 8) return -1;
    if (dex < 14) return 0;
    return dex - 14;
}

// cf. uhitm.c hmon_hitmon_potion() -> potion.c potionhit()
function consumeMeleePotion(player, weapon) {
    const potion = { ...weapon, quan: 1 };
    if ((weapon.quan || 1) > 1) {
        weapon.quan = (weapon.quan || 1) - 1;
        potion.o_id = next_ident();
    } else {
        player.removeFromInventory(weapon);
        if (player.weapon === weapon) player.weapon = null;
        if (player.swapWeapon === weapon) player.swapWeapon = null;
        if (player.quiver === weapon) player.quiver = null;
    }
    return potion;
}

function potionHealsMonster(potion) {
    if (!potion) return false;
    return potion.otyp === POT_HEALING
        || potion.otyp === POT_EXTRA_HEALING
        || potion.otyp === POT_FULL_HEALING
        || potion.otyp === POT_RESTORE_ABILITY
        || potion.otyp === POT_GAIN_ABILITY;
}

// cf. uhitm.c hmon_hitmon_potion() -> potion.c potionhit()
function hitMonsterWithPotion(player, monster, display, weapon) {
    const potion = consumeMeleePotion(player, weapon);
    const bottleChoices = player?.hallucinating ? 24 : 7;
    rn2(bottleChoices); // bottlename()

    // cf. potion.c:1671
    if (rn2(5) && monster.mhp > 1) {
        monster.mhp--;
    }

    if (potionHealsMonster(potion) && monster.mhp < (monster.mhpmax || monster.mhp)) {
        monster.mhp = monster.mhpmax || monster.mhp;
        display.putstr_message(`The ${monDisplayName(monster)} looks sound and hale again.`);
    }

    // cf. potion.c:1893 — distance<3 && !rn2((1+DEX)/2) gate for potionbreathe()
    const dex = player.attributes?.[A_DEX] ?? 10;
    const breatheDenom = Math.max(1, Math.floor((1 + dex) / 2));
    rn2(breatheDenom);
}

// cf. mon.c xkilled() — monster death handling.
// Co-located here with its primary caller playerAttackMonster().
// TODO: future mon.js codematch should migrate this to mon.js.
function handleMonsterKilled(player, monster, display, map) {
    // cf. uhitm.c -> mon.c mondead() -> killed() -> xkilled()
    const mdat = monster.type || {};
    const killVerb = nonliving(mdat) ? 'destroy' : 'kill';
    display.putstr_message(`You ${killVerb} the ${monDisplayName(monster)}!`);
    mondead(monster, map);

    // cf. exper.c experience() -- roughly monster level * level
    const exp = (monster.mlevel + 1) * (monster.mlevel + 1);
    player.exp += exp;
    player.score += exp;
    newexplevel(player, display);

    // cf. mon.c:3581-3609 xkilled() — "illogical but traditional" treasure drop.
    const treasureRoll = rn2(6);
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
        const dropTooBig = isSmallMonster && !!otmp
            && otmp.otyp !== FIGURINE
            && ((otmp.owt || 0) > 30 || !!objectData[otmp.otyp]?.oc_big);
        if (isPermaFood && !(flags2 & M2_COLLECT)) {
            obj_resists(otmp, 0, 0);
        } else if (dropTooBig) {
            obj_resists(otmp, 0, 0);
        } else {
            otmp.ox = monster.mx;
            otmp.oy = monster.my;
            map.objects.push(otmp);
        }
    }

    // cf. mon.c:3243 corpse_chance()
    const gfreq = (mdat.geno || 0) & G_FREQ;
    const verysmall = (mdat.size || 0) === MZ_TINY;
    const corpsetmp = 2 + (gfreq < 2 ? 1 : 0) + (verysmall ? 1 : 0);
    const createCorpse = !rn2(corpsetmp);

    if (createCorpse) {
        const corpse = mkcorpstat(CORPSE, monster.mndx || 0, true);
        corpse.age = Math.max((player?.turns || 0) + 1, 1);
        if (map) {
            corpse.ox = monster.mx;
            corpse.oy = monster.my;
            map.objects.push(corpse);
        }
    }

    return true;
}

// cf. uhitm.c do_attack() / hmon_hitmon() — hero attacks monster
export function playerAttackMonster(player, monster, display, map) {
    // To-hit calculation
    // cf. uhitm.c find_roll_to_hit():
    //   tmp = 1 + abon() + find_mac(mtmp) + u.uhitinc
    //         + (sgn(Luck)*((abs(Luck)+2)/3)) + u.ulevel
    //   then: mhit = (tmp > rnd(20))
    const dieRoll = rnd(20);
    // cf. weapon.c abon() = str_bonus + (ulevel<3?1:0) + dex_bonus
    const abon = player.strToHit + (player.level < 3 ? 1 : 0)
        + dexToHit(player.attributes?.[A_DEX] ?? 10);
    let toHit = 1 + abon + monster.mac + player.level
        + luckBonus(player.luck || 0)
        + weaponEnchantment(player.weapon);
    // cf. uhitm.c:386-393 — monster state adjustments
    if (monster.stunned) toHit += 2;
    if (monster.flee) toHit += 2;
    if (monster.sleeping) toHit += 2;
    if (monster.mcanmove === false) toHit += 4;

    if (toHit <= dieRoll) {
        // Miss
        // cf. uhitm.c -- "You miss the <monster>"
        display.putstr_message(`You miss the ${monDisplayName(monster)}.`);
        // cf. uhitm.c:5997 passive() — rn2(3) when monster alive after attack
        rn2(3);
        return false;
    }

    // cf. uhitm.c:742 exercise(A_DEX, TRUE) on successful hit
    exercise(player, A_DEX, true);

    if (player.weapon && player.weapon.oclass === POTION_CLASS) {
        hitMonsterWithPotion(player, monster, display, player.weapon);
        // cf. uhitm.c hmon_hitmon_potion() sets base damage to 1 (or 0 vs shade)
        // after potionhit(), then proceeds through normal kill/flee/passive handling.
        if ((monster.mndx ?? -1) !== PM_SHADE) {
            monster.mhp -= 1;
        }
        if (monster.mhp <= 0) {
            return handleMonsterKilled(player, monster, display, map);
        }
        // cf. uhitm.c:624-628 known_hitum() — 1/25 morale/flee check on surviving hit
        if (!rn2(25) && monster.mhp < Math.floor((monster.mhpmax || 1) / 2)) {
            // cf. monflee(mon, !rn2(3) ? rnd(100) : 0, ...) — flee timer
            const fleetime = !rn2(3) ? rnd(100) : 0;
            applyMonflee(monster, fleetime, false);
        }
        // cf. uhitm.c:5997 passive() — rn2(3) when monster alive after attack
        rn2(3);
        return false;
    }

    // Hit! Calculate damage
    // cf. weapon.c:265 dmgval() -- rnd(oc_wsdam) for small monsters
    let damage = 0;
    const rangedMelee = usesRangedMeleeDamage(player.weapon);
    const wsdam = weaponDamageSides(player.weapon, monster);
    if (player.weapon && rangedMelee) {
        // cf. uhitm.c hmon_hitmon_weapon_ranged() base damage.
        damage = rnd(2);
    } else if (player.weapon && wsdam > 0) {
        damage = rnd(wsdam);
        damage += weaponEnchantment(player.weapon);
        // cf. weapon.c dmgval() — blessed weapon bonus vs undead/demons.
        if (player.weapon.blessed && isUndeadOrDemon(monster.type)) {
            damage += rnd(4);
        }
    } else if (player.weapon && player.weapon.damage) {
        damage = c_d(player.weapon.damage[0], player.weapon.damage[1]);
        damage += player.weapon.enchantment || 0;
    } else {
        // Bare-handed combat
        // cf. uhitm.c -- barehand damage is 1d2 + martial arts bonuses
        damage = rnd(2);
    }

    // Add strength bonus
    if (!rangedMelee) {
        damage += player.strDamage;
    }

    // Minimum 1 damage on a hit
    if (damage < 1) damage = 1;

    // Apply damage
    // cf. uhitm.c -- "You hit the <monster>!"
    monster.mhp -= damage;

    if (monster.mhp <= 0) {
        // cf. uhitm.c:5997 passive() — skipped when monster is killed
        return handleMonsterKilled(player, monster, display, map);
    } else {
        // cf. uhitm.c -- various hit messages
        if (dieRoll >= 18) {
            display.putstr_message(`You smite the ${monDisplayName(monster)}!`);
        } else {
            display.putstr_message(`You hit the ${monDisplayName(monster)}.`);
        }
        // cf. uhitm.c hmon_hitmon_core():
        // For armed melee hits with damage > 1: mhitm_knockback() → rn2(3), rn2(6).
        // For unarmed hits with damage > 1: hmon_hitmon_stagger() → rnd(100).
        if (player.weapon && damage > 1 && !player.twoweap) {
            rn2(3);
            rn2(6);
        } else if (!player.weapon && damage > 1) {
            // cf. uhitm.c:1554 hmon_hitmon_stagger — rnd(100) stun chance check
            rnd(100);
        }
        // cf. uhitm.c:624-628 known_hitum() — 1/25 morale/flee check on surviving hit
        if (!rn2(25) && monster.mhp < Math.floor((monster.mhpmax || 1) / 2)) {
            // cf. monflee(mon, !rn2(3) ? rnd(100) : 0, ...) — flee timer
            const fleetime = !rn2(3) ? rnd(100) : 0;
            applyMonflee(monster, fleetime, false);
        }
        // cf. uhitm.c:5997 passive() — rn2(3) when monster alive after hit
        rn2(3);
        return false;
    }
}
