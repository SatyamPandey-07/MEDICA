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
    '<a href="https://doi.org/$1" target="_blank" rel="noopener noreferrer" style="padding:2px 6px;border:2px solid #000000;background:#FFF;border-radius:6px;font-size:11px;font-family:monospace;color:#000;text-decoration:none;display:inline-flex;align-items:center;gap:4px">🔗 DOI: $1</a>'
  );

  // Split into paragraphs / lines
  const lines = formatted.split("\n");

  return (
    <div style={{ lineHeight: 1.8, fontSize: 13, color: "#111111" }}>
      {lines.map((line, lineIdx) => {
        let trimmed = line.trim();

        if (!trimmed) return <div key={lineIdx} style={{ height: 8 }} />;

        // Header Check
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={lineIdx} style={{ fontSize: 14, fontWeight: 800, color: "#000000", marginTop: 16, marginBottom: 8 }}>
              {trimmed.replace("### ", "")}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={lineIdx} style={{ fontSize: 16, fontWeight: 800, color: "#000000", marginTop: 20, marginBottom: 8, borderBottom: "3px solid #000000", paddingBottom: 4 }}>
              {trimmed.replace("## ", "")}
            </h3>
          );
        }

        // Bullet Check
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const content = trimmed.substring(2);
          return (
            <ul key={lineIdx} style={{ paddingLeft: 20, margin: "4px 0" }}>
              <li dangerouslySetInnerHTML={{ __html: parseInlineStyles(content) }} />
            </ul>
          );
        }

        // Standard Paragraph
        return (
          <p
            key={lineIdx}
            style={{ margin: "4px 0" }}
            dangerouslySetInnerHTML={{ __html: parseInlineStyles(trimmed) }}
          />
        );
      })}
    </div>
  );
}

