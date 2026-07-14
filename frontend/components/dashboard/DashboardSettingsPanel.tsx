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
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-xl p-5 space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
        <div>
          <h3 className="text-xs font-bold text-indigo-600 flex items-center gap-2">
            <Sliders className="w-4 h-4" /> Oncology Widget Studio
          </h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">Configure, resize, rename, and publish dashboard widgets for the {topicName} community.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onResetLayout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-[10px] font-mono transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Reset Layout
          </button>
          <button onClick={onClose} className="p-1 rounded bg-zinc-100 border border-zinc-200 text-zinc-500 hover:text-zinc-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Manage Current Widgets */}
        <div>
          <h4 className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 mb-3 border-b border-zinc-200 pb-2">Active Widgets</h4>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {widgets.map((w) => {
               const def = WIDGET_REGISTRY[w.type];
               const Icon = def ? def.icon : Sliders;
               
               return (
                 <div key={w.id} className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${w.visible ? "bg-zinc-50 border-zinc-200" : "bg-zinc-50/50 border-zinc-100 opacity-60"}`}>
                   <div className="flex items-center gap-3">
                     <div className={`p-1.5 rounded-lg ${w.visible ? "bg-white border border-zinc-200 text-zinc-700" : "bg-zinc-100 text-zinc-400"}`}>
                       <Icon className="w-4 h-4" />
                     </div>
                     <div>
                       <div className="text-[11px] font-semibold text-zinc-800">{w.title}</div>
                       <div className="text-[9px] font-mono text-zinc-500">{def?.name || w.type}</div>
                     </div>
                   </div>
                   <button 
                     onClick={() => onToggleVisibility(w.id)}
                     className={`p-1.5 rounded-lg border transition-colors ${w.visible ? "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50" : "bg-zinc-100 border-zinc-200 text-zinc-400 hover:bg-zinc-50"}`}
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
          <h4 className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 mb-3 border-b border-zinc-200 pb-2">Widget Library</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
            {Object.values(WIDGET_REGISTRY).map((def) => {
              const Icon = def.icon;
              return (
                <div key={def.type} className="p-3 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-colors flex flex-col gap-3 group">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-zinc-50 text-zinc-500 group-hover:text-indigo-600 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-[11px] font-semibold text-zinc-800">{def.name}</div>
                  </div>
                  <button 
                    onClick={() => onAddWidget(def.type)}
                    className="w-full py-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 text-[10px] font-mono font-semibold flex items-center justify-center gap-1.5 transition-colors"
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
