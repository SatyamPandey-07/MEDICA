import React from "react";
import { Sliders, X, Plus, Eye, EyeOff, RotateCcw } from "lucide-react";
import { WidgetConfig } from "./types";
import { WIDGET_REGISTRY } from "./WidgetRegistry";

interface DashboardSettingsPanelProps {
  onClose: () => void;
  widgets: WidgetConfig[];
  onToggleVisibility: (id: string) => void;
  onAddWidget: (type: string) => void;
  onResetLayout: () => void;
  topicName: string;
}

export const DashboardSettingsPanel: React.FC<DashboardSettingsPanelProps> = ({
  onClose, widgets, onToggleVisibility, onAddWidget, onResetLayout, topicName
}) => {
  return (
    <div className="rounded-2xl border border-rose-500/20 bg-zinc-900/80 backdrop-blur-xl p-5 space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div>
          <h3 className="text-xs font-bold text-rose-400 flex items-center gap-2">
            <Sliders className="w-4 h-4" /> Oncology Widget Studio
          </h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">Configure, resize, rename, and publish dashboard widgets for the {topicName} community.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onResetLayout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-[10px] font-mono transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Reset Layout
          </button>
          <button onClick={onClose} className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Manage Current Widgets */}
        <div>
          <h4 className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 mb-3 border-b border-white/5 pb-2">Active Widgets</h4>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {widgets.map((w) => {
              const def = WIDGET_REGISTRY[w.type];
              const Icon = def ? def.icon : Sliders;
              
              return (
                <div key={w.id} className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${w.visible ? "bg-zinc-950/60 border-white/10" : "bg-zinc-950/20 border-white/5 opacity-60"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${w.visible ? "bg-zinc-800 text-zinc-300" : "bg-zinc-900 text-zinc-600"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-200">{w.title}</div>
                      <div className="text-[9px] font-mono text-zinc-500">{def?.name || w.type}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => onToggleVisibility(w.id)}
                    className={`p-1.5 rounded-lg border transition-colors ${w.visible ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-400"}`}
                  >
                    {w.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add New Widgets */}
        <div>
          <h4 className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 mb-3 border-b border-white/5 pb-2">Widget Library</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
            {Object.values(WIDGET_REGISTRY).map((def) => {
              const Icon = def.icon;
              return (
                <div key={def.type} className="p-3 rounded-xl bg-zinc-900 border border-white/5 hover:border-white/10 transition-colors flex flex-col gap-3 group">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 group-hover:text-rose-400 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-[11px] font-semibold text-zinc-300">{def.name}</div>
                  </div>
                  <button 
                    onClick={() => onAddWidget(def.type)}
                    className="w-full py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 text-[10px] font-mono font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add to Dashboard
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        
      </div>
    </div>
  );
};
