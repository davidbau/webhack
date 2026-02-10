#!/usr/bin/env python3
"""
Post-process animation trace JSON files from instrumented C NetHack.

Adds human-readable names, validates structure, and enriches metadata.
"""

import json
import sys
import os
from pathlib import Path

# Display mode constants from NetHack display.h
DISP_MODES = {
    -1: "DISP_BEAM",
    -2: "DISP_ALL",
    -3: "DISP_TETHER",
    -4: "DISP_FLASH",
    -5: "DISP_ALWAYS",
    -6: "DISP_CHANGE",
    -7: "DISP_END",
    -8: "DISP_FREEMEM",
}

def process_trace(trace_file):
    """Process a single animation trace file."""
    print(f"Processing {trace_file}...")
    
    with open(trace_file, 'r') as f:
        data = json.load(f)
    
    if 'animation_events' not in data:
        print(f"  Warning: No animation_events in {trace_file}")
        return None
    
    # Enrich events with human-readable names
    for event in data['animation_events']:
        # Add mode names
        if 'mode' in event and event['mode'] is not None:
            event['mode_name'] = DISP_MODES.get(event['mode'], f"UNKNOWN_{event['mode']}")
        
        # Add glyph type (would need glyph database for real names)
        if 'glyph' in event and event['glyph'] is not None:
            # TODO: Look up actual glyph name from database
            event['glyph_type'] = f"glyph_{event['glyph']}"
    
    # Add summary statistics
    total_events = len(data['animation_events'])
    total_time = max((e.get('timestamp', 0) for e in data['animation_events']), default=0)
    delay_events = sum(1 for e in data['animation_events'] if e.get('call') == 'delay_output')
    display_events = sum(1 for e in data['animation_events'] if e.get('type') == 'display')
    
    data['summary'] = {
        'total_events': total_events,
        'total_time_ms': total_time,
        'delay_count': delay_events,
        'display_count': display_events,
        'avg_delay_ms': total_time / delay_events if delay_events > 0 else 0
    }
    
    print(f"  Events: {total_events}, Time: {total_time}ms, Delays: {delay_events}, Displays: {display_events}")
    
    return data

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 process_animation_traces.py <trace_file> [...]")
        print("   or: python3 process_animation_traces.py test/animations/traces/c/*.json")
        sys.exit(1)
    
    for trace_file in sys.argv[1:]:
        if not os.path.exists(trace_file):
            print(f"Error: {trace_file} not found")
            continue
        
        processed_data = process_trace(trace_file)
        
        if processed_data:
            # Write back to same file (or could write to new location)
            output_file = trace_file.replace('.json', '_processed.json')
            with open(output_file, 'w') as f:
                json.dump(processed_data, f, indent=2)
            print(f"  Saved to {output_file}")

if __name__ == '__main__':
    main()
