import { create } from 'zustand';
import i18n from '@/i18n';
import type { ChartConfig, AxisConfig, LayerConfig, ChartType, Annotation, ExportConfig, ColorMapName, Scene3DConfig } from '@/types';
import { uid, createSampleSineDataset } from '@/utils/sampleData';
import { is3DChart } from '@/utils/chart';
import { useDatasetStore } from './datasetStore';
import { useHistoryStore } from './historyStore';

const defaultAxis: AxisConfig = {
  label: '',
  autoRange: true,
  gridVisible: true,
  logScale: false,
  scientificNotation: false,
};

// Create a shared default dataset that will be used by both stores
// The datasetStore will use this same instance
export const sharedDefaultDataset = createSampleSineDataset();

const defaultChartConfig: ChartConfig = {
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

interface ChartStore {
  chartConfig: ChartConfig;

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
}

export const useChartStore = create<ChartStore>()((set) => {
  const setWithHistory = (
    partial: Partial<ChartStore> | ((s: ChartStore) => Partial<ChartStore>),
    description?: string
  ) => {
    useHistoryStore.getState().pushSnapshot(description);
    set(partial);
  };

  return {
    chartConfig: defaultChartConfig,

    setChartType: (type) =>
      setWithHistory((s) => {
        const is3D = is3DChart(type);
        const needsZ = is3D || type === 'heatmap';
        let layers = s.chartConfig.layers;

        let zAxis = s.chartConfig.zAxis;
        if (needsZ && !zAxis) {
          zAxis = { ...defaultAxis, label: i18n.t('store.zAxis') };
        }

        if (needsZ) {
          const datasets = useDatasetStore.getState().datasets;
          layers = layers.map((layer) => {
            if (layer.zColumn) return layer;
            const ds = datasets.find((d) => d.id === layer.datasetId);
            if (!ds) return layer;
            const zCol = ds.columns.find((c) => c.type === 'Z');
            if (zCol) return { ...layer, zColumn: zCol.id };
            return layer;
          });
        }

        return { chartConfig: { ...s.chartConfig, type, layers, zAxis } };
      }, i18n.t('history.setChartType', { defaultValue: 'Change chart type' })),

    setChartTitle: (title) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, title } }), i18n.t('history.setChartTitle', { defaultValue: 'Edit title' })),

    setXAxis: (axis) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, xAxis: { ...s.chartConfig.xAxis, ...axis } } }), i18n.t('history.setXAxis', { defaultValue: 'Edit X axis' })),

    setYAxis: (axis) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, yAxis: { ...s.chartConfig.yAxis, ...axis } } }), i18n.t('history.setYAxis', { defaultValue: 'Edit Y axis' })),

    setYAxisRight: (axis) =>
      setWithHistory((s) => ({
        chartConfig: {
          ...s.chartConfig,
          yAxisRight: s.chartConfig.yAxisRight
            ? { ...s.chartConfig.yAxisRight, ...axis }
            : { ...defaultAxis, label: i18n.t('store.yAxisRight', { defaultValue: 'Right Y' }), ...axis },
        },
      }), i18n.t('history.setYAxisRight', { defaultValue: 'Edit right Y axis' })),

    setZAxis: (axis) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, zAxis: s.chartConfig.zAxis ? { ...s.chartConfig.zAxis, ...axis } : { ...defaultAxis, label: i18n.t('store.zAxis'), ...axis } } }), i18n.t('history.setZAxis', { defaultValue: 'Edit Z axis' })),

    setLegend: (legend) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, legend: { ...s.chartConfig.legend, ...legend } } }), i18n.t('history.setLegend', { defaultValue: 'Edit legend' })),

    setColorMap: (colorMap) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, colorMap } }), i18n.t('history.setColorMap', { defaultValue: 'Change color map' })),

    addLayer: (layer) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, layers: [...s.chartConfig.layers, layer] } }), i18n.t('history.addLayer', { defaultValue: 'Add layer' })),

    removeLayer: (layerId) =>
      setWithHistory((s) => ({
        chartConfig: { ...s.chartConfig, layers: s.chartConfig.layers.filter((l) => l.id !== layerId) },
      }), i18n.t('history.removeLayer', { defaultValue: 'Remove layer' })),

    updateLayer: (layerId, data) =>
      setWithHistory((s) => ({
        chartConfig: {
          ...s.chartConfig,
          layers: s.chartConfig.layers.map((l) => (l.id === layerId ? { ...l, ...data } : l)),
        },
      }), i18n.t('history.updateLayer', { defaultValue: 'Update layer' })),

    moveLayer: (layerId, toIndex) =>
      setWithHistory((s) => {
        const layers = [...s.chartConfig.layers];
        const fromIndex = layers.findIndex((l) => l.id === layerId);
        if (fromIndex === -1 || fromIndex === toIndex || toIndex < 0 || toIndex >= layers.length) return {};
        const [moved] = layers.splice(fromIndex, 1);
        layers.splice(toIndex, 0, moved);
        return { chartConfig: { ...s.chartConfig, layers } };
      }, i18n.t('history.moveLayer', { defaultValue: 'Reorder layer' })),

    reorderLayers: (layerIds) =>
      setWithHistory((s) => {
        const map = new Map(s.chartConfig.layers.map((l) => [l.id, l]));
        const reordered = layerIds.map((id) => map.get(id)).filter((l): l is LayerConfig => Boolean(l));
        // Preserve any layers not in layerIds at the end (defensive)
        const extras = s.chartConfig.layers.filter((l) => !layerIds.includes(l.id));
        return { chartConfig: { ...s.chartConfig, layers: [...reordered, ...extras] } };
      }, i18n.t('history.reorderLayers', { defaultValue: 'Reorder layers' })),

    setMargins: (margins) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, ...margins } }), i18n.t('history.setMargins', { defaultValue: 'Adjust margins' })),

    setExportConfig: (config) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, exportConfig: { ...s.chartConfig.exportConfig, ...config } } }), i18n.t('history.setExportConfig', { defaultValue: 'Change export config' })),

    setFontSize: (fontSize) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, fontSize } }), i18n.t('history.setFontSize', { defaultValue: 'Change font size' })),

    setScene3D: (scene) =>
      setWithHistory((s) => ({
        chartConfig: {
          ...s.chartConfig,
          scene3D: { ...(s.chartConfig.scene3D ?? { aspectMode: 'cube', aspectRatio: { x: 1, y: 1, z: 1 }, projection: 'orthographic' }), ...scene },
        },
      }), i18n.t('history.setScene3D', { defaultValue: 'Change 3D scene' })),

    applyConfigPatch: (patch) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, ...patch } }), i18n.t('history.applyTemplate', { defaultValue: 'Apply template' })),

    addAnnotation: (annotation) =>
      setWithHistory((s) => ({
        chartConfig: { ...s.chartConfig, annotations: [...s.chartConfig.annotations, annotation] },
      }), i18n.t('history.addAnnotation', { defaultValue: 'Add annotation' })),

    removeAnnotation: (annotationId) =>
      setWithHistory((s) => ({
        chartConfig: {
          ...s.chartConfig,
          annotations: s.chartConfig.annotations.filter((a) => a.id !== annotationId),
        },
      }), i18n.t('history.removeAnnotation', { defaultValue: 'Remove annotation' })),

    updateAnnotation: (annotationId, data) =>
      setWithHistory((s) => ({
        chartConfig: {
          ...s.chartConfig,
          annotations: s.chartConfig.annotations.map((a) =>
            a.id === annotationId ? { ...a, ...data } : a
          ),
        },
      }), i18n.t('history.updateAnnotation', { defaultValue: 'Update annotation' })),

    updateAnnotationSilent: (annotationId, data) =>
      set((s) => ({
        chartConfig: {
          ...s.chartConfig,
          annotations: s.chartConfig.annotations.map((a) =>
            a.id === annotationId ? { ...a, ...data } : a
          ),
        },
      })),

    duplicateAnnotation: (annotationId) =>
      setWithHistory((s) => {
        const ann = s.chartConfig.annotations.find((a) => a.id === annotationId);
        if (!ann) return {};
        const copy: Annotation = { ...ann, id: uid(), x: ann.x + 2, y: ann.y + 2 };
        return {
          chartConfig: {
            ...s.chartConfig,
            annotations: [...s.chartConfig.annotations, copy],
          },
        };
      }, i18n.t('history.duplicateAnnotation', { defaultValue: 'Duplicate annotation' })),

    bringAnnotationToFront: (annotationId) =>
      setWithHistory((s) => {
        const list = s.chartConfig.annotations.filter((a) => a.id !== annotationId);
        const target = s.chartConfig.annotations.find((a) => a.id === annotationId);
        if (!target) return {};
        return {
          chartConfig: {
            ...s.chartConfig,
            annotations: [...list, target],
          },
        };
      }, i18n.t('history.bringAnnotationToFront', { defaultValue: 'Bring annotation to front' })),

    sendAnnotationToBack: (annotationId) =>
      setWithHistory((s) => {
        const list = s.chartConfig.annotations.filter((a) => a.id !== annotationId);
        const target = s.chartConfig.annotations.find((a) => a.id === annotationId);
        if (!target) return {};
        return {
          chartConfig: {
            ...s.chartConfig,
            annotations: [target, ...list],
          },
        };
      }, i18n.t('history.sendAnnotationToBack', { defaultValue: 'Send annotation to back' })),

    reorderAnnotations: (annotationIds) =>
      setWithHistory((s) => {
        const map = new Map(s.chartConfig.annotations.map((a) => [a.id, a]));
        const reordered = annotationIds.map((id) => map.get(id)).filter((a): a is Annotation => Boolean(a));
        const extras = s.chartConfig.annotations.filter((a) => !annotationIds.includes(a.id));
        return {
          chartConfig: {
            ...s.chartConfig,
            annotations: [...reordered, ...extras],
          },
        };
      }, i18n.t('history.reorderAnnotations', { defaultValue: 'Reorder annotations' })),
  };
});
