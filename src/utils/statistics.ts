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
