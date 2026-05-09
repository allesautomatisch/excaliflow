import { getBoundTextElement } from "./textElement";
import { getSwimlaneLaneCount } from "./swimlane";
import {
  getSwimlaneLabelLaneIndex,
  isSwimlaneLabelElement,
} from "./swimlaneLabels";
import {
  isArrowElement,
  isFlowchartNodeElement,
  isFrameElement,
  isSwimlaneElement,
  isTextElement,
} from "./typeChecks";

import type {
  ElementsMap,
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawFrameElement,
  ExcalidrawFlowchartNodeElement,
  ExcalidrawSwimlaneElement,
  ExcalidrawTextElement,
} from "./types";

type ProcessNode = {
  element: ExcalidrawFlowchartNodeElement;
  text: string;
};

type ProcessEdge = {
  element: ExcalidrawArrowElement;
  from: string;
  label: string | null;
  to: string;
};

type ProcessSection = {
  id: string;
  title: string;
};

type ProcessTextBlock = {
  element: ExcalidrawTextElement;
  text: string;
};

type OrderedProcessNodes = {
  flowStartNodeIds: Set<string>;
  orderedNodes: ProcessNode[];
};

const DEFAULT_PROCESS_NAME = "Unbenannt";
const DEFAULT_EDGE_LABEL = "weiter";
const DEFAULT_LAST_DECISION_EDGE_LABEL = "sonst";

const normalizeInlineText = (text: string) => text.replace(/\s+/g, " ").trim();

const normalizeBlockText = (text: string) =>
  text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const compareStrings = (first: string, second: string) =>
  first < second ? -1 : first > second ? 1 : 0;

const getExplicitNodeIdFromText = (text: string) => {
  const match = text.match(/^([A-Za-z][A-Za-z0-9]{0,2}|\d{1,3}):\s+(.+)$/);

  if (!match) {
    return null;
  }

  return {
    id: match[1],
    text: normalizeInlineText(match[2]),
  };
};

const getElementText = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
) => {
  const boundText = getBoundTextElement(element, elementsMap);

  return normalizeInlineText(boundText?.originalText || boundText?.text || "");
};

const compareElementsByPosition = (
  first: ExcalidrawElement,
  second: ExcalidrawElement,
) => {
  return (
    first.y - second.y ||
    first.x - second.x ||
    compareStrings(first.id, second.id)
  );
};

const compareNodesByPosition = (first: ProcessNode, second: ProcessNode) =>
  compareElementsByPosition(first.element, second.element);

const getOutgoingEdges = (edges: ProcessEdge[]) => {
  const outgoingEdges = new Map<string, ProcessEdge[]>();

  for (const edge of edges) {
    const outgoing = outgoingEdges.get(edge.from) ?? [];
    outgoing.push(edge);
    outgoingEdges.set(edge.from, outgoing);
  }

  return outgoingEdges;
};

const getComponentStartNodes = (nodes: ProcessNode[], edges: ProcessEdge[]) => {
  const componentNodeIds = new Set(nodes.map((node) => node.element.id));
  const incomingCount = new Map(nodes.map((node) => [node.element.id, 0]));

  for (const edge of edges) {
    if (componentNodeIds.has(edge.from) && componentNodeIds.has(edge.to)) {
      incomingCount.set(edge.to, (incomingCount.get(edge.to) ?? 0) + 1);
    }
  }

  return nodes
    .filter((node) => incomingCount.get(node.element.id) === 0)
    .sort(compareNodesByPosition);
};

const getConnectedNodeComponents = (
  nodes: ProcessNode[],
  edges: ProcessEdge[],
) => {
  const nodeById = new Map(nodes.map((node) => [node.element.id, node]));
  const neighborsByNodeId = new Map<string, Set<string>>(
    nodes.map((node) => [node.element.id, new Set<string>()]),
  );

  for (const edge of edges) {
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) {
      continue;
    }

    neighborsByNodeId.get(edge.from)?.add(edge.to);
    neighborsByNodeId.get(edge.to)?.add(edge.from);
  }

  const sortedNodes = [...nodes].sort(compareNodesByPosition);
  const visited = new Set<string>();
  const components: ProcessNode[][] = [];

  for (const node of sortedNodes) {
    if (visited.has(node.element.id)) {
      continue;
    }

    const component: ProcessNode[] = [];
    const queue = [node];
    visited.add(node.element.id);

    while (queue.length > 0) {
      const nextNode = queue.shift()!;
      component.push(nextNode);

      const neighbors = [...(neighborsByNodeId.get(nextNode.element.id) ?? [])]
        .map((nodeId) => nodeById.get(nodeId))
        .filter((neighbor): neighbor is ProcessNode => !!neighbor)
        .sort(compareNodesByPosition);

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.element.id)) {
          visited.add(neighbor.element.id);
          queue.push(neighbor);
        }
      }
    }

    components.push(component.sort(compareNodesByPosition));
  }

  return components;
};

