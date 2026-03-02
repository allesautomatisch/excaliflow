import { clamp } from "@excalidraw/math";
import { THEME } from "@excalidraw/common";

import {
  LinearElementEditor,
  elementCenterPoint,
  getBoundTextElement,
  isArrowElement,
  isFlowchartNodeElement,
} from "@excalidraw/element";

import { fillCircle } from "./helpers";

import type {
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";
import type { InteractiveCanvasAppState } from "../types";
import type { FlowModeAnimationState } from "../scene/types";

type FlowParticle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  currentNodeId: string | null;
  targetNodeId: string | null;
  targetX: number;
  targetY: number;
  nextNodeChoiceSeed: number;
  maxSpeed: number;
  waypoints: {
    x: number;
    y: number;
  }[];
};

type FlowNodeInfo = {
  x: number;
  y: number;
  spawnRadiusX: number;
  spawnRadiusY: number;
  targetRadius: number;
};

type FlowTopology = {
  startNodeIds: string[];
  nodePositions: Map<string, FlowNodeInfo>;
  outgoingByNodeId: Map<
    string,
    {
      targetNodeId: string;
      waypoints: {
        x: number;
        y: number;
      }[];
      pathChancePercent: number;
    }[]
  >;
  diamondNodeCount: number;
  version: string;
};

const FLOW_PARTICLE_RADIUS = 4.2;
const FLOW_PARTICLE_BASE_SPEED = 190;
const FLOW_PARTICLE_MAX_SPEED = 280;
const FLOW_FLOW_FORCE = 1680;
const FLOW_ARRIVAL_DISTANCE = 44;
const FLOW_SPAWN_INTERVAL_MS = 212;
const FLOW_MIN_SPAWN_RADIUS = 4;
const FLOW_PARTICLE_MAX_SPEED_VARIATION = 0.2;
const FLOW_TARGET_TURN_STRENGTH = 0.28;
const FLOW_TARGET_RANDOM_RADIUS_FACTOR = 0.45;
const FLOW_DIAMOND_SPAWN_RATE_INCREMENT = 0.75;
const FLOW_MAX_DIAMOND_SPAWN_MULTIPLIER = 6;
const FLOW_PATH_PERCENTAGE_NORMALIZATION_TARGET = 100;
const FLOW_PERCENTAGE_REGEX = /(-?\d+(?:\.\d+)?)\s*%/;

type FlowTopologyEdge = {
  targetNodeId: string;
  waypoints: {
    x: number;
    y: number;
  }[];
  explicitPathChancePercent: number | null;
};

type FlowTopologyResolvedEdge = {
  targetNodeId: string;
  waypoints: {
    x: number;
    y: number;
  }[];
  pathChancePercent: number;
};

const getArrowPathPercentage = (
  arrow: Parameters<typeof getBoundTextElement>[0],
  allElementsMap: NonDeletedSceneElementsMap,
) => {
  const boundTextElement = getBoundTextElement(arrow, allElementsMap);
  if (!boundTextElement?.text) {
    return null;
  }

  const percentageMatch = boundTextElement.text.match(FLOW_PERCENTAGE_REGEX);
  if (!percentageMatch?.[1]) {
    return null;
  }

  const parsed = Number(percentageMatch[1]);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return clamp(parsed, 0, FLOW_PATH_PERCENTAGE_NORMALIZATION_TARGET);
};

