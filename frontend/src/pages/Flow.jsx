import { useState, useCallback, useRef, memo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Panel,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from "reactflow";
import "reactflow/dist/style.css";
import clsx from "clsx";
import { generateFlow } from "../services/ai";
import Loader from "../components/Loader";
import { getLayoutedElements } from "../utils/flowUtils.js";

// ─── SHAPES ──────────────────────────────────────────────
const shapeStyles = {
  rectangle: "rounded-md",
  rounded: "rounded-2xl",
  diamond: "rotate-45 rounded-sm",
  circle: "rounded-full",
  parallelogram: "-skew-x-12 rounded-md",
};

// ─── CUSTOM NODE ─────────────────────────────────────────
const CustomNode = memo(({ data, selected }) => {
  const {
    shape = "rectangle",
    bg = "#f9fafb",
    color = "#1a1a1a",
    border = "#374151",
    fontSize = 14,
    bold,
    italic,
    label,
    width = 140,
    height = 48,
  } = data;

  const borderColor = selected ? "#6366f1" : border;
  const base = clsx(
    "flex items-center justify-center text-center shadow-sm whitespace-pre-wrap break-words select-none",
    shapeStyles[shape],
    selected && "ring-2 ring-indigo-400/50"
  );

  return (
    <div
      className={base}
      style={{
        background: bg,
        color,
        border: `2px solid ${borderColor}`,
        fontSize,
        fontWeight: bold ? 600 : 400,
        fontStyle: italic ? "italic" : "normal",
        width,
        height,
      }}
    >
      {shape === "diamond" ? (
        <span className="-rotate-45 block">{label}</span>
      ) : (
        label
      )}
    </div>
  );
});

// ─── CUSTOM EDGE ─────────────────────────────────────────
const CustomEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd,
    style,
  }) => {
    const [path, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    });

    return (
      <>
        <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
        {data?.label && (
          <EdgeLabelRenderer>
            <div
              className="absolute text-xs bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 pointer-events-auto"
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              }}
            >
              {data.label}
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    );
  }
);

const NODE_TYPES = { custom: CustomNode };
const EDGE_TYPES = { custom: CustomEdge };

