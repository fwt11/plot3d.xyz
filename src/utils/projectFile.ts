import type { Dataset, ChartConfig, DataColumn, FigureConfig, LayerConfig, Annotation, AnnotationType } from '@/types';

/** .plot3d project file format version */
const PROJECT_VERSION = 6;

const VALID_COLUMN_TYPES: DataColumn['type'][] = ['X', 'Y', 'Z', 'label', 'error', 'errorPlus', 'errorMinus'];
const VALID_CHART_TYPES: ChartConfig['type'][] = ['line', 'scatter', 'bar', 'area', 'pie', 'polar', 'surface3d', 'scatter3d', 'contour3d', 'bar3d', 'box', 'histogram', 'heatmap', 'violin', 'isosurface3d', 'volume3d'];
const VALID_COLORMAPS: ChartConfig['colorMap'][] = ['jet', 'viridis', 'hot', 'coolwarm', 'parula', 'plasma', 'cividis', 'inferno', 'magma', 'turbo', 'batlow'];
const VALID_ANNOTATION_TYPES: AnnotationType[] = [
  'text', 'callout', 'arrow', 'line', 'bracket', 'rect', 'ellipse', 'polygon',
  'hline', 'vline', 'hband', 'vband', 'dataLabel', 'image',
];

export interface ProjectFile {
  version: number;
  createdAt: string;
  updatedAt: string;
  datasets: Dataset[];
  figure: FigureConfig;
  theme: 'light' | 'dark';
  lang: 'zh' | 'en';
}

/** Serialize current application state into a ProjectFile */
export function serializeProject(state: {
  datasets: Dataset[];
  figure: FigureConfig;
  theme: 'light' | 'dark';
  lang: 'zh' | 'en';
}): ProjectFile {
  return {
    version: PROJECT_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    datasets: JSON.parse(JSON.stringify(state.datasets)),
    figure: JSON.parse(JSON.stringify(state.figure)),
    theme: state.theme,
    lang: state.lang,
  };
}

function isValidColumn(col: unknown): col is DataColumn {
  if (typeof col !== 'object' || col === null) return false;
  const c = col as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    VALID_COLUMN_TYPES.includes(c.type as DataColumn['type']) &&
    Array.isArray(c.values)
  );
}

function sanitizeDataset(ds: unknown): Dataset | null {
  if (typeof ds !== 'object' || ds === null) return null;
  const d = ds as Record<string, unknown>;
  if (typeof d.id !== 'string' || typeof d.name !== 'string' || !Array.isArray(d.columns)) return null;
  const columns = d.columns.map((c) => (isValidColumn(c) ? c : null)).filter((c): c is DataColumn => c !== null);
  if (columns.length === 0) return null;
  return { id: d.id, name: d.name, columns };
}

function sanitizeAxis(axis: unknown, fallbackLabel: string): ChartConfig['xAxis'] {
  if (typeof axis !== 'object' || axis === null) {
    return { label: fallbackLabel, autoRange: true, gridVisible: true, logScale: false, scientificNotation: false };
  }
  const a = axis as Record<string, unknown>;
  return {
    label: typeof a.label === 'string' ? a.label : fallbackLabel,
    unit: typeof a.unit === 'string' ? a.unit : undefined,
    autoRange: typeof a.autoRange === 'boolean' ? a.autoRange : true,
    gridVisible: typeof a.gridVisible === 'boolean' ? a.gridVisible : true,
    logScale: typeof a.logScale === 'boolean' ? a.logScale : false,
    scientificNotation: typeof a.scientificNotation === 'boolean' ? a.scientificNotation : false,
    min: typeof a.min === 'number' ? a.min : undefined,
    max: typeof a.max === 'number' ? a.max : undefined,
    categoryAxis: typeof a.categoryAxis === 'boolean' ? a.categoryAxis : undefined,
    tickAngle: typeof a.tickAngle === 'number' ? a.tickAngle : undefined,
  };
}

