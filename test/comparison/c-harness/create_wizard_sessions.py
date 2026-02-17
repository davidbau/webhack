#!/usr/bin/env python3
"""Create wizard-mode sessions for all 13 classes with variety.

Seeds 201-213: One wizard-mode session per class with:
- Varying numbers of potions of gain level (5-20)
- Different wished items per class (mix of good and random)
- Different teleport depths (matching experience level from potions)
- Interactive exploration: pickup, use items, fight, explore
"""

import os
import sys
import subprocess
import random

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RUN_SESSION = os.path.join(SCRIPT_DIR, 'run_session.py')
SESSIONS_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..', 'sessions'))

# Character presets for each class
CLASSES = [
    ('archeologist', 201),
    ('barbarian', 202),
    ('caveman', 203),
    ('healer', 204),
    ('knight', 205),
    ('monk', 206),
    ('priest', 207),
    ('ranger', 208),
    ('rogue', 209),
    ('samurai', 210),
    ('tourist', 211),
    ('valkyrie', 212),
    ('wizard', 213),
]

# Pool of interesting items to wish for (mix of powerful and quirky)
WISH_ITEMS = {
    'armor': [
        'blessed +3 gray dragon scale mail',
        'blessed +3 silver dragon scale mail',
        'blessed +2 elven mithril-coat',
        'blessed +3 dwarvish mithril-coat',
        'blessed +2 crystal plate mail',
        'blessed +2 red dragon scale mail',
        'blessed +2 blue dragon scale mail',
    ],
    'boots': [
        'blessed +3 speed boots',
        'blessed +2 jumping boots',
        'blessed +2 water walking boots',
        'blessed +2 elven boots',
        'blessed +2 levitation boots',
    ],
    'helm': [
        'blessed +3 helm of brilliance',
        'blessed +2 helm of telepathy',
        'blessed +2 dunce cap',  # cursed in practice but interesting
        'blessed +2 cornuthaum',
    ],
    'gloves': [
        'blessed +3 gauntlets of power',
        'blessed +2 gauntlets of dexterity',
        'blessed +2 leather gloves',
    ],
    'cloak': [
        'blessed +2 cloak of magic resistance',
        'blessed +2 cloak of invisibility',
        'blessed +2 cloak of displacement',
        'blessed +2 oilskin cloak',
        'blessed +2 elven cloak',
    ],
    'amulet': [
        'blessed amulet of life saving',
        'blessed amulet of reflection',
        'blessed amulet of ESP',
        'amulet of magical breathing',
        'amulet versus poison',
    ],
    'ring': [
        'blessed ring of conflict',
        'blessed ring of free action',
        'ring of levitation',
        'ring of regeneration',
        'ring of teleport control',
        'ring of slow digestion',
        'ring of invisibility',
        'ring of fire resistance',
        'ring of cold resistance',
        'ring of see invisible',
    ],
    'wand': [
        'wand of death',
        'wand of wishing',
        'wand of teleportation',
        'wand of fire',
        'wand of cold',
        'wand of lightning',
        'wand of digging',
        'wand of polymorph',
        'wand of striking',
        'wand of slow monster',
        'wand of speed monster',
        'wand of create monster',
    ],
    'tool': [
        'blessed magic marker',
        'blessed bag of holding',
        'blessed unicorn horn',
        'blessed magic lamp',
        'blessed crystal ball',
        'blessed stethoscope',
        'blessed tinning kit',
        'blessed can of grease',
        'blessed +0 pick-axe',
        'skeleton key',
    ],
    'scroll': [
        'blessed scroll of genocide',
        'blessed scroll of charging',
        'blessed scroll of enchant weapon',
        'blessed scroll of enchant armor',
        'blessed scroll of identify',
        'scroll of magic mapping',
        'scroll of teleportation',
        'scroll of create monster',
    ],
    'potion': [
        'blessed potion of full healing',
        'blessed potion of extra healing',
        'blessed potion of gain ability',
        'potion of speed',
        'potion of invisibility',
        'potion of see invisible',
        'potion of monster detection',
        'potion of object detection',
    ],
    'weapon': [
        'blessed +3 silver saber',
        'blessed +2 long sword',
        'blessed +2 katana',
        'blessed +2 battle-axe',
        'blessed +2 dwarvish mattock',
        'blessed rustproof +2 dagger',
        'blessed +2 elven dagger',
        'blessed +2 crysknife',
    ],
    'food': [
        'blessed lembas wafer',
        'blessed food ration',
        'blessed tripe ration',
        'tin of spinach',
    ],
}

