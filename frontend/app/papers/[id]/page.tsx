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
  AlertTriangle,
  BookOpen,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";

import { getPaper } from "@/lib/api";
import { PaperMetadata } from "@/lib/types";
import { ClinicalTextRenderer } from "@/lib/formatters";

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
      } catch (err: unknown) {
        console.error("Error fetching paper details:", err);
        setError(err instanceof Error ? err.message : "Failed to load paper details.");
      } finally {
        setLoading(false);
      }
    };
    fetchPaperDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-zinc-950">
        <div className="text-center space-y-3">
          <BookOpen className="w-8 h-8 text-indigo-400 animate-bounce mx-auto" />
          <p className="text-[11px] font-mono tracking-widest uppercase text-zinc-500 font-semibold">Loading trial profile...</p>
        </div>
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-zinc-950">
        <div className="text-center max-w-sm space-y-4 p-8 bg-zinc-900/40 border border-white/5 rounded-2xl">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <h4 className="text-[13px] font-semibold text-zinc-200">Failed to retrieve record</h4>
          <p className="text-xs text-zinc-400">{error || "Paper record could not be found."}</p>
          <button
            onClick={() => router.push("/explorer")}
            className="w-full py-2.5 bg-zinc-800 border border-white/5 text-xs text-zinc-200 rounded-xl hover:bg-zinc-700 transition-colors font-medium"
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
    <div className="flex-1 flex flex-col min-h-0 relative h-full bg-zinc-950">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to list</span>
        </button>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">ID: {paper.id.substring(0, 8)}...</span>
        </div>
      </header>

      {/* Main Console Layout */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-5xl mx-auto space-y-10 animate-fade-in">
          {/* ============================================================
              HEADER: CLINICAL PROFILE OVERVIEW
             ============================================================ */}
          <div className="space-y-6">
            {/* Status indicators */}
            <div className="flex flex-wrap items-center gap-3">
              <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-mono tracking-widest font-semibold border ${
                paper.verification_status === "verified"
                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                  : paper.verification_status === "disputed"
                  ? "text-orange-400 bg-orange-500/10 border-orange-500/20"
                  : "text-zinc-400 bg-zinc-800 border-white/5"
              }`}>
                {paper.verification_status || "unverified"}
              </span>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-semibold tracking-widest uppercase">
                {paper.evidence_level.replace(/_/g, " ")}
              </span>
              {paper.trial_phase && (
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold tracking-widest uppercase">
                  {paper.trial_phase.replace(/_/g, " ")}
                </span>
              )}
            </div>

            {/* Trial Title */}
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-snug">
              {paper.title}
            </h1>

            {/* General Metadata */}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-xs text-zinc-400 font-medium">
              <span className="flex items-center gap-1.5 shrink-0">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                {dateStr}
              </span>
              <span className="shrink-0 italic text-zinc-300">
                {paper.journal || "PubMed Reference"}
              </span>
              <span className="font-mono text-[10px] text-zinc-500 tracking-widest uppercase">
                Citations: <strong className="text-zinc-200">{paper.citation_count || 0}</strong>
              </span>
            </div>

            {/* Author list */}
            <div className="flex items-start gap-3 text-[13px] text-zinc-400 border-t border-white/5 pt-6">
              <User className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
              <div className="leading-relaxed">
                <strong className="text-zinc-200 font-semibold mr-1">Authors:</strong> 
                {paper.authors?.join(", ") || "Unknown authors"}
              </div>
            </div>

            {/* Direct PubMed/DOI external Links */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {paper.pmid && (
                <a
                  href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors border border-white/5"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  PubMed Resource
                  <ExternalLink className="w-3 h-3 text-zinc-500" />
                </a>
              )}
              {paper.doi && (
                <a
                  href={`https://doi.org/${paper.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors border border-white/5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                  DOI Direct
                  <ExternalLink className="w-3 h-3 text-zinc-500" />
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
              <div className="p-6 md:p-8 rounded-2xl border border-white/5 bg-zinc-900/40">
                <h3 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-widest font-mono border-b border-white/5 pb-4 mb-6">
                  Paper Abstract
                </h3>
                <ClinicalTextRenderer text={paper.abstract || "No abstract content indexed."} />
              </div>

              {/* Extracted claims checklist */}
              <div className="p-6 md:p-8 rounded-2xl border border-white/5 bg-zinc-900/40">
                <h3 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-widest font-mono border-b border-white/5 pb-4 mb-6">
                  Extracted Scientific Keywords
                </h3>
                {paper.keywords && paper.keywords.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {paper.keywords.map((keyword, idx) => (
                      <div key={idx} className="flex items-start gap-4 p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div className="text-zinc-200 leading-relaxed text-[13px] font-medium">
                          Keyword: {keyword}
                          <div className="text-[10px] text-emerald-400/80 font-mono mt-2 font-semibold tracking-widest uppercase">
                            STATUS: {paper.verification_status} | CONFIDENCE: {paper.confidence_score?.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-zinc-500 italic">No keywords extracted for this paper yet.</p>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: CLASSIFICATION & ADVERSARIAL SKEPTICISM */}
            <div className="space-y-6">
              {/* Study Stats Profile card */}
              <div className="p-6 rounded-2xl border border-white/5 bg-zinc-900/40">
                <h4 className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase font-semibold mb-4">
                  Clinical Profile
                </h4>
                <div className="flex flex-col divide-y divide-white/5">
                  <div className="flex items-center justify-between py-3 text-xs">
                    <span className="text-zinc-500 font-medium">Database Source</span>
                    <span className="font-mono text-zinc-200 font-semibold capitalize">{paper.source}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 text-xs">
                    <span className="text-zinc-500 font-medium">Evidence Level</span>
                    <span className="text-indigo-400 font-semibold capitalize tracking-wide">{paper.evidence_level.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 text-xs">
                    <span className="text-zinc-500 font-medium">Verification Rank</span>
                    <span className="font-mono text-zinc-200 font-semibold">{paper.confidence_score?.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 text-xs">
                    <span className="text-zinc-500 font-medium">Study Type</span>
                    <span className="font-mono text-zinc-200 font-semibold capitalize tracking-wide">{paper.study_type.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 text-xs">
                    <span className="text-zinc-500 font-medium">Trial Phase</span>
                    <span className="font-mono text-zinc-200 font-semibold capitalize tracking-wide">
                      {paper.trial_phase ? paper.trial_phase.replace(/_/g, " ") : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Taxonomy Tags Panel */}
              <div className="p-6 rounded-2xl border border-white/5 bg-zinc-900/40">
                <h4 className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase font-semibold mb-5">
                  Taxonomy Mapping
                </h4>

                {paper.tags && (
                  <div className="flex flex-col gap-5">
                    {/* Cancers */}
                    {paper.tags.cancer && paper.tags.cancer.length > 0 && (
                      <div>
                        <div className="text-[9px] font-mono text-zinc-500 mb-2 font-semibold uppercase tracking-widest">Indication / Cancers:</div>
                        <div className="flex flex-wrap gap-2">
                          {paper.tags.cancer.map((c) => (
                            <span key={c} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[9px] font-medium tracking-widest uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                              <span>🎗️</span> {c.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Drugs */}
                    {paper.tags.drugs && paper.tags.drugs.length > 0 && (
                      <div>
                        <div className="text-[9px] font-mono text-zinc-500 mb-2 font-semibold uppercase tracking-widest">Therapeutics / Drugs:</div>
                        <div className="flex flex-wrap gap-2">
                          {paper.tags.drugs.map((d) => (
                            <span key={d} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[9px] font-medium tracking-widest uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              <span>💊</span> {d.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Biomarkers */}
                    {paper.tags.biomarkers && paper.tags.biomarkers.length > 0 && (
                      <div>
                        <div className="text-[9px] font-mono text-zinc-500 mb-2 font-semibold uppercase tracking-widest">Mutations / Targets:</div>
                        <div className="flex flex-wrap gap-2">
                          {paper.tags.biomarkers.map((b) => (
                            <span key={b} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[9px] font-medium tracking-widest uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <span>🧬</span> {b.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Treatments */}
                    {paper.tags.treatment && paper.tags.treatment.length > 0 && (
                      <div>
                        <div className="text-[9px] font-mono text-zinc-500 mb-2 font-semibold uppercase tracking-widest">Therapeutic Classes:</div>
                        <div className="flex flex-wrap gap-2">
                          {paper.tags.treatment.map((t) => (
                            <span key={t} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[9px] font-medium tracking-widest uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span>🎯</span> {t.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Evidence */}
                    {paper.tags.evidence && paper.tags.evidence.length > 0 && (
                      <div>
                        <div className="text-[9px] font-mono text-zinc-500 mb-2 font-semibold uppercase tracking-widest">Evidence Signals:</div>
                        <div className="flex flex-wrap gap-2">
                          {paper.tags.evidence.map((e) => (
                            <span key={e} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[9px] font-medium tracking-widest uppercase bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              <span>🛡️</span> {e.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Temporal */}
                    {paper.tags.temporal && paper.tags.temporal.length > 0 && (
                      <div>
                        <div className="text-[9px] font-mono text-zinc-500 mb-2 font-semibold uppercase tracking-widest">Recency & Timeline:</div>
                        <div className="flex flex-wrap gap-2">
                          {paper.tags.temporal.map((temp) => (
                            <span key={temp} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[9px] font-medium tracking-widest uppercase bg-zinc-800 text-zinc-300 border border-white/5">
                              <span>⏱️</span> {temp.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Adversarial Review panel */}
              <div className="p-6 rounded-2xl border border-red-500/20 bg-red-500/10">
                <div className="flex items-center gap-2 text-red-400 font-semibold text-[11px] font-mono uppercase tracking-widest mb-4">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Adversarial Review</span>
                </div>
                <div className="text-xs text-red-200/80 leading-relaxed font-medium space-y-3">
                  <p>
                    <strong className="text-red-300">Study Skeptic Assessment</strong>: This paper is classified as a{" "}
                    <strong className="text-red-300">{paper.study_type.replace(/_/g, " ")}</strong> (Evidence Level:{" "}
                    <strong className="text-red-300">{paper.evidence_level}</strong>).
                  </p>
                  {paper.adversarial_review ? (
                    <ClinicalTextRenderer text={paper.adversarial_review} className="text-red-100/90" />
                  ) : (
                    <p>
                      While findings match molecular targets, clinical practice requires Phase III overall survival
                      PFS primary endpoint data. Readers must verify trial sample size (N), check for potential
                      patient selection biases, and scan conflict of interest statements before applying these
                      claims to therapeutic designs.
                    </p>
                  )}
                </div>
              </div>

              {/* Related/Contradictory cross-references */}
              {((paper.related_papers && paper.related_papers.length > 0) || 
                (paper.contradictory_papers && paper.contradictory_papers.length > 0)) && (
                <div className="p-6 rounded-2xl border border-white/5 bg-zinc-900/40 flex flex-col gap-5">
                  <h4 className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase font-semibold">
                    Graph Cross-References
                  </h4>
                  
                  {/* Related */}
                  {paper.related_papers && paper.related_papers.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <div className="text-[9px] font-mono text-zinc-500 font-semibold tracking-widest uppercase mb-1">Supporting Trials:</div>
                      {paper.related_papers.map((relId) => (
                        <Link
                          key={relId}
                          href={`/papers/${relId}`}
                          className="flex items-center justify-between px-3 py-2 rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-xs text-indigo-300 font-semibold hover:bg-indigo-500/20 transition-colors"
                        >
                          <span className="truncate pr-4">Related Clinical Profile</span>
                          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Contradictory */}
                  {paper.contradictory_papers && paper.contradictory_papers.length > 0 && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                      <div className="text-[9px] font-mono text-red-400 font-semibold tracking-widest uppercase mb-1">Contradictory / Conflict Trials:</div>
                      {paper.contradictory_papers.map((conId) => (
                        <Link
                          key={conId}
                          href={`/papers/${conId}`}
                          className="flex items-center justify-between px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-xs text-red-300 font-semibold hover:bg-red-500/20 transition-colors"
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
