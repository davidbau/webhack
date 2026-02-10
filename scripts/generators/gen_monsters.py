#!/usr/bin/env python3
"""
Parse NetHack 3.7 monsters.h and generate js/monsters.js
"""
import re
import sys

MONSTERS_H = "nethack-c/include/monsters.h"

# Read the source
with open(MONSTERS_H) as f:
    lines = f.readlines()

# Weight constants
WT = {
    'WT_ETHEREAL': 0,
    'WT_JELLY': 50,
    'WT_NYMPH': 600,
    'WT_ELF': 800,
    'WT_HUMAN': 1450,
    'WT_BABY_DRAGON': 1500,
    'WT_DRAGON': 4500,
}

# Color constants
CLR = {
    'CLR_BLACK': 0,
    'CLR_RED': 1,
    'CLR_GREEN': 2,
    'CLR_BROWN': 3,
    'CLR_BLUE': 4,
    'CLR_MAGENTA': 5,
    'CLR_CYAN': 6,
    'CLR_GRAY': 7,
    'CLR_ORANGE': 9,
    'CLR_BRIGHT_GREEN': 10,
    'CLR_YELLOW': 11,
    'CLR_BRIGHT_BLUE': 12,
    'CLR_BRIGHT_MAGENTA': 13,
    'CLR_BRIGHT_CYAN': 14,
    'CLR_WHITE': 15,
    'HI_DOMESTIC': 15,  # CLR_WHITE
    'HI_LORD': 5,  # CLR_MAGENTA
    'HI_OVERLORD': 13,  # CLR_BRIGHT_MAGENTA
    'HI_METAL': 6,  # CLR_CYAN
    'HI_COPPER': 11,  # CLR_YELLOW
    'HI_SILVER': 7,  # CLR_GRAY
    'HI_GOLD': 11,  # CLR_YELLOW
    'HI_LEATHER': 3,  # CLR_BROWN
    'HI_CLOTH': 3,  # CLR_BROWN
    'HI_ORGANIC': 3,  # CLR_BROWN
    'HI_WOOD': 3,  # CLR_BROWN
    'HI_PAPER': 15,  # CLR_WHITE
    'HI_GLASS': 14,  # CLR_BRIGHT_CYAN
    'HI_MINERAL': 7,  # CLR_GRAY
    'DRAGON_SILVER': 14,  # CLR_BRIGHT_CYAN
    'HI_ZAP': 12,  # CLR_BRIGHT_BLUE
}

# A_NONE
A_NONE = -128

# First, strip out #if 0 ... #endif blocks and #ifdef CHARON / MAIL_STRUCTURES blocks
filtered_lines = []
skip_depth = 0
in_skip = False
skip_stack = []

i = 0
while i < len(lines):
    line = lines[i]
    stripped = line.strip()

    if stripped.startswith('#if 0'):
        skip_stack.append(True)
        in_skip = True
        i += 1
        continue
    elif stripped.startswith('#ifdef CHARON') or stripped.startswith('#ifdef MAIL_STRUCTURES'):
        skip_stack.append(True)
        in_skip = True
        i += 1
        continue
    elif stripped.startswith('#if ') or stripped.startswith('#ifdef ') or stripped.startswith('#ifndef '):
        if in_skip:
            skip_stack.append(False)  # nested, don't change skip state
        else:
            skip_stack.append(False)
        i += 1
        if not in_skip:
            filtered_lines.append(line)
        continue
    elif stripped.startswith('#endif'):
        if skip_stack:
            was_skip_start = skip_stack.pop()
            if was_skip_start:
                in_skip = any(s for s in skip_stack)
            i += 1
            if not in_skip and not was_skip_start:
                filtered_lines.append(line)
            continue
    elif stripped.startswith('#else'):
        # For our skip blocks, #else means we should now include
        if skip_stack and skip_stack[-1]:
            in_skip = False
            skip_stack[-1] = False
        i += 1
        continue

    if not in_skip:
        filtered_lines.append(line)
    i += 1

# Join into one big string
text = ''.join(filtered_lines)

# Remove C comments
text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
# Remove // comments
text = re.sub(r'//[^\n]*', '', text)

# Remove preprocessor directives
text = re.sub(r'^\s*#[^\n]*', '', text, flags=re.MULTILINE)

# Remove SEDUCTION_ATTACKS macros definition lines - they are #define so already removed
# But we need to handle SEDUCTION_ATTACKS_YES and SEDUCTION_ATTACKS_NO references

