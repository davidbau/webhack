// pline.js -- Message output: pline, You, Your, verbalize, gamelog, livelog
// cf. pline.c — pline, pline_dir, pline_xy, pline_mon, vpline, custompline,
//               urgent_pline, Norep, You, Your, You_feel, You_cant, pline_The,
//               There, You_hear, You_see, verbalize, putmesg, set_msg_dir,
//               set_msg_xy, You_buf, free_youbuf, dumplogmsg, dumplogfreemessages,
//               gamelog_add, livelog_printf, raw_printf, vraw_printf,
//               impossible, execplinehandler, nhassert_failed
//
// pline.c is the message output subsystem. All game messages route through
// pline() → vpline() → putmesg() → window port's putstr().
//
// Key functions:
//   pline(fmt, ...): primary message printer (printf-style)
//   vpline(fmt, va_list): core formatter; handles history, truncation, no-repeat
//   You/Your/You_feel/You_cant/There/pline_The: convenience wrappers with prefixes
//   You_hear/You_see: sensory messages respecting deafness/blindness
//   verbalize(fmt, ...): dialog in double-quotes
//   impossible(fmt, ...): error message for impossible game states
//   gamelog_add/livelog_printf: chronicle and live game logging
//   dumplogmsg/dumplogfreemessages: message history for endgame dump
//
// JS implementations: message output is handled by display.js (putstr_message)
//   and nethack.js. Most pline.c functions are replaced by display output.
//   pline() → display.putstr_message() (PARTIAL — no history, no pflags)
//   impossible() → console.error (PARTIAL)
//   livelog → not implemented in JS

// cf. pline.c:22 — dumplogmsg(line): store message in circular history buffer
// Keeps last N messages for endgame dump display.
// TODO: pline.c:22 — dumplogmsg(): endgame message history storage

// cf. pline.c:52 — dumplogfreemessages(): free message history buffers
// Frees all saved message history during save/endgame.
// TODO: pline.c:52 — dumplogfreemessages(): message history cleanup

// cf. pline.c:65 — putmesg(line): internal message output wrapper
// Outputs to window with optional urgent/suppress-history attributes.
// JS equiv: display.putstr_message() — partial equivalent.
// PARTIAL: pline.c:65 — putmesg() ↔ display.putstr_message()

// cf. pline.c:84 — set_msg_dir(dir): set accessibility location by direction
// Sets source direction for next message (for accessibility tools).
// TODO: pline.c:84 — set_msg_dir(): message direction hint

// cf. pline.c:93 — set_msg_xy(x, y): set accessibility location by coordinates
// Sets source position for next message.
// TODO: pline.c:93 — set_msg_xy(): message position hint

// cf. pline.c:104 — pline(line, ...): primary message printer
// Printf-style formatting; calls vpline().
// JS equiv: display.putstr_message() — partial equivalent.
// PARTIAL: pline.c:104 — pline() ↔ display.putstr_message()

// cf. pline.c:114 — pline_dir(dir, line, ...): message with direction location
// Like pline but with accessibility direction hint.
// TODO: pline.c:114 — pline_dir(): directed message

// cf. pline.c:126 — pline_xy(x, y, line, ...): message with coordinate location
// Like pline but with accessibility coordinate hint.
// TODO: pline.c:126 — pline_xy(): positioned message

// cf. pline.c:138 — pline_mon(mtmp, line, ...): message positioned at monster
// Like pline but with accessibility location set to monster position.
// TODO: pline.c:138 — pline_mon(): monster-positioned message

// cf. pline.c:153 — vpline(line, the_args): core message formatting and processing
// Formats printf-style message; applies truncation; handles no-repeat flag;
//   calls putmesg(); adds to message history; calls execplinehandler if set.
// TODO: pline.c:153 — vpline(): core message processor

// cf. pline.c:299 — custompline(pflags, line, ...): message with type override flags
// Like pline but with pflags (PLINE_URGENT, PLINE_NOMORE, etc.) override.
// TODO: pline.c:299 — custompline(): flagged message output

