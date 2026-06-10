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
      return { dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
    if (status === "disputed")
      return { dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" };
    return { dot: "bg-zinc-500", text: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" };
  };

  const getEvidenceStyle = (level: string) => {
    const map: Record<string, { bg: string; text: string; border: string }> = {
      randomized_controlled_trial: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20" },
      meta_analysis:               { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
      systematic_review:           { bg: "bg-teal-500/10", text: "text-teal-400", border: "border-teal-500/20" },
      cohort:                      { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20" },
      expert_opinion:              { bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/20" },
    };
    return map[level?.toLowerCase()] || { bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/20" };
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
    <div className="flex flex-col h-full min-h-0 bg-zinc-950">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-zinc-100 tracking-wide">
              Research Timeline
            </div>
            <div className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
              Chronological Trial Progression
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-white/5">
          <FlaskConical className="w-3.5 h-3.5" />
          {papers.length} milestones indexed
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-10 md:px-12">
        <div className="max-w-4xl mx-auto">

          {/* Hero heading */}
          <div className="mb-14 text-center">
            <h1 className="text-3xl font-bold text-zinc-100 tracking-tight mb-3">
              Clinical Trial Milestones
            </h1>
            <p className="text-[13px] text-zinc-400 leading-relaxed font-medium max-w-lg mx-auto">
              Chronological map of verified clinical studies, targeted therapeutics, and emerging oncology trials.
            </p>
          </div>

          {loading ? (
            /* Skeleton */
            <div className="flex flex-col gap-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-6">
                  <div className="w-14 h-14 rounded-full bg-zinc-900 animate-pulse shrink-0 border border-white/5" />
                  <div className="flex-1 h-32 rounded-2xl bg-zinc-900/50 animate-pulse border border-white/5" />
                </div>
              ))}
            </div>
          ) : papers.length === 0 ? (
            /* Empty */
            <div className="text-center py-16 px-8 rounded-3xl border border-white/5 bg-zinc-900/20">
              <Calendar className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
              <div className="text-sm font-semibold text-zinc-300 mb-2">
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
              <div className="absolute left-6 md:left-8 top-2 bottom-0 w-px bg-gradient-to-b from-indigo-500/50 via-zinc-800 to-transparent" />

              {years.map((year) => (
                <div key={year} className="mb-14 relative z-0">
                  {/* Year marker */}
                  <div className="flex items-center gap-4 mb-6 relative">
                    <div className="absolute top-1/2 -left-[45px] md:-left-[53px] w-5 h-5 rounded-full bg-zinc-950 border-4 border-indigo-500 z-10" />
                    <div className="px-4 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-400 font-mono">
                      {year}
                    </div>
                    <div className="h-px flex-1 bg-white/5" />
                    <div className="text-[10px] font-mono text-zinc-500 font-semibold px-3 py-1 bg-zinc-900/50 rounded-full border border-white/5 shrink-0">
                      {byYear[year].length} trial{byYear[year].length !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Papers for this year */}
                  <div className="pl-4 md:pl-8 flex flex-col gap-6">
                    {byYear[year].map((p, idx) => {
                      const pubDate = new Date(p.published);
                      const monthDay = pubDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      const evidStyle = getEvidenceStyle(p.evidence_level);
                      const statusStyle = getStatusColor(p.verification_status);

                      return (
                        <div key={p.id || idx} className="relative group">
                          {/* Timeline node dot (minor) */}
                          <div className={`absolute -left-[40px] md:-left-[56px] top-6 w-2.5 h-2.5 rounded-full z-10 shadow-[0_0_8px_currentColor] transition-colors ${statusStyle.dot} group-hover:scale-125`} />

                          {/* Card */}
                          <Link
                            href={`/papers/${p.id}`}
                            className="block p-5 md:p-6 rounded-2xl border border-white/5 bg-zinc-900/40 hover:bg-zinc-800/60 transition-all hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5"
                          >
                            {/* Top row */}
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                              {/* Date chip */}
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono font-semibold text-zinc-400 bg-zinc-800 px-2.5 py-1 rounded-lg border border-white/5">
                                  {monthDay}
                                </span>
                              </div>

                              {/* Badges */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold tracking-widest uppercase border ${evidStyle.bg} ${evidStyle.text} ${evidStyle.border}`}>
                                  {(p.evidence_level || "trial").replace(/_/g, " ")}
                                </span>
                                {p.trial_phase && (
                                  <span className="px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold tracking-widest uppercase border bg-sky-500/10 text-sky-400 border-sky-500/20">
                                    {p.trial_phase.replace("_", " ")}
                                  </span>
                                )}
                                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold tracking-widest uppercase border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                                  {p.verification_status === "verified"
                                    ? <CheckCircle className="w-3 h-3" />
                                    : p.verification_status === "disputed"
                                    ? <AlertTriangle className="w-3 h-3" />
                                    : null}
                                  {p.verification_status || "unverified"}
                                </span>
                              </div>
                            </div>

                            {/* Title */}
                            <h3 className="text-[15px] font-bold leading-snug text-zinc-100 mb-2.5 tracking-tight group-hover:text-indigo-400 transition-colors">
                              {p.title}
                            </h3>

                            {/* Authors */}
                            <div className="text-[12px] text-zinc-400 mb-4 font-medium flex items-center flex-wrap gap-x-2 gap-y-1">
                              <span>By {(p.authors || []).slice(0, 2).join(", ")}{p.authors?.length > 2 ? " et al." : ""}</span>
                              <span className="w-1 h-1 rounded-full bg-zinc-700" />
                              <span className="text-zinc-500 font-mono text-[10px] tracking-wide">{p.journal}</span>
                            </div>

                            {/* Tags */}
                            {p.tags && (
                              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/5">
                                {p.tags.cancer?.slice(0, 2).map((c: string) => (
                                  <span key={c} className="px-2 py-1 rounded-md text-[9px] font-mono font-semibold tracking-wide uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="opacity-70">🎗️</span> {c.replace(/_/g, " ")}
                                  </span>
                                ))}
                                {p.tags.drugs?.slice(0, 2).map((d: string) => (
                                  <span key={d} className="px-2 py-1 rounded-md text-[9px] font-mono font-semibold tracking-wide uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="opacity-70">💊</span> {d.replace(/_/g, " ")}
                                  </span>
                                ))}
                                {p.tags.biomarkers?.slice(0, 2).map((b: string) => (
                                  <span key={b} className="px-2 py-1 rounded-md text-[9px] font-mono font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="opacity-70">🧬</span> {b.replace(/_/g, " ")}
                                  </span>
                                ))}
                                {p.tags.treatment?.slice(0, 2).map((t: string) => (
                                  <span key={t} className="px-2 py-1 rounded-md text-[9px] font-mono font-semibold tracking-wide uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="opacity-70">🎯</span> {t.replace(/_/g, " ")}
                                  </span>
                                ))}
                                {p.tags.evidence?.slice(0, 2).map((e: string) => (
                                  <span key={e} className="px-2 py-1 rounded-md text-[9px] font-mono font-semibold tracking-wide uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="opacity-70">🛡️</span> {e.replace(/_/g, " ")}
                                  </span>
                                ))}
                                {p.tags.temporal?.slice(0, 2).map((temp: string) => (
                                  <span key={temp} className="px-2 py-1 rounded-md text-[9px] font-mono font-semibold tracking-wide uppercase bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 flex items-center gap-1.5 whitespace-nowrap">
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
