import { useRef, useCallback, useState, useEffect } from 'react';
import { useChartStore, useDatasetStore } from '@/store/plotStore';
import { useTranslation } from 'react-i18next';
import type { ChartType, Annotation, LayerConfig, DataColumn } from '@/types';
import { toNumber, isValidNumber } from '@/types';
import { is3DChart } from '@/utils/chart';
import { renderLatexToHTML, extractLatex, isLatexContent } from '@/utils/latex';

// Lazy-load Plotly.js to avoid blocking initial page load
type PlotComponentType = React.ComponentType<Record<string, unknown>>;
let PlotComponent: PlotComponentType | null = null;
let plotlyLoadPromise: Promise<PlotComponentType> | null = null;

function loadPlotly(): Promise<PlotComponentType> {
  if (PlotComponent) return Promise.resolve(PlotComponent);
  if (plotlyLoadPromise) return plotlyLoadPromise;

  plotlyLoadPromise = import('plotly.js-dist-min').then((PlotlyModule) => {
    const Plotly = PlotlyModule.default;
    return import('react-plotly.js/factory').then((factoryModule) => {
      PlotComponent = factoryModule.default(Plotly);
      return PlotComponent;
    });
  });
  return plotlyLoadPromise;
}

/** Map line style to Plotly dash string */
function lineStyleToDash(style: LayerConfig['lineStyle']): string {
  switch (style) {
    case 'dashed': return 'dash';
    case 'dotted': return 'dot';
    default: return 'solid';
  }
}

/** Map point style to Plotly marker symbol */
function pointStyleToSymbol(style: LayerConfig['pointStyle']): string {
  switch (style) {
    case 'square': return 'square';
    case 'triangle': return 'triangle-up';
    case 'none': return 'circle';
    default: return 'circle';
  }
}

/** Generate pie/polar colors in hex format */
function generateSegmentColors(count: number, alpha: number): string[] {
  const baseHues = [200, 30, 150, 340, 60, 270, 100, 10, 180, 300];
  return Array.from({ length: count }, (_, i) => {
    const hue = baseHues[i % baseHues.length];
    const s = 0.7, l = 0.55;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (hue < 60) { r = c; g = x; }
    else if (hue < 120) { r = x; g = c; }
    else if (hue < 180) { g = c; b = x; }
    else if (hue < 240) { g = x; b = c; }
    else if (hue < 300) { r = x; b = c; }
    else { r = c; b = x; }
    const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    return alpha < 1 ? `rgba(${Math.round((r + m) * 255)},${Math.round((g + m) * 255)},${Math.round((b + m) * 255)},${alpha})` : hex;
  });
}

/** Convert column values to number array */
function colToNumbers(col: DataColumn): number[] {
  return col.values.map((v) => toNumber(v));
}

/** Build error bar config for a trace */
function buildErrorBar(
  errorCol: DataColumn | undefined,
  errorPlusCol: DataColumn | undefined,
  errorMinusCol: DataColumn | undefined,
  color: string,
): Record<string, unknown> | undefined {
  if (!errorCol && !errorPlusCol && !errorMinusCol) return undefined;

  if (errorCol) {
    return {
      type: 'data',
      array: colToNumbers(errorCol),
      visible: true,
      color,
      thickness: 1,
      width: 4,
    };
  }

  const result: Record<string, unknown> = {
    type: 'data',
    visible: true,
    color,
    thickness: 1,
    width: 4,
  };
  if (errorPlusCol) {
    result.array = colToNumbers(errorPlusCol);
  }
  if (errorMinusCol) {
    result.arrayminus = colToNumbers(errorMinusCol);
  }
  return Object.keys(result).length > 4 ? result : undefined;
}

// --- AnnotationOverlay ---

