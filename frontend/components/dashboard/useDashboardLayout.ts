import { useState, useEffect, useCallback } from "react";
import { Layout } from "react-grid-layout";
import { DashboardLayoutData, WidgetConfig } from "./types";
import { WIDGET_REGISTRY } from "./WidgetRegistry";

const STORAGE_KEY = "mdc_dashboard_layout";

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "kpis-1", type: "summary_kpis", title: "Summary KPIs", visible: true },
  { id: "evidence-1", type: "evidence_dist", title: "Evidence Distribution", visible: true },
  { id: "summary-1", type: "system_summary", title: "System Summary", visible: true },
  { id: "lit-1", type: "latest_literature", title: "New Papers & Guidelines", visible: true, config: { limit: 50 } },
  { id: "insight-1", type: "insight_preview", title: "Clinical Insight Preview", visible: true },
  { id: "news-1", type: "topic_news", title: "Topic-Specific Feed", visible: true },
  { id: "graph-1", type: "graph_preview", title: "Knowledge Base Preview", visible: true },
  { id: "ingest-1", type: "ingestion_console", title: "Ingestion Console", visible: true, config: { limit: 10 } }
];

const DEFAULT_LAYOUTS: any = {
  lg: [
    { i: "kpis-1", x: 0, y: 0, w: 12, h: 4 },
    { i: "evidence-1", x: 0, y: 4, w: 8, h: 8 },
    { i: "summary-1", x: 8, y: 4, w: 4, h: 8 },
    { i: "lit-1", x: 0, y: 12, w: 6, h: 14 },
    { i: "insight-1", x: 6, y: 12, w: 6, h: 14 },
    { i: "news-1", x: 0, y: 26, w: 4, h: 10 },
    { i: "graph-1", x: 4, y: 26, w: 4, h: 10 },
    { i: "ingest-1", x: 8, y: 26, w: 4, h: 10 }
  ]
};

export function useDashboardLayout() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [layouts, setLayouts] = useState<{ [key: string]: any[] }>({});
  
  // Load initial data
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as DashboardLayoutData;
        // Verify types exist in registry
        const validWidgets = parsed.widgets.filter(w => WIDGET_REGISTRY[w.type]);
        setWidgets(validWidgets);
        setLayouts(parsed.layouts || DEFAULT_LAYOUTS);
      } else {
        setWidgets(DEFAULT_WIDGETS);
        setLayouts(DEFAULT_LAYOUTS);
      }
    } catch (e) {
      console.error("Failed to load dashboard layout", e);
      setWidgets(DEFAULT_WIDGETS);
      setLayouts(DEFAULT_LAYOUTS);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save to local storage whenever widgets or layouts change
  useEffect(() => {
    if (!isLoaded) return;
    
    const data: DashboardLayoutData = {
      widgets,
      layouts: layouts as any
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [widgets, layouts, isLoaded]);

  const onLayoutChange = useCallback((currentLayout: any[], allLayouts: { [key: string]: any[] }) => {
    setLayouts(allLayouts);
  }, []);

  const addWidget = useCallback((type: string) => {
    const def = WIDGET_REGISTRY[type];
    if (!def) return;
    
    const newId = `${type}-${Date.now()}`;
    const newWidget: WidgetConfig = {
      id: newId,
      type,
      title: def.name,
      visible: true,
      config: {}
    };
    
    setWidgets(prev => [...prev, newWidget]);
    
    // Add to all layouts at the bottom
    setLayouts(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(bp => {
        // Find max Y to place at bottom
        const maxY = next[bp].reduce((max: number, l: any) => Math.max(max, l.y + l.h), 0);
        next[bp] = [
          ...next[bp],
          { i: newId, x: 0, y: maxY, w: def.defaultSize.w, h: def.defaultSize.h }
        ];
      });
      // Ensure lg layout exists
      if (!next.lg) {
        next.lg = [{ i: newId, x: 0, y: 0, w: def.defaultSize.w, h: def.defaultSize.h }];
      }
      return next;
    });
  }, []);

  const removeWidget = useCallback((id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
    setLayouts(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(bp => {
        next[bp] = next[bp].filter(l => l.i !== id);
      });
      return next;
    });
  }, []);

  const toggleWidgetVisibility = useCallback((id: string) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  }, []);

  const duplicateWidget = useCallback((id: string) => {
    const existing = widgets.find(w => w.id === id);
    if (!existing) return;
    
    const newId = `${existing.type}-${Date.now()}`;
    const newWidget = { ...existing, id: newId, title: `${existing.title} (Copy)` };
    
    setWidgets(prev => [...prev, newWidget]);
    
    // Copy layout sizing but place at bottom
    setLayouts(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(bp => {
        const maxY = next[bp].reduce((max: number, l: any) => Math.max(max, l.y + l.h), 0);
        const existingLayout = next[bp].find(l => l.i === id);
        
        next[bp] = [
          ...next[bp],
          { 
            i: newId, 
            x: 0, 
            y: maxY, 
            w: existingLayout ? existingLayout.w : WIDGET_REGISTRY[existing.type].defaultSize.w, 
            h: existingLayout ? existingLayout.h : WIDGET_REGISTRY[existing.type].defaultSize.h 
          }
        ];
      });
      return next;
    });
  }, [widgets]);

  const updateWidgetConfig = useCallback((id: string, configUpdates: any) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, ...configUpdates } : w));
  }, []);

  const resetLayout = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
    setLayouts(DEFAULT_LAYOUTS);
  }, []);

  return {
    isLoaded,
    widgets,
    layouts,
    onLayoutChange,
    addWidget,
    removeWidget,
    toggleWidgetVisibility,
    duplicateWidget,
    updateWidgetConfig,
    resetLayout
  };
}
