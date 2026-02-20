// rip.js -- RIP/tombstone screen display
// cf. rip.c — genl_outrip(): render ASCII tombstone for game-over screen
//
// The tombstone art template (rip_txt[]) uses a 16-char-wide face between
// | markers. Lines:
//   NAME_LINE  6 — player name (up to 16 chars, centered)
//   GOLD_LINE  7 — gold amount ("NNN Au", centered)
//   DEATH_LINE 8..11 — death description word-wrapped to 16 chars/line
//   YEAR_LINE 12 — year of death (4-digit, centered)
// center() [static] writes text centered at column STONE_LINE_CENT (28).
//
// JS implementation: display.renderTombstone() at display.js:1135 is fully
//   implemented and matches the C logic (rip_txt template, center(), word-wrap
//   of death description). Called from nethack.js:1835 (done() path).
//   tombstone option flag stored in flags.tombstone (storage.js:556,597).
//   formatkiller() for death description is TODO in topten.js:13.

// cf. rip.c:75 [static] — center(line, text): center text on tombstone face
// Writes text into gr.rip[line] starting at STONE_LINE_CENT - (len+1)/2.
// JS equivalent: centerOnStone() local function inside display.renderTombstone()
//   at display.js:1153. Implemented.
// N/A as standalone: inlined into renderTombstone().

// cf. rip.c:85 — genl_outrip(tmpwin, how, when): render tombstone to a window
// Allocates copy of rip_txt[]; calls center() for name, gold, word-wrapped death
//   lines (splitting at spaces within STONE_LINE_LEN=16), and year;
//   writes all lines via putstr(tmpwin). Frees allocation after display.
// how: death method (passed to formatkiller()); when: timestamp for year extraction.
// JS equivalent: display.renderTombstone(name, gold, deathLines, year) at display.js:1135.
//   Fully implemented; caller in nethack.js:1835 handles word-wrap and year extraction.
//   Notable difference: JS receives pre-split deathLines array rather than calling
//   formatkiller() (JS formatkiller() is TODO in topten.js:13).
// ALIGNED: rip.c:85 — genl_outrip() ↔ display.renderTombstone() (display.js:1135)
