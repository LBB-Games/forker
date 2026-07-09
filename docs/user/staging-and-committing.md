# Staging and committing

Status: Current

## Stage files

On the Changes page, choose files from the unstaged or untracked sections and stage them. Staged files are the files Git will include in the next commit.

## Unstage files

If a staged file should not be included, unstage it. The file returns to the unstaged section without discarding its content.

## Write a commit message

Use the commit composer. Keep the first line concise and explain why the change exists when needed.

## Commit

Commit is available when there are staged changes and a commit message. After a successful commit, Forker refreshes repository state.

## Common errors

- Empty commit message.
- No staged files.
- Git user name/email not configured.
- Hooks rejected the commit.
- Repository has unresolved conflicts.

When Git returns stderr, Forker shows it in the workbench.
