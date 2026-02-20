// worm.js -- Long worm segment mechanics
// cf. worm.c — worm tail growth, movement, cutting, and segment bookkeeping
//
// Data model: Each long worm head has a `wormno` (1..MAX_NUM_WORMS-1).
// Three module-level arrays indexed by wormno:
//   wtails[wormno] — linked list start (points to tail segment)
//   wheads[wormno] — linked list end (dummy segment co-located with head)
//   wgrowtime[wormno] — move count when worm next grows
// Segments are wseg structs: { nseg, wx, wy }.
// The dummy head segment is NOT displayed; only wtails..wheads-1 are shown.

// cf. worm.c:96 — get_wormno(): find an unused worm tail slot (1..MAX_NUM_WORMS-1)
// Returns 0 if all slots taken ("level infested with worms").
// TODO: worm.c:96 — get_wormno(): scan wheads[] for empty slot

// cf. worm.c:120 — initworm(worm, wseg_count): initialize worm arrays for a new worm
// Creates dummy head/tail segment via create_worm_tail(); sets wgrowtime[wnum]=0.
// Called after worm->wormno = get_wormno() succeeds.
// TODO: worm.c:120 — initworm(): set up wheads/wtails/wgrowtime for a new worm

// cf. worm.c:146 [static] — toss_wsegs(curr, display_update): free all segments from curr onward
// Calls remove_monster(wx,wy) + newsym() for each placed segment, then frees it.
// TODO: worm.c:146 — toss_wsegs(): segment linked-list teardown

// cf. worm.c:175 [static] — shrink_worm(wnum): remove the tail-end segment
// If wtails==wheads (no actual tail), returns immediately.
// Otherwise unlinks wtails and calls toss_wsegs() on just that one segment.
// TODO: worm.c:175 — shrink_worm(): remove one tail segment

// cf. worm.c:196 — worm_move(worm): move worm and maybe grow
// Adds new dummy head segment at current worm position;
//   if wgrowtime reached: grow HP (d(2,2)) and don't delete tail;
//   otherwise: shrink_worm() to keep length constant.
// HP limit scales with segment count (8n for n<=11, then +6/+4/+2 per tier).
// TODO: worm.c:196 — worm_move(): worm movement and growth logic

// cf. worm.c:288 — worm_nomove(worm): worm didn't move this turn, so shrink
// Calls shrink_worm(), then reduces mhp by d(2,2) if mhp > segment count.
// TODO: worm.c:288 — worm_nomove(): worm shrink when immobile

// cf. worm.c:308 — wormgone(worm): kill the worm tail entirely
// Zeroes wormno, calls toss_wsegs on all segments (including the dummy head
//   co-located with the worm, thus removing it from level.monsters[][]),
//   resets wheads/wtails/wgrowtime.
// TODO: worm.c:308 — wormgone(): full worm tail removal

// cf. worm.c:344 — wormhitu(worm): attack hero from any nearby tail segment
// Iterates wtails..wheads-1; for any segment within dist2 < 3 of hero,
//   calls mattacku(). Returns 1 if worm dies (passive counter-attack), 0 otherwise.
// TODO: worm.c:344 — wormhitu(): worm tail attack hero

// cf. worm.c:373 — cutworm(worm, x, y, cuttier): chance to cut worm in half
// Chance: rnd(20); +10 if cuttier (blade/axe). Cut if >= 17.
// Finds hit segment; tail segment → just shrink; otherwise split:
//   new worm from clone_mon() if level>=3 and !rn2(3), else tail dies.
//   Both halves get reduced m_lev and new d(m_lev, 8) HP.
// TODO: worm.c:373 — cutworm(): worm splitting mechanic

// cf. worm.c:487 — see_wsegs(worm): refresh display for all tail segments
// Iterates wtails..wheads-1 and calls newsym() on each. Called from see_monster().
// TODO: worm.c:487 — see_wsegs(): redisplay worm tail segments

// cf. worm.c:503 — detect_wsegs(worm, use_detection_glyph): show segments for detection
// Shows tail segments using detected/tame/normal monster glyph as appropriate.
// TODO: worm.c:503 — detect_wsegs(): detection display of worm segments

// cf. worm.c:528 — save_worm(nhfp): serialize worm arrays to save file
// Writes segment count + (wx,wy) pairs for each wormno, then wgrowtime[].
// Also frees segment memory in release_data phase.
// N/A in JS (no save file format). JS equivalent would be part of game-state serialization.

