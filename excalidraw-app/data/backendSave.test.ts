import { vi } from "vitest";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import { saveToBackend } from "./index";

const elements = [
  API.createElement({ type: "rectangle", width: 120, height: 120 }),
];

afterEach(() => vi.restoreAllMocks());

it("completes named backend saves and retains image export preferences", async () => {
  const fetchSpy = vi
    .spyOn(window, "fetch")
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "saved-flow" }), { status: 201 }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const result = await saveToBackend(
    elements,
    {
      ...getDefaultAppState(),
      exportBackground: false,
      exportWithDarkMode: true,
      exportEmbedScene: true,
      exportScale: 3,
    },
    {},
    {
      drawingName: "Flow",
      persistEncryptionKey: true,
      invalidateImageCache: true,
    },
  );
  expect(result.errorMessage).toBeNull();
  const request = fetchSpy.mock.calls[0][1]!;
  const { data } = await decompressData(
    new Uint8Array(request.body as ArrayBuffer),
    { decryptionKey: result.encryptionKey! },
  );
  expect(JSON.parse(new TextDecoder().decode(data)).appState).toMatchObject({
    exportBackground: false,
    exportWithDarkMode: true,
    exportEmbedScene: true,
    exportScale: 3,
  });
  expect(fetchSpy.mock.calls[1][0].toString()).toContain(
    "/api/v2/drawings/saved-flow/image-cache",
  );
  expect(fetchSpy.mock.calls[1][1]).toMatchObject({ method: "DELETE" });
  expect(
    JSON.parse(fetchSpy.mock.calls[1][1]!.body as string).revision,
  ).toMatch(/^[a-f0-9]{64}$/);
});

it("does not invalidate images for share-link saves", async () => {
  const fetchSpy = vi
    .spyOn(window, "fetch")
    .mockResolvedValue(
      new Response(JSON.stringify({ id: "share-flow" }), { status: 201 }),
    );
  const result = await saveToBackend(elements, getDefaultAppState(), {});
  expect(result.errorMessage).toBeNull();
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});

it("reports save completion failure", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(window, "fetch")
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "saved-flow" }), { status: 201 }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 409 }));
  const result = await saveToBackend(
    elements,
    getDefaultAppState(),
    {},
    { persistEncryptionKey: true, invalidateImageCache: true },
  );
  expect(result.id).toBeNull();
  expect(result.errorMessage).toBeTruthy();
});

it("waits for attached image uploads before invalidating the cache", async () => {
  const backendFiles = await import("./backendFiles");
  let finishUpload!: () => void;
  const upload = vi
    .spyOn(backendFiles, "saveFilesToBackend")
    .mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishUpload = resolve;
        }),
    );
  const fetchSpy = vi
    .spyOn(window, "fetch")
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "saved-flow" }), { status: 201 }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const image = API.createElement({
    type: "image",
    status: "saved",
    fileId: "pixel" as any,
  });
  const pending = saveToBackend(
    [image],
    getDefaultAppState(),
    {
      pixel: {
        id: "pixel" as any,
        mimeType: "image/png",
        created: 123,
        dataURL: "data:image/png;base64,AQID" as any,
      },
    },
    { persistEncryptionKey: true, invalidateImageCache: true },
  );
  await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  finishUpload();
  expect((await pending).errorMessage).toBeNull();
  expect(fetchSpy).toHaveBeenCalledTimes(2);
});

it("does not invalidate when an attached image fails to upload", async () => {
  const backendFiles = await import("./backendFiles");
  vi.spyOn(backendFiles, "saveFilesToBackend").mockRejectedValue(
    new Error("upload failed"),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  const fetchSpy = vi
    .spyOn(window, "fetch")
    .mockResolvedValue(
      new Response(JSON.stringify({ id: "saved-flow" }), { status: 201 }),
    );
  const image = API.createElement({
    type: "image",
    status: "saved",
    fileId: "pixel" as any,
  });
  const result = await saveToBackend(
    [image],
    getDefaultAppState(),
    {
      pixel: {
        id: "pixel" as any,
        mimeType: "image/png",
        created: 123,
        dataURL: "data:image/png;base64,AQID" as any,
      },
    },
    { persistEncryptionKey: true, invalidateImageCache: true },
  );
  expect(result.errorMessage).toBeTruthy();
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});