const getOrderedComponentNodes = (
  nodes: ProcessNode[],
  startNodes: ProcessNode[],
  outgoingEdges: Map<string, ProcessEdge[]>,
  nodeById: Map<string, ProcessNode>,
) => {
  const componentNodeIds = new Set(nodes.map((node) => node.element.id));
  const sortedNodes = [...nodes].sort(compareNodesByPosition);
  const roots = startNodes.length > 0 ? startNodes : sortedNodes.slice(0, 1);
  const visited = new Set<string>();
  const orderedNodes: ProcessNode[] = [];

  const traverseFrom = (root: ProcessNode) => {
    const queued = new Set<string>();
    const queue = [root];
    queued.add(root.element.id);

    while (queue.length > 0) {
      const nextNode = queue.shift()!;

      if (visited.has(nextNode.element.id)) {
        continue;
      }

      visited.add(nextNode.element.id);
      orderedNodes.push(nextNode);

      const successors = (outgoingEdges.get(nextNode.element.id) ?? [])
        .map((edge) => nodeById.get(edge.to))
        .filter(
          (successor): successor is ProcessNode =>
            !!successor && componentNodeIds.has(successor.element.id),
        )
        .sort(compareNodesByPosition);

      for (const successor of successors) {
        if (
          !visited.has(successor.element.id) &&
          !queued.has(successor.element.id)
        ) {
          queued.add(successor.element.id);
          queue.push(successor);
        }
      }
    }
  };

  for (const root of roots) {
    traverseFrom(root);
  }

  while (orderedNodes.length < nodes.length) {
    const nextUnvisited = sortedNodes.find(
      (node) => !visited.has(node.element.id),
    );

    if (!nextUnvisited) {
      break;
    }

    traverseFrom(nextUnvisited);
  }

  return orderedNodes;
};

const getOrderedNodes = (
  nodes: ProcessNode[],
  edges: ProcessEdge[],
): OrderedProcessNodes => {
  const nodeById = new Map(nodes.map((node) => [node.element.id, node]));
  const outgoingEdges = getOutgoingEdges(edges);
  const components = getConnectedNodeComponents(nodes, edges)
    .map((nodes) => ({
      nodes,
      startNodes: getComponentStartNodes(nodes, edges),
    }))
    .sort((first, second) =>
      compareNodesByPosition(
        first.startNodes[0] ?? first.nodes[0],
        second.startNodes[0] ?? second.nodes[0],
      ),
    );
  const orderedNodes: ProcessNode[] = [];
  const flowStartNodeIds = new Set<string>();

  for (const component of components) {
    const orderedComponentNodes = getOrderedComponentNodes(
      component.nodes,
      component.startNodes,
      outgoingEdges,
      nodeById,
    );

    if (orderedComponentNodes[0]) {
      flowStartNodeIds.add(orderedComponentNodes[0].element.id);
    }

    orderedNodes.push(...orderedComponentNodes);
  }

  return {
    flowStartNodeIds,
    orderedNodes,
  };
};

const getSortedOutgoingEdges = (
  edges: ProcessEdge[],
  nodeByElementId: Map<string, ProcessNode>,
) => {
  return [...edges].sort((first, second) => {
    const firstTarget = nodeByElementId.get(first.to);
    const secondTarget = nodeByElementId.get(second.to);

    return (
      compareStrings(
        first.label ?? DEFAULT_EDGE_LABEL,
        second.label ?? DEFAULT_EDGE_LABEL,
      ) ||
      (firstTarget && secondTarget
        ? compareElementsByPosition(firstTarget.element, secondTarget.element)
        : 0) ||
      compareElementsByPosition(first.element, second.element)
    );
  });
};

