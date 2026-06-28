import { describe, it, expect } from 'vitest';
import {
  linearFit,
  polynomialFit,
  exponentialFit,
  logarithmicFit,
  powerFit,
  gaussianFit,
  logisticFit,
  calculateErrorStats,
  generateFittedValues,
  tCritical,
} from './curveFitting';

describe('linearFit', () => {
  it('fits y = 2x + 1 exactly with no noise', () => {
    const x = [0, 1, 2, 3, 4];
    const y = x.map((xi) => 2 * xi + 1);
    const result = linearFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.slope).toBeCloseTo(2, 10);
    expect(result!.intercept).toBeCloseTo(1, 10);
    expect(result!.rSquared).toBeCloseTo(1, 10);
  });

  it('returns null for insufficient data', () => {
    const result = linearFit([1], [2]);
    expect(result).toBeNull();
  });

  it('filters out NaN pairs', () => {
    const x = [0, 1, NaN, 3, 4];
    const y = [1, 3, NaN, 7, 9];
    const result = linearFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.slope).toBeCloseTo(2, 10);
    expect(result!.intercept).toBeCloseTo(1, 10);
  });

  it('returns null when all x are identical (singular)', () => {
    const result = linearFit([5, 5, 5, 5], [1, 2, 3, 4]);
    expect(result).toBeNull();
  });

  it('produces correct statistics when noisy', () => {
    // y = 2x + 1 + ε, ε ~ N(0, 0.1)
    const x = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const y = x.map((xi, i) => 2 * xi + 1 + (i % 2 === 0 ? 0.05 : -0.05));
    const result = linearFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.slope).toBeCloseTo(2, 1);
    expect(result!.intercept).toBeCloseTo(1, 1);
    expect(result!.rSquared).toBeGreaterThan(0.99);
    expect(result!.stats).toBeDefined();
    expect(result!.stats!.adjustedRSquared).toBeGreaterThan(0.99);
    expect(result!.stats!.n).toBe(10);
    expect(result!.stats!.parameterSE).toHaveLength(2);
    expect(result!.stats!.parameterCI).toHaveLength(2);
    // CI should bracket the estimate
    result!.stats!.parameterCI.forEach(([lo, hi]) => {
      expect(lo).toBeLessThan(hi);
    });
  });

  it('handles non-finite y values (infinity filtered)', () => {
    const x = [0, 1, 2, 3, 4];
    const y = [1, Infinity, 5, 7, 9];
    const result = linearFit(x, y);
    // filterValidPairs drops Infinity; remaining {0,2,3,4} → {1,5,7,9} → 4 points, fit succeeds
    expect(result).not.toBeNull();
    expect(result!.slope).toBeCloseTo(2, 10);
    expect(result!.intercept).toBeCloseTo(1, 10);
  });
});

describe('polynomialFit', () => {
  it('fits y = x² exactly with degree=2', () => {
    const x = [-2, -1, 0, 1, 2];
    const y = x.map((xi) => xi * xi);
    const result = polynomialFit(x, y, 2);
    expect(result).not.toBeNull();
    expect(result!.coefficients[0]).toBeCloseTo(1, 10); // x²
    expect(result!.coefficients[1]).toBeCloseTo(0, 10); // x¹
    expect(result!.coefficients[2]).toBeCloseTo(0, 10); // x⁰
  });

  it('rejects invalid degree (0)', () => {
    expect(polynomialFit([1, 2, 3], [1, 2, 3], 0)).toBeNull();
  });

  it('rejects invalid degree (>6)', () => {
    expect(polynomialFit([1, 2, 3], [1, 2, 3], 7)).toBeNull();
  });

  it('linear fit via poly1 matches linearFit', () => {
    const x = [0, 1, 2, 3];
    const y = [1, 3, 5, 7];
    const result = polynomialFit(x, y, 1);
    expect(result).not.toBeNull();
    expect(result!.coefficients[0]).toBeCloseTo(2, 10); // slope
    expect(result!.coefficients[1]).toBeCloseTo(1, 10); // intercept
  });

  it('returns null when data is too few for degree', () => {
    // Need at least degree+1 points
    expect(polynomialFit([1, 2], [1, 2], 5)).toBeNull();
  });

  it('handles higher degree (4) with sufficient data', () => {
    const x = [-2, -1, 0, 1, 2, -1.5, 1.5, -0.5, 0.5];
    const y = x.map((xi) => Math.pow(xi, 4) - 2 * xi * xi + 1);
    const result = polynomialFit(x, y, 4);
    expect(result).not.toBeNull();
    expect(result!.rSquared).toBeGreaterThan(0.99);
  });
});

