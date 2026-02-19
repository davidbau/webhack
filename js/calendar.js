// calendar.js -- Time routines
// Faithful port of calendar.c from NetHack 3.7.
//
// The time is used for:
//  - seed for rand()
//  - year on tombstone and yyyymmdd in record file
//  - phase of the moon (various monsters react to NEW_MOON or FULL_MOON)
//  - night and midnight (the undead are dangerous at midnight)
//  - determination of what files are "very old"

// cf. calendar.c:32
export function getnow() {
    const fixed_dt = (typeof process !== 'undefined' && process?.env?.NETHACK_FIXED_DATETIME)
        || undefined;
    if (fixed_dt) {
        const parsed = time_from_yyyymmddhhmmss(fixed_dt);
        if (parsed !== 0) return parsed;
    }
    return Math.floor(Date.now() / 1000);
}

// cf. calendar.c:46
function getlt() {
    const date = getnow();
    return new Date(date * 1000);
}

// cf. calendar.c:55
export function getyear() {
    return getlt().getFullYear();
}

// cf. calendar.c:62
export function yyyymmdd(date) {
    const lt = (date === 0 || date === undefined) ? getlt() : new Date(date * 1000);
    const year = lt.getFullYear();
    let datenum = year < 1970 ? year + 2000 : year;
    datenum = datenum * 100 + (lt.getMonth() + 1);
    datenum = datenum * 100 + lt.getDate();
    return datenum;
}

// cf. calendar.c:86
export function hhmmss(date) {
    const lt = (date === 0 || date === undefined) ? getlt() : new Date(date * 1000);
    return lt.getHours() * 10000 + lt.getMinutes() * 100 + lt.getSeconds();
}

// cf. calendar.c:101
export function yyyymmddhhmmss(date) {
    const lt = (date === 0 || date === undefined) ? getlt() : new Date(date * 1000);
    const year = lt.getFullYear();
    const datenum = year < 1970 ? year + 2000 : year;
    return String(datenum).padStart(4, '0')
        + String(lt.getMonth() + 1).padStart(2, '0')
        + String(lt.getDate()).padStart(2, '0')
        + String(lt.getHours()).padStart(2, '0')
        + String(lt.getMinutes()).padStart(2, '0')
        + String(lt.getSeconds()).padStart(2, '0');
}

// cf. calendar.c:126
export function time_from_yyyymmddhhmmss(buf) {
    if (typeof buf !== 'string' || buf.length !== 14) return 0;
    const y  = Number.parseInt(buf.slice(0, 4), 10);
    const mo = Number.parseInt(buf.slice(4, 6), 10);
    const md = Number.parseInt(buf.slice(6, 8), 10);
    const h  = Number.parseInt(buf.slice(8, 10), 10);
    const mi = Number.parseInt(buf.slice(10, 12), 10);
    const s  = Number.parseInt(buf.slice(12, 14), 10);
    const ms = new Date(y, mo - 1, md, h, mi, s).getTime();
    if (!Number.isFinite(ms) || ms < 0) return 0;
    return Math.floor(ms / 1000);
}

// cf. calendar.c:200
export function phase_of_the_moon() { // 0-7, with 0: new, 4: full
    const lt = getlt();
    const diy = Math.floor(
        (lt - new Date(lt.getFullYear(), 0, 1)) / (24 * 60 * 60 * 1000)
    ); // tm_yday equivalent (0-based day of year)
    const goldn = ((lt.getFullYear() - 1900) % 19) + 1; // tm_year is year-1900
    let epact = (11 * goldn + 18) % 30;
    if ((epact === 25 && goldn > 11) || epact === 24)
        epact++;
    return ((((((diy + epact) * 6) + 11) % 177) / 22) & 7);
}

// cf. calendar.c:215
export function friday_13th() {
    const lt = getlt();
    return lt.getDay() === 5 && lt.getDate() === 13;
}

// cf. calendar.c:224
export function night() {
    const hour = getlt().getHours();
    return hour < 6 || hour > 21;
}

// cf. calendar.c:232
export function midnight() {
    return getlt().getHours() === 0;
}
