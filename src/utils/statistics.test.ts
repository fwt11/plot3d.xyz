import { describe, it, expect } from 'vitest';
import {
  mean,
  variance,
  sampleVariance,
  stdDev,
  sampleStdDev,
  standardError,
  min,
  max,
  median,
  quantile,
  q1,
  q3,
  iqr,
  range,
  skewness,
  kurtosis,
  meanCI95HalfWidth,
  describeStats,
  fmt,
  pearsonCorrelation,
  spearmanCorrelation,
  kendallCorrelation,
  correlationPValue,
  correlation,
  correlationMatrix,
  durbinWatson,
  breuschPaganTest,
} from './statistics';

describe('mean', () => {
  it('computes arithmetic mean', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it('returns NaN for empty array', () => {
    expect(mean([])).toBeNaN();
  });
});

describe('variance / sampleVariance', () => {
  it('population variance divides by n', () => {
    const x = [1, 2, 3, 4, 5];
    // pop var = sum((x - mean)^2) / n = 10 / 5 = 2
    expect(variance(x)).toBeCloseTo(2, 10);
  });

  it('sample variance divides by n-1', () => {
    const x = [1, 2, 3, 4, 5];
    // sample var = 10 / 4 = 2.5
    expect(sampleVariance(x)).toBeCloseTo(2.5, 10);
  });

  it('returns NaN for empty array', () => {
    expect(variance([])).toBeNaN();
  });

  it('returns NaN for n < 2 in sample variance', () => {
    expect(sampleVariance([5])).toBeNaN();
  });
});

describe('stdDev / sampleStdDev / standardError', () => {
  it('stdDev equals sqrt of variance', () => {
    expect(stdDev([1, 2, 3, 4, 5])).toBeCloseTo(Math.sqrt(2), 10);
  });

  it('sampleStdDev equals sqrt of sampleVariance', () => {
    expect(sampleStdDev([1, 2, 3, 4, 5])).toBeCloseTo(Math.sqrt(2.5), 10);
  });

  it('sampleStdDev returns NaN for n < 2', () => {
    expect(sampleStdDev([5])).toBeNaN();
  });

  it('standardError is sampleStdDev / sqrt(n)', () => {
    const x = [1, 2, 3, 4, 5];
    expect(standardError(x)).toBeCloseTo(Math.sqrt(2.5 / 5), 10);
  });

  it('standardError returns NaN for n < 2', () => {
    expect(standardError([5])).toBeNaN();
  });
});

describe('min / max', () => {
  it('min returns smallest value', () => {
    expect(min([3, 1, 4, 1, 5, 9, 2, 6])).toBe(1);
  });

  it('max returns largest value', () => {
    expect(max([3, 1, 4, 1, 5, 9, 2, 6])).toBe(9);
  });

  it('min handles single element', () => {
    expect(min([5])).toBe(5);
  });

  it('max handles single element', () => {
    expect(max([5])).toBe(5);
  });
});

describe('median', () => {
  it('returns middle value for odd-length array', () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
  });

  it('returns average of two middle values for even-length array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('quantile / q1 / q3 / iqr', () => {
  it('quantile at 0.5 is median', () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });

  it('quantile at 0 returns min, at 1 returns max', () => {
    expect(quantile([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(quantile([1, 2, 3, 4, 5], 1)).toBe(5);
  });

  it('q1 returns first quartile', () => {
    // Sample q1 of [1..10] should be near 3.25
    const q = q1([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(q).toBeGreaterThan(2);
    expect(q).toBeLessThan(4);
  });

  it('q3 returns third quartile', () => {
    const q = q3([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(q).toBeGreaterThan(7);
    expect(q).toBeLessThan(9);
  });

  it('iqr is q3 - q1', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(iqr(x)).toBeCloseTo(q3(x) - q1(x), 10);
  });
});

describe('range', () => {
  it('returns max - min', () => {
    expect(range([1, 2, 3, 4, 5])).toBe(4);
  });
});

describe('skewness / kurtosis', () => {
  it('skewness of symmetric distribution is near 0', () => {
    // Symmetric around 5
    const x = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(Math.abs(skewness(x))).toBeLessThan(0.5);
  });

  it('skewness of right-skewed distribution is positive', () => {
    const x = [1, 1, 1, 2, 3, 4, 5, 6, 10];
    expect(skewness(x)).toBeGreaterThan(0);
  });

  it('kurtosis exists', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(typeof kurtosis(x)).toBe('number');
  });
});

describe('meanCI95HalfWidth', () => {
  it('returns positive finite value for non-degenerate sample', () => {
    const ci = meanCI95HalfWidth([1, 2, 3, 4, 5]);
    expect(ci).toBeGreaterThan(0);
    expect(Number.isFinite(ci)).toBe(true);
  });
});

describe('describeStats (descriptive stats)', () => {
  it('returns object with mean, stdDev, etc.', () => {
    const stats = describeStats([1, 2, 3, 4, 5]);
    expect(stats.count).toBe(5);
    expect(stats.mean).toBeCloseTo(3, 5);
    expect(stats.median).toBe(3);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(5);
    expect(stats.stdDev).toBeCloseTo(Math.sqrt(2.5), 5);
  });

  it('handles empty array', () => {
    const stats = describeStats([]);
    expect(stats.count).toBe(0);
  });

  it('handles single value', () => {
    const stats = describeStats([5]);
    expect(stats.count).toBe(1);
    expect(stats.mean).toBe(5);
  });
});

describe('fmt', () => {
  it('formats number with given digits', () => {
    expect(fmt(3.14159, 2)).toBe('3.14');
  });

  it('handles default digits', () => {
    expect(fmt(3.14159)).toMatch(/^3\./);
  });
});

describe('pearsonCorrelation', () => {
  it('returns 1 for perfect positive linear', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    expect(pearsonCorrelation(x, y)).toBeCloseTo(1, 10);
  });

  it('returns -1 for perfect negative linear', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [10, 8, 6, 4, 2];
    expect(pearsonCorrelation(x, y)).toBeCloseTo(-1, 10);
  });

  it('returns near 0 for uncorrelated data', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const y = [5, 3, 6, 2, 8, 1, 9, 4, 7, 2]; // pseudo-random
    expect(Math.abs(pearsonCorrelation(x, y))).toBeLessThan(0.5);
  });
});

describe('spearmanCorrelation', () => {
  it('returns 1 for monotonic increasing', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [10, 20, 30, 40, 50];
    expect(spearmanCorrelation(x, y)).toBeCloseTo(1, 10);
  });

  it('returns -1 for monotonic decreasing', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [50, 40, 30, 20, 10];
    expect(spearmanCorrelation(x, y)).toBeCloseTo(-1, 10);
  });
});

