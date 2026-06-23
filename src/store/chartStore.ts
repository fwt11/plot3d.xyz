import { create } from 'zustand';
import i18n from '@/i18n';
import type { ChartConfig, AxisConfig, LayerConfig, ChartType, Annotation, ExportConfig, ColorMapName } from '@/types';
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
  title: i18n.t('store.chartTitle'),
  xAxis: { ...defaultAxis, label: i18n.t('store.xAxis') },
  yAxis: { ...defaultAxis, label: i18n.t('store.yAxis') },
  legend: { visible: true, position: 'top' },
  colorMap: 'viridis',
  annotations: [],
  marginTop: 40,
  marginRight: 40,
  marginBottom: 40,
  marginLeft: 40,
  exportConfig: { resolutionMultiplier: 2, background: 'transparent' },
  fontSize: 12,
  layers: [
    {
      id: uid(),
      datasetId: sharedDefaultDataset.id,
      xColumn: sharedDefaultDataset.columns[0].id,
      yColumn: sharedDefaultDataset.columns[1].id,
      color: '#0ea5e9',
      visible: true,
      lineStyle: 'solid',
      lineWidth: 3,
      pointStyle: 'circle',
      pointSize: 6,
      fill: false,
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
  setZAxis: (axis: Partial<AxisConfig>) => void;
  setLegend: (legend: Partial<ChartConfig['legend']>) => void;
  setColorMap: (colorMap: ColorMapName) => void;
  addLayer: (layer: LayerConfig) => void;
  removeLayer: (layerId: string) => void;
  updateLayer: (layerId: string, data: Partial<LayerConfig>) => void;
  setMargins: (margins: { marginTop?: number; marginRight?: number; marginBottom?: number; marginLeft?: number }) => void;
  setExportConfig: (config: Partial<ExportConfig>) => void;
  setFontSize: (fontSize: number) => void;

  // Annotation actions
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (annotationId: string) => void;
  updateAnnotation: (annotationId: string, data: Partial<Annotation>) => void;
  /** Update annotation without pushing to history (used during drag) */
  updateAnnotationSilent: (annotationId: string, data: Partial<Annotation>) => void;
}

export const useChartStore = create<ChartStore>()((set) => {
  const setWithHistory = (partial: Partial<ChartStore> | ((s: ChartStore) => Partial<ChartStore>)) => {
    useHistoryStore.getState().pushSnapshot();
    set(partial);
  };

  return {
    chartConfig: defaultChartConfig,

    setChartType: (type) =>
      setWithHistory((s) => {
        const is3D = is3DChart(type);
        const needsZ = is3D || type === 'heatmap';
        let layers = s.chartConfig.layers;

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

        return { chartConfig: { ...s.chartConfig, type, layers } };
      }),

    setChartTitle: (title) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, title } })),

    setXAxis: (axis) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, xAxis: { ...s.chartConfig.xAxis, ...axis } } })),

    setYAxis: (axis) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, yAxis: { ...s.chartConfig.yAxis, ...axis } } })),

    setZAxis: (axis) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, zAxis: s.chartConfig.zAxis ? { ...s.chartConfig.zAxis, ...axis } : { ...defaultAxis, label: i18n.t('store.zAxis'), ...axis } } })),

    setLegend: (legend) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, legend: { ...s.chartConfig.legend, ...legend } } })),

    setColorMap: (colorMap) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, colorMap } })),

    addLayer: (layer) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, layers: [...s.chartConfig.layers, layer] } })),

    removeLayer: (layerId) =>
      setWithHistory((s) => ({
        chartConfig: { ...s.chartConfig, layers: s.chartConfig.layers.filter((l) => l.id !== layerId) },
      })),

    updateLayer: (layerId, data) =>
      setWithHistory((s) => ({
        chartConfig: {
          ...s.chartConfig,
          layers: s.chartConfig.layers.map((l) => (l.id === layerId ? { ...l, ...data } : l)),
        },
      })),

    setMargins: (margins) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, ...margins } })),

    setExportConfig: (config) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, exportConfig: { ...s.chartConfig.exportConfig, ...config } } })),

    setFontSize: (fontSize) =>
      setWithHistory((s) => ({ chartConfig: { ...s.chartConfig, fontSize } })),

    addAnnotation: (annotation) =>
      setWithHistory((s) => ({
        chartConfig: { ...s.chartConfig, annotations: [...s.chartConfig.annotations, annotation] },
      })),

    removeAnnotation: (annotationId) =>
      setWithHistory((s) => ({
        chartConfig: {
          ...s.chartConfig,
          annotations: s.chartConfig.annotations.filter((a) => a.id !== annotationId),
        },
      })),

    updateAnnotation: (annotationId, data) =>
      setWithHistory((s) => ({
        chartConfig: {
          ...s.chartConfig,
          annotations: s.chartConfig.annotations.map((a) =>
            a.id === annotationId ? { ...a, ...data } : a
          ),
        },
      })),

    updateAnnotationSilent: (annotationId, data) =>
      set((s) => ({
        chartConfig: {
          ...s.chartConfig,
          annotations: s.chartConfig.annotations.map((a) =>
            a.id === annotationId ? { ...a, ...data } : a
          ),
        },
      })),
  };
});
