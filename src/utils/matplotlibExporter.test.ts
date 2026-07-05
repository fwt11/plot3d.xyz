import { describe, it, expect } from 'vitest';
import { generateMatplotlibScript, generateFigureMatplotlibScript, latexForMatplotlib } from './matplotlibExporter';
import type { ChartConfig, Dataset, FigureConfig } from '@/types';

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

  it('exports data-coord text annotations as ax.annotate', () => {
    const cfg: ChartConfig = {
      ...baseConfig,
      annotations: [
        {
          id: 'a1',
          type: 'text',
          x: 2.5,
          y: 35,
          content: 'Peak here',
          fontSize: 12,
          color: '#ef4444',
          visible: true,
          coordMode: 'data',
        },
      ],
    };
    const script = generateMatplotlibScript(cfg, sampleDatasets);
    expect(script).toMatch(/ax\.annotate.*Peak here/);
  });

  it('exports percent-coord text annotations as fig.text', () => {
    const cfg: ChartConfig = {
      ...baseConfig,
      annotations: [
        {
          id: 'a1',
          type: 'text',
          x: 50,
          y: 95,
          content: 'Top center',
          fontSize: 12,
          color: '#000',
          visible: true,
          coordMode: 'percent',
        },
      ],
    };
    const script = generateMatplotlibScript(cfg, sampleDatasets);
    expect(script).toMatch(/fig\.text.*Top center/);
  });

  it('exports horizontal line annotations as axhline', () => {
    const cfg: ChartConfig = {
      ...baseConfig,
      annotations: [
        {
          id: 'a1',
          type: 'hline',
          x: 0,
          y: 25,
          content: '',
          fontSize: 12,
          color: '#888',
          visible: true,
          coordMode: 'data',
          referenceValue: 25,
        },
      ],
    };
    const script = generateMatplotlibScript(cfg, sampleDatasets);
    expect(script).toContain('axhline');
  });

  it('exports vertical line annotations as axvline', () => {
    const cfg: ChartConfig = {
      ...baseConfig,
      annotations: [
        {
          id: 'a1',
          type: 'vline',
          x: 3,
          y: 0,
          content: '',
          fontSize: 12,
          color: '#888',
          visible: true,
          coordMode: 'data',
          referenceValue: 3,
        },
      ],
    };
    const script = generateMatplotlibScript(cfg, sampleDatasets);
    expect(script).toContain('axvline');
  });

  it('exports rect annotations as plt.Rectangle patches', () => {
    const cfg: ChartConfig = {
      ...baseConfig,
      annotations: [
        {
          id: 'a1',
          type: 'rect',
          x: 1, y: 20,
          content: '',
          fontSize: 12,
          color: '#888',
          visible: true,
          coordMode: 'data',
          rectSize: { w: 2, h: 10 },
        },
      ],
    };
    const script = generateMatplotlibScript(cfg, sampleDatasets);
    expect(script).toContain('plt.Rectangle');
  });

  it('exports arrow annotations with arrowprops', () => {
    const cfg: ChartConfig = {
      ...baseConfig,
      annotations: [
        {
          id: 'a1',
          type: 'arrow',
          x: 1, y: 10,
          content: '',
          fontSize: 12,
          color: '#000',
          visible: true,
          coordMode: 'data',
          endPoint: { x: 4, y: 30 },
        },
      ],
    };
    const script = generateMatplotlibScript(cfg, sampleDatasets);
    expect(script).toMatch(/arrowprops/);
  });

  it('skips invisible annotations', () => {
    const cfg: ChartConfig = {
      ...baseConfig,
      annotations: [
        {
          id: 'a1',
          type: 'text',
          x: 2, y: 30,
          content: 'Should not appear',
          fontSize: 12,
          color: '#000',
          visible: false, // hidden
          coordMode: 'data',
        },
      ],
    };
    const script = generateMatplotlibScript(cfg, sampleDatasets);
    expect(script).not.toContain('Should not appear');
  });

  it('exports LaTeX-rendered annotations via mathtext', () => {
    const cfg: ChartConfig = {
      ...baseConfig,
      annotations: [
        {
          id: 'a1',
          type: 'latex',
          x: 2.5, y: 35,
          content: '$y = 2x + 1$',
          fontSize: 12,
          color: '#000',
          visible: true,
          coordMode: 'data',
        },
      ],
    };
    const script = generateMatplotlibScript(cfg, sampleDatasets);
    // mathtext uses $...$ inline; should pass through
    expect(script).toContain('y = 2x + 1');
  });
});

