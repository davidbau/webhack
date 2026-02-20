// timeout.js -- Timer-based effects: status countdowns, burn timers, egg hatching
// cf. timeout.c — nh_timeout, run_timers, start_timer, stop_timer, peek_timer,
//                 burn_object, begin_burn, end_burn, cleanup_burn,
//                 attach_egg_hatch_timeout, hatch_egg, kill_egg,
//                 attach_fig_transform_timeout, fall_asleep,
//                 stoned_dialogue, vomiting_dialogue, sleep_dialogue,
//                 choke_dialogue, sickness_dialogue, levitation_dialogue,
//                 slime_dialogue, slimed_to_death, burn_away_slime,
//                 phaze_dialogue, region_dialogue, done_timeout,
//                 slip_or_trip, see_lamp_flicker, lantern_message,
//                 do_storms, wiz_timeout_queue, timer_sanity_check,
//                 obj_move_timers, obj_split_timers, obj_stop_timers,
//                 obj_has_timer, spot_stop_timers, spot_time_expires,
//                 spot_time_left, insert_timer, remove_timer,
//                 save_timers, restore_timers, relink_timers,
//                 property_by_index, kind_name, print_queue,
//                 timer_stats, do_storms
//
// Timeout system overview:
//   timeout.c maintains a priority queue of timer_element structs (sorted by
//   expiration turn). Each timer has a func_index (registered callback),
//   a "kind" (SHORT=per-turn property delay, LONG=absolute turn), and an arg
//   (typically an object or monster pointer). run_timers() fires expired timers
//   each turn from moveloop. start_timer/stop_timer/peek_timer manage the queue.
//
// Dialogue functions (stoned_dialogue etc.) handle countdown messages for
//   timed status effects: petrification, vomiting, choking, illness, levitation,
//   sliming, pass-walls, magical breathing. nh_timeout() calls them each turn
//   based on status countdown values.
//
// Burn timers track fuel consumption for lamps, candles, lanterns. begin_burn
//   starts the timer; burn_object callback fires each turn; end_burn stops it.
//
// JS implementations (RNG-parity only):
//   start_corpse_timeout() → mkobj.js:767 (RNG-only stub for corpse rot timing)
//   attach_egg_hatch_timeout() → mkobj.js:793 (RNG-only stub for egg hatch timing)
// All runtime timer functions → not implemented in JS.
//
// Note: JS has no timer queue; status effects, burn durations, and egg hatching
//   are not yet simulated dynamically. Timer callbacks (burn_object, hatch_egg,
//   expire_gas_cloud, etc.) are all TODO.

// cf. timeout.c:117 [static] — property_by_index(idx, propertynum): name/num lookup
// Returns property name string and sets *propertynum for status property idx.
// Used by nh_timeout to iterate timed properties.
// TODO: timeout.c:117 — property_by_index(): timed property name lookup

// cf. timeout.c:137 [static] — stoned_dialogue(): petrification countdown messages
// Fires each turn player is petrifying; prints "You feel yourself slowing down",
//   "You are getting stiff", "You are turning to stone", then calls done().
// TODO: timeout.c:137 — stoned_dialogue(): petrification countdown

// cf. timeout.c:197 [static] — vomiting_dialogue(): vomiting countdown messages
// Applies vomit effects at various stages: nausea, vomiting, attribute penalties.
// TODO: timeout.c:197 — vomiting_dialogue(): vomiting countdown

// cf. timeout.c:268 [static] — sleep_dialogue(): sleep-related status dialogue
// Prints messages as sleep status wears off.
// TODO: timeout.c:268 — sleep_dialogue(): sleep countdown

// cf. timeout.c:295 [static] — choke_dialogue(): strangulation countdown messages
// Prints "You find it hard to breathe", "Your face is turning blue", etc.;
//   calls done() when choke timer expires.
// TODO: timeout.c:295 — choke_dialogue(): choking countdown

// cf. timeout.c:323 [static] — sickness_dialogue(): illness progression messages
// Prints illness stage messages; calls done(SICK) when timer reaches 0.
// TODO: timeout.c:323 — sickness_dialogue(): illness countdown

