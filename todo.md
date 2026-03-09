# Excaliflow / BPD TODO

Source of truth: `PLAN.md`. Always update `PLAN.md` first, then reflect changes here. This file is for quick reference and task tracking.

## Milestone 1 (stabilize defaults + create flow)

- [x] Learn plan and read source code to understand where to implement changes.
- [x] Check which features might already be implemented or partially implemented
- [x] Set default font size to small
- [x] Set default font family to built-in Comic Shanns
- [x] Enforce Comic Shanns for new nodes regardless of last-used font
- [x] Force Triangle arrowhead for newly created arrows (toolbar + `+` flow creation), regardless of last-used arrowhead
- [x] Force sharp corners for newly created nodes (tool-created and `+`-created), regardless of previously selected roundness
- [x] Snap dragged shapes to the selected grid size in BPD mode (default `120px`); hold Ctrl/Cmd to temporarily disable snap for free positioning
- [x] Keep arrows on a fixed `20px` snap grid regardless of the selected node grid size
- [x] Keep visible grid dots rendered at a fixed `20px` spacing regardless of the selected snap grid size
- [x] Make the grid visible by default
- [x] Apply default node size for sub-50x50 accidental drags
- [x] Use half-default-size threshold for drag fallback, and only fallback when dragged width and height are both below threshold
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
- [x] Set BPD default node size to `120x120` for all BPD node shapes, including capsule
- [x] Set `+` / `Cmd/Ctrl + Arrow` flowchart spacing to square-grid gaps (`120x120`)
- [x] Force `+` / `Cmd/Ctrl + Arrow` created nodes to default size (`120x120`) regardless of source node size
- [x] Align `Cmd/Ctrl + Arrow` preview placement constants with `+` node creation
- [x] Align `Cmd/Ctrl + Arrow` preview arrowheads with `+` node creation defaults
- [x] Auto-start typing in first node after committing `Cmd/Ctrl + Arrow` flowchart creation
- [x] Fix keyboard multi-add text focus race (select new node via `flushSync` before edit)
- [x] Ensure keyboard flow-created nodes always use Step shape/color (not selected-node style)
- [x] Make `D` shortcut context-aware: selected flow node -> diamond conversion, otherwise diamond tool
- [x] Extend context-aware conversion to `G/R/O/C` for flow nodes (otherwise select corresponding tool)
- [x] Show letter shortcuts (`R/D/G/O/C`) in `+` menu shape-switch popup instead of numeric keys
- [x] Add flowchart node icon selector in shape-switch popup with `none` + `automatic` options
- [x] Add flowchart node icon rendering in canvas and SVG export output (top-right corner)

## Milestone 4 (Flow visualization prototype)

- [x] Add flow mode toggle in context menu (Zen-style integration).
- [x] Add flow simulation rendering pipeline for particles in the interactive renderer.
- [x] Add flow node topology extraction from flowchart nodes + arrows.
- [x] Add particle spawn/advance logic and sink-node termination for particles.

## Milestone 5 (Swim lanes container)

- [x] Add Swim Lanes tool to the extra tools menu (desktop + mobile)
- [x] Add `swimlane` element model, rendering, export support, and equal divider spacing
- [x] Reuse frame-style parenting/membership behavior for swim lanes
- [x] Add Stats-panel authoring for swimlane line count
- [x] Auto-create and keep one headline text label per swimlane lane in sync with resize/line-count changes
- [x] Add focused swimlane element tests and keep TypeScript clean

## Ops

- [x] Add a feature flag (`VITE_APP_ENABLE_LOCAL_STORAGE`) to allow enabling/disabling scene localStorage persistence, and default persistence off.
- [ ] Keep Vite + Basic-auth proxy running; auto-restart if killed
- [x] Keep TypeScript checker at 0 errors

## QoL

- [x] Add a context-menu toggle for selection box metrics and keep it hidden by default
