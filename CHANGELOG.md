# Changelog

All notable user-facing changes to Forker are tracked here.

Forker is pre-1.0. Versions may include workflow, packaging, and interface changes while the core Git workbench stabilizes.

## [0.2.0] - 2026-07-08

### Added

- Release update dialog and settings update affordances that point users to GitHub Releases.
- Cross-platform install instructions with Linux distro-specific package guidance.
- Local remote fixture smoke-test script for branch/remote workflow validation.

### Changed

- Release packaging workflow and updater documentation were tightened for desktop bundle publishing.
- Theme tokens were refreshed across the bundled themes.

### Known issues

- Forker depends on a working system `git` executable; it does not bundle Git yet.
- Public macOS/Windows distribution still requires platform-specific signing/notarization validation.
- Some complex keyboard/screen-reader interactions may still need follow-up hardening.

## [0.1.3] - 2026-06-28

### Added

- Self-update support for signed desktop releases distributed through GitHub Releases.
- Resizable workbench panes for the sidebar, changed-file list, and commit details.
- Lightweight Git operation feedback for small file-level actions.

### Changed

- Background repository refreshes are quieter and less likely to interrupt active review work.
- File and commit selections are preserved more reliably across refreshes.
- Empty states and Git error guidance are more actionable.
- Keyboard and dialog accessibility paths were hardened for common workbench controls.

### Fixed

- Expanded Git operation safety coverage around destructive, branch, and remote workflows.
- Reduced refresh-related selection churn in review contexts.

### Known issues

- Release updater artifacts require the owner-held Tauri signing private key and must be generated in the release environment.
- The release process is source-driven and packaging is validated per platform; macOS and Windows signing/notarization still need owner-specific setup.
- Some keyboard and screen-reader paths may still need hardening in complex menu/list interactions.
- Full merge-conflict editing, interactive rebase, worktrees, submodules, and hosting-provider integration remain out of scope for this release.
- Forker depends on a working system `git` executable; it does not bundle Git yet.

## [0.1.2] - 2026-06-27

### Added

- Remote branch checkout support: checking out a remote-only branch creates a local tracking branch.
- Themed branch and ref colors for clearer history and branch context.
- Release readiness checklist and smoke-test guidance for repeatable packaging validation.

### Changed

- Simplified the Changes header to keep the workbench denser and more task-focused.
- Refactored app controller composition to reduce `App.svelte` responsibilities.
- Improved lazy diff loading behavior for more stable review sessions.

### Fixed

- Fixed lazy diff loading paths that could leave change review in a broken or stale state.

### Known issues

- The release process is source-driven and packaging is validated per platform; macOS and Windows signing/notarization still need owner-specific setup.
- Some keyboard and screen-reader paths still need hardening, especially complex menu/list interactions.
- Background refresh can still move selection in some review contexts.
- Full merge-conflict editing, interactive rebase, worktrees, submodules, and hosting-provider integration remain out of scope for this release.
- Forker depends on a working system `git` executable; it does not bundle Git yet.

## [0.1.1] - Previous development build

### Added

- Initial packaged Tauri desktop build flow.
- Core single-repository Git workbench: open repository, inspect status, review diffs, stage/unstage, commit, browse history, and run branch/remote/stash workflows.

[0.2.0]: https://github.com/LBB-Games/forker/releases/tag/v0.2.0
[0.1.3]: https://github.com/LBB-Games/forker/releases/tag/v0.1.3
[0.1.2]: https://github.com/LBB-Games/forker/releases/tag/v0.1.2
[0.1.1]: https://github.com/LBB-Games/forker/releases/tag/v0.1.1
