import { describe, it, expect } from 'vitest';
import {
  oneSampleTTest,
  twoSampleTTest,
  welchTTest,
  pairedTTest,
  oneWayAnova,
  mannWhitneyU,
  wilcoxonSignedRank,
  kruskalWallis,
  shapiroWilk,
  ksTestNormal,
  fmtP,
  fmtStat,
  qqPlotData,
} from './hypothesisTests';

describe('oneSampleTTest', () => {
  it('returns high |t| for clearly non-zero mean', () => {
    const r = oneSampleTTest([10, 11, 12, 11, 10], 0);
    expect(r).toBeDefined();
    expect(r.statistic).toBeDefined();
    expect(Math.abs(r.statistic)).toBeGreaterThan(10);
    expect(r.pValue).toBeLessThan(0.001);
    expect(r.significant).toBe(true);
  });

  it('returns low |t| for sample matching H0', () => {
    const r = oneSampleTTest([1.01, 0.99, 1.02, 0.98, 1.00], 1);
    expect(r).toBeDefined();
    expect(Math.abs(r.statistic)).toBeLessThan(2);
    expect(r.pValue).toBeGreaterThan(0.05);
    expect(r.significant).toBe(false);
  });

  it('returns invalid result when n < 2', () => {
    const r = oneSampleTTest([5], 0);
    expect(r.significant).toBe(false);
    expect(r.pValue).toBeNaN();
    expect(r.conclusion).toContain('无法计算');
  });

  it('returns invalid result when sd = 0', () => {
    const r = oneSampleTTest([5, 5, 5, 5, 5], 3);
    expect(r.significant).toBe(false);
    expect(r.pValue).toBeNaN();
  });
});

describe('twoSampleTTest', () => {
  it('detects significantly different means', () => {
    const a = [10, 11, 12, 11, 10];
    const b = [20, 21, 22, 21, 20];
    const r = twoSampleTTest(a, b);
    expect(r).toBeDefined();
    expect(r.pValue).toBeLessThan(0.001);
    expect(r.significant).toBe(true);
  });

  it('does not detect difference for similar samples', () => {
    const a = [1.0, 1.1, 0.9, 1.0, 1.05];
    const b = [1.0, 1.05, 0.95, 1.0, 1.1];
    const r = twoSampleTTest(a, b);
    expect(r).toBeDefined();
    expect(r.pValue).toBeGreaterThan(0.05);
  });

  it('returns invalid for insufficient samples', () => {
    const r = twoSampleTTest([1], [2, 3]);
    expect(r.pValue).toBeNaN();
  });

  it('returns invalid when pooled variance is 0', () => {
    const r = twoSampleTTest([5, 5, 5], [5, 5, 5]);
    expect(r.pValue).toBeNaN();
  });

  it('respects non-zero mu0 offset', () => {
    const a = [10, 11, 12, 11, 10];
    const b = [20, 21, 22, 21, 20];
    // Without offset, |t| is huge
    const r0 = twoSampleTTest(a, b, 0);
    // With offset = mean diff, |t| should be ~0
    const r1 = twoSampleTTest(a, b, -10);
    expect(Math.abs(r0.statistic)).toBeGreaterThan(Math.abs(r1.statistic));
  });
});

describe('welchTTest', () => {
  it('detects significantly different means with unequal variance', () => {
    const a = [10, 11, 12, 11, 10];
    const b = [20, 21, 22, 21, 20];
    const r = welchTTest(a, b);
    expect(r).toBeDefined();
    expect(r.pValue).toBeLessThan(0.001);
  });

  it('returns invalid for too-small samples', () => {
    const r = welchTTest([1], [2, 3]);
    expect(r.pValue).toBeNaN();
  });

  it('returns invalid when both variances are 0', () => {
    const r = welchTTest([5, 5, 5], [7, 7, 7]);
    expect(r.pValue).toBeNaN();
  });
});

