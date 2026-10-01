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

## Flow Backend Project Persistence

- Drawings saved to the Laravel Flow backend can be assigned to an existing project or to no project (`null`).
- Clipboard and imported images referenced by a backend drawing are encrypted in the browser with the drawing key, stored as opaque binary files by the Laravel backend, and restored when the drawing is opened by slug, share link, or the load dialog.
- Backend file storage defaults to Laravel's private local disk and can be moved to another configured filesystem (such as S3) through environment configuration without changing Excaliflow.
- The backend exposes project IDs/names through `/api/v2/projects`.
- Drawing list responses include `project_id` and `project_name`.
- Loading supports three filters: all drawings, no project only, or one selected project.
- Saving and loading preselect the current drawing's project when the drawing has one; otherwise loading defaults to `Kein Projekt`.
- The top-left file info displays the current project name or `Kein Projekt`.

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

6. **WebMCP Access to Existing Flowchart Features**

   - Expose two tools on the active app document: `flow_get_context` and `flow_apply_operations`.
   - Reuse the existing node placement, shape conversion, binding/text/frame helpers and arrow insertion graph-shifting function. UI and WebMCP share those helpers; do not add app capabilities solely for WebMCP without discussing them with the user.
   - Support atomic batches of existing node/connector actions, including one-operation batches and insertion into a specifically identified arrow. Each successful batch uses one existing undo step.
   - Validate strict schemas, drawing sessions, optional revisions, bounded retry IDs, locked elements/containers, editor activity and cancellation before committing a cloned scene.
   - Register through native `document.modelContext` with abort cleanup; retain a feature-detected legacy `navigator.modelContext` adapter with explicit unregister cleanup. Browsers without either API keep the normal editor.
   - Test checkpoint: native tools discovered and executed in the Codex in-app Browser on localhost; verify insertion shifts downstream nodes, bindings, Undo/Redo, retries, manual-edit conflicts, invalid-batch rollback and drawing switches. Run focused tests, package/app typechecks, lint and app build. Tool contracts and reproducible examples live in `excalidraw-app/webmcp/README.md`.
   - Verified 2026-10-01: 40 focused tests, app/element/core typechecks, app build, HTTP 200/listener and native Browser execution passed. Affected-file lint has 0 errors and one pre-existing unused `editorInterface` warning. Backend persistence and collaboration were not exercised against production data.

7. **Compact WebMCP Catalog for Future Sessions**

   - Derive compact shared discovery, strict execution schemas, summaries and on-demand `flow_help` details/examples from one operation contract.
   - Keep common creation/connection usable directly from discovery with context plus one atomic batch; return committed element labels/bindings/positions and contract version.
   - Protect initial compact/formatted catalog size with regression budgets; verify the actual Codex Browser description and a fresh native session without help calls.
   - Preserve existing app capabilities and insertion helpers; update the WebMCP reference and run focused tests, typecheck, lint, build and browser/load checks.
   - Verified 2026-10-01: 39 focused tests, app typecheck, WebMCP-file lint (0 errors/warnings), app build and HTTP 200/listener passed. Actual native Browser description shrank from 20177 to 12435 bytes (38.4%); fresh drawing creation/connection required only context plus one batch and no help. Optional insertion help, strict invalid-field rollback and existing graph-shift execution passed. The original drawing was backed up/restored with graph IDs and node positions preserved.

8. **Enforce Flow Conventions at the WebMCP Boundary**

   - Teach every new browser agent via registered descriptions/schemas, `flow_get_context.flowRules`, compact examples and optional operation-level `flow_help`; repository instructions are not required for app agents.
   - Replace raw public editing operations with semantic append/branch/insert/rename/loop operations (contract version 3). Compose the existing editor functions; keep raw engine operations private.
   - Require one-word object/action labels (max 32 combined characters), terminal defaults, 120x120 nodes on the 120px grid, and 240px chronological steps to the right. Branches start below and continue right; loops explicitly return to earlier reachable steps.
   - Validate the cloned result before one atomic commit, including occupied cells and off-grid anchors. Keep existing manual editing and insertion graph-shifting behavior.
   - Verify focused regressions, native Browser discovery/execution, typecheck, lint, build and local loading; document grammatical validation and existing routing limits.
   - Verified 2026-10-01: 42 focused tests, app typecheck, WebMCP lint (0 errors/warnings), app build and HTTP 200/listener passed. Fresh native Browser contract 3 creation, insertion/shift, branch/loop, optional help and invalid-input rollback passed. Browser description 8747 bytes (about 30% below contract 2). Original drawing restored after reload; all 39 graph elements match IDs, labels, geometry and bindings.

