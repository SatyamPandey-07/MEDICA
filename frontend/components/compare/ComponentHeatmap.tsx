"use client";

import React, { useState } from "react";
import { ComparisonCandidateResult } from "@/lib/types";
import { sequentialBlue, sequentialTextColor } from "./chartTokens";

const LAYERS: { key: keyof ComparisonCandidateResult["scores"]; label: string }[] = [
  { key: "keyword_jaccard", label: "Keyword" },
  { key: "embedding_similarity", label: "Embedding" },
  { key: "topic_similarity", label: "Topic" },
  { key: "entity_similarity", label: "Entity" },
  { key: "claim_similarity", label: "Claim" },
];

interface ComponentHeatmapProps {
  candidates: ComparisonCandidateResult[];
}

/**
 * Layer-score heatmap: one row per candidate, one column per analysis layer.
 * Sequential single-hue (blue) encoding — annotated with the value so the
 * chart never depends on hue-reading alone.
 */
export function ComponentHeatmap({ candidates }: ComponentHeatmapProps) {
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null);

  if (candidates.length === 0) return null;

  return (
    <div className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-x-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h3 className="text-[11px] font-semibold text-zinc-800 uppercase tracking-widest font-mono">
          Component Similarity Breakdown
        </h3>
        {/* Sequential legend */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-zinc-450">0%</span>
          <div
            className="w-24 h-2.5 rounded-full"
            style={{ background: `linear-gradient(to right, ${sequentialBlue(0)}, ${sequentialBlue(1)})` }}
          />
          <span className="text-[9px] font-mono text-zinc-450">100%</span>
        </div>
      </div>

      <div className="min-w-[560px]">
        <div className="grid" style={{ gridTemplateColumns: "minmax(160px, 1fr) repeat(5, 84px)" }}>
          <div />
          {LAYERS.map((l) => (
            <div key={l.key} className="text-[9px] font-mono text-zinc-450 uppercase tracking-widest text-center pb-2">
              {l.label}
            </div>
          ))}

          {candidates.map((c, rowIdx) => (
            <React.Fragment key={c.candidate_id}>
              <div className="flex items-center text-[12px] text-zinc-700 font-medium truncate pr-3 py-1" title={c.title}>
                {c.title}
              </div>
              {LAYERS.map((l, colIdx) => {
                const value = c.scores[l.key];
                const isHovered = hovered?.row === rowIdx && hovered?.col === colIdx;
                return (
                  <div key={l.key} className="p-[2px]">
                    <div
                      tabIndex={0}
                      role="button"
                      aria-label={`${c.title}, ${l.label}: ${Math.round(value * 100)}%`}
                      onMouseEnter={() => setHovered({ row: rowIdx, col: colIdx })}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered({ row: rowIdx, col: colIdx })}
                      onBlur={() => setHovered(null)}
                      className="relative h-9 rounded-md flex items-center justify-center text-[11px] font-mono font-semibold tabular-nums cursor-default transition-transform"
                      style={{
                        backgroundColor: sequentialBlue(value),
                        color: sequentialTextColor(value),
                        outline: isHovered ? "2px solid #0b0b0b" : "none",
                        outlineOffset: "-2px",
                      }}
                    >
                      {Math.round(value * 100)}%
                      {isHovered && (
                        <div
                          role="tooltip"
                          className="absolute z-20 bottom-full mb-1 left-1/2 -translate-x-1/2 px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white text-[10px] whitespace-nowrap shadow-lg"
                        >
                          {l.label}: {Math.round(value * 100)}%
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
