import { readFileSync } from "node:fs";

import { expect } from "vitest";

import { FONT_FAMILY, TEXT_ALIGN, VERTICAL_ALIGN } from "@excalidraw/common";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import { exportProcessDiagramToMarkdown } from "../flowchartMarkdown";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawElementType,
  ExcalidrawTextElement,
  FixedPointBinding,
} from "../types";

const baseElement = (
  id: string,
  type: ExcalidrawElementType,
  overrides: Partial<ExcalidrawElement> = {},
) =>
  ({
    id,
    type,
    x: 0,
    y: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roundness: null,
    roughness: 0,
    opacity: 100,
    width: 120,
    height: 120,
    angle: 0,
    seed: 1,
    version: 1,
    versionNonce: 1,
    index: null,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    ...overrides,
  } as ExcalidrawElement);

const textElement = (id: string, containerId: string, text: string) =>
  baseElement(id, "text", {
    containerId,
    text,
    originalText: text,
    fontSize: 16,
    fontFamily: FONT_FAMILY.Excalifont,
    textAlign: TEXT_ALIGN.CENTER,
    verticalAlign: VERTICAL_ALIGN.MIDDLE,
    autoResize: true,
    lineHeight: 1.25 as ExcalidrawTextElement["lineHeight"],
  } as Partial<ExcalidrawTextElement>);

const node = (
  id: string,
  text: string,
  x: number,
  y: number,
  type: ExcalidrawElementType = "rectangle",
) => {
  const textId = `${id}-text`;

  return [
    baseElement(id, type, {
      x,
      y,
      boundElements: [{ id: textId, type: "text" }],
    }),
    textElement(textId, id, text),
  ];
};

const binding = (elementId: string): FixedPointBinding => ({
  elementId,
  fixedPoint: [0.5, 0.5],
  mode: "orbit",
});

const arrow = (
  id: string,
  from: string,
  to: string,
  label?: string,
  x = 0,
  y = 0,
) => {
  const textId = `${id}-text`;
  const arrowElement = baseElement(id, "arrow", {
    x,
    y,
    width: 100,
    height: 0,
    points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
    startBinding: binding(from),
    endBinding: binding(to),
    startArrowhead: null,
    endArrowhead: "triangle",
    elbowed: true,
    fixedSegments: null,
    startIsSpecial: null,
    endIsSpecial: null,
    boundElements: label ? [{ id: textId, type: "text" }] : null,
  } as Partial<ExcalidrawArrowElement>);

  return label
    ? [arrowElement, textElement(textId, id, label)]
    : [arrowElement];
};

