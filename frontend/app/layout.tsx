"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageSquare,
  Compass,
  GitBranch,
  Clock,
  ShieldCheck,
  Cpu,
  Plus,
  Activity,
  Trash2,
  Dna,
  Circle,
  LayoutDashboard,
  Newspaper,
} from "lucide-react";

import { listSessions, deleteSession, getHealth } from "@/lib/api";
import { ChatSession } from "@/lib/types";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [systemHealth, setSystemHealth] = useState<"healthy" | "unhealthy" | "loading">("loading");

  const loadSessionsList = async () => {
    try {
      const [list, health] = await Promise.all([
        listSessions(),
        getHealth()
      ]);
      setSessions(list);
      setSystemHealth(health.status === "healthy" ? "healthy" : "unhealthy");
    } catch (e) {
      console.error("Failed loading system state:", e);
      setSystemHealth("unhealthy");
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadSessionsList();
    });
    const interval = setInterval(() => { loadSessionsList(); }, 10000);
    return () => clearInterval(interval);
  }, [pathname]);

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Delete this research session?")) {
      try {
        await deleteSession(id);
        setSessions(sessions.filter((s) => s.id !== id));
        if (pathname === "/" && window.location.search.includes(id)) router.push("/");
      } catch (err) {
        console.error("Failed to delete session", err);
      }
    }
  };

  const navLinks = [
    { name: "Chat Copilot", href: "/", icon: MessageSquare, color: "text-violet-400" },
    { name: "Intelligence Dashboard", href: "/dashboard", icon: LayoutDashboard, color: "text-rose-400" },
    { name: "Topic Clinical News", href: "/news", icon: Newspaper, color: "text-pink-400" },
    { name: "Knowledge Explorer", href: "/explorer", icon: Compass, color: "text-blue-400" },
    { name: "Citation Graph", href: "/graph", icon: GitBranch, color: "text-cyan-400" },
    { name: "Research Timeline", href: "/timeline", icon: Clock, color: "text-indigo-400" },
    { name: "Evidence Auditor", href: "/verification", icon: ShieldCheck, color: "text-emerald-400" },
    { name: "System Operator", href: "/admin", icon: Cpu, color: "text-purple-400" },
  ];

  return (
    <html lang="en">
      <head>
        <title>MEDICA | Agentic Oncology Intelligence Platform</title>
        <meta
          name="description"
          content="Production-grade AI-native oncology research intelligence. Continuously ingests, verifies, indexes and links cancer research knowledge."
        />
      </head>
      <body className="antialiased bg-zinc-950 text-zinc-50 font-sans h-screen overflow-hidden flex">
        <div className="flex w-full h-full">
          {/* ============================================================
              SIDEBAR
             ============================================================ */}
          <aside className="relative z-10 flex flex-col shrink-0 w-72 bg-zinc-900/50 border-r border-white/5 backdrop-blur-xl">
            {/* ── Logo ── */}
            <div className="px-6 py-6 border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="relative flex items-center justify-center shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20">
                  <Dna className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-base tracking-wide text-zinc-100">
                    MEDICA
                  </div>
                  <div className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
                    Oncology OS v1.0
                  </div>
                </div>
              </div>
            </div>

            {/* ── Navigation ── */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <nav className="space-y-1 mb-8">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                        isActive
                          ? "bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/20 shadow-sm"
                          : "text-zinc-400 hover:bg-white/[0.02] hover:text-zinc-200 border border-transparent"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-sm tracking-wide">{link.name}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* ── Chat Sessions ── */}
              <div className="mt-4">
                <div className="flex items-center justify-between px-3 mb-3">
                  <div className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase font-semibold">
                    Recent Sessions
                  </div>
                  <button
                    onClick={() => router.push("/")}
                    className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition-colors border border-indigo-500/20"
                    title="New Research Session"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {sessions.length === 0 ? (
                  <div className="px-3 py-4 text-[11px] text-zinc-600 italic">
                    No active sessions
                  </div>
                ) : (
                  <div className="space-y-1">
                    {sessions.map((s) => {
                      const isActive = pathname === "/" && window.location.search.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => router.push(`/?session_id=${s.id}`)}
                          className="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all"
                          style={{
                            background: isActive ? "hsl(262 50% 20% / 0.4)" : "transparent",
                            border: `1px solid ${isActive ? "hsl(262 50% 35% / 0.25)" : "transparent"}`,
                            color: isActive ? "hsl(262 83% 75%)" : "hsl(220 8% 45%)",
                            fontSize: 12,
                            overflow: "hidden",
                            minWidth: 0,
                          }}
                        >
                          <Circle
                            className="w-1.5 h-1.5 shrink-0"
                            style={{ color: isActive ? "hsl(262 83% 70%)" : "hsl(220 8% 30%)", fill: "currentColor" }}
                          />
                          <span
                            style={{
                              flex: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              minWidth: 0,
                            }}
                            title={s.title}
                          >
                            {s.title}
                          </span>
                          <button
                            data-sidebar-delete
                            onClick={(e) => handleDeleteSession(e, s.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            style={{
                              color: "hsl(0 70% 55%)",
                              background: "transparent",
                              border: "none",
                              padding: "2px",
                              borderRadius: 4,
                              boxShadow: "none",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 20,
                              height: 20,
                            }}
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Node Status ── */}
            <div
              className="px-5 py-3"
              style={{
                borderTop: "1px solid hsl(240 8% 8%)",
                background: "hsl(240 10% 2%)",
              }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-2"
                  style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "hsl(220 8% 30%)", letterSpacing: "0.1em" }}
                >
                  <Activity className="w-3 h-3" style={{ color: "hsl(262 83% 60%)" }} />
                  NODE STATE
                </div>
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      display: "inline-block",
                      width: 6, height: 6,
                      borderRadius: "50%",
                      background: systemHealth === "healthy"
                        ? "hsl(150 76% 50%)"
                        : systemHealth === "unhealthy"
                        ? "hsl(0 70% 55%)"
                        : "hsl(220 8% 40%)",
                      boxShadow: systemHealth === "healthy"
                        ? "0 0 6px hsl(150 76% 50%)"
                        : "none",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 9,
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: systemHealth === "healthy"
                        ? "hsl(150 76% 55%)"
                        : systemHealth === "unhealthy"
                        ? "hsl(0 70% 55%)"
                        : "hsl(220 8% 40%)",
                      fontWeight: 600,
                    }}
                  >
                    {systemHealth}
                  </span>
                </div>
              </div>
            </div>
          </aside>

          {/* ============================================================
              MAIN CONTENT AREA
             ============================================================ */}
          <main
            className="flex-1 flex flex-col min-w-0 overflow-hidden relative"
            style={{ background: "hsl(240 12% 2%)", zIndex: 0 }}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
