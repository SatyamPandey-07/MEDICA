import React, { useMemo, useState, useEffect, useRef } from "react";
import { Responsive } from "react-grid-layout";
import { WidgetConfig } from "./types";
import { WIDGET_REGISTRY } from "./WidgetRegistry";
import { WidgetContainer } from "./WidgetContainer";

interface DashboardLayoutProps {
  widgets: WidgetConfig[];
  layouts: any;
  onLayoutChange: (currentLayout: any, allLayouts: any) => void;
  isEditing: boolean;
  onRemoveWidget: (id: string) => void;
  onHideWidget: (id: string) => void;
  onDuplicateWidget: (id: string) => void;
  widgetTimestamps: Record<string, string>;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  widgets,
  layouts,
  onLayoutChange,
  isEditing,
  onRemoveWidget,
  onHideWidget,
  onDuplicateWidget,
  widgetTimestamps
}) => {
  const [width, setWidth] = useState(1200);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setWidth(width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Only render visible widgets
  const visibleWidgets = useMemo(() => widgets.filter(w => w.visible), [widgets]);

  return (
    <div ref={containerRef} className={`relative ${isEditing ? "min-h-[600px] pb-32" : ""}`}>
      {isEditing && (
        <div className="absolute inset-0 z-0 pointer-events-none dashboard-grid-bg" />
      )}
      <Responsive
        width={width}
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 8, sm: 4, xs: 2, xxs: 1 }}
        rowHeight={40}
        onLayoutChange={onLayoutChange}
        // @ts-expect-error type definitions missing isDraggable for Responsive
        isDraggable={isEditing}
        isResizable={isEditing}
        isBounded={true}
        compactType="vertical"
        margin={[20, 20]}
        containerPadding={[0, 0]}
        useCSSTransforms={true}
        draggableHandle=".react-grid-dragHandle"
      >
        {visibleWidgets.map(widget => {
          const def = WIDGET_REGISTRY[widget.type];
          if (!def) return null;
          
          const Component = def.component;
          
          return (
            <div 
              key={widget.id} 
              data-grid={{ 
                w: def.defaultSize.w, 
                h: def.defaultSize.h, 
                minW: def.minSize?.w, 
                minH: def.minSize?.h, 
                maxW: def.maxSize?.w, 
                maxH: def.maxSize?.h 
              }}
            >
              <WidgetContainer
                id={widget.id}
                config={widget}
                isEditing={isEditing}
                onRemove={onRemoveWidget}
                onHide={onHideWidget}
                onDuplicate={onDuplicateWidget}
              >
                <Component 
                  instanceId={widget.id}
                  title={widget.title}
                  config={widget.config}
                  isEditing={isEditing}
                  lastUpdated={widgetTimestamps[widget.type] || widgetTimestamps[widget.id]}
                />
              </WidgetContainer>
            </div>
          );
        })}
      </Responsive>
    </div>
  );
};
