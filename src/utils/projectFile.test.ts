import { describe, it, expect } from 'vitest';
import { sanitizeProjectFile, serializeProject } from './projectFile';
import type { FigureConfig } from '@/types';

const oldV5File = {
  version: 5,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  datasets: [{ id: 'ds1', name: 'D', columns: [
    { id: 'x', name: 'x', type: 'X', values: [1, 2, 3] },
    { id: 'y', name: 'y', type: 'Y', values: [4, 5, 6] },
  ]}],
  chartConfig: { id: 'c1', type: 'line', title: 'Old', layers: [
    { id: 'l1', datasetId: 'ds1', xColumn: 'x', yColumn: 'y', color: '#000',
      visible: true, lineStyle: 'solid', lineWidth: 2, pointStyle: 'none', pointSize: 4, fill: false },
  ]},
  theme: 'dark', lang: 'en',
};

describe('projectFile figure migration', () => {
  it('wraps a v5 single-chart file as a 1x1 figure', () => {
    const p = sanitizeProjectFile(oldV5File);
    expect(p).not.toBeNull();
    const fig = p!.figure as FigureConfig;
    expect(fig.rows).toBe(1);
    expect(fig.cols).toBe(1);
    expect(fig.subplots.length).toBe(1);
    expect(fig.subplots[0].title).toBe('Old');
    expect(fig.activeIndex).toBe(0);
  });

  it('round-trips a 2x1 figure', () => {
    const p = sanitizeProjectFile(oldV5File)!;
    const fig2 = { ...p.figure, rows: 2, cols: 1,
      subplots: [p.figure.subplots[0], { ...p.figure.subplots[0], id: 'c2', title: 'Second' }],
    };
    const serialized = serializeProject({ datasets: p.datasets, figure: fig2, theme: 'dark', lang: 'en' });
    const restored = sanitizeProjectFile(serialized)!;
    expect(restored.figure.subplots.length).toBe(2);
    expect(restored.figure.subplots[1].title).toBe('Second');
  });
});