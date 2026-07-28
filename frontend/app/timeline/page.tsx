"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Calendar,
  FlaskConical,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

import { listKnowledgePapers } from "@/lib/api";
import { KnowledgePaper } from "@/lib/types";

type PublishedKnowledgePaper = KnowledgePaper & { published: string };

function hasPublishedDate(paper: KnowledgePaper): paper is PublishedKnowledgePaper {
  return typeof paper.published === "string" && paper.published.length > 0;
}

export default function ResearchTimelinePage() {
  const [papers, setPapers] = useState<PublishedKnowledgePaper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPapers = async () => {
      setLoading(true);
      try {
        const data = await listKnowledgePapers();
        const sorted = data
          .filter(hasPublishedDate)
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
      return { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-250" };
    if (status === "disputed")
      return { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50", border: "border-red-250" };
    return { dot: "bg-zinc-400", text: "text-zinc-600", bg: "bg-zinc-50", border: "border-zinc-200" };
  };

  const getEvidenceStyle = (level: string) => {
    const map: Record<string, { bg: string; text: string; border: string }> = {
      randomized_controlled_trial: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-250" },
      meta_analysis:               { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-250" },
      systematic_review:           { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-250" },
      cohort:                      { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-250" },
      expert_opinion:              { bg: "bg-zinc-50", text: "text-zinc-650", border: "border-zinc-200" },
    };
    return map[level?.toLowerCase()] || { bg: "bg-zinc-50", text: "text-zinc-600", border: "border-zinc-200" };
  };

  // Group by year
  const byYear: Record<number, PublishedKnowledgePaper[]> = {};
  papers.forEach((p) => {
    const y = new Date(p.published).getFullYear();
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(p);
  });
  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-50">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-650">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-zinc-800 tracking-wide">
              Research Timeline
            </div>
            <div className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
              Chronological Trial Progression
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-600 bg-white px-3 py-1.5 rounded-full border border-zinc-200 shadow-sm">
          <FlaskConical className="w-3.5 h-3.5 text-zinc-400" />
          {papers.length} milestones indexed
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-8 py-10 md:px-12 w-full min-w-0">
        <div className="w-full">

          {/* Hero heading */}
          <div className="mb-14 text-center">
            <h1 className="text-3xl font-bold text-zinc-850 tracking-tight mb-3">
              Clinical Trial Milestones
            </h1>
            <p className="text-[13px] text-zinc-500 leading-relaxed font-medium max-w-lg mx-auto">
              Chronological map of verified clinical studies, targeted therapeutics, and emerging oncology trials.
            </p>
          </div>

          {loading ? (
            /* Skeleton */
            <div className="flex flex-col gap-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-6">
                  <div className="w-14 h-14 rounded-full bg-zinc-200 animate-pulse shrink-0 border border-zinc-300" />
                  <div className="flex-1 h-32 rounded-2xl bg-white animate-pulse border border-zinc-250 shadow-sm" />
                </div>
              ))}
            </div>
          ) : papers.length === 0 ? (
            /* Empty */
            <div className="text-center py-16 px-8 rounded-3xl border border-zinc-200 bg-white shadow-sm">
              <Calendar className="w-10 h-10 text-zinc-300 mx-auto mb-4" />
              <div className="text-sm font-semibold text-zinc-800 mb-2">
                No milestones indexed yet
              </div>
              <p className="text-[13px] text-zinc-500 max-w-sm mx-auto">
                Ingest oncology trials from PubMed via the Chat Copilot or System Operator to populate the timeline.
              </p>
            </div>
          ) : (
            /* Timeline stream */
            <div className="relative pl-6 md:pl-8">
              {/* Vertical line */}
              <div className="absolute left-6 md:left-8 top-2 bottom-0 w-px bg-gradient-to-b from-indigo-300 via-zinc-250 to-transparent" />

              {years.map((year) => (
                <div key={year} className="mb-14 relative z-0">
                  {/* Year marker */}
                  <div className="flex items-center gap-4 mb-6 relative">
                    <div className="absolute top-1/2 -left-[45px] md:-left-[53px] w-5 h-5 rounded-full bg-white border-4 border-indigo-600 z-10" />
                    <div className="px-4 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-sm font-bold text-indigo-650 font-mono">
                      {year}
                    </div>
                    <div className="h-px flex-1 bg-zinc-200" />
                    <div className="text-[10px] font-mono text-zinc-500 font-semibold px-3 py-1 bg-white rounded-full border border-zinc-200 shadow-sm shrink-0">
                      {byYear[year].length} trial{byYear[year].length !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Papers for this year */}
                  <div className="pl-4 md:pl-8 flex flex-col gap-6">
                    {byYear[year].map((p, idx) => {
                      const pubDate = new Date(p.published);
                      // Only render the level of date precision PubMed actually provided —
                      // showing a specific day for a year-only record would be fabricated data.
                      const precision = p.published_precision;
                      const dateLabel =
                        precision === "day"
                          ? pubDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : precision === "month"
                          ? pubDate.toLocaleDateString("en-US", { month: "short" })
                          : null;
                      const evidStyle = getEvidenceStyle(p.evidence_level);
                      const statusStyle = getStatusColor(p.verification_status);

                      return (
                        <div key={p.id || idx} className="relative group">
                          {/* Timeline node dot (minor) */}
                          <div className={`absolute -left-[40px] md:-left-[56px] top-6 w-2.5 h-2.5 rounded-full z-10 shadow-sm transition-colors ${statusStyle.dot} group-hover:scale-125`} />

                          {/* Card */}
                          <Link
                            href={`/papers/${p.id}`}
                            className="block p-5 md:p-6 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50/50 transition-all hover:border-indigo-400 hover:shadow-md"
                          >
                            {/* Top row */}
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                              {/* Date chip — only shown when we have real month/day precision */}
                              {dateLabel && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-semibold text-zinc-650 bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-200">
                                    {dateLabel}
                                  </span>
                                </div>
                              )}

                              {/* Badges */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold tracking-widest uppercase border ${evidStyle.bg} ${evidStyle.text} ${evidStyle.border}`}>
                                  {(p.evidence_level || "trial").replace(/_/g, " ")}
                                </span>
                                {p.trial_phase && (
                                  <span className="px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold tracking-widest uppercase border bg-sky-50 text-sky-700 border-sky-200">
                                    {p.trial_phase.replace("_", " ")}
                                  </span>
                                )}
                                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold tracking-widest uppercase border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                                  {p.verification_status === "verified"
                                    ? <CheckCircle className="w-3 h-3 text-emerald-600" />
                                    : p.verification_status === "disputed"
                                    ? <AlertTriangle className="w-3 h-3 text-rose-600" />
                                    : null}
                                  {p.verification_status || "unverified"}
                                </span>
                              </div>
                            </div>

                            {/* Title */}
                            <h3 className="text-[15px] font-bold leading-snug text-zinc-800 mb-2.5 tracking-tight group-hover:text-indigo-650 transition-colors">
                              {p.title}
                            </h3>

                            {/* Authors */}
                            <div className="text-[12px] text-zinc-550 mb-4 font-medium flex items-center flex-wrap gap-x-2 gap-y-1">
                              <span>By {(p.authors || []).slice(0, 2).join(", ")}{p.authors?.length > 2 ? " et al." : ""}</span>
                              <span className="w-1 h-1 rounded-full bg-zinc-300" />
                              <span className="text-zinc-500 font-mono text-[10px] tracking-wide">{p.journal}</span>
                            </div>

                            {/* Tags */}
                            {p.tags && (
                              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-zinc-150">
                                {p.tags.cancer?.slice(0, 2).map((c: string) => (
                                  <span key={c} className="px-2 py-1 rounded-md text-[9px] font-mono font-semibold tracking-wide uppercase bg-rose-50 text-rose-750 border border-rose-250 flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="opacity-70">🎗️</span> {c.replace(/_/g, " ")}
                                  </span>
                                ))}
                                {p.tags.drugs?.slice(0, 2).map((d: string) => (
                                  <span key={d} className="px-2 py-1 rounded-md text-[9px] font-mono font-semibold tracking-wide uppercase bg-indigo-50 text-indigo-755 border border-indigo-250 flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="opacity-70">💊</span> {d.replace(/_/g, " ")}
                                  </span>
                                ))}
                                {p.tags.biomarkers?.slice(0, 2).map((b: string) => (
                                  <span key={b} className="px-2 py-1 rounded-md text-[9px] font-mono font-semibold tracking-wide uppercase bg-teal-50 text-teal-750 border border-teal-250 flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="opacity-70">🧬</span> {b.replace(/_/g, " ")}
                                  </span>
                                ))}
                                {p.tags.treatment?.slice(0, 2).map((t: string) => (
                                  <span key={t} className="px-2 py-1 rounded-md text-[9px] font-mono font-semibold tracking-wide uppercase bg-amber-50 text-amber-750 border border-amber-250 flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="opacity-70">🎯</span> {t.replace(/_/g, " ")}
                                  </span>
                                ))}
                                {p.tags.evidence?.slice(0, 2).map((e: string) => (
                                  <span key={e} className="px-2 py-1 rounded-md text-[9px] font-mono font-semibold tracking-wide uppercase bg-sky-50 text-sky-750 border border-sky-250 flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="opacity-70">🛡️</span> {e.replace(/_/g, " ")}
                                  </span>
                                ))}
                                {p.tags.temporal?.slice(0, 2).map((temp: string) => (
                                  <span key={temp} className="px-2 py-1 rounded-md text-[9px] font-mono font-semibold tracking-wide uppercase bg-zinc-50 text-zinc-650 border border-zinc-200 flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="opacity-70">⏱️</span> {temp.replace(/_/g, " ")}
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
