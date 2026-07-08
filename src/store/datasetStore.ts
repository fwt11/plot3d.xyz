import { create } from 'zustand';
import type { Dataset, DataColumn, ChartType, LayerConfig } from '@/types';
import { uid } from '@/utils/sampleData';
import { is3DChart } from '@/utils/chart';
import { enrichColumns } from '@/utils/tracesBuilder';
import { sharedDefaultDataset } from './sharedDefaults';
import { useChartStore, selectActiveChart } from './chartStore';
import { useHistoryStore } from './historyStore';
import { useToastStore } from './toastStore';
import {
  savitzkyGolay,
  movingAverage,
  lowPassFilter,
  whittakerSmoothing,
  linearInterp,
  cubicSplineInterp,
  akimaInterp,
  pchipInterp,
  fillMissingValues as fillMissingFn,
  type MissingValueStrategy,
  detectOutliers,
  replaceOutliers,
  type FilterCondition,
} from '@/utils/dataProcessing';
import i18n from '@/i18n';

interface DatasetStore {
  datasets: Dataset[];
  activeDatasetId: string | null;
  pendingChartTypeSuggestion: ChartType | null;

  addDataset: (dataset: Dataset, options?: { setActive?: boolean }) => void;
  removeDataset: (id: string) => void;
  updateDataset: (id: string, data: Partial<Dataset>) => void;
  setActiveDataset: (id: string) => void;
  updateCellValue: (datasetId: string, columnId: string, rowIndex: number, value: string) => void;
  /** Update cell without pushing to history (used during typing; commit on blur via updateCellValue) */
  updateCellValueSilent: (datasetId: string, columnId: string, rowIndex: number, value: string) => void;
  addColumn: (datasetId: string) => void;
  removeColumn: (datasetId: string, columnId: string) => void;
  addRow: (datasetId: string) => void;
  insertRowAt: (datasetId: string, rowIndex: number, offset: 0 | 1) => void;
  removeRow: (datasetId: string, rowIndex: number) => void;
  setColumnType: (datasetId: string, columnId: string, type: DataColumn['type']) => void;
  renameColumn: (datasetId: string, columnId: string, name: string) => void;
  transformColumn: (datasetId: string, columnId: string, fn: (val: number) => number) => void;
  addComputedColumn: (datasetId: string, name: string, fn: (row: Record<string, number>) => number) => void;
  sortDataset: (datasetId: string, columnId: string, ascending: boolean) => void;
  normalizeColumn: (datasetId: string, columnId: string) => void;
  /** Normalize a column using the given method: 'minmax' | 'zscore' | 'log'. */
  normalizeColumnByMethod: (datasetId: string, columnId: string, method: 'minmax' | 'zscore' | 'log') => void;
  /** Smooth a column in-place using the given method. */
  smoothColumn: (datasetId: string, columnId: string, method: 'sg' | 'moving' | 'lowpass' | 'whittaker', params: { windowSize?: number; polyOrder?: number; alpha?: number; lambda?: number }) => void;
  /** Interpolate y values at query x positions and write into a new X + Y column pair. Returns the new column IDs. */
  interpolateColumn: (datasetId: string, xColumnId: string, yColumnId: string, method: 'linear' | 'spline' | 'akima' | 'pchip', queryX: number[], newColumnName?: string) => { newXColId: string; newYColId: string } | null;
  /** Filter rows by a condition on a column; rows failing the condition are removed. */
  filterRowsByCondition: (datasetId: string, columnId: string, condition: FilterCondition) => void;
  /** Fill missing values in a column using the given strategy. */
  fillMissingColumn: (datasetId: string, columnId: string, strategy: MissingValueStrategy) => void;
  /** Detect outliers in a column (IQR method). */
  detectColumnOutliers: (datasetId: string, columnId: string, k?: number) => { indices: number[]; lowerFence: number; upperFence: number; q1: number; q3: number; iqr: number };
  /** Replace outliers in a column with fence values or NaN. */
  replaceColumnOutliers: (datasetId: string, columnId: string, k: number, strategy: 'nan' | 'fence') => void;
  /** Remove rows at the given indices. */
  removeRowsAt: (datasetId: string, rowIndices: number[]) => void;
  acceptChartTypeSuggestion: () => void;
  dismissChartTypeSuggestion: () => void;
}

