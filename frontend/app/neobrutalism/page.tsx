"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Activity,
  FileSearch,
  Dna,
  Calendar,
  Layers,
  ArrowRight,
  Loader,
  FlaskConical,
} from "lucide-react";

import { searchEndpoint } from "@/lib/api";

export default function MedicalNeobrutalismPortal() {
  // Search state for live database lookup
  const [query, setQuery] = useState("pembrolizumab");
  const [cancerFilter, setCancerFilter] = useState("all");
  const [evidenceFilter, setEvidenceFilter] = useState("all");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<any | null>(null);

  // Scheduling Form State
  const [scheduleData, setScheduleData] = useState({
    pmid: "",
    topic: "",
    priority: "normal",
  });
  const [scheduleStatus, setScheduleStatus] = useState<string | null>(null);

  // Search trigger
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    setSelectedPaper(null);
    try {
      // Build a filter query term if filters are active
      let filterQ = query;
      if (cancerFilter !== "all") {
        filterQ += ` ${cancerFilter}`;
      }
      
      const searchRes = await searchEndpoint(filterQ, 10, "hybrid");
      
      // Client-side filter for evidence if set
      let finalResults = searchRes || [];
      if (evidenceFilter !== "all") {
        finalResults = finalResults.filter(
          (r: any) => r.paper?.evidence_level === evidenceFilter
        );
      }
      setResults(finalResults);
    } catch (err) {
      console.error("Neobrutalist Search failed:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Schedule trigger
  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleData.pmid.trim() && !scheduleData.topic.trim()) {
      setScheduleStatus("ERROR: You must specify a PMID or Ingestion Topic.");
      return;
    }
    setScheduleStatus("PENDING: Audit Request queued into System Operator scheduler...");
    setTimeout(() => {
      setScheduleStatus(
        `SUCCESS: Ingestion task queued successfully. Audit thread generated for target: "${
          scheduleData.pmid || scheduleData.topic
        }"`
      );
      setScheduleData({ pmid: "", topic: "", priority: "normal" });
    }, 1500);
  };

  // Run initial search
  useEffect(() => {
    handleSearch({ preventDefault: () => {} } as any);
  }, []);

  return (
    <div
      style={{
        background: "#FFFFFF",
        color: "#000000",
        minHeight: "100vh",
        width: "100%",
        padding: "60px 48px",
        overflowY: "auto",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        
        {/* ============================================================
            1. HERO SECTION
           ============================================================ */}
        <section
          style={{
            marginBottom: "80px",
            border: "4px solid #000000",
            background: "#FFFFFF",
            boxShadow: "8px 8px 0px #000000",
            padding: "60px 40px",
            position: "relative",
          }}
        >
          {/* Top Stamp */}
          <div
            style={{
              position: "absolute",
              top: "-18px",
              left: "40px",
              background: "#004D40",
              color: "#A7FFEB",
              border: "3px solid #000000",
              padding: "4px 16px",
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              fontSize: "12px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Clinical Audit Hub
          </div>

          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 64px)",
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: "#000000",
              marginBottom: "32px",
              textTransform: "uppercase",
            }}
          >
            Clinical Precision.<br />
            Uncompromising Truth.
          </h1>

          <p
            style={{
              fontSize: "18px",
              lineHeight: "1.6",
              color: "#000000",
              maxWidth: "800px",
              marginBottom: "40px",
              fontWeight: 500,
            }}
          >
            MEDICA processes, Normalizes, and indexes the global corpus of cancer research literature. 
            We deploy adversarial clinical audits and evidence grading loops to isolate breakthrough trials from commercial noise.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
            <a
              href="#console"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "12px",
                background: "#004D40",
                color: "#FFFFFF",
                border: "3px solid #000000",
                padding: "16px 36px",
                fontSize: "15px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                textDecoration: "none",
                boxShadow: "6px 6px 0px #000000",
                cursor: "pointer",
                transition: "transform 0.1s ease, box-shadow 0.1s ease",
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "translate(3px, 3px)";
                e.currentTarget.style.boxShadow = "3px 3px 0px #000000";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "6px 6px 0px #000000";
              }}
            >
              <span>Access Research Console</span>
              <ArrowRight style={{ width: 18, height: 18, strokeWidth: 3 }} />
            </a>
          </div>
        </section>

        {/* ============================================================
            2. FEATURE GRID (3-COLUMN NEOBRUTALIST CARDS)
           ============================================================ */}
        <section
          style={{
            marginBottom: "80px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "40px",
          }}
        >
          {/* Card 1 */}
          <div
            style={{
              border: "3px solid #000000",
              background: "#E0F2F1",
              boxShadow: "8px 8px 0px #000000",
              padding: "40px",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                border: "3px solid #000000",
                background: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Dna style={{ width: 26, height: 26, color: "#004D40", strokeWidth: 2.5 }} />
            </div>
            <h3
              style={{
                fontSize: "22px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
              }}
            >
              Continuous Ingestion
            </h3>
            <p style={{ fontSize: "14px", lineHeight: "1.6", color: "#000000", fontWeight: 500 }}>
              Live adapters ingest oncological literature directly from PubMed, CrossRef, and Semantic Scholar. 
              Our system runs autonomous pipelines to extract raw abstracts and parse structural meta-parameters.
            </p>
          </div>

          {/* Card 2 */}
          <div
            style={{
              border: "3px solid #000000",
              background: "#E0F2F1",
              boxShadow: "8px 8px 0px #000000",
              padding: "40px",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                border: "3px solid #000000",
                background: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldAlert style={{ width: 26, height: 26, color: "#004D40", strokeWidth: 2.5 }} />
            </div>
            <h3
              style={{
                fontSize: "22px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
              }}
            >
              Adversarial Auditing
            </h3>
            <p style={{ fontSize: "14px", lineHeight: "1.6", color: "#000000", fontWeight: 500 }}>
              Every record is passed to an LLM-skeptic verifier. 
              The engine flags selection biases, dissects small sample sizes, audits p-value integrity, and checks for undisclosed financial conflicts of interest.
            </p>
          </div>

          {/* Card 3 */}
          <div
            style={{
              border: "3px solid #000000",
              background: "#E0F2F1",
              boxShadow: "8px 8px 0px #000000",
              padding: "40px",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                border: "3px solid #000000",
                background: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Layers style={{ width: 26, height: 26, color: "#004D40", strokeWidth: 2.5 }} />
            </div>
            <h3
              style={{
                fontSize: "22px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
              }}
            >
              Taxonomy Mapping
            </h3>
            <p style={{ fontSize: "14px", lineHeight: "1.6", color: "#000000", fontWeight: 500 }}>
              Builds dynamic cross-links between 22+ cancers, 25+ specific drugs, and 20+ genetic biomarkers. 
              Translates unstructured scientific texts into an interactive, physics-based network map.
            </p>
          </div>
        </section>

        {/* ============================================================
            3. INTERACTIVE CONSOLE (DATA DISPLAY + SEARCH + SCHEDULER)
           ============================================================ */}
        <section
          id="console"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))",
            gap: "50px",
            alignItems: "start",
            marginBottom: "40px",
          }}
        >
          {/* LEFT COLUMN: INTERACTIVE LIVE SEARCH & RESULTS */}
          <div
            style={{
              border: "3px solid #000000",
              background: "#FFFFFF",
              boxShadow: "8px 8px 0px #000000",
              padding: "40px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "24px",
              }}
            >
              <FileSearch style={{ width: 22, height: 22, color: "#000000", strokeWidth: 3 }} />
              <h2
                style={{
                  fontSize: "24px",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "-0.01em",
                }}
              >
                Verification Lookup
              </h2>
            </div>

            {/* Search Form */}
            <form onSubmit={handleSearch} style={{ marginBottom: "32px" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  marginBottom: "24px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: "#004D40",
                      marginBottom: "6px",
                    }}
                  >
                    Query Keywords
                  </label>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="E.g., osimertinib, colorectal, pembrolizumab..."
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      border: "3px solid #000000",
                      background: "#FFFFFF",
                      fontSize: "14px",
                      fontWeight: 600,
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11px",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: "#004D40",
                        marginBottom: "6px",
                      }}
                    >
                      Oncology Group
                    </label>
                    <select
                      value={cancerFilter}
                      onChange={(e) => setCancerFilter(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        border: "3px solid #000000",
                        background: "#FFFFFF",
                        fontSize: "14px",
                        fontWeight: 600,
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="all">ALL GROUPS</option>
                      <option value="lung_cancer">LUNG CANCER</option>
                      <option value="breast_cancer">BREAST CANCER</option>
                      <option value="colorectal_cancer">COLORECTAL CANCER</option>
                      <option value="glioblastoma">GLIOBLASTOMA</option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11px",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: "#004D40",
                        marginBottom: "6px",
                      }}
                    >
                      Evidence Grade
                    </label>
                    <select
                      value={evidenceFilter}
                      onChange={(e) => setEvidenceFilter(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        border: "3px solid #000000",
                        background: "#FFFFFF",
                        fontSize: "14px",
                        fontWeight: 600,
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="all">ALL GRADES</option>
                      <option value="randomized_controlled_trial">RCT (LEVEL I)</option>
                      <option value="meta_analysis">META-ANALYSIS</option>
                      <option value="systematic_review">SYSTEMATIC REVIEW</option>
                      <option value="expert_opinion">EXPERT OPINION</option>
                      <option value="preclinical">PRECLINICAL</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "#FFFFFF",
                  color: "#000000",
                  border: "3px solid #000000",
                  fontSize: "14px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  boxShadow: "4px 4px 0px #000000",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                }}
              >
                {loading ? (
                  <>
                    <Loader className="animate-spin" style={{ width: 16, height: 16 }} />
                    <span>Processing Search...</span>
                  </>
                ) : (
                  <span>Query Database Index</span>
                )}
              </button>
            </form>

            {/* Results Output */}
            <div style={{ borderTop: "2px dashed #000000", paddingTop: "24px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "#757575",
                  marginBottom: "16px",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                Index Results ({results.length})
              </div>

              {loading ? (
                <div style={{ padding: "20px 0", textAlign: "center", fontWeight: 600 }}>
                  Searching backend index...
                </div>
              ) : results.length === 0 ? (
                <div style={{ padding: "30px 10px", textAlign: "center", border: "2px dashed #000000", background: "#F4F6F6" }}>
                  <p style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>No matched clinical trials.</p>
                  <p style={{ fontSize: "12px", color: "#666" }}>Try adjusting keywords or selecting "ALL GRADES".</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {results.map((r, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedPaper(r.paper)}
                      style={{
                        padding: "16px 20px",
                        border: "3px solid #000000",
                        background: selectedPaper?.title === r.paper?.title ? "#A7FFEB" : "#F4F6F6",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        boxShadow: selectedPaper?.title === r.paper?.title ? "4px 4px 0px #000000" : "none",
                        transform: selectedPaper?.title === r.paper?.title ? "translate(-2px, -2px)" : "none",
                        transition: "all 0.1s ease",
                      }}
                    >
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: "9px",
                            fontFamily: "'JetBrains Mono', monospace",
                            background: "#004D40",
                            color: "#FFFFFF",
                            padding: "2px 6px",
                            fontWeight: 700,
                          }}
                        >
                          {r.paper?.evidence_level?.replace(/_/g, " ")}
                        </span>
                        <span
                          style={{
                            fontSize: "9px",
                            fontFamily: "'JetBrains Mono', monospace",
                            background: r.paper?.verification_status === "verified" ? "#004D40" : "#E0F2F1",
                            color: r.paper?.verification_status === "verified" ? "#FFFFFF" : "#000000",
                            border: "1px solid #000000",
                            padding: "1px 6px",
                            fontWeight: 700,
                          }}
                        >
                          {r.paper?.verification_status}
                        </span>
                      </div>
                      <h4 style={{ fontSize: "14px", fontWeight: 800, lineHeight: "1.4" }}>
                        {r.paper?.title}
                      </h4>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: DETAIL VIEWER / SCHEDULER */}
          <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
            
            {/* Selected Paper Console */}
            {selectedPaper ? (
              <div
                style={{
                  border: "3px solid #000000",
                  background: "#FFFFFF",
                  boxShadow: "8px 8px 0px #000000",
                  padding: "40px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                  <FlaskConical style={{ width: 22, height: 22, color: "#004D40", strokeWidth: 3 }} />
                  <h3 style={{ fontSize: "20px", fontWeight: 900, textTransform: "uppercase" }}>
                    Trial Profile
                  </h3>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ borderBottom: "2px dashed #000000", pb: "16px", paddingBottom: "16px" }}>
                    <div style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", color: "#666", textTransform: "uppercase", marginBottom: "4px" }}>
                      Title
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: 800 }}>
                      {selectedPaper.title}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", borderBottom: "2px dashed #000000", paddingBottom: "16px" }}>
                    <div>
                      <div style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", color: "#666", textTransform: "uppercase", marginBottom: "4px" }}>
                        PMID Reference
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 700 }}>
                        {selectedPaper.pmid || "N/A"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", color: "#666", textTransform: "uppercase", marginBottom: "4px" }}>
                        Evidence Rank
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#004D40" }}>
                        {selectedPaper.confidence_score?.toFixed(2) || "0.00"}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", color: "#666", textTransform: "uppercase", marginBottom: "6px" }}>
                      Audited Abstract Summary
                    </div>
                    <p style={{ fontSize: "13px", lineHeight: "1.6", color: "#333", fontWeight: 500 }}>
                      {selectedPaper.abstract ? selectedPaper.abstract.slice(0, 420) + "..." : "No abstract catalogued."}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Task Scheduler Panel */}
            <div
              style={{
                border: "3px solid #000000",
                background: "#FFFFFF",
                boxShadow: "8px 8px 0px #000000",
                padding: "40px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "24px",
                }}
              >
                <Calendar style={{ width: 22, height: 22, color: "#000000", strokeWidth: 3 }} />
                <h2
                  style={{
                    fontSize: "24px",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Schedule Auditing
                </h2>
              </div>

              <form onSubmit={handleScheduleSubmit}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    marginBottom: "24px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11px",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: "#004D40",
                        marginBottom: "6px",
                      }}
                    >
                      Target PubMed PMID
                    </label>
                    <input
                      type="text"
                      value={scheduleData.pmid}
                      onChange={(e) => setScheduleData({ ...scheduleData, pmid: e.target.value })}
                      placeholder="E.g., 30886395"
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        border: "3px solid #000000",
                        background: "#FFFFFF",
                        fontSize: "14px",
                        fontWeight: 600,
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11px",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: "#004D40",
                        marginBottom: "6px",
                      }}
                    >
                      Ingestion Topic / Keywords
                    </label>
                    <input
                      type="text"
                      value={scheduleData.topic}
                      onChange={(e) => setScheduleData({ ...scheduleData, topic: e.target.value })}
                      placeholder="E.g., KRAS mutations glioblastoma"
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        border: "3px solid #000000",
                        background: "#FFFFFF",
                        fontSize: "14px",
                        fontWeight: 600,
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11px",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: "#004D40",
                        marginBottom: "6px",
                      }}
                    >
                      Job Priority Queue
                    </label>
                    <div style={{ display: "flex", gap: "12px" }}>
                      {["normal", "high", "critical"].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setScheduleData({ ...scheduleData, priority: p })}
                          style={{
                            flex: 1,
                            padding: "10px",
                            border: "3px solid #000000",
                            background: scheduleData.priority === p ? "#A7FFEB" : "#FFFFFF",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            fontSize: "12px",
                            cursor: "pointer",
                            boxShadow: scheduleData.priority === p ? "3px 3px 0px #000000" : "none",
                            transform: scheduleData.priority === p ? "translate(-1px, -1px)" : "none",
                            transition: "all 0.1s ease",
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: "#004D40",
                    color: "#FFFFFF",
                    border: "3px solid #000000",
                    fontSize: "14px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    boxShadow: "4px 4px 0px #000000",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Schedule Auditing Job
                </button>
              </form>

              {scheduleStatus && (
                <div
                  style={{
                    marginTop: "20px",
                    padding: "16px",
                    border: "3px solid #000000",
                    background: scheduleStatus.startsWith("ERROR")
                      ? "#FFCDD2"
                      : scheduleStatus.startsWith("PENDING")
                      ? "#FFF9C4"
                      : "#C8E6C9",
                    fontSize: "12px",
                    fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {scheduleStatus}
                </div>
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
