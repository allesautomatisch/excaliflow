import React from "react";
import { resolvablePromise } from "@excalidraw/common";
import { vi } from "vitest";
import { Excalidraw } from "@excalidraw/excalidraw";
import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";
import {
  newFrameElement,
  newSwimlaneElement,
  newElement,
} from "@excalidraw/element/newElement";
import {
  isArrowElement,
  isFlowchartNodeElement,
} from "@excalidraw/element/typeChecks";
import { getBoundTextElement } from "@excalidraw/element/textElement";
import {
  renderApp as render,
  act,
  unmountComponent,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";
import { Keyboard } from "@excalidraw/excalidraw/tests/helpers/ui";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { createFlowController } from "./controller";
import { flowToolCatalog, registerFlowTools } from "./register";
import { applySchema, validate } from "./engineSchema";
import { quickStartOperations } from "./schema";

import { exportDrawing } from "./export";

import type { ModelContext } from "./register";
vi.mock("./export", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  exportDrawing: vi.fn(async () => ({
    format: "md",
    destination: "clipboard",
    fileName: null,
    elementCount: 0,
  })),
}));

unmountComponent();
const { h } = window;
let api: ExcalidrawImperativeAPI;
let controller: ReturnType<typeof createFlowController>;
let drawing = { session: "drawing-one", backendId: null as string | null };

beforeEach(async () => {
  vi.mocked(exportDrawing).mockClear();
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  drawing = { session: "drawing-one", backendId: null };
  unmountComponent();
  const ready = resolvablePromise<ExcalidrawImperativeAPI>();
  await render(
    <Excalidraw
      handleKeyboardGlobally
      excalidrawAPI={(value) => ready.resolve(value)}
    />,
  );
  api = await ready;
  await waitFor(() => expect(api.getAppState().isLoading).toBe(false));
  controller = createFlowController(api, () => drawing);
});
afterEach(() => controller.dispose());

const context = async () => {
  const result = await controller.getContext({});
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result;
};
const apply = async (
  operations: unknown[],
  extra: Record<string, unknown> = {},
) => {
  const current = await context();
  return controller.apply({
    drawingSession: current.drawingSession,
    operations,
    ...extra,
  });
};
const three = [
  { op: "add_node", ref: "a", text: "Start", shape: "capsule", x: 0, y: 0 },
  { op: "add_node", ref: "b", text: "Prüfen", after: "a", gap: 360 },
  { op: "add_node", ref: "c", text: "Fertig", after: "b" },
  { op: "connect_nodes", from: "a", to: "b", ref: "ab", label: "weiter" },
  { op: "connect_nodes", from: "b", to: "c", ref: "bc" },
];
const liveNodes = () =>
  h.elements.filter((el) => !el.isDeleted && isFlowchartNodeElement(el));
const liveEdges = () =>
  h.elements.filter((el) => !el.isDeleted && isArrowElement(el));

it("creates three labeled nodes and two bound orthogonal edges in one call, then inserts a node with one undo step each", async () => {
  const created = await apply(three);
  expect(created).toMatchObject({ ok: true });
  if (!created.ok || !("refs" in created)) {
    throw new Error(JSON.stringify(created));
  }
  const refs = created.refs;
  expect(liveNodes()).toHaveLength(3);
  expect(liveEdges()).toHaveLength(2);
  expect(liveEdges().every((el) => isArrowElement(el) && el.elbowed)).toBe(
    true,
  );
  const map = new Map(h.elements.map((el) => [el.id, el]));
  expect(
    liveNodes().map((el) => getBoundTextElement(el, map)?.originalText),
  ).toEqual(["Start", "Prüfen", "Fertig"]);
  const insertion = await apply([
    {
      op: "insert_between",
      edgeId: refs.ab,
      nodes: [{ ref: "middle", text: "Validieren" }],
    },
  ]);
  expect(insertion).toMatchObject({ ok: true });
  expect(liveNodes()).toHaveLength(4);
  expect(liveEdges()).toHaveLength(3);
  expect(h.elements.find((el) => el.id === refs.ab)?.isDeleted).toBe(true);
  expect(liveNodes().some((el) => el.id === refs.a)).toBe(true);
  const latest = await context();
  const insertedId = "refs" in insertion ? insertion.refs.middle : "";
  expect(latest.elements).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ from: refs.a, to: insertedId, text: "weiter" }),
      expect.objectContaining({ from: insertedId, to: refs.b }),
    ]),
  );
  Keyboard.undo();
  expect(liveNodes()).toHaveLength(3);
  expect(liveEdges()).toHaveLength(2);
  Keyboard.undo();
  expect(liveNodes()).toHaveLength(0);
  Keyboard.redo();
  expect(liveNodes()).toHaveLength(3);
  Keyboard.redo();
  expect(liveNodes()).toHaveLength(4);
  expect(liveEdges()).toHaveLength(3);
});

it("deletes a node, its arrows and all bound labels, and restores them with undo", async () => {
  const result = await apply(three);
  if (!("refs" in result)) {
    throw new Error(JSON.stringify(result));
  }
  expect(await apply([{ op: "delete_node", id: result.refs.b }])).toMatchObject(
    { ok: true },
  );
  expect(liveNodes()).toHaveLength(2);
  expect(liveEdges()).toHaveLength(0);
  expect(
    h.elements.filter((el) => !el.isDeleted && el.type === "text"),
  ).toHaveLength(2);
  Keyboard.undo();
  expect(liveNodes()).toHaveLength(3);
  expect(liveEdges()).toHaveLength(2);
});

it("rolls back invalid batches without modifying live elements or history", async () => {
  const before = JSON.stringify(h.elements);
  const historyBefore = h.history.undoStack.length;
  expect(
    await apply([
      { op: "add_node", text: "Must roll back" },
      { op: "connect_nodes", from: "missing", to: "unknown" },
    ]),
  ).toMatchObject({ ok: false, error: { code: "INVALID_OPERATION" } });
  expect(JSON.stringify(h.elements)).toBe(before);
  expect(h.history.undoStack.length).toBe(historyBefore);
  expect(
    await apply([{ op: "add_node", text: "bad", arbitraryPatch: {} }]),
  ).toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
});