# Pre-defined variety for each class (deterministic for reproducibility)
CLASS_CONFIGS = {
    'archeologist': {
        'potions': 8,
        'teleport_level': 12,
        'wishes': [
            ('armor', 2),      # silver dragon scale mail
            ('boots', 0),      # speed boots
            ('tool', 1),       # bag of holding
            ('wand', 2),       # wand of teleportation
            ('ring', 4),       # ring of teleport control
            ('scroll', 5),     # scroll of magic mapping
        ],
    },
    'barbarian': {
        'potions': 15,
        'teleport_level': 18,
        'wishes': [
            ('armor', 0),      # gray dragon scale mail
            ('gloves', 0),     # gauntlets of power
            ('weapon', 3),     # battle-axe
            ('amulet', 0),     # life saving
            ('wand', 0),       # wand of death
            ('potion', 0),     # full healing
        ],
    },
    'caveman': {
        'potions': 12,
        'teleport_level': 15,
        'wishes': [
            ('armor', 4),      # crystal plate mail
            ('helm', 1),       # helm of telepathy
            ('tool', 2),       # unicorn horn
            ('wand', 4),       # wand of fire
            ('ring', 0),       # ring of conflict
            ('food', 0),       # lembas wafer
        ],
    },
    'healer': {
        'potions': 6,
        'teleport_level': 10,
        'wishes': [
            ('cloak', 0),      # cloak of magic resistance
            ('ring', 1),       # ring of free action
            ('tool', 4),       # crystal ball
            ('scroll', 1),     # scroll of charging
            ('wand', 6),       # wand of digging
            ('amulet', 2),     # amulet of ESP
        ],
    },
    'knight': {
        'potions': 10,
        'teleport_level': 14,
        'wishes': [
            ('armor', 0),      # gray dragon scale mail
            ('boots', 0),      # speed boots
            ('gloves', 1),     # gauntlets of dexterity
            ('weapon', 1),     # long sword
            ('amulet', 1),     # amulet of reflection
            ('wand', 1),       # wand of wishing
        ],
    },
    'monk': {
        'potions': 7,
        'teleport_level': 11,
        'wishes': [
            ('cloak', 1),      # cloak of invisibility
            ('boots', 1),      # jumping boots
            ('ring', 6),       # ring of invisibility
            ('amulet', 3),     # magical breathing
            ('tool', 0),       # magic marker
            ('potion', 3),     # potion of speed
        ],
    },
    'priest': {
        'potions': 9,
        'teleport_level': 13,
        'wishes': [
            ('armor', 1),      # silver dragon scale mail
            ('helm', 0),       # helm of brilliance
            ('cloak', 3),      # oilskin cloak
            ('wand', 5),       # wand of lightning
            ('scroll', 0),     # scroll of genocide
            ('ring', 9),       # ring of see invisible
        ],
    },
    'ranger': {
        'potions': 11,
        'teleport_level': 14,
        'wishes': [
            ('cloak', 4),      # elven cloak
            ('boots', 3),      # elven boots
            ('weapon', 6),     # elven dagger
            ('tool', 3),       # magic lamp
            ('wand', 3),       # wand of cold
            ('ring', 2),       # ring of levitation
        ],
    },
    'rogue': {
        'potions': 13,
        'teleport_level': 16,
        'wishes': [
            ('armor', 0),      # gray dragon scale mail
            ('cloak', 2),      # cloak of displacement
            ('tool', 8),       # pick-axe
            ('wand', 7),       # wand of polymorph
            ('ring', 3),       # ring of regeneration
            ('amulet', 4),     # amulet versus poison
        ],
    },
    'samurai': {
        'potions': 14,
        'teleport_level': 17,
        'wishes': [
            ('armor', 5),      # red dragon scale mail
            ('weapon', 2),     # katana
            ('boots', 0),      # speed boots
            ('helm', 1),       # helm of telepathy
            ('wand', 0),       # wand of death
            ('scroll', 2),     # scroll of enchant weapon
        ],
    },
    'tourist': {
        'potions': 20,         # tourists need lots of help!
        'teleport_level': 22,
        'wishes': [
            ('armor', 0),      # gray dragon scale mail
            ('boots', 0),      # speed boots
            ('helm', 0),       # helm of brilliance
            ('gloves', 0),     # gauntlets of power
            ('amulet', 0),     # life saving
            ('wand', 1),       # wand of wishing
            ('tool', 1),       # bag of holding
        ],
    },
    'valkyrie': {
        'potions': 10,
        'teleport_level': 14,
        'wishes': [
            ('armor', 1),      # silver dragon scale mail
            ('boots', 2),      # water walking boots
            ('gloves', 0),     # gauntlets of power
            ('ring', 7),       # ring of fire resistance
            ('wand', 4),       # wand of fire
            ('tool', 5),       # stethoscope
        ],
    },
    'wizard': {
        'potions': 5,          # wizards level up fast anyway
        'teleport_level': 9,
        'wishes': [
            ('cloak', 0),      # cloak of magic resistance
            ('ring', 4),       # ring of teleport control
            ('wand', 1),       # wand of wishing
            ('scroll', 1),     # scroll of charging
            ('tool', 0),       # magic marker
            ('potion', 2),     # potion of gain ability
        ],
    },
}

