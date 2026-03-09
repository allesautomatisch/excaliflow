# BPD Adaptation Plan (Excalidraw)

## Goals / Requested Features

- New toolbar tools: parallelogram + capsule/pill start/stop shape.
- New swim-lanes container element with equal vertical dividers, shared resize, authorable line count, and per-lane headline text labels.
- Defaults: stroke width thick; roughness very clean/architect; arrows default elbow/orthogonal.
- Default font size for new text/labels should be `small`.
- Default font family should be built-in `Comic Shanns`.
- New nodes must use `Comic Shanns` even if another font was used previously.
- Click-to-create uses a standard size on click; drag to size if dragging.
- For accidental tiny drags, use default node size; only honor dragged size when at least `50x50`.
- Default node size should be doubled (2x previous).
- Auto trigger type-inside after creating a shape.
- Add-next-step handle/button on selected shape: creates new shape + connecting elbow arrow.
- Add-next-step `+` button repositions to the nearest side of the selected node based on pointer position, and creates the next node in that chosen direction (up/right/down/left).
- Add-next-step `+` button and keyboard `Cmd/Ctrl + Arrow` flow creation always create the Step shape (blue rectangle with black outline).
- Distance between nodes created via `+` should be `1.5x` the previous spacing.
- Add a second contextual flowchart button (next to `+`) to quickly change the selected node shape via popup + shortcuts.
- Keyboard `D/G/R/O/C` shortcut behavior: if one flowchart node is selected, convert it to diamond/parallelogram/rectangle/ellipse/capsule; otherwise select the corresponding drawing tool.
- Add a contextual flowchart icon selector (`none` and `automatic`) to the popup, with icon values stored on node customData.
- Deleting a shape also deletes all associated arrows.

## UX Details & Proposals

- BPD mode is gated by a feature flag (`BPD_FEATURES`) to keep changes safe and isolate behavior.
- Default style in BPD mode:
  - `strokeWidth`: `bold` (2px, visually thicker for process diagrams).
  - `roughness`: `architect` (clean/straight).
  - `arrowType`: `elbow` (orthogonal connectors).
- Click-to-create:
  - If a shape tool is active and the pointer up occurs without drag, create a standard size shape at the click origin.
  - Proposed standard size: `160x100` (tunable after feedback).
  - Dragging still sizes normally.
- Auto type-inside:
  - After a new shape is created (click or drag), immediately start text editing and bind the text to the shape.
  - This uses the existing bound-text flow and centers the caret in the shape.
- Add-next-step handle:
  - A small “+” connector handle appears on selected BPD shapes (rect/diamond/ellipse/parallelogram/capsule).
  - Clicking it creates a new Step node on the chosen side (top/right/bottom/left), auto-spaced, and adds an elbow arrow between them.
  - Follow the current binding and snapping systems to keep arrows attached and orthogonal.
- Quick shape switch popup:
  - A second button appears next to `+` for selected flowchart nodes.
  - Clicking it opens a popup with toolbar-like shape buttons (Square, Diamond, Parallelogram, Circle, Pill).
  - Popup shortcuts (`2`-`6` and shape letter keys) apply shape changes and take precedence over normal toolbar switching while popup is open.
  - Shape changes preserve existing text and reapply BPD default colors for the chosen shape.

## Milestones

1. **BPD Defaults + Click-to-Create + Auto Type-Inside**

   - Add `BPD_FEATURES` flag in core.
   - Apply BPD defaults in `excalidraw-app` when enabled.
   - In core: on click-without-drag, create a standard-size shape instead of deleting the “too small” element.
   - Auto-start bound text editing after shape creation.
   - Test checkpoint: start Vite app, verify defaults and click-to-create in browser, `curl` dev page.

2. **New Shape Types + Toolbar Integration**

   - Introduce new element types: `parallelogram` and `capsule` (pill).
   - Renderers, bounds, hit-testing, selection, and text-binding support.
   - Add toolbar buttons + icons, and include in convert shape popup (if applicable).
   - Test checkpoint: create each shape, bind text, resize/rotate, and export SVG.

3. **Add-Next-Step Handle**

   - Add a contextual handle on selected BPD shapes.
   - Implement auto-creation of the next shape with an elbow arrow, preserving styles.
   - Make the `+` button directional with 4 side positions and side-aware creation.
   - Ensure `+` always creates a Step node and add a shape-switch popup button with shortcut handling.
   - Ensure undo/redo integrity and bindings for new shapes.
   - Test checkpoint: create chain of steps, undo/redo, move shapes and observe arrow bindings.

4. **Flow Visualization Prototype**
   - Add a desktop-only right-click toggle for flow-mode overlay in Canvas and view-mode context menus.
   - Add a lightweight particle simulation to animate lead/client flow across flowchart nodes and arrows.
   - Spawn particles from source nodes at fixed intervals and remove them when they reach sink nodes.
   - Add boids-style movement so motion is visually readable during the first pass.
   - Keep implementation intentionally simple and extensible for future rule changes.
   - Test checkpoint: enable flow mode and verify particles move continuously on a directed flowgraph.

