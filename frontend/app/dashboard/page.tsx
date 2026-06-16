"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  LayoutDashboard, Settings, User, UserCheck, RefreshCw, FileText,
  CheckCircle, AlertCircle, ShieldCheck, TrendingUp, Play, Clock,
  Compass, GitBranch, X, Sliders, Eye, BookOpen, HeartPulse, Activity,
  ArrowUp, ArrowDown, Info, Zap, Database, FlaskConical, Filter,
  Newspaper, BarChart3, Users, Bell, ChevronRight, Stethoscope,
  Search, Microscope, Star, TriangleAlert, CircleDot
} from "lucide-react";

import {
  getVerificationStats, listVerificationPapers, getGraphStats,
  listIngestionJobs, triggerIngestionJob
} from "@/lib/api";
import { VerificationPaper, VerificationStats, GraphStats, IngestionJob } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface WidgetConfig {
  id: string;
  title: string;
  visible: boolean;
  width?: "full" | "half" | "third";
  lastUpdated?: string;
  config?: {
    limit?: number;
    sortBy?: string;
    customQuery?: string;
  };
}

interface Toast {
  id: string;
  type: "success" | "info" | "warning";
  title: string;
  message: string;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "kpis",              title: "Summary KPIs",               visible: true,  width: "full" },
  { id: "evidence_dist",     title: "Evidence Distribution",      visible: true,  width: "half" },
  { id: "system_summary",    title: "System Summary",             visible: true,  width: "third" },
  { id: "latest_literature", title: "New Papers & Guidelines",    visible: true,  width: "half", config: { limit: 50, sortBy: "date" } },
  { id: "takeaway_preview",  title: "Clinical Insight Preview",   visible: true,  width: "half" },
  { id: "topic_news",        title: "Topic-Specific Feed",        visible: true,  width: "third" },
  { id: "graph_preview",     title: "Knowledge Base Preview",     visible: true,  width: "third" },
  { id: "ingestion_console", title: "Ingestion Console",          visible: true,  width: "third", config: { limit: 10 } },
];

