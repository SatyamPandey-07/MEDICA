"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  Eye,
  RefreshCw,
  FileBarChart,
} from "lucide-react";

import { getVerificationStats, listVerificationPapers } from "@/lib/api";
import { VerificationPaper, VerificationStats } from "@/lib/types";

export default function VerificationDashboardPage() {
  const [stats, setStats] = useState<VerificationStats | null>(null);
  const [papers, setPapers] = useState<VerificationPaper[]>([]);
  const [activeStatus, setActiveStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);

  const fetchStats = async () => {
    try { setStats(await getVerificationStats()); } catch (e) { console.error(e); }
  };

  const fetchPapers = async (status: string) => {
    setLoadingTable(true);
    try { setPapers(await listVerificationPapers(status)); } catch (e) { console.error(e); }
    finally { setLoadingTable(false); }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchStats();
      await fetchPapers("all");
      setLoading(false);
    };
    init();
  }, []);

  const handleStatusChange = (status: string) => {
    setActiveStatus(status);
    fetchPapers(status);
  };

  const statusTabs = ["all", "verified", "unverified", "disputed", "pending"];

  const statCards = [
    {
      label: "Papers Audited",
      value: stats?.total_papers ?? 0,
      icon: FileBarChart,
      iconColor: "text-zinc-500",
      bg: "bg-zinc-100 border border-zinc-200",
    },
    {
      label: "Avg Confidence",
      value: stats ? `${(stats.average_confidence_score * 100).toFixed(1)}%` : "—",
      icon: TrendingUp,
      iconColor: "text-indigo-600",
      bg: "bg-indigo-50 border border-indigo-150",
    },
    {
      label: "Verified",
      value: stats?.status_distribution.verified ?? 0,
      icon: CheckCircle,
      iconColor: "text-emerald-600",
      bg: "bg-emerald-50 border border-emerald-150",
    },
    {
      label: "Conflicts",
      value: stats?.status_distribution.disputed ?? 0,
      icon: AlertTriangle,
      iconColor: "text-amber-600",
      bg: "bg-amber-50 border border-amber-150",
    },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-50">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-zinc-800 tracking-wide">
              Evidence Auditor
            </div>
            <div className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
              Adversarial Audit Ledger
            </div>
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-mono text-emerald-750 font-semibold flex items-center gap-2 tracking-widest">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          GUARDED MODE
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-8 w-full min-w-0">
        <div className="w-full px-4 md:px-8">
          {/* Hero heading */}
          <div className="mb-8 animate-fade-in">
            <h1 className="text-2xl font-bold tracking-tight mb-2 text-zinc-805">
              Clinical Trial Verification
            </h1>
            <p className="text-[13px] text-zinc-500 leading-relaxed max-w-2xl font-medium">
              Adversarial auditing ledger &mdash; evaluates study sizes, guideline alignment, and conflicts of interest.
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col gap-6 animate-pulse">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-28 rounded-2xl bg-white border border-zinc-200 shadow-sm" />
                ))}
              </div>
              <div className="h-[400px] rounded-2xl bg-white border border-zinc-200 shadow-sm" />
            </div>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 animate-fade-in">
                {statCards.map((c) => {
                  const IconComponent = c.icon;
                  return (
                    <div key={c.label} className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase font-semibold">
                          {c.label}
                        </span>
                        <div className={`p-2 rounded-lg ${c.bg}`}>
                          <IconComponent className={`w-4 h-4 ${c.iconColor}`} />
                        </div>
                      </div>
                      <div className="text-3xl font-bold tracking-tight text-zinc-800">
                        {c.value}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Audit Ledger */}
              <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden animate-fade-in" style={{ animationDelay: "100ms" }}>
                {/* Toolbar */}
                <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-emerald-600" />
                    <span className="text-[11px] font-mono tracking-widest text-zinc-800 uppercase font-semibold">
                      Audit Data Ledger
                    </span>
                  </div>

                  {/* Status tabs */}
                  <div className="flex gap-2 flex-wrap">
                    {statusTabs.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-mono capitalize transition-all border ${
                          activeStatus === s
                            ? "bg-zinc-100 text-zinc-800 border-zinc-250 font-semibold shadow-sm"
                            : "bg-transparent text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 border-transparent"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto min-h-[300px]">
                  {loadingTable ? (
                    <div className="flex items-center justify-center py-20 gap-2 text-[12px] text-zinc-555 font-medium font-mono">
                      <RefreshCw className="w-4 h-4 animate-spin text-zinc-400" />
                      Fetching audits...
                    </div>
                  ) : papers.length === 0 ? (
                    <div className="text-center py-16 text-[12px] text-zinc-400 italic">
                      No clinical studies match this filter.
                    </div>
                  ) : (
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50/30">
                          {["Trial ID / PMID", "Clinical Study", "Evidence Level", "Confidence", "Quality Flags", ""].map((h) => (
                            <th key={h} className="px-5 py-4 text-left text-[10px] font-mono tracking-widest text-zinc-450 uppercase font-bold whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {papers.map((p) => {
                          const scorePct = (p.confidence_score * 100).toFixed(0);
                          const flags = p.flags || [];
                          return (
                            <tr
                              key={p.id}
                              className="border-b border-zinc-150 hover:bg-zinc-50/40 transition-colors"
                            >
                              {/* PMID */}
                              <td className="px-5 py-4">
                                {p.pmid ? (
                                  <a
                                    href={`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="font-mono text-[11px] font-semibold text-indigo-600 hover:text-indigo-850 border-b border-indigo-200 hover:border-indigo-650 transition-all"
                                  >
                                    pmid:{p.pmid}
                                  </a>
                                ) : (
                                  <span className="font-mono text-[11px] text-zinc-400 font-medium">
                                    {`doi:${(p.doi || "").substring(0, 10)}…`}
                                  </span>
                                )}
                              </td>

                              {/* Title */}
                              <td className="px-5 py-4 max-w-[280px]">
                                <div className="text-[13px] font-medium text-zinc-800 truncate" title={p.title}>
                                  {p.title}
                                </div>
                              </td>

                              {/* Level */}
                              <td className="px-5 py-4 whitespace-nowrap">
                                <span className="inline-flex px-2 py-1 rounded-md font-mono text-[10px] font-medium tracking-widest uppercase bg-indigo-50 text-indigo-700 border border-indigo-250">
                                  {(p.evidence_level || "").replace(/_/g, " ").toUpperCase()}
                                </span>
                              </td>

                              {/* Confidence */}
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-[11px] font-semibold text-zinc-700">
                                    {scorePct}%
                                  </span>
                                  <div className="w-16 h-1.5 rounded-full bg-zinc-100 overflow-hidden shrink-0">
                                    <div 
                                      className={`h-full ${
                                        p.confidence_score >= 0.75 ? "bg-emerald-500" : p.confidence_score >= 0.40 ? "bg-indigo-550" : "bg-rose-500"
                                      }`}
                                      style={{ width: `${scorePct}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* Flags */}
                              <td className="px-5 py-4">
                                {flags.length === 0 ? (
                                  <span className="inline-flex px-2 py-1 rounded-md font-mono text-[10px] font-medium tracking-widest uppercase bg-emerald-50 text-emerald-700 border border-emerald-250">
                                    ✓ CLEAR
                                  </span>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {flags.map((f: string) => (
                                      <span key={f} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[10px] font-medium tracking-widest uppercase bg-rose-50 text-rose-700 border border-rose-250">
                                        ⚠️ {f.replace(/_/g, " ")}
                                      </span>
                                    ))}
                                    {p.tags?.evidence?.map((e: string) => (
                                      <span key={e} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[10px] font-medium tracking-widest uppercase bg-amber-50 text-amber-700 border border-amber-250">
                                        🛡️ {e.replace(/_/g, " ")}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>

                              {/* Action */}
                              <td className="px-5 py-4 text-right">
                                <Link
                                  href={`/papers/${p.id}`}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-[11px] font-medium border border-zinc-200 shadow-sm transition-all"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Inspect
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