5. **Swim Lanes Container**

   - Introduce a new `swimlane` element type that behaves like a frame-style container for parenting and membership.
   - Render equally spaced top-to-bottom divider lines with a default of 4 total lines (3 lanes).
   - Add the tool to the extra tools menu on desktop and mobile.
   - Add a Stats-panel control to author the line count; resizing should keep all lines equal length and evenly spaced.
   - Auto-create one text label per swimlane lane and keep those labels centered when the swimlane is resized or its lane count changes.
   - Test checkpoint: TypeScript clean, swimlane helper test passes, app loads locally, and the tool appears in the extra tools menu.

## Clarifying Questions

1. For the default “standard size” on click, is `160x100` acceptable, or do you prefer another size?
2. For auto type-inside, should it also trigger when the shape tool is locked (rapid creation), or only when the tool is not locked?
3. For Add-next-step, should the default direction be rightward only, or should we detect nearest open side based on canvas space?

## Implemented Assumptions (Current)

- Click-to-create standard size is `120x120` for all BPD node shapes, including `capsule`.
- Auto type-inside triggers for newly created BPD shapes, including while tool-lock is active.
- Add-next-step `+` button is directional: its position follows pointer side (top/right/bottom/left), and clicking creates the next node on that side with an elbow arrow.
- Add-next-step `+` always creates Step shape (`rectangle`) with black stroke and blue background.
- Flowchart shape switch popup is available next to `+`; keyboard shortcuts in popup context override normal toolbar shape switching.
- In BPD mode, deleting a shape also deletes any arrows bound to that shape.
- In BPD mode, default font size is `small`.
- In BPD mode, default font family is `Comic Shanns`.
- In BPD mode, new node text insertion enforces `Comic Shanns` (does not inherit last-used font).
- In BPD mode, newly created node shapes always use sharp corners (roundness reset to sharp), regardless of previously selected roundness.
- In BPD mode, newly created arrows always use Triangle end arrowhead (toolbar arrows and `+`-created flow arrows), regardless of previously selected arrowhead.
- In BPD mode, flowchart arrows generated via keyboard `Cmd/Ctrl + Arrow` preview also use the same `+` defaults (`startArrowhead: null`, `endArrowhead: triangle`).
- In BPD mode, dragging selected shapes snaps to the selected grid size by default (`120px` initially, toggleable to `20px`); holding Ctrl/Cmd temporarily disables drag-grid snapping for free positioning.
- Arrows always use a `20px` snap grid for creation and editing, independent of the selected node grid size.
- The visible canvas grid is always rendered at `20px` spacing, independent of the selected snap grid size.
- The grid is visible by default.
- Selection box metrics are hidden by default and can be toggled from the canvas context menu.
- In BPD mode, dragged node size is applied unless both width and height are below half of that shape's default size (`60x60`); only those small drags snap to default size.
- In BPD mode, `+` and `Cmd/Ctrl + Arrow` flowchart node creation use square-grid spacing (`horizontal gap: 120`, `vertical gap: 120`).
- In BPD mode, nodes created via `+` or `Cmd/Ctrl + Arrow` are always forced to default size (`120x120`), independent of the selected/source node size.
- In BPD mode, creating a node via `+` auto-opens bound text editing on the new node so typing can start immediately.
- In BPD mode, keyboard `Cmd/Ctrl + Arrow` flowchart preview creation reuses the same spacing/grid and Step-style shape/color constants as the `+` button creation path.
- In BPD mode, committing keyboard `Cmd/Ctrl + Arrow` flowchart creation auto-starts text editing in the first created node, matching `+` behavior.
- Keyboard flowchart creation uses `flushSync` selection to the first created node before `startTextEditing`, preventing stale selection from reopening old node text.
- Keyboard `D/G/R/O/C` shortcuts are context-aware for flowchart nodes: selected node converts to matching shape; no node selected keeps normal tool selection behavior.
- In `+` menu shape-switch popup, shortcut labels display letter keys (`R/D/G/O/C`) instead of numeric keys.
- Flowchart nodes support an icon setting with options `none` and `automatic`, stored as `customData.flowchartNodeIcon`; the icon is rendered in the node top-right in canvas and SVG export.
- Swim-lanes are implemented as a dedicated `swimlane` container element with frame-style parenting, but they do not participate in frame naming/search UX.
- Swim-lanes default to 4 total vertical boundary lines (3 lanes), expose an integer `lineCount` property editable from Stats, and auto-manage one text headline per lane.

## Extra Low-Risk QoL Ideas

- Optional: BPD quick-style preset button (reapplies thick stroke + elbow arrows + architect roughness).
- Optional: BPD shape quick-swap in properties panel (rect ⇄ capsule ⇄ parallelogram).
- Optional: Default grid on for BPD mode (helps alignment without changing snapping logic).
