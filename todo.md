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

## Milestone 6 (WebMCP access to existing flowchart features)

- [x] Register `flow_get_context` and `flow_apply_operations` with strict discovery/validation schemas
- [x] Reuse existing node placement, conversion, binding/text/container helpers and insertion graph shifting
- [x] Apply atomic operation batches with one undo step and temporary references
- [x] Guard drawing switches, stale revisions, repeated request IDs, locked elements, active edits and cancellation
- [x] Clean up native and legacy registrations on unmount/remount; retain normal editor without WebMCP
- [x] Verify actual native discovery/execution in the requested Codex Browser, including insertion, Undo/Redo, rollback, retries and manual/drawing conflicts
- [x] Complete focused regression tests, package/app typechecks, affected-file lint and local build/load checks
- [x] Document tool contracts, concrete native example batches, prerequisites and manual checks

## Milestone 7 (Compact WebMCP catalog)

- [x] Derive discovery, strict validation and optional help/examples from shared operation contracts
- [x] Add read-only `flow_help` without adding new diagram editing capabilities
- [x] Advertise common create/connect example and return actual committed element confirmations
- [x] Add catalog size budgets and fresh-session/strict-validation regression tests
- [x] Verify fresh native Browser session, optional insertion help, build/typecheck/lint and local load
- [x] Update reference and record measured catalog size and acceptance evidence

## Milestone 8 (WebMCP Flow conventions)

- [x] Put shared Flow rules in discovery descriptions, structured context and optional help
- [x] Replace public raw geometry/text operations with semantic steps and explicit loops
- [x] Compose existing placement, binding, conversion and insertion functions
- [x] Enforce concise labels, standard grid geometry, chronological placement and atomic rollback
- [x] Add meaningful regression coverage for branches, loops, insertion, Undo/Redo and invalid batches
- [x] Complete native Browser, typecheck, lint, build and local-load acceptance
- [x] Update reference with contract v3, agent guidance and validation limits

## Milestone 9 (Loop return conventions)

- [x] Teach bottom exit/entry, lower returning nodes and node-clearance rules through WebMCP
- [x] Wrap existing node movement, bottom bindings and fixed elbow segment editing
- [x] Add semantic repair of existing loop edges while preserving IDs and labels
- [x] Test detours, source lowering, idempotence, Undo/Redo and atomic overlap rejection
- [x] Complete typecheck/lint/build/load checks
- [x] Verify bottom ports, node clearance, IDs, idempotence and Undo/Redo in native Browser
- [x] Repair both webinar loopbacks and update the reference
- [x] Export the actual drawing with final nested-loop ordering; verify no node or loop crossings
- [ ] Re-open the final exported drawing in Browser after its connection recovers

## Milestone 10 (Fresh Codex session experiments)

- [x] Define a fixed human-level prompt, isolated new projectless threads and comparable evaluation criteria
- [x] Run baseline experiments with evidenced empty starts and save screenshots/results
- [x] Adapt built-in WebMCP guidance based on observed results
- [x] Run new independent comparison threads and preserve their screenshots/results
- [x] Complete source checks and chronological report with limitations

## Milestone 11 (WebMCP export)

- [x] Register compact `export_as` with all four formats and save/clipboard/server destinations
- [x] Reuse existing exporters and expose image dialog options without mutating editor preferences
- [x] Guard snapshots, session/revision, invalid input, cancellation and active file handles
- [x] Test real format outputs, image flags and registration plus native Browser export
- [x] Complete typecheck/lint/build/load checks and update reference

- [x] Add server batch uploads with shared UUID and public exports route in Laravel
- [x] Add manual image-dialog server export and format selection
- [x] Add an icon-only copy button beside each published export link
- [x] Document production Flow host routing and upload/storage configuration

- [x] Wire `/api/v2/exports` and `/exports/` in repository Docker and Vercel hosting configurations
- [ ] Deploy frontend/backend and apply export proxy configuration on the live Flow host

## Ops

- [x] Add a feature flag (`VITE_APP_ENABLE_LOCAL_STORAGE`) to allow enabling/disabling scene localStorage persistence, and default persistence off.
- [ ] Keep Vite + Basic-auth proxy running; auto-restart if killed
- [x] Keep TypeScript checker at 0 errors
- [x] Add project-aware Flow backend save/load support with nullable project filtering
- [x] Persist encrypted clipboard/imported images with Flow backend drawings and restore them on load

## QoL

- [x] Add a context-menu toggle for selection box metrics and keep it hidden by default
- [x] Add Generate menu action to copy process diagrams as deterministic Markdown
- [x] Use `sonst` as the fallback label for the last unlabeled decision branch
- [x] Separate disconnected flows and emit frame/swimlane lane headings in Markdown export
- [x] Include free text blocks between flows in Markdown export
- [x] Include target node text on Decision branch targets
- [x] Simplify Markdown export to unordered list without node ids or arrow target ids
- [x] Use `zurück zu` for Decision branches targeting already exported nodes
