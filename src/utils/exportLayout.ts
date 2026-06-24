/**
 * Helpers for preparing Plotly data/layout for high-quality export.
 *
 * The web UI uses modest pixel sizes that look good on screen. When the chart
 * is exported to a high-resolution image and embedded in documents, those same
 * pixel fonts and thin curves can appear too small. We therefore scale font
 * sizes, margins, and trace line widths only for the export render, leaving
 * the workspace view unchanged.
 */

import type { ChartConfig, ExportBackground } from '@/types';
import {
  type ChartCssVars,
  LIGHT_CHART_CSS_VARS,
  getThemeCssVars,
} from '@/utils/layoutBuilder';

const FONT_KEYS = new Set([
  'font',
  'tickfont',
  'titlefont',
  'rangefont',
  'labelfont',
  'cfont',
  'colorbar',
]);

function scaleFontSizes(obj: unknown, scale: number): void {
  if (typeof obj !== 'object' || obj === null) return;
  if (Array.isArray(obj)) {
    obj.forEach((item) => scaleFontSizes(item, scale));
    return;
  }
  const record = obj as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (FONT_KEYS.has(key) && typeof value === 'object' && value !== null) {
      const font = value as Record<string, unknown>;
      if (typeof font.size === 'number') {
        font.size = font.size * scale;
      }
    }
    if (typeof value === 'object' && value !== null) {
      scaleFontSizes(value, scale);
    }
  }
}

function scaleMargins(layout: Record<string, unknown>, scale: number): void {
  const margin = layout.margin as Record<string, number> | undefined;
  if (!margin) return;
  for (const key of ['t', 'r', 'b', 'l']) {
    if (typeof margin[key] === 'number') {
      margin[key] = margin[key] * scale;
    }
  }
}

function scaleTraceLineWidths(data: Record<string, unknown>[], scale: number): void {
  for (const trace of data) {
    const line = trace.line as Record<string, unknown> | undefined;
    if (line && typeof line.width === 'number') {
      line.width = line.width * scale;
    }
    const marker = trace.marker as Record<string, unknown> | undefined;
    if (marker) {
      if (typeof marker.size === 'number') {
        marker.size = marker.size * scale;
      }
      const markerLine = marker.line as Record<string, unknown> | undefined;
      if (markerLine && typeof markerLine.width === 'number') {
        markerLine.width = markerLine.width * scale;
      }
    }
    for (const key of ['error_y', 'error_x'] as const) {
      const err = trace[key] as Record<string, unknown> | undefined;
      if (err && typeof err.thickness === 'number') {
        err.thickness = err.thickness * scale;
      }
    }
  }
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Return a deep-cloned layout with font sizes and margins scaled by `scale`.
 * The original layout object is not mutated.
 */
export function scaleLayoutForExport(
  layout: Record<string, unknown>,
  scale = 2,
): Record<string, unknown> {
  const cloned = deepClone(layout);
  scaleFontSizes(cloned, scale);
  scaleMargins(cloned, scale);
  return cloned;
}

/** Keys whose string values are colors and should be remapped for export. */
const COLOR_KEYS = new Set([
  'color',
  'colors',
  'bgcolor',
  'backgroundcolor',
  'paper_bgcolor',
  'plot_bgcolor',
  'gridcolor',
  'linecolor',
  'tickcolor',
  'zerolinecolor',
  'bordercolor',
  'fillcolor',
  'outlinecolor',
  'outliercolor',
  'highlightcolor',
]);

function replaceColorsInObject(obj: unknown, colorMap: Record<string, string>): void {
  if (typeof obj !== 'object' || obj === null) return;
  if (Array.isArray(obj)) {
    obj.forEach((item) => replaceColorsInObject(item, colorMap));
    return;
  }
  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (typeof value === 'string' && COLOR_KEYS.has(key.toLowerCase()) && value in colorMap) {
      record[key] = colorMap[value];
    } else if (typeof value === 'object' && value !== null) {
      replaceColorsInObject(value, colorMap);
    }
  }
}

