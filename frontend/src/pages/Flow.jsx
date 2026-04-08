import { useState, useCallback, useRef, memo, useEffect } from "react";
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
import { Handle, Position } from "reactflow";
import { v4 as uuid } from "uuid";
import { generateFlow } from "../services/ai";
import { getLayoutedElements } from "../utils/flowUtils.js";

// ─── THEME ────────────────────────────────────────────────────────────────────
const COLORS = {
  teal:    { bg: "#0d9488", border: "#0f766e", text: "#fff", glow: "rgba(13,148,136,0.4)" },
  rose:    { bg: "#e11d48", border: "#be123c", text: "#fff", glow: "rgba(225,29,72,0.4)"  },
  indigo:  { bg: "#4f46e5", border: "#4338ca", text: "#fff", glow: "rgba(79,70,229,0.4)"  },
  amber:   { bg: "#d97706", border: "#b45309", text: "#fff", glow: "rgba(217,119,6,0.4)"  },
  emerald: { bg: "#059669", border: "#047857", text: "#fff", glow: "rgba(5,150,105,0.4)"  },
  violet:  { bg: "#7c3aed", border: "#6d28d9", text: "#fff", glow: "rgba(124,58,237,0.4)" },
  sky:     { bg: "#0284c7", border: "#0369a1", text: "#fff", glow: "rgba(2,132,199,0.4)"  },
  slate:   { bg: "#334155", border: "#1e293b", text: "#fff", glow: "rgba(51,65,85,0.4)"   },
};

const SHAPE_PRESETS = [
  { id: "rect",    label: "Rectangle", icon: "▭", radius: "8px"  },
  { id: "rounded", label: "Rounded",   icon: "⬭", radius: "999px"},
  { id: "diamond", label: "Diamond",   icon: "◇", radius: "4px"  },
  { id: "circle",  label: "Circle",    icon: "○", radius: "50%"  },
];

const NODE_SYMBOLS = ["🏠","🎬","🎵","🎮","👤","⚙️","💳","🔐","📱","🔔","⭐","📂","🌐","🔗","💡","🎯","📊","🚀"];

// ─── CUSTOM NODES ─────────────────────────────────────────────────────────────
const CustomNode = memo(({ data, selected }) => {
  const isDiamond = data.shape === "diamond";
  const isCircle  = data.shape === "circle";

  const containerStyle = {
    position: "relative",
    display:  "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: isDiamond ? 110 : isCircle ? 90 : 130,
    minHeight: isDiamond ? 110 : isCircle ? 90 : 48,
    ...(isDiamond
      ? { transform: "rotate(45deg)", borderRadius: "8px" }
      : { borderRadius: data.radius || "8px" }),
    background: data.bg   || "#fff",
    border: `2px solid ${data.border || "#334155"}`,
    boxShadow: selected
      ? `0 0 0 2px #a5f3fc, 0 8px 32px ${data.glow || "rgba(0,0,0,0.3)"}`
      : `0 4px 16px ${data.glow || "rgba(0,0,0,0.2)"}, inset 0 1px 0 rgba(255,255,255,0.15)`,
    transition: "box-shadow 0.2s",
    cursor: "pointer",
  };

  const innerStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    transform: isDiamond ? "rotate(-45deg)" : "none",
    color: data.color || "#fff",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    letterSpacing: "0.02em",
    textAlign: "center",
    padding: isDiamond ? "4px 0" : "6px 12px",
    pointerEvents: "none",
    userSelect: "none",
  };

return (
  <div style={containerStyle}>
    
    {/* 🔥 TARGET HANDLE (TOP) */}
    <Handle
      type="target"
      position={Position.Top}
      style={{ background: "#fff", width: 8, height: 8 }}
    />

    <div style={innerStyle}>
      {data.symbol && <span style={{ fontSize: 16 }}>{data.symbol}</span>}
      <span>{data.label}</span>
    </div>

    {/* 🔥 SOURCE HANDLE (BOTTOM) */}
    <Handle
      type="source"
      position={Position.Bottom}
      style={{ background: "#fff", width: 8, height: 8 }}
    />
  </div>
);
});

