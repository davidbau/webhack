/**
 * themerms - NetHack themed room library
 * Converted from: themerms.lua
 *
 * This is a LIBRARY module (not a level generator).
 * Exports theme room definitions and callback functions used by dungeon.js
 *
 * GLOBALS EXPECTED AT RUNTIME (provided by dungeon.js execution context):
 * - align: Array of alignment strings (shuffled at level generation)
 * - nh: NetHack game state interface (nh.level_difficulty, nh.rn2, etc.)
 * - pline: Print line function for debug messages
 * - obj: Object creation interface (obj.new)
 */

import * as des from '../sp_lev.js';
import { selection, percent, shuffle, levelState, nh as nhGlobal } from '../sp_lev.js';
import { rn2, rnd, d, getRngLog } from '../rng.js';
import { setMtInitialized } from '../dungeon.js';

// Module-level state for postprocessing callbacks
let postprocess = [];

// Module-level depth tracking (set by themerooms_generate)
let _levelDepth = 1;

// NetHack global functions (Lua nh.* replacements)
// Use the global nh from sp_lev.js, but override level_difficulty to use our local depth tracking
// Note: Use getter to avoid circular dependency issues at module load time
const nh = {
    get debug_themerm() { return nhGlobal.debug_themerm; },
    level_difficulty: () => _levelDepth,
    rn2: (n) => rn2(n),
    start_timer_at: (x, y, type, time) => { /* TODO: implement timer system */ },
    impossible: (msg) => { console.warn('[themerms impossible]:', msg); },
};

// Stub other globals
const align = ["lawful", "neutral", "chaotic"]; // Will be shuffled by caller
const pline = (msg) => { console.log('[themerms]:', msg); };
const obj = {
    new: (id) => { return { class: () => ({ material: "unknown" }) }; } // Stub
};

// Reset state between level generations
export function reset_state() {
    postprocess = [];
    _initialized = false;
    themeroom_failed = false;
    // CRITICAL: Reset debug mode flags between levels
    debug_rm_idx = null;
    debug_fill_idx = null;
}

// Themeroom failure flag (set when room creation fails in themed rooms)
// C ref: mklev.c themeroom_failed global
let themeroom_failed = false;

export function set_themeroom_failed() {
    themeroom_failed = true;
}

export function get_themeroom_failed() {
    return themeroom_failed;
}

