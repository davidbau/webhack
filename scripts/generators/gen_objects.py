#!/usr/bin/env python3
"""
gen_objects.py — Parse NetHack objects.h and generate js/objects.js

This script reads the C macro definitions in objects.h and produces a
complete JavaScript data file with all ~450 objects faithfully ported.

Usage:
    python3 gen_objects.py > js/objects.js
"""

import re
import sys
import os

OBJECTS_H = os.path.join(os.path.dirname(__file__), 'nethack-c', 'include', 'objects.h')

# ── Color constants (matching display.js) ────────────────────────────
COLORS = {
    'CLR_BLACK': 0, 'CLR_RED': 1, 'CLR_GREEN': 2, 'CLR_BROWN': 3,
    'CLR_BLUE': 4, 'CLR_MAGENTA': 5, 'CLR_CYAN': 6, 'CLR_GRAY': 7,
    'CLR_BLACK': 0, 'CLR_ORANGE': 9, 'CLR_BRIGHT_GREEN': 10,
    'CLR_YELLOW': 11, 'CLR_BRIGHT_BLUE': 12,
    'CLR_BRIGHT_MAGENTA': 13, 'CLR_BRIGHT_CYAN': 14, 'CLR_WHITE': 15,
    'HI_METAL': 7, 'HI_COPPER': 11, 'HI_SILVER': 7, 'HI_GOLD': 11,
    'HI_LEATHER': 3, 'HI_CLOTH': 3, 'HI_ORGANIC': 3,
    'HI_WOOD': 3, 'HI_PAPER': 15, 'HI_GLASS': 14, 'HI_MINERAL': 7,
    'HI_ZAP': 9, 'DRAGON_SILVER': 7,
}

# ── Object class constants ───────────────────────────────────────────
OC_CLASSES = {
    'ILLOBJ_CLASS': 0, 'WEAPON_CLASS': 1, 'ARMOR_CLASS': 2,
    'RING_CLASS': 3, 'AMULET_CLASS': 4, 'TOOL_CLASS': 5,
    'FOOD_CLASS': 6, 'POTION_CLASS': 7, 'SCROLL_CLASS': 8,
    'SPBOOK_CLASS': 9, 'WAND_CLASS': 10, 'COIN_CLASS': 11,
    'GEM_CLASS': 12, 'ROCK_CLASS': 13, 'BALL_CLASS': 14,
    'CHAIN_CLASS': 15, 'VENOM_CLASS': 16,
}

# ── Material constants ───────────────────────────────────────────────
MATERIALS = {
    'LIQUID': 1, 'WAX': 2, 'VEGGY': 3, 'FLESH': 4, 'PAPER': 5,
    'CLOTH': 6, 'LEATHER': 7, 'WOOD': 8, 'BONE': 9, 'DRAGON_HIDE': 10,
    'IRON': 11, 'METAL': 12, 'COPPER': 13, 'SILVER': 14, 'GOLD': 15,
    'PLATINUM': 16, 'MITHRIL': 17, 'PLASTIC': 18, 'GLASS': 19,
    'GEMSTONE': 20, 'MINERAL': 21,
}

# ── Armor subtypes ───────────────────────────────────────────────────
ARM_SUBTYPES = {
    'ARM_SUIT': 0, 'ARM_SHIELD': 1, 'ARM_HELM': 2,
    'ARM_GLOVES': 3, 'ARM_BOOTS': 4, 'ARM_CLOAK': 5, 'ARM_SHIRT': 6,
}

# ── Weapon skill constants ───────────────────────────────────────────
WEAPON_SKILLS = {
    'P_NONE': 0,
    'P_DAGGER': 1, 'P_KNIFE': 2, 'P_AXE': 3, 'P_PICK_AXE': 4,
    'P_SHORT_SWORD': 5, 'P_BROAD_SWORD': 6, 'P_LONG_SWORD': 7,
    'P_TWO_HANDED_SWORD': 8, 'P_SABER': 9, 'P_CLUB': 10,
    'P_MACE': 11, 'P_MORNING_STAR': 12, 'P_FLAIL': 13,
    'P_HAMMER': 14, 'P_QUARTERSTAFF': 15, 'P_POLEARMS': 16,
    'P_SPEAR': 17, 'P_TRIDENT': 18, 'P_LANCE': 19,
    'P_BOW': 20, 'P_SLING': 21, 'P_CROSSBOW': 22,
    'P_DART': 23, 'P_SHURIKEN': 24, 'P_BOOMERANG': 25,
    'P_WHIP': 26, 'P_UNICORN_HORN': 27,
}

# ── Direction/attack types ───────────────────────────────────────────
DIRS = {
    'NODIR': 1, 'IMMEDIATE': 2, 'RAY': 3,
    'PIERCE': 1, 'SLASH': 2, 'WHACK': 3,
    'P': 1, 'S': 2, 'B': 3,
}

