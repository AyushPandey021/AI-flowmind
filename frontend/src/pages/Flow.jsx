import { useState, useCallback, useRef, memo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import clsx from "clsx";
import { v4 as uuid } from "uuid";
import { generateFlow } from "../services/ai";
// ─── NODE ─────────────────────────────
const CustomNode = memo(({ data, selected }) => {
  return (
    <div
      className={clsx(
        "px-3 py-2 shadow-md text-center",
        selected && "ring-2 ring-indigo-400"
      )}
      style={{
        background: data.bg || "#fff",
        border: `2px solid ${data.border || "#333"}`,
        borderRadius: data.radius || 8,
        color: data.color || "#111",
        fontSize: data.fontSize || 14,
      }}
    >
      {data.label}
    </div>
  );
});

const NODE_TYPES = { custom: CustomNode };

// ─── MAIN ─────────────────────────────
export default function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
const [shape, setShape] = useState("default");
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
const [aiPrompt, setAiPrompt] = useState("");
const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("New Node");
  const [bg, setBg] = useState("#ffffff");
  const [color, setColor] = useState("#000000");

  // ─── ADD NODE ─────────────────────
  const addNode = () => {
    const newNode = {
      id: uuid(),
      type: "custom",
      position: { x: Math.random() * 400, y: Math.random() * 400 },
    data: { label, bg, color, shape },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleGenerate = async () => {
  if (!aiPrompt.trim()) return;

  try {
    setLoading(true);

    const res = await generateFlow({ input: aiPrompt });

    const flow = res.data;

    const newNodes = flow.nodes.map((n, i) => ({
      id: String(n.id),
      type: "custom",
      position: { x: 200, y: i * 100 },
      data: { label: n.label },
    }));

    const newEdges = flow.edges.map((e) => ({
      id: `e-${e.source}-${e.target}`,
      source: String(e.source),
      target: String(e.target),
      animated: true,
    }));

    setNodes(newNodes);
    setEdges(newEdges);
  } catch (err) {
    console.error(err);
    alert("AI failed");
  } finally {
    setLoading(false);
  }
};
  // ─── DELETE ───────────────────────
  const deleteSelected = () => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode));
      setEdges((eds) =>
        eds.filter(
          (e) => e.source !== selectedNode && e.target !== selectedNode
        )
      );
      setSelectedNode(null);
    }
    if (selectedEdge) {
      setEdges((eds) => eds.filter((e) => e.id !== selectedEdge));
      setSelectedEdge(null);
    }
  };

  // ─── DUPLICATE ────────────────────
  const duplicateNode = () => {
    const node = nodes.find((n) => n.id === selectedNode);
    if (!node) return;

    const newNode = {
      ...node,
      id: uuid(),
      position: {
        x: node.position.x + 40,
        y: node.position.y + 40,
      },
    };

    setNodes((nds) => [...nds, newNode]);
  };

  // ─── UPDATE STYLE ─────────────────
  const updateNodeStyle = () => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode
          ? { ...n, data: { ...n.data, label, bg, color } }
          : n
      )
    );
  };

  // ─── CONNECT ──────────────────────
  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: "#333", strokeWidth: 2 },
          },
          eds
        )
      ),
    []
  );
