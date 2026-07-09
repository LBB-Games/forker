# Testing

Status: Current

## Frontend validation

Run from `forker/`:

```bash
npm run build
```

Use this as the default validation after frontend code changes.

## Visual audit

For meaningful visual changes, run the static visual audit when available. The audit checks high-priority workbench anti-patterns from the design system.

## Backend tests

Backend tests should use temporary Git repositories where possible. Test command behavior against real Git rather than mocks for important workflows.

Recommended coverage:

- repository validation,
- Git detection,
- snapshot loading,
- status parsing,
- diff parsing,
- stage/unstage/discard,
- commit,
- branch checkout/create,
- fetch/pull/push error handling,
- settings persistence,
- watcher debounce behavior.

## Manual smoke test

1. Start `npm run tauri:dev`.
2. Open a real test repository.
3. Confirm current branch, status, and commit log load.
4. Modify a file and confirm it appears in Changes.
5. Stage, unstage, and inspect the diff.
6. Commit in a disposable repository.
7. Fetch from a remote if configured.
8. Confirm errors remain visible and copyable.