describe("exportProcessDiagramToMarkdown", () => {
  it("exports a process diagram as a simple markdown list with labeled branches", () => {
    const elements = [
      ...node("n1", "Anfrage empfangen", 0, 0),
      ...node("n2", "Anfrage prüfen", 160, 0),
      ...node("n3", "Informationen vollständig?", 320, 0, "diamond"),
      ...node("n4", "Rückfragen stellen", 320, 160),
      ...node("n5", "Angebot erstellen", 480, 160),
      ...node("n6", "Angebot versenden", 640, 160),
      ...arrow("a1", "n1", "n2"),
      ...arrow("a2", "n2", "n3"),
      ...arrow("a3", "n3", "n5", "Ja"),
      ...arrow("a4", "n3", "n4", "Nein"),
      ...arrow("a5", "n4", "n2"),
      ...arrow("a6", "n5", "n6"),
    ];

    expect(
      exportProcessDiagramToMarkdown({
        elements,
        processName: "Angebot",
      }),
    ).toBe(`# Prozess: Angebot

- Anfrage empfangen
- Anfrage prüfen
- Informationen vollständig?
  - Ja:
    - Angebot erstellen
    - Angebot versenden
  - Nein:
    - Rückfragen stellen
    - zurück zu "Anfrage prüfen"`);
  });

  it("removes existing short ids from node text when present", () => {
    const elements = [
      ...node("start", "S: Start", 0, 0),
      ...node("end", "Ende", 160, 0),
      ...arrow("start-to-end", "start", "end"),
    ];

    expect(
      exportProcessDiagramToMarkdown({
        elements,
        processName: "Explizite IDs",
      }),
    ).toBe(`# Prozess: Explizite IDs

- Start
- Ende`);
  });

  it("marks unlabeled multi-output connections without inventing conditions", () => {
    const elements = [
      ...node("start", "Start", 0, 0),
      ...node("left", "Links", 0, 160),
      ...node("right", "Rechts", 160, 160),
      ...arrow("start-to-left", "start", "left"),
      ...arrow("start-to-right", "start", "right"),
    ];

    expect(
      exportProcessDiagramToMarkdown({
        elements,
        processName: null,
      }),
    ).toBe(`# Prozess: Unbenannt

- Start
  - Verbindung ohne Beschriftung:
    - Links
  - Verbindung ohne Beschriftung:
    - Rechts`);
  });

  it("does not invent a fallback for either unlabeled decision connection", () => {
    const elements = [
      ...node("decision", "Prüfen?", 0, 0, "diamond"),
      ...node("left", "Links", 0, 160),
      ...node("right", "Rechts", 160, 160),
      ...arrow("decision-to-left", "decision", "left"),
      ...arrow("decision-to-right", "decision", "right"),
    ];

    expect(
      exportProcessDiagramToMarkdown({
        elements,
        processName: "Entscheidung",
      }),
    ).toBe(`# Prozess: Entscheidung

- Prüfen?
  - Verbindung ohne Beschriftung:
    - Links
  - Verbindung ohne Beschriftung:
    - Rechts`);
  });

  it("keeps explicit labels and marks an unlabeled decision connection", () => {
    const elements = [
      ...node("decision", "Prüfen?", 0, 0, "diamond"),
      ...node("yes", "Weiter", 0, 160),
      ...node("no", "Stop", 160, 160),
      ...node("fallback", "Fallback", 320, 160),
      ...arrow("decision-to-yes", "decision", "yes", "Ja"),
      ...arrow("decision-to-no", "decision", "no", "Nein"),
      ...arrow("decision-to-fallback", "decision", "fallback"),
    ];

    expect(
      exportProcessDiagramToMarkdown({
        elements,
        processName: "Fallback",
      }),
    ).toBe(`# Prozess: Fallback

- Prüfen?
  - Ja:
    - Weiter
  - Nein:
    - Stop
  - Verbindung ohne Beschriftung:
    - Fallback`);
  });

  it("exports separated flows, frame headings, and swimlane lane headings from the markdown fixture", () => {
    const fixture = JSON.parse(
      readFileSync(
        `${process.cwd()}/test_files/markdown-export-test.excalidraw`,
        "utf8",
      ),
    ) as { elements: ExcalidrawElement[] };

    expect(
      exportProcessDiagramToMarkdown({
        elements: fixture.elements,
        processName: null,
      }),
    ).toBe(`# Prozess: Unbenannt

Beispiel Text, den
köönte

man auch hinzufügen

- Flow1
- Yes
- Cool

- Flow2
- Wirklich?
  - Verbindung ohne Beschriftung: zurück zu "Flow2"
  - Verbindung ohne Beschriftung:
    - Ja

Erläuterung 1: Blabla

Erläuterung 2: Lorem Ipsum

# Sektion 1
- Flow3
- Schritt 2

# Sektion 2
- Hier gehts weiter
- Richtig gut

# Lane 1
- Lane Test
- Sweet

# Lane 2
- Weiter
- Step 2

# Lane 3
- Und in Lane 3`);
  });
});