function sanitizeLayer(layer: unknown): LayerConfig | null {
  if (typeof layer !== 'object' || layer === null) return null;
  const l = layer as Record<string, unknown>;
  if (
    typeof l.id !== 'string' ||
    typeof l.datasetId !== 'string' ||
    typeof l.xColumn !== 'string' ||
    typeof l.yColumn !== 'string' ||
    typeof l.color !== 'string'
  ) {
    return null;
  }
  const errorBarConfig = sanitizeErrorBarConfig(l.errorBarConfig);
  return {
    id: l.id,
    datasetId: l.datasetId,
    xColumn: l.xColumn,
    yColumn: l.yColumn,
    zColumn: typeof l.zColumn === 'string' ? l.zColumn : undefined,
    color: l.color,
    visible: typeof l.visible === 'boolean' ? l.visible : true,
    lineStyle: ['solid', 'dashed', 'dotted'].includes(l.lineStyle as string) ? (l.lineStyle as LayerConfig['lineStyle']) : 'solid',
    lineWidth: typeof l.lineWidth === 'number' ? l.lineWidth : 3,
    pointStyle: ['circle', 'square', 'triangle', 'none'].includes(l.pointStyle as string) ? (l.pointStyle as LayerConfig['pointStyle']) : 'circle',
    pointSize: typeof l.pointSize === 'number' ? l.pointSize : 6,
    fill: typeof l.fill === 'boolean' ? l.fill : false,
    fillOpacity: typeof l.fillOpacity === 'number' ? Math.max(0, Math.min(1, l.fillOpacity)) : undefined,
    fillColor: typeof l.fillColor === 'string' ? l.fillColor : undefined,
    errorColumn: typeof l.errorColumn === 'string' ? l.errorColumn : undefined,
    errorPlusColumn: typeof l.errorPlusColumn === 'string' ? l.errorPlusColumn : undefined,
    errorMinusColumn: typeof l.errorMinusColumn === 'string' ? l.errorMinusColumn : undefined,
    errorXColumn: typeof l.errorXColumn === 'string' ? l.errorXColumn : undefined,
    errorXPlusColumn: typeof l.errorXPlusColumn === 'string' ? l.errorXPlusColumn : undefined,
    errorXMinusColumn: typeof l.errorXMinusColumn === 'string' ? l.errorXMinusColumn : undefined,
    yAxisSide: l.yAxisSide === 'right' ? 'right' : 'left',
    displayName: typeof l.displayName === 'string' ? l.displayName : undefined,
    errorBarConfig,
  };
}

function sanitizeErrorBarConfig(cfg: unknown): LayerConfig['errorBarConfig'] | undefined {
  if (typeof cfg !== 'object' || cfg === null) return undefined;
  const c = cfg as Record<string, unknown>;
  const type = ['sd', 'se', 'ci95', 'custom'].includes(c.type as string) ? (c.type as 'sd' | 'se' | 'ci95' | 'custom') : 'custom';
  return {
    type,
    capWidth: typeof c.capWidth === 'number' ? c.capWidth : 6,
    capStyle: c.capStyle === 'bracket' ? 'bracket' : 'line',
    showCap: typeof c.showCap === 'boolean' ? c.showCap : true,
    asymmetric: typeof c.asymmetric === 'boolean' ? c.asymmetric : false,
    thickness: typeof c.thickness === 'number' ? c.thickness : 2,
  };
}

