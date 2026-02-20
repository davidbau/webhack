// weapon.js -- To-hit/damage bonuses, weapon skill system, monster weapon AI
// cf. weapon.c — hitval, dmgval, abon, dbon, skill system, select_hwep/rwep
//
// Two major subsystems:
// 1. Combat bonus calculations: hitval(), dmgval(), abon(), dbon(),
//    weapon_hit_bonus(), weapon_dam_bonus(), special_dmgval(), silver_sears()
// 2. Weapon skill system: skill_init(), use_skill(), can_advance(),
//    enhance_weapon_skill(), add/lose/drain_weapon_skill(), unrestrict_weapon_skill()
//    Skill levels: P_ISRESTRICTED=0, P_UNSKILLED=1, P_BASIC=2, P_SKILLED=3,
//    P_EXPERT=4, P_MASTER=5 (unarmed only), P_GRAND_MASTER=6 (unarmed only).
//    Skill slots (u.weapon_slots) gate advancement; each level costs 1-3 slots.
// 3. Monster weapon AI: select_hwep(), select_rwep(), mon_wield_item(),
//    possibly_unwield(), mwepgone(), setmnotwielded()
//
// Partial JS implementations:
//   abon() → player.strToHit (player.js:532, attributed to attrib.c)
//   dbon() → player.strDamage (player.js:544, attributed to attrib.c)
//   select_rwep() → mthrowu.js:83 (simplified: lacks cockatrice eggs, pies,
//     boulders, throw-and-return weapons, polearm preference, gem/sling logic)
//   mwepgone() referenced in worn.js:172 as needed (not implemented)
//   No weapon skill system in JS yet.

// cf. weapon.c:76 [static] — give_may_advance_msg(skill): "more confident in skills" hint
// Prints "You feel more confident in your {weapon|spell casting|fighting} skills."
// TODO: weapon.c:76 — give_may_advance_msg(): skill advancement hint message

// cf. weapon.c:90 — weapon_descr(obj): skill category name for generic weapon description
// Returns makesingular of the P_NAME for the weapon's skill type.
// Special cases: P_NONE uses class name (or item-specific: corpse/tin/egg/statue);
//   P_SLING ammo → "stone"/"gem"; P_BOW ammo → "arrow"; P_CROSSBOW → "bolt";
//   P_FLAIL + grappling hook → "hook"; P_PICK_AXE + dwarvish mattock → "mattock".
// Used in drop messages ("you drop your sword" → generalized form).
// TODO: weapon.c:90 — weapon_descr(): generic weapon skill category description

// cf. weapon.c:149 — hitval(otmp, mon): "to hit" bonus of weapon vs. monster
// Adds: otmp->spe (for weapons/weptools), objects[otyp].oc_hitbon,
//   +2 if blessed vs undead/demon, +2 if spear vs kebabable monsters (S_XORN/DRAGON/etc.),
//   +4 trident vs swimmer in water (+2 in eel/snake territory), +2 if pick vs xorn/earth elem,
//   spec_abon() for artifacts.
// TODO: weapon.c:149 — hitval(): weapon to-hit bonus

// cf. weapon.c:216 — dmgval(otmp, mon): damage bonus of weapon vs. monster
// Rolls oc_wldam (large) or oc_wsdam (small) base; adds extra per weapon type for big/small;
//   adds otmp->spe for weapons (clamp to >=0), thick_skinned → 0, shade check → 0,
//   heavy iron ball weight bonus, blessed vs undead/demon (+1d4), axe vs wooden (+1d4),
//   silver vs silver-hating (+1d20), artifact_light vs hates_light (+1d8),
//   artifact spec_dbon doubling adjustment, greatest_erosion() subtracted (min 1).
// TODO: weapon.c:216 — dmgval(): weapon damage bonus

// cf. weapon.c:361 — special_dmgval(magr, mdef, armask, silverhit_p): blessed/silver
// damage for non-weapon hits (unarmed strikes with worn armor/rings).
// Finds worn item in armask slot; checks blessed vs mdef (+1d4) and silver vs silver-hating (+1d20).
// For ring slots without gloves: checks hero's rings directly.
// Sets *silverhit_p bitmask for ring slots that caused silver damage.
// TODO: weapon.c:361 — special_dmgval(): blessed/silver damage for unarmed hit

