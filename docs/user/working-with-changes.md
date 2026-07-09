# Working with changes

Status: Current

The Changes page groups files by Git status.

## Sections

- **Unstaged**: modified/deleted files not yet staged.
- **Staged**: files included in the next commit.
- **Untracked**: new files Git does not track yet.

## Review before acting

Select a file to inspect its diff. Forker should not hide diff line content by default; use horizontal scrolling when needed.

## Actions

Typical file actions include:

- stage,
- unstage,
- discard,
- open related context menu actions.

Destructive actions should use a workbench-native confirmation dialog that explains the consequence.

## Refresh behavior

Repository state can refresh after Git actions, filesystem events, focus changes, or manual refresh. The app should preserve selected file/commit when the item still exists.
