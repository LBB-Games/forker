# ADR 0005: Use workbench-native confirmations for destructive actions

## Status

Accepted

## Context

Git operations such as discard, reset, and some stash flows can destroy or move uncommitted work. Browser-native `confirm()` dialogs are inconsistent with the workbench, cannot show rich affected-file context, and provide limited accessibility control.

## Decision

Use workbench-native dialogs for destructive or risky actions. Dialogs should explain the consequence, identify affected work where practical, use explicit destructive labels, move focus inside, trap focus while open, close on Escape, and restore focus afterward.

## Consequences

Benefits:

- Risk is clearer.
- Dialogs match product design.
- Accessibility behavior is controllable.
- Future destructive flows can share one pattern.

Costs:

- Requires maintained dialog primitives.
- Each operation needs carefully written consequence copy.
