// worn.js -- Equipment slot management and monster armor mechanics
// cf. worn.c — setworn/setnotworn, monster armor AI, bypass bits, extrinsics
//
// Data model: The `worn[]` table maps wornmask bits to hero slot pointers
// (uarm, uarmc, uarmh, uarms, uarmg, uarmf, uarmu, uleft, uright, uwep,
//  uswapwep, uquiver, uamul, ublindf, uball, uchain). Each item has an
// `owornmask` field recording which slots it occupies. Monsters use
// `misc_worn_check` (bitmask) + `obj.owornmask` on minvent items instead.
// Wornmask constants: W_ARM=suit, W_ARMC=cloak, W_ARMH=helm, W_ARMS=shield,
//   W_ARMG=gloves, W_ARMF=boots, W_ARMU=shirt, W_AMUL=amulet,
//   W_RINGL/W_RINGR=rings, W_WEP=weapon, W_SWAPWEP=alt-weapon,
//   W_QUIVER=quiver, W_TOOL=blindfold/towel/lenses, W_SADDLE=saddle,
//   W_BALL=ball, W_CHAIN=chain.
// Partial JS implementation: owornmask/misc_worn_check used in u_init.js:299,339
//   for Knight's pony saddle. No worn.c functions exist in JS yet.
// bypass bits (obj.bypass + context.bypasses): used for object iteration
//   control during multiple-drop and polymorph. Not implemented in JS.

// cf. worn.c:50 — recalc_telepat_range(): recompute hero's unblind telepathy radius
// Counts worn items with oc_oprop==TELEPAT; sets u.unblind_telepat_range.
// range = (BOLT_LIM^2) * count; -1 if no telepathy items worn.
// TODO: worn.c:50 — recalc_telepat_range(): telepathy range from worn items

// cf. worn.c:73 — setworn(obj, mask): equip obj into slot(s) indicated by mask
// Unequips previous item in each slot (clears extrinsics, artifact intrinsics,
//   cancel_doff); sets new item (sets owornmask, grants extrinsics/artifact bonuses).
// Special case: W_ARM|I_SPECIAL = embedded dragon scales (uskin).
// Calls update_inventory() and recalc_telepat_range() at end.
// Also clears nudist roleplay flag and updates tux_penalty.
// TODO: worn.c:73 — setworn(): equip item into hero's slot

// cf. worn.c:147 — setnotworn(obj): force-remove obj from being worn
// Clears owornmask bits, updates u.uprops extrinsics, artifact intrinsics,
//   blocked properties. Calls cancel_doff, update_inventory, recalc_telepat_range.
// Used when object is destroyed while worn.
// TODO: worn.c:147 — setnotworn(): force-unwear item (e.g. item destroyed)

// cf. worn.c:180 — allunworn(): clear all hero worn-slot pointers
// Clears uarm/uarmc/... etc. without updating extrinsics (called after
//   inventory is freed during game save). Sets u.twoweap=0.
// TODO: worn.c:180 — allunworn(): clear all worn pointers (save cleanup)

// cf. worn.c:198 — wearmask_to_obj(wornmask): return item worn in given slot
// Scans worn[] table for matching mask, returns *wp->w_obj (may be null).
// Used by poly_obj() to find items being worn.
// TODO: worn.c:198 — wearmask_to_obj(): look up hero's worn item by mask

// cf. worn.c:210 — wornmask_to_armcat(mask): convert wornmask bit to ARM_* category
// Returns one of ARM_SUIT, ARM_CLOAK, ARM_HELM, ARM_SHIELD, ARM_GLOVES,
//   ARM_BOOTS, ARM_SHIRT; returns 0 if not an armor slot.
// TODO: worn.c:210 — wornmask_to_armcat(): wornmask → armor category

// cf. worn.c:242 — armcat_to_wornmask(cat): convert ARM_* category to wornmask bit
// Inverse of wornmask_to_armcat(). Returns the W_ARM* constant for the category.
// TODO: worn.c:242 — armcat_to_wornmask(): armor category → wornmask