// ─── MAIN FLOW COMPONENT ────────────────────────────────
export default function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("add");
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const rfWrapper = useRef(null);
  const [rfi, setRfi] = useState(null);

  // ── Add + Layout functions ────────────────────────────
  const autoLayout = useCallback(() => {
    if (!nodes.length) return;
    const { nodes: ln, edges: le } = getLayoutedElements(nodes, edges);
    setNodes(ln);
    setEdges(le);
  }, [nodes, edges]);

  const clearFlow = useCallback(() => {
    if (confirm("Clear everything?")) {
      setNodes([]);
      setEdges([]);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    try {
      setLoading(true);
      const res = await generateFlow({ input: aiPrompt });
      const flow = res.data;
      const n = flow.nodes.map((i, idx) => ({
        id: String(i.id),
        type: "custom",
        position: { x: 250, y: idx * 120 },
        data: { label: i.label },
      }));
      const e = flow.edges.map((x) => ({
        id: `e-${x.source}-${x.target}`,
        source: String(x.source),
        target: String(x.target),
        type: "custom",
        data: { label: "" },
      }));
      const { nodes: ln, edges: le } = getLayoutedElements(n, e);
      setNodes(ln);
      setEdges(le);
    } catch (err) {
      alert("AI generation failed. Check console.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [aiPrompt]);

  // ── Edge Builder ─────────────────────────────────────
  const buildEdge = useCallback(
    (src, tgt) => ({
      id: `e-${src}-${tgt}-${Date.now()}`,
      source: src,
      target: tgt,
      type: "custom",
      markerEnd: { type: "arrowclosed", color: "#374151" },
      style: { stroke: "#374151", strokeWidth: 2 },
    }),
    []
  );

  const onConnect = useCallback(
    (params) => setEdges((es) => addEdge(buildEdge(params.source, params.target), es)),
    [buildEdge]
  );

  const onNodeClick = (_, n) => {
    setSelectedNode(n.id);
    setSelectedEdge(null);
  };
  const onEdgeClick = (_, e) => {
    setSelectedEdge(e.id);
    setSelectedNode(null);
  };
  const onPaneClick = () => {
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  // ─── RETURN UI ───────────────────────────────────────
  return (
    <div className="w-full h-screen flex flex-col font-sans bg-slate-50">
      {/* Top Bar */}
      <div className="h-12 flex items-center px-4 bg-white border-b border-gray-200">
        <span className="font-bold text-indigo-900 text-lg">FlowMind 🚀</span>
        <div className="flex-1" />
        <button className="btn bg-indigo-500" onClick={autoLayout}>
          ⬚ Auto-layout
        </button>
        <button className="btn bg-red-500 ml-2" onClick={clearFlow}>
          ✕ Clear
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-60 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
          <div className="border-b border-gray-200 flex">
            {[
              ["add", "＋ Add"],
              ["style", "🎨 Style"],
              ["edge", "⇢ Edge"],
              ["ai", "⚡ AI"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={clsx(
                  "flex-1 py-2 font-bold text-xs uppercase tracking-wide border-b-2",
                  tab === id
                    ? "text-indigo-500 border-indigo-500"
                    : "text-gray-400 border-transparent"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Add/AI Tabs */}
          <div className="p-3 flex-1 overflow-y-auto text-xs text-gray-600">
            {tab === "ai" && (
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-gray-700 text-[11px] uppercase">
                  Describe your flow
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={6}
                  placeholder="e.g. user login system with OAuth"
                  className="w-full border border-gray-300 rounded p-2 text-sm focus:ring focus:ring-green-200"
                />
                <button
                  disabled={loading}
                  onClick={handleGenerate}
                  className={clsx(
                    "rounded py-2 text-white font-semibold transition",
                    loading
                      ? "bg-green-400/60 cursor-wait"
                      : "bg-green-600 hover:bg-green-700"
                  )}
                >
                  {loading ? "Generating…" : "⚡ Generate Flow"}
                </button>
              </div>
            )}
            {tab === "add" && (
              <div className="text-gray-500 text-sm">
                Configure and create new nodes (UI omitted here for brevity).
              </div>
            )}
          </div>

          <div className="px-3 py-2 border-t border-gray-200 text-[11px] text-gray-400">
            {nodes.length} nodes · {edges.length} edges
          </div>
        </div>

        {/* Canvas */}
        <div ref={rfWrapper} className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20">
              <Loader />
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onInit={setRfi}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            snapToGrid
            snapGrid={[10, 10]}
          >
            <Background variant="dots" gap={18} size={1} color="#d1d5db" />
            <Controls />
            <MiniMap
              nodeColor={(n) => n.data?.bg || "#f9fafb"}
              maskColor="rgba(248,250,252,0.7)"
              className="border border-gray-200 rounded-md"
            />
            <Panel position="top-right" className="flex gap-2 m-3">
              <button
                className={clsx(
                  "px-3 py-1 text-xs font-semibold text-white rounded",
                  selectedNode || selectedEdge
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                )}
              >
                🗑 Delete
              </button>
              <button className="px-3 py-1 text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white rounded">
                ⧉ Dup
              </button>
              <button
                onClick={autoLayout}
                className="px-3 py-1 text-xs font-semibold bg-green-500 hover:bg-green-600 text-white rounded"
              >
                ⬚ Layout
              </button>
            </Panel>
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

/* Tailwind Button shortcut */
export const Button = ({ children, onClick, color = "indigo" }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 text-xs font-semibold text-white bg-${color}-500 hover:bg-${color}-600 rounded`}
  >
    {children}
  </button>
);