const defaultDataset = sharedDefaultDataset;

/** Resolve the X column for a dataset: explicit X column, else the first column. */
function resolveXColumn(ds: Dataset): DataColumn | undefined {
  return ds.columns.find((c) => c.type === 'X') ?? ds.columns[0];
}

/** Build a single layer for one Y column, sharing the dataset's X column.
 *  Hue is spread by golden angle so multiple series stay visually distinct. */
function makeLayerForY(
  ds: Dataset,
  xCol: DataColumn | undefined,
  yCol: DataColumn,
  zCol?: DataColumn,
  index = 0,
): LayerConfig {
  const hue = (137.508 * index) % 360;
  return {
    id: uid(),
    datasetId: ds.id,
    xColumn: (xCol ?? yCol).id,
    yColumn: yCol.id,
    zColumn: zCol?.id,
    color: `hsl(${hue.toFixed(1)}, 70%, 55%)`,
    visible: true,
    lineStyle: 'solid',
    lineWidth: 3,
    pointStyle: 'circle',
    pointSize: 6,
    fill: false,
    fillOpacity: 0.35,
  };
}

/**
 * Sync layers for a dataset against its column types.
 * - 2D charts: one layer per Y column (auto multi-curve). Layers whose Y column
 *   is no longer a Y column are dropped; missing Y columns get a layer.
 * - 3D / heatmap: at most one layer (legacy behaviour).
 * Returns the (possibly) new layers array plus counts of added/removed layers.
 * Skipped entirely when the dataset is in `manualDatasets` (user took control).
 */
function syncLayersForDataset(
  layers: LayerConfig[],
  ds: Dataset,
  chartType: ChartType,
  manualDatasets: string[],
): { layers: LayerConfig[]; added: number; removed: number } {
  if (manualDatasets.includes(ds.id)) return { layers, added: 0, removed: 0 };

  const isMultiSeries2D = !is3DChart(chartType) && chartType !== 'heatmap';
  if (!isMultiSeries2D) {
    if (layers.some((l) => l.datasetId === ds.id)) return { layers, added: 0, removed: 0 };
    const xCol = resolveXColumn(ds);
    const yCol = ds.columns.find((c) => c.type === 'Y') ?? ds.columns[1];
    const zCol = ds.columns.find((c) => c.type === 'Z');
    if (xCol && yCol) {
      return { layers: [...layers, makeLayerForY(ds, xCol, yCol, zCol)], added: 1, removed: 0 };
    }
    return { layers, added: 0, removed: 0 };
  }

  const xCol = resolveXColumn(ds);
  const yCols = ds.columns.filter((c) => c.type === 'Y');
  const existingForDs = layers.filter((l) => l.datasetId === ds.id);
  const kept = layers.filter(
    (l) => l.datasetId !== ds.id || ds.columns.some((c) => c.id === l.yColumn && c.type === 'Y'),
  );
  const keptForDs = kept.filter((l) => l.datasetId === ds.id);
  const existingYIds = new Set(existingForDs.map((l) => l.yColumn));
  const addedLayers: LayerConfig[] = [];
  yCols.forEach((yCol) => {
    if (!existingYIds.has(yCol.id)) {
      addedLayers.push(makeLayerForY(ds, xCol, yCol, undefined, keptForDs.length + addedLayers.length));
    }
  });
  const removed = existingForDs.length - keptForDs.length;
  return { layers: [...kept, ...addedLayers], added: addedLayers.length, removed };
}