// themeroom_fills: Contents that can fill any room shape
// Each entry defines "name", optional "frequency"/"mindiff"/"maxdiff"/"eligible", and "contents" function
export const themeroom_fills = [

   {
      name: "Ice room",
      contents: function(rm) {
         const ice = selection.room();
         des.terrain(ice, "I");
         if (percent(25)) {
            const mintime = 1000 - (nh.level_difficulty() * 100);
            const ice_melter = function(x,y) {
               nh.start_timer_at(x,y, "melt-ice", mintime + nh.rn2(1000));
            };
            ice.iterate(ice_melter);
         }
      },
   },

   {
      name: "Cloud room",
      contents: function(rm) {
         const fog = selection.room();
         for (let i = 1; i <= (fog.numpoints() / 4); i++) {
            des.monster({ id: "fog cloud", asleep: true });
         }
         des.gas_cloud({ selection: fog });
      },
   },

   {
      name: "Boulder room",
      mindiff: 4,
      contents: function(rm) {
         const locs = selection.room().percentage(30);
         const func = function(x,y) {
            if (percent(50)) {
               des.object("boulder", x, y);
            } else {
               des.trap("rolling boulder", x, y);
            }
         };
         locs.iterate(func);
      },
   },

   {
      name: "Spider nest",
      contents: function(rm) {
         const spooders = nh.level_difficulty() > 8;
         const locs = selection.room().percentage(30);
         const func = function(x,y) {
            des.trap({ type: "web", x: x, y: y,
                       spider_on_web: spooders && percent(80) });
         };
         locs.iterate(func);
      },
   },

   {
      name: "Trap room",
      contents: function(rm) {
         const traps = [ "arrow", "dart", "falling rock", "bear",
                        "land mine", "sleep gas", "rust",
                        "anti magic" ];
         shuffle(traps);
         const locs = selection.room().percentage(30);
         const func = function(x,y) {
            des.trap(traps[0], x, y);
         };
         locs.iterate(func);
      },
   },

   {
      name: "Garden",
      eligible: function(rm) { return rm.lit === true; },
      contents: function(rm) {
         const s = selection.room();
         const npts = (s.numpoints() / 6);
         for (let i = 1; i <= npts; i++) {
            des.monster({ id: "wood nymph", asleep: true });
            if (percent(30)) {
               des.feature("fountain");
            }
         }
         postprocess.push({ handler: make_garden_walls,
                            data: { sel: selection.room() } });
      }
   },

   {
      name: "Buried treasure",
      contents: function(rm) {
         des.object({ id: "chest", buried: true, contents: function(otmp) {
            const xobj = otmp.totable();
            // keep track of the last buried treasure
            if (xobj.NO_OBJ === undefined) {
               postprocess.push({ handler: make_dig_engraving,
                                 data: { x: xobj.ox, y: xobj.oy }});
            }
            for (let i = 1; i <= d(3,4); i++) {
               des.object();
            }
         } });
      },
   },

   {
      name: "Buried zombies",
      contents: function(rm) {
         const diff = nh.level_difficulty()
         // start with [1..4] for low difficulty
         const zombifiable = [ "kobold", "gnome", "orc", "dwarf" ];
         if (diff > 3) {          // medium difficulty
            zombifiable[4] = "elf";
            zombifiable[5] = "human";
            if (diff > 6) {       // high difficulty (relatively speaking)
               zombifiable[6] = "ettin";
               zombifiable[7] = "giant";
            }
         }
         for (let i = 1; i <= (rm.width * rm.height) / 2; i++) {
            shuffle(zombifiable);
            const o = des.object({ id: "corpse", montype: zombifiable[0],
                                 buried: true });
            o.stop_timer("rot-corpse");
            o.start_timer("zombify-mon", rn2(21) + 990);
         }
      },
   },

   {
      name: "Massacre",
      contents: function(rm) {
         const mon = [ "apprentice", "warrior", "ninja", "thug",
                     "hunter", "acolyte", "abbot", "page",
                     "attendant", "neanderthal", "chieftain",
                     "student", "wizard", "valkyrie", "tourist",
                     "samurai", "rogue", "ranger", "priestess",
                     "priest", "monk", "knight", "healer",
                     "cavewoman", "caveman", "barbarian",
                     "archeologist" ];
         let idx = rn2(mon.length);
         for (let i = 1; i <= d(5,5); i++) {
            if (percent(10)) { idx = rn2(mon.length); }
            des.object({ id: "corpse", montype: mon[idx] });
         }
      },
   },

   {
      name: "Statuary",
      contents: function(rm) {
         for (let i = 1; i <= d(5,5); i++) {
            des.object({ id: "statue" });
         }
         for (let i = 1; i <= rnd(3); i++) {
            des.trap("statue");
         }
      },
   },


   {
      name: "Light source",
      eligible: function(rm) { return rm.lit === false; },
      contents: function(rm) {
         des.object({ id: "oil lamp", lit: true });
      }
   },

   {
      name: "Temple of the gods",
      contents: function(rm) {
         des.altar({ align: align[0] });
         des.altar({ align: align[1] });
         des.altar({ align: align[2] });
      },
   },

   {
      name: "Ghost of an Adventurer",
      contents: function(rm) {
         const loc = selection.room().rndcoord(0);
         des.monster({ id: "ghost", asleep: true, waiting: true,
                       coord: loc });
         if (percent(65)) {
            des.object({ id: "dagger", coord: loc, buc: "not-blessed" });
         }
         if (percent(55)) {
            des.object({ class: ")", coord: loc, buc: "not-blessed" });
         }
         if (percent(45)) {
            des.object({ id: "bow", coord: loc, buc: "not-blessed" });
            des.object({ id: "arrow", coord: loc, buc: "not-blessed" });
         }
         if (percent(65)) {
            des.object({ class: "[", coord: loc, buc: "not-blessed" });
         }
         if (percent(20)) {
            des.object({ class: "=", coord: loc, buc: "not-blessed" });
         }
         if (percent(20)) {
            des.object({ class: "?", coord: loc, buc: "not-blessed" });
         }
      },
   },

   {
      name: "Storeroom",
      contents: function(rm) {
         const locs = selection.room().percentage(30);
         const func = function(x,y) {
            if (percent(25)) {
               des.object("chest");
            } else {
               des.monster({ class: "m", appear_as: "obj:chest" });
            }
         };
         locs.iterate(func);
      },
   },

   {
      name: "Teleportation hub",
      contents: function(rm) {
         const locs = selection.room().filter_mapchar(".");
         for (let i = 1; i <= 2 + rn2(3); i++) {
            const pos = locs.rndcoord(1);
            if (pos.x > 0) {
               pos.x = pos.x + rm.region.x1 - 1;
               pos.y = pos.y + rm.region.y1;
               postprocess.push({ handler: make_a_trap,
                                  data: { type: "teleport", seen: true,
                                          coord: pos, teledest: 1 } });
            }
         }
      },
   },

]; // End themeroom_fills

