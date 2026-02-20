// teleport.js -- Teleportation mechanics (player, monster, objects, levels)
// cf. teleport.c — goodpos, enexto, teleds, safe_teleds, tele, scrolltele,
//                  dotele, level_tele, domagicportal, tele_trap, rloc,
//                  rloco, random_teleport_level, u_teleport_mon, and helpers
//
// Covers all teleportation in NetHack: hero teleport (within-level and
// level-teleport), monster relocation (rloc/rloc_to), object scatter (rloco),
// position validation (goodpos/teleok), nearest-position search (enexto/
// collect_coords), and trap/portal/scroll handlers.
//
// JS implementations (level-generation subset only):
//   collect_coords() → dungeon.js:2253 (PARTIAL — no scary check, no struct)
//   sp_goodpos() ↔ goodpos() → dungeon.js:2293 (PARTIAL — SPACE_POS + no-mon only)
//   enexto() → dungeon.js:2307 (PARTIAL — calls collect_coords, level-gen scope)
//   group_collect_coords/group_sp_goodpos/group_enexto → makemon.js:1589
//     (PARTIAL — variations used for group monster placement during mklev)
//   makemon_rnd_goodpos() → makemon.js:1556 (PARTIAL — goodpos subset for makemon)
// All other runtime teleport functions → not implemented in JS.

// cf. teleport.c:20 [static] — m_blocks_teleporting(mtmp): demon lords/princes block tele
// Returns TRUE if mtmp is a demon lord (is_dlord) or demon prince (is_dprince).
// Used by noteleport_level() via get_iter_mons().
// TODO: teleport.c:20 — m_blocks_teleporting(): demon blocking check

// cf. teleport.c:29 — noteleport_level(mon): is teleporting prevented for mon?
// Returns TRUE if In_hell + a blocking demon lord/prince exists, or
//   svl.level.flags.noteleport is set.
// JS equiv: level.flags.noteleport is not tracked at level-gen time;
//   check omitted in makemon.js:957.
// TODO: teleport.c:29 — noteleport_level(): level-wide teleport prevention

// cf. teleport.c:47 [static] — goodpos_onscary(x, y, mptr): scary-position check
// Approximation of onscary() for new monster creation / tele destination.
// Checks: mlet (HUMAN/ANGEL/rider/unique corpse → FALSE), altar+vampire,
//   scare scroll at (x,y), Elbereth engraving (not in Gehennom/endgame).
// N/A: scare checks not needed during level generation.
// N/A: teleport.c:47 — goodpos_onscary()

// cf. teleport.c:80 — goodpos(x, y, mtmp, gpflags): is (x,y) valid for mtmp or object?
// gpflags: MM_IGNOREWATER, MM_IGNORELAVA, GP_CHECKSCARY, GP_ALLOW_U, GP_AVOID_MONPOS.
// Checks: isok(x,y); terrain passability by monster type (SPACE_POS vs water/lava/air);
//   not occupied by player (unless GP_ALLOW_U) or another monster (unless GP_AVOID_MONPOS);
//   scary check (GP_CHECKSCARY); no bad terrain for specific monster types (eel→water, etc.).
// JS equiv (level-gen subset): sp_goodpos() in dungeon.js:2293 — SPACE_POS + no-monster.
//   Full goodpos with terrain awareness: makemon.js:1512 (goodpos_sp function).
// PARTIAL: teleport.c:80 — goodpos() ↔ sp_goodpos() (dungeon.js:2293) and goodpos_sp (makemon.js:1512)

// cf. teleport.c:190 — enexto(cc, x, y, mdat): find good pos near (x,y) for mdat
// Calls enexto_core first with GP_CHECKSCARY, then without if needed.
// cc is filled with found position; returns TRUE on success.
// JS equiv: enexto(cx, cy, map) in dungeon.js:2307 — no scary check (level-gen only).
// PARTIAL: teleport.c:190 — enexto() ↔ enexto() (dungeon.js:2307)

// cf. teleport.c:200 — enexto_gpflags(cc, x, y, mdat, gpflags): enexto with custom flags
// Direct call to enexto_core() with caller-supplied gpflags.
// TODO: teleport.c:200 — enexto_gpflags(): enexto with caller-specified flags

// cf. teleport.c:213 — enexto_core(cc, x, y, mdat, gpflags): core nearest-position search
// Collects candidate positions via collect_coords() in expanding rings; filters with
//   goodpos(x, y, &fakemon, gpflags). Returns closest accepted position.
// JS equiv: enexto() in dungeon.js:2307 wraps collect_coords + sp_goodpos.
// PARTIAL: teleport.c:213 — enexto_core() ↔ enexto() (dungeon.js:2307)

