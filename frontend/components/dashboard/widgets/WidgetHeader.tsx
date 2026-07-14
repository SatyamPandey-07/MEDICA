import React from "react";

export const WidgetHeader = ({ id, icon: Icon, color, title, lastUpdated, children }: {
  id: string; 
  icon: React.ElementType; 
  color: string; 
  title: string; 
  lastUpdated?: string;
  children?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between pb-3 border-b border-zinc-200 mb-4 shrink-0 dashboard-widget-header">
    <div className="flex items-center gap-2">
      <Icon className={`w-4 h-4 ${color}`} />
      <h3 className="text-[11px] font-mono tracking-widest uppercase text-zinc-700 font-semibold">{title}</h3>
    </div>
    <div className="flex items-center gap-2">
      {lastUpdated && (
        <span className="text-[8px] font-mono text-zinc-400 hidden sm:block">
          Updated {lastUpdated}
        </span>
      )}
      {children}
    </div>
  </div>
);
