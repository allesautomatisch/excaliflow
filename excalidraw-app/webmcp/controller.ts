import { randomId } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";
import { getBoundTextElement } from "@excalidraw/element/textElement";
import {
  isArrowElement,
  isFlowchartNodeElement,
  isFrameLikeElement,
} from "@excalidraw/element/typeChecks";
import { flushSync } from "react-dom";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { applyOperations } from "./operations";
import { applySchema as engineSchema } from "./engineSchema";
import { applyFlowOperations } from "./flowOperations";
import {
  applySchema,
  contextSchema,
  contractVersion,
  flowRules,
  validate,
} from "./schema";

import { exportDrawing, exportSchema } from "./export";

import type { Operation } from "./operations";
import type { ExportInput } from "./export";

type Drawing = { session: string; backendId: string | null; loading?: boolean };
type ApplyInput = {
  drawingSession: string;
  expectedRevision?: number;
  requestId?: string;
  operations: Operation[];
};
type ContextInput = {
  ids?: string[];
  selectedOnly?: boolean;
  detail?: string;
  offset?: number;
  limit?: number;
};
const fingerprint = (
  elements: readonly ExcalidrawElement[],
  name: string | null,
) =>
  JSON.stringify([
    name,
    elements.map((el) => [
      el.id,
      el.version,
      el.versionNonce,
      el.isDeleted,
      el.index,
    ]),
  ]);

