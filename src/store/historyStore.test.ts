import { describe, it, expect } from 'vitest';
import { useChartStore } from './chartStore';
import { useHistoryStore } from './historyStore';

describe('history snapshots figure', () => {
  it('undo restores the previous figure', () => {
    useHistoryStore.getState().clearHistory();
    const before = useChartStore.getState().figure.subplots[0].title;
    useChartStore.getState().setChartTitle('Changed');
    expect(useChartStore.getState().figure.subplots[0].title).toBe('Changed');
    useHistoryStore.getState().undo();
    expect(useChartStore.getState().figure.subplots[0].title).toBe(before);
  });
});