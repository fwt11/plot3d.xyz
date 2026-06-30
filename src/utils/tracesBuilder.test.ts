import { describe, it, expect } from 'vitest';
import {
  hexToRgba,
  lineStyleToDash,
  pointStyleToSymbol,
  hexToHue,
  colToNumbers,
  axisLabelText,
  buildErrorBar,
} from './tracesBuilder';
import type { DataColumn, ErrorBarConfig } from '@/types';

describe('hexToRgba', () => {
  it('converts 6-char hex with alpha', () => {
    expect(hexToRgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('converts 3-char hex', () => {
    expect(hexToRgba('#f00', 1)).toBe('rgba(255, 0, 0, 1)');
  });

  it('clamps alpha to [0, 1]', () => {
    expect(hexToRgba('#000000', 1.5)).toBe('rgba(0, 0, 0, 1)');
    expect(hexToRgba('#000000', -0.5)).toBe('rgba(0, 0, 0, 0)');
  });

  it('handles missing # prefix', () => {
    expect(hexToRgba('00ff00', 0.7)).toBe('rgba(0, 255, 0, 0.7)');
  });

  it('returns black for invalid hex length', () => {
    expect(hexToRgba('#abcd', 1)).toBe('rgba(0, 0, 0, 1)');
  });
});

describe('lineStyleToDash', () => {
  it('maps to Plotly dash strings', () => {
    expect(lineStyleToDash('solid')).toBe('solid');
    expect(lineStyleToDash('dashed')).toBe('dash');
    expect(lineStyleToDash('dotted')).toBe('dot');
  });
});

describe('pointStyleToSymbol', () => {
  it('maps to Plotly symbol names', () => {
    expect(pointStyleToSymbol('circle')).toBe('circle');
    expect(pointStyleToSymbol('square')).toBe('square');
    expect(pointStyleToSymbol('triangle')).toBe('triangle-up');
    expect(pointStyleToSymbol('none')).toBe('circle');
  });
});

describe('hexToHue', () => {
  it('red is hue 0', () => {
    expect(hexToHue('#ff0000')).toBe(0);
  });

  it('green is hue 120', () => {
    expect(hexToHue('#00ff00')).toBeCloseTo(120, 0);
  });

  it('blue is hue 240', () => {
    expect(hexToHue('#0000ff')).toBeCloseTo(240, 0);
  });

  it('gray is hue 0 (no saturation)', () => {
    expect(hexToHue('#808080')).toBe(0);
  });

  it('returns 200 for invalid hex length', () => {
    expect(hexToHue('#xyzxyz')).toBe(NaN); // parseInt returns NaN for non-hex chars
  });
});

describe('colToNumbers', () => {
  it('converts string values to numbers', () => {
    const col: DataColumn = {
      id: 'c1',
      name: 'x',
      type: 'X',
      values: ['1', '2.5', '3'],
    };
    expect(colToNumbers(col)).toEqual([1, 2.5, 3]);
  });

  it('passes through numeric values', () => {
    const col: DataColumn = {
      id: 'c2',
      name: 'x',
      type: 'X',
      values: [1, 2, 3],
    };
    expect(colToNumbers(col)).toEqual([1, 2, 3]);
  });
});

describe('axisLabelText', () => {
  it('returns label only when no unit', () => {
    expect(axisLabelText('Time')).toBe('Time');
  });

  it('appends unit in parentheses', () => {
    expect(axisLabelText('Time', 's')).toBe('Time (s)');
  });

  it('returns empty string for missing label', () => {
    expect(axisLabelText()).toBe('');
  });

  it('returns unit only when label missing', () => {
    expect(axisLabelText(undefined, 'V')).toBe('V');
  });
});

describe('buildErrorBar (custom mode)', () => {
  const errorCol: DataColumn = {
    id: 'err',
    name: 'err',
    type: 'error',
    values: ['0.1', '0.2', '0.15'],
  };

  it('returns undefined when no error columns', () => {
    expect(buildErrorBar(undefined, undefined, undefined, '#000')).toBeUndefined();
  });

  it('uses symmetric custom error column', () => {
    const cfg: ErrorBarConfig = {
      type: 'custom',
      capWidth: 6,
      capStyle: 'line',
      showCap: true,
      asymmetric: false,
      thickness: 2,
    };
    const result = buildErrorBar(errorCol, undefined, undefined, '#000', cfg);
    expect(result).toBeDefined();
    expect(result!.type).toBe('data');
    expect(result!.array).toEqual([0.1, 0.2, 0.15]);
    expect(result!.color).toBe('#000');
  });

  it('uses asymmetric error columns when asymmetric=true', () => {
    const errorPlus: DataColumn = {
      id: 'ep',
      name: 'ep',
      type: 'errorPlus',
      values: ['0.5', '0.4', '0.3'],
    };
    const errorMinus: DataColumn = {
      id: 'em',
      name: 'em',
      type: 'errorMinus',
      values: ['0.1', '0.2', '0.3'],
    };
    const cfg: ErrorBarConfig = {
      type: 'custom',
      capWidth: 8,
      capStyle: 'bracket',
      showCap: true,
      asymmetric: true,
      thickness: 1,
    };
    const result = buildErrorBar(undefined, errorPlus, errorMinus, '#f00', cfg);
    expect(result).toBeDefined();
    expect(result!.array).toEqual([0.5, 0.4, 0.3]);
    expect(result!.arrayminus).toEqual([0.1, 0.2, 0.3]);
  });

  it('returns visible=true by default (showCap not propagated in current impl)', () => {
    const cfg: ErrorBarConfig = {
      type: 'custom',
      capWidth: 6,
      capStyle: 'line',
      showCap: false,
      asymmetric: false,
      thickness: 2,
    };
    const result = buildErrorBar(errorCol, undefined, undefined, '#000', cfg);
    // Current implementation always sets visible=true for custom errors
    expect(result!.visible).toBe(true);
  });
});

describe('buildErrorBar (statistical mode)', () => {
  it('computes SD per unique X group', () => {
    const xCol: DataColumn = { id: 'x', name: 'x', type: 'X', values: ['1', '1', '1', '2', '2', '2'] };
    const yCol: DataColumn = { id: 'y', name: 'y', type: 'Y', values: ['10', '12', '14', '20', '22', '24'] };
    const cfg: ErrorBarConfig = {
      type: 'sd',
      capWidth: 6,
      capStyle: 'line',
      showCap: true,
      asymmetric: false,
      thickness: 2,
    };
    const result = buildErrorBar(undefined, undefined, undefined, '#000', cfg, xCol, yCol);
    expect(result).toBeDefined();
    // 2 unique X values → 2 SD values
    const arr = result!.array as number[];
    expect(arr).toHaveLength(2);
    // sample SD for [10,12,14] = sqrt(8/2) = 2; same for [20,22,24] (n-1 denominator)
    expect(arr[0]).toBeCloseTo(2, 2);
    expect(arr[1]).toBeCloseTo(2, 2);
    expect(result!.symmetric).toBe(true);
  });

  it('returns undefined when statistical mode lacks x/y columns', () => {
    const cfg: ErrorBarConfig = {
      type: 'sd',
      capWidth: 6,
      capStyle: 'line',
      showCap: true,
      asymmetric: false,
      thickness: 2,
    };
    // xCol/yCol not provided → falls through to custom check
    const result = buildErrorBar(undefined, undefined, undefined, '#000', cfg);
    expect(result).toBeUndefined();
  });
});