// cf. timeout.c:353 [static] — levitation_dialogue(): levitation countdown messages
// Prints "You float down" as levitation wears off; handles waning.
// TODO: timeout.c:353 — levitation_dialogue(): levitation countdown

// cf. timeout.c:389 [static] — slime_dialogue(): green slime transformation countdown
// Prints "You are turning into slime" messages at stages; calls slimed_to_death().
// TODO: timeout.c:389 — slime_dialogue(): sliming countdown

// cf. timeout.c:448 — burn_away_slime(): cure sliming status with a burn
// Called when fire cures the player of sliming; removes slime timer.
// TODO: timeout.c:448 — burn_away_slime(): fire-cure sliming

// cf. timeout.c:457 — slimed_to_death(kptr): death by sliming
// Finalizes slime transformation death; calls done() with TURNED_SLIME cause.
// TODO: timeout.c:457 — slimed_to_death(): slime transformation death

// cf. timeout.c:534 [static] — phaze_dialogue(): pass-walls timeout countdown
// Prints "Your body feels more solid" as phasing wears off.
// TODO: timeout.c:534 — phaze_dialogue(): pass-walls countdown

// cf. timeout.c:554 [static] — region_dialogue(): magical breathing countdown
// Prints warning as magical breathing (from gas cloud immunity) wears off.
// TODO: timeout.c:554 — region_dialogue(): magical breathing countdown

// cf. timeout.c:575 — done_timeout(how, which): timeout-triggered death
// Sets status for display then calls done(how); used when countdown reaches death.
// TODO: timeout.c:575 — done_timeout(): countdown-triggered death

// cf. timeout.c:588 — nh_timeout(): main per-turn timed status processor
// Iterates all timed properties; fires dialogue functions; decrements countdowns.
// Also handles: blindness recovery, confusion waning, stun, hallucination,
//   lycanthropy, fast/slow timers, temporary intrinsics.
// Called once per turn from moveloop().
// TODO: timeout.c:588 — nh_timeout(): per-turn status countdown processing

// cf. timeout.c:951 — fall_asleep(how_long, wakeup_msg): put hero to sleep
// Sets Sleeping status for how_long turns; optionally prints wakeup message.
// Used by sleep traps, sleep monster attacks, sleeping potion.
// TODO: timeout.c:951 — fall_asleep(): hero sleep effect

// cf. timeout.c:981 — attach_egg_hatch_timeout(egg, when): start egg hatching timer
// Creates a HATCH_EGG timer on the egg object expiring at turn=when.
// JS equiv: attach_egg_hatch_timeout_rng() in mkobj.js:793 — RNG-parity only.
// PARTIAL: timeout.c:981 — attach_egg_hatch_timeout() ↔ attach_egg_hatch_timeout_rng() (mkobj.js:793)

// cf. timeout.c:1009 — kill_egg(egg): stop egg hatching timer
// Removes HATCH_EGG timer from egg object (egg was destroyed/eaten).
// TODO: timeout.c:1009 — kill_egg(): cancel egg hatch timer

// cf. timeout.c:1017 — hatch_egg(arg, timeout): timer callback for egg hatching
// Spawns a monster of the appropriate species near the egg; calls makemon().
// Handles baby forms, tame pets, etc.
// TODO: timeout.c:1017 — hatch_egg(): egg hatching callback

// cf. timeout.c:1193 — learn_egg_type(mnum): mark egg type as known
// Sets egg type as identified in the discovery tables.
// TODO: timeout.c:1193 — learn_egg_type(): egg identification

// cf. timeout.c:1204 — attach_fig_transform_timeout(figurine): figurine transform timer
// Starts a FIGURINE_TRANSFORM timer on a figurine object.
// Used when a figurine animates on its own.
// TODO: timeout.c:1204 — attach_fig_transform_timeout(): figurine animation timer

// cf. timeout.c:1222 — slip_or_trip(): fumble messages and effects
// Generates "you slip", "you trip" messages with DEX penalty; called by
//   nh_timeout when player is Fumbling.
// TODO: timeout.c:1222 — slip_or_trip(): fumble effect