# Expand SEDUCTION_ATTACKS_YES and SEDUCTION_ATTACKS_NO
SEDUCTION_YES = "A(ATTK(AT_BITE, AD_SSEX, 0, 0), ATTK(AT_CLAW, AD_PHYS, 1, 3), ATTK(AT_CLAW, AD_PHYS, 1, 3), NO_ATTK, NO_ATTK, NO_ATTK)"
SEDUCTION_NO = "A(ATTK(AT_CLAW, AD_PHYS, 1, 3), ATTK(AT_CLAW, AD_PHYS, 1, 3), ATTK(AT_BITE, AD_DRLI, 2, 6), NO_ATTK, NO_ATTK, NO_ATTK)"

text = text.replace('SEDUCTION_ATTACKS_YES', SEDUCTION_YES)
text = text.replace('SEDUCTION_ATTACKS_NO', SEDUCTION_NO)

# Now find all MON(...) entries
# We need to handle nested parens
def find_mon_entries(text):
    entries = []
    i = 0
    while i < len(text):
        # Find MON(
        idx = text.find('MON(', i)
        if idx == -1:
            break
        # Now find the matching closing paren
        depth = 0
        j = idx + 3  # at the '('
        start = idx
        while j < len(text):
            if text[j] == '(':
                depth += 1
            elif text[j] == ')':
                depth -= 1
                if depth == 0:
                    entries.append(text[start:j+1])
                    break
            j += 1
        i = j + 1
    return entries

mon_entries = find_mon_entries(text)

# For each entry, also find its original line number
# We need to map back to original file
def find_line_numbers(original_lines, entries_text):
    """Find original line numbers for MON entries"""
    line_nums = []
    search_start = 0
    original_text = ''.join(original_lines)

    # For each entry we need to find its bn (last arg) and search in original
    for entry in entries_text:
        # Extract the bn (last identifier before closing paren)
        # e.g. GIANT_ANT)
        m = re.search(r',\s*([A-Z_]+)\s*\)\s*$', entry)
        if m:
            bn = m.group(1)
            # Find "bn)" in original text
            pattern = bn + ')'
            idx = original_text.find(pattern, search_start)
            if idx >= 0:
                # Count line number
                line_num = original_text[:idx].count('\n') + 1
                line_nums.append(line_num)
                search_start = idx + len(pattern)
            else:
                line_nums.append(0)
        else:
            line_nums.append(0)
    return line_nums

# Get line numbers from original file
original_text_full = ''.join(lines)
line_nums = []
search_pos = 0
for entry in mon_entries:
    m = re.search(r',\s*([A-Z][A-Z_0-9]+)\s*\)\s*$', entry)
    if m:
        bn = m.group(1)
        # Search for "bn)" which marks end of MON entry
        idx = original_text_full.find(bn + ')', search_pos)
        if idx >= 0:
            ln = original_text_full[:idx].count('\n') + 1
            line_nums.append(ln)
            search_pos = idx + len(bn) + 1
        else:
            line_nums.append(0)
    else:
        line_nums.append(0)


