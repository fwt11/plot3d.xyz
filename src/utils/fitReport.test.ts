import { describe, it, expect } from 'vitest';
import { fStatistic, fPValue } from './fitReport';

describe('fStatistic', () => {
  it('returns 0 for rSquared=0', () => {
    expect(fStatistic(0, 10, 2)).toBe(0);
  });

  it('returns Infinity for rSquared=1', () => {
    expect(fStatistic(1, 10, 2)).toBe(Infinity);
  });

  it('F = (R²/(p-1)) / ((1-R²)/(n-p)) for simple linear', () => {
    // n=10, p=2: F = (R²/1) / (0.2/8) = 0.8 / 0.025 = 32
    const r2 = 0.8;
    expect(fStatistic(r2, 10, 2)).toBeCloseTo(32, 6);
  });

  it('higher R² → higher F', () => {
    const f1 = fStatistic(0.5, 10, 2);
    const f2 = fStatistic(0.9, 10, 2);
    expect(f2).toBeGreaterThan(f1);
  });
});

describe('fPValue', () => {
  it('large F gives small p-value', () => {
    const p = fPValue(10, 2, 10);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(0.05);
  });

  it('F=0 gives p=1', () => {
    expect(fPValue(0, 2, 10)).toBeCloseTo(1, 6);
  });

  it('p-value decreases as F increases', () => {
    const p1 = fPValue(5, 2, 10);
    const p2 = fPValue(20, 2, 10);
    expect(p2).toBeLessThan(p1);
  });
});
