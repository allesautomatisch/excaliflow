import type { ExcalidrawElement } from "./types";

export type FlowchartNodeIconKey = "none" | "automatic" | "mail" | "user";

type FlowchartNodeIconPath = {
  d: string;
  fill?: string;
  fillRule?: string;
  clipRule?: string;
  stroke?: string;
  strokeWidth?: string;
  strokeLinecap?: string;
  strokeLinejoin?: string;
};

type FlowchartNodeIconOption = {
  key: FlowchartNodeIconKey;
  svg: string;
  paths: readonly FlowchartNodeIconPath[];
  svgPath: string;
};

const getAttribute = (svgAttributes: string, name: string) => {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `\\b${escapedName}\\s*=\\s*(\"|')(.*?)\\1`,
    "i",
  );
  const match = regex.exec(svgAttributes);

  return match?.[2] ?? null;
};

const getPathsFromSVG = (svg: string) => {
  const svgMatch = /<svg\b([^>]*)>/i.exec(svg);
  const svgAttributes = svgMatch?.[1] ?? "";
  const defaultStroke = getAttribute(svgAttributes, "stroke");
  const defaultStrokeWidth = getAttribute(svgAttributes, "stroke-width");
  const defaultStrokeLinecap = getAttribute(
    svgAttributes,
    "stroke-linecap",
  );
  const defaultStrokeLinejoin = getAttribute(
    svgAttributes,
    "stroke-linejoin",
  );
  const defaultFill = getAttribute(svgAttributes, "fill");
  const defaultFillRule = getAttribute(svgAttributes, "fill-rule");
  const defaultClipRule = getAttribute(svgAttributes, "clip-rule");
  const pathRegex = /<path\b([^>]*)\/?>/g;
  const paths: FlowchartNodeIconPath[] = [];
  let match: RegExpExecArray | null;

  while ((match = pathRegex.exec(svg)) !== null) {
    const attributes = match[1];
    const d = getAttribute(attributes, "d");

    if (!d) {
      continue;
    }

    paths.push({
      d,
      fill: getAttribute(attributes, "fill") ?? defaultFill ?? undefined,
      fillRule:
        getAttribute(attributes, "fill-rule") ??
        defaultFillRule ??
        undefined,
      clipRule:
        getAttribute(attributes, "clip-rule") ??
        defaultClipRule ??
        undefined,
      stroke: getAttribute(attributes, "stroke") ?? defaultStroke ?? undefined,
      strokeWidth:
        getAttribute(attributes, "stroke-width") ??
        defaultStrokeWidth ??
        undefined,
      strokeLinecap:
        getAttribute(attributes, "stroke-linecap") ??
        defaultStrokeLinecap ??
        undefined,
      strokeLinejoin:
        getAttribute(attributes, "stroke-linejoin") ??
        defaultStrokeLinejoin ??
        undefined,
    });
  }

  return paths;
};

const AUTOMATIC_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" >
  <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
</svg>`;

const MAIL_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
</svg>`;

const USER_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
</svg>`;

const automaticIconPaths = getPathsFromSVG(AUTOMATIC_ICON_SVG);
const mailIconPaths = getPathsFromSVG(MAIL_ICON_SVG);
const userIconPaths = getPathsFromSVG(USER_ICON_SVG);

export const FLOWCHART_NODE_ICON_CUSTOM_DATA_KEY = "flowchartNodeIcon";

export const DEFAULT_FLOWCHART_NODE_ICON_KEY: FlowchartNodeIconKey = "none";

export const FLOWCHART_NODE_ICON_OPTIONS = [
  {
    key: "none",
    svg: "",
    paths: [],
    svgPath: "",
  },
  {
    key: "automatic",
    svg: AUTOMATIC_ICON_SVG,
    paths: automaticIconPaths,
    svgPath: automaticIconPaths.map((path) => path.d).join(" "),
  },
  {
    key: "mail",
    svg: MAIL_ICON_SVG,
    paths: mailIconPaths,
    svgPath: mailIconPaths.map((path) => path.d).join(" "),
  },
  {
    key: "user",
    svg: USER_ICON_SVG,
    paths: userIconPaths,
    svgPath: userIconPaths.map((path) => path.d).join(" "),
  },
] as const satisfies readonly FlowchartNodeIconOption[];

const flowchartNodeIconByKey = new Map(
  FLOWCHART_NODE_ICON_OPTIONS.map((icon) => [icon.key, icon]),
);

const isFlowchartNodeIconKey = (value: unknown): value is FlowchartNodeIconKey =>
  value === "none" || value === "automatic" || value === "mail" || value === "user";

export const getFlowchartNodeIcon = (key: FlowchartNodeIconKey) =>
  flowchartNodeIconByKey.get(key);

export const getFlowchartNodeIconKey = (
  element: Pick<ExcalidrawElement, "customData">,
): FlowchartNodeIconKey => {
  const rawValue =
    element.customData?.[FLOWCHART_NODE_ICON_CUSTOM_DATA_KEY] ??
    DEFAULT_FLOWCHART_NODE_ICON_KEY;

  return isFlowchartNodeIconKey(rawValue)
    ? rawValue
    : DEFAULT_FLOWCHART_NODE_ICON_KEY;
};

export const FLOWCHART_NODE_ICON_VIEWBOX = 24;
export const FLOWCHART_NODE_ICON_SIZE = 32;
export const FLOWCHART_NODE_ICON_MARGIN = 6;