it("supports a single operation, deduplicates retries, and detects manual edits and queued revision conflicts", async () => {
  const initial = await context();
  const request = {
    drawingSession: initial.drawingSession,
    expectedRevision: initial.revision,
    requestId: "one",
    operations: [{ op: "add_node", text: "Einzeln" }],
  };
  const result = await controller.apply(request);
  expect(result).toMatchObject({ ok: true });
  expect(await controller.apply(request)).toEqual(result);
  expect(liveNodes()).toHaveLength(1);
  expect(
    await controller.apply({
      ...request,
      operations: [{ op: "add_node", text: "Anders" }],
    }),
  ).toMatchObject({ error: { code: "REQUEST_ID_CONFLICT" } });
  const beforeManual = await context();
  act(() =>
    api.updateScene({
      elements: h.elements.map((el) =>
        isFlowchartNodeElement(el) ? newElementWith(el, { x: 42 }) : el,
      ),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    }),
  );
  expect((await context()).revision).toBeGreaterThan(beforeManual.revision!);
  expect(
    await apply([{ op: "add_node", text: "Stale" }], {
      expectedRevision: beforeManual.revision,
    }),
  ).toMatchObject({ error: { code: "REVISION_CONFLICT" } });
  const now = await context();
  const parallel = await Promise.all([
    apply([{ op: "add_node", text: "First" }], {
      expectedRevision: now.revision,
    }),
    apply([{ op: "add_node", text: "Second" }], {
      expectedRevision: now.revision,
    }),
  ]);
  expect(parallel[0]).toMatchObject({ ok: true });
  expect(parallel[1]).toMatchObject({ error: { code: "REVISION_CONFLICT" } });
});

it("rejects writes to another drawing, view mode, locked elements, cancelled and disposed sessions", async () => {
  const old = await context();
  drawing = { session: "drawing-two", backendId: "two" };
  expect(
    await controller.apply({
      drawingSession: old.drawingSession,
      operations: three,
    }),
  ).toMatchObject({ error: { code: "DRAWING_CONFLICT" } });
  act(() => api.updateScene({ appState: { viewModeEnabled: true } }));
  expect(await apply(three)).toMatchObject({ error: { code: "READ_ONLY" } });
  act(() => api.updateScene({ appState: { viewModeEnabled: false } }));
  await apply([{ op: "add_node", text: "Locked" }]);
  const target = liveNodes()[0];
  act(() =>
    api.updateScene({
      elements: h.elements.map((el) =>
        el.id === target.id ? newElementWith(el, { locked: true }) : el,
      ),
    }),
  );
  expect(await apply([{ op: "delete_node", id: target.id }])).toMatchObject({
    error: { code: "INVALID_OPERATION" },
  });
  const ac = new AbortController();
  ac.abort();
  expect(
    await controller.apply(
      { drawingSession: (await context()).drawingSession, operations: three },
      { signal: ac.signal },
    ),
  ).toMatchObject({ error: { code: "ABORTED" } });
  const current = await context();
  controller.dispose();
  expect(
    await controller.apply({
      drawingSession: current.drawingSession,
      operations: three,
    }),
  ).toMatchObject({ error: { code: "SESSION_CLOSED" } });
});

it("keeps frame and text membership consistent and reroutes bound edges on node updates", async () => {
  const frame = newFrameElement({ x: -100, y: -100, width: 1500, height: 800 });
  act(() =>
    api.updateScene({
      elements: [frame],
      captureUpdate: CaptureUpdateAction.NEVER,
    }),
  );
  const added = await apply(three);
  if (!("refs" in added)) {
    throw new Error(JSON.stringify(added));
  }
  expect(
    h.elements
      .filter((el) => el.id !== frame.id)
      .every((el) => el.frameId === frame.id),
  ).toBe(true);
  const edgeBefore = liveEdges()[0];
  const changed = await apply([
    {
      op: "update_node",
      id: added.refs.b,
      text: "Neu",
      shape: "diamond",
      y: 250,
      width: 180,
    },
  ]);
  expect(changed).toMatchObject({ ok: true });
  expect(liveEdges()[0]).not.toEqual(edgeBefore);
  expect(
    await apply([
      { op: "update_node", id: added.refs.b, x: 2000, frameId: frame.id },
    ]),
  ).toMatchObject({ error: { code: "INVALID_OPERATION" } });
  expect(h.elements.find((el) => el.id === added.refs.b)?.x).toBe(480);
});

it("supports chained insertions, preserves arrowheads/label and targets only the named parallel edge", async () => {
  const created = await apply(three);
  if (!("refs" in created)) {
    throw new Error(JSON.stringify(created));
  }
  act(() =>
    api.updateScene({
      elements: h.elements.map((el) =>
        el.id === created.refs.ab && isArrowElement(el)
          ? newElementWith(el, {
              startArrowhead: "circle",
              endArrowhead: "bar",
            })
          : el,
      ),
    }),
  );
  await apply([
    {
      op: "connect_nodes",
      from: created.refs.a,
      to: created.refs.b,
      label: "parallel",
    },
  ]);
  const result = await apply([
    {
      op: "insert_between",
      edgeId: created.refs.ab,
      nodes: [
        { ref: "x", text: "X", x: 160, y: 0 },
        { ref: "y", text: "Y", x: 320, y: 0 },
      ],
    },
  ]);
  expect(result).toMatchObject({ ok: true });
  expect(liveNodes()).toHaveLength(5);
  const latest = await context();
  expect(
    latest.elements.filter(
      (el) =>
        "from" in el && el.from === created.refs.a && el.to === created.refs.b,
    ),
  ).toHaveLength(1);
  expect(latest.elements.find((el) => el.text === "parallel")).toBeDefined();
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  expect(latest.elements.find((el) => el.text === "weiter")).toMatchObject({
    startArrowhead: "circle",
    endArrowhead: "triangle",
  });
  expect(
    latest.elements.find(
      (el) =>
        "from" in el && el.from === result.refs.y && el.to === created.refs.b,
    ),
  ).toMatchObject({
    startArrowhead: null,
    endArrowhead: "bar",
  });
  expect(() =>
    validate(applySchema, {
      drawingSession: "s",
      operations: [{ op: "insert_between", nodes: [{ text: "X" }] }],
    }),
  ).toThrow();
});