function parseInlineStyles(htmlText: string): string {
  // Bold **text**
  let parsed = htmlText.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:800;color:#000000">$1</strong>');
  // Inline code `code`
  parsed = parsed.replace(/`(.*?)`/g, '<code style="padding:1px 6px;font-family:monospace;color:#5B21B6;font-size:11px;background:#EDE9FE;border:1px solid #000000;border-radius:4px">$1</code>');
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
      <div style={{ flex: 1, overflowY: "auto", padding: "40px 52px" }}>
        {messages.length === 0 && !currentAnswer && !isStreaming ? (
          /* Welcome Screen */
          <div style={{ maxWidth: 680, margin: "0 auto", paddingTop: 40 }}>
            {/* Hero */}
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 64, height: 64, borderRadius: 20, marginBottom: 24,
                background: "#FFE57F",
                border: "3px solid #000000",
                boxShadow: "6px 6px 0px #000000",
              }}>
                <Activity style={{ width: 28, height: 28, color: "#000000" }} />
              </div>
              <h1 style={{
                fontSize: 32, fontWeight: 800, marginBottom: 14, letterSpacing: "-0.03em",
                color: "#000000", lineHeight: 1.2,
              }}>
                Welcome to MEDICA Intelligence
              </h1>
              <p style={{ fontSize: 14, color: "#555555", lineHeight: 1.7, maxWidth: 460, margin: "0 auto", fontWeight: 500 }}>
                An autonomous oncology research system powered by <strong style={{ color: "#7C3AED" }}>Llama 3.3 70B on Groq</strong>.
                Query trials, verify claims, and cross-link clinical evidence.
              </p>
            </div>

            {/* Suggestion cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(s)}
                  style={{
                    padding: "22px 24px", borderRadius: 20, cursor: "pointer",
                    border: "3px solid #000000",
                    background: "#FFFFFF",
                    textAlign: "left", display: "flex", flexDirection: "column",
                    justifyContent: "space-between", minHeight: 120,
                    boxShadow: "5px 5px 0px #000000",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#FAF8F5";
                    e.currentTarget.style.transform = "translate(-2px,-2px)";
                    e.currentTarget.style.boxShadow = "7px 7px 0px #000000";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#FFFFFF";
                    e.currentTarget.style.transform = "";
                    e.currentTarget.style.boxShadow = "5px 5px 0px #000000";
                  }}
                >
                  <span style={{ fontSize: 13, color: "#111111", lineHeight: 1.6, fontWeight: 600, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {s}
                  </span>
                  <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#7C3AED", marginTop: 14, fontWeight: 700 }}>
                    SUBMIT QUERY →
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
                  display: "flex", gap: 16, padding: "24px 28px", borderRadius: 20,
                  border: "3px solid #000000",
                  background: m.role === "user" ? "#FAF8F5" : "#FFFFFF",
                  boxShadow: "5px 5px 0px #000000",
                  marginBottom: m.reasoning_path && m.reasoning_path.length > 0 ? 12 : 0,
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 800,
                    background: m.role === "user" ? "#E5E7EB" : "#FFE57F",
                    color: "#000000",
                    border: "2px solid #000000",
                  }}>
                    {m.role === "user" ? <User style={{ width: 16, height: 16 }} /> : "M"}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", color: "#888888", textTransform: "uppercase", marginBottom: 10, fontWeight: 700 }}>
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
                    padding: 16, borderRadius: 16, marginBottom: 12,
                    border: "3px solid #000000",
                    background: "#EDE9FE",
                    boxShadow: "4px 4px 0px #000000",
                  }}>
                    <button
                      data-icon-btn
                      onClick={() => setActiveReasoningOpen(!activeReasoningOpen)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        width: "100%", background: "none", border: "none", cursor: "pointer",
                        marginBottom: 8,
                        fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                        color: "#000000", fontWeight: 800,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Terminal style={{ width: 12, height: 12 }} />
                        REASONING LOOP · {currentReasoning.length} STEPS
                      </span>
                      {activeReasoningOpen ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />}
                    </button>

                    {activeReasoningOpen && (
                      <div style={{ paddingLeft: 12, borderLeft: "3px solid #000000", maxHeight: 280, overflowY: "auto" }}>
                        {currentReasoning.map((step, sIdx) => (
                          <div key={sIdx} style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>
                            {step.type === "thought" && (
                              <div style={{ color: "#5B21B6", fontWeight: 600 }}>
                                <span style={{ color: "#7C3AED", fontWeight: 800 }}>→ Thought:</span> {step.content}
                              </div>
                            )}
                            {step.type === "call" && (
                              <div style={{ color: "#B45309", fontWeight: 600 }}>
                                <span style={{ color: "#D97706", fontWeight: 800 }}>⚡ Action:</span> {step.content}
                              </div>
                            )}
                            {step.type === "observation" && (
                              <details style={{ color: "#555555" }}>
                                <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                                  <span>📊 Observation (expand)</span>
                                  <ChevronDown style={{ width: 10, height: 10 }} />
                                </summary>
                                <pre style={{
                                  marginTop: 6, padding: "8px 10px", borderRadius: 6,
                                  background: "#FFFFFF", border: "2px solid #000000",
                                  fontSize: 10, color: "#333333",
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
                    display: "flex", gap: 16, padding: "24px 28px", borderRadius: 20,
                    border: "3px solid #000000",
                    background: "#FFFFFF",
                    boxShadow: "5px 5px 0px #000000",
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: "#FFE57F",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 800, color: "#000000",
                      border: "2px solid #000000",
                    }}>M</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", color: "#7C3AED", textTransform: "uppercase", marginBottom: 10, fontWeight: 800 }}>
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
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7C3AED", border: "2px solid #000" }} className="dot-bounce" />
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7C3AED", border: "2px solid #000" }} className="dot-bounce" />
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7C3AED", border: "2px solid #000" }} className="dot-bounce" />
                    </div>
                    <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#7C3AED", fontWeight: 700 }}>Agent in thought loop...</span>
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
        padding: "20px 40px 28px",
        borderTop: "3px solid #000000",
        background: "#FAF8F5",
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
              width: "100%", paddingLeft: 20, paddingRight: 68, paddingTop: 14, paddingBottom: 14,
              borderRadius: 14, resize: "none",
              border: "3px solid #000000",
              background: "#FFFFFF",
              color: "#000000", fontSize: 13, lineHeight: 1.5,
              outline: "none", minHeight: 52,
              boxShadow: "4px 4px 0px #000000",
              transition: "box-shadow 0.15s ease",
            }}
          />
          <button
            onClick={() => handleSend(input)}
            disabled={isStreaming || !input.trim()}
            data-icon-btn
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              width: 42, height: 42, borderRadius: 12,
              cursor: isStreaming || !input.trim() ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "3px solid #000000",
              background: isStreaming || !input.trim() ? "#E5E7EB" : "#FFE57F",
              color: "#000000",
              boxShadow: !isStreaming && input.trim() ? "3px 3px 0px #000000" : "none",
              transition: "all 0.15s ease",
            }}
            title="Send"
          >
            <Send style={{ width: 16, height: 16 }} />
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
      paddingLeft: 14, borderLeft: "3px solid #000000",
      marginTop: 8,
    }}>
      <button
        data-icon-btn
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "none", border: "none", cursor: "pointer",
          fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
          color: "#555555", fontWeight: 700,
          transition: "color 0.15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#7C3AED")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#555555")}
      >
        <Terminal style={{ width: 11, height: 11 }} />
        REACTION TRACE · {steps.length} STEPS
        {isOpen ? <ChevronUp style={{ width: 11, height: 11 }} /> : <ChevronDown style={{ width: 11, height: 11 }} />}
      </button>

      {isOpen && (
        <div style={{ marginTop: 8, paddingLeft: 8, borderLeft: "2px solid #000000" }}>
          {steps.map((step, idx) => (
            <div key={idx} style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginBottom: 5 }}>
              {step.type === "thought" && (
                <div style={{ color: "#5B21B6", fontWeight: 600 }}>
                  <span style={{ color: "#7C3AED", fontWeight: 800 }}>→ Thought:</span> {step.content}
                </div>
              )}
              {step.type === "call" && (
                <div style={{ color: "#B45309", fontWeight: 600 }}>
                  <span style={{ color: "#D97706", fontWeight: 800 }}>⚡ Action:</span> {step.content}
                </div>
              )}
              {step.type === "observation" && (
                <details style={{ color: "#555555" }}>
                  <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                    <span>📊 Observation</span>
                    <ChevronDown style={{ width: 10, height: 10 }} />
                  </summary>
                  <pre style={{
                    marginTop: 4, padding: "8px 10px", borderRadius: 6,
                    background: "#FFFFFF", border: "2px solid #000000",
                    fontSize: 10, color: "#333333",
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