# ── Property constants ───────────────────────────────────────────────
PROPERTIES = {
    '0': 0, 'FIRE_RES': 1, 'COLD_RES': 2, 'SLEEP_RES': 3,
    'DISINT_RES': 4, 'SHOCK_RES': 5, 'POISON_RES': 6,
    'ACID_RES': 7, 'STONE_RES': 8,
    'ADORNED': 9, 'REGENERATION': 10, 'SEARCHING': 11,
    'SEE_INVIS': 12, 'INVIS': 13, 'TELEPORT': 14,
    'TELEPORT_CONTROL': 15, 'POLYMORPH': 16, 'POLYMORPH_CONTROL': 17,
    'LEVITATION': 18, 'STEALTH': 19, 'AGGRAVATE_MONSTER': 20,
    'CONFLICT': 21, 'PROTECTION': 22, 'WARNING': 23,
    'TELEPAT': 24, 'FAST': 25, 'STUNNED': 26, 'CONFUSION': 27,
    'BLINDED': 28, 'SICK': 29, 'STRANGLED': 30, 'HALLUC': 31,
    'FUMBLING': 32, 'WOUNDED_LEGS': 33, 'SLEEPY': 34,
    'HUNGER': 35, 'FREE_ACTION': 36, 'SLOW_DIGESTION': 37,
    'LIFESAVED': 38, 'REFLECTING': 39, 'ANTIMAGIC': 40,
    'DISPLACED': 41, 'CLAIRVOYANT': 42, 'FLYING': 43,
    'UNCHANGING': 44, 'FIXED_ABIL': 45, 'WWALKING': 46,
    'JUMPING': 47, 'MAGICAL_BREATHING': 48,
    'PROT_FROM_SHAPE_CHANGERS': 49,
}


def resolve_color(s):
    s = s.strip()
    return COLORS.get(s, 0)

def resolve_class(s):
    s = s.strip()
    return OC_CLASSES.get(s, 0)

def resolve_material(s):
    s = s.strip()
    return MATERIALS.get(s, 0)

def resolve_skill(s):
    s = s.strip()
    neg = False
    if s.startswith('-'):
        neg = True
        s = s[1:]
    v = WEAPON_SKILLS.get(s, 0)
    return -v if neg else v

def resolve_dir(s):
    s = s.strip()
    # Handle combined like P|S or B|P
    if '|' in s:
        parts = s.split('|')
        return sum(DIRS.get(p.strip(), 0) for p in parts)
    return DIRS.get(s, 0)

def resolve_prop(s):
    s = s.strip()
    return PROPERTIES.get(s, 0)

def resolve_int(s):
    s = s.strip()
    try:
        return int(s)
    except ValueError:
        return 0

def parse_string(s):
    """Extract string from C string literal or NoDes"""
    s = s.strip()
    if s == 'NoDes' or s == '(char *) 0' or s == '0':
        return None
    m = re.match(r'^"(.*)"$', s)
    if m:
        return m.group(1)
    return None


def read_and_preprocess(path):
    """Read objects.h, strip comments, join continuation lines, skip #if 0 blocks."""
    with open(path, 'r') as f:
        lines = f.readlines()

    # Track #if 0 / DEFERRED nesting
    result = []
    skip_depth = 0
    in_directive = False  # track multi-line preprocessor directives
    for line in lines:
        stripped = line.strip()
        if re.match(r'^#if\s+0', stripped) or '/* DEFERRED */' in stripped:
            skip_depth += 1
            continue
        if skip_depth > 0:
            if stripped.startswith('#if'):
                skip_depth += 1
            elif stripped.startswith('#endif'):
                skip_depth -= 1
            continue
        # Skip #ifdef MAIL_STRUCTURES section
        if stripped.startswith('#ifdef MAIL_STRUCTURES'):
            skip_depth += 1
            continue
        # Handle multi-line preprocessor directives
        if in_directive:
            # Still in a continuation of a #define or similar
            in_directive = stripped.endswith('\\')
            continue
        # Skip preprocessor directives (possibly multi-line)
        if stripped.startswith('#'):
            in_directive = stripped.endswith('\\')
            continue
        # Strip C comments
        line = re.sub(r'/\*.*?\*/', '', line)
        # Strip trailing comment
        line = re.sub(r'//.*$', '', line)
        result.append(line.rstrip())

    # Join continuation lines (ending with backslash) — shouldn't be many in data
    text = '\n'.join(result)
    text = re.sub(r'\\\n', ' ', text)
    # Strip multi-line C comments that span multiple lines
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
    return text


def extract_macro_calls(text):
    """Extract all top-level macro calls from the preprocessed text.
    Returns list of (macro_name, args_string, line_in_text)."""
    # Match patterns like WEAPON(...), ARMOR(...), etc.
    # Need to handle nested parens
    calls = []
    i = 0
    while i < len(text):
        # Look for a macro name followed by (
        m = re.match(r'([A-Z_][A-Z_0-9]*)\s*\(', text[i:])
        if m:
            macro_name = m.group(1)
            start = i + m.start()
            paren_start = i + m.end() - 1  # position of (
            # Find matching )
            depth = 1
            j = paren_start + 1
            while j < len(text) and depth > 0:
                if text[j] == '(':
                    depth += 1
                elif text[j] == ')':
                    depth -= 1
                j += 1
            if depth == 0:
                args_str = text[paren_start + 1 : j - 1]
                calls.append((macro_name, args_str))
                i = j
            else:
                i += 1
        else:
            i += 1
    return calls


def split_args(args_str):
    """Split macro arguments respecting nested parens and quotes."""
    args = []
    depth = 0
    current = ''
    in_string = False
    for ch in args_str:
        if ch == '"' and not in_string:
            in_string = True
            current += ch
        elif ch == '"' and in_string:
            in_string = False
            current += ch
        elif in_string:
            current += ch
        elif ch == '(':
            depth += 1
            current += ch
        elif ch == ')':
            depth -= 1
            current += ch
        elif ch == ',' and depth == 0:
            args.append(current.strip())
            current = ''
        else:
            current += ch
    if current.strip():
        args.append(current.strip())
    return args


def parse_obj_args(args_str):
    """Parse OBJ(name, desc) within an OBJECT() call."""
    m = re.match(r'OBJ\s*\((.*)\)', args_str.strip())
    if m:
        parts = split_args(m.group(1))
        return parse_string(parts[0]), parse_string(parts[1]) if len(parts) > 1 else None
    return None, None