# Different exploration patterns for variety
EXPLORE_PATTERNS = [
    # Pattern 0: Wide sweep with pickups
    'hh,jj,ll,kk,.s',
    # Pattern 1: Diagonal explorer
    'yy,bb,nn,uu,.s',
    # Pattern 2: Spiral outward
    'hhhjjjlllkkk,.',
    # Pattern 3: Quick jabs with search
    'hlhljkjk,sss',
    # Pattern 4: Thorough room search
    'h,l,j,k,ssss.',
    # Pattern 5: Long corridors
    'hhhhhh,llllll,s',
    # Pattern 6: Combat ready (with fight prefix)
    'Fh.Fl.Fj.Fk,.',
    # Pattern 7: Zigzag
    'hjlk,hjlk,ss',
]


def build_wizard_moves(char_class):
    """Construct move sequence for wizard-mode gameplay with variety."""
    config = CLASS_CONFIGS[char_class]
    moves = []

    # Wish for potions of gain level (varying count)
    num_potions = config['potions']
    moves.append('#wish\n')
    moves.append(f'{num_potions} blessed potions of gain level\n')

    # Quaff all potions (they stack as item 'a')
    for _ in range(num_potions):
        moves.append('qa')

    # Wish for varied items based on class config
    item_letter = ord('b')  # Start assigning from 'b' since 'a' was potions
    wish_letters = {}

    for category, idx in config['wishes']:
        item = WISH_ITEMS[category][idx]
        moves.append('#wish\n')
        moves.append(f'{item}\n')
        wish_letters[category] = chr(item_letter)
        item_letter += 1

    # Equip items based on what we wished for
    for category, letter in wish_letters.items():
        if category == 'armor':
            moves.append(f'W{letter}')  # Wear armor
        elif category == 'boots':
            moves.append(f'W{letter}')  # Wear boots
        elif category == 'helm':
            moves.append(f'W{letter}')  # Wear helm
        elif category == 'gloves':
            moves.append(f'W{letter}')  # Wear gloves
        elif category == 'cloak':
            moves.append(f'W{letter}')  # Wear cloak
        elif category == 'amulet':
            moves.append(f'P{letter}')  # Put on amulet
        elif category == 'ring':
            moves.append(f'P{letter}')  # Put on ring
        elif category == 'weapon':
            moves.append(f'w{letter}')  # Wield weapon

    # Level teleport (Ctrl+V = \x16) to deep level
    teleport_level = config['teleport_level']
    moves.append('\x16')  # Ctrl+V for level teleport
    moves.append(f'{teleport_level}\n')

    # Interactive exploration for ~100 turns
    # Use different patterns based on class index for variety
    class_idx = [c[0] for c in CLASSES].index(char_class)

    # Mix of exploration patterns
    patterns_to_use = [
        EXPLORE_PATTERNS[class_idx % len(EXPLORE_PATTERNS)],
        EXPLORE_PATTERNS[(class_idx + 3) % len(EXPLORE_PATTERNS)],
        EXPLORE_PATTERNS[(class_idx + 5) % len(EXPLORE_PATTERNS)],
    ]

    # Build ~100 turns of exploration
    turns = 0
    pattern_idx = 0
    while turns < 100:
        pattern = patterns_to_use[pattern_idx % len(patterns_to_use)]
        moves.append(pattern)
        turns += len([c for c in pattern if c in 'hjklyubn.s'])
        pattern_idx += 1

        # Occasionally add extra actions
        if turns % 20 == 0:
            moves.append('i')  # Check inventory
        if turns % 30 == 0:
            moves.append(':')  # Look around
        if turns % 40 == 0 and 'wand' in wish_letters:
            # Zap a wand in a random direction
            moves.append(f'z{wish_letters["wand"]}.')  # Zap at self/down
        if turns % 50 == 0 and 'scroll' in wish_letters:
            moves.append(f'r{wish_letters["scroll"]}')  # Read a scroll

    return ''.join(moves)


