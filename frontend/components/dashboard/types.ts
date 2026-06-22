import React from "react";
import { Layout } from "react-grid-layout";

export interface WidgetConfig {
  id: string; // The instance ID
  type: string; // The widget definition ID
  title: string;
  visible: boolean;
  config?: any;
  lastUpdated?: string;
}

export interface DashboardLayoutData {
  widgets: WidgetConfig[];
  layouts: {
    lg: Layout[];
    md: Layout[];
    sm: Layout[];
    xs: Layout[];
    xxs: Layout[];
  };
}

export interface WidgetProps {
  instanceId: string;
  title: string;
  config?: any;
  isEditing?: boolean;
  onConfigChange?: (newConfig: any) => void;
  lastUpdated?: string;
}

export interface WidgetDefinition {
  type: string;
  name: string;
  icon: React.ElementType;
  component: React.ComponentType<WidgetProps>;
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
  maxSize?: { w: number; h: number };
}