// themerooms: Complete room definitions (shape + contents)
// Each entry defines "name", optional "frequency"/"mindiff"/"maxdiff"/"eligible", and "contents" function
export const themerooms = [
   {
      name: "default",
      frequency: 1000,
      contents: function() {
         des.room({ type: "ordinary", filled: 1 });
      }
   },

   {
      name: "Fake Delphi",
      contents: function() {
         des.room({ type: "ordinary", w: 11, h: 9, filled: 1,
                  contents: function() {
                     des.room({ type: "ordinary", x: 4, y: 3, w: 3, h: 3,
                                filled: 1,
                                contents: function() {
                                   des.door({ state: "random", wall: "all" });
                                }
                     });
                  }
         });
      },
   },

   {
      name: "Room in a room",
      contents: function() {
         des.room({ type: "ordinary", filled: 1,
                  contents: function() {
                     des.room({ type: "ordinary",
                                contents: function() {
                                   des.door({ state: "random", wall: "all" });
                                }
                     });
                  }
         });
      },
   },

   {
      name: "Huge room with another room inside",
      contents: function() {
         des.room({ type: "ordinary", w: rn2(10)+11, h: rn2(5)+8,
                    filled: 1,
            contents: function() {
               if (percent(90)) {
                  des.room({ type: "ordinary", filled: 1,
                             contents: function() {
                                des.door({ state: "random", wall: "all" });
                                   if (percent(50)) {
                                      des.door({ state: "random", wall: "all" });
                                   }
                              }
                  });
               }
            }
         });
      },
   },

   {
      name: "Nesting rooms",
      contents: function() {
         des.room({ type: "ordinary", w: 9 + rn2(4), h: 9 + rn2(4),
                    filled: 1,
            contents: function(rm) {
               // Lua: math.random(floor(rm.width/2), rm.width-2) -> rn2(range)+min
               const minWid = Math.floor(rm.width / 2);
               const maxWid = rm.width - 2;
               const wid = rn2(maxWid - minWid + 1) + minWid;
               const minHei = Math.floor(rm.height / 2);
               const maxHei = rm.height - 2;
               const hei = rn2(maxHei - minHei + 1) + minHei;
               des.room({ type: "ordinary", w: wid, h: hei, filled: 1,
                  contents: function() {
                     if (percent(90)) {
                        des.room({ type: "ordinary", filled: 1,
                           contents: function() {
                              des.door({ state: "random", wall: "all" });
                              if (percent(15)) {
                                 des.door({ state: "random", wall: "all" });
                              }
                           }
                        });
                     }
                     des.door({ state: "random", wall: "all" });
                     if (percent(15)) {
                        des.door({ state: "random", wall: "all" });
                     }
                  }
               });
            }
         });
      },
   },

   {
      name: "Default room with themed fill",
      frequency: 6,
      contents: function() {
         des.room({ type: "themed", contents: themeroom_fill });
      }
   },

   {
      name: "Unlit room with themed fill",
      frequency: 2,
      contents: function() {
         des.room({ type: "themed", lit: 0, contents: themeroom_fill });
      }
   },

   {
      name: "Room with both normal contents and themed fill",
      frequency: 2,
      contents: function() {
         des.room({ type: "themed", filled: 1, contents: themeroom_fill });
      }
   },

   {
      name: 'Pillars',
      contents: function() {
         const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_THEMEROOMS === '1';
         if (DEBUG) console.log('Pillars: outer contents() called, about to call des.room()');
         des.room({ type: "themed", w: 10, h: 10,
                  contents: function(rm) {
                     if (DEBUG) console.log(`Pillars: inner contents() called for room at (${rm.lx},${rm.ly}), about to shuffle`);
                     const terr = [ "-", "-", "-", "-", "L", "P", "T" ];
                     shuffle(terr);
                     if (DEBUG) console.log('Pillars: shuffle complete, terr=', terr);
                     for (let x = 0; x < (rm.width / 4); x++) {
                        for (let y = 0; y < (rm.height / 4); y++) {
                           des.terrain({ x: x * 4 + 2, y: y * 4 + 2, typ: terr[0], lit: -2 });
                           des.terrain({ x: x * 4 + 3, y: y * 4 + 2, typ: terr[0], lit: -2 });
                           des.terrain({ x: x * 4 + 2, y: y * 4 + 3, typ: terr[0], lit: -2 });
                           des.terrain({ x: x * 4 + 3, y: y * 4 + 3, typ: terr[0], lit: -2 });
                        }
                     }
                  }
         });
         if (DEBUG) console.log('Pillars: outer contents() returning');
      },
   },

   {
      name: 'Mausoleum',
      contents: function() {
         des.room({ type: "themed", w: 5 + rn2(3)*2, h: 5 + rn2(3)*2,
                  contents: function(rm) {
                     des.room({ type: "themed",
                                 x: Math.floor((rm.width - 1) / 2), y: Math.floor((rm.height - 1) / 2),
                                 w: 1, h: 1, joined: false,
                                 contents: function() {
                                    if (percent(50)) {
                                       const mons = [ "M", "V", "L", "Z" ];
                                       shuffle(mons);
                                       des.monster({ class: mons[0], x: 0, y: 0, waiting: 1 });
                                    } else {
                                       des.object({ id: "corpse", montype: "@", coord: [0, 0] });
                                    }
                                    if (percent(20)) {
                                       des.door({ state: "secret", wall: "all" });
                                    }
                                 }
                     });
                  }
         });
      },
   },

   {
      name: 'Random dungeon feature in the middle of an odd-sized room',
      contents: function() {
         const wid = 3 + (rn2(3) * 2);
         const hei = 3 + (rn2(3) * 2);
         des.room({ type: "ordinary", filled: 1, w: wid, h: hei,
                  contents: function(rm) {
                     const feature = [ "C", "L", "I", "P", "T" ];
                     shuffle(feature);
                     des.terrain(Math.floor((rm.width - 1) / 2), Math.floor((rm.height - 1) / 2),
                                 feature[0]);
                  }
         });
      },
   },

   {
      name: 'L-shaped',
      contents: function() {
         des.map({ map: `-----xxx
|...|xxx
|...|xxx
|...----
|......|
|......|
|......|
--------`, contents: function(m) { filler_region(1, 1); } });
      },
   },

   {
      name: 'L-shaped, rot 1',
      contents: function() {
         des.map({ map: `xxx-----
xxx|...|
xxx|...|
----...|
|......|
|......|
|......|
--------`, contents: function(m) { filler_region(5, 1); } });
      },
   },

   {
      name: 'L-shaped, rot 2',
      contents: function() {
         des.map({ map: `--------
|......|
|......|
|......|
----...|
xxx|...|
xxx|...|
xxx-----`, contents: function(m) { filler_region(1, 1); } });
      },
   },

   {
      name: 'L-shaped, rot 3',
      contents: function() {
         des.map({ map: `--------
|......|
|......|
|......|
|...----
|...|xxx
|...|xxx
-----xxx`, contents: function(m) { filler_region(1, 1); } });
      },
   },

   {
      name: 'Blocked center',
      contents: function() {
         des.map({ map: `-----------
|.........|
|.........|
|.........|
|...LLL...|
|...LLL...|
|...LLL...|
|.........|
|.........|
|.........|
-----------`, contents: function(m) {
            if (percent(30)) {
               const terr = [ "-", "P" ];
               shuffle(terr);
               des.replace_terrain({ region: [1, 1, 9, 9],
                                     fromterrain: "L",
                                     toterrain: terr[0] });
            }
            filler_region(1, 1);
         } });
      },
   },

   {
      name: 'Circular, small',
      contents: function() {
         des.map({ map: `xx---xx
x--.--x
--...--
|.....|
--...--
x--.--x
xx---xx`, contents: function(m) { filler_region(3, 3); } });
      },
   },

   {
      name: 'Circular, medium',
      contents: function() {
         des.map({ map: `xx-----xx
x--...--x
--.....--
|.......|
|.......|
|.......|
--.....--
x--...--x
xx-----xx`, contents: function(m) { filler_region(4, 4); } });
      },
   },

   {
      name: 'Circular, big',
      contents: function() {
         des.map({ map: `xxx-----xxx
x---...---x
x-.......-x
--.......--
|.........|
|.........|
|.........|
--.......--
x-.......-x
x---...---x
xxx-----xxx`, contents: function(m) { filler_region(5, 5); } });
      },
   },

   {
      name: 'T-shaped',
      contents: function() {
         des.map({ map: `xxx-----xxx
xxx|...|xxx
xxx|...|xxx
----...----
|.........|
|.........|
|.........|
-----------`, contents: function(m) { filler_region(5, 5); } });
      },
   },

   {
      name: 'T-shaped, rot 1',
      contents: function() {
         des.map({ map: `-----xxx
|...|xxx
|...|xxx
|...----
|......|
|......|
|......|
|...----
|...|xxx
|...|xxx
-----xxx`, contents: function(m) { filler_region(2, 2); } });
      },
   },

   {
      name: 'T-shaped, rot 2',
      contents: function() {
         des.map({ map: `-----------
|.........|
|.........|
|.........|
----...----
xxx|...|xxx
xxx|...|xxx
xxx-----xxx`, contents: function(m) { filler_region(2, 2); } });
      },
   },

   {
      name: 'T-shaped, rot 3',
      contents: function() {
         des.map({ map: `xxx-----
xxx|...|
xxx|...|
----...|
|......|
|......|
|......|
----...|
xxx|...|
xxx|...|
xxx-----`, contents: function(m) { filler_region(5, 5); } });
      },
   },

   {
      name: 'S-shaped',
      contents: function() {
         des.map({ map: `-----xxx
|...|xxx
|...|xxx
|...----
|......|
|......|
|......|
----...|
xxx|...|
xxx|...|
xxx-----`, contents: function(m) { filler_region(2, 2); } });
      },
   },

   {
      name: 'S-shaped, rot 1',
      contents: function() {
         des.map({ map: `xxx--------
xxx|......|
xxx|......|
----......|
|......----
|......|xxx
|......|xxx
--------xxx`, contents: function(m) { filler_region(5, 5); } });
      },
   },

   {
      name: 'Z-shaped',
      contents: function() {
         des.map({ map: `xxx-----
xxx|...|
xxx|...|
----...|
|......|
|......|
|......|
|...----
|...|xxx
|...|xxx
-----xxx`, contents: function(m) { filler_region(5, 5); } });
      },
   },

   {
      name: 'Z-shaped, rot 1',
      contents: function() {
         des.map({ map: `--------xxx
|......|xxx
|......|xxx
|......----
----......|
xxx|......|
xxx|......|
xxx--------`, contents: function(m) { filler_region(2, 2); } });
      },
   },

   {
      name: 'Cross',
      contents: function() {
         des.map({ map: `xxx-----xxx
xxx|...|xxx
xxx|...|xxx
----...----
|.........|
|.........|
|.........|
----...----
xxx|...|xxx
xxx|...|xxx
xxx-----xxx`, contents: function(m) { filler_region(6, 6); } });
      },
   },

   {
      name: 'Four-leaf clover',
      contents: function() {
         des.map({ map: `-----x-----
|...|x|...|
|...---...|
|.........|
---.....---
xx|.....|xx
---.....---
|.........|
|...---...|
|...|x|...|
-----x-----`, contents: function(m) { filler_region(6, 6); } });
      },
   },

   {
      name: 'Water-surrounded vault',
      contents: function() {
         des.map({ map: `}}}}}}
}----}
}|..|}
}|..|}
}----}
}}}}}}`, contents: function(m) {
            des.region({ region: [3, 3, 3, 3], type: "themed", irregular: true,
                         filled: 0, joined: false });
            const nasty_undead = [ "giant zombie", "ettin zombie", "vampire lord" ];
            const chest_spots = [ [ 2, 2 ], [ 3, 2 ], [ 2, 3 ], [ 3, 3 ] ];

            shuffle(chest_spots)
            // Guarantee an escape item inside one of the chests, to prevent
            // the hero falling in from above and becoming permanently stuck
            // [cf. generate_way_out_method(sp_lev.c)].
            // If the escape item is made of glass or crystal, make sure that
            // the chest isn't locked so that kicking it to gain access to its
            // contents won't be necessary; otherwise retain lock state from
            // random creation.
            // "pick-axe", "dwarvish mattock" could be included in the list of
            // escape items but don't normally generate in containers.
            const escape_items = [
               "scroll of teleportation", "ring of teleportation",
               "wand of teleportation", "wand of digging"
            ];
            const itm = obj.new(escape_items[rn2(escape_items.length)]);
            const itmcls = itm.class()
            let box;
            if (itmcls[ "material" ] === "glass") {
                  // explicitly force chest to be unlocked
                  box = des.object({ id: "chest", coord: chest_spots[0],
                                    olocked: "no" });
            } else {
                  // accept random locked/unlocked state
                  box = des.object({ id: "chest", coord: chest_spots[0] });
            }
            box.addcontent(itm);

            for (let i = 1; i < chest_spots.length; i++) {
                  des.object({ id: "chest", coord: chest_spots[i] });
            }

            shuffle(nasty_undead);
            des.monster(nasty_undead[0], 2, 2);
            des.exclusion({ type: "teleport", region: [ 2, 2, 3, 3 ] });
         } });
      },
   },

   {
      name: 'Twin businesses',
      mindiff: 4, // arbitrary
      contents: function() {
         // Due to the way room connections work in mklev.c, we must guarantee
         // that the "aisle" between the shops touches all four walls of the
         // larger room. Thus it has an extra width and height.
         des.room({ type: "themed", w: 9, h: 5, contents: function() {
               // There are eight possible placements of the two shops, four of
               // which have the vertical aisle in the center.
               const southeast = function() { return percent(50) ? "south" : "east"; }
               const northeast = function() { return percent(50) ? "north" : "east"; }
               const northwest = function() { return percent(50) ? "north" : "west"; }
               const southwest = function() { return percent(50) ? "south" : "west"; }
               const placements = [
                  { lx: 1, ly: 1, rx: 4, ry: 1, lwall: "south", rwall: southeast() },
                  { lx: 1, ly: 2, rx: 4, ry: 2, lwall: "north", rwall: northeast() },
                  { lx: 1, ly: 1, rx: 5, ry: 1, lwall: southeast(), rwall: southwest() },
                  { lx: 1, ly: 1, rx: 5, ry: 2, lwall: southeast(), rwall: northwest() },
                  { lx: 1, ly: 2, rx: 5, ry: 1, lwall: northeast(), rwall: southwest() },
                  { lx: 1, ly: 2, rx: 5, ry: 2, lwall: northeast(), rwall: northwest() },
                  { lx: 2, ly: 1, rx: 5, ry: 1, lwall: southwest(), rwall: "south" },
                  { lx: 2, ly: 2, rx: 5, ry: 2, lwall: northwest(), rwall: "north" }
               ];
               let ltype = "weapon shop", rtype = "armor shop";
               if (percent(50)) {
                  [ltype, rtype] = [rtype, ltype];
               }
               const shopdoorstate = function() {
                  if (percent(1)) {
                     return "locked";
                  } else if (percent(50)) {
                     return "closed";
                  } else {
                     return "open";
                  }
               }
               const p = placements[rnd(placements.length) - 1];
               des.room({ type: ltype, x: p["lx"], y: p["ly"], w: 3, h: 3, filled: 1, joined: false,
                           contents: function() {
                     des.door({ state: shopdoorstate(), wall: p["lwall"] })
                  }
               });
               des.room({ type: rtype, x: p["rx"], y: p["ry"], w: 3, h: 3, filled: 1, joined: false,
                           contents: function() {
                     des.door({ state: shopdoorstate(), wall: p["rwall"] })
                  }
               });
            }
         });
      }
   },

]; // End themerooms

