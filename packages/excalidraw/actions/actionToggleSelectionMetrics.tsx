import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

export const actionToggleSelectionMetrics = register({
  name: "toggleSelectionMetrics",
  label: "labels.toggleSelectionMetrics",
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.selectionMetricsEnabled,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        selectionMetricsEnabled: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.selectionMetricsEnabled,
});
