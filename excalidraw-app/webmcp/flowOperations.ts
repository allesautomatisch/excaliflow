import {
  isArrowElement,
  isFlowchartNodeElement,
} from "@excalidraw/element/typeChecks";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { applyOperations } from "./operations";
import { flowRules } from "./schema";

import type { Operation } from "./operations";

type Step = {
  object?: string;
  action?: string;
  kind?: "action" | "decision" | "input" | "start" | "end";
  ref?: string;
};
type FlowOperation = Operation & Step & { steps?: Step[] };
const shapes = {
  action: "rectangle",
  decision: "diamond",
  input: "parallelogram",
  start: "capsule",
  end: "capsule",
} as const;
const word = /^[\p{L}][\p{L}\p{N}-]*$/u;
const stepText = (step: Step) => {
  if (
    step.object === undefined &&
    step.action === undefined &&
    (step.kind === "start" || step.kind === "end")
  ) {
    return step.kind === "start" ? "Start" : "Ende";
  }
  if (
    !step.object ||
    !step.action ||
    !word.test(step.object) ||
    !word.test(step.action)
  ) {
    throw new Error(
      "Use one noun in object and one infinitive verb in action, without whitespace or line breaks; e.g. object=Video, action=veröffentlichen",
    );
  }
  const text = `${step.object} ${step.action}`;
  if (text.length > 32) {
    throw new Error(
      "Node label exceeds 32 characters; choose a shorter noun and verb",
    );
  }
  return text;
};