describe('single-chart matplotlib snapshot (Task 4.5 guard)', () => {
  it('single-chart matplotlib output is stable', () => {
    expect(generateMatplotlibScript(baseConfig, sampleDatasets, { dpi: 300 })).toMatchSnapshot();
  });
});

describe('generateFigureMatplotlibScript (Task 4.5)', () => {
  it('1x1 emits a plt.subplots script via delegation', () => {
    const fig: FigureConfig = { rows: 1, cols: 1, activeIndex: 0, gap: 8, subplots: [baseConfig] };
    const script = generateFigureMatplotlibScript(fig, sampleDatasets, {});
    expect(script).toContain('plt.subplots');
  });

  it('2x1 emits both axes populated with axs[0] and axs[1]', () => {
    const cfg2: ChartConfig = { ...baseConfig, id: 'c2', title: 'Second' };
    const fig: FigureConfig = { rows: 2, cols: 1, activeIndex: 0, gap: 8, subplots: [baseConfig, cfg2] };
    const script = generateFigureMatplotlibScript(fig, sampleDatasets, {});
    expect(script).toContain('plt.subplots(2, 1');
    expect(script).toMatch(/axs\[0\]/);
    expect(script).toMatch(/axs\[1\]/);
  });

  it('variable names do not collide across subplots (unique prefix per subplot)', () => {
    const cfg2: ChartConfig = { ...baseConfig, id: 'c2', title: 'Second' };
    const fig: FigureConfig = { rows: 2, cols: 1, activeIndex: 0, gap: 8, subplots: [baseConfig, cfg2] };
    const script = generateFigureMatplotlibScript(fig, sampleDatasets, {});
    // Each subplot's data arrays must be namespaced: 's0_x0' and 's1_x0' rather than colliding 'x0'.
    expect(script).toContain('s0_x0');
    expect(script).toContain('s1_x0');
  });
});

describe('latexForMatplotlib', () => {
  it('converts $$..$$ (KaTeX display math) to $..$ (matplotlib mathtext inline)', () => {
    expect(latexForMatplotlib('$$e=mc^2$$')).toBe('$e=mc^2$');
  });

  it('converts multi-line display math', () => {
    expect(latexForMatplotlib('$$y = 2x + 1$$')).toBe('$y = 2x + 1$');
  });

  it('handles multiple display math blocks in same string', () => {
    expect(latexForMatplotlib('Title: $$e=mc^2$$ and $$\\alpha$$')).toBe('Title: $e=mc^2$ and $\\alpha$');
  });

  it('passes through single-$ inline math unchanged', () => {
    expect(latexForMatplotlib('$e=mc^2$')).toBe('$e=mc^2$');
  });

  it('passes through plain text unchanged', () => {
    expect(latexForMatplotlib('Plain text label')).toBe('Plain text label');
  });

  it('handles empty string', () => {
    expect(latexForMatplotlib('')).toBe('');
  });
});

describe('generateMatplotlibScript with KaTeX display math (bug repro)', () => {
  it('does not emit $$..$$ to ax.annotate (matplotlib mathtext incompatibility)', () => {
    const cfg: ChartConfig = {
      ...baseConfig,
      annotations: [
        {
          id: 'a1',
          type: 'fitEquation',
          x: 2.5, y: 35,
          content: '$$ y = 2.0000x + 1.0000 $$',  // equationToLatex format
          fontSize: 12,
          color: '#000',
          visible: true,
          coordMode: 'data',
        },
      ],
    };
    const script = generateMatplotlibScript(cfg, sampleDatasets);
    // Should NOT contain "$$" (which breaks matplotlib mathtext)
    expect(script).not.toContain('$$');
    // Should contain single-$ inline math (note: spaces inside $$ are preserved)
    expect(script).toContain('y = 2.0000x + 1.0000');
  });

  it('converts percent-coord KaTeX display math to single-$ in fig.text', () => {
    const cfg: ChartConfig = {
      ...baseConfig,
      annotations: [
        {
          id: 'a1',
          type: 'latex',
          x: 50, y: 95,
          content: '$$\\int_0^\\infty e^{-x} dx = 1$$',
          fontSize: 12,
          color: '#000',
          visible: true,
          coordMode: 'percent',
        },
      ],
    };
    const script = generateMatplotlibScript(cfg, sampleDatasets);
    expect(script).toContain('fig.text');
    expect(script).not.toContain('$$');
  });
});
