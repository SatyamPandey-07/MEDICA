"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  HeartPulse, User, UserCheck, RefreshCw, Settings, Bell, CircleDot, Edit3, X
} from "lucide-react";

import {
  getVerificationStats, listVerificationPapers, getGraphStats,
  listIngestionJobs
} from "@/lib/api";
import { VerificationPaper, VerificationStats, GraphStats, IngestionJob } from "@/lib/types";

import { DashboardProvider } from "../../components/dashboard/DashboardContext";
import { useDashboardLayout } from "../../components/dashboard/useDashboardLayout";
import { DashboardLayout } from "../../components/dashboard/DashboardLayout";
import { DashboardSettingsPanel } from "../../components/dashboard/DashboardSettingsPanel";

const CANCER_TYPES = [
  "colorectal_cancer","breast_cancer","lung_cancer","non_small_cell_lung_cancer",
  "pancreatic_cancer","small_cell_lung_cancer","melanoma","glioblastoma",
  "leukemia","lymphoma","ovarian_cancer","prostate_cancer"
];

const formatCancerName = (name: string) => {
  return name
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

interface Toast {
  id: string;
  type: "success" | "info" | "warning";
  title: string;
  message: string;
}

export default function ClinicalDashboardPage() {
  const {
    isLoaded, widgets, layouts, onLayoutChange,
    addWidget, removeWidget, toggleWidgetVisibility,
    duplicateWidget, updateWidgetConfig, resetLayout
  } = useDashboardLayout();

  // ── Config ──────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [isExpertMode, setIsExpertMode] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // ── Data ────────────────────────────────────────────────────
  const [stats, setStats] = useState<VerificationStats | null>(null);
  const [papers, setPapers] = useState<VerificationPaper[]>([]);
  const [graphStats, setGraphStats] = useState<GraphStats | null>(null);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<VerificationPaper | null>(null);

  // ── Filters ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"all" | "guideline" | "paper">("all");
  const [selectedTopic, setSelectedTopic] = useState("colorectal_cancer");
  const [minConfidence, setMinConfidence] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // ── UI State ────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [lastGlobalUpdate, setLastGlobalUpdate] = useState("");
  const [countdown, setCountdown] = useState(20);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [widgetTimestamps, setWidgetTimestamps] = useState<Record<string, string>>({});
  const [prevJobCount, setPrevJobCount] = useState(0);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const cdRef   = useRef<NodeJS.Timeout | null>(null);

  // ── Persist settings ────────────────────────────────────────
  useEffect(() => {
    try {
      const m = localStorage.getItem("mdc_expert");
      const c = localStorage.getItem("mdc_selected_topic");
      if (m) setIsExpertMode(m === "true");
      if (c) setSelectedTopic(c);
    } catch {}
  }, []);

  const changeSelectedTopic = (topic: string) => {
    setSelectedTopic(topic);
    localStorage.setItem("mdc_selected_topic", topic);
  };

  const toggleExpert = () => {
    const n = !isExpertMode;
    setIsExpertMode(n);
    localStorage.setItem("mdc_expert", String(n));
    window.dispatchEvent(new CustomEvent("expert-mode-change", { detail: n }));
  };

  // ── Toast helpers ───────────────────────────────────────────
  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...t, id }]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 5000);
  }, []);

  // ── Fetch ───────────────────────────────────────────────────
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const now = new Date().toLocaleTimeString();
    try {
      const [vStats, fetchedPapers, gStats, fetchedJobs] = await Promise.all([
        getVerificationStats(),
        listVerificationPapers("all", "date", 50),
        getGraphStats(),
        listIngestionJobs(),
      ]);
      setStats(vStats);
      setPapers(fetchedPapers);
      setGraphStats(gStats);
      setJobs(prev => {
        // detect newly completed jobs
        const completedNow = fetchedJobs.filter(j => j.status === "done");
        const completedBefore = prev.filter(j => j.status === "done");
        if (completedNow.length > completedBefore.length) {
          addToast({ type: "success", title: "Ingestion Complete", message: `${completedNow.length - completedBefore.length} new job(s) finished. Widgets updated.` });
        }
        return fetchedJobs;
      });
      setPrevJobCount(fetchedJobs.filter(j => j.status === "running" || j.status === "pending").length);

      if (fetchedPapers.length > 0)
        setSelectedPaper(prev =>
          prev && fetchedPapers.some(p => p.id === prev.id)
            ? fetchedPapers.find(p => p.id === prev.id)!
            : fetchedPapers[0]
        );

      setLastGlobalUpdate(now);
      setCountdown(20);

      // Stamp every widget
      const ts: Record<string, string> = {};
      widgets.forEach(w => { ts[w.id] = now; });
      setWidgetTimestamps(ts);
    } catch (e) {
      console.error("Dashboard fetch error", e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [addToast, widgets]);

  useEffect(() => {
    if (isLoaded) {
      fetchData();
      pollRef.current = setInterval(() => { if (autoRefresh) fetchData(true); }, 20000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
  }, [autoRefresh, fetchData, isLoaded]);

  useEffect(() => {
    if (cdRef.current) clearInterval(cdRef.current);
    if (autoRefresh) {
      cdRef.current = setInterval(() =>
        setCountdown(p => (p <= 1 ? 20 : p - 1)), 1000);
    }
    return () => { if (cdRef.current) clearInterval(cdRef.current); };
  }, [autoRefresh]);

  // ── Derived data ────────────────────────────────────────────
  const isGuideline = (p: VerificationPaper) => {
    const t = p.title.toLowerCase();
    return t.includes("guideline") || t.includes("recommendation") || t.includes("consensus")
      || p.tags?.evidence?.includes("guideline_backed") === true
      || p.evidence_level === "systematic_review" || p.evidence_level === "meta_analysis";
  };

  const topicPapers = papers.filter(p =>
    p.tags?.cancer?.includes(selectedTopic)
    || p.title.toLowerCase().includes(selectedTopic.replace(/_/g, " "))
  );

  const totalGuidelines = topicPapers.filter(isGuideline).length;
  const runningJobs = jobs.filter(j => j.status === "running" || j.status === "pending");
  const recentNewPapers = topicPapers.filter(p => {
    if (!p.created_at) return false;
    return Date.now() - new Date(p.created_at).getTime() < 7 * 24 * 60 * 60 * 1000; // last 7 days
  });

  const filteredPapers = topicPapers.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || p.title.toLowerCase().includes(q)
      || (p.pmid?.includes(q)) || (p.journal?.toLowerCase().includes(q));
    const matchConf = p.confidence_score >= minConfidence;
    const isG = isGuideline(p);
    const matchTab = activeTab === "all" || (activeTab === "guideline" ? isG : !isG);
    return matchSearch && matchConf && matchTab;
  });

  const dynamicAvgConfidence = topicPapers.length > 0
    ? topicPapers.reduce((sum, p) => sum + p.confidence_score, 0) / topicPapers.length
    : 0.0;

  const dynamicStatusDistribution = topicPapers.reduce((acc, p) => {
    const s = p.verification_status;
    if (s === "verified" || s === "disputed" || s === "pending") {
      acc[s]++;
    }
    return acc;
  }, { verified: 0, disputed: 0, pending: 0 });

  const dynamicEvidenceLevelDistribution = topicPapers.reduce((acc: Record<string, number>, p) => {
    const el = p.evidence_level || "unknown";
    acc[el] = (acc[el] || 0) + 1;
    return acc;
  }, {});

  const evidenceDist = dynamicEvidenceLevelDistribution;

  // ── Render ───────────────────────────────────────────────────
  if (!isLoaded) return null;

  return (
    <DashboardProvider value={{
      stats, papers, graphStats, jobs,
      selectedPaper, setSelectedPaper,
      activeTab, setActiveTab,
      selectedTopic, setSelectedTopic,
      minConfidence, setMinConfidence,
      searchQuery, setSearchQuery,
      isExpertMode, topicPapers, filteredPapers,
      totalGuidelines, runningJobs, recentNewPapers,
      dynamicAvgConfidence, dynamicStatusDistribution,
      evidenceDist, fetchData, addToast
    }}>
      <div className="flex flex-col h-full min-h-0 bg-zinc-50 relative">

        {/* Edit Layout Mode Overlay Indicator */}
        {isEditingLayout && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="px-4 py-1.5 rounded-full bg-rose-50 text-rose-700 text-xs font-mono font-bold tracking-widest border border-rose-200 flex items-center gap-2 shadow-md">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              EDITING LAYOUT
            </div>
          </div>
        )}

        {/* Toast Notifications */}
        <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl animate-fade-in max-w-xs ${
              t.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : t.type === "info"    ? "bg-indigo-50 border-indigo-200 text-indigo-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
            }`}>
              <Bell className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] font-bold">{t.title}</div>
                <div className="text-[10px] opacity-80 mt-0.5">{t.message}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Header */}
        <header className="px-6 py-3.5 flex items-center justify-between border-b border-zinc-200 bg-white/80 backdrop-blur-xl sticky top-0 z-40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-500/20">
              <HeartPulse className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold text-zinc-800 tracking-wide">
                  {formatCancerName(selectedTopic)} Hub
                </h1>
                <select
                  value={selectedTopic}
                  onChange={e => changeSelectedTopic(e.target.value)}
                  className="ml-2 px-2 py-1 rounded-lg border border-zinc-200 bg-white text-[10px] font-mono text-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 cursor-pointer"
                >
                  {CANCER_TYPES.map(c => (
                    <option key={c} value={c}>
                      {formatCancerName(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase mt-0.5">
                Community Oncology Workspace · Updated {lastGlobalUpdate || "connecting…"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {runningJobs.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-150 text-[9px] font-mono text-indigo-700 animate-pulse">
                <CircleDot className="w-3 h-3 text-indigo-600" /> {runningJobs.length} LIVE
              </div>
            )}

            {/* Edit Layout Toggle */}
            <button onClick={() => {
              setIsEditingLayout(p => !p);
              if (!isEditingLayout) setShowSettings(true);
            }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-semibold transition-all border ${
                isEditingLayout
                  ? "bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/20"
                  : "bg-white text-zinc-700 border-zinc-200 shadow-sm hover:bg-zinc-50"
              }`}>
              {isEditingLayout ? <X className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
              {isEditingLayout ? "Done Editing" : "Edit Layout"}
            </button>

            {/* Expert toggle */}
            <button onClick={toggleExpert}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-semibold transition-all border ${
                isExpertMode
                  ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                  : "bg-white text-zinc-500 border-zinc-200 shadow-sm hover:bg-zinc-50"
              }`}>
              {isExpertMode ? <UserCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              {isExpertMode ? "Expert" : "General"}
            </button>

            {/* Auto-refresh */}
            <button onClick={() => setAutoRefresh(p => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono transition-all border ${
                autoRefresh
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-white text-zinc-400 border-zinc-200 hover:bg-zinc-50"
              }`}>
              <RefreshCw className={`w-3 h-3 ${autoRefresh ? "animate-spin" : ""}`} style={{ animationDuration: "3s" }} />
              {autoRefresh ? `${countdown}s` : "Paused"}
            </button>

            {/* Manual refresh */}
            <button onClick={() => fetchData()} className="p-1.5 rounded-lg bg-white text-zinc-600 hover:bg-zinc-50 border border-zinc-200 shadow-sm transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Settings */}
            <button onClick={() => setShowSettings(p => !p)}
              className={`p-1.5 rounded-lg border transition-colors ${showSettings ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 shadow-sm"}`}>
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-screen-2xl mx-auto space-y-5">
            {showSettings && (
              <DashboardSettingsPanel
                onClose={() => setShowSettings(false)}
                widgets={widgets}
                onToggleVisibility={toggleWidgetVisibility}
                onAddWidget={addWidget}
                onResetLayout={resetLayout}
                topicName={formatCancerName(selectedTopic)}
              />
            )}

            {loading && !layouts.lg ? (
              <div className="flex flex-col items-center justify-center py-40 gap-4">
                <div className="w-10 h-10 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
                <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest">Loading clinical intelligence…</div>
              </div>
            ) : (
              <DashboardLayout
                widgets={widgets}
                layouts={layouts}
                onLayoutChange={onLayoutChange}
                isEditing={isEditingLayout}
                onRemoveWidget={removeWidget}
                onHideWidget={toggleWidgetVisibility}
                onDuplicateWidget={duplicateWidget}
                widgetTimestamps={widgetTimestamps}
              />
            )}
          </div>
        </div>
      </div>
    </DashboardProvider>
  );
}
