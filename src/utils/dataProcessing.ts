// Data preprocessing utilities: smoothing, interpolation, filtering,
// missing-value handling, and outlier detection.
//
// All functions are pure and operate on number arrays; non-numeric / NaN
// values are handled explicitly so callers can pass raw column values.

import { toNumber } from '@/types';

// ─── Smoothing ──────────────────────────────────────────────────

/** Savitzky-Golay filter coefficients for a given window size and polynomial order.
 *  Uses the least-squares solution to fit a polynomial through the windowed points. */
function sgCoeffs(windowSize: number, polyOrder: number): number[] {
  const half = Math.floor(windowSize / 2);
  const m = polyOrder;
  const n = windowSize;
  // Build the design matrix A (n x (m+1))
  const A: number[][] = [];
  for (let i = 0; i < n; i++) {
    const x = i - half;
    const row: number[] = [];
    for (let j = 0; j <= m; j++) row.push(Math.pow(x, j));
    A.push(row);
  }
  // Compute (A^T A)^-1 A^T row `half` (convolution for smoothing at center).
  // We only need the `half`-th row of the pseudoinverse.
  const AtA: number[][] = Array.from({ length: m + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i < n; i++) {
    for (let r = 0; r <= m; r++) {
      for (let c = 0; c <= m; c++) {
        AtA[r][c] += A[i][r] * A[i][c];
      }
    }
  }
  const inv = invertMatrix(AtA);
  if (!inv) return [];
  // coeffs[k] = sum_j inv[0][j] * A[k][j]  (smoothing = derivative order 0)
  const coeffs: number[] = [];
  for (let k = 0; k < n; k++) {
    let s = 0;
    for (let j = 0; j <= m; j++) s += inv[0][j] * A[k][j];
    coeffs.push(s);
  }
  return coeffs;
}

/** Invert a small square matrix via Gauss-Jordan elimination. Returns null if singular. */
function invertMatrix(mat: number[][]): number[][] | null {
  const n = mat.length;
  const aug: number[][] = mat.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[pivot][col])) pivot = r;
    }
    if (Math.abs(aug[pivot][col]) < 1e-12) return null;
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]];
    const pv = aug[col][col];
    for (let c = 0; c < 2 * n; c++) aug[col][c] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      for (let c = 0; c < 2 * n; c++) aug[r][c] -= factor * aug[col][c];
    }
  }
  return aug.map((row) => row.slice(n));
}

/** Savitzky-Golay smoothing filter.
 *  @param values Input signal (non-finite values are treated as NaN and skipped).
 *  @param windowSize Odd window length >= polyOrder*2+1. Auto-corrected to nearest odd.
 *  @param polyOrder Polynomial order (>= 1). Default 2.
 */
export function savitzkyGolay(values: number[], windowSize: number, polyOrder = 2): number[] {
  const n = values.length;
  if (n === 0) return [];
  if (windowSize % 2 === 0) windowSize += 1;
  if (windowSize < polyOrder * 2 + 1) windowSize = polyOrder * 2 + 1;
  if (windowSize > n) windowSize = Math.max(3, n % 2 === 0 ? n - 1 : n);
  const half = Math.floor(windowSize / 2);
  const coeffs = sgCoeffs(windowSize, polyOrder);
  if (coeffs.length === 0) return [...values];

  const out = new Array<number>(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let weight = 0;
    for (let k = 0; k < windowSize; k++) {
      const idx = i + k - half;
      if (idx < 0 || idx >= n) continue;
      const v = values[idx];
      if (!Number.isFinite(v)) continue;
      sum += coeffs[k] * v;
      weight += Math.abs(coeffs[k]);
    }
    out[i] = weight !== 0 ? sum : NaN;
  }
  return out;
}

/** Simple moving average smoothing.
 *  @param windowSize Number of points in the averaging window (>= 1).
 */
export function movingAverage(values: number[], windowSize: number): number[] {
  const n = values.length;
  if (n === 0) return [];
  if (windowSize < 1) windowSize = 1;
  const half = Math.floor(windowSize / 2);
  const out = new Array<number>(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let k = -half; k <= half; k++) {
      const idx = i + k;
      if (idx < 0 || idx >= n) continue;
      const v = values[idx];
      if (!Number.isFinite(v)) continue;
      sum += v;
      count++;
    }
    out[i] = count > 0 ? sum / count : NaN;
  }
  return out;
}