def parse_mon(entry):
    """Parse a MON(...) entry into a dict"""
    # Remove MON( and trailing )
    inner = entry[4:-1].strip()

    # We need to split by commas at depth 0
    def split_top_level(s):
        parts = []
        depth = 0
        current = []
        for ch in s:
            if ch == '(' :
                depth += 1
                current.append(ch)
            elif ch == ')':
                depth -= 1
                current.append(ch)
            elif ch == ',' and depth == 0:
                parts.append(''.join(current).strip())
                current = []
            else:
                current.append(ch)
        if current:
            parts.append(''.join(current).strip())
        return parts

    parts = split_top_level(inner)

    # parts[0]: NAM("name") or NAMS("m","f","n")
    # parts[1]: S_XXX (symbol)
    # parts[2]: LVL(level, speed, ac, mr, align)
    # parts[3]: geno flags
    # parts[4]: A(attacks...)
    # parts[5]: SIZ(weight, nutrition, sound, size)
    # parts[6]: mr1
    # parts[7]: mr2
    # parts[8]: flags1
    # parts[9]: flags2
    # parts[10]: flags3
    # parts[11]: difficulty
    # parts[12]: color
    # parts[13]: bn (base name for PM_ constant)

    result = {}

    # Parse name
    nam = parts[0].strip()
    if nam.startswith('NAMS('):
        # NAMS("m", "f", "n")
        inner_nam = nam[5:-1]
        names = re.findall(r'"([^"]*)"', inner_nam)
        result['name'] = names[0] if names else ''
    elif nam.startswith('NAM('):
        inner_nam = nam[4:-1]
        m = re.search(r'"([^"]*)"', inner_nam)
        result['name'] = m.group(1) if m else ''
    else:
        result['name'] = nam

    # Symbol
    result['symbol'] = parts[1].strip()

    # LVL(level, speed, ac, mr, align)
    lvl_str = parts[2].strip()
    m = re.match(r'LVL\((.+)\)', lvl_str)
    if m:
        lvl_parts = [x.strip() for x in m.group(1).split(',')]
        result['level'] = lvl_parts[0]
        result['speed'] = lvl_parts[1]
        result['ac'] = lvl_parts[2]
        result['mr'] = lvl_parts[3]
        align = lvl_parts[4]
        if align == 'A_NONE':
            result['align'] = str(A_NONE)
        else:
            result['align'] = align

    # Geno
    result['geno'] = parts[3].strip()

    # Attacks - A(ATTK(...), ATTK(...), ...)
    atk_str = parts[4].strip()
    # Parse the A(...) wrapper
    m = re.match(r'A\((.+)\)', atk_str, re.DOTALL)
    if m:
        atk_inner = m.group(1).strip()
        # Split attacks at top level
        atk_parts = split_top_level(atk_inner)
        attacks = []
        for ap in atk_parts:
            ap = ap.strip()
            if ap == 'NO_ATTK':
                attacks.append(None)
            else:
                m2 = re.match(r'ATTK\((.+)\)', ap)
                if m2:
                    att_args = [x.strip() for x in m2.group(1).split(',')]
                    attacks.append({
                        'type': att_args[0],
                        'damage': att_args[1],
                        'dice': att_args[2],
                        'sides': att_args[3],
                    })
        result['attacks'] = attacks

    # SIZ(weight, nutrition, sound, size)
    siz_str = parts[5].strip()
    m = re.match(r'SIZ\((.+)\)', siz_str)
    if m:
        siz_parts = [x.strip() for x in m.group(1).split(',')]
        wt = siz_parts[0]
        if wt in WT:
            wt = str(WT[wt])
        result['weight'] = wt
        result['nutrition'] = siz_parts[1]
        result['sound'] = siz_parts[2]
        result['size'] = siz_parts[3]

    # mr1, mr2
    result['mr1'] = parts[6].strip()
    result['mr2'] = parts[7].strip()

    # flags1, flags2, flags3
    result['flags1'] = parts[8].strip()
    result['flags2'] = parts[9].strip()
    result['flags3'] = parts[10].strip()

    # difficulty
    result['difficulty'] = parts[11].strip()

    # color
    color = parts[12].strip()
    result['color'] = color

    # bn (PM_ name)
    result['bn'] = parts[13].strip()

    return result


# Parse all entries
monsters = []
for entry in mon_entries:
    try:
        m = parse_mon(entry)
        monsters.append(m)
    except Exception as e:
        print(f"Error parsing: {entry[:80]}...: {e}", file=sys.stderr)
        raise

def resolve_flags(flag_str):
    """Convert C flag expression to JS"""
    # Replace hex literals like 0x80000000UL or 0x80000000L
    s = flag_str
    s = s.replace('0L', '0')
    s = re.sub(r'(\d)L\b', r'\1', s)
    s = re.sub(r'(\d)UL\b', r'\1', s)
    return s

def format_geno(geno_str):
    """Format geno flags"""
    s = geno_str.strip()
    # Remove outer parens if present
    if s.startswith('(') and s.endswith(')'):
        s = s[1:-1].strip()
    return s

def format_color(color_str):
    """Return JS color constant name"""
    return color_str

def format_attacks(attacks):
    """Format attacks array"""
    real_attacks = [a for a in attacks if a is not None]
    if not real_attacks:
        return '[]'
    parts = []
    for a in real_attacks:
        parts.append(f"{{ type: {a['type']}, damage: {a['damage']}, dice: {a['dice']}, sides: {a['sides']} }}")
    return '[' + ', '.join(parts) + ']'


# Generate JS
out = []
out.append('// NetHack 3.7 Monster Data - auto-generated from monsters.h')
out.append('// Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985.')
out.append('// NetHack may be freely redistributed.  See license for details.')
out.append('')