function sanitizeAnnotation(ann: unknown): Annotation | null {
  if (typeof ann !== 'object' || ann === null) return null;
  const a = ann as Record<string, unknown>;
  if (typeof a.id !== 'string' || typeof a.x !== 'number' || typeof a.y !== 'number') return null;
  const rawType = a.type as string;
  const type: AnnotationType = VALID_ANNOTATION_TYPES.includes(rawType as AnnotationType)
    ? (rawType as AnnotationType)
    : rawType === 'latex'
      ? 'text'
      : 'text';

  const coordMode = a.coordMode === 'data' ? 'data' : 'percent';
  const parsePoint = (p: unknown): { x: number; y: number } | undefined => {
    if (typeof p !== 'object' || p === null) return undefined;
    const pt = p as Record<string, unknown>;
    if (typeof pt.x !== 'number' || typeof pt.y !== 'number') return undefined;
    return { x: pt.x, y: pt.y };
  };
  const parseNumberPair = (v: unknown): [number, number] | undefined => {
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number') {
      return [v[0], v[1]];
    }
    return undefined;
  };

  const annotation: Annotation = {
    id: a.id,
    type,
    x: a.x,
    y: a.y,
    content: typeof a.content === 'string' ? a.content : '',
    fontSize: typeof a.fontSize === 'number' ? a.fontSize : 14,
    color: typeof a.color === 'string' ? a.color : '#3b82f6',
    visible: typeof a.visible === 'boolean' ? a.visible : true,
    coordMode,
    locked: typeof a.locked === 'boolean' ? a.locked : undefined,
    zIndex: typeof a.zIndex === 'number' ? a.zIndex : undefined,
    fillColor: typeof a.fillColor === 'string' ? a.fillColor : undefined,
    fillOpacity: typeof a.fillOpacity === 'number' ? a.fillOpacity : undefined,
    strokeWidth: typeof a.strokeWidth === 'number' ? a.strokeWidth : undefined,
    strokeDash: ['solid', 'dashed', 'dotted'].includes(a.strokeDash as string) ? (a.strokeDash as 'solid' | 'dashed' | 'dotted') : undefined,
    opacity: typeof a.opacity === 'number' ? a.opacity : undefined,
    rotation: typeof a.rotation === 'number' ? a.rotation : undefined,
    fontFamily: typeof a.fontFamily === 'string' ? a.fontFamily : undefined,
    fontWeight: a.fontWeight === 'bold' ? 'bold' : undefined,
    textAlign: ['left', 'center', 'right'].includes(a.textAlign as string) ? (a.textAlign as 'left' | 'center' | 'right') : undefined,
    textValign: ['top', 'middle', 'bottom'].includes(a.textValign as string) ? (a.textValign as 'top' | 'middle' | 'bottom') : undefined,
    backgroundColor: typeof a.backgroundColor === 'string' ? a.backgroundColor : undefined,
    padding: typeof a.padding === 'number' ? a.padding : undefined,
    borderRadius: typeof a.borderRadius === 'number' ? a.borderRadius : undefined,
    arrowTo: parsePoint(a.arrowTo),
    endPoint: parsePoint(a.endPoint),
    rectSize: typeof a.rectSize === 'object' && a.rectSize !== null
      ? { w: Number((a.rectSize as Record<string, unknown>).w), h: Number((a.rectSize as Record<string, unknown>).h) }
      : undefined,
    ellipseRadii: typeof a.ellipseRadii === 'object' && a.ellipseRadii !== null
      ? { rx: Number((a.ellipseRadii as Record<string, unknown>).rx), ry: Number((a.ellipseRadii as Record<string, unknown>).ry) }
      : undefined,
    polygonPoints: Array.isArray(a.polygonPoints)
      ? a.polygonPoints.map(parsePoint).filter((p): p is { x: number; y: number } => p !== undefined)
      : undefined,
    bracketHeight: typeof a.bracketHeight === 'number' ? a.bracketHeight : undefined,
    referenceValue: typeof a.referenceValue === 'number' ? a.referenceValue : parseNumberPair(a.referenceValue),
    dataAttachment: typeof a.dataAttachment === 'object' && a.dataAttachment !== null
      ? {
          layerId: typeof (a.dataAttachment as Record<string, unknown>).layerId === 'string' ? (a.dataAttachment as Record<string, unknown>).layerId as string : undefined,
          pointIndex: typeof (a.dataAttachment as Record<string, unknown>).pointIndex === 'number' ? (a.dataAttachment as Record<string, unknown>).pointIndex as number : undefined,
          xValue: typeof (a.dataAttachment as Record<string, unknown>).xValue === 'number' ? (a.dataAttachment as Record<string, unknown>).xValue as number : undefined,
          yValue: typeof (a.dataAttachment as Record<string, unknown>).yValue === 'number' ? (a.dataAttachment as Record<string, unknown>).yValue as number : undefined,
        }
      : undefined,
    imageSrc: typeof a.imageSrc === 'string' ? a.imageSrc : undefined,
    imageSize: typeof a.imageSize === 'object' && a.imageSize !== null
      ? { w: Number((a.imageSize as Record<string, unknown>).w), h: Number((a.imageSize as Record<string, unknown>).h) }
      : undefined,
  };

  // Ensure old arrow/rect annotations still have required shape fields
  if ((type === 'arrow' || type === 'callout') && !annotation.arrowTo) {
    annotation.arrowTo = { x: annotation.x + 20, y: annotation.y - 20 };
  }
  if (type === 'rect' && !annotation.rectSize) {
    annotation.rectSize = { w: 20, h: 15 };
  }
  if (type === 'line' && !annotation.endPoint) {
    annotation.endPoint = { x: annotation.x + 20, y: annotation.y - 20 };
  }

  return annotation;
}

