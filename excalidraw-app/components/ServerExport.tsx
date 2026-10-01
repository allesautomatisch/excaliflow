import React, { useState } from "react";
import { prepareElementsForExport } from "@excalidraw/excalidraw/data";
import { cloneJSON } from "@excalidraw/common";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { copyTextToSystemClipboard } from "@excalidraw/excalidraw/clipboard";
import { copyIcon } from "@excalidraw/excalidraw/components/icons";

import { exportDrawing } from "../webmcp/export";

import type { ExportFormat, PublishedExport } from "../data/serverExports";

export function ServerExport({
  snapshot,
  selectedOnly,
}: {
  snapshot: Parameters<typeof exportDrawing>[1];
  selectedOnly: boolean;
}) {
  const [formats, setFormats] = useState<ExportFormat[]>(["png"]);
  const [exports, setExports] = useState<PublishedExport[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="server-export">
      <strong>Auf Server speichern</strong>
      <div className="server-export__formats">
        {(["png", "svg", "excalidraw", "md"] as ExportFormat[]).map(
          (format) => (
            <label key={format}>
              <input
                type="checkbox"
                checked={formats.includes(format)}
                disabled={busy}
                onChange={(event) => {
                  setExports([]);
                  setFormats((current) =>
                    event.target.checked
                      ? [...current, format]
                      : current.filter((item) => item !== format),
                  );
                }}
              />
              {format === "md"
                ? "Markdown"
                : format === "excalidraw"
                ? "Excalidraw"
                : format.toUpperCase()}
            </label>
          ),
        )}
      </div>
      <FilledButton
        label="Auf Server speichern"
        disabled={!formats.length || busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          setExports([]);
          try {
            const captured = cloneJSON({
              ...snapshot,
              state: { ...snapshot.state, fileHandle: null },
            });
            const hasImage = formats.some(
              (format) => format === "png" || format === "svg",
            );
            if (selectedOnly && !hasImage) {
              captured.elements = prepareElementsForExport(
                captured.elements,
                captured.state,
                true,
              ).exportedElements;
            }
            const result = await exportDrawing(
              {
                drawingSession: "manual",
                destination: "server",
                formats,
                name: captured.state.name || undefined,
                ...(hasImage ? { imageOptions: { selectedOnly } } : {}),
              },
              captured,
            );
            if ("exports" in result) {
              setExports(result.exports);
            }
          } catch (exception) {
            setError((exception as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {error && <div role="alert">{error}</div>}
      {exports.length > 0 && (
        <div className="server-export__links" aria-live="polite">
          {exports.map((file) => {
            const label =
              file.format === "md"
                ? "Markdown"
                : file.format === "excalidraw"
                ? "Excalidraw"
                : file.format.toUpperCase();
            return (
              <div key={file.format} className="server-export__link">
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  title={file.fileName}
                >
                  {label} öffnen
                </a>
                <button
                  type="button"
                  className="server-export__copy"
                  aria-label={`${label}-Link kopieren`}
                  title={`${label}-Link kopieren`}
                  onClick={async () => {
                    setError("");
                    try {
                      await copyTextToSystemClipboard(file.url);
                    } catch (exception) {
                      setError((exception as Error).message);
                    }
                  }}
                >
                  {copyIcon}
                </button>
              </div>
            );
          })}
          <FilledButton
            variant="outlined"
            label="Links kopieren"
            onClick={async () => {
              try {
                await copyTextToSystemClipboard(
                  exports.map((file) => file.url).join("\n"),
                );
              } catch (exception) {
                setError((exception as Error).message);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
