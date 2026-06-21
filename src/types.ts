export interface DataColumn {
  id: string;
  name: string;
  type: 'X' | 'Y' | 'Z' | 'label' | 'error';
  values: (number | string)[];
}

export interface Dataset {
  id: string;
  name: string;
  columns: DataColumn[];
}

export interface AxisConfig {
  label: string;
  min?: number;
  max?: number;
  autoRange: boolean;
  gridVisible: boolean;
  tickCount?: number;
  logScale: boolean;
  scientificNotation: boolean;
}

export interface LegendConfig {
  visible: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
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

export type ChartType = 'line' | 'scatter' | 'bar' | 'area' | 'pie' | 'polar' | 'surface3d' | 'scatter3d' | 'contour3d' | 'bar3d';

export type ExportBackground = 'transparent' | 'white' | 'theme';

export interface ExportConfig {
  resolutionMultiplier: 1 | 2 | 4;
  background: ExportBackground;
}

export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  zAxis?: AxisConfig;
  legend: LegendConfig;
  colorMap: string;
  layers: LayerConfig[];
  annotations: Annotation[];
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  exportConfig: ExportConfig;
  fontSize: number;
}

export type ColorMapName = 'jet' | 'viridis' | 'hot' | 'coolwarm' | 'parula' | 'plasma';

export interface Scene3DConfig {
  cameraPosition: [number, number, number];
  lightAngle: [number, number];
  ambientIntensity: number;
  opacity: number;
  colorMap: ColorMapName;
  showAxes: boolean;
  showColorbar: boolean;
  antialias: boolean;
  bloom: boolean;
}
