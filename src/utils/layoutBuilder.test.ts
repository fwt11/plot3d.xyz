import { describe, it, expect } from 'vitest';
import { LIGHT_CHART_CSS_VARS, buildLayout, buildInsets, getThemeCssVars } from './layoutBuilder';
import type { AxisConfig, ChartConfig, ExportConfig, InsetConfig } from '@/types';

const axis = (overrides: Partial<AxisConfig> = {}): AxisConfig => ({
  label: '',
  autoRange: true,
  gridVisible: true,
  logScale: false,
  scientificNotation: false,
  ...overrides,
});

const exportCfg: ExportConfig = {
  resolutionMultiplier: 2,
  background: 'theme',
  figureMultiplier: 1,
};

const baseConfig: ChartConfig = {
  id: 'c1',
  type: 'line',
  title: 'Test',
  xAxis: axis({ label: 'X', unit: 's' }),
  yAxis: axis({ label: 'Y' }),
  legend: { visible: true, position: 'top' },
  colorMap: 'viridis',
  layers: [],
  annotations: [],
  marginTop: 60,
  marginRight: 60,
  marginBottom: 60,
  marginLeft: 60,
  exportConfig: exportCfg,
  fontSize: 12,
};

describe('LIGHT_CHART_CSS_VARS', () => {
  it('exposes expected keys', () => {
    expect(LIGHT_CHART_CSS_VARS).toHaveProperty('textColor');
    expect(LIGHT_CHART_CSS_VARS).toHaveProperty('bgSurface');
    expect(LIGHT_CHART_CSS_VARS.bgSurface).toBe('#ffffff');
  });
});

describe('buildLayout', () => {
  it('sets title from config', () => {
    const result = buildLayout(baseConfig, LIGHT_CHART_CSS_VARS, false, false, false, [], false);
    expect((result.title as { text: string }).text).toBe('Test');
  });

  it('applies transparent background when requested', () => {
    const result = buildLayout(baseConfig, LIGHT_CHART_CSS_VARS, false, false, false, [], false, true);
    expect(result.paper_bgcolor).toBe('rgba(0,0,0,0)');
    expect(result.plot_bgcolor).toBe('rgba(0,0,0,0)');
  });

  it('uses theme background by default', () => {
    const result = buildLayout(baseConfig, LIGHT_CHART_CSS_VARS, false, false, false, [], false);
    expect(result.paper_bgcolor).toBe('#ffffff');
  });

  it('respects margin values from config', () => {
    const cfg = { ...baseConfig, marginTop: 100, marginLeft: 80 };
    const result = buildLayout(cfg, LIGHT_CHART_CSS_VARS, false, false, false, [], false);
    const margin = result.margin as { t: number; l: number };
    expect(margin.t).toBe(100);
    expect(margin.l).toBe(80);
  });

  it('respects showlegend from config', () => {
    const cfg = { ...baseConfig, legend: { ...baseConfig.legend, visible: false } };
    const result = buildLayout(cfg, LIGHT_CHART_CSS_VARS, false, false, false, [], false);
    expect(result.showlegend).toBe(false);
  });

  it('maps legend position "inside-top-right"', () => {
    const cfg = { ...baseConfig, legend: { ...baseConfig.legend, position: 'inside-top-right' as const } };
    const result = buildLayout(cfg, LIGHT_CHART_CSS_VARS, false, false, false, [], false);
    const legend = result.legend as { x: number; y: number };
    expect(legend.x).toBeCloseTo(0.98, 2);
    expect(legend.y).toBeCloseTo(0.98, 2);
  });

  it('falls back to top position for unknown legend position', () => {
    const cfg = {
      ...baseConfig,
      legend: { ...baseConfig.legend, position: 'unknown' as unknown as 'top' },
    };
    const result = buildLayout(cfg, LIGHT_CHART_CSS_VARS, false, false, false, [], false);
    const legend = result.legend as { x: number; y: number };
    expect(legend.x).toBeCloseTo(0.5, 2); // top
  });

  it('uses empty title for blank title', () => {
    const cfg = { ...baseConfig, title: '' };
    const result = buildLayout(cfg, LIGHT_CHART_CSS_VARS, false, false, false, [], false);
    expect((result.title as { text: string }).text).toBe('');
  });
});

