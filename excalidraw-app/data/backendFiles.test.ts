import { compressData } from "@excalidraw/excalidraw/data/encode";
import { vi } from "vitest";

import type { FileId } from "@excalidraw/element/types";
import type { BinaryFileMetadata } from "@excalidraw/excalidraw/types";

import { loadFilesFromBackend, saveFilesToBackend } from "./backendFiles";

const backendUrl = "https://automatisch.test/api/v2/";
const drawingId = "01TESTDRAWING";
const fileId = "file_A" as FileId;

describe("backend drawing files", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads opaque drawing file bytes", async () => {
    const fetchSpy = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(new Response(null, { status: 201 }));
    const buffer = new Uint8Array([1, 2, 3]);

    await saveFilesToBackend({
      backendUrl,
      drawingId,
      files: [{ id: fileId, buffer }],
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      `${backendUrl}drawings/${drawingId}/files/${fileId}`,
      expect.objectContaining({
        method: "PUT",
        body: expect.any(ArrayBuffer),
      }),
    );
  });

  it("downloads and decrypts drawing files", async () => {
    const decryptionKey = "sTdLvMC_M3V8_vGa3UVRDg";
    const dataURL = "data:image/png;base64,AQID";
    const encryptedFile = await compressData<BinaryFileMetadata>(
      new TextEncoder().encode(dataURL),
      {
        encryptionKey: decryptionKey,
        metadata: {
          id: fileId,
          mimeType: "image/png",
          created: 123,
          lastRetrieved: 123,
        },
      },
    );
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(encryptedFile, { status: 200 }),
    );

    const result = await loadFilesFromBackend({
      backendUrl,
      drawingId,
      decryptionKey,
      fileIds: [fileId],
    });

    expect(result.erroredFiles.size).toBe(0);
    expect(result.loadedFiles).toEqual([
      expect.objectContaining({
        id: fileId,
        mimeType: "image/png",
        dataURL,
        created: 123,
      }),
    ]);
  });

  it("reports missing drawing files without rejecting the whole load", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(null, { status: 404 }),
    );

    const result = await loadFilesFromBackend({
      backendUrl,
      drawingId,
      decryptionKey: "sTdLvMC_M3V8_vGa3UVRDg",
      fileIds: [fileId],
    });

    expect(result.loadedFiles).toEqual([]);
    expect(result.erroredFiles.has(fileId)).toBe(true);
  });
});
