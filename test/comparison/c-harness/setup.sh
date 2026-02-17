#!/bin/bash
# test/comparison/c-harness/setup.sh -- Build the C NetHack binary for comparison tests
#
# Fetches the NetHack C source at a pinned commit, applies patches for
# deterministic seeding and map dumping, then builds a TTY-only binary.
#
# Idempotent: safe to re-run. Will skip clone if source exists at correct commit.
#
# Prerequisites:
#   Linux: gcc, make, bison, flex, ncurses-dev
#   macOS: Xcode command-line tools (xcode-select --install)
#
# Usage:
#   cd test/comparison/c-harness && bash setup.sh
#   # or from project root:
#   bash test/comparison/c-harness/setup.sh

set -euo pipefail

# --- OS Detection ---
OS="$(uname -s)"
case "$OS" in
    Linux)
        HINTS_FILE="sys/unix/hints/linux-minimal"
        LUA_SYSCFLAGS="-DLUA_USE_POSIX"
        NPROC="$(nproc)"
        sed_inplace() { sed -i "$@"; }
        ;;
    Darwin)
        HINTS_FILE="sys/unix/hints/macosx-minimal"
        LUA_SYSCFLAGS="-DLUA_USE_MACOSX"
        NPROC="$(sysctl -n hw.ncpu)"
        sed_inplace() { sed -i '' "$@"; }
        ;;
    *)
        echo "[FAIL] Unsupported OS: $OS"
        exit 1
        ;;
esac
echo "    OS detected: $OS"

# --- Configuration ---
NETHACK_REPO="https://github.com/NetHack/NetHack.git"
PINNED_COMMIT="79c688cc6"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
NETHACK_DIR="$PROJECT_ROOT/nethack-c"
PATCHES_DIR="$SCRIPT_DIR/patches"
BINARY="$NETHACK_DIR/src/nethack"

echo "=== WebHack C Harness Setup ==="
echo "    Project root: $PROJECT_ROOT"
echo "    NetHack source: $NETHACK_DIR"
echo "    Pinned commit: $PINNED_COMMIT"
echo ""

# --- Step 1: Ensure source exists at correct commit ---
if [ -d "$NETHACK_DIR/.git" ]; then
    CURRENT_COMMIT=$(cd "$NETHACK_DIR" && git rev-parse --short=9 HEAD)
    if [[ "$CURRENT_COMMIT" == "$PINNED_COMMIT"* ]]; then
        echo "[OK] Source exists at correct commit ($CURRENT_COMMIT)"
    else
        echo "[WARN] Source exists but at commit $CURRENT_COMMIT (expected $PINNED_COMMIT)"
        echo "       Checking out pinned commit..."
        (cd "$NETHACK_DIR" && git checkout "$PINNED_COMMIT")
    fi
else
    echo "[...] Cloning NetHack source..."
    git clone "$NETHACK_REPO" "$NETHACK_DIR"
    (cd "$NETHACK_DIR" && git checkout "$PINNED_COMMIT")
    echo "[OK] Cloned and checked out $PINNED_COMMIT"
fi
echo ""

# --- Step 2: Apply patches ---
echo "[...] Applying patches from $PATCHES_DIR"
cd "$NETHACK_DIR"

# Reset any previous patches (idempotent)
git checkout -- . 2>/dev/null || true