// cf. worn.c:274 — wearslot(obj): return bitmask of slots this item can occupy
// Handles AMULET_CLASS, RING_CLASS, ARMOR_CLASS (by armcat), WEAPON_CLASS,
//   TOOL_CLASS (blindfold/towel/lenses → W_TOOL; weptools → W_WEP|W_SWAPWEP;
//   saddle → W_SADDLE), FOOD_CLASS (meat_ring → ring slots),
//   GEM_CLASS (quiver), BALL_CLASS, CHAIN_CLASS.
// TODO: worn.c:274 — wearslot(): determine valid wear slots for an object

// cf. worn.c:347 — check_wornmask_slots(): sanity check hero's worn slots
// Verifies each worn slot: item in inventory, owornmask bit set correctly,
//   no other inventory item claims same slot. EXTRA_SANITY_CHECKS adds
//   uskin/dragon-scales and u.twoweap consistency checks.
// Not needed for JS gameplay; debug only.
// TODO: worn.c:347 — check_wornmask_slots(): worn slot sanity check (debug)

// cf. worn.c:466 — mon_set_minvis(mon): set monster to permanently invisible
// Sets mon->perminvis=1 and mon->minvis=1 (if not invis_blkd);
//   calls newsym() and see_wsegs() for worms.
// TODO: worn.c:466 — mon_set_minvis(): make monster permanently invisible

// cf. worn.c:478 — mon_adjust_speed(mon, adjust, obj): change monster's speed
// adjust: +2=set MFAST (silent), +1=increase, 0=recheck boots, -1=decrease,
//   -2=set MSLOW (silent), -3=petrify (reduce fast), -4=green slime (reduce fast, silent).
// Checks minvent for speed boots to override permspeed; prints message if visible.
// Referenced in mon.js comments (line 8).
// TODO: worn.c:478 — mon_adjust_speed(): monster speed adjustment

// cf. worn.c:569 — update_mon_extrinsics(mon, obj, on, silently): update monster's
// resistances/properties when armor is worn or removed.
// Handles INVIS (minvis), FAST (calls mon_adjust_speed), ANTIMAGIC/REFLECTING/
//   PROTECTION (handled elsewhere), others via mextrinsics bitmask.
// On removal: checks remaining worn gear for redundant property sources.
// Also handles w_blocks() for INVIS-blocking (mummy wrapping).
// Referenced in steal.js for put_saddle_on_mon context.
// TODO: worn.c:569 — update_mon_extrinsics(): monster property update on equip

// cf. worn.c:707 — find_mac(mon): calculate monster's effective armor class
// Starts from mon->data->ac; subtracts ARM_BONUS for each worn item
//   (including amulet of guarding at -2 fixed); caps at ±AC_MAX.
// Referenced in combat.js:267 as needed for hit calculations.
// TODO: worn.c:707 — find_mac(): monster armor class calculation

// cf. worn.c:747 — m_dowear(mon, creation): monster equips best available armor
// Skips verysmall/nohands/animal/mindless monsters (with mummy/skeleton exception).
// Calls m_dowear_type() for each slot in order: amulet, shirt, cloak, helm,
//   shield, gloves, boots, suit. Skips shield if wielding two-handed weapon.
// TODO: worn.c:747 — m_dowear(): monster armor-equipping AI

// cf. worn.c:789 [static] — m_dowear_type(mon, flag, creation, racialexception):
// Find and equip the best item for one armor slot.
// Compares ARM_BONUS + extra_pref for all candidates; handles autocurse
//   (dunce cap/opposite alignment helm), delays, cloak-under-suit timing.
// Calls update_mon_extrinsics() for old and new item.
// TODO: worn.c:789 — m_dowear_type(): monster equips one armor slot

// cf. worn.c:996 — which_armor(mon, flag): return item in a monster's armor slot
// For hero (&youmonst): returns uarm/uarmc/etc. by switch.
// For monsters: scans minvent for obj->owornmask & flag.
// TODO: worn.c:996 — which_armor(): get worn item for given slot/monster

