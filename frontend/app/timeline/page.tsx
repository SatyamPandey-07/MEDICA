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
    if (status === "verified") return { dot: "hsl(150 76% 50%)", text: "hsl(150 76% 60%)", bg: "hsl(150 60% 12%)", border: "hsl(150 60% 20%)" };
    if (status === "disputed") return { dot: "hsl(24 90% 55%)", text: "hsl(24 90% 65%)", bg: "hsl(24 70% 10%)", border: "hsl(24 70% 20%)" };
    return { dot: "hsl(220 8% 40%)", text: "hsl(220 8% 55%)", bg: "hsl(220 8% 10%)", border: "hsl(220 8% 15%)" };
  };

  const getEvidenceStyle = (level: string) => {
    const map: Record<string, { bg: string; text: string; border: string }> = {
      randomized_controlled_trial: { bg: "hsl(262 50% 18%)", text: "hsl(262 83% 75%)", border: "hsl(262 50% 28%)" },
      meta_analysis:               { bg: "hsl(174 60% 12%)", text: "hsl(174 80% 55%)", border: "hsl(174 60% 22%)" },
      systematic_review:           { bg: "hsl(150 50% 12%)", text: "hsl(150 76% 55%)", border: "hsl(150 50% 22%)" },
      cohort:                      { bg: "hsl(217 60% 14%)", text: "hsl(217 91% 65%)", border: "hsl(217 60% 24%)" },
      expert_opinion:              { bg: "hsl(220 8% 10%)",  text: "hsl(220 8% 50%)",  border: "hsl(220 8% 16%)" },
    };
    return map[level?.toLowerCase()] || { bg: "hsl(220 8% 10%)", text: "hsl(220 8% 50%)", border: "hsl(220 8% 16%)" };
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
          <div style={{ marginBottom: 40 }}>
            <h1 style={{
              fontSize: 26, fontWeight: 700,
              background: "linear-gradient(135deg, hsl(220 20% 97%), hsl(220 10% 70%))",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              letterSpacing: "-0.02em", marginBottom: 8,
            }}>
              Clinical Trial Milestones
            </h1>
            <p style={{ fontSize: 13, color: "hsl(220 8% 45%)", lineHeight: 1.6 }}>
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
              {/* Vertical line */}
              <div style={{
                position: "absolute", left: 28, top: 0, bottom: 0, width: 1,
                background: "linear-gradient(180deg, transparent 0%, hsl(262 50% 30%) 10%, hsl(262 50% 25%) 90%, transparent 100%)",
              }} />

              {years.map((year) => (
                <div key={year} style={{ marginBottom: 40 }}>
                  {/* Year marker */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, position: "relative" }}>
                    <div style={{
                      width: 57, height: 28, borderRadius: 8, flexShrink: 0, zIndex: 1,
                      background: "linear-gradient(135deg, hsl(262 83% 55%), hsl(234 89% 60%))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, color: "white",
                      fontFamily: "'JetBrains Mono', monospace",
                      boxShadow: "0 4px 16px hsl(262 83% 40% / 0.35)",
                    }}>
                      {year}
                    </div>
                    <div style={{ height: 1, flex: 1, background: "hsl(240 8% 10%)" }} />
                    <div style={{
                      fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                      color: "hsl(220 8% 30%)", flexShrink: 0,
                    }}>
                      {byYear[year].length} trial{byYear[year].length !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Papers for this year */}
                  <div style={{ paddingLeft: 56, display: "flex", flexDirection: "column", gap: 16 }}>
                    {byYear[year].map((p, idx) => {
                      const pubDate = new Date(p.published);
                      const monthDay = pubDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      const evidStyle = getEvidenceStyle(p.evidence_level);
                      const statusStyle = getStatusColor(p.verification_status);

                      return (
                        <div key={p.id || idx} style={{ position: "relative" }}>
                          {/* Timeline node */}
                          <div style={{
                            position: "absolute",
                            left: -40, top: 18,
                            width: 12, height: 12, borderRadius: "50%",
                            background: "hsl(240 12% 2%)",
                            border: `2px solid ${p.verification_status === "verified" ? "hsl(150 76% 50%)" : "hsl(262 50% 45%)"}`,
                            boxShadow: p.verification_status === "verified"
                              ? "0 0 8px hsl(150 76% 50% / 0.4)"
                              : "0 0 6px hsl(262 83% 50% / 0.3)",
                            transition: "all 0.2s ease",
                          }} />

                          {/* Card */}
                          <Link
                            href={`/papers/${p.id}`}
                            className="card-hover card-active-left"
                            style={{
                              display: "block",
                              padding: "24px 28px",
                              borderRadius: 20,
                              border: "1px solid hsl(240 8% 10%)",
                              background: "linear-gradient(135deg, hsl(240 8% 5%) 0%, hsl(240 6% 6%) 100%)",
                              textDecoration: "none",
                            }}
                          >
                            {/* Top row */}
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                              {/* Date */}
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{
                                  fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                                  color: "hsl(220 8% 40%)", fontWeight: 500,
                                }}>
                                  {monthDay}
                                </span>
                              </div>

                              {/* Badges */}
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <span style={{
                                  ...evidStyle, padding: "2px 8px",
                                  borderRadius: 4, fontSize: 9,
                                  fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                                  border: `1px solid ${evidStyle.border}`,
                                  letterSpacing: "0.05em",
                                  background: evidStyle.bg, color: evidStyle.text,
                                }}>
                                  {(p.evidence_level || "trial").replace(/_/g, " ").toUpperCase()}
                                </span>
                                {p.trial_phase && (
                                  <span style={{
                                    padding: "2px 8px", borderRadius: 4, fontSize: 9,
                                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                                    background: "hsl(217 60% 14%)", color: "hsl(217 91% 65%)",
                                    border: "1px solid hsl(217 60% 24%)",
                                  }}>
                                    {p.trial_phase.replace("_", " ").toUpperCase()}
                                  </span>
                                )}
                                <span style={{
                                  padding: "2px 8px", borderRadius: 4, fontSize: 9,
                                  fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                                  background: statusStyle.bg, color: statusStyle.text,
                                  border: `1px solid ${statusStyle.border}`,
                                  display: "flex", alignItems: "center", gap: 4,
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
                              fontSize: 14, fontWeight: 600, lineHeight: 1.5,
                              color: "hsl(220 20% 95%)", marginBottom: 6,
                              letterSpacing: "-0.01em",
                            }}>
                              {p.title}
                            </h3>

                            {/* Authors */}
                            <div style={{ fontSize: 11, color: "hsl(220 8% 45%)", marginBottom: 12 }}>
                              By {(p.authors || []).slice(0, 2).join(", ")}{p.authors?.length > 2 ? " et al." : ""}{" "}
                              <span style={{ color: "hsl(220 8% 30%)", fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
                                {p.journal}
                              </span>
                            </div>

                            {/* Tags */}
                            {p.tags && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {p.tags.drugs?.slice(0, 2).map((d: string) => (
                                  <span key={d} style={{
                                    padding: "2px 7px", borderRadius: 4, fontSize: 9,
                                    fontFamily: "'JetBrains Mono', monospace",
                                    background: "hsl(262 50% 15%)", color: "hsl(262 83% 72%)",
                                    border: "1px solid hsl(262 50% 22%)",
                                  }}>
                                    drug:{d}
                                  </span>
                                ))}
                                {p.tags.biomarkers?.slice(0, 2).map((b: string) => (
                                  <span key={b} style={{
                                    padding: "2px 7px", borderRadius: 4, fontSize: 9,
                                    fontFamily: "'JetBrains Mono', monospace",
                                    background: "hsl(217 50% 13%)", color: "hsl(217 91% 68%)",
                                    border: "1px solid hsl(217 50% 22%)",
                                  }}>
                                    mut:{b}
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
