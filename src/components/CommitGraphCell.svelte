<script>
  import { graphLaneColor } from '../lib/commitGraph.js';

  let { graph = {} } = $props();

  const laneWidth = 14;
  const gutter = 8;
  const height = 52;
  const middleY = 26;

  let laneCount = $derived(Math.max(1, graph.laneCount ?? 1));
  let width = $derived(gutter * 2 + laneCount * laneWidth);
  let nodeLane = $derived(graph.nodeLane ?? 0);
  let topLanes = $derived(graph.topLanes ?? [nodeLane]);
  let bottomLanes = $derived(graph.bottomLanes ?? [nodeLane]);
  let parentLanes = $derived(graph.parentLanes ?? [nodeLane]);
  let bottomVerticalLanes = $derived(
    bottomLanes.filter((lane) => lane === nodeLane || topLanes.includes(lane) || !parentLanes.includes(lane))
  );

  function laneX(lane) {
    return gutter + lane * laneWidth + laneWidth / 2;
  }

  function color(lane) {
    return graph.laneColors?.[lane] ?? graphLaneColor(lane);
  }

  function connectorPath(fromLane, toLane) {
    const fromX = laneX(fromLane);
    const toX = laneX(toLane);
    const controlY = fromLane === toLane ? middleY + 8 : middleY + 13;
    return `M ${fromX} ${middleY} C ${fromX} ${controlY}, ${toX} ${height - 15}, ${toX} ${height}`;
  }
</script>

<span class="commit-graph" style={`--graph-width: ${width}px`} aria-hidden="true">
  <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="presentation">
    {#each topLanes as lane}
      <line class="graph-line" x1={laneX(lane)} y1="0" x2={laneX(lane)} y2={middleY} stroke={color(lane)} />
    {/each}

    {#each bottomVerticalLanes as lane}
      <line class="graph-line" x1={laneX(lane)} y1={middleY} x2={laneX(lane)} y2={height} stroke={color(lane)} />
    {/each}

    {#each parentLanes as lane}
      {#if lane !== nodeLane}
        <path class="graph-line graph-connector" d={connectorPath(nodeLane, lane)} stroke={color(lane)} />
      {/if}
    {/each}

    <circle class="graph-node-halo" cx={laneX(nodeLane)} cy={middleY} r="7" />
    <circle class="graph-node" cx={laneX(nodeLane)} cy={middleY} r="4.5" fill={color(nodeLane)} />
  </svg>
</span>
