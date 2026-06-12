"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Newspaper, ChevronRight, HeartPulse, RefreshCw, Search,
  BookOpen, FileText, Filter, LayoutDashboard, TrendingUp,
  AlertCircle, CheckCircle, Eye, FlaskConical, Microscope,
  ArrowLeft
} from "lucide-react";

import { listVerificationPapers, triggerIngestionJob } from "@/lib/api";
import { VerificationPaper } from "@/lib/types";

const CANCER_TYPES = [
  { id: "colorectal_cancer",        label: "Colorectal Cancer" },
  { id: "breast_cancer",            label: "Breast Cancer" },
  { id: "lung_cancer",              label: "Lung Cancer" },
  { id: "non_small_cell_lung_cancer", label: "NSCLC" },
  { id: "small_cell_lung_cancer",   label: "SCLC" },
  { id: "pancreatic_cancer",        label: "Pancreatic Cancer" },
  { id: "melanoma",                 label: "Melanoma" },
  { id: "glioblastoma",             label: "Glioblastoma" },
  { id: "leukemia",                 label: "Leukemia" },
  { id: "lymphoma",                 label: "Lymphoma" },
  { id: "ovarian_cancer",           label: "Ovarian Cancer" },
  { id: "prostate_cancer",          label: "Prostate Cancer" },
  { id: "renal_cell_carcinoma",     label: "Renal Cell Carcinoma" },
  { id: "multiple_myeloma",         label: "Multiple Myeloma" },
  { id: "bladder_cancer",           label: "Bladder Cancer" },
];

const scoreColor = (s: number) =>
  s >= 0.8 ? "text-emerald-400" : s >= 0.6 ? "text-blue-400" : s >= 0.4 ? "text-amber-400" : "text-red-400";

const isGuideline = (p: VerificationPaper) => {
  const t = p.title.toLowerCase();
  return t.includes("guideline") || t.includes("recommendation") || t.includes("consensus")
    || p.tags?.evidence?.includes("guideline_backed") === true
    || p.evidence_level === "systematic_review" || p.evidence_level === "meta_analysis";
};

