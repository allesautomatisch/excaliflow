import { FONT_FAMILY, TEXT_ALIGN, VERTICAL_ALIGN } from "@excalidraw/common";
import { pointFrom, type LocalPoint } from "@excalidraw/math";
import { readFileSync } from "node:fs";

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
  - Ja: weiter mit "Angebot erstellen"
  - Nein: weiter mit "Rückfragen stellen"
- Rückfragen stellen
- Angebot erstellen
- Angebot versenden`);
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

  it("uses weiter for unlabeled multi-output connections", () => {
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
  - weiter: weiter mit "Links"
  - weiter: weiter mit "Rechts"
- Links
- Rechts`);
  });

  it("uses sonst for the last unlabeled decision connection", () => {
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
  - weiter: weiter mit "Links"
  - sonst: weiter mit "Rechts"
- Links
- Rechts`);
  });

  it("keeps explicit decision labels and uses sonst for the unlabeled fallback", () => {
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
  - Ja: weiter mit "Weiter"
  - Nein: weiter mit "Stop"
  - sonst: weiter mit "Fallback"
- Weiter
- Stop
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
  - weiter: weiter mit "Flow2"
  - sonst: weiter mit "Ja"
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
