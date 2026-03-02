import { KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

export const actionToggleFlowMode = register({
  name: "flowMode",
  label: "buttons.flowMode",
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.flowModeEnabled,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        flowModeEnabled: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.flowModeEnabled,
  predicate: (elements, appState, appProps, app) => {
    return (
      app.editorInterface.formFactor !== "phone" &&
      typeof appProps.flowModeEnabled === "undefined"
    );
  },
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] &&
    event.altKey &&
    event.key.toLowerCase() === KEYS.F,
});