// Store these at module scope, they will be reinitialized in pre_themerooms_generate
let debug_rm_idx = null;
let debug_fill_idx = null;

// Track whether themerms has been initialized for current level
let _initialized = false;

// Given a point in a themed room, ensure that themed room is stocked with
// regular room contents.
// With 30% chance, also give it a random themed fill.
function filler_region(x, y) {
   let rmtyp = "ordinary";
   let func = null;
   if (percent(30)) {
      rmtyp = "themed";
      func = themeroom_fill;
   }
   des.region({ region: [x, y, x, y], type: rmtyp, irregular: true, filled: 1, contents: func });
}

function is_eligible(room, mkrm) {
   const t = typeof room;
   const diff = nh.level_difficulty();
   if (room.mindiff !== undefined && diff < room.mindiff) {
      return false;
   } else if (room.maxdiff !== undefined && diff > room.maxdiff) {
      return false;
   }
   if (mkrm !== undefined && room.eligible !== undefined) {
      return room.eligible(mkrm);
   }
   return true;
}

// given the name of a themed room or fill, return its index in that array
function lookup_by_name(name, checkfills) {
   if (name === undefined || name === null) {
      return null;
   }
   if (checkfills) {
      for (let i = 0; i < themeroom_fills.length; i++) {
         if (themeroom_fills[i].name === name) {
            return i;
         }
      }
   } else {
      for (let i = 0; i < themerooms.length; i++) {
         if (themerooms[i].name === name) {
            return i;
         }
      }
   }
   return null;
}