function sanitizeChartConfig(config: unknown): ChartConfig | null {
  if (typeof config !== 'object' || config === null) return null;
  const c = config as Record<string, unknown>;
  if (typeof c.id !== 'string') return null;

  const type = VALID_CHART_TYPES.includes(c.type as ChartConfig['type']) ? (c.type as ChartConfig['type']) : 'line';
  const colorMap = VALID_COLORMAPS.includes(c.colorMap as ChartConfig['colorMap']) ? (c.colorMap as ChartConfig['colorMap']) : 'viridis';

  const legend = typeof c.legend === 'object' && c.legend !== null
    ? c.legend as { visible?: boolean; position?: string; bordered?: boolean }
    : {};

  const exportConfig = typeof c.exportConfig === 'object' && c.exportConfig !== null
    ? c.exportConfig as { resolutionMultiplier?: number; background?: string; figureMultiplier?: number }
    : {};

  const scene3D = typeof c.scene3D === 'object' && c.scene3D !== null
    ? c.scene3D as Record<string, unknown>
    : {};
  const aspectMode = ['cube', 'data', 'manual'].includes(scene3D.aspectMode as string)
    ? (scene3D.aspectMode as 'cube' | 'data' | 'manual')
    : 'cube';
  const aspectRatio = typeof scene3D.aspectRatio === 'object' && scene3D.aspectRatio !== null
    ? scene3D.aspectRatio as Record<string, unknown>
    : {};
  const projection = ['perspective', 'orthographic'].includes(scene3D.projection as string)
    ? (scene3D.projection as 'perspective' | 'orthographic')
    : 'orthographic';

  return {
    id: c.id,
    type,
    title: typeof c.title === 'string' ? c.title : '',
    xAxis: sanitizeAxis(c.xAxis, 'X'),
    yAxis: sanitizeAxis(c.yAxis, 'Y'),
    yAxisRight: c.yAxisRight ? sanitizeAxis(c.yAxisRight, 'Y2') : undefined,
    zAxis: type.startsWith('surface') || type === 'scatter3d' || type === 'contour3d' || type === 'bar3d' || type === 'isosurface3d' || type === 'volume3d'
      ? sanitizeAxis(c.zAxis, 'Z')
      : undefined,
    legend: {
      visible: typeof legend.visible === 'boolean' ? legend.visible : true,
      position: ['top', 'bottom', 'left', 'right'].includes(legend.position as string) ? (legend.position as 'top' | 'bottom' | 'left' | 'right') : 'top',
      bordered: typeof legend.bordered === 'boolean' ? legend.bordered : false,
    },
    colorMap,
    layers: Array.isArray(c.layers)
      ? c.layers.map((l) => sanitizeLayer(l)).filter((l): l is LayerConfig => l !== null)
      : [],
    annotations: Array.isArray(c.annotations)
      ? c.annotations.map((a) => sanitizeAnnotation(a)).filter((a): a is Annotation => a !== null)
      : [],
    marginTop: typeof c.marginTop === 'number' ? c.marginTop : 40,
    marginRight: typeof c.marginRight === 'number' ? c.marginRight : 40,
    marginBottom: typeof c.marginBottom === 'number' ? c.marginBottom : 40,
    marginLeft: typeof c.marginLeft === 'number' ? c.marginLeft : 40,
    exportConfig: {
      resolutionMultiplier: [1, 2, 4].includes(exportConfig.resolutionMultiplier as number) ? (exportConfig.resolutionMultiplier as 1 | 2 | 4) : 2,
      background: ['transparent', 'white', 'theme'].includes(exportConfig.background as string) ? (exportConfig.background as 'transparent' | 'white' | 'theme') : 'transparent',
      figureMultiplier: [1, 2, 3].includes(exportConfig.figureMultiplier as number) ? (exportConfig.figureMultiplier as 1 | 2 | 3) : 1,
    },
    fontSize: typeof c.fontSize === 'number' ? c.fontSize : 16,
    manuallyManagedDatasetIds: Array.isArray(c.manuallyManagedDatasetIds)
      ? (c.manuallyManagedDatasetIds as unknown[]).filter((id): id is string => typeof id === 'string')
      : [],
    scene3D: {
      aspectMode,
      aspectRatio: {
        x: typeof aspectRatio.x === 'number' ? aspectRatio.x : 1,
        y: typeof aspectRatio.y === 'number' ? aspectRatio.y : 1,
        z: typeof aspectRatio.z === 'number' ? aspectRatio.z : 1,
      },
      projection,
    },
  };
}

