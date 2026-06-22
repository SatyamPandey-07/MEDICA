import React, { useState } from "react";
import Link from "next/link";
import { Zap, ChevronRight, Play } from "lucide-react";
import { WidgetProps } from "../types";
import { useDashboardContext } from "../DashboardContext";
import { WidgetHeader } from "./WidgetHeader";
import { triggerIngestionJob } from "@/lib/api";

const timeSince = (iso?: string) => {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export const IngestionConsoleWidget: React.FC<WidgetProps> = ({ instanceId, title, config, lastUpdated }) => {
  const { jobs, addToast, fetchData } = useDashboardContext();
  const [scrapeQuery, setScrapeQuery] = useState("");
  const [scrapeLimit, setScrapeLimit] = useState(10);
  const [scraping, setScraping] = useState(false);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrapeQuery.trim() || scraping) return;
    setScraping(true);
    try {
      const res = await triggerIngestionJob(scrapeQuery, scrapeLimit);
      addToast({ type: "info", title: "Ingestion Queued", message: res.message });
      setScrapeQuery("");
      fetchData(true);
    } catch (err: unknown) {
      addToast({ type: "warning", title: "Ingestion Failed", message: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setScraping(false);
    }
  };

  const limit = config?.limit || 6;

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0">
        <WidgetHeader id={instanceId} icon={Zap} color="text-indigo-400" title={title} lastUpdated={lastUpdated}>
          <Link href="/admin" className="text-[8px] font-mono text-zinc-500 hover:text-indigo-400 flex items-center gap-0.5 transition-colors">
            Control Panel <ChevronRight className="w-3 h-3" />
          </Link>
        </WidgetHeader>

        <form onSubmit={handleScrape} className="mb-4 shrink-0">
          <div className="text-[8px] font-mono uppercase tracking-wider text-zinc-600 mb-2">PubMed Quick Ingest</div>
          <div className="flex gap-1.5">
            <input type="text" placeholder="e.g. BRCA1 breast cancer..."
              value={scrapeQuery} onChange={e => setScrapeQuery(e.target.value)}
              disabled={scraping}
              className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-[10px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 disabled:opacity-50"
            />
            <select value={scrapeLimit} onChange={e => setScrapeLimit(Number(e.target.value))}
              className="px-2 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-[10px] font-mono text-zinc-300">
              {[5, 10, 25, 50].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <button type="submit" disabled={scraping || !scrapeQuery.trim()}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Play className="w-3 h-3" />{scraping ? "…" : "Run"}
            </button>
          </div>
        </form>

        <div className="text-[8px] font-mono uppercase tracking-wider text-zinc-600 mb-2 shrink-0">Recent Jobs</div>
        <div className="space-y-1.5 overflow-y-auto pr-1 flex-1 min-h-0">
          {jobs.slice(0, limit).map(j => (
            <div key={j.id} className="p-2 rounded-lg bg-zinc-950/40 border border-white/5 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-medium text-zinc-300 truncate" title={j.query}>{j.query}</div>
                <div className="text-[8px] font-mono text-zinc-600">{timeSince(j.started_at ?? undefined)} · {j.fetched} fetched · {j.processed} indexed</div>
              </div>
              <span className={`shrink-0 text-[7px] font-mono px-1.5 py-0.5 rounded font-bold uppercase border ${
                j.status === "done" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : j.status === "running" ? "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse"
                : j.status === "failed" ? "bg-red-500/10 text-red-400 border-red-500/20"
                : "bg-zinc-800 text-zinc-500 border-zinc-700"
              }`}>{j.status}</span>
            </div>
          ))}
          {jobs.length === 0 && (
            <div className="text-center py-6 text-[10px] text-zinc-700">No ingestion runs yet</div>
          )}
        </div>
      </div>
    </>
  );
};
