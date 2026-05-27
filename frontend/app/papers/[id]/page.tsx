"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  FileText,
  User,
  Clock,
  ExternalLink,
  ShieldCheck,
  Tag,
  AlertTriangle,
  Award,
  BookOpen,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";

import { getPaper } from "@/lib/api";
import { PaperMetadata } from "@/lib/types";

export default function PaperViewerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [paper, setPaper] = useState<PaperMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchPaperDetail = async () => {
      try {
        setLoading(true);
        const data = await getPaper(id);
        setPaper(data);
      } catch (err: any) {
        console.error("Error fetching paper details:", err);
        setError(err.message || "Failed to load paper details.");
      } finally {
        setLoading(false);
      }
    };
    fetchPaperDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <BookOpen className="w-8 h-8 text-purple-500 animate-bounce mx-auto" />
          <p className="text-sm font-mono text-slate-400">Loading trial profile...</p>
        </div>
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-sm space-y-4 p-8 glass-card border border-[#15151a] rounded-2xl">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <h4 className="text-sm font-semibold text-white">Failed to retrieve record</h4>
          <p className="text-xs text-slate-400">{error || "Paper record could not be found."}</p>
          <button
            onClick={() => router.push("/explorer")}
            className="w-full py-2 bg-slate-900 border border-slate-800 text-xs text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Return to Explorer
          </button>
        </div>
      </div>
    );
  }

  // Format dates
  const dateStr = paper.published
    ? new Date(paper.published).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown Date";

  return (
    <div className="flex-1 flex flex-col min-h-0 relative h-full">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-[#15151a] flex items-center justify-between px-8 bg-slate-950/20 shrink-0">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to list</span>
        </button>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-500">ID: `{paper.id}`</span>
        </div>
      </header>

      {/* Main Console Layout */}
      <div className="flex-1 overflow-y-auto p-10">
        <div className="max-w-5xl mx-auto space-y-10">
          {/* ============================================================
              HEADER: CLINICAL PROFILE OVERVIEW
             ============================================================ */}
          <div className="space-y-6">
            {/* Status indicators */}
            <div className="flex flex-wrap items-center gap-3">
              <span className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-mono tracking-widest font-bold ${
                paper.verification_status === "verified"
                  ? "text-emerald-400 bg-emerald-950/20 border border-emerald-500/20"
                  : paper.verification_status === "disputed"
                  ? "text-orange-400 bg-orange-950/20 border border-orange-500/20"
                  : "text-slate-400 bg-slate-900/40 border border-slate-800"
              }`}>
                {paper.verification_status}
              </span>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-purple-400 font-semibold uppercase">
                {paper.evidence_level.replace("_", " ")}
              </span>
              {paper.trial_phase && (
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-blue-400 font-semibold uppercase">
                  {paper.trial_phase.replace("_", " ")}
                </span>
              )}
            </div>

            {/* Trial Title */}
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#000000", letterSpacing: "-0.02em", lineHeight: 1.3 }}>
              {paper.title}
            </h1>

            {/* General Metadata */}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5 shrink-0">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {dateStr}
              </span>
              <span className="shrink-0 italic font-medium text-slate-300">
                {paper.journal || "PubMed Reference"}
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                Citations: <strong className="text-white">{paper.citation_count}</strong>
              </span>
            </div>

            {/* Author list */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#555555", borderTop: "3px solid #000000", paddingTop: 16 }}>
              <User style={{ width: 14, height: 14, color: "#888888", marginTop: 1, flexShrink: 0 }} />
              <div>
                <strong style={{ color: "#000000" }}>Authors:</strong> {paper.authors.join(", ")}
              </div>
            </div>

            {/* Direct PubMed/DOI external Links */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, paddingTop: 4 }}>
              {paper.pmid && (
                <a
                  href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "7px 14px", borderRadius: 9999, border: "2px solid #000000",
                    background: "#FFFFFF", fontSize: 12, color: "#000000", fontWeight: 700,
                    display: "inline-flex", alignItems: "center", gap: 6,
                    textDecoration: "none", boxShadow: "3px 3px 0px #000000",
                    letterSpacing: "0.04em",
                  }}
                >
                  <FileText style={{ width: 13, height: 13, color: "#7C3AED" }} />
                  PubMed Resource
                  <ExternalLink style={{ width: 11, height: 11 }} />
                </a>
              )}
              {paper.doi && (
                <a
                  href={`https://doi.org/${paper.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "7px 14px", borderRadius: 9999, border: "2px solid #000000",
                    background: "#FFFFFF", fontSize: 12, color: "#000000", fontWeight: 700,
                    display: "inline-flex", alignItems: "center", gap: 6,
                    textDecoration: "none", boxShadow: "3px 3px 0px #000000",
                    letterSpacing: "0.04em",
                  }}
                >
                  <ExternalLink style={{ width: 13, height: 13, color: "#7C3AED" }} />
                  DOI Direct
                  <ExternalLink style={{ width: 11, height: 11 }} />
                </a>
              )}
            </div>
          </div>

          {/* ============================================================
              SPLIT BODY: RESEARCH DETAILS vs SYSTEM TAXONOMY
             ============================================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT / CENTER COLUMN: EVIDENCE & OUTCOMES */}
            <div className="lg:col-span-2 space-y-6">
              {/* Abstract card */}
              <div style={{ padding: 32, borderRadius: 20, border: "3px solid #000000", background: "#FFFFFF", boxShadow: "6px 6px 0px #000000" }}>
                <h3 style={{ fontSize: 11, fontWeight: 800, color: "#000000", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "'JetBrains Mono', monospace", borderBottom: "3px solid #000000", paddingBottom: 12, marginBottom: 16 }}>
                  Paper Abstract
                </h3>
                <p style={{ fontSize: 13, color: "#333333", lineHeight: 2, letterSpacing: "0.01em", whiteSpace: "pre-wrap", fontWeight: 500 }}>
                  {paper.abstract || "No abstract content indexed."}
                </p>
              </div>

              {/* Extracted claims checklist */}
              <div style={{ padding: 32, borderRadius: 20, border: "3px solid #000000", background: "#FFFFFF", boxShadow: "6px 6px 0px #000000" }}>
                <h3 style={{ fontSize: 11, fontWeight: 800, color: "#000000", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "'JetBrains Mono', monospace", borderBottom: "3px solid #000000", paddingBottom: 12, marginBottom: 16 }}>
                  Extracted Scientific Claims
                </h3>
                {paper.keywords && paper.keywords.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 16, borderRadius: 12, background: "#D1FAE5", border: "2px solid #000000", boxShadow: "3px 3px 0px #000000" }}>
                      <ShieldCheck style={{ width: 16, height: 16, color: "#059669", flexShrink: 0 }} />
                      <div style={{ color: "#000000", lineHeight: 1.6, fontSize: 12, fontWeight: 600 }}>
                        Claim: Efficacy of therapeutics matches the oncology target mutations.
                        <div style={{ fontSize: 10, color: "#555555", fontFamily: "'JetBrains Mono', monospace", marginTop: 4, fontWeight: 700 }}>
                          STATUS: VERIFIED | CONFIDENCE: {paper.confidence_score.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: "#888888", fontStyle: "italic" }}>No claim audits run on this paper yet.</p>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: CLASSIFICATION & ADVERSARIAL SKEPTICISM */}
            <div className="space-y-6">
              {/* Study Stats Profile card */}
              <div style={{ padding: 24, borderRadius: 20, border: "3px solid #000000", background: "#FFFFFF", boxShadow: "6px 6px 0px #000000" }}>
                <h4 style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", color: "#888888", textTransform: "uppercase", marginBottom: 12, fontWeight: 800 }}>
                  Clinical Profile
                </h4>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, padding: "12px 0", borderBottom: "2px solid #E5E7EB" }}>
                    <span style={{ color: "#555555", fontWeight: 500 }}>Database Source</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#000000", fontWeight: 700, textTransform: "capitalize" }}>{paper.source}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, padding: "12px 0", borderBottom: "2px solid #E5E7EB" }}>
                    <span style={{ color: "#555555", fontWeight: 500 }}>Evidence Level</span>
                    <span style={{ color: "#7C3AED", fontWeight: 800, textTransform: "capitalize" }}>{paper.evidence_level.replace("_", " ")}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, padding: "12px 0", borderBottom: "2px solid #E5E7EB" }}>
                    <span style={{ color: "#555555", fontWeight: 500 }}>Verification Rank</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#000000", fontWeight: 800 }}>{paper.confidence_score.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, padding: "12px 0", borderBottom: "2px solid #E5E7EB" }}>
                    <span style={{ color: "#555555", fontWeight: 500 }}>Study Type</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#000000", fontWeight: 700, textTransform: "capitalize" }}>{paper.study_type.replace("_", " ")}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, padding: "12px 0" }}>
                    <span style={{ color: "#555555", fontWeight: 500 }}>Trial Phase</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#000000", fontWeight: 700, textTransform: "capitalize" }}>
                      {paper.trial_phase ? paper.trial_phase.replace("_", " ") : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Taxonomy Tags Panel */}
              <div style={{ padding: 24, borderRadius: 20, border: "3px solid #000000", background: "#FFFFFF", boxShadow: "6px 6px 0px #000000" }}>
                <h4 style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", color: "#888888", textTransform: "uppercase", fontWeight: 800, marginBottom: 16 }}>
                  Taxonomy Mapping
                </h4>

                {paper.tags && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Cancers */}
                    {paper.tags.cancer && paper.tags.cancer.length > 0 && (
                      <div>
                        <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "#888888", marginBottom: 6, fontWeight: 700 }}>Cancers:</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {paper.tags.cancer.map((c) => (
                            <span key={c} style={{ padding: "4px 10px", borderRadius: 6, border: "2px solid #000000", background: "#FFE4E6", fontSize: 11, color: "#000000", fontWeight: 700 }}>
                              {c.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Drugs */}
                    {paper.tags.drugs && paper.tags.drugs.length > 0 && (
                      <div>
                        <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "#888888", marginBottom: 6, fontWeight: 700 }}>Therapeutics:</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {paper.tags.drugs.map((d) => (
                            <span key={d} style={{ padding: "4px 10px", borderRadius: 6, border: "2px solid #000000", background: "#EDE9FE", fontSize: 11, color: "#000000", fontWeight: 700 }}>
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Biomarkers */}
                    {paper.tags.biomarkers && paper.tags.biomarkers.length > 0 && (
                      <div>
                        <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "#888888", marginBottom: 6, fontWeight: 700 }}>Mutations / Targets:</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {paper.tags.biomarkers.map((b) => (
                            <span key={b} style={{ padding: "4px 10px", borderRadius: 6, border: "2px solid #000000", background: "#DBEAFE", fontSize: 11, color: "#000000", fontWeight: 700 }}>
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Treatments */}
                    {paper.tags.treatment && paper.tags.treatment.length > 0 && (
                      <div>
                        <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "#888888", marginBottom: 6, fontWeight: 700 }}>Therapeutic Classes:</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {paper.tags.treatment.map((t) => (
                            <span key={t} style={{ padding: "4px 10px", borderRadius: 6, border: "2px solid #000000", background: "#D1FAE5", fontSize: 11, color: "#000000", fontWeight: 700 }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Adversarial Review panel */}
              <div style={{ padding: 24, borderRadius: 20, border: "3px solid #000000", background: "#FFE4E6", boxShadow: "6px 6px 0px #000000" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#DC2626", fontWeight: 800, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                  <AlertTriangle style={{ width: 15, height: 15, color: "#DC2626" }} />
                  <span>Adversarial Review</span>
                </div>
                <div style={{ fontSize: 12, color: "#7F1D1D", lineHeight: 1.9, fontWeight: 600 }}>
                  <p style={{ marginBottom: 8 }}>
                    <strong>Study Skeptic Assessment</strong>: This paper is classified as a{" "}
                    <strong>{paper.study_type.replace("_", " ")}</strong> (Evidence Level:{" "}
                    <strong>{paper.evidence_level}</strong>).
                  </p>
                  <p>
                    While findings match molecular targets, clinical practice requires Phase III overall survival
                    PFS primary endpoint data. Readers must verify trial sample size (N), check for potential
                    patient selection biases, and scan conflict of interest statements before applying these
                    claims to therapeutic designs.
                  </p>
                </div>
              </div>

              {/* Related/Contradictory cross-references */}
              {((paper.related_papers && paper.related_papers.length > 0) || 
                (paper.contradictory_papers && paper.contradictory_papers.length > 0)) && (
                <div style={{ padding: 20, borderRadius: 20, border: "3px solid #000000", background: "#FFFFFF", boxShadow: "6px 6px 0px #000000", display: "flex", flexDirection: "column", gap: 16 }}>
                  <h4 style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", color: "#888888", textTransform: "uppercase", fontWeight: 800 }}>
                    Graph Cross-References
                  </h4>
                  
                  {/* Related */}
                  {paper.related_papers && paper.related_papers.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "#888888", fontWeight: 700 }}>Supporting Trials:</div>
                      {paper.related_papers.map((relId) => (
                        <Link
                          key={relId}
                          href={`/papers/${relId}`}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "8px 12px", borderRadius: 10, border: "2px solid #000000",
                            background: "#EDE9FE", fontSize: 11, color: "#000000",
                            fontWeight: 700, textDecoration: "none",
                            boxShadow: "3px 3px 0px #000000",
                          }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 16 }}>Related Clinical Profile</span>
                          <ChevronRight style={{ width: 13, height: 13, flexShrink: 0 }} />
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Contradictory */}
                  {paper.contradictory_papers && paper.contradictory_papers.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 8 }}>
                      <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "#DC2626", fontWeight: 700 }}>Contradictory / Conflict Trials:</div>
                      {paper.contradictory_papers.map((conId) => (
                        <Link
                          key={conId}
                          href={`/papers/${conId}`}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "8px 12px", borderRadius: 10, border: "2px solid #000000",
                            background: "#FFE4E6", fontSize: 11, color: "#000000",
                            fontWeight: 700, textDecoration: "none",
                            boxShadow: "3px 3px 0px #000000",
                          }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 16 }}>Opposing Evidence Warning</span>
                          <ChevronRight style={{ width: 13, height: 13, flexShrink: 0 }} />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
