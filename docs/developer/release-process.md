# Release process

Status: Current for `0.1.x` preview releases

Forker releases are currently preview releases. The process below is intentionally explicit so each release records what was validated, what was packaged, and what remains a known issue.

## Version policy

- Use semantic-ish pre-1.0 versions: `0.MINOR.PATCH`.
- Keep these files in sync before building packages:
  - `package.json`
  - `package-lock.json`
  - `src-tauri/Cargo.toml`
  - `src-tauri/Cargo.lock`
  - `src-tauri/tauri.conf.json`
- Tag releases as `vX.Y.Z` after validation is complete.

## Pre-release checklist

1. Confirm the working tree is clean or contains only intentional release changes.
2. Update versions in all package/config files.
3. Update `CHANGELOG.md` with user-facing additions, changes, fixes, and known issues.
4. Review `docs/product/roadmap.md` and `docs/product/milestones.md` for any release-blocking gaps.
5. Run automated validation from `forker/`:

   ```bash
   npm install
   npm run build
   cd src-tauri
   cargo test
   cd ..
   npm run tauri:build
   ```

6. Run the desktop smoke test below with a disposable repository.
7. Validate every target package on the platform where it was built.
8. Record platform-specific results in the release notes.
9. Commit release prep changes.
10. Create and push tag `vX.Y.Z`.
11. Attach packages/installers and release notes to the release.

## Desktop smoke test

Use a disposable local repository. Do not run destructive-operation smoke tests against important work.

To create a local bare remote plus disposable working copies for remote workflow testing:

```bash
npm run smoke:remote-fixture -- --dirty
```

Open the printed `workbench-repo` path in Forker. The fixture intentionally creates a local bare `origin.git`, a workbench clone whose `main` branch is one commit ahead and one commit behind `origin/main`, a `collaborator-repo` that can push more remote commits, an `origin/feature/remote-only` branch, a tag, one unstaged edit, and one untracked file.

1. Start the packaged app or `npm run tauri:dev`.
2. Open the disposable `workbench-repo` printed by the fixture script.
3. Confirm current branch, status counts, remotes/tags, ahead/behind state, and commit log load.
4. Modify a tracked file and create an untracked file.
5. Confirm both files appear in Changes with correct state labels.
6. Select each file and verify the diff is readable, scrollable, and not truncated.
7. Stage and unstage each file.
8. Stage both files, enter a commit message, and commit.
9. Confirm the new commit appears in the log and the working tree is clean.
10. Create a branch and check it out.
11. Fetch from the local bare remote.
12. Check out `origin/feature/remote-only` and confirm Forker creates a local tracking branch.
13. Return to `main`; confirm the diverged ahead/behind state is visible.
14. Pull from the local bare remote; the fixture should merge cleanly because local and remote commits touch different files.
15. Push `main` back to the local bare remote and confirm ahead/behind clears.
16. From the printed `collaborator-repo`, run an empty commit and push, then fetch in Forker to confirm new remote state appears.
17. Create and apply/drop a stash in the disposable repository.
18. Trigger at least one safe Git error and confirm the message remains visible and copyable.
19. Exercise keyboard paths for command palette, repository picker, dialogs, file list, and commit log.
20. Close and reopen the app; confirm recent repositories and settings persist.

## Package validation

### Linux

Validate each package produced by Tauri:

- `.AppImage`: launch directly, open a repo, complete a minimal smoke test.
- `.deb`: install on a clean Debian/Ubuntu-compatible environment, launch from app menu and terminal, then uninstall.
- `.rpm`: install on an RPM-compatible environment, launch from app menu and terminal, then uninstall.

### macOS

Before public macOS distribution, validate:

- `.dmg` or `.app` launches on a clean machine.
- Code signing identity is correct.
- Notarization succeeds.
- Gatekeeper allows first launch without unsafe-user workarounds.

### Windows

Before public Windows distribution, validate:

- Installer runs on a clean Windows machine.
- App launches from Start menu and install directory.
- Code signing identity is correct, if signing is enabled.
- Uninstall removes app files without deleting user repositories.

## Security and platform notes

- Forker currently uses the system `git`; releases must state that Git is required and not bundled.
- Review `src-tauri/tauri.conf.json` before each public release, especially CSP, updater public key, and bundle metadata.
- Avoid weakening Tauri permissions, shell access, or file-system scope without a matching ADR/security note.
- Do not run release smoke tests on repositories with valuable uncommitted work.

## Release notes template

```markdown
# Forker X.Y.Z

## Highlights

- ...

## Added

- ...

## Changed

- ...

## Fixed

- ...

## Known issues

- ...

## Validation

- Frontend build: pass/fail, date, platform
- Rust tests: pass/fail, date, platform
- Tauri build: pass/fail, date, platform
- Desktop smoke test: pass/fail, date, platform
- Package checks: list packages and platforms
```

## Changelog

Maintain `CHANGELOG.md` in the app root. Every tagged release should have a dated changelog section and matching release notes.