9. **Loop Return Conventions and Node Clearance**

   - Expose existing bottom endpoint bindings and fixed elbow segment editing through semantic loop wrappers; avoid introducing a new editor/router mode.
   - Lower returning leaf nodes to a free grid row when possible; retain nodes with forward continuation and container membership.
   - Choose bounded lower return corridors and side detours using existing elbow geometry. Reject new/changed connectors crossing node interiors atomically; unrelated nodes remain in place.
   - Add `route_loop(edgeId)` to repair existing returns without changing connector IDs or labels. Deliver rules through discovery, context and help (contract 4).
   - Verify bottom directions, blocked target columns, idempotent repairs, insertion/Undo/Redo and rollback; repair the two webinar loops and verify the real drawing in Browser.
   - Verified 2026-10-01: 46 focused tests, app typecheck, WebMCP lint, build and HTTP 200/listener passed. Native Browser repaired both returns with bottom ports, separate return lanes and no node crossings; only the two returning nodes moved, IDs/labels remained unchanged. Undo restored the original graph; existing editor Redo normalized binding gaps, then the wrapper restored its endpoint spacing.
   - Route shorter loops first to allow enclosing returns beneath them. The final actual drawing was separately processed through `applyFlowOperations` and exported to `webinar-loops.excalidraw`; an additional verification confirmed no node or mutual loop crossings. Final live re-import remains pending: the dev server exhausted its heap and the Browser connection stopped responding. Server restarted and passed HTTP health checks; drawing backup and final export retained.

10. **Fresh Codex Session Experiments**

- Run sequential new projectless Codex threads with the same human-level URL/task prompt, verified empty drawings and no inherited conversation or repository context.
- Preserve tool/rule versions, thread evidence, graph outcomes and rendered screenshots before observer intervention; separate infrastructure failures from Flow-rule quality.
- Evaluate the baseline, adapt only built-in WebMCP guidance/wrappers based on observed failures and repeat in new threads under the same conditions.
- Produce a chronological report with each test, result and a one-sentence good/bad assessment. Protocol/evidence: `experiments/fresh-sessions-2026-10-01/`.
- Completed 2026-10-01: six fresh projectless chats with evidenced empty starts and preserved screenshots; pilot 02 excluded from controlled comparison because it used standalone Playwright and read app sources. Exact @Browser prompt held constant in 03–06, contracts 4/5/6 frozen per run.
- Contract 6 includes the user clarification: sharing the lowest occupied row is sufficient; only higher leaf sources lower. Precise edge-label errors, separate arrow/node span limits, compact authoring/branch guidance and optional free-bottom-port guidance added around existing editor functions.
- 48 focused tests passed; final help-only edit passed all five catalog-budget tests. App typecheck, WebMCP lint, build and HTTP health passed. Runs 05/06 finish with leaf sources on the existing lowest row; 06 still required two failed layout attempts and existing insertion/graph shift. No runtime-speed or guaranteed global-layout claim. Chronological report: `experiments/fresh-sessions-2026-10-01/report.md`.

11. **WebMCP Export Existing Formats**

- Add `export_as` for PNG, SVG, Excalidraw and the existing process Markdown exporter, with local save, clipboard or public server destinations.
- Reuse existing renderers, serialization, file saving and clipboard helpers. Expose image background, dark mode, embedded scene, 1/2/3x scale and existing selection-only export.
- In the manual server export results, offer a small copy icon beside each format link to copy its individual URL.
- Snapshot the current drawing with session/revision checks; exports must not mutate the drawing or its export preferences, or silently overwrite its active file handle.
- Verify format/destination coverage, image options, referenced assets, validation/cancellation and real native Browser export; update the compact catalog reference and run source/build/load checks.

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
- Process diagrams can be exported from the Generate tool menu via "Als Markdown kopieren"; the exporter writes deterministic Markdown to the clipboard as a simple unordered list using bound node text, branch labels/target node text, free text blocks, and process grouping headings from frames/swimlane lanes. Node IDs and arrow target IDs are omitted. Unlabeled decision branches use "weiter", except the last unlabeled decision branch, which uses "sonst". Decision branches use "zurück zu" when their target node has already appeared in the exported flow, otherwise "weiter mit". Disconnected flows are separated by a blank line, frame/swimlane headings are emitted once before the first node in that section/lane, and free text blocks are placed between flows by canvas position instead of inside a flow.
- Flow backend project persistence is implemented across the Laravel API and Excaliflow UI: project list dropdowns, nullable project filtering, current-project preselection, and project-name display in the top-left file info.
- Flow backend image persistence is implemented end to end: referenced image files are encrypted client-side, uploaded after the drawing record is saved, and decrypted/restored on every backend drawing load path.

- WebMCP exposes existing editing capabilities only in the currently open drawing. Export uses the existing render/serialization paths with local file, clipboard and public server destinations; backend drawing discovery, collaboration management and new app features remain outside the tool surface.
- Public WebMCP contract v4 accepts semantic steps without arbitrary geometry or directions and enforces bottom loop ports, clear return lanes and lower returning leaf nodes when possible. Forward insertion reuses the existing downstream graph shift; manual editor placement remains available. Existing node and unrelated connector IDs are preserved; the specifically replaced connector gets replacement IDs returned by the batch. Noun/verb meaning is taught through descriptions/examples; validation guarantees two short tokens, not grammatical classification.