# Monster symbol classes
out.append('// Monster symbol classes (from defsym.h)')
monsyms = [
    ('S_ANT', 1), ('S_BLOB', 2), ('S_COCKATRICE', 3), ('S_DOG', 4),
    ('S_EYE', 5), ('S_FELINE', 6), ('S_GREMLIN', 7), ('S_HUMANOID', 8),
    ('S_IMP', 9), ('S_JELLY', 10), ('S_KOBOLD', 11), ('S_LEPRECHAUN', 12),
    ('S_MIMIC', 13), ('S_NYMPH', 14), ('S_ORC', 15), ('S_PIERCER', 16),
    ('S_QUADRUPED', 17), ('S_RODENT', 18), ('S_SPIDER', 19), ('S_TRAPPER', 20),
    ('S_UNICORN', 21), ('S_VORTEX', 22), ('S_WORM', 23), ('S_XAN', 24),
    ('S_LIGHT', 25), ('S_ZRUTY', 26), ('S_ANGEL', 27), ('S_BAT', 28),
    ('S_CENTAUR', 29), ('S_DRAGON', 30), ('S_ELEMENTAL', 31), ('S_FUNGUS', 32),
    ('S_GNOME', 33), ('S_GIANT', 34), ('S_invisible', 35), ('S_JABBERWOCK', 36),
    ('S_KOP', 37), ('S_LICH', 38), ('S_MUMMY', 39), ('S_NAGA', 40),
    ('S_OGRE', 41), ('S_PUDDING', 42), ('S_QUANTMECH', 43), ('S_RUSTMONST', 44),
    ('S_SNAKE', 45), ('S_TROLL', 46), ('S_UMBER', 47), ('S_VAMPIRE', 48),
    ('S_WRAITH', 49), ('S_XORN', 50), ('S_YETI', 51), ('S_ZOMBIE', 52),
    ('S_HUMAN', 53), ('S_GHOST', 54), ('S_GOLEM', 55), ('S_DEMON', 56),
    ('S_EEL', 57), ('S_LIZARD', 58), ('S_WORM_TAIL', 59), ('S_MIMIC_DEF', 60),
]
for name, val in monsyms:
    out.append(f'export const {name} = {val};')
out.append(f'export const MAXMCLASSES = {len(monsyms) + 1};')
out.append('')

# Attack types
out.append('// Attack types (from monattk.h)')
at_types = [
    ('AT_ANY', -1), ('AT_NONE', 0), ('AT_CLAW', 1), ('AT_BITE', 2),
    ('AT_KICK', 3), ('AT_BUTT', 4), ('AT_TUCH', 5), ('AT_STNG', 6),
    ('AT_HUGS', 7), ('AT_SPIT', 10), ('AT_ENGL', 11), ('AT_BREA', 12),
    ('AT_EXPL', 13), ('AT_BOOM', 14), ('AT_GAZE', 15), ('AT_TENT', 16),
    ('AT_WEAP', 254), ('AT_MAGC', 255),
]
for name, val in at_types:
    out.append(f'export const {name} = {val};')
out.append('')

# Damage types
out.append('// Damage types (from monattk.h)')
ad_types = [
    ('AD_ANY', -1), ('AD_PHYS', 0), ('AD_MAGM', 1), ('AD_FIRE', 2),
    ('AD_COLD', 3), ('AD_SLEE', 4), ('AD_DISN', 5), ('AD_ELEC', 6),
    ('AD_DRST', 7), ('AD_ACID', 8), ('AD_SPC1', 9), ('AD_SPC2', 10),
    ('AD_BLND', 11), ('AD_STUN', 12), ('AD_SLOW', 13), ('AD_PLYS', 14),
    ('AD_DRLI', 15), ('AD_DREN', 16), ('AD_LEGS', 17), ('AD_STON', 18),
    ('AD_STCK', 19), ('AD_SGLD', 20), ('AD_SITM', 21), ('AD_SEDU', 22),
    ('AD_TLPT', 23), ('AD_RUST', 24), ('AD_CONF', 25), ('AD_DGST', 26),
    ('AD_HEAL', 27), ('AD_WRAP', 28), ('AD_WERE', 29), ('AD_DRDX', 30),
    ('AD_DRCO', 31), ('AD_DRIN', 32), ('AD_DISE', 33), ('AD_DCAY', 34),
    ('AD_SSEX', 35), ('AD_HALU', 36), ('AD_DETH', 37), ('AD_PEST', 38),
    ('AD_FAMN', 39), ('AD_SLIM', 40), ('AD_ENCH', 41), ('AD_CORR', 42),
    ('AD_POLY', 43),
    ('AD_CLRC', 240), ('AD_SPEL', 241), ('AD_RBRE', 242),
    ('AD_SAMU', 252), ('AD_CURS', 253),
]
for name, val in ad_types:
    out.append(f'export const {name} = {val};')
