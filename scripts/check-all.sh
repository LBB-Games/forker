#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Svelte type/component check"
npm run check:svelte

echo "==> Frontend production build"
npm run build

echo "==> Frontend accessibility smoke checks"
npm run check:a11y-smoke

echo "==> Tauri command manifest check"
npm run check:tauri-commands

echo "==> Rust format check"
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check

echo "==> Rust clippy"
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

echo "==> Rust check"
cargo check --manifest-path src-tauri/Cargo.toml

echo "==> All checks passed"