const normalizePathProbabilities = (
  edges: FlowTopologyEdge[],
): FlowTopologyResolvedEdge[] => {
  if (edges.length === 0) {
    return [];
  }

  const labeledEdgeCount = edges.filter(
    (edge) => edge.explicitPathChancePercent !== null,
  ).length;
  const unlabeledEdgeCount = edges.length - labeledEdgeCount;
  const labeledWeight = edges.reduce(
    (sum, edge) => sum + (edge.explicitPathChancePercent || 0),
    0,
  );
  const remainingWeight =
    FLOW_PATH_PERCENTAGE_NORMALIZATION_TARGET - labeledWeight;
  const remainingWeightPerUnlabeledEdge =
    unlabeledEdgeCount > 0 ? remainingWeight / unlabeledEdgeCount : 0;

  const edgesWithBaseWeights = edges.map((edge) => ({
    targetNodeId: edge.targetNodeId,
    waypoints: edge.waypoints,
    pathChancePercent:
      edge.explicitPathChancePercent === null
        ? remainingWeightPerUnlabeledEdge
        : edge.explicitPathChancePercent,
  }));

  const totalWeight = edgesWithBaseWeights.reduce(
    (sum, edge) => sum + edge.pathChancePercent,
    0,
  );

  if (totalWeight <= 0) {
    const fallbackWeight = FLOW_PATH_PERCENTAGE_NORMALIZATION_TARGET / edges.length;
    return edges.map((edge) => ({
      targetNodeId: edge.targetNodeId,
      waypoints: edge.waypoints,
      pathChancePercent: fallbackWeight,
    }));
  }

  const normalizationFactor =
    FLOW_PATH_PERCENTAGE_NORMALIZATION_TARGET / totalWeight;

  if (normalizationFactor === 1) {
    return edgesWithBaseWeights;
  }

  return edgesWithBaseWeights.map((edge) => ({
    ...edge,
    pathChancePercent: edge.pathChancePercent * normalizationFactor,
  }));
};

const getFlowTopology = (
  elementsMap: NonDeletedSceneElementsMap,
): FlowTopology => {
  const nodePositions = new Map<string, FlowNodeInfo>();
  const outgoingByNodeId = new Map<string, FlowTopologyResolvedEdge[]>();
  const pendingOutgoingByNodeId = new Map<string, FlowTopologyEdge[]>();
  const incomingByNodeId = new Map<string, string[]>();
  let diamondNodeCount = 0;
  const nodeIds: string[] = [];

  elementsMap.forEach((element) => {
    if (!isFlowchartNodeElement(element)) {
      return;
    }

    const center = elementCenterPoint(element, elementsMap);
    nodePositions.set(element.id, {
      x: center[0],
      y: center[1],
      spawnRadiusX: Math.max(FLOW_MIN_SPAWN_RADIUS, Math.abs(element.width) / 2),
      spawnRadiusY: Math.max(FLOW_MIN_SPAWN_RADIUS, Math.abs(element.height) / 2),
      targetRadius: Math.max(
        FLOW_MIN_SPAWN_RADIUS,
        Math.max(Math.abs(element.width), Math.abs(element.height)) / 2,
      ),
    });
    if (element.type === "diamond") {
      diamondNodeCount += 1;
    }

    outgoingByNodeId.set(element.id, []);
    pendingOutgoingByNodeId.set(element.id, []);
    incomingByNodeId.set(element.id, []);
    nodeIds.push(element.id);
  });

  const topologyBits: string[] = [];

  elementsMap.forEach((element) => {
    if (!isArrowElement(element)) {
      return;
    }

    const sourceNodeId = element.startBinding?.elementId;
    const targetNodeId = element.endBinding?.elementId;

    if (!sourceNodeId || !targetNodeId) {
      return;
    }

    if (!nodePositions.has(sourceNodeId) || !nodePositions.has(targetNodeId)) {
      return;
    }

    const points = LinearElementEditor.getPointsGlobalCoordinates(element, elementsMap);
    const waypoints = points.length > 2 ? points.slice(1, -1) : [];
    const pendingEdges = pendingOutgoingByNodeId.get(sourceNodeId);
    if (!pendingEdges) {
      return;
    }

    const explicitPathChancePercent = getArrowPathPercentage(
      element,
      elementsMap,
    );
    pendingEdges.push({
      targetNodeId,
      waypoints: waypoints.map((point) => ({
        x: point[0],
        y: point[1],
      })),
      explicitPathChancePercent,
    });
    incomingByNodeId.get(targetNodeId)?.push(sourceNodeId);

    topologyBits.push(
      `${sourceNodeId}->${targetNodeId}${
        points.length > 2 ? `:${waypoints.length}` : ""
      }`,
    );
  });

  pendingOutgoingByNodeId.forEach((edges, sourceNodeId) => {
    const resolvedEdges = normalizePathProbabilities(edges);
    outgoingByNodeId.set(sourceNodeId, resolvedEdges);
    topologyBits.push(
      ...resolvedEdges.map(
        (edge) =>
          `${sourceNodeId}->${edge.targetNodeId}:${edge.pathChancePercent.toFixed(
            4,
          )}`,
      ),
    );
  });

  const startNodeIds = nodeIds.filter((nodeId) => {
    const hasIncoming = (incomingByNodeId.get(nodeId) || []).length > 0;
    return !hasIncoming && (outgoingByNodeId.get(nodeId) || []).length > 0;
  });

  const version = `${nodeIds.length}:${topologyBits.sort().join(",")}`;

  return {
    startNodeIds,
    nodePositions,
    outgoingByNodeId,
    diamondNodeCount,
    version,
  };
};

