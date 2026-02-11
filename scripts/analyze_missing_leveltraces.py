#!/usr/bin/env python3
"""Analyze which level traces are missing.

Compares js/levels/*.js files with leveltrace/*.json files to identify
which levels still need traces generated.
"""

import json
import os
from pathlib import Path
from collections import defaultdict

PROJECT_ROOT = Path(__file__).parent.parent
LEVELS_DIR = PROJECT_ROOT / 'js' / 'levels'
LEVELTRACE_DIR = PROJECT_ROOT / 'leveltrace'

def analyze_missing_traces():
    """Identify which levels are missing traces."""

    # Get all level files
    level_files = sorted(LEVELS_DIR.glob('*.js'))
    level_names_from_files = []

    for level_file in level_files:
        level_name = level_file.stem  # filename without .js extension
        level_names_from_files.append(level_name)

    print(f"Total level files in js/levels/: {len(level_names_from_files)}")

    # Load the inventory of extracted traces
    inventory_path = LEVELTRACE_DIR / 'inventory.json'
    if inventory_path.exists():
        with open(inventory_path) as f:
            level_inventory = json.load(f)
    else:
        level_inventory = {}

    print(f"Total unique level names with traces: {len(level_inventory)}")

    # Categorize levels
    have_traces = set(level_inventory.keys())
    need_traces = []

    # Map file names to trace names (some transformations needed)
    # e.g., soko1-1.js corresponds to soko1 trace (variant 1)
    #       bigrm-1.js corresponds to bigrm trace (variant 1)

    categories = defaultdict(list)

    for level_name in level_names_from_files:
        # Skip wrapper files
        if level_name in ['bigroom', 'medusa', 'themerms']:
            categories['wrappers'].append(level_name)
            continue

        # Check for direct match
        if level_name in have_traces:
            categories['have_direct_trace'].append(level_name)
            continue

        # Check for base name match (e.g., soko1-1 → soko1, bigrm-1 → bigrm)
        # Pattern: name-number
        if '-' in level_name:
            parts = level_name.rsplit('-', 1)
            base_name = parts[0]

            # For sokoban: soko1-1 → soko1, soko1-2 → soko1
            if base_name.startswith('soko') and parts[1].isdigit():
                if base_name in have_traces:
                    categories['sokoban_variants'].append(level_name)
                    continue

            # For bigroom: bigrm-1 → bigrm, etc.
            if base_name == 'bigrm' and parts[1].isdigit():
                if 'bigrm' in have_traces:
                    categories['bigroom_variants'].append(level_name)
                    continue

            # For medusa: medusa-1 → medusa, etc.
            if base_name == 'medusa' and parts[1].isdigit():
                if 'medusa' in have_traces:
                    categories['medusa_variants'].append(level_name)
                    continue

            # For minetown: minetn-1 → minetn, etc.
            if base_name == 'minetn' and parts[1].isdigit():
                if 'minetn' in have_traces:
                    categories['minetown_variants'].append(level_name)
                    continue

            # For mineend: minend-1 → minend, etc.
            if base_name == 'minend' and parts[1].isdigit():
                if 'minend' in have_traces:
                    categories['mineend_variants'].append(level_name)
                    continue

            # For quest fila/filb: Arc-fila → Arc quest, etc.
            # Quest naming: <Role>-strt, <Role>-loca, <Role>-fila, <Role>-filb, <Role>-goal
            role_code, quest_part = parts
            if quest_part in ['fila', 'filb', 'strt', 'loca', 'goal']:
                # Check if we have traces for this role's quest
                if f"{role_code}-strt" in have_traces:
                    categories['quest_levels_with_trace'].append(level_name)
                    continue
                else:
                    categories['quest_levels_no_trace'].append(level_name)
                    continue

        # No match found - definitely missing
        categories['definitely_missing'].append(level_name)

    # Print categorized results
    print("\n=== Level Trace Analysis ===\n")

    print(f"✓ Have direct traces ({len(categories['have_direct_trace'])}):")
    for name in sorted(categories['have_direct_trace']):
        print(f"  {name}")

    print(f"\n⚠ Variant levels (have base trace, not specific variant) ({len(categories['sokoban_variants']) + len(categories['bigroom_variants']) + len(categories['medusa_variants']) + len(categories['minetown_variants']) + len(categories['mineend_variants'])}):")

    if categories['sokoban_variants']:
        print(f"  Sokoban variants ({len(categories['sokoban_variants'])}):")
        for name in sorted(categories['sokoban_variants']):
            print(f"    {name}")

    if categories['bigroom_variants']:
        print(f"  Bigroom variants ({len(categories['bigroom_variants'])}):")
        for name in sorted(categories['bigroom_variants']):
            print(f"    {name}")

    if categories['medusa_variants']:
        print(f"  Medusa variants ({len(categories['medusa_variants'])}):")
        for name in sorted(categories['medusa_variants']):
            print(f"    {name}")

    if categories['minetown_variants']:
        print(f"  Minetown variants ({len(categories['minetown_variants'])}):")
        for name in sorted(categories['minetown_variants']):
            print(f"    {name}")

    if categories['mineend_variants']:
        print(f"  Mineend variants ({len(categories['mineend_variants'])}):")
        for name in sorted(categories['mineend_variants']):
            print(f"    {name}")

    print(f"\n⚠ Quest levels with base trace ({len(categories['quest_levels_with_trace'])}):")
    if categories['quest_levels_with_trace']:
        by_role = defaultdict(list)
        for name in categories['quest_levels_with_trace']:
            role = name.split('-')[0]
            by_role[role].append(name)
        for role in sorted(by_role.keys()):
            print(f"  {role}: {', '.join(sorted(by_role[role]))}")

    print(f"\n✗ Quest levels with NO trace ({len(categories['quest_levels_no_trace'])}):")
    if categories['quest_levels_no_trace']:
        by_role = defaultdict(list)
        for name in categories['quest_levels_no_trace']:
            role = name.split('-')[0]
            by_role[role].append(name)
        for role in sorted(by_role.keys()):
            print(f"  {role}: {', '.join(sorted(by_role[role]))}")

    print(f"\n✗ Definitely missing traces ({len(categories['definitely_missing'])}):")
    for name in sorted(categories['definitely_missing']):
        print(f"  {name}")

    print(f"\n~ Wrapper files (not individual levels) ({len(categories['wrappers'])}):")
    for name in sorted(categories['wrappers']):
        print(f"  {name}")

    # Summary
    print("\n=== Summary ===")
    total_files = len(level_names_from_files)
    have_direct = len(categories['have_direct_trace'])
    have_base = (len(categories['sokoban_variants']) +
                 len(categories['bigroom_variants']) +
                 len(categories['medusa_variants']) +
                 len(categories['minetown_variants']) +
                 len(categories['mineend_variants']) +
                 len(categories['quest_levels_with_trace']))
    missing = len(categories['definitely_missing']) + len(categories['quest_levels_no_trace'])
    wrappers = len(categories['wrappers'])

    print(f"Total level files: {total_files}")
    print(f"Have direct traces: {have_direct} ({have_direct/total_files*100:.1f}%)")
    print(f"Have base trace (variants): {have_base} ({have_base/total_files*100:.1f}%)")
    print(f"Missing traces: {missing} ({missing/total_files*100:.1f}%)")
    print(f"Wrapper files (skip): {wrappers} ({wrappers/total_files*100:.1f}%)")

    # Create detailed report
    report = {
        'total_files': total_files,
        'have_direct_trace': sorted(categories['have_direct_trace']),
        'sokoban_variants': sorted(categories['sokoban_variants']),
        'bigroom_variants': sorted(categories['bigroom_variants']),
        'medusa_variants': sorted(categories['medusa_variants']),
        'minetown_variants': sorted(categories['minetown_variants']),
        'mineend_variants': sorted(categories['mineend_variants']),
        'quest_levels_with_trace': sorted(categories['quest_levels_with_trace']),
        'quest_levels_no_trace': sorted(categories['quest_levels_no_trace']),
        'definitely_missing': sorted(categories['definitely_missing']),
        'wrappers': sorted(categories['wrappers']),
    }

    report_path = LEVELTRACE_DIR / 'missing_analysis.json'
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"\nDetailed report saved to {report_path}")

    return report

if __name__ == '__main__':
    analyze_missing_traces()