export default function TopicNewsPage() {
  const [papers, setPapers] = useState<VerificationPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState("colorectal_cancer");
  const [typeFilter, setTypeFilter] = useState<"all" | "guideline" | "paper">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPaper, setSelectedPaper] = useState<VerificationPaper | null>(null);
  const [scrapeQuery, setScrapeQuery] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState("");

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listVerificationPapers("all", "date", 100);
      setPapers(all);
      if (all.length > 0 && !selectedPaper) setSelectedPaper(all[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPapers(); }, [fetchPapers]);

  const topicPapers = papers.filter(p => {
    const matchTopic = p.tags?.cancer?.includes(selectedTopic)
      || p.title.toLowerCase().includes(selectedTopic.replace(/_/g, " "));
    const matchSearch = !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase());
    const isG = isGuideline(p);
    const matchType = typeFilter === "all" || (typeFilter === "guideline" ? isG : !isG);
    return matchTopic && matchSearch && matchType;
  });

  const guidelines = topicPapers.filter(isGuideline);
  const rcts = topicPapers.filter(p => !isGuideline(p));

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrapeQuery.trim() || scraping) return;
    setScraping(true);
    setScrapeMsg("");
    try {
      const res = await triggerIngestionJob(scrapeQuery || selectedTopic.replace(/_/g, " "), 10);
      setScrapeMsg(res.message);
      setTimeout(() => setScrapeMsg(""), 5000);
    } catch { setScrapeMsg("Failed to trigger ingestion."); }
    finally { setScraping(false); }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-950">
      {/* Header */}
      <header className="px-6 py-3.5 flex items-center justify-between border-b border-white/5 bg-zinc-950/60 backdrop-blur-xl sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-white/5 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-pink-600 to-rose-600 shadow-lg shadow-pink-500/20">
            <Newspaper className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-[13px] font-bold text-zinc-100">Topic Clinical News</div>
            <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Oncology Literature by Indication</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchPapers} className="p-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 border border-white/5 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono border border-white/5 transition-colors">
            <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex min-h-0">
        {/* Sidebar — Cancer Type Nav */}
        <aside className="w-52 shrink-0 border-r border-white/5 bg-zinc-900/20 overflow-y-auto p-3">
          <div className="text-[8px] font-mono uppercase tracking-widest text-zinc-600 px-2 mb-2 font-semibold">Cancer Types</div>
          <nav className="space-y-0.5">
            {CANCER_TYPES.map(ct => {
              const count = papers.filter(p =>
                p.tags?.cancer?.includes(ct.id) || p.title.toLowerCase().includes(ct.id.replace(/_/g, " "))
              ).length;
              const isActive = selectedTopic === ct.id;
              return (
                <button key={ct.id} onClick={() => setSelectedTopic(ct.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all ${
                    isActive
                      ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                      : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300 border border-transparent"
                  }`}>
                  <span className="text-[10px] font-medium truncate">{ct.label}</span>
                  {count > 0 && (
                    <span className={`text-[8px] font-mono font-bold px-1 py-0.5 rounded ${
                      isActive ? "bg-rose-500/20 text-rose-300" : "bg-zinc-800 text-zinc-500"
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden">
          {/* Article List */}
          <div className="w-80 shrink-0 border-r border-white/5 flex flex-col min-h-0">
            {/* List Header */}
            <div className="p-4 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <HeartPulse className="w-4 h-4 text-pink-400" />
                <h2 className="text-[12px] font-bold text-zinc-200 capitalize">
                  {selectedTopic.replace(/_/g, " ")}
                </h2>
                <span className="text-[8px] font-mono text-zinc-600 ml-auto">{topicPapers.length} records</span>
              </div>

              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
                <input type="text" placeholder="Search..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-[10px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-pink-500/40"
                />
              </div>

              <div className="flex gap-1">
                {(["all", "guideline", "paper"] as const).map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    className={`flex-1 py-1 rounded-md text-[8px] font-mono capitalize transition-all border ${
                      typeFilter === t ? "bg-zinc-700 text-zinc-200 border-white/10" : "text-zinc-500 border-transparent hover:text-zinc-300"
                    }`}>
                    {t === "all" ? "All" : t === "guideline" ? "Guidelines" : "Papers"}
                  </button>
                ))}
              </div>
            </div>

            {/* Paper list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="w-5 h-5 text-zinc-600 animate-spin" />
                </div>
              ) : topicPapers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Microscope className="w-8 h-8 text-zinc-700 mb-2" />
                  <div className="text-[11px] text-zinc-600">No papers indexed for this topic.</div>
                  <div className="text-[10px] text-zinc-700 mt-1 max-w-[180px]">
                    Use the ingestion panel on the dashboard to fetch data from PubMed.
                  </div>
                </div>
              ) : (
                topicPapers.map(p => {
                  const isG = isGuideline(p);
                  const isActive = selectedPaper?.id === p.id;
                  return (
                    <div key={p.id} onClick={() => setSelectedPaper(p)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isActive ? "bg-rose-500/8 border-rose-500/20" : "bg-zinc-950/30 border-white/5 hover:bg-zinc-900/50"
                      }`}>
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[7px] font-mono font-bold border ${
                          isG ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        }`}>{isG ? "Guideline" : "Paper"}</span>
                        {p.published && <span className="text-[8px] font-mono text-zinc-600">{new Date(p.published).getFullYear()}</span>}
                        <span className={`text-[8px] font-mono font-bold ml-auto ${scoreColor(p.confidence_score)}`}>
                          {(p.confidence_score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <h4 className="text-[10px] font-medium text-zinc-200 line-clamp-2 leading-snug">{p.title}</h4>
                      <div className="text-[8px] font-mono text-zinc-600 mt-0.5 truncate">{p.journal}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Detail Panel */}
          <div className="flex-1 overflow-y-auto p-6 min-w-0">
            {!selectedPaper || !topicPapers.find(p => p.id === selectedPaper.id) ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <FlaskConical className="w-12 h-12 text-zinc-800 mb-4" />
                <div className="text-sm font-semibold text-zinc-500">Select a paper to view details</div>
              </div>
            ) : (() => {
              const p = selectedPaper;
              const isG = isGuideline(p);
              const tags = p.tags || { cancer: [], drugs: [], biomarkers: [], treatment: [], evidence: [] };
              return (
                <div className="max-w-3xl mx-auto space-y-5">
                  {/* Paper Header */}
                  <div className="p-5 rounded-2xl border border-white/5 bg-zinc-900/40">
                    <div className="flex items-start gap-3 mb-4">
                      <div className={`p-2.5 rounded-xl shrink-0 ${isG ? "bg-violet-500/10" : "bg-blue-500/10"}`}>
                        {isG ? <BookOpen className="w-5 h-5 text-violet-400" /> : <FileText className="w-5 h-5 text-blue-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase border ${
                            isG ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          }`}>{isG ? "Clinical Guideline" : "Research Paper"}</span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase border ${
                            p.verification_status === "verified" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}>{p.verification_status}</span>
                        </div>
                        <h1 className="text-base font-bold text-white leading-snug mb-2">{p.title}</h1>
                        <div className="flex flex-wrap gap-4 text-[10px] font-mono text-zinc-500">
                          {p.journal && <span>📖 {p.journal}</span>}
                          {p.published && <span>📅 {new Date(p.published).toLocaleDateString()}</span>}
                          {p.pmid && (
                            <a href={`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}`} target="_blank" rel="noopener noreferrer"
                              className="text-indigo-400 hover:underline">🔗 PMID {p.pmid}</a>
                          )}
                        </div>
                      </div>
                      <Link href={`/papers/${p.id}`}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-semibold border border-white/5 transition-colors">
                        <Eye className="w-3.5 h-3.5" /> Full Audit
                      </Link>
                    </div>

                    {/* Confidence bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] font-mono">
                        <span className="text-zinc-600">Evidence Confidence</span>
                        <span className={scoreColor(p.confidence_score)}>{(p.confidence_score * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div className={`h-full transition-all duration-700 ${
                          p.confidence_score >= 0.8 ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                          : p.confidence_score >= 0.6 ? "bg-gradient-to-r from-blue-500 to-cyan-500"
                          : "bg-gradient-to-r from-amber-500 to-orange-500"
                        }`} style={{ width: `${p.confidence_score * 100}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* What does it do? */}
                  <div className="p-5 rounded-2xl border border-white/5 bg-zinc-900/40">
                    <h3 className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" /> What does this paper do?
                    </h3>
                    <p className="text-[13px] text-zinc-300 leading-relaxed">
                      {p.abstract
                        ? p.abstract.slice(0, 600) + (p.abstract.length > 600 ? "…" : "")
                        : isG
                          ? `This clinical guideline provides evidence-based recommendations for management of ${tags.cancer.join(", ") || selectedTopic.replace(/_/g, " ")} patients, including standard-of-care protocols and drug regimens.`
                          : `This study evaluates ${tags.drugs.join(", ") || "therapeutic agents"} targeting ${tags.biomarkers.join(", ") || "molecular markers"} in ${tags.cancer.join(", ") || selectedTopic.replace(/_/g, " ")} with evidence-backed outcomes.`
                      }
                    </p>
                  </div>

                  {/* Clinical targets */}
                  {(tags.cancer.length + tags.drugs.length + tags.biomarkers.length + (tags.treatment?.length ?? 0)) > 0 && (
                    <div className="p-5 rounded-2xl border border-white/5 bg-zinc-900/40">
                      <h3 className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 font-semibold mb-3">Clinical Targets & Pathways</h3>
                      <div className="space-y-3">
                        {tags.cancer.length > 0 && (
                          <div>
                            <div className="text-[8px] font-mono text-zinc-600 uppercase mb-1.5">Cancer Types</div>
                            <div className="flex flex-wrap gap-1.5">
                              {tags.cancer.map(c => (
                                <span key={c} className="px-2.5 py-1 rounded-lg text-[10px] font-mono bg-rose-500/10 text-rose-300 border border-rose-500/15 capitalize">
                                  🎗️ {c.replace(/_/g, " ")}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {tags.drugs.length > 0 && (
                          <div>
                            <div className="text-[8px] font-mono text-zinc-600 uppercase mb-1.5">Drugs & Agents</div>
                            <div className="flex flex-wrap gap-1.5">
                              {tags.drugs.map(d => (
                                <span key={d} className="px-2.5 py-1 rounded-lg text-[10px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/15">
                                  💊 {d}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {tags.biomarkers.length > 0 && (
                          <div>
                            <div className="text-[8px] font-mono text-zinc-600 uppercase mb-1.5">Biomarkers</div>
                            <div className="flex flex-wrap gap-1.5">
                              {tags.biomarkers.map(b => (
                                <span key={b} className="px-2.5 py-1 rounded-lg text-[10px] font-mono bg-teal-500/10 text-teal-300 border border-teal-500/15 uppercase">
                                  🧬 {b}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(tags.evidence ?? []).length > 0 && (
                          <div>
                            <div className="text-[8px] font-mono text-zinc-600 uppercase mb-1.5">Evidence Tags</div>
                            <div className="flex flex-wrap gap-1.5">
                              {(tags.evidence ?? []).map(e => (
                                <span key={e} className="px-2.5 py-1 rounded-lg text-[10px] font-mono bg-violet-500/10 text-violet-300 border border-violet-500/15">
                                  {e.replace(/_/g, " ")}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Quick scrape for this topic */}
                  <div className="p-4 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/20">
                    <h3 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-semibold mb-2 flex items-center gap-2">
                      <Microscope className="w-3.5 h-3.5" /> Find More Papers on This Topic
                    </h3>
                    <form onSubmit={handleScrape} className="flex gap-2">
                      <input type="text"
                        placeholder={`e.g. ${selectedTopic.replace(/_/g, " ")} clinical trial...`}
                        value={scrapeQuery} onChange={e => setScrapeQuery(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-[11px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-pink-500/40"
                      />
                      <button type="submit" disabled={scraping}
                        className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-[10px] font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50">
                        {scraping ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                        Scrape
                      </button>
                    </form>
                    {scrapeMsg && (
                      <div className="mt-2 text-[10px] font-mono text-emerald-400">{scrapeMsg}</div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
