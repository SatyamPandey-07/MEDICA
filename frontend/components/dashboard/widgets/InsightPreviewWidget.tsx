import React from "react";
import Link from "next/link";
import { Compass, Eye, Zap, ShieldCheck, AlertCircle, Stethoscope } from "lucide-react";
import { WidgetProps } from "../types";
import { useDashboardContext } from "../DashboardContext";
import { WidgetHeader } from "./WidgetHeader";
import { VerificationPaper } from "@/lib/types";

const scoreColor = (s: number) =>
  s >= 0.8 ? "text-emerald-600 font-semibold" : s >= 0.6 ? "text-indigo-600 font-semibold" : s >= 0.4 ? "text-amber-600 font-semibold" : "text-red-600 font-semibold";

const scoreBg = (s: number) =>
  s >= 0.8 ? "bg-emerald-50 border-emerald-100 text-emerald-800" : s >= 0.6 ? "bg-indigo-50 border-indigo-100 text-indigo-800"
    : s >= 0.4 ? "bg-amber-50 border-amber-100 text-amber-800" : "bg-red-50 border-red-100 text-red-800";

export const InsightPreviewWidget: React.FC<WidgetProps> = ({ instanceId, title, lastUpdated }) => {
  const { selectedPaper, isExpertMode } = useDashboardContext();

  const isGuideline = (p: VerificationPaper) => {
    const t = p.title.toLowerCase();
    return t.includes("guideline") || t.includes("recommendation") || t.includes("consensus")
      || p.tags?.evidence?.includes("guideline_backed") === true
      || p.evidence_level === "systematic_review" || p.evidence_level === "meta_analysis";
  };

  if (!selectedPaper) {
    return (
      <div className="flex flex-col items-center justify-center text-center h-full">
        <Stethoscope className="w-10 h-10 text-zinc-300 mb-3" />
        <div className="text-sm font-semibold text-zinc-500">Select a paper</div>
        <p className="text-[11px] text-zinc-400 max-w-xs mt-1 leading-relaxed">
          Click any paper from the literature feed to view structured clinical insights and audit details.
        </p>
      </div>
    );
  }

  const p = selectedPaper;
  const tags = p.tags || { cancer: [], drugs: [], biomarkers: [], treatment: [], evidence: [] };
  const isG = isGuideline(p);

  return (
    <>
      <WidgetHeader id={instanceId} icon={Compass} color="text-emerald-600" title={title} lastUpdated={lastUpdated}>
        <Link href={`/papers/${p.id}`}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-[9px] font-mono border border-zinc-200 shadow-sm transition-colors">
          <Eye className="w-3 h-3" /> Full Audit
        </Link>
      </WidgetHeader>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
        <div className="p-3 rounded-xl bg-white border border-zinc-200 shadow-sm shrink-0">
          <div className="flex items-start gap-2 mb-2">
            <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase border ${
              isG ? "bg-violet-50 text-violet-700 border-violet-100" : "bg-blue-50 text-blue-700 border-blue-100"
            }`}>{isG ? "Guideline" : "Research Paper"}</span>
            <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase border ${scoreBg(p.confidence_score)}`}>
              {(p.confidence_score * 100).toFixed(0)}% conf.
            </span>
          </div>
          <h4 className="text-[13px] font-bold text-zinc-800 leading-snug mb-1.5">{p.title}</h4>
          <div className="flex flex-wrap gap-3 text-[9px] font-mono text-zinc-400">
            {p.journal && <span>📖 {p.journal}</span>}
            {p.published && <span>📅 {new Date(p.published).getFullYear()}</span>}
            {p.pmid && (
              <a href={`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}`} target="_blank" rel="noopener noreferrer"
                className="text-indigo-600 hover:underline">🔗 PMID {p.pmid}</a>
            )}
          </div>
        </div>

        {!isExpertMode ? (
          <>
            <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 shrink-0">
              <div className="text-[9px] font-mono uppercase tracking-widest text-emerald-600 font-semibold mb-2 flex items-center gap-1.5">
                <Zap className="w-3 h-3" /> What does this paper do?
              </div>
              <p className="text-[11px] text-zinc-600 leading-relaxed">
                {p.abstract
                  ? p.abstract.slice(0, 320) + (p.abstract.length > 320 ? "…" : "")
                  : isG
                    ? `Provides evidence-backed clinical recommendations for ${tags.cancer.join(", ") || "oncology"} patients, evaluating ${tags.drugs.join(", ") || "standard therapies"} against current guidelines.`
                    : `Investigates clinical efficacy of ${tags.drugs.join(", ") || "novel therapy"} targeting ${tags.biomarkers.join(", ") || "molecular markers"} in ${tags.cancer.join(", ") || "oncology"} patients.`
                }
              </p>
            </div>

            {(tags.cancer.length + tags.drugs.length + tags.biomarkers.length) > 0 && (
              <div className="shrink-0">
                <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 font-semibold mb-1.5">Clinical Targets</div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.cancer.map(c => (
                    <span key={c} className="px-2 py-0.5 rounded-md text-[9px] font-mono bg-rose-50 text-rose-700 border border-rose-200">🎗️ {c.replace(/_/g, " ")}</span>
                  ))}
                  {tags.drugs.map(d => (
                    <span key={d} className="px-2 py-0.5 rounded-md text-[9px] font-mono bg-blue-50 text-blue-700 border border-blue-200">💊 {d}</span>
                  ))}
                  {tags.biomarkers.map(b => (
                    <span key={b} className="px-2 py-0.5 rounded-md text-[9px] font-mono bg-teal-50 text-teal-700 border border-teal-200">🧬 {b.toUpperCase()}</span>
                  ))}
                </div>
              </div>
            )}

            <div className={`p-3 rounded-xl border flex items-center gap-3 shrink-0 ${scoreBg(p.confidence_score)}`}>
              <ShieldCheck className={`w-5 h-5 shrink-0 ${scoreColor(p.confidence_score)}`} />
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">Audit Status</div>
                <div className="text-[12px] font-bold text-zinc-800 capitalize mt-0.5">
                  {p.verification_status} · {(p.confidence_score * 100).toFixed(0)}% confidence
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 shrink-0">
              {[
                { l: "Evidence Level", v: p.evidence_level.replace(/_/g, " ") },
                { l: "Study Type", v: (p.evidence_level || "other").replace(/_/g, " ") },
                { l: "Confidence Score", v: p.confidence_score.toFixed(4), mono: true },
                { l: "Sample Size", v: p.sample_size ? `n = ${p.sample_size}` : "Not stated" },
                { l: "Audit Flags", v: p.flags?.length ? `${p.flags.length} warning(s)` : "None", warn: (p.flags?.length ?? 0) > 0 },
                { l: "Verification", v: p.verification_status },
              ].map(x => (
                <div key={x.l} className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
                  <div className="text-[8px] font-mono text-zinc-500 uppercase mb-0.5">{x.l}</div>
                  <div className={`text-[11px] font-semibold capitalize ${x.warn ? "text-amber-600" : "text-zinc-800"} ${x.mono ? "font-mono" : ""}`}>
                    {x.v}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-red-50/50 border border-red-200 shrink-0">
              <div className="text-[8px] font-mono uppercase tracking-widest text-red-600 font-semibold mb-1.5 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" /> Adversarial Verifier Log
              </div>
              <p className="text-[10px] font-mono text-zinc-500 leading-relaxed">
                {p.adversarial_review || "No adversarial review logged. Basic validation checks passed."}
              </p>
            </div>

            {(p.flags?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {p.flags!.map(f => (
                  <span key={f} className="px-2 py-0.5 rounded text-[8px] font-mono bg-amber-50 text-amber-700 border border-amber-200">⚠ {f.replace(/_/g, " ")}</span>
                ))}
              </div>
            )}

            {p.abstract && (
              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 shrink-0">
                <div className="text-[8px] font-mono uppercase tracking-widest text-zinc-500 font-semibold mb-1">Abstract</div>
                <p className="text-[10px] text-zinc-500 leading-relaxed line-clamp-4">{p.abstract}</p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};