describe('getThemeCssVars', () => {
  it('reads CSS variables from document root', () => {
    // jsdom provides document.documentElement
    const vars = getThemeCssVars();
    expect(vars).toHaveProperty('textColor');
    expect(vars).toHaveProperty('bgSurface');
    expect(vars).toHaveProperty('gridColor');
    // All values should be non-empty strings (fallbacks exist)
    expect(typeof vars.textColor).toBe('string');
    expect(typeof vars.bgSurface).toBe('string');
  });
});

describe('buildLayout — 2D dual-Y axis', () => {
  it('adds yaxis2 when a layer has yAxisSide=right', () => {
    const cfg: ChartConfig = {
      ...baseConfig,
      yAxisRight: axis({ label: 'Right Y', unit: 'A' }),
    };
    const expanded = [
      { layer: { id: 'L1', yAxisSide: 'right' as const, datasetId: 'd1', xColumn: 'x', yColumn: 'y', color: '#f00', visible: true, lineStyle: 'solid' as const, lineWidth: 1, pointStyle: 'circle' as const, pointSize: 4, fill: false }, dataset: {} as never },
    ];
    const result = buildLayout(cfg, LIGHT_CHART_CSS_VARS, false, false, false, expanded as never, false);
    expect(result.yaxis2).toBeDefined();
    const yaxis2 = result.yaxis2 as { title: { text: string }; overlaying: string; side: string };
    expect(yaxis2.title.text).toContain('Right Y');
    expect(yaxis2.overlaying).toBe('y');
    expect(yaxis2.side).toBe('right');
  });
});

describe('buildLayout — 3D chart', () => {
  it('adds scene config when is3DType=true', () => {
    const result = buildLayout(baseConfig, LIGHT_CHART_CSS_VARS, true, false, false, [], false);
    expect(result.scene).toBeDefined();
  });

  it('omits scene for 2D charts', () => {
    const result = buildLayout(baseConfig, LIGHT_CHART_CSS_VARS, false, false, false, [], false);
    expect(result.scene).toBeUndefined();
  });
});

describe('buildLayout — polar chart', () => {
  it('adds polar config when isPolar=true', () => {
    const result = buildLayout(baseConfig, LIGHT_CHART_CSS_VARS, false, false, true, [], false);
    expect(result.polar).toBeDefined();
  });
});

describe('buildLayout — axis min/max', () => {
  it('applies y-axis min/max when autoRange=false', () => {
    const cfg: ChartConfig = {
      ...baseConfig,
      yAxis: { ...baseConfig.yAxis, autoRange: false, min: 0, max: 100 },
    };
    const result = buildLayout(cfg, LIGHT_CHART_CSS_VARS, false, false, false, [], false);
    const yaxis = result.yaxis as { range?: [number, number]; autorange?: boolean };
    expect(yaxis.range).toEqual([0, 100]);
    expect(yaxis.autorange).toBe(false);
  });

  it('applies x-axis min/max when autoRange=false', () => {
    const cfg: ChartConfig = {
      ...baseConfig,
      xAxis: { ...baseConfig.xAxis, autoRange: false, min: -5, max: 5 },
    };
    const result = buildLayout(cfg, LIGHT_CHART_CSS_VARS, false, false, false, [], false);
    const xaxis = result.xaxis as { range?: [number, number]; autorange?: boolean };
    expect(xaxis.range).toEqual([-5, 5]);
    expect(xaxis.autorange).toBe(false);
  });
});

describe('buildLayout — log scale', () => {
  it('uses log type when yAxis.logScale=true', () => {
    const cfg: ChartConfig = {
      ...baseConfig,
      yAxis: { ...baseConfig.yAxis, logScale: true },
    };
    const result = buildLayout(cfg, LIGHT_CHART_CSS_VARS, false, false, false, [], false);
    const yaxis = result.yaxis as { type: string };
    expect(yaxis.type).toBe('log');
  });
});

