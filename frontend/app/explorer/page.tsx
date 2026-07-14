"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Compass,
  Clock,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Database,
  Search,
  ChevronRight,
  User,
  FileText,
} from "lucide-react";

import { listCancerTypes, listKnowledgePapers, search } from "@/lib/api";
import { KnowledgePaper, RetrievalResult } from "@/lib/types";

function ExplorerPageContent() {
  const searchParams = useSearchParams();
  const [cancerTypes, setCancerTypes] = useState<string[]>([]);
  const [selectedCancer, setSelectedCancer] = useState<string | null>(null);
  const [papers, setPapers] = useState<KnowledgePaper[]>([]);
  const [searchResults, setSearchResults] = useState<RetrievalResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"browse" | "search">("browse");

  useEffect(() => {
    listCancerTypes()
      .then(setCancerTypes)
      .catch(console.error);
  }, []);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setSearchQuery(q);
      setViewMode("search");
      setLoading(true);
      search(q)
        .then(setSearchResults)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [searchParams]);

  useEffect(() => {
    if (viewMode === "browse") {
      setLoading(true);
      listKnowledgePapers(selectedCancer || undefined)
        .then(setPapers)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [selectedCancer, viewMode]);

  const handleGlobalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setViewMode("search");
    try {
      const results = await search(searchQuery);
      setSearchResults(results);
    } catch (err) {
      console.error("Global search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatFolderName = (name: string) =>
    name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const filtered = viewMode === "browse" 
    ? papers.filter((p) => !searchQuery || p.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const evidenceStyle = (level: string) => {
    const map: Record<string, string> = {
      randomized_controlled_trial: "bg-indigo-50 text-indigo-700 border-indigo-200",
      meta_analysis:               "bg-emerald-50 text-emerald-700 border-emerald-200",
      systematic_review:           "bg-teal-50 text-teal-700 border-teal-200",
      rct:                         "bg-indigo-50 text-indigo-700 border-indigo-200",
      cohort:                      "bg-blue-50 text-blue-700 border-blue-200",
      expert_opinion:              "bg-zinc-50 text-zinc-600 border-zinc-200",
      preclinical:                 "bg-rose-50 text-rose-700 border-rose-200",
    };
    return map[level?.toLowerCase()] || "bg-zinc-50 text-zinc-600 border-zinc-200";
  };

  const statusStyle = (s: string) => {
    if (s === "verified") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (s === "disputed") return "bg-red-50 text-red-700 border-red-200";
    return "bg-amber-50 text-amber-700 border-amber-200";
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-50">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-zinc-800 tracking-wide">
              Knowledge Explorer
            </div>
            <div className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
              {viewMode === "browse" ? "Structured Markdown Store" : "Global Hybrid Search"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-full bg-zinc-100 border border-zinc-200 text-[10px] font-mono text-zinc-700 font-semibold flex items-center gap-2 tracking-widest">
            <Database className="w-3 h-3" />
            {viewMode === "browse" ? `${papers.length} files indexed` : `${searchResults.length} results found`}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* ── Left panel: folder tree ── */}
        <div className="w-64 shrink-0 border-r border-zinc-200 bg-white overflow-y-auto px-4 py-6">
          <div className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase px-3 mb-4 font-semibold">
            Explorer Modes
          </div>

          <div className="flex flex-col gap-1 mb-8">
            <button
              onClick={() => {
                setViewMode("browse");
                setSelectedCancer(null);
              }}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-all w-full text-left ${
                viewMode === "browse" && !selectedCancer
                  ? "bg-indigo-50 border border-indigo-100 text-indigo-600 font-semibold shadow-sm"
                  : "text-zinc-500 hover:bg-zinc-50 border border-transparent"
              }`}
            >
              <Database className="w-4 h-4" /> Browse Literature
            </button>
            <button
              onClick={() => {
                setViewMode("search");
                setSelectedCancer(null);
              }}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-all w-full text-left ${
                viewMode === "search"
                  ? "bg-indigo-50 border border-indigo-100 text-indigo-600 font-semibold shadow-sm"
                  : "text-zinc-500 hover:bg-zinc-50 border border-transparent"
              }`}
            >
              <Search className="w-4 h-4" /> Global Hybrid Search
            </button>
          </div>

          {viewMode === "browse" && (
            <>
              <div className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase px-3 mb-3 font-semibold">
                Categories
              </div>
              <div className="flex flex-col gap-1">
                {cancerTypes.map((name) => {
                  const active = selectedCancer === name;
                  return (
                    <button
                      key={name}
                      onClick={() => setSelectedCancer(name)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all text-left ${
                        active
                          ? "bg-indigo-50 border border-indigo-100 text-indigo-600 font-semibold shadow-sm"
                          : "text-zinc-500 hover:bg-zinc-50 border border-transparent"
                      }`}
                    >
                      <span className="truncate">{formatFolderName(name)}</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── Right panel: papers ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-8 py-8 w-full min-w-0">
          <div className="w-full">
            {/* Heading row + search */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4 animate-fade-in">
              <div>
                <h1 className="text-2xl font-bold tracking-tight mb-2 text-zinc-800">
                  {viewMode === "browse" 
                    ? (selectedCancer ? formatFolderName(selectedCancer) : "Comprehensive Memory Store")
                    : "Hybrid Search Engine"}
                </h1>
                <p className="text-[13px] text-zinc-500 leading-relaxed max-w-2xl">
                  {viewMode === "browse"
                    ? "Structured markdown files in the filesystem knowledge layer."
                    : "Semantic and keyword-based retrieval across the entire MEDICA database."}
                </p>
              </div>

              {/* Search */}
              <form onSubmit={handleGlobalSearch} className="relative shrink-0 w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder={viewMode === "browse" ? "Filter local papers..." : "Run global hybrid search..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-800 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500/20 transition-all placeholder:text-zinc-400"
                />
              </form>
            </div>

            {loading ? (
              <div className="flex flex-col gap-4 animate-pulse">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-32 rounded-2xl bg-white border border-zinc-200 shadow-sm" />
                ))}
              </div>
            ) : (viewMode === "browse" ? filtered : searchResults.map(r => r.paper)).length === 0 ? (
              <div className="text-center py-24 rounded-2xl border border-zinc-200 bg-white shadow-sm animate-fade-in">
                <Compass className="w-10 h-10 text-zinc-300 mx-auto mb-4" />
                <div className="text-sm font-semibold text-zinc-800 mb-2">
                  No papers found
                </div>
                <p className="text-[12px] text-zinc-500 max-w-xs mx-auto">
                  {viewMode === "browse" 
                    ? "Run a PubMed search from the Chat Copilot or trigger an ingestion job from the System Operator."
                    : "Try a different search query or use the browse mode to explore the knowledge base."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 animate-fade-in" style={{ animationDelay: "100ms" }}>
                {(viewMode === "browse" ? filtered : searchResults.map(r => r.paper)).map((p) => {
                  const result = viewMode === "search" ? searchResults.find(r => r.paper.id === p.id) : null;
                  const dateStr = p.published
                    ? new Date(p.published).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                    : "Date Unknown";
                  const authStr = (p.authors || []).slice(0, 3).join(", ");
                  const evClass = evidenceStyle(p.evidence_level || "unknown");
                  const stClass = statusStyle(p.verification_status);

                  return (
                    <Link
                      key={p.id}
                      href={`/papers/${p.id}`}
                      className="block p-6 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 shadow-sm transition-all group"
                    >
                      {/* Top badges row */}
                      <div className="flex items-center flex-wrap gap-2 mb-3">
                        <span className={`inline-flex px-2 py-1 rounded-md font-mono text-[10px] font-medium tracking-widest uppercase border ${evClass}`}>
                          {(p.evidence_level || "trial").replace(/_/g, " ")}
                        </span>

                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[10px] font-medium tracking-widest uppercase border ${stClass}`}>
                          {p.verification_status === "verified"
                            ? <CheckCircle className="w-3 h-3 text-emerald-600" />
                            : p.verification_status === "disputed"
                            ? <AlertTriangle className="w-3 h-3 text-red-600" />
                            : null}
                          {p.verification_status || "unverified"}
                        </span>

                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[10px] font-medium tracking-widest uppercase border bg-zinc-50 text-zinc-700 border-zinc-200">
                          <TrendingUp className="w-3 h-3 text-indigo-600" />
                          CONF: {p.confidence_score?.toFixed(2)}
                        </span>
                        
                        {viewMode === "search" && result && (
                           <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[10px] font-medium tracking-widest uppercase border bg-indigo-50 text-indigo-700 border-indigo-200">
                             MATCH: {result.score.toFixed(3)}
                           </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="text-[15px] font-semibold text-zinc-800 mb-2 leading-relaxed group-hover:text-indigo-600 transition-colors">
                        {p.title}
                      </h3>

                      {/* Snippet (if in search mode) */}
                      {viewMode === "search" && result?.snippet && (
                        <div className="mb-4 p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 leading-relaxed italic">
                          "...<span dangerouslySetInnerHTML={{ __html: result.snippet }} />..."
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-[11px] text-zinc-500 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {dateStr}
                        </span>
                        {authStr && (
                          <span className="flex items-center gap-1.5">
                            <User className="w-3 h-3" />
                            {authStr}
                          </span>
                        )}
                        {p.journal && (
                          <span className="flex items-center gap-1.5">
                            <FileText className="w-3 h-3" />
                            {p.journal}
                          </span>
                        )}
                      </div>

                      {p.tags && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {p.tags.cancer?.slice(0, 2).map((c: string) => (
                            <span key={c} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[9px] font-medium tracking-widest uppercase bg-rose-50 text-rose-750 border border-rose-250">
                              <span>🎗️</span> {c.replace(/_/g, " ")}
                            </span>
                          ))}
                          {p.tags.drugs?.slice(0, 2).map((d: string) => (
                            <span key={d} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[9px] font-medium tracking-widest uppercase bg-indigo-50 text-indigo-750 border border-indigo-250">
                              <span>💊</span> {d.replace(/_/g, " ")}
                            </span>
                          ))}
                          {p.tags.biomarkers?.slice(0, 2).map((b: string) => (
                            <span key={b} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[9px] font-medium tracking-widest uppercase bg-teal-50 text-teal-750 border border-teal-250">
                              <span>🧬</span> {b.toUpperCase().replace(/_/g, " ")}
                            </span>
                          ))}
                          {p.tags.treatment?.slice(0, 2).map((t: string) => (
                            <span key={t} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[9px] font-medium tracking-widest uppercase bg-emerald-50 text-emerald-750 border border-emerald-250">
                              <span>🎯</span> {t.replace(/_/g, " ")}
                            </span>
                          ))}
                          {p.tags.evidence?.slice(0, 2).map((e: string) => (
                            <span key={e} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[9px] font-medium tracking-widest uppercase bg-amber-50 text-amber-750 border border-amber-250">
                              <span>🛡️</span> {e.replace(/_/g, " ")}
                            </span>
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
    </div>
  );
}

export default function KnowledgeExplorerPage() {
  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center h-full bg-zinc-50 text-[11px] font-mono text-zinc-400 tracking-widest">
        <span className="animate-pulse">LOADING KNOWLEDGE BASE...</span>
      </div>
    }>
      <ExplorerPageContent />
    </React.Suspense>
  );
}