// called repeatedly until the core decides there are enough rooms
export function themerooms_generate(map, depth) {
   _levelDepth = depth; // Update module-level depth for nh.level_difficulty()

   // C ref: mklev.c:404 — reset failure flag before calling Lua themerooms_generate
   themeroom_failed = false;

   // First-time initialization for this level: shuffle align and init Lua MT RNG
   if (!_initialized) {
      pre_themerooms_generate();
      _initialized = true;
   }

   if (debug_rm_idx !== null) {
      // room may not be suitable for stairs/portals, so create the "default"
      // room half of the time
      // (if the user specified BOTH a room and a fill, presumably they are
      // interested in what happens when that room gets that fill, so don't
      // bother generating default-with-fill rooms as happens below)
      let actualrm = lookup_by_name("default", false);
      if (percent(50)) {
         if (is_eligible(themerooms[debug_rm_idx])) {
            actualrm = debug_rm_idx;
         } else {
            pline("Warning: themeroom '" + themerooms[debug_rm_idx].name
                  + "' is ineligible");
         }
      }
      themerooms[actualrm].contents();
      return true;
   } else if (debug_fill_idx !== null) {
      // when a fill is requested but not a room, still create the "default"
      // room half of the time, and "default with themed fill" half of the time
      // (themeroom_fill will take care of guaranteeing the fill in it)
      const actualrm = lookup_by_name(percent(50) ? "Default room with themed fill"
                                                  : "default", false);
      themerooms[actualrm].contents();
      return true;
   }
   let pick = null;
   let total_frequency = 0;
   const themerooms_count = themerooms.length;
   let eligible_count = 0;
   for (let i = 0; i < themerooms.length; i++) {
      if (typeof themerooms[i] !== "object") {
         nh.impossible('themed room ' + i + ' is not a table');
      } else if (is_eligible(themerooms[i], null)) {
         eligible_count++;
         // Reservoir sampling: select one room from the set of eligible rooms,
         // which may change on different levels because of level difficulty.
         let this_frequency;
         if (themerooms[i].frequency !== undefined) {
            this_frequency = themerooms[i].frequency;
         } else {
            this_frequency = 1;
         }
         total_frequency = total_frequency + this_frequency;
         // avoid rn2(0) if a room has freq 0
         if (this_frequency > 0 && rn2(total_frequency) < this_frequency) {
            pick = i;
         }
      }
   }
   if (themerooms_count > 100) {
      console.log(`themerooms_generate: ${themerooms_count} total themerooms, ${eligible_count} eligible`);
   }
   if (pick === null) {
      nh.impossible('no eligible themed rooms?');
      return false;
   }

   const DEBUG_THEME = typeof process !== 'undefined' && process.env.DEBUG_THEMEROOMS === '1';
   if (DEBUG_THEME) {
      console.log(`Selected themed room [${pick}]: "${themerooms[pick].name}"`);
   }

   const rngLog = getRngLog();
   const rngBefore = rngLog ? rngLog.length : 0;

   // Set up failure callback so des.room() can signal when it can't create a room
   // This bridges the sp_lev → themerms communication without circular dependency
   levelState.roomFailureCallback = () => { themeroom_failed = true; };

   try {
      themerooms[pick].contents();
   } finally {
      // Always clear the callback after contents() completes
      levelState.roomFailureCallback = null;
   }

   const rngAfter = rngLog ? getRngLog().length : 0;
   // Disabled: too spammy during investigation
   // if (rngLog && rngAfter - rngBefore > 100) {
   //    console.log(`themerooms[${pick}].contents() consumed ${rngAfter - rngBefore} RNG calls (name: ${themerooms[pick].name})`);
   // }

   // C ref: mklev.c:408 — return failure if theme room creation failed
   // The contents() function calls des.room() which sets themeroom_failed flag on failure
   return !themeroom_failed;
}

