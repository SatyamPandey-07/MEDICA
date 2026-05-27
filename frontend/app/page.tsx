"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Send,
  Terminal,
  Activity,
  User,
  ShieldCheck,
  FileText,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { getSession, streamChat } from "@/lib/api";
import { ChatMessage, ReasoningStep } from "@/lib/types";

// ============================================================
// LIGHTWEIGHT MARKDOWN + CITATION PARSER
// ============================================================
function ClinicalTextRenderer({ text }: { text: string }) {
  if (!text) return null;

  // 1. Process PMID & DOI references
  let formatted = text;
  
  // Format PMID [PMID: 12345] -> Clickable link
  formatted = formatted.replace(
    /\[PMID:\s*(\d+)\]/g,
    '<a href="https://pubmed.ncbi.nlm.nih.gov/$1/" target="_blank" rel="noopener noreferrer" class="px-1.5 py-0.5 rounded bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/20 text-purple-400 text-xs font-mono inline-flex items-center gap-0.5 transition-colors">📄 PMID: $1</a>'
  );

  // Format DOI [DOI: 10.1002/...] -> Clickable link
  formatted = formatted.replace(
    /\[DOI:\s*([^\s\]]+)\]/g,
    '<a href="https://doi.org/$1" target="_blank" rel="noopener noreferrer" class="px-1.5 py-0.5 rounded bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/20 text-purple-400 text-xs font-mono inline-flex items-center gap-0.5 transition-colors">🔗 DOI: $1</a>'
  );

  // Split into paragraphs / lines
  const lines = formatted.split("\n");

  return (
    <div className="space-y-3 leading-relaxed text-sm text-slate-200">
      {lines.map((line, lineIdx) => {
        let trimmed = line.trim();

        if (!trimmed) return <div key={lineIdx} className="h-2" />;

        // Header Check
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={lineIdx} className="text-base font-semibold text-white mt-4 mb-2 font-display">
              {trimmed.replace("### ", "")}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={lineIdx} className="text-lg font-bold text-white mt-5 mb-2 border-b border-[#15151a] pb-1 font-display">
              {trimmed.replace("## ", "")}
            </h3>
          );
        }

        // Bullet Check
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const content = trimmed.substring(2);
          return (
            <ul key={lineIdx} className="list-disc pl-5 space-y-1">
              <li dangerouslySetInnerHTML={{ __html: parseInlineStyles(content) }} />
            </ul>
          );
        }

        // Standard Paragraph
        return (
          <p
            key={lineIdx}
            dangerouslySetInnerHTML={{ __html: parseInlineStyles(trimmed) }}
          />
        );
      })}
    </div>
  );
}

function parseInlineStyles(htmlText: string): string {
  // Bold **text**
  let parsed = htmlText.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  // Inline code `code`
  parsed = parsed.replace(/`(.*?)`/g, '<code class="px-1 py-0.5 font-mono text-purple-300 text-xs bg-slate-900 rounded">$1</code>');
  return parsed;
}