// cf. weapon.c:436 — silver_sears(magr, mdef, silverhit): print silver ring sear message
// "Your silver ring[s] sear[s] <monster>!" with correct singular/plural/left/right.
// TODO: weapon.c:436 — silver_sears(): silver ring hit message

// cf. weapon.c:475 [static] — oselect(mtmp, type): find one item of given type in monster inv
// Skips non-petrifying corpses/eggs; skips items monster can't safely touch.
// TODO: weapon.c:475 — oselect(): typed item search in monster inventory

// cf. weapon.c:520 — autoreturn_weapon(otmp): is this a throw-and-return weapon?
// Checks arwep[] table (currently just AKLYS). Returns pointer to struct or null.
// TODO: weapon.c:520 — autoreturn_weapon(): check for aklys/boomerang-style weapon

// cf. weapon.c:533 — select_rwep(mtmp): select best ranged weapon for monster
// Priority: cockatrice eggs, cream pies (for Kops), boulders (for giants),
//   polearms (if within dist2<=13 and not weld-only), throw-and-return weapons,
//   then rwep[] priority list (spears, arrows, bolts, darts, rocks, etc.),
//   including gem-slinging with propellor logic.
// Sets gp.propellor to the launcher needed (or &hands_obj if none needed).
// Partially implemented as select_rwep() in mthrowu.js:83 (simplified).
// TODO: weapon.c:533 — select_rwep(): full monster ranged weapon selection

// cf. weapon.c:680 — monmightthrowwep(obj): can any monster throw this weapon type?
// Returns TRUE if obj->otyp is in rwep[] priority list.
// TODO: weapon.c:680 — monmightthrowwep(): test if weapon is monster-throwable

// cf. weapon.c:705 — select_hwep(mtmp): select best hand-to-hand weapon for monster
// Prefers artifacts; then giants prefer clubs, Balrog prefers bullwhip.
// Walks hwep[] priority list (tsurugi, runesword, mattock … worm tooth);
//   skips bimanual for weak/shield-wearing; skips silver if mon_hates_silver.
// TODO: weapon.c:705 — select_hwep(): monster melee weapon selection

// cf. weapon.c:747 — possibly_unwield(mon, polyspot): monster may need to change weapon
// Called after polymorph, theft, etc. If weapon is gone (stolen/destroyed): reset to NEED_WEAPON.
// If monster can no longer use weapons: setmnotwielded, message, drop on floor.
// Otherwise sets NEED_WEAPON so mon_wield_item will re-evaluate.
// TODO: weapon.c:747 — possibly_unwield(): monster weapon re-evaluation after change

// cf. weapon.c:801 — mon_wield_item(mon): monster wields appropriate weapon (takes 1 turn)
// Dispatches on mon->weapon_check: NEED_HTH_WEAPON → select_hwep,
//   NEED_RANGED_WEAPON → select_rwep, NEED_PICK_AXE/NEED_AXE/NEED_PICK_OR_AXE.
// Handles weld check (prints message; sets NO_WEAPON_WANTED if already welded).
// Prints wield message if canseemon; handles artifact speak/light.
// Referenced in mthrowu.js:10 as not being called before select_rwep in JS.
// TODO: weapon.c:801 — mon_wield_item(): monster weapon switch AI

// cf. weapon.c:938 — mwepgone(mon): force monster to stop wielding
// Calls setmnotwielded(mon, MON_WEP(mon)) and sets weapon_check = NEED_WEAPON.
// Referenced in worn.js:172 as needed by extract_from_minvent().
// TODO: weapon.c:938 — mwepgone(): monster unwield (weapon removed from inventory)

// cf. weapon.c:950 — abon(): hero's attack bonus from STR and DEX
// STR component: <6→-2, <8→-1, <17→0, ≤18/50→+1, <18/100→+2, else→+3; +1 if ulevel<3.
// DEX component: <4→-3, <6→-2, <8→-1, <14→0, else→+(dex-14).
// Polymorphed: returns adj_lev(youmonst.data) - 3 instead.
// Partially implemented as player.strToHit (player.js:532); JS version
//   lacks full STR18 encoding and DEX component; credited to attrib.c.
// TODO: weapon.c:950 — abon(): full attack bonus (STR + DEX)

