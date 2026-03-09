import {
  getSwimlaneLaneCount,
  isSwimlaneElement,
  normalizeSwimlaneLaneCount,
  normalizeSwimlaneLineCount,
  syncSwimlaneLabels,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { Scene } from "@excalidraw/element";

import DragInput from "./DragInput";

import type { AppState } from "../../types";

interface SwimlaneLineCountProps {
  element: ExcalidrawElement;
  scene: Scene;
  appState: AppState;
}

const SwimlaneLineCount = ({
  element,
  scene,
  appState,
}: SwimlaneLineCountProps) => {
  if (!isSwimlaneElement(element)) {
    return null;
  }

  return (
    <DragInput
      label="Lanes"
      value={getSwimlaneLaneCount(element)}
      elements={[element]}
      property="lineCount"
      scene={scene}
      appState={appState}
      sensitivity={12}
      updateOnChange
      dragInputCallback={({
        accumulatedChange,
        instantChange,
        nextValue,
        originalElements,
      }) => {
        const originalElement = originalElements[0];
        const latestElement = scene
          .getNonDeletedElementsMap()
          .get(originalElement.id);

        if (!latestElement || !isSwimlaneElement(latestElement)) {
          return;
        }

        const candidateValue =
          nextValue !== undefined
            ? nextValue
            : getSwimlaneLaneCount(originalElement) +
              accumulatedChange +
              instantChange;

        scene.mutateElement(latestElement, {
          lineCount: normalizeSwimlaneLineCount(
            normalizeSwimlaneLaneCount(candidateValue) + 1,
          ),
        });
        syncSwimlaneLabels(scene, latestElement);
      }}
    />
  );
};

export default SwimlaneLineCount;