// cf. worm.c:577 — rest_worm(nhfp): deserialize worm arrays from save file
// Reads segment count + coordinates, rebuilds wtails/wheads linked lists.
// N/A in JS (no restore from save file).

// cf. worm.c:615 — place_wsegs(worm, oldworm): place all tail segments on the map
// Iterates wtails..wheads-1; calls remove_monster(oldworm) if replacing, then
//   place_worm_seg(). Updates head segment wx/wy to worm->mx/my.
// Called from restore and replmon (mon.c).
// TODO: worm.c:615 — place_wsegs(): put worm segments into level.monsters[][] grid

// cf. worm.c:639 — sanity_check_worm(worm): validate worm segment consistency
// Checks wormno set, wtails/wheads non-null, each segment position has worm in map.
// Debug/sanity use only; not needed for JS gameplay.
// TODO: worm.c:639 — sanity_check_worm(): worm state validation (debug)

// cf. worm.c:682 — wormno_sanity_check(): verify wheads[0]/wtails[0] are always empty
// Only active when EXTRA_SANITY_CHECKS defined. Not needed for JS gameplay.

// cf. worm.c:714 — remove_worm(worm): remove all segments from map (not from fmon)
// Iterates all segments (including head), calls remove_monster() + newsym(), zeroes wx.
// Does NOT free the wseg structs — caller responsible for that.
// TODO: worm.c:714 — remove_worm(): unmap all worm segments

// cf. worm.c:738 — place_worm_tail_randomly(worm, x, y): lay worm tail from head outward
// Reverses segment list order while placing each segment at a valid adjacent spot.
// Segments that can't be placed are toss_wsegs()'d (truncation).
// TODO: worm.c:738 — place_worm_tail_randomly(): random tail placement during level creation

// cf. worm.c:827 — size_wseg(worm): return byte size of worm segment data (for #stats)
// Returns count_wsegs(worm) * sizeof(wseg). JS equivalent would return segment count.
// TODO: worm.c:827 — size_wseg(): segment memory accounting

// cf. worm.c:836 — count_wsegs(mtmp): return number of visible tail segments
// Counts from wtails[wormno]->nseg (skipping the hidden co-located head segment).
// TODO: worm.c:836 — count_wsegs(): count worm body segments

// cf. worm.c:852 [static] — create_worm_tail(num_segs): allocate a chain of (num_segs+1) wseg structs
// Returns null if num_segs==0. Head of the chain becomes wtails, end becomes wheads.
// TODO: worm.c:852 — create_worm_tail(): initial segment chain allocation

// cf. worm.c:883 — worm_known(worm): is any segment within the hero's field of view?
// Iterates all segments (including head segment) checking cansee(wx,wy).
// Used in canseemon() macro.
// TODO: worm.c:883 — worm_known(): FoV check across all worm segments

// cf. worm.c:898 — worm_cross(x1, y1, x2, y2): would diagonal move pass between two consecutive worm segs?
// Returns true if <x1,y2> and <x2,y1> both contain the same worm with consecutive segments.
// Called from test_move() to prevent squeezing through a worm's body.
// TODO: worm.c:898 — worm_cross(): diagonal crossing check for worm body

// cf. worm.c:946 — wseg_at(worm, x, y): return index of segment at (x,y) from the tail
// Used for display ordering. Returns 0 if not a worm segment.
// TODO: worm.c:946 — wseg_at(): segment index for display

// cf. worm.c:968 — flip_worm_segs_vertical(worm, miny, maxy): mirror segment y-coords
// Applies wy = maxy - wy + miny to all segments (used for level flipping).
// TODO: worm.c:968 — flip_worm_segs_vertical(): y-axis flip for all segments

// cf. worm.c:979 — flip_worm_segs_horizontal(worm, minx, maxx): mirror segment x-coords
// Applies wx = maxx - wx + minx to all segments (used for level flipping).
// TODO: worm.c:979 — flip_worm_segs_horizontal(): x-axis flip for all segments

// cf. worm.c:990 — redraw_worm(worm): call newsym() on every segment including head
// Differs from see_wsegs() in that it includes the dummy head segment.
// TODO: worm.c:990 — redraw_worm(): full worm redraw including head segment
