import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { getElementAbsoluteCoords } from "@excalidraw/element";

import type {
  ElementsMap,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { useExcalidrawAppState } from "../components/App";

import "./ElementCanvasButtons.scss";

import type { AppState } from "../types";

const CONTAINER_PADDING = 5;

export type ElementCanvasButtonsPosition =
  | "top-right"
  | "top"
  | "right"
  | "bottom"
  | "left";

const getContainerCoords = (
  element: NonDeletedExcalidrawElement,
  appState: AppState,
  elementsMap: ElementsMap,
  position: ElementCanvasButtonsPosition,
) => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const OFFSET = 10;

  let sceneX = x2;
  let sceneY = y1;

  switch (position) {
    case "top-right":
      sceneX = x2;
      sceneY = y1;
      break;
    case "top":
      sceneX = cx;
      sceneY = y1;
      break;
    case "right":
      sceneX = x2;
      sceneY = cy;
      break;
    case "bottom":
      sceneX = cx;
      sceneY = y2;
      break;
    case "left":
      sceneX = x1;
      sceneY = cy;
      break;
  }

  const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
    { sceneX, sceneY },
    appState,
  );

  let x = viewportX - appState.offsetLeft;
  let y = viewportY - appState.offsetTop;

  switch (position) {
    case "top-right":
      x += OFFSET;
      break;
    case "top":
      y -= OFFSET;
      break;
    case "right":
      x += OFFSET;
      break;
    case "bottom":
      y += OFFSET;
      break;
    case "left":
      x -= OFFSET;
      break;
  }

  return { x, y };
};

export const ElementCanvasButtons = ({
  children,
  element,
  elementsMap,
  position = "top-right",
}: {
  children: React.ReactNode;
  element: NonDeletedExcalidrawElement;
  elementsMap: ElementsMap;
  position?: ElementCanvasButtonsPosition;
}) => {
  const appState = useExcalidrawAppState();

  if (
    appState.contextMenu ||
    appState.newElement ||
    appState.resizingElement ||
    appState.isRotating ||
    appState.openMenu ||
    appState.viewModeEnabled
  ) {
    return null;
  }

  const { x, y } = getContainerCoords(element, appState, elementsMap, position);

  const transform =
    position === "top"
      ? "translate(-50%, -100%)"
      : position === "right"
      ? "translate(0, -50%)"
      : position === "bottom"
      ? "translate(-50%, 0)"
      : position === "left"
      ? "translate(-100%, -50%)"
      : undefined;

  return (
    <div
      className="excalidraw-canvas-buttons"
      style={{
        top: `${y}px`,
        left: `${x}px`,
        transform,
        // width: CONTAINER_WIDTH,
        padding: CONTAINER_PADDING,
      }}
    >
      {children}
    </div>
  );
};