// cf. timeout.c:1345 — see_lamp_flicker(obj, tailer): lamp flicker message
// Prints "Your <lamp> flickers" or "Your <lamp> is getting dim" messages.
// TODO: timeout.c:1345 — see_lamp_flicker(): lamp flicker message

// cf. timeout.c:1360 — lantern_message(obj): brass lantern dimming message
// Prints brass lantern-specific warning messages as fuel runs low.
// TODO: timeout.c:1360 — lantern_message(): lantern fuel warning

// cf. timeout.c:1383 — burn_object(arg, timeout): timer callback for burning objects
// Per-turn callback that consumes fuel; dims lamps/candles; fires flicker messages.
// Expires when obj->age reaches 0 (out of fuel).
// TODO: timeout.c:1383 — burn_object(): per-turn lamp/candle burn callback

// cf. timeout.c:1712 — begin_burn(obj, already_lit): start burn timer on light source
// Creates a BURN_OBJECT timer with expiration based on obj->age (fuel remaining).
// JS note: Light sources track obj.age for fuel, but no timer fires per turn.
// TODO: timeout.c:1712 — begin_burn(): start lamp/candle burn timer

// cf. timeout.c:1804 — end_burn(obj, timer_attached): stop burn timer
// Stops BURN_OBJECT timer; optionally removes from timer queue.
// TODO: timeout.c:1804 — end_burn(): stop lamp/candle burn timer

// cf. timeout.c:1828 — cleanup_burn(arg, expire_time): burn timer cleanup callback
// Called when burn timer is cancelled; handles cleanup of burn state.
// TODO: timeout.c:1828 — cleanup_burn(): burn timer cleanup callback

// cf. timeout.c:1847 — do_storms(): random lightning strikes in stormy areas
// Generates lightning bolt effects in storm regions of the level.
// Called per-turn when on a level with storm terrain.
// TODO: timeout.c:1847 — do_storms(): storm lightning effects

// cf. timeout.c:1995 — kind_name(kind): timer kind string name
// Returns human-readable name for timer kind (SHORT, LONG, SPECIAL, etc.).
// Used in debug/wizard display.
// TODO: timeout.c:1995 — kind_name(): timer kind name string

// cf. timeout.c:2014 [static] — print_queue(win, base): display timer queue
// Outputs each timer's kind, func, and expiration to window for #timeout display.
// TODO: timeout.c:2014 — print_queue(): timer queue display

// cf. timeout.c:2041 — wiz_timeout_queue(): wizard #timeout command
// Shows all active timers and timed status properties in a window.
// TODO: timeout.c:2041 — wiz_timeout_queue(): wizard timer display

// cf. timeout.c:2122 — timer_sanity_check(): validate timer queue integrity
// Checks for dangling pointers, duplicate timers, invalid func_index values.
// Called periodically in debug builds.
// TODO: timeout.c:2122 — timer_sanity_check(): timer integrity check

// cf. timeout.c:2214 — run_timers(): execute expired timers
// Pops all timers with expiration ≤ current turn; calls registered callback.
// Called once per turn from moveloop().
// TODO: timeout.c:2214 — run_timers(): main timer dispatch

// cf. timeout.c:2239 — start_timer(when, kind, func_index, arg): create new timer
// Allocates timer_element; inserts into priority queue via insert_timer().
// JS equiv: start_corpse_timeout_rng() in mkobj.js:767 — RNG-parity only.
// PARTIAL: timeout.c:2239 — start_timer() ↔ start_corpse_timeout_rng() (mkobj.js:767)

// cf. timeout.c:2291 — stop_timer(func_index, arg): remove timer from queue
// Finds and removes timer matching func_index+arg; calls cleanup if provided.
// TODO: timeout.c:2291 — stop_timer(): cancel timer

// cf. timeout.c:2316 — peek_timer(type, arg): query timeout without removing
// Returns expiration turn for timer matching type+arg, or 0 if not found.
// TODO: timeout.c:2316 — peek_timer(): timer expiration query

// cf. timeout.c:2331 — obj_move_timers(src, dest): move all timers to new object
// Updates timer arg pointers when object is duplicated or moved.
// TODO: timeout.c:2331 — obj_move_timers(): move object timers