describe('buildLayout — date axis (Phase 4 Task 4.1)', () => {
  it('uses date type when xAxis.timezone is set', () => {
    const cfg: ChartConfig = {
      ...baseConfig,
      xAxis: { ...baseConfig.xAxis, timezone: 'UTC' },
    };
    const result = buildLayout(cfg, LIGHT_CHART_CSS_VARS, false, false, false, [], false);
    const xaxis = result.xaxis as { type: string; timezone?: string };
    expect(xaxis.type).toBe('date');
    expect(xaxis.timezone).toBe('UTC');
  });

  it('includes tickformatstops for automatic date tick selection', () => {
    const cfg: ChartConfig = {
      ...baseConfig,
      xAxis: { ...baseConfig.xAxis, timezone: 'America/New_York' },
    };
    const result = buildLayout(cfg, LIGHT_CHART_CSS_VARS, false, false, false, [], false);
    const xaxis = result.xaxis as { tickformatstops?: Array<{ dtickrange: [number, number]; value: string }> };
    expect(xaxis.tickformatstops).toBeDefined();
    expect(xaxis.tickformatstops!.length).toBeGreaterThan(0);
    // Covers second, minute, hour, day, month, year ranges
    expect(xaxis.tickformatstops!.some((s) => s.value.includes('%H:%M'))).toBe(true);
  });

  it('falls back to linear/category when timezone is undefined', () => {
    const result = buildLayout(baseConfig, LIGHT_CHART_CSS_VARS, false, false, false, [], false);
    const xaxis = result.xaxis as { type: string; timezone?: string };
    expect(xaxis.timezone).toBeUndefined();
    expect(xaxis.type).not.toBe('date');
  });
});

describe('buildInsets (Phase 4 Task 4.5)', () => {
  const inset = (position: InsetConfig['position']): InsetConfig => ({
    id: 'i1',
    visible: true,
    position,
    widthPercent: 30,
    heightPercent: 20,
  });

  it('returns empty array when no insets', () => {
    expect(buildInsets({ marginTop: 0, marginLeft: 0, marginRight: 0, marginBottom: 0 })).toEqual([]);
  });

  it('skips hidden insets', () => {
    expect(buildInsets({
      marginTop: 0, marginLeft: 0, marginRight: 0, marginBottom: 0,
      insets: [{ ...inset('top-right'), visible: false }],
    })).toEqual([]);
  });

  it('renders top-right inset at high x and y', () => {
    const shapes = buildInsets({
      marginTop: 0, marginLeft: 0, marginRight: 0, marginBottom: 0,
      insets: [inset('top-right')],
    });
    expect(shapes).toHaveLength(1);
    const s = shapes[0] as { x0: number; x1: number; y0: number; y1: number; type: string };
    expect(s.type).toBe('rect');
    expect(s.x1).toBeCloseTo(0.99, 2);
    expect(s.x0).toBeCloseTo(0.69, 2); // 0.99 - 0.30
    expect(s.y1).toBeCloseTo(0.99, 2);
  });

  it('renders bottom-left inset at low x and y', () => {
    const shapes = buildInsets({
      marginTop: 0, marginLeft: 0, marginRight: 0, marginBottom: 0,
      insets: [inset('bottom-left')],
    });
    const s = shapes[0] as { x0: number; y0: number };
    expect(s.x0).toBeCloseTo(0.01, 2);
    expect(s.y0).toBeCloseTo(0.01, 2);
  });

  it('respects widthPercent and heightPercent', () => {
    const customInset: InsetConfig = { ...inset('top-left'), widthPercent: 50, heightPercent: 10 };
    const shapes = buildInsets({
      marginTop: 0, marginLeft: 0, marginRight: 0, marginBottom: 0,
      insets: [customInset],
    });
    const s = shapes[0] as { x0: number; x1: number; y0: number; y1: number };
    expect(s.x1 - s.x0).toBeCloseTo(0.5, 2);
    expect(s.y1 - s.y0).toBeCloseTo(0.1, 2);
  });

  it('uses paper coordinates (xref/yref = paper)', () => {
    const shapes = buildInsets({
      marginTop: 0, marginLeft: 0, marginRight: 0, marginBottom: 0,
      insets: [inset('bottom-right')],
    });
    const s = shapes[0] as { xref: string; yref: string };
    expect(s.xref).toBe('paper');
    expect(s.yref).toBe('paper');
  });

  it('supports multiple insets simultaneously', () => {
    const shapes = buildInsets({
      marginTop: 0, marginLeft: 0, marginRight: 0, marginBottom: 0,
      insets: [inset('top-left'), inset('bottom-right')],
    });
    expect(shapes).toHaveLength(2);
  });
});
