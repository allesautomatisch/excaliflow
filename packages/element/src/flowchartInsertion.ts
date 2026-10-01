// Shared with the existing arrow + insertion UI. Follow outgoing edges only
// beyond the source/target axis threshold; move their labels and reroute bindings.
import type { AppState } from "@excalidraw/excalidraw/types";

import { updateBoundElements } from "./binding";
import { updateElbowArrowPoints } from "./elbowArrow";
import { getBoundTextElement, getContainerCenter } from "./textElement";
import {
  isArrowElement,
  isElbowArrow,
  isFlowchartNodeElement,
} from "./typeChecks";

import type { Scene } from "./Scene";
import type { ExcalidrawFlowchartNodeElement, NonDeleted } from "./types";

export const moveFlowchartFollowingNodes = (
  scene: Scene,
  state: AppState,
  startNode: NonDeleted<ExcalidrawFlowchartNodeElement>,
  shift: { x: number; y: number },
  direction: "up" | "right" | "down" | "left",
  sourceCenter: { x: number; y: number },
  targetCenter: { x: number; y: number },
) => {
  const shouldMove = (node: ExcalidrawFlowchartNodeElement) => {
    const center = getContainerCenter(
      node,
      state,
      scene.getNonDeletedElementsMap(),
    );
    if (!center) {
      return false;
    }
    switch (direction) {
      case "left":
        return center.x <= Math.min(sourceCenter.x, targetCenter.x);
      case "right":
        return center.x >= Math.max(sourceCenter.x, targetCenter.x);
      case "up":
        return center.y <= Math.min(sourceCenter.y, targetCenter.y);
      case "down":
        return center.y >= Math.max(sourceCenter.y, targetCenter.y);
    }
  };
  const elements = scene.getNonDeletedElements();
  const elementsMap = scene.getNonDeletedElementsMap();
  const queue = [startNode];
  const visited = new Set<string>([startNode.id]);
  const nodesToMove: NonDeleted<ExcalidrawFlowchartNodeElement>[] = [];

  while (queue.length > 0) {
    const currentNode = queue.shift();
    if (!currentNode) {
      continue;
    }

    nodesToMove.push(currentNode);

    for (const element of elements) {
      if (!isArrowElement(element)) {
        continue;
      }

      if (!element.startBinding) {
        continue;
      }

      const nextNode =
        element.endBinding && elementsMap.get(element.endBinding.elementId);
      if (!nextNode) {
        continue;
      }

      if (
        isFlowchartNodeElement(nextNode) &&
        currentNode.id === element.startBinding.elementId &&
        shouldMove(nextNode) &&
        !visited.has(nextNode.id)
      ) {
        visited.add(nextNode.id);
        queue.push(nextNode);
      }
    }
  }

  const movedNodeIds = new Set(nodesToMove.map((node) => node.id));

  elements.forEach((element) => {
    if (
      !isElbowArrow(element) ||
      !element.startBinding ||
      !element.endBinding ||
      !movedNodeIds.has(element.startBinding.elementId) ||
      !movedNodeIds.has(element.endBinding.elementId)
    ) {
      return;
    }

    scene.mutateElement(element, {
      x: element.x + shift.x,
      y: element.y + shift.y,
    });

    const boundTextElement = getBoundTextElement(element, elementsMap);
    if (boundTextElement) {
      scene.mutateElement(boundTextElement, {
        x: boundTextElement.x + shift.x,
        y: boundTextElement.y + shift.y,
      });
    }
  });

  nodesToMove.forEach((node) => {
    scene.mutateElement(node, {
      x: node.x + shift.x,
      y: node.y + shift.y,
    });

    const boundTextElement = getBoundTextElement(node, elementsMap);
    if (boundTextElement) {
      scene.mutateElement(boundTextElement, {
        x: boundTextElement.x + shift.x,
        y: boundTextElement.y + shift.y,
      });
    }

    updateBoundElements(node, scene);
  });

  const updatedElementsMap = scene.getNonDeletedElementsMap();
  elements.forEach((element) => {
    if (
      !isElbowArrow(element) ||
      (!movedNodeIds.has(element.startBinding?.elementId ?? "") &&
        !movedNodeIds.has(element.endBinding?.elementId ?? ""))
    ) {
      return;
    }

    const updatedPoints = updateElbowArrowPoints(element, updatedElementsMap, {
      points: element.points,
    });
    scene.mutateElement(element, updatedPoints);
  });

  return movedNodeIds;
};
