export interface DataColumn {
  id: string;
  name: string;
  type: 'X' | 'Y' | 'Z' | 'label' | 'error' | 'errorPlus' | 'errorMinus';
  values: (number | string)[];
  /**
   * Optional inferred semantic type of the column. Used by the layout builder to
   * pick Plotly axis types (e.g. `'date'`) without forcing the user to flip a
   * timezone switch. Defaults to `'number'` when omitted (legacy files).
   */
  valueType?: 'number' | 'date' | 'category';
}

/** Helper to safely convert column values to numbers */
export function toNumber(v: number | string): number {
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  if (typeof v === 'string' && v.trim() === '') return NaN;
  const n = Number(v);
  return isNaN(n) || !isFinite(n) ? NaN : n;
}

/** Helper to check if a value is a valid number */
export function isValidNumber(v: number | string): boolean {
  return !isNaN(toNumber(v));
}

/**
 * Date / time string patterns we treat as a Plotly `date` axis.
 * Includes ISO 8601 (`2026-07-07T17:12:00Z`), `YYYY-MM-DD HH:mm:ss`,
 * `YYYY-MM-DD`, and US-style `MM/DD/YYYY HH:mm[:ss]`.
 *
 * Deliberately strict — false positives (e.g. `"1.2.3"`) would silently
 * misclassify numeric data, so the regex requires either an ISO-shaped
 * (`YYYY-MM-DD`) or unambiguous slash-separated date with an optional
 * time component.
 */
const DATE_REGEXES: RegExp[] = [
  /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/,
  /^\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s\d{1,2}:\d{2}(?::\d{2})?)?$/,
];

/** Returns true if a single value looks like a date/time string. */
export function hasTimeString(v: number | string): boolean {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (s === '') return false;
  if (!DATE_REGEXES.some((re) => re.test(s))) return false;
  const ms = Date.parse(s);
  return Number.isFinite(ms);
}

/**
 * Infer the semantic type of a column from its values.
 * - Empty or all-non-finite → `'number'` (caller's choice)
 * - Any string samples that parse as numbers → `'number'`
 * - All non-empty samples look like date strings → `'date'`
 * - Otherwise (e.g. free-form labels) → `'category'`
 *
 * Scans up to `sampleSize` non-null samples; defaults to 32.
 */
export function detectColumnType(
  values: (number | string)[],
  sampleSize: number = 32,
): 'number' | 'date' | 'category' {
  let numericCount = 0;
  let dateCount = 0;
  let nonEmptyCount = 0;
  const limit = Math.min(values.length, sampleSize);
  for (let i = 0; i < limit; i++) {
    const v = values[i];
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    nonEmptyCount++;
    if (hasTimeString(v)) {
      dateCount++;
    } else if (isValidNumber(v)) {
      numericCount++;
    }
  }
  if (nonEmptyCount === 0) return 'number';
  if (dateCount === nonEmptyCount) return 'date';
  if (numericCount === nonEmptyCount) return 'number';
  return 'category';
}

export interface Dataset {
  id: string;
  name: string;
  columns: DataColumn[];
}

export interface AxisConfig {
  label: string;
  /** Optional unit displayed alongside the label, e.g. "s" or "mol/L" */
  unit?: string;
  min?: number;
  max?: number;
  autoRange: boolean;
  gridVisible: boolean;
  logScale: boolean;
  scientificNotation: boolean;
  /** Force categorical axis (e.g. for bar charts). Undefined means auto. */
  categoryAxis?: boolean;
  /** Tick label rotation angle in degrees. */
  tickAngle?: number;
  /**
   * Phase 4 Task 4.1: time / date axis support.
   * When set, the X axis is rendered as a Plotly `date` type. The value is a
   * IANA timezone name (e.g. "UTC", "America/New_York"); when omitted,
   * defaults to "UTC". The `unit` field annotates the timezone in the axis
   * label when it differs from "UTC" (e.g. "Time (NY)"). */
  timezone?: string;
}

export interface LegendConfig {
  visible: boolean;
  position: 'top' | 'bottom' | 'left' | 'right' | 'inside-top-right' | 'inside-top-left' | 'inside-bottom-right' | 'inside-bottom-left';
  bordered?: boolean;
}

export interface LayerConfig {
  id: string;
  datasetId: string;
  xColumn: string;
  yColumn: string;
  zColumn?: string;
  color: string;
  visible: boolean;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  lineWidth: number;
  pointStyle: 'circle' | 'square' | 'triangle' | 'none';
  pointSize: number;
  fill: boolean;
  /** Fill opacity for area / filled traces (0-1). */
  fillOpacity?: number;
  /** Custom fill color. If omitted, the layer line color is used with fillOpacity applied. */
  fillColor?: string;
  errorColumn?: string;
  errorPlusColumn?: string;
  errorMinusColumn?: string;
  /** X-direction error bar column (symmetric) */
  errorXColumn?: string;
  /** X-direction error bar plus column (asymmetric) */
  errorXPlusColumn?: string;
  /** X-direction error bar minus column (asymmetric) */
  errorXMinusColumn?: string;
  /** Y-axis side for multi-axis plots */
  yAxisSide?: 'left' | 'right';
  /** Display name for legend (defaults to dataset-column name) */
  displayName?: string;
  /** Whether the layer is locked (cannot be edited/deleted). */
  locked?: boolean;
  /** Error bar configuration: type source + visual style. */
  errorBarConfig?: ErrorBarConfig;
}

