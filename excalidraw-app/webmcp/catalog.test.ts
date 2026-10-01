import { flowToolCatalog } from "./register";
import {
  applyDiscoverySchema,
  applySchema,
  contractVersion,
  getFlowHelp,
  operationDefinitions,
  operationNames,
  quickStartOperations,
  validate,
} from "./schema";

it("keeps initial discovery within compact and formatted payload budgets", () => {
  // Both automatic notifications and formatted Browser descriptions matter.
  const editing = flowToolCatalog.filter((tool) => tool.name !== "export_as");
  expect(JSON.stringify(editing).length).toBeLessThan(6000);
  expect(JSON.stringify(editing, null, 2).length).toBeLessThan(12500);
  expect(JSON.stringify(flowToolCatalog).length).toBeLessThan(7800);
  expect(JSON.stringify(flowToolCatalog, null, 2).length).toBeLessThan(16500);
  expect(flowToolCatalog.map((tool) => tool.name)).toEqual([
    "flow_get_context",
    "flow_apply_operations",
    "flow_help",
    "export_as",
  ]);
  expect(flowToolCatalog[1].inputSchema).toBe(applyDiscoverySchema);
  expect(flowToolCatalog[1].description).toContain(
    JSON.stringify(quickStartOperations),
  );
});

it("derives discovery, exact help and valid examples from the execution contracts", () => {
  for (const operation of operationNames) {
    const definition = operationDefinitions[operation];
    expect(getFlowHelp({ operation, detail: "schema" })).toMatchObject({
      ok: true,
      contractVersion,
      schema: definition.schema,
    });
    expect(getFlowHelp({ operation, detail: "example" })).toMatchObject({
      example: definition.example,
    });
    const input = {
      drawingSession: "session",
      operations: [definition.example],
    };
    expect(() => validate(applySchema, input)).not.toThrow();
    expect(() => validate(applyDiscoverySchema, input)).not.toThrow();
  }
  expect(() =>
    validate(applySchema, {
      drawingSession: "session",
      operations: quickStartOperations,
    }),
  ).not.toThrow();
});

it("retains strict operation-specific validation despite shared discovery fields", () => {
  for (const operation of [
    { op: "connect_loop", from: "a" },
    { op: "delete_node", id: "a", object: "unexpected" },
    {
      op: "insert_steps",
      edgeId: "a",
      steps: [{ object: "Video", action: "bewerben" }],
      id: "unexpected",
    },
  ]) {
    const input = { drawingSession: "session", operations: [operation] };
    expect(() => validate(applyDiscoverySchema, input)).not.toThrow();
    expect(() => validate(applySchema, input)).toThrow();
  }
  expect(() =>
    validate(applyDiscoverySchema, {
      drawingSession: "s",
      operations: [{ op: "new_app_feature" }],
    }),
  ).toThrow();
});

it("returns a small static index and loads only requested details", () => {
  const overview = getFlowHelp({});
  expect(overview).toMatchObject({ ok: true, contractVersion });
  expect(JSON.stringify(overview).length).toBeLessThan(2600);
  expect(JSON.stringify(overview)).not.toContain('"properties"');
  expect(getFlowHelp({ operation: "insert_steps" })).toMatchObject({
    notes: expect.stringContaining("existing insertion helper"),
  });
  expect(getFlowHelp({ detail: "schema" })).toMatchObject({
    error: { code: "INVALID_INPUT" },
  });
  expect(getFlowHelp({ operation: "constructor" })).toMatchObject({
    error: { code: "INVALID_INPUT" },
  });
  expect(getFlowHelp({ extra: true })).toMatchObject({
    error: { code: "INVALID_INPUT" },
  });
});

it("identifies the field and length limit in an operation validation error", () => {
  expect(() =>
    validate(applySchema, {
      drawingSession: "session",
      operations: [
        {
          op: "connect_loop",
          from: "a",
          to: "b",
          label: "Neue Videos veröffentlichen",
        },
      ],
    }),
  ).toThrow("input.operations[0].label: maximum 24 characters");
});
