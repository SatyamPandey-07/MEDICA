"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Folder,
  Compass,
  Clock,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Database,
  Search,
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
      randomized_controlled_trial: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      meta_analysis:               "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      systematic_review:           "bg-teal-500/10 text-teal-400 border-teal-500/20",
      rct:                         "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      cohort:                      "bg-blue-500/10 text-blue-400 border-blue-500/20",
      expert_opinion:              "bg-zinc-800 text-zinc-300 border-white/5",
      preclinical:                 "bg-red-500/10 text-red-400 border-red-500/20",
    };
    return map[level?.toLowerCase()] || "bg-zinc-800 text-zinc-300 border-white/5";
  };

  const statusStyle = (s: string) => {
    if (s === "verified") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (s === "disputed") return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    return "bg-zinc-800 text-zinc-400 border-white/5";
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-950">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-zinc-100 tracking-wide">
              Knowledge Explorer
            </div>
            <div className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
              {viewMode === "browse" ? "Structured Markdown Store" : "Global Hybrid Search"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-full bg-zinc-800 border border-white/5 text-[10px] font-mono text-zinc-300 font-semibold flex items-center gap-2 tracking-widest">
            <Database className="w-3 h-3" />
            {viewMode === "browse" ? `${papers.length} files indexed` : `${searchResults.length} results found`}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* ── Left panel: folder tree ── */}
        <div className="w-64 shrink-0 border-r border-white/5 bg-zinc-950/50 overflow-y-auto px-4 py-6">
          <div className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase px-3 mb-4 font-semibold">
            Explorer Modes
          </div>

          <div className="flex flex-col gap-1 mb-8">
            <button
              onClick={() => {
                setViewMode("browse");
                setSelectedCancer(null);
              }}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-all w-full text-left ${
                viewMode === "browse"
                  ? "bg-indigo-500/10 text-indigo-400 font-semibold"
                  : "text-zinc-400 hover:bg-white/[0.02] hover:text-zinc-200"
              }`}
            >
              <Database className="w-4 h-4" />
              Browse Knowledge
            </button>
            <button
              onClick={() => setViewMode("search")}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-all w-full text-left ${
                viewMode === "search"
                  ? "bg-indigo-500/10 text-indigo-400 font-semibold"
                  : "text-zinc-400 hover:bg-white/[0.02] hover:text-zinc-200"
              }`}
            >
              <Search className="w-4 h-4" />
              Global Search
            </button>
          </div>

          {viewMode === "browse" && (
            <>
              <div className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase px-3 mb-4 font-semibold">
                Cancer Directories
              </div>

              <div className="flex flex-col gap-1">
                {/* All */}
                <button
                  onClick={() => {
                    setLoading(true);
                    setSelectedCancer(null);
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-all w-full text-left ${
                    selectedCancer === null
                      ? "bg-indigo-500/10 text-indigo-400 font-semibold"
                      : "text-zinc-400 hover:bg-white/[0.02] hover:text-zinc-200"
                  }`}
                >
                  <Folder className="w-4 h-4" />
                  All Repositories
                </button>

                {cancerTypes.map((type) => {
                  const active = selectedCancer === type;
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        setLoading(true);
                        setSelectedCancer(type);
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-all w-full text-left ${
                        active
                          ? "bg-indigo-500/10 text-indigo-400 font-semibold"
                          : "text-zinc-400 hover:bg-white/[0.02] hover:text-zinc-200"
                      }`}
                    >
                      <Folder className="w-4 h-4 shrink-0" />
                      <span className="truncate">
                        {formatFolderName(type)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── Right panel: papers ── */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-5xl mx-auto">
            {/* Heading row + search */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4 animate-fade-in">
              <div>
                <h1 className="text-2xl font-bold tracking-tight mb-2 text-white">
                  {viewMode === "browse" 
                    ? (selectedCancer ? formatFolderName(selectedCancer) : "Comprehensive Memory Store")
                    : "Hybrid Search Engine"}
                </h1>
                <p className="text-[13px] text-zinc-400 leading-relaxed max-w-2xl">
                  {viewMode === "browse"
                    ? "Structured markdown files in the filesystem knowledge layer."
                    : "Semantic and keyword-based retrieval across the entire MEDICA database."}
                </p>
              </div>

              {/* Search */}
              <form onSubmit={handleGlobalSearch} className="relative shrink-0 w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder={viewMode === "browse" ? "Filter local papers..." : "Run global hybrid search..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-zinc-600"
                />
              </form>
            </div>

            {loading ? (
              <div className="flex flex-col gap-4 animate-pulse">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-32 rounded-2xl bg-zinc-900/40 border border-white/5" />
                ))}
              </div>
            ) : (viewMode === "browse" ? filtered : searchResults.map(r => r.paper)).length === 0 ? (
              <div className="text-center py-24 rounded-2xl border border-white/5 bg-zinc-900/40 animate-fade-in">
                <Compass className="w-10 h-10 text-zinc-700 mx-auto mb-4" />
                <div className="text-sm font-semibold text-zinc-300 mb-2">
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
                      className="block p-6 rounded-2xl border border-white/5 bg-zinc-900/40 hover:bg-zinc-800/50 hover:border-white/10 transition-all group"
                    >
                      {/* Top badges row */}
                      <div className="flex items-center flex-wrap gap-2 mb-3">
                        <span className={`inline-flex px-2 py-1 rounded-md font-mono text-[10px] font-medium tracking-widest uppercase border ${evClass}`}>
                          {(p.evidence_level || "trial").replace(/_/g, " ")}
                        </span>

                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[10px] font-medium tracking-widest uppercase border ${stClass}`}>
                          {p.verification_status === "verified"
                            ? <CheckCircle className="w-3 h-3" />
                            : p.verification_status === "disputed"
                            ? <AlertTriangle className="w-3 h-3" />
                            : null}
                          {p.verification_status || "unverified"}
                        </span>

                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[10px] font-medium tracking-widest uppercase border bg-zinc-800 text-zinc-300 border-white/5">
                          <TrendingUp className="w-3 h-3 text-indigo-400" />
                          CONF: {p.confidence_score?.toFixed(2)}
                        </span>
                        
                        {viewMode === "search" && result && (
                           <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[10px] font-medium tracking-widest uppercase border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                             MATCH: {result.score.toFixed(3)}
                           </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="text-[15px] font-semibold text-zinc-100 mb-2 leading-relaxed group-hover:text-indigo-400 transition-colors">
                        {p.title}
                      </h3>

                      {/* Snippet (if in search mode) */}
                      {viewMode === "search" && result?.snippet && (
                        <div className="mb-4 p-3 rounded-lg bg-zinc-950/50 border border-white/5 text-xs text-zinc-400 leading-relaxed italic">
                          "...<span dangerouslySetInnerHTML={{ __html: result.snippet }} />..."
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-[11px] text-zinc-500 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {dateStr}
                        </span>
                        <span>By {authStr}{p.authors?.length > 3 ? " et al." : ""}</span>
                        {p.journal && (
                          <span className="font-mono text-[10px] text-zinc-600 truncate max-w-[200px]">
                            {p.journal}
                          </span>
                        )}
                      </div>

                      {/* Tags */}
                      {p.tags && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {p.tags.cancer?.slice(0, 2).map((c: string) => (
                            <span key={c} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[9px] font-medium tracking-widest uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                              <span>🎗️</span> {c.replace(/_/g, " ")}
                            </span>
                          ))}
                          {p.tags.drugs?.slice(0, 2).map((d: string) => (
                            <span key={d} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[9px] font-medium tracking-widest uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              <span>💊</span> {d.replace(/_/g, " ")}
                            </span>
                          ))}
                          {p.tags.biomarkers?.slice(0, 2).map((b: string) => (
                            <span key={b} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[9px] font-medium tracking-widest uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <span>🧬</span> {b.replace(/_/g, " ")}
                            </span>
                          ))}
                          {p.tags.treatment?.slice(0, 2).map((t: string) => (
                            <span key={t} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[9px] font-medium tracking-widest uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span>🎯</span> {t.replace(/_/g, " ")}
                            </span>
                          ))}
                          {p.tags.evidence?.slice(0, 2).map((e: string) => (
                            <span key={e} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[9px] font-medium tracking-widest uppercase bg-orange-500/10 text-orange-400 border border-orange-500/20">
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
      <div className="flex items-center justify-center h-full bg-zinc-950 text-[11px] font-mono text-zinc-500 tracking-widest">
        <span className="animate-pulse">INITIALIZING EXPLORER CONSOLE...</span>
      </div>
    }>
      <ExplorerPageContent />
    </React.Suspense>
  );
}