it("paginates context and honors IDs/selection filters", async () => {
  await apply(three);
  const first = await controller.getContext({ limit: 2 });
  if (!first.ok) {
    throw new Error(JSON.stringify(first));
  }
  expect(first.elements).toHaveLength(2);
  expect(first.nextOffset).toBe(2);
  const second = await controller.getContext({ offset: 2, limit: 2 });
  if (!second.ok) {
    throw new Error(JSON.stringify(second));
  }
  expect(second.elements?.[0].id).not.toBe(first.elements?.[0].id);
  const filtered = await controller.getContext({ ids: [first.elements[0].id] });
  if (!filtered.ok) {
    throw new Error(JSON.stringify(filtered));
  }
  expect(filtered.elements).toHaveLength(1);
  act(() =>
    api.updateScene({
      appState: { selectedElementIds: { [first.elements[0].id]: true } },
    }),
  );
  expect(await controller.getContext({ selectedOnly: true })).toMatchObject({
    total: 1,
    selectedIds: [first.elements[0].id],
    elements: [expect.objectContaining({ id: first.elements[0].id })],
  });
});

it("registers modern tools with abort cleanup and survives remount without duplicates", async () => {
  const registered = new Map<string, unknown>();
  const context: ModelContext = {
    registerTool: vi.fn(async (tool, options) => {
      expect(registered.has(tool.name)).toBe(false);
      registered.set(tool.name, tool);
      options!.signal.addEventListener("abort", () =>
        registered.delete(tool.name),
      );
    }),
  };
  const cleanup = registerFlowTools(controller, { modelContext: context }, {});
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(registered.size).toBe(4);
  const replacement = createFlowController(api, () => drawing);
  const cleanup2 = registerFlowTools(
    replacement,
    { modelContext: context },
    {},
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(registered.size).toBe(4);
  cleanup();
  expect(registered.size).toBe(4);
  cleanup2();
  expect(registered.size).toBe(0);
});

it("handles legacy cleanup, registration failure and absent browser support", async () => {
  const context = { registerTool: vi.fn(), unregisterTool: vi.fn() };
  const cleanup = registerFlowTools(controller, {}, { modelContext: context });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(context.registerTool).toHaveBeenCalledTimes(4);
  cleanup();
  expect(context.unregisterTool).toHaveBeenCalledTimes(4);
  const unsupported = createFlowController(api, () => drawing);
  registerFlowTools(unsupported, {}, {})();
  expect(await unsupported.getContext({})).toMatchObject({
    error: { code: "SESSION_CLOSED" },
  });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const failed = createFlowController(api, () => drawing);
  const cleanFailure = registerFlowTools(
    failed,
    {
      modelContext: {
        registerTool: () => {
          throw new Error("denied");
        },
      },
    },
    {},
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(warn).toHaveBeenCalled();
  cleanFailure();
  warn.mockRestore();
});

it.each(["right", "left", "down", "up"] as const)(
  "uses existing graph shifting on tight %s insertions and preserves following IDs",
  async (direction) => {
    const created = await apply([
      { op: "add_node", ref: "a", text: "A", x: 0, y: 0 },
      { op: "add_node", ref: "b", text: "B", after: "a", direction },
      { op: "add_node", ref: "c", text: "C", after: "b", direction },
      { op: "connect_nodes", from: "a", to: "b", ref: "ab", label: "weiter" },
      { op: "connect_nodes", from: "b", to: "c", ref: "bc", label: "danach" },
    ]);
    if (!created.ok) {
      throw new Error(JSON.stringify(created));
    }
    const before = await context();
    const b = before.elements.find((el) => el.id === created.refs.b)!;
    const c = before.elements.find((el) => el.id === created.refs.c)!;
    const inserted = await apply([
      {
        op: "insert_between",
        edgeId: created.refs.ab,
        nodes: [{ text: "Neu", ref: "new" }],
      },
    ]);
    if (!inserted.ok) {
      throw new Error(JSON.stringify(inserted));
    }
    const after = await context();
    expect(
      after.elements.find((el) => el.id === inserted.refs.new),
    ).toMatchObject({ x: b.x, y: b.y });
    const delta = {
      x: direction === "right" ? 240 : direction === "left" ? -240 : 0,
      y: direction === "down" ? 240 : direction === "up" ? -240 : 0,
    };
    expect(after.elements.find((el) => el.id === b.id)).toMatchObject({
      x: b.x! + delta.x,
      y: b.y! + delta.y,
    });
    expect(after.elements.find((el) => el.id === c.id)).toMatchObject({
      x: c.x! + delta.x,
      y: c.y! + delta.y,
    });
    expect(
      after.elements.find((el) => el.id === created.refs.bc),
    ).toMatchObject({ text: "danach", from: b.id, to: c.id });
  },
);

it("shifts chains, honors gap/relative placement and rejects ignored placement arguments", async () => {
  const created = await apply(three);
  if (!created.ok) {
    throw new Error(JSON.stringify(created));
  }
  const result = await apply([
    {
      op: "insert_between",
      edgeId: created.refs.ab,
      nodes: [
        { ref: "x", text: "X", gap: 60 },
        { ref: "y", text: "Y", gap: 120 },
      ],
    },
  ]);
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  expect(
    (await context()).elements.find((el) => el.id === result.refs.x),
  ).toMatchObject({ x: 480 });
  expect(
    (await context()).elements.find((el) => el.id === result.refs.y),
  ).toMatchObject({ x: 660 });
  expect(
    (await context()).elements.find((el) => el.id === created.refs.b),
  ).toMatchObject({ x: 900 });
  const explicit = await apply([
    {
      op: "insert_between",
      edgeId: created.refs.bc,
      nodes: [
        {
          ref: "relative",
          text: "Nebenweg",
          after: created.refs.b,
          direction: "down",
          gap: 60,
        },
      ],
    },
  ]);
  expect(explicit).toMatchObject({ ok: true });
  expect(
    (await context()).elements.find((el) => el.text === "Nebenweg"),
  ).toMatchObject({ x: 900, y: 180 });
  const arrow = liveEdges()[0];
  expect(
    await apply([
      {
        op: "insert_between",
        edgeId: arrow.id,
        nodes: [{ text: "Wrong", direction: "up" }],
      },
    ]),
  ).toMatchObject({ ok: false });
});

it.each(["nodeLabel", "edge", "edgeLabel", "following"])(
  "atomically rejects deletion/update/insertion affecting a locked %s",
  async (lockedPart) => {
    const result = await apply(three);
    if (!result.ok) {
      throw new Error(JSON.stringify(result));
    }
    const map = new Map(h.elements.map((el) => [el.id, el]));
    const target = h.elements.find((el) => el.id === result.refs.b)!;
    const arrow = h.elements.find((el) => el.id === result.refs.ab)!;
    const lockedId =
      lockedPart === "nodeLabel"
        ? getBoundTextElement(target, map)!.id
        : lockedPart === "edge"
        ? arrow.id
        : lockedPart === "edgeLabel"
        ? getBoundTextElement(arrow, map)!.id
        : result.refs.c;
    act(() =>
      api.updateScene({
        elements: h.elements.map((el) =>
          el.id === lockedId ? newElementWith(el, { locked: true }) : el,
        ),
      }),
    );
    const before = JSON.stringify(h.elements);
    const history = h.history.undoStack.length;
    const operations =
      lockedPart === "following"
        ? [
            {
              op: "insert_between",
              edgeId: result.refs.ab,
              nodes: [{ text: "Neu" }],
            },
          ]
        : [{ op: "update_node", id: result.refs.b, x: 500 }];
    expect(await apply(operations)).toMatchObject({
      ok: false,
      error: { code: "INVALID_OPERATION" },
    });
    if (lockedPart !== "following") {
      expect(
        await apply([{ op: "delete_node", id: result.refs.b }]),
      ).toMatchObject({ ok: false });
    }
    expect(JSON.stringify(h.elements)).toBe(before);
    expect(h.history.undoStack.length).toBe(history);
  },
);

it("preserves unrelated elements and memberships instead of normalizing foreign arrows", async () => {
  const first = await apply(three);
  if (!first.ok) {
    throw new Error(JSON.stringify(first));
  }
  const frame = newFrameElement({
    x: -1000,
    y: -1000,
    width: 100,
    height: 100,
  });
  act(() =>
    api.updateScene({
      elements: [
        ...h.elements.map((el) =>
          el.id === first.refs.ab
            ? newElementWith(el, { frameId: frame.id })
            : el,
        ),
        frame,
      ],
    }),
  );
  const foreignArrow = JSON.stringify(
    h.elements.find((el) => el.id === first.refs.ab),
  );
  const unrelatedNodes = h.elements
    .filter((el) => el.id === first.refs.a || el.id === first.refs.b)
    .map((el) => JSON.stringify(el));
  expect(
    await apply([{ op: "add_node", text: "Independent", x: 2000, y: 0 }]),
  ).toMatchObject({ ok: true });
  expect(JSON.stringify(h.elements.find((el) => el.id === first.refs.ab))).toBe(
    foreignArrow,
  );
  expect(
    h.elements
      .filter((el) => el.id === first.refs.a || el.id === first.refs.b)
      .map((el) => JSON.stringify(el)),
  ).toEqual(unrelatedNodes);
});

it("keeps swimlane membership and wrapped text consistent after auto expansion", async () => {
  const lane = newSwimlaneElement({
    x: -100,
    y: -100,
    width: 1000,
    height: 1000,
  });
  act(() => api.updateScene({ elements: [lane] }));
  const result = await apply([
    {
      op: "add_node",
      ref: "x",
      text: "Long text ".repeat(35),
      width: 120,
      frameId: lane.id,
    },
  ]);
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  const target = h.elements.find((el) => el.id === result.refs.x)!;
  const bound = getBoundTextElement(
    target,
    new Map(h.elements.map((el) => [el.id, el])),
  )!;
  expect(bound.frameId).toBe(lane.id);
  expect(target.height).toBeGreaterThan(120);
  expect(bound.y + bound.height).toBeLessThanOrEqual(target.y + target.height);
  const before = JSON.stringify(h.elements);
  expect(
    await apply([
      { op: "update_node", id: result.refs.x, text: "overflow ".repeat(220) },
    ]),
  ).toMatchObject({ ok: false });
  expect(JSON.stringify(h.elements)).toBe(before);
  act(() =>
    api.updateScene({
      elements: h.elements.map((el) =>
        el.id === lane.id ? newElementWith(el, { locked: true }) : el,
      ),
    }),
  );
  expect(
    await apply([{ op: "add_node", text: "No", frameId: lane.id }]),
  ).toMatchObject({ ok: false });
});

it("updates/deletes an edge label and style while retaining endpoint bindings", async () => {
  const result = await apply(three);
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  expect(
    await apply([
      {
        op: "update_edge",
        id: result.refs.bc,
        label: "Ende",
        style: { strokeStyle: "dashed" },
      },
    ]),
  ).toMatchObject({ ok: true });
  expect(
    (await context()).elements.find((el) => el.id === result.refs.bc),
  ).toMatchObject({ text: "Ende", from: result.refs.b, to: result.refs.c });
  const edge = h.elements.find((el) => el.id === result.refs.bc)!;
  const label = getBoundTextElement(
    edge,
    new Map(h.elements.map((el) => [el.id, el])),
  )!;
  expect(await apply([{ op: "delete_edge", id: edge.id }])).toMatchObject({
    ok: true,
  });
  expect(h.elements.find((el) => el.id === label.id)?.isDeleted).toBe(true);
  expect(liveNodes()).toHaveLength(3);
});

it("invalidates queued writes and retry IDs across imports and drawing session changes", async () => {
  const before = await context();
  const pending = controller.apply({
    drawingSession: before.drawingSession,
    operations: three,
  });
  drawing = { session: "other", backendId: "other" };
  expect(await pending).toMatchObject({ error: { code: "DRAWING_CONFLICT" } });
  const now = await context();
  const imported = newElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 120,
    height: 120,
  });
  act(() => api.updateScene({ elements: [imported] }));
  await apply([{ op: "update_node", id: imported.id, text: "Import" }], {
    requestId: "retry",
  });
  const preImport = await context();
  act(() => api.updateScene({ appState: { isLoading: true } }));
  expect((await context()).drawingSession).not.toBe(preImport.drawingSession);
  expect(
    await controller.apply({
      drawingSession: preImport.drawingSession,
      operations: three,
    }),
  ).toMatchObject({ error: { code: "DRAWING_CONFLICT" } });
  act(() => api.updateScene({ elements: [], appState: { isLoading: false } }));
  expect(
    await apply([{ op: "add_node", text: "After import" }], {
      requestId: "retry",
    }),
  ).toMatchObject({ ok: true });
  expect(now.drawingSession).not.toBe(before.drawingSession);
});