// ─── CUSTOM EDGE ──────────────────────────────────────────────────────────────
const FloatingEdge = ({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, style = {}, markerEnd, data,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          strokeWidth: 2,
          stroke: data?.color || "#6366f1",
          strokeDasharray: data?.dashed ? "6 3" : undefined,
          filter: `drop-shadow(0 0 4px ${data?.color || "#6366f1"}88)`,
          ...style,
        }}
      />
    </>
  );
};

const NODE_TYPES = { custom: CustomNode };
const EDGE_TYPES = { floating: FloatingEdge };

// ─── SIDEBAR SECTION ──────────────────────────────────────────────────────────
const Section = ({ title, icon, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "10px 14px",
          background: "transparent", border: "none", cursor: "pointer",
          color: "#e2e8f0", fontSize: 12, fontWeight: 700,
          letterSpacing: "0.08em", textTransform: "uppercase",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span>{icon}</span>{title}
        </span>
        <span style={{
          fontSize: 10, opacity: 0.5,
          transform: open ? "rotate(180deg)" : "none",
          transition: "transform 0.2s",
        }}>▲</span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {children}
        </div>
      )}
    </div>
  );
};

// ─── BUTTON COMPONENT ─────────────────────────────────────────────────────────
const Btn = ({ onClick, children, color = "#4f46e5", disabled, style = {} }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      background: disabled ? "#1e293b" : `linear-gradient(135deg, ${color}, ${color}cc)`,
      color: disabled ? "#475569" : "#fff",
      border: "none", borderRadius: 8, padding: "8px 12px",
      fontSize: 12, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
      width: "100%", letterSpacing: "0.02em",
      fontFamily: "'DM Sans', sans-serif",
      boxShadow: disabled ? "none" : `0 2px 8px ${color}44`,
      transition: "all 0.15s",
      ...style,
    }}
  >
    {children}
  </button>
);

// ─── INPUT COMPONENT ──────────────────────────────────────────────────────────
const Input = ({ value, onChange, placeholder, multiline }) => {
  const shared = {
    value, onChange,
    placeholder,
    style: {
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 8, color: "#e2e8f0",
      fontSize: 12, padding: "8px 10px", width: "100%",
      fontFamily: "'DM Sans', sans-serif", outline: "none",
      resize: "vertical",
      boxSizing: "border-box",
    },
  };
  return multiline
    ? <textarea {...shared} rows={3} />
    : <input {...shared} />;
};

