# BPD Adaptation Plan (Excalidraw)

## Goals / Requested Features
- New toolbar tools: parallelogram + capsule/pill start/stop shape.
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
- Add-next-step `+` button always creates the Step shape (blue rectangle with black outline).
- Distance between nodes created via `+` should be `1.5x` the previous spacing.
- Add a second contextual flowchart button (next to `+`) to quickly change the selected node shape via popup + shortcuts.
- Deleting a shape also deletes all associated arrows.

## UX Details & Proposals
- BPD mode is gated by a feature flag (`BPD_FEATURES`) to keep changes safe and isolate behavior.
- Default style in BPD mode:
  - `strokeWidth`: `extraBold` (visually thick for process diagrams).
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

## Clarifying Questions
1. For the default “standard size” on click, is `160x100` acceptable, or do you prefer another size?
2. For auto type-inside, should it also trigger when the shape tool is locked (rapid creation), or only when the tool is not locked?
3. For Add-next-step, should the default direction be rightward only, or should we detect nearest open side based on canvas space?

## Implemented Assumptions (Current)
- Click-to-create standard size is `320x200`.
- Auto type-inside triggers for newly created BPD shapes, including while tool-lock is active.
- Add-next-step `+` button is directional: its position follows pointer side (top/right/bottom/left), and clicking creates the next node on that side with an elbow arrow.
- Add-next-step `+` always creates Step shape (`rectangle`) with black stroke and blue background.
- Flowchart shape switch popup is available next to `+`; keyboard shortcuts in popup context override normal toolbar shape switching.
- In BPD mode, deleting a shape also deletes any arrows bound to that shape.
- In BPD mode, default font size is `small`.
- In BPD mode, default font family is `Comic Shanns`.
- In BPD mode, new node text insertion enforces `Comic Shanns` (does not inherit last-used font).
- In BPD mode, dragged node size is applied only when dimensions are at least `50x50`; smaller drags snap to default size.
- In BPD mode, `+` node creation uses a `1.5x` spacing multiplier.
- In BPD mode, creating a node via `+` auto-opens bound text editing on the new node so typing can start immediately.

## Extra Low-Risk QoL Ideas
- Optional: BPD quick-style preset button (reapplies thick stroke + elbow arrows + architect roughness).
- Optional: BPD shape quick-swap in properties panel (rect ⇄ capsule ⇄ parallelogram).
- Optional: Default grid on for BPD mode (helps alignment without changing snapping logic).
