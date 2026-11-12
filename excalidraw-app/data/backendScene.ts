import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  decryptData,
  IV_LENGTH_BYTES,
} from "@excalidraw/excalidraw/data/encryption";

import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";

/**
 * Decodes shareLink data using the legacy buffer format.
 * @deprecated
 */
const legacyDecodeFromBackend = async ({
  buffer,
  decryptionKey,
}: {
  buffer: ArrayBuffer;
  decryptionKey: string;
}) => {
  let decrypted: ArrayBuffer;

  try {
    // Buffer should contain both the IV (fixed length) and encrypted data
    const iv = buffer.slice(0, IV_LENGTH_BYTES);
    const encrypted = buffer.slice(IV_LENGTH_BYTES, buffer.byteLength);
    decrypted = await decryptData(new Uint8Array(iv), encrypted, decryptionKey);
  } catch (error: any) {
    // Fixed IV (old format, backward compatibility)
    const fixedIv = new Uint8Array(IV_LENGTH_BYTES);
    decrypted = await decryptData(fixedIv, buffer, decryptionKey);
  }

  // We need to convert the decrypted array buffer to a string
  const string = new window.TextDecoder("utf-8").decode(
    new Uint8Array(decrypted),
  );
  const data: ImportedDataState = JSON.parse(string);

  return {
    elements: data.elements || null,
    appState: data.appState || null,
  };
};

export const decodeBackendDrawing = async (
  buffer: ArrayBuffer,
  decryptionKey: string,
): Promise<ImportedDataState> => {
  try {
    const { data } = await decompressData(new Uint8Array(buffer), {
      decryptionKey,
    });
    return JSON.parse(new TextDecoder().decode(data));
  } catch {
    return legacyDecodeFromBackend({ buffer, decryptionKey });
  }
};
