import {
  convertElementType,
  adjustBoundTextSize,
} from "@excalidraw/excalidraw/components/ConvertElementTypePopup";
import { moveFlowchartFollowingNodes } from "@excalidraw/element/flowchartInsertion";
import { FONT_FAMILY } from "@excalidraw/common";
import { Scene } from "@excalidraw/element/Scene";
import {
  createBindingArrow,
  getNextFlowchartNodePosition,
} from "@excalidraw/element/flowchart";
import { BPD_DEFAULT_SHAPE_BACKGROUNDS } from "@excalidraw/element/flowchartDefaults";
import {
  fixBindingsAfterDeletion,
  updateBoundElements,
} from "@excalidraw/element/binding";
import { elementsAreInFrameBounds } from "@excalidraw/element/frame";
import { newElement, newTextElement } from "@excalidraw/element/newElement";
import {
  getBoundTextElement,
  redrawTextBoundingBox,
} from "@excalidraw/element/textElement";
import {
  isArrowElement,
  isFlowchartNodeElement,
  isFrameLikeElement,
} from "@excalidraw/element/typeChecks";

import type { AppState } from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  ExcalidrawFlowchartNodeElement,
  ExcalidrawArrowElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { routeLoopbacks, segmentHitsNode } from "./loopRouting";

import type { shapes } from "./engineSchema";

type Style = Partial<
  Pick<
    ExcalidrawElement,
    | "strokeColor"
    | "backgroundColor"
    | "strokeWidth"
    | "strokeStyle"
    | "opacity"
  >
>;
type NodeSpec = {
  ref?: string;
  text?: string;
  shape?: typeof shapes[number];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  style?: Style;
  frameId?: string | null;
  after?: string;
  direction?: "up" | "right" | "down" | "left";
  gap?: number;
};
export type Operation = NodeSpec & {
  op: string;
  id?: string;
  from?: string;
  to?: string;
  label?: string;
  edgeId?: string;
  nodes?: NodeSpec[];
  loopRoute?: boolean;
};

