import { create } from 'zustand';
import type { Dataset, ChartConfig } from '@/types';
import { useDatasetStore } from './datasetStore';
import { useChartStore } from './chartStore';

/** A snapshot of the combined state at a point in time */
interface StateSnapshot {
  datasets: Dataset[];
  activeDatasetId: string | null;
  chartConfig: ChartConfig;
}

interface HistoryStore {
  _past: StateSnapshot[];
  _future: StateSnapshot[];

  /** Push current state onto the past stack and clear future (call BEFORE mutating) */
  pushSnapshot: () => void;

  /** Undo: restore previous state */
  undo: () => void;

  /** Redo: restore next state */
  redo: () => void;

  canUndo: () => boolean;
  canRedo: () => boolean;
}

const MAX_HISTORY = 50;

function captureSnapshot(): StateSnapshot {
  const ds = useDatasetStore.getState();
  const chart = useChartStore.getState();
  return {
    datasets: ds.datasets,
    activeDatasetId: ds.activeDatasetId,
    chartConfig: chart.chartConfig,
  };
}

function restoreSnapshot(snapshot: StateSnapshot): void {
  useDatasetStore.setState({
    datasets: snapshot.datasets,
    activeDatasetId: snapshot.activeDatasetId,
  });
  useChartStore.setState({
    chartConfig: snapshot.chartConfig,
  });
}

export const useHistoryStore = create<HistoryStore>()((set, get) => ({
  _past: [],
  _future: [],

  pushSnapshot: () => {
    const snapshot = captureSnapshot();
    set((s) => ({
      _past: [...s._past.slice(-(MAX_HISTORY - 1)), snapshot],
      _future: [],
    }));
  },

  undo: () => {
    const { _past, _future } = get();
    if (_past.length === 0) return;
    const currentSnapshot = captureSnapshot();
    const previous = _past[_past.length - 1];
    restoreSnapshot(previous);
    set({
      _past: _past.slice(0, -1),
      _future: [currentSnapshot, ..._future],
    });
  },

  redo: () => {
    const { _past, _future } = get();
    if (_future.length === 0) return;
    const currentSnapshot = captureSnapshot();
    const next = _future[0];
    restoreSnapshot(next);
    set({
      _past: [..._past, currentSnapshot],
      _future: _future.slice(1),
    });
  },

  canUndo: () => get()._past.length > 0,
  canRedo: () => get()._future.length > 0,
}));
