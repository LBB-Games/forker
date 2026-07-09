# Quickstart

Status: Current

This guide gets you from launch to a basic commit.

## 1. Start the desktop app

```bash
cd forker
npm run tauri:dev
```

## 2. Open a repository

Use the open-repository screen or title-bar repository control to choose a local Git repository path.

Forker validates that the path is inside a Git repository, then loads branch, remote, tag, commit, status, and diff information from the native Git CLI.

## 3. Read repository state

Check the workbench for:

- current branch,
- changed file counts,
- ahead/behind state,
- latest job or error state,
- selected page: Changes or Commits.

## 4. Review changed files

Open the **Changes** page. Select a file from unstaged, staged, or untracked sections. Review the diff before acting.

## 5. Stage files

Use the file row action or context menu to stage files. Staged files move into the staged section.

## 6. Commit

Enter a commit message in the commit composer and commit the staged files.

If Git returns an error, Forker displays the error in the workbench so you can inspect or copy it.

## 7. Sync with remotes

Use **Fetch**, **Pull**, and **Push** from the toolbar when a remote is configured. Watch ahead/behind and job-state indicators before and after each action.