// No live element is mutated: Scene and all existing helpers receive only clones.
export function applyOperations(
  elements: readonly ExcalidrawElement[],
  state: AppState,
  operations: Operation[],
  gridSize: number | null = null,
) {
  const scene = new Scene(JSON.parse(JSON.stringify(elements)));
  const refs: Record<string, string> = Object.create(null);
  const results: { op: string; ids: string[] }[] = [];
  const changed = new Set<string>();
  const touchedEdges = new Set<string>();
  const loopEdges = new Set<string>();
  const resolve = (id: string) => refs[id] ?? id;
  const get = (id: string) => {
    const element = scene.getNonDeletedElementsMap().get(resolve(id));
    if (!element) {
      throw new Error(`Element not found: ${id}`);
    }
    if (
      element.locked ||
      (element.frameId &&
        scene.getNonDeletedElementsMap().get(element.frameId)?.locked)
    ) {
      throw new Error(`Element is locked: ${id}`);
    }
    return element;
  };
  const node = (id: string) => {
    const element = get(id);
    if (!isFlowchartNodeElement(element)) {
      throw new Error(`Not a flowchart node: ${id}`);
    }
    return element;
  };
  const edge = (id: string) => {
    const element = get(id);
    if (!isArrowElement(element)) {
      throw new Error(`Not an arrow: ${id}`);
    }
    return element;
  };
  const remember = (ref: string | undefined, id: string) => {
    if (ref) {
      if (refs[ref] || scene.getElementsMapIncludingDeleted().has(ref)) {
        throw new Error(`Duplicate or colliding reference: ${ref}`);
      }
      refs[ref] = id;
    }
  };
  const append = (...items: ExcalidrawElement[]) =>
    scene.replaceAllElements([
      ...scene.getElementsIncludingDeleted(),
      ...items,
    ]);
  const membership = (
    element: ExcalidrawFlowchartNodeElement,
    frameId?: string | null,
  ) => {
    const map = scene.getNonDeletedElementsMap();
    const frames = scene.getNonDeletedFramesLikes();
    const frame =
      frameId === null
        ? null
        : frameId
        ? get(frameId)
        : frames.find((candidate) =>
            elementsAreInFrameBounds([element], candidate, map),
          );
    if (
      frame &&
      (!isFrameLikeElement(frame) ||
        !elementsAreInFrameBounds([element], frame, map))
    ) {
      throw new Error("Node must fit completely inside its frame/swimlane");
    }
    if (frame?.locked) {
      throw new Error("Container is locked");
    }
    scene.mutateElement(element, { frameId: frame?.id ?? null });
    const bound = getBoundTextElement(element, map);
    if (bound && bound.frameId !== element.frameId) {
      get(bound.id);
      scene.mutateElement(bound, { frameId: element.frameId });
    }
  };
  const label = (
    container: ExcalidrawFlowchartNodeElement | ExcalidrawArrowElement,
    text: string,
  ) => {
    let bound: ExcalidrawTextElement | null = getBoundTextElement(
      container,
      scene.getNonDeletedElementsMap(),
    );
    if (bound) {
      get(bound.id);
      scene.mutateElement(bound, {
        text,
        originalText: text,
        frameId: container.frameId,
      });
    } else {
      bound = newTextElement({
        x: container.x,
        y: container.y,
        text,
        fontFamily: FONT_FAMILY["Comic Shanns"],
        fontSize: 16,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: container.id,
        frameId: container.frameId,
        strokeColor: container.strokeColor,
      });
      scene.mutateElement(container, {
        boundElements: [
          ...(container.boundElements ?? []),
          { id: bound.id, type: "text" },
        ],
      });
      append(bound);
    }
    redrawTextBoundingBox(bound, container, scene);
  };
  const addNode = (spec: NodeSpec) => {
    const source = spec.after ? node(spec.after) : null;
    const width = spec.width ?? 120;
    const height = spec.height ?? 120;
    const direction = spec.direction ?? "right";
    const gap = spec.gap ?? 120;
    const last = scene
      .getNonDeletedElements()
      .flatMap((item) => (isFlowchartNodeElement(item) ? [item] : []))
      .at(-1);
    let x = source?.x ?? (last ? last.x + last.width + gap : 0);
    let y = source?.y ?? last?.y ?? 0;
    if (source) {
      const position = getNextFlowchartNodePosition(
        source,
        direction,
        scene,
        gap / 120,
        gridSize as Parameters<typeof getNextFlowchartNodePosition>[4],
        { width, height },
      );
      x = position.x;
      y = position.y;
    } else if (spec.direction !== undefined) {
      throw new Error("direction requires after");
    }
    const type = spec.shape ?? "rectangle";
    const created = newElement({
      type,
      x: spec.x ?? x,
      y: spec.y ?? y,
      width,
      height,
      strokeColor: "#000000",
      backgroundColor: BPD_DEFAULT_SHAPE_BACKGROUNDS[type],
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 0,
      roundness: null,
      ...spec.style,
    });
    if (!isFlowchartNodeElement(created)) {
      throw new Error("Unsupported shape");
    }
    remember(spec.ref, created.id);
    append(created);
    label(created, spec.text ?? "");
    membership(created, spec.frameId);
    const bound = getBoundTextElement(
      created,
      scene.getNonDeletedElementsMap(),
    );
    if (bound) {
      scene.mutateElement(bound, { frameId: created.frameId });
    }
    changed.add(created.id);
    return created;
  };
  const connect = (from: string, to: string, text?: string, style?: Style) => {
    const start = node(from);
    const end = node(to);
    if (start.id === end.id) {
      throw new Error("Self connections are not supported");
    }
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const direction =
      Math.abs(dx) >= Math.abs(dy)
        ? dx >= 0
          ? "right"
          : "left"
        : dy >= 0
        ? "down"
        : "up";
    const created = createBindingArrow(
      start,
      end,
      direction,
      { ...state, currentItemEndArrowhead: "triangle" },
      scene,
    );
    append(created);
    touchedEdges.add(created.id);
    scene.mutateElement(created, {
      ...style,
      frameId: start.frameId === end.frameId ? start.frameId : null,
    });
    if (text !== undefined) {
      label(created, text);
    }
    return created;
  };
  const remove = (element: ExcalidrawElement) => {
    const doomed = new Set([element.id]);
    if (isFlowchartNodeElement(element)) {
      for (const item of scene.getNonDeletedElements()) {
        if (
          isArrowElement(item) &&
          (item.startBinding?.elementId === element.id ||
            item.endBinding?.elementId === element.id)
        ) {
          doomed.add(item.id);
        }
      }
    }
    for (const id of [...doomed]) {
      const item = get(id);
      const bound = getBoundTextElement(item, scene.getNonDeletedElementsMap());
      if (bound) {
        doomed.add(bound.id);
      }
    }
    const deleted = [...doomed].map(get);
    deleted.forEach((item) => scene.mutateElement(item, { isDeleted: true }));
    fixBindingsAfterDeletion(scene.getElementsIncludingDeleted(), deleted);
    scene.replaceAllElements(scene.getElementsIncludingDeleted());
    return [...doomed];
  };
  try {
    for (const operation of operations) {
      let ids: string[];
      switch (operation.op) {
        case "add_node":
          ids = [addNode(operation).id];
          break;
        case "update_node": {
          let item = node(operation.id!);
          // Reject edits touching a locked bound label or connector before helpers reroute them.
          for (const binding of item.boundElements ?? []) {
            const affected = get(binding.id);
            if (isArrowElement(affected)) {
              touchedEdges.add(affected.id);
              const text = getBoundTextElement(
                affected,
                scene.getNonDeletedElementsMap(),
              );
              if (text) {
                get(text.id);
              }
            }
          }
          const { shape, x, y, width, height, style } = operation;
          if (shape !== undefined && shape !== item.type) {
            const converted = convertElementType(item, shape, { scene, state });
            if (!isFlowchartNodeElement(converted)) {
              throw new Error("Unsupported conversion");
            }
            scene.replaceAllElements(
              scene
                .getElementsIncludingDeleted()
                .map((el) => (el.id === item.id ? converted : el)),
            );
            item = node(item.id);
            const boundText = getBoundTextElement(
              item,
              scene.getNonDeletedElementsMap(),
            );
            if (boundText) {
              adjustBoundTextSize(item, boundText, scene);
            }
          }
          scene.mutateElement(item, {
            ...(shape === undefined
              ? {}
              : {
                  strokeColor: "#000000",
                  backgroundColor: BPD_DEFAULT_SHAPE_BACKGROUNDS[shape],
                  ...(shape === "rectangle" ? { roundness: null } : {}),
                }),
            ...(x === undefined ? {} : { x }),
            ...(y === undefined ? {} : { y }),
            ...(width === undefined ? {} : { width }),
            ...(height === undefined ? {} : { height }),
            ...style,
          });
          const bound = getBoundTextElement(
            item,
            scene.getNonDeletedElementsMap(),
          );
          if (operation.text !== undefined) {
            label(item, operation.text);
          } else if (bound) {
            redrawTextBoundingBox(bound, item, scene);
          }
          // Keep current membership for non-geometric edits. Moving outside an
          // existing container explicitly requires frameId:null or another ID.
          membership(
            item,
            operation.frameId === undefined && item.frameId
              ? item.frameId
              : operation.frameId,
          );
          if (bound) {
            scene.mutateElement(bound, { frameId: item.frameId });
          }
          updateBoundElements(item, scene);
          changed.add(item.id);
          ids = [item.id];
          break;
        }
        case "delete_node":
          ids = remove(node(operation.id!));
          break;
        case "connect_nodes": {
          const item = connect(
            operation.from!,
            operation.to!,
            operation.label,
            operation.style,
          );
          remember(operation.ref, item.id);
          if (operation.loopRoute) {
            loopEdges.add(item.id);
          }
          ids = [item.id];
          break;
        }
        case "route_loop": {
          const item = edge(operation.edgeId!);
          loopEdges.add(item.id);
          ids = [item.id, node(item.startBinding?.elementId ?? "").id];
          break;
        }
        case "update_edge": {
          const item = edge(operation.id!);
          scene.mutateElement(item, operation.style ?? {});
          if (operation.label !== undefined) {
            label(item, operation.label);
          }
          ids = [item.id];
          break;
        }
        case "delete_edge":
          ids = remove(edge(operation.id!));
          break;
        case "insert_between": {
          const old = edge(operation.edgeId!);
          if (!old.startBinding || !old.endBinding) {
            throw new Error("Insertion requires an arrow bound at both ends");
          }
          const start = node(old.startBinding.elementId);
          const end = node(old.endBinding.elementId);
          const oldLabel = getBoundTextElement(
            old,
            scene.getNonDeletedElementsMap(),
          )?.originalText;
          const dx = end.x + end.width / 2 - start.x - start.width / 2;
          const dy = end.y + end.height / 2 - start.y - start.height / 2;
          const direction =
            Math.abs(dx) >= Math.abs(dy)
              ? dx >= 0
                ? "right"
                : "left"
              : dy >= 0
              ? "down"
              : "up";
          const automatic = operation.nodes!.every(
            (spec) =>
              spec.x === undefined && spec.y === undefined && !spec.after,
          );
          const cursor = { x: end.x, y: end.y };
          let shift = 0;
          const chain = operation.nodes!.map((spec) => {
            if (!automatic) {
              if (
                !spec.after &&
                (spec.direction !== undefined || spec.gap !== undefined)
              ) {
                throw new Error(
                  "Explicit insertion direction/gap requires after",
                );
              }
              if (
                !spec.after &&
                (spec.x === undefined || spec.y === undefined)
              ) {
                throw new Error(
                  "Explicit insertion requires x and y for each node, or after",
                );
              }
              return addNode(spec);
            }
            if (spec.direction !== undefined && spec.direction !== direction) {
              throw new Error(
                "Automatic insertion follows the edge axis; use after for another direction",
              );
            }
            const created = addNode({
              ...spec,
              direction: undefined,
              x: cursor.x,
              y: cursor.y,
            });
            const step =
              (direction === "left" || direction === "right"
                ? created.width
                : created.height) + (spec.gap ?? 120);
            shift += step;
            if (direction === "right") {
              cursor.x += step;
            }
            if (direction === "left") {
              cursor.x -= step;
            }
            if (direction === "down") {
              cursor.y += step;
            }
            if (direction === "up") {
              cursor.y -= step;
            }
            return created;
          });
          if (automatic) {
            const moved = moveFlowchartFollowingNodes(
              scene,
              state,
              end,
              {
                x:
                  direction === "right"
                    ? shift
                    : direction === "left"
                    ? -shift
                    : 0,
                y:
                  direction === "down"
                    ? shift
                    : direction === "up"
                    ? -shift
                    : 0,
              },
              direction,
              { x: start.x + start.width / 2, y: start.y + start.height / 2 },
              { x: end.x + end.width / 2, y: end.y + end.height / 2 },
            );
            moved.forEach((id) => changed.add(id));
            for (const arrow of scene.getNonDeletedElements()) {
              if (
                isArrowElement(arrow) &&
                (moved.has(arrow.startBinding?.elementId ?? "") ||
                  moved.has(arrow.endBinding?.elementId ?? ""))
              ) {
                touchedEdges.add(arrow.id);
              }
            }
          }
          remove(old);
          const all = [start, ...chain, end];
          const links = all.slice(1).map((item, i) => {
            const link = connect(
              all[i].id,
              item.id,
              i === 0 ? oldLabel : undefined,
              {
                strokeColor: old.strokeColor,
                strokeWidth: old.strokeWidth,
                strokeStyle: old.strokeStyle,
                opacity: old.opacity,
              },
            );
            scene.mutateElement(link, {
              startArrowhead: i === 0 ? old.startArrowhead : null,
              endArrowhead:
                i === all.length - 2 ? old.endArrowhead : "triangle",
            });
            return link;
          });
          ids = [...chain, ...links].map((item) => item.id);
          break;
        }
        default:
          throw new Error("Unknown operation");
      }
      results.push({ op: operation.op, ids });
    }
    if (gridSize !== null) {
      scene.getNonDeletedElements().forEach((item) => {
        if (isArrowElement(item) && item.customData?.flowLoop) {
          loopEdges.add(item.id);
        }
      });
    }
    const movedLoopSources = routeLoopbacks(
      scene,
      [...loopEdges],
      gridSize ?? 120,
    );
    movedLoopSources.forEach((id) => changed.add(id));
    loopEdges.forEach((id) => touchedEdges.add(id));
    // Recheck after label sizing and all mutations, and keep connector/frame membership consistent.
    for (const id of changed) {
      const item = scene.getNonDeletedElementsMap().get(id);
      if (item && isFlowchartNodeElement(item) && item.frameId) {
        membership(item, item.frameId);
      }
    }
    for (const id of touchedEdges) {
      const item = scene.getNonDeletedElementsMap().get(id);
      if (
        item &&
        isArrowElement(item) &&
        item.startBinding &&
        item.endBinding
      ) {
        const start = scene
          .getNonDeletedElementsMap()
          .get(item.startBinding.elementId);
        const end = scene
          .getNonDeletedElementsMap()
          .get(item.endBinding.elementId);
        const frameId =
          start?.frameId === end?.frameId ? start?.frameId ?? null : null;
        if (frameId !== item.frameId) {
          get(item.id);
          scene.mutateElement(item, { frameId });
          const bound = getBoundTextElement(
            item,
            scene.getNonDeletedElementsMap(),
          );
          if (bound) {
            get(bound.id);
            scene.mutateElement(bound, { frameId });
          }
        }
      }
    }
    // A helper may also touch the opposite endpoint or an edge label. Audit
    // every changed pre-existing locked element, including locked containers.
    const originals = new Map(elements.map((item) => [item.id, item]));
    if (gridSize !== null) {
      const nodes = scene
        .getNonDeletedElements()
        .flatMap((item) => (isFlowchartNodeElement(item) ? [item] : []));
      for (const item of scene.getNonDeletedElements()) {
        if (
          !isArrowElement(item) ||
          JSON.stringify(originals.get(item.id)) === JSON.stringify(item)
        ) {
          continue;
        }
        const points = item.points.map(
          ([x, y]) => [item.x + x, item.y + y] as const,
        );
        if (
          points.some(
            (point, index) =>
              index > 0 &&
              nodes.some(
                (node) =>
                  node.id !== item.startBinding?.elementId &&
                  node.id !== item.endBinding?.elementId &&
                  segmentHitsNode(points[index - 1], point, node),
              ),
          )
        ) {
          throw new Error(
            "Connector overlaps a node; use a clear branch or move the blocking node with existing editor controls",
          );
        }
      }
    }
    const output = scene.getElementsIncludingDeleted().map((item) => {
      const original = originals.get(item.id);
      if (original && JSON.stringify(original) === JSON.stringify(item)) {
        return original;
      }
      if (
        original &&
        (original.locked ||
          (original.frameId && originals.get(original.frameId)?.locked))
      ) {
        throw new Error(`Batch affects locked element: ${original.id}`);
      }
      if (
        !item.isDeleted &&
        (isFlowchartNodeElement(item) || isArrowElement(item)) &&
        (Math.abs(item.x) > 100000 ||
          Math.abs(item.y) > 100000 ||
          item.width > (isArrowElement(item) ? 100000 : 2000) ||
          item.height > (isArrowElement(item) ? 100000 : 2000))
      ) {
        throw new Error("Result exceeds geometry limits");
      }
      return item;
    });
    return {
      elements: output,
      refs,
      results,
      movedLoopSources: [...movedLoopSources],
    };
  } finally {
    scene.destroy();
  }
}
