import { id, object, contextSchema, validate } from "./engineSchema";

import type { Schema } from "./engineSchema";
export { contextSchema, validate };
export type { Schema };
export const contractVersion = "7";
export const flowRules = {
  labels:
    "Usually noun + infinitive verb, two short words. Prefer simple words over compound nouns. object/action each contain one word; combined max 32 characters. No prose or authored line breaks. Terminal defaults: Start/Ende.",
  authoring:
    "Use clear actions from a consistent perspective. Finish the success path at the requested outcome; branch off retries and feedback. Decisions name checks, with labeled alternatives.",
  edgeLabels:
    "Connector labels: max 24 characters and three words, e.g. ja/nein/später.",
  nodeSize: 120,
  gridSize: 120,
  gap: 120,
  pitch: 240,
  mainDirection: "right",
  branches:
    "At a decision, append the success path right; branch alternatives down. One branch row per anchor; two branch_steps at the same anchor collide. Subsequent steps go right.",
  loops:
    "Return to an earlier reachable step, bottom-to-bottom. A returning leaf can share the lowest occupied flow row; lower it only if above that row. Keep return lanes below nodes and distinct.",
  overlaps:
    "New or changed connectors must not cross node interiors. Keep other nodes in place; reject the batch if no clear route is available.",
} as const;
const word: Schema = { type: "string", minLength: 1, maxLength: 24 };
const kinds = ["action", "decision", "input", "start", "end"] as const;
const stepFields = {
  object: word,
  action: word,
  kind: { enum: kinds },
  ref: id,
};
const stepSchema: Schema = {
  anyOf: [
    object(stepFields, ["object", "action"]),
    object({ kind: { enum: ["start", "end"] }, ref: id }, ["kind"]),
  ],
};
const steps: Schema = {
  type: "array",
  minItems: 1,
  maxItems: 20,
  items: stepSchema,
};
const edgeLabel: Schema = { type: "string", maxLength: 24 };
const operation = (
  op: string,
  fields: Record<string, Schema>,
  required: string[],
) => object({ op: { enum: [op] }, ...fields }, ["op", ...required]);
type OperationDefinition = {
  schema: Schema;
  summary: string;
  notes?: string;
  example: Record<string, unknown>;
};
export const operationDefinitions = {
  append_steps: {
    schema: operation("append_steps", { after: id, steps }, ["steps"]),
    summary:
      "Create and connect chronological steps to the right; after is required in a nonempty drawing.",
    notes:
      "Uses existing placement/binding helpers, fixed 120x120 nodes and 120px grid/gaps. Supply object and action as one word each, e.g. Video veröffentlichen. kind defaults to action; decision=diamond, input=parallelogram, start/end=capsule. Start/end may omit words. ref names a step within this batch. Occupied cells reject the batch; use insert_steps for an existing connector. No x/y/size/direction/style fields.",
    example: {
      op: "append_steps",
      steps: [
        { object: "Video", action: "veröffentlichen", ref: "video" },
        { object: "Kontakt", action: "erfassen", ref: "kontakt" },
        { object: "Webinar", action: "durchführen", ref: "webinar" },
      ],
    },
  },
  branch_steps: {
    schema: operation("branch_steps", { from: id, steps, label: edgeLabel }, [
      "from",
      "steps",
    ]),
    summary:
      "Start a branch in the existing downwards placement; continue it chronologically to the right.",
    notes:
      "Branch connector label defaults to sonst. Append the success path right; branch an alternative down. Two branch_steps from the same anchor need the same first cell and are rejected. Same labels, fixed geometry and safety checks as append_steps. No freely chosen branch coordinates.",
    example: {
      op: "branch_steps",
      from: "DECISION_ID",
      label: "nein",
      steps: [{ object: "Kontakt", action: "begleiten" }],
    },
  },
  insert_steps: {
    schema: operation("insert_steps", { edgeId: id, steps }, [
      "edgeId",
      "steps",
    ]),
    summary:
      "Insert steps into a forward horizontal connector using the existing graph-shift helper.",
    notes:
      "The existing insertion helper moves the target and downstream nodes by 240px per new step. Preserves the old label and outer arrowheads. Endpoints must be standard grid nodes; use connect_loop for returns, not insertion into a loop.",
    example: {
      op: "insert_steps",
      edgeId: "EDGE_ID",
      steps: [{ object: "Daten", action: "prüfen", ref: "check" }],
    },
  },
  rename_node: {
    schema: operation(
      "rename_node",
      { id, object: word, action: word, kind: stepFields.kind },
      ["id", "object", "action"],
    ),
    summary:
      "Replace a node label with object + action; optional kind converts its existing shape.",
    example: {
      op: "rename_node",
      id: "NODE_ID",
      object: "Bedarf",
      action: "klären",
    },
  },
  connect_loop: {
    schema: operation(
      "connect_loop",
      { from: id, to: id, label: edgeLabel, ref: id },
      ["from", "to"],
    ),
    summary:
      "Connect back to an earlier step that already reaches from through the flow.",
    notes:
      "Target must be left of the source and reach the source through existing/new bound connectors. Prefer a target with a free bottom port, before a branching decision, to avoid sharing its downward exit. Uses existing bottom bindings and fixed elbow segments. A returning leaf above the lowest occupied flow row may move down to a free cell on that row; no extra row is needed if already lowest. Forward continuation, locked nodes and containers prevent automatic lowering. Tries distinct clear lower return lanes and side detours; rejects node crossings. No arbitrary geometry input.",
    example: {
      op: "connect_loop",
      from: "LAST_NODE_ID",
      to: "EARLIER_NODE_ID",
      label: "wiederholen",
    },
  },
  route_loop: {
    schema: operation("route_loop", { edgeId: id }, ["edgeId"]),
    summary:
      "Apply bottom-to-bottom loop routing to an existing connector, keeping its ID and label.",
    notes:
      "Same return, lower-row and node-clearance rules as connect_loop. Use for an existing backward connector; unrelated nodes stay in place.",
    example: { op: "route_loop", edgeId: "LOOP_EDGE_ID" },
  },
  delete_node: {
    schema: operation("delete_node", { id }, ["id"]),
    summary: "Delete an existing node and its bound labels/connectors.",
    example: { op: "delete_node", id: "NODE_ID" },
  },
  delete_edge: {
    schema: operation("delete_edge", { id }, ["id"]),
    summary: "Delete an existing connector and its label.",
    example: { op: "delete_edge", id: "EDGE_ID" },
  },
} as const;
export type OperationName = keyof typeof operationDefinitions;
const definitions: OperationDefinition[] = Object.values(operationDefinitions);
export const operationNames = Object.keys(
  operationDefinitions,
) as OperationName[];
const applyEnvelope = (items: Schema) =>
  object(
    {
      drawingSession: id,
      expectedRevision: { type: "integer", minimum: 0 },
      requestId: id,
      operations: { type: "array", minItems: 1, maxItems: 100, items },
    },
    ["drawingSession", "operations"],
  );
