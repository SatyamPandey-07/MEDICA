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

    // Color definitions — vivid neobrutalist palette visible on light/cream background
    const colors: Record<string, { fill: string; stroke: string; glow: string }> = {
      cancer:    { fill: "#7C3AED", stroke: "#000000", glow: "rgba(124,58,237,0.25)" }, // Bold violet
      drug:      { fill: "#0EA5E9", stroke: "#000000", glow: "rgba(14,165,233,0.25)" }, // Vivid sky blue
      biomarker: { fill: "#10B981", stroke: "#000000", glow: "rgba(16,185,129,0.25)" }, // Bright emerald
      treatment: { fill: "#F59E0B", stroke: "#000000", glow: "rgba(245,158,11,0.25)" }, // Vibrant amber
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

      // ── Background: warm cream with subtle dot grid ──
      ctx.fillStyle = "#FAF8F5";
      ctx.fillRect(0, 0, w, h);
      // Dot grid pattern
      const gridSpacing = 28;
      ctx.fillStyle = "rgba(0,0,0,0.06)";
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
          ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
          ctx.lineWidth = 2;
        } else {
          ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
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

        // Outer glow (light shadow on cream bg)
        if (isHovered || isSelected) {
          ctx.shadowBlur = 18;
          ctx.shadowColor = c.fill;
        } else {
          ctx.shadowBlur = 0;
        }

        // Node circle
        ctx.fillStyle = c.fill;
        ctx.strokeStyle = isHovered || isSelected ? "#000000" : "#000000";
        ctx.lineWidth = isHovered || isSelected ? 3 : 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Label
        ctx.fillStyle = isHovered || isSelected ? "#000000" : "#333333";
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
      {/* Header buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Rebuild button */}
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 20px", borderRadius: "9999px", cursor: rebuilding ? "not-allowed" : "pointer",
              background: "#FFE57F",
              border: "3px solid #000000",
              color: "#000000", fontSize: 12, fontWeight: 800,
              boxShadow: rebuilding ? "none" : "4px 4px 0px #000000",
              transition: "all 0.15s ease", opacity: rebuilding ? 0.6 : 1,
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}
            title="Rebuild graph from all indexed papers"
          >
            <Sparkles style={{ width: 13, height: 13, animation: rebuilding ? "spin 1s linear infinite" : "none" }} />
            {rebuilding ? "Building..." : "Rebuild Graph"}
          </button>

          {/* Reload button */}
          <button
            onClick={loadGraph}
            style={{
              width: 36, height: 36, borderRadius: "9999px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "#FFFFFF",
              border: "3px solid #000000",
              color: "#000000",
              boxShadow: "3px 3px 0px #000000",
              transition: "all 0.15s ease",
            }}
            title="Reload Graph"
          >
            <RefreshCw style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </header>

      {/* Rebuild status message */}
      {rebuildMsg && (
        <div style={{
          margin: "0 32px", padding: "14px 22px", borderRadius: 16,
          background: rebuildMsg.ok ? "#E0F2F1" : "#FFEBEE",
          border: `3px solid ${rebuildMsg.ok ? "#004D40" : "#B71C1C"}`,
          color: rebuildMsg.ok ? "#004D40" : "#B71C1C",
          fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700,
          boxShadow: `4px 4px 0px ${rebuildMsg.ok ? "#004D40" : "#B71C1C"}`,
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
            {/* Physics canvas — warm cream background applied in canvas draw loop */}
            <div style={{
              flex: 1, height: "100%", position: "relative", overflow: "hidden",
              background: "#FAF8F5",
              border: "3px solid #000000",
              borderRadius: 20,
              margin: 20,
              boxShadow: "8px 8px 0px #000000",
            }}>
              {/* Legend HUD — neobrutalist card */}
              <div style={{
                position: "absolute", top: 20, left: 20, zIndex: 10,
                padding: "18px 22px", borderRadius: 16,
                background: "#FFFFFF",
                border: "3px solid #000000",
                boxShadow: "4px 4px 0px #000000",
                pointerEvents: "none",
              }}>
                <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#000000", fontWeight: 800, marginBottom: 12, display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  <Info style={{ width: 12, height: 12, color: "#7C3AED" }} />
                  Map Key
                </div>
                {[
                  { label: "Cancer Types",      dot: "#7C3AED" },
                  { label: "Drugs / Inhibitors", dot: "#0EA5E9" },
                  { label: "Biomarkers / Genes", dot: "#10B981" },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#000000", fontWeight: 600 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: item.dot, flexShrink: 0, border: "2px solid #000000" }} />
                    {item.label}
                  </div>
                ))}
                <div style={{ fontSize: 9, color: "#555555", fontFamily: "'JetBrains Mono', monospace", borderTop: "2px solid #000000", paddingTop: 10, marginTop: 6, lineHeight: 1.8 }}>
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

            {/* Node detail drawer — neobrutalist white card */}
            {selectedNode && (
              <div style={{
                width: 320, flexShrink: 0, zIndex: 10,
                borderLeft: "none",
                background: "#FFFFFF",
                border: "3px solid #000000",
                borderRadius: 20,
                boxShadow: "8px 8px 0px #000000",
                margin: 20,
                marginLeft: 0,
                overflowY: "auto", padding: 28,
              }}>
                <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: "3px solid #000000" }}>
                  <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", color: "#7C3AED", textTransform: "uppercase", marginBottom: 10, fontWeight: 700 }}>
                    {typeLabels[selectedNode.type] || "Node Entity"}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "#000000", lineHeight: 1.35, marginBottom: 14, letterSpacing: "-0.02em" }}>
                    {selectedNode.label}
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#444444", fontWeight: 600 }}>
                    <Activity style={{ width: 14, height: 14, color: "#10B981" }} />
                    Active in <strong style={{ color: "#000000", marginLeft: 4 }}>{selectedNode.papers_count}</strong>&nbsp;clinical trials
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", color: "#555555", textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>
                    Associated Knowledge
                  </div>
                  <div style={{
                    padding: "18px 20px", borderRadius: 16,
                    border: "3px solid #000000",
                    background: "#FAF8F5",
                    fontSize: 12, color: "#333333", lineHeight: 1.7,
                    boxShadow: "3px 3px 0px #000000",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 16, color: "#000000", fontWeight: 600 }}>
                      <Info style={{ width: 13, height: 13, color: "#7C3AED", marginTop: 2, flexShrink: 0 }} />
                      Explore papers matching this node in the Knowledge Explorer.
                    </div>
                    <a
                      href={`/explorer`}
                      style={{
                        display: "block", textAlign: "center",
                        padding: "10px 0", borderRadius: 9999, textDecoration: "none",
                        background: "#FFE57F",
                        border: "3px solid #000000",
                        color: "#000000", fontSize: 12, fontWeight: 800,
                        boxShadow: "3px 3px 0px #000000",
                        letterSpacing: "0.05em", textTransform: "uppercase",
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