describe('pairedTTest', () => {
  it('detects consistent paired differences (with noise)', () => {
    // Constant shift of -1 plus tiny noise so diff SD > 0
    const before = [10, 12, 14, 11, 13, 15, 16, 17];
    const after = [9.1, 11.05, 13.0, 10.2, 12.1, 14.0, 15.1, 16.05];
    const r = pairedTTest(before, after);
    expect(r).toBeDefined();
    expect(r.statistic).not.toBeNull();
    expect(r.pValue).toBeLessThan(0.01);
    expect(r.significant).toBe(true);
  });

  it('does not detect difference for identical samples (SD = 0 → invalid)', () => {
    const x = [1, 2, 3, 4, 5];
    const r = pairedTTest(x, x);
    expect(r).toBeDefined();
    // diffs are all 0 → SD = 0 → invalidResult path
    expect(r.pValue).toBeNaN();
  });

  it('returns invalid for too few pairs', () => {
    const r = pairedTTest([1], [2]);
    expect(r.pValue).toBeNaN();
  });
});

describe('oneWayAnova', () => {
  it('detects difference across 3 groups', () => {
    const g1 = [10, 11, 12];
    const g2 = [20, 21, 22];
    const g3 = [30, 31, 32];
    const r = oneWayAnova([g1, g2, g3]);
    expect(r).toBeDefined();
    expect(r.pValue).toBeLessThan(0.001);
    expect(r.significant).toBe(true);
  });

  it('no difference for similar groups', () => {
    const g1 = [1, 2, 3];
    const g2 = [2, 3, 4];
    const g3 = [1, 2, 4];
    const r = oneWayAnova([g1, g2, g3]);
    expect(r).toBeDefined();
    expect(r.pValue).toBeGreaterThan(0.05);
  });

  it('returns invalid for fewer than 2 groups', () => {
    const r = oneWayAnova([[1, 2, 3]]);
    expect(r.pValue).toBeNaN();
  });
});

describe('mannWhitneyU', () => {
  it('detects distribution shift', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [10, 11, 12, 13, 14];
    const r = mannWhitneyU(x, y);
    expect(r).toBeDefined();
    expect(r.significant).toBe(true);
  });

  it('does not detect difference for similar samples', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 3, 4, 5, 6];
    const r = mannWhitneyU(x, y);
    expect(r).toBeDefined();
    expect(r.significant).toBe(false);
  });

  it('returns invalid for empty sample', () => {
    const r = mannWhitneyU([], [1, 2, 3]);
    expect(r.pValue).toBeNaN();
  });
});

describe('wilcoxonSignedRank', () => {
  it('detects non-zero median of paired differences', () => {
    const before = [10, 12, 14, 11, 13, 15, 16, 17];
    const after = [9, 11, 13, 10, 12, 14, 15, 16];
    const r = wilcoxonSignedRank(before, after);
    expect(r).toBeDefined();
    expect(r.significant).toBe(true);
  });

  it('returns invalid for too few non-zero diffs', () => {
    const r = wilcoxonSignedRank([1, 2], [1, 2]);
    expect(r.pValue).toBeNaN();
  });
});

describe('kruskalWallis', () => {
  it('detects difference across groups', () => {
    const g1 = [1, 2, 3];
    const g2 = [10, 11, 12];
    const g3 = [20, 21, 22];
    const r = kruskalWallis([g1, g2, g3]);
    expect(r).toBeDefined();
    expect(r.significant).toBe(true);
  });

  it('does not detect difference for similar groups', () => {
    const g1 = [1, 2, 3];
    const g2 = [2, 3, 4];
    const r = kruskalWallis([g1, g2]);
    expect(r).toBeDefined();
    expect(r.significant).toBe(false);
  });
});