const autoLayout = () => {
  const spacingX = 200;
  const spacingY = 100;

  setNodes((nds) =>
    nds.map((node, index) => ({
      ...node,
      position: {
        x: (index % 3) * spacingX,
        y: Math.floor(index / 3) * spacingY,
      },
    }))
  );
};
  return (
    <div className="w-full h-screen flex">
      {/* SIDEBAR */}
 <div className="w-72 bg-white border-r p-4 flex flex-col gap-5 overflow-y-auto">
  <h2 className="font-bold text-indigo-600 text-lg">Flow Tools 🚀</h2>

  {/* ─── ADD NODE ───────────────── */}
  <div className="border rounded p-3">
    <h3 className="text-sm font-semibold mb-2">➕ Add Node</h3>

    <input
      value={label}
      onChange={(e) => setLabel(e.target.value)}
      placeholder="Node text"
      className="border p-1 w-full mb-2 text-sm"
    />

    <select
      onChange={(e) => setShape(e.target.value)}
      className="border w-full mb-2 text-sm p-1"
    >
      <option value="default">Rectangle</option>
      <option value="circle">Circle</option>
      <option value="diamond">Decision</option>
    </select>

    <button
      onClick={addNode}
      className="bg-indigo-500 text-white w-full py-1 rounded"
    >
      + Add Node
    </button>
  </div>

  {/* ─── EDIT NODE ───────────────── */}
  <div className="border rounded p-3">
    <h3 className="text-sm font-semibold mb-2">🎨 Edit Node</h3>

    <input
      value={label}
      onChange={(e) => setLabel(e.target.value)}
      placeholder="Edit label"
      className="border p-1 w-full mb-2 text-sm"
    />

    <div className="flex gap-2 mb-2">
      <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
    </div>

    <button
      onClick={updateNodeStyle}
      className="bg-green-500 text-white w-full py-1 rounded"
    >
      Apply Changes
    </button>
  </div>

  {/* ─── EDGE TOOLS ───────────────── */}
  <div className="border rounded p-3">
    <h3 className="text-sm font-semibold mb-2">🔗 Edge Tools</h3>

    <p className="text-xs text-gray-500 mb-2">
      Connect nodes by dragging handles
    </p>

    <button
      onClick={() =>
        setEdges((eds) =>
          eds.map((e) => ({ ...e, animated: !e.animated }))
        )
      }
      className="bg-blue-500 text-white w-full py-1 rounded mb-2"
    >
      Toggle Animation
    </button>

    <button
      onClick={() => setEdges([])}
      className="bg-gray-400 text-white w-full py-1 rounded"
    >
      Clear Edges
    </button>
  </div>

  {/* ─── AI GENERATE ───────────────── */}
  <div className="border rounded p-3">
    <h3 className="text-sm font-semibold mb-2">⚡ AI Generator</h3>

    <textarea
      value={aiPrompt}
      onChange={(e) => setAiPrompt(e.target.value)}
      placeholder="e.g. e-commerce checkout flow"
      className="border w-full p-2 text-sm mb-2"
    />

    <button
      onClick={handleGenerate}
      disabled={loading}
      className="bg-green-600 text-white w-full py-1 rounded"
    >
      {loading ? "Generating..." : "Generate Flow"}
    </button>
  </div>

  {/* ─── ACTIONS ───────────────── */}
  <div className="border rounded p-3">
    <h3 className="text-sm font-semibold mb-2">⚙️ Actions</h3>

    <button
      onClick={deleteSelected}
      className="bg-red-500 text-white w-full py-1 rounded mb-2"
    >
      🗑 Delete
    </button>

    <button
      onClick={duplicateNode}
      className="bg-yellow-500 text-white w-full py-1 rounded mb-2"
    >
      📄 Duplicate
    </button>

    <button
      onClick={() => {
        setNodes([]);
        setEdges([]);
      }}
      className="bg-gray-500 text-white w-full py-1 rounded"
    >
      Clear All
    </button>
  </div>

  {/* ─── LAYOUT TOOLS ───────────────── */}
  <div className="border rounded p-3">
    <h3 className="text-sm font-semibold mb-2">📐 Layout</h3>

    <button
onClick={autoLayout}
      className="bg-indigo-500 text-white w-full py-1 rounded"
    >
      Auto Arrange
    </button>
  </div>
</div>

      {/* CANVAS */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, n) => setSelectedNode(n.id)}
          onEdgeClick={(_, e) => setSelectedEdge(e.id)}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
          <Panel position="top-right">
            <span className="text-xs bg-white p-1 rounded shadow">
              {nodes.length} Nodes | {edges.length} Edges
            </span>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}