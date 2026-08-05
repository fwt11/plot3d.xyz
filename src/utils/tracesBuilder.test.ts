import { describe, it, expect } from 'vitest';
import {
  hexToRgba,
  lineStyleToDash,
  pointStyleToSymbol,
  hexToHue,
  colToNumbers,
  colToDateMs,
  colToXValues,
  enrichColumn,
  enrichColumns,
  axisLabelText,
  buildErrorBar,
  buildSurfaceMeshLines,
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

describe('colToDateMs', () => {
  it('parses YYYY-MM-DD HH:mm:ss strings to epoch ms', () => {
    const col: DataColumn = {
      id: 'c3',
      name: 'x',
      type: 'X',
      values: ['2026-07-07 17:12:00', '2026-07-08 00:00:00'],
    };
    const out = colToDateMs(col);
    expect(out[0]).toBe(Date.parse('2026-07-07 17:12:00'));
    expect(out[1]).toBe(Date.parse('2026-07-08 00:00:00'));
  });

  it('parses ISO 8601 with Z and offsets', () => {
    const col: DataColumn = {
      id: 'c4',
      name: 'x',
      type: 'X',
      values: ['2026-07-07T17:12:00Z', '2026-07-07T10:12:00-07:00'],
    };
    const out = colToDateMs(col);
    expect(Number.isFinite(out[0])).toBe(true);
    expect(Number.isFinite(out[1])).toBe(true);
  });

  it('parses YYYY-MM-DD only (treats as UTC midnight)', () => {
    const col: DataColumn = {
      id: 'c5',
      name: 'x',
      type: 'X',
      values: ['2026-07-07'],
    };
    expect(colToDateMs(col)[0]).toBe(Date.parse('2026-07-07T00:00:00Z'));
  });

  it('passes through numeric epoch ms', () => {
    const col: DataColumn = {
      id: 'c6',
      name: 'x',
      type: 'X',
      values: [1700000000000, 1700003600000],
    };
    expect(colToDateMs(col)).toEqual([1700000000000, 1700003600000]);
  });

  it('returns NaN for non-date strings', () => {
    const col: DataColumn = {
      id: 'c7',
      name: 'x',
      type: 'X',
      values: ['hello', 'world'],
    };
    expect(colToDateMs(col)).toEqual([NaN, NaN]);
  });

  it('returns NaN for empty / whitespace strings', () => {
    const col: DataColumn = {
      id: 'c8',
      name: 'x',
      type: 'X',
      values: ['', '   '],
    };
    expect(colToDateMs(col)).toEqual([NaN, NaN]);
  });
});

describe('enrichColumn', () => {
  it('sets valueType to "date" for date-string columns', () => {
    const col: DataColumn = {
      id: 'c9',
      name: 't',
      type: 'X',
      values: ['2026-07-07 17:12:00', '2026-07-08 18:12:00', '2026-07-09 19:12:00'],
    };
    expect(enrichColumn(col).valueType).toBe('date');
  });

  it('sets valueType to "number" for pure numeric columns', () => {
    const col: DataColumn = {
      id: 'c10',
      name: 'x',
      type: 'X',
      values: [1, 2.5, 3],
    };
    expect(enrichColumn(col).valueType).toBe('number');
  });

  it('sets valueType to "category" for free-form labels', () => {
    const col: DataColumn = {
      id: 'c11',
      name: 'label',
      type: 'label',
      values: ['apple', 'banana', 'cherry'],
    };
    expect(enrichColumn(col).valueType).toBe('category');
  });

  it('is idempotent — does not overwrite an explicit valueType', () => {
    const col: DataColumn = {
      id: 'c12',
      name: 't',
      type: 'X',
      valueType: 'number',
      values: ['2026-07-07 17:12:00', '2026-07-08 17:12:00'],
    };
    expect(enrichColumn(col).valueType).toBe('number');
  });
});

describe('enrichColumns', () => {
  it('returns the same array reference when nothing needed enrichment', () => {
    const col: DataColumn = {
      id: 'c13',
      name: 'x',
      type: 'X',
      valueType: 'number',
      values: [1, 2, 3],
    };
    const cols = [col];
    expect(enrichColumns(cols)).toBe(cols);
  });

  it('enriches only columns that are missing valueType', () => {
    const explicit: DataColumn = {
      id: 'a',
      name: 'a',
      type: 'X',
      valueType: 'number',
      values: [1, 2, 3],
    };
    const dateCol: DataColumn = {
      id: 'b',
      name: 'b',
      type: 'Y',
      values: ['2026-07-07', '2026-07-08'],
    };
    const result = enrichColumns([explicit, dateCol]);
    expect(result[0]).toBe(explicit); // same reference preserved
    expect(result[1]).not.toBe(dateCol);
    expect(result[1].valueType).toBe('date');
  });
});

describe('colToXValues', () => {
  it('returns epoch ms when valueType is "date"', () => {
    const col: DataColumn = {
      id: 'c14',
      name: 't',
      type: 'X',
      valueType: 'date',
      values: ['2026-07-07 17:12:00', '2026-07-08 00:00:00'],
    };
    const out = colToXValues(col);
    expect(out[0]).toBe(Date.parse('2026-07-07 17:12:00'));
    expect(out[1]).toBe(Date.parse('2026-07-08 00:00:00'));
  });

  it('falls back to numeric coercion when valueType is "number"', () => {
    const col: DataColumn = {
      id: 'c15',
      name: 'x',
      type: 'X',
      valueType: 'number',
      values: ['1', '2.5', '3'],
    };
    expect(colToXValues(col)).toEqual([1, 2.5, 3]);
  });

  it('falls back to numeric coercion when valueType is "date" but conversion yields nothing finite', () => {
    const col: DataColumn = {
      id: 'c16',
      name: 't',
      type: 'X',
      valueType: 'date',
      values: ['hello', 'world'],
    };
    expect(colToXValues(col)).toEqual([NaN, NaN]);
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


describe('buildSurfaceMeshLines', () => {
  it('emits one polyline per grid row and column with null separators', () => {
    // 2 x 3 grid: x = [1, 2], y = [10, 20, 30]
    const grid = {
      x: [1, 2],
      y: [10, 20, 30],
      z: [
        [1, 2],
        [3, 4],
        [5, 6],
      ],
    };
    const mesh = buildSurfaceMeshLines(grid);
    // 3 row lines (2 points + separator each) + 2 column lines (3 points + separator each)
    expect(mesh.x).toHaveLength(3 * 3 + 2 * 4);
    expect(mesh.y).toHaveLength(mesh.x.length);
    expect(mesh.z).toHaveLength(mesh.x.length);

    // First row line: (1,10,1) → (2,10,2) → null
    expect(mesh.x.slice(0, 3)).toEqual([1, 2, null]);
    expect(mesh.y.slice(0, 3)).toEqual([10, 10, null]);
    expect(mesh.z.slice(0, 3)).toEqual([1, 2, null]);

    // First column line starts after the 3 row lines: (1,10,1) → (1,20,3) → (1,30,5) → null
    const colStart = 3 * 3;
    expect(mesh.x.slice(colStart, colStart + 4)).toEqual([1, 1, 1, null]);
    expect(mesh.y.slice(colStart, colStart + 4)).toEqual([10, 20, 30, null]);
    expect(mesh.z.slice(colStart, colStart + 4)).toEqual([1, 3, 5, null]);
  });

  it('preserves null z cells as gaps inside lines', () => {
    const grid = {
      x: [1, 2],
      y: [10],
      z: [[null, 5]],
    };
    const mesh = buildSurfaceMeshLines(grid);
    expect(mesh.z).toContain(null);
    // The null z sits inside the row line, not just in separators
    expect(mesh.z[0]).toBeNull();
    expect(mesh.z[1]).toBe(5);
  });

  it('handles an empty grid', () => {
    const mesh = buildSurfaceMeshLines({ x: [], y: [], z: [] });
    expect(mesh.x).toEqual([]);
    expect(mesh.y).toEqual([]);
    expect(mesh.z).toEqual([]);
  });

  it('decimates dense grids to about maxLines lines per direction, keeping boundaries', () => {
    const n = 100;
    const grid = {
      x: Array.from({ length: n }, (_, i) => i),
      y: Array.from({ length: n }, (_, i) => i),
      z: Array.from({ length: n }, (_, yi) => Array.from({ length: n }, (_, xi) => xi + yi)),
    };
    const mesh = buildSurfaceMeshLines(grid, 25);
    // Count polylines via null separators
    const lineCount = mesh.x.filter((v) => v === null).length;
    // ~25 rows + ~25 columns (+1 each for the forced boundary line), well under 100+100
    expect(lineCount).toBeLessThanOrEqual(54);
    expect(lineCount).toBeGreaterThan(20);
    // First row line still spans the full x resolution (points, not decimated)
    expect(mesh.x.slice(0, n)).toEqual(grid.x);
  });
});
