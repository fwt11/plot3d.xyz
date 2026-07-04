import { describe, it, expect, beforeEach } from 'vitest';
import { createDefaultChartConfig } from './chartStore';
import { useChartStore, selectActiveChart } from './chartStore';
import { useHistoryStore } from './historyStore';

/** Reset the chartStore to a fresh 1x1 figure so each test starts clean. */
const resetFigure = () => {
  useChartStore.setState({
    figure: {
      rows: 1,
      cols: 1,
      subplots: [createDefaultChartConfig()],
      activeIndex: 0,
      gap: 8,
    },
  });
};

describe('createDefaultChartConfig', () => {
  it('returns a config with a fresh unique id and one layer', () => {
    const a = createDefaultChartConfig();
    const b = createDefaultChartConfig();
    expect(a.id).not.toEqual(b.id);
    expect(a.type).toBe('line');
    expect(a.layers.length).toBeGreaterThanOrEqual(1);
    expect(a.layers[0].id).not.toEqual(b.layers[0].id);
  });
});

describe('chartStore figure model', () => {
  beforeEach(() => resetFigure());

  it('initializes as a 1x1 figure with one subplot', () => {
    const s = useChartStore.getState();
    expect(s.figure.rows).toBe(1);
    expect(s.figure.cols).toBe(1);
    expect(s.figure.subplots.length).toBe(1);
    expect(s.figure.activeIndex).toBe(0);
  });

  it('selectActiveChart returns the active subplot', () => {
    const s = useChartStore.getState();
    expect(selectActiveChart(s)).toBe(s.figure.subplots[s.figure.activeIndex]);
  });

  it('setChartTitle mutates only the active subplot', () => {
    useChartStore.getState().setChartTitle('Hello');
    const s = useChartStore.getState();
    expect(s.figure.subplots[s.figure.activeIndex].title).toBe('Hello');
  });
});

describe('setGrid (multi-subplot)', () => {
  beforeEach(() => resetFigure());

  it('grows the grid by appending fresh subplots with unique ids', () => {
    useChartStore.getState().setGrid(2, 1);
    const fig = useChartStore.getState().figure;
    expect(fig.rows).toBe(2);
    expect(fig.cols).toBe(1);
    expect(fig.subplots.length).toBe(2);
    expect(fig.subplots[0].id).not.toEqual(fig.subplots[1].id);
    // Original subplot is preserved by identity at index 0.
    // (createDefaultChartConfig is only called for the new cells.)
    const defaultConfig = createDefaultChartConfig();
    expect(fig.subplots[1].id).not.toEqual(defaultConfig.id);
  });

  it('shrinks the grid by dropping trailing subplots', () => {
    useChartStore.getState().setGrid(2, 1);
    const before = useChartStore.getState().figure.subplots[0];
    useChartStore.getState().setGrid(1, 1);
    const fig = useChartStore.getState().figure;
    expect(fig.rows).toBe(1);
    expect(fig.cols).toBe(1);
    expect(fig.subplots.length).toBe(1);
    expect(fig.subplots[0]).toBe(before);
  });

  it('clamps activeIndex when shrinking would orphan it', () => {
    useChartStore.getState().setGrid(2, 1);
    useChartStore.getState().setActiveSubplot(1);
    useChartStore.getState().setGrid(1, 1);
    const fig = useChartStore.getState().figure;
    expect(fig.subplots.length).toBe(1);
    expect(fig.activeIndex).toBe(0);
  });

  it('clamps rows/cols to >= 1 and preserves the length invariant', () => {
    useChartStore.getState().setGrid(0, 2);
    const fig = useChartStore.getState().figure;
    expect(fig.rows).toBe(1);
    expect(fig.cols).toBe(2);
    expect(fig.subplots.length).toBe(fig.rows * fig.cols);

    useChartStore.getState().setGrid(-3, -4);
    const fig2 = useChartStore.getState().figure;
    expect(fig2.rows).toBe(1);
    expect(fig2.cols).toBe(1);
    expect(fig2.subplots.length).toBe(fig2.rows * fig2.cols);
  });
});

describe('setActiveSubplot', () => {
  beforeEach(() => resetFigure());

  it('clamps out-of-range indices into [0, length)', () => {
    useChartStore.getState().setGrid(2, 1);
    useChartStore.getState().setActiveSubplot(99);
    expect(useChartStore.getState().figure.activeIndex).toBe(1);

    useChartStore.getState().setActiveSubplot(-5);
    expect(useChartStore.getState().figure.activeIndex).toBe(0);
  });
});

describe('setGap', () => {
  beforeEach(() => resetFigure());

  it('clamps negatives to 0', () => {
    useChartStore.getState().setGap(-12);
    expect(useChartStore.getState().figure.gap).toBe(0);
  });
});

describe('subplot isolation', () => {
  beforeEach(() => resetFigure());

  it('setChartTitle changes only the active subplot in a 2x1 grid', () => {
    useChartStore.getState().setGrid(2, 1);
    useChartStore.getState().setActiveSubplot(1);
    // Seed subplots[0] with a known title.
    useChartStore.getState().setActiveSubplot(0);
    useChartStore.getState().setChartTitle('A');
    // Now mutate only subplots[1].
    useChartStore.getState().setActiveSubplot(1);
    useChartStore.getState().setChartTitle('B');

    const fig = useChartStore.getState().figure;
    expect(fig.subplots[0].title).toBe('A');
    expect(fig.subplots[1].title).toBe('B');
  });

  it('updateActiveChart changes only the active subplot and skips history', () => {
    useChartStore.getState().setGrid(2, 1);
    useChartStore.getState().setActiveSubplot(1);
    useChartStore.getState().setActiveSubplot(0);
    useChartStore.getState().setChartTitle('A');

    useChartStore.getState().setActiveSubplot(1);
    const historyBefore = useHistoryStore.getState();
    useChartStore.getState().updateActiveChart((c) => ({ ...c, title: 'B' }));

    const fig = useChartStore.getState().figure;
    expect(fig.subplots[0].title).toBe('A');
    expect(fig.subplots[1].title).toBe('B');
    // updateActiveChart must not push to history (used by cross-store actions).
    expect(useHistoryStore.getState()).toBe(historyBefore);
  });
});