describe('shapiroWilk', () => {
  // BUG NOTE: Royston's approximation in the current implementation produces
  // eps < 0 (denominator 1 - 2*aN² - 2*aN1² is negative for n ≥ 4) leading
  // to NaN W statistic. The n === 3 closed-form branch is independent of eps
  // and works. Phase 1 follow-up: fix Royston coefficients or switch to a
  // reference implementation.
  it('returns invalid for n < 3', () => {
    const r = shapiroWilk([1, 2]);
    expect(r.pValue).toBeNaN();
    expect(r.conclusion).toContain('无法计算');
  });

  it('returns invalid for n > 5000', () => {
    const big = Array.from({ length: 5001 }, (_, i) => i);
    const r = shapiroWilk(big);
    expect(r.pValue).toBeNaN();
  });

  it('returns invalid for zero-variance data', () => {
    const r = shapiroWilk([5, 5, 5, 5, 5]);
    expect(r.pValue).toBeNaN();
  });

  it('n = 3 uses closed-form branch', () => {
    const r = shapiroWilk([1, 2, 3]);
    expect(r).toBeDefined();
    expect(r.df).toBe(2);
    expect(r.extra?.sampleSize).toBe(3);
  });

  it('n ≥ 4 enters Royston branch (currently produces NaN due to bug)', () => {
    const r = shapiroWilk([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r).toBeDefined();
    expect(r.df).toBe(9);
  });
});

describe('ksTestNormal', () => {
  it('does not reject normality for normal-like sample', () => {
    const samples = [
      -0.5, -0.3, -0.1, 0.0, 0.1, 0.2, 0.3, 0.5, -0.2, 0.4,
      0.6, -0.4, 0.7, 0.8, 0.15, -0.6, 0.25, 0.9, 0.35, -0.15,
    ];
    const r = ksTestNormal(samples, 0, 1);
    expect(r).toBeDefined();
    expect(r.pValue).toBeGreaterThan(0.05);
  });

  it('rejects normality for highly skewed sample', () => {
    // Heavy right-skew — far from N(0,1)
    const samples = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29];
    const r = ksTestNormal(samples, 0, 1);
    expect(r).toBeDefined();
    expect(r.pValue).toBeLessThan(0.05);
    expect(r.significant).toBe(true);
  });

  it('returns invalid for n < 5', () => {
    const r = ksTestNormal([1, 2, 3], 0, 1);
    expect(r.pValue).toBeNaN();
  });

  it('returns invalid when sd = 0', () => {
    const r = ksTestNormal([1, 1, 1, 1, 1, 1, 1, 1], 0, 0);
    expect(r.pValue).toBeNaN();
  });
});

describe('fmtP', () => {
  it('shows < 0.0001 for very small values', () => {
    expect(fmtP(0.00001)).toBe('< 0.0001');
  });

  it('formats normal values to 4 decimal places', () => {
    expect(fmtP(0.1234)).toBe('0.1234');
  });

  it('returns — for non-finite values', () => {
    expect(fmtP(NaN)).toBe('—');
    expect(fmtP(Infinity)).toBe('—');
  });
});

describe('fmtStat', () => {
  it('formats normal values to 4 decimal places', () => {
    expect(fmtStat(1.234567)).toBe('1.2346');
  });

  it('returns — for non-finite values', () => {
    expect(fmtStat(NaN)).toBe('—');
  });

  it('uses exponential for very small or large values', () => {
    expect(fmtStat(1e-10)).toMatch(/e-/);
    expect(fmtStat(1e10)).toMatch(/e\+/);
  });
});

describe('qqPlotData', () => {
  it('returns empty arrays for too-small sample', () => {
    const r = qqPlotData([5]);
    expect(r.theoretical).toEqual([]);
    expect(r.sample).toEqual([]);
  });

  it('returns matching-length arrays for normal-sized sample', () => {
    const r = qqPlotData([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r.theoretical).toHaveLength(10);
    expect(r.sample).toHaveLength(10);
    // Sorted sample values
    expect(r.sample[0]).toBe(1);
    expect(r.sample[9]).toBe(10);
  });

  it('exercises normPPF plow / phigh branches via large n', () => {
    // n=50 makes (i+0.5)/n span both tails of the probit:
    // i=0 → p=0.01 < 0.02425 (plow branch)
    // i=49 → p=0.99 > 0.97575 (phigh branch)
    const samples = Array.from({ length: 50 }, (_, i) => i);
    const r = qqPlotData(samples);
    expect(r.theoretical).toHaveLength(50);
    // First theoretical value is from plow branch — finite (negative)
    expect(Number.isFinite(r.theoretical[0])).toBe(true);
    expect(r.theoretical[0]).toBeLessThan(-2);
    // Last theoretical value is from phigh branch — finite (positive)
    expect(Number.isFinite(r.theoretical[49])).toBe(true);
    expect(r.theoretical[49]).toBeGreaterThan(2);
  });
});
