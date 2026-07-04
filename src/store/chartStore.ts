import { create } from 'zustand';
import i18n from '@/i18n';
import type {
  ChartConfig,
  FigureConfig,
  AxisConfig,
  LayerConfig,
  ChartType,
  Annotation,
  ExportConfig,
  ColorMapName,
  Scene3DConfig,
} from '@/types';
import { uid } from '@/utils/sampleData';
import { is3DChart } from '@/utils/chart';
import { sharedDefaultDataset } from './sharedDefaults';
import { useDatasetStore } from './datasetStore';
import { useHistoryStore } from './historyStore';

const defaultAxis: AxisConfig = {
  label: '',
  autoRange: true,
  gridVisible: true,
  logScale: false,
  scientificNotation: false,
};

/**
 * Build a fresh default ChartConfig. Each call produces unique ids so
 * grid cells can have independent charts. (Chunk 1 Task 1.2)
 */
export function createDefaultChartConfig(): ChartConfig {
  return {
    id: uid(),
    type: 'line',
    title: '',
    xAxis: { ...defaultAxis, label: i18n.t('store.xAxis') },
    yAxis: { ...defaultAxis, label: i18n.t('store.yAxis') },
    legend: { visible: true, position: 'inside-top-right', bordered: false },
    colorMap: 'viridis',
    annotations: [],
    marginTop: 60,
    marginRight: 48,
    marginBottom: 70,
    marginLeft: 72,
    exportConfig: { resolutionMultiplier: 2, background: 'white', figureMultiplier: 1 },
    fontSize: 16,
    scene3D: { aspectMode: 'cube', aspectRatio: { x: 1, y: 1, z: 1 }, projection: 'orthographic' },
    layers: [
      {
        id: uid(),
        datasetId: sharedDefaultDataset.id,
        xColumn: sharedDefaultDataset.columns[0].id,
        yColumn: sharedDefaultDataset.columns[1].id,
        color: '#1f77b4',
        visible: true,
        lineStyle: 'solid',
        lineWidth: 3,
        pointStyle: 'none',
        pointSize: 5,
        fill: false,
        fillOpacity: 0.35,
      },
    ],
  };
}

interface ChartStore {
  figure: FigureConfig;

  // Chart config actions (each pushes to history before mutating)
  setChartType: (type: ChartType) => void;
  setChartTitle: (title: string) => void;
  setXAxis: (axis: Partial<AxisConfig>) => void;
  setYAxis: (axis: Partial<AxisConfig>) => void;
  setYAxisRight: (axis: Partial<AxisConfig>) => void;
  setZAxis: (axis: Partial<AxisConfig>) => void;
  setLegend: (legend: Partial<ChartConfig['legend']>) => void;
  setColorMap: (colorMap: ColorMapName) => void;
  addLayer: (layer: LayerConfig) => void;
  removeLayer: (layerId: string) => void;
  updateLayer: (layerId: string, data: Partial<LayerConfig>) => void;
  /** Move a layer to a new index (drag-to-sort). */
  moveLayer: (layerId: string, toIndex: number) => void;
  /** Reorder layers by providing a new array of layer IDs. */
  reorderLayers: (layerIds: string[]) => void;
  setMargins: (margins: { marginTop?: number; marginRight?: number; marginBottom?: number; marginLeft?: number }) => void;
  setExportConfig: (config: Partial<ExportConfig>) => void;
  setFontSize: (fontSize: number) => void;
  setScene3D: (scene: Partial<Scene3DConfig>) => void;
  /** Apply a partial chart config patch atomically (used by journal templates). */
  applyConfigPatch: (patch: Partial<ChartConfig>) => void;

  // Annotation actions
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (annotationId: string) => void;
  updateAnnotation: (annotationId: string, data: Partial<Annotation>) => void;
  /** Update annotation without pushing to history (used during drag) */
  updateAnnotationSilent: (annotationId: string, data: Partial<Annotation>) => void;
  duplicateAnnotation: (annotationId: string) => void;
  bringAnnotationToFront: (annotationId: string) => void;
  sendAnnotationToBack: (annotationId: string) => void;
  reorderAnnotations: (annotationIds: string[]) => void;

