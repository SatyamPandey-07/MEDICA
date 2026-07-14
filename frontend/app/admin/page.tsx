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
      done:    { bg: "bg-emerald-50", color: "text-emerald-700", border: "border-emerald-250", icon: <CheckCircle className="w-3 h-3 text-emerald-600" /> },
      running: { bg: "bg-blue-50", color: "text-blue-700", border: "border-blue-250", icon: <Activity className="w-3 h-3 text-blue-600 animate-pulse" /> },
      failed:  { bg: "bg-rose-50", color: "text-rose-700", border: "border-rose-250", icon: <XCircle className="w-3 h-3 text-rose-600" /> },
      pending: { bg: "bg-zinc-50", color: "text-zinc-600", border: "border-zinc-250", icon: <RefreshCw className="w-3 h-3 text-zinc-500 animate-spin" /> },
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
    <div className="flex flex-col h-full min-h-0 bg-zinc-50">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-650">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-zinc-800 tracking-wide">
              System Operator
            </div>
            <div className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
              Pipeline Control Panel
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-[10px] font-mono text-blue-700 font-semibold flex items-center gap-2 tracking-widest">
            <Activity className="w-3 h-3 animate-pulse text-blue-600" />
            {jobs.filter(j => j.status === "running").length} RUNNING
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-8 w-full min-w-0">
        <div className="w-full px-4 md:px-8">
          {/* Hero heading */}
          <div className="mb-8 animate-fade-in">
            <h1 className="text-2xl font-bold tracking-tight mb-2 text-zinc-805">
              Medica Pipeline Operator
            </h1>
            <p className="text-[13px] text-zinc-500 leading-relaxed max-w-2xl font-medium">
              Manual scheduler console &mdash; scrape PubMed, ingest raw papers, index embeddings, and run optimization scripts.
            </p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-fade-in">
            {[
              { label: "Total Runs", value: jobs.length, icon: Terminal, color: "text-indigo-600", bg: "bg-indigo-50 border border-indigo-150" },
              { label: "Papers Fetched", value: totalFetched, icon: Database, color: "text-blue-600", bg: "bg-blue-50 border border-blue-150" },
              { label: "Papers Indexed", value: totalIndexed, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50 border border-emerald-150" },
            ].map((c) => {
              const IconComponent = c.icon;
              return (
                <div key={c.label} className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase font-semibold">
                      {c.label}
                    </span>
                    <div className={`p-2 rounded-lg ${c.bg}`}>
                      <IconComponent className={`w-4 h-4 ${c.color}`} />
                    </div>
                  </div>
                  <div className="text-3xl font-bold tracking-tight text-zinc-800">
                    {c.value}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Control cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 animate-fade-in" style={{ animationDelay: "100ms" }}>
            {/* Scraper form */}
            <div className="lg:col-span-2 p-6 rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-zinc-200">
                <Search className="w-4 h-4 text-indigo-600" />
                <span className="text-[11px] font-mono tracking-widest text-zinc-800 uppercase font-semibold">
                  Ingest Research Adapter
                </span>
              </div>

              <form onSubmit={handleTriggerIngestion}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  {/* Query input */}
                  <div className="md:col-span-3">
                    <label className="block mb-2 text-[10px] font-mono tracking-widest text-zinc-400 uppercase font-semibold">
                      Search Terms
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-450" />
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="e.g. osimertinib NSCLC targeted therapy..."
                        disabled={submitting}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-800 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-zinc-400 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Limit */}
                  <div>
                    <label className="block mb-2 text-[10px] font-mono tracking-widest text-zinc-400 uppercase font-semibold">
                      Limit
                    </label>
                    <select
                      value={limit}
                      onChange={(e) => setLimit(Number(e.target.value))}
                      disabled={submitting}
                      className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-800 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/20 appearance-none disabled:opacity-50"
                    >
                      {[5, 10, 25, 50].map((v) => (
                        <option key={v} value={v}>{v} papers</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Status message */}
                {triggerMsg && (
                  <div className={`px-4 py-3 rounded-xl mb-4 text-[12px] font-semibold border flex items-center gap-2 ${
                    triggerMsg.type === "success" 
                      ? "bg-emerald-50 text-emerald-800 border-emerald-250" 
                      : "bg-red-50 text-red-800 border-red-250"
                  }`}>
                    {triggerMsg.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-rose-600" />}
                    {triggerMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !query.trim()}
                  className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    submitting || !query.trim()
                      ? "bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-650/10"
                  }`}
                >
                  <Play className="w-4 h-4" />
                  {submitting ? "Initializing pipeline..." : "Launch Ingestion Run"}
                </button>
              </form>
            </div>

            {/* Optimizer card */}
            <div className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-zinc-200">
                  <Zap className="w-4 h-4 text-indigo-650" />
                  <span className="text-[11px] font-mono tracking-widest text-zinc-800 uppercase font-semibold">
                    Memory Optimizer
                  </span>
                </div>
                <p className="text-[13px] text-zinc-550 leading-relaxed font-medium">
                  Trigger the relinking script to compute semantic controversies, rebuild pgvector index files, and cross-reference citations.
                </p>
              </div>
              <button
                onClick={handleTriggerOptimize}
                disabled={optimizing}
                className={`mt-6 w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all border ${
                  optimizing
                    ? "bg-zinc-50 text-zinc-400 border-zinc-150 cursor-not-allowed"
                    : "bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-250 shadow-sm"
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${optimizing ? "animate-spin" : ""}`} />
                {optimizing ? "Analyzing nodes..." : "Trigger Relinking Run"}
              </button>
            </div>
          </div>

          {/* Job ledger */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden animate-fade-in" style={{ animationDelay: "200ms" }}>
            <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-zinc-500" />
                <span className="text-[11px] font-mono tracking-widest text-zinc-800 uppercase font-semibold">
                  Background Ingestion Runs
                </span>
              </div>
              <button
                onClick={loadJobs}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-white hover:bg-zinc-50 text-zinc-500 hover:text-zinc-850 border border-zinc-200 shadow-sm transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto min-h-[250px]">
              {loading ? (
                <div className="flex items-center justify-center py-20 gap-2 text-[12px] text-zinc-500 font-mono">
                  <RefreshCw className="w-4 h-4 animate-spin text-zinc-400" />
                  Querying operator runs...
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-20 text-[12px] text-zinc-400 italic">
                  No ingestion runs triggered yet.
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/30">
                      {["Job ID", "Query Terms", "Semantic Expansion", "Status", "Indexed Stats", "Initialized", "Diagnostics"].map((h) => (
                        <th key={h} className="px-5 py-4 text-left text-[10px] font-mono tracking-widest text-zinc-450 uppercase font-bold whitespace-nowrap">
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
                          className="border-b border-zinc-150 hover:bg-zinc-50/40 transition-colors"
                        >
                          <td className="px-5 py-4 font-mono text-[11px] text-zinc-500" title={j.id}>
                            {j.id.substring(0, 8)}…
                          </td>
                          <td className="px-5 py-4 text-[13px] font-medium text-zinc-800 max-w-[200px] truncate" title={j.query}>
                            {j.query}
                          </td>
                          <td className="px-5 py-4 max-w-[280px]">
                            {j.status === "running" ? (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-indigo-600">
                                <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
                                expanding…
                              </span>
                            ) : extraTerms.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {extraTerms.map((term, tIdx) => (
                                  <span
                                    key={tIdx}
                                    className="px-2 py-1 rounded-md text-[10px] font-mono bg-zinc-50 text-zinc-700 border border-zinc-200 whitespace-nowrap"
                                    title={term}
                                  >
                                    {term}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] font-mono text-zinc-400 italic font-medium">
                                {j.status === "pending" ? "queued" : "no expansion"}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {statusBadge(j.status)}
                          </td>
                          <td className="px-5 py-4 font-mono text-[11px] text-zinc-500">
                            {j.status === "running" ? (
                              <span className="text-zinc-400 font-medium">processing…</span>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span>Fetched: <span className="text-zinc-800 font-bold">{j.fetched}</span></span>
                                <span>Indexed: <span className="text-indigo-650 font-bold">{j.processed}</span></span>
                                {(j.failed ?? 0) > 0 && <span className="text-rose-600 font-bold">Failed: {j.failed}</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4 text-[11px] font-mono text-zinc-400">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-zinc-400" />
                              {startStr}
                            </div>
                          </td>
                          <td className="px-5 py-4 font-mono text-[10px] max-w-[180px] truncate text-zinc-500" title={j.error_message || ""}>
                            {j.status === "failed" ? (
                              <span className="text-rose-600">{j.error_message}</span>
                            ) : j.status === "done" ? (
                              <span className="text-emerald-700 font-medium">✓ pipeline completed</span>
                            ) : (
                              <span className="text-zinc-400">waiting…</span>
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
