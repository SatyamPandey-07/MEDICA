"use client";

import React, { useEffect, useRef, useState } from "react";
import { GitBranch, Activity, Info, RefreshCw, Database, Sparkles } from "lucide-react";
import { getGraphNetwork, rebuildKnowledgeGraph } from "@/lib/api";

interface Node {
  id: string;
  label: string;
  type: string;
  papers_count: number;
  // Physics properties
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface Edge {
  source: string;
  target: string;
}

export default function CitationGraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasGraphNodes, setHasGraphNodes] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildMsg, setRebuildMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Instantiated physics nodes and edges
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const animationRef = useRef<number | null>(null);
  const dragNodeRef = useRef<Node | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  // Load knowledge graph data
  const loadGraph = async () => {
    setLoading(true);
    try {
      const data = await getGraphNetwork();

      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      const width = rect?.width && rect.width > 100 ? rect.width : 800;
      const height = rect?.height && rect.height > 100 ? rect.height : 500;
      
      const initializedNodes = data.nodes.map((n, idx: number) => {
        // Place in a circle layout initially
        const angle = (idx / data.nodes.length) * Math.PI * 2;
        const radius = 12 + Math.min(n.papers_count * 2, 10);
        return {
          ...n,
          x: width / 2 + Math.cos(angle) * 150 + (Math.random() - 0.5) * 50,
          y: height / 2 + Math.sin(angle) * 150 + (Math.random() - 0.5) * 50,
          vx: 0,
          vy: 0,
          radius,
        };
      });

      nodesRef.current = initializedNodes;
      edgesRef.current = data.edges;
      setHasGraphNodes(initializedNodes.length > 0);
    } catch (e) {
      console.error("Failed loading graph network:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadGraph();
    });
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const handleRebuild = async () => {
    if (rebuilding) return;
    setRebuilding(true);
    setRebuildMsg(null);
    try {
      const res = await rebuildKnowledgeGraph();
      if (res.nodes === 0) {
        setRebuildMsg({ ok: false, text: "No papers in database yet. Run an ingestion job from System Operator first." });
      } else {
        setRebuildMsg({ ok: true, text: `Graph built: ${res.nodes} nodes, ${res.edges} edges from ${res.papers_processed} papers.` });
        await loadGraph();
      }
    } catch (e: unknown) {
      setRebuildMsg({ ok: false, text: e instanceof Error ? e.message : "Rebuild failed." });
    } finally {
      setRebuilding(false);
    }
  };

  // Run Physics & Drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || loading || nodesRef.current.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize handler
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Color definitions — sleek light mode palette
    const colors: Record<string, { fill: string; stroke: string; glow: string }> = {
      cancer:    { fill: "#4f46e5", stroke: "#c7d2fe", glow: "rgba(79,70,229,0.15)" }, // Indigo
      drug:      { fill: "#0284c7", stroke: "#bae6fd", glow: "rgba(2,132,199,0.15)" }, // Sky
      biomarker: { fill: "#059669", stroke: "#a7f3d0", glow: "rgba(5,150,105,0.15)" }, // Emerald
      treatment: { fill: "#d97706", stroke: "#fde68a", glow: "rgba(217,119,6,0.15)" }, // Amber
    };

    // Main Physics loop (simple Verlet force-directed)
    const tick = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;

      // 1. Physics Calculations
      // Pull nodes to center
      const gravity = 0.05;
      for (const n of nodes) {
        n.vx += (w / 2 - n.x) * gravity * 0.1;
        n.vy += (h / 2 - n.y) * gravity * 0.1;
      }

      // Repulsion force between all nodes (charge)
      const charge = 800;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          if (dist < 250) {
            const force = charge / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (n1 !== dragNodeRef.current) {
              n1.vx -= fx;
              n1.vy -= fy;
            }
            if (n2 !== dragNodeRef.current) {
              n2.vx += fx;
              n2.vy += fy;
            }
          }
        }
      }

      // Attraction force along edges (springs)
      const springLength = 80;
      const springStrength = 0.06;
      for (const edge of edges) {
        const n1 = nodes.find((n) => n.id === edge.source);
        const n2 = nodes.find((n) => n.id === edge.target);
        if (!n1 || !n2) continue;

        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const force = (dist - springLength) * springStrength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (n1 !== dragNodeRef.current) {
          n1.vx += fx;
          n1.vy += fy;
        }
        if (n2 !== dragNodeRef.current) {
          n2.vx -= fx;
          n2.vy -= fy;
        }
      }

      // Apply drag node constraint
      if (dragNodeRef.current) {
        dragNodeRef.current.x = mouseRef.current.x;
        dragNodeRef.current.y = mouseRef.current.y;
        dragNodeRef.current.vx = 0;
        dragNodeRef.current.vy = 0;
      }

      // Update positions & velocity damping (friction)
      const damping = 0.85;
      for (const n of nodes) {
        if (n === dragNodeRef.current) continue;
        n.x += n.vx;
        n.y += n.vy;
        n.vx *= damping;
        n.vy *= damping;

        // Keep inside canvas bounds
        n.x = Math.max(n.radius, Math.min(w - n.radius, n.x));
        n.y = Math.max(n.radius, Math.min(h - n.radius, n.y));
      }

      // 2. Drawing
      ctx.clearRect(0, 0, w, h);

      // ── Background: clean light canvas with subtle dot grid ──
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      // Dot grid pattern
      const gridSpacing = 28;
      ctx.fillStyle = "rgba(9,9,11,0.03)";
      for (let gx = 0; gx < w; gx += gridSpacing) {
        for (let gy = 0; gy < h; gy += gridSpacing) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Edges
      ctx.lineWidth = 1;
      for (const edge of edges) {
        const n1 = nodes.find((n) => n.id === edge.source);
        const n2 = nodes.find((n) => n.id === edge.target);
        if (!n1 || !n2) continue;

        const isHoveredEdge = hoveredNode && (hoveredNode.id === n1.id || hoveredNode.id === n2.id);
        const isSelectedEdge = selectedNode && (selectedNode.id === n1.id || selectedNode.id === n2.id);

        if (isHoveredEdge || isSelectedEdge) {
          ctx.strokeStyle = "rgba(9, 9, 11, 0.25)";
          ctx.lineWidth = 2;
        } else {
          ctx.strokeStyle = "rgba(9, 9, 11, 0.05)";
          ctx.lineWidth = 1;
        }

        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.stroke();
      }

      // Draw Nodes
      for (const n of nodes) {
        const c = colors[n.type] || colors.cancer;
        const isHovered = hoveredNode?.id === n.id;
        const isSelected = selectedNode?.id === n.id;

        // Outer glow
        if (isHovered || isSelected) {
          ctx.shadowBlur = 24;
          ctx.shadowColor = c.fill;
        } else {
          ctx.shadowBlur = 8;
          ctx.shadowColor = "rgba(0,0,0,0.5)";
        }

        // Node circle
        ctx.fillStyle = c.fill;
        ctx.strokeStyle = isHovered || isSelected ? "#09090b" : c.stroke;
        ctx.lineWidth = isHovered || isSelected ? 2 : 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Label
        ctx.fillStyle = isHovered || isSelected ? "#09090b" : "#71717a";
        ctx.font = isHovered || isSelected ? "500 11px Inter" : "10px Inter";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(n.label, n.x, n.y + n.radius + 6);
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [loading, selectedNode, hoveredNode]);

  // Mouse handlers for dragging/clicking nodes
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    // Scale coordinate space matching layout size
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    // Find if clicked a node
    const clicked = nodesRef.current.find((n) => {
      const dx = n.x - pos.x;
      const dy = n.y - pos.y;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 6;
    });

    if (clicked) {
      dragNodeRef.current = clicked;
      setSelectedNode(clicked);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    mouseRef.current = pos;

    // Detect hover
    const hover = nodesRef.current.find((n) => {
      const dx = n.x - pos.x;
      const dy = n.y - pos.y;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 6;
    });

    setHoveredNode(hover || null);
  };

  const handleMouseUp = () => {
    dragNodeRef.current = null;
  };

  const typeLabels: Record<string, string> = {
    cancer: "Cancer Type",
    drug: "Targeted Therapeutic",
    biomarker: "Biomarker Mutation",
    treatment: "Treatment Class",
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-50">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600">
            <GitBranch className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-zinc-800 tracking-wide">
              Citation Graph Network
            </div>
            <div className="text-[10px] font-mono tracking-widest text-zinc-450 uppercase">
              Oncology Entity Physics Map
            </div>
          </div>
        </div>
      {/* Header buttons */}
        <div className="flex items-center gap-3">
          {/* Rebuild button */}
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            title="Rebuild graph from all indexed papers"
          >
            <Sparkles className={`w-3.5 h-3.5 ${rebuilding ? 'animate-spin' : ''}`} />
            {rebuilding ? "Building..." : "Rebuild Graph"}
          </button>

          {/* Reload button */}
          <button
            onClick={loadGraph}
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-550 hover:text-zinc-800 transition-all shadow-sm"
            title="Reload Graph"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Rebuild status message */}
      {rebuildMsg && (
        <div className="px-8 pt-6">
          <div className={`px-4 py-3 rounded-xl border font-mono text-xs font-semibold tracking-wide ${
            rebuildMsg.ok ? "bg-emerald-50 border-emerald-250 text-emerald-800" : "bg-red-50 border-red-250 text-red-800"
          }`}>
            {rebuildMsg.text}
          </div>
        </div>
      )}

      {/* Main split view */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center animate-fade-in">
              <GitBranch className="w-8 h-8 text-indigo-600/50 mx-auto mb-4 animate-pulse" />
              <p className="text-[11px] font-mono tracking-widest uppercase text-zinc-500 font-semibold">Mapping molecular graph nodes...</p>
            </div>
          </div>
        ) : !hasGraphNodes ? (
          /* ── EMPTY STATE ── */
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-md animate-fade-in">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-6 bg-indigo-50 border border-indigo-200 shadow-sm">
                <Database className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold tracking-tight mb-3 text-zinc-800">
                Graph is Empty
              </h2>
              <p className="text-[13px] text-zinc-500 leading-relaxed mb-8">
                The knowledge graph has no nodes yet. Click <strong className="text-indigo-600">Rebuild Graph</strong> to extract
                cancer, drug, and biomarker entities from all papers already in your database.
                Or go to <strong className="text-zinc-700">System Operator</strong> to ingest papers first.
              </p>
              <button
                onClick={handleRebuild}
                disabled={rebuilding}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold transition-all shadow-lg shadow-indigo-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className={`w-4 h-4 ${rebuilding ? 'animate-spin' : ''}`} />
                {rebuilding ? "Building graph..." : "Rebuild Graph Now"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Physics canvas */}
            <div className="flex-1 h-full relative overflow-hidden bg-white border border-zinc-200 rounded-2xl m-6 shadow-sm">
              {/* Legend HUD */}
              <div className="absolute top-6 left-6 z-10 px-5 py-4 rounded-xl bg-white/95 backdrop-blur border border-zinc-200 pointer-events-none shadow-md">
                <div className="text-[10px] font-mono font-semibold text-zinc-850 mb-3 flex items-center gap-2 tracking-widest uppercase">
                  <Info className="w-3.5 h-3.5 text-indigo-650" />
                  Map Key
                </div>
                {[
                  { label: "Cancer Types",      dot: "#4f46e5" },
                  { label: "Drugs / Inhibitors", dot: "#0284c7" },
                  { label: "Biomarkers / Genes", dot: "#059669" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 mb-2 text-[10px] font-mono text-zinc-555 font-medium tracking-wide">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_8px_currentColor]" style={{ background: item.dot, color: item.dot }} />
                    {item.label}
                  </div>
                ))}
                <div className="text-[9px] text-zinc-400 font-mono border-t border-zinc-200 pt-3 mt-3 leading-relaxed">
                  * Drag nodes to adjust physics<br />* Click a node to inspect it
                </div>
              </div>

              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="w-full h-full cursor-grab active:cursor-grabbing"
              />
            </div>

            {/* Node detail drawer */}
            {selectedNode && (
              <div className="w-80 shrink-0 z-10 bg-white border border-zinc-200 rounded-2xl shadow-sm m-6 ml-0 overflow-y-auto p-6 animate-fade-in flex flex-col">
                <div className="mb-6 pb-6 border-b border-zinc-200">
                  <div className="text-[10px] font-mono tracking-widest text-indigo-650 uppercase mb-3 font-semibold">
                    {typeLabels[selectedNode.type] || "Node Entity"}
                  </div>
                  <h3 className="text-xl font-bold text-zinc-800 leading-snug mb-4 tracking-tight">
                    {selectedNode.label}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-medium">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    Active in <strong className="text-zinc-800">{selectedNode.papers_count}</strong> clinical trials
                  </div>
                </div>

                <div className="flex-1">
                  <div className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase mb-4 font-semibold">
                    Associated Knowledge
                  </div>
                  <div className="p-5 rounded-xl border border-zinc-200 bg-zinc-50">
                    <div className="flex items-start gap-3 mb-5 text-[11px] text-zinc-500 leading-relaxed font-medium">
                      <Info className="w-4 h-4 text-indigo-650 mt-0.5 shrink-0" />
                      Explore papers matching this node in the Knowledge Explorer.
                    </div>
                    <a
                      href={`/explorer?q=${encodeURIComponent(selectedNode.label)}`}
                      className="block text-center py-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-650 text-xs font-semibold tracking-wide uppercase hover:bg-indigo-100 transition-all"
                    >
                      Open Explorer →
                    </a>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
