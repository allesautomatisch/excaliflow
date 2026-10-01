import { getSizeFromPoints, toBrandedType } from "@excalidraw/common";
import {
  getBindingGap,
  updateBoundElements,
} from "@excalidraw/element/binding";
import {
  getBoundTextElement,
  redrawTextBoundingBox,
} from "@excalidraw/element/textElement";
import {
  isArrowElement,
  isElbowArrow,
  isFlowchartNodeElement,
} from "@excalidraw/element/typeChecks";
import { pointFrom } from "@excalidraw/math";

import type { Scene } from "@excalidraw/element/Scene";
import type {
  ExcalidrawFlowchartNodeElement,
  FixedPoint,
} from "@excalidraw/element/types";
import type { LocalPoint } from "@excalidraw/math";

type Point = readonly [number, number];
const clearance = 18;

// Conservative node bounds: keeping away from these also keeps away from the
// shape's painted interior. Crossings between connectors are not node overlap.
export const segmentHitsNode = (
  a: Point,
  b: Point,
  node: ExcalidrawFlowchartNodeElement,
  padding = 0,
) =>
  Math.max(a[0], b[0]) > node.x - padding &&
  Math.min(a[0], b[0]) < node.x + node.width + padding &&
  Math.max(a[1], b[1]) > node.y - padding &&
  Math.min(a[1], b[1]) < node.y + node.height + padding;

