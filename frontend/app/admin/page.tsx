"use client";

import React, { useEffect, useState } from "react";
import {
  Cpu,
  Play,
  Activity,
  Terminal,
  Search,
  CheckCircle,
  XCircle,
  RefreshCw,
  Zap,
  Database,
  Clock,
} from "lucide-react";

import { listIngestionJobs, triggerIngestionJob, triggerOptimization } from "@/lib/api";
import { IngestionJob } from "@/lib/types";

export default function AdminDashboardPage() {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [triggerMsg, setTriggerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadJobs = async () => {
    try { setJobs(await listIngestionJobs()); } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const init = async () => { setLoading(true); await loadJobs(); setLoading(false); };
    init();
    const iv = setInterval(loadJobs, 4000);
    return () => clearInterval(iv);
  }, []);

  const handleTriggerIngestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || submitting) return;
    setSubmitting(true);
    setTriggerMsg(null);
    try {
      const res = await triggerIngestionJob(query, limit);
      setTriggerMsg({ type: "success", text: res.message });
      setQuery("");
      await loadJobs();
    } catch (err: any) {
      setTriggerMsg({ type: "error", text: err.message || "Failed to trigger ingestion." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTriggerOptimize = async () => {
    if (optimizing) return;
    setOptimizing(true);
    try {
      const res = await triggerOptimization();
      setTriggerMsg({ type: "success", text: res.message });
    } catch (err: any) {
      setTriggerMsg({ type: "error", text: `Optimization failed: ${err.message}` });
    } finally {
      setOptimizing(false);
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; border: string; icon: JSX.Element }> = {
      done:    { bg: "#D1FAE5", color: "#000000", border: "#000000", icon: <CheckCircle style={{ width: 10, height: 10 }} /> },
      running: { bg: "#EDE9FE", color: "#000000", border: "#000000", icon: <Activity style={{ width: 10, height: 10 }} /> },
      failed:  { bg: "#FFE4E6", color: "#000000", border: "#000000", icon: <XCircle style={{ width: 10, height: 10 }} /> },
      pending: { bg: "#F3F4F6", color: "#000000", border: "#000000", icon: <RefreshCw style={{ width: 10, height: 10, animation: "spin 1.5s linear infinite" }} /> },
    };
    const s = styles[status.toLowerCase()] || styles.pending;
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "4px 10px", borderRadius: 6, fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
        background: s.bg, color: s.color, border: `2px solid ${s.border}`,
        textTransform: "uppercase", letterSpacing: "0.06em",
      }}>
        {s.icon} {status}
      </span>
    );
  };

  const totalIndexed = jobs.reduce((acc, j) => acc + (j.processed || 0), 0);
  const totalFetched  = jobs.reduce((acc, j) => acc + (j.fetched  || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, hsl(262 83% 50%), hsl(300 70% 45%))",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Cpu style={{ width: 14, height: 14, color: "white" }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(220 20% 97%)", letterSpacing: "0.03em" }}>
              System Operator
            </div>
            <div style={{ fontSize: 10, color: "hsl(220 8% 40%)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>
              PIPELINE CONTROL PANEL
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            padding: "6px 14px", borderRadius: 9999,
            background: "#FFE57F", border: "2px solid #000000",
            boxShadow: "3px 3px 0px #000000",
            fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
            color: "#000000", fontWeight: 800,
            display: "flex", alignItems: "center", gap: 6,
            letterSpacing: "0.08em",
          }}>
            <Activity style={{ width: 10, height: 10 }} />
            {jobs.filter(j => j.status === "running").length} RUNNING
          </div>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "40px 52px" }}>
        {/* Hero heading */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8,
            background: "linear-gradient(135deg, hsl(220 20% 97%), hsl(220 10% 70%))",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Medica Pipeline Operator
          </h1>
          <p style={{ fontSize: 13, color: "hsl(220 8% 45%)", lineHeight: 1.6 }}>
            Manual scheduler console — scrape PubMed, ingest raw papers, index embeddings, and run optimization scripts.
          </p>
        </div>

        {/* Quick stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { label: "Total Runs", value: jobs.length, icon: Terminal, color: "hsl(262 83% 68%)" },
            { label: "Papers Fetched", value: totalFetched, icon: Database, color: "hsl(217 91% 65%)" },
            { label: "Papers Indexed", value: totalIndexed, icon: CheckCircle, color: "hsl(150 76% 55%)" },
          ].map((c) => (
            <div key={c.label} className="stat-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", color: "hsl(220 8% 38%)", textTransform: "uppercase" }}>
                  {c.label}
                </span>
                <c.icon style={{ width: 14, height: 14, color: c.color }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "hsl(220 20% 97%)", letterSpacing: "-0.03em" }}>
                {c.value}
              </div>
            </div>
          ))}
        </div>

        {/* Control cards */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 28 }}>
          {/* Scraper form */}
          <div style={{
            padding: "32px 36px", borderRadius: 20,
            border: "3px solid #000000",
            background: "#FFFFFF",
            boxShadow: "8px 8px 0px #000000",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, paddingBottom: 16, borderBottom: "3px solid #000000" }}>
              <Search style={{ width: 15, height: 15, color: "#7C3AED" }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: "#000000", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Ingest Research Adapter
              </span>
            </div>

            <form onSubmit={handleTriggerIngestion}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 16 }}>
                {/* Query input */}
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#000000", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
                    Search Terms
                  </label>
                  <div style={{ position: "relative" }}>
                    <Search style={{
                      position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                      width: 12, height: 12, color: "hsl(220 8% 30%)",
                    }} />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="e.g. osimertinib NSCLC targeted therapy..."
                      disabled={submitting}
                      style={{
                        width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
                        borderRadius: 9, border: "2px solid #000000",
                        background: "#FFFFFF", color: "#000000",
                        fontSize: 12, outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Limit */}
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#000000", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
                    Limit
                  </label>
                  <select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    disabled={submitting}
                    style={{
                      padding: "10px 12px", borderRadius: 9, border: "2px solid #000000",
                      background: "#FFFFFF", color: "#000000",
                      fontSize: 12, outline: "none", cursor: "pointer",
                    }}
                  >
                    {[5, 10, 25, 50].map((v) => (
                      <option key={v} value={v}>{v} papers</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status message */}
              {triggerMsg && (
                <div style={{
                  padding: "12px 16px", borderRadius: 12, marginBottom: 16, fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                  background: triggerMsg.type === "success" ? "#D1FAE5" : "#FFE4E6",
                  border: `2px solid #000000`,
                  color: "#000000",
                  boxShadow: "3px 3px 0px #000000",
                }}>
                  {triggerMsg.text}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !query.trim()}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 20px", borderRadius: 9, cursor: "pointer",
                  background: submitting || !query.trim()
                    ? "hsl(240 8% 12%)"
                    : "linear-gradient(135deg, hsl(262 83% 55%), hsl(234 89% 60%))",
                  border: "none",
                  color: submitting || !query.trim() ? "hsl(220 8% 35%)" : "white",
                  fontSize: 12, fontWeight: 600,
                  boxShadow: !submitting && query.trim() ? "0 4px 16px hsl(262 83% 40% / 0.3)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <Play style={{ width: 13, height: 13, fill: "currentColor" }} />
                {submitting ? "Initializing pipeline..." : "Launch Ingestion Run"}
              </button>
            </form>
          </div>

          {/* Optimizer card */}
          <div style={{
            padding: "32px 36px", borderRadius: 20, display: "flex", flexDirection: "column", justifyContent: "space-between",
            border: "3px solid #000000",
            background: "#FFFFFF",
            boxShadow: "8px 8px 0px #000000",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, paddingBottom: 14, borderBottom: "3px solid #000000" }}>
                <Zap style={{ width: 15, height: 15, color: "#7C3AED" }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: "#000000", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Memory Optimizer
                </span>
              </div>
              <p style={{ fontSize: 12, color: "#555555", lineHeight: 1.7, fontWeight: 500 }}>
                Trigger the weekly relinking script to compute semantic controversies, rebuild pgvector index files, and cross-reference citations.
              </p>
            </div>
            <button
              onClick={handleTriggerOptimize}
              disabled={optimizing}
              style={{
                marginTop: 20, width: "100%",
                padding: "12px 0", borderRadius: 9999, cursor: "pointer",
                background: "#FFE57F", border: "3px solid #000000",
                color: "#000000", fontSize: 12, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "4px 4px 0px #000000",
                letterSpacing: "0.06em", textTransform: "uppercase",
                transition: "all 0.15s ease",
              }}
            >
              <RefreshCw style={{ width: 13, height: 13, color: "#000000", animation: optimizing ? "spin 1s linear infinite" : "none" }} />
              {optimizing ? "Analyzing nodes..." : "Trigger Relinking Run"}
            </button>
          </div>
        </div>

        {/* Job ledger */}
        <div style={{
          borderRadius: 20, border: "3px solid #000000",
          background: "#FFFFFF", overflow: "hidden",
          boxShadow: "8px 8px 0px #000000",
        }}>
          <div style={{
            padding: "20px 28px", borderBottom: "3px solid #000000",
            background: "#FAF8F5",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Terminal style={{ width: 15, height: 15, color: "#7C3AED" }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: "#000000", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Background Ingestion Runs
              </span>
            </div>
            <button
              data-sidebar-delete
              onClick={loadJobs}
              style={{
                width: 32, height: 32, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center",
                background: "#FFFFFF", border: "2px solid #000000",
                boxShadow: "2px 2px 0px #000000",
                cursor: "pointer", color: "#000000",
                transition: "all 0.15s ease",
              }}
              title="Refresh"
            >
              <RefreshCw style={{ width: 13, height: 13 }} />
            </button>
          </div>

          <div style={{ overflowX: "auto", minHeight: 250 }}>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 0", gap: 10, color: "hsl(220 8% 35%)", fontSize: 12 }}>
                <RefreshCw style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                Querying operator runs...
              </div>
            ) : jobs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "56px 0", color: "hsl(220 8% 32%)", fontSize: 12, fontStyle: "italic" }}>
                No ingestion runs triggered yet.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "3px solid #000000", background: "#FAF8F5" }}>
                    {["Job ID", "Query Terms", "Status", "Indexed Stats", "Initialized", "Diagnostics"].map((h) => (
                      <th key={h} style={{
                        padding: "14px 20px", textAlign: "left",
                        fontSize: 9, fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: "0.1em", color: "#000000",
                        textTransform: "uppercase", fontWeight: 800,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => {
                    const startStr = j.started_at
                      ? new Date(j.started_at).toLocaleTimeString()
                      : "Pending";
                    return (
                      <tr
                        key={j.id}
                        style={{ borderBottom: "2px solid #E5E7EB", transition: "background 0.15s ease" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#FAF8F5")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "16px 22px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#555555", fontWeight: 600 }} title={j.id}>
                          {j.id.substring(0, 8)}…
                        </td>
                        <td style={{ padding: "16px 22px", fontSize: 12, fontWeight: 600, color: "#111111", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={j.query}>
                          {j.query}
                        </td>
                        <td style={{ padding: "16px 22px" }}>
                          {statusBadge(j.status)}
                        </td>
                        <td style={{ padding: "13px 20px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#333333" }}>
                          {j.status === "running" ? (
                            <span style={{ color: "#555555", fontWeight: 600 }}>processing…</span>
                          ) : (
                            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <span>Fetched: <strong style={{ color: "#000000" }}>{j.fetched}</strong></span>
                              <span>Indexed: <strong style={{ color: "#7C3AED" }}>{j.processed}</strong></span>
                              {(j.failed ?? 0) > 0 && <span style={{ color: "#DC2626", fontWeight: 700 }}>Failed: {j.failed}</span>}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "13px 20px" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#555555", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                            <Clock style={{ width: 11, height: 11 }} />
                            {startStr}
                          </span>
                        </td>
                        <td style={{ padding: "13px 20px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={j.error_message || ""}>
                          {j.status === "failed" ? (
                            <span style={{ color: "#DC2626", fontWeight: 700 }}>{j.error_message}</span>
                          ) : j.status === "done" ? (
                            <span style={{ color: "#059669", fontWeight: 700 }}>✓ pipeline completed</span>
                          ) : (
                            <span style={{ color: "#888888" }}>waiting…</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