it("checks abort after queueing and rejects an active human edit", async () => {
  const current = await context();
  const ac = new AbortController();
  const pending = controller.apply(
    { drawingSession: current.drawingSession, operations: three },
    { signal: ac.signal },
  );
  ac.abort();
  expect(await pending).toMatchObject({ error: { code: "ABORTED" } });
  const result = await apply(three);
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  const target = h.elements.find((el) => el.id === result.refs.a)!;
  act(() => api.updateScene({ appState: { resizingElement: target } }));
  expect(await apply([{ op: "add_node", text: "Busy" }])).toMatchObject({
    error: { code: "EDITOR_BUSY" },
  });
});

it("enforces schemas and limits including prototype property names", async () => {
  expect(
    await apply([{ op: "add_node", text: "X", constructor: {} }]),
  ).toMatchObject({ error: { code: "INVALID_INPUT" } });
  expect(
    await apply([{ op: "add_node", text: "X", x: Infinity }]),
  ).toMatchObject({ error: { code: "INVALID_INPUT" } });
  expect(
    await apply([
      { op: "add_node", ref: "x", text: "X" },
      { op: "add_node", ref: "x", text: "Y" },
    ]),
  ).toMatchObject({ error: { code: "INVALID_OPERATION" } });
  expect(
    await apply(
      Array.from({ length: 101 }, () => ({ op: "add_node", text: "X" })),
    ),
  ).toMatchObject({ error: { code: "INVALID_INPUT" } });
  expect(await controller.getContext({ limit: 201 })).toMatchObject({
    error: { code: "INVALID_INPUT" },
  });
  expect(
    await apply([
      { op: "add_node", text: "derived limit", x: 100000 },
      { op: "add_node", text: "too far" },
    ]),
  ).toMatchObject({ error: { code: "INVALID_OPERATION" } });
  expect(liveNodes()).toHaveLength(0);
});

