// map.js -- Map data structures
// Mirrors the level structure from rm.h, decl.h
// The map is COLNO x ROWNO grid of location objects.

import {
    COLNO, ROWNO, STONE, ROOM, CORR, DOOR, HWALL, VWALL,
    TLCORNER, TRCORNER, BLCORNER, BRCORNER, CROSSWALL,
    TUWALL, TDWALL, TLWALL, TRWALL, STAIRS,
    D_NODOOR, D_CLOSED, D_ISOPEN, D_LOCKED,
    IS_WALL, IS_DOOR, IS_ROOM, ACCESSIBLE,
    MAXNROFROOMS, ROOMOFFSET,
    isok
} from './config.js';

// A single map location (mirrors struct rm in rm.h:220+)
export function makeLocation() {
    return {
        typ: STONE,        // terrain type (levl_typ_types enum)
        seenv: 0,          // seen from which directions (bitmask)
        flags: 0,          // door state, altar alignment, etc.
        lit: false,         // is this square lit?
        waslit: false,      // was this square ever lit?
        roomno: 0,         // room number (0 = not in a room)
        edge: false,        // is this on the edge of a room?
        glyph: -1,         // what glyph is displayed here
        horizontal: false,  // for walls: is this horizontal?
        mem_bg: 0,         // remembered background
        mem_trap: 0,       // remembered trap
        mem_obj: 0,        // remembered object
        mem_invis: false,  // remembered invisible monster
    };
}

// A room structure (mirrors struct mkroom in mkroom.h)
// C ref: mkroom.h needfill values
const FILL_NONE = 0;
const FILL_NORMAL = 1;

export { FILL_NONE, FILL_NORMAL };

export function makeRoom() {
    return {
        lx: 0, ly: 0,     // lower-left corner
        hx: 0, hy: 0,     // upper-right corner
        rtype: 0,          // room type (OROOM, SHOP, etc.)
        rlit: false,       // is the room lit?
        needjoining: true, // does this room need corridors?
        needfill: FILL_NONE, // C ref: mkroom.h — needs filling? default 0
        doorct: 0,         // number of doors
        fdoor: 0,          // index of first door in doors[]
        irregular: false,  // is this an irregular room?
        nsubrooms: 0,      // number of subrooms
        roomnoidx: 0,      // room index before sort (for sort_rooms)
    };
}

// The level structure (mirrors parts of decl.h level data)
export class GameMap {
    constructor() {
        // The main map grid: locations[x][y]
        // C ref: level.locations[][] (decl.h)
        this.locations = [];
        for (let x = 0; x < COLNO; x++) {
            this.locations[x] = [];
            for (let y = 0; y < ROWNO; y++) {
                this.locations[x][y] = makeLocation();
            }
        }

        // Room data
        // C ref: svr.rooms[] (decl.h)
        this.rooms = [];
        this.nroom = 0;

        // Doors
        // C ref: svd.doors[] (decl.h)
        this.doors = [];
        this.doorindex = 0;

        // Stairs
        this.upstair = { x: 0, y: 0 };
        this.dnstair = { x: 0, y: 0 };

        // Room connectivity (smeq -- same-equivalent groups)
        // C ref: gs.smeq[] in decl.h
        this.smeq = [];

        // Level metadata
        this.flags = {
            nfountains: 0,
            nsinks: 0,
            has_shop: false,
            has_temple: false,
            has_vault: false,
            noteleport: false,
            hardfloor: false,
            nommap: false,
            shortsighted: false,
            graveyard: false,
            is_maze_lev: false,
            is_cavernous_lev: false,
            noautosearch: false,
            fumaroles: false,
        };

        // Monster list for this level
        this.monsters = [];

        // Object list for this level
        this.objects = [];

        // Trap list
        this.traps = [];
    }

    // Get location at (x,y) -- shorthand for the C's levl[x][y]
    // C ref: Throughout the codebase, levl[x][y] or level.locations[x][y]
    at(x, y) {
        if (x < 0 || x >= COLNO || y < 0 || y >= ROWNO) return null;
        return this.locations[x][y];
    }

    // Clear the map to stone
    clear() {
        for (let x = 0; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                const loc = this.locations[x][y];
                loc.typ = STONE;
                loc.seenv = 0;
                loc.flags = 0;
                loc.lit = false;
                loc.waslit = false;
                loc.roomno = 0;
                loc.edge = false;
                loc.glyph = -1;
                loc.horizontal = false;
                loc.mem_bg = 0;
                loc.mem_trap = 0;
                loc.mem_obj = 0;
                loc.mem_invis = false;
            }
        }
        this.rooms = [];
        this.nroom = 0;
        this.doors = [];
        this.doorindex = 0;
        this.monsters = [];
        this.objects = [];
        this.traps = [];
    }

    // Add a room to the rooms array
    addRoom(room) {
        this.rooms.push(room);
        this.nroom = this.rooms.length;
        return this.rooms.length - 1;
    }

    // Get the room at position (x,y), or null
    roomAt(x, y) {
        for (const room of this.rooms) {
            if (x >= room.lx && x <= room.hx &&
                y >= room.ly && y <= room.hy) {
                return room;
            }
        }
        return null;
    }

    // Find monster at (x,y)
    monsterAt(x, y) {
        return this.monsters.find(m => m.mx === x && m.my === y && m.mhp > 0) || null;
    }

    // Find objects at (x,y)
    objectsAt(x, y) {
        return this.objects.filter(o => o.ox === x && o.oy === y);
    }

    // Find trap at (x,y)
    trapAt(x, y) {
        return this.traps.find(t => t.tx === x && t.ty === y) || null;
    }

    // Remove a dead monster
    removeMonster(mon) {
        const idx = this.monsters.indexOf(mon);
        if (idx >= 0) this.monsters.splice(idx, 1);
    }

    // Remove an object from the level
    removeObject(obj) {
        const idx = this.objects.indexOf(obj);
        if (idx >= 0) this.objects.splice(idx, 1);
    }
}
