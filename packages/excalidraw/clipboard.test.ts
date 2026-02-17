import {
  createPasteEvent,
  parseClipboard,
  parseDataTransferEvent,
  serializeAsClipboardJSON,
} from "./clipboard";
import { API } from "./tests/helpers/api";
import { MIME_TYPES } from "@excalidraw/common";

describe("parseClipboard()", () => {
  it("should parse JSON as plaintext if not excalidraw-api/clipboard data", async () => {
    let text;
    let clipboardData;
    // -------------------------------------------------------------------------

    text = "123";
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({ types: { "text/plain": text } }),
      ),
    );
    expect(clipboardData.text).toBe(text);

    // -------------------------------------------------------------------------

    text = "[123]";
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({ types: { "text/plain": text } }),
      ),
    );
    expect(clipboardData.text).toBe(text);

    // -------------------------------------------------------------------------

    text = JSON.stringify({ val: 42 });
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({ types: { "text/plain": text } }),
      ),
    );
    expect(clipboardData.text).toBe(text);
  });

  it("should parse valid excalidraw JSON if inside text/plain", async () => {
    const rect = API.createElement({ type: "rectangle" });

    const json = serializeAsClipboardJSON({ elements: [rect], files: null });
    const clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/plain": json,
          },
        }),
      ),
    );
    expect(clipboardData.elements).toEqual([rect]);
  });

  it("should parse valid excalidraw JSON from excalidraw mime type", async () => {
    const payload = {
      type: "excalidraw/clipboard",
      elements: [
        {
          id: "Xxk1Gb9I0OvehdjGzC_WB",
          type: "capsule",
          x: 1340,
          y: 240,
          width: 320,
          height: 200,
          angle: 0,
          strokeColor: "#1e1e1e",
          backgroundColor: "#ffc9c9",
          fillStyle: "solid",
          strokeWidth: 2,
          strokeStyle: "solid",
          roughness: 0,
          opacity: 100,
          groupIds: [],
          frameId: null,
          index: "b0L",
          roundness: null,
          seed: 1671086815,
          version: 6,
          versionNonce: 295474367,
          isDeleted: false,
          boundElements: [{ type: "text", id: "l8FCZrILlDFQSxZfr2gXk" }],
          updated: 1771339909971,
          link: null,
          locked: false,
        },
        {
          id: "l8FCZrILlDFQSxZfr2gXk",
          type: "text",
          x: 1467,
          y: 327.5,
          width: 66,
          height: 25,
          angle: 0,
          strokeColor: "#1e1e1e",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 2,
          strokeStyle: "solid",
          roughness: 0,
          opacity: 100,
          groupIds: [],
          frameId: null,
          index: "b0M",
          roundness: null,
          seed: 885193777,
          version: 9,
          versionNonce: 2009703647,
          isDeleted: false,
          boundElements: null,
          updated: 1771339909971,
          link: null,
          locked: false,
          text: "asdasd",
          fontSize: 20,
          fontFamily: 8,
          textAlign: "center",
          verticalAlign: "middle",
          containerId: "Xxk1Gb9I0OvehdjGzC_WB",
          originalText: "asdasd",
          autoResize: true,
          lineHeight: 1.25,
        },
      ],
      files: {},
    };

    const clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            [MIME_TYPES.excalidrawClipboard]: JSON.stringify(payload),
          },
        }),
      ),
    );
    expect(clipboardData.elements).toEqual(payload.elements);
  });

  it("should parse valid excalidraw JSON if inside text/html", async () => {
    const rect = API.createElement({ type: "rectangle" });

    let json;
    let clipboardData;
    // -------------------------------------------------------------------------
    json = serializeAsClipboardJSON({ elements: [rect], files: null });
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/html": json,
          },
        }),
      ),
    );
    expect(clipboardData.elements).toEqual([rect]);
    // -------------------------------------------------------------------------
    json = serializeAsClipboardJSON({ elements: [rect], files: null });
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/html": `<div> ${json}</div>`,
          },
        }),
      ),
    );
    expect(clipboardData.elements).toEqual([rect]);
    // -------------------------------------------------------------------------
  });

  it("should parse <image> `src` urls out of text/html", async () => {
    let clipboardData;
    // -------------------------------------------------------------------------
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/html": `<img src="https://example.com/image.png" />`,
          },
        }),
      ),
    );
    expect(clipboardData.mixedContent).toEqual([
      {
        type: "imageUrl",
        value: "https://example.com/image.png",
      },
    ]);
    // -------------------------------------------------------------------------
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/html": `<div><img src="https://example.com/image.png" /></div><a><img src="https://example.com/image2.png" /></a>`,
          },
        }),
      ),
    );
    expect(clipboardData.mixedContent).toEqual([
      {
        type: "imageUrl",
        value: "https://example.com/image.png",
      },
      {
        type: "imageUrl",
        value: "https://example.com/image2.png",
      },
    ]);
  });

  it("should parse text content alongside <image> `src` urls out of text/html", async () => {
    const clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/html": `<a href="https://example.com">hello </a><div><img src="https://example.com/image.png" /></div><b>my friend!</b>`,
          },
        }),
      ),
    );
    expect(clipboardData.mixedContent).toEqual([
      {
        type: "text",
        // trimmed
        value: "hello",
      },
      {
        type: "imageUrl",
        value: "https://example.com/image.png",
      },
      {
        type: "text",
        value: "my friend!",
      },
    ]);
  });

  it("should parse spreadsheet from either text/plain and text/html", async () => {
    let clipboardData;
    // -------------------------------------------------------------------------
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/plain": `a	b
            1	2
            4	5
            7	10`,
          },
        }),
      ),
    );
    expect(clipboardData.spreadsheet).toEqual({
      title: "b",
      labels: ["1", "4", "7"],
      values: [2, 5, 10],
    });
    // -------------------------------------------------------------------------
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/html": `a	b
            1	2
            4	5
            7	10`,
          },
        }),
      ),
    );
    expect(clipboardData.spreadsheet).toEqual({
      title: "b",
      labels: ["1", "4", "7"],
      values: [2, 5, 10],
    });
    // -------------------------------------------------------------------------
    clipboardData = await parseClipboard(
      await parseDataTransferEvent(
        createPasteEvent({
          types: {
            "text/html": `<html>
            <body>
            <!--StartFragment--><google-sheets-html-origin><style type="text/css"><!--td {border: 1px solid #cccccc;}br {mso-data-placement:same-cell;}--></style><table xmlns="http://www.w3.org/1999/xhtml" cellspacing="0" cellpadding="0" dir="ltr" border="1" style="table-layout:fixed;font-size:10pt;font-family:Arial;width:0px;border-collapse:collapse;border:none"><colgroup><col width="100"/><col width="100"/></colgroup><tbody><tr style="height:21px;"><td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;" data-sheets-value="{&quot;1&quot;:2,&quot;2&quot;:&quot;a&quot;}">a</td><td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;" data-sheets-value="{&quot;1&quot;:2,&quot;2&quot;:&quot;b&quot;}">b</td></tr><tr style="height:21px;"><td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;text-align:right;" data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:1}">1</td><td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;text-align:right;" data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:2}">2</td></tr><tr style="height:21px;"><td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;text-align:right;" data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:4}">4</td><td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;text-align:right;" data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:5}">5</td></tr><tr style="height:21px;"><td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;text-align:right;" data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:7}">7</td><td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;text-align:right;" data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:10}">10</td></tr></tbody></table><!--EndFragment-->
            </body>
            </html>`,
            "text/plain": `a	b
            1	2
            4	5
            7	10`,
          },
        }),
      ),
    );
    expect(clipboardData.spreadsheet).toEqual({
      title: "b",
      labels: ["1", "4", "7"],
      values: [2, 5, 10],
    });
  });
});
