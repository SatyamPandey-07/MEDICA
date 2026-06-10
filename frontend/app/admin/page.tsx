"use client";

import React, { useEffect, useState } from "react";
import {
  Cpu,
  Play,
  Activity,
  Terminal,
  Search,
  CheckCircle,
  XCircle,
  RefreshCw,
  Zap,
  Database,
  Clock,
} from "lucide-react";

import { listIngestionJobs, triggerIngestionJob, triggerOptimization } from "@/lib/api";
import { IngestionJob } from "@/lib/types";

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function AdminDashboardPage() {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [triggerMsg, setTriggerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadJobs = async () => {
    try { setJobs(await listIngestionJobs()); } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const init = async () => { setLoading(true); await loadJobs(); setLoading(false); };
    init();
    const iv = setInterval(loadJobs, 4000);
    return () => clearInterval(iv);
  }, []);

  const handleTriggerIngestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || submitting) return;
    setSubmitting(true);
    setTriggerMsg(null);
    try {
      const res = await triggerIngestionJob(query, limit);
      setTriggerMsg({ type: "success", text: res.message });
      setQuery("");
      await loadJobs();
    } catch (err: unknown) {
      setTriggerMsg({ type: "error", text: errorMessage(err, "Failed to trigger ingestion.") });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTriggerOptimize = async () => {
    if (optimizing) return;
    setOptimizing(true);
    try {
      const res = await triggerOptimization();
      setTriggerMsg({ type: "success", text: res.message });
    } catch (err: unknown) {
      setTriggerMsg({ type: "error", text: `Optimization failed: ${errorMessage(err, "Unknown error.")}` });
    } finally {
      setOptimizing(false);
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; border: string; icon: React.ReactNode }> = {
      done:    { bg: "bg-emerald-500/10", color: "text-emerald-400", border: "border-emerald-500/20", icon: <CheckCircle className="w-3 h-3" /> },
      running: { bg: "bg-blue-500/10", color: "text-blue-400", border: "border-blue-500/20", icon: <Activity className="w-3 h-3 animate-pulse" /> },
      failed:  { bg: "bg-red-500/10", color: "text-red-400", border: "border-red-500/20", icon: <XCircle className="w-3 h-3" /> },
      pending: { bg: "bg-zinc-800", color: "text-zinc-400", border: "border-zinc-700", icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
    };
    const s = styles[status.toLowerCase()] || styles.pending;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-medium border uppercase tracking-widest ${s.bg} ${s.color} ${s.border}`}>
        {s.icon} {status}
      </span>
    );
  };

  const totalIndexed = jobs.reduce((acc, j) => acc + (j.processed || 0), 0);
  const totalFetched  = jobs.reduce((acc, j) => acc + (j.fetched  || 0), 0);

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-950">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-zinc-100 tracking-wide">
              System Operator
            </div>
            <div className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
              Pipeline Control Panel
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-mono text-blue-400 font-semibold flex items-center gap-2 tracking-widest">
            <Activity className="w-3 h-3 animate-pulse" />
            {jobs.filter(j => j.status === "running").length} RUNNING
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Hero heading */}
          <div className="mb-8 animate-fade-in">
            <h1 className="text-2xl font-bold tracking-tight mb-2 text-white">
              Medica Pipeline Operator
            </h1>
            <p className="text-[13px] text-zinc-400 leading-relaxed max-w-2xl">
              Manual scheduler console &mdash; scrape PubMed, ingest raw papers, index embeddings, and run optimization scripts.
            </p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-fade-in">
            {[
              { label: "Total Runs", value: jobs.length, icon: Terminal, color: "text-indigo-400", bg: "bg-indigo-500/10" },
              { label: "Papers Fetched", value: totalFetched, icon: Database, color: "text-blue-400", bg: "bg-blue-500/10" },
              { label: "Papers Indexed", value: totalIndexed, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            ].map((c) => {
              const IconComponent = c.icon;
              return (
                <div key={c.label} className="p-6 rounded-2xl border border-white/5 bg-zinc-900/40">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
                      {c.label}
                    </span>
                    <div className={`p-2 rounded-lg ${c.bg}`}>
                      <IconComponent className={`w-4 h-4 ${c.color}`} />
                    </div>
                  </div>
                  <div className="text-3xl font-bold tracking-tight text-white">
                    {c.value}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Control cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 animate-fade-in" style={{ animationDelay: "100ms" }}>
            {/* Scraper form */}
            <div className="lg:col-span-2 p-6 rounded-2xl border border-white/5 bg-zinc-900/40">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/5">
                <Search className="w-4 h-4 text-indigo-400" />
                <span className="text-[11px] font-mono tracking-widest text-zinc-300 uppercase font-semibold">
                  Ingest Research Adapter
                </span>
              </div>

              <form onSubmit={handleTriggerIngestion}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  {/* Query input */}
                  <div className="md:col-span-3">
                    <label className="block mb-2 text-[10px] font-mono tracking-widest text-zinc-500 uppercase font-semibold">
                      Search Terms
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="e.g. osimertinib NSCLC targeted therapy..."
                        disabled={submitting}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-zinc-600 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Limit */}
                  <div>
                    <label className="block mb-2 text-[10px] font-mono tracking-widest text-zinc-500 uppercase font-semibold">
                      Limit
                    </label>
                    <select
                      value={limit}
                      onChange={(e) => setLimit(Number(e.target.value))}
                      disabled={submitting}
                      className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 appearance-none disabled:opacity-50"
                    >
                      {[5, 10, 25, 50].map((v) => (
                        <option key={v} value={v}>{v} papers</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Status message */}
                {triggerMsg && (
                  <div className={`px-4 py-3 rounded-xl mb-4 text-[12px] font-medium border flex items-center gap-2 ${
                    triggerMsg.type === "success" 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                  }`}>
                    {triggerMsg.type === "success" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {triggerMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !query.trim()}
                  className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    submitting || !query.trim()
                      ? "bg-zinc-800/50 text-zinc-500 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                  }`}
                >
                  <Play className="w-4 h-4" />
                  {submitting ? "Initializing pipeline..." : "Launch Ingestion Run"}
                </button>
              </form>
            </div>

            {/* Optimizer card */}
            <div className="p-6 rounded-2xl border border-white/5 bg-zinc-900/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/5">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <span className="text-[11px] font-mono tracking-widest text-zinc-300 uppercase font-semibold">
                    Memory Optimizer
                  </span>
                </div>
                <p className="text-[13px] text-zinc-400 leading-relaxed">
                  Trigger the weekly relinking script to compute semantic controversies, rebuild pgvector index files, and cross-reference citations.
                </p>
              </div>
              <button
                onClick={handleTriggerOptimize}
                disabled={optimizing}
                className={`mt-6 w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all ${
                  optimizing
                    ? "bg-zinc-800/50 text-zinc-500 cursor-not-allowed"
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${optimizing ? "animate-spin" : ""}`} />
                {optimizing ? "Analyzing nodes..." : "Trigger Relinking Run"}
              </button>
            </div>
          </div>

          {/* Job ledger */}
          <div className="rounded-2xl border border-white/5 bg-zinc-900/40 overflow-hidden animate-fade-in" style={{ animationDelay: "200ms" }}>
            <div className="px-6 py-4 border-b border-white/5 bg-zinc-950/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-zinc-400" />
                <span className="text-[11px] font-mono tracking-widest text-zinc-300 uppercase font-semibold">
                  Background Ingestion Runs
                </span>
              </div>
              <button
                onClick={loadJobs}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto min-h-[250px]">
              {loading ? (
                <div className="flex items-center justify-center py-20 gap-2 text-[12px] text-zinc-500">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Querying operator runs...
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-20 text-[12px] text-zinc-500 italic">
                  No ingestion runs triggered yet.
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-zinc-950/20">
                      {["Job ID", "Query Terms", "Semantic Expansion", "Status", "Indexed Stats", "Initialized", "Diagnostics"].map((h) => (
                        <th key={h} className="px-5 py-4 text-left text-[10px] font-mono tracking-widest text-zinc-500 uppercase font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => {
                      const startStr = j.started_at
                        ? new Date(j.started_at).toLocaleTimeString()
                        : "Pending";
                      const expandedTerms = j.expanded_terms || [];
                      const extraTerms = expandedTerms.filter(
                        (t) => t.toLowerCase() !== j.query.toLowerCase()
                      );
                      
                      return (
                        <tr
                          key={j.id}
                          className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-5 py-4 font-mono text-[11px] text-zinc-400" title={j.id}>
                            {j.id.substring(0, 8)}…
                          </td>
                          <td className="px-5 py-4 text-[13px] font-medium text-zinc-200 max-w-[200px] truncate" title={j.query}>
                            {j.query}
                          </td>
                          <td className="px-5 py-4 max-w-[280px]">
                            {j.status === "running" ? (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-indigo-400">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                expanding…
                              </span>
                            ) : extraTerms.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {extraTerms.map((term, tIdx) => (
                                  <span
                                    key={tIdx}
                                    className="px-2 py-1 rounded-md text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-white/5 truncate max-w-[120px]"
                                    title={term}
                                  >
                                    {term}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] font-mono text-zinc-600 italic">
                                {j.status === "pending" ? "queued" : "no expansion"}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {statusBadge(j.status)}
                          </td>
                          <td className="px-5 py-4 font-mono text-[11px] text-zinc-400">
                            {j.status === "running" ? (
                              <span className="text-zinc-500">processing…</span>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span>Fetched: <span className="text-zinc-200">{j.fetched}</span></span>
                                <span>Indexed: <span className="text-indigo-400">{j.processed}</span></span>
                                {(j.failed ?? 0) > 0 && <span className="text-red-400">Failed: {j.failed}</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4 text-[11px] font-mono text-zinc-500">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              {startStr}
                            </div>
                          </td>
                          <td className="px-5 py-4 font-mono text-[10px] max-w-[180px] truncate" title={j.error_message || ""}>
                            {j.status === "failed" ? (
                              <span className="text-red-400">{j.error_message}</span>
                            ) : j.status === "done" ? (
                              <span className="text-emerald-500/70">✓ pipeline completed</span>
                            ) : (
                              <span className="text-zinc-600">waiting…</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