const formatCancerName = (name: string) => {
  return name
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const CANCER_TYPES = [
  "colorectal_cancer","breast_cancer","lung_cancer","non_small_cell_lung_cancer",
  "pancreatic_cancer","small_cell_lung_cancer","melanoma","glioblastoma",
  "leukemia","lymphoma","ovarian_cancer","prostate_cancer"
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString();

const timeSince = (iso?: string) => {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const scoreColor = (s: number) =>
  s >= 0.8 ? "text-emerald-400" : s >= 0.6 ? "text-blue-400" : s >= 0.4 ? "text-amber-400" : "text-red-400";

const scoreBg = (s: number) =>
  s >= 0.8 ? "bg-emerald-500/10 border-emerald-500/20" : s >= 0.6 ? "bg-blue-500/10 border-blue-500/20"
    : s >= 0.4 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20";

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export default function ClinicalDashboardPage() {
  // ── Config ──────────────────────────────────────────────────
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [showSettings, setShowSettings] = useState(false);
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

  // ── Scraper ─────────────────────────────────────────────────
  const [scrapeQuery, setScrapeQuery] = useState("");
  const [scrapeLimit, setScrapeLimit] = useState(10);
  const [scraping, setScraping] = useState(false);

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
      const w = localStorage.getItem("mdc_widgets");
      const m = localStorage.getItem("mdc_expert");
      const c = localStorage.getItem("mdc_selected_topic");
      if (w) {
        const parsed = JSON.parse(w) as WidgetConfig[];
        const merged = DEFAULT_WIDGETS.map(def => {
          const stored = parsed.find(x => x.id === def.id);
          return stored ? { ...def, ...stored } : def;
        });
        setWidgets(merged);
      } else {
        setWidgets(DEFAULT_WIDGETS);
      }
      if (m) setIsExpertMode(m === "true");
      if (c) setSelectedTopic(c);
    } catch {
      setWidgets(DEFAULT_WIDGETS);
    }
  }, []);

  const saveWidgets = (w: WidgetConfig[]) => {
    setWidgets(w);
    localStorage.setItem("mdc_widgets", JSON.stringify(w));
  };

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

      // stamp every widget
      const ts: Record<string, string> = {};
      DEFAULT_WIDGETS.forEach(w => { ts[w.id] = now; });
      setWidgetTimestamps(ts);
    } catch (e) {
      console.error("Dashboard fetch error", e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(() => { if (autoRefresh) fetchData(true); }, 20000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [autoRefresh, fetchData]);

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

  // Calculate dynamic stats for selected topic
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

  // Evidence distribution for bar chart
  const evidenceDist = dynamicEvidenceLevelDistribution;
  const evidenceEntries = Object.entries(evidenceDist).sort((a, b) => b[1] - a[1]);
  const maxEvCount = Math.max(...Object.values(evidenceDist), 1);

  // ── Widget helpers ──────────────────────────────────────────
  const WidgetHeader = ({ id, icon: Icon, color, title, children }: {
    id: string; icon: React.ElementType; color: string; title: string; children?: React.ReactNode
  }) => (
    <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4 shrink-0">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <h3 className="text-[11px] font-mono tracking-widest uppercase text-zinc-300 font-semibold">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        {widgetTimestamps[id] && (
          <span className="text-[8px] font-mono text-zinc-600 hidden sm:block">
            Updated {widgetTimestamps[id]}
          </span>
        )}
        {children}
      </div>
    </div>
  );

  // ── Scraper ─────────────────────────────────────────────────
  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrapeQuery.trim() || scraping) return;
    setScraping(true);
    try {
      const res = await triggerIngestionJob(scrapeQuery, scrapeLimit);
      addToast({ type: "info", title: "Ingestion Queued", message: res.message });
      setScrapeQuery("");
      fetchData(true);
    } catch (err: unknown) {
      addToast({ type: "warning", title: "Ingestion Failed", message: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setScraping(false);
    }
  };

  // ── Widget renderers ─────────────────────────────────────────

  // ① KPIs ────────────────────────────────────────────────────
  const renderKPIs = (w: WidgetConfig) => {
    const kpis = [
      {
        id: "total_papers", label: "Total Papers", value: fmt(topicPapers.length),
        sub: `${fmt(recentNewPapers.length)} new this week`,
        icon: FileText, color: "text-rose-400", bg: "bg-rose-500/8 border-rose-500/15",
        badge: recentNewPapers.length > 0 ? `+${recentNewPapers.length} NEW` : null
      },
      {
        id: "guidelines", label: "Clinical Guidelines", value: fmt(totalGuidelines),
        sub: "ASCO · NCCN · ESMO",
        icon: BookOpen, color: "text-violet-400", bg: "bg-violet-500/8 border-violet-500/15",
        badge: null
      },
      {
        id: "avg_conf", label: "Avg. Confidence", value: `${(dynamicAvgConfidence * 100).toFixed(1)}%`,
        sub: `${fmt(dynamicStatusDistribution.verified)} verified`,
        icon: ShieldCheck, color: "text-emerald-400", bg: "bg-emerald-500/8 border-emerald-500/15",
        badge: null
      },
      {
        id: "conflicts", label: "Conflicts Detected", value: fmt(dynamicStatusDistribution.disputed),
        sub: `${fmt(dynamicStatusDistribution.pending)} pending audit`,
        icon: TriangleAlert, color: "text-amber-400", bg: "bg-amber-500/8 border-amber-500/15",
        badge: dynamicStatusDistribution.disputed > 0 ? "REVIEW" : null
      },
      {
        id: "active_jobs", label: "Active Pipelines", value: fmt(runningJobs.length),
        sub: runningJobs.length > 0 ? "Scraping in progress" : "Scheduler idle",
        icon: Activity, color: runningJobs.length > 0 ? "text-indigo-400" : "text-zinc-500",
        bg: runningJobs.length > 0 ? "bg-indigo-500/8 border-indigo-500/15" : "bg-zinc-800/20 border-zinc-700/20",
        badge: runningJobs.length > 0 ? "LIVE" : null
      },
      {
        id: "graph_nodes", label: "Knowledge Nodes", value: fmt(graphStats?.total_nodes ?? 0),
        sub: `${fmt(graphStats?.total_edges ?? 0)} connections`,
        icon: GitBranch, color: "text-cyan-400", bg: "bg-cyan-500/8 border-cyan-500/15",
        badge: null
      },
    ];

    return (
      <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5">
        <WidgetHeader id="kpis" icon={BarChart3} color="text-rose-400" title={w.title || "Summary KPIs"} />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {kpis.map(k => {
            const Icon = k.icon;
            return (
              <div key={k.id} className={`relative p-4 rounded-2xl border ${k.bg} flex flex-col gap-2`}>
                {k.badge && (
                  <span className={`absolute top-2 right-2 text-[7px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded-full ${
                    k.badge === "LIVE" ? "bg-indigo-500/20 text-indigo-300" :
                    k.badge === "REVIEW" ? "bg-amber-500/20 text-amber-300" :
                    "bg-rose-500/20 text-rose-300"
                  }`}>{k.badge}</span>
                )}
                <div className={`p-2 rounded-xl self-start ${k.bg}`}>
                  <Icon className={`w-4 h-4 ${k.color} ${k.id === "active_jobs" && runningJobs.length > 0 ? "animate-pulse" : ""}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-tight text-white leading-none">{k.value}</div>
                  <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 mt-1">{k.label}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{k.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ② Evidence Distribution ────────────────────────────────────
  const renderEvidenceDist = (w: WidgetConfig) => (
    <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5">
      <WidgetHeader id="evidence_dist" icon={BarChart3} color="text-violet-400" title={w.title || "Evidence Distribution"}>
        <Link href="/verification" className="text-[9px] font-mono text-zinc-500 hover:text-violet-400 transition-colors flex items-center gap-1">
          Full Audit <ChevronRight className="w-3 h-3" />
        </Link>
      </WidgetHeader>
      {evidenceEntries.length === 0 ? (
        <div className="text-center py-6 text-[11px] text-zinc-600 italic">No evidence data yet.</div>
      ) : (
        <div className="space-y-2.5">
          {evidenceEntries.map(([level, count]) => (
            <div key={level} className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-zinc-400 capitalize">{level.replace(/_/g, " ")}</span>
                <span className="text-zinc-200 font-semibold">{count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-rose-500 transition-all duration-700"
                  style={{ width: `${(count / maxEvCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {isExpertMode && (
            <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-3 gap-2">
              {[
                { l: "Verified", v: dynamicStatusDistribution.verified, c: "text-emerald-400" },
                { l: "Disputed", v: dynamicStatusDistribution.disputed, c: "text-red-400" },
                { l: "Pending",  v: dynamicStatusDistribution.pending,  c: "text-amber-400" },
              ].map(x => (
                <div key={x.l} className="text-center">
                  <div className={`text-lg font-bold ${x.c}`}>{x.v}</div>
                  <div className="text-[9px] font-mono text-zinc-600 uppercase">{x.l}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ③ Latest Literature ────────────────────────────────────────
  const renderLatestLiterature = (w: WidgetConfig) => {
    const limit = w.config?.limit || 50;
    const slicedPapers = filteredPapers.slice(0, limit);

    return (
      <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5 flex flex-col" style={{ height: 520 }}>
        <WidgetHeader id="latest_literature" icon={Newspaper} color="text-rose-400" title={w.title || "New Papers & Guidelines"}>
          <div className="flex gap-1">
            {(["all", "guideline", "paper"] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-2 py-0.5 rounded text-[8px] font-mono capitalize border transition-all ${
                  activeTab === t ? "bg-zinc-700 text-zinc-200 border-white/10" : "text-zinc-500 border-transparent hover:text-zinc-300"
                }`}>
                {t === "all" ? "All" : t === "guideline" ? "Guidelines" : "Papers"}
              </button>
            ))}
          </div>
        </WidgetHeader>

        {/* Search + Confidence */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
            <input type="text" placeholder="Search title, PMID, journal..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-[11px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-rose-500/40 placeholder:text-zinc-600"
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="w-3 h-3 text-zinc-500" />
            <input type="range" min={0} max={90} step={10} value={minConfidence * 100}
              onChange={e => setMinConfidence(Number(e.target.value) / 100)}
              className="w-20 accent-rose-500 cursor-pointer" />
            <span className="text-[9px] font-mono text-zinc-400 w-7">{(minConfidence * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Count indicator */}
        <div className="text-[9px] font-mono text-zinc-600 mb-2">
          Showing <span className="text-zinc-400">{slicedPapers.length}</span> of {topicPapers.length} records
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
          {slicedPapers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Microscope className="w-8 h-8 text-zinc-700 mb-2" />
              <div className="text-[11px] text-zinc-600">No papers match filters</div>
            </div>
          ) : slicedPapers.map(p => {
            const active = selectedPaper?.id === p.id;
            const isG = isGuideline(p);
            const sc = p.confidence_score;
            const isNew = p.created_at && Date.now() - new Date(p.created_at).getTime() < 3 * 24 * 60 * 60 * 1000;

            return (
              <div key={p.id} onClick={() => setSelectedPaper(p)}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  active ? "bg-rose-500/8 border-rose-500/25" : "bg-zinc-950/30 border-white/5 hover:bg-zinc-900/50 hover:border-white/8"
                }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase border ${
                        isG ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      }`}>
                        {isG ? "Guideline" : "Paper"}
                      </span>
                      {isNew && <span className="inline-flex px-1.5 py-0.5 rounded text-[7px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">NEW</span>}
                      {p.published && (
                        <span className="text-[8px] font-mono text-zinc-600">
                          {new Date(p.published).getFullYear()}
                        </span>
                      )}
                    </div>
                    <h4 className="text-[11px] font-medium text-zinc-200 line-clamp-2 leading-snug">{p.title}</h4>
                    <div className="text-[8px] font-mono text-zinc-600 mt-1 truncate">{p.journal}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-[11px] font-mono font-bold ${scoreColor(sc)}`}>{(sc * 100).toFixed(0)}%</div>
                    <div className="w-8 h-1 rounded-full bg-zinc-800 overflow-hidden mt-1">
                      <div className={`h-full ${sc >= 0.8 ? "bg-emerald-500" : sc >= 0.6 ? "bg-blue-500" : "bg-amber-500"}`}
                        style={{ width: `${sc * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ④ Clinical Insight Preview ─────────────────────────────────
  const renderInsightPreview = (w: WidgetConfig) => {
    if (!selectedPaper) return (
      <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5 flex flex-col items-center justify-center text-center" style={{ height: 520 }}>
        <Stethoscope className="w-10 h-10 text-zinc-700 mb-3" />
        <div className="text-sm font-semibold text-zinc-500">Select a paper</div>
        <p className="text-[11px] text-zinc-600 max-w-xs mt-1 leading-relaxed">
          Click any paper from the literature feed to view structured clinical insights and audit details.
        </p>
      </div>
    );

    const p = selectedPaper;
    const tags = p.tags || { cancer: [], drugs: [], biomarkers: [], treatment: [], evidence: [] };
    const isG = isGuideline(p);

    return (
      <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5 flex flex-col" style={{ height: 520 }}>
        <WidgetHeader id="takeaway_preview" icon={Compass} color="text-emerald-400" title={w.title || "Clinical Insight Preview"}>
          <Link href={`/papers/${p.id}`}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[9px] font-mono border border-white/5 transition-colors">
            <Eye className="w-3 h-3" /> Full Audit
          </Link>
        </WidgetHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
          {/* Header */}
          <div className="p-3 rounded-xl bg-zinc-950/50 border border-white/5">
            <div className="flex items-start gap-2 mb-2">
              <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase border ${
                isG ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
              }`}>{isG ? "Guideline" : "Research Paper"}</span>
              <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase border ${scoreBg(p.confidence_score)}`}>
                {(p.confidence_score * 100).toFixed(0)}% conf.
              </span>
            </div>
            <h4 className="text-[13px] font-bold text-white leading-snug mb-1.5">{p.title}</h4>
            <div className="flex flex-wrap gap-3 text-[9px] font-mono text-zinc-500">
              {p.journal && <span>📖 {p.journal}</span>}
              {p.published && <span>📅 {new Date(p.published).getFullYear()}</span>}
              {p.pmid && (
                <a href={`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}`} target="_blank" rel="noopener noreferrer"
                  className="text-indigo-400 hover:underline">🔗 PMID {p.pmid}</a>
              )}
            </div>
          </div>

          {/* Mode-aware content */}
          {!isExpertMode ? (
            <>
              {/* What does this paper do? */}
              <div className="p-3 rounded-xl bg-zinc-950/30 border border-white/5">
                <div className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 font-semibold mb-2 flex items-center gap-1.5">
                  <Zap className="w-3 h-3" /> What does this paper do?
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  {p.abstract
                    ? p.abstract.slice(0, 320) + (p.abstract.length > 320 ? "…" : "")
                    : isG
                      ? `Provides evidence-backed clinical recommendations for ${tags.cancer.join(", ") || "oncology"} patients, evaluating ${tags.drugs.join(", ") || "standard therapies"} against current guidelines.`
                      : `Investigates clinical efficacy of ${tags.drugs.join(", ") || "novel therapy"} targeting ${tags.biomarkers.join(", ") || "molecular markers"} in ${tags.cancer.join(", ") || "oncology"} patients.`
                  }
                </p>
              </div>

              {/* Targets */}
              {(tags.cancer.length + tags.drugs.length + tags.biomarkers.length) > 0 && (
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 font-semibold mb-1.5">Clinical Targets</div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.cancer.map(c => (
                      <span key={c} className="px-2 py-0.5 rounded-md text-[9px] font-mono bg-rose-500/10 text-rose-300 border border-rose-500/15">🎗️ {c.replace(/_/g, " ")}</span>
                    ))}
                    {tags.drugs.map(d => (
                      <span key={d} className="px-2 py-0.5 rounded-md text-[9px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/15">💊 {d}</span>
                    ))}
                    {tags.biomarkers.map(b => (
                      <span key={b} className="px-2 py-0.5 rounded-md text-[9px] font-mono bg-teal-500/10 text-teal-300 border border-teal-500/15">🧬 {b.toUpperCase()}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit verdict */}
              <div className={`p-3 rounded-xl border flex items-center gap-3 ${scoreBg(p.confidence_score)}`}>
                <ShieldCheck className={`w-5 h-5 shrink-0 ${scoreColor(p.confidence_score)}`} />
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">Audit Status</div>
                  <div className="text-[12px] font-bold text-white capitalize mt-0.5">
                    {p.verification_status} · {(p.confidence_score * 100).toFixed(0)}% confidence
                  </div>
                </div>
              </div>
            </>
          ) : (
            // EXPERT MODE
            <>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { l: "Evidence Level", v: p.evidence_level.replace(/_/g, " ") },
                  { l: "Study Type", v: (p.evidence_level || "other").replace(/_/g, " ") },
                  { l: "Confidence Score", v: p.confidence_score.toFixed(4), mono: true },
                  { l: "Sample Size", v: p.sample_size ? `n = ${p.sample_size}` : "Not stated" },
                  { l: "Audit Flags", v: p.flags?.length ? `${p.flags.length} warning(s)` : "None", warn: (p.flags?.length ?? 0) > 0 },
                  { l: "Verification", v: p.verification_status },
                ].map(x => (
                  <div key={x.l} className="p-2.5 rounded-xl bg-zinc-950/40 border border-white/5">
                    <div className="text-[8px] font-mono text-zinc-600 uppercase mb-0.5">{x.l}</div>
                    <div className={`text-[11px] font-semibold capitalize ${x.warn ? "text-amber-400" : "text-zinc-200"} ${x.mono ? "font-mono" : ""}`}>
                      {x.v}
                    </div>
                  </div>
                ))}
              </div>

              {/* Adversarial review */}
              <div className="p-3 rounded-xl bg-zinc-950/50 border border-red-500/10">
                <div className="text-[8px] font-mono uppercase tracking-widest text-red-400 font-semibold mb-1.5 flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3" /> Adversarial Verifier Log
                </div>
                <p className="text-[10px] font-mono text-zinc-400 leading-relaxed">
                  {p.adversarial_review || "No adversarial review logged. Basic validation checks passed."}
                </p>
              </div>

              {/* Evidence flags */}
              {(p.flags?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.flags!.map(f => (
                    <span key={f} className="px-2 py-0.5 rounded text-[8px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/15">⚠ {f.replace(/_/g, " ")}</span>
                  ))}
                </div>
              )}

              {/* Abstract excerpt */}
              {p.abstract && (
                <div className="p-3 rounded-xl bg-zinc-950/20 border border-white/5">
                  <div className="text-[8px] font-mono uppercase tracking-widest text-zinc-600 font-semibold mb-1">Abstract</div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed line-clamp-4">{p.abstract}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  // ⑤ Topic News ───────────────────────────────────────────────
  const renderTopicNews = (w: WidgetConfig) => (
    <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5 flex flex-col" style={{ height: 420 }}>
      <WidgetHeader id="topic_news" icon={HeartPulse} color="text-pink-400" title={w.title || "Topic-Specific Feed"}>
        <div className="flex items-center gap-2">
          <select value={selectedTopic} onChange={e => changeSelectedTopic(e.target.value)}
            className="px-2 py-1 rounded-lg border border-zinc-800 bg-zinc-950 text-[9px] font-mono text-zinc-300 focus:outline-none">
            {CANCER_TYPES.map(c => (
              <option key={c} value={c}>{formatCancerName(c)}</option>
            ))}
          </select>
          <Link href="/news" className="text-[8px] font-mono text-zinc-500 hover:text-pink-400 flex items-center gap-0.5 transition-colors">
            Page <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </WidgetHeader>

      <div className="text-[9px] font-mono text-zinc-600 mb-2">
        {topicPapers.length} record{topicPapers.length !== 1 ? "s" : ""} for <span className="text-zinc-400 capitalize">{selectedTopic.replace(/_/g, " ")}</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
        {topicPapers.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FlaskConical className="w-7 h-7 text-zinc-700 mb-2" />
            <div className="text-[11px] text-zinc-600">No data for this topic yet.</div>
            <div className="text-[10px] text-zinc-700 mt-1">Trigger an ingestion run below.</div>
          </div>
        )}
        {topicPapers.map(p => {
          const isG = isGuideline(p);
          return (
            <div key={p.id} onClick={() => setSelectedPaper(p)}
              className="p-2.5 rounded-xl border border-white/5 bg-zinc-950/20 hover:bg-zinc-900/40 cursor-pointer transition-colors">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded text-[7px] font-mono font-bold border ${
                  isG ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                }`}>{isG ? "Guideline" : "Paper"}</span>
                {p.published && <span className="text-[8px] font-mono text-zinc-600">{new Date(p.published).toLocaleDateString()}</span>}
                <span className={`text-[8px] font-mono font-bold ${scoreColor(p.confidence_score)}`}>{(p.confidence_score * 100).toFixed(0)}%</span>
              </div>
              <h4 className="text-[11px] font-medium text-zinc-200 line-clamp-2 leading-snug">{p.title}</h4>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ⑥ Knowledge Graph Preview ──────────────────────────────────
  const renderGraphPreview = (w: WidgetConfig) => {
    const items = [
      { l: "Cancer Types",  v: graphStats?.cancer_nodes ?? 0,   c: "from-rose-500 to-pink-500" },
      { l: "Drugs",         v: graphStats?.drug_nodes ?? 0,     c: "from-blue-500 to-cyan-500" },
      { l: "Biomarkers",    v: graphStats?.biomarker_nodes ?? 0,c: "from-teal-500 to-emerald-500" },
      { l: "Total Nodes",   v: graphStats?.total_nodes ?? 0,    c: "from-violet-500 to-purple-500" },
      { l: "Connections",   v: graphStats?.total_edges ?? 0,    c: "from-amber-500 to-orange-500" },
    ];
    const max = Math.max(...items.map(i => i.v), 1);
    return (
      <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5 flex flex-col justify-between" style={{ height: 420 }}>
        <div>
          <WidgetHeader id="graph_preview" icon={Database} color="text-cyan-400" title={w.title || "Knowledge Base Preview"}>
            <Link href="/explorer" className="text-[8px] font-mono text-zinc-500 hover:text-cyan-400 flex items-center gap-0.5 transition-colors">
              Explorer <ChevronRight className="w-3 h-3" />
            </Link>
          </WidgetHeader>
          <p className="text-[10px] text-zinc-500 mb-4 leading-relaxed">
            Canonical entity graph built from {topicPapers.length} indexed oncology papers across {graphStats?.cancer_nodes ?? 0} cancer types.
          </p>
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.l}>
                <div className="flex justify-between text-[10px] font-mono mb-1">
                  <span className="text-zinc-500">{item.l}</span>
                  <span className="text-zinc-200 font-semibold">{fmt(item.v)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div className={`h-full bg-gradient-to-r ${item.c} transition-all duration-700`}
                    style={{ width: `${(item.v / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Link href="/graph" className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-semibold transition-colors flex items-center justify-center gap-1.5 border border-white/5">
            <GitBranch className="w-3.5 h-3.5" /> Citation Graph
          </Link>
          <Link href="/explorer" className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-semibold transition-colors flex items-center justify-center gap-1.5 border border-white/5">
            <Compass className="w-3.5 h-3.5" /> Explorer
          </Link>
        </div>
      </div>
    );
  };

  // ⑦ Ingestion Console ───────────────────────────────────────
  const renderIngestionConsole = (w: WidgetConfig) => (
    <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5 flex flex-col justify-between" style={{ height: 420 }}>
      <div>
        <WidgetHeader id="ingestion_console" icon={Zap} color="text-indigo-400" title={w.title || "Ingestion Console"}>
          <Link href="/admin" className="text-[8px] font-mono text-zinc-500 hover:text-indigo-400 flex items-center gap-0.5 transition-colors">
            Control Panel <ChevronRight className="w-3 h-3" />
          </Link>
        </WidgetHeader>

        {/* Quick scrape form */}
        <form onSubmit={handleScrape} className="mb-4">
          <div className="text-[8px] font-mono uppercase tracking-wider text-zinc-600 mb-2">PubMed Quick Ingest</div>
          <div className="flex gap-1.5">
            <input type="text" placeholder="e.g. BRCA1 breast cancer..."
              value={scrapeQuery} onChange={e => setScrapeQuery(e.target.value)}
              disabled={scraping}
              className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-[10px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 disabled:opacity-50"
            />
            <select value={scrapeLimit} onChange={e => setScrapeLimit(Number(e.target.value))}
              className="px-2 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-[10px] font-mono text-zinc-300">
              {[5, 10, 25, 50].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <button type="submit" disabled={scraping || !scrapeQuery.trim()}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Play className="w-3 h-3" />{scraping ? "…" : "Run"}
            </button>
          </div>
        </form>

        {/* Job list */}
        <div className="text-[8px] font-mono uppercase tracking-wider text-zinc-600 mb-2">Recent Jobs</div>
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-0.5">
          {jobs.slice(0, 6).map(j => (
            <div key={j.id} className="p-2 rounded-lg bg-zinc-950/40 border border-white/5 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-medium text-zinc-300 truncate" title={j.query}>{j.query}</div>
                <div className="text-[8px] font-mono text-zinc-600">{timeSince(j.started_at ?? undefined)} · {j.fetched} fetched · {j.processed} indexed</div>
              </div>
              <span className={`shrink-0 text-[7px] font-mono px-1.5 py-0.5 rounded font-bold uppercase border ${
                j.status === "done" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : j.status === "running" ? "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse"
                : j.status === "failed" ? "bg-red-500/10 text-red-400 border-red-500/20"
                : "bg-zinc-800 text-zinc-500 border-zinc-700"
              }`}>{j.status}</span>
            </div>
          ))}
          {jobs.length === 0 && (
            <div className="text-center py-6 text-[10px] text-zinc-700">No ingestion runs yet</div>
          )}
        </div>
      </div>
    </div>
  );

  // ⑧ System Summary ──────────────────────────────────────────
  const renderSystemSummary = (w: WidgetConfig) => {
    const verifiedPct = topicPapers.length > 0
      ? ((dynamicStatusDistribution.verified / topicPapers.length) * 100).toFixed(0) : "0";
    const completedJobs = jobs.filter(j => j.status === "done");
    const totalIndexed = completedJobs.reduce((a, j) => a + (j.processed || 0), 0);

    return (
      <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5">
        <WidgetHeader id="system_summary" icon={Star} color="text-amber-400" title={w.title || "System Summary"} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { l: "Total Indexed",    v: fmt(totalIndexed),     icon: Database,     c: "text-cyan-400" },
            { l: "Verified %",       v: `${verifiedPct}%`,     icon: CheckCircle,  c: "text-emerald-400" },
            { l: "Ingestion Runs",   v: fmt(completedJobs.length), icon: FlaskConical, c: "text-indigo-400" },
            { l: "Data Sources",     v: "PubMed",              icon: Search,       c: "text-zinc-400" },
          ].map(x => {
            const Icon = x.icon;
            return (
              <div key={x.l} className="p-3 rounded-xl bg-zinc-950/40 border border-white/5 flex flex-col gap-2">
                <Icon className={`w-4 h-4 ${x.c}`} />
                <div>
                  <div className="text-lg font-bold text-white leading-none">{x.v}</div>
                  <div className="text-[9px] font-mono text-zinc-600 uppercase mt-0.5">{x.l}</div>
                </div>
              </div>
            );
          })}
        </div>
        {isExpertMode && (
          <div className="mt-3 pt-3 border-t border-white/5 text-[9px] font-mono text-zinc-600 space-y-1">
            <div>LLM Provider: <span className="text-zinc-400">Groq / llama-3.3-70b-versatile</span></div>
            <div>Embedding: <span className="text-zinc-400">all-MiniLM-L6-v2 (local)</span></div>
            <div>Vector Dims: <span className="text-zinc-400">384</span></div>
            <div>Database: <span className="text-zinc-400">PostgreSQL + pgvector 0.8.2</span></div>
          </div>
        )}
      </div>
    );
  };

  // ── Widget dispatcher ────────────────────────────────────────
  const renderWidget = (id: string, w: WidgetConfig) => ({
    kpis:              renderKPIs(w),
    evidence_dist:     renderEvidenceDist(w),
    latest_literature: renderLatestLiterature(w),
    takeaway_preview:  renderInsightPreview(w),
    topic_news:        renderTopicNews(w),
    graph_preview:     renderGraphPreview(w),
    ingestion_console: renderIngestionConsole(w),
    system_summary:    renderSystemSummary(w),
  }[id] ?? null);

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-950">

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-xl animate-fade-in max-w-xs ${
            t.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
            : t.type === "info"    ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-300"
            : "bg-amber-500/10 border-amber-500/20 text-amber-300"
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
      <header className="px-6 py-3.5 flex items-center justify-between border-b border-white/5 bg-zinc-950/60 backdrop-blur-xl sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-rose-600 to-pink-600 shadow-lg shadow-rose-500/20">
            <HeartPulse className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold text-zinc-100 tracking-wide">
                {formatCancerName(selectedTopic)} Hub
              </h1>
              <select
                value={selectedTopic}
                onChange={e => changeSelectedTopic(e.target.value)}
                className="ml-2 px-2 py-1 rounded-lg border border-zinc-800 bg-zinc-900 text-[10px] font-mono text-zinc-300 focus:outline-none focus:ring-1 focus:ring-rose-500/40 cursor-pointer"
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
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-mono text-indigo-300 animate-pulse">
              <CircleDot className="w-3 h-3" /> {runningJobs.length} LIVE
            </div>
          )}

          {/* Expert toggle */}
          <button onClick={toggleExpert}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-semibold transition-all border ${
              isExpertMode
                ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
                : "bg-zinc-800/60 text-zinc-400 border-zinc-700/40 hover:bg-zinc-800"
            }`}>
            {isExpertMode ? <UserCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            {isExpertMode ? "Expert" : "General"}
          </button>

          {/* Auto-refresh */}
          <button onClick={() => setAutoRefresh(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono transition-all border ${
              autoRefresh
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-zinc-800/60 text-zinc-500 border-zinc-700/40"
            }`}>
            <RefreshCw className={`w-3 h-3 ${autoRefresh ? "animate-spin" : ""}`} style={{ animationDuration: "3s" }} />
            {autoRefresh ? `${countdown}s` : "Paused"}
          </button>

          {/* Manual refresh */}
          <button onClick={() => fetchData()} className="p-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 border border-white/5 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Settings */}
          <button onClick={() => setShowSettings(p => !p)}
            className={`p-1.5 rounded-lg border transition-colors ${showSettings ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : "bg-zinc-800/60 border-white/5 text-zinc-300 hover:bg-zinc-700"}`}>
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-screen-2xl mx-auto space-y-5">

          {/* Settings drawer / Widget Studio */}
          {showSettings && (
            <div className="rounded-2xl border border-rose-500/20 bg-zinc-900/80 backdrop-blur-xl p-5 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div>
                  <h3 className="text-xs font-bold text-rose-400 flex items-center gap-2">
                    <Sliders className="w-4 h-4" /> Oncology Widget Studio
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Configure, resize, rename, and publish dashboard widgets for the {formatCancerName(selectedTopic)} community.</p>
                </div>
                <button onClick={() => setShowSettings(false)} className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {widgets.map((w, i) => (
                  <div key={w.id} className="p-4 rounded-xl bg-zinc-950 border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={w.visible}
                          id={`visible-${w.id}`}
                          onChange={() => {
                            const n = widgets.map((x, j) => i === j ? { ...x, visible: !x.visible } : x);
                            saveWidgets(n);
                          }}
                          className="w-3.5 h-3.5 rounded accent-rose-500 cursor-pointer"
                        />
                        <label htmlFor={`visible-${w.id}`} className="text-[11px] font-mono uppercase tracking-widest text-zinc-300 font-semibold cursor-pointer">
                          {w.title}
                        </label>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => {
                          if (i === 0) return;
                          const n = [...widgets];
                          [n[i-1], n[i]] = [n[i], n[i-1]];
                          saveWidgets(n);
                        }} disabled={i === 0} className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-20">
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button onClick={() => {
                          if (i === widgets.length - 1) return;
                          const n = [...widgets];
                          [n[i+1], n[i]] = [n[i], n[i+1]];
                          saveWidgets(n);
                        }} disabled={i === widgets.length - 1} className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-20">
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {w.visible && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                        <div className="col-span-2">
                          <label className="text-[9px] font-mono text-zinc-500 uppercase block mb-1">Widget Title</label>
                          <input type="text" value={w.title}
                            onChange={(e) => {
                              const n = widgets.map((x, j) => i === j ? { ...x, title: e.target.value } : x);
                              saveWidgets(n);
                            }}
                            className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-200 focus:outline-none focus:border-rose-500/40"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-mono text-zinc-500 uppercase block mb-1">Grid Width</label>
                          <select value={w.width || "third"}
                            onChange={(e) => {
                              const n = widgets.map((x, j) => i === j ? { ...x, width: e.target.value as WidgetConfig["width"] } : x);
                              saveWidgets(n);
                            }}
                            className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-200 focus:outline-none"
                          >
                            <option value="full">Full Width</option>
                            <option value="half">Half Width</option>
                            <option value="third">Third Width</option>
                          </select>
                        </div>

                        {(w.id === "latest_literature" || w.id === "ingestion_console") && (
                          <div>
                            <label className="text-[9px] font-mono text-zinc-500 uppercase block mb-1">Item Limit</label>
                            <input type="number" min={1} max={100}
                              value={w.config?.limit || 10}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 10;
                                const n = widgets.map((x, j) => i === j ? { ...x, config: { ...x.config, limit: val } } : x);
                                saveWidgets(n);
                              }}
                              className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-200 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[9px] font-mono text-zinc-600 mt-2">All customized workspace configurations are saved in local storage.</p>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
              <div className="w-10 h-10 rounded-full border-2 border-rose-500/30 border-t-rose-500 animate-spin" />
              <div className="text-[11px] font-mono text-zinc-600 uppercase tracking-widest">Loading clinical intelligence…</div>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-5">
              {widgets
                .filter(w => w.visible)
                .map(w => {
                  let spanClass = "col-span-12";
                  if (w.width === "half") {
                    spanClass = "col-span-12 xl:col-span-6";
                    if (w.id === "evidence_dist") {
                      spanClass = "col-span-12 lg:col-span-8";
                    }
                  } else if (w.width === "third") {
                    spanClass = "col-span-12 md:col-span-6 xl:col-span-4";
                    if (w.id === "system_summary") {
                      // Adjust to fit neatly next to evidence_dist
                      spanClass = "col-span-12 lg:col-span-4";
                    }
                  }

                  return (
                    <div key={w.id} className={spanClass}>
                      {renderWidget(w.id, w)}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
