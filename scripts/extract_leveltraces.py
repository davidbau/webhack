#!/usr/bin/env python3
"""Extract individual level traces from grouped session files.

Reads test/comparison/maps/seed*_special_*.session.json files and
extracts each level into a separate file in leveltrace/ directory.

Output naming: leveltrace/<levelname>_seed<N>.json
"""

import json
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
MAPS_DIR = PROJECT_ROOT / 'test' / 'comparison' / 'maps'
LEVELTRACE_DIR = PROJECT_ROOT / 'leveltrace'

def extract_leveltraces():
    """Extract individual levels from grouped trace files."""
    LEVELTRACE_DIR.mkdir(exist_ok=True)

    # Find all special session files
    session_files = sorted(MAPS_DIR.glob('seed*_special_*.session.json'))

    extracted_count = 0
    level_inventory = {}

    for session_file in session_files:
        print(f"Processing {session_file.name}...")

        with open(session_file) as f:
            session = json.load(f)

        seed = session['seed']
        group = session['group']

        # Extract each level from the session
        for level_data in session['levels']:
            level_name = level_data['levelName']

            # Track which levels we've seen
            if level_name not in level_inventory:
                level_inventory[level_name] = []
            level_inventory[level_name].append(seed)

            # Create individual level trace file
            output_filename = f"{level_name}_seed{seed}.json"
            output_path = LEVELTRACE_DIR / output_filename

            # Create a minimal trace for this level
            level_trace = {
                'version': 2,
                'seed': seed,
                'type': 'special',
                'source': 'c',
                'levelName': level_name,
                'branch': level_data['branch'],
                'typGrid': level_data['typGrid']
            }

            # Include optional fields if present
            if 'branchLevel' in level_data:
                level_trace['branchLevel'] = level_data['branchLevel']
            if 'nlevels' in level_data:
                level_trace['nlevels'] = level_data['nlevels']

            # Write with compact array formatting
            with open(output_path, 'w') as f:
                json.dump(level_trace, f, indent=2)

            extracted_count += 1
            print(f"  Extracted {level_name} (seed {seed}) → {output_filename}")

    print(f"\n=== Extraction Summary ===")
    print(f"Total levels extracted: {extracted_count}")
    print(f"Unique level names: {len(level_inventory)}")
    print(f"\nLevel inventory (seeds per level):")
    for level_name in sorted(level_inventory.keys()):
        seeds = level_inventory[level_name]
        print(f"  {level_name:20s} : seeds {', '.join(map(str, seeds))}")

    return level_inventory

def main():
    if not MAPS_DIR.exists():
        print(f"Error: Maps directory not found: {MAPS_DIR}")
        sys.exit(1)

    level_inventory = extract_leveltraces()

    # Save inventory for later analysis
    inventory_path = LEVELTRACE_DIR / 'inventory.json'
    with open(inventory_path, 'w') as f:
        json.dump(level_inventory, f, indent=2)
    print(f"\nInventory saved to {inventory_path}")

if __name__ == '__main__':
    main()
