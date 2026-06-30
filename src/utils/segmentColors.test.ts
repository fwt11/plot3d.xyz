import { describe, it, expect } from 'vitest';
import { generateSegmentColors } from './segmentColors';

describe('generateSegmentColors', () => {
  it('returns N colors for N segments', () => {
    expect(generateSegmentColors(5, 1)).toHaveLength(5);
    expect(generateSegmentColors(10, 1)).toHaveLength(10);
  });

  it('returns empty array for 0 segments', () => {
    expect(generateSegmentColors(0, 1)).toEqual([]);
  });

  it('returns hex strings when alpha=1', () => {
    const colors = generateSegmentColors(3, 1);
    for (const c of colors) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('returns rgba strings when alpha<1', () => {
    const colors = generateSegmentColors(3, 0.5);
    for (const c of colors) {
      expect(c).toMatch(/^rgba\(/);
    }
  });

  it('returns distinct colors (no duplicates in first 5)', () => {
    const colors = generateSegmentColors(5, 1);
    const unique = new Set(colors);
    expect(unique.size).toBe(5);
  });
});