def parse_bits_args(args_str):
    """Parse BITS(...) returning dict of flags."""
    m = re.match(r'BITS\s*\((.*)\)', args_str.strip())
    if not m:
        return {}
    parts = split_args(m.group(1))
    # BITS(nmkn,mrg,uskn,ctnr,mgc,chrg,uniq,nwsh,big,tuf,dir,sub,mtrl)
    keys = ['known', 'merge', 'uses_known', 'container', 'magic', 'charged',
            'unique', 'no_wish', 'big', 'tough', 'dir', 'sub', 'material']
    result = {}
    for i, k in enumerate(keys):
        if i < len(parts):
            val = parts[i].strip()
            if k == 'material':
                result[k] = resolve_material(val)
            elif k == 'sub':
                result[k] = resolve_skill(val)
            elif k == 'dir':
                result[k] = resolve_dir(val)
            else:
                result[k] = resolve_int(val)
    return result


objects = []
markers = {}
obj_index = 0


def add_object(name, desc, bits, prop, oc_class, prob, delay, wt,
               cost, sdam, ldam, oc1, oc2, nut, color, sn):
    global obj_index
    obj = {
        'index': obj_index,
        'name': name,
        'desc': desc,
        'oc_class': oc_class,
        'prob': prob,
        'delay': delay,
        'weight': wt,
        'cost': cost,
        'sdam': sdam,
        'ldam': ldam,
        'oc1': oc1,
        'oc2': oc2,
        'nutrition': nut,
        'color': color,
        'sn': sn,
        'prop': prop,
    }
    obj.update(bits)
    objects.append(obj)
    obj_index += 1
    return obj