it.each([true, false])(
  "serializes pending registration across cleanup/remount (modern=%s)",
  async (modern) => {
    const registered = new Map<string, unknown>();
    let resolveFirst!: () => void;
    const firstPending = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    let count = 0;
    const native: ModelContext = {
      registerTool: vi.fn(async (tool, options) => {
        if (++count === 1) {
          await firstPending;
        }
        if (options?.signal.aborted) {
          return;
        }
        expect(registered.has(tool.name)).toBe(false);
        registered.set(tool.name, tool);
        options?.signal.addEventListener("abort", () =>
          registered.delete(tool.name),
        );
      }),
      unregisterTool: vi.fn((name) => {
        registered.delete(name);
      }),
    };
    const cleanup = registerFlowTools(
      controller,
      modern ? { modelContext: native } : {},
      modern ? {} : { modelContext: native },
    );
    await Promise.resolve();
    const replacement = createFlowController(api, () => drawing);
    const cleanup2 = registerFlowTools(
      replacement,
      modern ? { modelContext: native } : {},
      modern ? {} : { modelContext: native },
    );
    cleanup();
    resolveFirst();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(registered.size).toBe(4);
    cleanup2();
    expect(registered.size).toBe(0);
  },
);

it("uses only context and the advertised batch in a fresh session, with committed confirmations", async () => {
  const tools = new Map<string, Parameters<ModelContext["registerTool"]>[0]>();
  const cleanup = registerFlowTools(
    controller,
    {
      modelContext: {
        registerTool: (tool) => {
          tools.set(tool.name, tool);
        },
      },
    },
    {},
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  const advertised = flowToolCatalog.find(
    (tool) => tool.name === "flow_apply_operations",
  )!;
  expect(advertised.description).toContain(
    JSON.stringify(quickStartOperations),
  );
  const current = (await tools.get("flow_get_context")!.execute({})) as Awaited<
    ReturnType<typeof context>
  >;
  const result = (await tools.get("flow_apply_operations")!.execute({
    drawingSession: current.drawingSession,
    expectedRevision: current.revision,
    operations: quickStartOperations,
  })) as Awaited<ReturnType<typeof controller.apply>>;
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  expect(result.results.flatMap((operation) => operation.elements)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: result.refs.video,
        kind: "node",
        text: "Video veröffentlichen",
        x: 0,
        y: 0,
        width: 120,
        height: 120,
      }),
      expect.objectContaining({
        id: result.refs.kontakt,
        kind: "node",
        text: "Kontakt erfassen",
        x: 240,
        y: 0,
      }),
      expect.objectContaining({
        id: result.refs.webinar,
        kind: "node",
        text: "Webinar durchführen",
        x: 480,
        y: 0,
      }),
      expect.objectContaining({
        kind: "edge",
        from: result.refs.video,
        to: result.refs.kontakt,
      }),
      expect.objectContaining({
        kind: "edge",
        from: result.refs.kontakt,
        to: result.refs.webinar,
      }),
    ]),
  );
  const updated = await apply([
    { op: "update_node", id: result.refs.kontakt, text: "Aktualisiert" },
  ]);
  expect(updated).toMatchObject({
    results: [
      { elements: [expect.objectContaining({ text: "Aktualisiert" })] },
    ],
  });
  const deleted = await apply([{ op: "delete_node", id: result.refs.kontakt }]);
  expect(deleted).toMatchObject({
    results: [
      {
        elements: expect.arrayContaining([
          { id: result.refs.kontakt, deleted: true },
        ]),
      },
    ],
  });
  Keyboard.undo();
  Keyboard.undo();
  Keyboard.undo();
  expect(liveNodes()).toHaveLength(0);
  cleanup();
});

