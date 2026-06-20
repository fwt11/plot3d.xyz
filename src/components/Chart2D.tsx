import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Scatter, Bar, Pie, PolarArea, Radar } from 'react-chartjs-2';
import { usePlotStore } from '@/store/plotStore';
import type { ChartType, Annotation } from '@/types';
import { renderLatexToHTML, extractLatex, isLatexContent } from '@/utils/latex';

// Helper to read CSS variable values for Chart.js (which doesn't support CSS vars)
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Title,
  Tooltip,
  Legend
);

function AnnotationOverlay({ annotations, chartArea, onMoveAnnotation }: { annotations: Annotation[]; chartArea: DOMRect | null; onMoveAnnotation: (id: string, x: number, y: number, extra?: Partial<Annotation>) => void }) {
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

  return (
    <div
      className="absolute inset-0"
      style={{ padding: '16px', cursor: isDragging ? 'grabbing' : 'default' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {annotations.filter((a) => a.visible).map((ann) => {
        const px = (ann.x / 100) * chartArea.width;
        const py = (ann.y / 100) * chartArea.height;

        if (ann.type === 'arrow' && ann.arrowTo) {
          const tx = (ann.arrowTo.x / 100) * chartArea.width;
          const ty = (ann.arrowTo.y / 100) * chartArea.height;
          return (
            <svg
              key={ann.id}
              className="absolute inset-0 w-full h-full"
              style={{ overflow: 'visible', pointerEvents: 'none' }}
            >
              <defs>
                <marker id={`arrowhead-${ann.id}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill={ann.color} />
                </marker>
              </defs>
              <line
                x1={px} y1={py} x2={tx} y2={ty}
                stroke={ann.color}
                strokeWidth={2}
                markerEnd={`url(#arrowhead-${ann.id})`}
                style={{ pointerEvents: 'none' }}
              />
              {/* Start handle */}
              <circle
                cx={px} cy={py} r={6}
                fill={ann.color}
                fillOpacity={0.6}
                stroke={ann.color}
                strokeWidth={1}
                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                onMouseDown={(e) => handleArrowEndpointDown(e as unknown as React.MouseEvent, ann.id, 'start', ann.x, ann.y)}
              />
              {/* End handle */}
              <circle
                cx={tx} cy={ty} r={6}
                fill={ann.color}
                fillOpacity={0.6}
                stroke={ann.color}
                strokeWidth={1}
                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                onMouseDown={(e) => handleArrowEndpointDown(e as unknown as React.MouseEvent, ann.id, 'end', ann.arrowTo!.x, ann.arrowTo!.y)}
              />
            </svg>
          );
        }

        if (ann.type === 'rect' && ann.rectSize) {
          const w = (ann.rectSize.w / 100) * chartArea.width;
          const h = (ann.rectSize.h / 100) * chartArea.height;
          return (
            <div
              key={ann.id}
              className="absolute border-2 rounded-sm cursor-grab active:cursor-grabbing"
              style={{
                left: px - w / 2,
                top: py - h / 2,
                width: w,
                height: h,
                borderColor: ann.color,
                backgroundColor: ann.color + '15',
              }}
              onMouseDown={(e) => handleMouseDown(e, ann)}
            />
          );
        }

        // Text or LaTeX
        const isLatex = ann.type === 'latex' || isLatexContent(ann.content);
        let html: string;
        if (isLatex) {
          const { latex, displayMode } = extractLatex(ann.content);
          html = renderLatexToHTML(latex, displayMode);
        } else {
          html = ann.content;
        }

        return (
          <div
            key={ann.id}
            className="absolute cursor-grab active:cursor-grabbing select-none"
            style={{
              left: px,
              top: py,
              transform: 'translate(-50%, -50%)',
              color: ann.color,
              fontSize: `${ann.fontSize}px`,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}
            onMouseDown={(e) => handleMouseDown(e, ann)}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
}

export default function Chart2D() {
  const chartConfig = usePlotStore((s) => s.chartConfig);
  const datasets = usePlotStore((s) => s.datasets);
  const updateAnnotation = usePlotStore((s) => s.updateAnnotation);
  const chartRef = useRef<ChartJS<'line' | 'scatter' | 'bar' | 'pie' | 'polarArea' | 'radar'>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const is3D = ['surface3d', 'scatter3d', 'contour3d', 'bar3d'].includes(chartConfig.type);

  const chartArea = useMemo(() => {
    if (!containerRef.current) return null;
    return containerRef.current.getBoundingClientRect();
  }, [chartConfig.annotations, chartConfig.type, chartConfig.layers]);

  const handleMoveAnnotation = useCallback((id: string, x: number, y: number, extra?: Partial<Annotation>) => {
    if (extra) {
      updateAnnotation(id, { ...extra, ...(x >= 0 ? { x } : {}), ...(y >= 0 ? { y } : {}) });
    } else {
      updateAnnotation(id, { x, y });
    }
  }, [updateAnnotation]);

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__chartRef = chartRef.current;
  }, [chartRef.current]);

  if (is3D) {
    return null;
  }

  const chartType = chartConfig.type as ChartType;
  const isScatter = chartType === 'scatter';
  const isPolar = chartType === 'polar';
  const isNoAxes = chartType === 'pie' || isPolar;
  const is3DChart = ['surface3d', 'scatter3d', 'contour3d', 'bar3d'].includes(chartType);
  // Scientific plots: line, scatter, area use numeric X axis
  const useNumericX = isScatter || chartType === 'line' || chartType === 'area';

  const allYColors = ['#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1'];

  const expandedDatasets: { label: string; xCol: typeof datasets[0]['columns'][0]; yCol: typeof datasets[0]['columns'][0]; color: string }[] = [];

  if (!is3DChart) {
    const visibleLayers = chartConfig.layers.filter((l) => l.visible);
    for (const layer of visibleLayers) {
      const ds = datasets.find((d) => d.id === layer.datasetId);
      if (!ds) continue;
      const xCol = ds.columns.find((c) => c.id === layer.xColumn) ?? ds.columns.find((c) => c.type === 'X') ?? ds.columns[0];
      if (!xCol) continue;
      const yCols = ds.columns.filter((c) => c.type === 'Y');
      if (yCols.length === 0) {
        const yCol = ds.columns.find((c) => c.id === layer.yColumn);
        if (yCol) {
          expandedDatasets.push({ label: `${ds.name} - ${yCol.name}`, xCol, yCol, color: layer.color });
        }
      } else {
        yCols.forEach((yCol, idx) => {
          expandedDatasets.push({
            label: `${ds.name} - ${yCol.name}`,
            xCol,
            yCol,
            color: yCols.length === 1 ? layer.color : allYColors[idx % allYColors.length],
          });
        });
      }
    }
  } else {
    for (const layer of chartConfig.layers.filter((l) => l.visible)) {
      const ds = datasets.find((d) => d.id === layer.datasetId);
      if (!ds) continue;
      const xCol = ds.columns.find((c) => c.id === layer.xColumn);
      const yCol = ds.columns.find((c) => c.id === layer.yColumn);
      if (!xCol || !yCol) continue;
      expandedDatasets.push({ label: `${ds.name} - ${yCol.name}`, xCol, yCol, color: layer.color });
    }
  }

  if (expandedDatasets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        请添加数据图层
      </div>
    );
  }

  const firstEntry = expandedDatasets[0];
  const labels = firstEntry.xCol.values.map(String);

  const chartData = {
    labels: useNumericX ? undefined : labels,
    datasets: expandedDatasets.map(({ label, xCol, yCol, color }) => {
      const base = {
        label,
        borderColor: color,
        backgroundColor:
          chartType === 'area'
            ? color + '40'
            : chartType === 'bar'
            ? color + 'CC'
            : chartType === 'pie'
            ? generatePieColors(yCol.values.length)
            : isPolar
            ? generatePolarColors(yCol.values.length)
            : color,
        borderWidth: chartType === 'bar' || chartType === 'pie' || isPolar ? 1 : 2,
        pointRadius: isScatter ? 4 : 2,
        pointHoverRadius: 6,
        fill: chartType === 'area' || isPolar,
        tension: 0.3,
      };

      if (useNumericX) {
        return {
          ...base,
          data: xCol.values.map((x, i) => ({
            x: Number(x) || 0,
            y: Number(yCol.values[i]) || 0,
          })),
        };
      }

      return {
        ...base,
        data: yCol.values.map((v) => Number(v) || 0),
      };
    }),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: {
        display: chartConfig.legend.visible,
        position: chartConfig.legend.position as 'top' | 'bottom' | 'left' | 'right',
        labels: { color: cssVar('--text-secondary'), font: { size: 11 } },
      },
      title: {
        display: !!chartConfig.title,
        text: chartConfig.title,
        color: cssVar('--text-primary'),
        font: { size: 14, weight: 'bold' as const },
      },
      tooltip: {
        backgroundColor: cssVar('--bg-surface'),
        titleColor: cssVar('--text-primary'),
        bodyColor: cssVar('--text-secondary'),
        borderColor: cssVar('--border'),
        borderWidth: 1,
      },
    },
    scales:
      isNoAxes
        ? {}
        : isPolar
        ? {
            r: {
              grid: { display: chartConfig.yAxis.gridVisible, color: cssVar('--grid-color') },
              ticks: { color: cssVar('--axis-text'), backdropColor: 'transparent' },
              pointLabels: { color: cssVar('--text-secondary'), font: { size: 11 } },
              min: chartConfig.yAxis.autoRange ? undefined : chartConfig.yAxis.min,
              max: chartConfig.yAxis.autoRange ? undefined : chartConfig.yAxis.max,
            },
          }
        : {
            x: {
              title: { display: !!chartConfig.xAxis.label, text: chartConfig.xAxis.label, color: cssVar('--text-secondary') },
              grid: { display: chartConfig.xAxis.gridVisible, color: cssVar('--grid-color'), lineWidth: 1 },
              ticks: { color: cssVar('--axis-text') },
              border: { color: cssVar('--axis-color') },
              min: chartConfig.xAxis.autoRange ? undefined : chartConfig.xAxis.min,
              max: chartConfig.xAxis.autoRange ? undefined : chartConfig.xAxis.max,
              type: (useNumericX ? 'linear' : 'category') as 'linear' | 'category',
            },
            y: {
              title: { display: !!chartConfig.yAxis.label, text: chartConfig.yAxis.label, color: cssVar('--text-secondary') },
              grid: { display: chartConfig.yAxis.gridVisible, color: cssVar('--grid-color'), lineWidth: 1 },
              ticks: { color: cssVar('--axis-text') },
              border: { color: cssVar('--axis-color') },
              min: chartConfig.yAxis.autoRange ? undefined : chartConfig.yAxis.min,
              max: chartConfig.yAxis.autoRange ? undefined : chartConfig.yAxis.max,
            },
          },
  };

  const RenderChart = () => {
    switch (chartType) {
      case 'scatter':
        return <Scatter ref={chartRef as React.Ref<ChartJS<'scatter'>>} data={chartData as Parameters<typeof Scatter>[0]['data']} options={options} />;
      case 'bar':
        return <Bar ref={chartRef as React.Ref<ChartJS<'bar'>>} data={chartData as Parameters<typeof Bar>[0]['data']} options={options} />;
      case 'pie':
        return <Pie ref={chartRef as React.Ref<ChartJS<'pie'>>} data={chartData as Parameters<typeof Pie>[0]['data']} options={options} />;
      case 'polar':
        return <PolarArea ref={chartRef as React.Ref<ChartJS<'polarArea'>>} data={chartData as Parameters<typeof PolarArea>[0]['data']} options={options as any} />;
      case 'area':
      case 'line':
      default:
        return <Line ref={chartRef as React.Ref<ChartJS<'line'>>} data={chartData as Parameters<typeof Line>[0]['data']} options={options} />;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full p-4" style={{ background: 'var(--chart-bg)' }}>
      <RenderChart />
      <AnnotationOverlay annotations={chartConfig.annotations} chartArea={chartArea} onMoveAnnotation={handleMoveAnnotation} />
    </div>
  );
}

function generatePieColors(count: number): string[] {
  const colors: string[] = [];
  const baseHues = [200, 30, 150, 340, 60, 270, 100, 10, 180, 300];
  for (let i = 0; i < count; i++) {
    const hue = baseHues[i % baseHues.length];
    colors.push(`hsla(${hue}, 70%, 55%, 0.85)`);
  }
  return colors;
}

function generatePolarColors(count: number): string[] {
  const colors: string[] = [];
  const baseHues = [200, 30, 150, 340, 60, 270, 100, 10, 180, 300];
  for (let i = 0; i < count; i++) {
    const hue = baseHues[i % baseHues.length];
    colors.push(`hsla(${hue}, 65%, 55%, 0.6)`);
  }
  return colors;
}
