"use client";

import React, { useState } from "react";
import { ComparisonCandidateResult } from "@/lib/types";
import { RELATION_COLORS, RELATION_LABELS, RelationKey, dominantRelation } from "./chartTokens";

const LEGEND_ORDER: RelationKey[] = ["supports", "contradicts", "extends", "similar", "neutral"];

interface RankedScoreChartProps {
  candidates: ComparisonCandidateResult[];
}

/**
 * Horizontal ranked bar chart: candidate overall similarity score, colored by
 * the dominant claim-relation to the new paper. Bars are the primary read;
 * the accompanying table (rendered by the caller) is the accessible fallback.
 */
export function RankedScoreChart({ candidates }: RankedScoreChartProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (candidates.length === 0) return null;

  return (
    <div className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h3 className="text-[11px] font-semibold text-zinc-800 uppercase tracking-widest font-mono">
          Ranked Overall Similarity
        </h3>
        {/* Legend — always present for 2+ series (relation categories) */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {LEGEND_ORDER.map((key) => (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-[3px] rounded-full shrink-0"
                style={{ backgroundColor: RELATION_COLORS[key] }}
              />
              <span className="text-[10px] font-mono text-zinc-500 tracking-wide">{RELATION_LABELS[key]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex flex-col gap-2">
        {/* Recessive gridlines at 0/25/50/75/100% */}
        <div className="absolute inset-y-0 left-[38%] right-0 pointer-events-none">
          {[0, 25, 50, 75, 100].map((pct) => (
            <div
              key={pct}
              className="absolute top-0 bottom-0 border-l border-zinc-150"
              style={{ left: `${pct}%` }}
            />
          ))}
        </div>

        {candidates.map((c, idx) => {
          const relation = dominantRelation(c.relation_counts);
          const color = RELATION_COLORS[relation];
          const pct = Math.round(c.overall_score * 100);
          const isActive = activeIdx === idx;

          return (
            <div
              key={c.candidate_id}
              className="relative flex items-center gap-3 group"
              tabIndex={0}
              role="button"
              aria-label={`${c.title}: ${pct}% overall similarity, dominant relation ${RELATION_LABELS[relation]}`}
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseLeave={() => setActiveIdx(null)}
              onFocus={() => setActiveIdx(idx)}
              onBlur={() => setActiveIdx(null)}
            >
              <div className="w-[35%] shrink-0 text-[12px] text-zinc-700 font-medium truncate pr-2" title={c.title}>
                {c.title}
              </div>
              <div className="relative flex-1 h-6 flex items-center">
                <div
                  className="h-5 rounded-r-[4px] transition-opacity"
                  style={{
                    width: `${Math.max(pct, 1.5)}%`,
                    backgroundColor: color,
                    opacity: isActive ? 1 : 0.88,
                  }}
                />
                <span className="ml-2 text-[11px] font-mono font-semibold text-zinc-700 tabular-nums">{pct}%</span>
              </div>

              {isActive && (
                <div
                  className="absolute z-20 left-[38%] top-full mt-1 w-72 p-3 rounded-xl border border-zinc-200 bg-white shadow-lg text-[11px]"
                  role="tooltip"
                >
                  <div className="font-semibold text-zinc-800 mb-2 truncate">{c.title}</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-zinc-600">
                    <span>Keyword</span><span className="text-right tabular-nums">{Math.round(c.scores.keyword_jaccard * 100)}%</span>
                    <span>Embedding</span><span className="text-right tabular-nums">{Math.round(c.scores.embedding_similarity * 100)}%</span>
                    <span>Topic</span><span className="text-right tabular-nums">{Math.round(c.scores.topic_similarity * 100)}%</span>
                    <span>Entity</span><span className="text-right tabular-nums">{Math.round(c.scores.entity_similarity * 100)}%</span>
                    <span>Claim</span><span className="text-right tabular-nums">{Math.round(c.scores.claim_similarity * 100)}%</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-zinc-150 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-zinc-600">
                      Dominant relation: <strong className="text-zinc-800">{RELATION_LABELS[relation]}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