describe("Markdown routes", () => {
  it("nests decisions and repeats short shared continuations while preserving loops", () => {
    const elements = [
      ...node("start", "Start?", 0, 0, "diamond"),
      ...node("nested", "Prüfen?", 160, 0, "diamond"),
      ...node("fix", "Korrigieren", 160, 160),
      ...node("other", "Alternative", 0, 160),
      ...node("join", "Gemeinsam", 320, 0),
      ...node("end", "Ende", 480, 0),
      ...arrow("a", "start", "nested", "Ja"),
      ...arrow("b", "start", "other", "Nein"),
      ...arrow("c", "nested", "join", "Ja"),
      ...arrow("d", "nested", "fix", "Nein"),
      ...arrow("e", "fix", "nested"),
      ...arrow("f", "other", "join"),
      ...arrow("g", "join", "end"),
    ];
    expect(exportProcessDiagramToMarkdown({ elements }))
      .toBe(`# Prozess: Unbenannt

- Start?
  - Ja:
    - Prüfen?
      - Ja:
        - Gemeinsam
        - Ende
      - Nein:
        - Korrigieren
        - zurück zu "Prüfen?"
  - Nein:
    - Alternative
    - Gemeinsam
    - Ende`);
  });

  it("preserves a labeled single connection and terminates a rootless cycle", () => {
    const elements = [
      ...node("a", "Warten", 0, 0),
      ...node("b", "Prüfen", 160, 0),
      ...arrow("ab", "a", "b", "Nach 10 Tagen"),
      ...arrow("ba", "b", "a"),
    ];
    expect(exportProcessDiagramToMarkdown({ elements }))
      .toBe(`# Prozess: Unbenannt

- Warten
  - Nach 10 Tagen:
    - Prüfen
    - zurück zu "Warten"`);
  });

  it.each(["Growth Engine Example", "Fullfillment Engine Example"])(
    "exports the complete %s sample deterministically",
    (name) => {
      const path = `${process.cwd()}/samples/${name}`;
      const { elements } = JSON.parse(
        readFileSync(`${path}.excalidraw`, "utf8"),
      );
      const markdown = exportProcessDiagramToMarkdown({
        elements,
        processName: name,
      });
      expect(
        exportProcessDiagramToMarkdown({
          elements: [...elements].reverse(),
          processName: name,
        }),
      ).toBe(markdown);
      // Test snapshots are separate from the immutable, versioned sample exports.
      expect(markdown).toMatchSnapshot();
      if (name === "Growth Engine Example") {
        expect(markdown).not.toContain("## Setter Follow Up");
        expect(markdown.match(/^ *- Setter Follow Up$/gm)).toHaveLength(2);
        expect(markdown).toContain(
          'weiter mit "Attended? (nach Meeting Show-up Series (nach Book with AE) / Setter Follow Up)"',
        );
      } else {
        expect(markdown).not.toContain("## Off-board Client");
        expect(markdown.match(/- Off-board Client/g)).toHaveLength(2);
        expect(markdown.match(/- Referal Request/g)).toHaveLength(2);
      }
    },
  );
});

describe("Unambiguous Markdown destinations", () => {
  it("qualifies repeated and case-only names using their actual incoming steps", () => {
    const elements = [
      ...node("ae", "Book with AE", 0, 0),
      ...node("mdr", "Book with MDR", 0, 200),
      ...node("attend-a", "Attended?", 200, 0, "diamond"),
      ...node("attend-b", "attended?", 200, 200, "diamond"),
      ...arrow("a", "ae", "attend-a"),
      ...arrow("b", "mdr", "attend-b"),
      ...arrow("return", "attend-b", "attend-a", "No"),
    ];
    const before = JSON.stringify(elements);
    const result = exportProcessDiagramToMarkdown({ elements });
    expect(result).toContain("attended? (nach Book with MDR)");
    expect(result).toContain(
      'No: weiter mit "Attended? (nach Book with AE / attended? (nach Book with MDR))"',
    );
    expect(result).toContain(
      "## Attended? (nach Book with AE / attended? (nach Book with MDR))",
    );
    expect(result).not.toContain('weiter mit "Attended?"');
    expect(
      exportProcessDiagramToMarkdown({ elements: [...elements].reverse() }),
    ).toBe(result);
    expect(JSON.stringify(elements)).toBe(before);
  });

  it("keeps independent entries above shared flows, including flows with loops", () => {
    const elements = [
      ...node("a", "First entry", 0, 0),
      ...node("b", "Second entry", 0, 200),
      ...node("join", "Shared", 200, 0),
      ...node("loop", "Retry", 400, 0),
      ...arrow("a-join", "a", "join"),
      ...arrow("b-join", "b", "join"),
      ...arrow("join-loop", "join", "loop"),
      ...arrow("loop-join", "loop", "join"),
    ];
    const result = exportProcessDiagramToMarkdown({ elements });
    expect(result).toContain("## Einstieg: First entry");
    expect(result).toContain("## Einstieg: Second entry");
    expect(result.indexOf("## Einstieg: Second entry")).toBeLessThan(
      result.indexOf("## Shared"),
    );
    expect(result.match(/^- Shared$/gm)).toHaveLength(1);
    expect(result.match(/weiter mit "Shared"/g)).toHaveLength(2);
    expect(result).toContain('- Retry\n- zurück zu "Shared"');
  });

  it("retains an explicitly labeled sonst branch without inventing one", () => {
    const elements = [
      ...node("a", "Closed?", 0, 0, "diamond"),
      ...node("b", "OSA", 200, 0),
      ...node("c", "FB", 200, 200),
      ...arrow("ab", "a", "b", "sonst"),
      ...arrow("ac", "a", "c"),
    ];
    const result = exportProcessDiagramToMarkdown({ elements });
    expect(result).toContain("  - sonst:\n    - OSA");
    expect(result).toContain("  - Verbindung ohne Beschriftung:\n    - FB");
  });

  it("disambiguates identical contexts and collisions with literal names", () => {
    const elements = [
      ...node("root", "Root", 0, 0),
      ...node("a", "Check", 200, 0),
      ...node("b", "Check", 200, 200),
      ...node("literal", "Check (nach Root)", 0, 400),
      ...arrow("ra", "root", "a"),
      ...arrow("rb", "root", "b"),
    ];
    const result = exportProcessDiagramToMarkdown({ elements });
    expect(result).toContain("- Check (nach Root) (1)");
    expect(result).toContain("- Check (nach Root) (2)");
    expect(result).toContain("\n- Check (nach Root)");
  });
});

