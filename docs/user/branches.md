# Branches

Status: Current

## Current branch

The current branch is shown in the navigator and status bar. Branch state should be visible through text and icons, not color alone.

## Checkout a branch

Select a local branch from the navigator or branch action. Forker runs Git checkout through the backend and refreshes repository state afterward.

Before checkout, make sure your working tree is safe. Git may block checkout if local changes would be overwritten.

## Create a branch

Use the branch creation action. The app should request a branch name and create it from the selected/current commit or branch, depending on the flow.

## Branch risk

Branch operations can change the working tree. Read dialogs and error banners before retrying or forcing an operation.
