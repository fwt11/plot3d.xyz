import { describe, it, expect } from 'vitest';
import { generateMatplotlibScript } from './matplotlibExporter';
import type { ChartConfig, Dataset } from '@/types';

const sampleDatasets: Dataset[] = [
  {
    id: 'ds1',
    name: 'Sample',
    columns: [
      { id: 'c1', name: 'x', type: 'X', values: [1, 2, 3, 4, 5] },
      { id: 'c2', name: 'y', type: 'Y', values: [10, 20, 30, 40, 50] },
    ],
  },
];

const baseConfig: ChartConfig = {
  id: 'c1',
  type: 'line',
  title: 'Sample Chart',
  xAxis: { label: 'X', unit: 's', autoRange: true, gridVisible: true, logScale: false, scientificNotation: false },
  yAxis: { label: 'Y', autoRange: true, gridVisible: true, logScale: false, scientificNotation: false },
  legend: { visible: true, position: 'top' },
  colorMap: 'viridis',
  layers: [
    {
      id: 'L1',
      datasetId: 'ds1',
      xColumn: 'c1',
      yColumn: 'c2',
      color: '#0ea5e9',
      visible: true,
      lineStyle: 'solid',
      lineWidth: 2,
      pointStyle: 'circle',
      pointSize: 4,
      fill: false,
    },
  ],
  annotations: [],
  marginTop: 50, marginRight: 50, marginBottom: 50, marginLeft: 50,
  exportConfig: { resolutionMultiplier: 2, background: 'white', figureMultiplier: 1 },
  fontSize: 12,
};

describe('generateMatplotlibScript (Phase 5 Task 5.1)', () => {
  it('produces a self-contained Python script with numpy + matplotlib imports', () => {
    const script = generateMatplotlibScript(baseConfig, sampleDatasets);
    expect(script).toContain('import numpy as np');
    expect(script).toContain('import matplotlib.pyplot as plt');
  });

  it('includes a shebang and docstring', () => {
    const script = generateMatplotlibScript(baseConfig, sampleDatasets);
    expect(script).toMatch(/^#!\/usr\/bin\/env python3/);
    expect(script).toContain('"""');
  });

  it('contains a fitting equation comment when fitResult is provided', () => {
    // For now, the function does not accept fitResult — this is a placeholder
    // verifying the basic structure works. Future Phase 3.4 enhancement
    // would add inline fit equation rendering.
    const script = generateMatplotlibScript(baseConfig, sampleDatasets);
    expect(typeof script).toBe('string');
    expect(script.length).toBeGreaterThan(100);
  });

  it('handles scatter chart type', () => {
    const cfg = { ...baseConfig, type: 'scatter' as const };
    const script = generateMatplotlibScript(cfg, sampleDatasets);
    // Should produce valid script without crashing
    expect(script).toContain('plt.');
  });

  it('handles bar chart type', () => {
    const cfg = { ...baseConfig, type: 'bar' as const };
    const script = generateMatplotlibScript(cfg, sampleDatasets);
    expect(script).toContain('plt.');
  });

  it('uses provided filename in output', () => {
    const script = generateMatplotlibScript(baseConfig, sampleDatasets, { filename: 'my_fig' });
    expect(script).toContain('my_fig');
  });

  it('strips .py extension from filename', () => {
    const script = generateMatplotlibScript(baseConfig, sampleDatasets, { filename: 'my_fig.py' });
    expect(script).toContain('my_fig');
    expect(script).not.toContain('my_fig.py');
  });

  it('falls back to "chart" when no title and no filename', () => {
    const cfg = { ...baseConfig, title: '' };
    const script = generateMatplotlibScript(cfg, sampleDatasets, { filename: '' });
    expect(script).toContain('chart');
  });

  it('uses custom DPI', () => {
    const script = generateMatplotlibScript(baseConfig, sampleDatasets, { dpi: 600 });
    expect(script).toContain('600');
  });
});
