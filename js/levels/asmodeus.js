/**
 * asmodeus - NetHack special level
 * Converted from: asmodeus.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack gehennom asmodeus.lua	$NHDT-Date: 1652196020 2022/05/10 15:20:20 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.2 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1992 by M. Stephenson and Izchak Miller
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "mazegrid", bg: "-" })

    des.level_flags("mazelevel");

    const tmpbounds = selection.match("-");
    const bnds = tmpbounds.bounds();
    const bounds2 = selection.fillrect(bnds.lx, bnds.ly + 1, bnds.hx - 2, bnds.hy - 1);

    // First part - PLACEHOLDER: Lua→JS conversion incomplete
    // const asmo1 = des.map({ halign: "half-left", valign: "center", map: `...` });
    // Temporarily disabled due to incomplete Lua→JS conversion

    // Second part - PLACEHOLDER
    // const asmo2 = des.map({ halign: "half-right", valign: "center", map: `...` });
    // Temporarily disabled due to incomplete Lua→JS conversion

    return des.finalize_level();
}