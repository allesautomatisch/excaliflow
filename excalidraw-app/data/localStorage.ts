import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "@excalidraw/excalidraw/appState";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { IS_LOCAL_STORAGE_ENABLED, STORAGE_KEYS } from "../app_constants";

const withLocalStorage = <T>(callback: () => T, fallback: T) => {
  if (!IS_LOCAL_STORAGE_ENABLED) {
    return fallback;
  }
  try {
    return callback();
  } catch (error: any) {
    console.error(error);
    return fallback;
  }
};

export const saveUsernameToLocalStorage = (username: string) => {
  if (!IS_LOCAL_STORAGE_ENABLED) {
    return;
  }
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_COLLAB,
      JSON.stringify({ username }),
    );
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

export const importUsernameFromLocalStorage = (): string | null => {
  if (!IS_LOCAL_STORAGE_ENABLED) {
    return null;
  }
  return withLocalStorage(() => {
    const data = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB);
    if (data) {
      return JSON.parse(data).username;
    }
    return null;
  }, null);
};

export const importFromLocalStorage = () => {
  if (!IS_LOCAL_STORAGE_ENABLED) {
    return { elements: [], appState: null };
  }
  let savedElements = null;
  let savedState = null;

  return withLocalStorage(() => {
    savedElements = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS);
    savedState = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE);

    let elements: ExcalidrawElement[] = [];
    if (savedElements) {
      try {
        elements = JSON.parse(savedElements);
      } catch (error: any) {
        console.error(error);
        // Do nothing because elements array is already empty
      }
    }

    let appState = null;
    if (savedState) {
      try {
        appState = {
          ...getDefaultAppState(),
          ...clearAppStateForLocalStorage(
            JSON.parse(savedState) as Partial<AppState>,
          ),
        };
      } catch (error: any) {
        console.error(error);
        // Do nothing because appState is already null
      }
    }

    return { elements, appState };
  }, { elements: [], appState: null });
};

export const getElementsStorageSize = () => {
  if (!IS_LOCAL_STORAGE_ENABLED) {
    return 0;
  }
  return withLocalStorage(() => {
    const elements = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS);
    const elementsSize = elements?.length || 0;
    return elementsSize;
  }, 0);
};

export const getTotalStorageSize = () => {
  if (!IS_LOCAL_STORAGE_ENABLED) {
    return 0;
  }
  return withLocalStorage(() => {
    const appState = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE);
    const collab = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB);

    const appStateSize = appState?.length || 0;
    const collabSize = collab?.length || 0;

    return appStateSize + collabSize + getElementsStorageSize();
  }, 0);
};

export const getLegacyLibraryFromLocalStorage = () =>
  withLocalStorage(
    () =>
      localStorage.getItem(STORAGE_KEYS.__LEGACY_LOCAL_STORAGE_LIBRARY),
    null,
  );

export const clearLegacyLibraryFromLocalStorage = () => {
  if (!IS_LOCAL_STORAGE_ENABLED) {
    return;
  }
  withLocalStorage(
    () => {
      localStorage.removeItem(STORAGE_KEYS.__LEGACY_LOCAL_STORAGE_LIBRARY);
      return null;
    },
    null,
  );
};