// called before any rooms are generated
let _mtInitCount = 0;
export function pre_themerooms_generate() {
   // C ref: MT initialization happens lazily on first Lua RNG call (des.object/des.monster),
   // NOT here in pre_themerooms_generate(). Removing MT init from here to match C timing.
   // Theme selection happens BEFORE MT init in C (calls 260-261 vs 263-292 in seed 4).
   _mtInitCount++;
   console.log(`pre_themerooms_generate called (count=${_mtInitCount})`);

   // NOTE: MT init removed - now handled lazily in sp_lev.js des.object/des.monster

   const debug_themerm = nh.debug_themerm(false);
   const debug_fill = nh.debug_themerm(true);
   let xtrainfo = "";
   debug_rm_idx = lookup_by_name(debug_themerm, false);
   debug_fill_idx = lookup_by_name(debug_fill, true);
   if (debug_themerm !== null && debug_rm_idx === null) {
      if (lookup_by_name(debug_themerm, true) !== null) {
         xtrainfo = "; it is a fill type";
      }
      pline("Warning: themeroom '" + debug_themerm
            + "' not found in themerooms" + xtrainfo, true);
   }
   if (debug_fill !== null && debug_fill_idx === null) {
      if (lookup_by_name(debug_fill, false) !== null) {
         xtrainfo = "; it is a room type";
      }
      pline("Warning: themeroom fill '" + debug_fill
            + "' not found in themeroom_fills" + xtrainfo, true);
   }
}

