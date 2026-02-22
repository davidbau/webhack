# Code Match: NetHack C to JS Correspondence

This document tracks the mapping between NetHack C source files (`nethack-c/src/*.c`)
and corresponding JavaScript files (`js/*.js`) in this JS port.

**See also:** [C_PARITY_WORKLIST.md](C_PARITY_WORKLIST.md) tracks active parity
debugging by domain (which functions are diverging and which issues track them).
This document tracks structural coverage (which C files/functions have JS counterparts).

**Goal**: Every C file containing game logic should have a corresponding JS file with
the same name, and every function in the C file should have a corresponding function
with the same name in the JS file (where applicable).

**Status legend**:
- `[ ]` No JS file yet
- `[~]` JS file exists but needs alignment (function names/structure don't match C)
- `[a]` Aligned — JS file matches C naming, but some functions not yet implemented
- `[p]` Present — all functions exist, some with partial implementations
- `[x]` Complete — all functions fully implemented at parity
- `[N/A]` Not applicable (system/platform code with no JS equivalent)

**Note on .h files**: C header files define types, constants, and function prototypes.
In JS, these are handled by module exports. Constants and data structures from headers
are documented in the corresponding .js file rather than in separate files.

**Note on .lua files**: NetHack uses Lua for special level definitions. The JS port
handles these via `js/levels/` and `js/special_levels.js`. These are data-driven and
don't follow the same 1:1 C→JS mapping pattern.

---

## C Source Files

### Game Core

| Status | C File | JS File | Notes |
|--------|--------|---------|-------|
| `[~]` | allmain.c | allmain.js | Main game loop, newgame, moveloop. JS: split across `nethack.js`, `menace.js` |
| `[N/A]` | alloc.c | — | Memory allocation (nhalloc, nhfree). JS uses GC |
| `[a]` | apply.c | apply.js | Applying items. handleApply (doapply) with isApplyCandidate/isApplyChopWeapon/isApplyPolearm/isApplyDownplay helpers; ~70 functions TODO |
| `[~]` | artifact.c | artifact.js | Artifact creation and effects |
| `[~]` | attrib.c | attrib.js | Attribute system. JS: partially in `attrib_exercise.js` |
| `[~]` | ball.c | ball.js | Ball & chain handling |
| `[a]` | bones.c | bones.js | Bones file save/load. All 9 functions aligned; 3 static TODO (no_bones_level, goodfruit, fixuporacle) |
| `[~]` | botl.c | botl.js | Bottom status line |
| `[x]` | calendar.c | calendar.js | Time, moon phase, Friday 13th, night/midnight. Affects gameplay |
| `[N/A]` | cfgfiles.c | — | Config file parsing. JS: `storage.js` handles config differently |
| `[a]` | cmd.c | cmd.js | Command dispatch. rhack() dispatches all key/command input; handleExtendedCommand (doextcmd); prefix commands (m/F/G/g). input.js handles low-level input. ~140 C functions are N/A (key binding, mouse, cmdq infrastructure) |
| `[N/A]` | coloratt.c | — | Terminal color attribute mapping |
| `[N/A]` | date.c | — | Build date/version stamps |
| `[~]` | dbridge.c | dbridge.js | Drawbridge mechanics |
| `[~]` | decl.c | decl.js | Global variable declarations. JS: spread across modules |
| `[a]` | detect.c | detect.js | Detection spells and scrolls. dosearch0 implemented (RNG-parity); ~40 functions TODO |
| `[~]` | dig.c | dig.js | Digging mechanics |
| `[~]` | display.c | display.js | Display/rendering. JS file exists but may diverge |
| `[N/A]` | dlb.c | — | Data librarian (file bundling). Not needed in JS |
| `[a]` | do.c | do.js | Miscellaneous actions. handleDrop/handleDownstairs/handleUpstairs (dodrop/dodown/doup); ~45 functions TODO |
| `[~]` | do_name.c | do_name.js | Naming things (docallcmd, do_mgivenname) |
| `[~]` | do_wear.c | do_wear.js | Wearing/removing armor and accessories. Multi-slot handleWear/handlePutOn/handleTakeOff/handleRemove; canwearobj, cursed_check, find_ac. Equipment on/off effects implemented for all slot types: Boots (speed/stealth/fumble/levitation with messages and makeknown), Cloaks (stealth/displacement/invisibility/protection), Helmets (brilliance/telepathy/dunce cap), Gloves (fumbling/power/dexterity), all 28 ring types (resistances, teleport, polymorph, conflict, etc. with extrinsic tracking), Amulets (ESP, life saving, strangulation, change, etc.). Uses toggle_extrinsic/toggle_stealth/toggle_displacement helpers. adj_abon and learnring implemented. Remaining gaps: float_up/float_down for levitation, vision system calls (see_monsters, newsym), cockatrice corpse wielding check, multi-takeoff(A), armor destruction. |
| `[a]` | dog.c | dog.js | Pet behavior. dogfood/makedog/mon_arrive in dog.js; losedogs/keepdogs/migrate TODO |
| `[a]` | dogmove.c | dogmove.js | Pet movement AI. All functions except `quickmimic` |
| `[a]` | dokick.c | kick.js | Kicking mechanics. handleKick (dokick) approximation; full kick effects TODO |
| `[a]` | dothrow.c | dothrow.js | Throwing mechanics. handleThrow/handleFire (dothrow/dofire), promptDirectionAndThrowItem (throwit), ammoAndLauncher, DIRECTION_KEYS; ~30 functions TODO |
| `[a]` | drawing.c | symbols.js | Symbol/glyph drawing tables and lookup functions. Data tables in symbols.js; 3 lookup functions implemented |
| `[~]` | dungeon.c | dungeon.js | Dungeon structure and level management |
| `[a]` | eat.c | eat.js | Eating mechanics. handleEat (doeat) implemented; ~50 functions TODO |
| `[~]` | end.c | end.js | Game over, death, scoring |
| `[a]` | engrave.c | engrave.js | Engraving mechanics. handleEngrave (doengrave) approximation, maybeSmudgeEngraving (wipe_engr_at); engrave_data.js has text data; ~30 functions TODO |
| `[a]` | exper.c | exper.js | Experience and leveling. newuexp, newexplevel, pluslvl, losexp implemented; experience, more_experienced, newpw, enermod, rndexp TODO |
| `[~]` | explode.c | explode.js | Explosion effects |
| `[~]` | extralev.c | extralev.js | Special level generation helpers |
| `[N/A]` | files.c | — | File I/O operations. JS: `storage.js` |
| `[a]` | fountain.c | fountain.js | Fountain effects. drinkfountain/dryup implemented (RNG-parity); ~12 functions TODO |
| `[~]` | getpos.c | getpos.js | Position selection UI |
| `[~]` | glyphs.c | glyphs.js | Glyph system. JS: partially in `display.js`, `symbols.js` |
| `[a]` | hack.c | hack.js | Core movement and actions. handleMovement (domove_core) with door/trap/autopickup handling, handleRun (lookaround/context.run), checkRunStop, pickRunContinuationDir, findPath (findtravelpath), handleTravel (dotravel), executeTravelStep, performWaitSearch. All are approximations with partial RNG parity; ~70 C functions TODO |
| `[a]` | hacklib.c | hacklib.js | String/char utilities. All C functions implemented; in-place string ops return new strings in JS |
| `[~]` | iactions.c | iactions.js | Item actions context menu |
| `[~]` | insight.c | insight.js | Player knowledge/enlightenment |
| `[a]` | invent.c | invent.js | Inventory management. handleInventory/buildInventoryOverlayLines/compactInvletPromptChars (ddoinv/display_inventory/compactify); ~80 functions TODO |
| `[x]` | isaac64.c | isaac64.js | ISAAC64 PRNG. All 8 functions matched |
| `[~]` | light.c | light.js | Light source management |
| `[a]` | lock.c | lock.js | Lock picking and door opening. handleForce/handleOpen/handleClose (doforce/doopen/doclose) approximations; ~15 functions TODO |
| `[N/A]` | mail.c | — | In-game mail system (uses real mail on Unix) |
| `[a]` | makemon.c | makemon.js | Monster creation. Core functions aligned; clone_mon/propagate TODO |
| `[~]` | mcastu.c | mcastu.js | Monster spellcasting. castmu/buzzmu and all 11 spell functions TODO (runtime gameplay) |
| `[N/A]` | mdlib.c | — | Metadata library utilities |
| `[a]` | mhitm.c | mhitm.js | Monster-vs-monster combat. mattackm/hitmm/mdamagem/passivemm/fightm implemented (m-vs-m path); RNG parity for pets in dogmove.js; monCombatName per-monster visibility pronouns; 5 functions TODO |
| `[a]` | mhitu.c | mhitu.js | Monster-vs-hero combat. monsterAttackPlayer restructured to match hitmu() flow; hitmsg, mhitm_knockback, mhitu_adtyping dispatcher, ~30 AD_* handlers (phys/fire/cold/elec/acid/stck/plys/slee/conf/stun/blnd/drst/drli/dren/drin/slow/ston etc.) implemented with real effects; gazemu/gulpmu/expels/summonmu/doseduce TODO |
| `[~]` | minion.c | minion.js | Minion summoning: msummon, summon_minion, demon_talk, bribe, guardian angels. All 14 functions TODO (runtime gameplay) |
| `[~]` | mklev.c | mklev.js | Level generation. makelevel/makerooms/makecorridors/mineralize PARTIAL in dungeon.js; topologize/mkinvokearea/place_branch TODO |
| `[~]` | mkmap.c | mkmap.js | Map generation algorithms. JS: in `sp_lev.js` |
| `[~]` | mkmaze.c | mkmaze.js | Maze generation. wallification/create_maze/makemaz PARTIAL in dungeon.js; water plane (movebubbles etc.) TODO; save/restore N/A |
| `[~]` | mkobj.c | mkobj.js | Object creation |
| `[~]` | mkroom.c | mkroom.js | Room generation. somex/somey/inside_room/somexy/somexyspace ALIGNED in dungeon.js; mkshop/mktemple PARTIAL; fill_zoo ALIGNED; save/restore N/A |
| `[a]` | mon.c | mon.js | Monster lifecycle: movemon, mfndpos (flag-based), mm_aggression, corpse_chance, passivemm, hider premove, zombie_maker, zombie_form, undead_to_corpse, genus, pm_to_cham |
| `[a]` | mondata.c | mondata.js | Monster data queries: predicates, mon_knows_traps, passes_bars, dmgtype, hates_silver, sticks, etc. |
| `[a]` | monmove.c | monmove.js | Monster movement: dochug, m_move, m_move_aggress, set_apparxy, m_search_items |
| `[~]` | monst.c | monst.js | Monster data tables. mons[] array PARTIAL in monsters.js (JS-native structure); monst_globals_init implicit in module load |
| `[~]` | mplayer.c | mplayer.js | Player-character rival monsters (endgame + ghost-level). is_mplayer() in mondata.js; rnd_offensive/defensive/misc_item in makemon.js; mk_mplayer/create_mplayers/mplayer_talk TODO (endgame not yet modeled) |
| `[a]` | mthrowu.c | mthrowu.js | Monster ranged attacks: m_throw, thrwmu, lined_up, select_rwep, monmulti |
| `[~]` | muse.c | muse.js | Monster item usage AI |
| `[~]` | music.c | music.js | Musical instruments |
| `[N/A]` | nhlobj.c | — | Lua object bindings (l_obj_*). All 21 functions are Lua C API wrappers; JS port uses direct function calls (object(), monster() in sp_lev.js) with no Lua interpreter |
| `[N/A]` | nhlsel.c | — | Lua selection bindings (l_selection_*). All ~40 functions wrap selvar.c for Lua; JS port uses the `selection` object exported from sp_lev.js directly |
| `[N/A]` | nhlua.c | — | Lua interpreter integration |
| `[N/A]` | nhmd4.c | — | MD4 hash implementation |
| `[a]` | o_init.c | o_init.js | Object class initialization. Core shuffle functions aligned; setgemprobs, obj_shuffle_range, objdescr_is added; discovery functions in `discovery.js` |
| `[a]` | objects.c | objects.js | Object data tables. objects.js is auto-generated from objects.h (same source as C); objects_globals_init implicit in module load |
| `[~]` | objnam.c | objnam.js | Object naming (xname, doname, makeplural, readobjnam/wishing). All functions TODO; no JS object naming yet |
| `[~]` | options.c | options.js | Game options. JS: options.js (data), options_menu.js (handleSet UI) |
| `[a]` | pager.c | pager.js | Text pager and look/describe commands. handleHelp/handleWhatis/handleWhatdoes/handleHistory/handlePrevMessages/handleViewMapPrompt/handleLook (dohelp/dowhatis/dowhatdoes/dohistory/doprev_message/doterrain). Game look functions (do_look, lookat, waterbody_name) TODO |
| `[a]` | pickup.c | pickup.js | Picking up items. handlePickup/handleLoot/handlePay/handleTogglePickup (dopickup/doloot/dopay/dotogglepickup); pay is a stub; ~50 functions TODO |
| `[a]` | pline.c | pline.js | Message output. pline, custompline, vpline, Norep, urgent_pline, raw_printf, vraw_printf, impossible, livelog_printf, gamelog_add, verbalize, You/Your/You_feel/You_cant/You_hear/You_see/pline_The/There, pline_dir/pline_xy/pline_mon, set_msg_dir/set_msg_xy, dumplogmsg/dumplogfreemessages, execplinehandler, nhassert_failed, You_buf/free_youbuf all implemented. putmesg semantics handled via setOutputContext |
| `[~]` | polyself.c | polyself.js | Polymorphing |
| `[~]` | potion.c | potion.js | Potion effects. handleQuaff (dodrink) with name-string matching for healing/gain level. Intrinsic timeout system: itimeout/set_itimeout/incr_itimeout. Status effect functions: make_confused/stunned/blinded/sick/hallucinated/vomiting/deaf/glib/slimed/stoned (all match C structure with Unaware check, Sick_resistance, partial cure logic, Halluc_resistance mask param). peffects dispatcher with 18 peffect_* functions for all potion types. Resistance checks for FREE_ACTION (sleeping/paralysis), ACID_RES (acid). healup with curesick/cureblind params. Remaining gaps: handleQuaff not yet using peffects dispatcher, unkn/identification tracking, speed_up(), vision system calls, vapors/throwing/dipping/mixing. |
| `[~]` | pray.c | pray.js | Prayer mechanics, sacrifice, turning undead, deity interaction. All 45 functions TODO (runtime gameplay) |
| `[~]` | priest.c | priest.js | Priest behavior, temple management, shrine, minion roamers. move_special() PARTIAL in monmove.js:679; all other functions TODO |
| `[~]` | quest.c | quest.js | Quest mechanics. All 22 functions are runtime gameplay (NPC dialog, eligibility, expulsion); none in JS |
| `[~]` | questpgr.c | questpgr.js | Quest text pager. com_pager_core N/A (Lua interpreter); is_quest_artifact PARTIAL in objdata.js:54; all other functions TODO |
| `[a]` | read.c | read.js | Reading scrolls/spellbooks. handleRead (doread) with spellbook study + seffects dispatcher + all 22 scroll effects implemented; some effects approximate (teleportation, mapping, detection need infrastructure) |
| `[x]` | rect.c | rect.js | Rectangle allocation for room placement |
| `[~]` | region.c | region.js | Region effects (gas clouds, etc.). No runtime regions in JS; all functions TODO |
| `[N/A]` | report.c | — | Bug reporting, panic trace |
| `[~]` | restore.c | restore.js | Game state restoration. All functions N/A (JS uses storage.js/IndexedDB with different format) |
| `[a]` | rip.c | display.js | RIP screen. genl_outrip as Display.renderTombstone (method); center() inlined |
| `[x]` | rnd.c | rng.js | Random number generation |
| `[~]` | role.c | role.js | Role/race/gender/alignment selection. roles[] data in player.js; ok_role/ok_race/ok_align PARTIAL in nethack.js; role_init PARTIAL in nethack.js+u_init.js; Hello() in player.js; all others TODO |
| `[~]` | rumors.c | rumors.js | Rumor/oracle/CapitalMon system. JS: `rumor_data.js` (data); unpadline/init_rumors/get_rnd_line in `hacklib.js`; getrumor inlined in `dungeon.js`; outoracle/doconsult/CapitalMon TODO |
| `[~]` | save.c | save.js | Game state serialization. N/A (JS uses storage.js/IndexedDB); handleSave in storage.js |
| `[a]` | selvar.c | — | Selection geometry. JS: `selection` object in `sp_lev.js`. All major geometry functions aligned including ellipse/gradient/is_irregular/size_description |
| `[N/A]` | sfbase.c | — | Save file base I/O routines |
| `[N/A]` | sfstruct.c | — | Save file structure definitions |
| `[a]` | shk.c | shk.js | Shopkeeper behavior. describeGroundObjectForPlayer (xname-based), maybeHandleShopEntryMessage, getprice/getCost/getShopQuoteForFloorObject (pricing approximations); shknam.js has naming. ~90 functions TODO |
| `[a]` | shknam.c | shknam.js | Shop naming and stocking. All C functions aligned; hallucination in shkname/is_izchak and in_town() in is_izchak deferred |
| `[~]` | sit.c | sit.js | Sitting effects. All 7 functions (dosit, rndcurse, attrcurse, take_gold, throne_sit_effect, special_throne_effect, lay_an_egg) are TODO stubs |
| `[~]` | sounds.c | sounds.js | Monster sounds, ambient room sounds, chat. dosounds() partial in nethack.js/headless_runtime.js; domonnoise/growl/yelp/whimper/beg/dotalk TODO; sound library N/A |
| `[~]` | sp_lev.c | sp_lev.js | Special level interpreter |
| `[a]` | spell.c | spell.js | Spell casting. ageSpells (age_spells), handleKnownSpells (dovspell/dospellmenu), estimateSpellFailPercent (percent_success approximation), spellRetentionText (spellretention). Spell category/skill tables from C. ~40 functions TODO |
| `[~]` | stairs.c | stairs.js | Stairway management. JS uses map.upstair/dnstair objects; u_on_upstairs/dnstairs → getArrivalPosition in do.js; stairway_find_*, On_stairs_*, stairs_description TODO |
| `[~]` | steal.c | steal.js | Monster stealing. `findgold` in makemon.js; drop logic partially inline in monmove.js; all steal/mpickobj/relobj/mdrop_obj unimplemented |
| `[~]` | steed.c | steed.js | Riding steeds. put_saddle_on_mon partially inline in u_init.js; all 15 functions are TODO stubs |
| `[N/A]` | strutil.c | — | String utilities (strbuf, pmatch). JS: native string ops |
| `[N/A]` | symbols.c | — | Terminal graphics mode management (ASCII/IBM/curses/UTF-8 symbol-set switching). Browser port uses static data in symbols.js; no runtime mode switching |
| `[N/A]` | sys.c | — | System-level interface |
| `[~]` | teleport.c | teleport.js | Teleportation. goodpos/collect_coords/enexto PARTIAL in dungeon.js; all runtime tele functions TODO |
| `[~]` | timeout.c | timeout.js | Timer-based effects. Full timer queue: run_timers, start/stop/peek/insert/remove_timer, obj_move/split/stop_timers, obj_has_timer, spot timers, done_timeout, egg/figurine/burn timers, fall_asleep. nh_timeout() has intrinsic timeout decrement loop matching C structure: calls dialogue functions before decrement, then on expiry fires effect via _fireExpiryEffect with full switch covering STONED/SLIMED/STRANGLED death, SICK death-or-recovery (CON check), CONFUSION/STUNNED/BLINDED/DEAF/HALLUC set-to-1-then-clear pattern, FAST slow message, INVIS expiry message, FUMBLING re-increment, VOMITING/GLIB/WOUNDED_LEGS/DISPLACED/PASSES_WALLS/DETECT_MONSTERS handlers. Dialogue stubs exported for stoned/vomiting/sleep/choke/sickness/levitation/slime/phaze. Remaining gaps: full dialogue countdown text sequences, float_down for levitation, vision system calls |
| `[a]` | topten.c | topten.js | High score table. observable_depth implemented; I/O funcs N/A; encode/format funcs TODO |
| `[p]` | track.c | track.js | Player tracking for pets. save/rest not yet implemented |
| `[a]` | trap.c | trap.js | Trap mechanics: m_harmless_trap, floor_trigger, mintrap_postmove, mon_check_in_air |
| `[a]` | u_init.c | u_init.js | Player initialization. u_init_role, u_init_race, u_init_carry_attr_boost, trquan, ini_inv, ini_inv_mkobj_filter, restricted_spell_discipline aligned. JS-only wrappers: simulatePostLevelInit, initAttributes |
| `[a]` | uhitm.c | uhitm.js | Hero-vs-monster combat. playerAttackMonster, all mhitm_ad_* handlers (40+), mhitm_adtyping dispatcher, mhitm_mgc_atk_negated, mhitm_knockback (with eligibility + messages) implemented; 50 functions TODO |
| `[N/A]` | utf8map.c | — | UTF-8 glyph mapping for terminal |
| `[~]` | vault.c | `vault.js` | Vault guard behavior |
| `[N/A]` | version.c | — | Version info |
| `[a]` | vision.c | vision.js | FOV / LOS. Core algorithm (view_from, right_side, left_side, clear_path, do_clear_area) matches C. block_point/dig_point/rogue_vision TODO |
| `[~]` | weapon.c | `weapon.js` | Weapon skills, hit/damage bonuses, monster weapon AI. abon→player.strToHit, dbon→player.strDamage (player.js); select_rwep partial in mthrowu.js. |
| `[a]` | were.c | were.js | Lycanthropy. 6 of 8 functions aligned; you_were/you_unwere TODO (need polymon/rehumanize) |
| `[~]` | wield.c | `wield.js` | Wielding weapons. setuwep/setuswapwep/setuqwep, uwepgone/uswapwepgone/uqwepgone, welded/weldmsg, ready_weapon, can_twoweapon(stub). handleWield/handleSwapWeapon/handleQuiver. Two-weapon combat, chwepon, corpse petrify, wield_tool TODO. |
| `[N/A]` | windows.c | — | Windowing system interface. JS: `display.js`, `browser_input.js` |
| `[~]` | wizard.c | wizard.js | Wizard of Yendor AI. All 21 functions are runtime gameplay AI; none implemented in JS |
| `[a]` | wizcmds.c | wizcmds.js | Wizard-mode debug commands. handleWizLoadDes (wiz_load_splua), wizLevelChange (wiz_level_change), wizMap (wiz_map), wizTeleport (wiz_level_tele), wizGenesis (wiz_genesis); Lua commands N/A; sanity checks and advanced debug TODO |
| `[~]` | worm.c | worm.js | Long worm mechanics. save/rest_worm are N/A (no save file). All 24 other functions are TODO stubs |
| `[~]` | worn.c | `worn.js` | Equipment slot management |
| `[a]` | write.c | write.js | Writing on scrolls. cost, write_ok, new_book_description implemented; dowrite TODO |
| `[a]` | zap.c | zap.js | Wand beam effects. zhitm, zap_hit, resist (faithful alev/dlev), burnarmor, xkilled, corpse_chance, dobuzz implemented. dozap/weffects/bhitm/revive/polyuse and many others TODO |

### Summary

- **Total C files**: 129
- **N/A (system/platform)**: 22
- **Game logic files**: 107
- **Complete (`[x]`)**: 4
- **Aligned (`[a]`)**: 46
- **Present (`[p]`)**: 1
- **Needs alignment (`[~]`)**: 57
- **No JS file yet (`[ ]`)**: 0

### JS Files Without C Counterparts

These JS files don't directly correspond to a single C file:

| JS File | Purpose | C Counterparts |
|---------|---------|----------------|
| animation_examples.js | Animation demo data | None (JS-only) |
| animations.js | Visual animations | None (JS-only) |
| attrib_exercise.js | Attribute exercise tracking | attrib.c |
| browser_input.js | Browser keyboard/mouse input | None (JS-only) |
| cmd.js | Command dispatch | cmd.c |
| config.js | Game configuration | decl.c, options.c |
| delay.js | Delay/animation timing | None (JS-only) |
| discovery.js | Object identification, handleDiscoveries, handleCallObjectTypePrompt | o_init.c, invent.c |
| display_rng.js | Display-layer RNG | rnd.c |
| engrave_data.js | Engraving text data | engrave.c |
| epitaph_data.js | Epitaph text data | engrave.c |
| floor_objects.js | Floor object display | pickup.c, invent.c |
| headless_runtime.js | Headless test runtime | None (JS-only) |
| input.js | Input handling/replay | None (JS-only) |
| keylog.js | Keystroke logging | None (JS-only) |
| hack.js | Core movement/running/travel | hack.c |
| kick.js | Kick command | dokick.c |
| map.js | Map data structure | hack.c, mklev.c |
| menace.js | Main game entry point | allmain.c |
| monsters.js | Monster data tables | monst.c |
| nethack.js | Game orchestration | allmain.c |
| objdata.js | Object property queries | objnam.c, mkobj.c |
| options_menu.js | Options UI and handleSet | options.c |
| player.js | Player state and roles | role.c, decl.c |
| replay_core.js | Session replay/comparison | None (JS-only, test infra) |
| rumor_data.js | Rumor text data | rumors.c |
| special_levels.js | Special level registry | sp_lev.c, extralev.c |
| shk.js | Shopkeeper pricing/messages | shk.c |
| spell.js | Spell system | spell.c |
| storage.js | Save/load/config, handleSave | save.c, restore.c, files.c |
| xoshiro256.js | Xoshiro256 PRNG | None (JS-only, display RNG) |

---

## Function-Level Details

This section is generated from source symbol tables and includes function rows for every C file in this document.

### allmain.c -> allmain.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1001 | `argcheck` | - | Missing |
| 1124 | `debug_fields` | - | Missing |
| 907 | `do_positionbar` | - | Missing |
| 1259 | `dump_enums` | - | Missing |
| 1356 | `dump_glyphids` | - | Missing |
| 36 | `early_init` | - | Missing |
| 697 | `init_sound_disp_gamewindows` | - | Missing |
| 950 | `interrupt_multi` | - | Missing |
| 566 | `maybe_do_tutorial` | - | Missing |
| 586 | `moveloop` | - | Missing |
| 169 | `moveloop_core` | - | Missing |
| 50 | `moveloop_preamble` | - | Missing |
| 764 | `newgame` | - | Missing |
| 621 | `regen_hp` | - | Missing |
| 599 | `regen_pw` | - | Missing |
| 680 | `stop_occupation` | - | Missing |
| 1182 | `timet_delta` | - | Missing |
| 1173 | `timet_to_seconds` | - | Missing |
| 116 | `u_calc_moveamt` | - | Missing |
| 851 | `welcome` | - | Missing |

### alloc.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 266 | `FITSint_` | - | Missing |
| 276 | `FITSuint_` | - | Missing |
| 238 | `dupstr` | - | Missing |
| 253 | `dupstr_n` | - | Missing |
| 125 | `fmt_ptr` | - | Missing |
| 142 | `heapmon_init` | - | Missing |
| 152 | `nhalloc` | - | Missing |
| 219 | `nhdupstr` | - | Missing |
| 205 | `nhfree` | - | Missing |
| 170 | `nhrealloc` | - | Missing |
| 85 | `re_alloc` | - | Missing |

### apply.c -> apply.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 4146 | `apply_ok` | - | Missing |
| 993 | `beautiful` | - | Missing |
| 3884 | `broken_wand_explode` | - | Missing |
| 3367 | `calc_pole_range` | - | Missing |
| 3697 | `can_grapple_location` | - | Missing |
| 1573 | `catch_lit` | - | Missing |
| 1858 | `check_jump` | - | Missing |
| 927 | `check_leash` | - | Missing |
| 3387 | `could_pole_mon` | - | Missing |
| 3872 | `discard_broken_wand` | - | Missing |
| 3703 | `display_grapple_positions` | - | Missing |
| 1963 | `display_jump_positions` | - | Missing |
| 3330 | `display_polearm_positions` | - | Missing |
| 61 | `do_blinding_ray` | - | Missing |
| 3905 | `do_break_wand` | - | Missing |
| 4209 | `doapply` | - | Missing |
| 1843 | `dojump` | - | Missing |
| 1781 | `dorub` | - | Missing |
| 2394 | `fig_transform` | - | Missing |
| 2507 | `figurine_location_checks` | - | Missing |
| 3279 | `find_poleable_mon` | - | Missing |
| 4522 | `flip_coin` | - | Missing |
| 4468 | `flip_through_book` | - | Missing |
| 876 | `get_mleash` | - | Missing |
| 1955 | `get_valid_jump_position` | - | Missing |
| 3317 | `get_valid_polearm_position` | - | Missing |
| 3682 | `grapple_range` | - | Missing |
| 2581 | `grease_ok` | - | Missing |
| 1889 | `is_valid_jump_pos` | - | Missing |
| 198 | `its_dead` | - | Missing |
| 3603 | `jelly_ok` | - | Missing |
| 1984 | `jump` | - | Missing |
| 757 | `leashable` | - | Missing |
| 1699 | `light_cocktail` | - | Missing |
| 722 | `m_unleash` | - | Missing |
| 518 | `magic_whistled` | - | Missing |
| 3893 | `maybe_dunk_boulders` | - | Missing |
| 887 | `mleashed_next2u` | - | Missing |
| 915 | `next_to_u` | - | Missing |
| 694 | `number_leashed` | - | Missing |
| 707 | `o_unleash` | - | Missing |
| 2809 | `reset_trapset` | - | Missing |
| 1766 | `rub_ok` | - | Missing |
| 2912 | `set_trap` | - | Missing |
| 3412 | `snickersnee_used_dist_attk` | - | Missing |
| 1468 | `snuff_candle` | - | Missing |
| 1493 | `snuff_lit` | - | Missing |
| 1514 | `splash_lit` | - | Missing |
| 2163 | `tinnable` | - | Missing |
| 2654 | `touchstone_ok` | - | Missing |
| 688 | `um_dist` | - | Missing |
| 4426 | `unfixable_trouble_count` | - | Missing |
| 742 | `unleash_all` | - | Missing |
| 1198 | `use_bell` | - | Missing |
| 79 | `use_camera` | - | Missing |
| 1315 | `use_candelabrum` | - | Missing |
| 1383 | `use_candle` | - | Missing |
| 3564 | `use_cream_pie` | - | Missing |
| 2540 | `use_figurine` | - | Missing |
| 3725 | `use_grapple` | - | Missing |
| 2600 | `use_grease` | - | Missing |
| 1624 | `use_lamp` | - | Missing |
| 765 | `use_leash` | - | Missing |
| 817 | `use_leash_core` | - | Missing |
| 495 | `use_magic_whistle` | - | Missing |
| 1014 | `use_mirror` | - | Missing |
| 3422 | `use_pole` | - | Missing |
| 3612 | `use_royal_jelly` | - | Missing |
| 318 | `use_stethoscope` | - | Missing |
| 2676 | `use_stone` | - | Missing |
| 2173 | `use_tinning_kit` | - | Missing |
| 112 | `use_towel` | - | Missing |
| 2817 | `use_trap` | - | Missing |
| 2255 | `use_unicorn_horn` | - | Missing |
| 2951 | `use_whip` | - | Missing |
| 476 | `use_whistle` | - | Missing |

### artifact.c -> artifact.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1249 | `Mb_hit` | - | Missing |
| 2466 | `Sting_effects` | - | Missing |
| 2320 | `abil_to_adtyp` | - | Missing |
| 2344 | `abil_to_spfx` | - | Missing |
| 2309 | `arti_cost` | - | Missing |
| 979 | `arti_immune` | - | Missing |
| 2131 | `arti_invoke` | - | Missing |
| 2106 | `arti_invoke_cost` | - | Missing |
| 2091 | `arti_invoke_cost_pw` | - | Missing |
| 537 | `arti_reflects` | - | Missing |
| 2279 | `arti_speak` | - | Missing |
| 371 | `artifact_exists` | - | Missing |
| 2299 | `artifact_has_invprop` | - | Missing |
| 1447 | `artifact_hit` | - | Missing |
| 2264 | `artifact_light` | - | Missing |
| 329 | `artifact_name` | - | Missing |
| 478 | `artifact_origin` | - | Missing |
| 151 | `artiname` | - | Missing |
| 626 | `attacks` | - | Missing |
| 993 | `bane_applies` | - | Missing |
| 526 | `confers_luck` | - | Missing |
| 2708 | `count_surround_traps` | - | Missing |
| 636 | `defends` | - | Missing |
| 687 | `defends_when_carried` | - | Missing |
| 1113 | `discover_artifact` | - | Missing |
| 1147 | `disp_artifact_discoveries` | - | Missing |
| 312 | `dispose_of_orig_obj` | - | Missing |
| 1749 | `doinvoke` | - | Missing |
| 1177 | `dump_artifact_info` | - | Missing |
| 356 | `exist_artifact` | - | Missing |
| 422 | `find_artifact` | - | Missing |
| 2236 | `finesse_ahriman` | - | Missing |
| 409 | `found_artifact` | - | Missing |
| 2821 | `get_artifact` | - | Missing |
| 2427 | `glow_color` | - | Missing |
| 2442 | `glow_strength` | - | Missing |
| 2451 | `glow_verb` | - | Missing |
| 87 | `hack_artifacts` | - | Missing |
| 2790 | `has_magic_key` | - | Missing |
| 111 | `init_artifacts` | - | Missing |
| 1963 | `invoke_banish` | - | Missing |
| 2054 | `invoke_blinding_ray` | - | Missing |
| 1848 | `invoke_charge_obj` | - | Missing |
| 1934 | `invoke_create_ammo` | - | Missing |
| 1867 | `invoke_create_portal` | - | Missing |
| 1818 | `invoke_energy_boost` | - | Missing |
| 2022 | `invoke_fling_poison` | - | Missing |
| 1780 | `invoke_healing` | - | Missing |
| 1727 | `invoke_ok` | - | Missing |
| 2040 | `invoke_storm_spell` | - | Missing |
| 1769 | `invoke_taming` | - | Missing |
| 1838 | `invoke_untrap` | - | Missing |
| 2808 | `is_art` | - | Missing |
| 2775 | `is_magic_key` | - | Missing |
| 172 | `mk_artifact` | - | Missing |
| 2753 | `mkot_trap_warn` | - | Missing |
| 462 | `nartifact_exist` | - | Missing |
| 1762 | `nothing_special` | - | Missing |
| 2837 | `permapoisoned` | - | Missing |
| 698 | `protects` | - | Missing |
| 133 | `restore_artifacts` | - | Missing |
| 575 | `restrict_name` | - | Missing |
| 2640 | `retouch_equipment` | - | Missing |
| 2508 | `retouch_object` | - | Missing |
| 119 | `save_artifacts` | - | Missing |
| 716 | `set_artifact_intrinsic` | - | Missing |
| 555 | `shade_glare` | - | Missing |
| 516 | `spec_ability` | - | Missing |
| 1076 | `spec_abon` | - | Missing |
| 1009 | `spec_applies` | - | Missing |
| 1091 | `spec_dbon` | - | Missing |
| 1065 | `spec_m2` | - | Missing |
| 908 | `touch_artifact` | - | Missing |
| 1131 | `undiscovered_artifact` | - | Missing |
| 2598 | `untouchable` | - | Missing |
| 2376 | `what_gives` | - | Missing |

### attrib.c -> attrib.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1197 | `acurr` | - | Missing |
| 1242 | `acurrstr` | - | Missing |
| 1003 | `adjabil` | - | Missing |
| 1295 | `adjalign` | - | Missing |
| 117 | `adjattrib` | - | Missing |
| 1179 | `adjuhploss` | - | Missing |
| 408 | `change_luck` | - | Missing |
| 815 | `check_innate_abil` | - | Missing |
| 595 | `exerchk` | - | Missing |
| 486 | `exercise` | - | Missing |
| 518 | `exerper` | - | Missing |
| 1265 | `extremeattr` | - | Missing |
| 902 | `from_what` | - | Missing |
| 200 | `gainstr` | - | Missing |
| 720 | `init_attr` | - | Missing |
| 696 | `init_attr_role_redist` | - | Missing |
| 861 | `innately` | - | Missing |
| 877 | `is_innate` | - | Missing |
| 218 | `losestr` | - | Missing |
| 1144 | `minuhpmax` | - | Missing |
| 1077 | `newhp` | - | Missing |
| 271 | `poison_strdmg` | - | Missing |
| 314 | `poisoned` | - | Missing |
| 291 | `poisontell` | - | Missing |
| 777 | `postadjabil` | - | Missing |
| 737 | `redist_attr` | - | Missing |
| 452 | `restore_attrib` | - | Missing |
| 679 | `rnd_attr` | - | Missing |
| 786 | `role_abil` | - | Missing |
| 438 | `set_moreluck` | - | Missing |
| 1154 | `setuhpmax` | - | Missing |
| 420 | `stone_luck` | - | Missing |
| 1317 | `uchangealign` | - | Missing |
| 761 | `vary_init_attr` | - | Missing |

### ball.c -> ball.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 327 | `Lift_covet_and_placebc` | - | Missing |
| 259 | `Placebc` | - | Missing |
| 287 | `Unplacebc` | - | Missing |
| 306 | `Unplacebc_and_covet_placebc` | - | Missing |
| 43 | `ballfall` | - | Missing |
| 23 | `ballrelease` | - | Missing |
| 354 | `bc_order` | - | Missing |
| 1034 | `bc_sanity_check` | - | Missing |
| 180 | `check_restriction` | - | Missing |
| 560 | `drag_ball` | - | Missing |
| 986 | `drag_down` | - | Missing |
| 882 | `drop_ball` | - | Missing |
| 236 | `lift_covet_and_placebc` | - | Missing |
| 965 | `litter` | - | Missing |
| 437 | `move_bc` | - | Missing |
| 193 | `placebc` | - | Missing |
| 120 | `placebc_core` | - | Missing |
| 380 | `set_bc` | - | Missing |
| 212 | `unplacebc` | - | Missing |
| 222 | `unplacebc_and_covet_placebc` | - | Missing |
| 147 | `unplacebc_core` | - | Missing |

### bones.c -> bones.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 752 | `bones_include_name` | - | Missing |
| 356 | `can_make_bones` | - | Missing |
| 259 | `drop_upon_death` | - | Missing |
| 786 | `fix_ghostly_obj` | - | Missing |
| 308 | `fixuporacle` | - | Missing |
| 823 | `free_ebones` | - | Missing |
| 629 | `getbones` | - | Missing |
| 226 | `give_to_nearby_mon` | - | Missing |
| 42 | `goodfruit` | - | Missing |
| 808 | `newebones` | - | Missing |
| 390 | `remove_mon_from_bones` | - | Missing |
| 51 | `resetobjs` | - | Missing |
| 198 | `sanitize_name` | - | Missing |
| 403 | `savebones` | - | Missing |
| 774 | `set_ghostly_objlist` | - | Missing |

### botl.c -> botl.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 4215 | `all_options_statushilites` | - | Missing |
| 1629 | `anything_to_s` | - | Missing |
| 1903 | `bl_idx_to_fldname` | - | Missing |
| 256 | `bot` | - | Missing |
| 744 | `bot_via_windowport` | - | Missing |
| 422 | `botl_score` | - | Missing |
| 43 | `check_gold_symbol` | - | Missing |
| 3094 | `clear_status_hilites` | - | Missing |
| 1556 | `compare_blstats` | - | Missing |
| 1086 | `cond_cmp` | - | Missing |
| 1129 | `cond_menu` | - | Missing |
| 2884 | `conditionbitmask2str` | - | Missing |
| 1056 | `condopt` | - | Missing |
| 3220 | `count_status_hilites` | - | Missing |
| 444 | `describe_level` | - | Missing |
| 51 | `do_statusline1` | - | Missing |
| 104 | `do_statusline2` | - | Missing |
| 1246 | `eval_notify_windowport_field` | - | Missing |
| 1374 | `evaluate_and_notify_windowport` | - | Missing |
| 1833 | `exp_percent_changing` | - | Missing |
| 1795 | `exp_percentage` | - | Missing |
| 1964 | `fldname_to_bl_indx` | - | Missing |
| 2107 | `get_hilite` | - | Missing |
| 24 | `get_strength_str` | - | Missing |
| 2416 | `has_ltgt_percentnumber` | - | Missing |
| 2000 | `hilite_reset_needed` | - | Missing |
| 3112 | `hlattr2attrname` | - | Missing |
| 1506 | `init_blstats` | - | Missing |
| 2473 | `is_fld_arrayvalues` | - | Missing |
| 2395 | `is_ltgt_percentnumber` | - | Missing |
| 2914 | `match_str2conditionbitmask` | - | Missing |
| 405 | `max_rank_sz` | - | Missing |
| 1099 | `menualpha_cmp` | - | Missing |
| 2079 | `noneoftheabove` | - | Missing |
| 1213 | `opt_next_cond` | - | Missing |
| 1107 | `parse_cond_option` | - | Missing |
| 2976 | `parse_condition` | - | Missing |
| 2336 | `parse_status_hl1` | - | Missing |
| 2557 | `parse_status_hl2` | - | Missing |
| 1720 | `percentage` | - | Missing |
| 2490 | `query_arrayvalue` | - | Missing |
| 2852 | `query_conditions` | - | Missing |
| 364 | `rank` | - | Missing |
| 335 | `rank_of` | - | Missing |
| 318 | `rank_to_xlev` | - | Missing |
| 1913 | `repad_with_dashes` | - | Missing |
| 2064 | `reset_status_hilites` | - | Missing |
| 1673 | `s_to_anything` | - | Missing |
| 2319 | `split_clridx` | - | Missing |
| 2431 | `splitsubfields` | - | Missing |
| 1874 | `stat_cap_indx` | - | Missing |
| 1889 | `stat_hunger_indx` | - | Missing |
| 1038 | `stat_update_time` | - | Missing |
| 2022 | `status_eval_next_unhilite` | - | Missing |
| 1470 | `status_finish` | - | Missing |
| 3333 | `status_hilite2str` | - | Missing |
| 2527 | `status_hilite_add_threshold` | - | Missing |
| 3160 | `status_hilite_linestr_add` | - | Missing |
| 3205 | `status_hilite_linestr_countfield` | - | Missing |
| 3191 | `status_hilite_linestr_done` | - | Missing |
| 3313 | `status_hilite_linestr_gather` | - | Missing |
| 3231 | `status_hilite_linestr_gather_conditions` | - | Missing |
| 4236 | `status_hilite_menu` | - | Missing |
| 3633 | `status_hilite_menu_add` | - | Missing |
| 3450 | `status_hilite_menu_choose_behavior` | - | Missing |
| 3415 | `status_hilite_menu_choose_field` | - | Missing |
| 3554 | `status_hilite_menu_choose_updownboth` | - | Missing |
| 4095 | `status_hilite_menu_fld` | - | Missing |
| 4043 | `status_hilite_remove` | - | Missing |
| 4194 | `status_hilites_viewall` | - | Missing |
| 1433 | `status_initialize` | - | Missing |
| 2952 | `str2conditionbitmask` | - | Missing |
| 278 | `timebot` | - | Missing |
| 370 | `title_to_mon` | - | Missing |
| 301 | `xlev_to_rank` | - | Missing |

### calendar.c -> calendar.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 215 | `friday_13th` | - | Missing |
| 47 | `getlt` | - | Missing |
| 32 | `getnow` | - | Missing |
| 55 | `getyear` | - | Missing |
| 86 | `hhmmss` | - | Missing |
| 232 | `midnight` | - | Missing |
| 224 | `night` | - | Missing |
| 200 | `phase_of_the_moon` | - | Missing |
| 126 | `time_from_yyyymmddhhmmss` | - | Missing |
| 62 | `yyyymmdd` | - | Missing |
| 101 | `yyyymmddhhmmss` | - | Missing |

### cfgfiles.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 439 | `adjust_prefix` | - | Missing |
| 1887 | `assure_syscf_file` | - | Missing |
| 1435 | `can_read_file` | - | Missing |
| 462 | `choose_random_part` | - | Missing |
| 1119 | `cnf_line_ACCESSIBILITY` | - | Missing |
| 623 | `cnf_line_AUTOCOMPLETE` | - | Missing |
| 610 | `cnf_line_AUTOPICKUP_EXCEPTION` | - | Missing |
| 617 | `cnf_line_BINDINGS` | - | Missing |
| 693 | `cnf_line_BONESDIR` | - | Missing |
| 872 | `cnf_line_BONES_POOLS` | - | Missing |
| 1154 | `cnf_line_BOULDER` | - | Missing |
| 913 | `cnf_line_CHECK_PLNAME` | - | Missing |
| 904 | `cnf_line_CHECK_SAVE_UID` | - | Missing |
| 737 | `cnf_line_CONFIGDIR` | - | Missing |
| 1110 | `cnf_line_CRASHREPORTURL` | - | Missing |
| 704 | `cnf_line_DATADIR` | - | Missing |
| 837 | `cnf_line_DEBUGFILES` | - | Missing |
| 850 | `cnf_line_DUMPLOGFILE` | - | Missing |
| 993 | `cnf_line_ENTRYMAX` | - | Missing |
| 828 | `cnf_line_EXPLORERS` | - | Missing |
| 1080 | `cnf_line_GDBPATH` | - | Missing |
| 863 | `cnf_line_GENERICUSERS` | - | Missing |
| 1095 | `cnf_line_GREPPATH` | - | Missing |
| 636 | `cnf_line_HACKDIR` | - | Missing |
| 944 | `cnf_line_HIDEUSAGE` | - | Missing |
| 1168 | `cnf_line_HILITE_STATUS` | - | Missing |
| 651 | `cnf_line_LEVELDIR` | - | Missing |
| 1033 | `cnf_line_LIVELOG` | - | Missing |
| 726 | `cnf_line_LOCKDIR` | - | Missing |
| 953 | `cnf_line_MAXPLAYERS` | - | Missing |
| 1019 | `cnf_line_MAX_STATUENAME_RANK` | - | Missing |
| 1162 | `cnf_line_MENUCOLOR` | - | Missing |
| 819 | `cnf_line_MSGHANDLER` | - | Missing |
| 630 | `cnf_line_MSGTYPE` | - | Missing |
| 759 | `cnf_line_NAME` | - | Missing |
| 601 | `cnf_line_OPTIONS` | - | Missing |
| 1065 | `cnf_line_PANICTRACE_GDB` | - | Missing |
| 1050 | `cnf_line_PANICTRACE_LIBC` | - | Missing |
| 967 | `cnf_line_PERSMAX` | - | Missing |
| 980 | `cnf_line_PERS_IS_UID` | - | Missing |
| 1006 | `cnf_line_POINTSMIN` | - | Missing |
| 1132 | `cnf_line_PORTABLE_DEVICE_PATHS` | - | Missing |
| 1278 | `cnf_line_QT_COMPACT` | - | Missing |
| 1264 | `cnf_line_QT_FONTSIZE` | - | Missing |
| 1250 | `cnf_line_QT_TILEHEIGHT` | - | Missing |
| 1236 | `cnf_line_QT_TILEWIDTH` | - | Missing |
| 895 | `cnf_line_RECOVER` | - | Missing |
| 1189 | `cnf_line_ROGUESYMBOLS` | - | Missing |
| 766 | `cnf_line_ROLE` | - | Missing |
| 671 | `cnf_line_SAVEDIR` | - | Missing |
| 715 | `cnf_line_SCOREDIR` | - | Missing |
| 922 | `cnf_line_SEDUCE` | - | Missing |
| 810 | `cnf_line_SHELLERS` | - | Missing |
| 1228 | `cnf_line_SOUND` | - | Missing |
| 1219 | `cnf_line_SOUNDDIR` | - | Missing |
| 886 | `cnf_line_SUPPORT` | - | Missing |
| 1200 | `cnf_line_SYMBOLS` | - | Missing |
| 748 | `cnf_line_TROUBLEDIR` | - | Missing |
| 1179 | `cnf_line_WARNINGS` | - | Missing |
| 793 | `cnf_line_WIZARDS` | - | Missing |
| 1211 | `cnf_line_WIZKIT` | - | Missing |
| 783 | `cnf_line_catname` | - | Missing |
| 776 | `cnf_line_dogname` | - | Missing |
| 1669 | `cnf_parser_done` | - | Missing |
| 1654 | `cnf_parser_init` | - | Missing |
| 1536 | `config_erradd` | - | Missing |
| 1857 | `config_error_add` | - | Missing |
| 1584 | `config_error_done` | - | Missing |
| 1462 | `config_error_init` | - | Missing |
| 1485 | `config_error_nextline` | - | Missing |
| 167 | `do_write_config_file` | - | Missing |
| 586 | `find_optparam` | - | Missing |
| 221 | `fopen_config_file` | - | Missing |
| 505 | `free_config_sections` | - | Missing |
| 141 | `get_configfile` | - | Missing |
| 147 | `get_default_configfile` | - | Missing |
| 379 | `get_uchars` | - | Missing |
| 550 | `handle_config_section` | - | Missing |
| 521 | `is_config_section` | - | Missing |
| 1508 | `l_get_config_errors` | - | Missing |
| 1685 | `parse_conf_buf` | - | Missing |
| 1836 | `parse_conf_file` | - | Missing |
| 1802 | `parse_conf_str` | - | Missing |
| 1384 | `parse_config_line` | - | Missing |
| 1616 | `read_config_file` | - | Missing |
| 214 | `set_configfile_name` | - | Missing |
| 1867 | `vconfig_error_add` | - | Missing |

### cmd.c -> cmd.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 3560 | `accept_menu_prefix` | - | Missing |
| 4704 | `act_on_act` | - | Missing |
| 3344 | `all_options_autocomplete` | - | Missing |
| 2758 | `bind_key` | - | Missing |
| 2790 | `bind_key_fn` | - | Missing |
| 2720 | `bind_mousebtn` | - | Missing |
| 3242 | `bind_specialkey` | - | Missing |
| 647 | `can_do_extcmd` | - | Missing |
| 4952 | `click_to_cmd` | - | Missing |
| 3079 | `cmd_from_dir` | - | Missing |
| 3119 | `cmd_from_ecname` | - | Missing |
| 3086 | `cmd_from_func` | - | Missing |
| 3154 | `cmdname_from_func` | - | Missing |
| 478 | `cmdq_add_dir` | - | Missing |
| 438 | `cmdq_add_ec` | - | Missing |
| 519 | `cmdq_add_int` | - | Missing |
| 458 | `cmdq_add_key` | - | Missing |
| 500 | `cmdq_add_userinput` | - | Missing |
| 615 | `cmdq_clear` | - | Missing |
| 571 | `cmdq_copy` | - | Missing |
| 608 | `cmdq_peek` | - | Missing |
| 594 | `cmdq_pop` | - | Missing |
| 557 | `cmdq_reverse` | - | Missing |
| 539 | `cmdq_shift` | - | Missing |
| 2808 | `commands_init` | - | Missing |
| 4346 | `confdir` | - | Missing |
| 3360 | `count_autocompletions` | - | Missing |
| 2360 | `count_bind_keys` | - | Missing |
| 4359 | `directionname` | - | Missing |
| 1874 | `do_fight` | cmd.js:rhack (F prefix) | Aligned |
| 1684 | `do_move_east` | - | Missing |
| 1670 | `do_move_north` | - | Missing |
| 1677 | `do_move_northeast` | - | Missing |
| 1663 | `do_move_northwest` | - | Missing |
| 1698 | `do_move_south` | - | Missing |
| 1691 | `do_move_southeast` | - | Missing |
| 1705 | `do_move_southwest` | - | Missing |
| 1656 | `do_move_west` | - | Missing |
| 1890 | `do_repeat` | - | Missing |
| 1827 | `do_reqmenu` | cmd.js:rhack (m prefix) | Aligned |
| 1858 | `do_run` | hack.js:handleRun | APPROX |
| 1798 | `do_run_east` | - | Missing |
| 1784 | `do_run_north` | - | Missing |
| 1791 | `do_run_northeast` | - | Missing |
| 1777 | `do_run_northwest` | - | Missing |
| 1812 | `do_run_south` | - | Missing |
| 1805 | `do_run_southeast` | - | Missing |
| 1819 | `do_run_southwest` | - | Missing |
| 1770 | `do_run_west` | - | Missing |
| 1842 | `do_rush` | hack.js:handleRun (rush) | APPROX |
| 1741 | `do_rush_east` | - | Missing |
| 1727 | `do_rush_north` | - | Missing |
| 1734 | `do_rush_northeast` | - | Missing |
| 1720 | `do_rush_northwest` | - | Missing |
| 1755 | `do_rush_south` | - | Missing |
| 1748 | `do_rush_southeast` | - | Missing |
| 1762 | `do_rush_southwest` | - | Missing |
| 1713 | `do_rush_west` | - | Missing |
| 708 | `doc_extcmd_flagstr` | - | Missing |
| 5425 | `doclicklook` | - | Missing |
| 677 | `doextcmd` | cmd.js:handleExtendedCommand | APPROX — handles #commands subset |
| 746 | `doextlist` | - | Missing |
| 4380 | `doherecmdmenu` | - | Missing |
| 2917 | `dokeylist` | - | Missing |
| 1577 | `dolookaround` | - | Missing |
| 1530 | `dolookaround_floodfill_findroom` | - | Missing |
| 1074 | `domonability` | - | Missing |
| 4962 | `domouseaction` | - | Missing |
| 342 | `doprev_message` | pager.js:handlePrevMessages | Aligned |
| 5726 | `dosh_core` | - | Missing |
| 5706 | `dosuspend_core` | - | Missing |
| 1365 | `doterrain` | - | Missing |
| 4389 | `dotherecmdmenu` | - | Missing |
| 5343 | `dotravel` | hack.js:handleTravel | APPROX — cursor-based travel |
| 5392 | `dotravel_target` | cmd.js:rhack (ch=31) | APPROX — retravel via stored destination |
| 3907 | `dtoxy` | - | Missing |
| 5743 | `dummyfunction` | - | Missing |
| 3949 | `dxdy_moveok` | - | Missing |
| 3140 | `ecname_from_fn` | - | Missing |
| 5227 | `end_of_input` | - | Missing |
| 1136 | `enter_explore_mode` | - | Missing |
| 3066 | `ext_func_tab_from_func` | - | Missing |
| 641 | `extcmd_initiator` | - | Missing |
| 936 | `extcmd_via_menu` | - | Missing |
| 2351 | `extcmds_getentry` | - | Missing |
| 2622 | `extcmds_match` | - | Missing |
| 3977 | `get_adjacent_loc` | - | Missing |
| 2374 | `get_changed_key_binds` | - | Missing |
| 5056 | `get_count` | - | Missing |
| 4004 | `getdir` | - | Missing |
| 2548 | `handler_change_autocompletions` | - | Missing |
| 2507 | `handler_rebind_keys` | - | Missing |
| 2405 | `handler_rebind_keys_add` | - | Missing |
| 5203 | `hangup` | - | Missing |
| 175 | `harness_dump_checkpoint` | - | Missing |
| 4217 | `help_dir` | - | Missing |
| 4945 | `here_cmd_menu` | - | Missing |
| 4372 | `isok` | - | Missing |
| 155 | `json_write_escaped` | - | Missing |
| 2660 | `key2extcmddesc` | - | Missing |
| 3273 | `key2txt` | - | Missing |
| 2843 | `keylist_func_has_key` | - | Missing |
| 2859 | `keylist_putcmds` | - | Missing |
| 1356 | `levltyp_to_name` | - | Missing |
| 3374 | `lock_mouse_buttons` | - | Missing |
| 1543 | `lookaround_known_room` | - | Missing |
| 1170 | `makemap_prepost` | - | Missing |
| 4467 | `mcmd_addmenu` | - | Missing |
| 3917 | `movecmd` | - | Missing |
| 5699 | `paranoid_query` | - | Missing |
| 5632 | `paranoid_ynq` | - | Missing |
| 5142 | `parse` | - | Missing |
| 3292 | `parseautocomplete` | - | Missing |
| 629 | `pgetchar` | - | Missing |
| 3632 | `random_response` | - | Missing |
| 3568 | `randomkey` | - | Missing |
| 5320 | `readchar` | - | Missing |
| 5257 | `readchar_core` | - | Missing |
| 5332 | `readchar_poskey` | - | Missing |
| 3958 | `redraw_cmd` | - | Missing |
| 3658 | `reset_cmd_vars` | - | Missing |
| 3392 | `reset_commands` | - | Missing |
| 377 | `reset_occupations` | - | Missing |
| 3678 | `rhack` | cmd.js:rhack | APPROX — dispatches all commands, missing many C bindings |
| 3652 | `rnd_extcmd_idx` | - | Missing |
| 1639 | `set_move_cmd` | - | Missing |
| 388 | `set_occupation` | - | Missing |
| 4168 | `show_direction_keys` | - | Missing |
| 3256 | `spkey_name` | - | Missing |
| 4889 | `there_cmd_menu` | - | Missing |
| 4685 | `there_cmd_menu_common` | - | Missing |
| 4670 | `there_cmd_menu_far` | - | Missing |
| 4570 | `there_cmd_menu_next2u` | - | Missing |
| 4481 | `there_cmd_menu_self` | - | Missing |
| 350 | `timed_occupation` | - | Missing |
| 1513 | `u_can_see_whole_selection` | - | Missing |
| 1480 | `u_have_seen_bounds_selection` | - | Missing |
| 1462 | `u_have_seen_whole_selection` | - | Missing |
| 3534 | `update_rest_on_space` | - | Missing |
| 1258 | `wiz_dumpmap` | - | Missing |
| 1292 | `wiz_dumpobj` | - | Missing |
| 1322 | `wiz_dumpsnap` | - | Missing |
| 3895 | `xytod` | - | Missing |
| 5446 | `yn_func_menu_opt` | - | Missing |
| 5515 | `yn_function` | - | Missing |
| 5463 | `yn_function_menu` | - | Missing |
| 5438 | `yn_menuable_resp` | - | Missing |

### coloratt.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 606 | `add_menu_coloring` | - | Missing |
| 574 | `add_menu_coloring_parsed` | - | Missing |
| 1100 | `alt_color_spec` | - | Missing |
| 1037 | `alternative_palette` | - | Missing |
| 309 | `attr2attrname` | - | Missing |
| 519 | `basic_menu_colors` | - | Missing |
| 1087 | `change_palette` | - | Missing |
| 712 | `check_enhanced_colors` | - | Missing |
| 986 | `closest_color` | - | Missing |
| 327 | `clr2colorname` | - | Missing |
| 250 | `color_attr_parse_str` | - | Missing |
| 238 | `color_attr_to_str` | - | Missing |
| 968 | `color_distance` | - | Missing |
| 226 | `colortable_to_int32` | - | Missing |
| 1025 | `count_alt_palette` | - | Missing |
| 698 | `count_menucolors` | - | Missing |
| 653 | `free_menu_coloring` | - | Missing |
| 673 | `free_one_menu_coloring` | - | Missing |
| 1013 | `get_nhcolor_from_256_index` | - | Missing |
| 363 | `match_str2attr` | - | Missing |
| 338 | `match_str2clr` | - | Missing |
| 790 | `onlyhexdigits` | - | Missing |
| 385 | `query_attr` | - | Missing |
| 464 | `query_color` | - | Missing |
| 293 | `query_color_attr` | - | Missing |
| 802 | `rgbstr_to_int32` | - | Missing |
| 857 | `set_map_customcolor` | - | Missing |
| 753 | `wc_color_name` | - | Missing |

### date.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 134 | `free_nomakedefs` | - | Missing |
| 52 | `populate_nomakedefs` | - | Missing |

### dbridge.c -> dbridge.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 361 | `E_phrase` | - | Missing |
| 464 | `automiss` | - | Missing |
| 753 | `close_drawbridge` | - | Missing |
| 235 | `create_drawbridge` | - | Missing |
| 116 | `db_under_typ` | - | Missing |
| 866 | `destroy_drawbridge` | - | Missing |
| 532 | `do_entity` | - | Missing |
| 286 | `e_at` | - | Missing |
| 402 | `e_died` | - | Missing |
| 509 | `e_jumps` | - | Missing |
| 474 | `e_missed` | - | Missing |
| 351 | `e_nam` | - | Missing |
| 380 | `e_survives_at` | - | Missing |
| 180 | `find_drawbridge` | - | Missing |
| 211 | `get_wall_for_db` | - | Missing |
| 170 | `is_db_wall` | - | Missing |
| 137 | `is_drawbridge_wall` | - | Missing |
| 86 | `is_ice` | - | Missing |
| 62 | `is_lava` | - | Missing |
| 100 | `is_moat` | - | Missing |
| 46 | `is_pool` | - | Missing |
| 77 | `is_pool_or_lava` | - | Missing |
| 38 | `is_waterwall` | - | Missing |
| 304 | `m_to_e` | - | Missing |
| 741 | `nokiller` | - | Missing |
| 818 | `open_drawbridge` | - | Missing |
| 330 | `set_entity` | - | Missing |
| 321 | `u_to_e` | - | Missing |

### decl.c -> decl.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1066 | `decl_globals_init` | - | Missing |
| 1185 | `sa_victual` | - | Missing |

### detect.c -> detect.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 107 | `browse_map` | - | Missing |
| 263 | `check_map_spot` | - | Missing |
| 319 | `clear_stale_map` | - | Missing |
| 1590 | `cvt_sdoor_to_door` | - | Missing |
| 908 | `detect_obj_traps` | - | Missing |
| 1930 | `detecting` | - | Missing |
| 957 | `display_trap_map` | - | Missing |
| 1423 | `do_mapping` | - | Missing |
| 1449 | `do_vicinity_map` | - | Missing |
| 2098 | `dosearch` | - | Missing |
| 2017 | `dosearch0` | detect.js:dosearch0 | RNG-PARITY — search for hidden doors/traps |
| 2295 | `dump_map` | - | Missing |
| 1936 | `find_trap` | - | Missing |
| 1793 | `findit` | - | Missing |
| 1640 | `findone` | - | Missing |
| 480 | `food_detect` | - | Missing |
| 1611 | `foundone` | - | Missing |
| 1092 | `furniture_detect` | - | Missing |
| 336 | `gold_detect` | - | Missing |
| 1143 | `level_distance` | - | Missing |
| 123 | `map_monst` | - | Missing |
| 95 | `map_redisplay` | - | Missing |
| 1966 | `mfind0` | - | Missing |
| 799 | `monster_detect` | - | Missing |
| 202 | `o_in` | - | Missing |
| 230 | `o_material` | - | Missing |
| 604 | `object_detect` | - | Missing |
| 250 | `observe_recursively` | - | Missing |
| 1903 | `openit` | - | Missing |
| 1730 | `openone` | - | Missing |
| 2135 | `premap_detect` | - | Missing |
| 86 | `reconstrain_map` | - | Missing |
| 2357 | `reveal_terrain` | - | Missing |
| 2168 | `reveal_terrain_getglyph` | - | Missing |
| 866 | `sense_trap` | - | Missing |
| 1373 | `show_map_spot` | - | Missing |
| 2125 | `skip_premap_detect` | - | Missing |
| 1012 | `trap_detect` | - | Missing |
| 140 | `trapped_chest_at` | - | Missing |
| 183 | `trapped_door_at` | - | Missing |
| 71 | `unconstrain_map` | - | Missing |
| 1207 | `use_crystal_ball` | - | Missing |
| 2108 | `warnreveal` | - | Missing |

### dig.c -> dig.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1763 | `adj_pit_checks` | - | Missing |
| 1885 | `buried_ball` | - | Missing |
| 1958 | `buried_ball_to_freedom` | - | Missing |
| 1935 | `buried_ball_to_punishment` | - | Missing |
| 1984 | `bury_an_obj` | - | Missing |
| 2193 | `bury_monst` | - | Missing |
| 2273 | `bury_obj` | - | Missing |
| 2050 | `bury_objs` | - | Missing |
| 2212 | `bury_you` | - | Missing |
| 300 | `dig` | - | Missing |
| 207 | `dig_check` | - | Missing |
| 169 | `dig_typ` | - | Missing |
| 1027 | `dig_up_grave` | - | Missing |
| 640 | `digactualhole` | - | Missing |
| 255 | `digcheck_fail_message` | - | Missing |
| 885 | `dighole` | - | Missing |
| 1504 | `draft_message` | - | Missing |
| 2241 | `escape_tomb` | - | Missing |
| 606 | `fillholetyp` | - | Missing |
| 571 | `furniture_handled` | - | Missing |
| 597 | `holetime` | - | Missing |
| 195 | `is_digging` | - | Missing |
| 838 | `liquid_flow` | - | Missing |
| 1414 | `mdig_tunnel` | - | Missing |
| 88 | `mkcavearea` | - | Missing |
| 48 | `mkcavepos` | - | Missing |
| 141 | `pick_can_reach` | - | Missing |
| 1844 | `pit_flow` | - | Missing |
| 30 | `rm_waslit` | - | Missing |
| 2146 | `rot_corpse` | - | Missing |
| 2125 | `rot_organic` | - | Missing |
| 2086 | `unearth_objs` | - | Missing |
| 2230 | `unearth_you` | - | Missing |
| 1092 | `use_pick_axe` | - | Missing |
| 1162 | `use_pick_axe2` | - | Missing |
| 1377 | `watch_dig` | - | Missing |
| 1362 | `watchman_canseeu` | - | Missing |
| 2288 | `wiz_debug_cmd_bury` | - | Missing |
| 1548 | `zap_dig` | - | Missing |

### display.c -> display.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 2305 | `back_to_glyph` | - | Missing |
| 201 | `canseemon` | - | Missing |
| 3148 | `check_pos` | - | Missing |
| 2125 | `clear_glyph_buffer` | - | Missing |
| 2207 | `cls` | - | Missing |
| 2717 | `cmap_to_roguecolor` | - | Missing |
| 1689 | `curs_on_u` | - | Missing |
| 527 | `display_monster` | - | Missing |
| 647 | `display_warning` | - | Missing |
| 1704 | `docrt` | - | Missing |
| 1711 | `docrt_flags` | - | Missing |
| 1696 | `doredraw` | - | Missing |
| 3132 | `error4` | - | Missing |
| 759 | `feel_location` | - | Missing |
| 739 | `feel_newsym` | - | Missing |
| 1309 | `flash_glyph_at` | - | Missing |
| 2226 | `flush_screen` | - | Missing |
| 3815 | `fn_cmap_to_glyph` | - | Missing |
| 2525 | `get_bkglyph_and_framecolor` | - | Missing |
| 2496 | `glyph_at` | - | Missing |
| 2505 | `glyphinfo_at` | - | Missing |
| 215 | `is_safemon` | - | Missing |
| 208 | `knowninvisible` | - | Missing |
| 233 | `magic_map_background` | - | Missing |
| 279 | `map_background` | - | Missing |
| 313 | `map_engraving` | - | Missing |
| 2612 | `map_glyphinfo` | - | Missing |
| 391 | `map_invisible` | - | Missing |
| 488 | `map_location` | - | Missing |
| 333 | `map_object` | - | Missing |
| 296 | `map_trap` | - | Missing |
| 1534 | `mimic_light_blocking` | - | Missing |
| 681 | `mon_overrides_region` | - | Missing |
| 187 | `mon_visible` | - | Missing |
| 180 | `mon_warning` | - | Missing |
| 3165 | `more_than_one` | - | Missing |
| 931 | `newsym` | - | Missing |
| 1865 | `newsym_force` | - | Missing |
| 1780 | `redraw_map` | - | Missing |
| 1820 | `reglyph_darkroom` | - | Missing |
| 2757 | `reset_glyphmap` | - | Missing |
| 2165 | `row_refresh` | - | Missing |
| 1491 | `see_monsters` | - | Missing |
| 1578 | `see_nearby_objects` | - | Missing |
| 1560 | `see_objects` | - | Missing |
| 1613 | `see_traps` | - | Missing |
| 194 | `see_with_infrared` | - | Missing |
| 173 | `sensemon` | - | Missing |
| 3226 | `set_corn` | - | Missing |
| 3258 | `set_crosswall` | - | Missing |
| 1550 | `set_mimic_blocking` | - | Missing |
| 3387 | `set_seenv` | - | Missing |
| 3180 | `set_twall` | - | Missing |
| 3205 | `set_wall` | - | Missing |
| 3348 | `set_wall_state` | - | Missing |
| 1114 | `shieldeff` | - | Missing |
| 1879 | `show_glyph` | - | Missing |
| 495 | `show_mon_or_warn` | - | Missing |
| 728 | `suppress_map_output` | - | Missing |
| 2455 | `swallow_to_glyph` | - | Missing |
| 1336 | `swallowed` | - | Missing |
| 3471 | `t_warn` | - | Missing |
| 1131 | `tether_glyph` | - | Missing |
| 1178 | `tmp_at` | - | Missing |
| 3126 | `type_to_name` | - | Missing |
| 1449 | `under_ground` | - | Missing |
| 1399 | `under_water` | - | Missing |
| 401 | `unmap_invisible` | - | Missing |
| 422 | `unmap_object` | - | Missing |
| 3402 | `unset_seenv` | - | Missing |
| 3531 | `wall_angle` | - | Missing |
| 667 | `warning_of` | - | Missing |
| 3294 | `xy_set_wall_state` | - | Missing |
| 2479 | `zapdir_to_glyph` | - | Missing |

### dlb.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 263 | `build_dlb_filename` | - | Missing |
| 218 | `close_library` | - | Missing |
| 447 | `dlb_cleanup` | - | Missing |
| 483 | `dlb_fclose` | - | Missing |
| 529 | `dlb_fgetc` | - | Missing |
| 519 | `dlb_fgets` | - | Missing |
| 456 | `dlb_fopen` | - | Missing |
| 499 | `dlb_fread` | - | Missing |
| 509 | `dlb_fseek` | - | Missing |
| 539 | `dlb_ftell` | - | Missing |
| 429 | `dlb_init` | - | Missing |
| 175 | `find_file` | - | Missing |
| 252 | `lib_dlb_cleanup` | - | Missing |
| 292 | `lib_dlb_fclose` | - | Missing |
| 381 | `lib_dlb_fgetc` | - | Missing |
| 349 | `lib_dlb_fgets` | - | Missing |
| 273 | `lib_dlb_fopen` | - | Missing |
| 299 | `lib_dlb_fread` | - | Missing |
| 324 | `lib_dlb_fseek` | - | Missing |
| 391 | `lib_dlb_ftell` | - | Missing |
| 232 | `lib_dlb_init` | - | Missing |
| 201 | `open_library` | - | Missing |
| 127 | `readlibdir` | - | Missing |

### do.c -> do.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 947 | `better_not_try_to_drop_that` | - | Missing |
| 50 | `boulder_hits_pool` | - | Missing |
| 665 | `canletgo` | - | Missing |
| 2314 | `cmd_safety_prevention` | - | Missing |
| 1348 | `currentlevel_rewrite` | - | Missing |
| 2308 | `danger_uprops` | - | Missing |
| 2065 | `deferred_goto` | - | Missing |
| 363 | `doaltarobj` | - | Missing |
| 924 | `doddrop` | - | Missing |
| 1131 | `dodown` | - | Missing |
| 29 | `dodrop` | - | Missing |
| 2347 | `donull` | - | Missing |
| 498 | `dosinkring` | - | Missing |
| 1298 | `doup` | - | Missing |
| 2386 | `dowipe` | - | Missing |
| 714 | `drop` | - | Missing |
| 786 | `dropx` | - | Missing |
| 800 | `dropy` | - | Missing |
| 807 | `dropz` | - | Missing |
| 849 | `engulfer_digests_food` | - | Missing |
| 1448 | `familiar_level_msg` | - | Missing |
| 2033 | `final_level` | - | Missing |
| 162 | `flooreffects` | - | Missing |
| 1479 | `goto_level` | - | Missing |
| 2445 | `heal_legs` | - | Missing |
| 1993 | `hellish_smoke_mesg` | - | Missing |
| 2404 | `legs_in_no_shape` | - | Missing |
| 2022 | `maybe_lvltport_feedback` | - | Missing |
| 981 | `menu_drop` | - | Missing |
| 964 | `menudrop_split` | - | Missing |
| 893 | `obj_no_longer_held` | - | Missing |
| 404 | `polymorph_sink` | - | Missing |
| 2101 | `revive_corpse` | - | Missing |
| 2241 | `revive_mon` | - | Missing |
| 1375 | `save_currentstate` | - | Missing |
| 2047 | `schedule_goto` | - | Missing |
| 2422 | `set_wounded_legs` | - | Missing |
| 460 | `teleport_sink` | - | Missing |
| 2006 | `temperature_change_msg` | - | Missing |
| 395 | `trycall` | - | Missing |
| 1412 | `u_collide_m` | - | Missing |
| 1110 | `u_stuck_cannot_go` | - | Missing |
| 2357 | `wipeoff` | - | Missing |
| 2288 | `zombify_mon` | - | Missing |

### do_name.c -> do_name.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1142 | `Adjmonnam` | - | Missing |
| 1159 | `Amonnam` | - | Missing |
| 1289 | `Mgender` | - | Missing |
| 1074 | `Monnam` | - | Missing |
| 1092 | `Some_Monnam` | - | Missing |
| 1133 | `YMonnam` | - | Missing |
| 1152 | `a_monnam` | - | Missing |
| 158 | `alreadynamed` | - | Missing |
| 1415 | `bogon_is_pname` | - | Missing |
| 1369 | `bogusmon` | - | Missing |
| 480 | `call_ok` | - | Missing |
| 133 | `christen_monst` | - | Missing |
| 1557 | `christen_orc` | - | Missing |
| 1526 | `coyotename` | - | Missing |
| 1170 | `distant_monnam` | - | Missing |
| 199 | `do_mgivenname` | - | Missing |
| 290 | `do_oname` | - | Missing |
| 636 | `docall` | - | Missing |
| 605 | `docall_xname` | - | Missing |
| 499 | `docallcmd` | - | Missing |
| 51 | `free_mgivenname` | - | Missing |
| 81 | `free_oname` | - | Missing |
| 1461 | `hcolor` | - | Missing |
| 1493 | `hliquid` | - | Missing |
| 1035 | `l_monnam` | - | Missing |
| 1627 | `lookup_novel` | - | Missing |
| 1110 | `m_monnam` | - | Missing |
| 1254 | `minimal_monnam` | - | Missing |
| 1042 | `mon_nam` | - | Missing |
| 1191 | `mon_nam_too` | - | Missing |
| 1313 | `mon_pmname` | - | Missing |
| 1221 | `monverbself` | - | Missing |
| 105 | `name_from_player` | - | Missing |
| 467 | `name_ok` | - | Missing |
| 679 | `namefloorobj` | - | Missing |
| 31 | `new_mgivenname` | - | Missing |
| 61 | `new_oname` | - | Missing |
| 1083 | `noit_Monnam` | - | Missing |
| 1054 | `noit_mon_nam` | - | Missing |
| 1102 | `noname_monnam` | - | Missing |
| 1611 | `noveltitle` | - | Missing |
| 1321 | `obj_pmname` | - | Missing |
| 429 | `objtyp_is_callable` | - | Missing |
| 372 | `oname` | - | Missing |
| 1303 | `pmname` | - | Missing |
| 1470 | `rndcolor` | - | Missing |
| 772 | `rndghostname` | - | Missing |
| 1389 | `rndmonnam` | - | Missing |
| 1538 | `rndorcname` | - | Missing |
| 1424 | `roguename` | - | Missing |
| 95 | `safe_oname` | - | Missing |
| 1065 | `some_mon_nam` | - | Missing |
| 827 | `x_monnam` | - | Missing |
| 1117 | `y_monnam` | - | Missing |

### do_wear.c -> do_wear.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1085 | `Amulet_off` | 309 | Full: ESP, life saving, strangulation, sleep, unchanging, reflection, breathing, guarding, flying extrinsic toggles |
| 958 | `Amulet_on` | 264 | Full: ESP, life saving, strangulation msg, sleep, change (gender swap), unchanging, reflection, breathing, guarding, flying |
| 934 | `Armor_gone` | - | Missing |
| 904 | `Armor_off` | 259 | No-op (matches C) |
| 882 | `Armor_on` | 258 | No-op (matches C) |
| 1490 | `Blindf_off` | - | Missing |
| 1456 | `Blindf_on` | - | Missing |
| 261 | `Boots_off` | 104 | Speed slow message+makeknown, stealth, fumble clear, levitation. Missing: float_down, water walking sink check |
| 186 | `Boots_on` | 84 | Speed message+makeknown, stealth, fumble timeout, levitation+makeknown. Missing: float_up, water walking |
| 382 | `Cloak_off` | 147 | Stealth, displacement, invisibility+makeknown. Missing: mummy wrapping, alchemy smock acid_res |
| 325 | `Cloak_on` | 124 | Stealth, displacement, invisibility+makeknown, protection+makeknown. Missing: mummy wrapping, oilskin, alchemy smock |
| 645 | `Gloves_off` | 228 | Fumble clear, power STR restore, dexterity. Missing: cockatrice corpse check |
| 575 | `Gloves_on` | 209 | Fumble timeout, power STR=25+makeknown, dexterity |
| 517 | `Helmet_off` | 189 | Brilliance adj_abon reverse, telepathy, dunce cap. Missing: fedora luck, cornuthaum CHA, helm of opposite alignment |
| 433 | `Helmet_on` | 168 | Brilliance adj_abon, telepathy, dunce cap. Missing: fedora luck, cornuthaum, helm of opposite alignment |
| 1450 | `Ring_gone` | - | Missing (wrapper for Ring_off_or_gone with gone=true) |
| 1444 | `Ring_off` | 399 | All 28 ring types with extrinsic toggles. Missing: Ring_off_or_gone shared setworn logic |
| 1342 | `Ring_off_or_gone` | - | Missing (JS uses separate Ring_off) |
| 1237 | `Ring_on` | 366 | All 28 ring types: passive extrinsics, stealth, warning, see_invis, invis, levitation, attribute rings, accuracy/damage, protection+find_ac, shape changers. Uses oldprop via RING_OPROP_MAP. Missing: float_up, self_invis_message, see_monsters, newsym |
| 730 | `Shield_off` | 252 | No-op (matches C) |
| 704 | `Shield_on` | 251 | No-op (matches C) |
| 773 | `Shirt_off` | 256 | No-op (matches C) |
| 754 | `Shirt_on` | 255 | No-op (matches C) |
| 2204 | `accessory_or_armor_on` | - | Missing |
| 3254 | `adj_abon` | 343 | Simplified: clamps attr to [3,25], no racial cap or Fixed_abil check |
| 1218 | `adjust_attrib` | - | Missing (C uses for ring attribute changes; JS uses adj_abon directly) |
| 2006 | `already_wearing` | - | Missing |
| 2012 | `already_wearing2` | - | Missing |
| 3415 | `any_worn_armor_ok` | - | Missing |
| 1766 | `armor_or_accessory_off` | - | Missing |
| 1915 | `armoroff` | - | Missing |
| 2985 | `better_not_take_that_off` | - | Missing |
| 1640 | `cancel_doff` | - | Missing |
| 1659 | `cancel_don` | - | Missing |
| 2025 | `canwearobj` | 107 | Multi-slot validation with layering checks |
| 3424 | `count_worn_armor` | - | Missing |
| 1728 | `count_worn_stuff` | - | Missing |
| 1888 | `cursed` | 141 | cursed_check — prints message, sets bknown |
| 3196 | `destroy_arm` | - | Missing |
| 2819 | `do_takeoff` | - | Missing |
| 3017 | `doddoremarm` | - | Missing |
| 1598 | `doffing` | - | Missing |
| 1569 | `donning` | - | Missing |
| 2449 | `doputon` | 295 | handlePutOn — rings + amulets |
| 1869 | `doremring` | 389 | handleRemove — R command |
| 1828 | `dotakeoff` | 338 | handleTakeOff — multi-slot with layering |
| 2427 | `dowear` | 257 | handleWear — multi-slot with canwearobj |
| 793 | `dragon_armor_handling` | - | Missing |
| 3339 | `equip_ok` | - | Missing |
| 2468 | `find_ac` | 168 | Full AC recalculation |
| 2523 | `glibr` | - | Missing |
| 567 | `hard_helmet` | - | Missing |
| 1857 | `ia_dotakeoff` | - | Missing |
| 3277 | `inaccessible_equipment` | - | Missing |
| 1188 | `learnring` | 349 | Simplified: sets obj.known=true (C also handles discovery tracking) |
| 3184 | `maybe_destroy_armor` | - | Missing |
| 3085 | `menu_remarm` | - | Missing |
| 67 | `off_msg` | - | Missing |
| 75 | `on_msg` | - | Missing |
| 3386 | `puton_ok` | - | Missing |
| 3057 | `remarm_swapwep` | - | Missing |
| 3393 | `remove_ok` | - | Missing |
| 3009 | `reset_remarm` | - | Missing |
| 2691 | `select_off` | - | Missing |
| 1534 | `set_wear` | - | Missing |
| 2625 | `some_armor` | - | Missing |
| 1683 | `stop_donning` | - | Missing |
| 2652 | `stuck_ring` | - | Missing |
| 2895 | `take_off` | - | Missing |
| 3407 | `takeoff_ok` | - | Missing |
| 147 | `toggle_displacement` | - | Missing |
| 106 | `toggle_stealth` | - | Missing |
| 2682 | `unchanger` | - | Missing |
| 3400 | `wear_ok` | - | Missing |
| 607 | `wielding_corpse` | - | Missing |
| 3139 | `wornarm_destroyed` | - | Missing |

### dog.c -> dog.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1358 | `abuse_dog` | - | Missing |
| 934 | `discard_migrations` | - | Missing |
| 991 | `dogfood` | - | Missing |
| 35 | `free_edog` | - | Missing |
| 45 | `initedog` | - | Missing |
| 764 | `keep_mon_accessible` | - | Missing |
| 785 | `keepdogs` | - | Missing |
| 304 | `losedogs` | - | Missing |
| 138 | `make_familiar` | - | Missing |
| 219 | `makedog` | - | Missing |
| 883 | `migrate_to_level` | - | Missing |
| 420 | `mon_arrive` | - | Missing |
| 623 | `mon_catchup_elapsed_time` | - | Missing |
| 725 | `mon_leave` | - | Missing |
| 23 | `newedog` | - | Missing |
| 91 | `pet_type` | - | Missing |
| 104 | `pick_familiar_pm` | - | Missing |
| 287 | `set_mon_lastmove` | - | Missing |
| 1139 | `tamedog` | - | Missing |
| 295 | `update_mlstmv` | - | Missing |
| 1288 | `wary_dog` | - | Missing |

### dogmove.c -> dogmove.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 853 | `best_target` | - | Missing |
| 1394 | `can_reach_location` | - | Missing |
| 1377 | `could_reach_item` | - | Missing |
| 146 | `cursed_object_at` | - | Missing |
| 219 | `dog_eat` | - | Missing |
| 477 | `dog_goal` | - | Missing |
| 356 | `dog_hunger` | - | Missing |
| 394 | `dog_invent` | - | Missing |
| 992 | `dog_move` | - | Missing |
| 157 | `dog_nutrition` | - | Missing |
| 342 | `dog_starve` | - | Missing |
| 709 | `find_friends` | - | Missing |
| 665 | `find_targ` | - | Missing |
| 1463 | `finish_meating` | - | Missing |
| 1477 | `mnum_leashable` | - | Missing |
| 904 | `pet_ranged_attk` | - | Missing |
| 1487 | `quickmimic` | - | Missing |
| 753 | `score_targ` | - | Missing |
| 1433 | `wantdoor` | - | Missing |

### dokick.c -> kick.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 412 | `container_impact_dmg` | - | Missing |
| 1854 | `deliver_obj_to_mon` | - | Missing |
| 1257 | `dokick` | kick.js:handleKick | APPROX — kick command |
| 1943 | `down_gate` | - | Missing |
| 1473 | `drop_to` | - | Missing |
| 295 | `ghitm` | - | Missing |
| 1511 | `impact_drop` | - | Missing |
| 910 | `kick_door` | - | Missing |
| 864 | `kick_dumb` | - | Missing |
| 146 | `kick_monster` | - | Missing |
| 974 | `kick_nondoor` | - | Missing |
| 489 | `kick_object` | - | Missing |
| 881 | `kick_ouch` | - | Missing |
| 794 | `kickstr` | - | Missing |
| 126 | `maybe_kick_monster` | - | Missing |
| 1769 | `obj_delivery` | - | Missing |
| 1909 | `otransit_msg` | - | Missing |
| 508 | `really_kick_object` | - | Missing |
| 1639 | `ship_object` | - | Missing |
| 846 | `watchman_door_damage` | - | Missing |
| 834 | `watchman_thief_arrest` | - | Missing |

### dothrow.c -> dothrow.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 381 | `autoquiver` | - | Missing |
| 2612 | `breakmsg` | - | Missing |
| 2480 | `breakobj` | - | Missing |
| 2444 | `breaks` | - | Missing |
| 2582 | `breaktest` | - | Missing |
| 1181 | `check_shop_obj` | - | Missing |
| 469 | `dofire` | dothrow.js:handleFire | APPROX — fire command |
| 352 | `dothrow` | dothrow.js:handleThrow | APPROX — throw command |
| 590 | `endmultishot` | - | Missing |
| 447 | `find_launcher` | - | Missing |
| 2309 | `gem_accept` | - | Missing |
| 1220 | `harmless_missile` | - | Missing |
| 2417 | `hero_breaks` | - | Missing |
| 606 | `hitfloor` | - | Missing |
| 1078 | `hurtle` | - | Missing |
| 742 | `hurtle_jump` | - | Missing |
| 773 | `hurtle_step` | - | Missing |
| 1130 | `mhurtle` | - | Missing |
| 992 | `mhurtle_step` | - | Missing |
| 297 | `ok_to_throw` | - | Missing |
| 1913 | `omon_adj` | - | Missing |
| 2457 | `release_camera_demon` | - | Missing |
| 1855 | `return_throw_to_inv` | - | Missing |
| 1442 | `sho_obj_return_to_u` | - | Missing |
| 1976 | `should_mulch_missile` | - | Missing |
| 1468 | `swallowit` | - | Missing |
| 2011 | `thitmonst` | - | Missing |
| 2656 | `throw_gold` | - | Missing |
| 87 | `throw_obj` | - | Missing |
| 317 | `throw_ok` | - | Missing |
| 1430 | `throwing_weapon` | - | Missing |
| 1510 | `throwit` | - | Missing |
| 1482 | `throwit_mon_hit` | - | Missing |
| 1460 | `throwit_return` | - | Missing |
| 1951 | `tmiss` | - | Missing |
| 1256 | `toss_up` | - | Missing |
| 656 | `walk_path` | - | Missing |
| 977 | `will_hurtle` | - | Missing |

### drawing.c -> symbols.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 120 | `def_char_is_furniture` | - | Missing |
| 108 | `def_char_to_monclass` | - | Missing |
| 91 | `def_char_to_objclass` | - | Missing |

### dungeon.c -> dungeon.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1643 | `Can_dig_down` | - | Missing |
| 1656 | `Can_fall_thru` | - | Missing |
| 1668 | `Can_rise_up` | - | Missing |
| 268 | `Fread` | - | Missing |
| 1901 | `In_V_tower` | - | Missing |
| 1917 | `In_W_tower` | - | Missing |
| 1936 | `In_hell` | - | Missing |
| 1850 | `In_mines` | - | Missing |
| 1843 | `In_quest` | - | Missing |
| 2011 | `Invocation_lev` | - | Missing |
| 1637 | `Is_botlevel` | - | Missing |
| 1464 | `Is_branchlev` | - | Missing |
| 1448 | `Is_special` | - | Missing |
| 1908 | `On_W_tower_level` | - | Missing |
| 514 | `add_branch` | - | Missing |
| 545 | `add_level` | - | Missing |
| 1972 | `assign_level` | - | Missing |
| 1980 | `assign_rnd_level` | - | Missing |
| 1891 | `at_dgn_entrance` | - | Missing |
| 1695 | `avoid_ceiling` | - | Missing |
| 2234 | `br_string` | - | Missing |
| 3380 | `br_string2` | - | Missing |
| 1477 | `builds_up` | - | Missing |
| 1708 | `ceiling` | - | Missing |
| 2250 | `chr_u_on_lvl` | - | Missing |
| 440 | `correct_branch_type` | - | Missing |
| 2943 | `count_feat_lastseentyp` | - | Missing |
| 1339 | `deepest_lev_reached` | - | Missing |
| 1431 | `depth` | - | Missing |
| 284 | `dname_to_dnum` | - | Missing |
| 2565 | `donamelevel` | - | Missing |
| 3286 | `dooverview` | - | Missing |
| 1864 | `dungeon_branch` | - | Missing |
| 1325 | `dunlev` | - | Missing |
| 1332 | `dunlevs_in_dungeon` | - | Missing |
| 1548 | `earth_sense` | - | Missing |
| 3402 | `endgamelevelname` | - | Missing |
| 311 | `find_branch` | - | Missing |
| 1943 | `find_hell` | - | Missing |
| 300 | `find_level` | - | Missing |
| 2632 | `find_mapseen` | - | Missing |
| 2644 | `find_mapseen_by_str` | - | Missing |
| 1122 | `fixup_level_locations` | - | Missing |
| 2574 | `free_exclusions` | - | Missing |
| 1185 | `free_proto_dungeon` | - | Missing |
| 2472 | `get_annotation` | - | Missing |
| 781 | `get_dgn_align` | - | Missing |
| 744 | `get_dgn_flags` | - | Missing |
| 1796 | `get_level` | - | Missing |
| 1951 | `goto_hell` | - | Missing |
| 1684 | `has_ceiling` | - | Missing |
| 651 | `indent` | - | Missing |
| 1993 | `induced_align` | - | Missing |
| 1111 | `init_castle_tune` | - | Missing |
| 867 | `init_dungeon_branches` | - | Missing |
| 997 | `init_dungeon_dungeons` | - | Missing |
| 797 | `init_dungeon_levels` | - | Missing |
| 960 | `init_dungeon_set_depth` | - | Missing |
| 933 | `init_dungeon_set_entry` | - | Missing |
| 1205 | `init_dungeons` | - | Missing |
| 566 | `init_level` | - | Missing |
| 2827 | `init_mapseen` | - | Missing |
| 463 | `insert_branch` | - | Missing |
| 2872 | `interest_mapseen` | - | Missing |
| 1376 | `ledger_no` | - | Missing |
| 1422 | `ledger_to_dlev` | - | Missing |
| 1402 | `ledger_to_dnum` | - | Missing |
| 2092 | `lev_by_name` | - | Missing |
| 2021 | `level_difficulty` | - | Missing |
| 380 | `level_range` | - | Missing |
| 2609 | `load_exclusions` | - | Missing |
| 2713 | `load_mapseen` | - | Missing |
| 3259 | `mapseen_temple` | - | Missing |
| 1392 | `maxledgerno` | - | Missing |
| 1497 | `next_level` | - | Missing |
| 1439 | `on_level` | - | Missing |
| 2753 | `overview_stats` | - | Missing |
| 415 | `parent_dlevel` | - | Missing |
| 346 | `parent_dnum` | - | Missing |
| 632 | `pick_level` | - | Missing |
| 666 | `place_level` | - | Missing |
| 598 | `possible_places` | - | Missing |
| 1518 | `prev_level` | - | Missing |
| 2257 | `print_branch` | - | Missing |
| 2284 | `print_dungeon` | - | Missing |
| 2483 | `print_level_annotation` | - | Missing |
| 3508 | `print_mapseen` | - | Missing |
| 2494 | `query_annotation` | - | Missing |
| 3067 | `recalc_mapseen` | - | Missing |
| 2440 | `recbranch_mapseen` | - | Missing |
| 2803 | `remdun_mapseen` | - | Missing |
| 211 | `restore_dungeon` | - | Missing |
| 2657 | `rm_mapseen` | - | Missing |
| 3274 | `room_discovered` | - | Missing |
| 149 | `save_dungeon` | - | Missing |
| 2588 | `save_exclusions` | - | Missing |
| 2687 | `save_mapseen` | - | Missing |
| 3360 | `seen_string` | - | Missing |
| 3433 | `shop_string` | - | Missing |
| 3297 | `show_overview` | - | Missing |
| 1961 | `single_level_branch` | - | Missing |
| 1744 | `surface` | - | Missing |
| 2198 | `tport_menu` | - | Missing |
| 3336 | `traverse_mapseenchn` | - | Missing |
| 3452 | `tunesuffix` | - | Missing |
| 1568 | `u_on_newpos` | - | Missing |
| 1599 | `u_on_rndspot` | - | Missing |
| 2169 | `unplaced_floater` | - | Missing |
| 2184 | `unreachable_level` | - | Missing |
| 2919 | `update_lastseentyp` | - | Missing |
| 2935 | `update_mapseen_for` | - | Missing |

### eat.c -> eat.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 141 | `Bitfield` | - | Missing |
| 142 | `Bitfield` | - | Missing |
| 3956 | `Finish_digestion` | - | Missing |
| 1796 | `Hear_again` | - | Missing |
| 3915 | `Popeye` | - | Missing |
| 2253 | `accessory_has_effect` | - | Missing |
| 338 | `adj_victual_nutrition` | - | Missing |
| 3128 | `bite` | - | Missing |
| 2216 | `bounded_increase` | - | Missing |
| 3888 | `cant_finish_meal` | - | Missing |
| 245 | `choke` | - | Missing |
| 3803 | `consume_oeaten` | - | Missing |
| 1528 | `consume_tin` | - | Missing |
| 1339 | `corpse_intrinsic` | - | Missing |
| 1389 | `costly_tin` | - | Missing |
| 1129 | `cpostfx` | - | Missing |
| 791 | `cprefx` | - | Missing |
| 422 | `do_reset_eat` | - | Missing |
| 2812 | `doeat` | - | Missing |
| 2729 | `doeat_nonfood` | - | Missing |
| 544 | `done_eating` | - | Missing |
| 603 | `eat_brains` | - | Missing |
| 3512 | `eat_ok` | - | Missing |
| 2260 | `eataccessory` | - | Missing |
| 1850 | `eatcorpse` | - | Missing |
| 3783 | `eaten_stat` | - | Missing |
| 519 | `eatfood` | - | Missing |
| 576 | `eating_conducts` | - | Missing |
| 475 | `eating_dangerous_corpse` | - | Missing |
| 2073 | `eating_glob` | - | Missing |
| 163 | `eatmdone` | - | Missing |
| 181 | `eatmupdate` | - | Missing |
| 2409 | `eatspecial` | - | Missing |
| 2622 | `edibility_prompts` | - | Missing |
| 1103 | `eye_of_newt_buzz` | - | Missing |
| 867 | `fix_petrification` | - | Missing |
| 3574 | `floorfood` | - | Missing |
| 396 | `food_disappears` | - | Missing |
| 409 | `food_substitution` | - | Missing |
| 217 | `food_xname` | - | Missing |
| 2493 | `foodword` | - | Missing |
| 2505 | `fpostfx` | - | Missing |
| 2094 | `fprefx` | - | Missing |
| 2080 | `garlic_breath` | - | Missing |
| 3158 | `gethungry` | - | Missing |
| 1003 | `givit` | - | Missing |
| 126 | `init_uhunger` | - | Missing |
| 890 | `intrinsic_possible` | - | Missing |
| 91 | `is_edible` | - | Missing |
| 3342 | `is_fainted` | - | Missing |
| 2604 | `leather_cover` | - | Missing |
| 3284 | `lesshungry` | - | Missing |
| 758 | `maybe_cannibal` | - | Missing |
| 500 | `maybe_extend_timed_resist` | - | Missing |
| 3872 | `maybe_finished_meal` | - | Missing |
| 3276 | `morehungry` | - | Missing |
| 3357 | `newuhs` | - | Missing |
| 325 | `obj_nutrition` | - | Missing |
| 3534 | `offer_ok` | - | Missing |
| 1698 | `opentin` | - | Missing |
| 292 | `recalc_wt` | - | Missing |
| 309 | `reset_eat` | - | Missing |
| 3349 | `reset_faint` | - | Missing |
| 1808 | `rottenfood` | - | Missing |
| 1461 | `set_tin_variety` | - | Missing |
| 961 | `should_givit` | - | Missing |
| 2017 | `start_eating` | - | Missing |
| 1718 | `start_tin` | - | Missing |
| 992 | `temp_givit` | - | Missing |
| 453 | `temp_resist` | - | Missing |
| 1428 | `tin_details` | - | Missing |
| 3556 | `tin_ok` | - | Missing |
| 1489 | `tin_variety` | - | Missing |
| 1405 | `tin_variety_txt` | - | Missing |
| 3083 | `tinopen_ok` | - | Missing |
| 360 | `touchfood` | - | Missing |
| 3331 | `unfaint` | - | Missing |
| 3093 | `use_tin_opener` | - | Missing |
| 1516 | `use_up_tin` | - | Missing |
| 1376 | `violated_vegetarian` | - | Missing |
| 3731 | `vomit` | - | Missing |

### end.c -> end.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1898 | `NH_abort` | - | Missing |
| 909 | `artifact_score` | - | Missing |
| 1811 | `bel_copy1` | - | Missing |
| 1825 | `build_english_list` | - | Missing |
| 1596 | `container_contents` | - | Missing |
| 1740 | `dealloc_killer` | - | Missing |
| 1709 | `delayed_killer` | - | Missing |
| 621 | `disclose` | - | Missing |
| 1022 | `done` | - | Missing |
| 71 | `done1` | - | Missing |
| 93 | `done2` | - | Missing |
| 172 | `done_hangup` | - | Missing |
| 188 | `done_in_by` | - | Missing |
| 157 | `done_intr` | - | Missing |
| 853 | `done_object_cleanup` | - | Missing |
| 544 | `dump_everything` | - | Missing |
| 521 | `dump_plines` | - | Missing |
| 1728 | `find_delayed_killer` | - | Missing |
| 369 | `fixup_death` | - | Missing |
| 947 | `fuzzer_savelife` | - | Missing |
| 765 | `get_valuables` | - | Missing |
| 1676 | `nh_terminate` | - | Missing |
| 832 | `odds_and_ends` | - | Missing |
| 1132 | `really_done` | - | Missing |
| 1782 | `restore_killers` | - | Missing |
| 1762 | `save_killers` | - | Missing |
| 706 | `savelife` | - | Missing |
| 479 | `should_query_disclose_option` | - | Missing |
| 800 | `sort_valuables` | - | Missing |
| 1795 | `wordcount` | - | Missing |

### engrave.c -> engrave.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1764 | `blengr` | - | Missing |
| 187 | `can_reach_floor` | - | Missing |
| 218 | `cant_reach_floor` | - | Missing |
| 1644 | `del_engr` | - | Missing |
| 461 | `del_engr_at` | - | Missing |
| 1706 | `disturb_grave` | - | Missing |
| 955 | `doengrave` | engrave.js:handleEngrave | APPROX — engraving command |
| 545 | `doengrave_ctx_init` | - | Missing |
| 895 | `doengrave_ctx_verb` | - | Missing |
| 741 | `doengrave_sfx_item` | - | Missing |
| 583 | `doengrave_sfx_item_WAN` | - | Missing |
| 231 | `engr_at` | engrave.js:engr_at | Aligned |
| 297 | `engr_can_be_felt` | - | Missing |
| 1625 | `engr_stats` | - | Missing |
| 1266 | `engrave` | - | Missing |
| 1523 | `engraving_sanity_check` | - | Missing |
| 1731 | `feel_engraving` | - | Missing |
| 1508 | `forget_engravings` | - | Missing |
| 473 | `freehand` | - | Missing |
| 408 | `make_engr_at` | engrave.js:make_engr_at | Aligned |
| 1686 | `make_grave` | - | Missing |
| 51 | `random_engraving` | - | Missing |
| 318 | `read_engr_at` | - | Missing |
| 1583 | `rest_engravings` | - | Missing |
| 1666 | `rloc_engr` | - | Missing |
| 1497 | `sanitize_engravings` | - | Missing |
| 1550 | `save_engravings` | - | Missing |
| 1723 | `see_engraving` | - | Missing |
| 251 | `sengr_at` | - | Missing |
| 481 | `stylus_ok` | - | Missing |
| 503 | `u_can_engrave` | - | Missing |
| 264 | `u_wipe_engr` | headless_runtime.js, nethack.js | Aligned — calls wipe_engr_at at player pos |
| 271 | `wipe_engr_at` | engrave.js:wipe_engr_at | Aligned — RNG-faithful wipe with rubout table |
| 120 | `wipeout_text` | engrave.js:wipeoutEngravingText | Aligned — C-faithful rubout with rn2(4) per char |

### exper.c -> exper.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 26 | `enermod` | - | Missing (needs Role_switch data from roles.js) |
| 85 | `experience` | - | Missing (needs find_mac, permonst attack data, extra_nasty) |
| 207 | `losexp` | exper.js:losexp | Implemented — RNG-faithful (rnd(10) HP, rn2(5) PW); simplified newhp/newpw (placeholder ranges vs role-dependent) |
| 169 | `more_experienced` | - | Missing (needs u.urexp, flags.showexp, disp.botl) |
| 300 | `newexplevel` | exper.js:newexplevel | Implemented |
| 45 | `newpw` | - | Missing (needs enadv struct data from roles/races) |
| 14 | `newuexp` | exper.js:newuexp | Implemented |
| 307 | `pluslvl` | exper.js:pluslvl | Implemented — RNG-faithful; simplified newhp/newpw (rnd(8)/rn2(3) placeholders vs role-dependent) |
| 378 | `rndexp` | - | Missing (needs LARGEST_INT handling) |

### explode.c -> explode.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 985 | `adtyp_to_expltype` | - | Missing |
| 118 | `engulfer_explosion_msg` | - | Missing |
| 199 | `explode` | - | Missing |
| 972 | `explode_oil` | - | Missing |
| 26 | `explosionmask` | - | Missing |
| 1017 | `mon_explodes` | - | Missing |
| 721 | `scatter` | - | Missing |
| 960 | `splatter_burning_oil` | - | Missing |

### extralev.c -> extralev.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 278 | `corr` | - | Missing |
| 288 | `makerogueghost` | - | Missing |
| 193 | `makeroguerooms` | - | Missing |
| 139 | `miniwalk` | - | Missing |
| 45 | `roguecorr` | - | Missing |
| 21 | `roguejoin` | - | Missing |

### files.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 3621 | `Death_quote` | - | Missing |
| 1291 | `check_panic_save` | - | Missing |
| 2662 | `check_recordfile` | - | Missing |
| 3404 | `choose_passage` | - | Missing |
| 731 | `clearlocks` | - | Missing |
| 518 | `close_nhfile` | - | Missing |
| 905 | `commit_bonesfile` | - | Missing |
| 985 | `compress_bonesfile` | - | Missing |
| 2154 | `contains_directory` | - | Missing |
| 831 | `create_bonesfile` | - | Missing |
| 621 | `create_levelfile` | - | Missing |
| 1138 | `create_savefile` | - | Missing |
| 3094 | `debugcore` | - | Missing |
| 972 | `delete_bonesfile` | - | Missing |
| 2133 | `delete_convertedfile` | - | Missing |
| 717 | `delete_levelfile` | - | Missing |
| 1238 | `delete_savefile` | - | Missing |
| 3058 | `do_deferred_showpaths` | - | Missing |
| 1569 | `docompress_file` | - | Missing |
| 1814 | `docompress_file` | - | Missing |
| 2040 | `doconvert_file` | - | Missing |
| 305 | `fname_decode` | - | Missing |
| 255 | `fname_encode` | - | Missing |
| 444 | `fopen_datafile` | - | Missing |
| 2584 | `fopen_sym_file` | - | Missing |
| 2440 | `fopen_wizkit_file` | - | Missing |
| 354 | `fqname` | - | Missing |
| 509 | `free_nhfile` | - | Missing |
| 1522 | `free_saved_games` | - | Missing |
| 1278 | `get_freeing_nhfile` | - | Missing |
| 1378 | `get_saved_games` | - | Missing |
| 461 | `init_nhfile` | - | Missing |
| 3640 | `livelog_add` | - | Missing |
| 3686 | `livelog_add` | - | Missing |
| 2230 | `lock_file` | - | Missing |
| 1783 | `make_compressed_name` | - | Missing |
| 2066 | `make_converted_name` | - | Missing |
| 2199 | `make_lockname` | - | Missing |
| 496 | `new_nhfile` | - | Missing |
| 199 | `nh_basename` | - | Missing |
| 1765 | `nh_compress` | - | Missing |
| 1774 | `nh_uncompress` | - | Missing |
| 583 | `nhclose` | - | Missing |
| 930 | `open_bonesfile` | - | Missing |
| 672 | `open_levelfile` | - | Missing |
| 1196 | `open_savefile` | - | Missing |
| 2774 | `paniclog` | - | Missing |
| 1336 | `plname_from_file` | - | Missing |
| 1993 | `problematic_savefile` | - | Missing |
| 2537 | `proc_wizkit_line` | - | Missing |
| 2604 | `read_sym_file` | - | Missing |
| 3447 | `read_tribute` | - | Missing |
| 2557 | `read_wizkit` | - | Missing |
| 2838 | `recover_savefile` | - | Missing |
| 1541 | `redirect` | - | Missing |
| 1249 | `restore_saved_game` | - | Missing |
| 3148 | `reveal_paths` | - | Missing |
| 534 | `rewind_nhfile` | - | Missing |
| 1107 | `save_savefile_name` | - | Missing |
| 767 | `set_bonesfile_name` | - | Missing |
| 816 | `set_bonestemp_name` | - | Missing |
| 1116 | `set_error_savefile` | - | Missing |
| 606 | `set_levelfile_name` | - | Missing |
| 999 | `set_savefile_name` | - | Missing |
| 753 | `strcmp_wrap` | - | Missing |
| 2809 | `testinglog` | - | Missing |
| 2391 | `unlock_file` | - | Missing |
| 394 | `validate_prefix_locations` | - | Missing |
| 549 | `viable_nhfile` | - | Missing |
| 2512 | `wizkit_addinv` | - | Missing |

### fountain.c -> fountain.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 581 | `breaksink` | - | Missing |
| 394 | `dipfountain` | - | Missing |
| 716 | `dipsink` | - | Missing |
| 165 | `dofindgem` | - | Missing |
| 120 | `dogushforth` | - | Missing |
| 64 | `dowaterdemon` | - | Missing |
| 94 | `dowaternymph` | - | Missing |
| 38 | `dowatersnakes` | - | Missing |
| 243 | `drinkfountain` | fountain.js:drinkfountain | RNG-PARITY — fountain drinking effects |
| 595 | `drinksink` | - | Missing |
| 201 | `dryup` | fountain.js:dryup | RNG-PARITY — fountain drying up |
| 134 | `gush` | - | Missing |
| 805 | `sink_backs_up` | - | Missing |
| 558 | `wash_hands` | - | Missing |
| 179 | `watchman_warn_fountain` | - | Missing |

### getpos.c -> getpos.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 640 | `auto_describe` | - | Missing |
| 312 | `cmp_coord_distu` | - | Missing |
| 595 | `coord_desc` | - | Missing |
| 557 | `dxdy_to_dist_descr` | - | Missing |
| 513 | `gather_locs` | - | Missing |
| 438 | `gather_locs_interesting` | - | Missing |
| 771 | `getpos` | - | Missing |
| 102 | `getpos_getvalids_selection` | - | Missing |
| 167 | `getpos_help` | - | Missing |
| 137 | `getpos_help_keyxhelp` | - | Missing |
| 665 | `getpos_menu` | - | Missing |
| 753 | `getpos_refresh` | - | Missing |
| 41 | `getpos_sethilite` | - | Missing |
| 72 | `getpos_toggle_hilite_state` | - | Missing |
| 341 | `gloc_filter_classify_glyph` | - | Missing |
| 412 | `gloc_filter_done` | - | Missing |
| 382 | `gloc_filter_floodfill` | - | Missing |
| 364 | `gloc_filter_floodfill_matcharea` | - | Missing |
| 391 | `gloc_filter_init` | - | Missing |
| 422 | `known_vibrating_square_at` | - | Missing |
| 94 | `mapxy_valid` | - | Missing |
| 729 | `truncate_to_map` | - | Missing |

### glyphs.c -> glyphs.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 482 | `add_custom_nhcolor_entry` | - | Missing |
| 370 | `add_glyph_to_cache` | - | Missing |
| 529 | `apply_customizations` | - | Missing |
| 1165 | `clear_all_glyphmap_colors` | - | Missing |
| 795 | `dump_all_glyphids` | - | Missing |
| 1193 | `find_display_sym_customization` | - | Missing |
| 1215 | `find_display_urep_customization` | - | Missing |
| 393 | `find_glyph_in_cache` | - | Missing |
| 416 | `find_glyphid_in_cache_by_glyphnum` | - | Missing |
| 1268 | `find_glyphs` | - | Missing |
| 734 | `find_matching_customization` | - | Missing |
| 184 | `fix_glyphname` | - | Missing |
| 234 | `glyph_find_core` | - | Missing |
| 433 | `glyph_hash` | - | Missing |
| 200 | `glyph_to_cmap` | - | Missing |
| 450 | `glyphid_cache_status` | - | Missing |
| 468 | `glyphrep` | - | Missing |
| 112 | `glyphrep_to_custom_map_entries` | - | Missing |
| 1300 | `glyphs_to_unicode` | - | Missing |
| 333 | `init_glyph_cache` | - | Missing |
| 1262 | `just_find_callback` | - | Missing |
| 456 | `match_glyph` | - | Missing |
| 579 | `maybe_shuffle_customizations` | - | Missing |
| 822 | `parse_id` | - | Missing |
| 749 | `purge_all_custom_entries` | - | Missing |
| 759 | `purge_custom_entries` | - | Missing |
| 589 | `shuffle_customizations` | - | Missing |
| 644 | `shuffle_customizations` | - | Missing |
| 1249 | `test_glyphnames` | - | Missing |
| 53 | `to_custom_symset_entry_callback` | - | Missing |
| 1278 | `to_unicode_callback` | - | Missing |
| 806 | `wizcustom_glyphids` | - | Missing |

### hack.c -> hack.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 2323 | `air_turbulence` | - | Missing |
| 2444 | `avoid_moving_on_liquid` | - | Missing |
| 2425 | `avoid_moving_on_trap` | - | Missing |
| 2476 | `avoid_running_into_trap_or_liquid` | - | Missing |
| 2496 | `avoid_trap_andor_region` | - | Missing |
| 920 | `bad_rock` | - | Missing |
| 4302 | `calc_capacity` | - | Missing |
| 263 | `cannot_push` | - | Missing |
| 248 | `cannot_push_msg` | - | Missing |
| 934 | `cant_squeeze_thru` | - | Missing |
| 2597 | `carrying_too_much` | - | Missing |
| 4329 | `check_capacity` | - | Missing |
| 3511 | `check_special_room` | - | Missing |
| 4416 | `cmp_weights` | - | Missing |
| 146 | `could_move_onto_boulder` | - | Missing |
| 3964 | `crawl_destination` | - | Missing |
| 1779 | `disturb_buried_zombies` | - | Missing |
| 2676 | `domove` | - | Missing |
| 1936 | `domove_attackmon_at` | - | Missing |
| 1906 | `domove_bump_mon` | - | Missing |
| 2693 | `domove_core` | hack.js:handleMovement | APPROX — movement, door auto-open, traps, autopickup |
| 2210 | `domove_fight_empty` | - | Missing |
| 1977 | `domove_fight_ironbars` | - | Missing |
| 2002 | `domove_fight_web` | - | Missing |
| 2079 | `domove_swap_with_pet` | hack.js:handleMovement | APPROX — pet displacement within handleMovement |
| 3948 | `doorless_door` | hack.js:handleMovement | APPROX — inline in handleMovement |
| 3761 | `dopickup` | hack.js:handleMovement | APPROX — autopickup inline in handleMovement |
| 167 | `dopush` | - | Missing |
| 817 | `dosinkfall` | - | Missing |
| 4351 | `dump_weights` | - | Missing |
| 4015 | `end_running` | - | Missing |
| 2620 | `escape_from_sticky_mon` | - | Missing |
| 1247 | `findtravelpath` | hack.js:findPath | APPROX — BFS pathfinding |
| 3367 | `furniture_present` | - | Missing |
| 1833 | `handle_tip` | - | Missing |
| 1768 | `impact_disturbs_zombies` | - | Missing |
| 2406 | `impaired_movement` | - | Missing |
| 3383 | `in_rooms` | - | Missing |
| 3449 | `in_town` | - | Missing |
| 4426 | `inv_cnt` | - | Missing |
| 4281 | `inv_weight` | - | Missing |
| 3045 | `invocation_message` | - | Missing |
| 963 | `invocation_pos` | - | Missing |
| 1507 | `is_valid_travelpt` | - | Missing |
| 82 | `long_to_any` | - | Missing |
| 3783 | `lookaround` | hack.js:checkRunStop | APPROX — run stop conditions |
| 4185 | `losehp` | - | Missing |
| 4321 | `max_capacity` | - | Missing |
| 904 | `may_dig` | - | Missing |
| 913 | `may_passwall` | - | Missing |
| 3001 | `maybe_smudge_engr` | engrave.js:maybeSmudgeEngraving | Aligned — wipes both old and new pos, rnd(5), checks engr_at |
| 4086 | `maybe_wail` | - | Missing |
| 4444 | `money_cnt` | - | Missing |
| 90 | `monst_to_any` | - | Missing |
| 3991 | `monster_nearby` | monutil.js:monsterNearby | Aligned |
| 3351 | `monstinroom` | - | Missing |
| 2567 | `move_out_of_bounds` | - | Missing |
| 3473 | `move_update` | - | Missing |
| 337 | `moverock` | - | Missing |
| 349 | `moverock_core` | - | Missing |
| 328 | `moverock_done` | - | Missing |
| 806 | `movobj` | - | Missing |
| 4315 | `near_capacity` | - | Missing |
| 4036 | `nomul` | - | Missing |
| 1725 | `notice_all_mons` | - | Missing |
| 1689 | `notice_mon` | - | Missing |
| 1716 | `notice_mons_cmp` | - | Missing |
| 98 | `obj_to_any` | - | Missing |
| 3016 | `overexert_hp` | - | Missing |
| 3032 | `overexertion` | - | Missing |
| 3673 | `pickup_checks` | - | Missing |
| 3121 | `pooleffects` | - | Missing |
| 106 | `revive_nasty` | - | Missing |
| 316 | `rock_disappear_msg` | - | Missing |
| 4481 | `rounddiv` | - | Missing |
| 2977 | `runmode_delay_output` | - | Missing |
| 4123 | `saving_grace` | - | Missing |
| 3112 | `set_uinwater` | - | Missing |
| 4176 | `showdamage` | - | Missing |
| 2377 | `slippery_ice_fumbling` | - | Missing |
| 4455 | `spot_checks` | - | Missing |
| 3200 | `spoteffects` | - | Missing |
| 628 | `still_chewing` | - | Missing |
| 1866 | `swim_move_danger` | - | Missing |
| 3072 | `switch_terrain` | - | Missing |
| 972 | `test_move` | - | Missing |
| 1531 | `trapmove` | - | Missing |
| 1798 | `u_locomotion` | - | Missing |
| 2399 | `u_maybe_impaired` | - | Missing |
| 1675 | `u_rooted` | - | Missing |
| 1814 | `u_simple_floortyp` | - | Missing |
| 4052 | `unmul` | - | Missing |
| 2346 | `water_turbulence` | - | Missing |
| 4225 | `weight_cap` | - | Missing |

### hacklib.c -> hacklib.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 267 | `c_eos` | - | Missing |
| 986 | `case_insensitive_comp` | - | Missing |
| 365 | `chrcasecpy` | - | Missing |
| 1004 | `copy_bytes` | - | Missing |
| 351 | `copynchars` | - | Missing |
| 1038 | `datamodel` | - | Missing |
| 126 | `digit` | - | Missing |
| 737 | `dist2` | - | Missing |
| 721 | `distmin` | - | Missing |
| 258 | `eos` | - | Missing |
| 665 | `findword` | - | Missing |
| 849 | `fuzzymatch` | - | Missing |
| 140 | `highc` | - | Missing |
| 427 | `ing_suffix` | - | Missing |
| 746 | `isqrt` | - | Missing |
| 154 | `lcase` | - | Missing |
| 133 | `letter` | - | Missing |
| 147 | `lowc` | - | Missing |
| 206 | `mungspaces` | - | Missing |
| 36 | `nh_deterministic_qsort` | - | Missing |
| 19 | `nh_qsort_idx_cmp` | - | Missing |
| 918 | `nh_snprintf` | - | Missing |
| 768 | `online2` | - | Missing |
| 483 | `onlyspace` | - | Missing |
| 689 | `ordin` | - | Missing |
| 409 | `s_suffix` | - | Missing |
| 714 | `sgn` | - | Missing |
| 702 | `sitoa` | - | Missing |
| 621 | `strNsubst` | - | Missing |
| 305 | `str_end_is` | - | Missing |
| 316 | `str_lines_maxlen` | - | Missing |
| 277 | `str_start_is` | - | Missing |
| 387 | `strcasecpy` | - | Missing |
| 244 | `strip_newline` | - | Missing |
| 563 | `stripchars` | - | Missing |
| 585 | `stripdigits` | - | Missing |
| 340 | `strkitten` | - | Missing |
| 781 | `strncmpi` | - | Missing |
| 804 | `strstri` | - | Missing |
| 600 | `strsubst` | - | Missing |
| 896 | `swapbits` | - | Missing |
| 493 | `tabexpand` | - | Missing |
| 228 | `trimspaces` | - | Missing |
| 166 | `ucase` | - | Missing |
| 946 | `unicodeval_to_utf8str` | - | Missing |
| 178 | `upstart` | - | Missing |
| 187 | `upwords` | - | Missing |
| 533 | `visctrl` | - | Missing |
| 1056 | `what_datamodel_is_this` | - | Missing |
| 464 | `xcrypt` | - | Missing |

### iactions.c -> iactions.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 127 | `ia_addmenu` | - | Missing |
| 46 | `item_naming_classification` | - | Missing |
| 86 | `item_reading_classification` | - | Missing |
| 278 | `itemactions` | - | Missing |
| 140 | `itemactions_pushkeys` | - | Missing |

### insight.c -> insight.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 2516 | `achieve_rank` | - | Missing |
| 3207 | `align_str` | - | Missing |
| 1464 | `attributes_enlightenment` | - | Missing |
| 286 | `attrval` | - | Missing |
| 445 | `background_enlightenment` | - | Missing |
| 705 | `basics_enlightenment` | - | Missing |
| 266 | `cause_known` | - | Missing |
| 804 | `characteristics_enlightenment` | - | Missing |
| 2504 | `count_achievements` | - | Missing |
| 2542 | `do_gamelog` | - | Missing |
| 2014 | `doattributes` | - | Missing |
| 3165 | `doborn` | - | Missing |
| 2086 | `doconduct` | - | Missing |
| 3155 | `dogenocided` | - | Missing |
| 2779 | `dovanquished` | - | Missing |
| 159 | `enlght_combatinc` | - | Missing |
| 200 | `enlght_halfdmg` | - | Missing |
| 126 | `enlght_line` | - | Missing |
| 117 | `enlght_out` | - | Missing |
| 360 | `enlightenment` | - | Missing |
| 313 | `fmt_elapsed_time` | - | Missing |
| 1445 | `item_resistance_message` | - | Missing |
| 3027 | `list_genocided` | - | Missing |
| 2794 | `list_vanquished` | - | Missing |
| 3295 | `mstatusline` | - | Missing |
| 2990 | `num_extinct` | - | Missing |
| 2973 | `num_genocides` | - | Missing |
| 3005 | `num_gone` | - | Missing |
| 823 | `one_characteristic` | - | Missing |
| 3255 | `piousness` | - | Missing |
| 2417 | `record_achievement` | - | Missing |
| 2486 | `remove_achievement` | - | Missing |
| 2728 | `set_vanq_order` | - | Missing |
| 2253 | `show_achievements` | - | Missing |
| 2094 | `show_conduct` | - | Missing |
| 2571 | `show_gamelog` | - | Missing |
| 3223 | `size_str` | - | Missing |
| 2527 | `sokoban_in_play` | - | Missing |
| 917 | `status_enlightenment` | - | Missing |
| 232 | `trap_predicament` | - | Missing |
| 3422 | `ustatusline` | - | Missing |
| 2631 | `vanqsort_cmp` | - | Missing |
| 223 | `walking_on_water` | - | Missing |
| 1247 | `weapon_insight` | - | Missing |
| 2027 | `youhiding` | - | Missing |

### invent.c -> invent.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1152 | `addinv` | - | Missing |
| 1160 | `addinv_before` | - | Missing |
| 1056 | `addinv_core0` | - | Missing |
| 960 | `addinv_core1` | - | Missing |
| 1025 | `addinv_core2` | - | Missing |
| 1169 | `addinv_nomerge` | - | Missing |
| 4927 | `adjust_gold_ok` | - | Missing |
| 4917 | `adjust_ok` | - | Missing |
| 5008 | `adjust_split` | - | Missing |
| 1710 | `any_obj_ok` | - | Missing |
| 2377 | `askchain` | - | Missing |
| 694 | `assigninvlet` | - | Missing |
| 1187 | `carry_obj_effects` | - | Missing |
| 1495 | `carrying` | - | Missing |
| 1508 | `carrying_stoning_corpse` | - | Missing |
| 4889 | `check_invent_gold` | - | Missing |
| 5423 | `cinv_ansimpleoname` | - | Missing |
| 5391 | `cinv_doname` | - | Missing |
| 2143 | `ckunpaid` | - | Missing |
| 2136 | `ckvalidcat` | - | Missing |
| 1627 | `compactify` | - | Missing |
| 1337 | `consume_obj_charge` | - | Missing |
| 3548 | `count_buc` | - | Missing |
| 3620 | `count_contents` | - | Missing |
| 2698 | `count_unidentified` | - | Missing |
| 3526 | `count_unpaid` | - | Missing |
| 1546 | `currency` | - | Missing |
| 3006 | `ddoinv` | - | Missing |
| 1413 | `delallobj` | - | Missing |
| 1430 | `delobj` | - | Missing |
| 1438 | `delobj_core` | - | Missing |
| 4037 | `dfeature_at` | - | Missing |
| 2964 | `dispinv_with_action` | - | Missing |
| 5489 | `display_binventory` | - | Missing |
| 5446 | `display_cinventory` | - | Missing |
| 3428 | `display_inventory` | - | Missing |
| 5341 | `display_minventory` | - | Missing |
| 3057 | `display_pickinv` | - | Missing |
| 3467 | `display_used_invlets` | - | Missing |
| 4319 | `dolook` | - | Missing |
| 4981 | `doorganize` | invent.js:463 | Implemented (inline in item action menu 'i' handler; prompt + letter swap) |
| 5068 | `doorganize_core` | invent.js:463 | Implemented (inline; see doorganize) |
| 2814 | `doperminv` | - | Missing |
| 4679 | `dopramulet` | - | Missing |
| 4601 | `doprarm` | - | Missing |
| 4503 | `doprgold` | - | Missing |
| 4740 | `doprinuse` | - | Missing |
| 4642 | `doprring` | - | Missing |
| 4715 | `doprtool` | - | Missing |
| 4550 | `doprwep` | - | Missing |
| 3827 | `dotypeinv` | - | Missing |
| 3654 | `dounpaid` | - | Missing |
| 4343 | `feel_cockatrice` | - | Missing |
| 3021 | `find_unpaid` | - | Missing |
| 4845 | `free_invbuf` | - | Missing |
| 3044 | `free_pickinv_cache` | - | Missing |
| 1403 | `freeinv` | - | Missing |
| 1356 | `freeinv_core` | - | Missing |
| 2637 | `fully_identify_obj` | - | Missing |
| 1613 | `g_at` | - | Missing |
| 1752 | `getobj` | - | Missing |
| 1719 | `getobj_hands_txt` | - | Missing |
| 2202 | `ggetobj` | - | Missing |
| 1208 | `hold_another_object` | - | Missing |
| 2651 | `identify` | - | Missing |
| 2711 | `identify_pack` | - | Missing |
| 70 | `inuse_classify` | - | Missing |
| 5290 | `invdisp_nothing` | - | Missing |
| 391 | `invletter_value` | - | Missing |
| 2167 | `is_inuse` | - | Missing |
| 2156 | `is_worn` | - | Missing |
| 2750 | `learn_unseen_invent` | - | Missing |
| 4800 | `let_to_name` | - | Missing |
| 4104 | `look_here` | - | Missing |
| 149 | `loot_classify` | - | Missing |
| 309 | `loot_xname` | - | Missing |
| 2660 | `menu_identify` | - | Missing |
| 4379 | `mergable` | - | Missing |
| 775 | `merge_choice` | - | Missing |
| 814 | `merged` | - | Missing |
| 1678 | `mime_action` | - | Missing |
| 4578 | `noarmor` | - | Missing |
| 1479 | `nxtobj` | - | Missing |
| 1587 | `o_on` | - | Missing |
| 1602 | `obj_here` | - | Missing |
| 2861 | `obj_to_let` | - | Missing |
| 5477 | `only_here` | - | Missing |
| 5661 | `perm_invent_toggled` | - | Missing |
| 5549 | `prepare_perminvent` | - | Missing |
| 2875 | `prinv` | - | Missing |
| 4855 | `reassign` | - | Missing |
| 739 | `reorder_invent` | - | Missing |
| 3456 | `repopulate_perminvent` | - | Missing |
| 2552 | `reroll_menu` | - | Missing |
| 2188 | `safeq_shortxprname` | - | Missing |
| 2180 | `safeq_xprname` | - | Missing |
| 2624 | `set_cknown_lknown` | - | Missing |
| 2094 | `silly_thing` | - | Missing |
| 1466 | `sobj_at` | - | Missing |
| 593 | `sortloot` | - | Missing |
| 655 | `sortloot` | - | Missing |
| 403 | `sortloot_cmp` | - | Missing |
| 1664 | `splittable` | - | Missing |
| 4366 | `stackobj` | - | Missing |
| 5565 | `sync_perminvent` | - | Missing |
| 1672 | `taking_off` | - | Missing |
| 3580 | `tally_BUCX` | - | Missing |
| 3793 | `this_type_only` | - | Missing |
| 4698 | `tool_being_used` | - | Missing |
| 1557 | `u_carried_gloves` | - | Missing |
| 1576 | `u_have_novel` | - | Missing |
| 647 | `unsortloot` | - | Missing |
| 2782 | `update_inventory` | - | Missing |
| 1321 | `useup` | - | Missing |
| 1312 | `useupall` | - | Missing |
| 4763 | `useupf` | - | Missing |
| 2149 | `wearing_armor` | - | Missing |
| 4334 | `will_feel_cockatrice` | - | Missing |
| 5309 | `worn_wield_only` | - | Missing |
| 2895 | `xprname` | - | Missing |

### isaac64.c -> isaac64.js
No function symbols parsed from isaac64.c.

### light.c -> light.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 719 | `any_light_source` | - | Missing |
| 916 | `arti_light_description` | - | Missing |
| 881 | `arti_light_radius` | - | Missing |
| 843 | `candle_light_range` | - | Missing |
| 99 | `del_light_source` | - | Missing |
| 142 | `delete_ls` | - | Missing |
| 361 | `discard_flashes` | - | Missing |
| 169 | `do_light_sources` | - | Missing |
| 376 | `find_mid` | - | Missing |
| 606 | `light_sources_sanity_check` | - | Missing |
| 501 | `light_stats` | - | Missing |
| 571 | `maybe_write_ls` | - | Missing |
| 69 | `new_light_core` | - | Missing |
| 826 | `obj_adjust_light_radius` | - | Missing |
| 771 | `obj_is_burning` | - | Missing |
| 808 | `obj_merge_light_sources` | - | Missing |
| 706 | `obj_move_light_source` | - | Missing |
| 763 | `obj_sheds_light` | - | Missing |
| 779 | `obj_split_light_source` | - | Missing |
| 517 | `relink_light_sources` | - | Missing |
| 479 | `restore_light_sources` | - | Missing |
| 421 | `save_light_sources` | - | Missing |
| 257 | `show_transient_light` | - | Missing |
| 729 | `snuff_light_source` | - | Missing |
| 330 | `transient_light_cleanup` | - | Missing |
| 398 | `whereis_mon` | - | Missing |
| 935 | `wiz_light_sources` | - | Missing |
| 634 | `write_ls` | - | Missing |

### lock.c -> lock.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 289 | `autokey` | - | Missing |
| 1056 | `boxlock` | - | Missing |
| 162 | `breakchestlock` | - | Missing |
| 1276 | `chest_shatter_msg` | - | Missing |
| 957 | `doclose` | lock.js:handleClose | APPROX — close door command |
| 676 | `doforce` | lock.js:handleForce | APPROX — force lock command |
| 773 | `doopen` | lock.js:handleOpen | APPROX — open door command |
| 780 | `doopen_indir` | - | Missing |
| 1103 | `doorlock` | - | Missing |
| 216 | `forcelock` | - | Missing |
| 38 | `lock_action` | - | Missing |
| 269 | `maybe_reset_pick` | - | Missing |
| 926 | `obstructed` | - | Missing |
| 358 | `pick_lock` | - | Missing |
| 30 | `picking_at` | - | Missing |
| 17 | `picking_lock` | - | Missing |
| 68 | `picklock` | - | Missing |
| 259 | `reset_pick` | - | Missing |
| 759 | `stumble_on_door_mimic` | - | Missing |
| 660 | `u_have_forceable_weapon` | - | Missing |

### mail.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 685 | `ck_server_admin_msg` | - | Missing |
| 461 | `ckmailstatus` | - | Missing |
| 550 | `ckmailstatus` | - | Missing |
| 744 | `ckmailstatus` | - | Missing |
| 90 | `free_maildata` | - | Missing |
| 97 | `getmailstatus` | - | Missing |
| 288 | `md_rush` | - | Missing |
| 149 | `md_start` | - | Missing |
| 248 | `md_stop` | - | Missing |
| 399 | `newmail` | - | Missing |
| 589 | `read_simplemail` | - | Missing |
| 487 | `readmail` | - | Missing |
| 704 | `readmail` | - | Missing |
| 763 | `readmail` | - | Missing |

### makemon.c -> makemon.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 2010 | `adj_lev` | - | Missing |
| 1608 | `align_shift` | - | Missing |
| 2548 | `bagotricks` | - | Missing |
| 1778 | `check_mongen_order` | - | Missing |
| 839 | `clone_mon` | - | Missing |
| 1757 | `cmp_init_mongen_order` | - | Missing |
| 1553 | `create_critters` | - | Missing |
| 1829 | `dump_mongen` | - | Missing |
| 2373 | `freemcorpsenm` | - | Missing |
| 2227 | `golemhp` | - | Missing |
| 2045 | `grow_up` | - | Missing |
| 1061 | `init_mextra` | - | Missing |
| 1801 | `init_mongen_order` | - | Missing |
| 35 | `is_home_elemental` | - | Missing |
| 81 | `m_initgrp` | - | Missing |
| 591 | `m_initinv` | - | Missing |
| 150 | `m_initthrow` | - | Missing |
| 163 | `m_initweap` | monsters.js `m_initweap()` | Aligned — fixed offensive item check |
| 1149 | `makemon` | - | Missing |
| 1078 | `makemon_rnd_goodpos` | - | Missing |
| 1539 | `mbirth_limit` | - | Missing |
| 1733 | `mk_gen_ok` | - | Missing |
| 1867 | `mkclass` | - | Missing |
| 1874 | `mkclass_aligned` | - | Missing |
| 1977 | `mkclass_poly` | - | Missing |
| 578 | `mkmonmoney` | - | Missing |
| 2175 | `mongets` | - | Missing |
| 988 | `monhp_per_lvl` | - | Missing |
| 2364 | `newmcorpsenm` | - | Missing |
| 1068 | `newmextra` | - | Missing |
| 1014 | `newmonhp` | - | Missing |
| 2262 | `peace_minded` | - | Missing |
| 960 | `propagate` | - | Missing |
| 1649 | `rndmonst` | - | Missing |
| 1656 | `rndmonst_adj` | - | Missing |
| 2315 | `set_malign` | monsters.js `set_malign()` | Aligned |
| 2387 | `set_mimic_sym` | - | Missing |
| 2599 | `summon_furies` | - | Missing |
| 1638 | `temperature_shift` | - | Missing |
| 1590 | `uncommon` | - | Missing |
| 1511 | `unmakemon` | - | Missing |
| 58 | `wrong_elem_type` | - | Missing |

### mcastu.c -> mcastu.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 981 | `buzzmu` | - | Missing |
| 632 | `cast_cleric_spell` | - | Missing |
| 449 | `cast_wizard_spell` | - | Missing |
| 177 | `castmu` | - | Missing |
| 130 | `choose_clerical_spell` | - | Missing |
| 76 | `choose_magic_spell` | - | Missing |
| 49 | `cursetxt` | - | Missing |
| 410 | `death_inflicted_by` | - | Missing |
| 885 | `is_undirected_spell` | - | Missing |
| 360 | `m_cure_self` | - | Missing |
| 913 | `spell_would_be_useless` | - | Missing |
| 375 | `touch_of_death` | - | Missing |

### mdlib.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 349 | `bannerc_string` | - | Missing |
| 669 | `build_options` | - | Missing |
| 393 | `build_savebones_compat_string` | - | Missing |
| 627 | `count_and_validate_soundlibopts` | - | Missing |
| 602 | `count_and_validate_winopts` | - | Missing |
| 849 | `do_runtime_info` | - | Missing |
| 248 | `make_version` | - | Missing |
| 236 | `md_ignored_features` | - | Missing |
| 300 | `mdlib_version_string` | - | Missing |
| 375 | `mkstemp` | - | Missing |
| 641 | `opt_out_words` | - | Missing |
| 864 | `release_runtime_info` | - | Missing |
| 835 | `runtime_info_init` | - | Missing |
| 316 | `version_id_string` | - | Missing |

### mhitm.c -> mhitm.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1475 | `attk_protection` | mhitm.js | Implemented |
| 807 | `engulf_target` | - | Missing |
| 970 | `explmm` | mhitm.js | Implemented (simplified) |
| 597 | `failed_grab` | mhitm.js | Implemented |
| 106 | `fightm` | mhitm.js | Implemented |
| 736 | `gazemm` | mhitm.js | Implemented (simplified) |
| 849 | `gulpmm` | - | Missing (engulf handled inline) |
| 644 | `hitmm` | mhitm.js | Implemented |
| 293 | `mattackm` | mhitm.js | Implemented |
| 1016 | `mdamagem` | mhitm.js | Implemented |
| 179 | `mdisplacem` | - | Missing |
| 76 | `missmm` | mhitm.js | Implemented |
| 1122 | `mon_poly` | - | Missing |
| 1283 | `mswingsm` | - | Missing |
| 27 | `noises` | mhitm.js | Stub |
| 1210 | `paralyze_monst` | mhitm.js | Implemented |
| 1304 | `passivemm` | mhitm.js | Implemented |
| 41 | `pre_mm_attack` | mhitm.js | Implemented (simplified) |
| 1260 | `rustm` | mhitm.js | Stub |
| 1223 | `sleep_monst` | mhitm.js | Implemented |
| 1250 | `slept_monst` | mhitm.js | Stub |
| 1461 | `xdrainenergym` | mhitm.js | Implemented |

### mhitu.c -> mhitu.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 2349 | `assess_dmg` | - | Missing |
| 447 | `calc_mattacku_vars` | - | Missing |
| 2606 | `cloneu` | - | Missing |
| 1928 | `could_seduce` | - | Missing |
| 1031 | `diseasemu` | - | Missing |
| 1979 | `doseduce` | - | Missing |
| 263 | `expels` | - | Missing |
| 1587 | `explmu` | - | Missing |
| 1661 | `gazemu` | - | Missing |
| 309 | `getmattk` | - | Missing |
| 1269 | `gulp_blnd_check` | - | Missing |
| 1285 | `gulpmu` | - | Missing |
| 30 | `hitmsg` | mhitu.js:hitmsg | Implemented — C-faithful attack verb dispatch (bite/kick/sting/butt/touch/tentacle/hit) |
| 1140 | `hitmu` | mhitu.js:monsterAttackPlayer | Implemented — restructured to match C hitmu() flow: mhm state object, mhitu_adtyping dispatch, mhitm_knockback, negative AC damage reduction |
| 1085 | `magic_negation` | mondata.js | Implemented (simplified) |
| 490 | `mattacku` | mhitu.js:monsterAttackPlayer | Implemented — attack loop with AT_WEAP weapon swing messages, range2 dispatch for thrwmu |
| 2303 | `mayberem` | - | Missing |
| 1895 | `mdamageu` | - | Missing (damage applied inline in monsterAttackPlayer) |
| 86 | `missmu` | mhitu.js:monsterAttackPlayer | Implemented — miss message with "just misses" variant |
| 2386 | `mon_avoiding_this_attack` | - | Missing |
| 146 | `mpoisons_subj` | - | Missing |
| 131 | `mswings` | mhitu.js:monsterWeaponSwingMsg | Implemented — weapon swing verb/message for AT_WEAP |
| 106 | `mswings_verb` | mhitu.js:monsterWeaponSwingVerb | Implemented — thrust/swing/slash verb selection |
| 466 | `mtrapped_in_pit` | - | Missing |
| - | `mhitu_adtyping` | mhitu.js:mhitu_adtyping | Implemented — dispatcher for ~30 AD_* handlers in mhitu (monster-attacks-hero) branch |
| - | `mhitu_ad_phys` | mhitu.js | Implemented — AT_HUGS grab, AT_WEAP weapon dmgval, AT_TUCH gate |
| - | `mhitu_ad_fire` | mhitu.js | Implemented — Fire_resistance check, rn2(20) destroy_items gate |
| - | `mhitu_ad_cold` | mhitu.js | Implemented — Cold_resistance check, rn2(20) destroy_items gate |
| - | `mhitu_ad_elec` | mhitu.js | Implemented — Shock_resistance check, rn2(20) destroy_items gate |
| - | `mhitu_ad_acid` | mhitu.js | Implemented — Acid_resistance check, exercise(A_STR) |
| - | `mhitu_ad_stck` | mhitu.js | Implemented — sets player.ustuck |
| - | `mhitu_ad_wrap` | mhitu.js | Implemented — mcan check, sets ustuck |
| - | `mhitu_ad_plys` | mhitu.js | Implemented — rn2(3) gate, Free_action check, paralysis via game.multi |
| - | `mhitu_ad_slee` | mhitu.js | Implemented — rn2(5) gate, Sleep_resistance + Free_action check |
| - | `mhitu_ad_conf` | mhitu.js | Implemented — rn2(4) + mspec_used gate, make_confused() |
| - | `mhitu_ad_stun` | mhitu.js | Implemented — make_stunned() |
| - | `mhitu_ad_blnd` | mhitu.js | Implemented — make_blinded() |
| - | `mhitu_ad_drst` | mhitu.js | Implemented — Poison_resistance check, rn2(8) gate; approximation: uses fixed stat drain instead of poisoned() subsystem |
| - | `mhitu_ad_drli` | mhitu.js | Implemented — rn2(3) gate, Drain_resistance check, losexp() |
| - | `mhitu_ad_dren` | mhitu.js | Implemented — drain_en (player.pw) inline |
| - | `mhitu_ad_drin` | mhitu.js | Implemented — brain eating: INT drain, level loss; approximation: no helmet check |
| - | `mhitu_ad_slow` | mhitu.js | Implemented — speed reduction; approximation: simple flag set vs full HFast property manipulation |
| - | `mhitu_ad_ston` | mhitu.js | Implemented — rn2(3) + rn2(10) gates, messages; approximation: no actual petrification yet |
| - | `mhitu_ad_tlpt` | mhitu.js | Stub — negation check only, no teleport system |
| - | `mhitu_ad_sgld` | mhitu.js | Stub — hitmsg + damage=0 (no gold theft) |
| - | `mhitu_ad_sedu` | mhitu.js | Stub — hitmsg + damage=0 (no seduction/item theft) |
| - | `mhitu_ad_ssex` | mhitu.js | Stub — hitmsg + damage=0 |
| - | `mhitu_ad_curs` | mhitu.js | Stub — hitmsg + damage=0 (no curse system) |
| - | `mhitu_ad_slim` | mhitu.js | Stub — hitmsg + damage=0 (no sliming) |
| - | `mhitu_ad_ench` | mhitu.js | Stub — hitmsg + damage=0 (no enchantment drain) |
| - | `mhitu_ad_poly` | mhitu.js | Stub — hitmsg + damage=0 (no polymorph) |
| - | `mhitu_ad_were` | mhitu.js | Stub — hitmsg + damage=0 (no lycanthropy) |
| - | `mhitu_ad_heal` | mhitu.js | Implemented — restores player HP |
| - | `mhitu_ad_legs` | mhitu.js | Implemented — delegates to AD_PHYS |
| - | `mhitu_ad_dgst` | mhitu.js | Stub — hitmsg + damage=0 (no engulfing) |
| - | `mhitu_ad_samu` | mhitu.js | Stub — hitmsg + damage=0 (no artifact theft) |
| - | `mhitu_ad_dise` | mhitu.js | Stub — hitmsg + damage=0 (no disease) |
| - | `mhitu_ad_deth` | mhitu.js | Implemented — redirects to drli |
| - | `mhitu_ad_pest` | mhitu.js | Stub — physical damage only |
| - | `mhitu_ad_famn` | mhitu.js | Stub — physical damage only |
| - | `mhitu_ad_halu` | mhitu.js | Stub — hitmsg + damage=0 (no hallucination) |
| - | `mhitu_ad_rust` | mhitu.js | Stub — hitmsg + damage=0 (no armor erosion) |
| - | `mhitu_ad_corr` | mhitu.js | Stub — hitmsg + damage=0 (no armor erosion) |
| - | `mhitu_ad_dcay` | mhitu.js | Stub — hitmsg + damage=0 (no armor erosion) |
| - | `mhitm_knockback` | mhitu.js | Implemented — rn2(3) distance, rn2(6) chance, eligibility (AD_PHYS, attack type, size), rn2(2)+rn2(2) message |
| 2425 | `passiveum` | - | Missing |
| 954 | `summonmu` | - | Missing |
| 1045 | `u_slip_free` | - | Missing |
| 162 | `u_slow_down` | - | Missing |
| 175 | `wildmiss` | - | Missing |

### minion.c -> minion.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 360 | `bribe` | - | Missing |
| 263 | `demon_talk` | - | Missing |
| 404 | `dlord` | - | Missing |
| 390 | `dprince` | - | Missing |
| 29 | `free_emin` | - | Missing |
| 497 | `gain_guardian_angel` | - | Missing |
| 419 | `llord` | - | Missing |
| 428 | `lminion` | - | Missing |
| 467 | `lose_guardian_angel` | - | Missing |
| 40 | `monster_census` | - | Missing |
| 59 | `msummon` | - | Missing |
| 443 | `ndemon` | monsters.js `ndemon()` | Aligned |
| 17 | `newemin` | - | Missing |
| 198 | `summon_minion` | - | Missing |

### mklev.c -> mklev.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 571 | `add_door` | - | Missing |
| 305 | `add_room` | - | Missing |
| 319 | `add_subroom` | - | Missing |
| 553 | `alloc_doors` | - | Missing |
| 1746 | `bydoor` | - | Missing |
| 678 | `cardinal_nextto_room` | - | Missing |
| 1194 | `chk_okdoor` | - | Missing |
| 847 | `clear_level_structures` | - | Missing |
| 825 | `count_level_features` | - | Missing |
| 232 | `do_room_or_subroom` | - | Missing |
| 1796 | `dodoor` | - | Missing |
| 612 | `dosdoor` | - | Missing |
| 935 | `fill_ordinary_room` | - | Missing |
| 1656 | `find_branch_room` | - | Missing |
| 2299 | `find_okay_roompos` | - | Missing |
| 148 | `finddpos` | - | Missing |
| 107 | `finddpos_shift` | - | Missing |
| 336 | `free_luathemes` | - | Missing |
| 2246 | `generate_stairs` | - | Missing |
| 2215 | `generate_stairs_find_room` | - | Missing |
| 2197 | `generate_stairs_room_good` | - | Missing |
| 74 | `good_rm_wall_doorpos` | - | Missing |
| 430 | `join` | - | Missing |
| 1540 | `level_finalize_topology` | - | Missing |
| 799 | `make_niches` | - | Missing |
| 519 | `makecorridors` | - | Missing |
| 1247 | `makelevel` | - | Missing |
| 737 | `makeniche` | - | Missing |
| 358 | `makerooms` | - | Missing |
| 818 | `makevtele` | - | Missing |
| 1789 | `maybe_sdoor` | - | Missing |
| 1445 | `mineralize` | - | Missing |
| 2620 | `mk_knox_portal` | - | Missing |
| 2328 | `mkaltar` | - | Missing |
| 2281 | `mkfount` | - | Missing |
| 2349 | `mkgrave` | - | Missing |
| 2599 | `mkinvk_check_wall` | - | Missing |
| 2406 | `mkinvokearea` | - | Missing |
| 2499 | `mkinvpos` | - | Missing |
| 1573 | `mklev` | - | Missing |
| 1219 | `mklev_sanity_check` | - | Missing |
| 2313 | `mksink` | - | Missing |
| 2155 | `mkstairs` | - | Missing |
| 2032 | `mktrap` | - | Missing |
| 1811 | `mktrap_victim` | - | Missing |
| 1802 | `occupied` | - | Missing |
| 1775 | `okdoor` | - | Missing |
| 1687 | `place_branch` | - | Missing |
| 698 | `place_niche` | - | Missing |
| 1673 | `pos_to_room` | - | Missing |
| 211 | `sort_rooms` | - | Missing |
| 1170 | `themerooms_post_level_generate` | - | Missing |
| 1593 | `topologize` | - | Missing |
| 1934 | `traptype_rnd` | - | Missing |
| 1998 | `traptype_roguelvl` | - | Missing |
| 1428 | `water_has_kelp` | - | Missing |

### mkmap.c -> mkmap.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 331 | `finish_map` | - | Missing |
| 153 | `flood_fill_rm` | - | Missing |
| 55 | `get_map` | - | Missing |
| 37 | `init_fill` | - | Missing |
| 24 | `init_map` | - | Missing |
| 258 | `join_map` | - | Missing |
| 246 | `join_map_cleanup` | - | Missing |
| 443 | `litstate_rnd` | - | Missing |
| 451 | `mkmap` | - | Missing |
| 68 | `pass_one` | - | Missing |
| 124 | `pass_three` | - | Missing |
| 101 | `pass_two` | - | Missing |
| 412 | `remove_room` | - | Missing |
| 379 | `remove_rooms` | - | Missing |

### mkmaze.c -> mkmaze.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 475 | `baalz_fixup` | - | Missing |
| 341 | `bad_location` | - | Missing |
| 1441 | `bound_digging` | - | Missing |
| 708 | `check_ransacked` | - | Missing |
| 951 | `create_maze` | - | Missing |
| 166 | `extend_spine` | - | Missing |
| 229 | `fix_wall_spines` | - | Missing |
| 570 | `fixup_special` | - | Missing |
| 1479 | `fumaroles` | - | Missing |
| 1354 | `get_level_extends` | - | Missing |
| 317 | `is_exclusion_zone` | - | Missing |
| 70 | `is_solid` | - | Missing |
| 45 | `iswall` | - | Missing |
| 59 | `iswall_or_stone` | - | Missing |
| 1128 | `makemaz` | - | Missing |
| 1924 | `maybe_adjust_hero_bubble` | - | Missing |
| 309 | `maze0xy` | - | Missing |
| 895 | `maze_inbounds` | - | Missing |
| 905 | `maze_remove_deadends` | - | Missing |
| 1317 | `mazexy` | dungeon.js:mazexy | Aligned — rnd(xMax/yMax), corrmaze flag, exhaustive fallback |
| 781 | `migr_booty_item` | - | Missing |
| 718 | `migrate_orc` | - | Missing |
| 1868 | `mk_bubble` | - | Missing |
| 1459 | `mkportal` | - | Missing |
| 1534 | `movebubbles` | - | Missing |
| 1947 | `mv_bubble` | - | Missing |
| 297 | `okay` | - | Missing |
| 1043 | `pick_vibrasquare_location` | - | Missing |
| 356 | `place_lregion` | - | Missing |
| 1098 | `populate_maze` | - | Missing |
| 413 | `put_lregion_here` | - | Missing |
| 1745 | `restore_waterlevel` | - | Missing |
| 1718 | `save_waterlevel` | - | Missing |
| 77 | `set_levltyp` | - | Missing |
| 125 | `set_levltyp_lit` | - | Missing |
| 1797 | `set_wportal` | - | Missing |
| 1807 | `setup_waterlevel` | - | Missing |
| 749 | `shiny_orc_stuff` | - | Missing |
| 800 | `stolen_booty` | - | Missing |
| 1855 | `unsetup_waterlevel` | - | Missing |
| 1233 | `walkfrom` | - | Missing |
| 1280 | `walkfrom` | - | Missing |
| 198 | `wall_cleanup` | - | Missing |
| 290 | `wallification` | - | Missing |
| 1684 | `water_friction` | - | Missing |

### mkobj.c -> mkobj.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 2717 | `add_to_buried` | - | Missing |
| 2673 | `add_to_container` | - | Missing |
| 2695 | `add_to_migration` | - | Missing |
| 2645 | `add_to_minv` | - | Missing |
| 1854 | `bcsign` | - | Missing |
| 713 | `bill_dummy_object` | - | Missing |
| 1742 | `bless` | - | Missing |
| 1838 | `blessorcurse` | - | Missing |
| 3371 | `check_contained` | - | Missing |
| 3417 | `check_glob` | - | Missing |
| 836 | `clear_dknown` | - | Missing |
| 627 | `clear_splitobjs` | - | Missing |
| 2730 | `container_weight` | - | Missing |
| 418 | `copy_oextra` | - | Missing |
| 2126 | `corpse_revive_type` | - | Missing |
| 753 | `costly_alteration` | - | Missing |
| 1780 | `curse` | - | Missing |
| 2742 | `dealloc_obj` | - | Missing |
| 2812 | `dealloc_obj_real` | - | Missing |
| 97 | `dealloc_oextra` | - | Missing |
| 2522 | `discard_minvent` | - | Missing |
| 2828 | `dobjsfree` | - | Missing |
| 2620 | `extract_nexthere` | - | Missing |
| 2593 | `extract_nobj` | - | Missing |
| 2022 | `fixup_oil` | - | Missing |
| 168 | `free_omailcmd` | - | Missing |
| 152 | `free_omid` | - | Missing |
| 129 | `free_omonst` | - | Missing |
| 2198 | `get_mtraits` | - | Missing |
| 2844 | `hornoplenty` | - | Missing |
| 3344 | `init_dummyobj` | - | Missing |
| 81 | `init_oextra` | - | Missing |
| 3246 | `insane_obj_bits` | - | Missing |
| 3311 | `insane_object` | - | Missing |
| 2267 | `is_flammable` | - | Missing |
| 2286 | `is_rottable` | - | Missing |
| 1988 | `is_treefruit` | - | Missing |
| 1440 | `item_on_ice` | - | Missing |
| 178 | `may_generate_eroded` | objects.js `mayGenerateEroded()` | Aligned — in_mklev context ordering fixed |
| 1701 | `maybe_adjust_light` | - | Missing |
| 2250 | `mk_named_object` | - | Missing |
| 2224 | `mk_tt_object` | sp_lev.js `mk_tt_object()` | Aligned |
| 305 | `mkbox_cnts` | - | Missing |
| 2064 | `mkcorpstat` | - | Missing |
| 2000 | `mkgold` | sp_lev.js `mkgold()` | Aligned |
| 271 | `mkobj` | - | Missing |
| 228 | `mkobj_at` | - | Missing |
| 197 | `mkobj_erosions` | - | Missing |
| 1176 | `mksobj` | - | Missing |
| 239 | `mksobj_at` | - | Missing |
| 870 | `mksobj_init` | - | Missing |
| 254 | `mksobj_migr_to_species` | - | Missing |
| 3201 | `mon_obj_sanity` | - | Missing |
| 158 | `new_omailcmd` | - | Missing |
| 87 | `newoextra` | - | Missing |
| 144 | `newomid` | - | Missing |
| 115 | `newomonst` | - | Missing |
| 510 | `next_ident` | - | Missing |
| 537 | `nextoid` | - | Missing |
| 3275 | `nomerge_exception` | - | Missing |
| 3699 | `obj_absorb` | - | Missing |
| 2144 | `obj_attach_mid` | - | Missing |
| 2554 | `obj_extract_self` | - | Missing |
| 2394 | `obj_ice_effects` | - | Missing |
| 3765 | `obj_meld` | - | Missing |
| 3640 | `obj_nexto` | - | Missing |
| 3658 | `obj_nexto_xy` | - | Missing |
| 2946 | `obj_sanity_check` | - | Missing |
| 2437 | `obj_timer_checks` | - | Missing |
| 3029 | `objlist_sanity` | - | Missing |
| 2420 | `peek_at_iced_corpse_age` | - | Missing |
| 2302 | `place_object` | - | Missing |
| 3815 | `pudding_merge_message` | - | Missing |
| 2368 | `recreate_pile_at` | - | Missing |
| 2505 | `remove_object` | - | Missing |
| 642 | `replace_object` | - | Missing |
| 1368 | `rider_revival_time` | - | Missing |
| 1981 | `rnd_treefruit_at` | - | Missing |
| 389 | `rndmonnum` | - | Missing |
| 396 | `rndmonnum_adj` | - | Missing |
| 3444 | `sanity_check_worn` | - | Missing |
| 2154 | `save_mtraits` | - | Missing |
| 1861 | `set_bknown` | - | Missing |
| 1315 | `set_corpsenm` | - | Missing |
| 3131 | `shop_obj_sanity` | - | Missing |
| 1497 | `shrink_glob` | - | Missing |
| 1670 | `shrinking_glob_gone` | - | Missing |
| 458 | `splitobj` | - | Missing |
| 1386 | `start_corpse_timeout` | - | Missing |
| 1470 | `start_glob_timeout` | - | Missing |
| 1273 | `stone_furniture_type` | - | Missing |
| 1261 | `stone_object_type` | - | Missing |
| 1764 | `unbless` | - | Missing |
| 1819 | `uncurse` | - | Missing |
| 855 | `unknow_object` | - | Missing |
| 685 | `unknwn_contnr_contents` | - | Missing |
| 557 | `unsplitobj` | - | Missing |
| 1885 | `weight` | - | Missing |
| 3293 | `where_name` | - | Missing |

### mkroom.c -> mkroom.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 503 | `antholemon` | - | Missing |
| 913 | `cmap_to_type` | - | Missing |
| 784 | `courtmon` | - | Missing |
| 53 | `do_mkroom` | - | Missing |
| 277 | `fill_zoo` | sp_lev.js `fill_zoo()` | Aligned — all room types, ndemon, mkgold merge, mongets/set_malign, mk_tt_object |
| 641 | `has_dnstairs` | - | Missing |
| 654 | `has_upstairs` | - | Missing |
| 679 | `inside_room` | - | Missing |
| 1051 | `invalid_shop_shape` | - | Missing |
| 43 | `isbig` | - | Missing |
| 258 | `mk_zoo_thronemon` | - | Missing |
| 96 | `mkshop` | - | Missing |
| 531 | `mkswamp` | - | Missing |
| 599 | `mktemple` | - | Missing |
| 457 | `mkundead` | - | Missing |
| 245 | `mkzoo` | - | Missing |
| 479 | `morguemon` | - | Missing |
| 624 | `nexttodoor` | - | Missing |
| 221 | `pick_room` | - | Missing |
| 876 | `rest_room` | - | Missing |
| 894 | `rest_rooms` | - | Missing |
| 845 | `save_room` | - | Missing |
| 864 | `save_rooms` | - | Missing |
| 766 | `search_special` | - | Missing |
| 578 | `shrine_pos` | - | Missing |
| 667 | `somex` | - | Missing |
| 695 | `somexy` | - | Missing |
| 745 | `somexyspace` | - | Missing |
| 673 | `somey` | - | Missing |
| 818 | `squadmon` | - | Missing |

### mon.c -> mon.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 5222 | `accept_newcham_form` | - | Missing |
| 5915 | `adj_erinys` | - | Missing |
| 4466 | `alloc_itermonarr` | - | Missing |
| 3068 | `anger_quest_guardians` | - | Missing |
| 5704 | `angry_guards` | - | Missing |
| 5539 | `can_be_hatched` | - | Missing |
| 1972 | `can_carry` | - | Missing |
| 1940 | `can_touch_safely` | - | Missing |
| 5908 | `check_gear_next_turn` | - | Missing |
| 2579 | `copy_mextra` | - | Missing |
| 3177 | `corpse_chance` | - | Missing |
| 1895 | `curr_mon_load` | - | Missing |
| 5580 | `dead_species` | - | Missing |
| 3981 | `deal_with_overcrowding` | - | Missing |
| 2631 | `dealloc_mextra` | - | Missing |
| 2658 | `dealloc_monst` | - | Missing |
| 4867 | `decide_to_shapeshift` | - | Missing |
| 2469 | `dmonsfree` | - | Missing |
| 5562 | `egg_type_from_parent` | - | Missing |
| 3873 | `elemental_clog` | - | Missing |
| 6060 | `flash_mon` | - | Missing |
| 452 | `genus` | - | Missing |
| 4539 | `get_iter_mons` | - | Missing |
| 4557 | `get_iter_mons_xy` | - | Missing |
| 5673 | `golemeffects` | - | Missing |
| 4591 | `healmon` | - | Missing |
| 4801 | `hide_monst` | - | Missing |
| 4721 | `hideunder` | - | Missing |
| 4976 | `isspecmon` | - | Missing |
| 4522 | `iter_mons` | - | Missing |
| 4495 | `iter_mons_safe` | - | Missing |
| 5602 | `kill_eggs` | - | Missing |
| 5632 | `kill_genocided_monsters` | - | Missing |
| 3465 | `killed` | - | Missing |
| 2835 | `lifesaved_monster` | - | Missing |
| 2993 | `logdeadmon` | - | Missing |
| 1162 | `m_calcdistress` | - | Missing |
| 1374 | `m_consume_obj` | - | Missing |
| 2730 | `m_detach` | - | Missing |
| 2112 | `m_in_air` | - | Missing |
| 3829 | `m_into_limbo` | - | Missing |
| 312 | `m_poisongas_ok` | - | Missing |
| 4117 | `m_respond` | monmove.js | Partial — dispatcher calls m_respond_shrieker/medusa/erinyes; shrieker rn2(10) gate faithful but makemon stubbed; medusa gazemu stubbed; erinyes aggravate faithful |
| 4104 | `m_respond_medusa` | monmove.js | Stub — gazemu not implemented |
| 4084 | `m_respond_shrieker` | monmove.js | Partial — rn2(10) gate faithful, makemon stubbed |
| 4622 | `m_restartcham` | - | Missing |
| 546 | `make_corpse` | - | Missing |
| 1909 | `max_mon_load` | - | Missing |
| 3994 | `maybe_mnexto` | - | Missing |
| 4693 | `maybe_unhide_at` | - | Missing |
| 1156 | `mcalcdistress` | - | Missing |
| 1108 | `mcalcmove` | - | Missing |
| 1336 | `meatbox` | - | Missing |
| 1638 | `meatcorpse` | - | Missing |
| 1445 | `meatmetal` | - | Missing |
| 1515 | `meatobj` | - | Missing |
| 2122 | `mfndpos` | mon.js | Flag-based port. Missing: ALLOW_DIG, poison gas regions, worm segments |
| 5249 | `mgender_from_permonst` | - | Missing |
| 3838 | `migrate_mon` | - | Missing |
| 5769 | `mimic_hit_msg` | - | Missing |
| 929 | `minliquid` | - | Missing |
| 943 | `minliquid_core` | - | Missing |
| 2823 | `mlifesaver` | - | Missing |
| 2372 | `mm_2way_aggression` | mon.js | Ported (zombie-maker aggression) |
| 2410 | `mm_aggression` | mon.js | Ported (purple worm + zombie-maker) |
| 2433 | `mm_displacement` | mon.js | Ported (displacer beast logic) |
| 4026 | `mnearto` | - | Missing |
| 3950 | `mnexto` | - | Missing |
| 2046 | `mon_allowflags` | monmove.js | Ported. Missing: ALLOW_DIG, Conflict ALLOW_U, is_vampshifter NOGARLIC |
| 4824 | `mon_animal_list` | - | Missing |
| 1708 | `mon_give_prop` | - | Missing |
| 1760 | `mon_givit` | - | Missing |
| 2678 | `mon_leaving_level` | monutil.js | Partial — unstuck() called from mondead, mtrapped clearing; Missing: worm removal, mswallower display, mimic unhide, newsym |
| 240 | `mon_sanity_check` | - | Missing |
| 3743 | `mon_to_stone` | - | Missing |
| 3077 | `mondead` | monutil.js | Partial — marks dead, calls unstuck() + relobj inventory drop; Missing: lifesaved_monster, vamprises, steam vortex gas cloud (rn2(10)), Kop respawn (rnd(5)+makemon), chameleon/lycanthrope revert, mvitals tracking, quest leader death |
| 3249 | `mondied` | - | Missing |
| 3263 | `mongone` | - | Missing |
| 3373 | `monkilled` | - | Missing |
| 2039 | `monlineu` | - | Missing |
| 2458 | `monnear` | - | Missing |
| 3283 | `monstone` | - | Missing |
| 1308 | `movemon` | - | Missing |
| 1196 | `movemon_singlemon` | - | Missing |
| 1809 | `mpickgold` | - | Missing |
| 1829 | `mpickstuff` | - | Missing |
| 5271 | `newcham` | - | Missing |
| 4426 | `normal_shape` | - | Missing |
| 3859 | `ok_to_obliterate` | - | Missing |
| 5756 | `pacify_guard` | - | Missing |
| 5763 | `pacify_guards` | - | Missing |
| 4158 | `peacefuls_respond` | - | Missing |
| 4850 | `pick_animal` | - | Missing |
| 4934 | `pickvampshape` | - | Missing |
| 517 | `pm_to_cham` | - | Missing |
| 4130 | `qst_guardians_respond` | - | Missing |
| 2543 | `relmon` | - | Missing |
| 2497 | `replmon` | - | Missing |
| 4616 | `rescham` | - | Missing |
| 4635 | `restartcham` | - | Missing |
| 4644 | `restore_cham` | - | Missing |
| 4657 | `restrap` | - | Missing |
| 59 | `sanity_check_single_mon` | - | Missing |
| 5964 | `see_monster_closeup` | - | Missing |
| 6018 | `see_nearby_monsters` | - | Missing |
| 4404 | `seemimic` | - | Missing |
| 5150 | `select_newcham_form` | makemon.js:select_newcham_form | APPROX — random fallback only, missing sandestin/doppelganger/werecreature |
| 2804 | `set_mon_min_mhpmax` | - | Missing |
| 3417 | `set_ustuck` | - | Missing |
| 4260 | `setmangry` | - | Missing |
| 6051 | `shieldeff_mon` | - | Missing |
| 399 | `undead_to_corpse` | - | Missing |
| 3434 | `unstuck` | monutil.js | Implemented — clears player.ustuck, rnd(2) for sticky/engulf/hug monsters; TODO: swallowed-player repositioning + vision recalc (no RNG impact) |
| 5789 | `usmellmon` | - | Missing |
| 5008 | `valid_vampshiftform` | - | Missing |
| 4986 | `validspecmon` | - | Missing |
| 5021 | `validvamp` | - | Missing |
| 3761 | `vamp_stone` | - | Missing |
| 2886 | `vamprises` | - | Missing |
| 4317 | `wake_msg` | - | Missing |
| 4362 | `wake_nearby` | - | Missing |
| 4397 | `wake_nearto` | - | Missing |
| 4369 | `wake_nearto_core` | - | Missing |
| 4328 | `wakeup` | - | Missing |
| 5071 | `wiz_force_cham_form` | - | Missing |
| 3472 | `xkilled` | - | Missing |
| 368 | `zombie_form` | - | Missing |
| 344 | `zombie_maker` | - | Missing |

### mondata.c -> mondata.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 129 | `Resists_Elem` | - | Missing |
| 54 | `attacktype` | - | Missing |
| 42 | `attacktype_fordmg` | - | Missing |
| 1331 | `big_little_match` | - | Missing |
| 1316 | `big_to_little` | - | Missing |
| 640 | `breakarm` | - | Missing |
| 591 | `can_be_strangled` | - | Missing |
| 305 | `can_blnd` | - | Missing |
| 567 | `can_blow` | - | Missing |
| 580 | `can_chant` | - | Missing |
| 623 | `can_track` | - | Missing |
| 663 | `cantvomit` | - | Missing |
| 1522 | `cvt_adtyp_to_mseenres` | - | Missing |
| 1540 | `cvt_prop_to_mseenres` | - | Missing |
| 91 | `defended` | - | Missing |
| 712 | `dmgtype` | - | Missing |
| 700 | `dmgtype_fromattack` | - | Missing |
| 1180 | `gender` | - | Missing |
| 1660 | `get_atkdam_type` | - | Missing |
| 1586 | `give_u_to_m_resistances` | - | Missing |
| 540 | `hates_blessings` | - | Missing |
| 524 | `hates_silver` | - | Missing |
| 1211 | `levl_follower` | - | Missing |
| 1303 | `little_to_big` | - | Missing |
| 1380 | `locomotion` | - | Missing |
| 720 | `max_passive_dmg` | - | Missing |
| 533 | `mon_hates_blessings` | - | Missing |
| 547 | `mon_hates_light` | - | Missing |
| 517 | `mon_hates_silver` | - | Missing |
| 1617 | `mon_knows_traps` | - | Missing |
| 1629 | `mon_learns_traps` | - | Missing |
| 1641 | `mons_see_trap` | - | Missing |
| 1558 | `monstseesu` | - | Missing |
| 1572 | `monstunseesu` | - | Missing |
| 428 | `mstrength` | - | Missing |
| 501 | `mstrength_ranged_attk` | - | Missing |
| 1449 | `msummon_environ` | - | Missing |
| 883 | `name_to_mon` | - | Missing |
| 1090 | `name_to_monclass` | - | Missing |
| 893 | `name_to_monplus` | - | Missing |
| 61 | `noattacks` | - | Missing |
| 678 | `num_horns` | - | Missing |
| 1507 | `olfaction` | - | Missing |
| 1411 | `on_fire` | - | Missing |
| 554 | `passes_bars` | - | Missing |
| 80 | `poly_when_stoned` | - | Missing |
| 1191 | `pronoun_gender` | - | Missing |
| 1359 | `raceptr` | - | Missing |
| 402 | `ranged_attk` | - | Missing |
| 1607 | `resist_conflict` | - | Missing |
| 248 | `resists_blnd` | - | Missing |
| 278 | `resists_blnd_by_arti` | - | Missing |
| 201 | `resists_drli` | - | Missing |
| 215 | `resists_magm` | - | Missing |
| 771 | `same_race` | - | Missing |
| 13 | `set_mon_data` | - | Missing |
| 632 | `sliparm` | - | Missing |
| 1395 | `stagger` | - | Missing |
| 654 | `sticks` | - | Missing |

### monmove.c -> monmove.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 2191 | `accessible` | - | Missing |
| 395 | `bee_eat_jelly` | - | Missing |
| 2368 | `can_fog` | - | Missing |
| 2124 | `can_hide_under_obj` | - | Missing |
| 2359 | `can_ooze` | - | Missing |
| 2184 | `closed_door` | - | Missing |
| 1248 | `count_webbing_walls` | - | Missing |
| 2173 | `dissolve_bars` | - | Missing |
| 534 | `distfleeck` | - | Missing |
| 328 | `disturb` | - | Missing |
| 691 | `dochug` | - | Missing |
| 205 | `dochugw` | - | Missing |
| 376 | `find_pmmonst` | - | Missing |
| 425 | `gelcube_digests` | - | Missing |
| 1231 | `holds_up_web` | - | Missing |
| 1057 | `itsstuck` | - | Missing |
| 1143 | `leppie_avoidance` | - | Missing |
| 1158 | `leppie_stash` | - | Missing |
| 575 | `m_arrival` | - | Missing |
| 1301 | `m_avoid_kicked_loc` | - | Missing |
| 1317 | `m_avoid_soko_push_loc` | - | Missing |
| 1185 | `m_balks_at_approaching` | - | Missing |
| 144 | `m_break_boulder` | - | Missing |
| 134 | `m_can_break_boulder` | - | Missing |
| 1112 | `m_digweapon_check` | - | Missing |
| 651 | `m_everyturn_effect` | - | Missing |
| 1717 | `m_move` | - | Missing |
| 2091 | `m_move_aggress` | - | Missing |
| 673 | `m_postmove_effect` | - | Missing |
| 1334 | `m_search_items` | - | Missing |
| 1273 | `maybe_spin_web` | - | Missing |
| 55 | `mb_trapped` | - | Missing |
| 584 | `mind_blast` | monmove.js | Partial — RNG-faithful: rn2(20) gate, hero lock-on (sensemon/Blind_telepat/rn2(10)), rnd(15) damage, monster loop with telepathic/rn2(2)/rn2(10)/rnd(15); losehp stubbed, hero unhide stubbed |
| 308 | `mon_regen` | - | Missing |
| 79 | `mon_track_add` | - | Missing |
| 90 | `mon_track_clear` | - | Missing |
| 1040 | `mon_would_consume_item` | - | Missing |
| 1003 | `mon_would_take_item` | - | Missing |
| 107 | `mon_yells` | - | Missing |
| 463 | `monflee` | - | Missing |
| 97 | `monhaskey` | - | Missing |
| 242 | `onscary` | - | Missing |
| 1459 | `postmov` | - | Missing |
| 363 | `release_hero` | - | Missing |
| 2201 | `set_apparxy` | monmove.js | Partial — pet/ustuck/position early-return, notseen/displaced displacement, rn2(3)/rn2(4) gotu, offset loop faithful; Approximations: missing Underwater check, missing Xorn smell, loop exit omits passes_walls/can_ooze/can_fog, Displaced detected via cloak otyp not intrinsic |
| 1074 | `should_displace` | - | Missing |
| 1256 | `soko_allow_web` | - | Missing |
| 2322 | `stuff_prevents_passage` | - | Missing |
| 2280 | `undesirable_disp` | - | Missing |
| 2380 | `vamp_shift` | - | Missing |
| 177 | `watch_on_duty` | - | Missing |

### monst.c -> monst.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 72 | `monst_globals_init` | - | Missing |

### mplayer.c -> mplayer.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 327 | `create_mplayers` | - | Missing |
| 44 | `dev_name` | - | Missing |
| 72 | `get_mplname` | - | Missing |
| 118 | `mk_mplayer` | - | Missing |
| 95 | `mk_mplayer_armor` | - | Missing |
| 356 | `mplayer_talk` | - | Missing |

### mthrowu.c -> mthrowu.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1255 | `blocking_terrain` | - | Missing |
| 1067 | `breamm` | - | Missing |
| 1248 | `breamu` | - | Missing |
| 1057 | `breathwep_name` | - | Missing |
| 162 | `drop_throw` | - | Missing |
| 1390 | `hit_bars` | - | Missing |
| 1472 | `hits_bars` | - | Missing |
| 1371 | `lined_up` | - | Missing |
| 1303 | `linedup` | - | Missing |
| 1268 | `linedup_callback` | - | Missing |
| 1378 | `m_carrying` | - | Missing |
| 58 | `m_has_launcher_and_ammo` | - | Missing |
| 1349 | `m_lined_up` | - | Missing |
| 551 | `m_throw` | - | Missing |
| 1135 | `m_useup` | - | Missing |
| 1127 | `m_useupall` | - | Missing |
| 201 | `monmulti` | - | Missing |
| 262 | `monshoot` | - | Missing |
| 321 | `ohitmon` | - | Missing |
| 824 | `return_from_mtoss` | - | Missing |
| 52 | `rnd_hallublast` | - | Missing |
| 990 | `spitmm` | - | Missing |
| 1241 | `spitmu` | - | Missing |
| 75 | `thitu` | - | Missing |
| 943 | `thrwmm` | - | Missing |
| 1147 | `thrwmu` | - | Missing |
| 506 | `ucatchgem` | - | Missing |

### muse.c -> muse.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 3211 | `cures_sliming` | - | Missing |
| 2950 | `cures_stoning` | - | Missing |
| 1705 | `fhito_loc` | - | Missing |
| 440 | `find_defensive` | muse.js | Stub — returns false, no RNG consumed |
| 2075 | `find_misc` | muse.js | Stub — returns false, no RNG consumed |
| 1420 | `find_offensive` | - | Missing |
| 3234 | `green_mon` | - | Missing |
| 1343 | `hero_behind_chokepoint` | - | Missing |
| 1293 | `linedup_chk_corpse` | - | Missing |
| 419 | `m_next2m` | - | Missing |
| 360 | `m_sees_sleepy_soldier` | - | Missing |
| 383 | `m_tele` | - | Missing |
| 336 | `m_use_healing` | - | Missing |
| 1299 | `m_use_undead_turning` | - | Missing |
| 1732 | `mbhit` | - | Missing |
| 1596 | `mbhitm` | - | Missing |
| 2966 | `mcould_eat_tin` | - | Missing |
| 2837 | `mcureblindness` | - | Missing |
| 2242 | `mloot_container` | - | Missing |
| 2871 | `mon_consume_unstone` | - | Missing |
| 779 | `mon_escape` | - | Missing |
| 1370 | `mon_has_friends` | - | Missing |
| 1394 | `mon_likes_objpile_at` | - | Missing |
| 2762 | `mon_reflects` | - | Missing |
| 194 | `mplayhorn` | - | Missing |
| 292 | `mquaffmsg` | - | Missing |
| 237 | `mreadmsg` | - | Missing |
| 2996 | `munslime` | - | Missing |
| 2849 | `munstone` | - | Missing |
| 2228 | `muse_newcham_mon` | - | Missing |
| 3069 | `muse_unslime` | - | Missing |
| 164 | `mzapwand` | - | Missing |
| 2656 | `necrophiliac` | - | Missing |
| 756 | `reveal_trap` | - | Missing |
| 1221 | `rnd_defensive_item` | - | Missing |
| 2619 | `rnd_misc_item` | - | Missing |
| 2015 | `rnd_offensive_item` | - | Missing |
| 2671 | `searches_for_item` | - | Missing |
| 2801 | `ureflects` | - | Missing |
| 795 | `use_defensive` | muse.js | Stub — returns 0, no RNG consumed |
| 2361 | `use_misc` | muse.js | Stub — returns 0, no RNG consumed |
| 1816 | `use_offensive` | - | Missing |
| 2596 | `you_aggravate` | - | Missing |

### music.c -> music.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 67 | `awaken_monsters` | - | Missing |
| 45 | `awaken_scare` | - | Missing |
| 162 | `awaken_soldiers` | - | Missing |
| 139 | `calm_nymphs` | - | Missing |
| 196 | `charm_monsters` | - | Missing |
| 105 | `charm_snakes` | - | Missing |
| 344 | `do_earthquake` | - | Missing |
| 503 | `do_improvisation` | - | Missing |
| 221 | `do_pit` | - | Missing |
| 759 | `do_play_instrument` | - | Missing |
| 478 | `generic_lvl_desc` | - | Missing |
| 733 | `improvised_notes` | - | Missing |
| 902 | `obj_to_instr` | - | Missing |
| 85 | `put_monsters_to_sleep` | - | Missing |

### nhlobj.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 114 | `l_obj_add_to_container` | - | Missing |
| 389 | `l_obj_at` | - | Missing |
| 603 | `l_obj_bury` | - | Missing |
| 35 | `l_obj_check` | - | Missing |
| 469 | `l_obj_container` | - | Missing |
| 47 | `l_obj_gc` | - | Missing |
| 97 | `l_obj_getcontents` | - | Missing |
| 483 | `l_obj_isnull` | - | Missing |
| 350 | `l_obj_new_readobjnam` | - | Missing |
| 445 | `l_obj_nextobj` | - | Missing |
| 171 | `l_obj_objects_to_table` | - | Missing |
| 413 | `l_obj_placeobj` | - | Missing |
| 73 | `l_obj_push` | - | Missing |
| 654 | `l_obj_register` | - | Missing |
| 496 | `l_obj_timer_has` | - | Missing |
| 520 | `l_obj_timer_peek` | - | Missing |
| 579 | `l_obj_timer_start` | - | Missing |
| 547 | `l_obj_timer_stop` | - | Missing |
| 247 | `l_obj_to_table` | - | Missing |
| 142 | `nhl_obj_u_giveobj` | - | Missing |
| 89 | `nhl_push_obj` | - | Missing |

### nhlsel.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 281 | `l_selection_and` | - | Missing |
| 58 | `l_selection_check` | - | Missing |
| 762 | `l_selection_circle` | - | Missing |
| 136 | `l_selection_clone` | - | Missing |
| 810 | `l_selection_ellipse` | - | Missing |
| 559 | `l_selection_fillrect` | - | Missing |
| 657 | `l_selection_filter_mapchar` | - | Missing |
| 389 | `l_selection_filter_percent` | - | Missing |
| 726 | `l_selection_flood` | - | Missing |
| 70 | `l_selection_gc` | - | Missing |
| 454 | `l_selection_getbounds` | - | Missing |
| 224 | `l_selection_getpoint` | - | Missing |
| 862 | `l_selection_gradient` | - | Missing |
| 631 | `l_selection_grow` | - | Missing |
| 925 | `l_selection_iterate` | - | Missing |
| 509 | `l_selection_line` | - | Missing |
| 682 | `l_selection_match` | - | Missing |
| 127 | `l_selection_new` | - | Missing |
| 260 | `l_selection_not` | - | Missing |
| 203 | `l_selection_numpoints` | - | Missing |
| 306 | `l_selection_or` | - | Missing |
| 112 | `l_selection_push_copy` | - | Missing |
| 94 | `l_selection_push_new` | - | Missing |
| 591 | `l_selection_randline` | - | Missing |
| 531 | `l_selection_rect` | - | Missing |
| 1025 | `l_selection_register` | - | Missing |
| 407 | `l_selection_rndcoord` | - | Missing |
| 432 | `l_selection_room` | - | Missing |
| 159 | `l_selection_setpoint` | - | Missing |
| 962 | `l_selection_size_description` | - | Missing |
| 361 | `l_selection_sub` | - | Missing |
| 81 | `l_selection_to` | - | Missing |
| 332 | `l_selection_xor` | - | Missing |
| 476 | `params_sel_2coords` | - | Missing |

### nhlua.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 395 | `check_mapchr` | - | Missing |
| 2831 | `end_luapat` | - | Missing |
| 1960 | `free_tutorial` | - | Missing |
| 2567 | `get_lua_version` | - | Missing |
| 1448 | `get_nh_lua_variables` | - | Missing |
| 1230 | `get_table_boolean` | - | Missing |
| 1258 | `get_table_boolean_opt` | - | Missing |
| 1168 | `get_table_int` | - | Missing |
| 1180 | `get_table_int_opt` | - | Missing |
| 243 | `get_table_mapchr` | - | Missing |
| 258 | `get_table_mapchr_opt` | - | Missing |
| 1273 | `get_table_option` | - | Missing |
| 1193 | `get_table_str` | - | Missing |
| 1206 | `get_table_str_opt` | - | Missing |
| 2965 | `hook_open` | - | Missing |
| 2897 | `hooked_open` | - | Missing |
| 2075 | `init_nhc_data` | - | Missing |
| 2214 | `init_u_data` | - | Missing |
| 171 | `l_nhcore_call` | - | Missing |
| 161 | `l_nhcore_done` | - | Missing |
| 142 | `l_nhcore_init` | - | Missing |
| 227 | `lcheck_param_table` | - | Missing |
| 2543 | `load_lua` | - | Missing |
| 3195 | `nhlL_newstate` | - | Missing |
| 2997 | `nhlL_openlibs` | - | Missing |
| 320 | `nhl_add_table_entry_bool` | - | Missing |
| 303 | `nhl_add_table_entry_char` | - | Missing |
| 295 | `nhl_add_table_entry_int` | - | Missing |
| 328 | `nhl_add_table_entry_region` | - | Missing |
| 313 | `nhl_add_table_entry_str` | - | Missing |
| 3120 | `nhl_alloc` | - | Missing |
| 913 | `nhl_an` | - | Missing |
| 1815 | `nhl_callback` | - | Missing |
| 2759 | `nhl_clearfromtable` | - | Missing |
| 1614 | `nhl_debug_flags` | - | Missing |
| 473 | `nhl_deltrap` | - | Missing |
| 1304 | `nhl_dnum_name` | - | Missing |
| 2519 | `nhl_done` | - | Missing |
| 1594 | `nhl_doturn` | - | Missing |
| 1289 | `nhl_dump_fmtstr` | - | Missing |
| 201 | `nhl_error` | - | Missing |
| 1660 | `nhl_flip_level` | - | Missing |
| 1873 | `nhl_gamestate` | - | Missing |
| 1795 | `nhl_get_cmd_key` | - | Missing |
| 680 | `nhl_get_config` | - | Missing |
| 1144 | `nhl_get_debug_themerm_name` | - | Missing |
| 276 | `nhl_get_timertype` | - | Missing |
| 508 | `nhl_get_xy_params` | - | Missing |
| 697 | `nhl_getlin` | - | Missing |
| 532 | `nhl_getmap` | - | Missing |
| 2251 | `nhl_getmeminuse` | - | Missing |
| 418 | `nhl_gettrap` | - | Missing |
| 3180 | `nhl_hookfn` | - | Missing |
| 622 | `nhl_impossible` | - | Missing |
| 899 | `nhl_ing_suffix` | - | Missing |
| 2446 | `nhl_init` | - | Missing |
| 1343 | `nhl_int_to_obj_name` | - | Missing |
| 1324 | `nhl_int_to_pm_name` | - | Missing |
| 1121 | `nhl_is_genocided` | - | Missing |
| 1108 | `nhl_level_difficulty` | - | Missing |
| 2335 | `nhl_loadlua` | - | Missing |
| 927 | `nhl_lua_rnglog_ctx_enabled` | - | Missing |
| 857 | `nhl_makeplural` | - | Missing |
| 871 | `nhl_makesingular` | - | Missing |
| 723 | `nhl_menu` | - | Missing |
| 2115 | `nhl_meta_u_index` | - | Missing |
| 2182 | `nhl_meta_u_newindex` | - | Missing |
| 3143 | `nhl_panic` | - | Missing |
| 666 | `nhl_parse_config` | - | Missing |
| 2260 | `nhl_pcall` | - | Missing |
| 2306 | `nhl_pcall_handle` | - | Missing |
| 636 | `nhl_pline` | - | Missing |
| 2091 | `nhl_push_anything` | - | Missing |
| 2884 | `nhl_pushhooked_open_table` | - | Missing |
| 1575 | `nhl_pushkey` | - | Missing |
| 1086 | `nhl_random` | - | Missing |
| 1068 | `nhl_rn2` | - | Missing |
| 949 | `nhl_rnglog_set_lua_caller` | - | Missing |
| 885 | `nhl_s_suffix` | - | Missing |
| 2229 | `nhl_set_package_path` | - | Missing |
| 1520 | `nhl_stairways` | - | Missing |
| 1551 | `nhl_test` | - | Missing |
| 812 | `nhl_text` | - | Missing |
| 1679 | `nhl_timer_has_at` | - | Missing |
| 1710 | `nhl_timer_peek_at` | - | Missing |
| 1763 | `nhl_timer_start_at` | - | Missing |
| 1738 | `nhl_timer_stop_at` | - | Missing |
| 2192 | `nhl_u_clear_inventory` | - | Missing |
| 2202 | `nhl_u_giveobj` | - | Missing |
| 1372 | `nhl_variable` | - | Missing |
| 652 | `nhl_verbalize` | - | Missing |
| 3159 | `nhl_warn` | - | Missing |
| 2841 | `opencheckpat` | - | Missing |
| 1496 | `restore_luadata` | - | Missing |
| 1479 | `save_luadata` | - | Missing |
| 384 | `splev_chr2typ` | - | Missing |
| 403 | `splev_typ2chr` | - | Missing |
| 2810 | `start_luapat` | - | Missing |
| 2243 | `traceback_handler` | - | Missing |
| 1988 | `tutorial` | - | Missing |

### nhmd4.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 83 | `nhmd4_body` | - | Missing |
| 235 | `nhmd4_final` | - | Missing |
| 183 | `nhmd4_init` | - | Missing |
| 196 | `nhmd4_update` | - | Missing |

### o_init.c -> o_init.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 627 | `choose_disco_sort` | - | Missing |
| 709 | `disco_append_typename` | - | Missing |
| 733 | `disco_output_sorted` | - | Missing |
| 677 | `disco_typename` | - | Missing |
| 473 | `discover_object` | - | Missing |
| 569 | `discovered_cmp` | - | Missing |
| 870 | `doclassdisco` | - | Missing |
| 756 | `dodiscovered` | - | Missing |
| 1164 | `get_sortdisco` | - | Missing |
| 150 | `init_objects` | - | Missing |
| 264 | `init_oclass_probs` | - | Missing |
| 545 | `interesting_to_discover` | - | Missing |
| 293 | `obj_shuffle_range` | - | Missing |
| 376 | `objdescr_is` | - | Missing |
| 466 | `observe_object` | - | Missing |
| 858 | `oclass_to_name` | - | Missing |
| 393 | `oinit` | - | Missing |
| 84 | `randomize_gem_colors` | - | Missing |
| 1087 | `rename_disco` | - | Missing |
| 435 | `restnames` | - | Missing |
| 399 | `savenames` | - | Missing |
| 53 | `setgemprobs` | - | Missing |
| 112 | `shuffle` | - | Missing |
| 346 | `shuffle_all` | - | Missing |
| 34 | `shuffle_tiles` | - | Missing |
| 583 | `sortloot_descr` | - | Missing |
| 517 | `undiscover_object` | - | Missing |

### objects.c -> objects.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 32 | `objects_globals_init` | - | Missing |

### objnam.c -> objnam.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 2149 | `An` | - | Missing |
| 2293 | `Doname2` | - | Missing |
| 5412 | `Japanese_item_name` | - | Missing |
| 2224 | `The` | - | Missing |
| 2280 | `Tobjnam` | - | Missing |
| 2368 | `Yname2` | - | Missing |
| 2270 | `Yobjnam2` | - | Missing |
| 2392 | `Ysimple_name2` | - | Missing |
| 2480 | `actualoname` | - | Missing |
| 1143 | `add_erosion_words` | - | Missing |
| 2136 | `an` | - | Missing |
| 2436 | `ansimpleoname` | - | Missing |
| 2234 | `aobjnam` | - | Missing |
| 5425 | `armor_simple_name` | - | Missing |
| 3184 | `badman` | - | Missing |
| 2492 | `bare_artifactname` | - | Missing |
| 5541 | `boots_simple_name` | - | Missing |
| 3158 | `ch_ksound` | - | Missing |
| 5482 | `cloak_simple_name` | - | Missing |
| 1815 | `corpse_xname` | - | Missing |
| 1915 | `cxname` | - | Missing |
| 1924 | `cxname_singular` | - | Missing |
| 3910 | `dbterrainmesg` | - | Missing |
| 347 | `distant_name` | - | Missing |
| 1745 | `doname` | - | Missing |
| 1223 | `doname_base` | - | Missing |
| 1759 | `doname_vague_quan` | - | Missing |
| 1752 | `doname_with_price` | - | Missing |
| 1195 | `erosion_matters` | - | Missing |
| 431 | `fruit_from_indx` | - | Missing |
| 443 | `fruit_from_name` | - | Missing |
| 414 | `fruitname` | - | Missing |
| 5522 | `gloves_simple_name` | - | Missing |
| 5503 | `helm_simple_name` | - | Missing |
| 2100 | `just_an` | - | Missing |
| 1933 | `killer_xname` | - | Missing |
| 2826 | `makeplural` | - | Missing |
| 3027 | `makesingular` | - | Missing |
| 167 | `maybereleaseobuf` | - | Missing |
| 5596 | `mimic_obj_name` | - | Missing |
| 1038 | `minimal_xname` | - | Missing |
| 1090 | `mshot_xname` | - | Missing |
| 142 | `nextobuf` | - | Missing |
| 1778 | `not_fully_identified` | - | Missing |
| 333 | `obj_is_pname` | - | Missing |
| 201 | `obj_typename` | - | Missing |
| 2521 | `otense` | - | Missing |
| 2303 | `paydoname` | - | Missing |
| 4900 | `readobjnam` | - | Missing |
| 3923 | `readobjnam_init` | - | Missing |
| 4168 | `readobjnam_parse_charges` | - | Missing |
| 4230 | `readobjnam_postparse1` | - | Missing |
| 4656 | `readobjnam_postparse2` | - | Missing |
| 4717 | `readobjnam_postparse3` | - | Missing |
| 3956 | `readobjnam_preparse` | - | Missing |
| 150 | `releaseobuf` | - | Missing |
| 523 | `reorder_fruit` | - | Missing |
| 5393 | `rnd_class` | - | Missing |
| 3445 | `rnd_otyp_by_namedesc` | - | Missing |
| 3422 | `rnd_otyp_by_wpnskill` | - | Missing |
| 5614 | `safe_qbuf` | - | Missing |
| 312 | `safe_typename` | - | Missing |
| 3529 | `set_wallprop_from_str` | - | Missing |
| 5560 | `shield_simple_name` | - | Missing |
| 3522 | `shiny_obj` | - | Missing |
| 5590 | `shirt_simple_name` | - | Missing |
| 2000 | `short_oname` | - | Missing |
| 298 | `simple_typename` | - | Missing |
| 2418 | `simpleonames` | - | Missing |
| 2773 | `singplur_compound` | - | Missing |
| 2698 | `singplur_lookup` | - | Missing |
| 2082 | `singular` | - | Missing |
| 123 | `strprepend` | - | Missing |
| 5461 | `suit_simple_name` | - | Missing |
| 2162 | `the` | - | Missing |
| 1106 | `the_unique_obj` | - | Missing |
| 1121 | `the_unique_pm` | - | Missing |
| 2464 | `thesimpleoname` | - | Missing |
| 2553 | `vtense` | - | Missing |
| 3233 | `wishymatch` | - | Missing |
| 3544 | `wizterrainwish` | - | Missing |
| 558 | `xcalled` | - | Missing |
| 575 | `xname` | - | Missing |
| 581 | `xname_flags` | - | Missing |
| 2349 | `yname` | - | Missing |
| 2252 | `yobjnam` | - | Missing |
| 2381 | `ysimple_name` | - | Missing |

### options.c -> options.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 9307 | `add_autopickup_exception` | - | Missing |
| 8095 | `add_menu_cmd_alias` | - | Missing |
| 9650 | `all_options_apes` | - | Missing |
| 9563 | `all_options_conds` | - | Missing |
| 9602 | `all_options_menucolors` | - | Missing |
| 9635 | `all_options_msgtypes` | - | Missing |
| 9665 | `all_options_palette` | - | Missing |
| 9685 | `all_options_strbuf` | - | Missing |
| 447 | `ask_do_tutorial` | - | Missing |
| 7556 | `assign_warnings` | - | Missing |
| 6678 | `bad_negation` | - | Missing |
| 5470 | `can_set_perm_invent` | - | Missing |
| 7481 | `change_inv_order` | - | Missing |
| 708 | `check_misc_menu_command` | - | Missing |
| 5517 | `check_perm_invent_again` | - | Missing |
| 8141 | `collect_menu_keys` | - | Missing |
| 6775 | `complain_about_duplicate` | - | Missing |
| 9221 | `count_apes` | - | Missing |
| 9209 | `count_cond` | - | Missing |
| 6688 | `determine_ambiguities` | - | Missing |
| 8800 | `doset` | options_menu.js:handleSet | APPROX — options menu |
| 9048 | `doset_add_menu` | - | Missing |
| 8722 | `doset_simple` | - | Missing |
| 8551 | `doset_simple_menu` | - | Missing |
| 9286 | `dotogglepickup` | pickup.js:handleTogglePickup | Aligned |
| 6767 | `duplicate_opt_detection` | - | Missing |
| 10159 | `enhance_menu_text` | - | Missing |
| 6881 | `escapes` | - | Missing |
| 7573 | `feature_alert_opts` | - | Missing |
| 9379 | `free_autopickup_exceptions` | - | Missing |
| 7787 | `free_one_msgtype` | - | Missing |
| 801 | `freeroleoptvals` | - | Missing |
| 8185 | `fruitadd` | - | Missing |
| 8036 | `get_cnf_role_opt` | - | Missing |
| 8109 | `get_menu_cmd_key` | - | Missing |
| 8496 | `get_option_value` | - | Missing |
| 748 | `getoptstr` | - | Missing |
| 9238 | `handle_add_list_remove` | - | Missing |
| 5571 | `handler_align_misc` | - | Missing |
| 6316 | `handler_autopickup_exception` | - | Missing |
| 5609 | `handler_autounlock` | - | Missing |
| 5660 | `handler_disclose` | - | Missing |
| 6392 | `handler_menu_colors` | - | Missing |
| 5765 | `handler_menu_headings` | - | Missing |
| 5780 | `handler_menu_objsyms` | - | Missing |
| 5529 | `handler_menustyle` | - | Missing |
| 5817 | `handler_msg_window` | - | Missing |
| 6487 | `handler_msgtype` | - | Missing |
| 5878 | `handler_number_pad` | - | Missing |
| 5938 | `handler_paranoid_confirmation` | - | Missing |
| 5996 | `handler_perminv_mode` | - | Missing |
| 6137 | `handler_petattr` | - | Missing |
| 6071 | `handler_pickup_burden` | - | Missing |
| 6099 | `handler_pickup_types` | - | Missing |
| 6109 | `handler_runmode` | - | Missing |
| 6152 | `handler_sortloot` | - | Missing |
| 6306 | `handler_symset` | - | Missing |
| 6558 | `handler_versinfo` | - | Missing |
| 6191 | `handler_whatis_coord` | - | Missing |
| 6264 | `handler_whatis_filter` | - | Missing |
| 6605 | `handler_windowborders` | - | Missing |
| 7830 | `hide_unhide_msgtypes` | - | Missing |
| 8052 | `illegal_menu_cmd_key` | - | Missing |
| 7064 | `initoptions` | - | Missing |
| 7305 | `initoptions_finish` | - | Missing |
| 7119 | `initoptions_init` | - | Missing |
| 9957 | `is_wc2_option` | - | Missing |
| 9903 | `is_wc_option` | - | Missing |
| 6724 | `length_without_val` | - | Missing |
| 8523 | `longest_option_name` | - | Missing |
| 8126 | `map_menu_cmd` | - | Missing |
| 6745 | `match_optname` | - | Missing |
| 7705 | `msgtype2name` | - | Missing |
| 7746 | `msgtype_add` | - | Missing |
| 7846 | `msgtype_count` | - | Missing |
| 7772 | `msgtype_free` | - | Missing |
| 7859 | `msgtype_parse_add` | - | Missing |
| 7812 | `msgtype_type` | - | Missing |
| 9762 | `next_opt` | - | Missing |
| 6833 | `nh_getenv` | - | Missing |
| 6846 | `nmcpy` | - | Missing |
| 8077 | `oc_to_str` | - | Missing |
| 729 | `opt2roleopt` | - | Missing |
| 1408 | `optfn_DECgraphics` | - | Missing |
| 1919 | `optfn_IBMgraphics` | - | Missing |
| 937 | `optfn_align_message` | - | Missing |
| 987 | `optfn_align_status` | - | Missing |
| 899 | `optfn_alignment` | - | Missing |
| 1036 | `optfn_altkeyhandling` | - | Missing |
| 1080 | `optfn_autounlock` | - | Missing |
| 5195 | `optfn_boolean` | - | Missing |
| 1185 | `optfn_boulder` | - | Missing |
| 1263 | `optfn_catname` | - | Missing |
| 1273 | `optfn_crash_email` | - | Missing |
| 1299 | `optfn_crash_name` | - | Missing |
| 1325 | `optfn_crash_urlmax` | - | Missing |
| 1359 | `optfn_cursesgraphics` | - | Missing |
| 1456 | `optfn_disclose` | - | Missing |
| 1576 | `optfn_dogname` | - | Missing |
| 1585 | `optfn_dungeon` | - | Missing |
| 1607 | `optfn_effects` | - | Missing |
| 1629 | `optfn_font_map` | - | Missing |
| 1638 | `optfn_font_menu` | - | Missing |
| 1647 | `optfn_font_message` | - | Missing |
| 1656 | `optfn_font_size_map` | - | Missing |
| 1665 | `optfn_font_size_menu` | - | Missing |
| 1674 | `optfn_font_size_message` | - | Missing |
| 1683 | `optfn_font_size_status` | - | Missing |
| 1692 | `optfn_font_size_text` | - | Missing |
| 1701 | `optfn_font_status` | - | Missing |
| 1710 | `optfn_font_text` | - | Missing |
| 1719 | `optfn_fruit` | - | Missing |
| 1790 | `optfn_gender` | - | Missing |
| 1828 | `optfn_glyph` | - | Missing |
| 1865 | `optfn_hilite_status` | - | Missing |
| 1910 | `optfn_horsename` | - | Missing |
| 1976 | `optfn_map_mode` | - | Missing |
| 2083 | `optfn_menu_deselect_all` | - | Missing |
| 2091 | `optfn_menu_deselect_page` | - | Missing |
| 2099 | `optfn_menu_first_page` | - | Missing |
| 2189 | `optfn_menu_headings` | - | Missing |
| 2107 | `optfn_menu_invert_all` | - | Missing |
| 2115 | `optfn_menu_invert_page` | - | Missing |
| 2123 | `optfn_menu_last_page` | - | Missing |
| 2131 | `optfn_menu_next_page` | - | Missing |
| 2231 | `optfn_menu_objsyms` | - | Missing |
| 2139 | `optfn_menu_previous_page` | - | Missing |
| 2147 | `optfn_menu_search` | - | Missing |
| 2155 | `optfn_menu_select_all` | - | Missing |
| 2163 | `optfn_menu_select_page` | - | Missing |
| 2171 | `optfn_menu_shift_left` | - | Missing |
| 2179 | `optfn_menu_shift_right` | - | Missing |
| 2296 | `optfn_menuinvertmode` | - | Missing |
| 2326 | `optfn_menustyle` | - | Missing |
| 2384 | `optfn_monsters` | - | Missing |
| 2402 | `optfn_mouse_support` | - | Missing |
| 2462 | `optfn_msg_window` | - | Missing |
| 2529 | `optfn_msghistory` | - | Missing |
| 2555 | `optfn_name` | - | Missing |
| 2580 | `optfn_number_pad` | - | Missing |
| 8361 | `optfn_o_autocomplete` | - | Missing |
| 8317 | `optfn_o_autopickup_exceptions` | - | Missing |
| 8339 | `optfn_o_bind_keys` | - | Missing |
| 8383 | `optfn_o_menu_colors` | - | Missing |
| 8404 | `optfn_o_message_types` | - | Missing |
| 8429 | `optfn_o_status_cond` | - | Missing |
| 8461 | `optfn_o_status_hilites` | - | Missing |
| 2654 | `optfn_objects` | - | Missing |
| 2676 | `optfn_packorder` | - | Missing |
| 2705 | `optfn_palette` | - | Missing |
| 2741 | `optfn_palette` | - | Missing |
| 2824 | `optfn_paranoid_confirmation` | - | Missing |
| 3052 | `optfn_perminv_mode` | - | Missing |
| 3144 | `optfn_petattr` | - | Missing |
| 3203 | `optfn_pettype` | - | Missing |
| 3262 | `optfn_pickup_burden` | - | Missing |
| 3314 | `optfn_pickup_types` | - | Missing |
| 3410 | `optfn_pile_limit` | - | Missing |
| 3444 | `optfn_player_selection` | - | Missing |
| 3477 | `optfn_playmode` | - | Missing |
| 3513 | `optfn_race` | - | Missing |
| 3551 | `optfn_roguesymset` | - | Missing |
| 3595 | `optfn_role` | - | Missing |
| 3633 | `optfn_runmode` | - | Missing |
| 3675 | `optfn_scores` | - | Missing |
| 3769 | `optfn_scroll_amount` | - | Missing |
| 3800 | `optfn_scroll_margin` | - | Missing |
| 3869 | `optfn_sortdiscoveries` | - | Missing |
| 3920 | `optfn_sortloot` | - | Missing |
| 3964 | `optfn_sortvanquished` | - | Missing |
| 3830 | `optfn_soundlib` | - | Missing |
| 4019 | `optfn_statushilites` | - | Missing |
| 4073 | `optfn_statuslines` | - | Missing |
| 4117 | `optfn_subkeyvalue` | - | Missing |
| 4141 | `optfn_suppress_alert` | - | Missing |
| 4173 | `optfn_symset` | - | Missing |
| 4245 | `optfn_term_cols` | - | Missing |
| 4286 | `optfn_term_rows` | - | Missing |
| 4327 | `optfn_tile_file` | - | Missing |
| 4360 | `optfn_tile_height` | - | Missing |
| 4392 | `optfn_tile_width` | - | Missing |
| 4424 | `optfn_traps` | - | Missing |
| 4446 | `optfn_vary_msgcount` | - | Missing |
| 4478 | `optfn_versinfo` | - | Missing |
| 4653 | `optfn_video` | - | Missing |
| 4631 | `optfn_video_height` | - | Missing |
| 4610 | `optfn_video_width` | - | Missing |
| 4544 | `optfn_videocolors` | - | Missing |
| 4579 | `optfn_videoshades` | - | Missing |
| 4688 | `optfn_warnings` | - | Missing |
| 4709 | `optfn_whatis_coord` | - | Missing |
| 4754 | `optfn_whatis_filter` | - | Missing |
| 4803 | `optfn_windowborders` | - | Missing |
| 4863 | `optfn_windowchain` | - | Missing |
| 4900 | `optfn_windowcolors` | - | Missing |
| 4949 | `optfn_windowtype` | - | Missing |
| 9469 | `option_help` | - | Missing |
| 10120 | `options_free_window_colors` | - | Missing |
| 7920 | `parse_role_opt` | - | Missing |
| 7611 | `parsebindings` | - | Missing |
| 506 | `parseoptions` | - | Missing |
| 862 | `petname_optfn` | - | Missing |
| 5172 | `pfxfn_IBM_` | - | Missing |
| 4997 | `pfxfn_cond_` | - | Missing |
| 5042 | `pfxfn_font` | - | Missing |
| 7716 | `query_msgtype` | - | Missing |
| 6797 | `rejectoption` | - | Missing |
| 9356 | `remove_autopickup_exception` | - | Missing |
| 6758 | `reset_duplicate_opt_detection` | - | Missing |
| 837 | `restoptvals` | - | Missing |
| 772 | `saveoptstr` | - | Missing |
| 815 | `saveoptvals` | - | Missing |
| 7461 | `set_menuobjsyms_flags` | - | Missing |
| 9859 | `set_option_mod_status` | - | Missing |
| 10138 | `set_playmode` | - | Missing |
| 9939 | `set_wc2_option_mod_status` | - | Missing |
| 9885 | `set_wc_option_mod_status` | - | Missing |
| 2058 | `shared_menu_optfn` | - | Missing |
| 9100 | `show_menu_controls` | - | Missing |
| 5434 | `spcfn_misc_menu_cmd` | - | Missing |
| 6668 | `string_for_env_opt` | - | Missing |
| 6650 | `string_for_opt` | - | Missing |
| 9392 | `sym_val` | - | Missing |
| 8780 | `term_for_boolean` | - | Missing |
| 7886 | `test_regex_pattern` | - | Missing |
| 6956 | `txt2key` | - | Missing |
| 790 | `unsaveoptstr` | - | Missing |
| 7536 | `warning_opts` | - | Missing |
| 9970 | `wc2_supported` | - | Missing |
| 9983 | `wc_set_font_name` | - | Missing |
| 10027 | `wc_set_window_colors` | - | Missing |
| 9916 | `wc_supported` | - | Missing |

### pager.c -> pager.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 2446 | `Bitfield` | - | Missing |
| 2447 | `Bitfield` | - | Missing |
| 2448 | `Bitfield` | - | Missing |
| 1133 | `add_cmap_descr` | - | Missing |
| 1627 | `add_quoted_engraving` | - | Missing |
| 82 | `append_str` | - | Missing |
| 830 | `checkfile` | - | Missing |
| 2774 | `dispfile_debughelp` | - | Missing |
| 2744 | `dispfile_help` | - | Missing |
| 2768 | `dispfile_license` | - | Missing |
| 2756 | `dispfile_optionfile` | - | Missing |
| 2762 | `dispfile_optmenu` | - | Missing |
| 2750 | `dispfile_shelp` | - | Missing |
| 2780 | `dispfile_usagehelp` | - | Missing |
| 1669 | `do_look` | pager.js:handleLook | APPROX — look at ground |
| 1246 | `do_screen_description` | - | Missing |
| 2249 | `do_supplemental_info` | - | Missing |
| 2714 | `docontact` | - | Missing |
| 2856 | `dohelp` | pager.js:handleHelp | APPROX — help command |
| 2957 | `dohistory` | pager.js:handleHistory | APPROX — message history |
| 2332 | `doidtrap` | - | Missing |
| 2816 | `domenucontrols` | - | Missing |
| 2325 | `doquickwhatis` | - | Missing |
| 2655 | `dowhatdoes` | pager.js:handleWhatdoes | APPROX — key help |
| 2573 | `dowhatdoes_core` | - | Missing |
| 2318 | `dowhatis` | pager.js:handleWhatis | APPROX — identify symbol |
| 2810 | `hmenu_doextlist` | - | Missing |
| 2786 | `hmenu_doextversion` | - | Missing |
| 2792 | `hmenu_dohistory` | - | Missing |
| 2804 | `hmenu_dowhatdoes` | - | Missing |
| 2798 | `hmenu_dowhatis` | - | Missing |
| 807 | `ia_checkfile` | - | Missing |
| 614 | `ice_descr` | - | Missing |
| 68 | `is_swallow_sym` | - | Missing |
| 1975 | `look_all` | - | Missing |
| 422 | `look_at_monster` | - | Missing |
| 380 | `look_at_object` | - | Missing |
| 2140 | `look_engrs` | - | Missing |
| 1962 | `look_region_nearby` | - | Missing |
| 2074 | `look_traps` | - | Missing |
| 657 | `lookat` | - | Missing |
| 186 | `mhidden_description` | - | Missing |
| 138 | `monhealthdescr` | - | Missing |
| 284 | `object_from_map` | - | Missing |
| 108 | `self_lookat` | - | Missing |
| 2904 | `setopt_cmd` | - | Missing |
| 167 | `trap_description` | - | Missing |
| 561 | `waterbody_name` | - | Missing |
| 2454 | `whatdoes_cond` | - | Missing |
| 2417 | `whatdoes_help` | - | Missing |

### pickup.c -> pickup.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 2035 | `able_to_loot` | - | Missing |
| 475 | `add_valid_menu_class` | - | Missing |
| 509 | `all_but_uchain` | - | Missing |
| 517 | `allow_all` | - | Missing |
| 597 | `allow_cat_no_uchain` | - | Missing |
| 523 | `allow_category` | - | Missing |
| 975 | `autopick` | - | Missing |
| 930 | `autopick_testobj` | - | Missing |
| 2531 | `boh_loss` | - | Missing |
| 1570 | `carry_count` | - | Missing |
| 913 | `check_autopickup_exceptions` | - | Missing |
| 430 | `check_here` | - | Missing |
| 3485 | `choose_tip_container_menu` | - | Missing |
| 2714 | `ck_bag` | - | Missing |
| 101 | `collect_obj_classes` | - | Missing |
| 2018 | `container_at` | - | Missing |
| 2883 | `container_gone` | - | Missing |
| 1511 | `count_categories` | - | Missing |
| 635 | `count_justpicked` | - | Missing |
| 3829 | `count_target_containers` | - | Missing |
| 337 | `deferred_decor` | - | Missing |
| 1544 | `delta_cwt` | - | Missing |
| 353 | `describe_decor` | - | Missing |
| 2512 | `do_boh_explosion` | - | Missing |
| 2082 | `do_loot_cont` | - | Missing |
| 2160 | `doloot` | pickup.js:handleLoot | APPROX — loot command |
| 2172 | `doloot_core` | - | Missing |
| 3542 | `dotip` | - | Missing |
| 1972 | `encumber_msg` | - | Missing |
| 2891 | `explain_container_prompt` | - | Missing |
| 285 | `fatal_corpse_mistake` | - | Missing |
| 648 | `find_justpicked` | - | Missing |
| 317 | `force_decor` | - | Missing |
| 2552 | `in_container` | - | Missing |
| 3377 | `in_or_out_menu` | - | Missing |
| 2504 | `is_boh_item_gone` | - | Missing |
| 609 | `is_worn_by_type` | - | Missing |
| 1705 | `lift_object` | - | Missing |
| 2425 | `loot_mon` | - | Missing |
| 2482 | `mbag_explodes` | - | Missing |
| 2797 | `mbag_item_gone` | - | Missing |
| 469 | `menu_class_present` | - | Missing |
| 3245 | `menu_loot` | - | Missing |
| 2066 | `mon_beside` | - | Missing |
| 460 | `n_or_more` | - | Missing |
| 2820 | `observe_quantum_cat` | - | Missing |
| 2721 | `out_container` | - | Missing |
| 1897 | `pick_obj` | - | Missing |
| 672 | `pickup` | pickup.js:handlePickup | APPROX — pickup command |
| 1803 | `pickup_object` | - | Missing |
| 1942 | `pickup_prinv` | - | Missing |
| 1226 | `query_category` | - | Missing |
| 141 | `query_classes` | - | Missing |
| 1025 | `query_objlist` | - | Missing |
| 2775 | `removed_from_icebox` | - | Missing |
| 616 | `reset_justpicked` | - | Missing |
| 2344 | `reverse_loot` | - | Missing |
| 303 | `rider_corpse_revival` | - | Missing |
| 76 | `simple_look` | - | Missing |
| 2937 | `stash_ok` | - | Missing |
| 3461 | `tip_ok` | - | Missing |
| 3668 | `tipcontainer` | - | Missing |
| 3934 | `tipcontainer_checks` | - | Missing |
| 3851 | `tipcontainer_gettarget` | - | Missing |
| 3210 | `traditional_loot` | - | Missing |
| 2923 | `u_handsy` | - | Missing |
| 273 | `u_safe_from_fatal_corpse` | - | Missing |
| 2952 | `use_container` | - | Missing |

### pline.c -> pline.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 327 | `Norep` | 154 | Aligned |
| 425 | `There` | 195 | Aligned |
| 366 | `You` | 175 | Aligned |
| 339 | `You_buf` | 211 | Aligned |
| 403 | `You_cant` | 187 | Aligned |
| 388 | `You_feel` | 183 | Aligned |
| 436 | `You_hear` | 199 | Aligned |
| 455 | `You_see` | 203 | Aligned |
| 377 | `Your` | 179 | Aligned |
| 299 | `custompline` | 125 | Aligned |
| 52 | `dumplogfreemessages` | 227 | Aligned |
| 22 | `dumplogmsg` | 219 | Aligned |
| 641 | `execplinehandler` | 262 | Aligned |
| 351 | `free_youbuf` | 215 | Aligned (no-op) |
| 495 | `gamelog_add` | 235 | Aligned |
| 531 | `gamelog_add` | 235 | Aligned (single entry point) |
| 584 | `impossible` | 253 | Aligned |
| 514 | `livelog_printf` | 244 | Aligned |
| 538 | `livelog_printf` | 244 | Aligned (single entry point) |
| 690 | `nhassert_failed` | 268 | Aligned |
| 104 | `pline` | 131 | Aligned |
| 414 | `pline_The` | 191 | Aligned |
| 114 | `pline_dir` | 158 | Aligned |
| 138 | `pline_mon` | 168 | Aligned |
| 126 | `pline_xy` | 163 | Aligned |
| 65 | `putmesg` | - | N/A (handled via setOutputContext) |
| 549 | `raw_printf` | 140 | Aligned |
| 84 | `set_msg_dir` | 51 | Aligned |
| 93 | `set_msg_xy` | 55 | Aligned |
| 315 | `urgent_pline` | 150 | Aligned |
| 476 | `verbalize` | 207 | Aligned |
| 153 | `vpline` | 135 | Aligned |
| 563 | `vraw_printf` | 144 | Aligned |

### polyself.c -> polyself.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 2175 | `armor_to_dragon` | - | Missing |
| 2127 | `body_part` | - | Missing |
| 1153 | `break_armor` | - | Missing |
| 269 | `change_sex` | - | Missing |
| 168 | `check_strangling` | - | Missing |
| 1405 | `dobreathe` | - | Missing |
| 1626 | `dogaze` | - | Missing |
| 1761 | `dohide` | - | Missing |
| 1878 | `domindblast` | - | Missing |
| 1861 | `dopoly` | - | Missing |
| 1465 | `doremove` | - | Missing |
| 1481 | `dospinweb` | - | Missing |
| 1434 | `dospit` | - | Missing |
| 1608 | `dosummon` | - | Missing |
| 1290 | `drop_weapon` | - | Missing |
| 1119 | `dropp` | - | Missing |
| 131 | `float_vs_flight` | - | Missing |
| 303 | `livelog_newform` | - | Missing |
| 1956 | `mbodypart` | - | Missing |
| 332 | `newman` | - | Missing |
| 2133 | `poly_gender` | - | Missing |
| 200 | `polyman` | - | Missing |
| 731 | `polymon` | - | Missing |
| 465 | `polyself` | - | Missing |
| 2220 | `polysense` | - | Missing |
| 1352 | `rehumanize` | - | Missing |
| 38 | `set_uasmon` | - | Missing |
| 1938 | `skinback` | - | Missing |
| 158 | `steed_vs_stealth` | - | Missing |
| 1073 | `uasmon_maxStr` | - | Missing |
| 2257 | `udeadinside` | - | Missing |
| 2249 | `ugenocided` | - | Missing |
| 2144 | `ugolemeffects` | - | Missing |
| 1925 | `uunstick` | - | Missing |

### potion.c -> potion.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1494 | `H2Opotion_dip` | - | Missing |
| 1484 | `bottlename` | - | Missing |
| 2217 | `dip_hands_ok` | - | Missing |
| 2365 | `dip_into` | - | Missing |
| 2200 | `dip_ok` | - | Missing |
| 2403 | `dip_potion_explosion` | - | Missing |
| 2801 | `djinni_from_bottle` | - | Missing |
| 2253 | `dodip` | - | Missing |
| 526 | `dodrink` | - | Missing |
| 618 | `dopotion` | - | Missing |
| 505 | `drink_ok` | - | Missing |
| 481 | `ghost_from_bottle` | - | Missing |
| 1424 | `healup` | 324 | Full: heal HP, max HP increase, cure blindness, cure sickness |
| 2229 | `hold_potion` | - | Missing |
| 1591 | `impact_arti_light` | - | Missing |
| 83 | `incr_itimeout` | 53 | Full match |
| 56 | `itimeout` | 29 | Full match |
| 68 | `itimeout_incr` | 37 | Full match |
| 261 | `make_blinded` | 133 | Probe-ahead with BBlinded, message paths for regaining/losing sight, Unaware check. Missing: Eyes of Overworld special messages, Blindfolded sub-paths, toggle_blindness vision calls |
| 89 | `make_confused` | 66 | Full: Unaware check, Hallucination-aware message, botl flag |
| 443 | `make_deaf` | 176 | Full match |
| 461 | `make_glib` | 190 | Full match |
| 369 | `make_hallucinated` | 152 | Full: mask parameter for Halluc_resistance toggling, Blind-aware verb, botl flag. Missing: uswallow/mimicking/vision recalc |
| 137 | `make_sick` | 104 | Full: Sick_resistance check, partial cure (clearing one type keeps other with doubled timer), cause tracking, CON exercise. Missing: delayed_killer allocation |
| 195 | `make_slimed` | 193 | Simplified: set/clear with message and botl. Missing: fake appearance handling |
| 222 | `make_stoned` | 200 | Simplified: set/clear with message and botl. Missing: delayed_killer |
| 107 | `make_stunned` | 85 | Full: Unaware check, stagger message, botl flag. Missing: u.usteed wobble |
| 243 | `make_vomiting` | 167 | Full: Unaware check, message on clear, botl flag |
| 2108 | `mixtype` | - | Missing |
| 2782 | `mongrantswish` | - | Missing |
| 1293 | `peffect_acid` | 510 | Acid_resistance check, damage, exercise |
| 1069 | `peffect_blindness` | 352 | Blessed cure, cursed extension |
| 768 | `peffect_booze` | 560 | Confusion from booze |
| 1010 | `peffect_confusion` | 337 | Blessed cure, cursed extension |
| 792 | `peffect_enlightenment` | - | Missing |
| 1124 | `peffect_extra_healing` | 456 | Heal + max HP, cure hallucination, exercise |
| 1140 | `peffect_full_healing` | 469 | Full heal, cure hallucination, exercise |
| 1026 | `peffect_gain_ability` | 546 | Simplified: random attr +1. Missing: blessed=all attrs, proper adjattrib |
| 1220 | `peffect_gain_energy` | 492 | Energy gain/drain with max increase |
| 1079 | `peffect_gain_level` | 480 | Level gain/loss. Missing: pluslvl() with adjabil/newhp/newpw |
| 693 | `peffect_hallucination` | 433 | Blessed cure, cursed extension |
| 1115 | `peffect_healing` | 445 | Heal, cure blindness, exercise |
| 808 | `peffect_invisibility` | 521 | Timed invisibility via incr_itimeout |
| 1161 | `peffect_levitation` | - | Missing |
| 910 | `peffect_monster_detection` | - | Missing |
| 951 | `peffect_object_detection` | - | Missing |
| 1256 | `peffect_oil` | - | Missing |
| 877 | `peffect_paralysis` | 396 | FREE_ACTION check, confusion-aware message |
| 1314 | `peffect_polymorph` | - | Missing |
| 646 | `peffect_restore_ability` | 539 | Stub: no attribute restoration yet |
| 838 | `peffect_see_invisible` | 532 | Timed see_invis via incr_itimeout |
| 960 | `peffect_sickness` | 416 | Blessed cure, cursed illness, uncursed vomiting |
| 897 | `peffect_sleeping` | 380 | FREE_ACTION check, blessed wake, sleep mechanism |
| 1048 | `peffect_speed` | 364 | Speed up with incr_itimeout. Missing: full speed_up() |
| 714 | `peffect_water` | - | Missing |
| 1329 | `peffects` | 577 | Dispatcher for 18 potion types |
| 2394 | `poof` | - | Missing |
| 2428 | `potion_dip` | - | Missing |
| 1918 | `potionbreathe` | - | Missing |
| 1621 | `potionhit` | - | Missing |
| 471 | `self_invis_message` | - | Missing |
| 75 | `set_itimeout` | 46 | Full match |
| 2905 | `speed_up` | - | Missing (peffect_speed uses incr_itimeout directly) |
| 2859 | `split_mon` | - | Missing |
| 1457 | `strange_feeling` | - | Missing |
| 336 | `toggle_blindness` | - | Missing |

### pray.c -> pray.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 2507 | `a_gname` | - | Missing |
| 2514 | `a_gname_at` | - | Missing |
| 2530 | `align_gname` | - | Missing |
| 2628 | `align_gtitle` | - | Missing |
| 2652 | `altar_wrath` | - | Missing |
| 2490 | `altarmask_at` | - | Missing |
| 704 | `angrygods` | - | Missing |
| 788 | `at_your_feet` | - | Missing |
| 1781 | `bestow_artifact` | - | Missing |
| 2677 | `blocked_boulder` | - | Missing |
| 2124 | `can_pray` | - | Missing |
| 1446 | `consume_offering` | - | Missing |
| 116 | `critically_low_hp` | - | Missing |
| 1501 | `desecrate_altar` | - | Missing |
| 2199 | `dopray` | - | Missing |
| 1854 | `dosacrifice` | - | Missing |
| 2414 | `doturn` | - | Missing |
| 1899 | `eval_offering` | - | Missing |
| 349 | `fix_curse_trouble` | - | Missing |
| 373 | `fix_worst_trouble` | - | Missing |
| 694 | `fry_by_god` | - | Missing |
| 805 | `gcrownu` | - | Missing |
| 999 | `give_spell` | - | Missing |
| 610 | `god_zaps_you` | - | Missing |
| 1429 | `gods_angry` | - | Missing |
| 1436 | `gods_upset` | - | Missing |
| 1415 | `godvoice` | - | Missing |
| 2577 | `halu_gname` | - | Missing |
| 198 | `in_trouble` | - | Missing |
| 2347 | `maybe_turn_mon_iter` | - | Missing |
| 1959 | `offer_corpse` | - | Missing |
| 1631 | `offer_different_alignment_altar` | - | Missing |
| 1602 | `offer_fake_amulet` | - | Missing |
| 1592 | `offer_negative_valued` | - | Missing |
| 1529 | `offer_real_amulet` | - | Missing |
| 1480 | `offer_too_soon` | - | Missing |
| 1071 | `pleased` | - | Missing |
| 2177 | `pray_revive` | - | Missing |
| 2276 | `prayer_done` | - | Missing |
| 1839 | `sacrifice_value` | - | Missing |
| 1698 | `sacrifice_your_race` | - | Missing |
| 161 | `stuck_in_wall` | - | Missing |
| 2524 | `u_gname` | - | Missing |
| 1387 | `water_prayer` | - | Missing |
| 288 | `worst_cursed_item` | - | Missing |

### priest.c -> priest.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 841 | `angry_priest` | - | Missing |
| 883 | `clearpriests` | - | Missing |
| 392 | `findpriest` | - | Missing |
| 545 | `forget_temple_entry` | - | Missing |
| 28 | `free_epri` | - | Missing |
| 760 | `ghod_hitsu` | - | Missing |
| 376 | `has_shrine` | - | Missing |
| 153 | `histemple_at` | - | Missing |
| 735 | `in_your_sanctuary` | - | Missing |
| 161 | `inhistemple` | - | Missing |
| 410 | `intemple` | - | Missing |
| 688 | `mk_roamer` | - | Missing |
| 280 | `mon_aligntyp` | - | Missing |
| 42 | `move_special` | - | Missing |
| 16 | `newepri` | - | Missing |
| 370 | `p_coaligned` | - | Missing |
| 177 | `pri_move` | - | Missing |
| 558 | `priest_talk` | - | Missing |
| 220 | `priestini` | - | Missing |
| 302 | `priestname` | - | Missing |
| 719 | `reset_hostility` | - | Missing |
| 897 | `restpriest` | - | Missing |
| 142 | `temple_occupied` | - | Missing |

### quest.c -> quest.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 125 | `artitouch` | - | Missing |
| 427 | `chat_with_guardian` | - | Missing |
| 282 | `chat_with_leader` | - | Missing |
| 380 | `chat_with_nemesis` | - | Missing |
| 186 | `expulsion` | - | Missing |
| 226 | `finish_quest` | - | Missing |
| 153 | `is_pure` | - | Missing |
| 116 | `leaddead` | - | Missing |
| 357 | `leader_speaks` | - | Missing |
| 107 | `nemdead` | - | Missing |
| 389 | `nemesis_speaks` | - | Missing |
| 412 | `nemesis_stinks` | - | Missing |
| 147 | `not_capable` | - | Missing |
| 140 | `ok_to_quest` | - | Missing |
| 62 | `on_goal` | - | Missing |
| 40 | `on_locate` | - | Missing |
| 26 | `on_start` | - | Missing |
| 90 | `onquest` | - | Missing |
| 437 | `prisoner_speaks` | - | Missing |
| 459 | `quest_chat` | - | Missing |
| 500 | `quest_stat_check` | - | Missing |
| 481 | `quest_talk` | - | Missing |

### questpgr.c -> questpgr.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 624 | `com_pager` | - | Missing |
| 468 | `com_pager_core` | - | Missing |
| 236 | `convert_arg` | - | Missing |
| 328 | `convert_line` | - | Missing |
| 423 | `deliver_by_pline` | - | Missing |
| 439 | `deliver_by_window` | - | Missing |
| 655 | `deliver_splev_message` | - | Missing |
| 73 | `find_qarti` | - | Missing |
| 89 | `find_quest_artifact` | - | Missing |
| 134 | `guardname` | - | Missing |
| 142 | `homebase` | - | Missing |
| 61 | `intermed` | - | Missing |
| 67 | `is_quest_artifact` | - | Missing |
| 50 | `ldrname` | - | Missing |
| 124 | `neminame` | - | Missing |
| 637 | `qt_montype` | - | Missing |
| 630 | `qt_pager` | - | Missing |
| 199 | `qtext_pronoun` | - | Missing |
| 459 | `skip_pager` | - | Missing |
| 150 | `stinky_nemesis` | - | Missing |

### read.c -> read.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 253 | `apron_text` | - | Missing |
| 303 | `assign_candy_wrapper` | - | Missing |
| 1079 | `can_center_cloud` | - | Missing |
| 295 | `candy_wrapper_text` | - | Missing |
| 3059 | `cant_revive` | - | Missing |
| 79 | `cap_spe` | read.js:275 | Implemented |
| 688 | `charge_ok` | - | Missing |
| 3319 | `create_particular` | - | Missing |
| 3199 | `create_particular_creation` | - | Missing |
| 3084 | `create_particular_parse` | - | Missing |
| 1087 | `display_stinking_cloud_positions` | - | Missing |
| 2585 | `do_class_genocide` | - | Missing |
| 2773 | `do_genocide` | - | Missing |
| 3029 | `do_stinking_cloud` | - | Missing |
| 329 | `doread` | read.js:73 | Implemented (handleRead: inventory selection + spellbook study + seffects dispatch) |
| 2288 | `drop_boulder_on_monster` | - | Missing |
| 2241 | `drop_boulder_on_player` | - | Missing |
| 88 | `erode_obj_text` | - | Missing |
| 1019 | `forget` | read.js:936 | Partial (inline in seffect_amnesia; forgets spells only, no map forget) |
| 223 | `hawaiian_design` | - | Missing |
| 189 | `hawaiian_motif` | - | Missing |
| 69 | `learnscroll` | - | Missing (learnscrolltyp used directly) |
| 57 | `learnscrolltyp` | read.js:270 | Implemented (wraps discoverObject) |
| 2438 | `litroom` | - | Missing |
| 1043 | `maybe_tame` | - | Missing |
| 666 | `p_glow1` | - | Missing |
| 672 | `p_glow2` | - | Missing |
| 679 | `p_glow3` | - | Missing |
| 2966 | `punish` | - | Missing |
| 314 | `read_ok` | - | Missing |
| 728 | `recharge` | - | Missing |
| 1777 | `seffect_amnesia` | read.js:936 | Implemented (forgets spells; rn2 message; exercise(A_WIS,false)) |
| 1952 | `seffect_blank_paper` | read.js:317 | Implemented |
| 1735 | `seffect_charging` | read.js:388 | Partial (confused path faithful; non-confused: no getobj/recharge yet) |
| 1348 | `seffect_confuse_monster` | read.js:469 | Implemented (faithful RNG: rnd(100), rnd(2), rn1(8,2); umconf tracking) |
| 1557 | `seffect_create_monster` | read.js:839 | Implemented (faithful RNG: rn2(73)+rnd(4); uses makemon; confused=acid blob) |
| 1285 | `seffect_destroy_armor` | read.js:789 | Implemented (confused erodeproof; normal destroy_arm; cursed degrade+stun) |
| 1866 | `seffect_earth` | read.js:1043 | Approximate (messages match; no boulder drop_boulder_on_monster/player yet) |
| 1114 | `seffect_enchant_armor` | read.js:686 | Implemented (faithful: evaporation check, enchant calc, vibration warning) |
| 1576 | `seffect_enchant_weapon` | read.js:606 | Implemented (faithful: confused erodeproof; chwepon RNG: rn2(spe), rnd(3-spe/3)) |
| 1797 | `seffect_fire` | read.js:1007 | Partial (faithful RNG: rn1(3,3)+bcsign; no explode() area effect yet) |
| 1993 | `seffect_food_detection` | read.js:901 | Stub (message only; needs food_detect infrastructure) |
| 1669 | `seffect_genocide` | read.js:993 | Stub (messages only; needs do_genocide/do_class_genocide prompts) |
| 1982 | `seffect_gold_detection` | read.js:884 | Stub (message only; needs gold_detect/trap_detect infrastructure) |
| 2002 | `seffect_identify` | read.js:326 | Implemented (faithful RNG: rn2(5) blessed check + cval; identify_pack inline) |
| 1688 | `seffect_light` | read.js:425 | Partial (confused: faithful rn1(2,3)+makemon lights; non-confused: no litroom yet) |
| 2049 | `seffect_magic_mapping` | read.js:909 | Approximate (messages match; no do_mapping() level reveal yet) |
| 2104 | `seffect_mail` | - | Missing (mail not relevant to gameplay) |
| 1923 | `seffect_punishment` | read.js:1063 | Partial (confused/blessed "guilty" faithful; no punish() ball-and-chain yet) |
| 1438 | `seffect_remove_curse` | read.js:556 | Implemented (faithful: inventory iteration, blessorcurse(2) for confused, uncurse worn) |
| 1403 | `seffect_scare_monster` | read.js:515 | Implemented (faithful: resist() per monster, monflee, cansee check, ct counting) |
| 1938 | `seffect_stinking_cloud` | read.js:1078 | Stub (message only; needs do_stinking_cloud positioning) |
| 1626 | `seffect_taming` | read.js:960 | Approximate (simplified: no resist/maybe_tame, just sets tame flag in radius) |
| 1962 | `seffect_teleportation` | read.js:867 | Stub (messages only; needs scrolltele/level_tele infrastructure) |
| 2141 | `seffects` | read.js:1097 | Implemented (full dispatch to all 22 scroll types; exercise(A_WIS) for magic scrolls) |
| 2418 | `set_lit` | - | Missing |
| 651 | `stripspe` | - | Missing |
| 99 | `tshirt_text` | - | Missing |
| 3013 | `unpunish` | - | Missing |
| 1068 | `valid_cloud_pos` | - | Missing |
| 2361 | `wand_explode` | - | Missing |

### rect.c -> rect.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 161 | `add_rect` | - | Missing |
| 45 | `free_rect` | - | Missing |
| 82 | `get_rect` | - | Missing |
| 60 | `get_rect_ind` | - | Missing |
| 29 | `init_rect` | - | Missing |
| 116 | `intersect` | - | Missing |
| 134 | `rect_bounds` | - | Missing |
| 147 | `remove_rect` | - | Missing |
| 104 | `rnd_rect` | - | Missing |
| 182 | `split_rects` | - | Missing |

### region.c -> region.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 161 | `add_mon_to_reg` | - | Missing |
| 133 | `add_rect_to_reg` | - | Missing |
| 284 | `add_region` | - | Missing |
| 660 | `any_visible_region` | - | Missing |
| 394 | `clear_regions` | - | Missing |
| 227 | `clone_region` | - | Missing |
| 1003 | `create_force_field` | - | Missing |
| 1213 | `create_gas_cloud` | - | Missing |
| 1313 | `create_gas_cloud_selection` | - | Missing |
| 955 | `create_msg_region` | - | Missing |
| 79 | `create_region` | - | Missing |
| 983 | `enter_force_field` | - | Missing |
| 1046 | `expire_gas_cloud` | - | Missing |
| 263 | `free_region` | - | Missing |
| 480 | `in_out_region` | - | Missing |
| 1091 | `inside_gas_cloud` | - | Missing |
| 54 | `inside_rect` | - | Missing |
| 63 | `inside_region` | - | Missing |
| 1168 | `is_hero_inside_gas_cloud` | - | Missing |
| 533 | `m_in_out_region` | - | Missing |
| 1182 | `make_gas_cloud` | - | Missing |
| 210 | `mon_in_region` | - | Missing |
| 651 | `reg_damg` | - | Missing |
| 1341 | `region_danger` | - | Missing |
| 1368 | `region_safety` | - | Missing |
| 899 | `region_stats` | - | Missing |
| 192 | `remove_mon_from_reg` | - | Missing |
| 638 | `remove_mon_from_regions` | - | Missing |
| 344 | `remove_region` | - | Missing |
| 622 | `replace_mon_regions` | - | Missing |
| 928 | `reset_region_mids` | - | Missing |
| 799 | `rest_regions` | - | Missing |
| 414 | `run_regions` | - | Missing |
| 741 | `save_regions` | - | Missing |
| 732 | `show_region` | - | Missing |
| 598 | `update_monster_region` | - | Missing |
| 582 | `update_player_regions` | - | Missing |
| 718 | `visible_region_at` | - | Missing |
| 674 | `visible_region_summary` | - | Missing |

### report.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 529 | `NH_panictrace_gdb` | - | Missing |
| 485 | `NH_panictrace_libc` | - | Missing |
| 189 | `crashreport_bidshow` | - | Missing |
| 113 | `crashreport_init` | - | Missing |
| 461 | `dobugreport` | - | Missing |
| 571 | `get_saved_pline` | - | Missing |
| 600 | `panictrace_handler` | - | Missing |
| 625 | `panictrace_setsignals` | - | Missing |
| 290 | `submit_web_report` | - | Missing |
| 237 | `swr_add_uricoded` | - | Missing |

### restore.c -> restore.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1430 | `add_id_mapping` | - | Missing |
| 1417 | `clear_id_mapping` | - | Missing |
| 781 | `dorecover` | - | Missing |
| 71 | `find_lev_obj` | - | Missing |
| 484 | `freefruitchn` | - | Missing |
| 1308 | `get_plname_from_file` | - | Missing |
| 1038 | `getlev` | - | Missing |
| 497 | `ghostfruit` | - | Missing |
| 113 | `inven_inuse` | - | Missing |
| 465 | `loadfruitchn` | - | Missing |
| 1454 | `lookup_id_mapping` | - | Missing |
| 1480 | `reset_oattached_mids` | - | Missing |
| 1339 | `rest_bubbles` | - | Missing |
| 1013 | `rest_levl` | - | Missing |
| 947 | `rest_stairs` | - | Missing |
| 980 | `restcemetery` | - | Missing |
| 153 | `restdamage` | - | Missing |
| 522 | `restgamestate` | - | Missing |
| 130 | `restlevchn` | - | Missing |
| 747 | `restlevelfile` | - | Missing |
| 734 | `restlevelstate` | - | Missing |
| 307 | `restmon` | - | Missing |
| 373 | `restmonchn` | - | Missing |
| 183 | `restobj` | - | Missing |
| 231 | `restobjchn` | - | Missing |
| 1360 | `restore_gamelog` | - | Missing |
| 1506 | `restore_menu` | - | Missing |
| 1385 | `restore_msghistory` | - | Missing |
| 1027 | `trickery` | - | Missing |

### rip.c -> display.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 75 | `center` | - | Missing |
| 85 | `genl_outrip` | - | Missing |

### rnd.c -> rng.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 207 | `RND` | - | Missing |
| 338 | `d` | - | Missing |
| 189 | `init_isaac64` | - | Missing |
| 465 | `init_random` | - | Missing |
| 103 | `midlog_enter` | - | Missing |
| 114 | `midlog_exit_int` | - | Missing |
| 140 | `midlog_exit_ptr` | - | Missing |
| 127 | `midlog_exit_void` | - | Missing |
| 472 | `reseed_random` | - | Missing |
| 241 | `rn2` | - | Missing |
| 216 | `rn2_on_display_rng` | - | Missing |
| 231 | `rn2_on_display_rng` | - | Missing |
| 312 | `rnd` | - | Missing |
| 331 | `rnd_on_display_rng` | - | Missing |
| 361 | `rne` | - | Missing |
| 56 | `rng_log_get_call_count` | - | Missing |
| 37 | `rng_log_init` | - | Missing |
| 48 | `rng_log_set_caller` | - | Missing |
| 62 | `rng_log_write` | - | Missing |
| 262 | `rnl` | - | Missing |
| 390 | `rnz` | - | Missing |
| 418 | `set_random` | - | Missing |
| 428 | `set_random` | - | Missing |
| 482 | `shuffle_int_array` | - | Missing |
| 178 | `whichrng` | - | Missing |

### role.c -> role.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 2143 | `Goodbye` | - | Missing |
| 2120 | `Hello` | - | Missing |
| 1583 | `build_plselection_prompt` | - | Missing |
| 2163 | `character_race` | - | Missing |
| 1358 | `clearrolefilter` | - | Missing |
| 2177 | `genl_player_selection` | - | Missing |
| 2206 | `genl_player_setup` | - | Missing |
| 3017 | `genl_player_setup` | - | Missing |
| 1303 | `gotrolefilter` | - | Missing |
| 2777 | `maybe_skip_seps` | - | Missing |
| 1172 | `ok_align` | - | Missing |
| 1107 | `ok_gend` | - | Missing |
| 1037 | `ok_race` | - | Missing |
| 971 | `ok_role` | - | Missing |
| 1211 | `pick_align` | - | Missing |
| 1146 | `pick_gend` | - | Missing |
| 1081 | `pick_race` | - | Missing |
| 1015 | `pick_role` | - | Missing |
| 1665 | `plnamesuffix` | - | Missing |
| 2806 | `plsel_startmenu` | - | Missing |
| 1384 | `promptsep` | - | Missing |
| 1415 | `race_alignmentcount` | - | Missing |
| 916 | `randalign` | - | Missing |
| 853 | `randgend` | - | Missing |
| 787 | `randrace` | - | Missing |
| 719 | `randrole` | - | Missing |
| 731 | `randrole_filtered` | - | Missing |
| 2728 | `reset_role_filtering` | - | Missing |
| 1235 | `rigid_role_checks` | - | Missing |
| 1399 | `role_gendercount` | - | Missing |
| 1980 | `role_init` | - | Missing |
| 1816 | `role_menu_extra` | - | Missing |
| 1726 | `role_selection_prolog` | - | Missing |
| 1318 | `rolefilterstring` | - | Missing |
| 1431 | `root_plselection_prompt` | - | Missing |
| 1284 | `setrolefilter` | - | Missing |
| 2979 | `setup_algnmenu` | - | Missing |
| 2943 | `setup_gendmenu` | - | Missing |
| 2905 | `setup_racemenu` | - | Missing |
| 2854 | `setup_rolemenu` | - | Missing |
| 943 | `str2align` | - | Missing |
| 880 | `str2gend` | - | Missing |
| 813 | `str2race` | - | Missing |
| 747 | `str2role` | - | Missing |
| 907 | `validalign` | - | Missing |
| 844 | `validgend` | - | Missing |
| 778 | `validrace` | - | Missing |
| 713 | `validrole` | - | Missing |

### rumors.c -> rumors.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 791 | `CapitalMon` | - | Missing |
| 770 | `couldnt_open_file` | - | Missing |
| 696 | `doconsult` | - | Missing |
| 939 | `free_CapMons` | - | Missing |
| 420 | `get_rnd_line` | - | Missing |
| 499 | `get_rnd_text` | - | Missing |
| 117 | `getrumor` | - | Missing |
| 829 | `init_CapMons` | - | Missing |
| 577 | `init_oracles` | - | Missing |
| 85 | `init_rumors` | - | Missing |
| 308 | `others_check` | - | Missing |
| 640 | `outoracle` | - | Missing |
| 529 | `outrumor` | - | Missing |
| 623 | `restore_oracles` | - | Missing |
| 196 | `rumor_check` | - | Missing |
| 598 | `save_oracles` | - | Missing |
| 67 | `unpadline` | - | Missing |

### save.c -> save.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 74 | `dosave0` | - | Missing |
| 1038 | `free_dungeons` | - | Missing |
| 1055 | `freedynamicdata` | - | Missing |
| 679 | `save_bc` | - | Missing |
| 574 | `save_bubbles` | - | Missing |
| 237 | `save_gamelog` | - | Missing |
| 1008 | `save_msghistory` | - | Missing |
| 648 | `save_stairs` | - | Missing |
| 600 | `savecemetery` | - | Missing |
| 623 | `savedamage` | - | Missing |
| 929 | `savefruitchn` | - | Missing |
| 265 | `savegamestate` | - | Missing |
| 421 | `savelev` | - | Missing |
| 444 | `savelev_core` | - | Missing |
| 952 | `savelevchn` | - | Missing |
| 560 | `savelevl` | - | Missing |
| 809 | `savemon` | - | Missing |
| 862 | `savemonchn` | - | Missing |
| 709 | `saveobj` | - | Missing |
| 745 | `saveobjchn` | - | Missing |
| 343 | `savestateinlock` | - | Missing |
| 898 | `savetrapchn` | - | Missing |
| 977 | `store_plname_in_file` | - | Missing |
| 329 | `tricked_fileremoved` | - | Missing |

### selvar.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 542 | `line_dist_coord` | - | Missing |
| 379 | `sel_flood_havepoint` | - | Missing |
| 48 | `selection_clear` | - | Missing |
| 65 | `selection_clone` | - | Missing |
| 456 | `selection_do_ellipse` | - | Missing |
| 570 | `selection_do_gradient` | - | Missing |
| 321 | `selection_do_grow` | - | Missing |
| 626 | `selection_do_line` | - | Missing |
| 683 | `selection_do_randline` | - | Missing |
| 248 | `selection_filter_mapchar` | - | Missing |
| 224 | `selection_filter_percent` | - | Missing |
| 395 | `selection_floodfill` | - | Missing |
| 802 | `selection_force_newsyms` | - | Missing |
| 33 | `selection_free` | - | Missing |
| 781 | `selection_from_mkroom` | - | Missing |
| 77 | `selection_getbounds` | - | Missing |
| 168 | `selection_getpoint` | - | Missing |
| 747 | `selection_is_irregular` | - | Missing |
| 726 | `selection_iterate` | - | Missing |
| 15 | `selection_new` | - | Missing |
| 211 | `selection_not` | - | Missing |
| 99 | `selection_recalc_bounds` | - | Missing |
| 284 | `selection_rndcoord` | - | Missing |
| 181 | `selection_setpoint` | - | Missing |
| 764 | `selection_size_description` | - | Missing |
| 372 | `set_selection_floodfillchk` | - | Missing |

### sfbase.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 246 | `SF_X` | - | Missing |
| 617 | `bitfield_dump` | - | Missing |
| 625 | `complex_dump` | - | Missing |
| 792 | `norm_ptrs_achievement_tracking` | - | Missing |
| 752 | `norm_ptrs_align` | - | Missing |
| 748 | `norm_ptrs_any` | - | Missing |
| 757 | `norm_ptrs_arti_info` | - | Missing |
| 762 | `norm_ptrs_attribs` | - | Missing |
| 767 | `norm_ptrs_bill_x` | - | Missing |
| 797 | `norm_ptrs_book_info` | - | Missing |
| 772 | `norm_ptrs_branch` | - | Missing |
| 777 | `norm_ptrs_bubble` | - | Missing |
| 782 | `norm_ptrs_cemetery` | - | Missing |
| 787 | `norm_ptrs_context_info` | - | Missing |
| 847 | `norm_ptrs_d_flags` | - | Missing |
| 852 | `norm_ptrs_d_level` | - | Missing |
| 857 | `norm_ptrs_damage` | - | Missing |
| 862 | `norm_ptrs_dest_area` | - | Missing |
| 867 | `norm_ptrs_dgn_topology` | - | Missing |
| 802 | `norm_ptrs_dig_info` | - | Missing |
| 872 | `norm_ptrs_dungeon` | - | Missing |
| 877 | `norm_ptrs_ebones` | - | Missing |
| 882 | `norm_ptrs_edog` | - | Missing |
| 887 | `norm_ptrs_egd` | - | Missing |
| 892 | `norm_ptrs_emin` | - | Missing |
| 897 | `norm_ptrs_engr` | - | Missing |
| 807 | `norm_ptrs_engrave_info` | - | Missing |
| 902 | `norm_ptrs_epri` | - | Missing |
| 907 | `norm_ptrs_eshk` | - | Missing |
| 912 | `norm_ptrs_fakecorridor` | - | Missing |
| 917 | `norm_ptrs_fe` | - | Missing |
| 922 | `norm_ptrs_flag` | - | Missing |
| 927 | `norm_ptrs_fruit` | - | Missing |
| 932 | `norm_ptrs_gamelog_line` | - | Missing |
| 937 | `norm_ptrs_kinfo` | - | Missing |
| 942 | `norm_ptrs_levelflags` | - | Missing |
| 947 | `norm_ptrs_linfo` | - | Missing |
| 952 | `norm_ptrs_ls_t` | - | Missing |
| 972 | `norm_ptrs_mapseen` | - | Missing |
| 957 | `norm_ptrs_mapseen_feat` | - | Missing |
| 962 | `norm_ptrs_mapseen_flags` | - | Missing |
| 967 | `norm_ptrs_mapseen_rooms` | - | Missing |
| 977 | `norm_ptrs_mextra` | - | Missing |
| 982 | `norm_ptrs_mkroom` | - | Missing |
| 987 | `norm_ptrs_monst` | - | Missing |
| 992 | `norm_ptrs_mvitals` | - | Missing |
| 997 | `norm_ptrs_nhcoord` | - | Missing |
| 1002 | `norm_ptrs_nhrect` | - | Missing |
| 1007 | `norm_ptrs_novel_tracking` | - | Missing |
| 1012 | `norm_ptrs_obj` | - | Missing |
| 812 | `norm_ptrs_obj_split` | - | Missing |
| 1017 | `norm_ptrs_objclass` | - | Missing |
| 1022 | `norm_ptrs_oextra` | - | Missing |
| 817 | `norm_ptrs_polearm_info` | - | Missing |
| 1027 | `norm_ptrs_prop` | - | Missing |
| 1032 | `norm_ptrs_q_score` | - | Missing |
| 1037 | `norm_ptrs_rm` | - | Missing |
| 1042 | `norm_ptrs_s_level` | - | Missing |
| 1047 | `norm_ptrs_skills` | - | Missing |
| 1052 | `norm_ptrs_spell` | - | Missing |
| 1057 | `norm_ptrs_stairway` | - | Missing |
| 822 | `norm_ptrs_takeoff_info` | - | Missing |
| 827 | `norm_ptrs_tin_info` | - | Missing |
| 1062 | `norm_ptrs_trap` | - | Missing |
| 832 | `norm_ptrs_tribute_info` | - | Missing |
| 1067 | `norm_ptrs_u_conduct` | - | Missing |
| 1072 | `norm_ptrs_u_event` | - | Missing |
| 1077 | `norm_ptrs_u_have` | - | Missing |
| 1082 | `norm_ptrs_u_realtime` | - | Missing |
| 1087 | `norm_ptrs_u_roleplay` | - | Missing |
| 1092 | `norm_ptrs_version_info` | - | Missing |
| 837 | `norm_ptrs_victual_info` | - | Missing |
| 1097 | `norm_ptrs_vlaunchinfo` | - | Missing |
| 1102 | `norm_ptrs_vptrs` | - | Missing |
| 842 | `norm_ptrs_warntype_info` | - | Missing |
| 1107 | `norm_ptrs_you` | - | Missing |
| 647 | `sf_init` | - | Missing |
| 377 | `sf_log` | - | Missing |
| 664 | `sf_setflprocs` | - | Missing |
| 658 | `sf_setprocs` | - | Missing |
| 265 | `sfi_char` | - | Missing |
| 306 | `sfi_genericptr` | - | Missing |
| 348 | `sfi_version_info` | - | Missing |
| 290 | `sfo_genericptr` | - | Missing |
| 330 | `sfo_version_info` | - | Missing |
| 449 | `sfvalue_any` | - | Missing |
| 608 | `sfvalue_bitfield` | - | Missing |
| 460 | `sfvalue_genericptr` | - | Missing |

### sfstruct.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 100 | `SF_C` | - | Missing |
| 147 | `SF_X` | - | Missing |
| 447 | `bclose` | - | Missing |
| 478 | `bflush` | - | Missing |
| 436 | `bufoff` | - | Missing |
| 415 | `bufon` | - | Missing |
| 494 | `bwrite` | - | Missing |
| 404 | `close_check` | - | Missing |
| 384 | `getidx` | - | Missing |
| 113 | `historical_sfi_char` | - | Missing |
| 136 | `historical_sfi_genericptr_t` | - | Missing |
| 130 | `historical_sfo_genericptr_t` | - | Missing |
| 603 | `logging_finish` | - | Missing |
| 549 | `mread` | - | Missing |
| 596 | `sfstruct_read_error` | - | Missing |

### shk.c -> shk.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 5812 | `Shk_Your` | - | Missing |
| 4334 | `add_damage` | - | Missing |
| 3250 | `add_one_tobill` | - | Missing |
| 3306 | `add_to_billobjs` | - | Missing |
| 3430 | `addtobill` | - | Missing |
| 437 | `addupbill` | - | Missing |
| 4932 | `after_shk_move` | - | Missing |
| 3178 | `alter_cost` | - | Missing |
| 1272 | `angry_shk_exists` | - | Missing |
| 3539 | `append_honorific` | - | Missing |
| 3327 | `bill_box_content` | - | Missing |
| 3391 | `billable` | - | Missing |
| 5726 | `block_door` | - | Missing |
| 5761 | `block_entry` | - | Missing |
| 2700 | `bp_to_obj` | - | Missing |
| 2250 | `buy_container` | - | Missing |
| 5843 | `cad` | - | Missing |
| 451 | `call_kops` | - | Missing |
| 1463 | `cheapest_item` | - | Missing |
| 1219 | `check_credit` | - | Missing |
| 5674 | `check_unpaid` | - | Missing |
| 5623 | `check_unpaid_usage` | - | Missing |
| 377 | `clear_no_charge` | - | Missing |
| 329 | `clear_no_charge_obj` | - | Missing |
| 389 | `clear_no_charge_pets` | - | Missing |
| 319 | `clear_unpaid` | - | Missing |
| 309 | `clear_unpaid_obj` | - | Missing |
| 2936 | `contained_cost` | - | Missing |
| 2987 | `contained_gold` | - | Missing |
| 4210 | `corpsenm_price_adj` | - | Missing |
| 5562 | `cost_per_charge` | - | Missing |
| 5304 | `costly_adjacent` | - | Missing |
| 5680 | `costly_gold` | - | Missing |
| 5285 | `costly_spot` | - | Missing |
| 569 | `credit_report` | - | Missing |
| 1116 | `delete_contents` | - | Missing |
| 664 | `deserted_shop` | - | Missing |
| 4465 | `discard_damage_owned_by` | - | Missing |
| 4444 | `discard_damage_struct` | - | Missing |
| 4132 | `doinvbill` | - | Missing |
| 3814 | `donate_gold` | - | Missing |
| 1684 | `dopay` | pickup.js:handlePay | STUB — pay command placeholder |
| 2161 | `dopayobj` | - | Missing |
| 3005 | `dropped_container` | - | Missing |
| 4426 | `find_damage` | - | Missing |
| 1025 | `find_objowner` | - | Missing |
| 2718 | `find_oid` | - | Missing |
| 2664 | `finish_paybill` | - | Missing |
| 4785 | `fix_shop_damage` | - | Missing |
| 3139 | `gem_learned` | - | Missing |
| 2818 | `get_cost` | shk.js:getCost | APPROX — item cost calculation |
| 2750 | `get_cost_of_shop_item` | - | Missing |
| 2787 | `get_pricing_units` | - | Missing |
| 5073 | `getcad` | - | Missing |
| 4254 | `getprice` | shk.js:getprice | APPROX — base price lookup |
| 5911 | `globby_bill_fixup` | - | Missing |
| 1258 | `home_shk` | - | Missing |
| 1390 | `hot_pursuit` | - | Missing |
| 2518 | `inherits` | - | Missing |
| 980 | `inhishop` | - | Missing |
| 509 | `inside_shop` | shk.js:insideShop | APPROX — shop boundary check |
| 2396 | `insufficient_funds` | - | Missing |
| 4947 | `is_fshk` | - | Missing |
| 1108 | `is_unpaid` | - | Missing |
| 5541 | `kops_gone` | - | Missing |
| 4526 | `litter_getpos` | - | Missing |
| 4647 | `litter_newsyms` | - | Missing |
| 4557 | `litter_scatter` | - | Missing |
| 1411 | `make_angry_shk` | - | Missing |
| 1336 | `make_happy_shk` | - | Missing |
| 1381 | `make_happy_shoppers` | - | Missing |
| 1486 | `make_itemized_bill` | - | Missing |
| 5048 | `makekops` | - | Missing |
| 1609 | `menu_pick_pay_items` | - | Missing |
| 5835 | `mon_owns` | - | Missing |
| 157 | `money2mon` | - | Missing |
| 186 | `money2u` | - | Missing |
| 215 | `next_shkp` | - | Missing |
| 1067 | `noisy_shop` | - | Missing |
| 1128 | `obfree` | - | Missing |
| 2805 | `oid_price_adjustment` | - | Missing |
| 1077 | `onbill` | - | Missing |
| 1101 | `onshopbill` | - | Missing |
| 1285 | `pacify_shk` | - | Missing |
| 1238 | `pay` | - | Missing |
| 1986 | `pay_billed_items` | - | Missing |
| 5109 | `pay_for_damage` | - | Missing |
| 2426 | `paybill` | - | Missing |
| 862 | `pick_pick` | - | Missing |
| 3026 | `picked_container` | - | Missing |
| 5341 | `price_quote` | - | Missing |
| 2360 | `reject_purchase` | - | Missing |
| 606 | `remote_burglary` | - | Missing |
| 4667 | `repair_damage` | - | Missing |
| 4387 | `repairable_damage` | - | Missing |
| 280 | `replshk` | - | Missing |
| 290 | `restshk` | - | Missing |
| 1303 | `rile_shk` | - | Missing |
| 628 | `rob_shop` | - | Missing |
| 1322 | `rouse_shk` | - | Missing |
| 896 | `same_price` | - | Missing |
| 5880 | `sasc_bug` | - | Missing |
| 3864 | `sellobj` | - | Missing |
| 3850 | `sellobj_state` | - | Missing |
| 3089 | `set_cost` | - | Missing |
| 2623 | `set_repo_loc` | - | Missing |
| 272 | `set_residency` | - | Missing |
| 400 | `setpaid` | - | Missing |
| 5456 | `shk_chat` | - | Missing |
| 5403 | `shk_embellish` | - | Missing |
| 4491 | `shk_fixes_damage` | - | Missing |
| 4376 | `shk_impaired` | - | Missing |
| 4815 | `shk_move` | - | Missing |
| 3353 | `shk_names_obj` | - | Missing |
| 5820 | `shk_owns` | - | Missing |
| 5797 | `shk_your` | - | Missing |
| 4297 | `shkcatch` | - | Missing |
| 235 | `shkgone` | - | Missing |
| 931 | `shop_debt` | - | Missing |
| 993 | `shop_keeper` | - | Missing |
| 5321 | `shop_object` | - | Missing |
| 4954 | `shopdig` | - | Missing |
| 944 | `shopper_financial_report` | - | Missing |
| 1440 | `sortbill_cmp` | - | Missing |
| 3044 | `special_stock` | - | Missing |
| 3560 | `splitbill` | - | Missing |
| 3650 | `stolen_container` | - | Missing |
| 3691 | `stolen_value` | - | Missing |
| 3598 | `sub_one_frombill` | - | Missing |
| 3631 | `subfrombill` | - | Missing |
| 1059 | `tended_shop` | - | Missing |
| 692 | `u_entered_shop` | - | Missing |
| 520 | `u_left_shop` | - | Missing |
| 3201 | `unpaid_cost` | - | Missing |
| 2112 | `update_bill` | - | Missing |
| 6036 | `use_unpaid_trapobj` | - | Missing |

### shknam.c -> shknam.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 857 | `Shknam` | - | Missing |
| 583 | `free_eshk` | - | Missing |
| 843 | `get_shop_item` | - | Missing |
| 596 | `good_shopdoor` | - | Missing |
| 360 | `init_shop_selection` | - | Missing |
| 922 | `is_izchak` | - | Missing |
| 454 | `mkshobj_at` | - | Missing |
| 443 | `mkveggy_at` | - | Missing |
| 487 | `nameshk` | - | Missing |
| 571 | `neweshk` | - | Missing |
| 819 | `saleable` | - | Missing |
| 642 | `shkinit` | - | Missing |
| 870 | `shkname` | - | Missing |
| 914 | `shkname_is_pname` | - | Missing |
| 408 | `shkveg` | - | Missing |
| 732 | `stock_room` | - | Missing |
| 709 | `stock_room_goodpos` | - | Missing |
| 380 | `veggy_item` | - | Missing |

### sit.c -> sit.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 640 | `attrcurse` | - | Missing |
| 396 | `dosit` | - | Missing |
| 354 | `lay_an_egg` | - | Missing |
| 565 | `rndcurse` | - | Missing |
| 238 | `special_throne_effect` | - | Missing |
| 14 | `take_gold` | - | Missing |
| 39 | `throne_sit_effect` | - | Missing |

### sounds.c -> sounds.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1779 | `activate_chosen_soundlib` | - | Missing |
| 1556 | `add_sound_mapping` | - | Missing |
| 1798 | `assign_soundlib` | - | Missing |
| 2084 | `base_soundname_to_filename` | - | Missing |
| 62 | `beehive_mon_sound` | - | Missing |
| 519 | `beg` | - | Missing |
| 1809 | `choose_soundlib` | - | Missing |
| 617 | `cry_sound` | - | Missing |
| 1257 | `dochat` | - | Missing |
| 679 | `domonnoise` | - | Missing |
| 202 | `dosounds` | - | Missing |
| 1248 | `dotalk` | - | Missing |
| 1995 | `get_sound_effect_filename` | - | Missing |
| 1864 | `get_soundlib_name` | - | Missing |
| 402 | `growl` | - | Missing |
| 351 | `growl_sound` | - | Missing |
| 1981 | `initialize_semap_basenames` | - | Missing |
| 546 | `maybe_gasp` | - | Missing |
| 1659 | `maybe_play_sound` | - | Missing |
| 20 | `mon_in_room` | - | Missing |
| 659 | `mon_is_gecko` | - | Missing |
| 89 | `morgue_mon_sound` | - | Missing |
| 1927 | `nosound_achievement` | - | Missing |
| 1947 | `nosound_ambience` | - | Missing |
| 1922 | `nosound_exit_nhsound` | - | Missing |
| 1937 | `nosound_hero_playnotes` | - | Missing |
| 1917 | `nosound_init_nhsound` | - | Missing |
| 1942 | `nosound_play_usersound` | - | Missing |
| 1932 | `nosound_soundeffect` | - | Missing |
| 1953 | `nosound_verbal` | - | Missing |
| 181 | `oracle_sound` | - | Missing |
| 1642 | `play_sound_for_message` | - | Missing |
| 1676 | `release_sound_mappings` | - | Missing |
| 1413 | `responsive_mon_at` | - | Missing |
| 2161 | `set_voice` | - | Missing |
| 1629 | `sound_matches_message` | - | Missing |
| 2185 | `sound_speak` | - | Missing |
| 1883 | `soundlib_id_from_opt` | - | Missing |
| 131 | `temple_priest_sound` | - | Missing |
| 30 | `throne_mon_sound` | - | Missing |
| 1427 | `tiphat` | - | Missing |
| 479 | `whimper` | - | Missing |
| 427 | `yelp` | - | Missing |
| 115 | `zoo_mon_sound` | - | Missing |

### sp_lev.c -> sp_lev.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 5541 | `add_doors_to_room` | - | Missing |
| 2805 | `build_room` | - | Missing |
| 1408 | `check_room` | - | Missing |
| 2439 | `create_altar` | - | Missing |
| 2669 | `create_corridor` | - | Missing |
| 6444 | `create_des_coder` | - | Missing |
| 1715 | `create_door` | - | Missing |
| 1926 | `create_monster` | - | Missing |
| 2186 | `create_object` | sp_lev.js `object()` | Aligned — executes in script order (deferral removed) |
| 1487 | `create_room` | - | Missing |
| 1669 | `create_subroom` | - | Missing |
| 1813 | `create_trap` | - | Missing |
| 4769 | `cvt_to_abscoord` | - | Missing |
| 4790 | `cvt_to_relcoord` | - | Missing |
| 2542 | `dig_corridor` | - | Missing |
| 5214 | `ensure_way_out` | - | Missing |
| 2924 | `fill_empty_maze` | - | Missing |
| 2729 | `fill_special_room` | sp_lev.js `fill_special_room()` | Aligned — called from finalize_level |
| 3141 | `find_montype` | - | Missing |
| 3464 | `find_objtype` | - | Missing |
| 429 | `flip_dbridge_horizontal` | - | Missing |
| 443 | `flip_dbridge_vertical` | - | Missing |
| 500 | `flip_encoded_dir_bits` | - | Missing |
| 534 | `flip_level` | - | Missing |
| 968 | `flip_level_rnd` | - | Missing |
| 927 | `flip_vault_guard` | - | Missing |
| 459 | `flip_visuals` | - | Missing |
| 4597 | `floodfillchk_match_accessible` | - | Missing |
| 4584 | `floodfillchk_match_under` | - | Missing |
| 5143 | `generate_way_out_method` | - | Missing |
| 5316 | `get_coord` | - | Missing |
| 1386 | `get_free_room_loc` | - | Missing |
| 1203 | `get_location` | - | Missing |
| 1338 | `get_location_coord` | - | Missing |
| 3988 | `get_mkroom_name` | - | Missing |
| 1361 | `get_room_loc` | - | Missing |
| 3112 | `get_table_align` | - | Missing |
| 3438 | `get_table_buc` | - | Missing |
| 5558 | `get_table_coords_or_region` | - | Missing |
| 3403 | `get_table_int_or_random` | - | Missing |
| 5257 | `get_table_intarray_entry` | - | Missing |
| 3129 | `get_table_monclass` | - | Missing |
| 3165 | `get_table_montype` | - | Missing |
| 3451 | `get_table_objclass` | - | Missing |
| 3535 | `get_table_objtype` | - | Missing |
| 5279 | `get_table_region` | - | Missing |
| 4001 | `get_table_roomtype_opt` | - | Missing |
| 4347 | `get_table_traptype_opt` | - | Missing |
| 3186 | `get_table_xy_or_coord` | - | Missing |
| 4364 | `get_trapname_bytype` | - | Missing |
| 4376 | `get_traptype_byname` | - | Missing |
| 1318 | `get_unpacked_coord` | - | Missing |
| 4136 | `good_stair_loc` | - | Missing |
| 1281 | `is_ok_location` | - | Missing |
| 4144 | `l_create_stairway` | - | Missing |
| 5407 | `l_get_lregion` | - | Missing |
| 3057 | `l_push_mkroom_table` | - | Missing |
| 3048 | `l_push_wid_hei_table` | - | Missing |
| 6435 | `l_register_des` | - | Missing |
| 4736 | `l_table_getset_feature_flag` | - | Missing |
| 5368 | `levregion_add` | - | Missing |
| 2837 | `light_region` | - | Missing |
| 1123 | `link_doors_rooms` | - | Missing |
| 6454 | `load_special` | - | Missing |
| 4280 | `lspo_altar` | - | Missing |
| 4526 | `lspo_corridor` | - | Missing |
| 4668 | `lspo_door` | - | Missing |
| 5717 | `lspo_drawbridge` | - | Missing |
| 3878 | `lspo_engraving` | - | Missing |
| 5495 | `lspo_exclusion` | - | Missing |
| 4841 | `lspo_feature` | - | Missing |
| 6011 | `lspo_finalize_level` | - | Missing |
| 4926 | `lspo_gas_cloud` | - | Missing |
| 4477 | `lspo_gold` | - | Missing |
| 4240 | `lspo_grave` | - | Missing |
| 4229 | `lspo_ladder` | - | Missing |
| 3755 | `lspo_level_flags` | - | Missing |
| 3833 | `lspo_level_init` | - | Missing |
| 5469 | `lspo_levregion` | - | Missing |
| 6074 | `lspo_map` | - | Missing |
| 5766 | `lspo_mazewalk` | - | Missing |
| 3074 | `lspo_message` | - | Missing |
| 3936 | `lspo_mineralize` | - | Missing |
| 3212 | `lspo_monster` | - | Missing |
| 5934 | `lspo_non_diggable` | - | Missing |
| 5943 | `lspo_non_passwall` | - | Missing |
| 3553 | `lspo_object` | - | Missing |
| 4555 | `lspo_random_corridors` | - | Missing |
| 5581 | `lspo_region` | - | Missing |
| 5048 | `lspo_replace_terrain` | - | Missing |
| 5990 | `lspo_reset_level` | - | Missing |
| 4025 | `lspo_room` | - | Missing |
| 4220 | `lspo_stair` | - | Missing |
| 5440 | `lspo_teleport_region` | - | Missing |
| 4975 | `lspo_terrain` | - | Missing |
| 4394 | `lspo_trap` | - | Missing |
| 5873 | `lspo_wall_property` | - | Missing |
| 5962 | `lspo_wallify` | - | Missing |
| 360 | `lvlfill_maze_grid` | - | Missing |
| 375 | `lvlfill_solid` | - | Missing |
| 392 | `lvlfill_swamp` | - | Missing |
| 1865 | `m_bad_boulder_spot` | - | Missing |
| 329 | `map_cleanup` | - | Missing |
| 276 | `mapfrag_canmatch` | - | Missing |
| 282 | `mapfrag_error` | - | Missing |
| 257 | `mapfrag_free` | - | Missing |
| 228 | `mapfrag_fromstr` | - | Missing |
| 267 | `mapfrag_get` | - | Missing |
| 299 | `mapfrag_match` | - | Missing |
| 218 | `match_maptyps` | - | Missing |
| 1111 | `maybe_add_door` | - | Missing |
| 2898 | `maze1xy` | - | Missing |
| 4808 | `nhl_abs_coord` | - | Missing |
| 1853 | `noncoalignment` | - | Missing |
| 1312 | `pm_good_location` | - | Missing |
| 1885 | `pm_to_humidity` | - | Missing |
| 4575 | `random_wdir` | - | Missing |
| 1017 | `remove_boundary_syms` | - | Missing |
| 1149 | `rnddoor` | - | Missing |
| 1160 | `rndtrap` | - | Missing |
| 2485 | `search_door` | - | Missing |
| 4644 | `sel_set_door` | - | Missing |
| 4630 | `sel_set_feature` | - | Missing |
| 5532 | `sel_set_lit` | - | Missing |
| 4606 | `sel_set_ter` | - | Missing |
| 987 | `sel_set_wall_property` | - | Missing |
| 5952 | `sel_set_wallify` | - | Missing |
| 1043 | `set_door_orientation` | - | Missing |
| 4590 | `set_floodfillchk_match_under` | - | Missing |
| 1275 | `set_ok_location_func` | - | Missing |
| 1002 | `set_wall_property` | - | Missing |
| 5908 | `set_wallprop_in_selection` | - | Missing |
| 1090 | `shared_with_room` | - | Missing |
| 316 | `solidify_map` | - | Missing |
| 1909 | `sp_amask_to_amask` | - | Missing |
| 3020 | `sp_code_jmpaddr` | - | Missing |
| 6336 | `sp_level_coder_init` | - | Missing |
| 2980 | `splev_initlev` | - | Missing |
| 3029 | `spo_end_moninvent` | - | Missing |
| 4116 | `spo_endroom` | - | Missing |
| 3038 | `spo_pop_container` | - | Missing |
| 6324 | `update_croom` | - | Missing |
| 2863 | `wallify_map` | - | Missing |

### spell.c -> spell.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 669 | `age_spells` | spell.js:ageSpells | Aligned — decrement spell retention |
| 343 | `book_cursed` | - | Missing |
| 646 | `book_disappears` | - | Missing |
| 658 | `book_substitution` | - | Missing |
| 1619 | `can_center_spell_location` | - | Missing |
| 1003 | `cast_chain_lightning` | - | Missing |
| 1104 | `cast_protection` | - | Missing |
| 189 | `confused_book` | - | Missing |
| 130 | `cursed_book` | - | Missing |
| 231 | `deadbook` | - | Missing |
| 211 | `deadbook_pacify_undead` | - | Missing |
| 1627 | `display_spell_target_positions` | - | Missing |
| 820 | `docast` | - | Missing |
| 2075 | `dospellmenu` | spell.js:handleKnownSpells | APPROX — spell list display |
| 2021 | `dovspell` | spell.js:handleKnownSpells | APPROX — known spells command |
| 787 | `dowizcast` | - | Missing |
| 2391 | `force_learn_spell` | - | Missing |
| 715 | `getspell` | - | Missing |
| 2340 | `initialspell` | - | Missing |
| 2363 | `known_spell` | - | Missing |
| 356 | `learn` | - | Missing |
| 1763 | `losespells` | - | Missing |
| 2417 | `num_spells` | - | Missing |
| 2173 | `percent_success` | spell.js:estimateSpellFailPercent | APPROX — spell failure calculation |
| 952 | `propagate_chain_lightning` | - | Missing |
| 687 | `rejectcasting` | - | Missing |
| 2059 | `show_spells` | - | Missing |
| 864 | `skill_based_spellbook_id` | - | Missing |
| 1927 | `sortspells` | - | Missing |
| 1607 | `spell_aim_step` | - | Missing |
| 1181 | `spell_backfire` | - | Missing |
| 1870 | `spell_cmp` | - | Missing |
| 2379 | `spell_idx` | - | Missing |
| 115 | `spell_let_to_idx` | - | Missing |
| 856 | `spell_skilltype` | spell.js:spellCategoryForName | APPROX — spell category lookup |
| 1385 | `spelleffects` | - | Missing |
| 1220 | `spelleffects_check` | - | Missing |
| 2295 | `spellretention` | spell.js:spellRetentionText | APPROX — retention display |
| 1976 | `spellsortmenu` | - | Missing |
| 832 | `spelltypemnemonic` | spell.js:spellCategoryForName | APPROX — category for display |
| 468 | `study_book` | - | Missing |
| 1655 | `throwspell` | - | Missing |
| 1707 | `tport_spell` | - | Missing |

### stairs.c -> stairs.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 154 | `On_ladder` | - | Missing |
| 148 | `On_stairs` | - | Missing |
| 170 | `On_stairs_dn` | - | Missing |
| 162 | `On_stairs_up` | - | Missing |
| 180 | `known_branch_stairs` | - | Missing |
| 187 | `stairs_description` | - | Missing |
| 8 | `stairway_add` | - | Missing |
| 40 | `stairway_at` | - | Missing |
| 50 | `stairway_find` | - | Missing |
| 79 | `stairway_find_dir` | - | Missing |
| 64 | `stairway_find_from` | - | Missing |
| 99 | `stairway_find_special_dir` | - | Missing |
| 89 | `stairway_find_type_dir` | - | Missing |
| 27 | `stairway_free_all` | - | Missing |
| 137 | `u_on_dnstairs` | - | Missing |
| 113 | `u_on_sstairs` | - | Missing |
| 125 | `u_on_upstairs` | - | Missing |

### steal.c -> steal.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 45 | `findgold` | - | Missing |
| 772 | `maybe_absorb_item` | - | Missing |
| 814 | `mdrop_obj` | - | Missing |
| 852 | `mdrop_special_objs` | - | Missing |
| 618 | `mpickobj` | - | Missing |
| 875 | `relobj` | - | Missing |
| 213 | `remove_worn_item` | - | Missing |
| 14 | `somegold` | - | Missing |
| 343 | `steal` | - | Missing |
| 689 | `stealamulet` | - | Missing |
| 165 | `stealarm` | - | Missing |
| 58 | `stealgold` | - | Missing |
| 120 | `thiefdead` | - | Missing |
| 133 | `unresponsive` | - | Missing |
| 147 | `unstolenarm` | - | Missing |
| 294 | `worn_item_removal` | - | Missing |

### steed.c -> steed.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 169 | `can_ride` | - | Missing |
| 26 | `can_saddle` | - | Missing |
| 576 | `dismount_steed` | - | Missing |
| 178 | `doride` | - | Missing |
| 387 | `exercise_steed` | - | Missing |
| 402 | `kick_steed` | - | Missing |
| 460 | `landing_spot` | - | Missing |
| 827 | `maybewakesteed` | - | Missing |
| 197 | `mount_steed` | - | Missing |
| 898 | `place_monster` | - | Missing |
| 852 | `poly_steed` | - | Missing |
| 142 | `put_saddle_on_mon` | - | Missing |
| 17 | `rider_cant_reach` | - | Missing |
| 878 | `stucksteed` | - | Missing |
| 36 | `use_saddle` | - | Missing |

### strutil.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 82 | `Strlen_` | - | Missing |
| 145 | `pmatch` | - | Missing |
| 105 | `pmatch_internal` | - | Missing |
| 152 | `pmatchi` | - | Missing |
| 17 | `strbuf_append` | - | Missing |
| 49 | `strbuf_empty` | - | Missing |
| 9 | `strbuf_init` | - | Missing |
| 58 | `strbuf_nl_to_crlf` | - | Missing |
| 28 | `strbuf_reserve` | - | Missing |

### symbols.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 217 | `assign_graphics` | - | Missing |
| 319 | `clear_symsetentry` | - | Missing |
| 909 | `do_symset` | - | Missing |
| 693 | `free_symsets` | - | Missing |
| 131 | `get_othersym` | - | Missing |
| 122 | `init_ov_primary_symbols` | - | Missing |
| 113 | `init_ov_rogue_symbols` | - | Missing |
| 167 | `init_primary_symbols` | - | Missing |
| 187 | `init_rogue_symbols` | - | Missing |
| 95 | `init_showsyms` | - | Missing |
| 85 | `init_symbols` | - | Missing |
| 673 | `load_symset` | - | Missing |
| 852 | `match_sym` | - | Missing |
| 438 | `parse_sym_line` | - | Missing |
| 773 | `parsesymbols` | - | Missing |
| 431 | `proc_symset_line` | - | Missing |
| 739 | `savedsym_add` | - | Missing |
| 726 | `savedsym_find` | - | Missing |
| 712 | `savedsym_free` | - | Missing |
| 757 | `savedsym_strbuf` | - | Missing |
| 657 | `set_symhandling` | - | Missing |
| 253 | `switch_symbols` | - | Missing |
| 353 | `symset_is_compatible` | - | Missing |
| 295 | `update_ov_primary_symset` | - | Missing |
| 301 | `update_ov_rogue_symset` | - | Missing |
| 307 | `update_primary_symset` | - | Missing |
| 313 | `update_rogue_symset` | - | Missing |

### sys.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 21 | `sys_early_init` | - | Missing |
| 115 | `sysopt_release` | - | Missing |
| 164 | `sysopt_seduce_set` | - | Missing |

### teleport.c -> teleport.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 573 | `collect_coords` | - | Missing |
| 1894 | `control_mon_tele` | - | Missing |
| 1439 | `domagicportal` | - | Missing |
| 1029 | `dotele` | - | Missing |
| 914 | `dotelecmd` | - | Missing |
| 191 | `enexto` | - | Missing |
| 214 | `enexto_core` | - | Missing |
| 276 | `enexto_core` | - | Missing |
| 201 | `enexto_gpflags` | - | Missing |
| 81 | `goodpos` | - | Missing |
| 48 | `goodpos_onscary` | - | Missing |
| 1160 | `level_tele` | - | Missing |
| 1533 | `level_tele_trap` | - | Missing |
| 21 | `m_blocks_teleporting` | - | Missing |
| 1998 | `mlevel_tele_trap` | - | Missing |
| 1957 | `mtele_trap` | - | Missing |
| 1932 | `mvault_tele` | - | Missing |
| 30 | `noteleport_level` | - | Missing |
| 2182 | `random_teleport_level` | - | Missing |
| 1794 | `rloc` | - | Missing |
| 1570 | `rloc_pos_ok` | - | Missing |
| 1766 | `rloc_to` | - | Missing |
| 1640 | `rloc_to_core` | - | Missing |
| 1772 | `rloc_to_flag` | - | Missing |
| 2094 | `rloco` | - | Missing |
| 712 | `safe_teleds` | - | Missing |
| 844 | `scrolltele` | - | Missing |
| 1781 | `stairway_find_forwiz` | - | Missing |
| 837 | `tele` | - | Missing |
| 381 | `tele_jump_ok` | - | Missing |
| 1945 | `tele_restrict` | - | Missing |
| 809 | `tele_to_rnd_pet` | - | Missing |
| 1487 | `tele_trap` | - | Missing |
| 443 | `teleds` | - | Missing |
| 415 | `teleok` | - | Missing |
| 781 | `teleport_pet` | - | Missing |
| 2254 | `u_teleport_mon` | - | Missing |
| 768 | `vault_tele` | - | Missing |

### timeout.c -> timeout.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 981 | `attach_egg_hatch_timeout` | 473 | Aligned |
| 1204 | `attach_fig_transform_timeout` | 509 | Aligned |
| 1712 | `begin_burn` | 542 | Aligned |
| 448 | `burn_away_slime` | 587 | Stub (no-op) |
| 1383 | `burn_object` | 524 | Aligned |
| 295 | `choke_dialogue` | 583 | Stub (no-op) |
| 1828 | `cleanup_burn` | 551 | Aligned |
| 1847 | `do_storms` | 575 | Aligned |
| 575 | `done_timeout` | 462 | Aligned |
| 1804 | `end_burn` | 564 | Aligned |
| 951 | `fall_asleep` | 451 | Aligned |
| 1017 | `hatch_egg` | 499 | Aligned |
| 2459 | `insert_timer` | 247 | Aligned |
| 1009 | `kill_egg` | 492 | Aligned |
| 1995 | `kind_name` | 130 | Aligned |
| 1360 | `lantern_message` | 593 | Stub (no-op) |
| 1193 | `learn_egg_type` | - | Missing |
| 353 | `levitation_dialogue` | 585 | Stub (no-op) |
| 2619 | `maybe_write_timer` | - | N/A (save/restore) |
| 2576 | `mon_is_local` | - | N/A (save/restore) |
| 588 | `nh_timeout` | 407 | Aligned: intrinsic timeout decrement loop, dialogue calls before decrement, _fireExpiryEffect with death/status/equipment handlers |
| 2396 | `obj_has_timer` | 369 | Aligned |
| 2552 | `obj_is_local` | - | N/A (save/restore) |
| 2331 | `obj_move_timers` | 333 | Aligned |
| 2351 | `obj_split_timers` | 344 | Aligned |
| 2369 | `obj_stop_timers` | 364 | Aligned |
| 2316 | `peek_timer` | 235 | Aligned |
| 534 | `phaze_dialogue` | 589 | Stub (no-op) |
| 2014 | `print_queue` | 282 | Aligned |
| 117 | `property_by_index` | - | Missing |
| 554 | `region_dialogue` | 590 | Stub (no-op) |
| 2743 | `relink_timers` | 607 | Stub |
| 2475 | `remove_timer` | 243 | Aligned |
| 2699 | `restore_timers` | 611 | Stub |
| 2214 | `run_timers` | 268 | Aligned |
| 2660 | `save_timers` | 615 | Stub |
| 1345 | `see_lamp_flicker` | 592 | Stub (no-op) |
| 323 | `sickness_dialogue` | 584 | Stub (no-op) |
| 268 | `sleep_dialogue` | 582 | Stub (no-op) |
| 389 | `slime_dialogue` | 586 | Stub (no-op) |
| 457 | `slimed_to_death` | 588 | Stub (no-op) |
| 1222 | `slip_or_trip` | 591 | Stub (no-op) |
| 2408 | `spot_stop_timers` | 377 | Aligned |
| 2437 | `spot_time_expires` | 389 | Aligned |
| 2451 | `spot_time_left` | 399 | Aligned |
| 2239 | `start_timer` | 168 | Aligned |
| 137 | `stoned_dialogue` | 580 | Stub (no-op) |
| 2291 | `stop_timer` | 210 | Aligned |
| 2595 | `timer_is_local` | - | N/A (save/restore) |
| 2122 | `timer_sanity_check` | 311 | Aligned |
| 2727 | `timer_stats` | 139 | Aligned |
| 197 | `vomiting_dialogue` | 581 | Stub (no-op) |
| 2041 | `wiz_timeout_queue` | 294 | Aligned |
| 2497 | `write_timer` | - | N/A (save/restore) |

### topten.c -> topten.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 480 | `add_achieveX` | - | Missing |
| 1356 | `classmon` | - | Missing |
| 208 | `discardexcess` | - | Missing |
| 491 | `encode_extended_achievements` | - | Missing |
| 584 | `encode_extended_conducts` | - | Missing |
| 455 | `encodeachieve` | - | Missing |
| 411 | `encodeconduct` | - | Missing |
| 394 | `encodexlogflags` | - | Missing |
| 90 | `formatkiller` | - | Missing |
| 615 | `free_ttlist` | - | Missing |
| 1381 | `get_rnd_toptenentry` | - | Missing |
| 1471 | `nsb_mung_line` | - | Missing |
| 1479 | `nsb_unmung_line` | - | Missing |
| 183 | `observable_depth` | - | Missing |
| 946 | `outentry` | - | Missing |
| 929 | `outheader` | - | Missing |
| 1194 | `prscore` | - | Missing |
| 220 | `readentry` | - | Missing |
| 1112 | `score_wanted` | - | Missing |
| 628 | `topten` | - | Missing |
| 165 | `topten_print` | - | Missing |
| 174 | `topten_print_bold` | - | Missing |
| 1445 | `tt_doppel` | - | Missing |
| 1422 | `tt_oname` | - | Missing |
| 301 | `writeentry` | - | Missing |
| 340 | `writexlentry` | - | Missing |

### track.c -> track.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 38 | `gettrack` | - | Missing |
| 59 | `hastrack` | - | Missing |
| 15 | `initrack` | - | Missing |
| 89 | `rest_track` | - | Missing |
| 72 | `save_track` | - | Missing |
| 24 | `settrack` | - | Missing |

### trap.c -> trap.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 4525 | `acid_damage` | - | Missing |
| 908 | `activate_statue_trap` | - | Missing |
| 6511 | `adj_nonconjoined_pit` | - | Missing |
| 726 | `animate_statue` | - | Missing |
| 6601 | `b_trapped` | - | Missing |
| 4883 | `back_on_ground` | - | Missing |
| 3098 | `blow_up_landmine` | - | Missing |
| 88 | `burnarmor` | - | Missing |
| 1086 | `check_in_air` | - | Missing |
| 6201 | `chest_trap` | - | Missing |
| 3009 | `choose_trapnote` | - | Missing |
| 593 | `clamp_hole_destination` | - | Missing |
| 6487 | `clear_conjoined_pits` | - | Missing |
| 4090 | `climb_pit` | - | Missing |
| 6117 | `closeholdingtrap` | - | Missing |
| 5248 | `cnv_trap_obj` | - | Missing |
| 6459 | `conjoined_pits` | - | Missing |
| 5165 | `could_untrap` | - | Missing |
| 6423 | `count_traps` | - | Missing |
| 6575 | `delfloortrap` | - | Missing |
| 6438 | `deltrap` | - | Missing |
| 5701 | `disarm_box` | - | Missing |
| 5460 | `disarm_holdingtrap` | - | Missing |
| 5501 | `disarm_landmine` | - | Missing |
| 5571 | `disarm_shooting_trap` | - | Missing |
| 5537 | `disarm_squeaky_board` | - | Missing |
| 418 | `dng_bottom` | - | Missing |
| 4140 | `dofiretrap` | - | Missing |
| 4224 | `domagictrap` | - | Missing |
| 2922 | `dotrap` | - | Missing |
| 5155 | `dountrap` | - | Missing |
| 5109 | `drain_en` | - | Missing |
| 4966 | `drown` | - | Missing |
| 4804 | `emergency_disrobe` | - | Missing |
| 171 | `erode_obj` | - | Missing |
| 602 | `fall_through` | - | Missing |
| 3495 | `feeltrap` | - | Missing |
| 3917 | `fill_pit` | - | Missing |
| 3506 | `find_random_launch_coord` | - | Missing |
| 4362 | `fire_damage` | - | Missing |
| 4457 | `fire_damage_chain` | - | Missing |
| 3931 | `float_down` | - | Missing |
| 3844 | `float_up` | - | Missing |
| 1061 | `floor_trigger` | - | Missing |
| 3170 | `force_launch_placement` | - | Missing |
| 360 | `grease_protect` | - | Missing |
| 5607 | `help_monster_out` | - | Missing |
| 442 | `hole_destination` | - | Missing |
| 7065 | `ignite_items` | - | Missing |
| 2711 | `immune_to_trap` | - | Missing |
| 3751 | `instapetrify` | - | Missing |
| 5282 | `into_vs_onto` | - | Missing |
| 3602 | `isclearpath` | - | Missing |
| 6529 | `join_adjacent_pits` | - | Missing |
| 939 | `keep_saddle_with_steedcorpse` | - | Missing |
| 3148 | `launch_drop_spot` | - | Missing |
| 3162 | `launch_in_progress` | - | Missing |
| 3186 | `launch_obj` | - | Missing |
| 4483 | `lava_damage` | - | Missing |
| 6701 | `lava_effects` | - | Missing |
| 3633 | `m_easy_escape_pit` | - | Missing |
| 1098 | `m_harmless_trap` | - | Missing |
| 456 | `maketrap` | - | Missing |
| 6966 | `maybe_finish_sokoban` | - | Missing |
| 3765 | `minstapetrify` | - | Missing |
| 3640 | `mintrap` | - | Missing |
| 390 | `mk_trap_statue` | - | Missing |
| 3566 | `mkroll_launch` | - | Missing |
| 5300 | `move_into_trap` | - | Missing |
| 3820 | `mselftouch` | - | Missing |
| 972 | `mu_maybe_destroy_web` | - | Missing |
| 6159 | `openfallingtrap` | - | Missing |
| 6008 | `openholdingtrap` | - | Missing |
| 4564 | `pot_acid_damage` | - | Missing |
| 4921 | `rescued_from_terrain` | - | Missing |
| 1045 | `reset_utrap` | - | Missing |
| 5437 | `reward_untrap` | - | Missing |
| 4854 | `rnd_nextto_goodpos` | - | Missing |
| 3485 | `seetrap` | - | Missing |
| 3790 | `selftouch` | - | Missing |
| 1030 | `set_utrap` | - | Missing |
| 6898 | `sink_into_lava` | - | Missing |
| 6946 | `sokoban_guilt` | - | Missing |
| 3028 | `steedintrap` | - | Missing |
| 6409 | `t_at` | - | Missing |
| 1018 | `t_missile` | - | Missing |
| 6618 | `thitm` | - | Missing |
| 7079 | `trap_ice_effects` | - | Missing |
| 7102 | `trap_sanity_check` | - | Missing |
| 2301 | `trapeffect_anti_magic` | - | Missing |
| 1182 | `trapeffect_arrow_trap` | - | Missing |
| 1468 | `trapeffect_bear_trap` | - | Missing |
| 1241 | `trapeffect_dart_trap` | - | Missing |
| 1715 | `trapeffect_fire_trap` | - | Missing |
| 1991 | `trapeffect_hole` | - | Missing |
| 2464 | `trapeffect_landmine` | - | Missing |
| 2066 | `trapeffect_level_telep` | - | Missing |
| 2638 | `trapeffect_magic_portal` | - | Missing |
| 2271 | `trapeffect_magic_trap` | - | Missing |
| 1810 | `trapeffect_pit` | - | Missing |
| 2413 | `trapeffect_poly_trap` | - | Missing |
| 1313 | `trapeffect_rocktrap` | - | Missing |
| 2590 | `trapeffect_rolling_boulder_trap` | - | Missing |
| 1580 | `trapeffect_rust_trap` | - | Missing |
| 2863 | `trapeffect_selector` | - | Missing |
| 1548 | `trapeffect_slp_gas_trap` | - | Missing |
| 1392 | `trapeffect_sqky_board` | - | Missing |
| 2257 | `trapeffect_statue_trap` | - | Missing |
| 2048 | `trapeffect_telep_trap` | - | Missing |
| 2653 | `trapeffect_vibrating_square` | - | Missing |
| 2084 | `trapeffect_web` | - | Missing |
| 7007 | `trapname` | - | Missing |
| 2989 | `trapnote` | - | Missing |
| 5348 | `try_disarm` | - | Missing |
| 5584 | `try_lift` | - | Missing |
| 6567 | `uescaped_shaft` | - | Missing |
| 6683 | `unconscious` | - | Missing |
| 5514 | `unsqueak_ok` | - | Missing |
| 5755 | `untrap` | - | Missing |
| 5728 | `untrap_box` | - | Missing |
| 5196 | `untrap_prob` | - | Missing |
| 6555 | `uteetering_at_seen_pit` | - | Missing |
| 4619 | `water_damage` | - | Missing |
| 4762 | `water_damage_chain` | - | Missing |

### u_init.c -> u_init.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1297 | `ini_inv` | - | Missing |
| 1204 | `ini_inv_adjust_obj` | - | Missing |
| 1114 | `ini_inv_mkobj_filter` | - | Missing |
| 1178 | `ini_inv_obj_substitution` | - | Missing |
| 1250 | `ini_inv_use_obj` | - | Missing |
| 586 | `knows_class` | - | Missing |
| 575 | `knows_object` | - | Missing |
| 868 | `pauper_reinit` | - | Missing |
| 1090 | `restricted_spell_discipline` | - | Missing |
| 1036 | `skills_for_role` | - | Missing |
| 1105 | `trquan` | - | Missing |
| 927 | `u_init_carry_attr_boost` | - | Missing |
| 1369 | `u_init_inventory_attrs` | - | Missing |
| 942 | `u_init_misc` | - | Missing |
| 790 | `u_init_race` | - | Missing |
| 635 | `u_init_role` | - | Missing |
| 1394 | `u_init_skills_discoveries` | - | Missing |

### uhitm.c -> uhitm.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 74 | `mhitm_mgc_atk_negated` | uhitm.js | Implemented |
| 188 | `attack_checks` | - | Missing |
| 330 | `check_caitiff` | - | Missing |
| 4813 | `damageum` | - | Missing |
| 2111 | `demonpet` | - | Missing |
| 6286 | `disguised_as_mon` | - | Missing |
| 6278 | `disguised_as_non_mon` | - | Missing |
| 447 | `do_attack` | - | Missing |
| 3923 | `do_stone_mon` | - | Missing |
| 3902 | `do_stone_u` | - | Missing |
| 735 | `double_punch` | - | Missing |
| 103 | `dynamic_multi_reason` | - | Missing |
| 4927 | `end_engulf` | - | Missing |
| 125 | `erode_armor` | - | Missing |
| 4869 | `explum` | - | Missing |
| 364 | `find_roll_to_hit` | - | Missing |
| 1941 | `first_weapon_hit` | - | Missing |
| 6319 | `flash_hits_mon` | - | Missing |
| 431 | `force_attack` | - | Missing |
| 4936 | `gulpum` | - | Missing |
| 757 | `hitum` | - | Missing |
| 650 | `hitum_cleave` | - | Missing |
| 818 | `hmon` | - | Missing |
| 1732 | `hmon_hitmon` | - | Missing |
| 837 | `hmon_hitmon_barehands` | - | Missing |
| 1414 | `hmon_hitmon_dmg_recalc` | - | Missing |
| 1365 | `hmon_hitmon_do_hit` | - | Missing |
| 1519 | `hmon_hitmon_jousting` | - | Missing |
| 1097 | `hmon_hitmon_misc_obj` | - | Missing |
| 1615 | `hmon_hitmon_msg_hit` | - | Missing |
| 1680 | `hmon_hitmon_msg_lightobj` | - | Missing |
| 1641 | `hmon_hitmon_msg_silver` | - | Missing |
| 1566 | `hmon_hitmon_pet` | - | Missing |
| 1488 | `hmon_hitmon_poison` | - | Missing |
| 1073 | `hmon_hitmon_potion` | - | Missing |
| 1582 | `hmon_hitmon_splitmon` | - | Missing |
| 1548 | `hmon_hitmon_stagger` | - | Missing |
| 1048 | `hmon_hitmon_weapon` | - | Missing |
| 919 | `hmon_hitmon_weapon_melee` | - | Missing |
| 884 | `hmon_hitmon_weapon_ranged` | - | Missing |
| 5402 | `hmonas` | - | Missing |
| 2076 | `joust` | - | Missing |
| 586 | `known_hitum` | - | Missing |
| 6403 | `light_hits_gremlin` | - | Missing |
| 5196 | `m_is_steadfast` | - | Missing |
| 2034 | `m_slips_free` | - | Missing |
| 2720 | `mhitm_ad_acid` | uhitm.js | Implemented (m-vs-m path) |
| 2936 | `mhitm_ad_blnd` | uhitm.js | Implemented (m-vs-m path) |
| 2604 | `mhitm_ad_cold` | uhitm.js | Implemented (m-vs-m path) |
| 3668 | `mhitm_ad_conf` | uhitm.js | Implemented (m-vs-m path) |
| 2316 | `mhitm_ad_corr` | uhitm.js | Stub (no armor system) |
| 2993 | `mhitm_ad_curs` | uhitm.js | Stub (no m-vs-m effect) |
| 2341 | `mhitm_ad_dcay` | uhitm.js | Stub (no armor system) |
| 3815 | `mhitm_ad_deth` | uhitm.js | Implemented (redirects to drli) |
| 4470 | `mhitm_ad_dgst` | uhitm.js | Stub |
| 4571 | `mhitm_ad_dise` | uhitm.js | Stub (no m-vs-m effect) |
| 2396 | `mhitm_ad_dren` | uhitm.js | Implemented (m-vs-m path) |
| 3146 | `mhitm_ad_drin` | uhitm.js | Implemented (m-vs-m path) |
| 2423 | `mhitm_ad_drli` | uhitm.js | Implemented (m-vs-m path) |
| 3100 | `mhitm_ad_drst` | uhitm.js | Implemented (m-vs-m path) |
| 2662 | `mhitm_ad_elec` | uhitm.js | Implemented (m-vs-m path) |
| 3581 | `mhitm_ad_ench` | uhitm.js | Stub (no m-vs-m effect) |
| 3755 | `mhitm_ad_famn` | uhitm.js | Stub (physical only m-vs-m) |
| 2499 | `mhitm_ad_fire` | uhitm.js | Implemented (m-vs-m path) |
| 3875 | `mhitm_ad_halu` | uhitm.js | Stub (no m-vs-m effect) |
| 4274 | `mhitm_ad_heal` | uhitm.js | Implemented (m-vs-m path) |
| 4403 | `mhitm_ad_legs` | uhitm.js | Implemented (delegates to phys) |
| 3786 | `mhitm_ad_pest` | uhitm.js | Stub (physical only m-vs-m) |
| 3959 | `mhitm_ad_phys` | uhitm.js | Implemented (m-vs-m path) |
| 3409 | `mhitm_ad_plys` | uhitm.js | Implemented (m-vs-m path) |
| 3707 | `mhitm_ad_poly` | uhitm.js | Stub (needs newcham) |
| 2259 | `mhitm_ad_rust` | uhitm.js | Stub (no armor system) |
| 4548 | `mhitm_ad_samu` | uhitm.js | Stub (no m-vs-m effect) |
| 4601 | `mhitm_ad_sedu` | uhitm.js | Stub (no m-vs-m effect) |
| 2768 | `mhitm_ad_sgld` | uhitm.js | Stub (no m-vs-m effect) |
| 3457 | `mhitm_ad_slee` | uhitm.js | Implemented (m-vs-m path) |
| 3504 | `mhitm_ad_slim` | uhitm.js | Stub (needs newcham) |
| 3630 | `mhitm_ad_slow` | uhitm.js | Implemented (m-vs-m path) |
| 4729 | `mhitm_ad_ssex` | uhitm.js | Stub (no m-vs-m effect) |
| 3284 | `mhitm_ad_stck` | uhitm.js | Implemented (m-vs-m path) |
| 4181 | `mhitm_ad_ston` | uhitm.js | Stub (needs petrification) |
| 4366 | `mhitm_ad_stun` | uhitm.js | Implemented (m-vs-m path) |
| 2837 | `mhitm_ad_tlpt` | uhitm.js | Stub |
| 4243 | `mhitm_ad_were` | uhitm.js | Stub (no m-vs-m effect) |
| 3315 | `mhitm_ad_wrap` | uhitm.js | Implemented (m-vs-m path) |
| 4760 | `mhitm_adtyping` | uhitm.js | Implemented |
| 5225 | `mhitm_knockback` | mhitu.js + uhitm.js | Implemented — rn2(3) distance, rn2(6) chance, eligibility checks (AD_PHYS, attack type, size), rn2(2)+rn2(2) message; no actual monster movement |
| 3082 | `mhitm_really_poison` | uhitm.js | Implemented |
| 1920 | `mhurtle_to_doom` | - | Missing |
| 5176 | `missum` | - | Missing |
| 350 | `mon_maybe_unparalyze` | - | Missing |
| 6293 | `nohandglow` | - | Missing |
| 5843 | `passive` | - | Missing |
| 6105 | `passive_obj` | - | Missing |
| 1970 | `shade_aware` | - | Missing |
| 1994 | `shade_miss` | - | Missing |
| 4909 | `start_engulf` | - | Missing |
| 2152 | `steal_it` | - | Missing |
| 6260 | `stumble_onto_mimic` | - | Missing |
| 6179 | `that_is_a_mimic` | - | Missing |
| 2126 | `theft_petrifies` | - | Missing |

### utf8map.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 148 | `add_custom_urep_entry` | - | Missing |
| 59 | `free_all_glyphmap_u` | - | Missing |
| 86 | `mixed_to_utf8` | - | Missing |
| 37 | `set_map_u` | - | Missing |
| 18 | `unicode_val` | - | Missing |

### vault.c -> vault.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 123 | `blackout` | - | Missing |
| 48 | `clear_fcorr` | - | Missing |
| 281 | `find_guard_dest` | - | Missing |
| 204 | `findgd` | - | Missing |
| 35 | `free_egd` | - | Missing |
| 869 | `gd_letknow` | - | Missing |
| 888 | `gd_move` | - | Missing |
| 836 | `gd_move_cleanup` | - | Missing |
| 734 | `gd_mv_monaway` | - | Missing |
| 752 | `gd_pick_corridor_gold` | - | Missing |
| 1272 | `gd_sound` | - | Missing |
| 175 | `grddead` | - | Missing |
| 1257 | `hidden_gold` | - | Missing |
| 192 | `in_fcorridor` | - | Missing |
| 317 | `invault` | - | Missing |
| 632 | `move_gold` | - | Missing |
| 155 | `parkguard` | - | Missing |
| 1205 | `paygd` | - | Missing |
| 144 | `restfakecorr` | - | Missing |
| 256 | `uleftvault` | - | Missing |
| 1278 | `vault_gd_watching` | - | Missing |
| 244 | `vault_occupied` | - | Missing |
| 237 | `vault_summon_gd` | - | Missing |
| 646 | `wallify_vault` | - | Missing |

### version.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 371 | `check_version` | - | Missing |
| 354 | `comp_times` | - | Missing |
| 760 | `compare_critical_bytes` | - | Missing |
| 468 | `copyright_banner_line` | - | Missing |
| 166 | `doextversion` | - | Missing |
| 156 | `doversion` | - | Missing |
| 491 | `dump_version_info` | - | Missing |
| 277 | `early_version_info` | - | Missing |
| 666 | `get_critical_size_count` | - | Missing |
| 461 | `get_current_feature_ver` | - | Missing |
| 428 | `get_feature_notice_ver` | - | Missing |
| 35 | `getversionstring` | - | Missing |
| 336 | `insert_rtoption` | - | Missing |
| 89 | `status_version` | - | Missing |
| 673 | `store_critical_bytes` | - | Missing |
| 509 | `store_version` | - | Missing |
| 710 | `uptodate` | - | Missing |
| 837 | `validate` | - | Missing |

### vision.c -> vision.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1408 | `_q1_path` | - | Missing |
| 1502 | `_q2_path` | - | Missing |
| 1549 | `_q3_path` | - | Missing |
| 1455 | `_q4_path` | - | Missing |
| 854 | `block_point` | - | Missing |
| 1602 | `clear_path` | - | Missing |
| 956 | `dig_point` | - | Missing |
| 2096 | `do_clear_area` | - | Missing |
| 153 | `does_block` | - | Missing |
| 1040 | `fill_point` | - | Missing |
| 274 | `get_unused_cs` | - | Missing |
| 105 | `get_viz_clear` | - | Missing |
| 2141 | `howmonseen` | - | Missing |
| 1847 | `left_side` | - | Missing |
| 414 | `new_angle` | - | Missing |
| 900 | `recalc_block_point` | - | Missing |
| 1655 | `right_side` | - | Missing |
| 314 | `rogue_vision` | - | Missing |
| 888 | `unblock_point` | - | Missing |
| 1991 | `view_from` | - | Missing |
| 1640 | `view_init` | - | Missing |
| 121 | `vision_init` | - | Missing |
| 512 | `vision_recalc` | - | Missing |
| 211 | `vision_reset` | - | Missing |

### weapon.c -> weapon.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 950 | `abon` | - | Missing |
| 1224 | `add_skills_to_menu` | - | Missing |
| 1432 | `add_weapon_skill` | - | Missing |
| 520 | `autoreturn_weapon` | - | Missing |
| 1151 | `can_advance` | - | Missing |
| 1168 | `could_advance` | - | Missing |
| 988 | `dbon` | - | Missing |
| 216 | `dmgval` | - | Missing |
| 1471 | `drain_weapon_skill` | - | Missing |
| 1062 | `dry_a_towel` | - | Missing |
| 1324 | `enhance_weapon_skill` | - | Missing |
| 1015 | `finish_towel_change` | - | Missing |
| 76 | `give_may_advance_msg` | - | Missing |
| 149 | `hitval` | - | Missing |
| 1448 | `lose_weapon_skill` | - | Missing |
| 801 | `mon_wield_item` | - | Missing |
| 680 | `monmightthrowwep` | - | Missing |
| 938 | `mwepgone` | - | Missing |
| 476 | `oselect` | - | Missing |
| 1182 | `peaked_skill` | - | Missing |
| 747 | `possibly_unwield` | - | Missing |
| 705 | `select_hwep` | - | Missing |
| 533 | `select_rwep` | - | Missing |
| 1809 | `setmnotwielded` | - | Missing |
| 1301 | `show_skills` | - | Missing |
| 436 | `silver_sears` | - | Missing |
| 1193 | `skill_advance` | - | Missing |
| 1733 | `skill_init` | - | Missing |
| 1087 | `skill_level_name` | - | Missing |
| 1120 | `skill_name` | - | Missing |
| 1127 | `slots_required` | - | Missing |
| 361 | `special_dmgval` | - | Missing |
| 1409 | `unrestrict_weapon_skill` | - | Missing |
| 1419 | `use_skill` | - | Missing |
| 1527 | `uwep_skill_type` | - | Missing |
| 1639 | `weapon_dam_bonus` | - | Missing |
| 90 | `weapon_descr` | - | Missing |
| 1540 | `weapon_hit_bonus` | - | Missing |
| 1512 | `weapon_type` | - | Missing |
| 1033 | `wet_a_towel` | - | Missing |

### were.c -> were.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 48 | `counter_were` | - | Missing |
| 96 | `new_were` | - | Missing |
| 232 | `set_ulycn` | - | Missing |
| 70 | `were_beastie` | - | Missing |
| 9 | `were_change` | - | Missing |
| 142 | `were_summon` | - | Missing |
| 213 | `you_unwere` | - | Missing |
| 192 | `you_were` | - | Missing |

### wield.c -> wield.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 756 | `can_twoweapon` | 64 | Stub (returns false) |
| 133 | `cant_wield_corpse` | - | Missing |
| 909 | `chwepon` | - | Missing |
| 507 | `doquiver_core` | 212 | handleQuiver — Q command |
| 456 | `doswapweapon` | 184 | handleSwapWeapon — x command |
| 836 | `dotwoweapon` | - | Missing |
| 350 | `dowield` | 116 | handleWield — w command |
| 500 | `dowieldquiver` | 212 | handleQuiver — Q command |
| 804 | `drop_uswapwep` | - | Missing |
| 153 | `empty_handed` | - | Missing |
| 341 | `finish_splitting` | - | Missing |
| 1069 | `mwelded` | - | Missing |
| 289 | `ready_ok` | - | Missing |
| 164 | `ready_weapon` | 73 | Core wield logic |
| 829 | `set_twoweap` | - | Missing |
| 271 | `setuqwep` | 23 | Set quiver slot |
| 280 | `setuswapwep` | 18 | Set swap weapon slot |
| 897 | `untwoweapon` | - | Missing |
| 888 | `uqwepgone` | 38 | Force-remove quiver |
| 879 | `uswapwepgone` | 33 | Force-remove swap weapon |
| 864 | `uwepgone` | 28 | Force-remove main weapon |
| 1042 | `welded` | 48 | Cursed weapon check |
| 1052 | `weldmsg` | 57 | Weld message |
| 326 | `wield_ok` | - | Missing |
| 678 | `wield_tool` | - | Missing |

### windows.c -> —
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1785 | `add_menu` | - | Missing |
| 1816 | `add_menu_heading` | - | Missing |
| 1832 | `add_menu_str` | - | Missing |
| 342 | `addto_windowchain` | - | Missing |
| 1769 | `adjust_menu_promptstyle` | - | Missing |
| 231 | `check_tty_wincap` | - | Missing |
| 241 | `check_tty_wincap2` | - | Missing |
| 1644 | `choose_classes_menu` | - | Missing |
| 267 | `choose_windows` | - | Missing |
| 372 | `commit_windowchain` | - | Missing |
| 1439 | `decode_glyph` | - | Missing |
| 1466 | `decode_mixed` | - | Missing |
| 206 | `def_raw_print` | - | Missing |
| 215 | `def_wait_synch` | - | Missing |
| 1328 | `dump_add_menu` | - | Missing |
| 1300 | `dump_clear_nhwindow` | - | Missing |
| 1267 | `dump_close_log` | - | Missing |
| 1293 | `dump_create_nhwindow` | - | Missing |
| 1314 | `dump_destroy_nhwindow` | - | Missing |
| 1307 | `dump_display_nhwindow` | - | Missing |
| 1348 | `dump_end_menu` | - | Missing |
| 1126 | `dump_fmtstr` | - | Missing |
| 1276 | `dump_forward_putstr` | - | Missing |
| 1244 | `dump_open_log` | - | Missing |
| 1286 | `dump_putstr` | - | Missing |
| 1366 | `dump_redirect` | - | Missing |
| 1359 | `dump_select_menu` | - | Missing |
| 1321 | `dump_start_menu` | - | Missing |
| 1428 | `encglyph` | - | Missing |
| 193 | `genl_can_suspend_no` | - | Missing |
| 199 | `genl_can_suspend_yes` | - | Missing |
| 1539 | `genl_display_file` | - | Missing |
| 472 | `genl_getmsghistory` | - | Missing |
| 451 | `genl_message_menu` | - | Missing |
| 461 | `genl_preference_update` | - | Missing |
| 1528 | `genl_putmixed` | - | Missing |
| 489 | `genl_putmsghistory` | - | Missing |
| 922 | `genl_status_enablefield` | - | Missing |
| 909 | `genl_status_finish` | - | Missing |
| 893 | `genl_status_init` | - | Missing |
| 937 | `genl_status_update` | - | Missing |
| 1841 | `get_menu_coloring` | - | Missing |
| 1868 | `getlin` | - | Missing |
| 1419 | `glyph2symidx` | - | Missing |
| 1410 | `glyph2ttychar` | - | Missing |
| 1397 | `has_color` | - | Missing |
| 714 | `hup_add_menu` | - | Missing |
| 793 | `hup_change_color` | - | Missing |
| 784 | `hup_cliparound` | - | Missing |
| 697 | `hup_create_nhwindow` | - | Missing |
| 872 | `hup_ctrl_nhwindow` | - | Missing |
| 762 | `hup_curs` | - | Missing |
| 776 | `hup_display_file` | - | Missing |
| 769 | `hup_display_nhwindow` | - | Missing |
| 730 | `hup_end_menu` | - | Missing |
| 643 | `hup_exit_nhwindows` | - | Missing |
| 808 | `hup_get_color_string` | - | Missing |
| 683 | `hup_getlin` | - | Missing |
| 690 | `hup_init_nhwindows` | - | Missing |
| 829 | `hup_int_ndecl` | - | Missing |
| 676 | `hup_nh_poskey` | - | Missing |
| 657 | `hup_nhgetch` | - | Missing |
| 755 | `hup_outrip` | - | Missing |
| 744 | `hup_print_glyph` | - | Missing |
| 737 | `hup_putstr` | - | Missing |
| 704 | `hup_select_menu` | - | Missing |
| 801 | `hup_set_font_name` | - | Missing |
| 816 | `hup_status_update` | - | Missing |
| 865 | `hup_void_fdecl_constchar_p` | - | Missing |
| 842 | `hup_void_fdecl_int` | - | Missing |
| 849 | `hup_void_fdecl_winid` | - | Missing |
| 856 | `hup_void_fdecl_winid_ulong` | - | Missing |
| 835 | `hup_void_ndecl` | - | Missing |
| 664 | `hup_yn_function` | - | Missing |
| 1562 | `menuitem_invert_test` | - | Missing |
| 1600 | `mixed_to_glyphinfo` | - | Missing |
| 615 | `nhwindows_hangup` | - | Missing |
| 1856 | `select_menu` | - | Missing |
| 253 | `win_choices_find` | - | Missing |
| 169 | `wl_addhead` | - | Missing |
| 176 | `wl_addtail` | - | Missing |
| 157 | `wl_new` | - | Missing |

### wizard.c -> wizard.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 488 | `aggravate` | monmove.js | Faithful — wakes sleeping monsters, rn2(5) unfreeze chance; In_W_tower check omitted |
| 61 | `amulet` | - | Missing |
| 332 | `choose_stairs` | - | Missing |
| 511 | `clonewiz` | - | Missing |
| 840 | `cuss` | - | Missing |
| 468 | `has_aggravatables` | - | Missing |
| 779 | `intervene` | - | Missing |
| 106 | `mon_has_amulet` | - | Missing |
| 165 | `mon_has_arti` | - | Missing |
| 117 | `mon_has_special` | - | Missing |
| 585 | `nasty` | - | Missing |
| 202 | `on_ground` | - | Missing |
| 184 | `other_mon_has_arti` | - | Missing |
| 532 | `pick_nasty` | - | Missing |
| 709 | `resurrect` | - | Missing |
| 270 | `strategy` | - | Missing |
| 369 | `tactics` | - | Missing |
| 236 | `target_on` | - | Missing |
| 142 | `which_arti` | - | Missing |
| 809 | `wizdeadorgone` | - | Missing |
| 216 | `you_have` | - | Missing |

### wizcmds.c -> wizcmds.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 1199 | `contained_stats` | - | Missing |
| 1135 | `count_obj` | - | Missing |
| 1444 | `levl_sanity_check` | - | Missing |
| 1506 | `list_migrating_mons` | - | Missing |
| 110 | `makemap_remove_mons` | - | Missing |
| 73 | `makemap_unmakemon` | - | Missing |
| 1485 | `migrsort_cmp` | - | Missing |
| 1284 | `misc_stats` | - | Missing |
| 1257 | `mon_chain` | - | Missing |
| 1177 | `mon_invent_chain` | - | Missing |
| 1156 | `obj_chain` | - | Missing |
| 1460 | `sanity_check` | - | Missing |
| 1228 | `size_monst` | - | Missing |
| 1117 | `size_obj` | - | Missing |
| 1885 | `wiz_custom` | - | Missing |
| 229 | `wiz_detect` | - | Missing |
| 1705 | `wiz_display_macros` | - | Missing |
| 412 | `wiz_flip_level` | - | Missing |
| 549 | `wiz_fuzzer` | - | Missing |
| 203 | `wiz_genesis` | wizcmds.js:wizGenesis | APPROX — create monster |
| 50 | `wiz_identify` | - | Missing |
| 949 | `wiz_intrinsic` | - | Missing |
| 243 | `wiz_kill` | - | Missing |
| 446 | `wiz_level_change` | wizcmds.js:wizLevelChange | APPROX — wizard level teleport |
| 399 | `wiz_level_tele` | wizcmds.js:wizTeleport | APPROX — coordinate teleport |
| 841 | `wiz_levltyp_legend` | - | Missing |
| 353 | `wiz_load_lua` | - | Missing |
| 376 | `wiz_load_splua` | wizcmds.js:handleWizLoadDes | APPROX — load special level |
| 156 | `wiz_makemap` | - | Missing |
| 176 | `wiz_map` | wizcmds.js:wizMap | APPROX — reveal map |
| 693 | `wiz_map_levltyp` | - | Missing |
| 1827 | `wiz_migrate_mons` | - | Missing |
| 1784 | `wiz_mon_diff` | - | Missing |
| 534 | `wiz_panic` | - | Missing |
| 568 | `wiz_polyself` | - | Missing |
| 1102 | `wiz_rumor_check` | - | Missing |
| 576 | `wiz_show_seenv` | - | Missing |
| 1616 | `wiz_show_stats` | - | Missing |
| 621 | `wiz_show_vision` | - | Missing |
| 657 | `wiz_show_wmodes` | - | Missing |
| 885 | `wiz_smell` | - | Missing |
| 494 | `wiz_telekinesis` | - | Missing |
| 218 | `wiz_where` | - | Missing |
| 32 | `wiz_wish` | - | Missing |
| 1938 | `wizcustom_callback` | - | Missing |
| 1402 | `you_sanity_check` | - | Missing |

### worm.c -> worm.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 836 | `count_wsegs` | - | Missing |
| 852 | `create_worm_tail` | - | Missing |
| 373 | `cutworm` | - | Missing |
| 503 | `detect_wsegs` | - | Missing |
| 979 | `flip_worm_segs_horizontal` | - | Missing |
| 968 | `flip_worm_segs_vertical` | - | Missing |
| 120 | `initworm` | - | Missing |
| 738 | `place_worm_tail_randomly` | - | Missing |
| 615 | `place_wsegs` | - | Missing |
| 803 | `random_dir` | - | Missing |
| 990 | `redraw_worm` | - | Missing |
| 714 | `remove_worm` | - | Missing |
| 577 | `rest_worm` | - | Missing |
| 639 | `sanity_check_worm` | - | Missing |
| 528 | `save_worm` | - | Missing |
| 487 | `see_wsegs` | - | Missing |
| 175 | `shrink_worm` | - | Missing |
| 827 | `size_wseg` | - | Missing |
| 146 | `toss_wsegs` | - | Missing |
| 898 | `worm_cross` | - | Missing |
| 883 | `worm_known` | - | Missing |
| 196 | `worm_move` | - | Missing |
| 288 | `worm_nomove` | - | Missing |
| 308 | `wormgone` | - | Missing |
| 344 | `wormhitu` | - | Missing |
| 682 | `wormno_sanity_check` | - | Missing |
| 946 | `wseg_at` | - | Missing |

### worn.c -> worn.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 180 | `allunworn` | - | Missing |
| 242 | `armcat_to_wornmask` | - | Missing |
| 1109 | `bypass_obj` | - | Missing |
| 1117 | `bypass_objlist` | - | Missing |
| 347 | `check_wornmask_slots` | - | Missing |
| 1045 | `clear_bypass` | - | Missing |
| 1060 | `clear_bypasses` | - | Missing |
| 1329 | `extra_pref` | - | Missing |
| 1367 | `extract_from_minvent` | - | Missing |
| 707 | `find_mac` | - | Missing |
| 747 | `m_dowear` | - | Missing |
| 789 | `m_dowear_type` | - | Missing |
| 1030 | `m_lose_armor` | - | Missing |
| 478 | `mon_adjust_speed` | - | Missing |
| 1167 | `mon_break_armor` | - | Missing |
| 466 | `mon_set_minvis` | - | Missing |
| 1149 | `nxt_unbypassed_loot` | - | Missing |
| 1132 | `nxt_unbypassed_obj` | - | Missing |
| 1350 | `racial_exception` | - | Missing |
| 50 | `recalc_telepat_range` | - | Missing |
| 147 | `setnotworn` | - | Missing |
| 73 | `setworn` | - | Missing |
| 569 | `update_mon_extrinsics` | - | Missing |
| 198 | `wearmask_to_obj` | - | Missing |
| 274 | `wearslot` | - | Missing |
| 996 | `which_armor` | - | Missing |
| 210 | `wornmask_to_armcat` | - | Missing |

### write.c -> write.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 74 | `dowrite` | - | Missing |
| 395 | `new_book_description` | - | Missing |
| 61 | `write_ok` | - | Missing |

### zap.c -> zap.js
| C Line | C Function | JS Line | Alignment |
|--------|------------|---------|-----------|
| 5624 | `adtyp_to_prop` | - | Missing |
| 2593 | `backfire` | - | Missing |
| 3815 | `bhit` | - | Missing |
| 158 | `bhitm` | - | Missing |
| 2117 | `bhito` | - | Missing |
| 2426 | `bhitpile` | - | Missing |
| 1365 | `blank_novel` | - | Missing |
| 4136 | `boomhit` | - | Missing |
| 2675 | `boxlock_invent` | - | Missing |
| 5552 | `break_statue` | - | Missing |
| 4584 | `burn_floor_objects` | - | Missing |
| 4706 | `buzz` | - | Missing |
| 1237 | `cancel_item` | - | Missing |
| 3138 | `cancel_monst` | - | Missing |
| 1544 | `create_polymon` | - | Missing |
| 5935 | `destroy_items` | - | Missing |
| 5583 | `destroyable` | - | Missing |
| 4664 | `disintegrate_mon` | - | Missing |
| 2523 | `do_enlightenment_effect` | - | Missing |
| 1635 | `do_osshock` | - | Missing |
| 4721 | `dobuzz` | - | Missing |
| 2615 | `dozap` | - | Missing |
| 1380 | `drain_item` | - | Missing |
| 3535 | `exclam` | - | Missing |
| 6303 | `flash_str` | - | Missing |
| 3048 | `flashburn` | - | Missing |
| 5507 | `fracture_rock` | - | Missing |
| 839 | `get_container_location` | - | Missing |
| 690 | `get_mon_location` | - | Missing |
| 652 | `get_obj_location` | - | Missing |
| 3544 | `hit` | - | Missing |
| 5680 | `inventory_resistance_check` | - | Missing |
| 5692 | `item_what` | - | Missing |
| 121 | `learnwand` | - | Missing |
| 3014 | `lightdamage` | - | Missing |
| 6194 | `makewish` | - | Missing |
| 5768 | `maybe_destroy_item` | - | Missing |
| 3582 | `maybe_explode_trap` | - | Missing |
| 5010 | `melt_ice` | - | Missing |
| 5089 | `melt_ice_away` | - | Missing |
| 3559 | `miss` | - | Missing |
| 5471 | `mon_spell_hits_spot` | - | Missing |
| 711 | `montraits` | - | Missing |
| 1456 | `obj_resists` | - | Missing |
| 1474 | `obj_shudders` | - | Missing |
| 1676 | `obj_unpolyable` | - | Missing |
| 1700 | `poly_obj` | - | Missing |
| 1503 | `polyuse` | - | Missing |
| 624 | `probe_monster` | - | Missing |
| 610 | `probe_objchain` | - | Missing |
| 576 | `release_hold` | - | Missing |
| 6070 | `resist` | zap.js:71 | Implemented (faithful: alev per oclass, dlev capped, rn2(100+alev-dlev) < mr) |
| 882 | `revive` | - | Missing |
| 1141 | `revive_egg` | - | Missing |
| 3567 | `skiprange` | - | Missing |
| 3468 | `spell_damage_bonus` | - | Missing |
| 3497 | `spell_hit_bonus` | - | Missing |
| 5058 | `start_melt_ice_timeout` | - | Missing |
| 1991 | `stone_to_flesh_obj` | - | Missing |
| 5646 | `u_adtyp_resistance_obj` | - | Missing |
| 3005 | `ubreatheu` | - | Missing |
| 4700 | `ubuzz` | - | Missing |
| 1154 | `unturn_dead` | - | Missing |
| 1223 | `unturn_you` | - | Missing |
| 3419 | `weffects` | - | Missing |
| 6135 | `wishcmdassist` | - | Missing |
| 4646 | `zap_hit` | - | Missing |
| 3616 | `zap_map` | - | Missing |
| 2606 | `zap_ok` | - | Missing |
| 5111 | `zap_over_floor` | - | Missing |
| 3075 | `zap_steed` | - | Missing |
| 3207 | `zap_updown` | - | Missing |
| 2537 | `zapnodir` | - | Missing |
| 2512 | `zappable` | - | Missing |
| 3403 | `zapsetup` | - | Missing |
| 87 | `zaptype` | - | Missing |
| 3409 | `zapwrapup` | - | Missing |
| 2693 | `zapyourself` | - | Missing |
| 4224 | `zhitm` | - | Missing |
| 4387 | `zhitu` | - | Missing |
| 861 | `zombie_can_dig` | - | Missing |

