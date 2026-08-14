import { decompressData } from "@excalidraw/excalidraw/data/encode";
import { MIME_TYPES } from "@excalidraw/common";

import type { FileId } from "@excalidraw/element/types";
import type {
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "@excalidraw/excalidraw/types";

const getDrawingFileUrl = (
  backendUrl: string,
  drawingId: string,
  fileId: FileId,
) => {
  const endpoint = new URL(backendUrl, window.location.href);
  endpoint.pathname = `${endpoint.pathname.replace(
    /\/+$/,
    "",
  )}/drawings/${encodeURIComponent(drawingId)}/files/${encodeURIComponent(
    fileId,
  )}`;

  return endpoint;
};

export const saveFilesToBackend = async ({
  backendUrl,
  drawingId,
  files,
}: {
  backendUrl: string;
  drawingId: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  await Promise.all(
    files.map(async ({ id, buffer }) => {
      const body = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
      const response = await fetch(
        getDrawingFileUrl(backendUrl, drawingId, id).toString(),
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/octet-stream",
          },
          body,
        },
      );

      if (!response.ok) {
        throw new Error(`Drawing file upload failed (HTTP ${response.status})`);
      }
    }),
  );
};

export const loadFilesFromBackend = async ({
  backendUrl,
  drawingId,
  decryptionKey,
  fileIds,
}: {
  backendUrl: string;
  drawingId: string;
  decryptionKey: string;
  fileIds: readonly FileId[];
}) => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    [...new Set(fileIds)].map(async (id) => {
      try {
        const response = await fetch(
          getDrawingFileUrl(backendUrl, drawingId, id).toString(),
          { headers: { Accept: "application/octet-stream" } },
        );

        if (!response.ok) {
          erroredFiles.set(id, true);
          return;
        }

        const { data, metadata } = await decompressData<BinaryFileMetadata>(
          new Uint8Array(await response.arrayBuffer()),
          { decryptionKey },
        );

        loadedFiles.push({
          mimeType: metadata.mimeType || MIME_TYPES.binary,
          id,
          dataURL: new TextDecoder().decode(data) as DataURL,
          created: metadata.created || Date.now(),
          lastRetrieved: Date.now(),
        });
      } catch (error: any) {
        erroredFiles.set(id, true);
        console.error(error);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};
