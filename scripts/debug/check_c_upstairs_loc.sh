#!/bin/bash
# Check where upstairs actually is in C version by looking for '<' character

cd /share/u/davidbau/git/menace/nethack-c
./nethack --role=Valkyrie --race=human --name=Agent --gender=female --align=neutral --seed=99999 --headless <<'EOF' 2>&1 | head -25 | grep -E "^[│┌┐└┘├┤┬┴┼─ \.<>@d#·+]"
EOF
