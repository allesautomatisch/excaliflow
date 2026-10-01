// Strict execution schemas and compact discovery are derived from one contract.
export type Schema = {
  description?: string;
  type?: string;
  enum?: readonly unknown[];
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: false;
  items?: Schema;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  anyOf?: Schema[];
};

export const object = (
  properties: Record<string, Schema>,
  required: string[] = [],
): Schema => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
export const id: Schema = { type: "string", minLength: 1, maxLength: 128 };
const text: Schema = { type: "string", maxLength: 2000 };
const coordinate: Schema = {
  type: "number",
  minimum: -100000,
  maximum: 100000,
};
const dimension: Schema = { type: "number", minimum: 40, maximum: 2000 };
export const shapes = [
  "rectangle",
  "diamond",
  "parallelogram",
  "ellipse",
  "capsule",
] as const;
const style = object({
  strokeColor: { type: "string", minLength: 1, maxLength: 32 },
  backgroundColor: { type: "string", minLength: 1, maxLength: 32 },
  strokeWidth: { type: "number", minimum: 1, maximum: 8 },
  strokeStyle: { enum: ["solid", "dashed", "dotted"] },
  opacity: { type: "number", minimum: 0, maximum: 100 },
});
const nodePatch = {
  text,
  shape: { enum: shapes },
  x: coordinate,
  y: coordinate,
  width: dimension,
  height: dimension,
  style,
  frameId: { anyOf: [id, { type: "null" }] },
};
const nodeFields = {
  ...nodePatch,
  ref: id,
  after: id,
  direction: { enum: ["up", "right", "down", "left"] },
  gap: { type: "number", minimum: 0, maximum: 2000 },
};
const operation = (
  op: string,
  fields: Record<string, Schema>,
  required: string[],
) => object({ op: { enum: [op] }, ...fields }, ["op", ...required]);
export const contextSchema = object({
  ids: { type: "array", items: id, maxItems: 200 },
  selectedOnly: { type: "boolean" },
  detail: { enum: ["compact", "geometry"] },
  offset: { type: "integer", minimum: 0, maximum: 100000 },
  limit: { type: "integer", minimum: 1, maximum: 200 },
});
export const applySchema = object(
  {
    drawingSession: id,
    expectedRevision: { type: "integer", minimum: 0 },
    requestId: id,
    operations: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      items: {
        anyOf: [
          operation("add_node", nodeFields, ["text"]),
          operation("update_node", { id, ...nodePatch }, ["id"]),
          operation("delete_node", { id }, ["id"]),
          operation(
            "connect_nodes",
            { from: id, to: id, ref: id, label: text, style },
            ["from", "to"],
          ),
          operation("update_edge", { id, label: text, style }, ["id"]),
          operation("delete_edge", { id }, ["id"]),
          operation(
            "insert_between",
            {
              edgeId: id,
              nodes: {
                type: "array",
                minItems: 1,
                maxItems: 20,
                items: object(nodeFields, ["text"]),
              },
            },
            ["edgeId", "nodes"],
          ),
        ],
      },
    },
  },
  ["drawingSession", "operations"],
);

export function validate(schema: Schema, value: unknown, path = "input"): void {
  if (schema.anyOf) {
    if (value && typeof value === "object" && "op" in value) {
      const matches = schema.anyOf.filter((option) =>
        option.properties?.op?.enum?.includes(value.op),
      );
      if (matches.length === 1) {
        validate(matches[0], value, path);
        return;
      }
    }
    if (
      !schema.anyOf.some((option) => {
        try {
          validate(option, value, path);
          return true;
        } catch {
          return false;
        }
      })
    ) {
      throw new Error(`${path}: no allowed variant matches`);
    }
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    throw new Error(`${path}: invalid value`);
  }
  if (schema.type === "null" && value !== null) {
    throw new Error(`${path}: expected null`);
  }
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${path}: expected object`);
    }
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in record)) {
        throw new Error(`${path}.${key}: required`);
      }
    }
    for (const key of Object.keys(record)) {
      const child = Object.prototype.hasOwnProperty.call(schema.properties, key)
        ? schema.properties?.[key]
        : undefined;
      if (!child) {
        throw new Error(`${path}.${key}: unknown field`);
      }
      validate(child, record[key], `${path}.${key}`);
    }
  } else if (schema.type === "array") {
    if (
      !Array.isArray(value) ||
      value.length < (schema.minItems ?? 0) ||
      value.length > (schema.maxItems ?? Infinity)
    ) {
      throw new Error(`${path}: invalid array`);
    }
    value.forEach((item, i) => validate(schema.items!, item, `${path}[${i}]`));
  } else if (schema.type === "string") {
    if (
      typeof value === "string" &&
      value.length > (schema.maxLength ?? Infinity)
    ) {
      throw new Error(`${path}: maximum ${schema.maxLength} characters`);
    }
    if (
      typeof value !== "string" ||
      value.length < (schema.minLength ?? 0) ||
      value.length > (schema.maxLength ?? Infinity)
    ) {
      throw new Error(`${path}: invalid string`);
    }
  } else if (schema.type === "number" || schema.type === "integer") {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      (schema.type === "integer" && !Number.isInteger(value)) ||
      value < (schema.minimum ?? -Infinity) ||
      value > (schema.maximum ?? Infinity)
    ) {
      throw new Error(`${path}: invalid number`);
    }
  } else if (schema.type === "boolean" && typeof value !== "boolean") {
    throw new Error(`${path}: expected boolean`);
  }
}
