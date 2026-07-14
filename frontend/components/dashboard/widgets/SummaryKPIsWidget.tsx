import React from "react";
import { BarChart3, FileText, BookOpen, ShieldCheck, TriangleAlert, Activity, GitBranch } from "lucide-react";
import { WidgetProps } from "../types";
import { useDashboardContext } from "../DashboardContext";
import { WidgetHeader } from "./WidgetHeader";

const fmt = (n: number) => n.toLocaleString();

export const SummaryKPIsWidget: React.FC<WidgetProps> = ({ instanceId, title, lastUpdated }) => {
  const { topicPapers, recentNewPapers, totalGuidelines, dynamicAvgConfidence, dynamicStatusDistribution, runningJobs, graphStats } = useDashboardContext();

  const kpis = [
    {
      id: "total_papers", label: "Total Papers", value: fmt(topicPapers.length),
      sub: `${fmt(recentNewPapers.length)} new this week`,
      icon: FileText, color: "text-rose-600", bg: "bg-rose-50 border-rose-100",
      badge: recentNewPapers.length > 0 ? `+${recentNewPapers.length} NEW` : null
    },
    {
      id: "guidelines", label: "Clinical Guidelines", value: fmt(totalGuidelines),
      sub: "ASCO · NCCN · ESMO",
      icon: BookOpen, color: "text-violet-600", bg: "bg-violet-50 border-violet-100",
      badge: null
    },
    {
      id: "avg_conf", label: "Avg. Confidence", value: `${(dynamicAvgConfidence * 100).toFixed(1)}%`,
      sub: `${fmt(dynamicStatusDistribution.verified)} verified`,
      icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100",
      badge: null
    },
    {
      id: "conflicts", label: "Conflicts Detected", value: fmt(dynamicStatusDistribution.disputed),
      sub: `${fmt(dynamicStatusDistribution.pending)} pending audit`,
      icon: TriangleAlert, color: "text-amber-600", bg: "bg-amber-50 border-amber-100",
      badge: dynamicStatusDistribution.disputed > 0 ? "REVIEW" : null
    },
    {
      id: "active_jobs", label: "Active Pipelines", value: fmt(runningJobs.length),
      sub: runningJobs.length > 0 ? "Scraping in progress" : "Scheduler idle",
      icon: Activity, color: runningJobs.length > 0 ? "text-indigo-600" : "text-zinc-400",
      bg: runningJobs.length > 0 ? "bg-indigo-50 border-indigo-100" : "bg-zinc-50 border-zinc-200",
      badge: runningJobs.length > 0 ? "LIVE" : null
    },
    {
      id: "graph_nodes", label: "Knowledge Nodes", value: fmt(graphStats?.total_nodes ?? 0),
      sub: `${fmt(graphStats?.total_edges ?? 0)} connections`,
      icon: GitBranch, color: "text-cyan-600", bg: "bg-cyan-50 border-cyan-100",
      badge: null
    },
  ];

  return (
    <>
      <WidgetHeader id={instanceId} icon={BarChart3} color="text-rose-600" title={title} lastUpdated={lastUpdated} />
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 flex-1 overflow-y-auto min-h-0">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.id} className={`relative p-4 rounded-2xl border ${k.bg} flex flex-col gap-2`}>
              {k.badge && (
                <span className={`absolute top-2 right-2 text-[7px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded-full ${
                  k.badge === "LIVE" ? "bg-indigo-100 text-indigo-800" :
                  k.badge === "REVIEW" ? "bg-amber-100 text-amber-800" :
                  "bg-rose-100 text-rose-800"
                }`}>{k.badge}</span>
              )}
              <div className={`p-2 rounded-xl self-start ${k.bg}`}>
                <Icon className={`w-4 h-4 ${k.color} ${k.id === "active_jobs" && runningJobs.length > 0 ? "animate-pulse" : ""}`} />
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-zinc-800 leading-none">{k.value}</div>
                <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 mt-1">{k.label}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">{k.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
