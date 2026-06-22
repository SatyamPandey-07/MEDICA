import React, { createContext, useContext } from 'react';
import { VerificationStats, VerificationPaper, GraphStats, IngestionJob } from '@/lib/types';

export interface DashboardContextState {
  stats: VerificationStats | null;
  papers: VerificationPaper[];
  graphStats: GraphStats | null;
  jobs: IngestionJob[];
  selectedPaper: VerificationPaper | null;
  setSelectedPaper: (p: VerificationPaper | null) => void;
  activeTab: "all" | "guideline" | "paper";
  setActiveTab: (t: "all" | "guideline" | "paper") => void;
  selectedTopic: string;
  setSelectedTopic: (t: string) => void;
  minConfidence: number;
  setMinConfidence: (c: number) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isExpertMode: boolean;
  topicPapers: VerificationPaper[];
  filteredPapers: VerificationPaper[];
  totalGuidelines: number;
  runningJobs: IngestionJob[];
  recentNewPapers: VerificationPaper[];
  dynamicAvgConfidence: number;
  dynamicStatusDistribution: { verified: number; disputed: number; pending: number };
  evidenceDist: Record<string, number>;
  fetchData: (silent?: boolean) => Promise<void>;
  addToast: (t: { type: "success" | "info" | "warning"; title: string; message: string }) => void;
}

const DashboardContext = createContext<DashboardContextState | undefined>(undefined);

export const DashboardProvider: React.FC<{ value: DashboardContextState; children: React.ReactNode }> = ({ value, children }) => {
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
};

export const useDashboardContext = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboardContext must be used within a DashboardProvider');
  }
  return context;
};
