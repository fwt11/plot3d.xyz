import { describe, it, expect } from 'vitest';
import { createDefaultChartConfig } from './chartStore';
import { useChartStore, selectActiveChart } from './chartStore';

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