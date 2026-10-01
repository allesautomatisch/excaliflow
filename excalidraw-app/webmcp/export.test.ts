import { vi } from "vitest";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { fileSave } from "@excalidraw/excalidraw/data/filesystem";
import {
  copyBlobToClipboardAsPng,
  copyTextToSystemClipboard,
} from "@excalidraw/excalidraw/clipboard";
import { decodePngMetadata } from "@excalidraw/excalidraw/data/image";
import { blobToArrayBuffer } from "@excalidraw/excalidraw/data/blob";
import { decodeSvgBase64Payload } from "@excalidraw/excalidraw/scene/export";

import type { DataURL } from "@excalidraw/excalidraw/types";
import type { FileId } from "@excalidraw/element/types";

import { exportDrawing } from "./export";

vi.mock("@excalidraw/excalidraw/data/filesystem", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fileSave: vi.fn(async (blob) => {
    await blob;
    return { name: "Saved" };
  }),
}));
vi.mock("@excalidraw/excalidraw/clipboard", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  copyTextToSystemClipboard: vi.fn(async () => {}),
  copyBlobToClipboardAsPng: vi.fn(async (blob) => {
    await blob;
  }),
}));

const text = async (blob: Blob) =>
  new TextDecoder().decode(await blobToArrayBuffer(blob));
const snapshot = () => ({
  elements: [
    API.createElement({
      type: "rectangle",
      id: "node",
      width: 240,
      height: 240,
    }),
    API.createElement({
      type: "text",
      id: "label",
      text: "Video veröffentlichen",
      x: 400,
      width: 200,
      height: 20,
    }),
  ],
  state: {
    ...getDefaultAppState(),
    width: 1000,
    height: 800,
    offsetLeft: 0,
    offsetTop: 0,
    name: "My Company Flow",
    fileHandle: { name: "Original.excalidraw" } as any,
  },
  files: {},
});

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each(["excalidraw", "md"] as const)(
  "saves and copies real %s content without changing the active file handle",
  async (format) => {
    const snap = snapshot();
    const before = JSON.stringify(snap);
    await exportDrawing(
      { drawingSession: "s", format, destination: "save", name: "Example" },
      snap,
    );
    const saved = await vi.mocked(fileSave).mock.calls[0][0];
    const savedText = await text(saved);
    expect(vi.mocked(fileSave).mock.calls[0][1]).toMatchObject({
      name: "Example",
      extension: format,
    });
    if (format === "excalidraw") {
      expect(vi.mocked(fileSave).mock.calls[0][1].fileHandle).toBeNull();
    }
    await exportDrawing(
      {
        drawingSession: "s",
        format,
        destination: "clipboard",
        name: "Example",
      },
      snap,
    );
    expect(vi.mocked(copyTextToSystemClipboard).mock.calls[0][0]).toBe(
      savedText,
    );
    if (format === "md") {
      expect(savedText).toContain("Video veröffentlichen");
    } else {
      expect(JSON.parse(savedText)).toMatchObject({
        type: "excalidraw",
        elements: expect.arrayContaining([
          expect.objectContaining({ id: "node" }),
        ]),
      });
    }
    expect(JSON.stringify(snap)).toBe(before);
  },
);