/** Validate and sanitize a parsed object into a ProjectFile */
export function isValidProjectFile(data: unknown): data is ProjectFile {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.version === 'number' &&
    Array.isArray(obj.datasets) &&
    (
      (typeof obj.figure === 'object' && obj.figure !== null) ||
      (typeof obj.chartConfig === 'object' && obj.chartConfig !== null)
    )
  );
}

/** Drop layers whose dataset/column references no longer exist. */
function filterValidLayers(
  cfg: ChartConfig,
  datasetIds: Set<string>,
  columnIdsByDataset: Map<string, Set<string>>,
): ChartConfig {
  return {
    ...cfg,
    layers: cfg.layers.filter((layer) => {
      if (!datasetIds.has(layer.datasetId)) return false;
      const colIds = columnIdsByDataset.get(layer.datasetId);
      if (!colIds) return false;
      if (!colIds.has(layer.xColumn) || !colIds.has(layer.yColumn)) return false;
      if (layer.zColumn && !colIds.has(layer.zColumn)) return false;
      if (layer.errorColumn && !colIds.has(layer.errorColumn)) return false;
      if (layer.errorPlusColumn && !colIds.has(layer.errorPlusColumn)) return false;
      if (layer.errorMinusColumn && !colIds.has(layer.errorMinusColumn)) return false;
      if (layer.errorXColumn && !colIds.has(layer.errorXColumn)) return false;
      if (layer.errorXPlusColumn && !colIds.has(layer.errorXPlusColumn)) return false;
      if (layer.errorXMinusColumn && !colIds.has(layer.errorXMinusColumn)) return false;
      return true;
    }),
  };
}

