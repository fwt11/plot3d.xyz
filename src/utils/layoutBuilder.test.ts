import { describe, it, expect } from 'vitest';
import { LIGHT_CHART_CSS_VARS, buildLayout, getThemeCssVars } from './layoutBuilder';
import type { AxisConfig, ChartConfig, ExportConfig } from '@/types';

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
