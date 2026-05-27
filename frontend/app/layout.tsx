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
  Sparkles,
  Circle,
} from "lucide-react";

import { listSessions, deleteSession } from "@/lib/api";
import { ChatSession } from "@/lib/types";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [systemHealth, setSystemHealth] = useState<"healthy" | "unhealthy" | "loading">("loading");

  const loadSessionsList = async () => {
    try {
      const list = await listSessions();
      setSessions(list);
      setSystemHealth("healthy");
    } catch (e) {
      console.error("Failed loading chat sessions:", e);
      setSystemHealth("unhealthy");
    }
  };

  useEffect(() => {
    loadSessionsList();
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
    { name: "Knowledge Explorer", href: "/explorer", icon: Compass, color: "text-blue-400" },
    { name: "Citation Graph", href: "/graph", icon: GitBranch, color: "text-cyan-400" },
    { name: "Research Timeline", href: "/timeline", icon: Clock, color: "text-indigo-400" },
    { name: "Evidence Auditor", href: "/verification", icon: ShieldCheck, color: "text-emerald-400" },
    { name: "System Operator", href: "/admin", icon: Cpu, color: "text-purple-400" },
    { name: "Clinical Hub (Brutalist)", href: "/neobrutalism", icon: Sparkles, color: "text-amber-400" },
  ];

  return (
    <html lang="en">
      <head>
        <title>MEDICA | Agentic Oncology Intelligence Platform</title>
        <meta
          name="description"
          content="Production-grade AI-native oncology research intelligence. Continuously ingests, verifies, indexes and links cancer research knowledge."
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;1,14..32,400&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="antialiased select-none"
        style={{
          background: "hsl(240 12% 2%)",
          color: "hsl(220 20% 97%)",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <div className="flex h-screen overflow-hidden">
          {/* Ambient glow spheres */}
          <div
            className="glow-sphere glow-sphere--violet pointer-events-none"
            style={{ width: 500, height: 500, top: -100, left: -80, zIndex: 0 }}
          />
          <div
            className="glow-sphere glow-sphere--teal pointer-events-none"
            style={{ width: 400, height: 400, bottom: -80, right: 200, zIndex: 0 }}
          />

          {/* ============================================================
              SIDEBAR
             ============================================================ */}
          <aside
            className="relative z-10 flex flex-col shrink-0"
            style={{
              width: 256,
              borderRight: "1px solid hsl(240 8% 10%)",
              background: "linear-gradient(180deg, hsl(240 10% 3%) 0%, hsl(240 10% 2%) 100%)",
            }}
          >
            {/* ── Logo ── */}
            <div className="px-5 py-5" style={{ borderBottom: "1px solid hsl(240 8% 8%)" }}>
              <div className="flex items-center gap-3">
                {/* Hexagonal logo mark */}
                <div
                  className="relative flex items-center justify-center shrink-0"
                  style={{
                    width: 36, height: 36,
                    background: "linear-gradient(135deg, hsl(262 83% 60%) 0%, hsl(234 89% 65%) 100%)",
                    borderRadius: 10,
                    boxShadow: "0 4px 20px hsl(262 83% 50% / 0.35)",
                  }}
                >
                  <Dna className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div
                    className="font-bold tracking-wide"
                    style={{ fontSize: 16, letterSpacing: "0.05em", color: "hsl(220 20% 97%)" }}
                  >
                    MEDICA
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: "0.12em",
                      background: "linear-gradient(90deg, hsl(262 83% 72%), hsl(196 80% 72%))",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    ONCOLOGY OS v1.0
                  </div>
                </div>
              </div>
            </div>

            {/* ── Navigation ── */}
            <nav className="px-3 py-4" style={{ borderBottom: "1px solid hsl(240 8% 8%)" }}>
              <div
                className="px-2 mb-3"
                style={{
                  fontSize: 9,
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "0.15em",
                  color: "hsl(220 8% 35%)",
                  textTransform: "uppercase",
                }}
              >
                Core Systems
              </div>
              <div className="space-y-0.5">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group relative"
                      style={{
                        background: isActive ? "hsl(262 50% 25% / 0.4)" : "transparent",
                        border: `1px solid ${isActive ? "hsl(262 50% 40% / 0.3)" : "transparent"}`,
                        color: isActive ? "hsl(220 20% 97%)" : "hsl(220 8% 50%)",
                        fontWeight: isActive ? 500 : 400,
                        fontSize: 13,
                      }}
                    >
                      {/* Active indicator line */}
                      {isActive && (
                        <div
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full"
                          style={{
                            height: "60%",
                            background: "linear-gradient(180deg, hsl(262 83% 65%), hsl(196 80% 65%))",
                          }}
                        />
                      )}
                      <link.icon
                        className="w-4 h-4 shrink-0 transition-all duration-150"
                        style={{ color: isActive ? "hsl(262 83% 72%)" : "hsl(220 8% 40%)" }}
                      />
                      <span>{link.name}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* ── Research Streams ── */}
            <div className="flex-1 flex flex-col min-h-0">
              <div
                className="px-5 py-3 flex items-center justify-between"
                style={{ borderBottom: "1px solid hsl(240 8% 7%)" }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: "0.15em",
                    color: "hsl(220 8% 30%)",
                    textTransform: "uppercase",
                  }}
                >
                  Research Streams
                </span>
                <Link
                  href="/"
                  className="flex items-center justify-center rounded-md transition-all"
                  style={{
                    width: 22,
                    height: 22,
                    border: "1px solid hsl(240 8% 14%)",
                    background: "transparent",
                    color: "hsl(220 8% 40%)",
                  }}
                  title="New Session"
                >
                  <Plus className="w-3 h-3" />
                </Link>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2">
                {sessions.length === 0 ? (
                  <div
                    className="text-center py-6"
                    style={{ fontSize: 11, color: "hsl(220 8% 30%)", fontStyle: "italic" }}
                  >
                    No active streams.
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {sessions.map((s) => {
                      const isActive = pathname === "/" && window.location.search.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => router.push(`/?session_id=${s.id}`)}
                          className="group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all"
                          style={{
                            background: isActive ? "hsl(262 50% 20% / 0.4)" : "transparent",
                            border: `1px solid ${isActive ? "hsl(262 50% 35% / 0.25)" : "transparent"}`,
                            color: isActive ? "hsl(262 83% 75%)" : "hsl(220 8% 45%)",
                            fontSize: 12,
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Circle className="w-1.5 h-1.5 shrink-0" style={{ color: isActive ? "hsl(262 83% 70%)" : "hsl(220 8% 30%)", fill: "currentColor" }} />
                            <span className="truncate" style={{ maxWidth: 160 }} title={s.title}>
                              {s.title}
                            </span>
                          </div>
                          <button
                            onClick={(e) => handleDeleteSession(e, s.id)}
                            className="opacity-0 group-hover:opacity-100 rounded p-0.5 transition-all shrink-0"
                            style={{ color: "hsl(0 70% 55%)" }}
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