// ─── SELECT COMPONENT ─────────────────────────────────────────────────────────
const Select = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    style={{
      background: "#1e293b",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 8, color: "#e2e8f0",
      fontSize: 12, padding: "7px 10px", width: "100%",
      fontFamily: "'DM Sans', sans-serif", cursor: "pointer", outline: "none",
    }}
  >
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Node creation state
  const [label,     setLabel]     = useState("New Node");
  const [shape,     setShape]     = useState("rect");
  const [colorKey,  setColorKey]  = useState("teal");
  const [symbol,    setSymbol]    = useState("");
  const [edgeColor, setEdgeColor] = useState("#6366f1");
  const [dashedEdge, setDashedEdge] = useState(false);

  // Selection
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);

  // AI
  const [aiPrompt, setAiPrompt] = useState("");
  const [loading,  setLoading]  = useState(false);

  // Stats
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });
  useEffect(() => setStats({ nodes: nodes.length, edges: edges.length }), [nodes, edges]);

  // ─── ADD NODE ───────────────────────────────────────────────────────────────
  const addNode = () => {
    const theme = COLORS[colorKey];
    const shapePreset = SHAPE_PRESETS.find(s => s.id === shape);
    setNodes(nds => [...nds, {
      id:   uuid(),
      type: "custom",
      position: { x: 120 + Math.random() * 400, y: 80 + Math.random() * 350 },
      data: {
        label,
        symbol,
        shape,
        radius: shapePreset?.radius || "8px",
        bg:     theme.bg,
        border: theme.border,
        color:  theme.text,
        glow:   theme.glow,
      },
    }]);
  };

  // ─── UPDATE SELECTED NODE ───────────────────────────────────────────────────
  const updateNodeStyle = () => {
    if (!selectedNode) return;
    const theme = COLORS[colorKey];
    const shapePreset = SHAPE_PRESETS.find(s => s.id === shape);
    setNodes(nds => nds.map(n =>
      n.id === selectedNode
        ? {
            ...n,
            data: {
              ...n.data,
              label, symbol, shape,
              radius: shapePreset?.radius || "8px",
              bg:     theme.bg,
              border: theme.border,
              color:  theme.text,
              glow:   theme.glow,
            },
          }
        : n
    ));
  };

  // ─── CONNECT ────────────────────────────────────────────────────────────────
  const onConnect = useCallback(
    params =>
      setEdges(eds =>
        addEdge(
          {
            ...params,
          type: "smoothstep",
            animated: true,
            data: { color: edgeColor, dashed: dashedEdge },
            markerEnd: {
              type: "arrowclosed",
              width: 16, height: 16,
              color: edgeColor,
            },
          },
          eds
        )
      ),
    [edgeColor, dashedEdge]
  );

  // ─── DELETE ─────────────────────────────────────────────────────────────────
  const deleteSelected = () => {
    if (selectedNode) {
      setNodes(nds => nds.filter(n => n.id !== selectedNode));
      setEdges(eds => eds.filter(e => e.source !== selectedNode && e.target !== selectedNode));
      setSelectedNode(null);
    }
    if (selectedEdge) {
      setEdges(eds => eds.filter(e => e.id !== selectedEdge));
      setSelectedEdge(null);
    }
  };

  // ─── DUPLICATE ──────────────────────────────────────────────────────────────
  const duplicateNode = () => {
    const node = nodes.find(n => n.id === selectedNode);
    if (!node) return;
    setNodes(nds => [...nds, {
      ...node,
      id: uuid(),
      position: { x: node.position.x + 50, y: node.position.y + 50 },
    }]);
  };

  // ─── AUTO LAYOUT ────────────────────────────────────────────────────────────
  const autoLayout = () => {
    setNodes(nds => nds.map((node, i) => ({
      ...node,
      position: { x: (i % 4) * 200, y: Math.floor(i / 4) * 130 },
    })));
  };

  // ─── AI GENERATE ────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!aiPrompt.trim()) return;
    try {
      setLoading(true);
      const res  = await generateFlow({ input: aiPrompt });
      const flow = res.data;

      const colorKeys = Object.keys(COLORS);
      // const newNodes  = flow.nodes.map((n, i) => {
      //   const key = colorKeys[i % colorKeys.length];
      //   const t   = COLORS[key];
      //   return {
      //     id:   String(n.id),
      //     type: "custom",
      //     position: { x: 180 + (i % 4) * 210, y: Math.floor(i / 4) * 140 },
      //     data: {
      //       label: n.label,
      //       shape: i === 0 ? "rounded" : i % 4 === 2 ? "diamond" : "rect",
      //       radius: i === 0 ? "999px" : i % 4 === 2 ? "4px" : "8px",
      //       bg:     t.bg,
      //       border: t.border,
      //       color:  t.text,
      //       glow:   t.glow,
      //     },
      //   };
      // });

      const newNodes = flow.nodes.map((n, i) => {
  const key = colorKeys[i % colorKeys.length];
  const t = COLORS[key];

  return {
    id: String(n.id),
    type: "custom",
    position: { x: 0, y: 0 }, // ❗ important (dagre will set)
    data: {
      label: n.label,
      shape: i === 0 ? "rounded" : i % 3 === 0 ? "diamond" : "rect",
      radius: i === 0 ? "999px" : "8px",
      bg: t.bg,
      border: t.border,
      color: t.text,
      glow: t.glow,
    },
  };
});
      const newEdges = flow.edges.map(e => ({
        id:       `e-${e.source}-${e.target}`,
        source:   String(e.source),
        target:   String(e.target),
        type:     "floating",
        animated: true,
        data:     { color: "#6366f1" },
        markerEnd: { type: "arrowclosed", color: "#6366f1", width: 16, height: 16 },
      }));
const { nodes: layoutNodes, edges: layoutEdges } =
  getLayoutedElements(newNodes, newEdges, "TB");

setNodes(layoutNodes);
setEdges(layoutEdges);
    } catch (err) {
      console.error(err);
      alert("AI generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── LOAD DEMO FLOW ─────────────────────────────────────────────────────────
  const loadKidflixDemo = () => {
    const demoNodes = [
      { id: "1",  label: "Splash",            shape: "rounded", colorKey: "slate"   },
      { id: "2",  label: "Onboarding",        shape: "rounded", colorKey: "slate"   },
      { id: "3",  label: "Already a User?",   shape: "diamond", colorKey: "teal"    },
      { id: "4",  label: "Log In",            shape: "rounded", colorKey: "rose"    },
      { id: "5",  label: "Sign Up",           shape: "rounded", colorKey: "rose"    },
      { id: "6",  label: "Mobile Login",      shape: "rect",    colorKey: "slate"   },
      { id: "7",  label: "Social Login",      shape: "rect",    colorKey: "slate"   },
      { id: "8",  label: "Mobile Sign Up",    shape: "rect",    colorKey: "slate"   },
      { id: "9",  label: "Social Sign Up",    shape: "rect",    colorKey: "slate"   },
      { id: "10", label: "Create Profile",    shape: "rect",    colorKey: "slate"   },
      { id: "11", label: "🏠 Home Page",      shape: "rounded", colorKey: "teal"    },
      { id: "12", label: "🎬 Movies",         shape: "rect",    colorKey: "rose"    },
      { id: "13", label: "📺 TV Show",        shape: "rect",    colorKey: "rose"    },
      { id: "14", label: "🎵 Listen",         shape: "rect",    colorKey: "rose"    },
      { id: "15", label: "🎮 Games",          shape: "rect",    colorKey: "rose"    },
      { id: "16", label: "Parent? Enter Passcode", shape: "diamond", colorKey: "teal" },
      { id: "17", label: "Child Profile Settings", shape: "rect", colorKey: "sky"  },
      { id: "18", label: "Subscription",     shape: "rect",    colorKey: "sky"     },
      { id: "19", label: "Content Screen",   shape: "rect",    colorKey: "indigo"  },
      { id: "20", label: "Screen Time Exceeded?", shape: "diamond", colorKey: "teal" },
      { id: "21", label: "🚪 Exit",          shape: "rounded", colorKey: "amber"   },
    ];

    const positions = [
      [370,20],[370,100],[370,195],[160,300],[580,300],
      [80,420],[80,510],[600,420],[600,510],[600,600],
      [370,680],[80,780],[230,780],[370,780],[510,780],
      [160,920],[280,1020],[480,1020],[370,1140],[370,1240],[370,1360],
    ];

    const mappedNodes = demoNodes.map((n, i) => {
      const theme = COLORS[n.colorKey];
      const shapePreset = SHAPE_PRESETS.find(s => s.id === n.shape);
      return {
        id:   n.id,
        type: "custom",
        position: { x: positions[i][0], y: positions[i][1] },
        data: {
          label:  n.label,
          shape:  n.shape,
          radius: shapePreset?.radius || "8px",
          bg:     theme.bg,
          border: theme.border,
          color:  theme.text,
          glow:   theme.glow,
        },
      };
    });

    const demoEdges = [
      ["1","2"],["2","3"],["3","4"],["3","5"],
      ["4","6"],["4","7"],["5","8"],["5","9"],["9","10"],
      ["6","11"],["7","11"],["8","11"],["10","11"],
      ["11","12"],["11","13"],["11","14"],["11","15"],
      ["11","16"],["16","17"],["16","18"],
      ["17","19"],["18","19"],["19","20"],
      ["20","21"],
    ].map(([s,t]) => ({
      id: `e-${s}-${t}`,
      source: s, target: t,
      type: "smoothstep", animated: true,
      data: { color: "#6366f1" },
      markerEnd: { type: "arrowclosed", color: "#6366f1", width: 16, height: 16 },
    }));

    setNodes(mappedNodes);
    setEdges(demoEdges)
  };

  // ─── NODE CLICK ─────────────────────────────────────────────────────────────
  const handleNodeClick = (_, n) => {
    setSelectedNode(n.id);
    setSelectedEdge(null);
    setLabel(n.data.label || "");
    setSymbol(n.data.symbol || "");
    setShape(n.data.shape || "rect");
    const matchedColor = Object.keys(COLORS).find(k => COLORS[k].bg === n.data.bg) || "teal";
    setColorKey(matchedColor);
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; }

        body {
          margin: 0;
          font-family: 'DM Sans', sans-serif;
          background: #020617;
        }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }

        .flow-sidebar::-webkit-scrollbar { width: 3px; }

        .reactflow-wrapper .react-flow__background {
          background: #030712 !important;
        }

        .react-flow__minimap {
          background: #0f172a !important;
          border: 1px solid rgba(255,255,255,0.06) !important;
          border-radius: 10px !important;
          overflow: hidden;
        }

        .react-flow__controls {
          background: #0f172a !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          border-radius: 10px !important;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,0.4) !important;
        }

        .react-flow__controls-button {
          background: transparent !important;
          border-color: rgba(255,255,255,0.08) !important;
          color: #94a3b8 !important;
          fill: #94a3b8 !important;
        }

        .react-flow__controls-button:hover {
          background: rgba(255,255,255,0.05) !important;
          color: #e2e8f0 !important;
          fill: #e2e8f0 !important;
        }

        .react-flow__edge-path {
          transition: stroke 0.2s;
        }

        .react-flow__node.selected .custom-node-wrap {
          ring: 2px;
        }

        .color-swatch {
          width: 22px; height: 22px; border-radius: 6px;
          cursor: pointer; border: 2px solid transparent;
          transition: all 0.15s; flex-shrink: 0;
        }
        .color-swatch:hover { transform: scale(1.15); }
        .color-swatch.active { border-color: #fff; transform: scale(1.1); }

        .shape-btn {
          flex: 1; padding: 6px 4px; border-radius: 7px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: #94a3b8; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 10px; font-weight: 600;
          text-align: center; transition: all 0.15s;
          display: flex; flex-direction: column;
          align-items: center; gap: 2px;
        }
        .shape-btn:hover { background: rgba(255,255,255,0.08); color: #e2e8f0; }
        .shape-btn.active {
          background: rgba(99,102,241,0.2);
          border-color: #6366f1; color: #a5b4fc;
        }

        .symbol-chip {
          width: 28px; height: 28px; border-radius: 7px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          cursor: pointer; font-size: 14px;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .symbol-chip:hover { background: rgba(255,255,255,0.1); transform: scale(1.15); }
        .symbol-chip.active {
          background: rgba(99,102,241,0.2);
          border-color: #6366f1;
        }

        .stat-pill {
          display: flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 99px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          font-size: 11px; font-weight: 600;
          color: #94a3b8; font-family: 'DM Sans', sans-serif;
        }

        .action-row {
          display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
        }

        .glow-pulse {
          animation: glowPulse 2s ease-in-out infinite;
        }
        @keyframes glowPulse {
          0%,100% { box-shadow: 0 0 8px #6366f188; }
          50%      { box-shadow: 0 0 20px #6366f1cc; }
        }
      `}</style>

      <div style={{ width: "100vw", height: "100vh", display: "flex", background: "#030712", overflow: "hidden" }}>

        {/* ─── SIDEBAR ──────────────────────────────────────────────────────── */}
        <div
          className="flow-sidebar"
          style={{
            width: 272,
            height: "100vh",
            background: "linear-gradient(180deg, #0f172a 0%, #0a1120 100%)",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            gap: 0,
            overflowY: "auto",
            flexShrink: 0,
          }}
        >
          {/* Header */}
          <div style={{
            padding: "20px 18px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: "linear-gradient(135deg, #6366f1, #0d9488)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16,
              }}>✦</div>
              <div>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: "#f1f5f9",
                  fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em",
                }}>FlowCraft</div>
                <div style={{ fontSize: 10, color: "#475569", fontWeight: 500 }}>Visual Flow Builder</div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <div className="stat-pill">
                <span style={{ color: "#6366f1", fontSize: 8 }}>●</span>
                {stats.nodes} Nodes
              </div>
              <div className="stat-pill">
                <span style={{ color: "#0d9488", fontSize: 8 }}>●</span>
                {stats.edges} Edges
              </div>
              {selectedNode && (
                <div className="stat-pill" style={{ borderColor: "#6366f1", color: "#a5b4fc" }}>
                  ✎ Editing
                </div>
              )}
            </div>
          </div>

          {/* Sections */}
          <div style={{ padding: "12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>

            {/* ── ADD / EDIT NODE ──────────────────────────────────────────── */}
            <Section title="Node" icon="◈" defaultOpen={true}>

              {/* Label */}
              <Input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Node label..."
              />

              {/* Shape */}
              <div style={{ display: "flex", gap: 5 }}>
                {SHAPE_PRESETS.map(s => (
                  <button
                    key={s.id}
                    className={`shape-btn ${shape === s.id ? "active" : ""}`}
                    onClick={() => setShape(s.id)}
                  >
                    <span style={{ fontSize: 14 }}>{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>

              {/* Colors */}
              <div>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, marginBottom: 5, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Color Palette
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {Object.entries(COLORS).map(([key, val]) => (
                    <div
                      key={key}
                      className={`color-swatch ${colorKey === key ? "active" : ""}`}
                      style={{ background: val.bg }}
                      onClick={() => setColorKey(key)}
                      title={key}
                    />
                  ))}
                </div>
              </div>

              {/* Symbols */}
              <div>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, marginBottom: 5, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Symbol (optional)
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  <div
                    className={`symbol-chip ${symbol === "" ? "active" : ""}`}
                    onClick={() => setSymbol("")}
                    style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}
                  >∅</div>
                  {NODE_SYMBOLS.map(s => (
                    <div
                      key={s}
                      className={`symbol-chip ${symbol === s ? "active" : ""}`}
                      onClick={() => setSymbol(s)}
                    >{s}</div>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <Btn onClick={addNode} color="#4f46e5">+ Add Node</Btn>
                <Btn onClick={updateNodeStyle} color="#0d9488" disabled={!selectedNode}>
                  ✎ Update
                </Btn>
              </div>
            </Section>

            {/* ── EDGE TOOLS ─────────────────────────────────────────────── */}
            <Section title="Edges" icon="⟶" defaultOpen={false}>
              <div>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, marginBottom: 5, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Edge Color
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  {["#6366f1","#0d9488","#e11d48","#d97706","#059669","#7c3aed","#0284c7"].map(c => (
                    <div
                      key={c}
                      className={`color-swatch ${edgeColor === c ? "active" : ""}`}
                      style={{ background: c, width: 20, height: 20 }}
                      onClick={() => setEdgeColor(c)}
                    />
                  ))}
                </div>
              </div>

              <label style={{
                display: "flex", alignItems: "center", gap: 8,
                cursor: "pointer", fontSize: 12, color: "#94a3b8",
                fontFamily: "'DM Sans', sans-serif",
              }}>
                <input
                  type="checkbox"
                  checked={dashedEdge}
                  onChange={e => setDashedEdge(e.target.checked)}
                  style={{ accentColor: "#6366f1" }}
                />
                Dashed edge style
              </label>

              <Btn
                onClick={() => setEdges(eds => eds.map(e => ({ ...e, animated: !e.animated })))}
                color="#0284c7"
              >
                ⟳ Toggle Animation
              </Btn>
              <Btn onClick={() => setEdges([])} color="#475569">✕ Clear Edges</Btn>
            </Section>

            {/* ── ACTIONS ────────────────────────────────────────────────── */}
            <Section title="Actions" icon="⚙" defaultOpen={false}>
              <div className="action-row">
                <Btn onClick={deleteSelected} color="#be123c" disabled={!selectedNode && !selectedEdge}>
                  🗑 Delete
                </Btn>
                <Btn onClick={duplicateNode} color="#b45309" disabled={!selectedNode}>
                  ⎘ Duplicate
                </Btn>
              </div>
              <Btn onClick={autoLayout} color="#4f46e5">
                ⊞ Auto Layout
              </Btn>
              <Btn onClick={() => { setNodes([]); setEdges([]); }} color="#334155">
                ✕ Clear All
              </Btn>
            </Section>

            {/* ── AI GENERATOR ───────────────────────────────────────────── */}
            <Section title="AI Generator" icon="⚡" defaultOpen={false}>
              <Input
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="e.g. e-commerce checkout flow..."
                multiline
              />
              <Btn
                onClick={handleGenerate}
                color={loading ? "#1e293b" : "#7c3aed"}
                disabled={loading}
                style={loading ? {} : { animation: "none" }}
              >
                {loading ? "⏳ Generating..." : "⚡ Generate with AI"}
              </Btn>
            </Section>

            {/* ── DEMO ───────────────────────────────────────────────────── */}
            <Section title="Examples" icon="★" defaultOpen={false}>
              <Btn onClick={loadKidflixDemo} color="#0d9488">
                📱 Load Kidflix Flow
              </Btn>
            </Section>

          </div>

          {/* Footer */}
          <div style={{
            marginTop: "auto",
            padding: "12px 16px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            fontSize: 10, color: "#334155", textAlign: "center",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 500, flexShrink: 0,
          }}>
            Drag handles between nodes to connect · Click nodes to select
          </div>
        </div>

        {/* ─── CANVAS ───────────────────────────────────────────────────────── */}
        <div className="reactflow-wrapper" style={{ flex: 1, position: "relative", background: "#030712" }}>

          {/* Decorative Background Glow */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
            background: `
              radial-gradient(ellipse 60% 40% at 30% 20%, rgba(99,102,241,0.06) 0%, transparent 60%),
              radial-gradient(ellipse 50% 35% at 75% 70%, rgba(13,148,136,0.05) 0%, transparent 60%)
            `,
          }} />

          {/* Empty state */}
          {nodes.length === 0 && (
            <div style={{
              position: "absolute", inset: 0, display: "flex",
              flexDirection: "column", alignItems: "center", justifyContent: "center",
              pointerEvents: "none", zIndex: 1,
            }}>
              <div style={{
                fontSize: 48, marginBottom: 12,
                filter: "drop-shadow(0 0 24px rgba(99,102,241,0.4))",
              }}>✦</div>
              <div style={{
                fontSize: 20, fontWeight: 700, color: "#1e293b",
                fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em",
              }}>Start Building Your Flow</div>
              <div style={{ fontSize: 13, color: "#1e293b", marginTop: 6, fontWeight: 400 }}>
                Add nodes from the sidebar · Try the Kidflix demo
              </div>
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
            onNodeClick={handleNodeClick}
            onEdgeClick={(_, e) => { setSelectedEdge(e.id); setSelectedNode(null); }}
            onPaneClick={() => { setSelectedNode(null); setSelectedEdge(null); }}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            style={{ background: "transparent" }}
          >
            <Background
              variant="dots"
              gap={24}
              size={1}
              color="rgba(148,163,184,0.12)"
            />
            <Controls />
            <MiniMap
              nodeColor={n => n.data?.bg || "#334155"}
              maskColor="rgba(3,7,18,0.8)"
              nodeStrokeWidth={0}
            />

            {/* Top-right badge */}
            <Panel position="top-right">
              <div style={{
                display: "flex", gap: 6, alignItems: "center",
                padding: "6px 12px",
                background: "rgba(15,23,42,0.8)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 99,
              }}>
                <span style={{ fontSize: 8, color: "#22c55e" }}>●</span>
                <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
                  {stats.nodes} nodes · {stats.edges} edges
                </span>
              </div>
            </Panel>

            {/* Hint bar at bottom center */}
            <Panel position="bottom-center">
              {selectedNode && (
                <div style={{
                  padding: "6px 16px",
                  background: "rgba(79,70,229,0.15)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(99,102,241,0.3)",
                  borderRadius: 99,
                  fontSize: 11, color: "#a5b4fc",
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
                  letterSpacing: "0.02em",
                }}>
                  ✎ Node selected — edit in sidebar then click Update
                </div>
              )}
            </Panel>
          </ReactFlow>
        </div>
      </div>
    </>
  );
}