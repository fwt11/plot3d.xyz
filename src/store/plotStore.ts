import { create } from 'zustand';
import i18n from '@/i18n';
import type { Dataset, DataColumn, ChartConfig, Scene3DConfig, AxisConfig, LayerConfig, ChartType, Annotation, ExportConfig } from '@/types';
import { uid, createSampleSineDataset } from '@/utils/sampleData';

interface PlotStore {
  theme: 'light' | 'dark';
  lang: 'zh' | 'en';
  datasets: Dataset[];
  activeDatasetId: string | null;
  chartConfig: ChartConfig;
  scene3D: Scene3DConfig;
  pendingChartTypeSuggestion: ChartType | null;
  _past: Partial<PlotStore>[];
  _future: Partial<PlotStore>[];

  // Theme
  toggleTheme: () => void;

  // Language
  setLang: (lang: 'zh' | 'en') => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Dataset actions
  addDataset: (dataset: Dataset) => void;
  removeDataset: (id: string) => void;
  updateDataset: (id: string, data: Partial<Dataset>) => void;
  setActiveDataset: (id: string) => void;
  updateCellValue: (datasetId: string, columnId: string, rowIndex: number, value: string) => void;
  addColumn: (datasetId: string) => void;
  removeColumn: (datasetId: string, columnId: string) => void;
  addRow: (datasetId: string) => void;
  removeRow: (datasetId: string, rowIndex: number) => void;
  setColumnType: (datasetId: string, columnId: string, type: DataColumn['type']) => void;
  renameColumn: (datasetId: string, columnId: string, name: string) => void;
  transformColumn: (datasetId: string, columnId: string, fn: (val: number) => number) => void;
  addComputedColumn: (datasetId: string, name: string, fn: (row: Record<string, number>) => number) => void;
  sortDataset: (datasetId: string, columnId: string, ascending: boolean) => void;
  normalizeColumn: (datasetId: string, columnId: string) => void;

  // Chart config actions
  setChartType: (type: ChartType) => void;
  setChartTitle: (title: string) => void;
  setXAxis: (axis: Partial<AxisConfig>) => void;
  setYAxis: (axis: Partial<AxisConfig>) => void;
  setZAxis: (axis: Partial<AxisConfig>) => void;
  setLegend: (legend: Partial<ChartConfig['legend']>) => void;
  setColorMap: (colorMap: string) => void;
  addLayer: (layer: LayerConfig) => void;
  removeLayer: (layerId: string) => void;
  updateLayer: (layerId: string, data: Partial<LayerConfig>) => void;
  setMargins: (margins: { marginTop?: number; marginRight?: number; marginBottom?: number; marginLeft?: number }) => void;
  setExportConfig: (config: Partial<ExportConfig>) => void;
  setFontSize: (fontSize: number) => void;

  // Chart type suggestion actions
  acceptChartTypeSuggestion: () => void;
  dismissChartTypeSuggestion: () => void;

  // Annotation actions
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (annotationId: string) => void;
  updateAnnotation: (annotationId: string, data: Partial<Annotation>) => void;

  // 3D scene actions
  setScene3D: (config: Partial<Scene3DConfig>) => void;
}

const defaultAxis: AxisConfig = {
  label: '',
  autoRange: true,
  gridVisible: true,
  logScale: false,
  scientificNotation: false,
};

const defaultDataset = createSampleSineDataset();

const defaultChartConfig: ChartConfig = {
  id: uid(),
  type: 'line',
  title: i18n.t('store.chartTitle'),
  xAxis: { ...defaultAxis, label: i18n.t('store.xAxis') },
  yAxis: { ...defaultAxis, label: i18n.t('store.yAxis') },
  legend: { visible: true, position: 'top' },
  colorMap: 'jet',
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
      datasetId: defaultDataset.id,
      xColumn: defaultDataset.columns[0].id,
      yColumn: defaultDataset.columns[1].id,
      color: '#0ea5e9',
      visible: true,
      lineStyle: 'solid',
      lineWidth: 2,
      pointStyle: 'circle',
      pointSize: 3,
      fill: false,
    },
  ],
};