export const applySchema = applyEnvelope({
  anyOf: definitions.map((entry) => entry.schema),
});
export const applyDiscoverySchema = applyEnvelope(
  object(
    {
      ...Object.assign(
        {},
        ...definitions.map((entry) => entry.schema.properties),
      ),
      op: { enum: operationNames },
    },
    ["op"],
  ),
);
export const operationOverview = definitions
  .map(
    (entry) =>
      `${entry.schema.properties!.op.enum![0]}(${entry.schema
        .required!.filter((key) => key !== "op")
        .join(",")})`,
  )
  .join("; ");
export const helpSchema = object({
  operation: { enum: operationNames },
  detail: { enum: ["summary", "schema", "example"] },
});
export const quickStartOperations = [operationDefinitions.append_steps.example];
export function getFlowHelp(input: unknown = {}) {
  try {
    validate(helpSchema, input);
  } catch (err) {
    return {
      ok: false,
      contractVersion,
      error: { code: "INVALID_INPUT", message: (err as Error).message },
    };
  }
  const { operation: name, detail = "summary" } = input as {
    operation?: OperationName;
    detail?: string;
  };
  if (!name) {
    if (detail !== "summary") {
      return {
        ok: false,
        contractVersion,
        error: {
          code: "INVALID_INPUT",
          message: "operation is required for schema/example detail",
        },
      };
    }
    return {
      ok: true,
      contractVersion,
      flowRules,
      operations: definitions.map((entry) => ({
        operation: entry.schema.properties!.op.enum![0],
        required: entry.schema.required!.filter((key) => key !== "op"),
        summary: entry.summary,
      })),
    };
  }
  const entry: OperationDefinition = operationDefinitions[name];
  return {
    ok: true,
    contractVersion,
    flowRules,
    operation: name,
    summary: entry.summary,
    required: entry.schema.required!.filter((key) => key !== "op"),
    notes: entry.notes,
    ...(detail === "schema"
      ? { schema: entry.schema }
      : detail === "example"
      ? { example: entry.example }
      : {}),
  };
}