out.append('')

# Resistances
out.append('// Resistances (from monflag.h)')
mr_flags = [
    ('MR_FIRE', 0x01), ('MR_COLD', 0x02), ('MR_SLEEP', 0x04),
    ('MR_DISINT', 0x08), ('MR_ELEC', 0x10), ('MR_POISON', 0x20),
    ('MR_ACID', 0x40), ('MR_STONE', 0x80),
]
for name, val in mr_flags:
    out.append(f'export const {name} = 0x{val:02x};')
out.append('')

# MR2 flags
out.append('// MR2 resistances (from monflag.h)')
mr2_flags = [
    ('MR2_SEE_INVIS', 0x0100), ('MR2_LEVITATE', 0x0200),
    ('MR2_WATERWALK', 0x0400), ('MR2_MAGBREATH', 0x0800),
    ('MR2_DISPLACED', 0x1000), ('MR2_STRENGTH', 0x2000),
    ('MR2_FUMBLING', 0x4000),
]
for name, val in mr2_flags:
    out.append(f'export const {name} = 0x{val:04x};')
out.append('')

# M1 flags
out.append('// Monster flags 1 (from monflag.h)')
m1_flags = [
    ('M1_FLY', 0x00000001), ('M1_SWIM', 0x00000002),
    ('M1_AMORPHOUS', 0x00000004), ('M1_WALLWALK', 0x00000008),
    ('M1_CLING', 0x00000010), ('M1_TUNNEL', 0x00000020),
    ('M1_NEEDPICK', 0x00000040), ('M1_CONCEAL', 0x00000080),
    ('M1_HIDE', 0x00000100), ('M1_AMPHIBIOUS', 0x00000200),
    ('M1_BREATHLESS', 0x00000400), ('M1_NOTAKE', 0x00000800),
    ('M1_NOEYES', 0x00001000), ('M1_NOHANDS', 0x00002000),
    ('M1_NOLIMBS', 0x00006000), ('M1_NOHEAD', 0x00008000),
    ('M1_MINDLESS', 0x00010000), ('M1_HUMANOID', 0x00020000),
    ('M1_ANIMAL', 0x00040000), ('M1_SLITHY', 0x00080000),
    ('M1_UNSOLID', 0x00100000), ('M1_THICK_HIDE', 0x00200000),
    ('M1_OVIPAROUS', 0x00400000), ('M1_REGEN', 0x00800000),
    ('M1_SEE_INVIS', 0x01000000), ('M1_TPORT', 0x02000000),
    ('M1_TPORT_CNTRL', 0x04000000), ('M1_ACID', 0x08000000),
    ('M1_POIS', 0x10000000), ('M1_CARNIVORE', 0x20000000),
    ('M1_HERBIVORE', 0x40000000), ('M1_OMNIVORE', 0x60000000),
    ('M1_METALLIVORE', 0x80000000),
]
for name, val in m1_flags:
    out.append(f'export const {name} = 0x{val:08x};')
out.append('')

# M2 flags
out.append('// Monster flags 2 (from monflag.h)')
m2_flags = [
    ('M2_NOPOLY', 0x00000001), ('M2_UNDEAD', 0x00000002),
    ('M2_WERE', 0x00000004), ('M2_HUMAN', 0x00000008),
    ('M2_ELF', 0x00000010), ('M2_DWARF', 0x00000020),
    ('M2_GNOME', 0x00000040), ('M2_ORC', 0x00000080),
    ('M2_DEMON', 0x00000100), ('M2_MERC', 0x00000200),
    ('M2_LORD', 0x00000400), ('M2_PRINCE', 0x00000800),
    ('M2_MINION', 0x00001000), ('M2_GIANT', 0x00002000),
    ('M2_SHAPESHIFTER', 0x00004000),
    ('M2_MALE', 0x00010000), ('M2_FEMALE', 0x00020000),
    ('M2_NEUTER', 0x00040000), ('M2_PNAME', 0x00080000),
    ('M2_HOSTILE', 0x00100000), ('M2_PEACEFUL', 0x00200000),
    ('M2_DOMESTIC', 0x00400000), ('M2_WANDER', 0x00800000),
    ('M2_STALK', 0x01000000), ('M2_NASTY', 0x02000000),
    ('M2_STRONG', 0x04000000), ('M2_ROCKTHROW', 0x08000000),
    ('M2_GREEDY', 0x10000000), ('M2_JEWELS', 0x20000000),
    ('M2_COLLECT', 0x40000000), ('M2_MAGIC', 0x80000000),
]
for name, val in m2_flags:
    out.append(f'export const {name} = 0x{val:08x};')