/** First-order low-pass filter (exponential moving average).
 *  @param alpha Smoothing factor in (0, 1). Smaller = smoother. Default 0.2.
 */
export function lowPassFilter(values: number[], alpha = 0.2): number[] {
  const n = values.length;
  if (n === 0) return [];
  const a = Math.max(0.001, Math.min(0.999, alpha));
  const out = new Array<number>(n).fill(NaN);
  let prev: number | null = null;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) {
      out[i] = prev ?? NaN;
      continue;
    }
    if (prev === null) {
      prev = v;
    } else {
      prev = a * v + (1 - a) * prev;
    }
    out[i] = prev;
  }
  return out;
}

/** Whittaker smoother (2nd-order) using a sparse least-squares solve.
 *  @param lambda Smoothness penalty (>= 1). Larger = smoother. Default 10.
 *  @returns Smoothed signal with NaNs preserved as NaN.
 */
export function whittakerSmoothing(values: number[], lambda = 10): number[] {
  const n = values.length;
  if (n === 0) return [];
  // Build valid index mask
  const valid: number[] = [];
  for (let i = 0; i < n; i++) if (Number.isFinite(values[i])) valid.push(i);
  if (valid.length === 0) return new Array(n).fill(NaN);
  if (valid.length <= 2) return [...values];

  // Construct the system (D^T D * lambda + W) z = W y
  // where D is the 2nd-order difference operator and W is the weight matrix.
  // We solve using the Thomas algorithm for the tridiagonal system.
  const m = valid.length;
  const y = valid.map((i) => values[i]);

  // Build second-difference matrix D (m-2 x m)
  // D^T D is pentadiagonal; combined with lambda*I + W it stays pentadiagonal.
  // For simplicity we build the dense normal-equation matrix.
  const A: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
  // D^T D (2nd difference)
  for (let i = 0; i < m - 2; i++) {
    const coeffs = [1, -2, 1];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        A[i + r][i + c] += lambda * coeffs[r] * coeffs[c];
      }
    }
  }
  // Add identity (weights = 1 for all valid points)
  for (let i = 0; i < m; i++) A[i][i] += 1;

  // RHS = y
  const b = [...y];

  // Solve A z = b via Gaussian elimination with partial pivoting
  const z = solveDense(A, b);
  if (!z) return [...values];

  // Map back to original positions, preserving NaNs
  const out = new Array<number>(n).fill(NaN);
  for (let k = 0; k < m; k++) out[valid[k]] = z[k];
  return out;
}

/** Solve a dense linear system A x = b via Gaussian elimination with partial pivoting. */
function solveDense(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const aug = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[pivot][col])) pivot = r;
    }
    if (Math.abs(aug[pivot][col]) < 1e-12) return null;
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]];
    const pv = aug[col][col];
    for (let c = col; c <= n; c++) aug[col][c] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      for (let c = col; c <= n; c++) aug[r][c] -= factor * aug[col][c];
    }
  }
  return aug.map((row) => row[n]);
}

// ─── Interpolation ──────────────────────────────────────────────

/** Point in the (x, y) dataset. */
export interface XYPoint { x: number; y: number; }

/** Convert parallel x/y arrays into sorted valid XY points (NaNs dropped). */
export function toXYPoints(x: number[], y: number[]): XYPoint[] {
  const pts: XYPoint[] = [];
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(y[i])) pts.push({ x: x[i], y: y[i] });
  }
  pts.sort((a, b) => a.x - b.x);
  return pts;
}

/** Linear interpolation at a set of query x values.
 *  @param xs Original x (need not be sorted).
 *  @param ys Original y.
 *  @param queryX X values to evaluate the interpolant at.
 */
export function linearInterp(xs: number[], ys: number[], queryX: number[]): number[] {
  const pts = toXYPoints(xs, ys);
  if (pts.length === 0) return queryX.map(() => NaN);
  if (pts.length === 1) return queryX.map(() => pts[0].y);
  return queryX.map((qx) => {
    if (qx <= pts[0].x) return pts[0].y;
    if (qx >= pts[pts.length - 1].x) return pts[pts.length - 1].y;
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].x <= qx) lo = mid; else hi = mid;
    }
    const p0 = pts[lo], p1 = pts[hi];
    const t = (qx - p0.x) / (p1.x - p0.x);
    return p0.y + t * (p1.y - p0.y);
  });
}

