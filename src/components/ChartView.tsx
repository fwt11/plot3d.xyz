import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { useChartStore, useDatasetStore } from '@/store/plotStore';
import { useUiStore } from '@/store/uiStore';
import { useToastStore } from '@/store/toastStore';
import { useChartInteractionStore } from '@/store/chartInteractionStore';
import { useTranslation } from 'react-i18next';
import type { ChartType, Annotation } from '@/types';
import { isValidNumber } from '@/types';
import { is3DChart } from '@/utils/chart';
import { showContextMenu, type MenuItemOrSeparator } from '@/utils/contextMenu';
import { Image, FileCode, RotateCcw, Camera } from 'lucide-react';
import { AnnotationOverlay } from '@/components/AnnotationOverlay';
import {
  colToNumbers,
  buildErrorBar,
  lineStyleToDash,
  pointStyleToSymbol,
  hexToHue,
  toPlotlyColorScale,
  extractGridData,
  type ExpandedEntry,
} from '@/utils/tracesBuilder';
import { buildLayout } from '@/utils/layoutBuilder';
import { buildExportPayload } from '@/utils/exportLayout';

// Lazy-load Plotly.js to avoid blocking initial page load
type PlotComponentType = React.ComponentType<Record<string, unknown>>;
let PlotComponent: PlotComponentType | null = null;
let plotlyLoadPromise: Promise<PlotComponentType> | null = null;

/** CSS variables used for the chart when exporting to a white background.
 *  This ensures text and grid colors remain readable regardless of app theme. */
const LIGHT_CHART_CSS_VARS = {
  textColor: '#000000',
  textSecondary: '#000000',
  textMuted: '#333333',
  borderColor: '#000000',
  gridColor: 'rgba(0, 0, 0, 0.35)',
  bgSurface: '#ffffff',
};

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

