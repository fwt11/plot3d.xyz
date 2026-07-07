import { create } from 'zustand';
import type { Dataset, FigureConfig } from '@/types';
import { useDatasetStore } from './datasetStore';
import { useChartStore } from './chartStore';
import i18n from '@/i18n';

/** A snapshot of the combined state at a point in time */
interface StateSnapshot {
  datasets: Dataset[];
  activeDatasetId: string | null;
  figure: FigureConfig;
}

/** A history entry: a snapshot plus metadata describing the operation. */
export interface HistoryEntry {
  snapshot: StateSnapshot;
  /** Human-readable description of the operation (e.g. "修改标题", "添加图层"). */
  description: string;
  /** Timestamp when the entry was recorded. */
  timestamp: number;
}

/** A saved branch of history (created when undoing then performing a new operation). */
export interface HistoryBranch {
  id: string;
  /** The future entries that were saved when a new operation diverged. */
  entries: HistoryEntry[];
  /** Timestamp when the branch was created. */
  createdAt: number;
  /** Description of the operation that created the branch point. */
  description: string;
}

interface HistoryStore {
  /** Past entries (can be undone). Each entry's snapshot is the state BEFORE the operation. */
  _past: HistoryEntry[];
  /** Future entries (can be redone) on the current branch. */
  _future: HistoryEntry[];
  /** Saved branches from undo-then-new-operation (non-linear history). */
  _branches: HistoryBranch[];

  /** Push current state onto the past stack. If there are future entries, they are saved as a branch.
   *  @param description Human-readable description of the operation about to happen. */
  pushSnapshot: (description?: string) => void;

  /** Undo: restore previous state. */
  undo: () => void;

  /** Redo: restore next state. */
  redo: () => void;

  canUndo: () => boolean;
  canRedo: () => boolean;

  /** Get the full history list (past + current + future) for display. */
  getHistory: () => { past: HistoryEntry[]; future: HistoryEntry[]; branches: HistoryBranch[] };

  /** Restore a saved branch: swaps current future with the branch's entries. */
  restoreBranch: (branchId: string) => void;

  /** Delete a saved branch. */
  deleteBranch: (branchId: string) => void;

  /** Clear all history (past, future, branches). */
  clearHistory: () => void;
}

const MAX_HISTORY = 50;
const MAX_BRANCHES = 10;

function captureSnapshot(): StateSnapshot {
  const ds = useDatasetStore.getState();
  const chart = useChartStore.getState();
  return {
    datasets: ds.datasets,
    activeDatasetId: ds.activeDatasetId,
    figure: chart.figure,
  };
}

function restoreSnapshot(snapshot: StateSnapshot): void {
  useDatasetStore.setState({
    datasets: snapshot.datasets,
    activeDatasetId: snapshot.activeDatasetId,
  });
  useChartStore.setState({
    figure: snapshot.figure,
  });
}

function makeBranchId(): string {
  return `branch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useHistoryStore = create<HistoryStore>()((set, get) => ({
  _past: [],
  _future: [],
  _branches: [],

  pushSnapshot: (description?: string) => {
    const snapshot = captureSnapshot();
    const entry: HistoryEntry = {
      snapshot,
      description: description || i18n.t('history.edit', 'Edit'),
      timestamp: Date.now(),
    };
    set((s) => {
      // If there are future entries, save them as a branch (non-linear history)
      let branches = s._branches;
      if (s._future.length > 0) {
        const branch: HistoryBranch = {
          id: makeBranchId(),
          entries: s._future,
          createdAt: Date.now(),
          description: entry.description,
        };
        branches = [...s._branches, branch].slice(-MAX_BRANCHES);
      }
      return {
        _past: [...s._past.slice(-(MAX_HISTORY - 1)), entry],
        _future: [],
        _branches: branches,
      };
    });
  },

  undo: () => {
    const { _past, _future } = get();
    if (_past.length === 0) return;
    const currentSnapshot = captureSnapshot();
    const previous = _past[_past.length - 1];
    restoreSnapshot(previous.snapshot);
    // Move the current state into future with the description of the undone operation
    const futureEntry: HistoryEntry = {
      snapshot: currentSnapshot,
      description: previous.description,
      timestamp: Date.now(),
    };
    set({
      _past: _past.slice(0, -1),
      _future: [futureEntry, ..._future],
    });
  },

  redo: () => {
    const { _past, _future } = get();
    if (_future.length === 0) return;
    const currentSnapshot = captureSnapshot();
    const next = _future[0];
    restoreSnapshot(next.snapshot);
    // Move the current state into past with the description of the redone operation
    const pastEntry: HistoryEntry = {
      snapshot: currentSnapshot,
      description: next.description,
      timestamp: Date.now(),
    };
    set({
      _past: [..._past, pastEntry],
      _future: _future.slice(1),
    });
  },

  canUndo: () => get()._past.length > 0,
  canRedo: () => get()._future.length > 0,

  getHistory: () => {
    const { _past, _future, _branches } = get();
    return { past: _past, future: _future, branches: _branches };
  },

  restoreBranch: (branchId: string) => {
    const { _branches, _future } = get();
    const branch = _branches.find((b) => b.id === branchId);
    if (!branch) return;
    // Swap: current future becomes a new branch, branch's entries become current future
    const newBranch: HistoryBranch = {
      id: makeBranchId(),
      entries: _future,
      createdAt: Date.now(),
      description: i18n.t('history.branchRestored', 'Branch restored'),
    };
    // Restore the last entry of the branch (the most recent future state)
    if (branch.entries.length > 0) {
      const lastEntry = branch.entries[branch.entries.length - 1];
      restoreSnapshot(lastEntry.snapshot);
    }
    set({
      _future: branch.entries,
      _branches: [..._branches.filter((b) => b.id !== branchId), newBranch].slice(-MAX_BRANCHES),
    });
  },

  deleteBranch: (branchId: string) => {
    set((s) => ({
      _branches: s._branches.filter((b) => b.id !== branchId),
    }));
  },

  clearHistory: () => {
    set({ _past: [], _future: [], _branches: [] });
  },
}));
