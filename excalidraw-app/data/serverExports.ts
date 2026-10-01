export type ExportFormat = "png" | "svg" | "excalidraw" | "md";
export type PublishedExport = {
  format: ExportFormat;
  fileName: string;
  url: string;
  sizeBytes: number;
};
export type PublishedExports = { uuid: string; exports: PublishedExport[] };

// Same-origin routes are proxied to the Flow Laravel backend in development
// and by the Flow host in production. No drawing encryption applies to exports.
export async function publishExports(
  name: string,
  files: { format: ExportFormat; blob: Blob }[],
  signal?: AbortSignal,
): Promise<PublishedExports> {
  const body = new FormData();
  body.set("name", name);
  for (const file of files) {
    body.set(`files[${file.format}]`, file.blob, `export.${file.format}`);
  }
  const response = await fetch("/api/v2/exports", {
    method: "POST",
    headers: { Accept: "application/json" },
    body,
    signal,
  });
  if (!response.ok) {
    throw new Error(`Server export failed (HTTP ${response.status})`);
  }
  const result = (await response.json()) as PublishedExports;
  if (
    !result.uuid ||
    result.exports?.length !== files.length ||
    !files.every((file) =>
      result.exports.some(
        (item) =>
          item.format === file.format && /^\/exports\/[^/]+$/.test(item.url),
      ),
    )
  ) {
    throw new Error("Invalid server export response");
  }
  return {
    ...result,
    exports: result.exports.map((file) => ({
      ...file,
      url: new URL(file.url, window.location.origin).href,
    })),
  };
}
