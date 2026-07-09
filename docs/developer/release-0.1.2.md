# Forker 0.1.2 release readiness

Status: Ready for release publishing

Use this page to track the remaining work before publishing `v0.1.2`.

## Release scope

`0.1.2` is a preview release focused on branch/diff polish and release-process hardening.

Expected user-facing changes:

- Remote branch checkout support.
- Themed branch/ref colors.
- Simplified Changes header.
- Lazy diff loading fixes.
- App controller composition cleanup.
- New changelog and release validation process.

## Required validation

| Check | Status | Notes |
| --- | --- | --- |
| Version files set to `0.1.2` | Done | `package.json`, lockfile, Cargo, Tauri config. |
| `CHANGELOG.md` updated | Done | `0.1.2` section dated 2026-06-27. |
| Frontend build | Done | `npm run build` passed on 2026-06-27. |
| Backend tests | Done | `cargo test` passed on 2026-06-27: 11 passed. |
| Tauri package build | Done | `npm run tauri:build` passed on 2026-06-27. |
| Desktop smoke test | Pending | Use `docs/developer/release-process.md`. |
| Linux package validation | Pending | Validate AppImage, deb, and rpm on compatible environments. |
| macOS package validation | Not required unless shipping macOS packages | Signing/notarization owner setup is still needed. |
| Windows package validation | Not required unless shipping Windows packages | Signing owner setup is still needed. |
| Release notes drafted | Done | See `docs/developer/release-notes-0.1.2.md`. |

## Built artifacts

Latest local Linux package build produced:

- `src-tauri/target/release/bundle/appimage/forker_0.1.2_amd64.AppImage`
- `src-tauri/target/release/bundle/deb/forker_0.1.2_amd64.deb`
- `src-tauri/target/release/bundle/rpm/forker-0.1.2-1.x86_64.rpm`

These artifacts were produced by the local release build. Package-level launch/install validation should be recorded by the person publishing or distributing platform packages.

## Known issues to include in release notes

- Keyboard and screen-reader behavior still needs hardening for some complex controls.
- Some background refresh paths can still disturb file/commit selection.
- Git must already be installed on the user's system.
- No built-in merge-conflict editor, rebase UI, worktree management, submodule management, or hosting-provider integration yet.
- Public macOS/Windows distribution still requires platform-specific signing/notarization validation.

## Before tagging

1. Commit release prep.
2. Tag `v0.1.2`.
3. Push the commit and tag.
4. Create the GitHub/Gitea release with `docs/developer/release-notes-0.1.2.md`.
5. Attach validated package artifacts.