// cf. weapon.c:988 — dbon(): hero's damage bonus from STR
// <6→-1, <16→0, <18→+1, ==18→+2, ≤18/75→+3, ≤18/90→+4, <18/100→+5, else→+6.
// Polymorphed: returns 0.
// Partially implemented as player.strDamage (player.js:544); lacks STR18 encoding;
//   credited to attrib.c.
// TODO: weapon.c:988 — dbon(): full damage bonus (STR)

// cf. weapon.c:1014 [static] — finish_towel_change(obj, newspe): apply towel wetness change
// Clamps spe to [0,7]; if wielded, updates u.unweapon; calls update_inventory().
// TODO: weapon.c:1014 — finish_towel_change(): towel wetness state update

// cf. weapon.c:1033 — wet_a_towel(obj, amt, verbose): increase towel's wetness
// amt>0: set new spe; amt<0: increment by -amt; amt=0: no-op.
// Prints "gets damp/damper/wet/wetter" if verbose and increasing.
// Calls finish_towel_change() if changed.
// TODO: weapon.c:1033 — wet_a_towel(): towel wetting

// cf. weapon.c:1062 — dry_a_towel(obj, amt, verbose): decrease towel's wetness
// amt<0: decrement by abs(amt); amt>=0: set to new value.
// Prints "dries [out]" if verbose and decreasing.
// Calls finish_towel_change() if changed.
// TODO: weapon.c:1062 — dry_a_towel(): towel drying

// cf. weapon.c:1087 — skill_level_name(skill, buf): copy skill level name to buffer
// Returns "Unskilled"/"Basic"/"Skilled"/"Expert"/"Master"/"Grand Master"/"Unknown".
// TODO: weapon.c:1087 — skill_level_name(): skill level string

// cf. weapon.c:1120 — skill_name(skill): return skill name string (e.g. "long sword")
// Returns P_NAME(skill) — looks up from objects[] or odd_skill_names[] as appropriate.
// TODO: weapon.c:1120 — skill_name(): skill name string

// cf. weapon.c:1127 [static] — slots_required(skill): slots needed to advance skill
// Weapons/two-weapon: returns current level (1/2/3 for unskilled→basic/skilled/expert).
// Unarmed/martial: returns (level+1)/2 (cheaper).
// TODO: weapon.c:1127 — slots_required(): advancement slot cost

// cf. weapon.c:1151 — can_advance(skill, speedy): can this skill be advanced right now?
// Requires: not restricted, not at max, not at P_SKILL_LIMIT, enough practice,
//   enough weapon_slots (unless wizard+speedy).
// TODO: weapon.c:1151 — can_advance(): skill advancement eligibility check

// cf. weapon.c:1168 [static] — could_advance(skill): could advance if more slots?
// Like can_advance() but ignores weapon_slots check.
// TODO: weapon.c:1168 — could_advance(): skill advancement ignoring slot limit

// cf. weapon.c:1182 [static] — peaked_skill(skill): skill at max and over-practiced?
// Returns TRUE if at P_MAX_SKILL and has enough practice to advance (but can't).
// TODO: weapon.c:1182 — peaked_skill(): skill cap reached with pending experience

// cf. weapon.c:1193 [static] — skill_advance(skill): advance skill one level
// Deducts slots_required(); increments P_SKILL; records in u.skill_record;
//   prints "you are now more/most skilled in X"; calls skill_based_spellbook_id for spells.
// TODO: weapon.c:1193 — skill_advance(): perform one skill level advancement

// cf. weapon.c:1224 [static] — add_skills_to_menu(win, selectable, speedy): build skill menu
// Grouped by Fighting/Weapon/Spellcasting with section headings.
// Marks skills with *, #, or spaces based on can_advance/could_advance/peaked_skill.
// Wizard mode shows P_ADVANCE and practice_needed_to_advance values.
// TODO: weapon.c:1224 — add_skills_to_menu(): build #enhance/dumplog skill menu

// cf. weapon.c:1301 — show_skills(): display skill list for dumplog
// Creates a non-selectable menu via add_skills_to_menu and displays it.
// TODO: weapon.c:1301 — show_skills(): skill display for dumplog

// cf. weapon.c:1324 — enhance_weapon_skill(): #enhance command handler
// Loops showing selectable skill menu until no more advances or not speedy.
// Counts to_advance/eventually_advance/maxxed_cnt for legend display.
// Wizard: "Advance skills without practice?" y/n option (speedy mode).
// TODO: weapon.c:1324 — enhance_weapon_skill(): #enhance command