def process_calls(calls):
    global obj_index
    # Known macro names we process
    KNOWN_MACROS = {
        'MARKER', 'OBJECT', 'GENERIC', 'WEAPON', 'PROJECTILE', 'BOW',
        'ARMOR', 'HELM', 'CLOAK', 'SHIELD', 'GLOVES', 'BOOTS', 'DRGN_ARMR',
        'RING', 'AMULET', 'TOOL', 'CONTAINER', 'EYEWEAR', 'WEPTOOL',
        'FOOD', 'POTION', 'SCROLL', 'XTRA_SCROLL_LABEL', 'SPELL',
        'WAND', 'COIN', 'GEM', 'ROCK',
    }
    for macro_name, args_str in calls:
        if macro_name not in KNOWN_MACROS:
            continue
        args = split_args(args_str)

        if macro_name == 'MARKER':
            # MARKER(tag, sn) — record marker
            tag = args[0].strip()
            sn = args[1].strip()
            # The marker value is the sn, which refers to a previously
            # defined enum. We'll just record it.
            markers[tag] = sn
            continue

        if macro_name == 'OBJECT':
            # Full OBJECT(OBJ(...), BITS(...), prp, sym, prob, dly, wt,
            #             cost, sdam, ldam, oc1, oc2, nut, color, sn)
            name, desc = parse_obj_args(args[0])
            bits = parse_bits_args(args[1])
            prop = resolve_prop(args[2])
            oc_class_str = args[3].strip()
            oc_class = resolve_class(oc_class_str)
            prob = resolve_int(args[4])
            delay = resolve_int(args[5])
            wt = resolve_int(args[6])
            cost = resolve_int(args[7])
            sdam = resolve_int(args[8])
            ldam = resolve_int(args[9])
            oc1 = resolve_int(args[10])
            oc2 = resolve_int(args[11])
            nut = resolve_int(args[12])
            color = resolve_color(args[13])
            sn = args[14].strip()
            add_object(name, desc, bits, prop, oc_class, prob, delay, wt,
                       cost, sdam, ldam, oc1, oc2, nut, color, sn)

        elif macro_name == 'GENERIC':
            # GENERIC(desc, class, gen_enum)
            desc_str = parse_string(args[0])
            oc_class = resolve_class(args[1])
            sn = args[2].strip()
            name = f"generic {desc_str}" if desc_str else "generic"
            bits = {'known': 0, 'merge': 0, 'uses_known': 0, 'container': 0,
                    'magic': 0, 'charged': 0, 'unique': 0, 'no_wish': 1,
                    'big': 0, 'tough': 0, 'dir': 0, 'sub': 0, 'material': 0}
            add_object(name, desc_str, bits, 0, oc_class, 0, 0, 0,
                       0, 0, 0, 0, 0, 0, 7, sn)

        elif macro_name == 'WEAPON':
            # WEAPON(name,desc,kn,mg,bi,prob,wt,cost,sdam,ldam,hitbon,typ,sub,metal,color,sn)
            name = parse_string(args[0])
            desc = parse_string(args[1])
            kn = resolve_int(args[2])
            mg = resolve_int(args[3])
            bi = resolve_int(args[4])
            prob = resolve_int(args[5])
            wt = resolve_int(args[6])
            cost = resolve_int(args[7])
            sdam = resolve_int(args[8])
            ldam = resolve_int(args[9])
            hitbon = resolve_int(args[10])
            typ = resolve_dir(args[11])
            sub = resolve_skill(args[12])
            metal = resolve_material(args[13])
            color = resolve_color(args[14])
            sn = args[15].strip()
            bits = {'known': kn, 'merge': mg, 'uses_known': 1, 'container': 0,
                    'magic': 0, 'charged': 1, 'unique': 0, 'no_wish': 0,
                    'big': bi, 'tough': 0, 'dir': typ, 'sub': sub, 'material': metal}
            add_object(name, desc, bits, 0, OC_CLASSES['WEAPON_CLASS'], prob, 0, wt,
                       cost, sdam, ldam, hitbon, 0, wt, color, sn)

        elif macro_name == 'PROJECTILE':
            # PROJECTILE(name,desc,kn,prob,wt,cost,sdam,ldam,hitbon,metal,sub,color,sn)
            name = parse_string(args[0])
            desc = parse_string(args[1])
            kn = resolve_int(args[2])
            prob = resolve_int(args[3])
            wt = resolve_int(args[4])
            cost = resolve_int(args[5])
            sdam = resolve_int(args[6])
            ldam = resolve_int(args[7])
            hitbon = resolve_int(args[8])
            metal = resolve_material(args[9])
            sub = resolve_skill(args[10])
            color = resolve_color(args[11])
            sn = args[12].strip()
            bits = {'known': kn, 'merge': 1, 'uses_known': 1, 'container': 0,
                    'magic': 0, 'charged': 1, 'unique': 0, 'no_wish': 0,
                    'big': 0, 'tough': 0, 'dir': DIRS['PIERCE'], 'sub': sub,
                    'material': metal}
            add_object(name, desc, bits, 0, OC_CLASSES['WEAPON_CLASS'], prob, 0, wt,
                       cost, sdam, ldam, hitbon, 0, wt, color, sn)

        elif macro_name == 'BOW':
            # BOW(name,desc,kn,prob,wt,cost,hitbon,metal,sub,color,sn)
            name = parse_string(args[0])
            desc = parse_string(args[1])
            kn = resolve_int(args[2])
            prob = resolve_int(args[3])
            wt = resolve_int(args[4])
            cost = resolve_int(args[5])
            hitbon = resolve_int(args[6])
            metal = resolve_material(args[7])
            sub = resolve_skill(args[8])
            color = resolve_color(args[9])
            sn = args[10].strip()
            bits = {'known': kn, 'merge': 0, 'uses_known': 1, 'container': 0,
                    'magic': 0, 'charged': 1, 'unique': 0, 'no_wish': 0,
                    'big': 0, 'tough': 0, 'dir': 0, 'sub': sub, 'material': metal}
            add_object(name, desc, bits, 0, OC_CLASSES['WEAPON_CLASS'], prob, 0, wt,
                       cost, 2, 2, hitbon, 0, wt, color, sn)

        elif macro_name == 'ARMOR':
            # ARMOR(name,desc,kn,mgc,blk,power,prob,delay,wt,cost,ac,can,sub,metal,c,sn)
            name = parse_string(args[0])
            desc = parse_string(args[1])
            kn = resolve_int(args[2])
            mgc = resolve_int(args[3])
            blk = resolve_int(args[4])
            power = resolve_prop(args[5])
            prob = resolve_int(args[6])
            delay = resolve_int(args[7])
            wt = resolve_int(args[8])
            cost = resolve_int(args[9])
            ac = resolve_int(args[10])
            can = resolve_int(args[11])
            sub_str = args[12].strip()
            sub = ARM_SUBTYPES.get(sub_str, 0)
            metal = resolve_material(args[13])
            color = resolve_color(args[14])
            sn = args[15].strip()
            bits = {'known': kn, 'merge': 0, 'uses_known': 1, 'container': 0,
                    'magic': mgc, 'charged': 1, 'unique': 0, 'no_wish': 0,
                    'big': blk, 'tough': 0, 'dir': 0, 'sub': sub, 'material': metal}
            add_object(name, desc, bits, power, OC_CLASSES['ARMOR_CLASS'], prob, delay, wt,
                       cost, 0, 0, 10 - ac, can, wt, color, sn)

        elif macro_name in ('HELM', 'CLOAK', 'SHIELD', 'GLOVES', 'BOOTS'):
            # These expand to ARMOR with specific sub type
            sub_map = {
                'HELM': 'ARM_HELM', 'CLOAK': 'ARM_CLOAK',
                'SHIELD': 'ARM_SHIELD', 'GLOVES': 'ARM_GLOVES',
                'BOOTS': 'ARM_BOOTS',
            }
            if macro_name == 'SHIELD':
                # SHIELD(name,desc,kn,mgc,blk,pow,prob,delay,wt,cost,ac,can,metal,c,sn)
                name = parse_string(args[0])
                desc = parse_string(args[1])
                kn = resolve_int(args[2])
                mgc = resolve_int(args[3])
                blk = resolve_int(args[4])
                power = resolve_prop(args[5])
                prob = resolve_int(args[6])
                delay = resolve_int(args[7])
                wt = resolve_int(args[8])
                cost = resolve_int(args[9])
                ac = resolve_int(args[10])
                can = resolve_int(args[11])
                metal = resolve_material(args[12])
                color = resolve_color(args[13])
                sn = args[14].strip()
            else:
                # HELM/CLOAK/GLOVES/BOOTS(name,desc,kn,mgc,power,prob,delay,wt,cost,ac,can,metal,c,sn)
                name = parse_string(args[0])
                desc = parse_string(args[1])
                kn = resolve_int(args[2])
                mgc = resolve_int(args[3])
                power = resolve_prop(args[4])
                prob = resolve_int(args[5])
                delay = resolve_int(args[6])
                wt = resolve_int(args[7])
                cost = resolve_int(args[8])
                ac = resolve_int(args[9])
                can = resolve_int(args[10])
                metal = resolve_material(args[11])
                color = resolve_color(args[12])
                sn = args[13].strip()
                blk = 0

            sub = ARM_SUBTYPES.get(sub_map[macro_name], 0)
            bits = {'known': kn, 'merge': 0, 'uses_known': 1, 'container': 0,
                    'magic': mgc, 'charged': 1, 'unique': 0, 'no_wish': 0,
                    'big': blk, 'tough': 0, 'dir': 0, 'sub': sub, 'material': metal}
            add_object(name, desc, bits, power, OC_CLASSES['ARMOR_CLASS'], prob, delay, wt,
                       cost, 0, 0, 10 - ac, can, wt, color, sn)

        elif macro_name == 'DRGN_ARMR':
            # DRGN_ARMR(name,mgc,power,cost,ac,color,snam)
            name = parse_string(args[0])
            mgc = resolve_int(args[1])
            power = resolve_prop(args[2])
            cost = resolve_int(args[3])
            ac = resolve_int(args[4])
            color = resolve_color(args[5])
            sn = args[6].strip()
            bits = {'known': 1, 'merge': 0, 'uses_known': 1, 'container': 0,
                    'magic': mgc, 'charged': 1, 'unique': 0, 'no_wish': 0,
                    'big': 1, 'tough': 0, 'dir': 0, 'sub': ARM_SUBTYPES['ARM_SUIT'],
                    'material': MATERIALS['DRAGON_HIDE']}
            add_object(name, None, bits, power, OC_CLASSES['ARMOR_CLASS'], 0, 5, 40,
                       cost, 0, 0, 10 - ac, 0, 40, color, sn)

        elif macro_name == 'RING':
            # RING(name,stone,power,cost,mgc,spec,mohs,metal,color,sn)
            name = parse_string(args[0])
            stone = parse_string(args[1])
            power = resolve_prop(args[2])
            cost = resolve_int(args[3])
            mgc = resolve_int(args[4])
            spec = resolve_int(args[5])
            mohs = resolve_int(args[6])
            metal = resolve_material(args[7])
            color = resolve_color(args[8])
            sn = args[9].strip()
            hardgem = 1 if mohs >= 8 else 0
            bits = {'known': 0, 'merge': 0, 'uses_known': spec, 'container': 0,
                    'magic': mgc, 'charged': spec, 'unique': 0, 'no_wish': 0,
                    'big': 0, 'tough': hardgem, 'dir': 0, 'sub': 0, 'material': metal}
            add_object(name, stone, bits, power, OC_CLASSES['RING_CLASS'], 1, 0, 3,
                       cost, 0, 0, 0, 0, 15, color, sn)

        elif macro_name == 'AMULET':
            # AMULET(name,desc,power,prob,sn)
            name = parse_string(args[0])
            desc = parse_string(args[1])
            power = resolve_prop(args[2])
            prob = resolve_int(args[3])
            sn = args[4].strip()
            bits = {'known': 0, 'merge': 0, 'uses_known': 0, 'container': 0,
                    'magic': 1, 'charged': 0, 'unique': 0, 'no_wish': 0,
                    'big': 0, 'tough': 0, 'dir': 0, 'sub': 0,
                    'material': MATERIALS['IRON']}
            add_object(name, desc, bits, power, OC_CLASSES['AMULET_CLASS'], prob, 0, 20,
                       150, 0, 0, 0, 0, 20, COLORS['HI_METAL'], sn)

        elif macro_name == 'TOOL':
            # TOOL(name,desc,kn,mrg,mgc,chg,prob,wt,cost,mat,color,sn)
            name = parse_string(args[0])
            desc = parse_string(args[1])
            kn = resolve_int(args[2])
            mrg = resolve_int(args[3])
            mgc = resolve_int(args[4])
            chg = resolve_int(args[5])
            prob = resolve_int(args[6])
            wt = resolve_int(args[7])
            cost = resolve_int(args[8])
            mat = resolve_material(args[9])
            color = resolve_color(args[10])
            sn = args[11].strip()
            bits = {'known': kn, 'merge': mrg, 'uses_known': chg, 'container': 0,
                    'magic': mgc, 'charged': chg, 'unique': 0, 'no_wish': 0,
                    'big': 0, 'tough': 0, 'dir': 0, 'sub': 0, 'material': mat}
            add_object(name, desc, bits, 0, OC_CLASSES['TOOL_CLASS'], prob, 0, wt,
                       cost, 0, 0, 0, 0, wt, color, sn)

        elif macro_name == 'CONTAINER':
            # CONTAINER(name,desc,kn,mgc,chg,prob,wt,cost,mat,color,sn)
            name = parse_string(args[0])
            desc = parse_string(args[1])
            kn = resolve_int(args[2])
            mgc = resolve_int(args[3])
            chg = resolve_int(args[4])
            prob = resolve_int(args[5])
            wt = resolve_int(args[6])
            cost = resolve_int(args[7])
            mat = resolve_material(args[8])
            color = resolve_color(args[9])
            sn = args[10].strip()
            bits = {'known': kn, 'merge': 0, 'uses_known': chg, 'container': 1,
                    'magic': mgc, 'charged': chg, 'unique': 0, 'no_wish': 0,
                    'big': 0, 'tough': 0, 'dir': 0, 'sub': 0, 'material': mat}
            add_object(name, desc, bits, 0, OC_CLASSES['TOOL_CLASS'], prob, 0, wt,
                       cost, 0, 0, 0, 0, wt, color, sn)

        elif macro_name == 'EYEWEAR':
            # EYEWEAR(name,desc,kn,prop,prob,wt,cost,mat,color,sn)
            name = parse_string(args[0])
            desc = parse_string(args[1])
            kn = resolve_int(args[2])
            prop = resolve_prop(args[3])
            prob = resolve_int(args[4])
            wt = resolve_int(args[5])
            cost = resolve_int(args[6])
            mat = resolve_material(args[7])
            color = resolve_color(args[8])
            sn = args[9].strip()
            bits = {'known': kn, 'merge': 0, 'uses_known': 0, 'container': 0,
                    'magic': 0, 'charged': 0, 'unique': 0, 'no_wish': 0,
                    'big': 0, 'tough': 0, 'dir': 0, 'sub': 0, 'material': mat}
            add_object(name, desc, bits, prop, OC_CLASSES['TOOL_CLASS'], prob, 0, wt,
                       cost, 0, 0, 0, 0, wt, color, sn)

        elif macro_name == 'WEPTOOL':
            # WEPTOOL(name,desc,kn,mgc,bi,prob,wt,cost,sdam,ldam,hitbon,sub,mat,clr,sn)
            name = parse_string(args[0])
            desc = parse_string(args[1])
            kn = resolve_int(args[2])
            mgc = resolve_int(args[3])
            bi = resolve_int(args[4])
            prob = resolve_int(args[5])
            wt = resolve_int(args[6])
            cost = resolve_int(args[7])
            sdam = resolve_int(args[8])
            ldam = resolve_int(args[9])
            hitbon_str = args[10].strip()
            hitbon = resolve_dir(hitbon_str)  # Could be WHACK, PIERCE, etc.
            sub = resolve_skill(args[11])
            mat = resolve_material(args[12])
            color = resolve_color(args[13])
            sn = args[14].strip()
            bits = {'known': kn, 'merge': 0, 'uses_known': 1, 'container': 0,
                    'magic': mgc, 'charged': 1, 'unique': 0, 'no_wish': 0,
                    'big': bi, 'tough': 0, 'dir': hitbon, 'sub': sub, 'material': mat}
            add_object(name, desc, bits, 0, OC_CLASSES['TOOL_CLASS'], prob, 0, wt,
                       cost, sdam, ldam, hitbon, 0, wt, color, sn)

        elif macro_name == 'FOOD':
            # FOOD(name, prob, delay, wt, unk, tin, nutrition, color, sn)
            name = parse_string(args[0])
            prob = resolve_int(args[1])
            delay = resolve_int(args[2])
            wt = resolve_int(args[3])
            unk = resolve_int(args[4])
            tin = resolve_material(args[5])
            nutrition = resolve_int(args[6])
            color = resolve_color(args[7])
            sn = args[8].strip()
            food_cost = nutrition // 20 + 5
            bits = {'known': 1, 'merge': 1, 'uses_known': unk, 'container': 0,
                    'magic': 0, 'charged': 0, 'unique': 0, 'no_wish': 0,
                    'big': 0, 'tough': 0, 'dir': 0, 'sub': 0, 'material': tin}
            add_object(name, None, bits, 0, OC_CLASSES['FOOD_CLASS'], prob, delay, wt,
                       food_cost, 0, 0, 0, 0, nutrition, color, sn)

        elif macro_name == 'POTION':
            # POTION(name,desc,mgc,power,prob,cost,color,sn)
            name = parse_string(args[0])
            desc = parse_string(args[1])
            mgc = resolve_int(args[2])
            power = resolve_prop(args[3])
            prob = resolve_int(args[4])
            cost = resolve_int(args[5])
            color = resolve_color(args[6])
            sn = args[7].strip()
            bits = {'known': 0, 'merge': 1, 'uses_known': 0, 'container': 0,
                    'magic': mgc, 'charged': 0, 'unique': 0, 'no_wish': 0,
                    'big': 0, 'tough': 0, 'dir': 0, 'sub': 0,
                    'material': MATERIALS['GLASS']}
            add_object(name, desc, bits, power, OC_CLASSES['POTION_CLASS'], prob, 0, 20,
                       cost, 0, 0, 0, 0, 10, color, sn)

        elif macro_name == 'XTRA_SCROLL_LABEL':
            # XTRA_SCROLL_LABEL(text, sn) → SCROLL(NoDes, text, 1, 0, 100, sn)
            text = parse_string(args[0])
            sn = args[1].strip()
            name = None
            mgc = 1
            prob = 0
            cost = 100
            bits = {'known': 0, 'merge': 1, 'uses_known': 0, 'container': 0,
                    'magic': mgc, 'charged': 0, 'unique': 0, 'no_wish': 0,
                    'big': 0, 'tough': 0, 'dir': 0, 'sub': 0,
                    'material': MATERIALS['PAPER']}
            add_object(name, text, bits, 0, OC_CLASSES['SCROLL_CLASS'], prob, 0, 5,
                       cost, 0, 0, 0, 0, 6, COLORS['HI_PAPER'], sn)

        elif macro_name == 'SCROLL':
            # SCROLL(name,text,mgc,prob,cost,sn)
            name = parse_string(args[0])
            text = parse_string(args[1])
            mgc = resolve_int(args[2])
            prob = resolve_int(args[3])
            cost = resolve_int(args[4])
            sn = args[5].strip()
            bits = {'known': 0, 'merge': 1, 'uses_known': 0, 'container': 0,
                    'magic': mgc, 'charged': 0, 'unique': 0, 'no_wish': 0,
                    'big': 0, 'tough': 0, 'dir': 0, 'sub': 0,
                    'material': MATERIALS['PAPER']}
            add_object(name, text, bits, 0, OC_CLASSES['SCROLL_CLASS'], prob, 0, 5,
                       cost, 0, 0, 0, 0, 6, COLORS['HI_PAPER'], sn)

        elif macro_name == 'SPELL':
            # SPELL(name,desc,sub,prob,delay,level,mgc,dir,color,sn)
            name = parse_string(args[0])
            desc = parse_string(args[1])
            sub_str = args[2].strip()
            sub = resolve_skill(sub_str) if sub_str in WEAPON_SKILLS else 0
            prob = resolve_int(args[3])
            delay = resolve_int(args[4])
            level = resolve_int(args[5])
            mgc = resolve_int(args[6])
            direction = resolve_dir(args[7])
            color = resolve_color(args[8])
            sn = args[9].strip()
            bits = {'known': 0, 'merge': 0, 'uses_known': 0, 'container': 0,
                    'magic': mgc, 'charged': 0, 'unique': 0, 'no_wish': 0,
                    'big': 0, 'tough': 0, 'dir': direction, 'sub': sub,
                    'material': MATERIALS['PAPER']}
            add_object(name, desc, bits, 0, OC_CLASSES['SPBOOK_CLASS'], prob, delay, 50,
                       level * 100, 0, 0, 0, level, 20, color, sn)

        elif macro_name == 'WAND':
            # WAND(name,typ,prob,cost,mgc,dir,metal,color,sn)
            name = parse_string(args[0])
            typ = parse_string(args[1])
            prob = resolve_int(args[2])
            cost = resolve_int(args[3])
            mgc = resolve_int(args[4])
            direction = resolve_dir(args[5])
            metal = resolve_material(args[6])
            color = resolve_color(args[7])
            sn = args[8].strip()
            bits = {'known': 0, 'merge': 0, 'uses_known': 1, 'container': 0,
                    'magic': mgc, 'charged': 1, 'unique': 0, 'no_wish': 0,
                    'big': 0, 'tough': 0, 'dir': direction, 'sub': 0, 'material': metal}
            add_object(name, typ, bits, 0, OC_CLASSES['WAND_CLASS'], prob, 0, 7,
                       cost, 0, 0, 0, 0, 30, color, sn)

        elif macro_name == 'COIN':
            # COIN(name,prob,metal,worth,sn)
            name = parse_string(args[0])
            prob = resolve_int(args[1])
            metal = resolve_material(args[2])
            worth = resolve_int(args[3])
            sn = args[4].strip()
            bits = {'known': 1, 'merge': 1, 'uses_known': 0, 'container': 0,
                    'magic': 0, 'charged': 0, 'unique': 0, 'no_wish': 0,
                    'big': 0, 'tough': 0, 'dir': 0, 'sub': 0, 'material': metal}
            add_object(name, None, bits, 0, OC_CLASSES['COIN_CLASS'], prob, 0, 1,
                       worth, 0, 0, 0, 0, 0, COLORS['HI_GOLD'], sn)

        elif macro_name == 'GEM':
            # GEM(name,desc,prob,wt,gval,nutr,mohs,glass,color,sn)
            name = parse_string(args[0])
            desc = parse_string(args[1])
            prob = resolve_int(args[2])
            wt = resolve_int(args[3])
            gval = resolve_int(args[4])
            nutr = resolve_int(args[5])
            mohs = resolve_int(args[6])
            glass = resolve_material(args[7])
            color = resolve_color(args[8])
            sn = args[9].strip()
            hardgem = 1 if mohs >= 8 else 0
            bits = {'known': 0, 'merge': 1, 'uses_known': 0, 'container': 0,
                    'magic': 0, 'charged': 0, 'unique': 0, 'no_wish': 0,
                    'big': 0, 'tough': hardgem, 'dir': 0, 'sub': 0, 'material': glass}
            add_object(name, desc, bits, 0, OC_CLASSES['GEM_CLASS'], prob, 0, wt,
                       gval, 3, 3, 0, 0, nutr, color, sn)

        elif macro_name == 'ROCK':
            # ROCK(name,desc,kn,prob,wt,gval,sdam,ldam,mgc,nutr,mohs,glass,colr,sn)
            name = parse_string(args[0])
            desc = parse_string(args[1])
            kn = resolve_int(args[2])
            prob = resolve_int(args[3])
            wt = resolve_int(args[4])
            gval = resolve_int(args[5])
            sdam = resolve_int(args[6])
            ldam = resolve_int(args[7])
            mgc = resolve_int(args[8])
            nutr = resolve_int(args[9])
            mohs = resolve_int(args[10])
            glass = resolve_material(args[11])
            color = resolve_color(args[12])
            sn = args[13].strip()
            hardgem = 1 if mohs >= 8 else 0
            bits = {'known': kn, 'merge': 1, 'uses_known': 0, 'container': 0,
                    'magic': mgc, 'charged': 0, 'unique': 0, 'no_wish': 0,
                    'big': 0, 'tough': hardgem, 'dir': 0, 'sub': 0, 'material': glass}
            add_object(name, desc, bits, 0, OC_CLASSES['GEM_CLASS'], prob, 0, wt,
                       gval, sdam, ldam, 0, 0, nutr, color, sn)


