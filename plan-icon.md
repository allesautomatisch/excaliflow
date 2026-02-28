## Flowchart Node Icon Selector (No URL Feature)

### Summary
Add a per-node icon setting for flowchart nodes, with:
1. A central icon registry keyed by string.
2. A second row in the existing `...` shape submenu for icon selection.
3. Rendering of the selected icon in the node’s top-right corner.
4. Initial icon set: `none` and `automatic`.

### Scope
- In scope:
  - Per-node icon key storage.
  - Icon menu row (under shape row).
  - Node corner icon rendering.
  - Central icon definitions for keys + SVG path data.

### Implementation Plan

1. Create a central flowchart node icon registry.
- Add new module: `/Users/oliver/Herd/excaliflow/packages/element/src/flowchartNodeIcons.ts`.
- Define:
  - `export type FlowchartNodeIconKey = "none" | "automatic";`
  - `export const FLOWCHART_NODE_ICON_CUSTOM_DATA_KEY = "flowchartNodeIcon";`
  - `export const FLOWCHART_NODE_ICON_OPTIONS` with stable order:
    - `{ key: "none", ...svgData }`
    - `{ key: "automatic", ...svgData }`
  - `export const DEFAULT_FLOWCHART_NODE_ICON_KEY: FlowchartNodeIconKey = "none";`
  - `export const getFlowchartNodeIconKey(element): FlowchartNodeIconKey`:
    - Reads `element.customData?.flowchartNodeIcon`.
    - Falls back to `"none"` on missing/invalid value.
    - "none" state is stored as empty string or missing key, when user selects "none", it is stored as an empty string.
- Include the provided SVG path data in this registry as canonical source.

2. Expose the icon registry from element package.
- Update `/Users/oliver/Herd/excaliflow/packages/element/src/index.ts` to export `flowchartNodeIcons`.

3. Add icon drawing support to canvas element rendering.
- Update `/Users/oliver/Herd/excaliflow/packages/element/src/renderElement.ts`:
  - In generic shape branch (`rectangle/parallelogram/capsule/diamond/ellipse`), after shape draw, conditionally render icon when:
    - element is a flowchart node shape.
    - resolved key is not `"none"`.
  - Draw icon at top-right in local element coordinates, so it naturally rotates/scales with node.
  - Use fixed icon size + margin constants (decision fixed now):
    - `ICON_SIZE = 16`
    - `ICON_MARGIN = 6`
  - Use node stroke color as icon color (`currentColor` equivalent), applying existing dark-theme filter logic consistently.

4. Add icon support to SVG export rendering.
- Update `/Users/oliver/Herd/excaliflow/packages/excalidraw/renderer/staticSvgScene.ts`:
  - In shape case for flowchart-node-capable types, append an SVG icon group/path when key != `none`.
  - Place icon using same constants/geometry as canvas path.
  - Reuse same transform pipeline so icon rotates with node and respects opacity.

5. Add menu row in flowchart shape picker UI.
- Update `/Users/oliver/Herd/excaliflow/packages/excalidraw/components/App.tsx`:
  - Keep existing shape row as first row.
  - Add second row for icon options (`none`, `automatic`).
  - Resolve current selected icon key from selected node’s `customData`.
  - Add handler `onFlowchartNodeIconPickerSelect(key, source)`:
    - Mutates selected node `customData.flowchartNodeIcon`.
    - Calls capture scheduling (`this.store.scheduleCapture()`).
    - Tracks event (fixed now: `trackEvent("flowchart", "change-node-icon-" + key, source)`).
  - Use existing open/close behavior of the `...` picker (no new popup state).

6. Add UI icon components for picker buttons.
- Update `/Users/oliver/Herd/excaliflow/packages/excalidraw/components/icons.tsx`:
  - Add `FlowchartNodeIconNoneIcon`.
  - Add `FlowchartNodeIconAutomaticIcon`.
- These are menu visuals only; canonical key/svg metadata remains in element registry.

7. Adjust submenu styling to support two rows.
- Update `/Users/oliver/Herd/excaliflow/packages/excalidraw/components/ElementCanvasButtons.scss`:
  - Change picker layout from single row to column.
  - Add row class styles:
    - `.excalidraw-flowchart-shape-picker-row { display: flex; gap: ... }`
  - Keep spacing and panel look consistent with existing design tokens.

8. Planning artifacts update (when implementation is done).
- Update `/Users/oliver/Herd/excaliflow/PLAN.md` with this feature entry.
- Check off corresponding task in `/Users/oliver/Herd/excaliflow/todo.md`.

### Public APIs / Interfaces / Types
- New exported type from element package:
  - `FlowchartNodeIconKey = "none" | "automatic"`.
- New exported constants/helpers from element package:
  - `FLOWCHART_NODE_ICON_OPTIONS`
  - `FLOWCHART_NODE_ICON_CUSTOM_DATA_KEY`
  - `DEFAULT_FLOWCHART_NODE_ICON_KEY`
  - `getFlowchartNodeIconKey(...)`
- Persistence contract (internal but stable):
  - Per-node icon key stored at `element.customData.flowchartNodeIcon`.

### Test Cases and Scenarios

1. Unit tests (element-level)
- Add tests for icon-key resolution:
  - Missing `customData` => `none`.
  - Invalid value => `none`.
  - Valid `automatic` => `automatic`.

2. UI behavior tests (flowchart picker)
- With one selected flowchart node and picker open:
  - Top row still shows shape options.
  - Second row shows exactly `none` + `automatic`.
  - Selecting `automatic` writes `customData.flowchartNodeIcon = "automatic"`.
  - Selecting `none` writes `customData.flowchartNodeIcon = ""`.

3. Rendering checks
- Canvas render:
  - `automatic` icon appears top-right on node.
  - `none` shows no icon.
- SVG export render:
  - Export includes icon for `automatic`.
  - Export omits icon for `none`.

4. Regression checks
- Shape conversion of selected node preserves `customData` and keeps icon key.

### Assumptions and Defaults
- Icon key is stored in `customData` to avoid broad element schema migration.
- Default icon state for all nodes is `none`.
- Icon appears only on flowchart node shapes and only when key != `none`.
- `none` is persisted explicitly as `"none"` once selected.