// cf. weapon.c:1409 — unrestrict_weapon_skill(skill): change skill from restricted→unskilled/basic
// Sets P_SKILL=P_UNSKILLED, P_MAX_SKILL=P_BASIC, P_ADVANCE=0 if previously restricted.
// Called during skill_init() and from pray.c.
// TODO: weapon.c:1409 — unrestrict_weapon_skill(): unlock a restricted skill

// cf. weapon.c:1419 — use_skill(skill, degree): record skill practice
// Adds degree to P_ADVANCE(skill); if newly can_advance, gives hint message.
// Called throughout combat/spell code to accumulate practice points.
// TODO: weapon.c:1419 — use_skill(): record skill practice

// cf. weapon.c:1432 — add_weapon_skill(n): gain n weapon skill slots
// Increments u.weapon_slots by n; if new slots unlock can_advance for any skill,
//   calls give_may_advance_msg().
// TODO: weapon.c:1432 — add_weapon_skill(): gain skill advancement slots (on level up)

// cf. weapon.c:1448 — lose_weapon_skill(n): lose n weapon skill slots
// Deducts from unused slots first; if none, rolls back last advanced skill
//   and refunds remaining slots (slots_required-1).
// TODO: weapon.c:1448 — lose_weapon_skill(): lose skill slots (from draining)

// cf. weapon.c:1471 — drain_weapon_skill(n): randomly drain n skills one level each
// Picks random skills from u.skill_record, drops them one level, refunds slots,
//   reduces practice proportionally within new level. Prints forget messages.
// TODO: weapon.c:1471 — drain_weapon_skill(): random skill drain

// cf. weapon.c:1512 — weapon_type(obj): return skill category (P_*) for an object
// Returns P_BARE_HANDED_COMBAT if null; P_NONE if not weapon/weptool/gem;
//   else abs(objects[otyp].oc_skill).
// TODO: weapon.c:1512 — weapon_type(): skill category for weapon object

// cf. weapon.c:1527 — uwep_skill_type(): skill category for hero's wielded weapon
// Returns P_TWO_WEAPON_COMBAT if u.twoweap; else weapon_type(uwep).
// TODO: weapon.c:1527 — uwep_skill_type(): current weapon skill in use

// cf. weapon.c:1540 — weapon_hit_bonus(weapon): to-hit bonus from weapon skill
// P_NONE: 0. Weapon skill: -4/0/+2/+3 for unskilled/basic/skilled/expert.
// Two-weapon: takes min of twoweap skill and weapon skill; -9/-7/-5/-3.
// Bare-handed/martial arts: scales with skill level (×2 for martial).
// Riding penalty: -2/-1/0/0 for unskilled/basic/skilled/expert; -2 extra for twoweap.
// TODO: weapon.c:1540 — weapon_hit_bonus(): skill-based to-hit bonus

// cf. weapon.c:1639 — weapon_dam_bonus(weapon): damage bonus from weapon skill
// P_NONE: 0. Weapon skill: -2/0/+1/+2 for unskilled/basic/skilled/expert.
// Two-weapon: -3/-1/0/+1 for unskilled through expert.
// Bare-handed/martial arts: scales with skill (×3 for martial).
// Riding bonus: +1/+2 for skilled/expert (not for two-weapon).
// TODO: weapon.c:1639 — weapon_dam_bonus(): skill-based damage bonus

// cf. weapon.c:1733 — skill_init(class_skill): initialize weapon skills for new game
// Resets all skills to restricted; sets P_BASIC for weapons in starting inventory
//   (skipping ammo); sets initial spell skills by role; sets max from class_skill table;
//   unlocks bare-handed if max > P_EXPERT; sets P_RIDING if role starts with pony;
//   unrestricts role's special spell school; calls skill_based_spellbook_id if not pauper.
// TODO: weapon.c:1733 — skill_init(): new game weapon skill initialization

// cf. weapon.c:1809 — setmnotwielded(mon, obj): make monster stop wielding obj
// Ends artifact lighting if needed; calls MON_NOWEP(mon); clears W_WEP from owornmask.
// TODO: weapon.c:1809 — setmnotwielded(): clear monster weapon wielding state
