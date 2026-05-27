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
  const [network, setNetwork] = useState<{ nodes: any[]; edges: any[] } | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(true);
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
      setNetwork(data);

      // Initialize nodes with positions
      const width = 800;
      const height = 500;
      
      const initializedNodes = data.nodes.map((n: any, idx: number) => {
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
    } catch (e) {
      console.error("Failed loading graph network:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
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
    } catch (e: any) {
      setRebuildMsg({ ok: false, text: e.message || "Rebuild failed." });
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

    // Color definitions
    const colors: Record<string, { fill: string; stroke: string; glow: string }> = {
      cancer: { fill: "#4c1d95", stroke: "#a78bfa", glow: "rgba(167, 139, 250, 0.4)" }, // Violet
      drug: { fill: "#1e3a8a", stroke: "#60a5fa", glow: "rgba(96, 165, 250, 0.4)" },    // Blue
      biomarker: { fill: "#064e3b", stroke: "#34d399", glow: "rgba(52, 211, 153, 0.4)" }, // Emerald
      treatment: { fill: "#78350f", stroke: "#fbbf24", glow: "rgba(251, 191, 36, 0.4)" }, // Amber
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

      // 2. Drawing Calculations
      ctx.clearRect(0, 0, w, h);

      // Draw Edges (Glow and Lines)
      ctx.lineWidth = 1;
      for (const edge of edges) {
        const n1 = nodes.find((n) => n.id === edge.source);
        const n2 = nodes.find((n) => n.id === edge.target);
        if (!n1 || !n2) continue;

        // Highlight active connections
        const isHoveredEdge = hoveredNode && (hoveredNode.id === n1.id || hoveredNode.id === n2.id);
        const isSelectedEdge = selectedNode && (selectedNode.id === n1.id || selectedNode.id === n2.id);

        if (isHoveredEdge || isSelectedEdge) {
          ctx.strokeStyle = "rgba(167, 139, 250, 0.4)";
          ctx.lineWidth = 1.5;
        } else {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
          ctx.lineWidth = 0.8;
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

        // Node Glow Shadow
        if (isHovered || isSelected) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = c.stroke;
        } else {
          ctx.shadowBlur = 0;
        }

        // Draw outer node border circle
        ctx.fillStyle = c.fill;
        ctx.strokeStyle = isHovered || isSelected ? "#ffffff" : c.stroke;
        ctx.lineWidth = isHovered || isSelected ? 2 : 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0; // Reset shadow

        // Label details text
        ctx.fillStyle = isHovered || isSelected ? "#ffffff" : "#94a3b8";
        ctx.font = isHovered || isSelected ? "bold 10px Inter" : "9px Inter";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(n.label, n.x, n.y + n.radius + 5);
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, hsl(174 80% 36%), hsl(196 80% 46%))",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <GitBranch style={{ width: 14, height: 14, color: "white" }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(220 20% 97%)", letterSpacing: "0.03em" }}>
              Citation Graph Network
            </div>
            <div style={{ fontSize: 10, color: "hsl(220 8% 40%)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>
              ONCOLOGY ENTITY PHYSICS MAP
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Rebuild button */}
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "6px 12px", borderRadius: 8, cursor: rebuilding ? "not-allowed" : "pointer",
              background: "linear-gradient(135deg, hsl(174 80% 30%), hsl(196 80% 36%))",
              border: "none", color: "white", fontSize: 11, fontWeight: 600,
              boxShadow: rebuilding ? "none" : "0 2px 12px hsl(174 70% 30% / 0.35)",
              transition: "all 0.15s ease", opacity: rebuilding ? 0.6 : 1,
            }}
            title="Rebuild graph from all indexed papers"
          >
            <Sparkles style={{ width: 12, height: 12, animation: rebuilding ? "spin 1s linear infinite" : "none" }} />
            {rebuilding ? "Building..." : "Rebuild Graph"}
          </button>

          {/* Reload button */}
          <button
            onClick={loadGraph}
            style={{
              width: 30, height: 30, borderRadius: 8, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "hsl(240 8% 8%)", border: "1px solid hsl(240 8% 14%)",
              color: "hsl(220 8% 45%)", transition: "all 0.15s ease",
            }}
            title="Reload Graph"
          >
            <RefreshCw style={{ width: 13, height: 13 }} />
          </button>
        </div>
      </header>

      {/* Rebuild status message */}
      {rebuildMsg && (
        <div style={{
          margin: "0 24px", padding: "10px 16px", borderRadius: 8,
          background: rebuildMsg.ok ? "hsl(174 60% 9%)" : "hsl(0 50% 10%)",
          border: `1px solid ${rebuildMsg.ok ? "hsl(174 60% 20%)" : "hsl(0 50% 20%)"}`,
          color: rebuildMsg.ok ? "hsl(174 80% 52%)" : "hsl(0 70% 60%)",
          fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
        }}>
          {rebuildMsg.text}
        </div>
      )}

      {/* Main split view */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden", position: "relative" }}>
        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <GitBranch style={{ width: 28, height: 28, color: "hsl(262 83% 65%)", margin: "0 auto 12px", animation: "spin 1.5s linear infinite" }} />
              <p style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "hsl(220 8% 35%)" }}>Mapping molecular graph nodes...</p>
            </div>
          </div>
        ) : nodesRef.current.length === 0 ? (
          /* ── EMPTY STATE ── */
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", maxWidth: 420 }}>
              <div style={{
                display: "inline-flex", width: 56, height: 56, borderRadius: 16, marginBottom: 20,
                background: "linear-gradient(135deg, hsl(174 80% 20%), hsl(196 80% 25%))",
                alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 32px hsl(174 70% 20% / 0.3)",
              }}>
                <Database style={{ width: 24, height: 24, color: "hsl(174 80% 55%)" }} />
              </div>
              <h2 style={{
                fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 10,
                color: "hsl(220 20% 90%)",
              }}>
                Graph is Empty
              </h2>
              <p style={{ fontSize: 12, color: "hsl(220 8% 42%)", lineHeight: 1.7, marginBottom: 24 }}>
                The knowledge graph has no nodes yet. Click <strong style={{ color: "hsl(174 80% 52%)" }}>Rebuild Graph</strong> to extract
                cancer, drug, and biomarker entities from all papers already in your database.
                Or go to <strong style={{ color: "hsl(220 15% 75%)" }}>System Operator</strong> to ingest papers first.
              </p>
              <button
                onClick={handleRebuild}
                disabled={rebuilding}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "11px 22px", borderRadius: 10, cursor: rebuilding ? "not-allowed" : "pointer",
                  background: "linear-gradient(135deg, hsl(174 80% 35%), hsl(196 80% 42%))",
                  border: "none", color: "white", fontSize: 13, fontWeight: 600,
                  boxShadow: "0 4px 20px hsl(174 70% 30% / 0.4)",
                  opacity: rebuilding ? 0.6 : 1,
                }}
              >
                <Sparkles style={{ width: 15, height: 15, animation: rebuilding ? "spin 1s linear infinite" : "none" }} />
                {rebuilding ? "Building graph..." : "Rebuild Graph Now"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Physics canvas */}
            <div style={{ flex: 1, height: "100%", position: "relative", overflow: "hidden",
              background: "radial-gradient(ellipse at 40% 40%, hsl(262 50% 6%) 0%, hsl(240 12% 2%) 100%)" }}>
              {/* Legend HUD */}
              <div style={{
                position: "absolute", top: 20, left: 20, zIndex: 10,
                padding: "14px 16px", borderRadius: 12,
                background: "hsl(240 10% 5% / 0.9)", backdropFilter: "blur(16px)",
                border: "1px solid hsl(240 8% 12%)",
                pointerEvents: "none",
              }}>
                <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "hsl(220 20% 80%)", fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <Info style={{ width: 12, height: 12, color: "hsl(262 83% 68%)" }} />
                  MAP KEY
                </div>
                {[
                  { label: "Cancer Types", dot: "hsl(262 50% 55%)" },
                  { label: "Drugs / Inhibitors", dot: "hsl(217 91% 58%)" },
                  { label: "Biomarkers / Genes", dot: "hsl(150 76% 46%)" },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "hsl(220 8% 45%)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.dot, flexShrink: 0, boxShadow: `0 0 6px ${item.dot}` }} />
                    {item.label}
                  </div>
                ))}
                <div style={{ fontSize: 9, color: "hsl(220 8% 28%)", fontFamily: "'JetBrains Mono', monospace", borderTop: "1px solid hsl(240 8% 10%)", paddingTop: 8, marginTop: 4, lineHeight: 1.7 }}>
                  * Drag nodes to adjust physics<br />* Click a node to inspect it
                </div>
              </div>

              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ width: "100%", height: "100%", cursor: "grab" }}
              />
            </div>

            {/* Node detail drawer */}
            {selectedNode && (
              <div style={{
                width: 300, flexShrink: 0, zIndex: 10,
                borderLeft: "1px solid hsl(240 8% 10%)",
                background: "hsl(240 10% 4%)",
                overflowY: "auto", padding: 24,
              }}>
                <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid hsl(240 8% 9%)" }}>
                  <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", color: "hsl(262 83% 65%)", textTransform: "uppercase", marginBottom: 8 }}>
                    {typeLabels[selectedNode.type] || "Node Entity"}
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "hsl(220 20% 95%)", lineHeight: 1.4, marginBottom: 12, letterSpacing: "-0.01em" }}>
                    {selectedNode.label}
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "hsl(220 8% 45%)" }}>
                    <Activity style={{ width: 13, height: 13, color: "hsl(150 76% 50%)" }} />
                    Active in <strong style={{ color: "hsl(220 20% 92%)", marginLeft: 4 }}>{selectedNode.papers_count}</strong>&nbsp;clinical trials
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", color: "hsl(220 8% 30%)", textTransform: "uppercase", marginBottom: 12 }}>
                    Associated Knowledge
                  </div>
                  <div style={{
                    padding: 14, borderRadius: 10,
                    border: "1px solid hsl(240 8% 12%)",
                    background: "hsl(240 8% 7%)",
                    fontSize: 12, color: "hsl(220 8% 50%)", lineHeight: 1.6,
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12, color: "hsl(220 15% 80%)" }}>
                      <Info style={{ width: 13, height: 13, color: "hsl(262 83% 65%)", marginTop: 2, flexShrink: 0 }} />
                      Explore papers matching this node in the Knowledge Explorer.
                    </div>
                    <a
                      href={`/explorer`}
                      style={{
                        display: "block", textAlign: "center",
                        padding: "8px 0", borderRadius: 8, textDecoration: "none",
                        background: "hsl(262 50% 18%)", border: "1px solid hsl(262 50% 28%)",
                        color: "hsl(262 83% 72%)", fontSize: 11, fontWeight: 500,
                      }}
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