export function createFlowController(
  api: ExcalidrawImperativeAPI,
  getDrawing: () => Drawing,
) {
  const controllerSession = randomId();
  let disposed = false;
  let session = "";
  let revision = 0;
  let lastFingerprint = "";
  let nativeImport = 0;
  let lastDrawing = "";
  let wasLoading = false;
  let lastIds = new Set<string>();
  let queue: Promise<unknown> = Promise.resolve();
  const success = (
    refs: Record<string, string>,
    results: { op: string; ids: string[] }[],
  ) => {
    const snap = snapshot();
    const map = new Map(snap.elements.map((item) => [item.id, item]));
    return {
      ok: true as const,
      ...identity(),
      refs,
      results: results.map((result) => ({
        ...result,
        elements: result.ids.flatMap<Record<string, unknown>>((id) => {
          const item = map.get(id);
          if (!item) {
            return [];
          }
          if (item.isDeleted) {
            return [{ id, deleted: true }];
          }
          if (!isArrowElement(item) && !isFlowchartNodeElement(item)) {
            return [];
          }
          return [
            {
              id,
              kind: isArrowElement(item) ? "edge" : "node",
              shape: item.type,
              text: (getBoundTextElement(item, map)?.originalText ?? "").slice(
                0,
                500,
              ),
              ...(isArrowElement(item)
                ? {
                    from: item.startBinding?.elementId ?? null,
                    to: item.endBinding?.elementId ?? null,
                  }
                : {
                    x: item.x,
                    y: item.y,
                    width: item.width,
                    height: item.height,
                  }),
            },
          ];
        }),
      })),
    };
  };
  const requests = new Map<
    string,
    { input: string; result: ReturnType<typeof success> }
  >();
  const snapshot = () => {
    const drawing = getDrawing();
    const elements = api.getSceneElementsIncludingDeleted();
    const state = api.getAppState();
    if (lastDrawing !== drawing.session) {
      lastDrawing = drawing.session;
      nativeImport = 0;
      lastIds.clear();
      wasLoading = state.isLoading;
    } else if (state.isLoading && !wasLoading) {
      // Native file imports / scene resets also establish a new session.
      nativeImport++;
    } else if (
      !state.isLoading &&
      !wasLoading &&
      lastIds.size &&
      !elements.some((el) => lastIds.has(el.id))
    ) {
      nativeImport++;
    }
    wasLoading = state.isLoading;
    lastIds = new Set(elements.map((el) => el.id));
    const drawingSession = `${controllerSession}:${drawing.session}:${nativeImport}`;
    if (drawingSession !== session) {
      session = drawingSession;
      revision = 0;
      lastFingerprint = "";
      requests.clear();
    }
    const next = fingerprint(elements, state.name);
    if (next !== lastFingerprint) {
      revision++;
      lastFingerprint = next;
    }
    return { elements, state, drawing, drawingSession, revision };
  };
  let pointerActive = false;
  const pointerDown = api.onPointerDown(() => {
    pointerActive = true;
  });
  const pointerUp = api.onPointerUp(() => {
    pointerActive = false;
  });
  const unsubscribe = api.onChange(() => snapshot());
  const error = (code: string, message: string) => ({
    ok: false as const,
    error: { code, message },
    ...identity(),
  });
  const identity = () => {
    const snap = snapshot();
    return {
      contractVersion,
      flowRules,
      drawingSession: snap.drawingSession,
      revision: snap.revision,
    };
  };
  const getContext = async (input: unknown = {}) => {
    if (disposed) {
      return error("SESSION_CLOSED", "Editor session is closed");
    }
    try {
      validate(contextSchema, input);
    } catch (err) {
      return error("INVALID_INPUT", (err as Error).message);
    }
    const {
      ids,
      selectedOnly,
      detail,
      offset = 0,
      limit = 100,
    } = input as ContextInput;
    const snap = snapshot();
    const map = new Map(snap.elements.map((item) => [item.id, item]));
    const selectedIds = Object.keys(snap.state.selectedElementIds).filter(
      (id) => snap.state.selectedElementIds[id],
    );
    const candidates = snap.elements.filter(
      (el) =>
        !el.isDeleted &&
        (isFlowchartNodeElement(el) ||
          isArrowElement(el) ||
          isFrameLikeElement(el)) &&
        (!ids || ids.includes(el.id)) &&
        (!selectedOnly || selectedIds.includes(el.id)),
    );
    return {
      ok: true as const,
      contractVersion,
      flowRules,
      drawingSession: snap.drawingSession,
      revision: snap.revision,
      drawing: {
        backendId: nativeImport ? null : snap.drawing.backendId,
        name: snap.state.name,
      },
      editable:
        !snap.state.viewModeEnabled &&
        !snap.state.isLoading &&
        !snap.drawing.loading,
      selectedIds: selectedIds.slice(0, 200),
      total: candidates.length,
      nextOffset: offset + limit < candidates.length ? offset + limit : null,
      elements: candidates.slice(offset, offset + limit).map((item) => ({
        id: item.id,
        kind: isArrowElement(item)
          ? "edge"
          : isFlowchartNodeElement(item)
          ? "node"
          : "container",
        shape: item.type,
        text: (getBoundTextElement(item, map)?.originalText ?? "").slice(
          0,
          500,
        ),
        frameId: item.frameId,
        locked: item.locked,
        ...(isArrowElement(item)
          ? {
              from: item.startBinding?.elementId ?? null,
              to: item.endBinding?.elementId ?? null,
              startArrowhead: item.startArrowhead,
              endArrowhead: item.endArrowhead,
            }
          : { x: item.x, y: item.y, width: item.width, height: item.height }),
        ...(detail === "geometry"
          ? {
              x: item.x,
              y: item.y,
              width: item.width,
              height: item.height,
              strokeColor: item.strokeColor,
              backgroundColor: item.backgroundColor,
              strokeWidth: item.strokeWidth,
              ...(isArrowElement(item) ? { points: item.points } : {}),
            }
          : {}),
      })),
    };
  };
  const apply = (
    input: unknown,
    options?: { signal?: AbortSignal },
    flow = false,
  ) => {
    const execute = () => {
      if (disposed) {
        return error("SESSION_CLOSED", "Editor session is closed");
      }
      if (options?.signal?.aborted) {
        return error("ABORTED", "Tool execution was cancelled");
      }
      try {
        validate(flow ? applySchema : engineSchema, input);
      } catch (err) {
        return error("INVALID_INPUT", (err as Error).message);
      }
      const request = input as ApplyInput;
      const snap = snapshot();
      if (request.drawingSession !== snap.drawingSession) {
        return error(
          "DRAWING_CONFLICT",
          "Drawing session changed; read context again",
        );
      }
      const serialized = JSON.stringify([flow, request]);
      const previous = request.requestId
        ? requests.get(request.requestId)
        : undefined;
      if (previous) {
        return previous.input === serialized
          ? previous.result
          : error(
              "REQUEST_ID_CONFLICT",
              "requestId already used with different input",
            );
      }
      if (
        request.expectedRevision !== undefined &&
        request.expectedRevision !== snap.revision
      ) {
        return error("REVISION_CONFLICT", "Scene changed; read context again");
      }
      if (
        snap.state.viewModeEnabled ||
        snap.state.isLoading ||
        snap.drawing.loading
      ) {
        return error("READ_ONLY", "Drawing is not editable");
      }
      if (
        snap.state.editingTextElement ||
        snap.state.newElement ||
        snap.state.resizingElement ||
        snap.state.isRotating ||
        pointerActive
      ) {
        return error(
          "EDITOR_BUSY",
          "Finish the current human edit before retrying",
        );
      }
      if (snap.elements.length > 10000) {
        return error("LIMIT_EXCEEDED", "Scene exceeds 10000 elements");
      }
      try {
        const batch = (flow ? applyFlowOperations : applyOperations)(
          snap.elements,
          snap.state,
          request.operations,
        );
        if (batch.elements.length > 10000) {
          return error("LIMIT_EXCEEDED", "Batch exceeds scene limit");
        }
        // No await between the fresh snapshot, validation and commit. JS event-loop
        // ordering prevents human/collaboration edits from interleaving here.
        flushSync(() =>
          api.updateScene({
            elements: batch.elements,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          }),
        );
        const result = success(batch.refs, batch.results);
        if (request.requestId) {
          requests.set(request.requestId, { input: serialized, result });
          if (requests.size > 100) {
            requests.delete(requests.keys().next().value!);
          }
        }
        return result;
      } catch (err) {
        return error("INVALID_OPERATION", (err as Error).message);
      }
    };
    const result = queue.then(execute);
    queue = result.catch(() => undefined);
    return result;
  };
  const exportAs = (input: unknown, options?: { signal?: AbortSignal }) => {
    const execute = async () => {
      if (disposed) {
        return error("SESSION_CLOSED", "Editor session is closed");
      }
      if (options?.signal?.aborted) {
        return error("ABORTED", "Tool execution was cancelled");
      }
      try {
        validate(exportSchema, input);
        const request = input as ExportInput;
        if (Boolean(request.format) === Boolean(request.formats)) {
          throw new Error("Provide either format or formats");
        }
        if (
          request.formats &&
          new Set(request.formats).size !== request.formats.length
        ) {
          throw new Error("formats must contain unique formats");
        }
        if (request.formats && request.destination !== "server") {
          throw new Error("formats batches require destination=server");
        }
        if (
          request.imageOptions &&
          !(request.formats ?? [request.format]).some(
            (format) => format === "png" || format === "svg",
          )
        ) {
          throw new Error("imageOptions only apply to png/svg");
        }
        if (
          request.name &&
          (/[\\/]/.test(request.name) ||
            [...request.name].some((char) => char.charCodeAt(0) < 32))
        ) {
          throw new Error("name must be a filename stem, not a path");
        }
      } catch (err) {
        return error("INVALID_INPUT", (err as Error).message);
      }
      const request = input as ExportInput;
      const snap = snapshot();
      if (request.drawingSession !== snap.drawingSession) {
        return error(
          "DRAWING_CONFLICT",
          "Drawing session changed; read context again",
        );
      }
      if (
        request.expectedRevision !== undefined &&
        request.expectedRevision !== snap.revision
      ) {
        return error("REVISION_CONFLICT", "Scene changed; read context again");
      }
      if (
        snap.state.isLoading ||
        snap.drawing.loading ||
        snap.state.editingTextElement ||
        snap.state.newElement ||
        snap.state.resizingElement ||
        snap.state.isRotating ||
        pointerActive
      ) {
        return error(
          "EDITOR_BUSY",
          "Finish loading or the current human edit before exporting",
        );
      }
      if (request.destination === "clipboard" && !document.hasFocus()) {
        return error(
          "EDITOR_NOT_FOCUSED",
          "Focus the app tab before copying to clipboard",
        );
      }
      if (snap.elements.length > 10000) {
        return error("LIMIT_EXCEEDED", "Scene exceeds 10000 elements");
      }
      try {
        const result = await exportDrawing(
          request,
          {
            elements: snap.elements,
            state: snap.state,
            files: api.getFiles(),
          },
          options?.signal,
        );
        // The output describes the captured drawing, even if a human switches
        // drawings while the native save dialog is open. No scene commit occurs.
        return {
          ok: true as const,
          contractVersion,
          drawingSession: snap.drawingSession,
          revision: snap.revision,
          ...result,
        };
      } catch (err) {
        return error(
          (err as Error).name === "AbortError" ? "ABORTED" : "EXPORT_FAILED",
          (err as Error).message,
        );
      }
    };
    const result = queue.then(execute);
    // execute captures/clones the snapshot before its first await. Export IO
    // (system clipboard or a save dialog) must not hold the editing queue open.
    queue = queue.then(() => undefined);
    return result;
  };
  return {
    getContext,
    exportAs,
    apply,
    applyFlow: (input: unknown, options?: { signal?: AbortSignal }) =>
      apply(input, options, true),
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      unsubscribe();
      pointerDown();
      pointerUp();
      requests.clear();
    },
  };
}
