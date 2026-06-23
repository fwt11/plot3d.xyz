// Descriptive statistics utility module.
// Pure functions operating on number arrays; non-numeric / NaN values are
// filtered out automatically so callers can pass raw column values.

import { toNumber } from '@/types';

/** Filter out NaN / non-finite values from an input array of (number | string). */
export function toValidNumbers(values: ReadonlyArray<number | string>): number[] {
  const out: number[] = [];
  for (const v of values) {
    const n = toNumber(v);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** Arithmetic mean. Returns NaN for empty input. */
export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Sum of squared deviations from the mean (population formula, divide by n). */
function sumSquaredDeviations(values: number[], mu: number): number {
  let s = 0;
  for (const v of values) {
    const d = v - mu;
    s += d * d;
  }
  return s;
}

/** Population variance (divide by n). Returns NaN for empty input. */
export function variance(values: number[]): number {
  if (values.length === 0) return NaN;
  const mu = mean(values);
  return sumSquaredDeviations(values, mu) / values.length;
}

/** Sample variance (divide by n-1, Bessel's correction). Returns NaN for n < 2. */
export function sampleVariance(values: number[]): number {
  if (values.length < 2) return NaN;
  const mu = mean(values);
  return sumSquaredDeviations(values, mu) / (values.length - 1);
}

/** Population standard deviation. Returns NaN for empty input. */
export function stdDev(values: number[]): number {
  return Math.sqrt(variance(values));
}

/** Sample standard deviation (Bessel's correction). Returns NaN for n < 2. */
export function sampleStdDev(values: number[]): number {
  return Math.sqrt(sampleVariance(values));
}

/** Standard error of the mean (SD / sqrt(n)). Returns NaN for n < 2. */
export function standardError(values: number[]): number {
  if (values.length < 2) return NaN;
  return sampleStdDev(values) / Math.sqrt(values.length);
}

/** Minimum value. Returns NaN for empty input. */
export function min(values: number[]): number {
  if (values.length === 0) return NaN;
  let m = values[0];
  for (let i = 1; i < values.length; i++) if (values[i] < m) m = values[i];
  return m;
}

/** Maximum value. Returns NaN for empty input. */
export function max(values: number[]): number {
  if (values.length === 0) return NaN;
  let m = values[0];
  for (let i = 1; i < values.length; i++) if (values[i] > m) m = values[i];
  return m;
}

/** Median (50th percentile). Uses linear interpolation between ordered values. */
export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Quantile via linear interpolation (default method matches numpy's default).
 *  q must be in [0, 1]. */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return NaN;
  if (values.length === 1) return values[0];
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/** First quartile (Q1, 25th percentile). */
export function q1(values: number[]): number {
  return quantile(values, 0.25);
}

/** Third quartile (Q3, 75th percentile). */
export function q3(values: number[]): number {
  return quantile(values, 0.75);
}

/** Interquartile range (Q3 - Q1). */
export function iqr(values: number[]): number {
  return q3(values) - q1(values);
}

/** Range (max - min). Returns NaN for empty input. */
export function range(values: number[]): number {
  if (values.length === 0) return NaN;
  return max(values) - min(values);
}

/** Sample skewness (adjusted Fisher-Pearson standardized moment coefficient).
 *  Returns NaN for n < 3. */
export function skewness(values: number[]): number {
  const n = values.length;
  if (n < 3) return NaN;
  const mu = mean(values);
  const sd = sampleStdDev(values);
  if (sd === 0 || !Number.isFinite(sd)) return NaN;
  let m3 = 0;
  for (const v of values) {
    const d = v - mu;
    m3 += d * d * d;
  }
  m3 /= n;
  const g1 = m3 / (sd * sd * sd);
  // Bias-corrected (adjusted) skewness
  return g1 * Math.sqrt(n * (n - 1)) / (n - 2);
}

/** Sample excess kurtosis (Fisher's definition: normal → 0).
 *  Returns NaN for n < 4. */
export function kurtosis(values: number[]): number {
  const n = values.length;
  if (n < 4) return NaN;
  const mu = mean(values);
  const sd = sampleStdDev(values);
  if (sd === 0 || !Number.isFinite(sd)) return NaN;
  let m4 = 0;
  for (const v of values) {
    const d = v - mu;
    const d2 = d * d;
    m4 += d2 * d2;
  }
  m4 /= n;
  const g2 = m4 / (sd * sd * sd * sd) - 3;
  // Bias-corrected excess kurtosis
  return ((n - 1) / ((n - 2) * (n - 3))) * ((n + 1) * g2 + 6);
}

/** 95% confidence interval half-width for the mean (t-based).
 *  Returns NaN for n < 2. Uses normal approximation for large n. */
export function meanCI95HalfWidth(values: number[]): number {
  const n = values.length;
  if (n < 2) return NaN;
  const se = standardError(values);
  const tcrit = tCritical(n - 1);
  return se * tcrit;
}

// --- t-distribution critical values (two-tailed, alpha=0.05) ---
const T_CRIT_025: Record<number, number> = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
  6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
  11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131,
  20: 2.086, 25: 2.060, 30: 2.042, 40: 2.021, 60: 2.000,
  120: 1.980,
};

/** Two-tailed t critical value for alpha=0.05 given degrees of freedom. */
function tCritical(df: number): number {
  if (df <= 0) return 1.96;
  if (T_CRIT_025[df] !== undefined) return T_CRIT_025[df];
  if (df >= 120) return 1.96;
  const keys = Object.keys(T_CRIT_025).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < keys.length - 1; i++) {
    if (df > keys[i] && df < keys[i + 1]) {
      const t1 = T_CRIT_025[keys[i]];
      const t2 = T_CRIT_025[keys[i + 1]];
      return t1 + ((t2 - t1) * (df - keys[i])) / (keys[i + 1] - keys[i]);
    }
  }
  return 1.96;
}

/** Complete descriptive statistics for a single column. */
export interface DescriptiveStats {
  count: number;
  mean: number;
  stdDev: number;        // sample SD
  variance: number;      // sample variance
  stdError: number;      // SE of mean
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  range: number;
  iqr: number;
  skewness: number;
  kurtosis: number;
  ci95Low: number;       // 95% CI lower bound for the mean
  ci95High: number;      // 95% CI upper bound for the mean
  sum: number;
}

/** Compute the full descriptive statistics for a values array. */
export function describe(values: number[]): DescriptiveStats {
  const n = values.length;
  const mu = mean(values);
  const sd = sampleStdDev(values);
  const se = standardError(values);
  const ciHalf = meanCI95HalfWidth(values);
  const med = median(values);
  const q1v = q1(values);
  const q3v = q3(values);
  const mn = min(values);
  const mx = max(values);
  let sum = 0;
  for (const v of values) sum += v;
  return {
    count: n,
    mean: mu,
    stdDev: sd,
    variance: sampleVariance(values),
    stdError: se,
    min: mn,
    q1: q1v,
    median: med,
    q3: q3v,
    max: mx,
    range: range(values),
    iqr: q3v - q1v,
    skewness: skewness(values),
    kurtosis: kurtosis(values),
    ci95Low: mu - ciHalf,
    ci95High: mu + ciHalf,
    sum,
  };
}

/** Format a number for display, returning '—' for NaN. */
export function fmt(v: number, digits = 4): string {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-4 && v !== 0)) return v.toExponential(digits);
  return v.toFixed(digits);
}

