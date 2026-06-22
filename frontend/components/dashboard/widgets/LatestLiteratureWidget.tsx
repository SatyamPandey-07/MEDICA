import React from "react";
import { Newspaper, Search, Filter, Microscope } from "lucide-react";
import { WidgetProps } from "../types";
import { useDashboardContext } from "../DashboardContext";
import { WidgetHeader } from "./WidgetHeader";
import { VerificationPaper } from "@/lib/types";

const scoreColor = (s: number) =>
  s >= 0.8 ? "text-emerald-400" : s >= 0.6 ? "text-blue-400" : s >= 0.4 ? "text-amber-400" : "text-red-400";

export const LatestLiteratureWidget: React.FC<WidgetProps> = ({ instanceId, title, config, lastUpdated }) => {
  const { 
    filteredPapers, topicPapers, activeTab, setActiveTab, 
    searchQuery, setSearchQuery, minConfidence, setMinConfidence,
    selectedPaper, setSelectedPaper
  } = useDashboardContext();

  const limit = config?.limit || 50;
  const slicedPapers = filteredPapers.slice(0, limit);

  const isGuideline = (p: VerificationPaper) => {
    const t = p.title.toLowerCase();
    return t.includes("guideline") || t.includes("recommendation") || t.includes("consensus")
      || p.tags?.evidence?.includes("guideline_backed") === true
      || p.evidence_level === "systematic_review" || p.evidence_level === "meta_analysis";
  };

  return (
    <>
      <WidgetHeader id={instanceId} icon={Newspaper} color="text-rose-400" title={title} lastUpdated={lastUpdated}>
        <div className="flex gap-1">
          {(["all", "guideline", "paper"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-2 py-0.5 rounded text-[8px] font-mono capitalize border transition-all ${
                activeTab === t ? "bg-zinc-700 text-zinc-200 border-white/10" : "text-zinc-500 border-transparent hover:text-zinc-300"
              }`}>
              {t === "all" ? "All" : t === "guideline" ? "Guidelines" : "Papers"}
            </button>
          ))}
        </div>
      </WidgetHeader>

      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex gap-2 mb-3 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
            <input type="text" placeholder="Search title, PMID, journal..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-[11px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-rose-500/40 placeholder:text-zinc-600"
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="w-3 h-3 text-zinc-500" />
            <input type="range" min={0} max={90} step={10} value={minConfidence * 100}
              onChange={e => setMinConfidence(Number(e.target.value) / 100)}
              className="w-20 accent-rose-500 cursor-pointer" />
            <span className="text-[9px] font-mono text-zinc-400 w-7">{(minConfidence * 100).toFixed(0)}%</span>
          </div>
        </div>

        <div className="text-[9px] font-mono text-zinc-600 mb-2 shrink-0">
          Showing <span className="text-zinc-400">{slicedPapers.length}</span> of {topicPapers.length} records
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
          {slicedPapers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Microscope className="w-8 h-8 text-zinc-700 mb-2" />
              <div className="text-[11px] text-zinc-600">No papers match filters</div>
            </div>
          ) : slicedPapers.map(p => {
            const active = selectedPaper?.id === p.id;
            const isG = isGuideline(p);
            const sc = p.confidence_score;
            const isNew = p.created_at && Date.now() - new Date(p.created_at).getTime() < 3 * 24 * 60 * 60 * 1000;

            return (
              <div key={p.id} onClick={() => setSelectedPaper(p)}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  active ? "bg-rose-500/8 border-rose-500/25" : "bg-zinc-950/30 border-white/5 hover:bg-zinc-900/50 hover:border-white/8"
                }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase border ${
                        isG ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      }`}>
                        {isG ? "Guideline" : "Paper"}
                      </span>
                      {isNew && <span className="inline-flex px-1.5 py-0.5 rounded text-[7px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">NEW</span>}
                      {p.published && (
                        <span className="text-[8px] font-mono text-zinc-600">
                          {new Date(p.published).getFullYear()}
                        </span>
                      )}
                    </div>
                    <h4 className="text-[11px] font-medium text-zinc-200 line-clamp-2 leading-snug">{p.title}</h4>
                    <div className="text-[8px] font-mono text-zinc-600 mt-1 truncate">{p.journal}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-[11px] font-mono font-bold ${scoreColor(sc)}`}>{(sc * 100).toFixed(0)}%</div>
                    <div className="w-8 h-1 rounded-full bg-zinc-800 overflow-hidden mt-1">
                      <div className={`h-full ${sc >= 0.8 ? "bg-emerald-500" : sc >= 0.6 ? "bg-blue-500" : "bg-amber-500"}`}
                        style={{ width: `${sc * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