function AnnotationOverlay({
  annotations,
  chartArea,
  onMoveAnnotation,
}: {
  annotations: Annotation[];
  chartArea: DOMRect | null;
  onMoveAnnotation: (id: string, x: number, y: number, extra?: Partial<Annotation>) => void;
}) {
  const [dragging, setDragging] = useState<{ id: string; startMouseX: number; startMouseY: number; startX: number; startY: number } | null>(null);
  const [draggingArrow, setDraggingArrow] = useState<{ id: string; endpoint: 'start' | 'end'; startMouseX: number; startMouseY: number; startX: number; startY: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent, ann: Annotation) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging({ id: ann.id, startMouseX: e.clientX, startMouseY: e.clientY, startX: ann.x, startY: ann.y });
  }, []);

  const handleArrowEndpointDown = useCallback((e: React.MouseEvent, annId: string, endpoint: 'start' | 'end', startX: number, startY: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingArrow({ id: annId, endpoint, startMouseX: e.clientX, startMouseY: e.clientY, startX, startY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!chartArea) return;

    if (dragging) {
      const dx = ((e.clientX - dragging.startMouseX) / chartArea.width) * 100;
      const dy = ((e.clientY - dragging.startMouseY) / chartArea.height) * 100;
      const x = Math.max(0, Math.min(100, dragging.startX + dx));
      const y = Math.max(0, Math.min(100, dragging.startY + dy));
      onMoveAnnotation(dragging.id, x, y);
    } else if (draggingArrow) {
      const dx = ((e.clientX - draggingArrow.startMouseX) / chartArea.width) * 100;
      const dy = ((e.clientY - draggingArrow.startMouseY) / chartArea.height) * 100;
      const x = Math.max(0, Math.min(100, draggingArrow.startX + dx));
      const y = Math.max(0, Math.min(100, draggingArrow.startY + dy));
      if (draggingArrow.endpoint === 'start') {
        onMoveAnnotation(draggingArrow.id, x, y);
      } else {
        onMoveAnnotation(draggingArrow.id, -1, -1, { arrowTo: { x, y } });
      }
    }
  }, [dragging, draggingArrow, chartArea, onMoveAnnotation]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setDraggingArrow(null);
  }, []);

  const isDragging = dragging || draggingArrow;

  if (!chartArea || annotations.length === 0) return null;

  const toPixelX = (val: number): number => (val / 100) * chartArea.width;
  const toPixelY = (val: number): number => (val / 100) * chartArea.height;

  return (
    <div
      className="absolute inset-0"
      style={{ padding: '16px', cursor: isDragging ? 'grabbing' : 'default', pointerEvents: isDragging ? 'auto' : 'none' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {annotations.filter((a) => a.visible).map((ann) => {
        const px = toPixelX(ann.x);
        const py = toPixelY(ann.y);

        if (ann.type === 'arrow' && ann.arrowTo) {
          const tx = toPixelX(ann.arrowTo.x);
          const ty = toPixelY(ann.arrowTo.y);
          return (
            <svg key={ann.id} className="absolute inset-0 w-full h-full" style={{ overflow: 'visible', pointerEvents: 'none' }}>
              <defs>
                <marker id={`arrowhead-${ann.id}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill={ann.color} />
                </marker>
              </defs>
              <line x1={px} y1={py} x2={tx} y2={ty} stroke={ann.color} strokeWidth={2} markerEnd={`url(#arrowhead-${ann.id})`} style={{ pointerEvents: 'none' }} />
              <circle cx={px} cy={py} r={6} fill={ann.color} fillOpacity={0.6} stroke={ann.color} strokeWidth={1} style={{ cursor: 'grab', pointerEvents: 'auto' }} onMouseDown={(e) => handleArrowEndpointDown(e as unknown as React.MouseEvent, ann.id, 'start', ann.x, ann.y)} />
              <circle cx={tx} cy={ty} r={6} fill={ann.color} fillOpacity={0.6} stroke={ann.color} strokeWidth={1} style={{ cursor: 'grab', pointerEvents: 'auto' }} onMouseDown={(e) => handleArrowEndpointDown(e as unknown as React.MouseEvent, ann.id, 'end', ann.arrowTo!.x, ann.arrowTo!.y)} />
            </svg>
          );
        }

        if (ann.type === 'rect' && ann.rectSize) {
          const w = (ann.rectSize.w / 100) * chartArea.width;
          const h = (ann.rectSize.h / 100) * chartArea.height;
          return (
            <div key={ann.id} className="absolute border-2 rounded-sm cursor-grab active:cursor-grabbing" style={{ left: px - w / 2, top: py - h / 2, width: w, height: h, borderColor: ann.color, backgroundColor: ann.color + '15', pointerEvents: 'auto' }} onMouseDown={(e) => handleMouseDown(e, ann)} />
          );
        }

        const isLatex = ann.type === 'latex' || isLatexContent(ann.content);
        let html: string;
        if (isLatex) {
          const { latex, displayMode } = extractLatex(ann.content);
          html = renderLatexToHTML(latex, displayMode);
        } else {
          html = ann.content;
        }

        return (
          <div key={ann.id} className="absolute cursor-grab active:cursor-grabbing select-none" style={{ left: px, top: py, transform: 'translate(-50%, -50%)', color: ann.color, fontSize: `${ann.fontSize}px`, lineHeight: 1.2, whiteSpace: 'nowrap', textShadow: '0 1px 3px rgba(0,0,0,0.8)', pointerEvents: 'auto' }} onMouseDown={(e) => handleMouseDown(e, ann)} dangerouslySetInnerHTML={{ __html: html }} />
        );
      })}
    </div>
  );
}

// --- Main Chart2D Component ---

const allYColors = ['#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1'];

interface ExpandedEntry {
  label: string;
  xCol: DataColumn;
  yCol: DataColumn;
  color: string;
  layer: LayerConfig;
  datasetId: string;
  errorCol?: DataColumn;
  errorPlusCol?: DataColumn;
  errorMinusCol?: DataColumn;
}

export default function Chart2D() {
  const { t } = useTranslation();
  const chartConfig = useChartStore((s) => s.chartConfig);
  const datasets = useDatasetStore((s) => s.datasets);
  const updateAnnotation = useChartStore((s) => s.updateAnnotation);
  const theme = useChartStore((s) => s.chartConfig); // re-render on theme change
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartArea, setChartArea] = useState<DOMRect | null>(null);
  const [PlotlyComponent, setPlotlyComponent] = useState<React.ComponentType<Record<string, unknown>> | null>(null);

  const is3DType = is3DChart(chartConfig.type);

  // Lazy load Plotly
  useEffect(() => {
    loadPlotly().then((comp) => {
      setPlotlyComponent(() => comp);
    });
  }, []);

  // Update chartArea on resize only
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setChartArea(containerRef.current.getBoundingClientRect());
      }
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const handleMoveAnnotation = useCallback((id: string, x: number, y: number, extra?: Partial<Annotation>) => {
    if (extra) {
      updateAnnotation(id, { ...extra, ...(x >= 0 ? { x } : {}), ...(y >= 0 ? { y } : {}) });
    } else {
      updateAnnotation(id, { x, y });
    }
  }, [updateAnnotation]);

  if (is3DType) {
    return null;
  }

  if (!PlotlyComponent) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        {t('chart2d.loading', 'Loading chart...')}
      </div>
    );
  }

  const chartType = chartConfig.type as ChartType;
  const isScatter = chartType === 'scatter';
  const isPolar = chartType === 'polar';
  const isPie = chartType === 'pie';
  const isNoAxes = isPie || isPolar;
  const useNumericX = isScatter || chartType === 'line' || chartType === 'area';

  // --- Expand layers into trace entries ---

  const expandedDatasets: ExpandedEntry[] = [];
  const visibleLayers = chartConfig.layers.filter((l) => l.visible);

  for (const layer of visibleLayers) {
    const ds = datasets.find((d) => d.id === layer.datasetId);
    if (!ds) continue;
    const xCol = ds.columns.find((c) => c.id === layer.xColumn) ?? ds.columns.find((c) => c.type === 'X') ?? ds.columns[0];
    if (!xCol) continue;

    const errorCol = layer.errorColumn ? ds.columns.find((c) => c.id === layer.errorColumn) : undefined;
    const errorPlusCol = layer.errorPlusColumn ? ds.columns.find((c) => c.id === layer.errorPlusColumn) : undefined;
    const errorMinusCol = layer.errorMinusColumn ? ds.columns.find((c) => c.id === layer.errorMinusColumn) : undefined;

    const yCols = ds.columns.filter((c) => c.type === 'Y');
    if (yCols.length === 0) {
      const yCol = ds.columns.find((c) => c.id === layer.yColumn);
      if (yCol) {
        expandedDatasets.push({
          label: layer.displayName || `${ds.name} - ${yCol.name}`,
          xCol, yCol, color: layer.color, layer, datasetId: ds.id,
          errorCol, errorPlusCol, errorMinusCol,
        });
      }
    } else {
      yCols.forEach((yCol, idx) => {
        expandedDatasets.push({
          label: yCols.length === 1 ? (layer.displayName || `${ds.name} - ${yCol.name}`) : `${ds.name} - ${yCol.name}`,
          xCol,
          yCol,
          color: yCols.length === 1 ? layer.color : allYColors[idx % allYColors.length],
          layer,
          datasetId: ds.id,
          errorCol: yCols.length === 1 ? errorCol : undefined,
          errorPlusCol: yCols.length === 1 ? errorPlusCol : undefined,
          errorMinusCol: yCols.length === 1 ? errorMinusCol : undefined,
        });
      });
    }
  }

  if (expandedDatasets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        {t('chart2d.addLayer')}
      </div>
    );
  }

  // --- Check if any layer uses right Y axis ---
  const hasRightYAxis = expandedDatasets.some((e) => e.layer.yAxisSide === 'right');

  // --- Build Plotly traces ---

  const traces = expandedDatasets.map((entry) => {
    const { label, xCol, yCol, color, layer } = entry;
    const xValues = colToNumbers(xCol);
    const yValues = colToNumbers(yCol);

    const xLogScale = chartConfig.xAxis.logScale;
    const yLogScale = chartConfig.yAxis.logScale;
    const filterIndices = xValues.map((x, i) => {
      const y = yValues[i];
      const xOk = !xLogScale || x > 0;
      const yOk = !yLogScale || y > 0;
      return xOk && yOk && isValidNumber(x) && isValidNumber(y);
    });
    const filteredX = xValues.filter((_, i) => filterIndices[i]);
    const filteredY = yValues.filter((_, i) => filterIndices[i]);

    const pointSymbol = pointStyleToSymbol(layer.pointStyle);
    const showPoints = layer.pointStyle !== 'none';

    if (isPie) {
      return {
        type: 'pie' as const,
        labels: xCol.values.map(String),
        values: yValues,
        marker: { colors: generateSegmentColors(yValues.length, 0.85) },
        textinfo: 'label+percent',
        hole: 0,
      };
    }

    if (isPolar) {
      return {
        type: 'scatterpolar' as const,
        r: filteredY,
        theta: filteredX,
        mode: showPoints ? 'lines+markers' : 'lines',
        name: label,
        line: { color, dash: lineStyleToDash(layer.lineStyle), width: layer.lineWidth },
        marker: { symbol: pointSymbol, size: showPoints ? layer.pointSize : 0, color },
        fill: layer.fill ? 'toself' : undefined,
      };
    }

    let plotlyType: 'scatter' | 'bar';
    let mode: string;

    if (chartType === 'bar') {
      plotlyType = 'bar';
      mode = '';
    } else {
      plotlyType = 'scatter';
      mode = isScatter
        ? (showPoints ? 'markers' : 'markers')
        : (showPoints ? 'lines+markers' : 'lines');
    }

    const trace: Record<string, unknown> = {
      type: plotlyType,
      mode,
      name: label,
      x: useNumericX ? filteredX : xCol.values.map(String),
      y: useNumericX ? filteredY : yValues,
      line: {
        color,
        dash: lineStyleToDash(layer.lineStyle),
        width: layer.lineWidth,
      },
      marker: {
        symbol: pointSymbol,
        size: showPoints ? layer.pointSize : 0,
        color: color,
        line: chartType === 'bar' ? { width: 1, color } : undefined,
      },
    };

    if (layer.fill || chartType === 'area') {
      trace.fill = 'tozeroy';
      trace.fillcolor = color + '40';
    }

    if (layer.yAxisSide === 'right') {
      trace.yaxis = 'y2';
    }

    const errY = buildErrorBar(entry.errorCol, entry.errorPlusCol, entry.errorMinusCol, color);
    if (errY) {
      if (useNumericX && (xLogScale || yLogScale)) {
        const errorArray = errY.array as number[];
        const errorMinusArray = errY.arrayminus as number[] | undefined;
        errY.array = errorArray.filter((_, i) => filterIndices[i]);
        if (errorMinusArray) {
          errY.arrayminus = errorMinusArray.filter((_, i) => filterIndices[i]);
        }
      }
      trace.error_y = errY;
    }

    return trace;
  });

  // --- Build Plotly layout ---
  // Read CSS variables once
  const cs = getComputedStyle(document.documentElement);
  const textColor = cs.getPropertyValue('--text-primary').trim() || '#e4e4e7';
  const textSecondary = cs.getPropertyValue('--text-secondary').trim() || '#a1a1aa';
  const textMuted = cs.getPropertyValue('--text-muted').trim() || '#71717a';
  const borderColor = cs.getPropertyValue('--border').trim() || '#3f3f46';
  const gridColor = cs.getPropertyValue('--grid-color').trim() || '#27272a';

  const legendPositionMap: Record<string, { x: number; y: number; xanchor: string; yanchor: string }> = {
    top: { x: 0.5, y: 1.1, xanchor: 'center', yanchor: 'bottom' },
    bottom: { x: 0.5, y: -0.1, xanchor: 'center', yanchor: 'top' },
    left: { x: -0.1, y: 0.5, xanchor: 'right', yanchor: 'middle' },
    right: { x: 1.1, y: 0.5, xanchor: 'left', yanchor: 'middle' },
  };

  const legendPos = legendPositionMap[chartConfig.legend.position] || legendPositionMap.top;

  const layout: Record<string, unknown> = {
    title: {
      text: chartConfig.title || '',
      font: { size: 14, color: textColor },
      xref: 'paper',
      x: 0.5,
    },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: {
      color: textSecondary,
      size: chartConfig.fontSize,
    },
    margin: {
      t: chartConfig.marginTop,
      r: chartConfig.marginRight + (hasRightYAxis ? 40 : 0),
      b: chartConfig.marginBottom,
      l: chartConfig.marginLeft,
    },
    showlegend: chartConfig.legend.visible,
    legend: {
      ...legendPos,
      font: { size: 11, color: textSecondary },
      bgcolor: 'transparent',
      borderwidth: 0,
    },
    autosize: true,
  };

  if (!isNoAxes) {
    const xAxisConfig: Record<string, unknown> = {
      title: { text: chartConfig.xAxis.label || '', font: { size: chartConfig.fontSize, color: textSecondary } },
      type: chartConfig.xAxis.logScale ? 'log' : (useNumericX ? 'linear' : 'category'),
      gridcolor: chartConfig.xAxis.gridVisible ? gridColor : 'transparent',
      gridwidth: 1,
      zerolinecolor: gridColor,
      linecolor: borderColor,
      tickfont: { color: textMuted, size: chartConfig.fontSize },
      exponentformat: chartConfig.xAxis.scientificNotation ? 'e' : 'none',
    };
    if (chartConfig.xAxis.scientificNotation) xAxisConfig.tickformat = '.2e';
    if (!chartConfig.xAxis.autoRange && chartConfig.xAxis.min !== undefined && chartConfig.xAxis.max !== undefined) {
      xAxisConfig.range = [chartConfig.xAxis.min, chartConfig.xAxis.max];
      xAxisConfig.autorange = false;
    }

    const yAxisConfig: Record<string, unknown> = {
      title: { text: chartConfig.yAxis.label || '', font: { size: chartConfig.fontSize, color: textSecondary } },
      type: chartConfig.yAxis.logScale ? 'log' : 'linear',
      gridcolor: chartConfig.yAxis.gridVisible ? gridColor : 'transparent',
      gridwidth: 1,
      zerolinecolor: gridColor,
      linecolor: borderColor,
      tickfont: { color: textMuted, size: chartConfig.fontSize },
      exponentformat: chartConfig.yAxis.scientificNotation ? 'e' : 'none',
    };
    if (chartConfig.yAxis.scientificNotation) yAxisConfig.tickformat = '.2e';
    if (!chartConfig.yAxis.autoRange && chartConfig.yAxis.min !== undefined && chartConfig.yAxis.max !== undefined) {
      yAxisConfig.range = [chartConfig.yAxis.min, chartConfig.yAxis.max];
      yAxisConfig.autorange = false;
    }

    layout.xaxis = xAxisConfig;
    layout.yaxis = yAxisConfig;

    if (hasRightYAxis) {
      layout.yaxis2 = {
        title: { text: '', font: { size: chartConfig.fontSize, color: textSecondary } },
        overlaying: 'y',
        side: 'right',
        type: chartConfig.yAxis.logScale ? 'log' : 'linear',
        gridcolor: 'transparent',
        zerolinecolor: gridColor,
        linecolor: borderColor,
        tickfont: { color: textMuted, size: chartConfig.fontSize },
        exponentformat: chartConfig.yAxis.scientificNotation ? 'e' : 'none',
        showgrid: false,
      };
      if (chartConfig.yAxis.scientificNotation) {
        (layout.yaxis2 as Record<string, unknown>).tickformat = '.2e';
      }
    }
  }

  if (isPolar) {
    layout.polar = {
      radialaxis: { gridcolor: chartConfig.yAxis.gridVisible ? gridColor : 'transparent', tickfont: { color: textMuted }, visible: true },
      angularaxis: { gridcolor: chartConfig.xAxis.gridVisible ? gridColor : 'transparent', tickfont: { color: textMuted } },
    };
    delete layout.xaxis;
    delete layout.yaxis;
  }

  const plotlyConfig = {
    responsive: true,
    displayModeBar: false,
    scrollZoom: true,
  };

  // Suppress unused variable warning for theme (used to trigger re-render on theme change)
  void theme;

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ background: 'var(--chart-bg)' }}>
      <PlotlyComponent
        data={traces}
        layout={layout}
        config={plotlyConfig}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
      />
      <AnnotationOverlay
        annotations={chartConfig.annotations}
        chartArea={chartArea}
        onMoveAnnotation={handleMoveAnnotation}
      />
    </div>
  );
}
