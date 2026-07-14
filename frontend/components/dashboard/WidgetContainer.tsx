import React, { forwardRef, useState } from "react";
import { MoreVertical, Settings, Copy, EyeOff, Trash2, Maximize, RotateCcw } from "lucide-react";
import { WidgetConfig } from "./types";

interface WidgetContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  id: string;
  config: WidgetConfig;
  isEditing: boolean;
  onRemove: (id: string) => void;
  onHide: (id: string) => void;
  onDuplicate: (id: string) => void;
  children: React.ReactNode;
}

export const WidgetContainer = forwardRef<HTMLDivElement, WidgetContainerProps>(
  ({ id, config, isEditing, onRemove, onHide, onDuplicate, children, className, style, ...props }, ref) => {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
      <div
        ref={ref}
        className={`rounded-2xl border border-zinc-200 bg-white shadow-sm flex flex-col relative group h-full ${className || ""} ${isEditing ? "ring-1 ring-rose-500/30 ring-inset" : ""}`}
        style={{ ...style, overflow: "hidden" }}
        {...props}
      >
        {isEditing && (
          <div className="absolute top-2 right-2 z-50 flex items-center gap-1">
            <div className="react-grid-dragHandle cursor-move p-1.5 rounded-lg bg-rose-50/50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition-colors">
              <Maximize className="w-3.5 h-3.5" />
            </div>
            
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                className="p-1.5 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-500 hover:text-zinc-800 transition-colors"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 w-48 rounded-xl bg-white border border-zinc-200 shadow-xl z-50 overflow-hidden py-1">
                    <button onClick={() => { onDuplicate(id); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-[11px] text-zinc-700 hover:bg-zinc-50 flex items-center gap-2">
                      <Copy className="w-3.5 h-3.5" /> Duplicate Widget
                    </button>
                    <button onClick={() => { onHide(id); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-[11px] text-zinc-700 hover:bg-zinc-50 flex items-center gap-2">
                      <EyeOff className="w-3.5 h-3.5" /> Hide Widget
                    </button>
                    <div className="h-px bg-zinc-100 my-1" />
                    <button onClick={() => { onRemove(id); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-[11px] text-red-600 hover:bg-red-50 flex items-center gap-2">
                      <Trash2 className="w-3.5 h-3.5" /> Remove from Dashboard
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* We add a padding overlay for editing mode so it's clear what's happening and children don't block drag */}
        {isEditing && (
          <div className="absolute inset-0 z-30 pointer-events-none border-2 border-dashed border-rose-500/20 rounded-2xl" />
        )}
        
        <div className={`flex-1 flex flex-col p-5 overflow-hidden ${isEditing ? "opacity-80 pointer-events-none" : ""}`}>
          {children}
        </div>
      </div>
    );
  }
);

WidgetContainer.displayName = "WidgetContainer";
