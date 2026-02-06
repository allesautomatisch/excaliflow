# Excaliflow / BPD TODO

Source of truth: `PLAN.md`.
Always update `PLAN.md` first, then reflect changes here. This file is for quick reference and task tracking.

## Milestone 1 (stabilize defaults + create flow)
- [x] Learn plan and read source code to understand where to implement changes.
- [x] Check which features might already be implemented or partially implemented
- [x] Set default font size to small
- [x] Set default font family to built-in Comic Shanns
- [x] Enforce Comic Shanns for new nodes regardless of last-used font
- [x] Apply default node size for sub-50x50 accidental drags
- [x] Double default node size

## Milestone 2 (new shapes/tools)
- [x] Add Parallelogram tool (toolbar + element type + rendering + icons)
- [x] Add Capsule/Pill tool (toolbar + element type + rendering + icons)

## Milestone 3 ("Add next step" handle)
- [x] Add handle/button to create next step + elbow-arrow binding
- [x] QoL: keyboard/flow optimizations for BPD
- [x] Make `+` button directional (top/right/bottom/left) and create next node in clicked side direction
- [x] Make `+` always create Step shape (blue square / rectangle)
- [x] Auto-focus text editing when creating a node via `+`, so typing can start immediately
- [x] Add adjacent shape-switch popup button with toolbar-like shape buttons and popup-priority shortcuts
- [x] Delete associated arrows automatically when deleting a shape
- [x] Increase `+` node spacing to 1.5x

## Ops
- [ ] Keep Vite + Basic-auth proxy running; auto-restart if killed
- [x] Keep TypeScript checker at 0 errors
