import { CaptureUpdateAction } from "@excalidraw/element";

import { gridIcon } from "../components/icons";

import { register } from "./register";

export const actionToggleGridSize = register({
  name: "toggleGridSize",
  icon: gridIcon,
  label: (_elements, appState) => {
    return appState.gridSize === 120 ? "labels.gridSize120" : "labels.gridSize20";
  },
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => appState.gridSize === 120,
  },
  perform: (elements, appState) => {
    return {
      appState: {
        ...appState,
        gridSize: appState.gridSize === 120 ? 20 : 120,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  predicate: (elements, appState, props) => {
    return props.gridModeEnabled === undefined;
  },
});
