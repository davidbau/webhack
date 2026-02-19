// track.js -- Player tracking (for pets)
// Faithful port of track.c from NetHack 3.7.
//
// Circular buffer recording player positions for pet pathfinding.
// Pets use gettrack() to find nearby hero footprints when deciding where to move.

// cf. track.c:9
const UTSZ = 100;

let _utrack = new Array(UTSZ).fill(null).map(() => ({ x: 0, y: 0 }));
let _utcnt = 0;
let _utpnt = 0;

// cf. track.c:15
export function initrack() {
    _utcnt = _utpnt = 0;
    _utrack = new Array(UTSZ).fill(null).map(() => ({ x: 0, y: 0 }));
}

// cf. track.c:24 — add to track
export function settrack(player) {
    if (_utcnt < UTSZ) _utcnt++;
    if (_utpnt === UTSZ) _utpnt = 0;
    _utrack[_utpnt].x = player.x;
    _utrack[_utpnt].y = player.y;
    _utpnt++;
}

// cf. track.c:38 — get a track coord on or next to x,y last tracked by hero
// Returns the track entry if distmin=1 (adjacent), null if distmin=0 (same pos) or not found.
export function gettrack(x, y) {
    let cnt = _utcnt;
    let idx = _utpnt;
    while (cnt-- > 0) {
        if (idx === 0) idx = UTSZ - 1;
        else idx--;
        const tc = _utrack[idx];
        const ndist = Math.max(Math.abs(x - tc.x), Math.abs(y - tc.y)); // distmin
        if (ndist <= 1) return ndist ? tc : null;
    }
    return null;
}

// cf. track.c:59 — return true if x,y has hero tracks on it
export function hastrack(x, y) {
    for (let i = 0; i < _utcnt; i++) {
        if (_utrack[i].x === x && _utrack[i].y === y)
            return true;
    }
    return false;
}

// TODO: track.c:72 — save_track(): save/restore not yet implemented
// TODO: track.c:89 — rest_track(): save/restore not yet implemented
