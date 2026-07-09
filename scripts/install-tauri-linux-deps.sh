#!/usr/bin/env bash
set -euo pipefail

if ! command -v apt >/dev/null 2>&1; then
  echo "This helper currently supports apt-based Linux distributions only." >&2
  exit 1
fi

sudo apt update
sudo apt install -y \
  build-essential \
  curl \
  wget \
  file \
  pkg-config \
  libssl-dev \
  libdbus-1-dev \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