// called after all rooms have been generated
// but before creating connecting corridors/doors, or filling rooms
export function post_themerooms_generate() {
}

export function themeroom_fill(rm) {
   const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_THEMEROOMS === '1';
   if (DEBUG) {
      console.log(`themeroom_fill() called for room at (${rm.lx},${rm.ly})`);
   }
   if (debug_fill_idx !== null) {
      if (is_eligible(themeroom_fills[debug_fill_idx], rm)) {
         des.setCurrentRoom(rm);
         themeroom_fills[debug_fill_idx].contents(rm);
         des.setCurrentRoom(null);
      } else{
         // ideally this would be a debugpline, not a full pline, and offer
         // some more context on whether it failed because of difficulty or
         // because of eligible function returning false; the warning doesn't
         // necessarily mean anything.
         pline("Warning: fill '" + themeroom_fills[debug_fill_idx].name
               + "' is not eligible in room that generated it");
      }
      return;
   }
   let pick = null;
   let total_frequency = 0;
   let eligible_count = 0;
   for (let i = 0; i < themeroom_fills.length; i++) {
      if (typeof themeroom_fills[i] !== "object") {
         nh.impossible('themeroom fill ' + i + ' must be a table');
      } else if (is_eligible(themeroom_fills[i], rm)) {
         eligible_count++;
         // Reservoir sampling: select one room from the set of eligible rooms,
         // which may change on different levels because of level difficulty.
         let this_frequency;
         if (themeroom_fills[i].frequency !== undefined) {
            this_frequency = themeroom_fills[i].frequency;
         } else {
            this_frequency = 1;
         }
         total_frequency = total_frequency + this_frequency;
         // avoid rn2(0) if a fill has freq 0
         if (this_frequency > 0 && rn2(total_frequency) < this_frequency) {
            pick = i;
         }

         // Debug: Log each eligible room
         if (typeof process !== 'undefined' && process.env.DEBUG_THEMERM_ELIGIBLE === '1') {
            console.log(`  Eligible[${eligible_count}]: ${themeroom_fills[i].name} (freq=${this_frequency}, total=${total_frequency}, picked=${pick === i})`);
         }
      }
   }

   if (typeof process !== 'undefined' && process.env.DEBUG_THEMERM_ELIGIBLE === '1') {
      console.log(`Total eligible rooms: ${eligible_count}, final frequency: ${total_frequency}`);
   }

   if (pick === null) {
      nh.impossible('no eligible themed room fills?');
      return;
   }

   // Debug: Log which themed room was selected
   if (typeof process !== 'undefined' && process.env.DEBUG_THEMERM_EXEC === '1') {
      console.log(`\n=== Executing themed room fill: ${themeroom_fills[pick].name} ===`);
   }

   des.setCurrentRoom(rm);
   themeroom_fills[pick].contents(rm);
   des.setCurrentRoom(null);
}

