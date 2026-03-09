import type { ExcalidrawElement } from "./types";

const DISABLE_GRID_SNAP_CUSTOM_DATA_KEY = "disableGridSnap";

export const isGridSnapDisabled = (
  element: Pick<ExcalidrawElement, "customData"> | null | undefined,
) => {
  return element?.customData?.[DISABLE_GRID_SNAP_CUSTOM_DATA_KEY] === true;
};

export const withGridSnapDisabled = (
  customData?: ExcalidrawElement["customData"],
) => {
  return {
    ...customData,
    [DISABLE_GRID_SNAP_CUSTOM_DATA_KEY]: true,
  };
};
