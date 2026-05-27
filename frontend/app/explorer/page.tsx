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
      randomized_controlled_trial: ["#EDE9FE", "#000000", "#000000"],
      meta_analysis:               ["#D1FAE5", "#000000", "#000000"],
      systematic_review:           ["#CCFBF1", "#000000", "#000000"],
      rct:                         ["#EDE9FE", "#000000", "#000000"],
      cohort:                      ["#DBEAFE", "#000000", "#000000"],
      expert_opinion:              ["#F3F4F6", "#000000", "#000000"],
      preclinical:                 ["#FFE4E6", "#000000", "#000000"],
    };
    const s = map[level?.toLowerCase()] || ["#F3F4F6", "#000000", "#000000"];
    return { bg: s[0], text: s[1], border: s[2] };
  };

  const statusStyle = (s: string) => {
    if (s === "verified") return { color: "#000000", bg: "#D1FAE5", border: "#000000" };
    if (s === "disputed") return { color: "#000000", bg: "#FEF3C7", border: "#000000" };
    return { color: "#000000", bg: "#F3F4F6", border: "#000000" };
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
          borderRight: "3px solid #000000",
          background: "#FAF8F5",
          overflowY: "auto",
          padding: "28px 16px",
        }}>
          <div style={{
            fontSize: 9, fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.15em", color: "#888888",
            textTransform: "uppercase", padding: "0 10px", marginBottom: 18,
            fontWeight: 800,
          }}>
            Cancer Directories
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {/* All */}
            <button
              onClick={() => setSelectedCancer(null)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                border: selectedCancer === null ? "2px solid #000000" : "2px solid transparent",
                background: selectedCancer === null ? "#FFE57F" : "transparent",
                boxShadow: selectedCancer === null ? "3px 3px 0px #000000" : "none",
                color: "#000000",
                fontSize: 12, fontWeight: selectedCancer === null ? 800 : 500,
                textAlign: "left", transition: "all 0.15s ease",
                width: "100%", marginBottom: 4,
              }}
            >
              <Folder style={{
                width: 14, height: 14,
                color: selectedCancer === null ? "#7C3AED" : "#888888",
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
                    border: active ? "2px solid #000000" : "2px solid transparent",
                    background: active ? "#FFE57F" : "transparent",
                    boxShadow: active ? "3px 3px 0px #000000" : "none",
                    color: "#000000",
                    fontSize: 12, fontWeight: active ? 800 : 500,
                    textAlign: "left", transition: "all 0.15s ease",
                    width: "100%", marginBottom: 4,
                  }}
                >
                  <Folder style={{
                    width: 14, height: 14,
                    color: active ? "#7C3AED" : "#888888",
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
                fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4,
                color: "#000000",
              }}>
                {selectedCancer ? formatFolderName(selectedCancer) : "Comprehensive Memory Store"}
              </h1>
              <p style={{ fontSize: 12, color: "#555555", fontWeight: 500 }}>
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
                  paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                  borderRadius: 9999, border: "2px solid #000000",
                  background: "#FFFFFF", color: "#000000",
                  fontSize: 12, outline: "none", width: 200,
                  boxShadow: "3px 3px 0px #000000",
                  fontWeight: 600,
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
                      border: "3px solid #000000",
                      background: "#FFFFFF",
                      boxShadow: "6px 6px 0px #000000",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {/* Top badges row */}
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: 6, fontSize: 9,
                        fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                        letterSpacing: "0.06em", textTransform: "uppercase",
                        background: evStyle.bg, color: evStyle.text, border: `2px solid ${evStyle.border}`,
                      }}>
                        {(p.evidence_level || "trial").replace(/_/g, " ")}
                      </span>

                      <span style={{
                        padding: "4px 10px", borderRadius: 6, fontSize: 9,
                        fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                        display: "flex", alignItems: "center", gap: 4,
                        background: stStyle.bg, color: stStyle.color, border: `2px solid ${stStyle.border}`,
                        textTransform: "uppercase", letterSpacing: "0.06em",
                      }}>
                        {p.verification_status === "verified"
                          ? <CheckCircle style={{ width: 9, height: 9 }} />
                          : p.verification_status === "disputed"
                          ? <AlertTriangle style={{ width: 9, height: 9 }} />
                          : null}
                        {p.verification_status || "unverified"}
                      </span>

                      <span style={{
                        padding: "4px 10px", borderRadius: 6, fontSize: 9,
                        fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                        background: "#EDE9FE", color: "#000000",
                        border: "2px solid #000000",
                        display: "flex", alignItems: "center", gap: 4,
                        textTransform: "uppercase", letterSpacing: "0.06em",
                      }}>
                        <TrendingUp style={{ width: 9, height: 9 }} />
                        CONF: {p.confidence_score?.toFixed(2)}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 style={{
                      fontSize: 15, fontWeight: 700, color: "#000000",
                      marginBottom: 8, lineHeight: 1.5, letterSpacing: "-0.01em",
                    }}>
                      {p.title}
                    </h3>

                    {/* Metadata */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 12, fontSize: 11, color: "#555555", fontWeight: 500 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock style={{ width: 11, height: 11 }} />
                        {dateStr}
                      </span>
                      <span>By {authStr}{p.authors?.length > 3 ? " et al." : ""}</span>
                      {p.journal && (
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#888888" }}>
                          {p.journal}
                        </span>
                      )}
                    </div>

                    {/* Molecular tags */}
                    {p.tags && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {p.tags.drugs?.slice(0, 3).map((d: string) => (
                          <span key={d} style={{
                            padding: "3px 9px", borderRadius: 6, fontSize: 9,
                            fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                            background: "#EDE9FE", color: "#000000",
                            border: "2px solid #000000",
                          }}>drug:{d}</span>
                        ))}
                        {p.tags.biomarkers?.slice(0, 3).map((b: string) => (
                          <span key={b} style={{
                            padding: "3px 9px", borderRadius: 6, fontSize: 9,
                            fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                            background: "#DBEAFE", color: "#000000",
                            border: "2px solid #000000",
                          }}>mut:{b}</span>
                        ))}
                        {p.tags.treatment?.slice(0, 3).map((t: string) => (
                          <span key={t} style={{
                            padding: "3px 9px", borderRadius: 6, fontSize: 9,
                            fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                            background: "#D1FAE5", color: "#000000",
                            border: "2px solid #000000",
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
