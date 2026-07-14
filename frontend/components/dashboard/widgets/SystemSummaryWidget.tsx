import React from "react";
import { Star, Database, CheckCircle, FlaskConical, Search } from "lucide-react";
import { WidgetProps } from "../types";
import { useDashboardContext } from "../DashboardContext";
import { WidgetHeader } from "./WidgetHeader";

const fmt = (n: number) => n.toLocaleString();

export const SystemSummaryWidget: React.FC<WidgetProps> = ({ instanceId, title, lastUpdated }) => {
  const { topicPapers, dynamicStatusDistribution, jobs, isExpertMode } = useDashboardContext();

  const verifiedPct = topicPapers.length > 0
    ? ((dynamicStatusDistribution.verified / topicPapers.length) * 100).toFixed(0) : "0";
  const completedJobs = jobs.filter(j => j.status === "done");
  const totalIndexed = completedJobs.reduce((a, j) => a + (j.processed || 0), 0);

  return (
    <>
      <WidgetHeader id={instanceId} icon={Star} color="text-amber-600" title={title} lastUpdated={lastUpdated} />
      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { l: "Total Indexed",    v: fmt(totalIndexed),     icon: Database,     c: "text-cyan-600" },
            { l: "Verified %",       v: `${verifiedPct}%`,     icon: CheckCircle,  c: "text-emerald-600" },
            { l: "Ingestion Runs",   v: fmt(completedJobs.length), icon: FlaskConical, c: "text-indigo-600" },
            { l: "Data Sources",     v: "PubMed",              icon: Search,       c: "text-zinc-500" },
          ].map(x => {
            const Icon = x.icon;
            return (
              <div key={x.l} className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex flex-col gap-2">
                <Icon className={`w-4 h-4 ${x.c}`} />
                <div>
                  <div className="text-lg font-bold text-zinc-800 leading-none">{x.v}</div>
                  <div className="text-[9px] font-mono text-zinc-500 uppercase mt-0.5">{x.l}</div>
                </div>
              </div>
            );
          })}
        </div>
        {isExpertMode && (
          <div className="mt-4 pt-4 border-t border-zinc-200 text-[9px] font-mono text-zinc-500 space-y-1">
            <div>LLM Provider: <span className="text-zinc-700">Groq / llama-3.3-70b-versatile</span></div>
            <div>Embedding: <span className="text-zinc-700">all-MiniLM-L6-v2 (local)</span></div>
            <div>Vector Dims: <span className="text-zinc-700">384</span></div>
            <div>Database: <span className="text-zinc-700">PostgreSQL + pgvector 0.8.2</span></div>
          </div>
        )}
      </div>
    </>
  );
};