// cf. teleport.c:380 [static] — tele_jump_ok(ox, oy, nx, ny): restricted-area tele check
// Checks if teleporting from (ox,oy) to (nx,ny) is allowed on special levels
//   with svl.level.flags.nommap.
// TODO: teleport.c:380 — tele_jump_ok(): restricted-area teleport destination check

// cf. teleport.c:414 [static] — teleok(x, y, thru): is (x,y) valid tele destination?
// Calls goodpos(); if thru=FALSE also rejects teleport traps and level teleporters.
// TODO: teleport.c:414 — teleok(): teleport destination validation

// cf. teleport.c:442 — teleds(nx, ny, ws): teleport player to (nx,ny)
// Handles ball & chain drag, sets u.ux/uy, calls newsym/pbusy, vision update,
//   terrain effects (lava/water/air/pit), u_on_newpos/vision/pline messages.
// TODO: teleport.c:442 — teleds(): hero teleport to specific location

// cf. teleport.c:572 — collect_coords(cc, cx, cy, maxradius): expand rings of coords
// Builds array of positions in rings 1..maxradius from (cx,cy).
// Shuffles each ring independently using Fisher-Yates (front-to-back, rn2-consuming).
// JS equiv: collect_coords() in dungeon.js:2253 — identical algorithm.
// ALIGNED: teleport.c:572 — collect_coords() ↔ collect_coords() (dungeon.js:2253)

// cf. teleport.c:712 — safe_teleds(trap_src): teleport player to a safe spot
// Tries random locations (up to 2×COLNO×ROWNO), then systematic scan; calls teleds().
// trap_src=TRUE: player on trap, get some distance.
// TODO: teleport.c:712 — safe_teleds(): random safe hero teleport

// cf. teleport.c:768 [static] — vault_tele(): teleport player to/near vault
// Finds a random vault position; falls back to tele() if no vault.
// TODO: teleport.c:768 — vault_tele(): hero vault teleport

// cf. teleport.c:781 — teleport_pet(petx, pety, force): check if pet can be teleported
// Checks leash constraints; force=TRUE ignores them.
// Returns TRUE if pet is free to teleport with hero.
// TODO: teleport.c:781 — teleport_pet(): pet teleport feasibility check

// cf. teleport.c:809 — tele_to_rnd_pet(): teleport hero next to a random pet
// Finds a tamed monster; locates adjacent valid spot; calls teleds().
// Used by ring of teleport control / scroll of teleportation mechanics.
// TODO: teleport.c:809 — tele_to_rnd_pet(): teleport hero to pet

// cf. teleport.c:837 — tele(): teleport hero (non-scroll method)
// Checks: On_stairs, noteleport_level; adjusts luck; calls scrolltele(0).
// TODO: teleport.c:837 — tele(): hero teleport wrapper

// cf. teleport.c:844 — scrolltele(is_scroll): hero teleport via scroll or other means
// Wizard mode: ask for destination; controlled tele (ring): choose destination;
//   normal tele: random location via safe_teleds().
// TODO: teleport.c:844 — scrolltele(): scroll/controlled teleport handler

// cf. teleport.c:914 — dotelecmd(): #teleport wizard-mode command
// Provides menu: random/safe/level/to-pet options; or directly calls tele().
// Returns ECMD_TIME or ECMD_OK.
// TODO: teleport.c:914 — dotelecmd(): wizard teleport command

// cf. teleport.c:1029 — dotele(is_trap): core teleportation logic
// Handles energy cost, anti-magic, confusion effects; calls tele() or safe_teleds().
// Also handles teleport trap arrival.
// TODO: teleport.c:1029 — dotele(): core teleport logic

// cf. teleport.c:1160 — level_tele(): level teleportation
// Controlled: pick destination level interactively; restricted to dungeon bounds
//   and special level constraints.
// Uncontrolled: random_teleport_level(); avoids current level.
// Calls goto_level() with teleport flag; handles scroll of teleportation.
// TODO: teleport.c:1160 — level_tele(): level teleportation handler

// cf. teleport.c:1439 — domagicportal(ttmp): step on magic portal
// Determines destination level (portal.destination); calls goto_level().
// Handles bones-file interactions and branch stair transitions.
// TODO: teleport.c:1439 — domagicportal(): magic portal handler

// cf. teleport.c:1487 — tele_trap(trap): hero steps on teleport trap
// Relocates nearby monsters to make room; activates dotele(TRUE).
// Removes disarmed traps; handles sleeping/paralyzed states.
// TODO: teleport.c:1487 — tele_trap(): hero teleport trap activation

