import dagre from "dagre";

const nodeWidth = 180;
const nodeHeight = 60;

export const getLayoutedElements = (nodes, edges) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // 🔥 ADVANCED LAYOUT SETTINGS
  dagreGraph.setGraph({
    rankdir: "TB",     // Top → Bottom
    align: "UL",       // Better alignment
    nodesep: 100,      // Horizontal spacing
    ranksep: 140,      // Vertical spacing
    marginx: 40,
    marginy: 40,
  });

  // 🔥 ADD NODES
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: nodeWidth,
      height: nodeHeight,
    });
  });

  // 🔥 ADD EDGES
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // 🔥 APPLY LAYOUT
  dagre.layout(dagreGraph);

  // 🔥 SET POSITIONS (CENTER FIX)
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      sourcePosition: "bottom",
      targetPosition: "top",
    };
  });

  // 🔥 OPTIONAL: EDGE STYLE IMPROVEMENT
  const layoutedEdges = edges.map((edge) => ({
    ...edge,
    type: "smoothstep",   // curved edges 🔥
  }));

  return { nodes: layoutedNodes, edges: layoutedEdges };
};