const getSpawnRateMultiplier = (diamondNodeCount: number) =>
  clamp(
    1 + diamondNodeCount * FLOW_DIAMOND_SPAWN_RATE_INCREMENT,
    1,
    FLOW_MAX_DIAMOND_SPAWN_MULTIPLIER,
  );

const pickNextNodeId = (
  topology: FlowTopology,
  currentNodeId: string,
  randomOffset: number,
): {
  targetNodeId: string;
  waypoints: {
    x: number;
    y: number;
  }[];
  pathChancePercent: number;
} | null => {
  const outgoingEdges = topology.outgoingByNodeId.get(currentNodeId) || [];
  if (outgoingEdges.length === 0) {
    return null;
  }

  if (outgoingEdges.length === 1) {
    return outgoingEdges[0] || null;
  }

  const randomChoice = getDeterministicRandom(randomOffset) * 100;
  let cumulativeChance = 0;

  for (const edge of outgoingEdges) {
    cumulativeChance += edge.pathChancePercent;
    if (randomChoice <= cumulativeChance) {
      return edge;
    }
  }

  return outgoingEdges[outgoingEdges.length - 1] || null;
};

const clampColor = (v: number) => clamp(v, 0, 1);

const getDeterministicRandom = (seed: number) =>
  Math.sin(seed) - Math.floor(Math.sin(seed));

const isPageRenderable = () =>
  typeof document === "undefined" ||
  (document.visibilityState === "visible" &&
    typeof document.hasFocus === "function"
      ? document.hasFocus()
      : true);
const FLOW_MAX_DELTA_TIME = 100;

const getRandomPointInNodeArea = (
  nodeInfo: FlowNodeInfo,
  seed: number,
) => {
  const u = getDeterministicRandom(seed * 17.131);
  const v = getDeterministicRandom(seed * 31.271);
  const angle = u * Math.PI * 2;
  const scale = Math.sqrt(v);

  return {
    x: nodeInfo.x + Math.cos(angle) * nodeInfo.spawnRadiusX * scale,
    y: nodeInfo.y + Math.sin(angle) * nodeInfo.spawnRadiusY * scale,
  };
};

const getRandomPointInTargetCircle = (
  nodeInfo: FlowNodeInfo,
  seed: number,
) => {
  const angle = getDeterministicRandom(seed * 11.971) * Math.PI * 2;
  const scale = Math.sqrt(getDeterministicRandom(seed * 27.113));
  const targetRadius = nodeInfo.targetRadius * FLOW_TARGET_RANDOM_RADIUS_FACTOR;

  return {
    x: nodeInfo.x + Math.cos(angle) * targetRadius * scale,
    y: nodeInfo.y + Math.sin(angle) * targetRadius * scale,
  };
};

const nextFlowChoiceSeed = (seed: number) => (seed * 1664525 + 1013904223) >>> 0;

const getParticleMaxSpeed = (seed: number) => {
  const variation = (getDeterministicRandom(seed) - 0.5) * FLOW_PARTICLE_MAX_SPEED_VARIATION;
  return clamp(
    FLOW_PARTICLE_MAX_SPEED * (1 + variation),
    FLOW_PARTICLE_MAX_SPEED * 0.8,
    FLOW_PARTICLE_MAX_SPEED * 1.2,
  );
};

const rotateTowards = (
  vx: number,
  vy: number,
  targetDx: number,
  targetDy: number,
) => {
  const speed = Math.max(1, Math.hypot(vx, vy));
  const targetDistance = Math.max(1, Math.hypot(targetDx, targetDy));
  const targetVx = (targetDx / targetDistance) * speed;
  const targetVy = (targetDy / targetDistance) * speed;

  const alignment = clamp(
    ((vx * targetVx) + (vy * targetVy)) / (speed * speed),
    -1,
    1,
  );
  if (alignment >= 0.9995) {
    return { vx, vy };
  }

  return {
    vx: vx + (targetVx - vx) * FLOW_TARGET_TURN_STRENGTH,
    vy: vy + (targetVy - vy) * FLOW_TARGET_TURN_STRENGTH,
  };
};