// --- Correlation analysis ---

/** Pearson product-moment correlation coefficient.
 *  Returns NaN if either array has < 2 points or zero variance. */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return NaN;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) continue;
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
    count++;
  }
  if (count < 2) return NaN;
  const numerator = count * sumXY - sumX * sumY;
  const denominator = Math.sqrt((count * sumX2 - sumX * sumX) * (count * sumY2 - sumY * sumY));
  if (denominator === 0) return NaN;
  return numerator / denominator;
}

/** Compute ranks of values, handling ties with average rank. */
function rankArray(values: number[]): number[] {
  const n = values.length;
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && indexed[j].v === indexed[i].v) j++;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks[indexed[k].i] = avgRank;
    }
    i = j;
  }
  return ranks;
}

/** Spearman's rank correlation coefficient.
 *  Uses Pearson correlation on the ranks of x and y. */
export function spearmanCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return NaN;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(y[i])) {
      xs.push(x[i]);
      ys.push(y[i]);
    }
  }
  if (xs.length < 2) return NaN;
  const xRanks = rankArray(xs);
  const yRanks = rankArray(ys);
  return pearsonCorrelation(xRanks, yRanks);
}

/** Kendall's tau-b rank correlation coefficient (handles ties).
 *  Returns NaN for n < 2. */
