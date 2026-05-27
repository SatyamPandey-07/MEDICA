"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Folder,
  Compass,
  Clock,
  ChevronRight,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Database,
  Search,
} from "lucide-react";

import { listCancerTypes, listKnowledgePapers } from "@/lib/api";

export default function KnowledgeExplorerPage() {
  const [cancerTypes, setCancerTypes] = useState<string[]>([]);
  const [selectedCancer, setSelectedCancer] = useState<string | null>(null);
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    listCancerTypes()
      .then(setCancerTypes)
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    listKnowledgePapers(selectedCancer || undefined)
      .then(setPapers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCancer]);

  const formatFolderName = (name: string) =>
    name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const filtered = papers.filter((p) =>
    !searchQuery || p.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const evidenceStyle = (level: string) => {
    const map: Record<string, [string, string, string]> = {
      randomized_controlled_trial: ["hsl(262 50% 18%)", "hsl(262 83% 72%)", "hsl(262 50% 26%)"],
      meta_analysis:               ["hsl(174 60% 11%)", "hsl(174 80% 52%)", "hsl(174 60% 20%)"],
      systematic_review:           ["hsl(150 50% 11%)", "hsl(150 76% 52%)", "hsl(150 50% 20%)"],
      rct:                         ["hsl(262 50% 18%)", "hsl(262 83% 72%)", "hsl(262 50% 26%)"],
      cohort:                      ["hsl(217 60% 13%)", "hsl(217 91% 65%)", "hsl(217 60% 22%)"],
      expert_opinion:              ["hsl(220 8% 10%)",  "hsl(220 8% 48%)",  "hsl(220 8% 15%)"],
      preclinical:                 ["hsl(0 50% 11%)",   "hsl(0 70% 58%)",   "hsl(0 50% 18%)"],
    };
    const s = map[level?.toLowerCase()] || ["hsl(220 8% 10%)", "hsl(220 8% 48%)", "hsl(220 8% 15%)"];
    return { bg: s[0], text: s[1], border: s[2] };
  };

  const statusStyle = (s: string) => {
    if (s === "verified") return { color: "hsl(150 76% 55%)", bg: "hsl(150 60% 10%)", border: "hsl(150 60% 18%)" };
    if (s === "disputed") return { color: "hsl(24 90% 62%)", bg: "hsl(24 70% 10%)", border: "hsl(24 70% 18%)" };
    return { color: "hsl(220 8% 45%)", bg: "hsl(220 8% 10%)", border: "hsl(220 8% 16%)" };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, hsl(217 91% 50%), hsl(234 89% 60%))",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Compass style={{ width: 14, height: 14, color: "white" }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(220 20% 97%)", letterSpacing: "0.03em" }}>
              Knowledge Explorer
            </div>
            <div style={{ fontSize: 10, color: "hsl(220 8% 40%)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>
              STRUCTURED MARKDOWN STORE
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            padding: "6px 14px", borderRadius: 9999,
            background: "#FFE57F", border: "2px solid #000000",
            boxShadow: "3px 3px 0px #000000",
            fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
            color: "#000000", fontWeight: 700,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Database style={{ width: 11, height: 11 }} />
            {papers.length} files indexed
          </div>
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        {/* ── Left panel: folder tree ── */}
        <div style={{
          width: 240, flexShrink: 0,
          borderRight: "1px solid hsl(240 8% 9%)",
          background: "hsl(240 10% 3%)",
          overflowY: "auto",
          padding: "28px 16px",
        }}>
          <div style={{
            fontSize: 9, fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.15em", color: "hsl(220 8% 28%)",
            textTransform: "uppercase", padding: "0 10px", marginBottom: 18,
          }}>
            Cancer Directories
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* All */}
            <button
              onClick={() => setSelectedCancer(null)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                border: "1px solid",
                background: selectedCancer === null ? "hsl(262 50% 20% / 0.6)" : "transparent",
                borderColor: selectedCancer === null ? "hsl(262 50% 35% / 0.4)" : "transparent",
                color: selectedCancer === null ? "hsl(220 20% 95%)" : "hsl(220 8% 45%)",
                fontSize: 12, fontWeight: selectedCancer === null ? 500 : 400,
                textAlign: "left", transition: "all 0.15s ease",
                width: "100%", marginBottom: 4,
              }}
            >
              <Folder style={{
                width: 14, height: 14,
                color: selectedCancer === null ? "hsl(262 83% 70%)" : "hsl(220 8% 35%)",
              }} />
              All Repositories
            </button>

            {cancerTypes.map((type) => {
              const active = selectedCancer === type;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedCancer(type)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                    border: "1px solid",
                    background: active ? "hsl(262 50% 20% / 0.6)" : "transparent",
                    borderColor: active ? "hsl(262 50% 35% / 0.4)" : "transparent",
                    color: active ? "hsl(220 20% 95%)" : "hsl(220 8% 42%)",
                    fontSize: 12, fontWeight: active ? 500 : 400,
                    textAlign: "left", transition: "all 0.15s ease",
                    width: "100%", marginBottom: 4,
                  }}
                >
                  <Folder style={{
                    width: 14, height: 14,
                    color: active ? "hsl(262 83% 70%)" : "hsl(220 8% 30%)",
                  }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {formatFolderName(type)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right panel: papers ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "40px 48px" }}>
          {/* Heading row + search */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, gap: 16 }}>
            <div>
              <h1 style={{
                fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4,
                background: "linear-gradient(135deg, hsl(220 20% 97%), hsl(220 10% 70%))",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                {selectedCancer ? formatFolderName(selectedCancer) : "Comprehensive Memory Store"}
              </h1>
              <p style={{ fontSize: 12, color: "hsl(220 8% 40%)" }}>
                Structured markdown files in the filesystem knowledge layer.
              </p>
            </div>

            {/* Search */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <Search style={{
                width: 13, height: 13,
                position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                color: "hsl(220 8% 35%)",
              }} />
              <input
                type="text"
                placeholder="Filter papers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                  borderRadius: 8, border: "1px solid hsl(240 8% 12%)",
                  background: "hsl(240 8% 5%)", color: "hsl(220 20% 90%)",
                  fontSize: 12, outline: "none", width: 200,
                }}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton" style={{ height: 130, borderRadius: 14 }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "64px 32px",
              border: "1px solid hsl(240 8% 10%)",
              borderRadius: 20, background: "hsl(240 8% 4%)",
            }}>
              <Compass style={{ width: 40, height: 40, color: "hsl(220 8% 22%)", margin: "0 auto 16px" }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: "hsl(220 20% 88%)", marginBottom: 8 }}>
                No indexed oncology files
              </div>
              <p style={{ fontSize: 12, color: "hsl(220 8% 40%)", maxWidth: 300, margin: "0 auto" }}>
                Run a PubMed search from the Chat Copilot or trigger an ingestion job from the System Operator.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filtered.map((p) => {
                const dateStr = p.published
                  ? new Date(p.published).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                  : "Date Unknown";
                const authStr = (p.authors || []).slice(0, 3).join(", ");
                const evStyle = evidenceStyle(p.evidence_level || "unknown");
                const stStyle = statusStyle(p.verification_status);

                return (
                  <Link
                    key={p.pmid || p.doi || p.title}
                    href={`/papers/${p.id}`}
                    className="card-hover card-active-left"
                    style={{
                      display: "block", textDecoration: "none",
                      padding: "24px 28px", borderRadius: 20,
                      border: "1px solid hsl(240 8% 10%)",
                      background: "linear-gradient(135deg, hsl(240 8% 5%) 0%, hsl(240 6% 6%) 100%)",
                    }}
                  >
                    {/* Top badges row */}
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                      <span style={{
                        padding: "2px 9px", borderRadius: 4, fontSize: 9,
                        fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                        letterSpacing: "0.05em", textTransform: "uppercase",
                        background: evStyle.bg, color: evStyle.text, border: `1px solid ${evStyle.border}`,
                      }}>
                        {(p.evidence_level || "trial").replace(/_/g, " ")}
                      </span>

                      <span style={{
                        padding: "2px 9px", borderRadius: 4, fontSize: 9,
                        fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                        display: "flex", alignItems: "center", gap: 4,
                        background: stStyle.bg, color: stStyle.color, border: `1px solid ${stStyle.border}`,
                      }}>
                        {p.verification_status === "verified"
                          ? <CheckCircle style={{ width: 9, height: 9 }} />
                          : p.verification_status === "disputed"
                          ? <AlertTriangle style={{ width: 9, height: 9 }} />
                          : null}
                        {p.verification_status || "unverified"}
                      </span>

                      <span style={{
                        padding: "2px 9px", borderRadius: 4, fontSize: 9,
                        fontFamily: "'JetBrains Mono', monospace",
                        background: "hsl(262 50% 14%)", color: "hsl(262 83% 70%)",
                        border: "1px solid hsl(262 50% 22%)",
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <TrendingUp style={{ width: 9, height: 9 }} />
                        CONF: {p.confidence_score?.toFixed(2)}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 style={{
                      fontSize: 14, fontWeight: 600, color: "hsl(220 20% 93%)",
                      marginBottom: 6, lineHeight: 1.5, letterSpacing: "-0.01em",
                    }}>
                      {p.title}
                    </h3>

                    {/* Metadata */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 12, fontSize: 11, color: "hsl(220 8% 42%)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock style={{ width: 11, height: 11 }} />
                        {dateStr}
                      </span>
                      <span>By {authStr}{p.authors?.length > 3 ? " et al." : ""}</span>
                      {p.journal && (
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "hsl(220 8% 30%)" }}>
                          {p.journal}
                        </span>
                      )}
                    </div>

                    {/* Molecular tags */}
                    {p.tags && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {p.tags.drugs?.slice(0, 3).map((d: string) => (
                          <span key={d} style={{
                            padding: "2px 7px", borderRadius: 4, fontSize: 9,
                            fontFamily: "'JetBrains Mono', monospace",
                            background: "hsl(262 50% 14%)", color: "hsl(262 83% 70%)",
                            border: "1px solid hsl(262 50% 22%)",
                          }}>drug:{d}</span>
                        ))}
                        {p.tags.biomarkers?.slice(0, 3).map((b: string) => (
                          <span key={b} style={{
                            padding: "2px 7px", borderRadius: 4, fontSize: 9,
                            fontFamily: "'JetBrains Mono', monospace",
                            background: "hsl(217 50% 13%)", color: "hsl(217 91% 65%)",
                            border: "1px solid hsl(217 50% 22%)",
                          }}>mut:{b}</span>
                        ))}
                        {p.tags.treatment?.slice(0, 3).map((t: string) => (
                          <span key={t} style={{
                            padding: "2px 7px", borderRadius: 4, fontSize: 9,
                            fontFamily: "'JetBrains Mono', monospace",
                            background: "hsl(150 50% 10%)", color: "hsl(150 76% 55%)",
                            border: "1px solid hsl(150 50% 18%)",
                          }}>tx:{t}</span>
                        ))}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
