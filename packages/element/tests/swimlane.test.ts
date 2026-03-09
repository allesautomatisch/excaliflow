import { FONT_FAMILY, arrayToMap } from "@excalidraw/common";
import { pointFrom, pointRotateRads } from "@excalidraw/math";

import { dragSelectedElements } from "../src/dragElements";
import { isGridSnapDisabled } from "../src/grid";
import { mutateElement } from "../src/mutateElement";
import { newElement, newSwimlaneElement } from "../src/newElement";
import { transformElements } from "../src/resizeElements";
import { Scene } from "../src/Scene";
import { getElementsInNewFrame } from "../src/frame";
import { ShapeCache } from "../src/shape";
import {
  DEFAULT_SWIMLANE_LANE_COUNT,
  DEFAULT_SWIMLANE_LINE_COUNT,
  getSwimlaneLaneCount,
  getSwimlaneInternalLineXOffsets,
  normalizeSwimlaneLaneCount,
  normalizeSwimlaneLineCount,
} from "../src/swimlane";
import { isSwimlaneLabelElement, syncSwimlaneLabels } from "../src/swimlaneLabels";
import { getTransformHandles } from "../src/transformHandles";

describe("swimlane element", () => {
  it("defaults to four equally spaced boundary lines", () => {
    const swimlane = newSwimlaneElement({
      x: 0,
      y: 0,
      width: 300,
      height: 180,
    });

    expect(swimlane.lineCount).toBe(DEFAULT_SWIMLANE_LINE_COUNT);
    expect(getSwimlaneInternalLineXOffsets(swimlane)).toEqual([100, 200]);
  });

  it("normalizes invalid line counts", () => {
    expect(normalizeSwimlaneLineCount(undefined)).toBe(
      DEFAULT_SWIMLANE_LINE_COUNT,
    );
    expect(normalizeSwimlaneLineCount(1)).toBe(2);
    expect(normalizeSwimlaneLineCount(5.6)).toBe(6);
    expect(normalizeSwimlaneLaneCount(undefined)).toBe(
      DEFAULT_SWIMLANE_LANE_COUNT,
    );
    expect(normalizeSwimlaneLaneCount(0)).toBe(1);
    expect(normalizeSwimlaneLaneCount(4.6)).toBe(5);
    expect(getSwimlaneLaneCount({ lineCount: 2 } as any)).toBe(1);
  });

  it("acts as a frame-like container for membership checks", () => {
    const swimlane = newSwimlaneElement({
      x: 0,
      y: 0,
      width: 200,
      height: 160,
    });
    const inside = newElement({
      type: "rectangle",
      x: 40,
      y: 30,
      width: 60,
      height: 40,
    });
    const outside = newElement({
      type: "rectangle",
      x: 260,
      y: 30,
      width: 60,
      height: 40,
    });

    const allElements = [swimlane, inside, outside];
    const elementsMap = arrayToMap(allElements);

    expect(getElementsInNewFrame(allElements, swimlane, elementsMap)).toEqual([
      inside,
    ]);
  });

  it("invalidates the cached shape when the line count changes", () => {
    const swimlane = newSwimlaneElement({
      x: 0,
      y: 0,
      width: 200,
      height: 160,
    });
    const elementsMap = arrayToMap([swimlane]);

    ShapeCache.generateElementShape(swimlane, null);
    expect(ShapeCache.get(swimlane, null)).toBeDefined();

    mutateElement(swimlane, elementsMap, { lineCount: 6 });

    expect(ShapeCache.get(swimlane, null)).toBeUndefined();
  });

  it("creates one centered label text element per swimlane lane", () => {
    const swimlane = newSwimlaneElement({
      x: 10,
      y: 20,
      width: 300,
      height: 180,
    });
    const scene = new Scene();
    scene.insertElement(swimlane);

    syncSwimlaneLabels(scene, swimlane);

    const labels = scene
      .getNonDeletedElements()
      .filter((element) => isSwimlaneLabelElement(element, swimlane.id))
      .sort((a, b) => a.x - b.x);

    expect(labels).toHaveLength(3);
    expect(labels.map((label) => label.text)).toEqual([
      "Lane 1",
      "Lane 2",
      "Lane 3",
    ]);
    expect(labels.map((label) => label.fontFamily)).toEqual([
      FONT_FAMILY["Comic Shanns"],
      FONT_FAMILY["Comic Shanns"],
      FONT_FAMILY["Comic Shanns"],
    ]);
    expect(labels.every((label) => isGridSnapDisabled(label))).toBe(true);
    expect(labels.map((label) => label.x + label.width / 2)).toEqual([
      60, 160, 260,
    ]);
    expect(labels.map((label) => label.y + label.height / 2)).toEqual([
      40, 40, 40,
    ]);
  });

  it("reflows swimlane labels when the swimlane is resized or relaned", () => {
    const swimlane = newSwimlaneElement({
      x: 0,
      y: 0,
      width: 300,
      height: 180,
    });
    const scene = new Scene();
    scene.insertElement(swimlane);

    syncSwimlaneLabels(scene, swimlane);

    mutateElement(swimlane, scene.getNonDeletedElementsMap(), {
      width: 400,
      lineCount: 5,
    });
    syncSwimlaneLabels(scene, swimlane);

    let labels = scene
      .getNonDeletedElements()
      .filter((element) => isSwimlaneLabelElement(element, swimlane.id))
      .sort((a, b) => a.x - b.x);

    expect(labels).toHaveLength(4);
    expect(labels.map((label) => label.x + label.width / 2)).toEqual([
      50, 150, 250, 350,
    ]);

    mutateElement(swimlane, scene.getNonDeletedElementsMap(), {
      lineCount: 2,
    });
    syncSwimlaneLabels(scene, swimlane);

    labels = scene
      .getNonDeletedElements()
      .filter((element) => isSwimlaneLabelElement(element, swimlane.id))
      .sort((a, b) => a.x - b.x);

    expect(labels).toHaveLength(1);
    expect(labels[0].x + labels[0].width / 2).toBe(200);
  });

  it("does not snap swimlane labels to the grid while dragging", () => {
    const swimlane = newSwimlaneElement({
      x: 10,
      y: 20,
      width: 300,
      height: 180,
    });
    const scene = new Scene();
    scene.insertElement(swimlane);
    syncSwimlaneLabels(scene, swimlane);

    const label = scene
      .getNonDeletedElements()
      .find((element) => isSwimlaneLabelElement(element, swimlane.id));

    expect(label).toBeDefined();

    const originalLabel = label!;
    const originalX = originalLabel.x;
    const originalY = originalLabel.y;

    dragSelectedElements(
      {
        originalElements: new Map([[originalLabel.id, { ...originalLabel }]]),
      } as any,
      [originalLabel],
      { x: 13, y: 11 },
      scene,
      { x: 0, y: 0 },
      20 as any,
    );

    expect(originalLabel.x).toBe(originalX + 13);
    expect(originalLabel.y).toBe(originalY + 11);
  });

  it("supports rotation handles and non-zero rotation", () => {
    const swimlane = newSwimlaneElement({
      x: 0,
      y: 0,
      width: 200,
      height: 120,
    });
    const scene = new Scene();
    scene.insertElement(swimlane);

    const handles = getTransformHandles(
      swimlane,
      { value: 1 as any },
      scene.getNonDeletedElementsMap(),
    );

    expect(handles.rotation).toBeDefined();

    transformElements(
      new Map(),
      "rotation",
      [swimlane],
      scene,
      false,
      false,
      false,
      swimlane.x + swimlane.width + 50,
      swimlane.y + swimlane.height / 2,
      0,
      0,
    );

    expect(swimlane.angle).not.toBe(0);
  });

  it("rotates and repositions swimlane labels with the swimlane", () => {
    const swimlane = newSwimlaneElement({
      x: 0,
      y: 0,
      width: 300,
      height: 180,
    });
    const scene = new Scene();
    scene.insertElement(swimlane);
    syncSwimlaneLabels(scene, swimlane);

    mutateElement(swimlane, scene.getNonDeletedElementsMap(), {
      angle: (Math.PI / 2) as any,
    });
    syncSwimlaneLabels(scene, swimlane);

    const labels = scene
      .getNonDeletedElements()
      .filter((element) => isSwimlaneLabelElement(element, swimlane.id))
      .sort((a, b) => a.x - b.x);

    const swimlaneCenter = pointFrom(
      swimlane.x + swimlane.width / 2,
      swimlane.y + swimlane.height / 2,
    );
    const expectedCenters = [
      pointFrom(50, 20),
      pointFrom(150, 20),
      pointFrom(250, 20),
    ]
      .map((center) => pointRotateRads(center, swimlaneCenter, swimlane.angle))
      .sort((a, b) => a[0] - b[0]);

    expect(labels).toHaveLength(3);
    expect(labels.map((label) => label.angle)).toEqual([
      swimlane.angle,
      swimlane.angle,
      swimlane.angle,
    ]);
    expect(labels.map((label) => Math.round(label.x + label.width / 2))).toEqual(
      expectedCenters.map(([x]) => Math.round(x)),
    );
    expect(labels.map((label) => Math.round(label.y + label.height / 2))).toEqual(
      expectedCenters.map(([, y]) => Math.round(y)),
    );
  });
});