/**
 * Remap the cloned data/layout colors so that the exported image honors the
 * configured export background independently of the app's current theme.
 */
function applyExportColors(
  data: Record<string, unknown>[],
  layout: Record<string, unknown>,
  exportBackground: ExportBackground,
): void {
  const currentVars = getThemeCssVars();
  const exportVars: ChartCssVars =
    exportBackground === 'white' ? LIGHT_CHART_CSS_VARS : currentVars;

  const colorMap: Record<string, string> = {};
  for (const key of Object.keys(currentVars) as Array<keyof ChartCssVars>) {
    const from = currentVars[key];
    const to = exportVars[key];
    if (from !== to) colorMap[from] = to;
  }

  if (Object.keys(colorMap).length > 0) {
    replaceColorsInObject(data, colorMap);
    replaceColorsInObject(layout, colorMap);
  }

  if (exportBackground === 'transparent') {
    layout.paper_bgcolor = 'rgba(0,0,0,0)';
    layout.plot_bgcolor = 'rgba(0,0,0,0)';
    if (typeof layout.scene === 'object' && layout.scene !== null) {
      const scene = layout.scene as Record<string, unknown>;
      scene.bgcolor = 'rgba(0,0,0,0)';
      for (const axis of ['xaxis', 'yaxis', 'zaxis'] as const) {
        const ax = scene[axis] as Record<string, unknown> | undefined;
        if (ax) ax.backgroundcolor = 'rgba(0,0,0,0)';
      }
    }
  }
}

interface PlotlyDivLike extends HTMLElement {
  data: Record<string, unknown>[];
  layout: Record<string, unknown>;
  _fullLayout?: { width?: number; height?: number };
}

/**
 * Build the `{ data, layout }` payload used by Plotly.toImage / downloadImage
 * with fonts and margins scaled for export. Width/height are read from the
 * rendered Plotly div so the exported aspect ratio matches the workspace.
 *
 * Colors are adjusted based on `chartConfig.exportConfig.background` so that
 * exports keep their configured background even when the workspace is using a
 * different theme.
 */
export function buildExportPayload(
  plotlyDiv: HTMLElement,
  chartConfig: ChartConfig,
  exportScale = 2,
): {
  data: Record<string, unknown>[];
  layout: Record<string, unknown>;
  width: number;
  height: number;
} {
  const div = plotlyDiv as PlotlyDivLike;
  const data = deepClone(div.data);
  const layout = deepClone(div.layout);
  applyExportColors(data, layout, chartConfig.exportConfig.background);
  scaleTraceLineWidths(data, exportScale);
  const scaledLayout = scaleLayoutForExport(layout, exportScale);
  const width = div._fullLayout?.width ?? div.clientWidth;
  const height = div._fullLayout?.height ?? div.clientHeight;
  return { data, layout: scaledLayout, width, height };
}

/**
 * Export a 3D chart to PNG using a temporary off-screen render so that the
 * configured export background is honored independently of the workspace theme.
 */
export async function export3DToPng(
  plotlyDiv: HTMLElement,
  chartConfig: ChartConfig,
  options: {
    scale?: number;
    backgroundColor?: string;
    width?: number;
    height?: number;
  } = {},
): Promise<string> {
  const { data, layout, width, height } = buildExportPayload(plotlyDiv, chartConfig, 1);
  const targetWidth = options.width ?? width;
  const targetHeight = options.height ?? height;

  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'fixed';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '-9999px';
  tempDiv.style.width = `${targetWidth}px`;
  tempDiv.style.height = `${targetHeight}px`;
  document.body.appendChild(tempDiv);

  try {
    const Plotly = (await import('plotly.js-dist-min')).default;
    const { toPng } = await import('html-to-image');
    await Plotly.newPlot(tempDiv, data, layout, {
      responsive: false,
      displayModeBar: false,
    });
    // Give WebGL a frame to finish rendering before capturing.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return await toPng(tempDiv, {
      pixelRatio: options.scale ?? 1,
      backgroundColor: options.backgroundColor,
    });
  } finally {
    document.body.removeChild(tempDiv);
  }
}