// This adapter only composes existing editor operations. It validates the cloned
// result before the controller commits it, so policy failures are atomic too.
export function applyFlowOperations(
  elements: readonly ExcalidrawElement[],
  state: AppState,
  inputs: Operation[],
) {
  const operations: Operation[] = [];
  const groups: { op: string; start: number; end: number }[] = [];
  const anchors = new Set<string>();
  const created = new Set<string>();
  const forward: { from: string; to: string; branch: boolean }[] = [];
  const loops: { from: string; to: string; ref: string }[] = [];
  const insertions: string[] = [];
  const frames = new Map(elements.map((el) => [el.id, el.frameId]));
  let count = 0;
  const usedRefs = new Set(
    inputs.flatMap((input) => {
      const op = input as FlowOperation;
      return [
        ...(op.ref ? [op.ref] : []),
        ...(op.steps?.flatMap((step) => (step.ref ? [step.ref] : [])) ?? []),
      ];
    }),
  );
  const elementIds = new Set(elements.map((el) => el.id));
  const internalRef = (base: string) => {
    let name = base;
    while (usedRefs.has(name) || elementIds.has(name)) {
      name += "_";
    }
    usedRefs.add(name);
    return name;
  };
  for (const [i, input] of inputs.entries()) {
    const op = input as FlowOperation;
    const start = operations.length;
    count += op.steps?.length ?? 0;
    if (count > 100) {
      throw new Error("A flow batch supports at most 100 new steps");
    }
    if (op.op === "append_steps" || op.op === "branch_steps") {
      let previous = op.op === "branch_steps" ? op.from : op.after;
      if (
        !previous &&
        (elements.some((el) => !el.isDeleted && isFlowchartNodeElement(el)) ||
          created.size)
      ) {
        throw new Error(
          "after is required in a nonempty drawing; choose an existing node from flow_get_context",
        );
      }
      if (previous) {
        anchors.add(previous);
      }
      for (const [j, step] of op.steps!.entries()) {
        const ref = step.ref ?? internalRef(`step_${i + 1}_${j + 1}`);
        const branch = op.op === "branch_steps" && j === 0;
        const frameId = previous ? frames.get(previous) : null;
        operations.push({
          op: "add_node",
          ref,
          text: stepText(step),
          shape: shapes[step.kind ?? "action"],
          ...(previous
            ? { after: previous, direction: branch ? "down" : "right" }
            : {}),
          frameId,
        });
        frames.set(ref, frameId ?? null);
        created.add(ref);
        if (previous) {
          operations.push({
            op: "connect_nodes",
            from: previous,
            to: ref,
            ...(branch ? { label: op.label ?? "sonst" } : {}),
          });
          forward.push({ from: previous, to: ref, branch });
        }
        previous = ref;
      }
    } else if (op.op === "insert_steps") {
      insertions.push(op.edgeId!);
      operations.push({
        op: "insert_between",
        edgeId: op.edgeId,
        nodes: op.steps!.map((step, j) => {
          const ref = step.ref ?? internalRef(`step_${i + 1}_${j + 1}`);
          created.add(ref);
          return {
            ref,
            text: stepText(step),
            shape: shapes[step.kind ?? "action"],
          };
        }),
      });
    } else if (op.op === "rename_node") {
      anchors.add(op.id!);
      operations.push({
        op: "update_node",
        id: op.id,
        text: stepText(op),
        ...(op.kind ? { shape: shapes[op.kind] } : {}),
      });
    } else if (op.op === "connect_loop") {
      const ref = op.ref ?? internalRef(`loop_${i + 1}`);
      anchors.add(op.from!);
      anchors.add(op.to!);
      loops.push({ from: op.from!, to: op.to!, ref });
      operations.push({
        op: "connect_nodes",
        from: op.from,
        to: op.to,
        label: op.label,
        ref,
        loopRoute: true,
      });
    } else if (op.op === "route_loop") {
      const edge = elements.find(
        (item) => item.id === op.edgeId && !item.isDeleted,
      );
      if (
        !edge ||
        !isArrowElement(edge) ||
        !edge.startBinding ||
        !edge.endBinding
      ) {
        throw new Error("route_loop requires an existing bound connector");
      }
      anchors.add(edge.startBinding.elementId);
      anchors.add(edge.endBinding.elementId);
      loops.push({
        from: edge.startBinding.elementId,
        to: edge.endBinding.elementId,
        ref: edge.id,
      });
      operations.push({ op: "route_loop", edgeId: edge.id });
    } else if (op.op === "delete_node" || op.op === "delete_edge") {
      operations.push({ op: op.op, id: op.id });
    } else {
      throw new Error(`Unsupported flow operation: ${op.op}`);
    }
    if (
      op.label !== undefined &&
      (/\s*[\r\n]/.test(op.label) || op.label.split(/\s+/u).length > 3)
    ) {
      throw new Error(
        "Connector labels must be short, single-line labels of at most 3 words",
      );
    }
    groups.push({ op: op.op, start, end: operations.length });
  }
  const batch = applyOperations(
    elements,
    state,
    operations,
    flowRules.gridSize,
  );
  const resolve = (id: string) => batch.refs[id] ?? id;
  const map = new Map(batch.elements.map((el) => [el.id, el]));
  const originals = new Map(elements.map((el) => [el.id, el]));
  const standard = (id: string, original = false) => {
    const item = (original ? originals : map).get(resolve(id));
    if (
      !item ||
      item.isDeleted ||
      !isFlowchartNodeElement(item) ||
      item.width !== flowRules.nodeSize ||
      item.height !== flowRules.nodeSize ||
      item.x % flowRules.gridSize !== 0 ||
      item.y % flowRules.gridSize !== 0
    ) {
      throw new Error(
        `Node ${id} must be 120x120 on the 120px grid; choose a standard grid node or adjust it with existing editor controls`,
      );
    }
    return item;
  };
  for (const ref of anchors) {
    standard(ref);
    if (originals.has(resolve(ref))) {
      standard(ref, true);
    }
  }
  for (const ref of created) {
    standard(ref);
  }
  for (const link of forward) {
    const from = standard(link.from);
    const to = standard(link.to);
    if (
      link.branch
        ? to.y !== from.y + flowRules.pitch &&
          !(
            batch.movedLoopSources.includes(to.id) &&
            to.y > from.y + flowRules.pitch
          )
        : to.x !== from.x + flowRules.pitch ||
          (to.y !== from.y &&
            !(batch.movedLoopSources.includes(to.id) && to.y > from.y))
    ) {
      throw new Error(
        "Chronological steps must use the next grid cell to the right; use branch_steps for a new row or insert_steps for an occupied connector",
      );
    }
  }
  for (const edgeId of insertions) {
    const old = map.get(resolve(edgeId));
    if (!old || !isArrowElement(old) || !old.startBinding || !old.endBinding) {
      throw new Error("Insertion requires a bound connector");
    }
    const from = standard(old.startBinding.elementId);
    const to = standard(old.endBinding.elementId);
    if (to.x <= from.x || to.y !== from.y) {
      throw new Error(
        "insert_steps requires a forward horizontal connector; return connections use connect_loop",
      );
    }
  }
  const loopIds = new Set(loops.map((loop) => resolve(loop.ref)));
  for (const loop of loops) {
    const from = standard(loop.from);
    const to = standard(loop.to);
    if (to.x >= from.x) {
      throw new Error("A loop must return to an earlier step to the left");
    }
    const visited = new Set<string>();
    const pending = [to.id];
    while (pending.length) {
      const id = pending.pop()!;
      if (visited.has(id)) {
        continue;
      }
      visited.add(id);
      for (const edge of batch.elements) {
        if (
          !edge.isDeleted &&
          isArrowElement(edge) &&
          !loopIds.has(edge.id) &&
          edge.startBinding?.elementId === id &&
          edge.endBinding
        ) {
          pending.push(edge.endBinding.elementId);
        }
      }
    }
    if (!visited.has(from.id)) {
      throw new Error(
        "Loop target must already reach its source through the flow",
      );
    }
  }
  const nodes = batch.elements.filter(
    (el) => !el.isDeleted && isFlowchartNodeElement(el),
  );
  for (const node of nodes) {
    const original = originals.get(node.id);
    if (
      !original ||
      node.x !== original.x ||
      node.y !== original.y ||
      node.width !== original.width ||
      node.height !== original.height
    ) {
      standard(node.id);
      if (
        nodes.some(
          (other) =>
            other.id !== node.id &&
            node.x < other.x + other.width &&
            node.x + node.width > other.x &&
            node.y < other.y + other.height &&
            node.y + node.height > other.y,
        )
      ) {
        throw new Error(
          "A required grid cell is occupied; insert into the existing connector or choose another branch anchor",
        );
      }
    }
  }
  return {
    ...batch,
    results: groups.map((group) => ({
      op: group.op,
      ids: [
        ...new Set(
          batch.results
            .slice(group.start, group.end)
            .flatMap((result) => result.ids),
        ),
      ],
    })),
  };
}