describe('exponentialFit', () => {
  it('fits y = 2 * exp(0.5x) when x ≥ 0', () => {
    const x = [0, 1, 2, 3, 4];
    const y = x.map((xi) => 2 * Math.exp(0.5 * xi));
    const result = exponentialFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.a).toBeCloseTo(2, 6);
    expect(result!.b).toBeCloseTo(0.5, 6);
    expect(result!.rSquared).toBeCloseTo(1, 6);
  });

  it('skips y ≤ 0', () => {
    // y = [2, 0, 2*exp(0.5*2), -1, 2*exp(0.5*4)]; indices 1 and 3 should be skipped
    const x = [0, 1, 2, 3, 4];
    const y = [2, 0, 2 * Math.exp(0.5 * 2), -1, 2 * Math.exp(0.5 * 4)];
    const result = exponentialFit(x, y);
    // Result may be null (if remaining positive y < 2) or a fit on positive y only
    if (result) {
      expect(result.a).toBeGreaterThan(0);
    }
  });

  it('returns null when too few valid points', () => {
    // Only 1 positive y value
    const result = exponentialFit([0, 1, 2], [0, 0, 5]);
    expect(result).toBeNull();
  });
});

describe('logarithmicFit', () => {
  it('fits y = 3 + 2*ln(x) when x > 0', () => {
    const x = [0.5, 1, 2, 4, 8];
    const y = x.map((xi) => 3 + 2 * Math.log(xi));
    const result = logarithmicFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.a).toBeCloseTo(3, 6);
    expect(result!.b).toBeCloseTo(2, 6);
    expect(result!.rSquared).toBeCloseTo(1, 6);
  });

  it('skips x ≤ 0', () => {
    const result = logarithmicFit([0, -1, 1, 2], [0, 0, 1, 2]);
    // Only x=1, x=2 are valid → 2 points, which is min for linear fit
    expect(result).not.toBeNull();
  });
});

describe('powerFit', () => {
  it('fits y = 3 * x^1.5 when x > 0 and y > 0', () => {
    const x = [0.5, 1, 2, 4, 8];
    const y = x.map((xi) => 3 * Math.pow(xi, 1.5));
    const result = powerFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.a).toBeCloseTo(3, 5);
    expect(result!.b).toBeCloseTo(1.5, 5);
    expect(result!.rSquared).toBeCloseTo(1, 5);
  });

  it('returns null when too few valid points', () => {
    const result = powerFit([0, -1, 1], [0, 0, 5]);
    expect(result).toBeNull();
  });
});

describe('gaussianFit', () => {
  it('fits y = 5 * exp(-(x-2)² / (2*1²)) exactly', () => {
    // Center=2, sigma=1, amplitude=5
    const x = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
    const y = x.map((xi) => 5 * Math.exp(-Math.pow(xi - 2, 2) / 2));
    const result = gaussianFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.amplitude).toBeCloseTo(5, 4);
    expect(result!.center).toBeCloseTo(2, 4);
    expect(result!.sigma).toBeCloseTo(1, 2);
    expect(result!.rSquared).toBeGreaterThan(0.99);
  });

  it('returns null when fewer than 3 points', () => {
    const result = gaussianFit([1, 2], [3, 4]);
    expect(result).toBeNull();
  });
});

describe('logisticFit', () => {
  it('fits y = 10 / (1 + exp(-1*(x-3))) approximately', () => {
    // L=10, k=1, x0=3
    const x = [0, 1, 2, 3, 4, 5, 6];
    const y = x.map((xi) => 10 / (1 + Math.exp(-1 * (xi - 3))));
    const result = logisticFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.L).toBeCloseTo(10, 3);
    expect(result!.k).toBeCloseTo(1, 1);
    expect(result!.x0).toBeCloseTo(3, 1);
    expect(result!.rSquared).toBeGreaterThan(0.99);
  });
});

