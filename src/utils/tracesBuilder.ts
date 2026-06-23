import type { DataColumn, LayerConfig, ColorMapName, ErrorBarConfig } from '@/types';
import { toNumber, isValidNumber } from '@/types';
import { colorMaps } from '@/utils/colormaps';
import { sampleStdDev, standardError, meanCI95HalfWidth } from '@/utils/statistics';

// Re-export colorMaps and ColorMapName so consumers can import them from here
export { colorMaps } from '@/utils/colormaps';
export type { ColorMapName } from '@/types';

/** Map line style to Plotly dash string */
export function lineStyleToDash(style: LayerConfig['lineStyle']): string {
  switch (style) {
    case 'dashed': return 'dash';
    case 'dotted': return 'dot';
    default: return 'solid';
  }
}

/** Map point style to Plotly marker symbol */
export function pointStyleToSymbol(style: LayerConfig['pointStyle']): string {
  switch (style) {
    case 'square': return 'square';
    case 'triangle': return 'triangle-up';
    case 'none': return 'circle';
    default: return 'circle';
  }
}

/** Convert hex color to HSL hue (0-360) */
export function hexToHue(hex: string): number {
  const sanitized = hex.replace('#', '');
  if (sanitized.length !== 6) return 200;
  const r = parseInt(sanitized.slice(0, 2), 16) / 255;
  const g = parseInt(sanitized.slice(2, 4), 16) / 255;
  const b = parseInt(sanitized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return h;
}

/** Convert column values to number array */
export function colToNumbers(col: DataColumn): number[] {
  return col.values.map((v) => toNumber(v));
}

/** Build error bar config for a trace.
 *  - If `errorBarConfig` is provided with type 'sd'/'se'/'ci95', the error is computed
 *    from the Y column by grouping Y values by their X value (for repeated measurements).
 *  - If `errorBarConfig.type` is 'custom' (or config is absent), the explicit error columns
 *    are used as before.
 */
export function buildErrorBar(
  errorCol: DataColumn | undefined,
  errorPlusCol: DataColumn | undefined,
  errorMinusCol: DataColumn | undefined,
  color: string,
  errorBarConfig?: ErrorBarConfig,
  xCol?: DataColumn,
  yCol?: DataColumn,
): Record<string, unknown> | undefined {
  const cfg = errorBarConfig;
  const capWidth = cfg?.capWidth ?? 6;
  const thickness = cfg?.thickness ?? 2;
  const showCap = cfg?.showCap ?? true;

  // Statistical error computation from raw Y data (grouped by X)
  if (cfg && cfg.type !== 'custom' && xCol && yCol) {
    const stats = computeGroupedError(xCol, yCol, cfg.type);
    if (!stats) return undefined;
    const result: Record<string, unknown> = {
      type: 'data',
      array: stats.array,
      visible: true,
      color,
      thickness,
      width: capWidth,
      symmetric: !cfg.asymmetric,
    };
    if (!showCap) {
      result.visible = true;
    }
    return result;
  }

  // Custom error columns (existing behavior)
  if (!errorCol && !errorPlusCol && !errorMinusCol) return undefined;

  if (errorCol && (!cfg || cfg.type === 'custom')) {
    return {
      type: 'data',
      array: colToNumbers(errorCol),
      visible: true,
      color,
      thickness,
      width: capWidth,
    };
  }

  const result: Record<string, unknown> = {
    type: 'data',
    visible: true,
    color,
    thickness,
    width: capWidth,
  };
  if (errorPlusCol) {
    result.array = colToNumbers(errorPlusCol);
  }
  if (errorMinusCol) {
    result.arrayminus = colToNumbers(errorMinusCol);
  }
  return Object.keys(result).length > 4 ? result : undefined;
}

/** Group Y values by their X value and compute per-group error (SD / SE / CI95 half-width).
 *  Returns an array aligned with the unique X values, or null if insufficient data. */
function computeGroupedError(
  xCol: DataColumn,
  yCol: DataColumn,
  type: 'sd' | 'se' | 'ci95',
): { array: number[] } | null {
  const xValues = colToNumbers(xCol);
  const yValues = colToNumbers(yCol);
  const groups = new Map<number, number[]>();
  for (let i = 0; i < Math.min(xValues.length, yValues.length); i++) {
    const x = xValues[i];
    const y = yValues[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const key = x;
    const arr = groups.get(key);
    if (arr) arr.push(y);
    else groups.set(key, [y]);
  }
  if (groups.size === 0) return null;
  const result: number[] = [];
  for (const [, ys] of groups) {
    if (ys.length < 2) {
      result.push(0);
      continue;
    }
    if (type === 'sd') {
      result.push(sampleStdDev(ys));
    } else if (type === 'se') {
      result.push(standardError(ys));
    } else {
      result.push(meanCI95HalfWidth(ys));
    }
  }
  return { array: result };
}

/** Build axis label text with optional unit, e.g. "Time (s)" */
export function axisLabelText(label?: string, unit?: string): string {
  if (!unit) return label || '';
  if (!label) return unit;
  return `${label} (${unit})`;
}

/** Convert our colormap to Plotly colorscale format */
export function toPlotlyColorScale(mapName: ColorMapName): Array<[number, string]> {
  const map = colorMaps[mapName];
  return map.map((color, i) => [i / (map.length - 1), color] as [number, string]);
}

/** Build a regular X/Y grid and Z matrix for surface/contour plots.
 *  Duplicate (x, y) cells average their z values instead of overwriting.
 */
export function extractGridData(
  xValues: number[],
  yValues: number[],
  zValues: number[],
): { x: number[]; y: number[]; z: (number | null)[][] } {
  const validIndices = xValues
    .map((_, i) => i)
    .filter((i) => isValidNumber(xValues[i]) && isValidNumber(yValues[i]) && isValidNumber(zValues[i]));

  const uniqueX = [...new Set(validIndices.map((i) => xValues[i]))].sort((a, b) => a - b);
  const uniqueY = [...new Set(validIndices.map((i) => yValues[i]))].sort((a, b) => a - b);

  const xIndex = new Map(uniqueX.map((v, i) => [v, i]));
  const yIndex = new Map(uniqueY.map((v, i) => [v, i]));

  // Accumulate z values and counts per cell to average duplicates
  const accumulators = new Map<string, { sum: number; count: number }>();
  for (const i of validIndices) {
    const xi = xIndex.get(xValues[i])!;
    const yi = yIndex.get(yValues[i])!;
    const key = `${yi},${xi}`;
    const prev = accumulators.get(key);
    if (prev) {
      prev.sum += zValues[i];
      prev.count += 1;
    } else {
      accumulators.set(key, { sum: zValues[i], count: 1 });
    }
  }

  const zMatrix: (number | null)[][] = uniqueY.map((_, yi) =>
    uniqueX.map((_, xi) => {
      const acc = accumulators.get(`${yi},${xi}`);
      return acc ? acc.sum / acc.count : null;
    })
  );

  return { x: uniqueX, y: uniqueY, z: zMatrix };
}

export interface ExpandedEntry {
  label: string;
  xCol: DataColumn;
  yCol: DataColumn;
  zCol?: DataColumn;
  color: string;
  layer: LayerConfig;
  datasetId: string;
  errorCol?: DataColumn;
  errorPlusCol?: DataColumn;
  errorMinusCol?: DataColumn;
  errorXCol?: DataColumn;
  errorXPlusCol?: DataColumn;
  errorXMinusCol?: DataColumn;
}
