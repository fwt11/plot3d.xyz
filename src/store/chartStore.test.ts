import { describe, it, expect } from 'vitest';
import { createDefaultChartConfig } from './chartStore';

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