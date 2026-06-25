export interface DataColumn {
  id: string;
  name: string;
  type: 'X' | 'Y' | 'Z' | 'label' | 'error' | 'errorPlus' | 'errorMinus';
  values: (number | string)[];
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
}

export interface LegendConfig {
  visible: boolean;
  position: 'top' | 'bottom' | 'left' | 'right' | 'inside-top-right' | 'inside-top-left' | 'inside-bottom-right' | 'inside-bottom-left';
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

export type AnnotationType = 'text' | 'arrow' | 'rect' | 'latex';

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
  arrowTo?: { x: number; y: number };
  rectSize?: { w: number; h: number };
}

export type ChartType = 'line' | 'scatter' | 'bar' | 'area' | 'pie' | 'polar' | 'surface3d' | 'scatter3d' | 'contour3d' | 'bar3d' | 'box' | 'histogram' | 'heatmap' | 'violin' | 'isosurface3d' | 'volume3d';

export type ExportBackground = 'transparent' | 'white' | 'theme';

export interface ExportConfig {
  resolutionMultiplier: 1 | 2 | 4;
  background: ExportBackground;
  figureMultiplier: 1 | 2 | 3;
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
  legend: LegendConfig;
  colorMap: ColorMapName;
  layers: LayerConfig[];
  annotations: Annotation[];
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  exportConfig: ExportConfig;
  fontSize: number;
}

export type ColorMapName = 'jet' | 'viridis' | 'hot' | 'coolwarm' | 'parula' | 'plasma' | 'cividis' | 'inferno' | 'magma' | 'turbo' | 'batlow';