## Extra Low-Risk QoL Ideas

- Optional: BPD quick-style preset button (reapplies thick stroke + elbow arrows + architect roughness).
- Optional: BPD shape quick-swap in properties panel (rect ⇄ capsule ⇄ parallelogram).
- Optional: Default grid on for BPD mode (helps alignment without changing snapping logic).


## Public export extension (milestone 11)

- `export_as` supports local save, clipboard and `server`; server batches accept `formats` and share one generated UUID/date/name stem.
- Laravel `POST /api/v2/exports` stores validated PNG/SVG/Excalidraw/Markdown batches; public `GET /exports/{fileName}` retrieves the same bytes. Filesystem storage is persistent and configurable; no schema migration.
- The image dialog exposes server publication, multiple format selection, editable export name and public links with copy support. Existing image renderers/metadata and Markdown/JSON serializers are reused.
- Development proxies, Docker Nginx template and Vercel rewrites are wired. Frontend/backend and the Forge Flow host export routes were deployed on 2026-10-01; see the production acceptance below.


### Export acceptance, 01.10.2026

- 57 focused WebMCP/export/catalog tests, 12 Laravel export tests (49 assertions), and the Playwright login plus export-route smoke passed. Root/app TypeScript checks, affected WebMCP/export lint (zero errors/warnings), build and HTTP 200/listener passed. The existing app-wide unused `editorInterface` lint warning remains outside this change.
- Native @Browser: a four-format publication, PNG+Markdown pair and manual four-format image-dialog export each returned a shared UUID with readable date/name filenames. Public SVG rendered through the Flow-origin development proxy. Real PNG artifact is 1240x280 at 2x, with a transparent corner and a decoded embedded eight-element scene. Tool overrides left the dialog preferences unchanged.
- Evidence is in `experiments/exports-2026-10-01/`; final screenshot shows editable name, image options, four formats, public links and copy-links action.
- Follow-up: each published format link now has an accessible icon-only copy button using the existing clipboard helper. TypeScript, focused lint and app health passed; all four icons were confirmed in native Browser (`server-export-copy-icons.png`). A PNG icon click still yielded no clipboard readback in that browser, so native clipboard completion remains unconfirmed.
- Native system Clipboard calls and copy-links readback did not complete in the Codex browser. Their real serializer/PNG metadata/SVG output transport paths are covered by focused tests; no successful native clipboard round-trip is claimed. Local-save transport uses existing fileSave and is covered with mocked IO, not a confirmed native file-dialog round-trip.
- The additionally attempted legacy core export suite failed 7/8 tests (drop DOM setup and older font/scene snapshots); these tests call unchanged lower-level scene exporters rather than the new export transport. It was not declared green and its fixtures were not rewritten.
- Production release and host routing were subsequently completed; the acceptance below supersedes the earlier local-only deployment status.

- Repository hosting is wired for Docker and Vercel; the rendered Nginx proxy template passed `nginx -t` locally. Docker image runtime/production deployment was not exercised.

### Production acceptance, 01.10.2026

- Committed and pushed the complete session's guided WebMCP/editor changes, exports, individual copy icons and experiment report/evidence. Raw chat messages/tool transcripts remain local. Backend was first fast-forwarded to the existing remote master; its export changes were restored without conflicts and committed separately.
- Forge deployments finished for frontend `bd89310c` / `a7f045c7` and backend `f70bcae` / `a51679c`. The Flow host proxies uploads and retrieval to the existing backend with verified TLS, explicit server name and certificate-chain depth 3. Storage remains in Forge's existing shared `storage` directory across releases.
- Fixed two live-only integration findings: the PWA navigation fallback intercepted public file links, and Spatie's global `.md` suffix rewrite prevented retrieving actual Markdown exports. The service worker now excludes `/exports/` and `/api/`; a wrapper retains the existing page rewrite everywhere except export files. Installing current locked dependencies reproduced the Markdown issue in the existing tests before the fix.
- 64 focused frontend tests, 13 backend export tests (55 assertions), current TypeScript/build/lint checks and the local authenticated Playwright export-route smoke (2 tests) passed. One existing unused-variable lint warning remains. Public PNG/SVG/Excalidraw/Markdown URLs each returned HTTP 200 with the correct type and byte count; SVG rendered in native Browser after its service worker update. Native WebMCP and manual four-format publication both succeeded with shared UUIDs; all four individual copy icons are present.
- Evidence: `experiments/exports-2026-10-01/production-export-result.json`, `production-url-checks.json`, `production-export-dialog.png`, `production-svg-preview.png`. Clipboard readback in the Codex browser remains unconfirmed. The local backend's `.env` broadcast driver was changed from unavailable `reverb` to `log` after dependency synchronization; the private previous environment is backed up in `/private/tmp/excaliflow-release-backup/` and no environment file was committed.