def create_wizard_session(char_class, seed):
    """Create a single wizard-mode session."""
    output = os.path.join(SESSIONS_DIR, f'seed{seed}_{char_class}_wizard.session.json')
    moves = build_wizard_moves(char_class)

    print(f'\n=== Creating wizard session: seed={seed}, class={char_class} ===')
    config = CLASS_CONFIGS[char_class]
    print(f'    Potions: {config["potions"]}, Teleport to: Dlvl:{config["teleport_level"]}')
    print(f'    Wishes: {[WISH_ITEMS[cat][idx].split()[-1] for cat, idx in config["wishes"]]}')
    print(f'    Moves length: {len(moves)} characters')

    # Run the session
    cmd = [
        sys.executable, RUN_SESSION,
        str(seed), output,
        moves,
        '--character', char_class
    ]

    result = subprocess.run(cmd, capture_output=False)

    if result.returncode == 0:
        print(f'SUCCESS: {output}')
        return True
    else:
        print(f'FAILED: seed={seed}, class={char_class}')
        return False


def main():
    os.makedirs(SESSIONS_DIR, exist_ok=True)

    # Check which seed to start from (for resuming)
    start_seed = int(sys.argv[1]) if len(sys.argv) > 1 else 201

    # Single class mode
    single_class = sys.argv[2] if len(sys.argv) > 2 else None

    success_count = 0
    fail_count = 0

    for char_class, seed in CLASSES:
        if seed < start_seed:
            continue
        if single_class and char_class != single_class:
            continue

        if create_wizard_session(char_class, seed):
            success_count += 1
        else:
            fail_count += 1

    print(f'\n=== Summary ===')
    print(f'Success: {success_count}')
    print(f'Failed: {fail_count}')


if __name__ == '__main__':
    main()