it.each(["save", "clipboard", "server"] as const)(
  "keeps SVG flags and embedded scene in %s exports",
  async (destination) => {
    const snap = snapshot();
    snap.elements = [snap.elements[0]];
    const fetchMock = vi.fn(
      async (_url: unknown, _options: { body: FormData }) => ({
        ok: true,
        json: async () => ({
          uuid: "uuid",
          exports: [
            {
              format: "svg",
              fileName: "flow.svg",
              url: "/exports/flow.svg",
              sizeBytes: 10,
            },
          ],
        }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await exportDrawing(
      {
        drawingSession: "s",
        format: "svg",
        destination,
        imageOptions: {
          background: false,
          darkMode: true,
          embedScene: true,
          scale: 3,
        },
      },
      snap,
    );
    const svg =
      destination === "clipboard"
        ? String(vi.mocked(copyTextToSystemClipboard).mock.calls[0][0])
        : destination === "save"
        ? await text(await vi.mocked(fileSave).mock.calls[0][0])
        : await text(fetchMock.mock.calls[0][1].body.get("files[svg]") as Blob);
    expect(svg).toContain('width="780"');
    expect(svg).toContain('stroke="#d3d3d3"');
    expect(JSON.parse(decodeSvgBase64Payload({ svg })).elements).toEqual([
      expect.objectContaining({ id: "node" }),
    ]);
    expect(result.imageOptions).toMatchObject({
      background: false,
      darkMode: true,
      embedScene: true,
      scale: 3,
    });
    expect(snap.state.exportScale).toBe(1);
  },
);

it.each(["save", "clipboard", "server"] as const)(
  "keeps PNG scene metadata in %s exports",
  async (destination) => {
    // jsdom does not rasterize; use valid PNG bytes while exercising actual metadata encoding and transport.
    const png = await API.loadFile("./fixtures/smiley.png");
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback) => callback(png),
    );
    const snap = snapshot();
    snap.elements = [snap.elements[0]];
    const fetchMock = vi.fn(
      async (_url: unknown, _options: { body: FormData }) => ({
        ok: true,
        json: async () => ({
          uuid: "uuid",
          exports: [
            {
              format: "png",
              fileName: "flow.png",
              url: "/exports/flow.png",
              sizeBytes: 10,
            },
          ],
        }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await exportDrawing(
      {
        drawingSession: "s",
        format: "png",
        destination,
        imageOptions: { embedScene: true },
      },
      snap,
    );
    const blob =
      destination === "save"
        ? await vi.mocked(fileSave).mock.calls[0][0]
        : destination === "clipboard"
        ? await vi.mocked(copyBlobToClipboardAsPng).mock.calls[0][0]
        : (fetchMock.mock.calls[0][1].body.get("files[png]") as Blob);
    expect(JSON.parse(await decodePngMetadata(blob)).elements).toEqual([
      expect.objectContaining({ id: "node" }),
    ]);
  },
);

it("publishes PNG and Markdown together from the same captured selection and returns paired public URLs", async () => {
  const png = await API.loadFile("./fixtures/smiley.png");
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback) => callback(png),
  );
  const snap = snapshot();
  snap.state.selectedElementIds = { label: true };
  const fetchMock = vi.fn(
    async (_url: unknown, _options: { body: FormData }) => ({
      ok: true,
      json: async () => ({
        uuid: "shared",
        exports: ["png", "md"].map((format) => ({
          format,
          fileName: `date-my-company-flow-shared.${format}`,
          url: `/exports/date-my-company-flow-shared.${format}`,
          sizeBytes: 10,
        })),
      }),
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const result = await exportDrawing(
    {
      drawingSession: "s",
      formats: ["png", "md"],
      destination: "server",
      imageOptions: { selectedOnly: true, embedScene: true },
    },
    snap,
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const body = fetchMock.mock.calls[0][1].body;
  expect(
    JSON.parse(await decodePngMetadata(body.get("files[png]") as Blob))
      .elements,
  ).toEqual([expect.objectContaining({ id: "label" })]);
  expect(await text(body.get("files[md]") as Blob)).toContain(
    "Video veröffentlichen",
  );
  expect(result).toMatchObject({
    uuid: "shared",
    elementCount: 1,
    exports: [
      {
        url: expect.stringContaining(
          "/exports/date-my-company-flow-shared.png",
        ),
      },
      {
        url: expect.stringContaining("/exports/date-my-company-flow-shared.md"),
      },
    ],
  });
});

it("rejects empty selections and reports failed uploads without invoking local save or clipboard", async () => {
  await expect(
    exportDrawing(
      {
        drawingSession: "s",
        format: "png",
        destination: "clipboard",
        imageOptions: { selectedOnly: true },
      },
      snapshot(),
    ),
  ).rejects.toThrow("selection");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false, status: 413 })),
  );
  await expect(
    exportDrawing(
      { drawingSession: "s", format: "md", destination: "server" },
      snapshot(),
    ),
  ).rejects.toThrow("413");
  expect(fileSave).not.toHaveBeenCalled();
  expect(copyTextToSystemClipboard).not.toHaveBeenCalled();
});

it("keeps referenced image assets in clipboard scene JSON and omits unrelated files", async () => {
  const snap: Parameters<typeof exportDrawing>[1] = {
    ...snapshot(),
    elements: [
      API.createElement({ type: "image", id: "photo", fileId: "asset" }),
    ],
    files: {
      asset: {
        id: "asset" as FileId,
        dataURL: "data:image/png;base64,AAAA" as DataURL,
        mimeType: "image/png",
        created: 123,
      },
      unused: {
        id: "unused" as FileId,
        dataURL: "data:image/png;base64,BBBB" as DataURL,
        mimeType: "image/png",
        created: 123,
      },
    },
  };
  await exportDrawing(
    { drawingSession: "s", format: "excalidraw", destination: "clipboard" },
    snap,
  );
  const copied = JSON.parse(
    String(vi.mocked(copyTextToSystemClipboard).mock.calls[0][0]),
  );
  expect(copied.files).toEqual({ asset: snap.files.asset });
});