  // Grid actions (multi-subplot — Approach A selector shim)
  /** Resize the grid; trailing subplots beyond the new count are dropped,
   *  new subplots are appended via createDefaultChartConfig(). */
  setGrid: (rows: number, cols: number) => void;
  /** Set the active subplot index (clamped). Not undoable. */
  setActiveSubplot: (index: number) => void;
  /** Adjust the grid gap in px (clamped to >= 0). */
  setGap: (gap: number) => void;

  /** Mutate only the active subplot without pushing to history.
   *  Used by cross-store actions (e.g. datasetStore) that already push
   *  their own snapshot or want to avoid an extra chart-level entry. */
  updateActiveChart: (fn: (c: ChartConfig) => ChartConfig) => void;
}

/** Select the currently active subplot's ChartConfig. (Chunk 1 Task 1.3) */
export const selectActiveChart = (s: ChartStore): ChartConfig =>
  s.figure.subplots[s.figure.activeIndex];

/**
 * Map a function over the active subplot, returning a partial state patch.
 * Used by every config-mutating action so editing targets the active cell.
 */
const patchActive = (
  s: ChartStore,
  fn: (c: ChartConfig) => ChartConfig
): Partial<ChartStore> => ({
  figure: {
    ...s.figure,
    subplots: s.figure.subplots.map((c, i) =>
      i === s.figure.activeIndex ? fn(c) : c
    ),
  },
});

