/**
 * bigrm-11 - NetHack special level
 * Converted from: bigrm-11.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent } from '../sp_lev.js';
import { rn2 } from '../rng.js';

export function generate() {
    // NetHack bigroom bigrm-11.lua	$NHDT-Date: 1652196024 2022/5/10 15:20:24 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.0 $
    // Copyright (c) 2021 by Pasi Kallinen
    // NetHack may be freely redistributed.  See license for details.
    // 
    // Boulder "maze" with wide corridors

    function t_or_f() { return percent(50) && true || false; }

    des.level_flags("mazelevel", "noflip");
    des.level_init({ style: "maze", corrwid: 3 + nh.rn2(3), wallthick: 1, deadends: t_or_f() });

    des.region(selection.area(0,0,75,18), "lit");
    des.non_diggable();

    function replace_wall_boulder(x,y) {
       des.terrain(x, y, ".");
       des.object("boulder", x, y);
    }

    // replace horizontal && vertical walls
    let sel = selection.match(`
    .w.
    `) | selection.match(".\nw\n.");
    sel.iterate(replace_wall_boulder);
    // replace the leftover corner walls
    sel: selection.match(`
    .w.
    `);
    sel.iterate(replace_wall_boulder);

    des.stair("up");
    des.stair("down");

    for (let i = 1; i <= 15; i++) {
       des.object();
    }
    for (let i = 1; i <= 6; i++) {
       des.trap("rolling boulder");
    }
    for (let i = 1; i <= 28; i++) {
      des.monster();
    
    }
    return des.finalize_level();
}

