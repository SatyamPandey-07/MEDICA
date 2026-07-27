/**
 * Chart color tokens for the paper-comparison view.
 * Categorical palette validated for CVD-safety with the dataviz skill's
 * validator (light-mode surface #fcfcfb): worst adjacent normal-vision
 * delta 31.3, worst CVD delta 6.9 (deutan) — within the floor, mitigated
 * by always pairing color with a text label (never color-alone identity).
 */
import { RelationCounts, ComparisonCandidateResult } from "@/lib/types";

export const RELATION_COLORS = {
  supports: "#2a78d6",
  contradicts: "#e34948",
  extends: "#1baf7a",
  similar: "#4a3aa7",
  neutral: "#898781",
} as const;

export type RelationKey = keyof typeof RELATION_COLORS;

export const RELATION_LABELS: Record<RelationKey, string> = {
  supports: "Supports",
  contradicts: "Contradicts",
  extends: "Extends",
  similar: "Similar",
  neutral: "Neutral",
};

/** The relation with the highest count for a candidate; ties fall back to "neutral". */
export function dominantRelation(counts: RelationCounts): RelationKey {
  const entries: [RelationKey, number][] = [
    ["supports", counts.supports],
    ["contradicts", counts.contradicts],
    ["extends", counts.extends],
    ["similar", counts.similar],
    ["neutral", counts.neutral],
  ];
  let best: [RelationKey, number] = ["neutral", -1];
  for (const entry of entries) {
    if (entry[1] > best[1]) best = entry;
  }
  return best[1] > 0 ? best[0] : "neutral";
}

// Sequential single-hue (blue) ramp, light -> dark, for magnitude encoding (heatmap cells).
const SEQUENTIAL_LIGHT = [0xcd, 0xe2, 0xfb]; // step 100
const SEQUENTIAL_DARK = [0x0d, 0x36, 0x6b]; // step 700

/** Interpolate the sequential blue ramp for a 0-1 score. */
export function sequentialBlue(score: number): string {
  const t = Math.max(0, Math.min(1, score));
  const rgb = SEQUENTIAL_LIGHT.map((start, i) => Math.round(start + (SEQUENTIAL_DARK[i] - start) * t));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/** Perceived luminance of an interpolated ramp step, to decide label ink color. */
export function sequentialTextColor(score: number): string {
  const t = Math.max(0, Math.min(1, score));
  // Ramp is dark enough past ~55% to need white text.
  return t > 0.55 ? "#ffffff" : "#0b0b0b";
}

export function relationCountEntries(candidate: ComparisonCandidateResult): { key: RelationKey; count: number }[] {
  return [
    { key: "supports", count: candidate.relation_counts.supports },
    { key: "contradicts", count: candidate.relation_counts.contradicts },
    { key: "extends", count: candidate.relation_counts.extends },
    { key: "similar", count: candidate.relation_counts.similar },
    { key: "neutral", count: candidate.relation_counts.neutral },
  ];
}
