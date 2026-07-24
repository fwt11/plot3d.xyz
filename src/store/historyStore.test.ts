import { describe, it, expect, beforeEach } from 'vitest';
import { useChartStore } from './chartStore';
import { useDatasetStore } from './datasetStore';
import { useHistoryStore } from './historyStore';
import type { Dataset } from '@/types';

function makeDataset(): Dataset {
  return {
    id: 'ds-test',
    name: 'Test',
    columns: [
      { id: 'col-x', name: 'X', type: 'X', values: [1, 2, 3] },
      { id: 'col-y', name: 'Y', type: 'Y', values: [10, 20, 30] },
    ],
  };
}

function getCell(colId: string, row: number) {
  const ds = useDatasetStore.getState().datasets.find((d) => d.id === 'ds-test');
  if (!ds) throw new Error('test dataset missing');
  const col = ds.columns.find((c) => c.id === colId);
  if (!col) throw new Error('test column missing');
  return col.values[row];
}

function activeTitle() {
  return useChartStore.getState().figure.subplots[useChartStore.getState().figure.activeIndex].title;
}

beforeEach(() => {
  useHistoryStore.getState().clearHistory();
  useDatasetStore.setState({ datasets: [makeDataset()], activeDatasetId: 'ds-test' });
});

describe('history snapshots figure', () => {
  it('undo restores the previous figure', () => {
    const before = activeTitle();
    useChartStore.getState().setChartTitle('Changed');
    expect(activeTitle()).toBe('Changed');
    useHistoryStore.getState().undo();
    expect(activeTitle()).toBe(before);
  });
});

describe('cell edit sessions (focus-time snapshot + silent writes)', () => {
  it('undo restores the pre-edit value and redo restores the edited value', () => {
    const description = 'Edit cell';
    // onFocus: capture the pre-edit state BEFORE the first silent write
    useHistoryStore.getState().pushSnapshot(description);
    // typing: silent writes only
    useDatasetStore.getState().updateCellValueSilent('ds-test', 'col-y', 0, '99');
    useDatasetStore.getState().updateCellValueSilent('ds-test', 'col-y', 0, '999');
    expect(getCell('col-y', 0)).toBe('999');
    // the whole session produced exactly one history entry
    expect(useHistoryStore.getState()._past.filter((e) => e.description === description)).toHaveLength(1);

    useHistoryStore.getState().undo();
    expect(getCell('col-y', 0)).toBe(10);
    useHistoryStore.getState().redo();
    expect(getCell('col-y', 0)).toBe('999');
  });

  it('drops the speculative snapshot when the session ends without changes', () => {
    const description = 'Edit cell';
    useHistoryStore.getState().pushSnapshot(description);
    // onBlur with the value unchanged: cancel the speculative snapshot
    useHistoryStore.getState().popLastSnapshot(description);
    expect(useHistoryStore.getState().canUndo()).toBe(false);
  });

  it('popLastSnapshot never removes an entry with a different description', () => {
    useHistoryStore.getState().pushSnapshot('Some other edit');
    useHistoryStore.getState().popLastSnapshot('Edit cell');
    expect(useHistoryStore.getState().canUndo()).toBe(true);
    useHistoryStore.getState().popLastSnapshot('Some other edit');
    expect(useHistoryStore.getState().canUndo()).toBe(false);
  });
});

describe('batch fill (one snapshot before the silent writes)', () => {
  it('a single undo reverts the whole batch', () => {
    useHistoryStore.getState().pushSnapshot('Fill cells');
    [0, 1, 2].forEach((row) =>
      useDatasetStore.getState().updateCellValueSilent('ds-test', 'col-y', row, '0')
    );
    expect(getCell('col-y', 2)).toBe('0');

    useHistoryStore.getState().undo();
    expect(getCell('col-y', 0)).toBe(10);
    expect(getCell('col-y', 1)).toBe(20);
    expect(getCell('col-y', 2)).toBe(30);
  });
});

describe('restoreBranch', () => {
  it('applies the branch tip, leaves nothing to redo, and creates no empty branch', () => {
    useChartStore.getState().setChartTitle('T1');
    useHistoryStore.getState().undo(); // future = [T1 state]
    useChartStore.getState().setChartTitle('T2'); // diverges: future saved as a branch
    expect(activeTitle()).toBe('T2');

    const { branches } = useHistoryStore.getState().getHistory();
    expect(branches).toHaveLength(1);

    useHistoryStore.getState().restoreBranch(branches[0].id);
    // restored to the branch tip...
    expect(activeTitle()).toBe('T1');
    // ...with nothing left to redo (redo must NOT jump back to the branch start)
    expect(useHistoryStore.getState().canRedo()).toBe(false);
    useHistoryStore.getState().redo();
    expect(activeTitle()).toBe('T1');
    // the current future was empty, so no empty branch may be created
    expect(useHistoryStore.getState().getHistory().branches).toHaveLength(0);
  });

  it('saves a non-empty current future as a new branch when restoring', () => {
    useChartStore.getState().setChartTitle('A');
    useHistoryStore.getState().undo();
    useChartStore.getState().setChartTitle('B'); // branch1 holds the 'A' state
    const branch1 = useHistoryStore.getState().getHistory().branches[0];

    useHistoryStore.getState().undo(); // future = [B state]
    useHistoryStore.getState().restoreBranch(branch1.id);

    expect(activeTitle()).toBe('A');
    const { branches, future } = useHistoryStore.getState().getHistory();
    expect(future).toHaveLength(0);
    // branch1 consumed, the displaced future saved as exactly one new branch
    expect(branches).toHaveLength(1);
    expect(branches[0].entries).toHaveLength(1);
  });
});
