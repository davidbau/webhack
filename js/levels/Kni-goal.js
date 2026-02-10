/**
 * Kni-goal - NetHack special level
 * Converted from: Kni-goal.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Knight Kni-goal.lua	$NHDT-Date: 1652196005 2022/5/10 15:20:5 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991,92 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel");

    des.map(`

    ....PPPP..PPP..                                                             
    .PPPPP...PP..     ..........     .................................          
    ..PPPPP...P..    ...........    ...................................         
    ..PPP.......   ...........    ......................................        
    ...PPP.......    .........     ...............   .....................      
    ...........    ............    ............     ......................      
    ............   .............      .......     .....................         
    ..............................            .........................         
    ...............................   ..................................        
    .............................    ....................................       
    .........    ......................................................         
    .....PP...    .....................................................         
    .....PPP....    ....................................................        
    ......PPP....   ..............   ....................................       
    .......PPP....  .............    .....................................      
    ........PP...    ............    ......................................     
    ...PPP........     ..........     ..................................        
    ..PPPPP........     ..........     ..............................           
    ....PPPPP......       .........     ..........................              
    .......PPPP...                                                              

    `);
    // Dungeon Description
    des.region(selection.area(0,0,14,19), "lit");
    des.region(selection.area(15,0,75,19), "unlit");
    // Stairs
    des.stair("up", 3,8);
    // Non diggable walls
    des.non_diggable(selection.area(0,0,75,19));
    // Objects
    des.object({ id: "mirror", x: 50,y: 6, buc: "blessed", spe: 0, name: "The Magic Mirror of Merlin" });
    des.object({ coord: [ 33, 1 ] });
    des.object({ coord: [ 33, 2 ] });
    des.object({ coord: [ 33, 3 ] });
    des.object({ coord: [ 33, 4 ] });
    des.object({ coord: [ 33, 5 ] });
    des.object({ coord: [ 34, 1 ] });
    des.object({ coord: [ 34, 2 ] });
    des.object({ coord: [ 34, 3 ] });
    des.object({ coord: [ 34, 4 ] });
    des.object({ coord: [ 34, 5 ] });
    des.object({ coord: [ 35, 1 ] });
    des.object({ coord: [ 35, 2 ] });
    des.object({ coord: [ 35, 3 ] });
    des.object({ coord: [ 35, 4 ] });
    des.object({ coord: [ 35, 5 ] });
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    // Random traps
    des.trap("spiked pit",13,7);
    des.trap("spiked pit",12,8);
    des.trap("spiked pit",12,9);
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    // Random monsters.
    des.monster({ id: "Ixoth", x: 50, y: 6, peaceful: 0 });
    des.monster({ id: "quasit", peaceful: 0 });
    des.monster({ id: "quasit", peaceful: 0 });
    des.monster({ id: "quasit", peaceful: 0 });
    des.monster({ id: "quasit", peaceful: 0 });
    des.monster({ id: "quasit", peaceful: 0 });
    des.monster({ id: "quasit", peaceful: 0 });
    des.monster({ id: "quasit", peaceful: 0 });
    des.monster({ id: "quasit", peaceful: 0 });
    des.monster({ id: "quasit", peaceful: 0 });
    des.monster({ id: "quasit", peaceful: 0 });
    des.monster({ id: "quasit", peaceful: 0 });
    des.monster({ id: "quasit", peaceful: 0 });
    des.monster({ id: "quasit", peaceful: 0 });
    des.monster({ id: "quasit", peaceful: 0 });
    des.monster({ id: "quasit", peaceful: 0 });
    des.monster({ id: "quasit", peaceful: 0 });
    des.monster({ class: "i", peaceful: 0 });
    des.monster({ class: "i", peaceful: 0 });
    des.monster({ id: "ochre jelly", peaceful: 0 });
    des.monster({ id: "ochre jelly", peaceful: 0 });
    des.monster({ id: "ochre jelly", peaceful: 0 });
    des.monster({ id: "ochre jelly", peaceful: 0 });
    des.monster({ id: "ochre jelly", peaceful: 0 });
    des.monster({ id: "ochre jelly", peaceful: 0 });
    des.monster({ id: "ochre jelly", peaceful: 0 });
    des.monster({ id: "ochre jelly", peaceful: 0 });
    des.monster({ class: "j", peaceful: 0 });


    return des.finalize_level();
}

