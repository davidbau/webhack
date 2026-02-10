#!/bin/bash
# Fix common syntax errors in level files

# Fix chance= to chance:
sed -i 's/, chance=/, chance:/g' js/levels/*.js

# Fix toterrain= to toterrain:
sed -i 's/, toterrain=/, toterrain:/g' js/levels/*.js

# Fix fromterrain= to fromterrain:
sed -i 's/, fromterrain=/, fromterrain:/g' js/levels/*.js

echo "Fixed common property syntax errors"