const drawFlowParticle = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  particle: FlowParticle,
) => {
  context.save();

  context.fillStyle =
    appState.theme === THEME.DARK ? "rgba(152, 221, 255, 0.9)" : "#1665d9";
  context.strokeStyle =
    appState.theme === THEME.DARK
      ? "rgba(255, 255, 255, 0.55)"
      : "rgba(255, 255, 255, 0.85)";
  context.lineWidth = clampColor(1 / appState.zoom.value);

  fillCircle(
    context,
    particle.x + appState.scrollX,
    particle.y + appState.scrollY,
    FLOW_PARTICLE_RADIUS / appState.zoom.value,
    true,
    true,
  );

  context.restore();
};

export const updateFlowModeSimulation = ({
  context,
  appState,
  allElementsMap,
  state,
  deltaTime,
}: {
  context: CanvasRenderingContext2D;
  appState: InteractiveCanvasAppState;
  allElementsMap: NonDeletedSceneElementsMap;
  state?: { flowMode?: FlowModeAnimationState };
  deltaTime: number;
}): FlowModeAnimationState | undefined => {
  if (!appState.flowModeEnabled) {
    return undefined;
  }

  if (!isPageRenderable()) {
    return state?.flowMode;
  }

  const topology = getFlowTopology(allElementsMap);
  const hasNodes = topology.nodePositions.size > 0;
  const spawnRateMultiplier = getSpawnRateMultiplier(topology.diamondNodeCount);
  const spawnInterval = FLOW_SPAWN_INTERVAL_MS / spawnRateMultiplier;

  const flowState: FlowModeAnimationState = {
    particles: (state?.flowMode?.particles || []).map((particle) => ({
      ...particle,
      waypoints: particle.waypoints || [],
    })),
    spawnAccumulator: state?.flowMode?.spawnAccumulator || 0,
    nextParticleId: state?.flowMode?.nextParticleId || 0,
    topologyVersion: state?.flowMode?.topologyVersion || "",
  };

  flowState.topologyVersion = topology.version;

  if (!hasNodes) {
    return {
      particles: [],
      spawnAccumulator: flowState.spawnAccumulator,
      nextParticleId: flowState.nextParticleId,
      topologyVersion: flowState.topologyVersion,
    };
  }

  if (!isPageRenderable()) {
    return state?.flowMode;
  }

  const dtMs = Math.min(Math.max(deltaTime, 0), FLOW_MAX_DELTA_TIME);
  const dt = dtMs / 1000;

  if (dtMs > 0) {
    flowState.spawnAccumulator += dtMs;
  }

  const spawnCount = Math.floor(flowState.spawnAccumulator / spawnInterval);
  if (spawnCount > 0) {
    flowState.spawnAccumulator %= spawnInterval;
  }

  let nextParticleId = flowState.nextParticleId;
  const spawnNodeIds = topology.startNodeIds;
  if (spawnNodeIds.length > 0) {
    for (let spawnIndex = 0; spawnIndex < spawnCount; spawnIndex++) {
      const seed = nextParticleId++;
      const spawnNodeId = spawnNodeIds[seed % spawnNodeIds.length];
      if (!spawnNodeId) {
        continue;
      }

      const start = topology.nodePositions.get(spawnNodeId);
      if (!start) {
        continue;
      }

      const nextNodeChoiceSeed = nextFlowChoiceSeed(seed);
      const firstTarget = pickNextNodeId(
        topology,
        spawnNodeId,
        nextNodeChoiceSeed,
      );
      if (!firstTarget) {
        continue;
      }

      const jitter = (seed * 31.5) % (Math.PI * 2);
      const speed = clamp(
        FLOW_PARTICLE_BASE_SPEED + ((seed % 70) - 35),
        150,
        FLOW_PARTICLE_MAX_SPEED,
      );
      const spawnPosition = getRandomPointInNodeArea(start, seed);
      const firstTargetNode = topology.nodePositions.get(
        firstTarget.targetNodeId,
      );
      if (!firstTargetNode) {
        continue;
      }

      const firstTargetPosition = getRandomPointInTargetCircle(
        firstTargetNode,
        nextNodeChoiceSeed,
      );

      flowState.particles.push({
        id: seed,
        x: spawnPosition.x,
        y: spawnPosition.y,
        vx: Math.cos(jitter) * (speed * 0.2),
        vy: Math.sin(jitter) * (speed * 0.2),
        currentNodeId: spawnNodeId,
        targetNodeId: firstTarget.targetNodeId,
        targetX: firstTargetPosition.x,
        targetY: firstTargetPosition.y,
        nextNodeChoiceSeed,
        maxSpeed: getParticleMaxSpeed(nextNodeChoiceSeed),
        waypoints: firstTarget.waypoints.map((waypoint) => ({
          x: waypoint.x,
          y: waypoint.y,
        })),
      });
    }
  }

  flowState.nextParticleId = nextParticleId;

  const aliveParticles: FlowParticle[] = [];

  for (const particle of flowState.particles) {
    const targetNodeId = particle.targetNodeId;
    if (!targetNodeId) {
      continue;
    }

    const hasCornerTarget = particle.waypoints.length > 0;
    const activeTarget = hasCornerTarget
      ? particle.waypoints[0]
      : { x: particle.targetX, y: particle.targetY };
    const dx = activeTarget.x - particle.x;
    const dy = activeTarget.y - particle.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const normalizedDx = dx / distance;
    const normalizedDy = dy / distance;

    const fx = normalizedDx * FLOW_FLOW_FORCE;
    const fy = normalizedDy * FLOW_FLOW_FORCE;

    particle.vx += fx * dt;
    particle.vy += fy * dt;

    const currentSpeed = Math.max(1, Math.hypot(particle.vx, particle.vy));
    const limitedSpeed = Math.min(currentSpeed, particle.maxSpeed);
    const scale = limitedSpeed / currentSpeed;
    particle.vx *= scale;
    particle.vy *= scale;

    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;

    if (distance <= FLOW_ARRIVAL_DISTANCE) {
      if (particle.waypoints.length > 0) {
        particle.waypoints.shift();
        const nextTarget = particle.waypoints[0] || {
          x: particle.targetX,
          y: particle.targetY,
        };
        const nextDx = nextTarget.x - particle.x;
        const nextDy = nextTarget.y - particle.y;
        const nextVelocity = rotateTowards(particle.vx, particle.vy, nextDx, nextDy);
        particle.vx = nextVelocity.vx;
        particle.vy = nextVelocity.vy;
      } else {
        const nextNodeChoiceSeed = nextFlowChoiceSeed(
          particle.nextNodeChoiceSeed,
        );
        const nextTarget = pickNextNodeId(
          topology,
          targetNodeId,
          nextNodeChoiceSeed,
        );
        if (!nextTarget) {
          continue;
        }

        const nextTargetNode = topology.nodePositions.get(
          nextTarget.targetNodeId,
        );
        if (!nextTargetNode) {
          continue;
        }

        const nextTargetPosition = getRandomPointInTargetCircle(
          nextTargetNode,
          nextNodeChoiceSeed,
        );
        const nextFollowTarget = nextTarget.waypoints[0] || nextTargetPosition;
        const turnTargetDx = nextFollowTarget.x - particle.x;
        const turnTargetDy = nextFollowTarget.y - particle.y;
        const turnedVelocity = rotateTowards(
          particle.vx,
          particle.vy,
          turnTargetDx,
          turnTargetDy,
        );

        particle.vx = turnedVelocity.vx;
        particle.vy = turnedVelocity.vy;
        particle.currentNodeId = targetNodeId;
        particle.targetNodeId = nextTarget.targetNodeId;
        particle.waypoints = nextTarget.waypoints.map((waypoint) => ({
          x: waypoint.x,
          y: waypoint.y,
        }));
        particle.targetX = nextTargetPosition.x;
        particle.targetY = nextTargetPosition.y;
        particle.nextNodeChoiceSeed = nextNodeChoiceSeed;
      }
    }

    drawFlowParticle(context, appState, particle);
    aliveParticles.push(particle);
  }

  return {
    particles: aliveParticles,
    spawnAccumulator: flowState.spawnAccumulator,
    nextParticleId: flowState.nextParticleId,
    topologyVersion: flowState.topologyVersion,
  };
};
