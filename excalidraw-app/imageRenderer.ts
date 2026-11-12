import { isInitializedImageElement } from "@excalidraw/element";
import {
  exportImageBlob,
  prepareElementsForExport,
} from "@excalidraw/excalidraw/data";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";

import type {
  BinaryFileMetadata,
  BinaryFiles,
  DataURL,
} from "@excalidraw/excalidraw/types";

import { decodeBackendDrawing } from "./data/backendScene";

export type ImageRenderInput = {
  payload: string;
  encryptionKey: string;
  files: Record<string, string>;
  format: "png" | "svg";
};

const decodeBase64 = (value: string) =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

export async function renderFlowImage(
  input: ImageRenderInput,
): Promise<string> {
  const scene = await decodeBackendDrawing(
    decodeBase64(input.payload).buffer,
    input.encryptionKey,
  );
  const elements = restoreElements(scene.elements, null);
  const state = {
    ...restoreAppState(scene.appState, null),
    width: 0,
    height: 0,
    offsetTop: 0,
    offsetLeft: 0,
  };
  const files: BinaryFiles = { ...scene.files };
  await Promise.all(
    elements.map(async (element) => {
      if (!isInitializedImageElement(element) || files[element.fileId]) {
        return;
      }
      const encrypted = input.files[element.fileId];
      if (!encrypted) {
        throw new Error("A saved drawing image is missing");
      }
      const { data, metadata } = await decompressData<BinaryFileMetadata>(
        decodeBase64(encrypted),
        { decryptionKey: input.encryptionKey },
      );
      files[element.fileId] = {
        id: element.fileId,
        mimeType: metadata.mimeType,
        created: metadata.created,
        dataURL: new TextDecoder().decode(data) as DataURL,
      };
    }),
  );
  const { exportedElements, exportingFrame } = prepareElementsForExport(
    elements,
    state,
    false,
  );
  const blob = await exportImageBlob(
    input.format,
    exportedElements,
    state,
    files,
    {
      exportBackground: state.exportBackground,
      viewBackgroundColor: state.viewBackgroundColor,
      exportingFrame,
    },
  );
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Could not encode the rendered image"));
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.readAsDataURL(blob);
  });
}

declare global {
  interface Window {
    renderFlowImage: typeof renderFlowImage;
  }
}

// This standalone page reads no session or drawing URLs. The server gives a
// fresh isolated browser the encrypted snapshot directly through Playwright.
window.renderFlowImage = renderFlowImage;