export function kendallCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return NaN;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(y[i])) {
      xs.push(x[i]);
      ys.push(y[i]);
    }
  }
  const m = xs.length;
  if (m < 2) return NaN;
  let concordant = 0;
  let discordant = 0;
  let tiedX = 0;
  let tiedY = 0;
  let tiedXY = 0;
  for (let i = 0; i < m - 1; i++) {
    for (let j = i + 1; j < m; j++) {
      const dx = xs[j] - xs[i];
      const dy = ys[j] - ys[i];
      if (dx === 0 && dy === 0) {
        tiedXY++;
      } else if (dx === 0) {
        tiedX++;
      } else if (dy === 0) {
        tiedY++;
      } else if ((dx > 0 && dy > 0) || (dx < 0 && dy < 0)) {
        concordant++;
      } else {
        discordant++;
      }
    }
  }
  const total = concordant + discordant + tiedX + tiedY + tiedXY;
  if (total === 0) return NaN;
  // Kendall tau-b
  const n0 = (m * (m - 1)) / 2;
  const n1 = tiedX;
  const n2 = tiedY;
  const denom = Math.sqrt((n0 - n1) * (n0 - n2));
  if (denom === 0) return NaN;
  return (concordant - discordant) / denom;
}

/** Correlation result with p-value (approximate, via Fisher z-transform for Pearson/Spearman). */
export interface CorrelationResult {
  coefficient: number;
  pValue: number;
  n: number;
}

/** Two-tailed p-value for a correlation coefficient using Fisher z-transform.
 *  Suitable for Pearson and Spearman. */
export function correlationPValue(r: number, n: number): number {
  if (n < 4 || !Number.isFinite(r) || Math.abs(r) >= 1) return NaN;
  // Fisher z-transform
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);
  // Standard normal CDF
  const zStat = z / se;
  // Two-tailed p-value
  const p = 2 * (1 - normalCdfLocal(Math.abs(zStat)));
  return Math.max(0, Math.min(1, p));
}

// Local normal CDF to avoid circular import with distributions.ts
function normalCdfLocal(x: number): number {
  return 0.5 * (1 + erfLocal(x / Math.SQRT2));
}