// cf. teleport.c:1533 — level_tele_trap(trap, trflags): hero on level-teleport trap
// Shows "You are whisked away!" message; applies confusion/stun effects.
// Calls level_tele(); removes trap if appropriate.
// TODO: teleport.c:1533 — level_tele_trap(): level teleport trap handler

// cf. teleport.c:1570 [static] — rloc_pos_ok(x, y, mon): can monster arrive here via tele?
// Checks: restricted areas (svl.level.flags nommap/noteleport), shopkeeper
//   constraint (no rloc into a shop if shopkeeper present), goodpos with RLOC flags.
// TODO: teleport.c:1570 — rloc_pos_ok(): monster tele arrival validation

// cf. teleport.c:1640 [static] — rloc_to_core(mon, x, y, rflags): place monster at (x,y)
// Removes from old location; handles worm/tail; sets mx/my; updates player if stuck;
//   newsym; messages if visible; calls set_apparxy; shop tracking via mintrap.
// rflags: RLOC_NOMSG, RLOC_TELE, RLOC_MIGR.
// TODO: teleport.c:1640 — rloc_to_core(): core monster relocation

// cf. teleport.c:1766 — rloc_to(mon, x, y): relocate monster to (x,y), no messages
// Wrapper for rloc_to_core(mon, x, y, 0).
// TODO: teleport.c:1766 — rloc_to(): monster relocation (no message)

// cf. teleport.c:1772 — rloc_to_flag(mon, x, y, rflags): relocate with flags
// Wrapper for rloc_to_core(mon, x, y, rflags).
// TODO: teleport.c:1772 — rloc_to_flag(): monster relocation with flags

// cf. teleport.c:1781 [static] — stairway_find_forwiz(up, ladder): find stair for wiz tele
// Searches current level's stairway list for a stair matching up/isladder.
// Used by rloc() in wizard mode.
// TODO: teleport.c:1781 — stairway_find_forwiz(): wizard stair search

// cf. teleport.c:1794 — rloc(mon, rflags): relocate monster to random location
// Wizard handling: if player is wizard monster, try stairs then map corner.
// Finds random valid position (rloc_pos_ok, up to 50 tries + fallback scan).
// Calls rloc_to_core(); may fail if no position found.
// TODO: teleport.c:1794 — rloc(): random monster relocation

// cf. teleport.c:1894 — control_mon_tele(mon): wizard picks monster's tele destination
// Interactive getpos() for wizard-mode; validates with teleok(); calls rloc_to().
// TODO: teleport.c:1894 — control_mon_tele(): wizard monster tele control

// cf. teleport.c:1932 [static] — mvault_tele(mon): teleport monster to/near vault
// Finds vault room; calls rloc_to() for a valid vault spot; falls back to rloc().
// TODO: teleport.c:1932 — mvault_tele(): monster vault teleport

// cf. teleport.c:1945 — tele_restrict(mon): is teleportation restricted for monster?
// Checks: noteleport_level(mon); also Riders and Vlad are unrestricted.
// TODO: teleport.c:1945 — tele_restrict(): per-monster teleport restriction

// cf. teleport.c:1957 — mtele_trap(mon, trap, vis): monster steps on teleport trap
// Relocates monster via tele_restrict + rloc(); prints messages if visible.
// TODO: teleport.c:1957 — mtele_trap(): monster teleport trap

// cf. teleport.c:1998 — mlevel_tele_trap(mon, trap, vis, dx, dy): monster level-tele trap
// Checks tele_restrict(); migrates monster off level if allowed.
// Returns TRUE if monster left level (MIGR_RANDOM or Gehennom fallback).
// TODO: teleport.c:1998 — mlevel_tele_trap(): monster level teleport trap

// cf. teleport.c:2094 — rloco(obj): scatter object randomly on level
// Handles shop billing, restricted fall areas; places object at random valid position.
// Used by disintegration and other wide-area effects.
// TODO: teleport.c:2094 — rloco(): random object scatter

// cf. teleport.c:2182 — random_teleport_level(): compute random level-tele destination
// Constrained to dungeon branch structure; avoids current level.
// Considers Sokoban, Mines, Gehennom bounds; returns d_level struct.
// TODO: teleport.c:2182 — random_teleport_level(): random destination level

// cf. teleport.c:2254 — u_teleport_mon(mon, give_tele_control): player tele a monster
// Called by wand of teleportation and spell targeting.
// Priests and Riders may resist; tries controlled then random relocation.
// give_tele_control: whether wizard teleport control applies.
// TODO: teleport.c:2254 — u_teleport_mon(): player-induced monster teleport