out.append('')

# M3 flags
out.append('// Monster flags 3 (from monflag.h)')
m3_flags = [
    ('M3_WANTSAMUL', 0x0001), ('M3_WANTSBELL', 0x0002),
    ('M3_WANTSBOOK', 0x0004), ('M3_WANTSCAND', 0x0008),
    ('M3_WANTSARTI', 0x0010), ('M3_WANTSALL', 0x001f),
    ('M3_WAITFORU', 0x0040), ('M3_CLOSE', 0x0080),
    ('M3_COVETOUS', 0x001f), ('M3_WAITMASK', 0x00c0),
    ('M3_INFRAVISION', 0x0100), ('M3_INFRAVISIBLE', 0x0200),
    ('M3_DISPLACES', 0x0400),
]
for name, val in m3_flags:
    out.append(f'export const {name} = 0x{val:04x};')
out.append('')

# Generation flags
out.append('// Generation flags (from monflag.h)')
g_flags = [
    ('G_UNIQ', 0x1000), ('G_NOHELL', 0x0800), ('G_HELL', 0x0400),
    ('G_NOGEN', 0x0200), ('G_SGROUP', 0x0080), ('G_LGROUP', 0x0040),
    ('G_GENO', 0x0020), ('G_NOCORPSE', 0x0010), ('G_FREQ', 0x0007),
    ('G_IGNORE', 0x8000),
]
for name, val in g_flags:
    out.append(f'export const {name} = 0x{val:04x};')
out.append('')

# Sounds
out.append('// Monster sounds (from monflag.h)')
ms_sounds = [
    ('MS_SILENT', 0), ('MS_BARK', 1), ('MS_MEW', 2), ('MS_ROAR', 3),
    ('MS_BELLOW', 4), ('MS_GROWL', 5), ('MS_SQEEK', 6), ('MS_SQAWK', 7),
    ('MS_CHIRP', 8), ('MS_HISS', 9), ('MS_BUZZ', 10), ('MS_GRUNT', 11),
    ('MS_NEIGH', 12), ('MS_MOO', 13), ('MS_WAIL', 14), ('MS_GURGLE', 15),
    ('MS_BURBLE', 16), ('MS_TRUMPET', 17), ('MS_ANIMAL', 17),
    ('MS_SHRIEK', 18), ('MS_BONES', 19), ('MS_LAUGH', 20), ('MS_MUMBLE', 21),
    ('MS_IMITATE', 22), ('MS_WERE', 23), ('MS_ORC', 24), ('MS_HUMANOID', 25),
    ('MS_ARREST', 26), ('MS_SOLDIER', 27), ('MS_GUARD', 28), ('MS_DJINNI', 29),
    ('MS_NURSE', 30), ('MS_SEDUCE', 31), ('MS_VAMPIRE', 32), ('MS_BRIBE', 33),
    ('MS_CUSS', 34), ('MS_RIDER', 35), ('MS_LEADER', 36), ('MS_NEMESIS', 37),
    ('MS_GUARDIAN', 38), ('MS_SELL', 39), ('MS_ORACLE', 40), ('MS_PRIEST', 41),
    ('MS_SPELL', 42), ('MS_BOAST', 43), ('MS_GROAN', 44),
]
for name, val in ms_sounds:
    out.append(f'export const {name} = {val};')
out.append('')

# Sizes
out.append('// Monster sizes (from monflag.h)')
mz_sizes = [
    ('MZ_TINY', 0), ('MZ_SMALL', 1), ('MZ_MEDIUM', 2), ('MZ_HUMAN', 2),
    ('MZ_LARGE', 3), ('MZ_HUGE', 4), ('MZ_GIGANTIC', 7),
]
for name, val in mz_sizes:
    out.append(f'export const {name} = {val};')
