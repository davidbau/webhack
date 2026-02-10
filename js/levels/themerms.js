/**
 * themerms - NetHack special level
 * Converted from: themerms.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';
import { percent } from '../sp_lev.js';
import { rn2 } from '../rng.js';
import * as nh from '../sp_lev.js';
import { shuffle } from '../sp_lev.js';

export function generate() {
    // NetHack themerms.lua	$NHDT-Date: 1744445274 2025/04/12 0:07:54 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.40 $
    // Copyright (c) 2020 by Pasi Kallinen
    // NetHack may be freely redistributed.  See license for details.
    // 
    // themerooms is an array of tables.
    // the tables define "name", "frequency", "contents", "mindiff" and "maxdiff".
    // * "name" is not shown in-game; it is so that developers can specify a
    // certain room to generate by using the THEMERM or THEMERMFILL environment
    // variable. While technically optional, it should be provided on all the
    // rooms; if it isn't, the room can't be directly specified.
    // * "frequency" is optional; if omitted, 1 is assumed.
    // * "contents" is a function describing what gets put into the room.
    // * "mindiff" and "maxdiff" are optional and independent; if omitted, the
    // room is not constrained by level difficulty.
    // * "eligible" is optional; if omitted, True is assumed.
    // 
    // themeroom_fills is an array of tables with the exact same structure as
    // themerooms. It is used for contents of a room that are independent of its
    // shape, so that interestingly-shaped themerooms can be filled with a variety
    // of contents.
    // * The "contents" functions in themeroom_fills take the room they are
    // filling as an argument.
    // * Frequency of themeroom_fills is a separate pool from themerooms, and has
    // no effect on how likely that any given room will receive a themeroom_fill.
    // 
    // des.room({ type = "ordinary", filled = 1 })
    // - ordinary rooms can be converted to shops or any other special rooms.
    // - filled = 1 means the room gets random room contents, even if it
    // doesn't get converted into a special room. Without filled,
    // the room only gets what you define in here.
    // - use type = "themed" to force a room that's never converted
    // to a special room, such as a shop or a temple.
    // 
    // for each level, the core first calls pre_themerooms_generate(),
    // then it calls themerooms_generate() multiple times until it decides
    // enough rooms have been generated, and then it calls
    // post_themerooms_generate(). When the level has been generated, with
    // joining corridors and rooms filled, the core calls post_level_generate().
    // The lua state is persistent through the gameplay, but not across saves,
    // so remember to reset any variables.

    const postprocess = { };

    themeroom_fills = {

       {
          name = "Ice room",
          contents = function(rm)
             const ice = selection.room();
             des.terrain(ice, "I");
             if ((percent(25))) {
                const mintime = 1000 - (nh.level_difficulty() * 100);
                const ice_melter = function(x,y)
                   nh.start_timer_at(x,y, "melt-ice", mintime + nh.rn2(1000))
                };
                ice.iterate(ice_melter)
             }
          },
       },

       {
          name = "Cloud room",
          contents = function(rm)
             const fog = selection.room();
             for (let i = 1; i <= (fog:numpoints() / 4); i++) {
                des.monster({ id: "fog cloud", asleep: true });
             }
             des.gas_cloud({ selection: fog });
          },
       },

       {
          name = "Boulder room",
          mindiff = 4,
          contents = function(rm)
             const locs = selection.room():percentage(30);
             const func = function(x,y)
                if ((percent(50))) {
                   des.object("boulder", x, y);
                } else {
                   des.trap("rolling boulder", x, y);
                }
             };
             locs.iterate(func)
          },
       },

       {
          name = "Spider nest",
          contents = function(rm)
             const spooders = nh.level_difficulty() > 8;
             const locs = selection.room():percentage(30);
             const func = function(x,y)
    des.trap({ type: "web", x: x, y: y, spider_on_web: spooders && percent(80) });
             }
             locs.iterate(func)
          },
       },

       {
          name = "Trap room",
          contents = function(rm)
             const traps = { "arrow", "dart", "falling rock", "bear",
                            "land mine", "sleep gas", "rust",
                            "anti magic" }
             shuffle(traps)
             const locs = selection.room():percentage(30);
             const func = function(x,y)
                des.trap(traps[1], x, y);
             }
             locs.iterate(func)
          },
       },

       {
          name = "Garden",
          eligible = function(rm) return rm.lit === true; end,
          contents = function(rm)
             const s = selection.room();
             const npts = (s.numpoints() / 6);
             for (let i = 1; i <= npts; i++) {
                des.monster({ id: "wood nymph", asleep: true });
                if ((percent(30))) {
                   des.feature("fountain");
                }
             }
             table.insert(postprocess, { handler = make_garden_walls,
                                         data = { sel = selection.room() } })
          }
       },

       {
          name = "Buried treasure",
          contents = function(rm)
    des.object({ id = "chest", buried = true, contents = function(otmp) xobj = otmp.totable();
            //  keep track of the last buried treasure if ((xobj.NO_OBJ == nil)) { table.insert(postprocess, { handler = make_dig_engraving, data = { x = xobj.ox, y = xobj.oy }})
            } for i = 1, d(3,4) do des.object();
            } } });
          },
       },

       {
          name = "Buried zombies",
          contents = function(rm)
             const diff = nh.level_difficulty()
             // start with [1..4] for low difficulty
             const zombifiable = ["kobold", "gnome", "orc", "dwarf"];
             if (diff > 3) { //  medium difficulty
                zombifiable[5], zombifiable[6] = "elf", "human"
                if (diff > 6) { //  high difficulty (relatively speaking)
                   zombifiable[7], zombifiable[8] = "ettin", "giant"
                }
             }
             for (let i = 1; i <= (rm.width * rm.height) / 2; i++) {
                shuffle(zombifiable)
    const o = des.object({ id: "corpse", montype: zombifiable[1], buried: true });
                o.stop_timer("rot-corpse")
                o.start_timer("zombify-mon", Math.random(990, 1010))
             }
          },
       },

       {
          name = "Massacre",
          contents = function(rm)
             const mon = { "apprentice", "warrior", "ninja", "thug",
                         "hunter", "acolyte", "abbot", "page",
                         "attendant", "neanderthal", "chieftain",
                         "student", "wizard", "valkyrie", "tourist",
                         "samurai", "rogue", "ranger", "priestess",
                         "priest", "monk", "knight", "healer",
                         "cavewoman", "caveman", "barbarian",
                         "archeologist" }
             const idx = Math.random(mon.length);
             for (let i = 1; i <= d(5; i += 5)) {
                if ((percent(10))) { idx = Math.random(mon.length); end
                des.object({ id: "corpse", montype: mon[idx] });
             }
          },
       },

       {
          name = "Statuary",
          contents = function(rm)
             for (let i = 1; i <= d(5; i += 5)) {
                des.object({ id: "statue" });
             }
             for (let i = 1; i <= d(3); i++) {
                des.trap("statue");
             }
          },
       },


       {
          name = "Light source",
          eligible = function(rm) return rm.lit === false; end,
          contents = function(rm)
             des.object({ id: "oil lamp", lit: true });
          }
       },

       {
          name = "Temple of the gods",
          contents = function(rm)
             des.altar({ align: align[1] });
             des.altar({ align: align[2] });
             des.altar({ align: align[3] });
          },
       },

       {
          name = "Ghost of an Adventurer",
          contents = function(rm)
             const loc = selection.room():rndcoord(0);
    des.monster({ id: "ghost", asleep: true, waiting: true, coord: loc });
             if (percent(65)) {
                des.object({ id: "dagger", coord: loc, buc: "!-blessed" });
             }
             if (percent(55)) {
                des.object({ class: ")", coord: loc, buc: "!-blessed" });
             }
             if (percent(45)) {
                des.object({ id: "bow", coord: loc, buc: "!-blessed" });
                des.object({ id: "arrow", coord: loc, buc: "!-blessed" });
             }
             if (percent(65)) {
                des.object({ class: "[", coord: loc, buc: "!-blessed" });
             }
             if (percent(20)) {
                des.object({ class: "=", coord: loc, buc: "!-blessed" });
             }
             if (percent(20)) {
                des.object({ class: "?", coord: loc, buc: "!-blessed" });
             }
          },
       },

       {
          name = "Storeroom",
          contents = function(rm)
             const locs = selection.room():percentage(30);
             const func = function(x,y)
                if ((percent(25))) {
                   des.object("chest");
                } else {
                   des.monster({ class: "m", appear_as: "obj:chest" });
                }
             };
             locs.iterate(func)
          },
       },

       {
          name = "Teleportation hub",
          contents = function(rm)
             const locs = selection.room():filter_mapchar(".");
             for (let i = 1; i <= 2 + nh.rn2(3); i++) {
                const pos = locs.rndcoord(1);
                if ((pos.x > 0)) {
                   pos.x = pos.x + rm.region.x1 - 1
                   pos.y = pos.y + rm.region.y1
                   table.insert(postprocess, { handler = make_a_trap,
                                          data = { type = "teleport", seen = true,
                                                   coord = pos, teledest = 1 } })
                }
             }
          },
       },
    }

    themerooms = {
       {
          name = "default",
          frequency = 1000,
          contents = function()
             des.room({ type: "ordinary", filled: 1 });
          }
       },

       {
          name = "Fake Delphi",
          contents = function()
    des.room({ type: "ordinary", w: 11, h: 9, filled: 1, contents: function() { des.room({ type: "ordinary", x: 4, y: 3, w: 3, h: 3, filled: 1, contents: function() { des.door({ state: "random", wall: "all" }); } }); } });
          },
       },

       {
          name = "Room in a room",
          contents = function()
    des.room({ type: "ordinary", filled: 1, contents: function() { des.room({ type: "ordinary", contents: function() { des.door({ state: "random", wall: "all" }); } }); } });
          },
       },

       {
          name = "Huge room with another room inside",
          contents = function()
    des.room({ type: "ordinary", w: nh.rn2(10)+11, h: nh.rn2(5)+8, filled: 1, contents: function() { if ((percent(90))) {
            des.room({ type: "ordinary", filled: 1, contents: function() { des.door({ state: "random", wall: "all" });
            if ((percent(50))) {
            des.door({ state: "random", wall: "all" });
            } } });
            } } });
          },
       },

       {
          name = "Nesting rooms",
          contents = function()
    des.room({ type: "ordinary", w: 9 + nh.rn2(4), h: 9 + nh.rn2(4), filled: 1, contents: function(rm) { wid = Math.random(Math.floor(rm.width / 2), rm.width - 2);
            hei = Math.random(Math.floor(rm.height / 2), rm.height - 2) des.room({ type: "ordinary", w: wid, h: hei, filled: 1, contents: function() { if ((percent(90))) {
            des.room({ type: "ordinary", filled: 1, contents: function() { des.door({ state: "random", wall: "all" });
            if ((percent(15))) {
            des.door({ state: "random", wall: "all" });
            } } });
            }
            des.door({ state: "random", wall: "all" });
            if ((percent(15))) {
            des.door({ state: "random", wall: "all" });
            } } }); } });
          },
       },

       {
          name = "Default room with themed fill",
          frequency = 6,
          contents = function()
             des.room({ type: "themed", contents: themeroom_fill });
          }
       },

       {
          name = "Unlit room with themed fill",
          frequency = 2,
          contents = function()
             des.room({ type: "themed", lit: 0, contents: themeroom_fill });
          }
       },

       {
          name = "Room with both normal contents && themed fill",
          frequency = 2,
          contents = function()
             des.room({ type: "themed", filled: 1, contents: themeroom_fill });
          }
       },

       {
          name = 'Pillars',
          contents = function()
    des.room({ type: "themed", w: 10, h: 10, contents: function(rm) { terr = ["-", "-", "-", "-", "L", "P", "T"];
            shuffle(terr);
            for x = 0 }, (rm.width / 4) - 1 do for y: 0, (rm.height / 4) - 1 do des.terrain({ x: x * 4 + 2, y = y * 4 + 2, typ = terr[1], lit = -2 });
            des.terrain({ x = x * 4 + 3, y = y * 4 + 2, typ = terr[1], lit = -2 });
            des.terrain({ x = x * 4 + 2, y = y * 4 + 3, typ = terr[1], lit = -2 });
            des.terrain({ x = x * 4 + 3, y = y * 4 + 3, typ = terr[1], lit = -2 });
            } } } });
          },
       },

       {
          name = 'Mausoleum',
          contents = function()
    des.room({ type: "themed", w: 5 + nh.rn2(3)*2, h: 5 + nh.rn2(3)*2, contents: function(rm) { des.room({ type: "themed", x: (rm.width - 1) / 2, y: (rm.height - 1) / 2, w: 1, h: 1, joined: false, contents: function() { if ((percent(50))) { mons = ["M", "V", "L", "Z"];
            shuffle(mons);
            des.monster({ class: mons[1], x: 0, y: 0, waiting: 1 });
            else;
            des.object({ id: "corpse", montype: "@", coord: [0,0] });
            } if ((percent(20))) {
            des.door({ state: "secret", wall: "all" });
            } } }); } });
          },
       },

       {
          name = 'Random dungeon feature in the middle of an odd-sized room',
          contents = function()
             const wid = 3 + (nh.rn2(3) * 2);
             const hei = 3 + (nh.rn2(3) * 2);
    des.room({ type: "ordinary", filled: 1, w: wid, h: hei, contents: function(rm) { feature = ["C", "L", "I", "P", "T"];
            shuffle(feature) des.terrain((rm.width - 1) / 2, (rm.height - 1) / 2, feature[1]); } });
          },
       },

       {
          name = 'L-shaped',
          contents = function()
             des.map({ map: `

    -----xxx
    |...|xxx
    |...|xxx
    |...----
    |......|
    |......|
    |......|
    --------
    `, contents: function(m) { filler_region(1,1) } });
          },
       },

       {
          name = 'L-shaped, rot 1',
          contents = function()
             des.map({ map: `

    xxx-----
    xxx|...|
    xxx|...|
    ----...|
    |......|
    |......|
    |......|
    --------
    `, contents: function(m) { filler_region(5,1) } });
          },
       },

       {
          name = 'L-shaped, rot 2',
          contents = function()
             des.map({ map: `

    --------
    |......|
    |......|
    |......|
    ----...|
    xxx|...|
    xxx|...|
    xxx-----
    `, contents: function(m) { filler_region(1,1) } });
          },
       },

       {
          name = 'L-shaped, rot 3',
          contents = function()
             des.map({ map: `

    --------
    |......|
    |......|
    |......|
    |...----
    |...|xxx
    |...|xxx
    -----xxx
    `, contents: function(m) { filler_region(1,1) } });
          },
       },

       {
          name = 'Blocked center',
          contents = function()
             des.map({ map: `

    -----------
    |.........|
    |.........|
    |.........|
    |...LLL...|
    |...LLL...|
    |...LLL...|
    |.........|
    |.........|
    |.........|
    -----------
    `, contents: function(m) { if ((percent(30))) { terr = ["-", "P"];
            shuffle(terr);
            des.replace_terrain({ region: [1,1, 9,9], fromterrain: "L", toterrain: terr[1] });
            } filler_region(1,1); } });
          },
       },

       {
          name = 'Circular, small',
          contents = function()
             des.map({ map: `

    xx---xx
    x--.--x
    --...--
    |.....|
    --...--
    x--.--x
    xx---xx
    `, contents: function(m) { filler_region(3,3) } });
          },
       },

       {
          name = 'Circular, medium',
          contents = function()
             des.map({ map: `

    xx-----xx
    x--...--x
    --.....--
    |.......|
    |.......|
    |.......|
    --.....--
    x--...--x
    xx-----xx
    `, contents: function(m) { filler_region(4,4) } });
          },
       },

       {
          name = 'Circular, big',
          contents = function()
             des.map({ map: `

    xxx-----xxx
    x---...---x
    x-.......-x
    --.......--
    |.........|
    |.........|
    |.........|
    --.......--
    x-.......-x
    x---...---x
    xxx-----xxx
    `, contents: function(m) { filler_region(5,5) } });
          },
       },

       {
          name = 'T-shaped',
          contents = function()
             des.map({ map: `

    xxx-----xxx
    xxx|...|xxx
    xxx|...|xxx
    ----...----
    |.........|
    |.........|
    |.........|
    -----------
    `, contents: function(m) { filler_region(5,5) } });
          },
       },

       {
          name = 'T-shaped, rot 1',
          contents = function()
             des.map({ map: `

    -----xxx
    |...|xxx
    |...|xxx
    |...----
    |......|
    |......|
    |......|
    |...----
    |...|xxx
    |...|xxx
    -----xxx
    `, contents: function(m) { filler_region(2,2) } });
          },
       },

       {
          name = 'T-shaped, rot 2',
          contents = function()
             des.map({ map: `

    -----------
    |.........|
    |.........|
    |.........|
    ----...----
    xxx|...|xxx
    xxx|...|xxx
    xxx-----xxx
    `, contents: function(m) { filler_region(2,2) } });
          },
       },

       {
          name = 'T-shaped, rot 3',
          contents = function()
             des.map({ map: `

    xxx-----
    xxx|...|
    xxx|...|
    ----...|
    |......|
    |......|
    |......|
    ----...|
    xxx|...|
    xxx|...|
    xxx-----
    `, contents: function(m) { filler_region(5,5) } });
          },
       },

       {
          name = 'S-shaped',
          contents = function()
             des.map({ map: `

    -----xxx
    |...|xxx
    |...|xxx
    |...----
    |......|
    |......|
    |......|
    ----...|
    xxx|...|
    xxx|...|
    xxx-----
    `, contents: function(m) { filler_region(2,2) } });
          },
       },

       {
          name = 'S-shaped, rot 1',
          contents = function()
             des.map({ map: `

    xxx--------
    xxx|......|
    xxx|......|
    ----......|
    |......----
    |......|xxx
    |......|xxx
    --------xxx
    `, contents: function(m) { filler_region(5,5) } });
          },
       },

       {
          name = 'Z-shaped',
          contents = function()
             des.map({ map: `

    xxx-----
    xxx|...|
    xxx|...|
    ----...|
    |......|
    |......|
    |......|
    |...----
    |...|xxx
    |...|xxx
    -----xxx
    `, contents: function(m) { filler_region(5,5) } });
          },
       },

       {
          name = 'Z-shaped, rot 1',
          contents = function()
             des.map({ map: `

    --------xxx
    |......|xxx
    |......|xxx
    |......----
    ----......|
    xxx|......|
    xxx|......|
    xxx--------
    `, contents: function(m) { filler_region(2,2) } });
          },
       },

       {
          name = 'Cross',
          contents = function()
             des.map({ map: `

    xxx-----xxx
    xxx|...|xxx
    xxx|...|xxx
    ----...----
    |.........|
    |.........|
    |.........|
    ----...----
    xxx|...|xxx
    xxx|...|xxx
    xxx-----xxx
    `, contents: function(m) { filler_region(6,6) } });
          },
       },

       {
          name = 'Four-leaf clover',
          contents = function()
             des.map({ map: `

    -----x-----
    |...|x|...|
    |...---...|
    |.........|
    ---.....---
    xx|.....|xx
    ---.....---
    |.........|
    |...---...|
    |...|x|...|
    -----x-----
    `, contents: function(m) { filler_region(6,6) } });
          },
       },

       {
          name = 'Water-surrounded vault',
          contents = function()
             des.map({ map = `

    }}}}}}
    }----}
    }|..|}
    }|..|}
    }----}
    }}}}}}
    `, contents = function(m) des.region({ region={3,3,3,3], type="themed", irregular=true, filled=0, joined=false });
            nasty_undead = ["giant zombie", "ettin zombie", "vampire lord"];
            chest_spots = { { 2, 2 }, { 3, 2 }, { 2, 3 }, { 3, 3 } };
            shuffle(chest_spots) //  Guarantee an escape item inside one of the chests, to prevent -- the hero falling in from above and becoming permanently stuck -- [cf. generate_way_out_method(sp_lev.c)]. -- If the escape item is made of glass or crystal, make sure that -- the chest isn't locked so that kicking it to gain access to its -- contents won't be necessary;
            otherwise retain lock state from -- random creation. -- "pick-axe", "dwarvish mattock" could be included in the list of -- escape items but don't normally generate in containers. local escape_items = ["scroll of teleportation", "ring of teleportation", "wand of teleportation", "wand of digging"]; local itm = obj.new(escape_items[math.random(#escape_items)]); local itmcls = itm:class() local box if (itmcls[ "material" ] == "glass") { -- explicitly force chest to be unlocked box = des.object({ id = "chest", coord = chest_spots[1], olocked = "no" }); else -- accept random locked/unlocked state box = des.object({ id = "chest", coord = chest_spots[1] }); } box:addcontent(itm); for i = 2, #chest_spots do des.object({ id = "chest", coord = chest_spots[i] }); } shuffle(nasty_undead); des.monster(nasty_undead[1], 2, 2); des.exclusion({ type = "teleport", region = { 2,2, 3,3 } }); } }); end, }, { name = 'Twin businesses', mindiff = 4, -- arbitrary contents = function() -- Due to the way room connections work in mklev.c, we must guarantee -- that the "aisle" between the shops touches all four walls of the -- larger room. Thus it has an extra width and height. des.room({ type="themed", w=9, h=5, contents = function() -- There are eight possible placements of the two shops, four of -- which have the vertical aisle in the center. southeast = function() return percent(50) and "south" or "east" } northeast = function() return percent(50) and "north" or "east" } northwest = function() return percent(50) and "north" or "west" } southwest = function() return percent(50) and "south" or "west" } placements = { { lx = 1, ly = 1, rx = 4, ry = 1, lwall = "south", rwall = southeast() }, { lx = 1, ly = 2, rx = 4, ry = 2, lwall = "north", rwall = northeast() }, { lx = 1, ly = 1, rx = 5, ry = 1, lwall = southeast(), rwall = southwest() }, { lx = 1, ly = 1, rx = 5, ry = 2, lwall = southeast(), rwall = northwest() }, { lx = 1, ly = 2, rx = 5, ry = 1, lwall = northeast(), rwall = southwest() }, { lx = 1, ly = 2, rx = 5, ry = 2, lwall = northeast(), rwall = northwest() }, { lx = 2, ly = 1, rx = 5, ry = 1, lwall = southwest(), rwall = "south" }, { lx = 2, ly = 2, rx = 5, ry = 2, lwall = northwest(), rwall = "north" } } ltype,rtype = "weapon shop","armor shop" if (percent(50)) { ltype,rtype = rtype,ltype } shopdoorstate = function() if (percent(1)) { return "locked" } else if (percent(50)) { return "closed" else return "open" } } p = placements[d(#placements)] des.room({ type=ltype, x=p["lx"], y=p["ly"], w=3, h=3, filled=1, joined=false, contents = function() des.door({ state=shopdoorstate(), wall=p["lwall"] }) } }); des.room({ type=rtype, x=p["rx"], y=p["ry"], w=3, h=3, filled=1, joined=false, contents = function() des.door({ state=shopdoorstate(), wall=p["rwall"] }) } }); } }); } }, }; -- store these at global scope, they will be reinitialized in -- pre_themerooms_generate debug_rm_idx = nil debug_fill_idx = nil -- Given a point in a themed room, ensure that themed room is stocked with -- regular room contents. -- With 30% chance, also give it a random themed fill. function filler_region(x, y) local rmtyp = "ordinary"; local func = nil; if ((percent(30))) { rmtyp = "themed"; func = themeroom_fill; } des.region({ region={x,y,x,y}, type=rmtyp, irregular=true, filled=1, contents = func }); } function is_eligible(room, mkrm) local t = type(room); local diff = nh.level_difficulty(); if ((room.mindiff ~= nil and diff < room.mindiff)) { return false } else if ((room.maxdiff ~= nil and diff > room.maxdiff)) { return false } if ((mkrm ~= nil and room.eligible ~= nil)) { return room.eligible(mkrm); } return true } -- given the name of a themed room or fill, return its index in that array function lookup_by_name(name, checkfills) if (name == nil) { return nil } if (checkfills) { for i = 1, #themeroom_fills do if (themeroom_fills[i].name == name) { return i } } else for i = 1, #themerooms do if (themerooms[i].name == name) { return i } } } return nil } -- called repeatedly until the core decides there are enough rooms function themerooms_generate() if (debug_rm_idx ~= nil) { -- room may not be suitable for stairs/portals, so create the "default" -- room half of the time -- (if the user specified BOTH a room and a fill, presumably they are -- interested in what happens when that room gets that fill, so don't -- bother generating default-with-fill rooms as happens below) local actualrm = lookup_by_name("default", false);
            if (percent(50)) { if (is_eligible(themerooms[debug_rm_idx])) { actualrm = debug_rm_idx else pline("Warning: themeroom '"..themerooms[debug_rm_idx].name .."' is ineligible") } } themerooms[actualrm].contents();
            return } else if (debug_fill_idx ~= nil) { -- when a fill is requested but not a room, still create the "default" -- room half of the time, and "default with themed fill" half of the time -- (themeroom_fill will take care of guaranteeing the fill in it) local actualrm = lookup_by_name(percent(50) and "Default room with themed fill" or "default") themerooms[actualrm].contents();
            return } local pick = nil;
            local total_frequency = 0;
            for i = 1, #themerooms do if ((type(themerooms[i]) ~= "table")) { nh.impossible('themed room '..i..' is not a table') } else if (is_eligible(themerooms[i], nil)) { -- Reservoir sampling: select one room from the set of eligible rooms, -- which may change on different levels because of level difficulty. local this_frequency;
            if ((themerooms[i].frequency ~= nil)) { this_frequency = themerooms[i].frequency;
            else this_frequency = 1;
            } total_frequency = total_frequency + this_frequency;
            -- avoid rn2(0) if (a room has freq 0 if this_frequency > 0 and nh.rn2(total_frequency) < this_frequency) { pick = i;
            } } } if (pick == nil) { nh.impossible('no eligible themed rooms?') return } themerooms[pick].contents();
            } -- called before any rooms are generated function pre_themerooms_generate() local debug_themerm = nh.debug_themerm(false) local debug_fill = nh.debug_themerm(true) local xtrainfo = "" debug_rm_idx = lookup_by_name(debug_themerm, false) debug_fill_idx = lookup_by_name(debug_fill, true) if (debug_themerm ~= nil and debug_rm_idx == nil) { if (lookup_by_name(debug_themerm, true) ~= nil) { xtrainfo = "; it is a fill type" } pline("Warning: themeroom '"..debug_themerm .."' not found in themerooms"..xtrainfo, true) } if (debug_fill ~= nil and debug_fill_idx == nil) { if (lookup_by_name(debug_fill, false) ~= nil) { xtrainfo = "; it is a room type" } pline("Warning: themeroom fill '"..debug_fill .."' not found in themeroom_fills"..xtrainfo, true) } } -- called after all rooms have been generated -- but before creating connecting corridors/doors, or filling rooms function post_themerooms_generate() } function themeroom_fill(rm) if (debug_fill_idx ~= nil) { if (is_eligible(themeroom_fills[debug_fill_idx], rm)) { themeroom_fills[debug_fill_idx].contents(rm);
            else -- ideally this would be a debugpline, not a full pline, and offer -- some more context on whether it failed because of difficulty or -- because of eligible function returning false;
            the warning doesn't -- necessarily mean anything. pline("Warning: fill '"..themeroom_fills[debug_fill_idx].name .."' is not eligible in room that generated it") } return } local pick = nil; local total_frequency = 0; for i = 1, #themeroom_fills do if ((type(themeroom_fills[i]) ~= "table")) { nh.impossible('themeroom fill '..i..' must be a table') } else if (is_eligible(themeroom_fills[i], rm)) { -- Reservoir sampling: select one room from the set of eligible rooms, -- which may change on different levels because of level difficulty. local this_frequency; if ((themeroom_fills[i].frequency ~= nil)) { this_frequency = themeroom_fills[i].frequency; else this_frequency = 1; } total_frequency = total_frequency + this_frequency; -- avoid rn2(0) if (a fill has freq 0 if this_frequency > 0 and nh.rn2(total_frequency) < this_frequency) { pick = i; } } } if (pick == nil) { nh.impossible('no eligible themed room fills?') return } themeroom_fills[pick].contents(rm); } -- postprocess callback: create an engraving pointing at a location function make_dig_engraving(data) local floors = selection.negate():filter_mapchar("."); local pos = floors:rndcoord(0); local tx = data.x - pos.x - 1; local ty = data.y - pos.y; local dig = ""; if ((tx == 0 and ty == 0)) { dig = " here"; else if ((tx < 0 or tx > 0)) { dig = string.format(" %i %s", math.abs(tx), (tx > 0) and "east" or "west"); } if ((ty < 0 or ty > 0)) { dig = dig .. string.format(" %i %s", math.abs(ty), (ty > 0) and "south" or "north"); } } des.engraving({ coord = pos, type = "burn", text = "Dig" .. dig }); } -- postprocess callback: turn room walls into trees function make_garden_walls(data) local sel = data.sel:grow(); -- change walls to trees des.replace_terrain({ selection = sel, fromterrain="w", toterrain = "T" }); -- update secret doors; attempting to change to AIR will set arboreal flag des.replace_terrain({ selection = sel, fromterrain="S", toterrain = "A" }); } -- postprocess callback: make a trap function make_a_trap(data) if ((data.teledest == 1 and data.type == "teleport")) { local locs = selection.negate():filter_mapchar("."); repeat data.teledest = locs:rndcoord(1); until (data.teledest.x ~= data.coord.x and data.teledest.y ~= data.coord.y); } des.trap(data); } -- called once after the whole level has been generated function post_level_generate() for i, v in ipairs(postprocess) do v.handler(v.data); } postprocess = { }; end

    return des.finalize_level();
}
