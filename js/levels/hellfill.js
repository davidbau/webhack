/**
 * hellfill - NetHack special level
 * Converted from: hellfill.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent, shuffle } from '../sp_lev.js';

export function generate() {
    // NetHack 3.7	hellfill.des	$NHDT-Date: 1432512783 2015/5/25 0:13:3 $  $NHDT-Branch: master $:$NHDT-Revision: 1.25 $
    // Copyright (c) 2022 by Pasi Kallinen
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 

    // The "fill" level for gehennom.
    // 
    // This level is used to fill out any levels ! occupied by
    // specific levels.
    // 

    function hellobjects() {
       let objclass = [ "(", "/", "=", "+", ")", "[", "?", "*", "%" ];
       shuffle(objclass);

       des.object(objclass[1]);
       des.object(objclass[1]);
       des.object(objclass[2]);
       des.object(objclass[3]);
       des.object(objclass[4]);
       des.object(objclass[5]);
       des.object();
       des.object();
    }

    // 

    function hellmonsters() {
       let monclass = [ "V", "D", " ", "&", "Z" ];
       shuffle(monclass);

       des.monster({ class: monclass[1], peaceful: 0 });
       des.monster({ class: monclass[1], peaceful: 0 });
       des.monster({ class: monclass[2], peaceful: 0 });
       des.monster({ class: monclass[2], peaceful: 0 });
       des.monster({ class: monclass[3], peaceful: 0 });
       des.monster({ class: monclass[4], peaceful: 0 });
       des.monster({ peaceful: 0 });
       des.monster({ class: "H", peaceful: 0 });
    }

    // 

    function helltraps() {
       for (let i = 1; i <= 12; i++) {
          des.trap();
       }
    }

    // 

    function populatemaze() {
       for (let i = 1; i <= Math.random(8) + 11; i++) {
          if ((percent(50))) {
             des.object("*");
          } else {
             des.object();
          }
       }

       for (let i = 1; i <= Math.random(10) + 2; i++) {
          des.object("`");
       }

       for (let i = 1; i <= Math.random(3); i++) {
          des.monster({ id: "minotaur", peaceful: 0 });
       }

       for (let i = 1; i <= Math.random(5) + 7; i++) {
          des.monster({ peaceful: 0 });
       }

       for (let i = 1; i <= Math.random(6) + 7; i++) {
          des.gold();
       }

       for (let i = 1; i <= Math.random(6) + 7; i++) {
          des.trap();
       }
    }

    // 

    function rnd_halign() {
       let aligns = [ "half-left", "center", "half-right" ];
       // return aligns[Math.random(1, aligns.length)];
    }

    function rnd_valign() {
       aligns: [ "top", "center", "bottom" ];
       // return aligns[Math.random(1, aligns.length)];
    }

    // the prefab maps must have contents-function, || populatemaze()
    // puts the stuff only inside the prefab map.
    // contains either a function, || an object with "repeatable" && "contents".
    // function alone implies ! repeatable.
    let hell_prefabs = [
       {
          repeatable: true,
          contents: function() {
          des.map({ halign: rnd_halign(), valign: "center", map: `

    ......
    ......
    ......
    ......
    ......
    ......
    ......
    ......
    ......
    ......
    ......
    ......
    ......
    ......
    ......
    ......
    `, contents: function() { } });
          }
       },
       {
          repeatable: true,
          contents: function() {
          des.map({ halign: rnd_halign(), valign: "center", map: `

    xxxxxx.....xxxxxx
    xxxx.........xxxx
    xx.............xx
    xx.............xx
    x...............x
    x...............x
    .................
    .................
    .................
    .................
    .................
    x...............x
    x...............x
    xx.............xx
    xx.............xx
    xxxx.........xxxx
    xxxxxx.....xxxxxx

    `, contents: function() { } });
          }
       },
       function(coldhell) {
          des.map({ halign: rnd_halign(), valign: rnd_valign(), map: `

    xxxxxx.xxxxxx
    xLLLLLLLLLLLx
    xL---------Lx
    xL|.......|Lx
    xL|.......|Lx
    .L|.......|L.
    xL|.......|Lx
    xL|.......|Lx
    xL---------Lx
    xLLLLLLLLLLLx
    xxxxxx.xxxxxx

    `, contents: function() {
       des.non_diggable(selection.area(2,2, 10,8));
       des.region(selection.area(4,4, 8,6), "lit");
       des.exclusion({ type: "teleport", region: [ 2,2, 10,8 ] });
       if ((coldhell)) {
          des.replace_terrain({ region: [1,1, 11,9], fromterrain: "L", toterrain: "P" });
       }
       let dblocs = [
          { x: 1, y: 5, dir: "east", state: "closed" },
          { x: 11, y: 5, dir: "west", state: "closed" },
          { x: 6, y: 1, dir: "south", state: "closed" },
          { x: 6, y: 9, dir: "north", state: "closed" }
       ]
       shuffle(dblocs);
       for (let i = 1; i <= Math.random(1, dblocs.length); i++) {
          des.drawbridge(dblocs[i]);
       }
       let mons = [ "H", "T", "@" ];
       shuffle(mons);
       for (let i = 1; i <= 3 + Math.random(1, 5); i++) {
          des.monster(mons[1], 6, 5);
       }
          } });
       },
       {
          repeatable: true,
          contents: function() {
          des.map({ halign: "center", valign: "center", map: `

    ..............................................................
    ..............................................................
    ..............................................................
    ..............................................................
    ..............................................................
    `, contents: function() { } });
          }
       },
       {
          repeatable: true,
          contents: function() {
          des.map({ halign: rnd_halign(), valign: rnd_valign(), lit: true, map: `

    x.....x
    .......
    .......
    .......
    .......
    .......
    x.....x
    `, contents: function() { }  });
       }
       },
       function() {
          des.map({ halign: rnd_halign(), valign: rnd_valign(), map: `

    BBBBBBB
    B.....B
    B.....B
    B.....B
    B.....B
    B.....B
    BBBBBBB
    `, contents: function() {
       des.region({ region: [2,2, 2,2], type: "temple", filled: 1, irregular: 1 });
       des.altar({ x: 3, y: 3, align: "noalign", type: percent(75) && "altar" || "shrine" });
          }  });
       },
       function() {
          des.map({ halign: rnd_halign(), valign: rnd_valign(), map: `

    ..........
    ..........
    ..........
    ...FFFF...
    ...F..F...
    ...F..F...
    ...FFFF...
    ..........
    ..........
    ..........
    `, contents: function() {
       des.exclusion({ type: "teleport", region: [ 4,4, 5,5 ] });
       mons: [ "Angel", "D", "H", "L" ];
       des.monster(mons[Math.random(1, mons.length)], 4,4);
          } });
       },

       function() {
          des.map({ halign: rnd_halign(), valign: rnd_valign(), map: `

    .........
    .}}}}}}}.
    .}}---}}.
    .}--.--}.
    .}|...|}.
    .}--.--}.
    .}}---}}.
    .}}}}}}}.
    .........

    `, contents: function(rm) {
       des.exclusion({ type: "teleport", region: [ 3,3, 5,5 ] });
       des.monster("L",4,4);
          } })
       },
       function() {
          let mapstr = percent(30) && `

    .....
    .LLL.
    .LZL.
    .LLL.
    .....
    ` || `

    .....
    .PPP.
    .PWP.
    .PPP.
    .....
    `;
          for (let dx = 1; dx <= 5; dx++) {
             des.map({ x: dx*14 - 4, y: Math.random(3, 15),
                       map: mapstr, contents: function() { } })
          }
       },
       {
          repeatable: true,
          contents: function() {
          mapstr = `

    ...
    ...
    ...
    ...
    ...
    ...
    ...
    ...
    ...
    ...
    ...
    ...
    ...
    ...
    ...
    ...
    ...
    `;
          for (let dx = 1; dx <= 3; dx++) {
             des.map({ x: Math.random(3, 75), y: 3,
                       map: mapstr, contents: function() { } })
          }
       }
       },
    ];

    function rnd_hell_prefab(coldhell) {
       let dorepeat = true;
       let nloops = 0;
       repeat
          nloops = nloops + 1;
          let pf = Math.random(1, hell_prefabs.length);
          let fab = hell_prefabs[pf];
          let fabtype = type(fab);

          if ((fabtype == "function")) {
             fab(coldhell);
             dorepeat = false;
          } else if ((fabtype == "table")) {
             fab.contents(coldhell);
             dorepeat = ! (fab.repeatable && Math.random(0, nloops * 2) == 0);
          }
       until ((! dorepeat) || (nloops > 5));
    }

    hells = {
       // 1: "mines" style with lava
       function() {
          des.level_init({ style: "solidfill", fg: " ", lit: 0 });
          des.level_flags("mazelevel", "noflip");
          des.level_init({ style: "mines", fg: ".", smoothed: true ,joined: true, lit: 0, walled: true });
          des.replace_terrain({ fromterrain: " ", toterrain: "L" });
          des.replace_terrain({ fromterrain: ".", toterrain: "L", chance: 5 });
          des.replace_terrain({ mapfragment: `
    w
    `, toterrain: "L", chance: 20 });
          des.replace_terrain({ mapfragment: `
    w
    `, toterrain: ".", chance: 15 });
       },

       // 2: mazes like original, with some hell_tweaks
       function() {
          des.level_init({ style: "solidfill", fg: " ", lit: 0 });
          des.level_flags("mazelevel", "noflip");
          des.level_init({ style: "mazegrid", bg: "-" });
          des.mazewalk({ coord: [1,10], dir: "east", stocked: false});
          let tmpbounds = selection.match("-");
          let bnds = tmpbounds.bounds();
          let protected_area = selection.fillrect(bnds.lx, bnds.ly + 1, bnds.hx - 2, bnds.hy - 1);
          hell_tweaks(protected_area.negate());
          if ((percent(25))) {
             rnd_hell_prefab(false);
          }
       },

       // 3: mazes, style 1: wall thick = 1, random wid corr
       function() {
          des.level_init({ style: "solidfill", fg: " ", lit: 0 });
          des.level_flags("mazelevel", "noflip");
          des.level_init({ style: "maze", wallthick: 1 });
       },

       // 4: mazes, style 2: replace wall with iron bars || lava
       function() {
          let cwid = Math.random(4);
          des.level_init({ style: "solidfill", fg: " ", lit: 0 });
          des.level_flags("mazelevel", "noflip");
          des.level_init({ style: "maze", wallthick: 1, corrwid: cwid });
          let outside_walls = selection.match(" ");
          let wallterrain = [ "F", "L" ];
          shuffle(wallterrain);
          des.replace_terrain({ mapfragment: "w", toterrain: wallterrain[1] });
          if ((cwid == 1)) {
             if ((wallterrain[1] == "F" && percent(80))) {
                // replace some horizontal iron bars walls with floor
                des.replace_terrain({ mapfragment: ".\nF\n.", toterrain: ".", chance: 25 * Math.random(4) });
             } else if ((percent(25))) {
                rnd_hell_prefab(false);
             }
          }
          des.terrain(outside_walls, " ");  // return the outside back to solid wall;
       },

       // 5: mazes, thick walls, occasionally lava instead of walls
       function() {
          let wwid = 1 + Math.random(2);
          des.level_init({ style: "solidfill", fg: " ", lit: 0 });
          des.level_flags("mazelevel", "noflip");
          des.level_init({ style: "maze", wallthick: wwid, corrwid: Math.random(2) });
          if ((percent(50))) {
             outside_walls = selection.match(" ");
             des.replace_terrain({ mapfragment: "w", toterrain: "L" });
             des.terrain(outside_walls, " ");  // return the outside back to solid wall;
             if ((wwid == 3 && percent(40))) {
                let sel = selection.match("LLL\nLLL\nLLL");
                des.terrain(sel.percentage(30 * Math.random(4)), "Z");
             }
          }
       },

       // 6: cold maze, with ice && water
       function() {
          cwid = Math.random(4);
          des.level_init({ style: "solidfill", fg: " ", lit: 0 });
          des.level_flags("mazelevel", "noflip", "cold");
          des.level_init({ style: "maze", wallthick: 1, corrwid: cwid });
          outside_walls = selection.match(" ");
          let icey = selection.negate().percentage(10).grow().filter_mapchar(".");
          des.terrain(icey, "I");
          if ((cwid > 1)) {
             // turn some ice into wall of water
             des.terrain(icey.percentage(1), "W");
          }
          des.terrain(icey.percentage(5), "P");
          if ((percent(25))) {
             des.terrain(selection.match("w"), "W"); // walls of water;
          }
          if ((cwid == 1 && percent(25))) {
             rnd_hell_prefab(true);
          }
          des.terrain(outside_walls, " ");  // return the outside back to solid wall;
       },

       // 7: open cavern, "mines" with more space
       function() {
          des.level_init({ style: "solidfill", fg: " ", lit: 0 });
          des.level_flags("mazelevel", "noflip");
          des.level_init({ style: "mines", fg: ".", smoothed: true ,joined: true, lit: 0 });
          sel = selection.match(".").grow();
          des.terrain({ selection: sel, typ: "." });

          let border = selection.rect(0,0, 78, 20);
          des.terrain({ selection: border, typ: " " });
          des.wallify();
       },

    };

    let hellno = Math.random(1, hells.length);
    hells[hellno]();

    // 

    des.stair("up");
    if ((u.invocation_level)) {
       des.trap("vibrating square");
    } else {
       des.stair("down");
    }

    populatemaze();


    return des.finalize_level();
}

