"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ComparisonCandidateResult } from "@/lib/types";
import { RELATION_COLORS, RELATION_LABELS, relationCountEntries } from "./chartTokens";

interface ComparisonTableProps {
  candidates: ComparisonCandidateResult[];
}

/**
 * Accessible table view of the full comparison result — the fallback for
 * both the ranked bar chart and the heatmap, plus per-candidate claim
 * relationship detail (text content, not chartable).
 */
export function ComparisonTable({ candidates }: ComparisonTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50">
        <h3 className="text-[11px] font-semibold text-zinc-800 uppercase tracking-widest font-mono">
          Full Comparison Table
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/30">
              {["", "Paper", "Overall", "Keyword", "Embedding", "Topic", "Entity", "Claim", "Relations"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[9px] font-mono tracking-widest text-zinc-450 uppercase font-bold whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => {
              const isOpen = expanded === c.candidate_id;
              return (
                <React.Fragment key={c.candidate_id}>
                  <tr className="border-b border-zinc-150 hover:bg-zinc-50/40 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpanded(isOpen ? null : c.candidate_id)}
                        className="text-zinc-400 hover:text-zinc-700"
                        aria-label={isOpen ? "Collapse claim detail" : "Expand claim detail"}
                      >
                        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 max-w-[240px]">
                      <div className="text-[12px] font-medium text-zinc-800 truncate" title={c.title}>{c.title}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] font-bold text-zinc-800 tabular-nums">
                      {Math.round(c.overall_score * 100)}%
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-600 tabular-nums">{Math.round(c.scores.keyword_jaccard * 100)}%</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-600 tabular-nums">{Math.round(c.scores.embedding_similarity * 100)}%</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-600 tabular-nums">{Math.round(c.scores.topic_similarity * 100)}%</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-600 tabular-nums">{Math.round(c.scores.entity_similarity * 100)}%</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-600 tabular-nums">{Math.round(c.scores.claim_similarity * 100)}%</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {relationCountEntries(c).filter((r) => r.count > 0).map((r) => (
                          <span
                            key={r.key}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[9px] font-semibold"
                            style={{ color: RELATION_COLORS[r.key], backgroundColor: `${RELATION_COLORS[r.key]}14` }}
                          >
                            {RELATION_LABELS[r.key]} {r.count}
                          </span>
                        ))}
                        {relationCountEntries(c).every((r) => r.count === 0) && (
                          <span className="text-[9px] text-zinc-400 italic">no claim pairs</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-zinc-50/60 border-b border-zinc-150">
                      <td colSpan={9} className="px-6 py-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[12px]">
                          <div>
                            <div className="text-[9px] font-mono text-zinc-450 uppercase tracking-widest font-semibold mb-2">
                              New Paper Claims
                            </div>
                            {c.new_paper_claims.length > 0 ? (
                              <ul className="space-y-1.5 text-zinc-700 list-disc list-inside">
                                {c.new_paper_claims.map((claim, i) => <li key={i}>{claim}</li>)}
                              </ul>
                            ) : (
                              <p className="text-zinc-400 italic">No claims extracted.</p>
                            )}
                          </div>
                          <div>
                            <div className="text-[9px] font-mono text-zinc-450 uppercase tracking-widest font-semibold mb-2">
                              &quot;{c.title}&quot; Claims
                            </div>
                            {c.candidate_claims.length > 0 ? (
                              <ul className="space-y-1.5 text-zinc-700 list-disc list-inside">
                                {c.candidate_claims.map((claim, i) => <li key={i}>{claim}</li>)}
                              </ul>
                            ) : (
                              <p className="text-zinc-400 italic">No claims extracted.</p>
                            )}
                          </div>
                          {(c.shared_keywords.length > 0 || c.shared_entities.length > 0) && (
                            <div className="md:col-span-2 pt-4 border-t border-zinc-200 flex flex-col gap-3">
                              {c.shared_keywords.length > 0 && (
                                <div>
                                  <span className="text-[9px] font-mono text-zinc-450 uppercase tracking-widest font-semibold mr-2">
                                    Shared keywords:
                                  </span>
                                  <span className="text-zinc-600">{c.shared_keywords.join(", ")}</span>
                                </div>
                              )}
                              {c.shared_entities.length > 0 && (
                                <div>
                                  <span className="text-[9px] font-mono text-zinc-450 uppercase tracking-widest font-semibold mr-2">
                                    Shared entities:
                                  </span>
                                  <span className="text-zinc-600">{c.shared_entities.join(", ")}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
