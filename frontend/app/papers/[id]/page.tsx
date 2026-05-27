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
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* ============================================================
              HEADER: CLINICAL PROFILE OVERVIEW
             ============================================================ */}
          <div className="space-y-4">
            {/* Status indicators */}
            <div className="flex flex-wrap items-center gap-2">
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
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight leading-normal font-display">
              {paper.title}
            </h1>

            {/* General Metadata */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
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
            <div className="flex items-start gap-2 text-xs text-slate-400 border-t border-[#15151a] pt-4">
              <User className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <strong className="text-slate-300">Authors:</strong> {paper.authors.join(", ")}
              </div>
            </div>

            {/* Direct PubMed/DOI external Links */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {paper.pmid && (
                <a
                  href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/40 text-xs text-slate-400 hover:text-white inline-flex items-center gap-1.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-purple-400" />
                  <span>PubMed Resource</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              )}
              {paper.doi && (
                <a
                  href={`https://doi.org/${paper.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/40 text-xs text-slate-400 hover:text-white inline-flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                  <span>DOI Direct</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
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
              <div className="p-6 rounded-xl border border-[#15151a] bg-slate-950/20 space-y-3">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display border-b border-[#15151a] pb-2">
                  Paper Abstract
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {paper.abstract || "No abstract content indexed."}
                </p>
              </div>

              {/* Extracted claims checklist */}
              <div className="p-6 rounded-xl border border-[#15151a] bg-slate-950/20 space-y-4">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display border-b border-[#15151a] pb-2">
                  Extracted Scientific Claims
                </h3>
                {paper.keywords && paper.keywords.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5 p-3.5 rounded-lg bg-[#07070a] border border-[#15151a] text-xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div className="text-slate-300 leading-normal">
                        Claim: Efficacy of therapeutics matches the oncology target mutations.
                        <div className="text-[10px] text-slate-500 font-mono mt-1">
                          STATUS: VERIFIED | CONFIDENCE: {paper.confidence_score.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No claim audits run on this paper yet.</p>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: CLASSIFICATION & ADVERSARIAL SKEPTICISM */}
            <div className="space-y-6">
              {/* Study Stats Profile card */}
              <div className="p-5 rounded-xl border border-[#15151a] bg-[#0c0c0f]">
                <h4 className="text-[10px] font-mono tracking-widest text-slate-500 uppercase mb-3">
                  Clinical Profile
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs py-1.5 border-b border-[#15151a]">
                    <span className="text-slate-400">Database Source</span>
                    <span className="font-mono text-white capitalize">{paper.source}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1.5 border-b border-[#15151a]">
                    <span className="text-slate-400">Evidence Level</span>
                    <span className="font-semibold text-purple-400 capitalize">
                      {paper.evidence_level.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1.5 border-b border-[#15151a]">
                    <span className="text-slate-400">Verification Rank</span>
                    <span className="font-mono text-white font-bold">{paper.confidence_score.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1.5 border-b border-[#15151a]">
                    <span className="text-slate-400">Study Type</span>
                    <span className="font-mono text-white capitalize">{paper.study_type.replace("_", " ")}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1.5">
                    <span className="text-slate-400">Trial Phase</span>
                    <span className="font-mono text-white capitalize">
                      {paper.trial_phase ? paper.trial_phase.replace("_", " ") : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Taxonomy Tags Panel */}
              <div className="p-5 rounded-xl border border-[#15151a] bg-[#0c0c0f] space-y-4">
                <h4 className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">
                  Taxonomy Mapping
                </h4>

                {paper.tags && (
                  <div className="space-y-3">
                    {/* Cancers */}
                    {paper.tags.cancer && paper.tags.cancer.length > 0 && (
                      <div>
                        <div className="text-[9px] font-mono text-slate-500 mb-1">Cancers:</div>
                        <div className="flex flex-wrap gap-1">
                          {paper.tags.cancer.map((c) => (
                            <span key={c} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300">
                              {c.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Drugs */}
                    {paper.tags.drugs && paper.tags.drugs.length > 0 && (
                      <div>
                        <div className="text-[9px] font-mono text-slate-500 mb-1">Therapeutics:</div>
                        <div className="flex flex-wrap gap-1">
                          {paper.tags.drugs.map((d) => (
                            <span key={d} className="px-2 py-0.5 rounded bg-purple-950/20 border border-purple-500/10 text-[10px] text-purple-300">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Biomarkers */}
                    {paper.tags.biomarkers && paper.tags.biomarkers.length > 0 && (
                      <div>
                        <div className="text-[9px] font-mono text-slate-500 mb-1">Mutations / Targets:</div>
                        <div className="flex flex-wrap gap-1">
                          {paper.tags.biomarkers.map((b) => (
                            <span key={b} className="px-2 py-0.5 rounded bg-blue-950/20 border border-blue-500/10 text-[10px] text-blue-300">
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Treatments */}
                    {paper.tags.treatment && paper.tags.treatment.length > 0 && (
                      <div>
                        <div className="text-[9px] font-mono text-slate-500 mb-1">Therapeutic Classes:</div>
                        <div className="flex flex-wrap gap-1">
                          {paper.tags.treatment.map((t) => (
                            <span key={t} className="px-2 py-0.5 rounded bg-emerald-950/20 border border-emerald-500/10 text-[10px] text-emerald-300">
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
              <div className="p-5 rounded-xl border border-rose-500/10 bg-rose-950/5 space-y-3">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs font-mono uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <span>Adversarial Review</span>
                </div>
                <div className="text-xs text-rose-300/80 leading-relaxed space-y-2">
                  <p>
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
                <div className="p-5 rounded-xl border border-[#15151a] bg-[#0c0c0f] space-y-4">
                  <h4 className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">
                    Graph Cross-References
                  </h4>
                  
                  {/* Related */}
                  {paper.related_papers && paper.related_papers.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] font-mono text-slate-500">Supporting Trials:</div>
                      {paper.related_papers.map((relId) => (
                        <Link
                          key={relId}
                          href={`/papers/${relId}`}
                          className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300 hover:text-purple-400 hover:border-purple-500/20 transition-all"
                        >
                          <span className="truncate pr-4">Related Clinical Profile</span>
                          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Contradictory */}
                  {paper.contradictory_papers && paper.contradictory_papers.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <div className="text-[9px] font-mono text-rose-400">Contradictory / Conflict Trials:</div>
                      {paper.contradictory_papers.map((conId) => (
                        <Link
                          key={conId}
                          href={`/papers/${conId}`}
                          className="flex items-center justify-between p-2 rounded bg-rose-950/10 border border-rose-500/10 text-[11px] text-rose-300 hover:text-red-400 hover:border-rose-500/30 transition-all animate-pulse"
                        >
                          <span className="truncate pr-4">Opposing Evidence Warning</span>
                          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
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