const applyFlow = async (
  operations: unknown[],
  extra: Record<string, unknown> = {},
) => {
  const current = await context();
  return controller.applyFlow({
    drawingSession: current.drawingSession,
    expectedRevision: current.revision,
    operations,
    ...extra,
  });
};
it("enforces noun/action steps, fixed grid, branches, explicit loops and insertion with undo", async () => {
  const created = await applyFlow([
    {
      op: "append_steps",
      steps: [
        { object: "Video", action: "veröffentlichen", ref: "a" },
        { object: "Interesse", action: "prüfen", kind: "decision", ref: "b" },
        { object: "Termin", action: "buchen", ref: "c" },
      ],
    },
    {
      op: "branch_steps",
      from: "b",
      label: "nein",
      steps: [
        { object: "Kontakt", action: "begleiten", ref: "d" },
        { object: "Webinar", action: "bewerben", ref: "e" },
      ],
    },
    { op: "connect_loop", from: "e", to: "a", label: "wiederholen" },
  ]);
  if (!created.ok) {
    throw new Error(JSON.stringify(created));
  }
  expect(
    liveNodes().map((node) => [node.x, node.y, node.width, node.height]),
  ).toEqual([
    [0, 0, 120, 120],
    [240, 0, 120, 120],
    [480, 0, 120, 120],
    [240, 240, 120, 120],
    [480, 240, 120, 120],
  ]);
  expect(liveEdges()).toHaveLength(5);
  const ab = liveEdges().find(
    (edge) =>
      isArrowElement(edge) &&
      edge.startBinding?.elementId === created.refs.a &&
      edge.endBinding?.elementId === created.refs.b,
  )!;
  const insertion = await applyFlow([
    {
      op: "insert_steps",
      edgeId: ab.id,
      steps: [{ object: "Kontakt", action: "erfassen", ref: "middle" }],
    },
  ]);
  if (!insertion.ok) {
    throw new Error(JSON.stringify(insertion));
  }
  expect(liveNodes().find((node) => node.id === insertion.refs.middle)?.x).toBe(
    240,
  );
  expect(liveNodes().find((node) => node.id === created.refs.b)?.x).toBe(480);
  expect(liveNodes().find((node) => node.id === created.refs.c)?.x).toBe(720);
  Keyboard.undo();
  expect(liveNodes().find((node) => node.id === created.refs.b)?.x).toBe(240);
  Keyboard.undo();
  expect(liveNodes()).toHaveLength(0);
  Keyboard.redo();
  expect(liveNodes()).toHaveLength(5);
});
it("rejects bypasses, prose, occupied cells and forward/disconnected loop targets atomically", async () => {
  const seed = await applyFlow(quickStartOperations);
  if (!seed.ok) {
    throw new Error(JSON.stringify(seed));
  }
  const before = JSON.stringify(h.elements);
  const revision = (await context()).revision;
  for (const invalid of [
    { op: "add_node", text: "Raw bypass" },
    {
      op: "append_steps",
      after: seed.refs.webinar,
      x: 960,
      steps: [{ object: "Termin", action: "buchen" }],
    },
    {
      op: "append_steps",
      after: seed.refs.webinar,
      steps: [{ object: "Dieses Webinar", action: "jetzt buchen" }],
    },
    {
      op: "append_steps",
      after: seed.refs.webinar,
      steps: [{ object: "Webinar\nDetails", action: "bewerben" }],
    },
    {
      op: "append_steps",
      after: seed.refs.video,
      steps: [{ object: "Termin", action: "buchen" }],
    },
    { op: "connect_loop", from: seed.refs.video, to: seed.refs.webinar },
  ]) {
    expect(
      await applyFlow([
        {
          op: "rename_node",
          id: seed.refs.video,
          object: "Video",
          action: "bewerben",
        },
        invalid,
      ]),
    ).toMatchObject({ ok: false });
    expect(JSON.stringify(h.elements)).toBe(before);
    expect((await context()).revision).toBe(revision);
  }
  const unrelated = await apply([
    { op: "add_node", text: "Separate", x: 0, y: 480 },
  ]);
  if (!unrelated.ok) {
    throw new Error(JSON.stringify(unrelated));
  }
  const separate = liveNodes().find((node) => node.y === 480)!;
  expect(
    await applyFlow([
      { op: "connect_loop", from: seed.refs.webinar, to: separate.id },
    ]),
  ).toMatchObject({ error: { code: "INVALID_OPERATION" } });
});
it("keeps terminals concise and rejects off-grid anchors and oversized result labels", async () => {
  const created = await applyFlow([
    {
      op: "append_steps",
      steps: [
        { kind: "start", ref: "start" },
        { object: "Video", action: "veröffentlichen" },
        { kind: "end", ref: "end" },
      ],
    },
  ]);
  expect(created).toMatchObject({ ok: true });
  const map = new Map(h.elements.map((el) => [el.id, el]));
  expect(
    liveNodes().map((node) => getBoundTextElement(node, map)?.originalText),
  ).toEqual(["Start", "Video veröffentlichen", "Ende"]);
  expect(
    await applyFlow([
      { op: "append_steps", steps: [{ object: "Video", action: "bewerben" }] },
    ]),
  ).toMatchObject({ error: { code: "INVALID_OPERATION" } });
  const anchor = liveNodes()[2];
  await apply([{ op: "update_node", id: anchor.id, x: 501 }]);
  expect(
    await applyFlow([
      {
        op: "append_steps",
        after: anchor.id,
        steps: [{ object: "Termin", action: "buchen" }],
      },
    ]),
  ).toMatchObject({ error: { code: "INVALID_OPERATION" } });
  expect(
    await applyFlow([
      {
        op: "rename_node",
        id: liveNodes()[0].id,
        object: "Kundeninformationen",
        action: "zusammenstellen",
      },
    ]),
  ).toMatchObject({ error: { code: "INVALID_OPERATION" } });
});

it("keeps a lowest-row leaf in place and supports long bottom return arrows", async () => {
  const result = await applyFlow([
    {
      op: "append_steps",
      steps: Array.from({ length: 11 }, (_, index) => ({
        object: "Daten",
        action: "prüfen",
        ref: `step${index}`,
      })),
    },
    { op: "connect_loop", from: "step10", to: "step0", ref: "return" },
  ]);
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  expect(liveNodes()).toHaveLength(11);
  expect(liveNodes().every((node) => node.y === 0)).toBe(true);
  const edge = liveEdges().find((item) => item.id === result.refs.return)!;
  if (!isArrowElement(edge)) {
    throw new Error("Expected arrow");
  }
  expect(edge.width).toBe(2400);
  expect(edge.startBinding?.fixedPoint).toEqual([0.5, 1]);
  expect(edge.endBinding?.fixedPoint).toEqual([0.5, 1]);
  expect(edge.y + edge.points[1][1]).toBeGreaterThan(120);
  expect(liveNodes().find((node) => node.id === result.refs.step10)?.y).toBe(0);
});