// cf. timeout.c:2351 — obj_split_timers(src, dest): copy timers to new split object
// Creates duplicate timers for newly split object stacks.
// TODO: timeout.c:2351 — obj_split_timers(): copy object timers on split

// cf. timeout.c:2369 — obj_stop_timers(obj): stop all timers on object
// Calls stop_timer for all timers attached to obj (BURN, HATCH, etc.).
// TODO: timeout.c:2369 — obj_stop_timers(): cancel all object timers

// cf. timeout.c:2396 — obj_has_timer(object, timer_type): check for specific timer
// Returns TRUE if object has an active timer of type timer_type.
// TODO: timeout.c:2396 — obj_has_timer(): object timer presence check

// cf. timeout.c:2408 — spot_stop_timers(x, y, func_index): stop timers at map location
// Removes all timers attached to position (x,y) matching func_index.
// TODO: timeout.c:2408 — spot_stop_timers(): cancel location timers

// cf. timeout.c:2437 — spot_time_expires(x, y, func_index): expiration at location
// Returns expiration turn for timer at (x,y) matching func_index.
// TODO: timeout.c:2437 — spot_time_expires(): location timer expiration

// cf. timeout.c:2451 — spot_time_left(x, y, func_index): turns remaining for spot timer
// Returns (expiration - current turn) for timer at (x,y).
// TODO: timeout.c:2451 — spot_time_left(): location timer countdown

// cf. timeout.c:2459 [static] — insert_timer(gnu): insert into sorted queue
// Inserts timer_element in ascending expiration order into global queue.
// TODO: timeout.c:2459 — insert_timer(): timer queue insertion

// cf. timeout.c:2475 [static] — remove_timer(base, func_index, arg): remove from queue
// Finds and unlinks timer_element from linked list.
// TODO: timeout.c:2475 — remove_timer(): timer queue removal

// cf. timeout.c:2497 — write_timer(nhfp, timer): serialize timer to save file
// Writes timer fields; handles object/monster arg type encoding.
// N/A: JS has no save file system.
// N/A: timeout.c:2497 — write_timer()

// cf. timeout.c:2552 [static] — obj_is_local(obj): object stays on level when saved?
// Returns TRUE if obj is in invent, floor, or in a local container.
// N/A: JS has no save file system.
// N/A: timeout.c:2552 — obj_is_local()

// cf. timeout.c:2576 [static] — mon_is_local(mon): monster stays on level when saved?
// Returns TRUE if mon is in fmon list (not migrating).
// N/A: JS has no save file system.
// N/A: timeout.c:2576 — mon_is_local()

// cf. timeout.c:2595 [static] — timer_is_local(timer): timer attached to level-local element?
// Returns TRUE if timer's arg object/monster stays on current level.
// N/A: JS has no save file system.
// N/A: timeout.c:2595 — timer_is_local()

// cf. timeout.c:2619 — maybe_write_timer(nhfp, range, write_it): count/write timers in range
// Counts or serializes timers (LOCAL or MIGRATING) to save file.
// N/A: JS has no save file system.
// N/A: timeout.c:2619 — maybe_write_timer()

// cf. timeout.c:2660 — save_timers(nhfp, range): save timers to file
// Writes timer count then each timer via maybe_write_timer().
// N/A: JS has no save file system.
// N/A: timeout.c:2660 — save_timers()

// cf. timeout.c:2699 — restore_timers(nhfp, range, adjust): restore timers from save
// Reads timer count and data; relinks to objects/monsters; adjusts for elapsed turns.
// N/A: JS has no save file system.
// N/A: timeout.c:2699 — restore_timers()

// cf. timeout.c:2727 — timer_stats(hdrfmt, hdrbuf, count, size): timer memory stats
// Appends timer count and byte usage to stats buffer.
// TODO: timeout.c:2727 — timer_stats(): timer memory statistics

// cf. timeout.c:2743 — relink_timers(ghostly): restore obj/mon pointers after load
// Re-links timer arg pointers to real object/monster addresses post-load.
// Ghostly=TRUE: adjusts TTL for bones-file timers that aged while buried.
// N/A: JS has no save file system.
// N/A: timeout.c:2743 — relink_timers()
