/**
 * fakewiz1 - NetHack special level
 * Converted from: fakewiz1.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack yendor fakewiz1.lua	$NHDT-Date: 1652196025 2022/05/10 15:20:25 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.2 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1992 by M. Stephenson and Izchak Miller
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "mazegrid", bg: "-" });

    des.level_flags("mazelevel");

    const tmpbounds = selection.match("-");
    const bnds = tmpbounds.bounds();
    const bounds2 = selection.fillrect(bnds.lx, bnds.ly + 1, bnds.hx - 2, bnds.hy - 1);

    const fakewiz1 = des.map({ halign: "center", valign: "center", map: `

    .........
    . }}}}}}}.
    .}}---}}.
    .}--.--}.
    .}| + .|}.
    .}--.--}.
    .}}---}}.
    .}}}}}}}. +  +  +  + .

    ;

    return des.finalize_level();
}
