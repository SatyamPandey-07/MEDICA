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
          padding: "4px 12px", borderRadius: 6,
          background: "hsl(150 50% 10%)", border: "1px solid hsl(150 50% 20%)",
          fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
          color: "hsl(150 76% 55%)", display: "flex", alignItems: "center", gap: 6,
        }}>
          <ShieldCheck style={{ width: 11, height: 11 }} />
          GUARDED MODE
        </div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
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
              borderRadius: 16, border: "1px solid hsl(240 8% 10%)",
              background: "hsl(240 8% 4%)", overflow: "hidden",
            }}>
              {/* Toolbar */}
              <div style={{
                padding: "16px 24px",
                borderBottom: "1px solid hsl(240 8% 8%)",
                background: "hsl(240 10% 5%)",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldAlert style={{ width: 15, height: 15, color: "hsl(262 83% 68%)" }} />
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: "hsl(220 20% 90%)",
                    fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}>
                    Audit Data Ledger
                  </span>
                </div>

                {/* Status tabs */}
                <div style={{ display: "flex", gap: 4 }}>
                  {statusTabs.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      style={{
                        padding: "4px 12px", borderRadius: 6, fontSize: 11,
                        fontFamily: "'JetBrains Mono', monospace", cursor: "pointer",
                        transition: "all 0.15s ease", border: "1px solid",
                        textTransform: "capitalize",
                        background: activeStatus === s ? "hsl(262 50% 22%)" : "transparent",
                        borderColor: activeStatus === s ? "hsl(262 50% 35%)" : "hsl(240 8% 12%)",
                        color: activeStatus === s ? tabColor(s) : "hsl(220 8% 40%)",
                        fontWeight: activeStatus === s ? 600 : 400,
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
                        borderBottom: "1px solid hsl(240 8% 9%)",
                        background: "hsl(240 10% 4%)",
                      }}>
                        {["Trial ID / PMID", "Clinical Study", "Evidence Level", "Confidence", "Quality Flags", ""].map((h) => (
                          <th key={h} style={{
                            padding: "12px 20px", textAlign: "left",
                            fontSize: 9, fontFamily: "'JetBrains Mono', monospace",
                            letterSpacing: "0.1em", color: "hsl(220 8% 30%)", textTransform: "uppercase",
                            fontWeight: 600,
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
                              borderBottom: "1px solid hsl(240 8% 7%)",
                              transition: "background 0.15s ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(240 8% 6%)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            {/* PMID */}
                            <td style={{ padding: "14px 20px" }}>
                              {p.pmid ? (
                                <a
                                  href={`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`}
                                  target="_blank" rel="noopener noreferrer"
                                  style={{
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: 11, fontWeight: 600,
                                    color: "hsl(262 83% 72%)",
                                    textDecoration: "none", borderBottom: "1px solid hsl(262 50% 35%)",
                                  }}
                                >
                                  pmid:{p.pmid}
                                </a>
                              ) : (
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "hsl(220 8% 45%)" }}>
                                  {`doi:${(p.doi || "").substring(0, 10)}…`}
                                </span>
                              )}
                            </td>

                            {/* Title */}
                            <td style={{ padding: "14px 20px", maxWidth: 320 }}>
                              <div style={{
                                fontSize: 12, fontWeight: 500, color: "hsl(220 15% 85%)",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }} title={p.title}>
                                {p.title}
                              </div>
                            </td>

                            {/* Level */}
                            <td style={{ padding: "14px 20px" }}>
                              <span style={{
                                padding: "2px 8px", borderRadius: 4,
                                fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                                fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
                                background: "hsl(240 8% 10%)", color: "hsl(220 8% 50%)",
                                border: "1px solid hsl(240 8% 14%)",
                              }}>
                                {(p.evidence_level || "").replace(/_/g, " ")}
                              </span>
                            </td>

                            {/* Confidence */}
                            <td style={{ padding: "14px 20px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{
                                  fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                                  fontWeight: 700, color: scoreColor(p.confidence_score),
                                }}>
                                  {scorePct}%
                                </span>
                                <div style={{
                                  width: 60, height: 4, borderRadius: 2,
                                  background: "hsl(240 8% 12%)", overflow: "hidden", flexShrink: 0,
                                }}>
                                  <div style={{
                                    width: `${scorePct}%`, height: "100%", borderRadius: 2,
                                    background: scoreGradient(p.confidence_score),
                                  }} />
                                </div>
                              </div>
                            </td>

                            {/* Flags */}
                            <td style={{ padding: "14px 20px" }}>
                              {flags.length === 0 ? (
                                <span style={{
                                  fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                                  padding: "2px 8px", borderRadius: 4,
                                  background: "hsl(150 60% 10%)", color: "hsl(150 76% 55%)",
                                  border: "1px solid hsl(150 60% 18%)",
                                }}>
                                  no flags
                                </span>
                              ) : (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                  {flags.map((f: string) => (
                                    <span key={f} style={{
                                      fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                                      padding: "2px 7px", borderRadius: 4,
                                      background: "hsl(0 50% 10%)", color: "hsl(0 70% 65%)",
                                      border: "1px solid hsl(0 50% 18%)",
                                    }}>
                                      {f}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>

                            {/* Action */}
                            <td style={{ padding: "14px 20px", textAlign: "right" }}>
                              <Link
                                href={`/papers/${p.id}`}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 6,
                                  padding: "5px 12px", borderRadius: 7,
                                  background: "hsl(262 50% 18%)", border: "1px solid hsl(262 50% 28%)",
                                  color: "hsl(262 83% 72%)", fontSize: 11, textDecoration: "none",
                                  fontWeight: 500, transition: "all 0.15s ease",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(262 50% 24%)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "hsl(262 50% 18%)")}
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