export const useDatasetStore = create<DatasetStore>()((set, get) => ({
  datasets: [defaultDataset],
  activeDatasetId: defaultDataset.id,
  pendingChartTypeSuggestion: null,

  addDataset: (dataset, options) =>
    set((s) => {
      // Backfill `valueType` for columns that don't have it yet (e.g. JSON
      // project files, fit results, copy/paste). The CSV/Excel import path
      // already does this in FileTab, but doing it here keeps `addDataset`
      // honest as the single chokepoint.
      const enrichedColumns = enrichColumns(dataset.columns);
      const input = enrichedColumns === dataset.columns
        ? dataset
        : { ...dataset, columns: enrichedColumns };
      const hasZ = input.columns.some((c) => c.type === 'Z');
      const xCol = input.columns.find((c) => c.type === 'X') ?? input.columns[0];
      const yCol = input.columns.find((c) => c.type === 'Y') ?? input.columns[1];

      // Push history before cross-store mutation
      useHistoryStore.getState().pushSnapshot(i18n.t('history.addDataset', { defaultValue: 'Add dataset' }));

      // Auto-create layers for this dataset via chartStore (one per Y column)
      const chartState = useChartStore.getState();
      const activeChart = selectActiveChart(chartState);
      const manualDatasets = activeChart.manuallyManagedDatasetIds ?? [];
      const sync = syncLayersForDataset(activeChart.layers, input, activeChart.type, manualDatasets);
      const newLayers = sync.layers;
      const addedLayerCount = sync.added;

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
      useChartStore.getState().updateActiveChart((c) => ({ ...c, layers: newLayers }));

      if (addedLayerCount > 0) {
        useToastStore.getState().addToast(
          i18n.t('toast.autoLayersAdded', { count: addedLayerCount, defaultValue: `Added curves for ${addedLayerCount} Y column(s)` }),
          'info',
        );
      }

      return {
        datasets: [...s.datasets, input],
        activeDatasetId: options?.setActive === false ? s.activeDatasetId : input.id,
        pendingChartTypeSuggestion: suggestion,
      };
    }),

  removeDataset: (id) => {
    useHistoryStore.getState().pushSnapshot(i18n.t('history.removeDataset', { defaultValue: 'Remove dataset' }));
    set((s) => ({
      datasets: s.datasets.filter((d) => d.id !== id),
      activeDatasetId: s.activeDatasetId === id ? (s.datasets[0]?.id ?? null) : s.activeDatasetId,
    }));
    // Remove layers that reference the deleted dataset
    useChartStore.getState().updateActiveChart((c) => ({
      ...c,
      layers: c.layers.filter((l) => l.datasetId !== id),
    }));
  },

  updateDataset: (id, data) => {
    useHistoryStore.getState().pushSnapshot(i18n.t('history.updateDataset', { defaultValue: 'Update dataset' }));
    set((s) => ({
      datasets: s.datasets.map((d) => (d.id === id ? { ...d, ...data } : d)),
    }));
  },

  setActiveDataset: (id) => set({ activeDatasetId: id }),

  updateCellValue: (datasetId, columnId, rowIndex, value) => {
    // Push a single history snapshot when the user commits a cell edit (on blur).
    // During typing, updateCellValueSilent is used to avoid flooding the history stack.
    useHistoryStore.getState().pushSnapshot(i18n.t('history.editCell', { defaultValue: 'Edit cell' }));
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

  updateCellValueSilent: (datasetId, columnId, rowIndex, value) =>
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

  addColumn: (datasetId) => {
    useHistoryStore.getState().pushSnapshot(i18n.t('history.addColumn', { defaultValue: 'Add column' }));
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
    useHistoryStore.getState().pushSnapshot(i18n.t('history.removeColumn', { defaultValue: 'Remove column' }));
    set((s) => ({
      datasets: s.datasets.map((d) =>
        d.id === datasetId
          ? { ...d, columns: d.columns.filter((c) => c.id !== columnId) }
          : d
      ),
    }));
    // Clean up layers that depend on the removed column
    useChartStore.getState().updateActiveChart((c) => ({
      ...c,
      layers: c.layers
        .map((l) => {
          if (l.datasetId !== datasetId) return l;
          if (l.xColumn === columnId || l.yColumn === columnId) return null;
          return {
            ...l,
            zColumn: l.zColumn === columnId ? undefined : l.zColumn,
            errorColumn: l.errorColumn === columnId ? undefined : l.errorColumn,
            errorPlusColumn: l.errorPlusColumn === columnId ? undefined : l.errorPlusColumn,
            errorMinusColumn: l.errorMinusColumn === columnId ? undefined : l.errorMinusColumn,
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null),
    }));
  },

  addRow: (datasetId) => {
    useHistoryStore.getState().pushSnapshot(i18n.t('history.addRow', { defaultValue: 'Add row' }));
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

  insertRowAt: (datasetId, rowIndex, offset) => {
    useHistoryStore.getState().pushSnapshot(i18n.t('history.insertRow', { defaultValue: 'Insert row' }));
    set((s) => ({
      datasets: s.datasets.map((d) => {
        if (d.id !== datasetId) return d;
        const insertIndex = Math.max(0, Math.min(d.columns[0]?.values.length || 0, rowIndex + offset));
        return {
          ...d,
          columns: d.columns.map((c) => ({
            ...c,
            values: [...c.values.slice(0, insertIndex), '', ...c.values.slice(insertIndex)],
          })),
        };
      }),
    }));
  },

  removeRow: (datasetId, rowIndex) => {
    useHistoryStore.getState().pushSnapshot(i18n.t('history.removeRow', { defaultValue: 'Remove row' }));
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
    useHistoryStore.getState().pushSnapshot(i18n.t('history.setColumnType', { defaultValue: 'Set column type' }));

    let syncResult = { added: 0, removed: 0 };

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
      const activeChart = selectActiveChart(chartState);
      const isCurrently3D = is3DChart(activeChart.type);

      let newChartType = activeChart.type;
      if (newType === 'Z' && !isCurrently3D) {
        newChartType = 'surface3d';
      } else if (newType !== 'Z' && isCurrently3D && !hasZColumn) {
        newChartType = 'line';
      }

      let layers = activeChart.layers;
      let added = 0;
      let removed = 0;
      const manualDatasets = activeChart.manuallyManagedDatasetIds ?? [];
      const targetDs = newDatasets.find((d) => d.id === datasetId);
      if (targetDs) {
        const sync = syncLayersForDataset(activeChart.layers, targetDs, newChartType, manualDatasets);
        layers = sync.layers;
        added = sync.added;
        removed = sync.removed;
      }

      // Update chartStore (no history push — already pushed above)
      useChartStore.getState().updateActiveChart((c) => ({
        ...c,
        type: newChartType,
        layers,
      }));

      syncResult = { added, removed };

      return {
        datasets: newDatasets,
      };
    });

    if (syncResult.added > 0) {
      useToastStore.getState().addToast(
        i18n.t('toast.autoLayersAdded', { count: syncResult.added, defaultValue: `Added curves for ${syncResult.added} Y column(s)` }),
        'info',
      );
    } else if (syncResult.removed > 0) {
      useToastStore.getState().addToast(
        i18n.t('toast.autoLayersRemoved', { count: syncResult.removed, defaultValue: `Removed ${syncResult.removed} curve(s)` }),
        'info',
      );
    }
  },

  renameColumn: (datasetId, columnId, name) => {
    useHistoryStore.getState().pushSnapshot(i18n.t('history.renameColumn', { defaultValue: 'Rename column' }));
    set((s) => ({
      datasets: s.datasets.map((d) =>
        d.id === datasetId
          ? { ...d, columns: d.columns.map((c) => (c.id === columnId ? { ...c, name } : c)) }
          : d
      ),
    }));
  },

  transformColumn: (datasetId, columnId, fn) => {
    useHistoryStore.getState().pushSnapshot(i18n.t('history.transformColumn', { defaultValue: 'Transform column' }));
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
    useHistoryStore.getState().pushSnapshot(i18n.t('history.addComputedColumn', { defaultValue: 'Add computed column' }));
    set((s) => ({
      datasets: s.datasets.map((d) => {
        if (d.id !== datasetId) return d;
        const maxRows = Math.max(...d.columns.map((c) => c.values.length), 0);
        const values = Array.from({ length: maxRows }, (_, i) => {
          const row: Record<string, number> = {};
          d.columns.forEach((c, ci) => { const n = Number(c.values[i]); if (!isNaN(n)) row[`col_${ci}`] = n; });
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
    useHistoryStore.getState().pushSnapshot(i18n.t('history.sortDataset', { defaultValue: 'Sort data' }));
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
    useHistoryStore.getState().pushSnapshot(i18n.t('history.normalizeColumn', { defaultValue: 'Normalize column' }));
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

  normalizeColumnByMethod: (datasetId, columnId, method) => {
    useHistoryStore.getState().pushSnapshot(i18n.t('history.normalizeColumn', { defaultValue: 'Normalize column' }));
    set((s) => ({
      datasets: s.datasets.map((d) => {
        if (d.id !== datasetId) return d;
        return {
          ...d,
          columns: d.columns.map((c) => {
            if (c.id !== columnId) return c;
            const nums = c.values.map((v) => { const n = Number(v); return isNaN(n) ? NaN : n; });
            const valid = nums.filter((n) => !isNaN(n));
            if (valid.length === 0) return c;
            if (method === 'minmax') {
              const min = Math.min(...valid);
              const max = Math.max(...valid);
              const range = max - min || 1;
              return { ...c, values: nums.map((n) => isNaN(n) ? '' : String((n - min) / range)) };
            }
            if (method === 'zscore') {
              const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
              const variance = valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length;
              const sd = Math.sqrt(variance) || 1;
              return { ...c, values: nums.map((n) => isNaN(n) ? '' : String((n - mean) / sd)) };
            }
            // log
            return { ...c, values: nums.map((n) => isNaN(n) || n <= 0 ? '' : String(Math.log(n))) };
          }),
        };
      }),
    }));
  },

  smoothColumn: (datasetId, columnId, method, params) => {
    useHistoryStore.getState().pushSnapshot(i18n.t('history.smoothColumn', { defaultValue: 'Smooth column' }));
    set((s) => ({
      datasets: s.datasets.map((d) => {
        if (d.id !== datasetId) return d;
        return {
          ...d,
          columns: d.columns.map((c) => {
            if (c.id !== columnId) return c;
            const nums = c.values.map((v) => { const n = Number(v); return isNaN(n) ? NaN : n; });
            let smoothed: number[];
            switch (method) {
              case 'sg':
                smoothed = savitzkyGolay(nums, params.windowSize ?? 5, params.polyOrder ?? 2);
                break;
              case 'moving':
                smoothed = movingAverage(nums, params.windowSize ?? 5);
                break;
              case 'lowpass':
                smoothed = lowPassFilter(nums, params.alpha ?? 0.2);
                break;
              case 'whittaker':
                smoothed = whittakerSmoothing(nums, params.lambda ?? 10);
                break;
              default:
                return c;
            }
            return { ...c, values: smoothed.map((v) => isNaN(v) ? '' : String(v)) };
          }),
        };
      }),
    }));
  },

  interpolateColumn: (datasetId, xColumnId, yColumnId, method, queryX, newColumnName) => {
    const dataset = get().datasets.find((d) => d.id === datasetId);
    const xCol = dataset?.columns.find((c) => c.id === xColumnId);
    const yCol = dataset?.columns.find((c) => c.id === yColumnId);
    if (!dataset || !xCol || !yCol) return null;

    const xs = xCol.values.map((v) => { const n = Number(v); return isNaN(n) ? NaN : n; });
    const ys = yCol.values.map((v) => { const n = Number(v); return isNaN(n) ? NaN : n; });
    let result: number[];
    switch (method) {
      case 'spline': result = cubicSplineInterp(xs, ys, queryX); break;
      case 'akima': result = akimaInterp(xs, ys, queryX); break;
      case 'pchip': result = pchipInterp(xs, ys, queryX); break;
      default: result = linearInterp(xs, ys, queryX); break;
    }

    const newXColId = uid();
    const newYColId = uid();
    const name = newColumnName ?? `${yCol.name}_${method}`;

    useHistoryStore.getState().pushSnapshot(i18n.t('history.interpolateColumn', { defaultValue: 'Interpolate column' }));
    set((s) => ({
      datasets: s.datasets.map((d) => {
        if (d.id !== datasetId) return d;
        const newXCol: DataColumn = { id: newXColId, name: `${xCol.name}_${method}`, type: 'X', values: queryX.map((v) => String(v)) };
        const newYCol: DataColumn = { id: newYColId, name, type: 'Y', values: result.map((v) => isNaN(v) ? '' : String(v)) };
        return { ...d, columns: [...d.columns, newXCol, newYCol] };
      }),
    }));
    return { newXColId, newYColId };
  },

  filterRowsByCondition: (datasetId, columnId, condition) => {
    useHistoryStore.getState().pushSnapshot(i18n.t('history.filterRows', { defaultValue: 'Filter rows' }));
    set((s) => ({
      datasets: s.datasets.map((d) => {
        if (d.id !== datasetId) return d;
        const col = d.columns.find((c) => c.id === columnId);
        if (!col) return d;
        const keep: boolean[] = col.values.map((v) => {
          const n = Number(v);
          if (isNaN(n)) return false;
          switch (condition.operator) {
            case 'gt': return n > (condition.value ?? 0);
            case 'lt': return n < (condition.value ?? 0);
            case 'ge': return n >= (condition.value ?? 0);
            case 'le': return n <= (condition.value ?? 0);
            case 'eq': return Math.abs(n - (condition.value ?? 0)) < 1e-12;
            case 'ne': return Math.abs(n - (condition.value ?? 0)) >= 1e-12;
            case 'range': return n >= (condition.minValue ?? -Infinity) && n <= (condition.maxValue ?? Infinity);
            default: return true;
          }
        });
        return {
          ...d,
          columns: d.columns.map((c) => ({ ...c, values: c.values.filter((_, i) => keep[i]) })),
        };
      }),
    }));
  },

  fillMissingColumn: (datasetId, columnId, strategy) => {
    useHistoryStore.getState().pushSnapshot(i18n.t('history.fillMissing', { defaultValue: 'Fill missing values' }));
    set((s) => ({
      datasets: s.datasets.map((d) => {
        if (d.id !== datasetId) return d;
        if (strategy === 'delete') {
          // Delete rows where this column has missing values
          const col = d.columns.find((c) => c.id === columnId);
          if (!col) return d;
          const keep = col.values.map((v) => { const n = Number(v); return !isNaN(n); });
          return { ...d, columns: d.columns.map((c) => ({ ...c, values: c.values.filter((_, i) => keep[i]) })) };
        }
        return {
          ...d,
          columns: d.columns.map((c) => c.id === columnId ? { ...c, values: fillMissingFn(c.values, strategy) } : c),
        };
      }),
    }));
  },

  detectColumnOutliers: (datasetId, columnId, k = 1.5) => {
    const ds = get().datasets.find((d) => d.id === datasetId);
    const col = ds?.columns.find((c) => c.id === columnId);
    if (!col) return { indices: [], lowerFence: NaN, upperFence: NaN, q1: NaN, q3: NaN, iqr: NaN };
    return detectOutliers(col.values, k);
  },

  replaceColumnOutliers: (datasetId, columnId, k, strategy) => {
    useHistoryStore.getState().pushSnapshot(i18n.t('history.replaceOutliers', { defaultValue: 'Replace outliers' }));
    set((s) => ({
      datasets: s.datasets.map((d) => {
        if (d.id !== datasetId) return d;
        return {
          ...d,
          columns: d.columns.map((c) => c.id === columnId ? { ...c, values: replaceOutliers(c.values, k, strategy) } : c),
        };
      }),
    }));
  },

  removeRowsAt: (datasetId, rowIndices) => {
    useHistoryStore.getState().pushSnapshot(i18n.t('history.removeRows', { defaultValue: 'Remove rows' }));
    const indexSet = new Set(rowIndices);
    set((s) => ({
      datasets: s.datasets.map((d) =>
        d.id === datasetId
          ? { ...d, columns: d.columns.map((c) => ({ ...c, values: c.values.filter((_, i) => !indexSet.has(i)) })) }
          : d
      ),
    }));
  },

  acceptChartTypeSuggestion: () => {
    const suggestion = get().pendingChartTypeSuggestion;
    if (suggestion) {
      useHistoryStore.getState().pushSnapshot(i18n.t('history.acceptChartType', { defaultValue: 'Accept chart type suggestion' }));
      useChartStore.getState().setChartType(suggestion);
      set({ pendingChartTypeSuggestion: null });
    }
  },

  dismissChartTypeSuggestion: () =>
    set({ pendingChartTypeSuggestion: null }),
}));
