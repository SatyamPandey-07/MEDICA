import React from "react";
import Link from "next/link";
import { HeartPulse, ChevronRight, FlaskConical } from "lucide-react";
import { WidgetProps } from "../types";
import { useDashboardContext } from "../DashboardContext";
import { WidgetHeader } from "./WidgetHeader";
import { VerificationPaper } from "@/lib/types";

const CANCER_TYPES = [
  "colorectal_cancer","breast_cancer","lung_cancer","non_small_cell_lung_cancer",
  "pancreatic_cancer","small_cell_lung_cancer","melanoma","glioblastoma",
  "leukemia","lymphoma","ovarian_cancer","prostate_cancer"
];

const formatCancerName = (name: string) => {
  return name
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const scoreColor = (s: number) =>
  s >= 0.8 ? "text-emerald-400" : s >= 0.6 ? "text-blue-400" : s >= 0.4 ? "text-amber-400" : "text-red-400";

export const TopicNewsWidget: React.FC<WidgetProps> = ({ instanceId, title, lastUpdated }) => {
  const { topicPapers, selectedTopic, setSelectedTopic, setSelectedPaper } = useDashboardContext();

  const isGuideline = (p: VerificationPaper) => {
    const t = p.title.toLowerCase();
    return t.includes("guideline") || t.includes("recommendation") || t.includes("consensus")
      || p.tags?.evidence?.includes("guideline_backed") === true
      || p.evidence_level === "systematic_review" || p.evidence_level === "meta_analysis";
  };

  return (
    <>
      <WidgetHeader id={instanceId} icon={HeartPulse} color="text-pink-400" title={title} lastUpdated={lastUpdated}>
        <div className="flex items-center gap-2">
          <select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)}
            className="px-2 py-1 rounded-lg border border-zinc-800 bg-zinc-950 text-[9px] font-mono text-zinc-300 focus:outline-none">
            {CANCER_TYPES.map(c => (
              <option key={c} value={c}>{formatCancerName(c)}</option>
            ))}
          </select>
          <Link href="/news" className="text-[8px] font-mono text-zinc-500 hover:text-pink-400 flex items-center gap-0.5 transition-colors">
            Page <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </WidgetHeader>

      <div className="text-[9px] font-mono text-zinc-600 mb-2 shrink-0">
        {topicPapers.length} record{topicPapers.length !== 1 ? "s" : ""} for <span className="text-zinc-400 capitalize">{selectedTopic.replace(/_/g, " ")}</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
        {topicPapers.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FlaskConical className="w-7 h-7 text-zinc-700 mb-2" />
            <div className="text-[11px] text-zinc-600">No data for this topic yet.</div>
            <div className="text-[10px] text-zinc-700 mt-1">Trigger an ingestion run below.</div>
          </div>
        )}
        {topicPapers.map(p => {
          const isG = isGuideline(p);
          return (
            <div key={p.id} onClick={() => setSelectedPaper(p)}
              className="p-2.5 rounded-xl border border-white/5 bg-zinc-950/20 hover:bg-zinc-900/40 cursor-pointer transition-colors">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded text-[7px] font-mono font-bold border ${
                  isG ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                }`}>{isG ? "Guideline" : "Paper"}</span>
                {p.published && <span className="text-[8px] font-mono text-zinc-600">{new Date(p.published).toLocaleDateString()}</span>}
                <span className={`text-[8px] font-mono font-bold ${scoreColor(p.confidence_score)}`}>{(p.confidence_score * 100).toFixed(0)}%</span>
              </div>
              <h4 className="text-[11px] font-medium text-zinc-200 line-clamp-2 leading-snug">{p.title}</h4>
            </div>
          );
        })}
      </div>
    </>
  );
};