export const useChartStore = create<ChartStore>()((set) => {
  const setWithHistory = (
    partial: Partial<ChartStore> | ((s: ChartStore) => Partial<ChartStore>),
    description?: string
  ) => {
    useHistoryStore.getState().pushSnapshot(description);
    set(partial);
  };

  return {
    figure: {
      rows: 1,
      cols: 1,
      subplots: [createDefaultChartConfig()],
      activeIndex: 0,
      gap: 8,
    },

    setChartType: (type) =>
      setWithHistory((s) => patchActive(s, (c) => {
        const is3D = is3DChart(type);
        const needsZ = is3D || type === 'heatmap';
        let layers = c.layers;
        let zAxis = c.zAxis;
        if (needsZ && !zAxis) {
          zAxis = { ...defaultAxis, label: i18n.t('store.zAxis') };
        }
        if (needsZ) {
          const datasets = useDatasetStore.getState().datasets;
          layers = layers.map((layer) => {
            if (layer.zColumn) return layer;
            const ds = datasets.find((d) => d.id === layer.datasetId);
            if (!ds) return layer;
            const zCol = ds.columns.find((col) => col.type === 'Z');
            return zCol ? { ...layer, zColumn: zCol.id } : layer;
          });
        }
        return { ...c, type, layers, zAxis };
      }), i18n.t('history.setChartType', { defaultValue: 'Change chart type' })),

    setChartTitle: (title) =>
      setWithHistory((s) => patchActive(s, (c) => ({ ...c, title })),
        i18n.t('history.setChartTitle', { defaultValue: 'Edit title' })),

    setXAxis: (axis) =>
      setWithHistory((s) => patchActive(s, (c) => ({ ...c, xAxis: { ...c.xAxis, ...axis } })),
        i18n.t('history.setXAxis', { defaultValue: 'Edit X axis' })),

    setYAxis: (axis) =>
      setWithHistory((s) => patchActive(s, (c) => ({ ...c, yAxis: { ...c.yAxis, ...axis } })),
        i18n.t('history.setYAxis', { defaultValue: 'Edit Y axis' })),

    setYAxisRight: (axis) =>
      setWithHistory((s) => patchActive(s, (c) => ({
        ...c,
        yAxisRight: c.yAxisRight
          ? { ...c.yAxisRight, ...axis }
          : { ...defaultAxis, label: i18n.t('store.yAxisRight', { defaultValue: 'Right Y' }), ...axis },
      })), i18n.t('history.setYAxisRight', { defaultValue: 'Edit right Y axis' })),

    setZAxis: (axis) =>
      setWithHistory((s) => patchActive(s, (c) => ({
        ...c,
        zAxis: c.zAxis ? { ...c.zAxis, ...axis } : { ...defaultAxis, label: i18n.t('store.zAxis'), ...axis },
      })), i18n.t('history.setZAxis', { defaultValue: 'Edit Z axis' })),

    setLegend: (legend) =>
      setWithHistory((s) => patchActive(s, (c) => ({ ...c, legend: { ...c.legend, ...legend } })),
        i18n.t('history.setLegend', { defaultValue: 'Edit legend' })),

    setColorMap: (colorMap) =>
      setWithHistory((s) => patchActive(s, (c) => ({ ...c, colorMap })),
        i18n.t('history.setColorMap', { defaultValue: 'Change color map' })),

    addLayer: (layer) =>
      setWithHistory((s) => patchActive(s, (c) => ({ ...c, layers: [...c.layers, layer] })),
        i18n.t('history.addLayer', { defaultValue: 'Add layer' })),

    removeLayer: (layerId) =>
      setWithHistory((s) => patchActive(s, (c) => ({
        ...c,
        layers: c.layers.filter((l) => l.id !== layerId),
      })), i18n.t('history.removeLayer', { defaultValue: 'Remove layer' })),

    updateLayer: (layerId, data) =>
      setWithHistory((s) => patchActive(s, (c) => ({
        ...c,
        layers: c.layers.map((l) => (l.id === layerId ? { ...l, ...data } : l)),
      })), i18n.t('history.updateLayer', { defaultValue: 'Update layer' })),

    moveLayer: (layerId, toIndex) =>
      setWithHistory((s) => patchActive(s, (c) => {
        const layers = [...c.layers];
        const fromIndex = layers.findIndex((l) => l.id === layerId);
        if (fromIndex === -1 || fromIndex === toIndex || toIndex < 0 || toIndex >= layers.length) return c;
        const [moved] = layers.splice(fromIndex, 1);
        layers.splice(toIndex, 0, moved);
        return { ...c, layers };
      }), i18n.t('history.moveLayer', { defaultValue: 'Reorder layer' })),

    reorderLayers: (layerIds) =>
      setWithHistory((s) => patchActive(s, (c) => {
        const map = new Map(c.layers.map((l) => [l.id, l]));
        const reordered = layerIds.map((id) => map.get(id)).filter((l): l is LayerConfig => Boolean(l));
        const extras = c.layers.filter((l) => !layerIds.includes(l.id));
        return { ...c, layers: [...reordered, ...extras] };
      }), i18n.t('history.reorderLayers', { defaultValue: 'Reorder layers' })),

    setMargins: (margins) =>
      setWithHistory((s) => patchActive(s, (c) => ({ ...c, ...margins })),
        i18n.t('history.setMargins', { defaultValue: 'Adjust margins' })),

    setExportConfig: (config) =>
      setWithHistory((s) => patchActive(s, (c) => ({
        ...c,
        exportConfig: { ...c.exportConfig, ...config },
      })), i18n.t('history.setExportConfig', { defaultValue: 'Change export config' })),

    setFontSize: (fontSize) =>
      setWithHistory((s) => patchActive(s, (c) => ({ ...c, fontSize })),
        i18n.t('history.setFontSize', { defaultValue: 'Change font size' })),

    setScene3D: (scene) =>
      setWithHistory((s) => patchActive(s, (c) => ({
        ...c,
        scene3D: { ...(c.scene3D ?? { aspectMode: 'cube', aspectRatio: { x: 1, y: 1, z: 1 }, projection: 'orthographic' }), ...scene },
      })), i18n.t('history.setScene3D', { defaultValue: 'Change 3D scene' })),

    applyConfigPatch: (patch) =>
      setWithHistory((s) => patchActive(s, (c) => ({ ...c, ...patch })),
        i18n.t('history.applyTemplate', { defaultValue: 'Apply template' })),

    addAnnotation: (annotation) =>
      setWithHistory((s) => patchActive(s, (c) => ({
        ...c,
        annotations: [...c.annotations, annotation],
      })), i18n.t('history.addAnnotation', { defaultValue: 'Add annotation' })),

    removeAnnotation: (annotationId) =>
      setWithHistory((s) => patchActive(s, (c) => ({
        ...c,
        annotations: c.annotations.filter((a) => a.id !== annotationId),
      })), i18n.t('history.removeAnnotation', { defaultValue: 'Remove annotation' })),

    updateAnnotation: (annotationId, data) =>
      setWithHistory((s) => patchActive(s, (c) => ({
        ...c,
        annotations: c.annotations.map((a) =>
          a.id === annotationId ? { ...a, ...data } : a
        ),
      })), i18n.t('history.updateAnnotation', { defaultValue: 'Update annotation' })),

    updateAnnotationSilent: (annotationId, data) =>
      set((s) => patchActive(s, (c) => ({
        ...c,
        annotations: c.annotations.map((a) =>
          a.id === annotationId ? { ...a, ...data } : a
        ),
      }))),

    duplicateAnnotation: (annotationId) =>
      setWithHistory((s) => patchActive(s, (c) => {
        const ann = c.annotations.find((a) => a.id === annotationId);
        if (!ann) return c;
        const copy: Annotation = { ...ann, id: uid(), x: ann.x + 2, y: ann.y + 2 };
        return { ...c, annotations: [...c.annotations, copy] };
      }), i18n.t('history.duplicateAnnotation', { defaultValue: 'Duplicate annotation' })),

    bringAnnotationToFront: (annotationId) =>
      setWithHistory((s) => patchActive(s, (c) => {
        const list = c.annotations.filter((a) => a.id !== annotationId);
        const target = c.annotations.find((a) => a.id === annotationId);
        if (!target) return c;
        return { ...c, annotations: [...list, target] };
      }), i18n.t('history.bringAnnotationToFront', { defaultValue: 'Bring annotation to front' })),

    sendAnnotationToBack: (annotationId) =>
      setWithHistory((s) => patchActive(s, (c) => {
        const list = c.annotations.filter((a) => a.id !== annotationId);
        const target = c.annotations.find((a) => a.id === annotationId);
        if (!target) return c;
        return { ...c, annotations: [target, ...list] };
      }), i18n.t('history.sendAnnotationToBack', { defaultValue: 'Send annotation to back' })),

    reorderAnnotations: (annotationIds) =>
      setWithHistory((s) => patchActive(s, (c) => {
        const map = new Map(c.annotations.map((a) => [a.id, a]));
        const reordered = annotationIds.map((id) => map.get(id)).filter((a): a is Annotation => Boolean(a));
        const extras = c.annotations.filter((a) => !annotationIds.includes(a.id));
        return { ...c, annotations: [...reordered, ...extras] };
      }), i18n.t('history.reorderAnnotations', { defaultValue: 'Reorder annotations' })),

    setGrid: (rows, cols) =>
      setWithHistory((s) => {
        const r = Math.max(1, rows);
        const c = Math.max(1, cols);
        const count = r * c;
        let subplots = s.figure.subplots.slice(0, count);
        while (subplots.length < count) subplots.push(createDefaultChartConfig());
        const activeIndex = Math.min(s.figure.activeIndex, count - 1);
        return { figure: { ...s.figure, rows: r, cols: c, subplots, activeIndex } };
      }, i18n.t('history.setGrid', { defaultValue: 'Change grid layout' })),

    setActiveSubplot: (index) =>
      set((s) => ({
        figure: {
          ...s.figure,
          activeIndex: Math.max(0, Math.min(index, s.figure.subplots.length - 1)),
        },
      })),

    setGap: (gap) =>
      setWithHistory((s) => ({ figure: { ...s.figure, gap: Math.max(0, gap) } }),
        i18n.t('history.setGap', { defaultValue: 'Adjust grid gap' })),

    updateActiveChart: (fn) =>
      set((s) => patchActive(s, fn)),
  };
});