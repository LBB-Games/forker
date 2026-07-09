# Forker 0.1.2

Forker 0.1.2 is a preview release focused on branch workflow polish, diff review stability, and a repeatable release process.

## Highlights

- Check out remote-only branches directly; Forker creates a local tracking branch for the selected remote branch.
- Branch and ref labels now use themed colors to make history and repository context easier to scan.
- Diff loading is more stable during change review.
- Release prep is now documented with a changelog, package checklist, and smoke-test guidance.

## Added

- Remote branch checkout support.
- Themed branch/ref colors.
- `CHANGELOG.md` for user-facing release history.
- `docs/developer/release-process.md` with pre-release, smoke-test, packaging, and release-note checklists.
- `docs/developer/release-0.1.2.md` to track this release's validation state.

## Changed

- Simplified the Changes header for a denser, more task-focused workbench.
- Refactored app controller composition to reduce large-component coupling.
- Improved lazy diff loading behavior for review sessions.
- Updated install docs to describe preview packages and the system Git requirement.

## Fixed

- Fixed lazy diff loading paths that could leave the diff pane stale or broken.

## Known issues

- Forker requires a working system `git` executable; Git is not bundled.
- Some keyboard and screen-reader paths still need hardening, especially complex menu/list interactions.
- Background refresh can still disturb file/commit selection in some review contexts.
- Merge-conflict editing, interactive rebase, worktree management, submodule management, and hosting-provider integration remain out of scope for this release.
- macOS and Windows public distribution still need owner-specific signing/notarization validation.

## Validation

Completed on 2026-06-27:

- Frontend build: `npm run build` passed.
- Rust tests: `cargo test` passed, 11 tests.
- Tauri package build: `npm run tauri:build` passed.
- Linux artifacts produced:
  - `forker_0.1.2_amd64.AppImage`
  - `forker_0.1.2_amd64.deb`
  - `forker-0.1.2-1.x86_64.rpm`

Package launch/install smoke-test results should be recorded by whoever publishes or distributes the artifacts.