// postprocess callback: create an engraving pointing at a location
function make_dig_engraving(data) {
   const floors = selection.negate().filter_mapchar(".");
   const pos = floors.rndcoord(0);
   const tx = data.x - pos.x - 1;
   const ty = data.y - pos.y;
   let dig = "";
   if (tx === 0 && ty === 0) {
      dig = " here";
   } else {
      if (tx < 0 || tx > 0) {
         dig = ` ${Math.abs(tx)} ${(tx > 0) ? "east" : "west"}`;
      }
      if (ty < 0 || ty > 0) {
         dig = dig + ` ${Math.abs(ty)} ${(ty > 0) ? "south" : "north"}`;
      }
   }
   des.engraving({ coord: pos, type: "burn", text: "Dig" + dig });
}

// postprocess callback: turn room walls into trees
function make_garden_walls(data) {
   const sel = data.sel.grow();
   // change walls to trees
   des.replace_terrain({ selection: sel, fromterrain: "w", toterrain: "T" });
   // update secret doors; attempting to change to AIR will set arboreal flag
   des.replace_terrain({ selection: sel, fromterrain: "S", toterrain: "A" });
}

// postprocess callback: make a trap
function make_a_trap(data) {
   if (data.teledest === 1 && data.type === "teleport") {
      const locs = selection.negate().filter_mapchar(".");
      do {
         data.teledest = locs.rndcoord(1);
      } while (data.teledest.x === data.coord.x && data.teledest.y === data.coord.y);
   }
   des.trap(data);
}

// called once after the whole level has been generated
export function post_level_generate() {
   for (const v of postprocess) {
      v.handler(v.data);
   }
   postprocess = [];
}