out.append('')

# Colors
out.append('// Colors (from color.h)')
for name, val in sorted(CLR.items(), key=lambda x: x[1]):
    out.append(f'export const {name} = {val};')
out.append('')

# Weight constants
out.append('// Weight constants (from weight.h)')
for name, val in WT.items():
    out.append(f'export const {name} = {val};')
out.append('')

# PM_ constants
out.append('// Monster index constants (PM_*)')
for idx, mon in enumerate(monsters):
    out.append(f'export const PM_{mon["bn"]} = {idx};')
out.append(f'export const NUMMONS = {len(monsters)};')
out.append(f'export const NON_PM = -1;')
out.append(f'export const LOW_PM = 0;')
out.append(f'export const HIGH_PM = {len(monsters) - 1};')
# Find LONG_WORM_TAIL index
lwt_idx = None
for idx, mon in enumerate(monsters):
    if mon['bn'] == 'LONG_WORM_TAIL':
        lwt_idx = idx
        break
if lwt_idx is not None:
    out.append(f'export const SPECIAL_PM = PM_LONG_WORM_TAIL; // {lwt_idx}')
out.append('')

# Helper to convert flag expression to JS
def to_js_expr(s):
    """Convert a C flag expression to JS"""
    s = s.strip()
    if s == '0' or s == '0L':
        return '0'
    # Remove trailing L/UL from numbers
    s = re.sub(r'\b0x([0-9a-fA-F]+)UL\b', r'0x\1', s)
    s = re.sub(r'\b0x([0-9a-fA-F]+)L\b', r'0x\1', s)
    s = re.sub(r'(\d)L\b', r'\1', s)
    s = re.sub(r'(\d)UL\b', r'\1', s)
    return s

# The mons array
out.append('// The master monster array')
out.append('export const mons = [')

for idx, mon in enumerate(monsters):
    ln = line_nums[idx] if idx < len(line_nums) else 0

    # Format attacks
    attacks = mon['attacks']
    real_attacks = [a for a in attacks if a is not None]
    if not real_attacks:
        atk_str = '[]'
    else:
        atk_parts = []
        for a in real_attacks:
            atk_parts.append(f'{{ type: {a["type"]}, damage: {a["damage"]}, dice: {a["dice"]}, sides: {a["sides"]} }}')
        if len(atk_parts) <= 2:
            atk_str = '[' + ', '.join(atk_parts) + ']'
        else:
            atk_str = '[\n' + ',\n'.join('      ' + p for p in atk_parts) + '\n    ]'

    # Format geno
    geno = format_geno(mon['geno'])
    geno = to_js_expr(geno)

    # Format resistances and flags
    mr1 = to_js_expr(mon['mr1'])
    mr2 = to_js_expr(mon['mr2'])
    flags1 = to_js_expr(mon['flags1'])
    flags2 = to_js_expr(mon['flags2'])
    flags3 = to_js_expr(mon['flags3'])
    color = mon['color']

    name_escaped = mon['name'].replace("'", "\\'")

    out.append(f'  {{ // PM_{mon["bn"]} ({idx}) - monsters.h line {ln}')
    out.append(f"    name: '{name_escaped}',")
    out.append(f'    symbol: {mon["symbol"]},')
    out.append(f'    level: {mon["level"]}, speed: {mon["speed"]}, ac: {mon["ac"]}, mr: {mon["mr"]}, align: {mon["align"]},')
    out.append(f'    geno: {geno},')
    out.append(f'    attacks: {atk_str},')
    out.append(f'    weight: {mon["weight"]}, nutrition: {mon["nutrition"]},')
    out.append(f'    sound: {mon["sound"]}, size: {mon["size"]},')
    out.append(f'    mr1: {mr1}, mr2: {mr2},')
    out.append(f'    flags1: {flags1},')
    out.append(f'    flags2: {flags2},')
    out.append(f'    flags3: {flags3},')
    out.append(f'    difficulty: {mon["difficulty"]}, color: {color}')
    out.append(f'  }},')

out.append('];')
out.append('')
out.append('// End of monsters.js')

# Write the output
output_path = "js/monsters.js"
with open(output_path, 'w') as f:
    f.write('\n'.join(out))
    f.write('\n')

print(f"Generated {output_path} with {len(monsters)} monsters")
