import { create } from 'zustand';
import type { Dataset, DataColumn, ChartType } from '@/types';
import { uid } from '@/utils/sampleData';
import { is3DChart } from '@/utils/chart';
import { sharedDefaultDataset, useChartStore } from './chartStore';
import { useHistoryStore } from './historyStore';

interface DatasetStore {
  datasets: Dataset[];
  activeDatasetId: string | null;
  pendingChartTypeSuggestion: ChartType | null;

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
  acceptChartTypeSuggestion: () => void;
  dismissChartTypeSuggestion: () => void;
}

const defaultDataset = sharedDefaultDataset;

export const useDatasetStore = create<DatasetStore>()((set, get) => ({
  datasets: [defaultDataset],
  activeDatasetId: defaultDataset.id,
  pendingChartTypeSuggestion: null,

  addDataset: (dataset) =>
    set((s) => {
      const hasZ = dataset.columns.some((c) => c.type === 'Z');
      const xCol = dataset.columns.find((c) => c.type === 'X') ?? dataset.columns[0];
      const yCol = dataset.columns.find((c) => c.type === 'Y') ?? dataset.columns[1];
      const zCol = dataset.columns.find((c) => c.type === 'Z');

      // Push history before cross-store mutation
      useHistoryStore.getState().pushSnapshot();

      // Auto-create layer for this dataset via chartStore
      const chartState = useChartStore.getState();
      let newLayers = chartState.chartConfig.layers;
      if (xCol && yCol) {
        newLayers = [...chartState.chartConfig.layers, {
          id: uid(),
          datasetId: dataset.id,
          xColumn: xCol.id,
          yColumn: yCol.id,
          zColumn: zCol?.id,
          color: `hsl(${Math.random() * 360}, 70%, 55%)`,
          visible: true,
          lineStyle: 'solid' as const,
          lineWidth: 2,
          pointStyle: 'circle' as const,
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

      // Update chartStore layers (no history push — already pushed above)
      useChartStore.setState((cs) => ({
        chartConfig: { ...cs.chartConfig, layers: newLayers },
      }));

      return {
        datasets: [...s.datasets, dataset],
        activeDatasetId: dataset.id,
        pendingChartTypeSuggestion: suggestion,
      };
    }),

  removeDataset: (id) => {
    useHistoryStore.getState().pushSnapshot();
    set((s) => ({
      datasets: s.datasets.filter((d) => d.id !== id),
      activeDatasetId: s.activeDatasetId === id ? (s.datasets[0]?.id ?? null) : s.activeDatasetId,
    }));
  },

  updateDataset: (id, data) => {
    useHistoryStore.getState().pushSnapshot();
    set((s) => ({
      datasets: s.datasets.map((d) => (d.id === id ? { ...d, ...data } : d)),
    }));
  },

  setActiveDataset: (id) => set({ activeDatasetId: id }),

  updateCellValue: (datasetId, columnId, rowIndex, value) => {
    useHistoryStore.getState().pushSnapshot();
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
    }));
  },

  addColumn: (datasetId) => {
    useHistoryStore.getState().pushSnapshot();
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
    }));
  },

  removeColumn: (datasetId, columnId) => {
    useHistoryStore.getState().pushSnapshot();
    set((s) => ({
      datasets: s.datasets.map((d) =>
        d.id === datasetId
          ? { ...d, columns: d.columns.filter((c) => c.id !== columnId) }
          : d
      ),
    }));
  },

  addRow: (datasetId) => {
    useHistoryStore.getState().pushSnapshot();
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
    }));
  },

  removeRow: (datasetId, rowIndex) => {
    useHistoryStore.getState().pushSnapshot();
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
    }));
  },

  setColumnType: (datasetId, columnId, type) => {
    useHistoryStore.getState().pushSnapshot();

    set((s) => {
      const newType = type as DataColumn['type'];

      const newDatasets = s.datasets.map((d) =>
        d.id === datasetId
          ? { ...d, columns: d.columns.map((c) => (c.id === columnId ? { ...c, type: newType } : c)) }
          : d
      );

      const hasZColumn = newDatasets.some((d) => d.columns.some((c) => c.type === 'Z'));

      // Access chartStore lazily to avoid circular deps
      const chartState = useChartStore.getState();
      const isCurrently3D = is3DChart(chartState.chartConfig.type);

      let newChartType = chartState.chartConfig.type;
      if (newType === 'Z' && !isCurrently3D) {
        newChartType = 'surface3d';
      } else if (newType !== 'Z' && isCurrently3D && !hasZColumn) {
        newChartType = 'line';
      }

      let layers = chartState.chartConfig.layers;
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
              lineStyle: 'solid' as const,
              lineWidth: 2,
              pointStyle: 'circle' as const,
              pointSize: 3,
              fill: false,
            }];
          }
        }
      }

      // Update chartStore (no history push — already pushed above)
      useChartStore.setState((cs) => ({
        chartConfig: { ...cs.chartConfig, type: newChartType, layers },
      }));

      return {
        datasets: newDatasets,
      };
    });
  },

  renameColumn: (datasetId, columnId, name) => {
    useHistoryStore.getState().pushSnapshot();
    set((s) => ({
      datasets: s.datasets.map((d) =>
        d.id === datasetId
          ? { ...d, columns: d.columns.map((c) => (c.id === columnId ? { ...c, name } : c)) }
          : d
      ),
    }));
  },

  transformColumn: (datasetId, columnId, fn) => {
    useHistoryStore.getState().pushSnapshot();
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
    }));
  },

  addComputedColumn: (datasetId, name, fn) => {
    useHistoryStore.getState().pushSnapshot();
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
    }));
  },

  sortDataset: (datasetId, columnId, ascending) => {
    useHistoryStore.getState().pushSnapshot();
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
    }));
  },

  normalizeColumn: (datasetId, columnId) => {
    useHistoryStore.getState().pushSnapshot();
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
    }));
  },

  acceptChartTypeSuggestion: () => {
    const suggestion = get().pendingChartTypeSuggestion;
    if (suggestion) {
      useHistoryStore.getState().pushSnapshot();
      useChartStore.getState().setChartType(suggestion);
      set({ pendingChartTypeSuggestion: null });
    }
  },

  dismissChartTypeSuggestion: () =>
    set({ pendingChartTypeSuggestion: null }),
}));