def emit_js():
    """Generate the JavaScript output."""
    # Class symbols
    class_syms = {
        0: '?',   # ILLOBJ
        1: ')',   # WEAPON
        2: '[',   # ARMOR
        3: '=',   # RING
        4: '"',   # AMULET
        5: '(',   # TOOL
        6: '%',   # FOOD
        7: '!',   # POTION
        8: '?',   # SCROLL
        9: '+',   # SPBOOK
        10: '/',  # WAND
        11: '$',  # COIN
        12: '*',  # GEM
        13: '`',  # ROCK
        14: '0',  # BALL
        15: '_',  # CHAIN
        16: '.',  # VENOM
    }

    # Reverse maps for readable class names
    class_names = {v: k for k, v in OC_CLASSES.items()}
    mat_names = {v: k for k, v in MATERIALS.items()}

    lines = []
    lines.append('// objects.js — Complete NetHack object database')
    lines.append('// Auto-generated by gen_objects.py from nethack-c/include/objects.h')
    lines.append('// C ref: objects.h + objects.c — object data initialization')
    lines.append('// DO NOT EDIT BY HAND — regenerate with: python3 gen_objects.py > js/objects.js')
    lines.append('')
    lines.append('// ── Object Class Constants ─────────────────────────────────────')
    lines.append('// C ref: objclass.h')
    for name, val in sorted(OC_CLASSES.items(), key=lambda x: x[1]):
        lines.append(f'export const {name} = {val};')
    lines.append('')

    lines.append('// ── Material Constants ─────────────────────────────────────────')
    lines.append('// C ref: material.h')
    for name, val in sorted(MATERIALS.items(), key=lambda x: x[1]):
        lines.append(f'export const {name} = {val};')
    lines.append('')

    lines.append('// ── Armor Subtypes ─────────────────────────────────────────────')
    for name, val in sorted(ARM_SUBTYPES.items(), key=lambda x: x[1]):
        lines.append(f'export const {name} = {val};')
    lines.append('')

    lines.append('// ── Object Class Symbols ───────────────────────────────────────')
    lines.append('// C ref: defsym.h — OBJCLASS section')
    lines.append('export const CLASS_SYMBOLS = {')
    for cls, sym in sorted(class_syms.items()):
        cname = class_names.get(cls, f'CLASS_{cls}')
        esc_sym = sym.replace("'", "\\'").replace('"', '\\"')
        lines.append(f"    [{cls}]: '{esc_sym}', // {cname}")
    lines.append('};')
    lines.append('')

    lines.append('// ── Object Enum Constants ──────────────────────────────────────')
    lines.append('// C ref: decl.h — onames enum')
    for obj in objects:
        sn = obj['sn']
        # Skip invalid identifiers (like "0" for the sentinel)
        if not re.match(r'^[A-Za-z_][A-Za-z0-9_]*$', sn):
            continue
        lines.append(f"export const {sn} = {obj['index']};")
    lines.append(f'export const NUM_OBJECTS = {len(objects)};')
    lines.append('')

    # Markers — resolve expressions to numeric values
    lines.append('// ── Markers ─────────────────────────────────────────────────────')
    # Build a resolution context from all object sn values
    sn_map = {}
    for obj in objects:
        sn = obj['sn']
        if re.match(r'^[A-Za-z_][A-Za-z0-9_]*$', sn):
            sn_map[sn] = obj['index']
    for tag, sn_expr in markers.items():
        # Try to resolve the expression
        try:
            val = eval(sn_expr, {"__builtins__": {}}, sn_map)
            lines.append(f'export const {tag} = {val};')
            sn_map[tag] = val  # allow later markers to reference this
        except:
            lines.append(f'// export const {tag} = {sn_expr}; // unresolved')
    lines.append('')

    lines.append('// ── Object Data Array ──────────────────────────────────────────')
    lines.append('// C ref: objects.c — objects[] array')
    lines.append('// Each entry mirrors struct objclass fields.')
    lines.append('export const objectData = [')
    for obj in objects:
        name_str = f'"{obj["name"]}"' if obj['name'] else 'null'
        desc_str = f'"{obj["desc"]}"' if obj['desc'] else 'null'
        cname = class_names.get(obj['oc_class'], f'{obj["oc_class"]}')
        sym = class_syms.get(obj['oc_class'], '?')
        lines.append(f'    {{ // [{obj["index"]}] {obj["sn"]}')
        lines.append(f'        name: {name_str},')
        lines.append(f'        desc: {desc_str},')
        lines.append(f'        oc_class: {obj["oc_class"]}, // {cname}')
        lines.append(f"        symbol: '{sym}',")
        lines.append(f'        color: {obj["color"]},')
        lines.append(f'        prob: {obj["prob"]},')
        lines.append(f'        delay: {obj["delay"]},')
        lines.append(f'        weight: {obj["weight"]},')
        lines.append(f'        cost: {obj["cost"]},')
        lines.append(f'        sdam: {obj["sdam"]}, ldam: {obj["ldam"]},')
        lines.append(f'        oc1: {obj["oc1"]}, oc2: {obj["oc2"]},')
        lines.append(f'        nutrition: {obj["nutrition"]},')
        lines.append(f'        material: {obj.get("material", 0)},')
        lines.append(f'        prop: {obj["prop"]},')
        # Bit flags
        flags = []
        for flag in ['known', 'merge', 'uses_known', 'container',
                     'magic', 'charged', 'unique', 'no_wish', 'big', 'tough']:
            if obj.get(flag, 0):
                flags.append(flag)
        flags_str = ', '.join(f'{f}: 1' for f in flags) if flags else ''
        if flags_str:
            lines.append(f'        {flags_str},')
        lines.append(f'        dir: {obj.get("dir", 0)}, sub: {obj.get("sub", 0)},')
        lines.append(f'    }},')
    lines.append('];')
    lines.append('')

    lines.append(f'// Total objects: {len(objects)}')
    lines.append('')

    return '\n'.join(lines)


def main():
    text = read_and_preprocess(OBJECTS_H)
    calls = extract_macro_calls(text)
    process_calls(calls)
    js = emit_js()
    print(js)


if __name__ == '__main__':
    main()