/** Cubic spline interpolation (natural boundary conditions).
 *  @param xs Original x (need not be sorted).
 *  @param ys Original y.
 *  @param queryX X values to evaluate the interpolant at.
 */
export function cubicSplineInterp(xs: number[], ys: number[], queryX: number[]): number[] {
  const pts = toXYPoints(xs, ys);
  const n = pts.length;
  if (n === 0) return queryX.map(() => NaN);
  if (n === 1) return queryX.map(() => pts[0].y);
  if (n === 2) return linearInterp(xs, ys, queryX);

  // Compute second derivatives s[i] for natural spline (s[0] = s[n-1] = 0)
  const h = new Array<number>(n - 1);
  for (let i = 0; i < n - 1; i++) h[i] = pts[i + 1].x - pts[i].x;
  const alpha = new Array<number>(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    alpha[i] = 3 * ((pts[i + 1].y - pts[i].y) / h[i] - (pts[i].y - pts[i - 1].y) / h[i - 1]);
  }
  const l = new Array<number>(n).fill(0);
  const mu = new Array<number>(n).fill(0);
  const z = new Array<number>(n).fill(0);
  l[0] = 1;
  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (pts[i + 1].x - pts[i - 1].x) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }
  l[n - 1] = 1;
  const s = new Array<number>(n).fill(0);
  for (let j = n - 2; j >= 0; j--) {
    s[j] = z[j] - mu[j] * s[j + 1];
  }

  return queryX.map((qx) => {
    if (qx <= pts[0].x) return pts[0].y;
    if (qx >= pts[n - 1].x) return pts[n - 1].y;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].x <= qx) lo = mid; else hi = mid;
    }
    const i = lo;
    const hl = pts[i + 1].x - pts[i].x;
    if (hl === 0) return pts[i].y;
    const a = (pts[i + 1].x - qx) / hl;
    const b = (qx - pts[i].x) / hl;
    return a * pts[i].y + b * pts[i + 1].y + ((a * a * a - a) * s[i] + (b * b * b - b) * s[i + 1]) * (hl * hl) / 6;
  });
}

/** Akima interpolation (stable, non-oscillatory spline-like method).
 *  @param xs Original x (need not be sorted).
 *  @param ys Original y.
 *  @param queryX X values to evaluate the interpolant at.
 */
export function akimaInterp(xs: number[], ys: number[], queryX: number[]): number[] {
  const pts = toXYPoints(xs, ys);
  const n = pts.length;
  if (n === 0) return queryX.map(() => NaN);
  if (n === 1) return queryX.map(() => pts[0].y);
  if (n === 2) return linearInterp(xs, ys, queryX);

  // Compute slopes between consecutive points
  const m = new Array<number>(n - 1);
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    m[i] = dx !== 0 ? (pts[i + 1].y - pts[i].y) / dx : 0;
  }
  // Extend with two extra slopes on each end (Akima's extrapolation)
  const ext = [
    2 * m[0] - m[1],
    m[0],
    ...m,
    m[m.length - 1],
    2 * m[m.length - 1] - m[m.length - 2],
  ];
  // Compute derivatives at each point
  const t = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const m1 = ext[i];
    const m2 = ext[i + 1];
    const m3 = ext[i + 2];
    const m4 = ext[i + 3];
    const denom = Math.abs(m4 - m3) + Math.abs(m2 - m1);
    t[i] = denom !== 0 ? (Math.abs(m4 - m3) * m2 + Math.abs(m2 - m1) * m3) / denom : (m2 + m3) / 2;
  }

  return queryX.map((qx) => {
    if (qx <= pts[0].x) return pts[0].y;
    if (qx >= pts[n - 1].x) return pts[n - 1].y;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].x <= qx) lo = mid; else hi = mid;
    }
    const i = lo;
    const x0 = pts[i].x, x1 = pts[i + 1].x;
    const dx = x1 - x0;
    if (dx === 0) return pts[i].y;
    const y0 = pts[i].y, y1 = pts[i + 1].y;
    const t0 = t[i], t1 = t[i + 1];
    const u = (qx - x0) / dx;
    const u2 = u * u;
    const u3 = u2 * u;
    // Hermite cubic with derivatives t0, t1
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    return h00 * y0 + h10 * dx * t0 + h01 * y1 + h11 * dx * t1;
  });
}

