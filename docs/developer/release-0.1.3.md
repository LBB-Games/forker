# Forker 0.1.3 release readiness

Status: Historical preview release readiness notes

Use this page to track the remaining work before publishing `v0.1.3`.

## Release scope

`0.1.3` is a preview release focused on release notifications, resizable workbench panes, quieter refresh behavior, operation feedback, and accessibility/safety hardening.

Expected user-facing changes:

- Desktop update checks that link users to GitHub Releases.
- Resizable repository sidebar, changed-file list, and commit details panes.
- Quieter background repository refreshes.
- Better preservation of selected files and commits across refreshes.
- Lightweight feedback for Git operations.
- Improved empty states and Git error guidance.
- Keyboard/dialog accessibility hardening.
- Expanded Git operation safety tests.

## Required validation

| Check | Status | Notes |
| --- | --- | --- |
| Version files set to `0.1.3` | Done | `package.json`, lockfile, Cargo, Tauri config. |
| `CHANGELOG.md` updated | Done | `0.1.3` section dated 2026-06-28. |
| Frontend build | Done | `npm run build` passed on 2026-06-28. |
| Static visual audit | Done | No high-priority visual anti-patterns found on 2026-06-28. |
| Backend tests | Done | `cargo test` passed on 2026-06-28: 15 passed. |
| Tauri package build | Done | `npm run tauri:build` passed on 2026-06-28. |
| Desktop smoke test | Pending owner validation | Use `docs/developer/release-process.md`. |
| Linux package validation | Pending owner validation | Validate AppImage, deb, and rpm on compatible environments. |
| Release notification validation | Pending owner release environment | Install the previous release, publish `0.1.3`, then verify the Settings/update dialog links to GitHub Releases. |
| macOS package validation | Not required unless shipping macOS packages | Signing/notarization owner setup is still needed. |
| Windows package validation | Not required unless shipping Windows packages | Signing owner setup is still needed. |
| Release notes drafted | Done | See `docs/developer/release-notes-0.1.3.md`. |

## Built artifacts

Latest local Linux package build produced:

- `src-tauri/target/release/bundle/appimage/forker_0.1.3_amd64.AppImage`
- `src-tauri/target/release/bundle/deb/forker_0.1.3_amd64.deb`
- `src-tauri/target/release/bundle/rpm/forker-0.1.3-1.x86_64.rpm`

These artifacts were produced by the local release build. Package-level launch/install validation must be recorded by the person publishing or distributing platform packages.

## Known issues to include in release notes

- Git must already be installed on the user's system.
- Some complex keyboard/screen-reader interactions may still need follow-up hardening.
- No built-in merge-conflict editor, rebase UI, worktree management, submodule management, or hosting-provider integration yet.
- Public macOS/Windows distribution still requires platform-specific signing/notarization validation.

## Before tagging

1. Complete manual desktop smoke testing.
2. Run the GitHub Actions release workflow to generate packages.
3. Validate Linux packages and update notification behavior.
4. Commit release prep.
5. Tag `v0.1.3`.
6. Push the commit and tag.
7. Create or update the GitHub release with `docs/developer/release-notes-0.1.3.md`.
8. Attach/verify validated packages.
