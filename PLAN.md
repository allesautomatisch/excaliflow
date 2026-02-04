# BPD Adaptation Plan (Excalidraw)

## Goals / Requested Features
- New toolbar tools: parallelogram + capsule/pill start/stop shape.
- Defaults: stroke width thick; roughness very clean/architect; arrows default elbow/orthogonal.
- Click-to-create uses a standard size on click; drag to size if dragging.
- Auto trigger type-inside after creating a shape.
- Add-next-step handle/button on selected shape: creates new shape + connecting elbow arrow.

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
  - Clicking it creates a new shape to the right, same size, auto-spaced, and adds an elbow arrow between them.
  - Follow the current binding and snapping systems to keep arrows attached and orthogonal.

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
   - Ensure undo/redo integrity and bindings for new shapes.
   - Test checkpoint: create chain of steps, undo/redo, move shapes and observe arrow bindings.

## Clarifying Questions
1. For the default “standard size” on click, is `160x100` acceptable, or do you prefer another size?
2. For auto type-inside, should it also trigger when the shape tool is locked (rapid creation), or only when the tool is not locked?
3. For Add-next-step, should the default direction be rightward only, or should we detect nearest open side based on canvas space?

## Extra Low-Risk QoL Ideas
- Optional: BPD quick-style preset button (reapplies thick stroke + elbow arrows + architect roughness).
- Optional: BPD shape quick-swap in properties panel (rect ⇄ capsule ⇄ parallelogram).
- Optional: Default grid on for BPD mode (helps alignment without changing snapping logic).

