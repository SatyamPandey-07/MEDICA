/**
 * MEDICA TypeScript Type Definitions
 * Mirrors backend Pydantic models for full type safety.
 */

export type DataSource = "pubmed" | "crossref" | "semantic_scholar";

export type EvidenceLevel =
  | "meta_analysis"
  | "systematic_review"
  | "rct"
  | "cohort"
  | "case_control"
  | "case_series"
  | "expert_opinion"
  | "preclinical"
  | "unknown";

export type StudyType =
  | "meta_analysis"
  | "systematic_review"
  | "clinical_trial"
  | "observational"
  | "case_study"
  | "review"
  | "preclinical"
  | "editorial"
  | "other";

export type TrialPhase = "phase_1" | "phase_2" | "phase_3" | "phase_4" | "n/a";

export type VerificationStatus = "verified" | "unverified" | "disputed" | "pending";

export interface PaperTags {
  cancer: string[];
  treatment: string[];
  biomarkers: string[];
  drugs: string[];
  evidence: string[];
  outcomes: string[];
  study_type: string[];
  temporal: string[];
  system: string[];
}

export interface PaperMetadata {
  id: string;
  title: string;
  pmid?: string | null;
  doi?: string | null;
  journal?: string | null;
  published?: string | null; // ISO Date String
  authors: string[];
  source: DataSource;
  verification_status: VerificationStatus;
  confidence_score: number;
  evidence_level: EvidenceLevel;
  study_type: StudyType;
  trial_phase?: TrialPhase | null;
  tags?: PaperTags;
  linked_entities: string[];
  related_papers: string[];
  contradictory_papers: string[];
  citation_count: number;
  abstract?: string | null;
  keywords: string[];
  adversarial_review?: string | null;
  knowledge_path?: string | null;
}

export type KnowledgePaper = PaperMetadata;

export interface RetrievalResult {
  score: number;
  strategy: string;
  paper: PaperMetadata;
  snippet?: string | null;
}

export interface ReasoningStep {
  type: "thought" | "call" | "observation";
  content: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  reasoning_path?: ReasoningStep[];
}

export interface ChatSession {
  id: string;
  title: string;
  updated_at: string;
  messages_count: number;
}

export interface IngestionJob {
  id: string;
  job_name: string;
  source: string;
  query: string;
  status: "pending" | "running" | "done" | "failed";
  fetched: number;
  processed: number;
  failed: number;
  error_message?: string | null;
  expanded_terms?: string[];
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface VerificationStats {
  total_papers: number;
  average_confidence_score: number;
  status_distribution: {
    verified: number;
    unverified: number;
    disputed: number;
    pending: number;
  };
  evidence_level_distribution: Record<string, number>;
}

export interface VerificationPaper {
  id: string;
  title: string;
  pmid?: string;
  doi?: string;
  journal?: string;
  published?: string;
  verification_status: VerificationStatus;
  confidence_score: number;
  evidence_level: EvidenceLevel;
  flags: string[];
  tags?: PaperTags;
}

export interface GraphNetworkNode {
  id: string;
  label: string;
  type: string;
  papers_count: number;
}

export interface GraphNetworkEdge {
  source: string;
  target: string;
}

export interface GraphNetwork {
  nodes: GraphNetworkNode[];
  edges: GraphNetworkEdge[];
}

export interface GraphStats {
  total_nodes: number;
  total_edges: number;
  cancer_nodes: number;
  drug_nodes: number;
  biomarker_nodes: number;
}

export interface GraphRebuildResult extends GraphStats {
  status: string;
  papers_processed: number;
  nodes: number;
  edges: number;
}