const getEdgeLabel = (
  edge: ProcessEdge,
  edgeIndex: number,
  lastUnlabeledDecisionEdgeIndex: number,
) => {
  if (edge.label) {
    return edge.label;
  }

  if (edgeIndex === lastUnlabeledDecisionEdgeIndex) {
    return DEFAULT_LAST_DECISION_EDGE_LABEL;
  }

  return DEFAULT_EDGE_LABEL;
};

const getFrameSection = (frame: ExcalidrawFrameElement): ProcessSection => ({
  id: frame.id,
  title: normalizeInlineText(frame.name || "") || frame.id,
});

const getUnrotatedElementCenterX = (
  element: ExcalidrawElement,
  frame: ExcalidrawElement,
) => {
  const elementCenter = {
    x: element.x + element.width / 2,
    y: element.y + element.height / 2,
  };
  const frameCenter = {
    x: frame.x + frame.width / 2,
    y: frame.y + frame.height / 2,
  };
  const angle = -(frame.angle || 0);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = elementCenter.x - frameCenter.x;
  const dy = elementCenter.y - frameCenter.y;

  return frameCenter.x + dx * cos - dy * sin;
};

const getSwimlaneNodeLaneIndex = (
  node: ProcessNode,
  swimlane: ExcalidrawSwimlaneElement,
) => {
  const laneCount = getSwimlaneLaneCount(swimlane);

  if (swimlane.width <= 0 || laneCount <= 1) {
    return 0;
  }

  const laneWidth = swimlane.width / laneCount;
  const centerX = getUnrotatedElementCenterX(node.element, swimlane);
  const relativeX = Math.min(
    Math.max(centerX - swimlane.x, 0),
    Math.max(swimlane.width - Number.EPSILON, 0),
  );

  return Math.min(laneCount - 1, Math.floor(relativeX / laneWidth));
};

const getSwimlaneLabelTitles = (elements: readonly ExcalidrawElement[]) => {
  const titles = new Map<string, Map<number, string>>();

  for (const element of elements) {
    if (!isSwimlaneLabelElement(element) || !element.frameId) {
      continue;
    }

    const laneIndex = getSwimlaneLabelLaneIndex(element);
    const title = normalizeInlineText(
      element.originalText || element.text || "",
    );

    if (laneIndex === null || !title) {
      continue;
    }

    const swimlaneTitles = titles.get(element.frameId) ?? new Map();

    if (!swimlaneTitles.has(laneIndex)) {
      swimlaneTitles.set(laneIndex, title);
    }

    titles.set(element.frameId, swimlaneTitles);
  }

  return titles;
};

const isGeneratedProcessMarkdownText = (text: string) =>
  /^# Prozess:\s/.test(text);

const getFreeTextBlocks = (elements: readonly ExcalidrawElement[]) => {
  return elements
    .filter(
      (element): element is ExcalidrawTextElement =>
        isTextElement(element) &&
        !element.containerId &&
        !isSwimlaneLabelElement(element),
    )
    .map((element) => ({
      element,
      text: normalizeBlockText(element.originalText || element.text || ""),
    }))
    .filter(
      (textBlock) =>
        textBlock.text && !isGeneratedProcessMarkdownText(textBlock.text),
    )
    .sort((first, second) =>
      compareElementsByPosition(first.element, second.element),
    );
};

const getSwimlaneSection = (
  node: ProcessNode,
  swimlane: ExcalidrawSwimlaneElement,
  swimlaneLabelTitles: Map<string, Map<number, string>>,
): ProcessSection => {
  const laneIndex = getSwimlaneNodeLaneIndex(node, swimlane);
  const title =
    swimlaneLabelTitles.get(swimlane.id)?.get(laneIndex) ??
    `Lane ${laneIndex + 1}`;

  return {
    id: `${swimlane.id}:${laneIndex}`,
    title,
  };
};

const getNodeSection = (
  node: ProcessNode,
  elementsMap: ElementsMap,
  swimlaneLabelTitles: Map<string, Map<number, string>>,
): ProcessSection | null => {
  if (!node.element.frameId) {
    return null;
  }

  const frame = elementsMap.get(node.element.frameId) ?? null;

  if (isFrameElement(frame)) {
    return getFrameSection(frame);
  }

  if (isSwimlaneElement(frame)) {
    return getSwimlaneSection(node, frame, swimlaneLabelTitles);
  }

  return null;
};

const ensureBlankLine = (lines: string[]) => {
  if (lines[lines.length - 1] !== "") {
    lines.push("");
  }
};

