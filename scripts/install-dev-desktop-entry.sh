#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPLICATIONS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
DESKTOP_FILE="$APPLICATIONS_DIR/forker-dev.desktop"
ICON_PATH="$ROOT_DIR/src-tauri/icons/icon.png"

mkdir -p "$APPLICATIONS_DIR"

cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=forker (dev)
Comment=Forker Tauri development build
Exec=sh -lc 'cd "$ROOT_DIR" && npm run tauri:dev'
Icon=$ICON_PATH
Terminal=true
Categories=Development;
StartupWMClass=forker
EOF

chmod 0644 "$DESKTOP_FILE"
update-desktop-database "$APPLICATIONS_DIR" >/dev/null 2>&1 || true

echo "Installed $DESKTOP_FILE"
echo "Run npm run tauri:dev again; GNOME/Ubuntu should now match StartupWMClass=forker to the Forker icon."
