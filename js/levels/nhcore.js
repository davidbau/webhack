/**
 * nhcore - NetHack special level
 * Converted from: nhcore.lua
 */

import * as des from '../sp_lev.js';
import * as nh from '../sp_lev.js';

export function generate() {
    // NetHack core nhcore.lua	$NHDT-Date: 1652196284 2022/05/10 15:24:44 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.0 $
    // Copyright (c) 2021 by Pasi Kallinen
    // NetHack may be freely redistributed.  See license for details.
    // This file contains lua code used by NetHack core.
    // Is it loaded once, at game start, and kept in memory until game exit.

    // Data in nh_lua_variables table can be set and queried with nh.variable()
    // This table is saved and restored along with the game.
    nh_lua_variables = {
    }

    // wrapper to simplify calling from nethack core
    function get_variables_string() {
       return "nh_lua_variables=" + table_stringify(nh_lua_variables) + ";";;
    }

    function nh_callback_set(cb, fn) {
       const cbname = "_CB_" + cb;

       // pline("callback_set(%s,%s)", cb, fn);

       if ((type(nh_lua_variables[cbname]) !== "table")) {
          nh_lua_variables[cbname] = {}
       }
       nh_lua_variables[cbname][fn] = true
    }

    function nh_callback_rm(cb, fn) {
       const cbname = "_CB_" + cb;

       // pline("callback_RM(%s,%s)", cb, fn);

       if ((type(nh_lua_variables[cbname]) !== "table")) {
          nh_lua_variables[cbname] = {}
       }
       nh_lua_variables[cbname][fn] = null
    }

    function nh_callback_run(cb, ...args) {
       const cbname = "_CB_" + cb;

       // pline("callback_run(%s)", cb);
       // pline("TYPE:%s", type(nh_lua_variables[cbname]));

       if ((type(nh_lua_variables[cbname]) !== "table")) {
          nh_lua_variables[cbname] = {}
       }
       for k, v in pairs(nh_lua_variables[cbname]) {
          if ((! _G[k](table.unpack{...}))) {
             return false;;
          }
       }
       return true;;
    }

    // This is an example of generating an external file during gameplay,
    // which is updated periodically.
    // Intended for public servers using dgamelaunch as their login manager.
    const prev_dgl_extrainfo = 0;
    function mk_dgl_extrainfo() {
        if (((prev_dgl_extrainfo === 0) || (prev_dgl_extrainfo + 50 < u.moves))) {
            const filename = nh.dump_fmtstr("/tmp/nethack.%n.%d.log");
            const extrai, err = io.open(filename, "w");
            if (extrai) {
                const sortval = 0;
                const dname = nh.dnum_name(u.dnum);
                const dstr = "";
                const astr = " ";
                if (u.uhave_amulet === 1) {
                    sortval = sortval + 1024
                    astr = "A"
                }
                if (dname === "Fort Ludios") {
                    dstr = "Knx"
                    sortval = sortval + 245
                } else if (dname === "The Quest") {
                    dstr = "Q" + u.dlevel
                    sortval = sortval + 250 + u.dlevel
                } else if (dname === "The Elemental Planes") {
                    dstr = "End"
                    sortval = sortval + 256
                } else if (dname === "Vlad's Tower") {
                    dstr = "T" + u.dlevel
                    sortval = sortval + 235 + u.depth
                } else if (dname === "Sokoban") {
                    dstr = "S" + u.dlevel
                    sortval = sortval + 225 + u.depth
                } else if (dname === "The Gnomish Mines") {
                    dstr = "M" + u.dlevel
                    sortval = sortval + 215 + u.dlevel
                } else {
                    dstr = "D" + u.depth
                    sortval = sortval + u.depth
                }
                const str = sortval + "|" + astr + " " + dstr;

                extrai.write(str)
                extrai.close()
            } else {
                // failed to open the file.
                nh.pline("Failed to open dgl extrainfo file: " + err)
            }
            prev_dgl_extrainfo = u.moves
        }
    }

    // Show a helpful tip when player first uses getpos()
    function show_getpos_tip() {
       nh.text(`

    Tip: Farlooking or selecting a map location

    You are now in a "farlook" mode - the movement keys move the cursor,
    not your character.  Game time does not advance.  This mode is used
    to look around the map, or to select a location on it.

    When in this mode, you can press ESC to return to normal game mode,
    and pressing ? will show the key help.

    `)
    }

    // Callback functions
    nhcore = {
        // start_new_game called once, when starting a new game
        // after "Welcome to NetHack" message has been given.
        // start_new_game = function() nh.pline("NEW GAME!"); end,

        // restore_old_game called once, when restoring a saved game
        // after "Welcome back to NetHack" message has been given.
        // restore_old_game = function() nh.pline("RESTORED OLD GAME!"); end,

        // moveloop_turn is called once per turn.
        // moveloop_turn = mk_dgl_extrainfo,

        // game_exit is called when the game exits (quit, saved, ...args)
        // game_exit = function() end,

        // getpos_tip is called the first time the code enters getpos()
        getpos_tip = show_getpos_tip,

        // enter_tutorial and leave_tutorial
        enter_tutorial = tutorial_enter,
        leave_tutorial = tutorial_leave,
    }



    return des.finalize_level();
}