/** Validate, sanitize, and fix dangling references in a ProjectFile */
export function sanitizeProjectFile(data: unknown): ProjectFile | null {
  if (!isValidProjectFile(data)) return null;
  // Re-widen to a loose record so we can read both v6 `figure` and legacy
  // v1..v5 `chartConfig` (the ProjectFile type only carries `figure` now).
  const rawData = data as unknown as Record<string, unknown>;

  const datasets = (rawData.datasets as unknown[]).map((d) => sanitizeDataset(d)).filter((d): d is Dataset => d !== null);
  const datasetIds = new Set(datasets.map((d) => d.id));
  const columnIdsByDataset: Map<string, Set<string>> = new Map(
    datasets.map((d) => [d.id, new Set(d.columns.map((c) => c.id))]),
  );

  // Resolve figure: prefer v6 `figure`, fall back to legacy v5 `chartConfig`.
  let figure: FigureConfig;
  if (typeof rawData.figure === 'object' && rawData.figure !== null) {
    const raw = rawData.figure as Record<string, unknown>;
    const rows = Math.max(1, Math.floor(Number(raw.rows) || 1));
    const cols = Math.max(1, Math.floor(Number(raw.cols) || 1));
    const rawSubplots = Array.isArray(raw.subplots) ? raw.subplots : [];
    const sanitizedSubplots = rawSubplots
      .map((c) => sanitizeChartConfig(c))
      .filter((c): c is ChartConfig => c !== null)
      // Drop layers with missing dataset/column references, per subplot.
      .map((cfg) => filterValidLayers(cfg, datasetIds, columnIdsByDataset));
    // Pad with a default subplot if sanitization dropped entries, so we always
    // satisfy the invariant subplots.length === rows * cols.
    while (sanitizedSubplots.length < rows * cols) {
      const fallback = sanitizeChartConfig({ id: 'default', type: 'line' });
      if (!fallback) break;
      sanitizedSubplots.push(fallback);
    }
    const clampedActiveIndex = Math.max(0, Math.min(
      Math.floor(Number(raw.activeIndex) || 0),
      Math.max(0, sanitizedSubplots.length - 1),
    ));
    const gap = Math.max(0, Number(raw.gap) || 0);
    figure = { rows, cols, subplots: sanitizedSubplots, activeIndex: clampedActiveIndex, gap };
  } else {
    // Legacy v5 file: wrap single chartConfig as 1x1 figure.
    let cfg = sanitizeChartConfig(rawData.chartConfig);
    if (!cfg) {
      cfg = sanitizeChartConfig({ id: 'default', type: 'line' });
      if (!cfg) return null;
    }
    cfg = filterValidLayers(cfg, datasetIds, columnIdsByDataset);
    figure = { rows: 1, cols: 1, subplots: [cfg], activeIndex: 0, gap: 8 };
  }

  const theme = rawData.theme === 'light' ? 'light' : 'dark';
  const lang = rawData.lang === 'en' ? 'en' : 'zh';

  return {
    version: PROJECT_VERSION,
    createdAt: typeof rawData.createdAt === 'string' ? rawData.createdAt : new Date().toISOString(),
    updatedAt: typeof rawData.updatedAt === 'string' ? rawData.updatedAt : new Date().toISOString(),
    datasets,
    figure,
    theme,
    lang,
  };
}

/** Save project to a .plot3d JSON file */
export function saveProjectFile(project: ProjectFile, filename: string): void {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const link = document.createElement('a');
  link.download = filename.endsWith('.plot3d') ? filename : `${filename}.plot3d`;
  link.href = URL.createObjectURL(blob);
  link.click();
  // Delay revoke to ensure the browser has started the download
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/** Maximum allowed project file size: 50 MB. Larger files are rejected to prevent the UI from freezing. */
const MAX_PROJECT_FILE_BYTES = 50 * 1024 * 1024;

/** Load and parse a .plot3d file, returns ProjectFile or null on error */
export async function loadProjectFile(file: File): Promise<ProjectFile | null> {
  try {
    if (file.size > MAX_PROJECT_FILE_BYTES) {
      return null;
    }
    const text = await file.text();
    const data = JSON.parse(text);
    // Migrate v1 files that had scene3D field
    if (typeof data === 'object' && data !== null && data.version === 1) {
      delete data.scene3D;
      data.version = PROJECT_VERSION;
    }
    // v2 files are compatible with v3 (new chart types and yAxisRight are optional);
    // just bump the version so saved files use the current version.
    if (typeof data === 'object' && data !== null && data.version === 2) {
      data.version = PROJECT_VERSION;
    }
    // v3 -> v4: scene3D is optional and will be defaulted during sanitization.
    if (typeof data === 'object' && data !== null && data.version === 3) {
      data.version = PROJECT_VERSION;
    }
    // v4 -> v5: annotation model expanded with more types and style fields.
    if (typeof data === 'object' && data !== null && data.version === 4) {
      data.version = PROJECT_VERSION;
    }
    // v5 -> v6: file format migrated from `chartConfig` to `figure`. The sanitizer
    // wraps legacy `chartConfig` into a 1x1 figure automatically; we just bump the
    // version so the saved file is recognized as v6.
    if (typeof data === 'object' && data !== null && data.version === 5) {
      data.version = PROJECT_VERSION;
    }
    return sanitizeProjectFile(data);
  } catch {
    return null;
  }
}
