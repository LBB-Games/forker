const DEFAULT_GRAPH = {
  nodeLane: 0,
  laneCount: 1,
  topLanes: [0],
  bottomLanes: [0],
  parentLanes: [0],
};

export const GRAPH_LANE_COLORS = [
  'var(--accent)',
  'var(--branch-color-3)',
  'var(--success)',
  'var(--warning)',
  'var(--branch-color-4)',
  'var(--branch-color-7)',
  'var(--branch-color-6)',
  'var(--branch-color-5)',
];

export function graphLaneColor(lane = 0) {
  return GRAPH_LANE_COLORS[Math.max(0, lane) % GRAPH_LANE_COLORS.length];
}

export function commitsWithGraph(commits = [], options = {}) {
  const activeLanes = [];
  const activeLaneColors = [];
  const visibleIds = new Set(commits.map((commit) => commit.id).filter(Boolean));
  const getLaneColorForCommit = typeof options.getLaneColorForCommit === 'function'
    ? options.getLaneColorForCommit
    : () => null;

  return commits.map((commit) => {
    const id = commit.id;
    const parents = normalizeParents(commit.parents).filter((parent) => visibleIds.has(parent));
    let nodeLane = activeLanes.indexOf(id);

    if (nodeLane === -1) {
      nodeLane = firstEmptyLane(activeLanes);
      activeLanes[nodeLane] = id;
    }

    const branchColor = getLaneColorForCommit(commit, nodeLane);
    if (branchColor) activeLaneColors[nodeLane] = branchColor;
    if (!activeLaneColors[nodeLane]) activeLaneColors[nodeLane] = graphLaneColor(nodeLane);

    const topLanes = laneIndexes(activeLanes);
    const laneColors = { ...activeLaneColors };
    const nextLanes = activeLanes.slice();
    const nextLaneColors = activeLaneColors.slice();
    const parentLanes = [];

    if (parents.length) {
      const firstParentLane = nextLanes.findIndex((lane, index) => lane === parents[0] && index !== nodeLane);

      if (firstParentLane === -1) {
        nextLanes[nodeLane] = parents[0];
        nextLaneColors[nodeLane] = activeLaneColors[nodeLane];
        parentLanes.push(nodeLane);
      } else {
        nextLanes[nodeLane] = null;
        nextLaneColors[nodeLane] = null;
        parentLanes.push(firstParentLane);
      }

      for (const parent of parents.slice(1)) {
        let parentLane = nextLanes.indexOf(parent);

        if (parentLane === -1) {
          parentLane = firstEmptyLane(nextLanes);
          nextLanes[parentLane] = parent;
          nextLaneColors[parentLane] = graphLaneColor(parentLane);
        }

        parentLanes.push(parentLane);
      }
    } else {
      nextLanes[nodeLane] = null;
      nextLaneColors[nodeLane] = null;
    }

    trimTrailingEmptyLanes(nextLanes);
    trimTrailingEmptyLanes(nextLaneColors);

    const bottomLanes = laneIndexes(nextLanes);
    const laneCount = Math.max(1, activeLanes.length, nextLanes.length, nodeLane + 1);

    activeLanes.length = 0;
    activeLanes.push(...nextLanes);
    activeLaneColors.length = 0;
    activeLaneColors.push(...nextLaneColors);

    return {
      ...commit,
      graph: commit.graph ?? {
        ...DEFAULT_GRAPH,
        nodeLane,
        laneCount,
        topLanes,
        bottomLanes,
        parentLanes,
        laneColors,
      },
    };
  });
}

function normalizeParents(parents) {
  if (!Array.isArray(parents)) return [];
  return parents.map((parent) => String(parent).trim()).filter(Boolean);
}

function laneIndexes(lanes) {
  return lanes.reduce((indexes, value, index) => {
    if (value) indexes.push(index);
    return indexes;
  }, []);
}

function firstEmptyLane(lanes) {
  const index = lanes.findIndex((lane) => !lane);
  return index === -1 ? lanes.length : index;
}

function trimTrailingEmptyLanes(lanes) {
  while (lanes.length && !lanes[lanes.length - 1]) lanes.pop();
}