it("routes loops from bottom to bottom around a node below the target, lowers leaf sources and keeps repairs idempotent", async () => {
  const seed = await apply([
    { op: "add_node", text: "Video zeigen", x: 0, y: 0, ref: "a" },
    { op: "add_node", text: "Termin buchen", x: 240, y: 240, ref: "b" },
    { op: "add_node", text: "Themen sammeln", x: 480, y: 0, ref: "c" },
    { op: "add_node", text: "Daten prüfen", x: 0, y: 240, ref: "obstacle" },
    { op: "connect_nodes", from: "a", to: "b" },
    { op: "connect_nodes", from: "b", to: "c" },
  ]);
  if (!seed.ok) {
    throw new Error(JSON.stringify(seed));
  }
  const loop = await applyFlow([
    {
      op: "connect_loop",
      from: seed.refs.c,
      to: seed.refs.a,
      ref: "return",
      label: "neue Videos",
    },
  ]);
  if (!loop.ok) {
    throw new Error(JSON.stringify(loop));
  }
  const source = liveNodes().find((node) => node.id === seed.refs.c)!;
  const target = liveNodes().find((node) => node.id === seed.refs.a)!;
  expect(source.y).toBe(240);
  const edge = liveEdges().find((edge) => edge.id === loop.refs.return)!;
  if (!isArrowElement(edge)) {
    throw new Error("Expected arrow");
  }
  expect(edge.startBinding?.fixedPoint).toEqual([0.5, 1]);
  expect(edge.endBinding?.fixedPoint).toEqual([0.5, 1]);
  const points = edge.points.map(([x, y]) => [edge.x + x, edge.y + y]);
  expect(points[0][1]).toBe(source.y + source.height + 6);
  expect(points[1][1]).toBeGreaterThan(points[0][1]);
  expect(points.at(-1)![1]).toBe(target.y + target.height + 6);
  expect(points.at(-2)![1]).toBeGreaterThan(points.at(-1)![1]);
  // Independent segment/bounds assertion; the target-column obstacle forces
  // an extra side detour, rather than only a U-shaped line below both nodes.
  expect(points.length).toBeGreaterThan(4);
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    expect(a[0] === b[0] || a[1] === b[1]).toBe(true);
    for (const node of liveNodes()) {
      expect(
        Math.max(a[0], b[0]) > node.x &&
          Math.min(a[0], b[0]) < node.x + node.width &&
          Math.max(a[1], b[1]) > node.y &&
          Math.min(a[1], b[1]) < node.y + node.height,
      ).toBe(false);
    }
  }
  const before = JSON.stringify(h.elements);
  const repaired = await applyFlow([{ op: "route_loop", edgeId: edge.id }]);
  expect(repaired.ok).toBe(true);
  expect(JSON.stringify(h.elements)).toBe(before);
  expect(
    getBoundTextElement(edge, new Map(h.elements.map((el) => [el.id, el])))
      ?.originalText,
  ).toBe("neue Videos");
  Keyboard.undo();
  expect(liveEdges().some((item) => item.id === edge.id)).toBe(false);
  expect(liveNodes().find((node) => node.id === source.id)?.y).toBe(0);
  Keyboard.redo();
  expect(liveEdges().some((item) => item.id === edge.id)).toBe(true);
});

it("keeps overlapping loop return lanes separate and repairs stable", async () => {
  const seed = await apply([
    { op: "add_node", text: "Video zeigen", x: 0, y: 0, ref: "a" },
    { op: "add_node", text: "Call anbieten", x: 240, y: 0, ref: "b" },
    { op: "add_node", text: "Themen sammeln", x: 480, y: 0, ref: "c" },
    { op: "add_node", text: "Replay senden", x: 480, y: 240, ref: "d" },
    { op: "add_node", text: "Kontakt pflegen", x: 720, y: 240, ref: "e" },
    { op: "connect_nodes", from: "a", to: "b" },
    { op: "connect_nodes", from: "b", to: "c" },
    { op: "connect_nodes", from: "b", to: "d" },
    { op: "connect_nodes", from: "d", to: "e" },
  ]);
  if (!seed.ok) {
    throw new Error(JSON.stringify(seed));
  }
  const loops = await applyFlow([
    { op: "connect_loop", from: seed.refs.c, to: seed.refs.a, ref: "content" },
    { op: "connect_loop", from: seed.refs.e, to: seed.refs.b, ref: "followup" },
  ]);
  if (!loops.ok) {
    throw new Error(JSON.stringify(loops));
  }
  const arrows = liveEdges().filter((edge) =>
    [loops.refs.content, loops.refs.followup].includes(edge.id),
  );
  expect(arrows).toHaveLength(2);
  const horizontalSegments = arrows.map((edge) => {
    if (!isArrowElement(edge)) {
      throw new Error("Expected arrow");
    }
    const points = edge.points.map(([x, y]) => [edge.x + x, edge.y + y]);
    return points.flatMap((point, index) =>
      index && point[1] === points[index - 1][1]
        ? [[points[index - 1], point]]
        : [],
    );
  });
  for (const [a, b] of horizontalSegments[0]) {
    for (const [c, d] of horizontalSegments[1]) {
      expect(
        a[1] === c[1] &&
          Math.max(a[0], b[0]) > Math.min(c[0], d[0]) &&
          Math.min(a[0], b[0]) < Math.max(c[0], d[0]),
      ).toBe(false);
    }
  }
  const before = JSON.stringify(h.elements);
  expect(
    (
      await applyFlow(
        arrows.map((edge) => ({ op: "route_loop", edgeId: edge.id })),
      )
    ).ok,
  ).toBe(true);
  expect(JSON.stringify(h.elements)).toBe(before);
});