/** PCHIP interpolation (Piecewise Cubic Hermite Interpolating Polynomial).
 *  Preserves monotonicity and shape (Fritsch-Carlson method).
 *  @param xs Original x (need not be sorted).
 *  @param ys Original y.
 *  @param queryX X values to evaluate the interpolant at.
 */
export function pchipInterp(xs: number[], ys: number[], queryX: number[]): number[] {
  const pts = toXYPoints(xs, ys);
  const n = pts.length;
  if (n === 0) return queryX.map(() => NaN);
  if (n === 1) return queryX.map(() => pts[0].y);
  if (n === 2) return linearInterp(xs, ys, queryX);

  // Compute slopes between consecutive points
  const h = new Array<number>(n - 1);
  const delta = new Array<number>(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = pts[i + 1].x - pts[i].x;
    delta[i] = h[i] !== 0 ? (pts[i + 1].y - pts[i].y) / h[i] : 0;
  }
  // Compute derivatives (Fritsch-Carlson)
  const d = new Array<number>(n);
  d[0] = delta[0];
  d[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (delta[i - 1] * delta[i] <= 0) {
      d[i] = 0;
    } else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      d[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]);
    }
  }

  return queryX.map((qx) => {
    if (qx <= pts[0].x) return pts[0].y;
    if (qx >= pts[n - 1].x) return pts[n - 1].y;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].x <= qx) lo = mid; else hi = mid;
    }
    const i = lo;
    const x0 = pts[i].x, x1 = pts[i + 1].x;
    const dx = x1 - x0;
    if (dx === 0) return pts[i].y;
    const y0 = pts[i].y, y1 = pts[i + 1].y;
    const d0 = d[i], d1 = d[i + 1];
    const u = (qx - x0) / dx;
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    return h00 * y0 + h10 * dx * d0 + h01 * y1 + h11 * dx * d1;
  });
}

// ─── Data Filtering ─────────────────────────────────────────────

export type FilterOperator = 'gt' | 'lt' | 'ge' | 'le' | 'eq' | 'ne' | 'range';

export interface FilterCondition {
  operator: FilterOperator;
  /** Threshold value for gt/lt/ge/le/eq/ne. */
  value?: number;
  /** Lower bound for 'range'. */
  minValue?: number;
  /** Upper bound for 'range'. */
  maxValue?: number;
}

/** Filter a numeric column by a condition. Returns the indices of rows that pass. */
export function filterIndices(values: (number | string)[], cond: FilterCondition): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = toNumber(values[i]);
    if (!Number.isFinite(v)) continue;
    let pass = false;
    switch (cond.operator) {
      case 'gt': pass = v > (cond.value ?? 0); break;
      case 'lt': pass = v < (cond.value ?? 0); break;
      case 'ge': pass = v >= (cond.value ?? 0); break;
      case 'le': pass = v <= (cond.value ?? 0); break;
      case 'eq': pass = Math.abs(v - (cond.value ?? 0)) < 1e-12; break;
      case 'ne': pass = Math.abs(v - (cond.value ?? 0)) >= 1e-12; break;
      case 'range': pass = v >= (cond.minValue ?? -Infinity) && v <= (cond.maxValue ?? Infinity); break;
    }
    if (pass) result.push(i);
  }
  return result;
}

// ─── Missing Value Handling ─────────────────────────────────────

export type MissingValueStrategy = 'delete' | 'interpolate' | 'mean' | 'median' | 'zero';

/** Indices of missing (NaN / empty) values in a column. */
export function findMissingIndices(values: (number | string)[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = toNumber(values[i]);
    if (!Number.isFinite(v)) result.push(i);
  }
  return result;
}

/** Fill missing values in a numeric column using the given strategy.
 *  Returns a new array; non-numeric inputs are coerced to numbers. */