/** Generate pie/polar segment colors derived from a base color */
function generateSegmentColors(count: number, alpha: number, baseColor?: string): string[] {
  const baseHue = baseColor ? hexToHue(baseColor) : 200;
  const baseHues = [0, 30, 150, 340, 60, 270, 100, 10, 180, 300];
  return Array.from({ length: count }, (_, i) => {
    const hue = (baseHue + baseHues[i % baseHues.length]) % 360;
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

// --- Main ChartView Component ---

const allYColors = ['#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1'];

export default function ChartView() {
  const { t } = useTranslation();
  const chartConfig = useChartStore((s) => s.chartConfig);
  const datasets = useDatasetStore((s) => s.datasets);
  const updateAnnotation = useChartStore((s) => s.updateAnnotation);
  const updateAnnotationSilent = useChartStore((s) => s.updateAnnotationSilent);
  const theme = useUiStore((s) => s.theme); // re-render on theme change
  const addToast = useToastStore((s) => s.addToast);
  const setHover = useChartInteractionStore((s) => s.setHover);
  const setZoom = useChartInteractionStore((s) => s.setZoom);
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

  // Track Plotly hover events for status bar
  const handleHover = useCallback((event: Readonly<{ points?: ReadonlyArray<{ x: number | string; y: number | string; z?: number | string; curveNumber?: number; pointNumber?: number | number[] }> }> | undefined) => {
    const p = event?.points?.[0];
    if (!p) { setHover(null); return; }
    setHover({ x: p.x, y: p.y, z: p.z, curveNumber: p.curveNumber, pointNumber: Array.isArray(p.pointNumber) ? p.pointNumber[0] : p.pointNumber });
  }, [setHover]);

  // Track Plotly relayout (zoom/pan) events for status bar
  const handleRelayout = useCallback((event: Readonly<Record<string, unknown>>) => {
    const zoom: { x0?: number; x1?: number; y0?: number; y1?: number } = {};
    if (event['xaxis.range[0]'] !== undefined) zoom.x0 = Number(event['xaxis.range[0]']);
    if (event['xaxis.range[1]'] !== undefined) zoom.x1 = Number(event['xaxis.range[1]']);
    if (event['yaxis.range[0]'] !== undefined) zoom.y0 = Number(event['yaxis.range[0]']);
    if (event['yaxis.range[1]'] !== undefined) zoom.y1 = Number(event['yaxis.range[1]']);
    if (event['xaxis.autorange'] || event['yaxis.autorange']) {
      setZoom(null);
    } else if (Object.keys(zoom).length > 0) {
      setZoom(zoom);
    }
  }, [setZoom]);

  // Update chartArea on resize and container size changes
  useEffect(() => {
    const el = containerRef.current;
    const update = () => {
      if (el) {
        setChartArea(el.getBoundingClientRect());
      }
    };
    update();
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver !== 'undefined' && el
      ? new ResizeObserver(update)
      : null;
    if (observer && el) observer.observe(el);
    return () => {
      window.removeEventListener('resize', update);
      if (observer && el) observer.unobserve(el);
    };
  }, []);

  const handleMoveAnnotation = useCallback((id: string, x: number, y: number, extra?: Partial<Annotation>) => {
    if (extra) {
      updateAnnotationSilent(id, { ...extra, ...(x >= 0 ? { x } : {}), ...(y >= 0 ? { y } : {}) });
    } else {
      updateAnnotationSilent(id, { x, y });
    }
  }, [updateAnnotationSilent]);

  const handleDragEnd = useCallback((id: string, x: number, y: number, extra?: Partial<Annotation>) => {
    // Push a single history snapshot for the completed drag
    // x/y == -1 means the position was already set via silent updates
    updateAnnotation(id, extra ? { ...extra, ...(x >= 0 ? { x } : {}), ...(y >= 0 ? { y } : {}) } : { x, y });
  }, [updateAnnotation]);

  const handleChartContextMenu = useCallback((e: React.MouseEvent) => {
    const { resolutionMultiplier, background } = chartConfig.exportConfig;
    const exportBg = background === 'white'
      ? '#ffffff'
      : background === 'theme'
        ? (theme === 'dark' ? '#18181b' : '#ffffff')
        : undefined;

    const items: MenuItemOrSeparator[] = [
      {
        label: t('context.exportPng'),
        icon: <Image size={14} />,
        onClick: async () => {
          try {
            if (is3DType) {
              // 3D: use html-to-image to capture the entire container
              const { toPng } = await import('html-to-image');
              const dataUrl = await toPng(containerRef.current!, {
                pixelRatio: resolutionMultiplier,
                backgroundColor: exportBg,
              });
              const link = document.createElement('a');
              link.download = (chartConfig.title || 'chart') + '.png';
              link.href = dataUrl;
              link.click();
              addToast(t('toast.exportSuccess'), 'success');
            } else {
              // 2D: use Plotly's native export with scale for high-res
              const plotlyDiv = containerRef.current?.querySelector('.js-plotly-plot') as HTMLElement | null;
              if (!plotlyDiv) return;
              const Plotly = (await import('plotly.js-dist-min')).default;
              const { data, layout, width, height } = buildExportPayload(plotlyDiv, 2);
              await Plotly.downloadImage({ data, layout }, {
                format: 'png',
                scale: resolutionMultiplier,
                width,
                height,
                bgcolor: exportBg ?? 'rgba(0,0,0,0)',
                filename: chartConfig.title || 'chart',
              });
              addToast(t('toast.exportSuccess'), 'success');
            }
          } catch {
            addToast(t('toast.exportFailed'), 'error');
          }
        },
      },
      {
        label: t('context.exportSvg'),
        icon: <FileCode size={14} />,
        onClick: async () => {
          if (is3DType) {
            addToast(t('toast.svgNotSupported3d'), 'warning');
            return;
          }
          try {
            const plotlyDiv = containerRef.current?.querySelector('.js-plotly-plot') as HTMLElement | null;
            if (!plotlyDiv) return;
            const Plotly = (await import('plotly.js-dist-min')).default;
            const { data, layout, width, height } = buildExportPayload(plotlyDiv, 2);
            await Plotly.downloadImage({ data, layout }, {
              format: 'svg',
              scale: resolutionMultiplier,
              width,
              height,
              bgcolor: exportBg ?? 'rgba(0,0,0,0)',
              filename: chartConfig.title || 'chart',
            });
            addToast(t('toast.exportSuccess'), 'success');
          } catch {
            addToast(t('toast.exportFailed'), 'error');
          }
        },
      },
      {
        label: t('context.copyToClipboard'),
        icon: <Camera size={14} />,
        onClick: async () => {
          try {
            if (is3DType) {
              // 3D: use html-to-image
              const { toPng } = await import('html-to-image');
              const dataUrl = await toPng(containerRef.current!, {
                pixelRatio: resolutionMultiplier,
                backgroundColor: exportBg,
              });
              const response = await fetch(dataUrl);
              const blob = await response.blob();
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            } else {
              // 2D: use Plotly's toImage
              const plotlyDiv = containerRef.current?.querySelector('.js-plotly-plot') as HTMLElement | null;
              if (!plotlyDiv) return;
              const Plotly = (await import('plotly.js-dist-min')).default;
              const { data, layout, width, height } = buildExportPayload(plotlyDiv, 2);
              const dataUrl = await Plotly.toImage({ data, layout }, {
                format: 'png',
                scale: resolutionMultiplier,
                width,
                height,
                bgcolor: exportBg ?? 'rgba(0,0,0,0)',
              });
              const response = await fetch(dataUrl);
              const blob = await response.blob();
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            }
            addToast(t('toast.copySuccess'), 'success');
          } catch {
            addToast(t('toast.copyFailed'), 'error');
          }
        },
      },
      {
        label: t('context.copySvg'),
        icon: <FileCode size={14} />,
        onClick: async () => {
          if (is3DType) {
            addToast(t('toast.svgNotSupported3d'), 'warning');
            return;
          }
          try {
            const plotlyDiv = containerRef.current?.querySelector('.js-plotly-plot') as HTMLElement | null;
            if (!plotlyDiv) return;
            const Plotly = (await import('plotly.js-dist-min')).default;
            const { data, layout, width, height } = buildExportPayload(plotlyDiv, 2);
            const dataUrl = await Plotly.toImage({ data, layout }, {
              format: 'svg',
              scale: resolutionMultiplier,
              width,
              height,
              bgcolor: exportBg ?? 'rgba(0,0,0,0)',
            });
            const svgText = atob(dataUrl.split(',')[1]);
            await navigator.clipboard.writeText(svgText);
            addToast(t('toast.copySuccess'), 'success');
          } catch {
            addToast(t('toast.copyFailed'), 'error');
          }
        },
      },
      { separator: true },
      {
        label: t('context.resetZoom'),
        icon: <RotateCcw size={14} />,
        onClick: () => {
          const div = containerRef.current?.querySelector('.js-plotly-plot') as HTMLElement | null;
          if (div) {
            import('plotly.js-dist-min').then((Plotly) => {
              if (is3DType) {
                Plotly.default.relayout(div, {
                  'scene.xaxis.autorange': true,
                  'scene.yaxis.autorange': true,
                  'scene.zaxis.autorange': true,
                });
              } else {
                Plotly.default.relayout(div, {
                  'xaxis.autorange': true,
                  'yaxis.autorange': true,
                });
              }
            });
          }
        },
      },
    ];
    showContextMenu(e, items);
  }, [chartConfig.title, chartConfig.exportConfig, is3DType, theme, t, addToast]);

  const chartType = chartConfig.type as ChartType;
  const isScatter = chartType === 'scatter';
  const isPolar = chartType === 'polar';
  const isPie = chartType === 'pie';
  const isNoAxes = isPie || isPolar;
  const isBar = chartType === 'bar';
  const useNumericX = isScatter || chartType === 'line' || chartType === 'area' || (isBar && chartConfig.xAxis.categoryAxis === false);

  // --- Expand layers into trace entries (memoized) ---
  const expandedDatasets = useMemo<ExpandedEntry[]>(() => {
    const result: ExpandedEntry[] = [];
    const visibleLayers = chartConfig.layers.filter((l) => l.visible);

    for (const layer of visibleLayers) {
      const ds = datasets.find((d) => d.id === layer.datasetId);
      if (!ds) continue;
      const xCol = ds.columns.find((c) => c.id === layer.xColumn) ?? ds.columns.find((c) => c.type === 'X') ?? ds.columns[0];
      if (!xCol) continue;

      const errorCol = layer.errorColumn ? ds.columns.find((c) => c.id === layer.errorColumn) : undefined;
      const errorPlusCol = layer.errorPlusColumn ? ds.columns.find((c) => c.id === layer.errorPlusColumn) : undefined;
      const errorMinusCol = layer.errorMinusColumn ? ds.columns.find((c) => c.id === layer.errorMinusColumn) : undefined;
      const errorXCol = layer.errorXColumn ? ds.columns.find((c) => c.id === layer.errorXColumn) : undefined;
      const errorXPlusCol = layer.errorXPlusColumn ? ds.columns.find((c) => c.id === layer.errorXPlusColumn) : undefined;
      const errorXMinusCol = layer.errorXMinusColumn ? ds.columns.find((c) => c.id === layer.errorXMinusColumn) : undefined;

      if (is3DType) {
        const yCol = ds.columns.find((c) => c.id === layer.yColumn) ?? ds.columns.find((c) => c.type === 'Y');
        const zCol = layer.zColumn ? ds.columns.find((c) => c.id === layer.zColumn) : ds.columns.find((c) => c.type === 'Z');
        if (!yCol) continue;

        result.push({
          label: layer.displayName || yCol.name,
          xCol, yCol, zCol, color: layer.color, layer, datasetId: ds.id,
          errorCol, errorPlusCol, errorMinusCol,
          errorXCol, errorXPlusCol, errorXMinusCol,
        });
      } else {
        const yCols = ds.columns.filter((c) => c.type === 'Y');
        // For heatmap, also resolve the Z column
        const zColForHeatmap = chartType === 'heatmap'
          ? (layer.zColumn ? ds.columns.find((c) => c.id === layer.zColumn) : ds.columns.find((c) => c.type === 'Z'))
          : undefined;
        if (yCols.length === 0) {
          const yCol = ds.columns.find((c) => c.id === layer.yColumn);
          if (yCol) {
            result.push({
              label: layer.displayName || yCol.name,
              xCol, yCol, zCol: zColForHeatmap, color: layer.color, layer, datasetId: ds.id,
              errorCol, errorPlusCol, errorMinusCol,
              errorXCol, errorXPlusCol, errorXMinusCol,
            });
          }
        } else {
          yCols.forEach((yCol, idx) => {
            result.push({
              label: layer.displayName || yCol.name,
              xCol,
              yCol,
              zCol: zColForHeatmap,
              color: yCols.length === 1 ? layer.color : allYColors[idx % allYColors.length],
              layer,
              datasetId: ds.id,
              errorCol: yCols.length === 1 ? errorCol : undefined,
              errorPlusCol: yCols.length === 1 ? errorPlusCol : undefined,
              errorMinusCol: yCols.length === 1 ? errorMinusCol : undefined,
              errorXCol: yCols.length === 1 ? errorXCol : undefined,
              errorXPlusCol: yCols.length === 1 ? errorXPlusCol : undefined,
              errorXMinusCol: yCols.length === 1 ? errorXMinusCol : undefined,
            });
          });
        }
      }
    }
    return result;
  }, [chartConfig.layers, datasets, is3DType, chartType]);

  // --- Read CSS variables (cached, re-read only when theme triggers re-render) ---
  const cssVars = useMemo(() => {
    // For white-background exports, force a light color scheme so the exported image
    // matches a print-ready appearance even when the app is in dark mode.
    if (chartConfig.exportConfig.background === 'white') {
      return LIGHT_CHART_CSS_VARS;
    }
    const cs = getComputedStyle(document.documentElement);
    return {
      textColor: cs.getPropertyValue('--text-primary').trim() || '#e4e4e7',
      textSecondary: cs.getPropertyValue('--text-secondary').trim() || '#a1a1aa',
      textMuted: cs.getPropertyValue('--text-muted').trim() || '#71717a',
      borderColor: cs.getPropertyValue('--border').trim() || '#3f3f46',
      gridColor: cs.getPropertyValue('--grid-color').trim() || '#27272a',
      bgSurface: cs.getPropertyValue('--bg-surface').trim() || '#27272a',
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, chartConfig.exportConfig.background]);

  const colorScale = useMemo(() => toPlotlyColorScale(chartConfig.colorMap), [chartConfig.colorMap]);

  // --- Build Plotly traces (memoized) ---
  const traces = useMemo<Record<string, unknown>[]>(() => {
    if (is3DType) {
      return expandedDatasets.map((entry) => {
        const { label, xCol, yCol, zCol, color, layer } = entry;
        const xValues = colToNumbers(xCol);
        const yValues = colToNumbers(yCol);

        if (chartType === 'surface3d' && zCol) {
          const zValues = colToNumbers(zCol);
          const { x: uniqueX, y: uniqueY, z: zMatrix } = extractGridData(xValues, yValues, zValues);

          return {
            type: 'surface',
            name: label,
            x: uniqueX,
            y: uniqueY,
            z: zMatrix,
            colorscale: colorScale,
            opacity: layer.fill ? 0.8 : 1,
            showscale: true,
            colorbar: {
              title: { text: chartConfig.zAxis?.label || zCol.name, font: { size: chartConfig.fontSize, color: cssVars.textSecondary } },
              tickfont: { size: chartConfig.fontSize - 1, color: cssVars.textMuted },
            },
            contours: {
              z: { show: true, usecolormap: true, highlightcolor: '#fff', project: { z: false } },
            },
            lighting: { ambient: 0.6, diffuse: 0.8, specular: 0.3, roughness: 0.5, fresnel: 0.2 },
            lightposition: { x: 1000, y: 1000, z: 1000 },
          };
        }

        if (chartType === 'contour3d' && zCol) {
          const zValues = colToNumbers(zCol);
          const { x: uniqueX, y: uniqueY, z: zMatrix } = extractGridData(xValues, yValues, zValues);

          return {
            type: 'surface',
            name: label,
            x: uniqueX,
            y: uniqueY,
            z: zMatrix,
            colorscale: colorScale,
            opacity: 0.9,
            showscale: true,
            colorbar: {
              title: { text: chartConfig.zAxis?.label || zCol.name, font: { size: chartConfig.fontSize, color: cssVars.textSecondary } },
              tickfont: { size: chartConfig.fontSize - 1, color: cssVars.textMuted },
            },
            contours: {
              x: { show: true, usecolormap: true, highlightcolor: '#fff', project: { x: true } },
              y: { show: true, usecolormap: true, highlightcolor: '#fff', project: { y: true } },
              z: { show: true, usecolormap: true, highlightcolor: '#fff', project: { z: true } },
            },
          };
        }

        if (chartType === 'scatter3d') {
          const zValues = zCol ? colToNumbers(zCol) : xValues.map(() => 0);
          const indices = xValues.map((_, i) => i).filter((i) =>
            isValidNumber(xValues[i]) && isValidNumber(yValues[i]) && isValidNumber(zValues[i])
          );
          return {
            type: 'scatter3d',
            mode: layer.pointStyle === 'none' ? 'lines' : 'lines+markers',
            name: label,
            x: indices.map((i) => xValues[i]),
            y: indices.map((i) => yValues[i]),
            z: indices.map((i) => zValues[i]),
            marker: {
              size: layer.pointStyle === 'none' ? 0 : layer.pointSize,
              color: color,
              symbol: 'circle',
            },
            line: {
              color,
              width: layer.lineWidth,
              dash: lineStyleToDash(layer.lineStyle),
            },
          };
        }

        if (chartType === 'bar3d' && zCol) {
          const zValues = colToNumbers(zCol);
          const indices = xValues.map((_, i) => i).filter((i) =>
            isValidNumber(xValues[i]) && isValidNumber(yValues[i]) && isValidNumber(zValues[i])
          );
          return {
            type: 'scatter3d',
            mode: 'markers',
            name: label,
            x: indices.map((i) => xValues[i]),
            y: indices.map((i) => yValues[i]),
            z: indices.map((i) => zValues[i]),
            marker: {
              size: layer.pointSize * 2,
              color: color,
              symbol: 'square',
            },
          };
        }

        if (chartType === 'isosurface3d' && zCol) {
          const zValues = colToNumbers(zCol);
          const indices = xValues.map((_, i) => i).filter((i) =>
            isValidNumber(xValues[i]) && isValidNumber(yValues[i]) && isValidNumber(zValues[i])
          );
          const vals = indices.map((i) => zValues[i]);
          const isoMin = Math.min(...vals);
          const isoMax = Math.max(...vals);
          return {
            type: 'isosurface',
            name: label,
            x: indices.map((i) => xValues[i]),
            y: indices.map((i) => yValues[i]),
            z: indices.map((i) => zValues[i]),
            value: vals,
            isomin: isoMin,
            isomax: isoMax,
            surface: { show: true, count: 3, fill: 0.7 },
            caps: { x: { show: true }, y: { show: true }, z: { show: true } },
            colorscale: colorScale,
            showscale: true,
            colorbar: {
              title: { text: chartConfig.zAxis?.label || zCol.name, font: { size: chartConfig.fontSize, color: cssVars.textSecondary } },
              tickfont: { size: chartConfig.fontSize - 1, color: cssVars.textMuted },
            },
            opacity: layer.fill ? 0.8 : 1,
            lighting: { ambient: 0.6, diffuse: 0.8, specular: 0.3, roughness: 0.5 },
            lightposition: { x: 1000, y: 1000, z: 1000 },
          };
        }

        if (chartType === 'volume3d' && zCol) {
          const zValues = colToNumbers(zCol);
          const indices = xValues.map((_, i) => i).filter((i) =>
            isValidNumber(xValues[i]) && isValidNumber(yValues[i]) && isValidNumber(zValues[i])
          );
          const vals = indices.map((i) => zValues[i]);
          const volMin = Math.min(...vals);
          const volMax = Math.max(...vals);
          return {
            type: 'volume',
            name: label,
            x: indices.map((i) => xValues[i]),
            y: indices.map((i) => yValues[i]),
            z: indices.map((i) => zValues[i]),
            value: vals,
            isomin: volMin + (volMax - volMin) * 0.25,
            isomax: volMax,
            opacity: 0.3,
            surface: { show: true, count: 5 },
            colorscale: colorScale,
            showscale: true,
            colorbar: {
              title: { text: chartConfig.zAxis?.label || zCol.name, font: { size: chartConfig.fontSize, color: cssVars.textSecondary } },
              tickfont: { size: chartConfig.fontSize - 1, color: cssVars.textMuted },
            },
            lighting: { ambient: 0.6, diffuse: 0.8, specular: 0.3, roughness: 0.5 },
            lightposition: { x: 1000, y: 1000, z: 1000 },
          };
        }

        return {
          type: 'scatter3d',
          mode: 'markers',
          name: label,
          x: colToNumbers(xCol),
          y: colToNumbers(yCol),
          z: zCol ? colToNumbers(zCol) : colToNumbers(yCol),
          marker: { size: layer.pointSize, color },
        };
      });
    } else {
      return expandedDatasets.map((entry) => {
        const { label, xCol, yCol, zCol, color, layer } = entry;
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

        // --- Box plot: distribution of Y values ---
        if (chartType === 'box') {
          const validY = yValues.filter((v) => Number.isFinite(v));
          return {
            type: 'box' as const,
            name: label,
            y: validY,
            x: [label],
            marker: { color, outliercolor: color },
            boxpoints: 'outliers',
            line: { color },
            boxmean: 'sd',
          };
        }

        // --- Histogram: frequency distribution of Y values ---
        if (chartType === 'histogram') {
          const validY = yValues.filter((v) => Number.isFinite(v));
          return {
            type: 'histogram' as const,
            name: label,
            x: validY,
            marker: { color, opacity: 0.7, line: { color, width: 1 } },
            opacity: 0.7,
            nbinsx: Math.max(5, Math.min(50, Math.ceil(Math.sqrt(validY.length)))),
          };
        }

        // --- Violin: density distribution of Y values ---
        if (chartType === 'violin') {
          const validY = yValues.filter((v) => Number.isFinite(v));
          return {
            type: 'violin' as const,
            name: label,
            y: validY,
            x: [label],
            points: 'outliers',
            marker: { color, outliercolor: color },
            line: { color },
            box: { visible: true },
            meanline: { visible: true },
            opacity: 0.7,
          };
        }

        // --- Heatmap: Z values over X/Y grid ---
        if (chartType === 'heatmap' && zCol) {
          const zValues = colToNumbers(zCol);
          const { x: uniqueX, y: uniqueY, z: zMatrix } = extractGridData(xValues, yValues, zValues);
          return {
            type: 'heatmap' as const,
            name: label,
            x: uniqueX,
            y: uniqueY,
            z: zMatrix,
            colorscale: colorScale,
            showscale: true,
            colorbar: {
              title: { text: chartConfig.zAxis?.label || zCol.name, font: { size: chartConfig.fontSize, color: cssVars.textSecondary } },
              tickfont: { size: chartConfig.fontSize - 1, color: cssVars.textMuted },
            },
          };
        }

        if (isPie) {
          return {
            type: 'pie' as const,
            labels: xCol.values.map(String),
            values: yValues,
            marker: { colors: generateSegmentColors(yValues.length, 0.85, color) },
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

        const errY = buildErrorBar(entry.errorCol, entry.errorPlusCol, entry.errorMinusCol, color, layer.errorBarConfig, xCol, yCol);
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

        const errX = buildErrorBar(entry.errorXCol, entry.errorXPlusCol, entry.errorXMinusCol, color, layer.errorBarConfig, xCol, yCol);
        if (errX) {
          if (useNumericX && (xLogScale || yLogScale)) {
            const errorArray = errX.array as number[];
            const errorMinusArray = errX.arrayminus as number[] | undefined;
            errX.array = errorArray.filter((_, i) => filterIndices[i]);
            if (errorMinusArray) {
              errX.arrayminus = errorMinusArray.filter((_, i) => filterIndices[i]);
            }
          }
          trace.error_x = errX;
        }

        return trace;
      });
    }
  }, [expandedDatasets, chartType, is3DType, isPie, isPolar, isScatter, useNumericX, chartConfig, colorScale, cssVars]);

  // --- Build Plotly layout (memoized) ---
  const layout = useMemo<Record<string, unknown>>(() => {
    const base = buildLayout(chartConfig, cssVars, is3DType, isNoAxes, isPolar, expandedDatasets, useNumericX, chartConfig.exportConfig.background);
    // Overlay bars/boxes when multiple datasets are present
    if (chartType === 'histogram') base.barmode = 'overlay';
    if (chartType === 'box') base.boxmode = 'group';
    return base;
  }, [chartConfig, cssVars, is3DType, isNoAxes, isPolar, expandedDatasets, useNumericX, chartType]);

  const plotlyConfig = useMemo(() => ({
    responsive: true,
    displayModeBar: false,
    scrollZoom: true,
  }), []);

  if (!PlotlyComponent) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        {t('chart2d.loading', 'Loading chart...')}
      </div>
    );
  }

  if (expandedDatasets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        {t('chart2d.addLayer')}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{
        background: chartConfig.exportConfig.background === 'white'
          ? '#ffffff'
          : 'var(--chart-bg)',
      }}
      onContextMenu={handleChartContextMenu}
      data-chart-area
      {...(is3DType ? { 'data-chart-area-3d': 'true' } : {})}
    >
      <PlotlyComponent
        data={traces}
        layout={layout}
        config={plotlyConfig}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
        onHover={handleHover}
        onUnhover={() => setHover(null)}
        onRelayout={handleRelayout}
      />
      {!is3DType && (
        <AnnotationOverlay
          annotations={chartConfig.annotations}
          chartArea={chartArea}
          plotDivRef={containerRef}
          onMoveAnnotation={handleMoveAnnotation}
          onDragEnd={handleDragEnd}
        />
      )}
    </div>
  );
}
