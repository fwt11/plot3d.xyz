import { create } from 'zustand';
import i18n from '@/i18n';
import type { Dataset, DataColumn, ChartConfig, Scene3DConfig, AxisConfig, LayerConfig, ChartType, Annotation } from '@/types';
import { uid, createSampleSineDataset } from '@/utils/sampleData';

interface PlotStore {
  theme: 'light' | 'dark';
  lang: 'zh' | 'en';
  datasets: Dataset[];
  activeDatasetId: string | null;
  chartConfig: ChartConfig;
  scene3D: Scene3DConfig;

  // Theme
  toggleTheme: () => void;

  // Language
  setLang: (lang: 'zh' | 'en') => void;

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
  layers: [
    {
      id: uid(),
      datasetId: defaultDataset.id,
      xColumn: defaultDataset.columns[0].id,
      yColumn: defaultDataset.columns[1].id,
      color: '#0ea5e9',
      visible: true,
    },
  ],
};

export const usePlotStore = create<PlotStore>((set) => ({
  theme: 'dark',
  lang: (i18n.language?.startsWith('en') ? 'en' : 'zh') as 'zh' | 'en',
  datasets: [defaultDataset],
  activeDatasetId: defaultDataset.id,
  chartConfig: defaultChartConfig,
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

  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

  setLang: (lang) => {
    i18n.changeLanguage(lang);
    set({ lang });
  },

  addDataset: (dataset) =>
    set((s) => {
      const hasZ = dataset.columns.some((c) => c.type === 'Z');
      const hasY = dataset.columns.some((c) => c.type === 'Y');
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
        }];
      }

      // Auto-set chart type based on data
      let newType = s.chartConfig.type;
      if (hasZ) {
        // If data has Z column, switch to 3D
        // For scatter-like data (many unique X/Y values), use scatter3d
        // For grid-like data, use surface3d
        const xVals = xCol?.values.map(Number) ?? [];
        const yVals = yCol?.values.map(Number) ?? [];
        const uniqueXRatio = new Set(xVals.map((v) => v.toFixed(2))).size / (xVals.length || 1);
        const uniqueYRatio = new Set(yVals.map((v) => v.toFixed(2))).size / (yVals.length || 1);
        // If most X and Y values are unique (scatter), use scatter3d
        // If there are many repeated values (grid), use surface3d
        if (uniqueXRatio > 0.5 && uniqueYRatio > 0.5) {
          newType = 'scatter3d';
        } else {
          newType = 'surface3d';
        }
      } else if (hasY && !hasZ) {
        // If currently 3D but new data has no Z, switch to 2D
        if (['surface3d', 'scatter3d', 'contour3d', 'bar3d'].includes(s.chartConfig.type)) {
          newType = 'line';
        }
      }

      return {
        datasets: [...s.datasets, dataset],
        activeDatasetId: dataset.id,
        chartConfig: { ...s.chartConfig, type: newType, layers: newLayers },
      };
    }),

  removeDataset: (id) =>
    set((s) => ({
      datasets: s.datasets.filter((d) => d.id !== id),
      activeDatasetId: s.activeDatasetId === id ? (s.datasets[0]?.id ?? null) : s.activeDatasetId,
    })),

  updateDataset: (id, data) =>
    set((s) => ({
      datasets: s.datasets.map((d) => (d.id === id ? { ...d, ...data } : d)),
    })),

  setActiveDataset: (id) => set({ activeDatasetId: id }),

  updateCellValue: (datasetId, columnId, rowIndex, value) =>
    set((s) => ({
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
    set((s) => ({
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
    set((s) => ({
      datasets: s.datasets.map((d) =>
        d.id === datasetId
          ? { ...d, columns: d.columns.filter((c) => c.id !== columnId) }
          : d
      ),
    })),

  addRow: (datasetId) =>
    set((s) => ({
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
    set((s) => ({
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
    set((s) => {
      const newType = type as DataColumn['type'];

      // Compute the new datasets first to check for Z columns
      const newDatasets = s.datasets.map((d) =>
        d.id === datasetId
          ? { ...d, columns: d.columns.map((c) => (c.id === columnId ? { ...c, type: newType } : c)) }
          : d
      );

      // Check if any dataset has Z columns
      const hasZColumn = newDatasets.some((d) => d.columns.some((c) => c.type === 'Z'));
      const isCurrently3D = ['surface3d', 'scatter3d', 'contour3d', 'bar3d'].includes(s.chartConfig.type);

      let newChartType = s.chartConfig.type;
      if (newType === 'Z' && !isCurrently3D) {
        newChartType = 'surface3d';
      } else if (newType !== 'Z' && isCurrently3D && !hasZColumn) {
        newChartType = 'line';
      }

      // Auto-create a layer for the dataset if none exists
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
            }];
          }
        }
      }

      return {
        chartConfig: { ...s.chartConfig, type: newChartType, layers },
        datasets: newDatasets,
      };
    }),

  transformColumn: (datasetId, columnId, fn) =>
    set((s) => ({
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
    set((s) => ({
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
    set((s) => ({
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
    set((s) => ({
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
    set((s) => {
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
    set((s) => ({ chartConfig: { ...s.chartConfig, title } })),

  setXAxis: (axis) =>
    set((s) => ({ chartConfig: { ...s.chartConfig, xAxis: { ...s.chartConfig.xAxis, ...axis } } })),

  setYAxis: (axis) =>
    set((s) => ({ chartConfig: { ...s.chartConfig, yAxis: { ...s.chartConfig.yAxis, ...axis } } })),

  setZAxis: (axis) =>
    set((s) => ({ chartConfig: { ...s.chartConfig, zAxis: s.chartConfig.zAxis ? { ...s.chartConfig.zAxis, ...axis } : { ...defaultAxis, label: i18n.t('store.zAxis'), ...axis } } })),

  setLegend: (legend) =>
    set((s) => ({ chartConfig: { ...s.chartConfig, legend: { ...s.chartConfig.legend, ...legend } } })),

  setColorMap: (colorMap) =>
    set((s) => ({ chartConfig: { ...s.chartConfig, colorMap } })),

  addLayer: (layer) =>
    set((s) => ({ chartConfig: { ...s.chartConfig, layers: [...s.chartConfig.layers, layer] } })),

  removeLayer: (layerId) =>
    set((s) => ({
      chartConfig: { ...s.chartConfig, layers: s.chartConfig.layers.filter((l) => l.id !== layerId) },
    })),

  updateLayer: (layerId, data) =>
    set((s) => ({
      chartConfig: {
        ...s.chartConfig,
        layers: s.chartConfig.layers.map((l) => (l.id === layerId ? { ...l, ...data } : l)),
      },
    })),

  setScene3D: (config) =>
    set((s) => ({ scene3D: { ...s.scene3D, ...config } })),

  addAnnotation: (annotation) =>
    set((s) => ({
      chartConfig: { ...s.chartConfig, annotations: [...s.chartConfig.annotations, annotation] },
    })),

  removeAnnotation: (annotationId) =>
    set((s) => ({
      chartConfig: {
        ...s.chartConfig,
        annotations: s.chartConfig.annotations.filter((a) => a.id !== annotationId),
      },
    })),

  updateAnnotation: (annotationId, data) =>
    set((s) => ({
      chartConfig: {
        ...s.chartConfig,
        annotations: s.chartConfig.annotations.map((a) =>
          a.id === annotationId ? { ...a, ...data } : a
        ),
      },
    })),
}));