for patch in "$PATCHES_DIR"/*.patch; do
    if [ -f "$patch" ]; then
        PATCH_NAME=$(basename "$patch")
        echo "     Applying $PATCH_NAME..."
        git apply --recount "$patch"
        echo "     [OK] $PATCH_NAME applied"
    fi
done
echo ""

# --- Step 3: Configure build system ---
cd "$NETHACK_DIR"
INSTALL_PREFIX="$PROJECT_ROOT/nethack-c/install"
# On macOS, install our minimal hints file (no macosx-minimal in upstream)
if [ "$OS" = "Darwin" ]; then
    cp "$SCRIPT_DIR/macosx-minimal" sys/unix/hints/macosx-minimal
    # Replace PREFIX placeholder with actual project-local path
    sed_inplace "s|__NETHACK_PREFIX__|$INSTALL_PREFIX|g" sys/unix/hints/macosx-minimal
fi
# For Linux, patch the upstream linux-minimal hints PREFIX
if [ "$OS" = "Linux" ]; then
    sed_inplace "s|^\(PREFIX=\).*|\1$INSTALL_PREFIX|" sys/unix/hints/linux-minimal
fi
echo "[...] Running sys/unix/setup.sh with hints: $HINTS_FILE"
bash sys/unix/setup.sh "$HINTS_FILE"
echo "[OK] Build system configured"
echo ""

# --- Step 4: Fetch Lua (required dependency) ---
echo "[...] Fetching Lua..."
cd "$NETHACK_DIR"
if [ ! -f lib/lua-5.4.8/src/lua.h ]; then
    make fetch-lua
    echo "[OK] Lua fetched"
else
    echo "[OK] Lua already present"
fi
echo ""

# --- Step 5: Build ---
echo "[...] Building NetHack (TTY-only, $OS)"
cd "$NETHACK_DIR"
# Build Lua first (avoids parallel build race condition)
( cd lib/lua-5.4.8/src && make CC='cc' SYSCFLAGS="$LUA_SYSCFLAGS" a 2>&1 ) | tail -3
mkdir -p lib/lua
cp -f lib/lua-5.4.8/src/liblua.a lib/lua/liblua-5.4.8.a 2>/dev/null || true
# Now build the rest
make -j"$NPROC" 2>&1 | tail -5
echo ""

# --- Step 6: Install (copies data files to HACKDIR) ---
if [ -x "$BINARY" ]; then
    echo "[OK] Binary built successfully: $BINARY"
    echo "[...] Installing (copying data files)..."
    make install 2>&1 | tail -5
    INSTALL_DIR="$INSTALL_PREFIX/games/lib/nethackdir"
    if [ -d "$INSTALL_DIR" ]; then
        # Ensure sysconf exists (make install doesn't always copy it)
        if [ ! -f "$INSTALL_DIR/sysconf" ]; then
            cp "$NETHACK_DIR/sys/unix/sysconf" "$INSTALL_DIR/sysconf"
        fi
        # Allow all users to use wizard mode (needed for #dumpmap)
        sed_inplace 's/^WIZARDS=.*/WIZARDS=*/' "$INSTALL_DIR/sysconf"
        # Fix paths that may not exist on this platform (avoids "sysconf errors" on startup)
        sed_inplace 's|^GDBPATH=.*|#GDBPATH=/usr/bin/gdb|' "$INSTALL_DIR/sysconf"
        if [ "$OS" = "Darwin" ]; then
            sed_inplace 's|^GREPPATH=.*|GREPPATH=/usr/bin/grep|' "$INSTALL_DIR/sysconf"
        fi
        echo "[OK] Installed to $INSTALL_DIR"
    else
        echo "[WARN] Install directory not found at expected location"
    fi
    echo ""
else
    echo "[FAIL] Binary not found at $BINARY"
    echo "       Check build output above for errors."
    exit 1
fi

# --- Step 7: Verify ---
echo "=== Setup complete ==="
echo ""
echo "Installed to: $INSTALL_DIR"
echo ""
echo "To test deterministic map generation:"
echo "  export NETHACK_SEED=42"
echo "  export NETHACK_DUMPMAP=/tmp/map42.txt"
echo "  cd $NETHACK_DIR && src/nethack -u Wizard -D"
echo "  (in game: #dumpmap to write map to file)"

# Check for old global installation
OLD_INSTALL="$HOME/nethack-minimal"
if [ -d "$OLD_INSTALL" ]; then
    echo ""
    echo "NOTE: Old global installation found at $OLD_INSTALL"
    echo "      The C binary now installs to $INSTALL_PREFIX (project-local)."
    echo "      You can safely remove the old installation:"
    echo "        rm -rf $OLD_INSTALL"
fi