/** Error bar configuration.
 *  - type 'custom': use explicit error columns (errorColumn / errorPlusColumn / errorMinusColumn).
 *  - type 'sd'/'se'/'ci95': compute error from Y values grouped by X (for repeated measurements).
 */
export interface ErrorBarConfig {
  type: 'sd' | 'se' | 'ci95' | 'custom';
  /** Cap width in pixels. */
  capWidth: number;
  /** Cap style: 'line' (default Plotly caps) or 'bracket'. */
  capStyle: 'line' | 'bracket';
  /** Whether to show the end caps. */
  showCap: boolean;
  /** Whether the error bar is asymmetric (uses errorPlus/errorMinus columns for 'custom'). */
  asymmetric: boolean;
  /** Line thickness. */
  thickness: number;
}

export type AnnotationType =
  | 'text'
  | 'latex'
  | 'callout'
  | 'arrow'
  | 'line'
  | 'bracket'
  | 'rect'
  | 'ellipse'
  | 'polygon'
  | 'hline'
  | 'vline'
  | 'hband'
  | 'vband'
  | 'dataLabel'
  | 'image'
  | 'fitEquation';

export interface Annotation {
  id: string;
  type: AnnotationType;
  x: number;
  y: number;
  content: string;
  fontSize: number;
  color: string;
  visible: boolean;
  coordMode: 'percent' | 'data';
  locked?: boolean;
  zIndex?: number;

  // Generic shape styling
  fillColor?: string;
  fillOpacity?: number;
  fillVisible?: boolean; // when false, render shapes without a fill
  strokeWidth?: number;
  strokeDash?: 'solid' | 'dashed' | 'dotted';
  /** When false, render shape strokes (borders) invisible. Defaults true. */
  borderVisible?: boolean;
  opacity?: number;
  rotation?: number;

  // Text styling
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  textAlign?: 'left' | 'center' | 'right';
  textValign?: 'top' | 'middle' | 'bottom';
  backgroundColor?: string;
  padding?: number;
  borderRadius?: number;

  // Connectors and shapes
  arrowTo?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  rectSize?: { w: number; h: number };
  ellipseRadii?: { rx: number; ry: number };
  polygonPoints?: { x: number; y: number }[];
  bracketHeight?: number;
  bracketTopX?: number;
  bracketTopY?: number;

  // Reference lines / bands
  referenceValue?: number | [number, number];

  // Data attachment
  dataAttachment?: {
    layerId?: string;
    pointIndex?: number;
    xValue?: number;
    yValue?: number;
  };

  // Image
  imageSrc?: string;
  imageSize?: { w: number; h: number };
}

export type ChartType = 'line' | 'scatter' | 'bar' | 'area' | 'pie' | 'polar' | 'surface3d' | 'scatter3d' | 'contour3d' | 'bar3d' | 'box' | 'histogram' | 'heatmap' | 'violin' | 'isosurface3d' | 'volume3d';

export type ExportBackground = 'transparent' | 'white' | 'theme';

export interface ExportConfig {
  resolutionMultiplier: 1 | 2 | 4;
  background: ExportBackground;
  figureMultiplier: 1 | 2 | 3;
}

export interface Scene3DConfig {
  aspectMode: 'cube' | 'data' | 'manual';
  aspectRatio: { x: number; y: number; z: number };
  projection: 'perspective' | 'orthographic';
}

export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  /** Right Y-axis config for dual-axis plots. Used when any layer has yAxisSide='right'. */
  yAxisRight?: AxisConfig;
  zAxis?: AxisConfig;
  /** 3D scene configuration (aspect ratio and projection). */
  scene3D?: Scene3DConfig;
  legend: LegendConfig;
  colorMap: ColorMapName;
  layers: LayerConfig[];
  annotations: Annotation[];
  /** Phase 4 Task 4.5: inset plots (small panels embedded in the main chart). */
  insets?: InsetConfig[];
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  exportConfig: ExportConfig;
  fontSize: number;
}

export interface FigureConfig {
  /** Grid rows (>= 1). */
  rows: number;
  /** Grid columns (>= 1). */
  cols: number;
  /** Subplots in row-major order. Invariant: length === rows * cols. */
  subplots: ChartConfig[];
  /** Index of the subplot the config panels edit. In [0, subplots.length). */
  activeIndex: number;
  /** Gap between grid cells in px. */
  gap: number;
}

export type ColorMapName = 'jet' | 'viridis' | 'hot' | 'coolwarm' | 'parula' | 'plasma' | 'cividis' | 'inferno' | 'magma' | 'turbo' | 'batlow';

/**
 * Phase 4 Task 4.5: Inset (small panel embedded in the main chart).
 * v1 supports a static rectangular frame at one of four corners;
 * no drag / no collision detection (per spec).
 */
export type InsetPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface InsetConfig {
  id: string;
  visible: boolean;
  /** Inset position on the main chart (1-100 percent coordinates). */
  position: InsetPosition;
  /** Width in percent of the main chart area (default 25). */
  widthPercent?: number;
  /** Height in percent of the main chart area (default 25). */
  heightPercent?: number;
  /** Border color (default semi-transparent black). */
  borderColor?: string;
  /** Background color (default semi-transparent white). */
  backgroundColor?: string;
  /** Optional fixed X range (data coords); if omitted, uses paper coordinates only. */
  xRange?: [number, number];
  /** Optional fixed Y range (data coords); if omitted, uses paper coordinates only. */
  yRange?: [number, number];
}