// Select a small set of ordinary manual elbow paths, rather than replacing the
// editor's router. Endpoints and fixed interior segments use its normal helpers.
export function routeLoopbacks(
  scene: Scene,
  ids: readonly string[],
  grid: number,
) {
  const movedSources = new Set<string>();
  const map = scene.getNonDeletedElementsMap();
  const nodes = scene
    .getNonDeletedElements()
    .flatMap((item) => (isFlowchartNodeElement(item) ? [item] : []));
  const edges = scene
    .getNonDeletedElements()
    .flatMap((item) => (isArrowElement(item) ? [item] : []));
  const loopSources = new Set(
    edges.flatMap((edge) => {
      const from = edge.startBinding && map.get(edge.startBinding.elementId);
      const to = edge.endBinding && map.get(edge.endBinding.elementId);
      return from && to && from.x > to.x ? [from.id] : [];
    }),
  );
  const span = (id: string) => {
    const edge = map.get(id);
    if (!edge || !isArrowElement(edge)) {
      return Infinity;
    }
    const from = edge.startBinding && map.get(edge.startBinding.elementId);
    const to = edge.endBinding && map.get(edge.endBinding.elementId);
    return from && to ? from.x - to.x : Infinity;
  };
  // Route inner, shorter loops first, so enclosing returns can pass beneath
  // them instead of crossing their descending legs.
  const orderedIds = [...new Set(ids)].sort((a, b) => span(a) - span(b));
  for (const id of orderedIds) {
    const arrow = map.get(id);
    if (
      !arrow ||
      !isElbowArrow(arrow) ||
      !arrow.startBinding ||
      !arrow.endBinding
    ) {
      throw new Error("Loop routing requires a bound elbow connector");
    }
    const source = map.get(arrow.startBinding.elementId);
    const target = map.get(arrow.endBinding.elementId);
    if (
      !source ||
      !target ||
      !isFlowchartNodeElement(source) ||
      !isFlowchartNodeElement(target) ||
      target.x >= source.x
    ) {
      throw new Error("A loop must return to an earlier node to the left");
    }
    const reachable = new Set<string>();
    const pending = [target.id];
    while (pending.length) {
      const nodeId = pending.pop()!;
      if (reachable.has(nodeId)) {
        continue;
      }
      reachable.add(nodeId);
      edges.forEach((edge) => {
        if (
          edge.id !== id &&
          edge.startBinding?.elementId === nodeId &&
          edge.endBinding
        ) {
          pending.push(edge.endBinding.elementId);
        }
      });
    }
    if (!reachable.has(source.id)) {
      throw new Error(
        "Loop target must already reach its source through the flow",
      );
    }
    const hasForwardSuccessor = edges.some(
      (edge) =>
        edge.startBinding?.elementId === source.id &&
        edge.endBinding &&
        (map.get(edge.endBinding.elementId)?.x ?? -Infinity) > source.x,
    );
    if (!hasForwardSuccessor && !source.locked && !source.frameId) {
      const bottom = Math.max(
        target.y + target.height,
        ...nodes
          .filter((node) => reachable.has(node.id) && !loopSources.has(node.id))
          .map((node) => node.y + node.height),
      );
      // Sharing the lowest occupied row is enough: the bottom ports and return
      // lane already put the arrow below the nodes. Lower only when needed.
      const preferred = Math.ceil((bottom - source.height) / grid) * grid;
      for (
        let row = Math.max(source.y, preferred), attempt = 0;
        row > source.y && attempt < 16;
        row += grid, attempt++
      ) {
        const candidate = { ...source, y: row };
        if (
          nodes.some(
            (node) =>
              node.id !== source.id &&
              candidate.x < node.x + node.width &&
              candidate.x + candidate.width > node.x &&
              candidate.y < node.y + node.height &&
              candidate.y + candidate.height > node.y,
          )
        ) {
          continue;
        }
        scene.mutateElement(source, { y: row });
        const text = getBoundTextElement(source, map);
        if (text) {
          redrawTextBoundingBox(text, source, scene);
        }
        updateBoundElements(source, scene);
        movedSources.add(source.id);
        break;
      }
    }
    const start: Point = [
      source.x + source.width / 2,
      source.y + source.height + getBindingGap(source, arrow),
    ];
    const end: Point = [
      target.x + target.width / 2,
      target.y + target.height + getBindingGap(target, arrow),
    ];
    const approachY = target.y + target.height + grid / 2;
    const blocked = (path: readonly Point[]) =>
      path.some(
        (point, index) =>
          index > 0 &&
          nodes.some((node) =>
            segmentHitsNode(
              path[index - 1],
              point,
              node,
              node.id === source.id || node.id === target.id ? 0 : clearance,
            ),
          ),
      ) ||
      edges.some((other) => {
        const otherSource =
          other.startBinding && map.get(other.startBinding.elementId);
        const otherTarget =
          other.endBinding && map.get(other.endBinding.elementId);
        if (
          other.id === id ||
          !otherSource ||
          !otherTarget ||
          otherSource.x <= otherTarget.x
        ) {
          return false;
        }
        // Keep long return lanes distinct. Perpendicular crossings and a shared
        // endpoint can still occur; neither requires drawing over another lane.
        const a = path[1];
        const b = path[2];
        return other.points.some((point, index) => {
          if (!index) {
            return false;
          }
          const previous = other.points[index - 1];
          return (
            previous[1] === point[1] &&
            Math.abs(other.y + point[1] - a[1]) < clearance &&
            Math.max(a[0], b[0]) > other.x + Math.min(previous[0], point[0]) &&
            Math.min(a[0], b[0]) < other.x + Math.max(previous[0], point[0])
          );
        });
      });
    let path: Point[] | undefined;
    const firstLane =
      Math.ceil((Math.max(start[1], end[1]) + grid / 2) / grid) * grid;
    for (let attempt = 0; attempt < 16 && !path; attempt++) {
      const lane = firstLane + attempt * grid;
      const direct: Point[] = [start, [start[0], lane], [end[0], lane], end];
      if (!blocked(direct)) {
        path = direct;
        break;
      }
      for (let offset = 1; offset <= 8 && !path; offset++) {
        for (const column of [
          target.x + target.width + (offset * grid) / 2,
          target.x - (offset * grid) / 2,
        ]) {
          const detour: Point[] = [
            start,
            [start[0], lane],
            [column, lane],
            [column, approachY],
            [end[0], approachY],
            end,
          ];
          if (!blocked(detour)) {
            path = detour;
            break;
          }
        }
      }
    }
    if (!path) {
      throw new Error(
        "No clear bottom loop corridor; move the blocking nodes with existing editor controls",
      );
    }
    const points = path.map(([x, y]) =>
      pointFrom<LocalPoint>(x - start[0], y - start[1]),
    );
    const fixedSegments = points.slice(2, -1).map((point, index) => ({
      index: index + 2,
      start: points[index + 1],
      end: point,
    }));
    const startBinding = {
      ...arrow.startBinding,
      fixedPoint: toBrandedType<FixedPoint>([0.5, 1]),
    };
    const endBinding = {
      ...arrow.endBinding,
      fixedPoint: toBrandedType<FixedPoint>([0.5, 1]),
    };
    const patch = {
      x: start[0],
      y: start[1],
      points,
      ...getSizeFromPoints(points),
      fixedSegments,
      startBinding,
      endBinding,
      startIsSpecial: null,
      endIsSpecial: null,
      customData: { ...arrow.customData, flowLoop: true },
    };
    if (
      Object.entries(patch).some(
        ([key, value]) =>
          JSON.stringify(arrow[key as keyof typeof arrow]) !==
          JSON.stringify(value),
      )
    ) {
      scene.mutateElement(arrow, patch);
      const text = getBoundTextElement(arrow, map);
      if (text) {
        redrawTextBoundingBox(text, arrow, scene);
      }
    }
  }
  return movedSources;
}