// ============================================================
// CORE CHAT COMPONENT
// ============================================================
export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentReasoning, setCurrentReasoning] = useState<ReasoningStep[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [activeReasoningOpen, setActiveReasoningOpen] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Suggested research triggers
  const suggestions = [
    "Review pembrolizumab efficacy in mismatch repair-deficient (dMMR) colorectal cancer.",
    "Verify osimertinib resistance mechanisms in EGFR-mutant lung cancer.",
    "What is the evidence level of HER2-targeted ADCs in breast cancer?",
    "Verify claim: chemotherapy combined with immunotherapy improves overall survival.",
  ];

  // Load session history on ID change
  useEffect(() => {
    if (sessionId) {
      const loadHistory = async () => {
        try {
          const res = await getSession(sessionId);
          setMessages(res.messages || []);
          setCurrentAnswer("");
          setCurrentReasoning([]);
        } catch (e) {
          console.error("Failed loading session history:", e);
        }
      };
      loadHistory();
    } else {
      setMessages([]);
      setCurrentAnswer("");
      setCurrentReasoning([]);
    }
  }, [sessionId]);

  // Autoscroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentAnswer, currentReasoning]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isStreaming) return;

    // Reset stream state
    setInput("");
    setIsStreaming(true);
    setCurrentAnswer("");
    setCurrentReasoning([]);

    // 1. Add User message
    const userMsg: ChatMessage = { role: "user", content: textToSend };
    setMessages((prev) => [...prev, userMsg]);

    let activeSessionId = sessionId;

    // 2. Consume SSE stream
    await streamChat(
      textToSend,
      activeSessionId,
      (event) => {
        if (event.type === "session_init" && event.session_id) {
          activeSessionId = event.session_id;
          router.replace(`/?session_id=${activeSessionId}`);
        } else if (event.type === "thought" && event.content) {
          setCurrentReasoning((prev) => [...prev, { type: "thought", content: event.content! }]);
        } else if (event.type === "call" && event.content) {
          setCurrentReasoning((prev) => [...prev, { type: "call", content: event.content! }]);
        } else if (event.type === "observation" && event.content) {
          setCurrentReasoning((prev) => [...prev, { type: "observation", content: event.content! }]);
        } else if (event.type === "chunk" && event.content) {
          setCurrentAnswer((prev) => prev + event.content);
        } else if (event.type === "done") {
          setIsStreaming(false);
          // Commit current stream to full list
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: currentAnswer,
              reasoning_path: currentReasoning,
            },
          ]);
          setCurrentAnswer("");
          setCurrentReasoning([]);
        }
      },
      (err) => {
        setIsStreaming(false);
        console.error("Chat streaming error:", err);
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, hsl(262 83% 55%), hsl(300 70% 50%))",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Activity style={{ width: 14, height: 14, color: "white" }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(220 20% 97%)", letterSpacing: "0.03em" }}>
              Oncology Research Copilot
            </div>
            <div style={{ fontSize: 10, color: "hsl(220 8% 40%)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>
              AGENTIC REASONING ENGINE
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "hsl(150 76% 50%)",
            boxShadow: "0 0 8px hsl(150 76% 50% / 0.7)",
            display: "inline-block",
            animation: "pulse-glow 2s infinite ease-in-out",
          }} />
          <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "hsl(150 76% 55%)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Agentic Runtime Active
          </span>
        </div>
      </header>

      {/* ============================================================
          CHAT MESSAGES THREAD CONTAINER
         ============================================================ */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
        {messages.length === 0 && !currentAnswer && !isStreaming ? (
          /* Welcome Screen */
          <div style={{ maxWidth: 680, margin: "0 auto", paddingTop: 40 }}>
            {/* Hero */}
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 56, height: 56, borderRadius: 16, marginBottom: 20,
                background: "linear-gradient(135deg, hsl(262 83% 55%), hsl(300 70% 50%))",
                boxShadow: "0 8px 32px hsl(262 83% 40% / 0.35)",
              }}>
                <Activity style={{ width: 26, height: 26, color: "white" }} />
              </div>
              <h1 style={{
                fontSize: 26, fontWeight: 700, marginBottom: 12, letterSpacing: "-0.02em",
                background: "linear-gradient(135deg, hsl(220 20% 97%), hsl(220 10% 70%))",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                Welcome to MEDICA Intelligence
              </h1>
              <p style={{ fontSize: 13, color: "hsl(220 8% 45%)", lineHeight: 1.7, maxWidth: 460, margin: "0 auto" }}>
                An autonomous oncology research system powered by <span style={{ color: "hsl(262 83% 70%)" }}>Llama 3.3 70B on Groq</span>.
                Query trials, verify claims, and cross-link clinical evidence.
              </p>
            </div>

            {/* Suggestion cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(s)}
                  style={{
                    padding: "16px 18px", borderRadius: 12, cursor: "pointer",
                    border: "1px solid hsl(240 8% 12%)",
                    background: "linear-gradient(135deg, hsl(240 8% 5%) 0%, hsl(240 6% 7%) 100%)",
                    textAlign: "left", display: "flex", flexDirection: "column",
                    justifyContent: "space-between", minHeight: 110,
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "hsl(262 50% 35%)";
                    e.currentTarget.style.background = "linear-gradient(135deg, hsl(262 50% 8%) 0%, hsl(240 6% 7%) 100%)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "hsl(240 8% 12%)";
                    e.currentTarget.style.background = "linear-gradient(135deg, hsl(240 8% 5%) 0%, hsl(240 6% 7%) 100%)";
                  }}
                >
                  <span style={{ fontSize: 12, color: "hsl(220 15% 75%)", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {s}
                  </span>
                  <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "hsl(262 83% 65%)", marginTop: 12 }}>
                    Submit Query →
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message List */
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            {messages.map((m, idx) => (
              <div key={idx} style={{ marginBottom: 24 }}>
                {/* Chat message */}
                <div style={{
                  display: "flex", gap: 14, padding: "18px 20px", borderRadius: 14,
                  border: "1px solid",
                  borderColor: m.role === "user" ? "hsl(240 8% 10%)" : "hsl(262 30% 14%)",
                  background: m.role === "user"
                    ? "hsl(240 8% 5%)"
                    : "linear-gradient(135deg, hsl(262 30% 6%) 0%, hsl(240 8% 6%) 100%)",
                  marginBottom: m.reasoning_path && m.reasoning_path.length > 0 ? 8 : 0,
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700,
                    background: m.role === "user"
                      ? "hsl(220 8% 15%)"
                      : "linear-gradient(135deg, hsl(262 83% 50%), hsl(300 70% 45%))",
                    color: m.role === "user" ? "hsl(220 8% 60%)" : "white",
                    boxShadow: m.role === "assistant" ? "0 2px 12px hsl(262 83% 30% / 0.4)" : "none",
                  }}>
                    {m.role === "user" ? <User style={{ width: 16, height: 16 }} /> : "M"}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", color: "hsl(220 8% 35%)", textTransform: "uppercase", marginBottom: 10 }}>
                      {m.role === "user" ? "Researcher" : "MEDICA Intelligence"}
                    </div>
                    <ClinicalTextRenderer text={m.content} />
                  </div>
                </div>

                {/* Reasoning path */}
                {m.role === "assistant" && m.reasoning_path && m.reasoning_path.length > 0 && (
                  <ReasoningLogsVisualizer steps={m.reasoning_path} />
                )}
              </div>
            ))}

            {/* LIVE STREAMING */}
            {isStreaming && (
              <div style={{ marginTop: 8 }}>
                {/* Live reasoning */}
                {currentReasoning.length > 0 && (
                  <div style={{
                    padding: 16, borderRadius: 12, marginBottom: 12,
                    border: "1px solid hsl(262 50% 20%)",
                    background: "hsl(262 50% 6%)",
                  }}>
                    <button
                      onClick={() => setActiveReasoningOpen(!activeReasoningOpen)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        width: "100%", background: "none", border: "none", cursor: "pointer",
                        marginBottom: 8,
                        fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                        color: "hsl(262 83% 70%)",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Terminal style={{ width: 12, height: 12 }} />
                        REASONING LOOP · {currentReasoning.length} STEPS
                      </span>
                      {activeReasoningOpen ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />}
                    </button>

                    {activeReasoningOpen && (
                      <div style={{ paddingLeft: 12, borderLeft: "2px solid hsl(262 50% 22%)", maxHeight: 280, overflowY: "auto" }}>
                        {currentReasoning.map((step, sIdx) => (
                          <div key={sIdx} style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>
                            {step.type === "thought" && (
                              <div style={{ color: "hsl(262 83% 72%)" }}>
                                <span style={{ color: "hsl(262 50% 50%)" }}>→ Thought:</span> {step.content}
                              </div>
                            )}
                            {step.type === "call" && (
                              <div style={{ color: "hsl(38 90% 60%)" }}>
                                <span style={{ color: "hsl(38 80% 48%)" }}>⚡ Action:</span> {step.content}
                              </div>
                            )}
                            {step.type === "observation" && (
                              <details style={{ color: "hsl(220 8% 40%)" }}>
                                <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 6 }}>
                                  <span>📊 Observation (expand)</span>
                                  <ChevronDown style={{ width: 10, height: 10 }} />
                                </summary>
                                <pre style={{
                                  marginTop: 6, padding: "8px 10px", borderRadius: 6,
                                  background: "hsl(240 10% 4%)", border: "1px solid hsl(240 8% 10%)",
                                  fontSize: 10, color: "hsl(220 8% 45%)",
                                  overflowX: "auto", whiteSpace: "pre-wrap", maxHeight: 180, overflowY: "auto",
                                }}>
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

                {/* Streaming content */}
                {currentAnswer && (
                  <div style={{
                    display: "flex", gap: 14, padding: "18px 20px", borderRadius: 14,
                    border: "1px solid hsl(262 30% 14%)",
                    background: "linear-gradient(135deg, hsl(262 30% 6%), hsl(240 8% 6%))",
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                      background: "linear-gradient(135deg, hsl(262 83% 50%), hsl(300 70% 45%))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, color: "white",
                      boxShadow: "0 2px 12px hsl(262 83% 30% / 0.4)",
                    }}>M</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", color: "hsl(262 83% 60%)", textTransform: "uppercase", marginBottom: 10 }}>
                        MEDICA · Streaming...
                      </div>
                      <ClinicalTextRenderer text={currentAnswer} />
                    </div>
                  </div>
                )}

                {/* Thinking dots */}
                {!currentAnswer && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 48, marginTop: 8 }}>
                    <div style={{ display: "flex", gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "hsl(262 83% 65%)" }} className="dot-bounce" />
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "hsl(262 83% 65%)" }} className="dot-bounce" />
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "hsl(262 83% 65%)" }} className="dot-bounce" />
                    </div>
                    <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "hsl(262 83% 60%)" }}>Agent in thought loop...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input footer */}
      <footer style={{
        padding: "16px 32px 24px",
        borderTop: "1px solid hsl(240 8% 9%)",
        background: "hsl(240 10% 3%)",
        flexShrink: 0,
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto", position: "relative" }}>
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
            style={{
              width: "100%", paddingLeft: 20, paddingRight: 60, paddingTop: 14, paddingBottom: 14,
              borderRadius: 14, resize: "none",
              border: "1px solid hsl(240 8% 14%)",
              background: "hsl(240 10% 5%)",
              color: "hsl(220 20% 90%)", fontSize: 13, lineHeight: 1.5,
              outline: "none", minHeight: 52,
              transition: "border-color 0.15s ease",
            }}
            onFocus={(e) => (e.target.style.borderColor = "hsl(262 50% 35%)")}
            onBlur={(e) => (e.target.style.borderColor = "hsl(240 8% 14%)")}
          />
          <button
            onClick={() => handleSend(input)}
            disabled={isStreaming || !input.trim()}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              width: 38, height: 38, borderRadius: 10, cursor: isStreaming || !input.trim() ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "none",
              background: isStreaming || !input.trim()
                ? "hsl(240 8% 12%)"
                : "linear-gradient(135deg, hsl(262 83% 55%), hsl(300 70% 50%))",
              color: isStreaming || !input.trim() ? "hsl(220 8% 35%)" : "white",
              boxShadow: !isStreaming && input.trim() ? "0 4px 16px hsl(262 83% 40% / 0.35)" : "none",
              transition: "all 0.15s ease",
            }}
            title="Send"
          >
            <Send style={{ width: 15, height: 15 }} />
          </button>
        </div>
      </footer>
      <style>{`@keyframes pulse-glow { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}

// ============================================================
// CLOSED REASONING LOGS COLLAPSIBLE VISUALIZER
// ============================================================
function ReasoningLogsVisualizer({ steps }: { steps: ReasoningStep[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{
      maxWidth: 760, margin: "0 auto",
      paddingLeft: 14, borderLeft: "2px solid hsl(240 8% 10%)",
    }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "none", border: "none", cursor: "pointer",
          fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
          color: "hsl(220 8% 32%)",
          transition: "color 0.15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "hsl(262 83% 65%)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "hsl(220 8% 32%)")}
      >
        <Terminal style={{ width: 11, height: 11 }} />
        REACTION TRACE · {steps.length} STEPS
        {isOpen ? <ChevronUp style={{ width: 11, height: 11 }} /> : <ChevronDown style={{ width: 11, height: 11 }} />}
      </button>

      {isOpen && (
        <div style={{ marginTop: 8, paddingLeft: 8, borderLeft: "1px solid hsl(240 8% 10%)" }}>
          {steps.map((step, idx) => (
            <div key={idx} style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginBottom: 5 }}>
              {step.type === "thought" && (
                <div style={{ color: "hsl(220 8% 42%)" }}>
                  <span style={{ color: "hsl(262 50% 50%)" }}>→ Thought:</span> {step.content}
                </div>
              )}
              {step.type === "call" && (
                <div style={{ color: "hsl(38 90% 55%)" }}>
                  <span style={{ color: "hsl(38 80% 45%)" }}>⚡ Action:</span> {step.content}
                </div>
              )}
              {step.type === "observation" && (
                <details style={{ color: "hsl(220 8% 35%)" }}>
                  <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>📊 Observation</span>
                    <ChevronDown style={{ width: 10, height: 10 }} />
                  </summary>
                  <pre style={{
                    marginTop: 4, padding: "6px 8px", borderRadius: 6,
                    background: "hsl(240 10% 4%)", border: "1px solid hsl(240 8% 9%)",
                    fontSize: 10, color: "hsl(220 8% 40%)",
                    overflowX: "auto", whiteSpace: "pre-wrap", maxHeight: 160, overflowY: "auto",
                  }}>
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
