import { 
  BarChart3, BookOpen, Compass, Database, FileText, 
  GitBranch, HeartPulse, Newspaper, ShieldCheck, Star, 
  TriangleAlert, Activity, Zap 
} from "lucide-react";
import { WidgetDefinition } from "./types";
import { SummaryKPIsWidget } from "./widgets/SummaryKPIsWidget";
import { EvidenceDistWidget } from "./widgets/EvidenceDistWidget";
import { LatestLiteratureWidget } from "./widgets/LatestLiteratureWidget";
import { InsightPreviewWidget } from "./widgets/InsightPreviewWidget";
import { TopicNewsWidget } from "./widgets/TopicNewsWidget";
import { GraphPreviewWidget } from "./widgets/GraphPreviewWidget";
import { IngestionConsoleWidget } from "./widgets/IngestionConsoleWidget";
import { SystemSummaryWidget } from "./widgets/SystemSummaryWidget";

export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  summary_kpis: {
    type: "summary_kpis",
    name: "Summary KPIs",
    icon: BarChart3,
    component: SummaryKPIsWidget,
    defaultSize: { w: 12, h: 4 },
    minSize: { w: 6, h: 4 },
  },
  evidence_dist: {
    type: "evidence_dist",
    name: "Evidence Distribution",
    icon: BarChart3,
    component: EvidenceDistWidget,
    defaultSize: { w: 6, h: 8 },
    minSize: { w: 4, h: 6 },
  },
  system_summary: {
    type: "system_summary",
    name: "System Summary",
    icon: Star,
    component: SystemSummaryWidget,
    defaultSize: { w: 6, h: 6 },
    minSize: { w: 4, h: 4 },
  },
  latest_literature: {
    type: "latest_literature",
    name: "New Papers & Guidelines",
    icon: Newspaper,
    component: LatestLiteratureWidget,
    defaultSize: { w: 6, h: 12 },
    minSize: { w: 4, h: 8 },
  },
  insight_preview: {
    type: "insight_preview",
    name: "Clinical Insight Preview",
    icon: Compass,
    component: InsightPreviewWidget,
    defaultSize: { w: 6, h: 12 },
    minSize: { w: 4, h: 8 },
  },
  topic_news: {
    type: "topic_news",
    name: "Topic-Specific Feed",
    icon: HeartPulse,
    component: TopicNewsWidget,
    defaultSize: { w: 4, h: 10 },
    minSize: { w: 3, h: 6 },
  },
  graph_preview: {
    type: "graph_preview",
    name: "Knowledge Base Preview",
    icon: Database,
    component: GraphPreviewWidget,
    defaultSize: { w: 4, h: 10 },
    minSize: { w: 3, h: 6 },
  },
  ingestion_console: {
    type: "ingestion_console",
    name: "Ingestion Console",
    icon: Zap,
    component: IngestionConsoleWidget,
    defaultSize: { w: 4, h: 10 },
    minSize: { w: 3, h: 6 },
  }
};
