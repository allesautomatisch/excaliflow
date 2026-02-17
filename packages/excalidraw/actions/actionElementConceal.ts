import { KEYS, arrayToMap } from "@excalidraw/common";

import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { eyeClosedIcon, eyeIcon } from "../components/icons";

import { getSelectedElements } from "../scene";

import { register } from "./register";

const shouldConceal = (elements: readonly ExcalidrawElement[]) =>
  elements.every((el) => !el.concealed);

export const actionToggleElementConceal = register({
  name: "toggleElementConceal",
  label: (_elements, appState, app) => {
    const selected = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: false,
    });

    return shouldConceal(selected)
      ? "labels.elementConceal.conceal"
      : "labels.elementConceal.reveal";
  },
  icon: (appState, elements) => {
    const selectedElements = getSelectedElements(elements, appState);
    return shouldConceal(selectedElements) ? eyeClosedIcon : eyeIcon;
  },
  trackEvent: { category: "element" },
  predicate: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState);
    return selectedElements.length > 0;
  },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: true,
      includeElementsInFrames: true,
    });

    if (!selectedElements.length) {
      return false;
    }

    const nextConcealState = shouldConceal(selectedElements);
    const selectedElementsMap = arrayToMap(selectedElements);

    const nextElements = elements.map((element) => {
      if (!selectedElementsMap.has(element.id)) {
        return element;
      }

      return newElementWith(element, {
        concealed: nextConcealState,
      });
    });

    return {
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event, appState, _elements, app) => {
    return (
      event.key === KEYS.S &&
      !event[KEYS.CTRL_OR_CMD] &&
      !event.altKey &&
      !event.shiftKey &&
      app.scene.getSelectedElements({
        selectedElementIds: appState.selectedElementIds,
        includeBoundTextElement: false,
      }).length > 0
    );
  },
});
