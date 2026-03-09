import {
  DEFAULT_FONT_SIZE,
  FONT_FAMILY,
  TEXT_ALIGN,
  VERTICAL_ALIGN,
} from "@excalidraw/common";
import { pointFrom, pointRotateRads } from "@excalidraw/math";

import { newElementWith } from "./mutateElement";
import { withGridSnapDisabled } from "./grid";
import { newTextElement } from "./newElement";
import { isTextElement } from "./typeChecks";
import { getSwimlaneLaneCount } from "./swimlane";

import type { Scene } from "./Scene";
import type {
  ExcalidrawElement,
  ExcalidrawSwimlaneElement,
  ExcalidrawTextElement,
} from "./types";

const SWIMLANE_LABEL_VERTICAL_PADDING = 20;
const SWIMLANE_LABEL_DATA_KEY = "swimlaneLabel";

type SwimlaneLabelMetadata = {
  laneIndex: number;
};

const getSwimlaneLabelMetadata = (
  element: ExcalidrawElement,
): SwimlaneLabelMetadata | null => {
  if (!isTextElement(element)) {
    return null;
  }

  const metadata = element.customData?.[SWIMLANE_LABEL_DATA_KEY];
  if (
    metadata &&
    typeof metadata === "object" &&
    typeof metadata.laneIndex === "number"
  ) {
    return {
      laneIndex: metadata.laneIndex,
    };
  }

  return null;
};

export const isSwimlaneLabelElement = (
  element: ExcalidrawElement,
  swimlaneId?: ExcalidrawSwimlaneElement["id"],
): element is ExcalidrawTextElement => {
  const metadata = getSwimlaneLabelMetadata(element);
  return (
    !!metadata &&
    isTextElement(element) &&
    (swimlaneId === undefined || element.frameId === swimlaneId)
  );
};

export const getSwimlaneLabelLaneIndex = (
  element: ExcalidrawElement,
): number | null => {
  return getSwimlaneLabelMetadata(element)?.laneIndex ?? null;
};

const getSwimlaneLabelCenter = (
  swimlane: ExcalidrawSwimlaneElement,
  laneIndex: number,
) => {
  const laneWidth = swimlane.width / getSwimlaneLaneCount(swimlane);
  const swimlaneCenter = pointFrom(
    swimlane.x + swimlane.width / 2,
    swimlane.y + swimlane.height / 2,
  );
  const unrotatedCenter = pointFrom(
    swimlane.x + laneWidth * (laneIndex + 0.5),
    swimlane.y + SWIMLANE_LABEL_VERTICAL_PADDING,
  );
  const [x, y] = pointRotateRads(
    unrotatedCenter,
    swimlaneCenter,
    swimlane.angle,
  );

  return {
    x,
    y,
  };
};

const getSwimlaneLabelPosition = (
  swimlane: ExcalidrawSwimlaneElement,
  laneIndex: number,
  label: Pick<ExcalidrawTextElement, "width" | "height">,
) => {
  const center = getSwimlaneLabelCenter(swimlane, laneIndex);

  return {
    x: center.x - label.width / 2,
    y: center.y - label.height / 2,
  };
};

const getDefaultSwimlaneLabelText = (laneIndex: number) =>
  `Lane ${laneIndex + 1}`;

const createSwimlaneLabel = (
  swimlane: ExcalidrawSwimlaneElement,
  laneIndex: number,
) => {
  const center = getSwimlaneLabelCenter(swimlane, laneIndex);

  return newTextElement({
    x: center.x,
    y: center.y,
    angle: swimlane.angle,
    text: getDefaultSwimlaneLabelText(laneIndex),
    fontSize: DEFAULT_FONT_SIZE,
    fontFamily: FONT_FAMILY["Comic Shanns"],
    textAlign: TEXT_ALIGN.CENTER,
    verticalAlign: VERTICAL_ALIGN.MIDDLE,
    strokeColor: swimlane.strokeColor,
    frameId: swimlane.id,
    customData: withGridSnapDisabled({
      [SWIMLANE_LABEL_DATA_KEY]: {
        laneIndex,
      },
    }),
  });
};

export const syncSwimlaneLabels = (
  scene: Scene,
  swimlane: ExcalidrawSwimlaneElement,
) => {
  const desiredLaneCount = getSwimlaneLaneCount(swimlane);
  const existingLabels = Array.from(
    scene.getElementsMapIncludingDeleted().values(),
  ).filter(
    (element) => !element.isDeleted && isSwimlaneLabelElement(element, swimlane.id),
  ) as ExcalidrawTextElement[];

  const labelsByLaneIndex = new Map<number, ExcalidrawTextElement>();
  for (const label of existingLabels) {
    const laneIndex = getSwimlaneLabelLaneIndex(label);
    if (laneIndex !== null && !labelsByLaneIndex.has(laneIndex)) {
      labelsByLaneIndex.set(laneIndex, label);
    }
  }

  const labelsToInsert: ExcalidrawTextElement[] = [];

  for (let laneIndex = 0; laneIndex < desiredLaneCount; laneIndex++) {
    const label = labelsByLaneIndex.get(laneIndex);

    if (!label) {
      labelsToInsert.push(createSwimlaneLabel(swimlane, laneIndex));
      continue;
    }

    scene.mutateElement(
      label,
      {
        ...getSwimlaneLabelPosition(swimlane, laneIndex, label),
        angle: swimlane.angle,
      },
      {
        informMutation: false,
        isDragging: false,
      },
    );
  }

  if (labelsToInsert.length > 0) {
    scene.insertElementsAtIndex(
      labelsToInsert,
      scene.getElementIndex(swimlane.id) + 1,
    );
  }

  const labelsToDelete = new Set(
    existingLabels
      .filter((label) => {
        const laneIndex = getSwimlaneLabelLaneIndex(label);
        return laneIndex !== null && laneIndex >= desiredLaneCount;
      })
      .map((label) => label.id),
  );

  if (labelsToDelete.size > 0) {
    scene.mapElements((element) =>
      labelsToDelete.has(element.id)
        ? newElementWith(element, { isDeleted: true })
        : element,
    );
  }
};