// cf. worn.c:1029 [static] — m_lose_armor(mon, obj, polyspot): drop monster's armor
// Calls extract_from_minvent(), place_object(), optionally bypass_obj(),
//   and newsym().
// TODO: worn.c:1029 — m_lose_armor(): remove armor from monster and drop on floor

// cf. worn.c:1044 [static] — clear_bypass(objchn): recursively clear bypass bits
// Clears obj->bypass=0 on entire chain; recurses into container contents.
// TODO: worn.c:1044 — clear_bypass(): recursive bypass-bit clear on object chain

// cf. worn.c:1060 — clear_bypasses(): clear bypass bits on all object chains
// Clears fobj, invent, migrating_objs, buriedobjlist, billobjs, objs_deleted,
//   all monster minvents (and resets MCORPSENM for polymorph-worm tracking),
//   migrating_mons, mydogs, uball, uchain. Also called for worm polymorph bypass.
// TODO: worn.c:1060 — clear_bypasses(): global bypass-bit reset

// cf. worn.c:1109 — bypass_obj(obj): set bypass bit on one object
// Sets obj->bypass=1 and context.bypasses=TRUE.
// TODO: worn.c:1109 — bypass_obj(): mark single object as bypassed

// cf. worn.c:1117 — bypass_objlist(objchain, on): set/clear bypass bits on chain
// Sets or clears bypass bit for every object in the chain.
// TODO: worn.c:1117 — bypass_objlist(): bulk bypass-bit operation on chain

// cf. worn.c:1132 — nxt_unbypassed_obj(objchain): iterate objects skipping bypassed ones
// Returns first non-bypassed object; sets its bypass bit before returning
//   so successive calls advance through the list.
// TODO: worn.c:1132 — nxt_unbypassed_obj(): bypass-aware object iteration

// cf. worn.c:1149 — nxt_unbypassed_loot(lootarray, listhead): same for sortloot arrays
// Like nxt_unbypassed_obj() but for Loot arrays (which may have stale pointers).
// Validates that obj still exists in listhead before returning it.
// TODO: worn.c:1149 — nxt_unbypassed_loot(): bypass-aware loot array iteration

// cf. worn.c:1167 — mon_break_armor(mon, polyspot): remove/destroy armor on polymorph
// If breakarm (too big): destroys suit, cloak, shirt with cracking/ripping sounds.
// If sliparm (too small/whirly): drops suit, cloak, shirt.
// If handless_or_tiny: drops gloves, shield.
// If has_horns: drops non-flimsy helm.
// If slithy/centaur/tiny: drops boots.
// If can_saddle fails: drops saddle; may call dismount_steed(DISMOUNT_FELL).
// TODO: worn.c:1167 — mon_break_armor(): armor removal/destruction on polymorph

// cf. worn.c:1328 [static] — extra_pref(mon, obj): monster's preference bonus for armor
// Currently only: SPEED_BOOTS when mon->permspeed != MFAST → return 20.
// Used by m_dowear_type() to bias monster selection toward special armor.
// TODO: worn.c:1328 — extra_pref(): armor preference bonus for monster AI

// cf. worn.c:1350 — racial_exception(mon, obj): race-based armor exceptions
// Returns 1 (acceptable) if hobbit + elven armor (LoTR exception).
// Returns -1 (unacceptable) for future race+object bans; 0 for no exception.
// TODO: worn.c:1350 — racial_exception(): race-specific armor compatibility

// cf. worn.c:1367 — extract_from_minvent(mon, obj, do_extrinsics, silently):
// Remove an object from monster's inventory with full cleanup.
// Handles artifact_light (end_burn if W_ARM lit item), obj_extract_self(),
//   update_mon_extrinsics (if worn and do_extrinsics), misc_worn_check update,
//   check_gear_next_turn(), obj_no_longer_held(), mwepgone() if weapon.
// TODO: worn.c:1367 — extract_from_minvent(): remove object from monster inventory
