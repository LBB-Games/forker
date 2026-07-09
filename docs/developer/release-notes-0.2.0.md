# Forker 0.2.0

Forker 0.2.0 is a preview release focused on release/update polish, clearer install guidance, and workflow validation support.

## Highlights

- Added a dedicated release update dialog that links users to GitHub Releases.
- Improved the Settings update section and app update controller behavior.
- Added cross-platform install instructions, including Linux distro-specific notes for `.deb`, `.rpm`, AppImage, and NixOS usage.
- Added a local remote fixture smoke-test script for branch and remote workflow validation.
- Tightened release workflow and updater documentation.
- Refreshed bundled theme tokens.

## Install

Download the package for your platform from the `v0.2.0` GitHub Release:

- Windows: `.msi`
- macOS: `.dmg` or `.app.tar.gz`
- Debian/Ubuntu-family Linux: `.deb`
- Fedora/RHEL/openSUSE-family Linux: `.rpm`
- Other Linux distributions: `.AppImage`

See `README.md` for distro-specific Linux install commands and runtime notes.

## Known issues

- Forker requires a working system `git` executable.
- macOS and Windows public distribution may require owner-managed signing/notarization validation.
- Some complex keyboard and screen-reader interactions may still need hardening.
- Full merge-conflict editing, interactive rebase, worktrees, submodules, and hosting-provider integration remain out of scope for this release.
