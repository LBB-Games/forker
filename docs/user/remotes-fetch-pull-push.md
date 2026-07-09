# Remotes: fetch, pull, and push

Status: Current

## Fetch

Fetch updates remote-tracking refs without changing your working tree. Use fetch to learn whether remote branches changed.

## Pull

Pull fetches and integrates remote changes into your current branch. Git may stop if there are conflicts or if local changes would be overwritten.

## Push

Push sends local commits to the configured upstream branch. If no upstream exists, Forker may prompt for an upstream target.

## Ahead and behind

- **Ahead**: your branch has local commits not yet pushed.
- **Behind**: the remote has commits you do not have locally.
- **Diverged**: both local and remote have unique commits.

Forker should make divergence and push/pull risk visible before action.

## Authentication

Forker uses the system Git CLI, so authentication follows your existing SSH keys, credential helpers, and Git configuration.
