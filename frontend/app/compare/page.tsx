"use client";

import React, { useEffect, useState } from "react";
import {
  GitCompare,
  Upload,
  FileText,
  Loader2,
  AlertTriangle,
  Sparkles,
  ScanText,
} from "lucide-react";

import { comparePaper, listCancerTypes } from "@/lib/api";
import { PaperComparisonResponse } from "@/lib/types";
import { RankedScoreChart } from "@/components/compare/RankedScoreChart";
import { ComponentHeatmap } from "@/components/compare/ComponentHeatmap";
import { ComparisonTable } from "@/components/compare/ComparisonTable";

type InputMode = "pdf" | "paste";

export default function ComparePaperPage() {
  const [mode, setMode] = useState<InputMode>("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [cancerType, setCancerType] = useState<string>("");
  const [candidateLimit, setCandidateLimit] = useState(10);
  const [cancerTypes, setCancerTypes] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaperComparisonResponse | null>(null);

  useEffect(() => {
    listCancerTypes().then(setCancerTypes).catch(() => setCancerTypes([]));
  }, []);

  const canSubmit = mode === "pdf" ? !!file : title.trim().length > 0 && abstract.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await comparePaper({
        file: mode === "pdf" ? file : null,
        title: mode === "paste" ? title : undefined,
        abstract: mode === "paste" ? abstract : undefined,
        cancerType: cancerType || undefined,
        candidateLimit,
      });
      setResult(response);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Comparison failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-50">
      <header className="px-6 py-4 flex items-center justify-between border-b border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-50 border border-violet-200 text-violet-600">
            <GitCompare className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-zinc-800 tracking-wide">Paper Comparator</div>
            <div className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
              5-Layer Novelty &amp; Contradiction Analysis
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-8 w-full min-w-0">
        <div className="w-full px-4 md:px-8 max-w-6xl mx-auto space-y-8">
          <div className="animate-fade-in">
            <h1 className="text-2xl font-bold tracking-tight mb-2 text-zinc-805">Compare a New Paper</h1>
            <p className="text-[13px] text-zinc-500 leading-relaxed max-w-2xl font-medium">
              Upload a PDF (OCR fallback for scanned pages) or paste a title and abstract. MEDICA ranks it
              against related papers in the knowledge base using keyword, embedding, topic, entity, and
              claim-relation analysis — weighted claim&nbsp;35% / topic&nbsp;25% / embedding&nbsp;20% /
              keyword&nbsp;10% / entity&nbsp;10%.
            </p>
          </div>

          {/* Input form */}
          <div className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-sm space-y-5 animate-fade-in">
            <div className="flex gap-2">
              <button
                onClick={() => setMode("pdf")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold border transition-all ${
                  mode === "pdf" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100"
                }`}
              >
                <Upload className="w-3.5 h-3.5" /> Upload PDF
              </button>
              <button
                onClick={() => setMode("paste")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold border transition-all ${
                  mode === "paste" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100"
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Paste Title &amp; Abstract
              </button>
            </div>

            {mode === "pdf" ? (
              <label className="flex flex-col items-center justify-center gap-2 py-10 rounded-xl border-2 border-dashed border-zinc-250 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer">
                <Upload className="w-6 h-6 text-zinc-400" />
                <span className="text-[12px] font-semibold text-zinc-600">
                  {file ? file.name : "Click to select a PDF"}
                </span>
                <span className="text-[10px] text-zinc-400">Max 25MB</span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            ) : (
              <div className="space-y-3">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Paper title"
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <textarea
                  value={abstract}
                  onChange={(e) => setAbstract(e.target.value)}
                  placeholder="Abstract"
                  rows={5}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                />
              </div>
            )}

            <div className="flex flex-wrap items-end gap-4 pt-2 border-t border-zinc-150">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-mono text-zinc-450 uppercase tracking-widest font-semibold">
                  Cancer Type Filter
                </label>
                <select
                  value={cancerType}
                  onChange={(e) => setCancerType(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-zinc-200 text-[12px] bg-white min-w-[200px]"
                >
                  <option value="">All categories</option>
                  {cancerTypes.map((ct) => (
                    <option key={ct} value={ct}>{ct.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-mono text-zinc-450 uppercase tracking-widest font-semibold">
                  Candidate Papers
                </label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={candidateLimit}
                  onChange={(e) => setCandidateLimit(Number(e.target.value) || 10)}
                  className="w-24 px-3 py-2 rounded-lg border border-zinc-200 text-[12px]"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || loading}
                className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white text-[12px] font-semibold shadow-sm transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? "Running 5-layer analysis..." : "Run Comparison"}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-[12px] font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-6 animate-fade-in">
              {/* Summary */}
              <div className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <h2 className="text-lg font-bold text-zinc-850">{result.new_paper_title}</h2>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-450 uppercase tracking-widest">
                    {result.ocr_used && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700">
                        <ScanText className="w-3 h-3" /> OCR used
                      </span>
                    )}
                    <span>{result.candidate_pool_size} candidate paper(s)</span>
                  </div>
                </div>
                {result.new_paper_keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {result.new_paper_keywords.slice(0, 12).map((kw) => (
                      <span key={kw} className="px-2 py-1 rounded-md font-mono text-[9px] font-medium uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-150">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
                {result.new_paper_claims.length > 0 && (
                  <ul className="text-[12px] text-zinc-600 space-y-1 list-disc list-inside">
                    {result.new_paper_claims.map((claim, i) => <li key={i}>{claim}</li>)}
                  </ul>
                )}
              </div>

              {result.candidates.length === 0 ? (
                <div className="p-8 rounded-2xl border border-zinc-200 bg-white shadow-sm text-center text-[13px] text-zinc-500 italic">
                  No candidate papers were compared.
                </div>
              ) : (
                <>
                  <RankedScoreChart candidates={result.candidates} />
                  <ComponentHeatmap candidates={result.candidates} />
                  <ComparisonTable candidates={result.candidates} />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
