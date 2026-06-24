/**
 * Helpers for preparing Plotly data/layout for high-quality export.
 *
 * The web UI uses modest pixel sizes that look good on screen. When the chart
 * is exported to a high-resolution image and embedded in documents, those same
 * pixel fonts and thin curves can appear too small. We therefore scale font
 * sizes, margins, and trace line widths only for the export render, leaving
 * the workspace view unchanged.
 */

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

interface PlotlyDivLike extends HTMLElement {
  data: Record<string, unknown>[];
  layout: Record<string, unknown>;
  _fullLayout?: { width?: number; height?: number };
}

/**
 * Build the `{ data, layout }` payload used by Plotly.toImage / downloadImage
 * with fonts and margins scaled for export. Width/height are read from the
 * rendered Plotly div so the exported aspect ratio matches the workspace.
 */
export function buildExportPayload(
  plotlyDiv: HTMLElement,
  exportScale = 2,
): {
  data: Record<string, unknown>[];
  layout: Record<string, unknown>;
  width: number;
  height: number;
} {
  const div = plotlyDiv as PlotlyDivLike;
  const data = deepClone(div.data);
  scaleTraceLineWidths(data, exportScale);
  const layout = scaleLayoutForExport(div.layout, exportScale);
  const width = div._fullLayout?.width ?? div.clientWidth;
  const height = div._fullLayout?.height ?? div.clientHeight;
  return { data, layout, width, height };
}