function erfLocal(x: number): number {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

/** Full correlation analysis between two arrays. */
export function correlation(x: number[], y: number[], method: 'pearson' | 'spearman' | 'kendall' = 'pearson'): CorrelationResult {
  let r: number;
  let n: number;
  if (method === 'spearman') {
    r = spearmanCorrelation(x, y);
    const xs: number[] = [];
    const ys: number[] = [];
    const len = Math.min(x.length, y.length);
    for (let i = 0; i < len; i++) {
      if (Number.isFinite(x[i]) && Number.isFinite(y[i])) {
        xs.push(x[i]);
        ys.push(y[i]);
      }
    }
    n = xs.length;
  } else if (method === 'kendall') {
    r = kendallCorrelation(x, y);
    const xs: number[] = [];
    const ys: number[] = [];
    const len = Math.min(x.length, y.length);
    for (let i = 0; i < len; i++) {
      if (Number.isFinite(x[i]) && Number.isFinite(y[i])) {
        xs.push(x[i]);
        ys.push(y[i]);
      }
    }
    n = xs.length;
  } else {
    r = pearsonCorrelation(x, y);
    n = Math.min(x.length, y.length);
  }
  let p = NaN;
  if (method === 'kendall') {
    // Approximate p-value for Kendall tau via normal approximation
    if (n >= 10 && Number.isFinite(r) && Math.abs(r) < 1) {
      const v = (4 * n + 10) / (9 * n * (n - 1));
      const se = Math.sqrt(v);
      const zStat = r / se;
      p = 2 * (1 - normalCdfLocal(Math.abs(zStat)));
    }
  } else {
    p = correlationPValue(r, n);
  }
  return { coefficient: r, pValue: p, n };
}

/** Compute a correlation matrix for multiple columns.
 *  Returns a square matrix of correlation coefficients. */
export function correlationMatrix(columns: number[][], method: 'pearson' | 'spearman' | 'kendall' = 'pearson'): number[][] {
  const k = columns.length;
  const matrix: number[][] = Array.from({ length: k }, () => new Array(k).fill(1));
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const r = method === 'pearson'
        ? pearsonCorrelation(columns[i], columns[j])
        : method === 'spearman'
          ? spearmanCorrelation(columns[i], columns[j])
          : kendallCorrelation(columns[i], columns[j]);
      matrix[i][j] = r;
      matrix[j][i] = r;
    }
  }
  return matrix;
}

// --- Regression diagnostics ---

/** Durbin-Watson statistic for autocorrelation of residuals.
 *  DW ≈ 2 indicates no autocorrelation; DW < 1 or DW > 3 suggests strong autocorrelation. */
export function durbinWatson(residuals: number[]): number {
  const n = residuals.length;
  if (n < 3) return NaN;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    denominator += residuals[i] * residuals[i];
    if (i > 0) {
      const diff = residuals[i] - residuals[i - 1];
      numerator += diff * diff;
    }
  }
  if (denominator === 0) return NaN;
  return numerator / denominator;
}

/** Breusch-Pagan test for heteroscedasticity.
 *  Tests whether the variance of residuals depends on the fitted values.
 *  Returns the LM statistic and p-value (chi-square, 1 df). */
export function breuschPaganTest(fittedValues: number[], residuals: number[]): { lm: number; pValue: number; significant: boolean } {
  const n = residuals.length;
  if (n < 3) return { lm: NaN, pValue: NaN, significant: false };
  // Step 1: regress squared residuals on fitted values (simple linear regression)
  const sqResid = residuals.map((r) => r * r);
  const meanSqResid = mean(sqResid);
  const meanFitted = mean(fittedValues);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (fittedValues[i] - meanFitted) * (sqResid[i] - meanSqResid);
    sxx += (fittedValues[i] - meanFitted) ** 2;
  }
  if (sxx === 0) return { lm: NaN, pValue: NaN, significant: false };
  const slope = sxy / sxx;
  const intercept = meanSqResid - slope * meanFitted;
  // Explained sum of squares
  let ess = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * fittedValues[i];
    ess += (pred - meanSqResid) ** 2;
  }
  // LM = n * R² ≈ ess / (2 * σ⁴) * (n / 2)
  // The LM statistic is n * R² where R² is from the auxiliary regression
  const totalSS = sqResid.reduce((s, v) => s + (v - meanSqResid) ** 2, 0);
  const r2 = totalSS === 0 ? 0 : ess / totalSS;
  const lm = n * r2;
  // p-value from chi-square with 1 df
  const pValue = chi2PLocal(lm, 1);
  return { lm, pValue, significant: pValue < 0.05 };
}

// Local chi2 p-value to avoid circular import
function chi2PLocal(x: number, k: number): number {
  if (x <= 0) return 1;
  if (k <= 0) return NaN;
  // Upper incomplete gamma Q(k/2, x/2)
  return gammainccLocal(k / 2, x / 2);
}

