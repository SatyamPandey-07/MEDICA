import React from "react";
import Link from "next/link";
import { BarChart3, ChevronRight } from "lucide-react";
import { WidgetProps } from "../types";
import { useDashboardContext } from "../DashboardContext";
import { WidgetHeader } from "./WidgetHeader";

export const EvidenceDistWidget: React.FC<WidgetProps> = ({ instanceId, title, lastUpdated }) => {
  const { evidenceDist, isExpertMode, dynamicStatusDistribution } = useDashboardContext();

  const evidenceEntries = Object.entries(evidenceDist).sort((a, b) => b[1] - a[1]);
  const maxEvCount = Math.max(...Object.values(evidenceDist), 1);

  return (
    <>
      <WidgetHeader id={instanceId} icon={BarChart3} color="text-violet-400" title={title} lastUpdated={lastUpdated}>
        <Link href="/verification" className="text-[9px] font-mono text-zinc-500 hover:text-violet-400 transition-colors flex items-center gap-1">
          Full Audit <ChevronRight className="w-3 h-3" />
        </Link>
      </WidgetHeader>
      
      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        {evidenceEntries.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center py-6 text-[11px] text-zinc-600 italic">No evidence data yet.</div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {evidenceEntries.map(([level, count]) => (
              <div key={level} className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-zinc-400 capitalize">{level.replace(/_/g, " ")}</span>
                  <span className="text-zinc-200 font-semibold">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-rose-500 transition-all duration-700"
                    style={{ width: `${(count / maxEvCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            
            {isExpertMode && (
              <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-2">
                {[
                  { l: "Verified", v: dynamicStatusDistribution.verified, c: "text-emerald-400" },
                  { l: "Disputed", v: dynamicStatusDistribution.disputed, c: "text-red-400" },
                  { l: "Pending",  v: dynamicStatusDistribution.pending,  c: "text-amber-400" },
                ].map(x => (
                  <div key={x.l} className="text-center">
                    <div className={`text-lg font-bold ${x.c}`}>{x.v}</div>
                    <div className="text-[9px] font-mono text-zinc-600 uppercase">{x.l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
