import type { ExcalidrawSwimlaneElement } from "./types";

export const DEFAULT_SWIMLANE_LINE_COUNT = 4;
export const MIN_SWIMLANE_LINE_COUNT = 2;
export const DEFAULT_SWIMLANE_LANE_COUNT = DEFAULT_SWIMLANE_LINE_COUNT - 1;
export const MIN_SWIMLANE_LANE_COUNT = MIN_SWIMLANE_LINE_COUNT - 1;

export const normalizeSwimlaneLineCount = (lineCount?: number | null) => {
  if (!Number.isFinite(lineCount)) {
    return DEFAULT_SWIMLANE_LINE_COUNT;
  }

  return Math.max(MIN_SWIMLANE_LINE_COUNT, Math.round(lineCount!));
};

export const getSwimlaneLineCount = (element: ExcalidrawSwimlaneElement) =>
  normalizeSwimlaneLineCount(element.lineCount);

export const normalizeSwimlaneLaneCount = (laneCount?: number | null) =>
  Math.max(
    MIN_SWIMLANE_LANE_COUNT,
    normalizeSwimlaneLineCount(
      Number.isFinite(laneCount) ? Number(laneCount) + 1 : laneCount,
    ) - 1,
  );

export const getSwimlaneLaneCount = (element: ExcalidrawSwimlaneElement) =>
  normalizeSwimlaneLaneCount(getSwimlaneLineCount(element) - 1);

export const getSwimlaneInternalLineXOffsets = (
  element: ExcalidrawSwimlaneElement,
) => {
  const lineCount = getSwimlaneLineCount(element);
  if (lineCount <= 2) {
    return [];
  }

  const spacing = element.width / (lineCount - 1);
  return Array.from(
    { length: lineCount - 2 },
    (_, index) => spacing * (index + 1),
  );
};
