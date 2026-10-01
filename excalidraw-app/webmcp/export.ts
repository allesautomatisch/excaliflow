import { DEFAULT_FILENAME, MIME_TYPES, cloneJSON } from "@excalidraw/common";
import { exportProcessDiagramToMarkdown } from "@excalidraw/element";
import { copyTextToSystemClipboard } from "@excalidraw/excalidraw/clipboard";
import {
  exportCanvas,
  exportImageBlob,
  prepareElementsForExport,
} from "@excalidraw/excalidraw/data";
import { fileSave } from "@excalidraw/excalidraw/data/filesystem";
import { saveAsJSON, serializeAsJSON } from "@excalidraw/excalidraw/data/json";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import { publishExports } from "../data/serverExports";

import { id, object } from "./engineSchema";

import type { ExportFormat } from "../data/serverExports";

export const exportSchema = object(
  {
    drawingSession: id,
    expectedRevision: { type: "integer", minimum: 0 },
    format: { enum: ["png", "svg", "excalidraw", "md"] },
    formats: {
      type: "array",
      items: { enum: ["png", "svg", "excalidraw", "md"] },
      minItems: 1,
      maxItems: 4,
    },
    destination: { enum: ["save", "clipboard", "server"] },
    name: { type: "string", minLength: 1, maxLength: 128 },
    imageOptions: object({
      background: { type: "boolean" },
      darkMode: { type: "boolean" },
      embedScene: { type: "boolean" },
      scale: { enum: [1, 2, 3] },
      selectedOnly: { type: "boolean" },
    }),
  },
  ["drawingSession", "destination"],
);

export type ExportInput = {
  drawingSession: string;
  expectedRevision?: number;
  format?: ExportFormat;
  formats?: ExportFormat[];
  destination: "save" | "clipboard" | "server";
  name?: string;
  imageOptions?: {
    background?: boolean;
    darkMode?: boolean;
    embedScene?: boolean;
    scale?: 1 | 2 | 3;
    selectedOnly?: boolean;
  };
};

// Same format and transport helpers as the manual exports. A local copy of
// preferences prevents exporting from changing editor settings or file handles.
export async function exportDrawing(
  input: ExportInput,
  snapshot: {
    elements: readonly ExcalidrawElement[];
    state: AppState;
    files: BinaryFiles;
  },
  signal?: AbortSignal,
) {
  const name = input.name ?? (snapshot.state.name || DEFAULT_FILENAME);
  const state = { ...cloneJSON({ ...snapshot.state, fileHandle: null }), name };
  const elements = cloneJSON(snapshot.elements);
  const files = cloneJSON(snapshot.files);
  if (input.destination === "server") {
    const formats = input.formats ?? [input.format!];
    const opts = input.imageOptions ?? {};
    state.exportBackground = opts.background ?? state.exportBackground;
    state.exportWithDarkMode = opts.darkMode ?? state.exportWithDarkMode;
    state.exportEmbedScene = opts.embedScene ?? state.exportEmbedScene;
    state.exportScale = opts.scale ?? state.exportScale;
    const selectedOnly = opts.selectedOnly ?? false;
    if (
      selectedOnly &&
      !elements.some((el) => !el.isDeleted && state.selectedElementIds[el.id])
    ) {
      throw new Error("selectedOnly requires a current selection");
    }
    // All formats in a server batch refer to the same selection/snapshot.
    const { exportedElements, exportingFrame } = prepareElementsForExport(
      elements,
      state,
      selectedOnly,
    );
    const rendered = await Promise.all(
      formats.map(async (format) => ({
        format,
        blob:
          format === "png" || format === "svg"
            ? await exportImageBlob(format, exportedElements, state, files, {
                exportBackground: state.exportBackground,
                viewBackgroundColor: state.viewBackgroundColor,
                exportingFrame,
              })
            : format === "excalidraw"
            ? new Blob(
                [serializeAsJSON(exportedElements, state, files, "local")],
                { type: MIME_TYPES.excalidraw },
              )
            : new Blob(
                [
                  exportProcessDiagramToMarkdown({
                    elements: exportedElements,
                    processName: name,
                  }),
                ],
                { type: MIME_TYPES.md },
              ),
      })),
    );
    const result = await publishExports(name, rendered, signal);
    return {
      destination: "server" as const,
      ...result,
      ...(result.exports.length === 1
        ? {
            url: result.exports[0].url,
            fileName: result.exports[0].fileName,
            format: result.exports[0].format,
          }
        : {}),
      elementCount: exportedElements.length,
      ...(formats.some((format) => format === "png" || format === "svg")
        ? {
            imageOptions: {
              background: state.exportBackground,
              darkMode: state.exportWithDarkMode,
              embedScene: state.exportEmbedScene,
              scale: state.exportScale,
              selectedOnly,
            },
          }
        : {}),
    };
  }
  let fileName = `${name}.${input.format}`;
  let elementCount = elements.filter((element) => !element.isDeleted).length;
  let imageOptions: ExportInput["imageOptions"];
  let savedName: string | undefined;
  if (input.format === "png" || input.format === "svg") {
    const opts = input.imageOptions ?? {};
    state.exportBackground = opts.background ?? state.exportBackground;
    state.exportWithDarkMode = opts.darkMode ?? state.exportWithDarkMode;
    state.exportEmbedScene = opts.embedScene ?? state.exportEmbedScene;
    state.exportScale = opts.scale ?? state.exportScale;
    const selectedOnly = opts.selectedOnly ?? false;
    if (
      selectedOnly &&
      !elements.some(
        (element) => !element.isDeleted && state.selectedElementIds[element.id],
      )
    ) {
      throw new Error("selectedOnly requires a current selection");
    }
    const { exportedElements, exportingFrame } = prepareElementsForExport(
      elements,
      state,
      selectedOnly,
    );
    elementCount = exportedElements.length;
    imageOptions = {
      background: state.exportBackground,
      darkMode: state.exportWithDarkMode,
      embedScene: state.exportEmbedScene,
      scale: state.exportScale as 1 | 2 | 3,
      selectedOnly,
    };
    fileName = `${name}.${state.exportEmbedScene ? "excalidraw." : ""}${
      input.format
    }`;
    const handle = await exportCanvas(
      input.destination === "save"
        ? input.format
        : input.format === "png"
        ? "clipboard"
        : "clipboard-svg",
      exportedElements,
      state,
      files,
      {
        exportBackground: state.exportBackground,
        viewBackgroundColor: state.viewBackgroundColor,
        name,
        exportingFrame,
      },
    );
    savedName = handle?.name;
  } else if (input.format === "excalidraw") {
    if (input.destination === "save") {
      savedName = (await saveAsJSON(elements, state, files, name)).fileHandle
        ?.name;
    } else {
      await copyTextToSystemClipboard(
        serializeAsJSON(elements, state, files, "local"),
      );
    }
  } else {
    const markdown = exportProcessDiagramToMarkdown({
      elements,
      processName: name,
    });
    if (input.destination === "save") {
      savedName = (
        await fileSave(new Blob([markdown], { type: MIME_TYPES.md }), {
          name,
          extension: "md",
          description: "Process Markdown",
          mimeTypes: [MIME_TYPES.md],
        })
      )?.name;
    } else {
      await copyTextToSystemClipboard(markdown);
    }
  }
  return {
    format: input.format,
    destination: input.destination,
    fileName: input.destination === "save" ? savedName ?? fileName : null,
    elementCount,
    ...(imageOptions ? { imageOptions } : {}),
  };
}
