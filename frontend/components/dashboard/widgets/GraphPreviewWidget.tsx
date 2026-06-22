import React from "react";
import Link from "next/link";
import { Database, ChevronRight, GitBranch, Compass } from "lucide-react";
import { WidgetProps } from "../types";
import { useDashboardContext } from "../DashboardContext";
import { WidgetHeader } from "./WidgetHeader";

const fmt = (n: number) => n.toLocaleString();

export const GraphPreviewWidget: React.FC<WidgetProps> = ({ instanceId, title, lastUpdated }) => {
  const { graphStats, topicPapers } = useDashboardContext();

  const items = [
    { l: "Cancer Types",  v: graphStats?.cancer_nodes ?? 0,   c: "from-rose-500 to-pink-500" },
    { l: "Drugs",         v: graphStats?.drug_nodes ?? 0,     c: "from-blue-500 to-cyan-500" },
    { l: "Biomarkers",    v: graphStats?.biomarker_nodes ?? 0,c: "from-teal-500 to-emerald-500" },
    { l: "Total Nodes",   v: graphStats?.total_nodes ?? 0,    c: "from-violet-500 to-purple-500" },
    { l: "Connections",   v: graphStats?.total_edges ?? 0,    c: "from-amber-500 to-orange-500" },
  ];
  const max = Math.max(...items.map(i => i.v), 1);

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0">
        <WidgetHeader id={instanceId} icon={Database} color="text-cyan-400" title={title} lastUpdated={lastUpdated}>
          <Link href="/explorer" className="text-[8px] font-mono text-zinc-500 hover:text-cyan-400 flex items-center gap-0.5 transition-colors">
            Explorer <ChevronRight className="w-3 h-3" />
          </Link>
        </WidgetHeader>
        <p className="text-[10px] text-zinc-500 mb-4 leading-relaxed shrink-0">
          Canonical entity graph built from {topicPapers.length} indexed oncology papers across {graphStats?.cancer_nodes ?? 0} cancer types.
        </p>
        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
          {items.map(item => (
            <div key={item.l}>
              <div className="flex justify-between text-[10px] font-mono mb-1">
                <span className="text-zinc-500">{item.l}</span>
                <span className="text-zinc-200 font-semibold">{fmt(item.v)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${item.c} transition-all duration-700`}
                  style={{ width: `${(item.v / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 mt-4 shrink-0">
        <Link href="/graph" className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-semibold transition-colors flex items-center justify-center gap-1.5 border border-white/5">
          <GitBranch className="w-3.5 h-3.5" /> Citation Graph
        </Link>
        <Link href="/explorer" className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-semibold transition-colors flex items-center justify-center gap-1.5 border border-white/5">
          <Compass className="w-3.5 h-3.5" /> Explorer
        </Link>
      </div>
    </>
  );
};
