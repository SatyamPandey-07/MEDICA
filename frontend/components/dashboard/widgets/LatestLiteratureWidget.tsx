import React from "react";
import { Newspaper, Search, Filter, Microscope } from "lucide-react";
import { WidgetProps } from "../types";
import { useDashboardContext } from "../DashboardContext";
import { WidgetHeader } from "./WidgetHeader";
import { VerificationPaper } from "@/lib/types";

const scoreColor = (s: number) =>
  s >= 0.8 ? "text-emerald-600 font-semibold" : s >= 0.6 ? "text-indigo-600 font-semibold" : s >= 0.4 ? "text-amber-600 font-semibold" : "text-red-600 font-semibold";

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
      <WidgetHeader id={instanceId} icon={Newspaper} color="text-rose-600" title={title} lastUpdated={lastUpdated}>
        <div className="flex gap-1">
          {(["all", "guideline", "paper"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-2 py-0.5 rounded text-[8px] font-mono capitalize border transition-all ${
                activeTab === t ? "bg-zinc-100 text-zinc-800 border-zinc-200" : "text-zinc-500 border-transparent hover:text-zinc-700 hover:bg-zinc-50"
              }`}>
              {t === "all" ? "All" : t === "guideline" ? "Guidelines" : "Papers"}
            </button>
          ))}
        </div>
      </WidgetHeader>

      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex gap-2 mb-3 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400" />
            <input type="text" placeholder="Search title, PMID, journal..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-[11px] text-zinc-700 focus:outline-none focus:ring-1 focus:ring-rose-500/20 placeholder:text-zinc-400"
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="w-3 h-3 text-zinc-400" />
            <input type="range" min={0} max={90} step={10} value={minConfidence * 100}
              onChange={e => setMinConfidence(Number(e.target.value) / 100)}
              className="w-20 accent-rose-500 cursor-pointer" />
            <span className="text-[9px] font-mono text-zinc-500 w-7">{(minConfidence * 100).toFixed(0)}%</span>
          </div>
        </div>

        <div className="text-[9px] font-mono text-zinc-500 mb-2 shrink-0">
          Showing <span className="text-zinc-700 font-semibold">{slicedPapers.length}</span> of {topicPapers.length} records
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
          {slicedPapers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Microscope className="w-8 h-8 text-zinc-300 mb-2" />
              <div className="text-[11px] text-zinc-400 font-medium">No papers match filters</div>
            </div>
          ) : slicedPapers.map(p => {
            const active = selectedPaper?.id === p.id;
            const isG = isGuideline(p);
            const sc = p.confidence_score;
            const isNew = p.created_at && Date.now() - new Date(p.created_at).getTime() < 3 * 24 * 60 * 60 * 1000;

            return (
              <div key={p.id} onClick={() => setSelectedPaper(p)}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  active ? "bg-rose-50 border-rose-200 shadow-sm" : "bg-zinc-50/50 border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300"
                }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase border ${
                        isG ? "bg-violet-50 text-violet-700 border-violet-100" : "bg-blue-50 text-blue-700 border-blue-100"
                      }`}>
                        {isG ? "Guideline" : "Paper"}
                      </span>
                      {isNew && <span className="inline-flex px-1.5 py-0.5 rounded text-[7px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">NEW</span>}
                      {p.published && (
                        <span className="text-[8px] font-mono text-zinc-500">
                          {new Date(p.published).getFullYear()}
                        </span>
                      )}
                    </div>
                    <h4 className="text-[11px] font-medium text-zinc-800 line-clamp-2 leading-snug">{p.title}</h4>
                    <div className="text-[8px] font-mono text-zinc-500 mt-1 truncate">{p.journal}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-[11px] font-mono font-bold ${scoreColor(sc)}`}>{(sc * 100).toFixed(0)}%</div>
                    <div className="w-8 h-1 rounded-full bg-zinc-100 overflow-hidden mt-1">
                      <div className={`h-full ${sc >= 0.8 ? "bg-emerald-600" : sc >= 0.6 ? "bg-indigo-600" : "bg-amber-600"}`}
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