const emitTextBlock = (lines: string[], textBlock: ProcessTextBlock) => {
  ensureBlankLine(lines);
  lines.push(...textBlock.text.split("\n"));
};

export const exportProcessDiagramToMarkdown = ({
  elements,
  processName,
}: {
  elements: readonly ExcalidrawElement[];
  processName?: string | null;
}) => {
  const nonDeletedElements = elements.filter((element) => !element.isDeleted);
  const elementsMap: ElementsMap = new Map(
    nonDeletedElements.map((element) => [element.id, element]),
  );

  const nodes = nonDeletedElements
    .filter(isFlowchartNodeElement)
    .map((node) => {
      const originalText = getElementText(node, elementsMap);
      const textNodeId = getExplicitNodeIdFromText(originalText);

      return {
        element: node,
        text: textNodeId?.text ?? originalText,
      };
    });

  const nodeElementIds = new Set(nodes.map((node) => node.element.id));

  const edges = nonDeletedElements.reduce<ProcessEdge[]>((acc, element) => {
    if (
      !isArrowElement(element) ||
      !element.startBinding ||
      !element.endBinding ||
      !nodeElementIds.has(element.startBinding.elementId) ||
      !nodeElementIds.has(element.endBinding.elementId)
    ) {
      return acc;
    }

    acc.push({
      element,
      from: element.startBinding.elementId,
      label: getElementText(element, elementsMap) || null,
      to: element.endBinding.elementId,
    });

    return acc;
  }, []);

  const { flowStartNodeIds, orderedNodes } = getOrderedNodes(nodes, edges);
  const nodeByElementId = new Map(
    orderedNodes.map((node) => [node.element.id, node]),
  );
  const outgoingEdges = getOutgoingEdges(edges);
  const swimlaneLabelTitles = getSwimlaneLabelTitles(nonDeletedElements);
  const freeTextBlocks = getFreeTextBlocks(nonDeletedElements);
  const emittedSectionIds = new Set<string>();
  let nextTextBlockIndex = 0;

  const lines = [
    `# Prozess: ${
      normalizeInlineText(processName || "") || DEFAULT_PROCESS_NAME
    }`,
    "",
  ];

  for (const node of orderedNodes) {
    const section = getNodeSection(node, elementsMap, swimlaneLabelTitles);
    const shouldEmitSection = section && !emittedSectionIds.has(section.id);

    if (flowStartNodeIds.has(node.element.id)) {
      while (
        nextTextBlockIndex < freeTextBlocks.length &&
        compareElementsByPosition(
          freeTextBlocks[nextTextBlockIndex].element,
          node.element,
        ) <= 0
      ) {
        emitTextBlock(lines, freeTextBlocks[nextTextBlockIndex]);
        nextTextBlockIndex++;
      }
    }

    if (flowStartNodeIds.has(node.element.id) || shouldEmitSection) {
      ensureBlankLine(lines);
    }

    if (section && shouldEmitSection) {
      lines.push(`# ${section.title}`);
      emittedSectionIds.add(section.id);
    }

    const outgoing = getSortedOutgoingEdges(
      outgoingEdges.get(node.element.id) ?? [],
      nodeByElementId,
    );

    if (outgoing.length === 0) {
      lines.push(`- ${node.text}`);
    } else if (outgoing.length === 1) {
      lines.push(`- ${node.text}`);
    } else {
      lines.push(`- ${node.text}`);
      let lastUnlabeledDecisionEdgeIndex = -1;

      if (node.element.type === "diamond") {
        for (let edgeIndex = outgoing.length - 1; edgeIndex >= 0; edgeIndex--) {
          if (!outgoing[edgeIndex].label) {
            lastUnlabeledDecisionEdgeIndex = edgeIndex;
            break;
          }
        }
      }

      for (const [edgeIndex, edge] of outgoing.entries()) {
        const targetNode = nodeByElementId.get(edge.to);

        lines.push(
          `  - ${getEdgeLabel(
            edge,
            edgeIndex,
            lastUnlabeledDecisionEdgeIndex,
          )}: weiter mit "${targetNode?.text ?? ""}"`,
        );
      }
    }
  }

  while (nextTextBlockIndex < freeTextBlocks.length) {
    emitTextBlock(lines, freeTextBlocks[nextTextBlockIndex]);
    nextTextBlockIndex++;
  }

  return lines.join("\n");
};