const MAX_HISTORY = 50;

export const usePlotStore = create<PlotStore>()((set, get) => {
  const setWithHistory = (partial: Partial<PlotStore> | ((s: PlotStore) => Partial<PlotStore>)) => {
    const currentSnapshot = {
      datasets: get().datasets,
      chartConfig: get().chartConfig,
      activeDatasetId: get().activeDatasetId,
    };
    set((s) => ({
      _past: [...s._past.slice(-(MAX_HISTORY - 1)), currentSnapshot],
      _future: [],
    }));
    set(partial);
  };

  return {
  theme: 'dark',
  lang: (i18n.language?.startsWith('en') ? 'en' : 'zh') as 'zh' | 'en',
  datasets: [defaultDataset],
  activeDatasetId: defaultDataset.id,
  chartConfig: defaultChartConfig,
  pendingChartTypeSuggestion: null,
  scene3D: {
    cameraPosition: [3, 3, 3],
    lightAngle: [45, 45],
    ambientIntensity: 0.4,
    opacity: 1,
    colorMap: 'viridis',
    showAxes: true,
    showColorbar: true,
    antialias: true,
    bloom: false,
  },
  _past: [],
  _future: [],

  undo: () => {
    const { _past, _future } = get();
    if (_past.length === 0) return;
    const previous = _past[_past.length - 1];
    const currentSnapshot = {
      datasets: get().datasets,
      chartConfig: get().chartConfig,
      activeDatasetId: get().activeDatasetId,
    };
    set({
      ...previous,
      _past: _past.slice(0, -1),
      _future: [currentSnapshot, ..._future],
    });
  },

  redo: () => {
    const { _past, _future } = get();
    if (_future.length === 0) return;
    const next = _future[0];
    const currentSnapshot = {
      datasets: get().datasets,
      chartConfig: get().chartConfig,
      activeDatasetId: get().activeDatasetId,
    };
    set({
      ...next,
      _past: [..._past, currentSnapshot],
      _future: _future.slice(1),
    });
  },

  canUndo: () => get()._past.length > 0,
  canRedo: () => get()._future.length > 0,

  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark';
    // Sync data-theme to documentElement immediately so cssVar() reads correct values during render
    document.documentElement.setAttribute('data-theme', newTheme);
    set({ theme: newTheme });
  },

  setLang: (lang) => {
    i18n.changeLanguage(lang);
    set({ lang });
  },

  addDataset: (dataset) =>
    setWithHistory((s) => {
      const hasZ = dataset.columns.some((c) => c.type === 'Z');
      const xCol = dataset.columns.find((c) => c.type === 'X') ?? dataset.columns[0];
      const yCol = dataset.columns.find((c) => c.type === 'Y') ?? dataset.columns[1];
      const zCol = dataset.columns.find((c) => c.type === 'Z');

      // Auto-create layer for this dataset
      let newLayers = s.chartConfig.layers;
      if (xCol && yCol) {
        newLayers = [...s.chartConfig.layers, {
          id: uid(),
          datasetId: dataset.id,
          xColumn: xCol.id,
          yColumn: yCol.id,
          zColumn: zCol?.id,
          color: `hsl(${Math.random() * 360}, 70%, 55%)`,
          visible: true,
          lineStyle: 'solid',
          lineWidth: 2,
          pointStyle: 'circle',
          pointSize: 3,
          fill: false,
        }];
      }

      // Suggest chart type instead of auto-switching
      let suggestion: ChartType | null = null;
      if (hasZ) {
        const xVals = xCol?.values.map(Number) ?? [];
        const yVals = yCol?.values.map(Number) ?? [];
        const uniqueXRatio = new Set(xVals.map((v) => v.toFixed(2))).size / (xVals.length || 1);
        const uniqueYRatio = new Set(yVals.map((v) => v.toFixed(2))).size / (yVals.length || 1);
        if (uniqueXRatio > 0.5 && uniqueYRatio > 0.5) {
          suggestion = 'scatter3d';
        } else {
          suggestion = 'surface3d';
        }
      }

      return {
        datasets: [...s.datasets, dataset],
        activeDatasetId: dataset.id,
        chartConfig: { ...s.chartConfig, layers: newLayers },
        pendingChartTypeSuggestion: suggestion,
      };
    }),

  removeDataset: (id) =>
    setWithHistory((s) => ({
      datasets: s.datasets.filter((d) => d.id !== id),
      activeDatasetId: s.activeDatasetId === id ? (s.datasets[0]?.id ?? null) : s.activeDatasetId,
    })),

  updateDataset: (id, data) =>
    setWithHistory((s) => ({
      datasets: s.datasets.map((d) => (d.id === id ? { ...d, ...data } : d)),
    })),

  setActiveDataset: (id) => set({ activeDatasetId: id }),

  updateCellValue: (datasetId, columnId, rowIndex, value) =>
    setWithHistory((s) => ({
      datasets: s.datasets.map((d) =>
        d.id === datasetId
          ? {
              ...d,
              columns: d.columns.map((c) =>
                c.id === columnId
                  ? { ...c, values: c.values.map((v, i) => (i === rowIndex ? value : v)) }
                  : c
              ),
            }
          : d
      ),
    })),

  addColumn: (datasetId) =>
    setWithHistory((s) => ({
      datasets: s.datasets.map((d) =>
        d.id === datasetId
          ? {
              ...d,
              columns: [
                ...d.columns,
                {
                  id: uid(),
                  name: String.fromCharCode(65 + d.columns.length),
                  type: d.columns.length < 2 ? 'Y' : 'Z',
                  values: Array(d.columns[0]?.values.length || 0).fill(''),
                },
              ],
            }
          : d
      ),
    })),

  removeColumn: (datasetId, columnId) =>
    setWithHistory((s) => ({
      datasets: s.datasets.map((d) =>
        d.id === datasetId
          ? { ...d, columns: d.columns.filter((c) => c.id !== columnId) }
          : d
      ),
    })),

  addRow: (datasetId) =>
    setWithHistory((s) => ({
      datasets: s.datasets.map((d) =>
        d.id === datasetId
          ? {
              ...d,
              columns: d.columns.map((c) => ({
                ...c,
                values: [...c.values, ''],
              })),
            }
          : d
      ),
    })),

  removeRow: (datasetId, rowIndex) =>
    setWithHistory((s) => ({
      datasets: s.datasets.map((d) =>
        d.id === datasetId
          ? {
              ...d,
              columns: d.columns.map((c) => ({
                ...c,
                values: c.values.filter((_, i) => i !== rowIndex),
              })),
            }
          : d
      ),
    })),

  setColumnType: (datasetId, columnId, type) =>
    setWithHistory((s) => {
      const newType = type as DataColumn['type'];

      const newDatasets = s.datasets.map((d) =>
        d.id === datasetId
          ? { ...d, columns: d.columns.map((c) => (c.id === columnId ? { ...c, type: newType } : c)) }
          : d
      );

      const hasZColumn = newDatasets.some((d) => d.columns.some((c) => c.type === 'Z'));
      const isCurrently3D = ['surface3d', 'scatter3d', 'contour3d', 'bar3d'].includes(s.chartConfig.type);

      let newChartType = s.chartConfig.type;
      if (newType === 'Z' && !isCurrently3D) {
        newChartType = 'surface3d';
      } else if (newType !== 'Z' && isCurrently3D && !hasZColumn) {
        newChartType = 'line';
      }

      let layers = s.chartConfig.layers;
      const hasLayerForDs = layers.some((l) => l.datasetId === datasetId);
      if (!hasLayerForDs) {
        const ds = newDatasets.find((d) => d.id === datasetId);
        if (ds) {
          const xCol = ds.columns.find((c) => c.type === 'X') ?? ds.columns[0];
          const yCol = ds.columns.find((c) => c.type === 'Y') ?? ds.columns[1];
          const zCol = ds.columns.find((c) => c.type === 'Z');
          if (xCol && yCol) {
            layers = [...layers, {
              id: uid(),
              datasetId,
              xColumn: xCol.id,
              yColumn: yCol.id,
              zColumn: zCol?.id,
              color: `hsl(${Math.random() * 360}, 70%, 55%)`,
              visible: true,
              lineStyle: 'solid',
              lineWidth: 2,
              pointStyle: 'circle',
              pointSize: 3,
              fill: false,
            }];
          }
        }
      }

      return {
        chartConfig: { ...s.chartConfig, type: newChartType, layers },
        datasets: newDatasets,
      };
    }),

  renameColumn: (datasetId, columnId, name) =>
    setWithHistory((s) => ({
      datasets: s.datasets.map((d) =>
        d.id === datasetId
          ? { ...d, columns: d.columns.map((c) => (c.id === columnId ? { ...c, name } : c)) }
          : d
      ),
    })),

  transformColumn: (datasetId, columnId, fn) =>
    setWithHistory((s) => ({
      datasets: s.datasets.map((d) =>
        d.id === datasetId
          ? {
              ...d,
              columns: d.columns.map((c) =>
                c.id === columnId
                  ? { ...c, values: c.values.map((v) => { const n = Number(v); return isNaN(n) ? v : String(fn(n)); }) }
                  : c
              ),
            }
          : d
      ),
    })),

  addComputedColumn: (datasetId, name, fn) =>
    setWithHistory((s) => ({
      datasets: s.datasets.map((d) => {
        if (d.id !== datasetId) return d;
        const maxRows = Math.max(...d.columns.map((c) => c.values.length), 0);
        const values = Array.from({ length: maxRows }, (_, i) => {
          const row: Record<string, number> = {};
          d.columns.forEach((c) => { const n = Number(c.values[i]); if (!isNaN(n)) row[c.name] = n; });
          const result = fn(row);
          return isNaN(result) ? '' : String(result);
        });
        return {
          ...d,
          columns: [...d.columns, { id: uid(), name, type: d.columns.length < 2 ? 'Y' : 'Z', values }],
        };
      }),
    })),

  sortDataset: (datasetId, columnId, ascending) =>
    setWithHistory((s) => ({
      datasets: s.datasets.map((d) => {
        if (d.id !== datasetId) return d;
        const col = d.columns.find((c) => c.id === columnId);
        if (!col) return d;
        const indices = col.values.map((v, i) => ({ v: Number(v), i }));
        indices.sort((a, b) => (isNaN(a.v) ? 1 : isNaN(b.v) ? -1 : ascending ? a.v - b.v : b.v - a.v));
        return {
          ...d,
          columns: d.columns.map((c) => ({
            ...c,
            values: indices.map(({ i }) => c.values[i]),
          })),
        };
      }),
    })),

  normalizeColumn: (datasetId, columnId) =>
    setWithHistory((s) => ({
      datasets: s.datasets.map((d) => {
        if (d.id !== datasetId) return d;
        return {
          ...d,
          columns: d.columns.map((c) => {
            if (c.id !== columnId) return c;
            const nums = c.values.map(Number).filter((n) => !isNaN(n));
            const min = Math.min(...nums);
            const max = Math.max(...nums);
            const range = max - min || 1;
            return { ...c, values: c.values.map((v) => { const n = Number(v); return isNaN(n) ? v : String((n - min) / range); }) };
          }),
        };
      }),
    })),

  setChartType: (type) =>
    setWithHistory((s) => {
      const is3D = ['surface3d', 'scatter3d', 'contour3d', 'bar3d'].includes(type);
      let layers = s.chartConfig.layers;

      if (is3D) {
        layers = layers.map((layer) => {
          if (layer.zColumn) return layer;
          const ds = s.datasets.find((d) => d.id === layer.datasetId);
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

  acceptChartTypeSuggestion: () => {
    const suggestion = get().pendingChartTypeSuggestion;
    if (suggestion) {
      get().setChartType(suggestion);
      set({ pendingChartTypeSuggestion: null });
    }
  },

  dismissChartTypeSuggestion: () =>
    set({ pendingChartTypeSuggestion: null }),

  setScene3D: (config) =>
    set((s) => ({ scene3D: { ...s.scene3D, ...config } })),

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
  };
});

// Sync initial theme to documentElement so cssVar() works on first render
document.documentElement.setAttribute('data-theme', 'dark');
