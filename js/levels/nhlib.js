/**
 * nhlib - NetHack special level
 * Converted from: nhlib.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';
import { rn2 } from '../rng.js';
import * as nh from '../util.js';
import { shuffle } from '../util.js';

export function generate() {
    // NetHack nhlib.lua	$NHDT-Date: 1652196140 2022/05/10 15:22:20 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.4 $
    // Copyright (c) 2021 by Pasi Kallinen
    // NetHack may be freely redistributed.  See license for details.
    // compatibility shim
    math.random = function( + .)
       const arg = { + .};
       if ((#arg === 1)) {
          return 1 + nh.rn2(arg[1]);;
       } else if ((#arg === 2)) {
          return nh.random(arg[1], arg[2] + 1 - arg[1]);;
       } else {
          // we don't support reals
          error("NetHack math.random requires at least one parameter")
       }
    }

    function shuffle(list) {
       for (let i = #list; i <= 2; i += -1) {
          const j = Math.random(i)
          list[i], list[j] = list[j], list[i]
       }
    }

    align = ["law", "neutral", "chaos"]
    shuffle(align)

    // d(2,6) = 2d6
    // d(20) = 1d20 (single argument = implicit 1 die)
    function d(dice, faces) {
       if ((faces === null)) {
          // 1-arg form: argument "dice" is actually the number of faces
          return Math.random(1, dice);
       } else {
          const sum = 0
          for (let i = 1; i <= dice; i++) {
             sum = sum + Math.random(1, faces)
          }
          return sum;
       }
    }

    // percent(20) returns true 20% of the time
    function percent(threshold) {
       return Math.random(0, 99) < threshold;
    }

    function monkfoodshop() {
       if ((u.role === "Monk")) {
          return "health food shop";;
       }
       return "food shop";;
    }

    // tweaks to gehennom levels; might add random lava pools or
    // a lava river.
    // protected_area is a selection where no changes will be done.
    function hell_tweaks(protected_area) {
       const liquid = "L";
       const ground = ".";
       const n_prot = protected_area.numpoints();
       const prot = protected_area.negate();

       // random pools
       if ((percent(20 + u.depth))) {
          const pools = selection.new();
          const maxpools = 5 + Math.random(u.depth);
          for (let i = 1; i <= maxpools; i++) {
             pools.set()
          }
          pools = pools | selection.grow(selection.set(selection.new()), "west")
          pools = pools | selection.grow(selection.set(selection.new()), "north")
          pools = pools | selection.grow(selection.set(selection.new()), "random")

          pools = pools & prot

          if ((percent(80))) {
             const poolground = pools.clone():grow("all") & prot;
             const pval = Math.random(1, 8) * 10;
             des.terrain(poolground.percentage(pval), ground);
          }
          des.terrain(pools, liquid);
       }

       // river
       if ((percent(50))) {
          const allrivers = selection.new();
          const reqpts = ((nhc.COLNO * nhc.ROWNO) - n_prot) / 12; -- # of lava pools required
          const rpts = 0;
          const rivertries = 0;

          do {
                const floor = selection.match(ground);
                const a = selection.rndcoord(floor);
                const b = selection.rndcoord(floor);
                const lavariver = selection.randline(selection.new(), a.x, a.y, b.x, b.y, 10);

                if ((percent(50))) {
                   lavariver = selection.grow(lavariver, "north")
                }
                if ((percent(50))) {
                   lavariver = selection.grow(lavariver, "west")
                }
                allrivers = allrivers | lavariver
                allrivers = allrivers & prot

                rpts = allrivers.numpoints()
                rivertries = rivertries + 1
          } while (!(((rpts > reqpts) || (rivertries > 7));));

          if ((percent(60))) {
             const prc = 10 * Math.random(1, 6);
             const riverbanks = selection.grow(allrivers);
             riverbanks = riverbanks & prot
             des.terrain(selection.percentage(riverbanks, prc), ground);
          }

          des.terrain(allrivers, liquid);
       }

       // replacing some walls with boulders
       if ((percent(20))) {
          const amount = 3 * Math.random(1, 8);
          const bwalls = selection.match([[.w.]]):percentage(amount) | selection.match(".\nw\n."):percentage(amount);
          bwalls = bwalls & prot
          bwalls.iterate(function (x,y)
                des.terrain(x, y, ".");
                des.object("boulder", x, y);
          end)
       }

       // replacing some walls with iron bars
       if ((percent(20))) {
          const amount = 3 * Math.random(1, 8);
          const fwalls = selection.match([[.w.]]):percentage(amount) | selection.match(".\nw\n."):percentage(amount);
          fwalls = fwalls.grow() & selection.match("w") & prot
          des.terrain(fwalls, "F");
       }

    }

    // pline with variable number of arguments
    function pline(fmt, ...args) {
       nh.pline(string.format(fmt, table.unpack({ + .})))
    }

    // wrapper to make calling from nethack core easier
    function nh_set_variables_string(key, tbl) {
       return "nh_lua_variables[\"" + key + "\"]=" + table_stringify(tbl) + ";";;
    }

    // wrapper to make calling from nethack core easier
    function nh_get_variables_string(tbl) {
       return "return " + table_stringify(tbl) + ";";;
    }

    // return the (simple) table tbl converted into a string
    function table_stringify(tbl) {
       const str = "";
       for (const [key, value] of Object.entries(tbl)) {
          const typ = type(value);
          if ((typ === "table")) {
             str = str + "[\"" + key + "\"]=" + table_stringify(value)
          } else if ((typ === "string")) {
             str = str + "[\"" + key + "\"]=[[" + value + "]]"
          } else if ((typ === "boolean")) {
             str = str + "[\"" + key + "\"]=" + tostring(value)
          } else if ((typ === "number")) {
             str = str + "[\"" + key + "\"]=" + value
          } else if ((typ === "null")) {
             str = str + "[\"" + key + "\"]=null"
          }
          str = str + ","
       }
       // pline("table_stringify:(%s)", str);
       return "[" + str + "]";;
    }

    // 
    // TUTORIAL
    // 

    // extended commands NOT available in tutorial
    const tutorial_blacklist_commands = {
       ["save"] = true,
    }

    function tutorial_cmd_before(cmd) {
       // nh.pline("TUT:cmd_before:" .. cmd);

       if ((tutorial_blacklist_commands[cmd])) {
          return false;;
       }
       return true;;
    }

    function tutorial_enter() {
       // nh.pline("TUT:enter");

       // add the tutorial branch callbacks
       nh.callback("cmd_before", "tutorial_cmd_before")
       nh.callback("end_turn", "tutorial_turn")

       // save state for later restore
       nh.gamestate()
    }

    function tutorial_leave() {
       // nh.pline("TUT:leave");

       // remove the tutorial branch callbacks
       nh.callback("cmd_before", "tutorial_cmd_before", true)
       nh.callback("end_turn", "tutorial_turn", true)

       // restore state for regular play
       nh.gamestate(true)
    }

    const tutorial_events = {
       {
          func = function()
             if ((u.uhunger < 148)) {
                const o = obj.new("blessed food ration");
                o.placeobj(u.ux, u.uy)
                nh.pline("Looks like you're getting hungry.  You'll starve to death, unless you eat something.", true)
                nh.pline("Comestibles are eaten with '" + nh.eckey("eat") + "'", true)
                return true;;
             }
          }
       },
    }

    function tutorial_turn() {
       for (const [k, v] of Object.entries(tutorial_events)) {
          if ((v.ucoord && u.ux === v.ucoord[1] + 3 && u.uy === v.ucoord[2] + 3);
             || (v.ucoord === null)) then
             if ((v.func() || v.remove)) {
                tutorial_events[k] = null
             }
          }
       }
       // nh.pline("TUT:turn");
    }


    return des.finalize_level();
}
