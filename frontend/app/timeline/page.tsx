"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Calendar,
  TrendingUp,
  FlaskConical,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

import { listKnowledgePapers } from "@/lib/api";

export default function ResearchTimelinePage() {
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPapers = async () => {
      setLoading(true);
      try {
        const data = await listKnowledgePapers();
        const sorted = data
          .filter((p) => p.published)
          .sort((a, b) => new Date(a.published).getTime() - new Date(b.published).getTime());
        setPapers(sorted);
      } catch (e) {
        console.error("Failed fetching timeline:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchPapers();
  }, []);

  const getStatusColor = (status: string) => {
    if (status === "verified")
      return { dot: "#10B981", text: "#000000", bg: "#D1FAE5", border: "#000000" };
    if (status === "disputed")
      return { dot: "#F59E0B", text: "#000000", bg: "#FEF3C7", border: "#000000" };
    return { dot: "#6B7280", text: "#000000", bg: "#F3F4F6", border: "#000000" };
  };

  const getEvidenceStyle = (level: string) => {
    const map: Record<string, { bg: string; text: string; border: string }> = {
      randomized_controlled_trial: { bg: "#EDE9FE", text: "#000000", border: "#000000" },
      meta_analysis:               { bg: "#D1FAE5", text: "#000000", border: "#000000" },
      systematic_review:           { bg: "#CCFBF1", text: "#000000", border: "#000000" },
      cohort:                      { bg: "#DBEAFE", text: "#000000", border: "#000000" },
      expert_opinion:              { bg: "#F3F4F6", text: "#000000", border: "#000000" },
    };
    return map[level?.toLowerCase()] || { bg: "#F3F4F6", text: "#000000", border: "#000000" };
  };

  // Group by year
  const byYear: Record<number, any[]> = {};
  papers.forEach((p) => {
    const y = new Date(p.published).getFullYear();
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(p);
  });
  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, hsl(234 89% 60%), hsl(262 83% 65%))",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Clock style={{ width: 14, height: 14, color: "white" }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(220 20% 97%)", letterSpacing: "0.03em" }}>
              Research Timeline
            </div>
            <div style={{ fontSize: 10, color: "hsl(220 8% 40%)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>
              CHRONOLOGICAL TRIAL PROGRESSION
            </div>
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
          color: "hsl(220 8% 35%)",
        }}>
          <FlaskConical style={{ width: 13, height: 13 }} />
          {papers.length} milestones indexed
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "40px 52px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>

          {/* Hero heading */}
          <div style={{ marginBottom: 48 }}>
            <h1 style={{
              fontSize: 32, fontWeight: 800,
              color: "#000000",
              letterSpacing: "-0.03em", marginBottom: 12,
              lineHeight: 1.2,
            }}>
              Clinical Trial Milestones
            </h1>
            <p style={{ fontSize: 14, color: "#555555", lineHeight: 1.7, fontWeight: 500 }}>
              Chronological map of verified clinical studies, targeted therapeutics, and emerging oncology trials.
            </p>
          </div>

          {loading ? (
            /* Skeleton */
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ display: "flex", gap: 24 }}>
                  <div className="skeleton" style={{ width: 60, height: 60, borderRadius: 12, flexShrink: 0 }} />
                  <div className="skeleton" style={{ flex: 1, height: 120, borderRadius: 14 }} />
                </div>
              ))}
            </div>
          ) : papers.length === 0 ? (
            /* Empty */
            <div style={{
              textAlign: "center", padding: "64px 32px",
              border: "1px solid hsl(240 8% 10%)",
              borderRadius: 20, background: "hsl(240 8% 4%)",
            }}>
              <Calendar style={{ width: 40, height: 40, color: "hsl(220 8% 25%)", margin: "0 auto 16px" }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: "hsl(220 20% 90%)", marginBottom: 8 }}>
                No milestones indexed yet
              </div>
              <p style={{ fontSize: 12, color: "hsl(220 8% 40%)", maxWidth: 320, margin: "0 auto" }}>
                Ingest oncology trials from PubMed via the Chat Copilot or System Operator to populate the timeline.
              </p>
            </div>
          ) : (
            /* Timeline stream */
            <div style={{ position: "relative" }}>
              {/* Vertical bold black line */}
              <div style={{
                position: "absolute", left: 22, top: 0, bottom: 0, width: 4,
                background: "#000000",
                borderRadius: 4,
              }} />

              {years.map((year) => (
                <div key={year} style={{ marginBottom: 40 }}>
                  {/* Year marker - neobrutalist stamp */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, position: "relative" }}>
                    <div style={{
                      width: 64, height: 32, borderRadius: 8, flexShrink: 0, zIndex: 1,
                      background: "#FFE57F",
                      border: "3px solid #000000",
                      boxShadow: "3px 3px 0px #000000",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 800, color: "#000000",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      {year}
                    </div>
                    <div style={{ height: 3, flex: 1, background: "#000000", borderRadius: 2 }} />
                    <div style={{
                      fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                      color: "#000000", flexShrink: 0, fontWeight: 700,
                      background: "#F3F4F6",
                      border: "2px solid #000000",
                      borderRadius: 6,
                      padding: "2px 10px",
                    }}>
                      {byYear[year].length} trial{byYear[year].length !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Papers for this year */}
                  <div style={{ paddingLeft: 56, display: "flex", flexDirection: "column", gap: 20 }}>
                    {byYear[year].map((p, idx) => {
                      const pubDate = new Date(p.published);
                      const monthDay = pubDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      const evidStyle = getEvidenceStyle(p.evidence_level);
                      const statusStyle = getStatusColor(p.verification_status);

                      return (
                        <div key={p.id || idx} style={{ position: "relative" }}>
                          {/* Timeline node dot */}
                          <div style={{
                            position: "absolute",
                            left: -46, top: 20,
                            width: 16, height: 16, borderRadius: "50%",
                            background: p.verification_status === "verified" ? "#10B981" : "#FFE57F",
                            border: "3px solid #000000",
                            boxShadow: "2px 2px 0px #000000",
                            zIndex: 1,
                          }} />

                          {/* Card */}
                          <Link
                            href={`/papers/${p.id}`}
                            className="card-hover card-active-left"
                            style={{
                              display: "block",
                              padding: "24px 28px",
                              borderRadius: 20,
                              border: "3px solid #000000",
                              background: "#FFFFFF",
                              textDecoration: "none",
                              boxShadow: "6px 6px 0px #000000",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {/* Top row */}
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                              {/* Date chip */}
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{
                                  fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                                  color: "#000000", fontWeight: 700,
                                  background: "#F3F4F6",
                                  border: "2px solid #000000",
                                  borderRadius: 6, padding: "2px 8px",
                                }}>
                                  {monthDay}
                                </span>
                              </div>

                              {/* Badges */}
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <span style={{
                                  padding: "4px 10px",
                                  borderRadius: 6, fontSize: 9,
                                  fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                                  border: `2px solid #000000`,
                                  letterSpacing: "0.06em", textTransform: "uppercase",
                                  background: evidStyle.bg, color: evidStyle.text,
                                }}>
                                  {(p.evidence_level || "trial").replace(/_/g, " ").toUpperCase()}
                                </span>
                                {p.trial_phase && (
                                  <span style={{
                                    padding: "4px 10px", borderRadius: 6, fontSize: 9,
                                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                                    background: "#DBEAFE", color: "#000000",
                                    border: "2px solid #000000",
                                    letterSpacing: "0.06em", textTransform: "uppercase",
                                  }}>
                                    {p.trial_phase.replace("_", " ").toUpperCase()}
                                  </span>
                                )}
                                <span style={{
                                  padding: "4px 10px", borderRadius: 6, fontSize: 9,
                                  fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                                  background: statusStyle.bg, color: statusStyle.text,
                                  border: `2px solid #000000`,
                                  display: "flex", alignItems: "center", gap: 4,
                                  letterSpacing: "0.06em", textTransform: "uppercase",
                                }}>
                                  {p.verification_status === "verified"
                                    ? <CheckCircle style={{ width: 9, height: 9 }} />
                                    : p.verification_status === "disputed"
                                    ? <AlertTriangle style={{ width: 9, height: 9 }} />
                                    : null}
                                  {p.verification_status || "unverified"}
                                </span>
                              </div>
                            </div>

                            {/* Title */}
                            <h3 style={{
                              fontSize: 15, fontWeight: 700, lineHeight: 1.5,
                              color: "#000000", marginBottom: 8,
                              letterSpacing: "-0.01em",
                            }}>
                              {p.title}
                            </h3>

                            {/* Authors */}
                            <div style={{ fontSize: 12, color: "#555555", marginBottom: 14, fontWeight: 500 }}>
                              By {(p.authors || []).slice(0, 2).join(", ")}{p.authors?.length > 2 ? " et al." : ""}{" "}
                              <span style={{ color: "#888888", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                                {p.journal}
                              </span>
                            </div>

                            {/* Normalized Neobrutalist Tag Badges */}
                            {p.tags && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                                {p.tags.cancer?.slice(0, 2).map((c: string) => (
                                  <span key={c} style={{
                                    padding: "3px 8px", borderRadius: 6, fontSize: 9,
                                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 800,
                                    background: "#FFE4E6", color: "#000000",
                                    border: "2px solid #000000",
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                    whiteSpace: "nowrap",
                                  }}>
                                    <span>🎗️</span> {c.replace(/_/g, " ").toUpperCase()}
                                  </span>
                                ))}
                                {p.tags.drugs?.slice(0, 2).map((d: string) => (
                                  <span key={d} style={{
                                    padding: "3px 8px", borderRadius: 6, fontSize: 9,
                                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 800,
                                    background: "#EDE9FE", color: "#000000",
                                    border: "2px solid #000000",
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                    whiteSpace: "nowrap",
                                  }}>
                                    <span>💊</span> {d.replace(/_/g, " ").toUpperCase()}
                                  </span>
                                ))}
                                {p.tags.biomarkers?.slice(0, 2).map((b: string) => (
                                  <span key={b} style={{
                                    padding: "3px 8px", borderRadius: 6, fontSize: 9,
                                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 800,
                                    background: "#DBEAFE", color: "#000000",
                                    border: "2px solid #000000",
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                    whiteSpace: "nowrap",
                                  }}>
                                    <span>🧬</span> {b.replace(/_/g, " ").toUpperCase()}
                                  </span>
                                ))}
                                {p.tags.treatment?.slice(0, 2).map((t: string) => (
                                  <span key={t} style={{
                                    padding: "3px 8px", borderRadius: 6, fontSize: 9,
                                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 800,
                                    background: "#D1FAE5", color: "#000000",
                                    border: "2px solid #000000",
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                    whiteSpace: "nowrap",
                                  }}>
                                    <span>🎯</span> {t.replace(/_/g, " ").toUpperCase()}
                                  </span>
                                ))}
                                {p.tags.evidence?.slice(0, 2).map((e: string) => (
                                  <span key={e} style={{
                                    padding: "3px 8px", borderRadius: 6, fontSize: 9,
                                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 800,
                                    background: "#FFE57F", color: "#000000",
                                    border: "2px solid #000000",
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                    whiteSpace: "nowrap",
                                  }}>
                                    <span>🛡️</span> {e.replace(/_/g, " ").toUpperCase()}
                                  </span>
                                ))}
                                {p.tags.temporal?.slice(0, 2).map((temp: string) => (
                                  <span key={temp} style={{
                                    padding: "3px 8px", borderRadius: 6, fontSize: 9,
                                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 800,
                                    background: "#F3F4F6", color: "#000000",
                                    border: "2px solid #000000",
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                    whiteSpace: "nowrap",
                                  }}>
                                    <span>⏱️</span> {temp.replace(/_/g, " ").toUpperCase()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
