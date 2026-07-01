import { describe, it, expect } from 'vitest';
import { JOURNAL_TEMPLATES, applyTemplate } from './journalTemplates';
import type { ChartConfig } from '@/types';

const baseConfig: ChartConfig = {
  id: 'c1',
  type: 'line',
  title: 'Test',
  xAxis: { label: 'X', unit: 's', autoRange: true, gridVisible: true, logScale: false, scientificNotation: false },
  yAxis: { label: 'Y', autoRange: true, gridVisible: true, logScale: false, scientificNotation: false },
  legend: { visible: true, position: 'top' },
  colorMap: 'viridis',
  layers: [],
  annotations: [],
  marginTop: 50, marginRight: 50, marginBottom: 50, marginLeft: 50,
  exportConfig: { resolutionMultiplier: 1, background: 'theme', figureMultiplier: 1 },
  fontSize: 12,
};

describe('JOURNAL_TEMPLATES — Phase 5 Task 5.3', () => {
  it('covers Nature single + double', () => {
    expect(JOURNAL_TEMPLATES.find((t) => t.id === 'nature-single')).toBeDefined();
    expect(JOURNAL_TEMPLATES.find((t) => t.id === 'nature-double')).toBeDefined();
  });

  it('covers Science single + double', () => {
    expect(JOURNAL_TEMPLATES.find((t) => t.id === 'science-single')).toBeDefined();
    expect(JOURNAL_TEMPLATES.find((t) => t.id === 'science-double')).toBeDefined();
  });

  it('covers ACS single + double', () => {
    expect(JOURNAL_TEMPLATES.find((t) => t.id === 'acs-single')).toBeDefined();
    expect(JOURNAL_TEMPLATES.find((t) => t.id === 'acs-double')).toBeDefined();
  });

  it('covers Cell single + double (Phase 5 Task 5.3)', () => {
    const single = JOURNAL_TEMPLATES.find((t) => t.id === 'cell-single');
    const dbl = JOURNAL_TEMPLATES.find((t) => t.id === 'cell-double');
    expect(single).toBeDefined();
    expect(dbl).toBeDefined();
    expect(single!.widthInches).toBeLessThan(dbl!.widthInches);
  });

  it('covers Physical Review Letters single + double (Phase 5 Task 5.3)', () => {
    const single = JOURNAL_TEMPLATES.find((t) => t.id === 'prl-single');
    const dbl = JOURNAL_TEMPLATES.find((t) => t.id === 'prl-double');
    expect(single).toBeDefined();
    expect(dbl).toBeDefined();
    // PRL style uses higher DPI (600 vs 300 for biology journals)
    expect(single!.dpi).toBe(600);
    expect(dbl!.scientificNotation).toBe(true);
  });

  it('all templates have unique ids', () => {
    const ids = JOURNAL_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all templates have non-empty color palettes (>= 4 colors)', () => {
    for (const t of JOURNAL_TEMPLATES) {
      expect(t.colorPalette.length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('applyTemplate — Phase 5 Task 5.3', () => {
  it('applies Cell template successfully', () => {
    const template = JOURNAL_TEMPLATES.find((t) => t.id === 'cell-single')!;
    const result = applyTemplate(baseConfig, template);
    expect(result).toBeDefined();
    expect(result.exportConfig?.background).toBe('white');
    expect(result.xAxis?.label).toBe('X');
  });

  it('applies PRL template and sets scientific notation', () => {
    const template = JOURNAL_TEMPLATES.find((t) => t.id === 'prl-double')!;
    const result = applyTemplate(baseConfig, template);
    expect(result).toBeDefined();
    // PRL sets yAxis.scientificNotation
    expect(result.yAxis?.scientificNotation).toBe(true);
  });
});