export function fillMissingValues(values: (number | string)[], strategy: MissingValueStrategy): (number | string)[] {
  const nums = values.map(toNumber);
  if (strategy === 'delete') {
    return nums.filter((v) => Number.isFinite(v)).map(String);
  }
  if (strategy === 'zero') {
    return nums.map((v) => (Number.isFinite(v) ? v : 0)).map(String);
  }
  const valid = nums.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return values.map(() => '0');
  if (strategy === 'mean') {
    const m = valid.reduce((s, v) => s + v, 0) / valid.length;
    return nums.map((v) => (Number.isFinite(v) ? v : m)).map(String);
  }
  if (strategy === 'median') {
    const sorted = [...valid].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const med = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    return nums.map((v) => (Number.isFinite(v) ? v : med)).map(String);
  }
  // interpolate: linear interpolation between nearest valid neighbors
  const out = [...nums];
  const n = out.length;
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(out[i])) continue;
    let prevIdx = i - 1;
    while (prevIdx >= 0 && !Number.isFinite(out[prevIdx])) prevIdx--;
    let nextIdx = i + 1;
    while (nextIdx < n && !Number.isFinite(out[nextIdx])) nextIdx++;
    if (prevIdx >= 0 && nextIdx < n) {
      const t = (i - prevIdx) / (nextIdx - prevIdx);
      out[i] = out[prevIdx] + t * (out[nextIdx] - out[prevIdx]);
    } else if (prevIdx >= 0) {
      out[i] = out[prevIdx];
    } else if (nextIdx < n) {
      out[i] = out[nextIdx];
    } else {
      out[i] = 0;
    }
  }
  return out.map(String);
}

// ─── Outlier Detection (IQR method) ──────────────────────────────

export interface OutlierResult {
  /** Indices of detected outliers. */
  indices: number[];
  /** Lower fence (Q1 - 1.5*IQR). */
  lowerFence: number;
  /** Upper fence (Q3 + 1.5*IQR). */
  upperFence: number;
  /** Q1. */
  q1: number;
  /** Q3. */
  q3: number;
  /** IQR. */
  iqr: number;
}

/** Detect outliers in a column using the IQR (Tukey) method.
 *  @param k Multiplier for IQR (default 1.5; use 3 for "far out" outliers).
 */
export function detectOutliers(values: (number | string)[], k = 1.5): OutlierResult {
  const nums = values.map(toNumber).filter((v) => Number.isFinite(v));
  if (nums.length === 0) {
    return { indices: [], lowerFence: NaN, upperFence: NaN, q1: NaN, q3: NaN, iqr: NaN };
  }
  const sorted = [...nums].sort((a, b) => a - b);
  const q = (p: number) => {
    const pos = (sorted.length - 1) * p;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return sorted[lo];
    return sorted[lo] * (1 - (pos - lo)) + sorted[hi] * (pos - lo);
  };
  const q1v = q(0.25);
  const q3v = q(0.75);
  const iqrVal = q3v - q1v;
  const lower = q1v - k * iqrVal;
  const upper = q3v + k * iqrVal;
  const indices: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = toNumber(values[i]);
    if (Number.isFinite(v) && (v < lower || v > upper)) indices.push(i);
  }
  return { indices, lowerFence: lower, upperFence: upper, q1: q1v, q3: q3v, iqr: iqrVal };
}

/** Remove outlier rows (returns indices to keep). */
export function removeOutlierIndices(values: (number | string)[], k = 1.5): number[] {
  const { indices } = detectOutliers(values, k);
  const outlierSet = new Set(indices);
  const keep: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (!outlierSet.has(i)) keep.push(i);
  }
  return keep;
}

/** Replace outliers with NaN (so they can be filled later) or with the fence value. */
export function replaceOutliers(values: (number | string)[], k = 1.5, strategy: 'nan' | 'fence' = 'fence'): (number | string)[] {
  const { indices, lowerFence, upperFence } = detectOutliers(values, k);
  const out = [...values];
  for (const i of indices) {
    const v = toNumber(out[i]);
    if (strategy === 'nan') {
      out[i] = '';
    } else {
      out[i] = String(v < lowerFence ? lowerFence : upperFence);
    }
  }
  return out;
}
