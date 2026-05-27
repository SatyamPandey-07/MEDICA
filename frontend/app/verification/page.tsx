"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  XCircle,
  HelpCircle,
  Eye,
  RefreshCw,
  FileBarChart,
} from "lucide-react";

import { getVerificationStats, listVerificationPapers } from "@/lib/api";
import { VerificationStats } from "@/lib/types";

export default function VerificationDashboardPage() {
  const [stats, setStats] = useState<VerificationStats | null>(null);
  const [papers, setPapers] = useState<any[]>([]);
  const [activeStatus, setActiveStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);

  const fetchStats = async () => {
    try { setStats(await getVerificationStats()); } catch (e) { console.error(e); }
  };

  const fetchPapers = async (status: string) => {
    setLoadingTable(true);
    try { setPapers(await listVerificationPapers(status)); } catch (e) { console.error(e); }
    finally { setLoadingTable(false); }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchStats();
      await fetchPapers("all");
      setLoading(false);
    };
    init();
  }, []);

  const handleStatusChange = (status: string) => {
    setActiveStatus(status);
    fetchPapers(status);
  };

  const statusTabs = ["all", "verified", "unverified", "disputed", "pending"];

  const tabColor = (s: string) => {
    if (s === "verified") return "hsl(150 76% 55%)";
    if (s === "disputed") return "hsl(24 90% 60%)";
    if (s === "pending")  return "hsl(217 91% 65%)";
    return "hsl(220 8% 55%)";
  };

  const scoreColor = (n: number) =>
    n >= 0.75 ? "hsl(150 76% 55%)" : n >= 0.40 ? "hsl(217 91% 65%)" : "hsl(24 90% 60%)";

  const scoreGradient = (n: number) =>
    n >= 0.75
      ? "linear-gradient(90deg, hsl(150 76% 45%), hsl(174 80% 50%))"
      : n >= 0.40
      ? "linear-gradient(90deg, hsl(217 91% 55%), hsl(234 89% 65%))"
      : "linear-gradient(90deg, hsl(24 90% 50%), hsl(0 70% 55%))";

  const statCards = [
    {
      label: "Papers Audited",
      value: stats?.total_papers ?? 0,
      icon: FileBarChart,
      iconColor: "hsl(220 8% 55%)",
      valueColor: "hsl(220 20% 97%)",
      accent: "hsl(220 8% 15%)",
    },
    {
      label: "Avg Confidence",
      value: stats ? `${(stats.average_confidence_score * 100).toFixed(1)}%` : "—",
      icon: TrendingUp,
      iconColor: "hsl(262 83% 70%)",
      valueColor: "hsl(262 83% 80%)",
      accent: "hsl(262 50% 18%)",
    },
    {
      label: "Verified",
      value: stats?.status_distribution.verified ?? 0,
      icon: CheckCircle,
      iconColor: "hsl(150 76% 55%)",
      valueColor: "hsl(150 76% 60%)",
      accent: "hsl(150 60% 12%)",
    },
    {
      label: "Conflicts",
      value: stats?.status_distribution.disputed ?? 0,
      icon: AlertTriangle,
      iconColor: "hsl(24 90% 55%)",
      valueColor: "hsl(24 90% 65%)",
      accent: "hsl(24 70% 10%)",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, hsl(150 76% 35%), hsl(174 80% 40%))",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ShieldCheck style={{ width: 14, height: 14, color: "white" }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(220 20% 97%)", letterSpacing: "0.03em" }}>
              Evidence Auditor
            </div>
            <div style={{ fontSize: 10, color: "hsl(220 8% 40%)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>
              ADVERSARIAL AUDIT LEDGER
            </div>
          </div>
        </div>
        <div style={{
          padding: "6px 14px", borderRadius: 9999,
          background: "#D1FAE5", border: "2px solid #000000",
          boxShadow: "3px 3px 0px #000000",
          fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
          color: "#000000", fontWeight: 800,
          display: "flex", alignItems: "center", gap: 6,
          letterSpacing: "0.08em",
        }}>
          <ShieldCheck style={{ width: 11, height: 11 }} />
          GUARDED MODE
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
            Clinical Trial Verification
          </h1>
          <p style={{ fontSize: 13, color: "hsl(220 8% 45%)", lineHeight: 1.6 }}>
            Adversarial auditing ledger — evaluates study sizes, guideline alignment, and conflicts of interest.
          </p>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton" style={{ height: 100, borderRadius: 14 }} />
              ))}
            </div>
            <div className="skeleton" style={{ height: 400, borderRadius: 16 }} />
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
              {statCards.map((c) => (
                <div key={c.label} className="stat-card">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <span style={{
                      fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: "0.08em", color: "hsl(220 8% 40%)", textTransform: "uppercase",
                    }}>
                      {c.label}
                    </span>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: c.accent, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <c.icon style={{ width: 14, height: 14, color: c.iconColor }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: c.valueColor, letterSpacing: "-0.03em" }}>
                    {c.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Audit Ledger */}
            <div style={{
              borderRadius: 20, border: "3px solid #000000",
              background: "#FFFFFF", overflow: "hidden",
              boxShadow: "8px 8px 0px #000000",
            }}>
              {/* Toolbar */}
              <div style={{
                padding: "20px 28px",
                borderBottom: "3px solid #000000",
                background: "#FAF8F5",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldAlert style={{ width: 15, height: 15, color: "#7C3AED" }} />
                  <span style={{
                    fontSize: 12, fontWeight: 800, color: "#000000",
                    fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}>
                    Audit Data Ledger
                  </span>
                </div>

                {/* Status tabs */}
                <div style={{ display: "flex", gap: 6 }}>
                  {statusTabs.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      style={{
                        padding: "6px 14px", borderRadius: 9999, fontSize: 11,
                        fontFamily: "'JetBrains Mono', monospace", cursor: "pointer",
                        transition: "all 0.15s ease",
                        border: "2px solid #000000",
                        textTransform: "capitalize",
                        background: activeStatus === s ? "#FFE57F" : "#FFFFFF",
                        color: "#000000",
                        fontWeight: activeStatus === s ? 800 : 600,
                        boxShadow: activeStatus === s ? "3px 3px 0px #000000" : "none",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: "auto", minHeight: 300 }}>
                {loadingTable ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 10, color: "hsl(220 8% 35%)", fontSize: 12 }}>
                    <RefreshCw style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />
                    Fetching audits...
                  </div>
                ) : papers.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "64px 0", color: "hsl(220 8% 35%)", fontSize: 12, fontStyle: "italic" }}>
                    No clinical studies match this filter.
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{
                        borderBottom: "3px solid #000000",
                        background: "#FAF8F5",
                      }}>
                        {["Trial ID / PMID", "Clinical Study", "Evidence Level", "Confidence", "Quality Flags", ""].map((h) => (
                          <th key={h} style={{
                            padding: "16px 24px", textAlign: "left",
                            fontSize: 9, fontFamily: "'JetBrains Mono', monospace",
                            letterSpacing: "0.1em", color: "#000000", textTransform: "uppercase",
                            fontWeight: 800,
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {papers.map((p, i) => {
                        const scorePct = (p.confidence_score * 100).toFixed(0);
                        const flags = p.flags || [];
                        return (
                          <tr
                            key={p.id}
                            style={{
                              borderBottom: "2px solid #E5E7EB",
                              transition: "background 0.15s ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#FAF8F5")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            {/* PMID */}
                            <td style={{ padding: "18px 24px" }}>
                              {p.pmid ? (
                                <a
                                  href={`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`}
                                  target="_blank" rel="noopener noreferrer"
                                  style={{
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: 11, fontWeight: 700,
                                    color: "#7C3AED",
                                    textDecoration: "none", borderBottom: "2px solid #7C3AED",
                                  }}
                                >
                                  pmid:{p.pmid}
                                </a>
                              ) : (
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#555555", fontWeight: 600 }}>
                                  {`doi:${(p.doi || "").substring(0, 10)}…`}
                                </span>
                              )}
                            </td>

                            {/* Title */}
                            <td style={{ padding: "18px 24px", maxWidth: 320 }}>
                              <div style={{
                                fontSize: 12, fontWeight: 600, color: "#111111",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }} title={p.title}>
                                {p.title}
                              </div>
                            </td>

                            {/* Level */}
                            <td style={{ padding: "14px 20px" }}>
                              <span style={{
                                padding: "4px 10px", borderRadius: 6,
                                fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                                fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                                background: "#EDE9FE", color: "#000000",
                                border: "2px solid #000000",
                              }}>
                                {(p.evidence_level || "").replace(/_/g, " ")}
                              </span>
                            </td>

                            {/* Confidence */}
                            <td style={{ padding: "18px 24px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{
                                  fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                                  fontWeight: 700, color: "#000000",
                                }}>
                                  {scorePct}%
                                </span>
                                <div style={{
                                  width: 60, height: 6, borderRadius: 3,
                                  background: "#E5E7EB", overflow: "hidden", flexShrink: 0,
                                  border: "2px solid #000000",
                                }}>
                                  <div style={{
                                    width: `${scorePct}%`, height: "100%",
                                    background: p.confidence_score >= 0.75 ? "#10B981" : p.confidence_score >= 0.40 ? "#0EA5E9" : "#EF4444",
                                  }} />
                                </div>
                              </div>
                            </td>

                            {/* Flags */}
                            <td style={{ padding: "18px 24px" }}>
                              {flags.length === 0 ? (
                                <span style={{
                                  fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                                  padding: "4px 10px", borderRadius: 6,
                                  background: "#D1FAE5", color: "#000000",
                                  border: "2px solid #000000", fontWeight: 700,
                                }}>
                                  no flags
                                </span>
                              ) : (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                  {flags.map((f: string) => (
                                    <span key={f} style={{
                                      fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                                      padding: "4px 9px", borderRadius: 6, fontWeight: 700,
                                      background: "#FFE4E6", color: "#000000",
                                      border: "2px solid #000000",
                                    }}>
                                      {f}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>

                            {/* Action */}
                            <td style={{ padding: "18px 24px", textAlign: "right" }}>
                              <Link
                                href={`/papers/${p.id}`}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 6,
                                  padding: "6px 14px", borderRadius: 9999,
                                  background: "#FFE57F", border: "2px solid #000000",
                                  color: "#000000", fontSize: 11, textDecoration: "none",
                                  fontWeight: 800, transition: "all 0.15s ease",
                                  boxShadow: "3px 3px 0px #000000",
                                  letterSpacing: "0.05em", textTransform: "uppercase",
                                }}
                              >
                                <Eye style={{ width: 11, height: 11 }} />
                                Inspect
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