function gammainccLocal(a: number, x: number): number {
  if (x <= 0) return 1;
  // For small x, use series; for large x, use continued fraction
  if (x < a + 1) {
    return 1 - lowerIncompleteGammaSeriesLocal(a, x);
  }
  return upperIncompleteGammaCFLocal(a, x);
}

function lowerIncompleteGammaSeriesLocal(a: number, x: number): number {
  if (x <= 0) return 0;
  let sum = 1 / a;
  let del = sum;
  let n = 0;
  while (n < 1000) {
    n += 1;
    del *= x / (a + n);
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGammaLocal(a));
}

function upperIncompleteGammaCFLocal(a: number, x: number): number {
  const tiny = 1e-30;
  const fpmin = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  let i = 0;
  while (i < 1000) {
    i += 1;
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = b + an / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGammaLocal(a)) * h;
}

function logGammaLocal(x: number): number {
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGammaLocal(1 - x);
  }
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) {
    a += c[i] / (x + i);
  }
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Variance Inflation Factor (VIF) for detecting multicollinearity.
 *  VIF > 10 indicates strong multicollinearity.
 *  @param designMatrix Array of predictor arrays (each inner array is one predictor's values).
 *  @param columnIndex Index of the predictor to compute VIF for. */
export function varianceInflationFactor(designMatrix: number[][], columnIndex: number): number {
  const k = designMatrix.length;
  if (k < 2 || columnIndex < 0 || columnIndex >= k) return NaN;
  const target = designMatrix[columnIndex];
  const others = designMatrix.filter((_, i) => i !== columnIndex);
  // Regress target on others (linear regression with intercept)
  const n = target.length;
  if (n < others.length + 2) return NaN;
  // Build design matrix with intercept
  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row = [1];
    for (const col of others) row.push(col[i]);
    X.push(row);
  }
  const y = target;
  // OLS: beta = (X^T X)^-1 X^T y
  const p = X[0].length;
  // Normal equations: X^T X
  const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < p; b++) {
        XtX[a][b] += X[i][a] * X[i][b];
      }
    }
  }
  // Solve via Gaussian elimination
  const beta = gaussianElimination(XtX, Xty);
  if (!beta) return NaN;
  // Compute R²
  const yMean = mean(y);
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    let pred = 0;
    for (let j = 0; j < p; j++) pred += beta[j] * X[i][j];
    ssRes += (y[i] - pred) ** 2;
    ssTot += (y[i] - yMean) ** 2;
  }
  if (ssTot === 0) return NaN;
  const r2 = 1 - ssRes / ssTot;
  if (r2 >= 1) return Infinity;
  return 1 / (1 - r2);
}

/** Solve a linear system Ax = b via Gaussian elimination with partial pivoting. */
function gaussianElimination(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const aug = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
    }
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
    if (Math.abs(aug[i][i]) < 1e-12) return null;
    // Eliminate
    for (let k = i + 1; k < n; k++) {
      const factor = aug[k][i] / aug[i][i];
      for (let j = i; j <= n; j++) {
        aug[k][j] -= factor * aug[i][j];
      }
    }
  }
  // Back-substitute
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) sum += aug[i][j] * x[j];
    x[i] = (aug[i][n] - sum) / aug[i][i];
  }
  return x;
}

/** Jarque-Bera test for normality of residuals.
 *  Tests whether the skewness and kurtosis match a normal distribution. */
export function jarqueBeraTest(values: number[]): { jb: number; pValue: number; significant: boolean } {
  const n = values.length;
  if (n < 4) return { jb: NaN, pValue: NaN, significant: false };
  const s = skewness(values);
  const k = kurtosis(values);
  if (!Number.isFinite(s) || !Number.isFinite(k)) return { jb: NaN, pValue: NaN, significant: false };
  const jb = (n / 6) * (s * s + (k * k) / 4);
  // p-value from chi-square with 2 df
  const pValue = chi2PLocal(jb, 2);
  return { jb, pValue, significant: pValue < 0.05 };
}