it("rejects a changed connector crossing an intervening node without committing the batch", async () => {
  const seed = await apply([
    { op: "add_node", text: "Video zeigen", x: 0, y: 0, ref: "a" },
    {
      op: "add_node",
      text: "Blocker",
      x: 160,
      y: 0,
      width: 40,
      height: 120,
      ref: "obstacle",
    },
  ]);
  if (!seed.ok) {
    throw new Error(JSON.stringify(seed));
  }
  const before = JSON.stringify(h.elements);
  const revision = (await context()).revision;
  const result = await applyFlow([
    {
      op: "append_steps",
      after: seed.refs.a,
      steps: [{ object: "Termin", action: "buchen" }],
    },
  ]);
  expect(result).toMatchObject({
    ok: false,
    error: {
      code: "INVALID_OPERATION",
      message: expect.stringContaining("overlaps a node"),
    },
  });
  expect(JSON.stringify(h.elements)).toBe(before);
  expect((await context()).revision).toBe(revision);
});

it("rejects a blocked bottom port and retains labels, positions and revision atomically", async () => {
  const seed = await apply([
    { op: "add_node", text: "Video zeigen", x: 0, y: 0, ref: "a" },
    { op: "add_node", text: "Termin buchen", x: 240, y: 0, ref: "b" },
    { op: "add_node", text: "Themen sammeln", x: 480, y: 0, ref: "c" },
    { op: "add_node", text: "Blocker", x: 0, y: 120, ref: "obstacle" },
    { op: "connect_nodes", from: "a", to: "b" },
    { op: "connect_nodes", from: "b", to: "c" },
  ]);
  if (!seed.ok) {
    throw new Error(JSON.stringify(seed));
  }
  const before = JSON.stringify(h.elements);
  const revision = (await context()).revision;
  const result = await applyFlow([
    { op: "rename_node", id: seed.refs.b, object: "Bedarf", action: "klären" },
    { op: "connect_loop", from: seed.refs.c, to: seed.refs.a },
  ]);
  expect(result).toMatchObject({
    ok: false,
    error: {
      code: "INVALID_OPERATION",
      message: expect.stringContaining("No clear bottom loop corridor"),
    },
  });
  expect(JSON.stringify(h.elements)).toBe(before);
  expect((await context()).revision).toBe(revision);
});

it("exports a guarded snapshot without editing preferences, scene or undo history", async () => {
  await apply(three);
  const current = await context();
  const before = JSON.stringify(h.elements);
  const prefs = api.getAppState().exportScale;
  const result = await controller.exportAs({
    drawingSession: current.drawingSession,
    expectedRevision: current.revision,
    format: "md",
    destination: "clipboard",
  });
  expect(result).toMatchObject({
    ok: true,
    drawingSession: current.drawingSession,
    revision: current.revision,
  });
  expect(JSON.stringify(h.elements)).toBe(before);
  expect(api.getAppState().exportScale).toBe(prefs);
  Keyboard.undo();
  expect(liveNodes()).toHaveLength(0);
});

it("rejects malformed exports, stale identity/revision and cancellation before any IO", async () => {
  vi.mocked(exportDrawing).mockClear();
  const current = await context();
  const valid = {
    drawingSession: current.drawingSession,
    format: "png",
    destination: "server",
  };
  for (const patch of [
    { format: undefined },
    { formats: ["png", "md"] },
    { format: undefined, formats: ["png", "png"] },
    { format: undefined, formats: ["png"], destination: "save" },
    { format: "md", imageOptions: { scale: 2 } },
    { imageOptions: { scale: 4 } },
    { name: "../escape" },
    { surprise: true },
  ]) {
    expect(await controller.exportAs({ ...valid, ...patch })).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
  }
  expect(
    await controller.exportAs({ ...valid, drawingSession: "old" }),
  ).toMatchObject({ error: { code: "DRAWING_CONFLICT" } });
  expect(
    await controller.exportAs({
      ...valid,
      expectedRevision: current.revision + 1,
    }),
  ).toMatchObject({ error: { code: "REVISION_CONFLICT" } });
  const aborted = new AbortController();
  aborted.abort();
  expect(
    await controller.exportAs(valid, { signal: aborted.signal }),
  ).toMatchObject({ error: { code: "ABORTED" } });
  expect(exportDrawing).not.toHaveBeenCalled();
});

it("queues exports, keeps their captured identity during drawing switches and aborts pending work", async () => {
  const pending = resolvablePromise<any>();
  vi.mocked(exportDrawing).mockImplementationOnce(async () => pending);
  const current = await context();
  const input = {
    drawingSession: current.drawingSession,
    formats: ["png", "md"],
    destination: "server",
  };
  const first = controller.exportAs(input);
  await waitFor(() => expect(exportDrawing).toHaveBeenCalled());
  const cancelled = new AbortController();
  const second = controller.exportAs(input, { signal: cancelled.signal });
  cancelled.abort();
  drawing = { session: "drawing-new", backendId: null };
  pending.resolve({ destination: "server", uuid: "shared", exports: [] });
  expect(await first).toMatchObject({
    ok: true,
    drawingSession: current.drawingSession,
    revision: current.revision,
    uuid: "shared",
  });
  expect(await second).toMatchObject({ error: { code: "ABORTED" } });
});

it("fails quickly when the app is not focused instead of waiting on clipboard permission", async () => {
  vi.mocked(exportDrawing).mockClear();
  vi.spyOn(document, "hasFocus").mockReturnValue(false);
  const current = await context();
  expect(
    await controller.exportAs({
      drawingSession: current.drawingSession,
      format: "md",
      destination: "clipboard",
    }),
  ).toMatchObject({ error: { code: "EDITOR_NOT_FOCUSED" } });
  expect(exportDrawing).not.toHaveBeenCalled();
  expect(await controller.getContext({})).toMatchObject({ ok: true });
});

it("allows editing while captured export IO is pending", async () => {
  const pending = resolvablePromise<any>();
  vi.mocked(exportDrawing).mockClear();
  vi.mocked(exportDrawing).mockImplementationOnce(async () => pending);
  const current = await context();
  const exported = controller.exportAs({
    drawingSession: current.drawingSession,
    format: "md",
    destination: "save",
  });
  await waitFor(() => expect(exportDrawing).toHaveBeenCalledTimes(1));
  expect(await apply(three)).toMatchObject({ ok: true });
  pending.resolve({
    format: "md",
    destination: "save",
    fileName: "Original.md",
  });
  expect(await exported).toMatchObject({
    ok: true,
    revision: current.revision,
  });
  expect(liveNodes()).toHaveLength(3);
});
