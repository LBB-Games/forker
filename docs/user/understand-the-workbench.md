# Understand the workbench

Status: Current

Forker uses a compact desktop workbench layout.

```text
┌──────────────────────────────────────────────────────────────┐
│ Title bar: repository identity, Git actions, command entry   │
├──────────────┬───────────────────────────────────────────────┤
│ Navigator    │ Changes or Commits page                       │
│              │                                               │
│ Pages        │ Changes: files, diff, commit composer         │
│ Branches     │ Commits: graph/log and commit details         │
│ Remotes/tags │                                               │
├──────────────┴───────────────────────────────────────────────┤
│ Status bar: branch, ahead/behind, dirty state, job state      │
└──────────────────────────────────────────────────────────────┘
```

## Title bar

Shows repository identity and common Git actions such as fetch, pull, push, branch, stash, refresh, and command palette access.

## Navigator

Keeps repository context visible: current branch, page entries, local branches, remotes, and tags.

## Changes page

Use this page to review working-tree changes, stage or unstage files, discard changes, stash, and commit.

## Commits page

Use this page to inspect history, graph lanes, refs, author/date/hash metadata, changed files, and selected commit diffs.

## Status bar

Use the status bar to confirm current branch, sync state, dirty state, and background job state.