describe("Short shared routes", () => {
  it.each([1, 2, 3, 4])(
    "inlines a complete %i-step route only up to three steps",
    (length) => {
      const elements = [
        ...node("a", "Entry A", 0, 0),
        ...node("b", "Entry B", 0, 200),
        ...arrow("a-start", "a", "step-1"),
        ...arrow("b-start", "b", "step-1"),
      ];
      for (let i = 1; i <= length; i++) {
        elements.push(...node(`step-${i}`, `Step ${i}`, i * 200, 0));
        if (i < length) {
          elements.push(...arrow(`edge-${i}`, `step-${i}`, `step-${i + 1}`));
        }
      }
      const result = exportProcessDiagramToMarkdown({ elements });
      for (let i = 1; i <= length; i++) {
        expect(result.split(`- Step ${i}`).length - 1).toBe(
          length <= 3 ? 2 : 1,
        );
      }
      expect(result.includes("## Step 1")).toBe(length > 3);
    },
  );

  it("stops before a decision and preserves labeled connections inside the short route", () => {
    const elements = [
      ...node("a", "Entry A", 0, 0),
      ...node("b", "Entry B", 0, 200),
      ...node("wait", "Wait", 200, 0),
      ...node("send", "Send", 400, 0),
      ...node("decision", "Ready?", 600, 0, "diamond"),
      ...node("done", "Done", 800, 0),
      ...arrow("aw", "a", "wait"),
      ...arrow("bw", "b", "wait"),
      ...arrow("ws", "wait", "send", "After 10 days"),
      ...arrow("sd", "send", "decision", "Delivered"),
      ...arrow("dd", "decision", "done", "Yes"),
      ...arrow("dw", "decision", "wait", "No"),
    ];
    const result = exportProcessDiagramToMarkdown({ elements });
    expect(result).not.toContain("## Wait");
    expect(result).toContain("## Ready?");
    expect(result.match(/- Wait/g)).toHaveLength(3);
    expect(result.match(/After 10 days:/g)).toHaveLength(3);
    expect(result.match(/Delivered:/g)).toHaveLength(3);
    expect(result).toContain('Delivered: zurück zu "Ready?"');
    expect(result.match(/^- Ready\?$/gm)).toHaveLength(1);
  });

  it("keeps a shared fork separate even when each branch has only one step", () => {
    const elements = [
      ...node("a", "Entry A", 0, 0),
      ...node("b", "Entry B", 0, 200),
      ...node("fork", "Dispatch", 200, 0),
      ...node("x", "X", 400, 0),
      ...node("y", "Y", 400, 200),
      ...arrow("af", "a", "fork"),
      ...arrow("bf", "b", "fork"),
      ...arrow("fx", "fork", "x", "A"),
      ...arrow("fy", "fork", "y", "B"),
    ];
    const result = exportProcessDiagramToMarkdown({ elements });
    expect(result).toContain("## Dispatch");
    expect(result.match(/^- Dispatch$/gm)).toHaveLength(1);
  });
});