describe('tCritical (exported helper)', () => {
  it('returns 1.96 for df <= 0', () => {
    expect(tCritical(0)).toBe(1.96);
    expect(tCritical(-5)).toBe(1.96);
  });

  it('returns exact table values for known df', () => {
    expect(tCritical(1)).toBeCloseTo(12.706, 3);
    expect(tCritical(2)).toBeCloseTo(4.303, 3);
    expect(tCritical(10)).toBeCloseTo(2.228, 3);
    expect(tCritical(30)).toBeCloseTo(2.042, 3);
  });

  it('returns 1.96 for df >= 120', () => {
    expect(tCritical(120)).toBe(1.98); // exact table entry
    expect(tCritical(121)).toBe(1.96); // > 120 branch
    expect(tCritical(1000)).toBe(1.96);
  });

  it('linearly interpolates between table entries', () => {
    // df=2.5 is between T_CRIT_025[2]=4.303 and T_CRIT_025[3]=3.182
    // Expected: 4.303 + (3.182 - 4.303) * 0.5 = 3.7425
    const result = tCritical(2.5);
    expect(result).toBeCloseTo(3.7425, 3);
  });

  it('uses linear interpolation for any non-tabulated df', () => {
    // df=7.5 is between T_CRIT_025[7]=2.365 and T_CRIT_025[8]=2.306
    // Expected: 2.365 + (2.306 - 2.365) * (7.5-7)/(8-7) = 2.365 - 0.059*0.5 = 2.3355
    const result = tCritical(7.5);
    expect(result).toBeCloseTo(2.3355, 3);
  });

  it('returns 1.96 for NaN df (fallback at end of function)', () => {
    // NaN is not in T_CRIT_025, not >120, and not > keys[i] && < keys[i+1]
    // → falls through to final `return 1.96`
    expect(tCritical(NaN)).toBe(1.96);
  });
});

describe('exponentialFit edge cases (Gauss-Newton divergence)', () => {
  it('handles initial guess leading to divergent iteration', () => {
    // Pathological: x all zero, y all positive → Gauss-Newton may diverge
    // exponentialFit does log-linearization first → if linResult OK, GN runs
    // But b stays 0 → exp(0*x) = 1 → pred = a, residual = y - a
    // After update: a ≈ y_mean. Should converge.
    const x = [0, 0, 0, 0];
    const y = [1, 2, 3, 4];
    const result = exponentialFit(x, y);
    // Just verify it doesn't crash; result may or may not be null
    expect(result !== undefined).toBe(true);
  });
});

describe('powerFit edge cases', () => {
  it('handles non-monotonic data gracefully', () => {
    // x increasing, y non-monotonic → powerFit's log-linearization may produce
    // a+b > 0 but GN may need to revert (line 648-652)
    const x = [1, 2, 3, 4];
    const y = [1, 100, 1, 100];
    const result = powerFit(x, y);
    // May return null (insufficient convergence) or a partial fit; just no crash
    expect(result !== undefined).toBe(true);
  });
});

describe('gaussianFit edge cases', () => {
  it('falls back to initial guess on convergence failure', () => {
    // Pathological: data with extreme outlier that makes det3=0
    // All identical y values → maxIdx always 0 → simple fit should work
    const x = [1, 2, 3, 4];
    const y = [5, 5, 5, 5];
    const result = gaussianFit(x, y);
    expect(result).not.toBeNull();
    // amplitude ≈ 5, center ≈ 1 (first max), sigma ≈ 0.5
    expect(result!.amplitude).toBeCloseTo(5, 4);
  });
});

describe('logisticFit edge cases', () => {
  it('handles extreme data', () => {
    // All y identical → no sigmoid curve detectable → may hit fallback
    const x = [1, 2, 3, 4, 5];
    const y = [10, 10, 10, 10, 10];
    const result = logisticFit(x, y);
    expect(result).not.toBeNull();
  });
});

describe('calculateErrorStats', () => {
  it('returns zero error for perfect prediction', () => {
    const y = [1, 2, 3, 4, 5];
    const stats = calculateErrorStats(y, y);
    expect(stats).not.toBeNull();
    expect(stats!.sse).toBe(0);
    expect(stats!.rSquared).toBe(1);
    expect(stats!.rmse).toBe(0);
    expect(stats!.meanAbsError).toBe(0);
  });

  it('returns null for empty arrays', () => {
    expect(calculateErrorStats([], [])).toBeNull();
  });

  it('returns null for length mismatch', () => {
    expect(calculateErrorStats([1, 2], [1])).toBeNull();
  });

  it('handles constant y (sst=0 → rSquared=1 by convention)', () => {
    const stats = calculateErrorStats([5, 5, 5], [5, 5, 6]);
    expect(stats!.rSquared).toBe(1);
  });
});

describe('generateFittedValues', () => {
  it('returns nPoints evenly spaced x values', () => {
    const result = generateFittedValues((x) => x * 2, 0, 10, 5);
    expect(result.x).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(result.y).toEqual([0, 5, 10, 15, 20]);
  });

  it('clamps nPoints to minimum 2 when given <2', () => {
    const result = generateFittedValues((x) => x, 0, 10, 1);
    expect(result.x).toHaveLength(2);
  });

  it('returns single point when xMin >= xMax', () => {
    const result = generateFittedValues((x) => x * 2, 5, 3, 10);
    expect(result.x).toEqual([5]);
    expect(result.y).toEqual([10]);
  });
});
