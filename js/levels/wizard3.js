/**
 * wizard3 - NetHack special level
 * Converted from: wizard3.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack yendor wizard3.lua	$NHDT-Date: 1652196040 2022/05/10 15:20:40 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.4 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1992 by M. Stephenson and Izchak Miller
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "mazegrid", bg: "-" });

    des.level_flags("mazelevel", "noteleport", "hardfloor");

    const tmpbounds = selection.match("-");
    const bnds = tmpbounds.bounds();
    const bounds2 = selection.fillrect(bnds.lx, bnds.ly + 1, bnds.hx - 2, bnds.hy - 1);

    const wiz3 = des.map({ halign: "center", valign: "center", map: `

    ----------------------------x
    |..|............S..........|x
    |..|..------------------S--|x
    |..|..|.........|..........|x
    |..S..|. }}}}}}}.| +  +  +  +  + |x
    | + | + |.}}---}}.|-S--------|x
    | + | + |.}--.--}.| + | +  +  + .|x
    | + | + |.}| + .|}.| + | +  +  + .|x
    | + ---|.}--.--}.| + | +  +  + .|x
    | +  + .|.}}---}}.| + | +  +  + .|x
    | +  + .S.}}}}}}}.| + | +  +  + .|x
    | +  + .| +  +  +  + .| + | +  +  + .|x
    ----------------------------x

    ;

    return des.finalize_level();
}