// cf. pline.c:315 — urgent_pline(line, ...): urgent message overriding suppression
// Forces message even if messages are being suppressed.
// TODO: pline.c:315 — urgent_pline(): forced urgent message

// cf. pline.c:327 — Norep(line, ...): message with no-repeat flag
// Suppresses output if identical to previous message.
// TODO: pline.c:327 — Norep(): no-repeat message

// cf. pline.c:339 — You_buf(siz): allocate "You" message buffer
// Returns buffer for formatting "You <verb>" messages.
// TODO: pline.c:339 — You_buf(): You message buffer

// cf. pline.c:351 — free_youbuf(): release You message buffer
// Frees the You message buffer.
// TODO: pline.c:351 — free_youbuf(): You buffer release

// cf. pline.c:366 — You(line, ...): message prefixed with "You "
// Prints "You <message>".
// TODO: pline.c:366 — You(): You-prefixed message

// cf. pline.c:377 — Your(line, ...): message prefixed with "Your "
// Prints "Your <message>".
// TODO: pline.c:377 — Your(): Your-prefixed message

// cf. pline.c:388 — You_feel(line, ...): "You feel..." with dream variant
// Prints "You feel <message>" or "You dream that you feel..." if unaware.
// TODO: pline.c:388 — You_feel(): You-feel message with dream variant

// cf. pline.c:403 — You_cant(line, ...): "You can't " prefix
// Prints "You can't <message>".
// TODO: pline.c:403 — You_cant(): You-cant message

// cf. pline.c:414 — pline_The(line, ...): "The " prefix
// Prints "The <message>".
// TODO: pline.c:414 — pline_The(): The-prefixed message

// cf. pline.c:425 — There(line, ...): "There " prefix
// Prints "There <message>".
// TODO: pline.c:425 — There(): There-prefixed message

// cf. pline.c:436 — You_hear(line, ...): auditory message
// Prints "You hear <message>"; respects deafness (deaf: no output).
//   Underwater: modifies message for muffled sound.
// TODO: pline.c:436 — You_hear(): auditory sense message

// cf. pline.c:455 — You_see(line, ...): visual message
// Prints "You see <message>"; respects blindness.
// TODO: pline.c:455 — You_see(): visual sense message

// cf. pline.c:476 — verbalize(line, ...): dialog in double-quotes
// Prints "<message>" with quotation marks; respects deafness.
// TODO: pline.c:476 — verbalize(): NPC/deity speech output

// cf. pline.c:495 — gamelog_add(glflags, gltime, str): add to chronicle
// Adds entry to the game event chronicle (for structured game log).
// TODO: pline.c:495 — gamelog_add(): game chronicle entry

// cf. pline.c:514 — livelog_printf(ll_type, line, ...): live game log
// Writes timestamped entry to live game log for tournament/spectating.
// TODO: pline.c:514 — livelog_printf(): live tournament logging

// cf. pline.c:549 — raw_printf(line, ...): raw unformatted message
// Prints directly without message history or pflags processing.
// TODO: pline.c:549 — raw_printf(): direct raw message

// cf. pline.c:563 — vraw_printf(line, the_args): core raw printer
// Printf-format without history processing; used for errors and startup.
// TODO: pline.c:563 — vraw_printf(): core raw message

// cf. pline.c:584 — impossible(s, ...): impossible game state error
// Prints debug error; optionally panics in debug builds.
// JS equiv: console.error (PARTIAL — no game-state display).
// PARTIAL: pline.c:584 — impossible() ↔ console.error

// cf. pline.c:641 — execplinehandler(line): external message handler
// Executes external program with message if pline_handler is configured.
// N/A: pline.c:641 — execplinehandler() (no external process support)

// cf. pline.c:690 — nhassert_failed(expression, filepath, line): assertion failure
// Handles failed assertion with error message; may call impossible().
// TODO: pline.c:690 — nhassert_failed(): assertion failure handler
