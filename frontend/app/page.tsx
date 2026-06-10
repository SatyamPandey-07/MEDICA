"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Send,
  Terminal,
  Activity,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { getSession, streamChat } from "@/lib/api";
import { ChatMessage, ReasoningStep } from "@/lib/types";
import { ClinicalTextRenderer } from "@/lib/formatters";

// ============================================================
// CORE CHAT COMPONENT
// ============================================================
function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentReasoning, setCurrentReasoning] = useState<ReasoningStep[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [activeReasoningOpen, setActiveReasoningOpen] = useState(true);

  const lastLoadedSessionId = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    "Review pembrolizumab efficacy in mismatch repair-deficient (dMMR) colorectal cancer.",
    "Verify osimertinib resistance mechanisms in EGFR-mutant lung cancer.",
    "What is the evidence level of HER2-targeted ADCs in breast cancer?",
    "Verify claim: chemotherapy combined with immunotherapy improves overall survival.",
  ];

  useEffect(() => {
    if (sessionId && sessionId !== lastLoadedSessionId.current) {
      const loadHistory = async () => {
        try {
          const res = await getSession(sessionId);
          // Only update state if the user hasn't switched sessions while we were fetching
          if (sessionId === new URLSearchParams(window.location.search).get("session_id")) {
            setMessages(res.messages || []);
            lastLoadedSessionId.current = sessionId;
            setCurrentAnswer("");
            setCurrentReasoning([]);
          }
        } catch (e) {
          console.error("Failed loading session history:", e);
        }
      };
      loadHistory();
    } else if (!sessionId) {
      setMessages([]);
      lastLoadedSessionId.current = null;
      setCurrentAnswer("");
      setCurrentReasoning([]);
    }
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentAnswer, currentReasoning]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isStreaming) return;

    setInput("");
    setIsStreaming(true);
    setCurrentAnswer("");
    setCurrentReasoning([]);

    const userMsg: ChatMessage = { role: "user", content: textToSend };
    setMessages((prev) => [...prev, userMsg]);

    let activeSessionId = sessionId;
    let accumulatedAnswer = "";
    let accumulatedReasoning: ReasoningStep[] = [];

    await streamChat(
      textToSend,
      activeSessionId,
      (event) => {
        if (event.type === "session_init" && event.session_id) {
          activeSessionId = event.session_id;
          lastLoadedSessionId.current = activeSessionId; // Mark as loaded to prevent useEffect reload
          router.replace(`/?session_id=${activeSessionId}`);
        } else if (event.type === "thought" && event.content) {
          accumulatedReasoning = [...accumulatedReasoning, { type: "thought", content: event.content! }];
          setCurrentReasoning(accumulatedReasoning);
        } else if (event.type === "call" && event.content) {
          accumulatedReasoning = [...accumulatedReasoning, { type: "call", content: event.content! }];
          setCurrentReasoning(accumulatedReasoning);
        } else if (event.type === "observation" && event.content) {
          accumulatedReasoning = [...accumulatedReasoning, { type: "observation", content: event.content! }];
          setCurrentReasoning(accumulatedReasoning);
        } else if (event.type === "chunk" && event.content) {
          accumulatedAnswer += event.content;
          setCurrentAnswer(accumulatedAnswer);
        } else if (event.type === "done") {
          setIsStreaming(false);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: accumulatedAnswer,
              reasoning_path: accumulatedReasoning,
            },
          ]);
          setCurrentAnswer("");
          setCurrentReasoning([]);
        }
      },
      (err) => {
        setIsStreaming(false);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `⚠️ Error running research agent: ${err.message || "Unknown error."}`,
          },
        ]);
      }
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-950">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-zinc-100 tracking-wide">
              Oncology Research Copilot
            </div>
            <div className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
              Agentic Reasoning Engine
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] font-mono text-emerald-500 tracking-widest uppercase">
            Runtime Active
          </span>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        {messages.length === 0 && !currentAnswer && !isStreaming ? (
          <div className="max-w-2xl mx-auto pt-12 animate-fade-in">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-white/5 shadow-xl shadow-black/50 mb-6">
                <Activity className="w-7 h-7 text-blue-400" />
              </div>
              <h1 className="text-3xl font-bold mb-4 tracking-tight text-white">
                Welcome to MEDICA Intelligence
              </h1>
              <p className="text-[14px] text-zinc-400 leading-relaxed max-w-md mx-auto">
                An autonomous oncology research system powered by <strong className="text-blue-400 font-medium">Llama 3.3</strong>.
                Query trials, verify claims, and cross-link clinical evidence.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(s)}
                  className="p-5 rounded-2xl border border-white/5 bg-zinc-900/50 hover:bg-zinc-800/80 hover:border-white/10 text-left flex flex-col justify-between min-h-[120px] transition-all group"
                >
                  <span className="text-[13px] text-zinc-300 leading-relaxed line-clamp-3">
                    {s}
                  </span>
                  <span className="text-[10px] font-mono text-blue-500 mt-4 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    SUBMIT QUERY &rarr;
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {messages.map((m, idx) => (
              <div key={idx} className="mb-6 animate-fade-in">
                <div className={`flex gap-4 p-6 rounded-2xl border ${
                  m.role === "user" 
                    ? "bg-zinc-900 border-white/5" 
                    : "bg-zinc-900/40 border-white/[0.02]"
                }`}>
                  <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-[12px] font-bold border ${
                    m.role === "user"
                      ? "bg-zinc-800 border-white/10 text-zinc-300"
                      : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                  }`}>
                    {m.role === "user" ? <User className="w-4 h-4" /> : "M"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase mb-2">
                      {m.role === "user" ? "Researcher" : "MEDICA Intelligence"}
                    </div>
                    {m.role === "user" ? (
                      <div className="text-[14px] text-zinc-200">{m.content}</div>
                    ) : (
                      <ClinicalTextRenderer text={m.content} />
                    )}
                  </div>
                </div>

                {m.role === "assistant" && m.reasoning_path && m.reasoning_path.length > 0 && (
                  <ReasoningLogsVisualizer steps={m.reasoning_path} />
                )}
              </div>
            ))}

            {/* LIVE STREAMING */}
            {isStreaming && (
              <div className="mt-2 animate-fade-in">
                {currentReasoning.length > 0 && (
                  <div className="p-4 rounded-xl mb-4 bg-zinc-900/60 border border-white/5">
                    <button
                      onClick={() => setActiveReasoningOpen(!activeReasoningOpen)}
                      className="flex items-center justify-between w-full text-[10px] font-mono text-zinc-400 hover:text-zinc-200 uppercase tracking-widest"
                    >
                      <span className="flex items-center gap-2">
                        <Terminal className="w-3 h-3" />
                        REASONING LOOP · {currentReasoning.length} STEPS
                      </span>
                      {activeReasoningOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {activeReasoningOpen && (
                      <div className="mt-3 pl-3 border-l border-zinc-800 max-h-[280px] overflow-y-auto space-y-2">
                        {currentReasoning.map((step, sIdx) => (
                          <div key={sIdx} className="text-[11px] font-mono">
                            {step.type === "thought" && (
                              <div className="text-zinc-400">
                                <span className="text-indigo-400 font-semibold mr-1">&rarr; Thought:</span>
                                {step.content}
                              </div>
                            )}
                            {step.type === "call" && (
                              <div className="text-zinc-400">
                                <span className="text-amber-400 font-semibold mr-1">&#9889; Action:</span>
                                {step.content}
                              </div>
                            )}
                            {step.type === "observation" && (
                              <details className="text-zinc-500 mt-1">
                                <summary className="cursor-pointer flex items-center gap-1 hover:text-zinc-300 transition-colors">
                                  <span>&#128202; Observation (expand)</span>
                                  <ChevronDown className="w-3 h-3" />
                                </summary>
                                <pre className="mt-2 p-2.5 rounded-lg bg-zinc-950 border border-white/5 text-[10px] text-zinc-400 overflow-x-auto whitespace-pre-wrap max-h-[180px]">
                                  {step.content}
                                </pre>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {currentAnswer && (
                  <div className="flex gap-4 p-6 rounded-2xl border border-white/5 bg-zinc-900/40">
                    <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-[12px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      M
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono tracking-widest text-blue-400 uppercase mb-2 animate-pulse">
                        MEDICA · Streaming...
                      </div>
                      <ClinicalTextRenderer text={currentAnswer} />
                    </div>
                  </div>
                )}

                {!currentAnswer && (
                  <div className="flex items-center gap-3 pl-12 mt-4">
                    <div className="flex gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"></span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Agent processing...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input footer */}
      <footer className="p-4 md:p-6 shrink-0 bg-zinc-950 border-t border-white/5">
        <div className="max-w-3xl mx-auto relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            placeholder="Query clinical evidence, run trial searches, or verify oncological claims..."
            disabled={isStreaming}
            rows={1}
            className="w-full pl-5 pr-14 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-[14px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none min-h-[56px] transition-all"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={isStreaming || !input.trim()}
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              isStreaming || !input.trim()
                ? "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/20"
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// CLOSED REASONING LOGS COLLAPSIBLE VISUALIZER
// ============================================================
function ReasoningLogsVisualizer({ steps }: { steps: ReasoningStep[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="max-w-3xl mx-auto pl-4 border-l border-zinc-800 mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 uppercase tracking-widest transition-colors"
      >
        <Terminal className="w-3 h-3" />
        Reaction Trace · {steps.length} Steps
        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {isOpen && (
        <div className="mt-3 pl-2 border-l border-zinc-800/50 space-y-1.5 animate-fade-in">
          {steps.map((step, idx) => (
            <div key={idx} className="text-[11px] font-mono">
              {step.type === "thought" && (
                <div className="text-zinc-400">
                  <span className="text-indigo-400 font-semibold mr-1">&rarr; Thought:</span>
                  {step.content}
                </div>
              )}
              {step.type === "call" && (
                <div className="text-zinc-400">
                  <span className="text-amber-400 font-semibold mr-1">&#9889; Action:</span>
                  {step.content}
                </div>
              )}
              {step.type === "observation" && (
                <details className="text-zinc-500 mt-1">
                  <summary className="cursor-pointer flex items-center gap-1 hover:text-zinc-300 transition-colors">
                    <span>&#128202; Observation</span>
                    <ChevronDown className="w-3 h-3" />
                  </summary>
                  <pre className="mt-2 p-2.5 rounded-lg bg-zinc-950 border border-white/5 text-[10px] text-zinc-400 overflow-x-auto whitespace-pre-wrap max-h-[160px]">
                    {step.content}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center h-full bg-zinc-950 text-[11px] font-mono text-zinc-500 tracking-widest">
        <span className="animate-pulse">INITIATING MEDICA CONSOLE...</span>
      </div>
    }>
      <ChatPageContent />
    </React.Suspense>
  );
}