describe('kendallCorrelation', () => {
  it('returns 1 for perfect concordance', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [1, 2, 3, 4, 5];
    expect(kendallCorrelation(x, y)).toBeCloseTo(1, 10);
  });

  it('returns -1 for perfect discordance', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [5, 4, 3, 2, 1];
    expect(kendallCorrelation(x, y)).toBeCloseTo(-1, 10);
  });
});

describe('correlationPValue', () => {
  it('returns small p-value for strong correlation', () => {
    const p = correlationPValue(0.95, 30);
    expect(p).toBeLessThan(0.001);
  });

  it('returns large p-value for weak correlation', () => {
    const p = correlationPValue(0.1, 5);
    expect(p).toBeGreaterThan(0.05);
  });
});

describe('correlation (combined test + p-value)', () => {
  it('returns both coefficient and p-value', () => {
    const r = correlation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10], 'pearson');
    expect(r.coefficient).toBeCloseTo(1, 10);
    expect(r.pValue).toBeLessThan(0.001);
  });

  it('supports spearman method', () => {
    const r = correlation([1, 2, 3, 4, 5], [10, 20, 30, 40, 50], 'spearman');
    expect(r.coefficient).toBeCloseTo(1, 5);
  });

  it('supports kendall method', () => {
    const r = correlation([1, 2, 3, 4, 5], [1, 2, 3, 4, 5], 'kendall');
    expect(r.coefficient).toBeCloseTo(1, 5);
  });
});

describe('correlationMatrix', () => {
  it('returns square matrix with 1s on diagonal', () => {
    const cols = [
      [1, 2, 3, 4, 5],
      [2, 4, 6, 8, 10],
      [5, 3, 1, 4, 2],
    ];
    const m = correlationMatrix(cols);
    expect(m.length).toBe(3);
    expect(m[0][0]).toBeCloseTo(1, 10);
    expect(m[1][1]).toBeCloseTo(1, 10);
    expect(m[2][2]).toBeCloseTo(1, 10);
  });

  it('symmetric: m[i][j] === m[j][i]', () => {
    const cols = [
      [1, 2, 3, 4, 5],
      [2, 4, 6, 8, 10],
    ];
    const m = correlationMatrix(cols);
    expect(m[0][1]).toBeCloseTo(m[1][0], 10);
  });
});

describe('durbinWatson', () => {
  it('returns finite positive value for random-like residuals', () => {
    const residuals = [0.1, -0.2, 0.15, -0.05, 0.1, -0.1, 0.05];
    const dw = durbinWatson(residuals);
    expect(Number.isFinite(dw)).toBe(true);
    expect(dw).toBeGreaterThan(0);
  });

  it('returns low value for positively autocorrelated residuals', () => {
    const residuals = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
    expect(durbinWatson(residuals)).toBeLessThan(1);
  });

  it('returns finite value for alternating residuals', () => {
    const residuals = [0, 1, 0, 1, 0, 1, 0, 1];
    const dw = durbinWatson(residuals);
    expect(Number.isFinite(dw)).toBe(true);
    // Alternating residuals give small DW (~1.75) due to no drift in magnitude
    expect(dw).toBeGreaterThan(0);
  });

  it('returns ≈3 for perfectly negatively correlated (alternating)', () => {
    const residuals = [1, -1, 1, -1];
    expect(durbinWatson(residuals)).toBeCloseTo(3, 5);
  });

  it('returns NaN for single residual', () => {
    expect(durbinWatson([5])).toBeNaN();
  });

  it('returns NaN for two identical residuals (no variation)', () => {
    expect(durbinWatson([3, 3])).toBeNaN();
  });

  it('returns NaN for n < 3', () => {
    expect(durbinWatson([1, 2])).toBeNaN();
  });
});

describe('breuschPaganTest', () => {
  it('returns test statistic and p-value', () => {
    const fitted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const residuals = [0.1, -0.1, 0.2, -0.2, 0.1, -0.1, 0.2, -0.2, 0.1, -0.1];
    const r = breuschPaganTest(fitted, residuals);
    expect(typeof r.lm).toBe('number');
    expect(typeof r.pValue).toBe('number');
    expect(typeof r.significant).toBe('boolean');
  });
});