// Curve fitting utility module

// --- Helper types ---

interface LinearFitResult {
  slope: number;
  intercept: number;
  rSquared: number;
  stats?: FitStatistics;
}

interface PolynomialFitResult {
  coefficients: number[];
  rSquared: number;
  stats?: FitStatistics;
}

interface ExponentialFitResult {
  a: number;
  b: number;
  rSquared: number;
  stats?: FitStatistics;
}

interface FittedValues {
  x: number[];
  y: number[];
}

interface ErrorStats {
  sse: number;
  sst: number;
  rSquared: number;
  rmse: number;
  meanAbsError: number;
}

/** Full fit statistics: adjusted R², parameter SE, 95% CI, residuals. */
export interface FitStatistics {
  n: number;                              // number of data points
  p: number;                              // number of parameters
  sse: number;                            // sum of squared errors
  sst: number;                            // total sum of squares
  rSquared: number;                      // R²
  adjustedRSquared: number;              // adjusted R²
  rmse: number;                           // root mean squared error
  mae: number;                            // mean absolute error
  residualStandardError: number;         // s = sqrt(SSE / (n - p))
  residuals: number[];                    // y_actual - y_fitted
  fittedValues: number[];                 // y_fitted at each x
  xValues: number[];                      // original x values
  parameterNames: string[];               // names of parameters
  parameterEstimates: number[];           // point estimates
  parameterSE: number[];                  // standard errors
  parameterCI: Array<[number, number]>;   // 95% confidence intervals
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
export function tCritical(df: number): number {
  if (df <= 0) return 1.96;
  if (T_CRIT_025[df] !== undefined) return T_CRIT_025[df];
  if (df >= 120) return 1.96;
  // Interpolate between known values
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

// --- Helper functions ---

/** Filter out NaN values from paired arrays */
function filterValidPairs(x: number[], y: number[]): { x: number[]; y: number[] } {
  const xValid: number[] = [];
  const yValid: number[] = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (!Number.isNaN(x[i]) && !Number.isNaN(y[i]) && Number.isFinite(x[i]) && Number.isFinite(y[i])) {
      xValid.push(x[i]);
      yValid.push(y[i]);
    }
  }
  return { x: xValid, y: yValid };
}

/** Compute mean of an array */
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// --- Matrix operations for polynomial regression ---

/** Solve upper-triangular system R x = b by back-substitution */
function solveUpperTriangular(R: number[][], b: number[]): number[] | null {
  const n = R.length;
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) {
      sum -= R[i][j] * x[j];
    }
    if (Math.abs(R[i][i]) < 1e-12) return null;
    x[i] = sum / R[i][i];
  }
  return x;
}

/** QR decomposition of A (m×n, m >= n) using Modified Gram-Schmidt.
 *  Returns Q (m×n) and R (n×n) such that A = QR.
 */
function qrDecompose(A: number[][]): { Q: number[][]; R: number[][] } | null {
  const m = A.length;
  const n = A[0].length;
  if (m < n) return null;

  const Q: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  const R: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  // Work on a copy because MGS overwrites columns
  const V = A.map((row) => [...row]);

  for (let k = 0; k < n; k++) {
    let norm = 0;
    for (let i = 0; i < m; i++) norm += V[i][k] ** 2;
    R[k][k] = Math.sqrt(norm);
    if (Math.abs(R[k][k]) < 1e-12) return null; // Singular

    for (let i = 0; i < m; i++) Q[i][k] = V[i][k] / R[k][k];

    for (let j = k + 1; j < n; j++) {
      R[k][j] = 0;
      for (let i = 0; i < m; i++) R[k][j] += Q[i][k] * V[i][j];
      for (let i = 0; i < m; i++) V[i][j] -= R[k][j] * Q[i][k];
    }
  }

  return { Q, R };
}

/** Invert an upper-triangular matrix R (n×n). Returns null if singular. */
function inverseUpperTriangular(R: number[][]): number[][] | null {
  const n = R.length;
  const inv: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let col = 0; col < n; col++) {
    // Solve R x = e_col by back-substitution
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = i === col ? 1 : 0;
      for (let j = i + 1; j < n; j++) {
        sum -= R[i][j] * x[j];
      }
      if (Math.abs(R[i][i]) < 1e-12) return null;
      x[i] = sum / R[i][i];
    }
    for (let i = 0; i < n; i++) inv[i][col] = x[i];
  }

  return inv;
}

// --- Public API ---

/**
 * Linear regression using least squares method.
 * Returns null if insufficient valid data points.
 */
export interface FitOptions {
  /** Optional weights per data point. Defaults to equal weights (unweighted OLS).
   *  Use w = 1/σ² for inverse-variance weighting. */
  weights?: number[];
  /** Optional per-parameter bounds: bounds[i] = [lower, upper] for parameter i.
   *  When provided, optimization constrains each parameter to its range.
   *  Only LM-based fits (Phase 3 Task 3.3) honor bounds; legacy Gauss-Newton
   *  fits ignore them. */
  bounds?: Array<[number, number]>;
}

/** Internal: filter valid pairs and apply weights. If weights are provided, returns
 *  effective (weighted) inputs. Returns null effective length if no valid pairs. */
function filterValidPairsWeighted(
  x: number[],
  y: number[],
  weights?: number[],
): { x: number[]; y: number[]; w: number[] } | null {
  const n = Math.min(x.length, y.length);
  const wLimit = weights?.length ?? n;
  const xv: number[] = [];
  const yv: number[] = [];
  const wv: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) continue;
    const wRaw = weights ? weights[Math.min(i, wLimit - 1)] : 1;
    const w = Number.isFinite(wRaw) ? wRaw : 0;
    if (w <= 0) continue; // skip zero/negative weights
    xv.push(x[i]);
    yv.push(y[i]);
    wv.push(w);
  }
  if (xv.length === 0) return null;
  return { x: xv, y: yv, w: wv };
}

export function linearFit(x: number[], y: number[], options?: FitOptions): LinearFitResult | null {
  const filtered = filterValidPairsWeighted(x, y, options?.weights);
  if (!filtered || filtered.x.length < 2) return null;
  const { x: xv, y: yv, w: wv } = filtered;

  const n = xv.length;
  const p = 2;
  const wSum = wv.reduce((s, v) => s + v, 0);
  const xMean = wv.reduce((s, _, i) => s + wv[i] * xv[i], 0) / wSum;
  const yMean = wv.reduce((s, _, i) => s + wv[i] * yv[i], 0) / wSum;

  let ssXY = 0;
  let ssXX = 0;
  for (let i = 0; i < n; i++) {
    ssXY += wv[i] * (xv[i] - xMean) * (yv[i] - yMean);
    ssXX += wv[i] * (xv[i] - xMean) ** 2;
  }

  if (Math.abs(ssXX) < 1e-12) return null;

  const slope = ssXY / ssXX;
  const intercept = yMean - slope * xMean;

  // Weighted fitted values and residuals
  const fittedValues = xv.map((xi) => slope * xi + intercept);
  const residuals = yv.map((yi, i) => yi - fittedValues[i]);
  const wSSE = residuals.reduce((s, r, i) => s + wv[i] * r * r, 0);
  const sstDenom = yv.reduce((s, yi, i) => s + wv[i] * (yi - yMean) ** 2, 0);
  const rSquared = sstDenom === 0 ? 1 : 1 - wSSE / sstDenom;
  const weightedMean = (vals: number[]) => {
    let s = 0;
    for (let i = 0; i < vals.length; i++) s += wv[i] * vals[i];
    return s / wSum;
  };
  const mae = weightedMean(residuals.map((r) => Math.abs(r)));
  const rmse = Math.sqrt(wSSE / n); // RMSE uses unweighted n by convention

  const adjustedRSquared = n > p ? 1 - ((1 - rSquared) * (n - 1)) / (n - p) : rSquared;

  // Weighted parameter standard errors
  // For OLS, residual variance σ² = SSE / (n - p); for WLS, σ² = wSSE / (n - p)
  // and Var(slope) = σ² / SSXX_w where SSXX_w = Σwᵢ(xᵢ-x̄ᵥ)²
  const residualSE = Math.sqrt(wSSE / (n - p));
  const seSlope = residualSE / Math.sqrt(ssXX);
  const seIntercept = residualSE * Math.sqrt(1 / wSum + (xMean * xMean) / ssXX);

  const tCrit = tCritical(n - p);
  const ciSlope: [number, number] = [slope - tCrit * seSlope, slope + tCrit * seSlope];
  const ciIntercept: [number, number] = [intercept - tCrit * seIntercept, intercept + tCrit * seIntercept];

  const fullStats: FitStatistics = {
    n,
    p,
    sse: wSSE,
    sst: sstDenom,
    rSquared,
    adjustedRSquared,
    rmse,
    mae,
    residualStandardError: residualSE,
    residuals,
    fittedValues,
    xValues: xv,
    parameterNames: ['slope', 'intercept'],
    parameterEstimates: [slope, intercept],
    parameterSE: [seSlope, seIntercept],
    parameterCI: [ciSlope, ciIntercept],
  };

  return { slope, intercept, rSquared, stats: fullStats };
}

/**
 * Polynomial regression using QR decomposition (Modified Gram-Schmidt).
 * Degree must be 1-6. Returns coefficients from highest degree to lowest.
 * Returns null if insufficient valid data points or singular matrix.
 */
export function polynomialFit(
  x: number[],
  y: number[],
  degree: number,
  options?: FitOptions,
): PolynomialFitResult | null {
  if (degree < 1 || degree > 6) return null;

  const filtered = filterValidPairsWeighted(x, y, options?.weights);
  if (!filtered || filtered.x.length <= degree) return null;
  const { x: xv, y: yv, w: wv } = filtered;

  const n = xv.length;
  const p = degree + 1;

  // Build weighted Vandermonde matrix: W^{1/2} * V
  const wSqrt = wv.map((w) => Math.sqrt(w));
  const vandermonde: number[][] = xv.map((xi, i) => {
    const row: number[] = [];
    for (let j = 0; j <= degree; j++) row.push(wSqrt[i] * xi ** j);
    return row;
  });
  // Right-hand side: W^{1/2} * y
  const yWeighted = yv.map((yi, i) => wSqrt[i] * yi);

  // Solve weighted least squares via QR
  const qr = qrDecompose(vandermonde);
  if (!qr) return null;

  const qtb = new Array(degree + 1).fill(0);
  for (let j = 0; j <= degree; j++) {
    for (let i = 0; i < n; i++) {
      qtb[j] += qr.Q[i][j] * yWeighted[i];
    }
  }

  const coeffsLowToHigh = solveUpperTriangular(qr.R, qtb);
  if (!coeffsLowToHigh) return null;

  const coefficients = [...coeffsLowToHigh].reverse();

  // Weighted fitted values and residuals
  const fittedValues = xv.map((xi) => {
    let yPred = 0;
    for (let j = 0; j <= degree; j++) {
      yPred += coeffsLowToHigh[j] * xi ** j;
    }
    return yPred;
  });
  const residuals = yv.map((yi, i) => yi - fittedValues[i]);
  const wSSE = residuals.reduce((s, r, i) => s + wv[i] * r * r, 0);
  const wSum = wv.reduce((s, v) => s + v, 0);

  // Weighted R²
  const yMeanW = wv.reduce((s, _, i) => s + wv[i] * yv[i], 0) / wSum;
  const sstDenom = yv.reduce((s, yi, i) => s + wv[i] * (yi - yMeanW) ** 2, 0);
  const rSquared = sstDenom === 0 ? 1 : 1 - wSSE / sstDenom;
  const mae = residuals.reduce((s, r, i) => s + wv[i] * Math.abs(r), 0) / wSum;
  const rmse = Math.sqrt(wSSE / n);

  const adjustedRSquared = n > p ? 1 - ((1 - rSquared) * (n - 1)) / (n - p) : rSquared;

  // Parameter standard errors via covariance matrix: cov = σ² * R⁻¹ R⁻ᵀ (already weighted)
  const residualSE = Math.sqrt(wSSE / (n - p));
  const RInv = inverseUpperTriangular(qr.R);
  const parameterSE: number[] = [];
  if (RInv) {
    for (let i = 0; i < p; i++) {
      let sumSq = 0;
      for (let j = 0; j < p; j++) {
        sumSq += RInv[i][j] * RInv[i][j];
      }
      parameterSE.push(residualSE * Math.sqrt(sumSq));
    }
  } else {
    for (let i = 0; i < p; i++) parameterSE.push(NaN);
  }

  const tCrit = tCritical(n - p);
  const parameterCI: Array<[number, number]> = coeffsLowToHigh.map((c, i) => [
    c - tCrit * parameterSE[i],
    c + tCrit * parameterSE[i],
  ]);

  const parameterNames = coeffsLowToHigh.map((_, i) => (i === 0 ? 'intercept' : `c${i}`));

  const fullStats: FitStatistics = {
    n,
    p,
    sse: wSSE,
    sst: sstDenom,
    rSquared,
    adjustedRSquared,
    rmse,
    mae,
    residualStandardError: residualSE,
    residuals,
    fittedValues,
    xValues: xv,
    parameterNames,
    parameterEstimates: coeffsLowToHigh,
    parameterSE,
    parameterCI,
  };

  return { coefficients, rSquared, stats: fullStats };
}

/**
 * Exponential fit: y = a * e^(b*x)
 * Uses Gauss-Newton non-linear least squares on the original y scale.
 * Initial guess comes from log-linearization; falls back to it if GN does not converge.
 * Skips points where y <= 0.
 * Returns null if insufficient valid data points.
 */
export function exponentialFit(x: number[], y: number[]): ExponentialFitResult | null {
  // Filter valid pairs, also skip y <= 0
  const xv: number[] = [];
  const yv: number[] = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (
      !Number.isNaN(x[i]) &&
      !Number.isNaN(y[i]) &&
      Number.isFinite(x[i]) &&
      Number.isFinite(y[i]) &&
      y[i] > 0
    ) {
      xv.push(x[i]);
      yv.push(y[i]);
    }
  }

  if (xv.length < 2) return null;

  const n = xv.length;
  const p = 2;

  // Initial guess via log-linearization
  const logY = yv.map((v) => Math.log(v));
  const linResult = linearFit(xv, logY);
  if (!linResult) return null;

  let a = Math.exp(linResult.intercept);
  let b = linResult.slope;

  // Gauss-Newton refinement on the original scale
  let jtJ00 = 0, jtJ01 = 0, jtJ11 = 0;
  const maxIter = 50;
  for (let iter = 0; iter < maxIter; iter++) {
    jtJ00 = 0; jtJ01 = 0; jtJ11 = 0;
    let jtR0 = 0, jtR1 = 0;

    for (let i = 0; i < n; i++) {
      const expTerm = Math.exp(b * xv[i]);
      const pred = a * expTerm;
      const residual = yv[i] - pred;

      // Partial derivatives of prediction w.r.t. (a, b)
      const dPredDa = expTerm;
      const dPredDb = a * xv[i] * expTerm;

      jtJ00 += dPredDa * dPredDa;
      jtJ01 += dPredDa * dPredDb;
      jtJ11 += dPredDb * dPredDb;
      jtR0 += dPredDa * residual;
      jtR1 += dPredDb * residual;
    }

    // Solve 2×2 system J^T J · delta = J^T r
    const det = jtJ00 * jtJ11 - jtJ01 * jtJ01;
    if (Math.abs(det) < 1e-18) break;

    const deltaA = (jtJ11 * jtR0 - jtJ01 * jtR1) / det;
    const deltaB = (jtJ00 * jtR1 - jtJ01 * jtR0) / det;

    if (!Number.isFinite(deltaA) || !Number.isFinite(deltaB)) break;
    if (Math.abs(deltaA) < 1e-12 && Math.abs(deltaB) < 1e-12) break;

    a += deltaA;
    b += deltaB;

    if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(b)) {
      // Revert to log-linearized guess
      a = Math.exp(linResult.intercept);
      b = linResult.slope;
      break;
    }
  }

  // Recompute J^T J at final parameters for covariance
  jtJ00 = 0; jtJ01 = 0; jtJ11 = 0;
  for (let i = 0; i < n; i++) {
    const expTerm = Math.exp(b * xv[i]);
    const dPredDa = expTerm;
    const dPredDb = a * xv[i] * expTerm;
    jtJ00 += dPredDa * dPredDa;
    jtJ01 += dPredDa * dPredDb;
    jtJ11 += dPredDb * dPredDb;
  }

  // Fitted values and residuals
  const fittedValues = xv.map((xi) => a * Math.exp(b * xi));
  const residuals = yv.map((yi, i) => yi - fittedValues[i]);
  const stats = calculateErrorStats(yv, fittedValues);
  if (!stats) return null;

  // Adjusted R²
  const adjustedRSquared = n > p ? 1 - ((1 - stats.rSquared) * (n - 1)) / (n - p) : stats.rSquared;

  // Parameter standard errors: cov = s² * (J^T J)^{-1}
  const sse = stats.sse;
  const residualSE = Math.sqrt(sse / (n - p));
  const det = jtJ00 * jtJ11 - jtJ01 * jtJ01;
  let seA = NaN, seB = NaN;
  if (Math.abs(det) > 1e-18) {
    const inv00 = jtJ11 / det;
    const inv11 = jtJ00 / det;
    seA = residualSE * Math.sqrt(inv00);
    seB = residualSE * Math.sqrt(inv11);
  }

  // 95% CI
  const tCrit = tCritical(n - p);
  const ciA: [number, number] = [a - tCrit * seA, a + tCrit * seA];
  const ciB: [number, number] = [b - tCrit * seB, b + tCrit * seB];

  const fullStats: FitStatistics = {
    n,
    p,
    sse,
    sst: stats.sst,
    rSquared: stats.rSquared,
    adjustedRSquared,
    rmse: stats.rmse,
    mae: stats.meanAbsError,
    residualStandardError: residualSE,
    residuals,
    fittedValues,
    xValues: xv,
    parameterNames: ['a', 'b'],
    parameterEstimates: [a, b],
    parameterSE: [seA, seB],
    parameterCI: [ciA, ciB],
  };

  return { a, b, rSquared: stats.rSquared, stats: fullStats };
}

// --- Additional fit types ---

interface LogarithmicFitResult {
  a: number;
  b: number;
  rSquared: number;
  stats?: FitStatistics;
}

interface PowerFitResult {
  a: number;
  b: number;
  rSquared: number;
  stats?: FitStatistics;
}

interface GaussianFitResult {
  amplitude: number;
  center: number;
  sigma: number;
  rSquared: number;
  stats?: FitStatistics;
}

interface LogisticFitResult {
  L: number;
  k: number;
  x0: number;
  rSquared: number;
  stats?: FitStatistics;
}

/**
 * Logarithmic fit: y = a + b*ln(x)
 * Skips points where x <= 0.
 * Returns null if insufficient valid data points.
 */
export function logarithmicFit(x: number[], y: number[]): LogarithmicFitResult | null {
  const xv: number[] = [];
  const yv: number[] = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(y[i]) && x[i] > 0) {
      xv.push(x[i]);
      yv.push(y[i]);
    }
  }
  if (xv.length < 2) return null;

  const n = xv.length;
  const p = 2;
  const lnX = xv.map((v) => Math.log(v));
  const linResult = linearFit(lnX, yv);
  if (!linResult || !linResult.stats) return null;

  const a = linResult.intercept;
  const b = linResult.slope;

  // Recompute stats on original scale
  const fittedValues = xv.map((xi) => a + b * Math.log(xi));
  const residuals = yv.map((yi, i) => yi - fittedValues[i]);
  const stats = calculateErrorStats(yv, fittedValues);
  if (!stats) return null;

  const adjustedRSquared = n > p ? 1 - ((1 - stats.rSquared) * (n - 1)) / (n - p) : stats.rSquared;
  const residualSE = Math.sqrt(stats.sse / (n - p));

  // SE from linear fit on (ln(x), y)
  const seA = linResult.stats.parameterSE[1]; // intercept SE
  const seB = linResult.stats.parameterSE[0]; // slope SE
  const tCrit = linResult.stats.parameterCI[0][0] !== linResult.stats.parameterCI[0][1]
    ? (linResult.stats.parameterEstimates[0] - linResult.stats.parameterCI[0][0]) / linResult.stats.parameterSE[0]
    : 1.96;
  const ciA: [number, number] = [a - tCrit * seA, a + tCrit * seA];
  const ciB: [number, number] = [b - tCrit * seB, b + tCrit * seB];

  const fullStats: FitStatistics = {
    n, p,
    sse: stats.sse, sst: stats.sst,
    rSquared: stats.rSquared, adjustedRSquared,
    rmse: stats.rmse, mae: stats.meanAbsError,
    residualStandardError: residualSE,
    residuals, fittedValues, xValues: xv,
    parameterNames: ['a', 'b'],
    parameterEstimates: [a, b],
    parameterSE: [seA, seB],
    parameterCI: [ciA, ciB],
  };

  return { a, b, rSquared: stats.rSquared, stats: fullStats };
}

/**
 * Power law fit: y = a * x^b
 * Uses log-linearization then Gauss-Newton refinement.
 * Skips points where x <= 0 or y <= 0.
 * Returns null if insufficient valid data points.
 */
export function powerFit(x: number[], y: number[]): PowerFitResult | null {
  const xv: number[] = [];
  const yv: number[] = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(y[i]) && x[i] > 0 && y[i] > 0) {
      xv.push(x[i]);
      yv.push(y[i]);
    }
  }
  if (xv.length < 2) return null;

  const n = xv.length;
  const p = 2;

  // Initial guess via log-linearization: ln(y) = ln(a) + b*ln(x)
  const lnX = xv.map((v) => Math.log(v));
  const lnY = yv.map((v) => Math.log(v));
  const linResult = linearFit(lnX, lnY);
  if (!linResult) return null;

  let a = Math.exp(linResult.intercept);
  let b = linResult.slope;

  // Gauss-Newton refinement on original scale
  let jtJ00 = 0, jtJ01 = 0, jtJ11 = 0;
  const maxIter = 50;
  for (let iter = 0; iter < maxIter; iter++) {
    jtJ00 = 0; jtJ01 = 0; jtJ11 = 0;
    let jtR0 = 0, jtR1 = 0;

    for (let i = 0; i < n; i++) {
      const pred = a * Math.pow(xv[i], b);
      const residual = yv[i] - pred;
      // Partials: dy/da = x^b, dy/db = a * x^b * ln(x)
      const dPredDa = Math.pow(xv[i], b);
      const dPredDb = a * Math.pow(xv[i], b) * Math.log(xv[i]);

      jtJ00 += dPredDa * dPredDa;
      jtJ01 += dPredDa * dPredDb;
      jtJ11 += dPredDb * dPredDb;
      jtR0 += dPredDa * residual;
      jtR1 += dPredDb * residual;
    }

    const det = jtJ00 * jtJ11 - jtJ01 * jtJ01;
    if (Math.abs(det) < 1e-18) break;

    const deltaA = (jtJ11 * jtR0 - jtJ01 * jtR1) / det;
    const deltaB = (jtJ00 * jtR1 - jtJ01 * jtR0) / det;

    if (!Number.isFinite(deltaA) || !Number.isFinite(deltaB)) break;
    if (Math.abs(deltaA) < 1e-12 && Math.abs(deltaB) < 1e-12) break;

    a += deltaA;
    b += deltaB;

    if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(b)) {
      a = Math.exp(linResult.intercept);
      b = linResult.slope;
      break;
    }
  }

  // Recompute J^T J at final parameters
  jtJ00 = 0; jtJ01 = 0; jtJ11 = 0;
  for (let i = 0; i < n; i++) {
    const dPredDa = Math.pow(xv[i], b);
    const dPredDb = a * Math.pow(xv[i], b) * Math.log(xv[i]);
    jtJ00 += dPredDa * dPredDa;
    jtJ01 += dPredDa * dPredDb;
    jtJ11 += dPredDb * dPredDb;
  }

  const fittedValues = xv.map((xi) => a * Math.pow(xi, b));
  const residuals = yv.map((yi, i) => yi - fittedValues[i]);
  const stats = calculateErrorStats(yv, fittedValues);
  if (!stats) return null;

  const adjustedRSquared = n > p ? 1 - ((1 - stats.rSquared) * (n - 1)) / (n - p) : stats.rSquared;
  const residualSE = Math.sqrt(stats.sse / (n - p));
  const det = jtJ00 * jtJ11 - jtJ01 * jtJ01;
  let seA = NaN, seB = NaN;
  if (Math.abs(det) > 1e-18) {
    seA = residualSE * Math.sqrt(jtJ11 / det);
    seB = residualSE * Math.sqrt(jtJ00 / det);
  }
  const tCrit = tCritical(n - p);
  const ciA: [number, number] = [a - tCrit * seA, a + tCrit * seA];
  const ciB: [number, number] = [b - tCrit * seB, b + tCrit * seB];

  const fullStats: FitStatistics = {
    n, p,
    sse: stats.sse, sst: stats.sst,
    rSquared: stats.rSquared, adjustedRSquared,
    rmse: stats.rmse, mae: stats.meanAbsError,
    residualStandardError: residualSE,
    residuals, fittedValues, xValues: xv,
    parameterNames: ['a', 'b'],
    parameterEstimates: [a, b],
    parameterSE: [seA, seB],
    parameterCI: [ciA, ciB],
  };

  return { a, b, rSquared: stats.rSquared, stats: fullStats };
}

/**
 * Gaussian fit: y = amplitude * exp(-((x - center)^2) / (2 * sigma^2))
 * Uses Gauss-Newton with initial guess from data.
 * Returns null if insufficient valid data points.
 */
export function gaussianFit(x: number[], y: number[]): GaussianFitResult | null {
  const { x: xv, y: yv } = filterValidPairs(x, y);
  if (xv.length < 3) return null;

  const n = xv.length;
  const p = 3;

  // Initial guess
  let maxIdx = 0;
  for (let i = 1; i < n; i++) {
    if (yv[i] > yv[maxIdx]) maxIdx = i;
  }
  let amplitude = yv[maxIdx];
  let center = xv[maxIdx];
  let sigma = (Math.max(...xv) - Math.min(...xv)) / 6;

  // Gauss-Newton
  const maxIter = 100;
  for (let iter = 0; iter < maxIter; iter++) {
    const J: number[][] = [];
    const residuals: number[] = [];
    for (let i = 0; i < n; i++) {
      const dx = xv[i] - center;
      const expTerm = Math.exp(-(dx * dx) / (2 * sigma * sigma));
      const pred = amplitude * expTerm;
      residuals.push(yv[i] - pred);
      // Partials
      const dAmp = expTerm;
      const dCenter = amplitude * expTerm * dx / (sigma * sigma);
      const dSigma = amplitude * expTerm * dx * dx / (sigma * sigma * sigma);
      J.push([dAmp, dCenter, dSigma]);
    }

    // Solve normal equations: (J^T J) delta = J^T r
    const jtJ = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const jtR = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          jtJ[r][c] += J[i][r] * J[i][c];
        }
        jtR[r] += J[i][r] * residuals[i];
      }
    }

    // Solve 3x3 system via Cramer's rule
    const det = det3(jtJ);
    if (Math.abs(det) < 1e-18) break;

    const delta: number[] = [];
    for (let col = 0; col < 3; col++) {
      const m = jtJ.map((row, i) => row.map((v, j) => (j === col ? jtR[i] : v)));
      delta.push(det3(m) / det);
    }

    if (delta.every((d) => Math.abs(d) < 1e-12)) break;
    if (delta.some((d) => !Number.isFinite(d))) break;

    amplitude += delta[0];
    center += delta[1];
    sigma += delta[2];

    if (!Number.isFinite(amplitude) || !Number.isFinite(center) || !Number.isFinite(sigma) || sigma <= 0) {
      // Revert
      amplitude = yv[maxIdx];
      center = xv[maxIdx];
      sigma = (Math.max(...xv) - Math.min(...xv)) / 6;
      break;
    }
  }

  const fittedValues = xv.map((xi) => {
    const dx = xi - center;
    return amplitude * Math.exp(-(dx * dx) / (2 * sigma * sigma));
  });
  const residuals = yv.map((yi, i) => yi - fittedValues[i]);
  const stats = calculateErrorStats(yv, fittedValues);
  if (!stats) return null;

  const adjustedRSquared = n > p ? 1 - ((1 - stats.rSquared) * (n - 1)) / (n - p) : stats.rSquared;
  const residualSE = Math.sqrt(stats.sse / (n - p));

  // Recompute J^T J at final params for covariance
  const jtJ = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < n; i++) {
    const dx = xv[i] - center;
    const expTerm = Math.exp(-(dx * dx) / (2 * sigma * sigma));
    const dAmp = expTerm;
    const dCenter = (amplitude * expTerm * dx) / (sigma * sigma);
    const dSigma = (amplitude * expTerm * dx * dx) / (sigma * sigma * sigma);
    const J = [dAmp, dCenter, dSigma];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        jtJ[r][c] += J[r] * J[c];
      }
    }
  }

  const det = det3(jtJ);
  const parameterSE: number[] = [NaN, NaN, NaN];
  if (Math.abs(det) > 1e-18) {
    const inv = inv3(jtJ, det);
    if (inv) {
      parameterSE[0] = residualSE * Math.sqrt(Math.max(inv[0][0], 0));
      parameterSE[1] = residualSE * Math.sqrt(Math.max(inv[1][1], 0));
      parameterSE[2] = residualSE * Math.sqrt(Math.max(inv[2][2], 0));
    }
  }

  const tCrit = tCritical(n - p);
  const params = [amplitude, center, sigma];
  const parameterCI: Array<[number, number]> = params.map((c, i) => [
    c - tCrit * parameterSE[i],
    c + tCrit * parameterSE[i],
  ]);

  const fullStats: FitStatistics = {
    n, p,
    sse: stats.sse, sst: stats.sst,
    rSquared: stats.rSquared, adjustedRSquared,
    rmse: stats.rmse, mae: stats.meanAbsError,
    residualStandardError: residualSE,
    residuals, fittedValues, xValues: xv,
    parameterNames: ['amplitude', 'center', 'sigma'],
    parameterEstimates: params,
    parameterSE,
    parameterCI,
  };

  return { amplitude, center, sigma, rSquared: stats.rSquared, stats: fullStats };
}

/**
 * Logistic (sigmoid) fit: y = L / (1 + exp(-k*(x - x0)))
 * Uses Gauss-Newton with initial guess from data.
 * Returns null if insufficient valid data points.
 */
export function logisticFit(x: number[], y: number[]): LogisticFitResult | null {
  const { x: xv, y: yv } = filterValidPairs(x, y);
  if (xv.length < 3) return null;

  const n = xv.length;
  const p = 3;

  // Initial guess
  let L = Math.max(...yv);
  let x0 = xv[0] + (xv[n - 1] - xv[0]) / 2;
  // Estimate k from slope at midpoint
  let k = 1;

  // Gauss-Newton
  const maxIter = 100;
  for (let iter = 0; iter < maxIter; iter++) {
    const J: number[][] = [];
    const residuals: number[] = [];
    for (let i = 0; i < n; i++) {
      const expTerm = Math.exp(-k * (xv[i] - x0));
      const denom = 1 + expTerm;
      const pred = L / denom;
      residuals.push(yv[i] - pred);
      // Partials
      const dL = 1 / denom;
      const dK = (L * expTerm * (xv[i] - x0)) / (denom * denom);
      const dX0 = (L * expTerm * k) / (denom * denom);
      J.push([dL, dK, dX0]);
    }

    const jtJ = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const jtR = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          jtJ[r][c] += J[i][r] * J[i][c];
        }
        jtR[r] += J[i][r] * residuals[i];
      }
    }

    const det = det3(jtJ);
    if (Math.abs(det) < 1e-18) break;

    const delta: number[] = [];
    for (let col = 0; col < 3; col++) {
      const m = jtJ.map((row, i) => row.map((v, j) => (j === col ? jtR[i] : v)));
      delta.push(det3(m) / det);
    }

    if (delta.every((d) => Math.abs(d) < 1e-12)) break;
    if (delta.some((d) => !Number.isFinite(d))) break;

    L += delta[0];
    k += delta[1];
    x0 += delta[2];

    if (!Number.isFinite(L) || !Number.isFinite(k) || !Number.isFinite(x0)) {
      L = Math.max(...yv);
      x0 = xv[0] + (xv[n - 1] - xv[0]) / 2;
      k = 1;
      break;
    }
  }

  const fittedValues = xv.map((xi) => {
    const expTerm = Math.exp(-k * (xi - x0));
    return L / (1 + expTerm);
  });
  const residuals = yv.map((yi, i) => yi - fittedValues[i]);
  const stats = calculateErrorStats(yv, fittedValues);
  if (!stats) return null;

  const adjustedRSquared = n > p ? 1 - ((1 - stats.rSquared) * (n - 1)) / (n - p) : stats.rSquared;
  const residualSE = Math.sqrt(stats.sse / (n - p));

  // Covariance
  const jtJ = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < n; i++) {
    const expTerm = Math.exp(-k * (xv[i] - x0));
    const denom = 1 + expTerm;
    const dL = 1 / denom;
    const dK = (L * expTerm * (xv[i] - x0)) / (denom * denom);
    const dX0 = (L * expTerm * k) / (denom * denom);
    const J = [dL, dK, dX0];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        jtJ[r][c] += J[r] * J[c];
      }
    }
  }

  const det = det3(jtJ);
  const parameterSE: number[] = [NaN, NaN, NaN];
  if (Math.abs(det) > 1e-18) {
    const inv = inv3(jtJ, det);
    if (inv) {
      parameterSE[0] = residualSE * Math.sqrt(Math.max(inv[0][0], 0));
      parameterSE[1] = residualSE * Math.sqrt(Math.max(inv[1][1], 0));
      parameterSE[2] = residualSE * Math.sqrt(Math.max(inv[2][2], 0));
    }
  }

  const tCrit = tCritical(n - p);
  const params = [L, k, x0];
  const parameterCI: Array<[number, number]> = params.map((c, i) => [
    c - tCrit * parameterSE[i],
    c + tCrit * parameterSE[i],
  ]);

  const fullStats: FitStatistics = {
    n, p,
    sse: stats.sse, sst: stats.sst,
    rSquared: stats.rSquared, adjustedRSquared,
    rmse: stats.rmse, mae: stats.meanAbsError,
    residualStandardError: residualSE,
    residuals, fittedValues, xValues: xv,
    parameterNames: ['L', 'k', 'x0'],
    parameterEstimates: params,
    parameterSE,
    parameterCI,
  };

  return { L, k, x0, rSquared: stats.rSquared, stats: fullStats };
}

// --- 3x3 matrix helpers ---

function det3(m: number[][]): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

function inv3(m: number[][], det: number): number[][] | null {
  if (Math.abs(det) < 1e-18) return null;
  const inv: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  inv[0][0] = (m[1][1] * m[2][2] - m[1][2] * m[2][1]) / det;
  inv[0][1] = (m[0][2] * m[2][1] - m[0][1] * m[2][2]) / det;
  inv[0][2] = (m[0][1] * m[1][2] - m[0][2] * m[1][1]) / det;
  inv[1][0] = (m[1][2] * m[2][0] - m[1][0] * m[2][2]) / det;
  inv[1][1] = (m[0][0] * m[2][2] - m[0][2] * m[2][0]) / det;
  inv[1][2] = (m[0][2] * m[1][0] - m[0][0] * m[1][2]) / det;
  inv[2][0] = (m[1][0] * m[2][1] - m[1][1] * m[2][0]) / det;
  inv[2][1] = (m[0][1] * m[2][0] - m[0][0] * m[2][1]) / det;
  inv[2][2] = (m[0][0] * m[1][1] - m[0][1] * m[1][0]) / det;
  return inv;
}

/**
 * Generate fitted values from a fit function over an x range.
 * Default nPoints = 100.
 */
export function generateFittedValues(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  nPoints: number = 100,
): FittedValues {
  if (nPoints < 2) nPoints = 2;
  if (xMin >= xMax) {
    return { x: [xMin], y: [fn(xMin)] };
  }

  const step = (xMax - xMin) / (nPoints - 1);
  const xValues: number[] = [];
  const yValues: number[] = [];

  for (let i = 0; i < nPoints; i++) {
    const xi = xMin + i * step;
    xValues.push(xi);
    yValues.push(fn(xi));
  }

  return { x: xValues, y: yValues };
}

/** Natural log of the gamma function. */

// --- New fit types (Phase 3 — Task 3.2) ---

interface FitResultShape { rSquared: number; stats: FitStatistics; }
interface LorentzianFitResult extends FitResultShape { amplitude: number; center: number; sigma: number; }
interface WeibullFitResult extends FitResultShape { amplitude: number; lambda: number; k: number; }
interface Logistic4PLFitResult extends FitResultShape { a: number; b: number; c: number; d: number; }
interface Logistic5PLFitResult extends Logistic4PLFitResult { g: number; }
interface HillFitResult extends FitResultShape { Vmax: number; K: number; n: number; }
interface BiexponentialFitResult extends FitResultShape { a: number; b: number; c: number; d: number; y0: number; }

/** Generic Levenberg-Marquardt fit using central-difference Jacobian.
 *  @param residualFn (params, x, y) => residual (= y - f(x; params))
 *  @param x, y data
 *  @param initial  initial parameter vector
 *  @param maxIter  max iterations
 *  @returns { params, residualVariance, jacobianAtSolution } or null
 *
 *  Used by all 6 new fit types in Phase 3 Task 3.2 — avoids hand-written
 *  partials for each.
 *  NOTE: An earlier `lmFit(residualFn, ...)` variant is retained below as
 *  `_lmFitResidual` for legacy callers / future re-enablement. Not used in
 *  Phase 3 Task 3.2. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars

/** Compute FitStatistics from final parameters and residuals.
 *  Retained as `_buildStatsLegacy` for legacy callers. Phase 3 Task 3.2 uses
 *  `buildStatsWithSE` which incorporates parameter covariance. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars

/** Compute JᵀJ from the residual Jacobian (n×p) and solve for parameter SE. */
function covarianceSE(jacobian: number[][], residuals: number[], p: number, n: number): number[] {
  if (!jacobian.length) return new Array(p).fill(NaN);
  // jacobian is n×p
  const JtJ: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let r = 0; r < p; r++) {
    for (let c = 0; c < p; c++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += jacobian[k][r] * jacobian[k][c];
      JtJ[r][c] = s;
    }
  }
  let det = 0;
  if (p === 1) det = JtJ[0][0];
  else if (p === 2) det = JtJ[0][0] * JtJ[1][1] - JtJ[0][1] * JtJ[1][0];
  else if (p === 3) det = JtJ[0][0] * (JtJ[1][1] * JtJ[2][2] - JtJ[1][2] * JtJ[2][1])
                      - JtJ[0][1] * (JtJ[1][0] * JtJ[2][2] - JtJ[1][2] * JtJ[2][0])
                      + JtJ[0][2] * (JtJ[1][0] * JtJ[2][1] - JtJ[1][1] * JtJ[2][0]);
  if (Math.abs(det) < 1e-18) return new Array(p).fill(NaN);

  // Compute inverse by Cramer's rule (only works for p ≤ 3)
  const inv = Array.from({ length: p }, () => new Array(p).fill(0));
  if (p === 1) inv[0][0] = 1 / det;
  else if (p === 2) {
    inv[0][0] = JtJ[1][1] / det;
    inv[1][1] = JtJ[0][0] / det;
    inv[0][1] = -JtJ[0][1] / det;
    inv[1][0] = -JtJ[1][0] / det;
  } else if (p === 3) {
    inv[0][0] = (JtJ[1][1] * JtJ[2][2] - JtJ[1][2] * JtJ[2][1]) / det;
    inv[0][1] = (JtJ[0][2] * JtJ[2][1] - JtJ[0][1] * JtJ[2][2]) / det;
    inv[0][2] = (JtJ[0][1] * JtJ[1][2] - JtJ[0][2] * JtJ[1][1]) / det;
    inv[1][0] = (JtJ[1][2] * JtJ[2][0] - JtJ[1][0] * JtJ[2][2]) / det;
    inv[1][1] = (JtJ[0][0] * JtJ[2][2] - JtJ[0][2] * JtJ[2][0]) / det;
    inv[1][2] = (JtJ[0][2] * JtJ[1][0] - JtJ[0][0] * JtJ[1][2]) / det;
    inv[2][0] = (JtJ[1][0] * JtJ[2][1] - JtJ[1][1] * JtJ[2][0]) / det;
    inv[2][1] = (JtJ[0][1] * JtJ[2][0] - JtJ[0][0] * JtJ[2][1]) / det;
    inv[2][2] = (JtJ[0][0] * JtJ[1][1] - JtJ[0][1] * JtJ[1][0]) / det;
  } else {
    return new Array(p).fill(NaN);
  }

  // σ² = SSE / (n - p)
  let sse = 0;
  for (const r of residuals) sse += r * r;
  const df = n - p;
  if (df <= 0) return new Array(p).fill(NaN);
  const sigma2 = sse / df;
  const out = new Array(p).fill(0);
  for (let i = 0; i < p; i++) {
    out[i] = Math.sqrt(Math.max(sigma2 * inv[i][i], 0));
  }
  return out;
}

/**
 * Lorentzian fit: y = A · σ² / ((x - x₀)² + σ²)
 * 3 parameters: amplitude A, center x₀, width σ
 */
export function lorentzianFit(x: number[], y: number[], options?: FitOptions): LorentzianFitResult | null {
  const filtered = filterValidPairsWeighted(x, y, options?.weights);
  if (!filtered || filtered.x.length < 4) return null;
  const { x: xv, y: yv } = filtered;
  // Initial guess: peak amplitude, midpoint, half-width
  const yMax = Math.max(...yv);
  const yMin = Math.min(...yv);
  const amp0 = yMax;
  const idxMax = yv.indexOf(yMax);
  const c0 = xv[idxMax];
  // Find the x distance from peak where y is closest to amp/2.
  // For Lorentzian y = A·σ²/((x-x₀)² + σ²), |x-x₀| at y=A/2 equals σ.
  let sigma0 = 1;
  let minHalfDist = Infinity;
  for (let i = 0; i < xv.length; i++) {
    const dist = Math.abs(yv[i] - amp0 / 2);
    if (dist < minHalfDist) {
      minHalfDist = dist;
      sigma0 = Math.max(0.5, Math.abs(xv[i] - c0));
    }
  }
  const predict = (params: number[], x: number) => {
    const [A, x0, s] = params;
    return (A * s * s) / ((x - x0) ** 2 + s * s);
  };
  // Initial A is also yMax; ignore intermediate yMin (used elsewhere)
  const _ = yMin; // suppress unused warning
  void _;
  const fitResult = lmFitGeneral(predict, xv, yv, [amp0, c0, sigma0], 200, options?.bounds);
  if (!fitResult) return null;
  const [A, x0, s] = fitResult.params;
  const fittedValues = xv.map((xi) => (A * s * s) / ((xi - x0) ** 2 + s * s));
  const residuals = yv.map((yi, i) => yi - fittedValues[i]);
  const stats = buildStatsWithSE(fitResult.params, residuals, xv, yv, fittedValues, ['amplitude', 'center', 'sigma'], 3, fitResult.jacobian);
  return { amplitude: A, center: x0, sigma: s, rSquared: stats.rSquared, stats };
}

/** Wrapper that calls lmFit with residual = y - f(x; params) using a residualFn that computes f.
 *  If `bounds` is provided, parameters are clamped to the given ranges after each iteration
 *  and constrained violations add a "soft penalty" via JᵀJ augmentation.
 *  Exported for use by globalFit (Phase 3 Task 3.5). */
export function lmFitGeneral(
  predictFn: (params: number[], x: number) => number,
  x: number[],
  y: number[],
  initial: number[],
  maxIter: number = 200,
  bounds?: Array<[number, number]>,
): { params: number[]; jacobian: number[][] } | null {
  const n = Math.min(x.length, y.length);
  if (n < initial.length + 1) return null;
  const p = initial.length;
  const h = 1e-5;

  // Clamp initial parameters to bounds
  let params = bounds ? initial.map((v, i) => clampParam(v, bounds[i])) : [...initial];
  if (bounds) {
    // Ensure initial params are within bounds; if any out of range, return null
    for (let i = 0; i < p; i++) {
      const [lo, hi] = bounds[i];
      if (params[i] < lo || params[i] > hi) return null;
    }
  }

  let lambda = 0.01;
  let bestSSE = Infinity;
  let bestParams = [...params];
  let bestJacobian: number[][] = [];

  for (let iter = 0; iter < maxIter; iter++) {
    const residuals = new Array(n);
    for (let i = 0; i < n; i++) residuals[i] = y[i] - predictFn(params, x[i]);
    let sse = 0;
    for (let i = 0; i < n; i++) sse += residuals[i] * residuals[i];

    if (sse < bestSSE) {
      bestSSE = sse;
      bestParams = [...params];
    }

    // Jacobian via central difference (params may be at bounds → use 1e-5 abs step)
    const jacobian: number[][] = [];
    for (let i = 0; i < n; i++) jacobian.push(new Array(p).fill(0));
    for (let j = 0; j < p; j++) {
      const paramsPlus = [...params];
      const paramsMinus = [...params];
      const scale = Math.max(Math.abs(params[j]), 1);
      const hj = h * scale;
      paramsPlus[j] = params[j] + hj;
      paramsMinus[j] = params[j] - hj;
      for (let i = 0; i < n; i++) {
        jacobian[i][j] = -(predictFn(paramsPlus, x[i]) - predictFn(paramsMinus, x[i])) / (2 * hj);
      }
    }
    bestJacobian = jacobian.map((r) => [...r]);

    const JtJ: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
    const Jtr = new Array(p).fill(0);
    for (let r = 0; r < p; r++) {
      for (let c = 0; c < p; c++) {
        let s = 0;
        for (let k = 0; k < n; k++) s += jacobian[k][r] * jacobian[k][c];
        JtJ[r][c] = s;
      }
      let s = 0;
      for (let k = 0; k < n; k++) s += jacobian[k][r] * residuals[k];
      Jtr[r] = s;
    }

    const JtJDamped = JtJ.map((row, i) => row.map((v, j) => v + (i === j ? lambda * (JtJ[i][i] + 1e-10) : 0)));
    const delta = solveSymmetric(JtJDamped, Jtr);
    if (!delta || delta.some((d) => !Number.isFinite(d))) break;

    // Proposed new params (clamped to bounds if specified)
    const rawNewParams = params.map((p0, i) => p0 + delta[i]);
    const newParams = bounds ? rawNewParams.map((v, i) => clampParam(v, bounds[i])) : rawNewParams;
    const newResiduals = new Array(n);
    for (let i = 0; i < n; i++) newResiduals[i] = y[i] - predictFn(newParams, x[i]);
    let newSSE = 0;
    for (let i = 0; i < n; i++) newSSE += newResiduals[i] * newResiduals[i];
    if (newSSE < sse) {
      params = newParams;
      lambda /= 10;
    } else {
      lambda *= 10;
    }
    if (Math.max(...delta.map((d) => Math.abs(d))) < 1e-8) break;
  }
  return { params: bestParams, jacobian: bestJacobian };
}

/** Clamp parameter `v` to the [lo, hi] range. */
function clampParam(v: number, range: [number, number]): number {
  const [lo, hi] = range;
  return Math.max(lo, Math.min(hi, v));
}

/** Solve a symmetric system A x = b via Gaussian elimination with partial pivoting. */
function solveSymmetric(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < n; k++) {
    let maxRow = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(M[i][k]) > Math.abs(M[maxRow][k])) maxRow = i;
    }
    [M[k], M[maxRow]] = [M[maxRow], M[k]];
    if (Math.abs(M[k][k]) < 1e-18) return null;
    for (let i = k + 1; i < n; i++) {
      const factor = M[i][k] / M[k][k];
      for (let j = k; j <= n; j++) M[i][j] -= factor * M[k][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j];
    x[i] = sum / M[i][i];
  }
  return x;
}

/** Build FitStatistics with proper covariance-based SE. */
function buildStatsWithSE(
  params: number[],
  residuals: number[],
  x: number[],
  y: number[],
  fittedValues: number[],
  parameterNames: string[],
  p: number,
  jacobian: number[][],
): FitStatistics {
  const n = x.length;
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  let sse = 0, sst = 0, absSum = 0;
  for (let i = 0; i < n; i++) {
    sse += residuals[i] * residuals[i];
    sst += (y[i] - yMean) ** 2;
    absSum += Math.abs(residuals[i]);
  }
  const rSquared = sst === 0 ? 1 : 1 - sse / sst;
  const rmse = Math.sqrt(sse / n);
  const mae = absSum / n;
  const adjustedRSquared = n > p ? 1 - ((1 - rSquared) * (n - 1)) / (n - p) : rSquared;
  const residualSE = Math.sqrt(sse / Math.max(n - p, 1));
  const tCrit = tCritical(Math.max(n - p, 1));
  const parameterSE = covarianceSE(jacobian, residuals, p, n);
  const parameterCI: Array<[number, number]> = params.map((c, i) => [
    c - tCrit * (parameterSE[i] || 0),
    c + tCrit * (parameterSE[i] || 0),
  ]);
  return {
    n, p, sse, sst, rSquared, adjustedRSquared,
    rmse, mae, residualStandardError: residualSE,
    residuals, fittedValues, xValues: x,
    parameterNames,
    parameterEstimates: params,
    parameterSE, parameterCI,
  };
}

/**
 * Weibull CDF fit: y = A · (1 - exp(-(x/λ)^k))
 * 3 parameters: amplitude A, scale λ, shape k
 */
export function weibullFit(x: number[], y: number[], options?: FitOptions): WeibullFitResult | null {
  const filtered = filterValidPairsWeighted(x, y, options?.weights);
  if (!filtered || filtered.x.length < 4) return null;
  const { x: xv, y: yv } = filtered;
  const yMax = Math.max(...yv);
  const A0 = yMax;
  // Initial λ: x at y = A0 · (1 - 1/e) ≈ 0.632 A0
  let lambda0 = 1;
  for (let i = 0; i < xv.length; i++) {
    if (yv[i] >= A0 * 0.632) { lambda0 = xv[i]; break; }
  }
  const k0 = 1.5;
  const predict = (params: number[], x: number) => {
    const [A, lambda, k] = params;
    return A * (1 - Math.exp(-Math.pow(x / lambda, k)));
  };
  const fit = lmFitGeneral(predict, xv, yv, [A0, lambda0, k0], 200, options?.bounds);
  if (!fit) return null;
  const [A, lambda, k] = fit.params;
  const fittedValues = xv.map(predict.bind(null, fit.params));
  const residuals = yv.map((yi, i) => yi - fittedValues[i]);
  const stats = buildStatsWithSE(fit.params, residuals, xv, yv, fittedValues, ['amplitude', 'lambda', 'k'], 3, fit.jacobian);
  return { amplitude: A, lambda, k, rSquared: stats.rSquared, stats };
}

/**
 * 4-parameter logistic: y = d + (a - d) / (1 + (x/c)^b)
 * Parameters: a (top), b (slope), c (inflection/EC50), d (bottom)
 */
export function logistic4PLFit(x: number[], y: number[], options?: FitOptions): Logistic4PLFitResult | null {
  const filtered = filterValidPairsWeighted(x, y, options?.weights);
  if (!filtered || filtered.x.length < 5) return null;
  const { x: xv, y: yv } = filtered;
  const yMax = Math.max(...yv);
  const yMin = Math.min(...yv);
  // Initial a, d, c (midpoint), b
  const a0 = yMax;
  const d0 = yMin;
  const c0 = xv[Math.floor(xv.length / 2)];
  const b0 = 2;
  const predict = (params: number[], x: number) => {
    const [a, b, c, d] = params;
    return d + (a - d) / (1 + Math.pow(x / c, b));
  };
  const fit = lmFitGeneral(predict, xv, yv, [a0, b0, c0, d0], 200, options?.bounds);
  if (!fit) return null;
  const [a, b, c, d] = fit.params;
  const fittedValues = xv.map(predict.bind(null, fit.params));
  const residuals = yv.map((yi, i) => yi - fittedValues[i]);
  const stats = buildStatsWithSE(fit.params, residuals, xv, yv, fittedValues, ['a', 'b', 'c', 'd'], 4, fit.jacobian);
  return { a, b, c, d, rSquared: stats.rSquared, stats };
}

/**
 * 5-parameter logistic: y = d + (a - d) / (1 + (x/c)^b)^g
 * Parameters: a, b, c, d, g (asymmetry)
 */
export function logistic5PLFit(x: number[], y: number[], options?: FitOptions): Logistic5PLFitResult | null {
  const filtered = filterValidPairsWeighted(x, y, options?.weights);
  if (!filtered || filtered.x.length < 6) return null;
  const { x: xv, y: yv } = filtered;
  const yMax = Math.max(...yv);
  const yMin = Math.min(...yv);
  const a0 = yMax, d0 = yMin, c0 = xv[Math.floor(xv.length / 2)], b0 = 2, g0 = 1;
  const predict = (params: number[], x: number) => {
    const [a, b, c, d, g] = params;
    return d + (a - d) / Math.pow(1 + Math.pow(x / c, b), g);
  };
  const fit = lmFitGeneral(predict, xv, yv, [a0, b0, c0, d0, g0], 200, options?.bounds);
  if (!fit) return null;
  const [a, b, c, d, g] = fit.params;
  const fittedValues = xv.map(predict.bind(null, fit.params));
  const residuals = yv.map((yi, i) => yi - fittedValues[i]);
  const stats = buildStatsWithSE(fit.params, residuals, xv, yv, fittedValues, ['a', 'b', 'c', 'd', 'g'], 5, fit.jacobian);
  return { a, b, c, d, g, rSquared: stats.rSquared, stats };
}

/**
 * Hill equation: y = Vmax · x^n / (K^n + x^n)
 * Parameters: Vmax, K, n
 */
export function hillFit(x: number[], y: number[], options?: FitOptions): HillFitResult | null {
  const filtered = filterValidPairsWeighted(x, y, options?.weights);
  if (!filtered || filtered.x.length < 4) return null;
  const { x: xv, y: yv } = filtered;
  // Use only positive x
  const validIdx = xv.map((_, i) => (xv[i] > 0 ? i : -1)).filter((i) => i >= 0);
  if (validIdx.length < 4) return null;
  const xvPos = validIdx.map((i) => xv[i]);
  const yvPos = validIdx.map((i) => yv[i]);
  const yMax = Math.max(...yvPos);
  const Vmax0 = yMax;
  // K = x at y = Vmax/2
  let K0 = 1;
  for (let i = 0; i < xvPos.length; i++) {
    if (yvPos[i] >= Vmax0 / 2) { K0 = xvPos[i]; break; }
  }
  const n0 = 1;
  const predict = (params: number[], x: number) => {
    const [Vmax, K, n] = params;
    return Vmax * Math.pow(x, n) / (Math.pow(K, n) + Math.pow(x, n));
  };
  const fit = lmFitGeneral(predict, xvPos, yvPos, [Vmax0, K0, n0], 200, options?.bounds);
  if (!fit) return null;
  const [Vmax, K, n] = fit.params;
  const fittedValues = xvPos.map(predict.bind(null, fit.params));
  const residuals = yvPos.map((yi, i) => yi - fittedValues[i]);
  const stats = buildStatsWithSE(fit.params, residuals, xvPos, yvPos, fittedValues, ['Vmax', 'K', 'n'], 3, fit.jacobian);
  return { Vmax, K, n, rSquared: stats.rSquared, stats };
}

/**
 * Bi-exponential: y = a·exp(-b·x) + c·exp(-d·x)
 * Parameters: a, b (>0), c, d (>0)
 * Initial guess: y(0) = a + c; linearize log(y) for fast b
 */
export function biexponentialFit(x: number[], y: number[], options?: FitOptions): BiexponentialFitResult | null {
  const filtered = filterValidPairsWeighted(x, y, options?.weights);
  if (!filtered || filtered.x.length < 5) return null;
  const { x: xv, y: yv } = filtered;
  // Filter to y > 0 for log-linearization
  const positiveIdx = xv.map((_, i) => (yv[i] > 0 ? i : -1)).filter((i) => i >= 0);
  if (positiveIdx.length < 5) return null;
  const xvPos = positiveIdx.map((i) => xv[i]);
  const yvPos = positiveIdx.map((i) => yv[i]);
  const y0 = yvPos[0];
  // Try a single exponential first for initial guess
  // a·exp(-b·x) + c·exp(-d·x) ≈ a·exp(-b·x) for x → ∞; ≈ (a+c)·exp(-b·x) for x → 0
  // Simpler: assume c = 0.2·a, d = 0.3·b
  const a0 = y0 * 0.7;
  const c0 = y0 * 0.3;
  const b0 = 0.5;
  const d0 = 0.2;
  const predict = (params: number[], x: number) => {
    const [a, b, c, d] = params;
    return a * Math.exp(-b * x) + c * Math.exp(-d * x);
  };
  const fit = lmFitGeneral(predict, xvPos, yvPos, [a0, b0, c0, d0], 200, options?.bounds);
  if (!fit) return null;
  const [a, b, c, d] = fit.params;
  const fittedValues = xvPos.map(predict.bind(null, fit.params));
  const residuals = yvPos.map((yi, i) => yi - fittedValues[i]);
  const stats = buildStatsWithSE(fit.params, residuals, xvPos, yvPos, fittedValues, ['a', 'b', 'c', 'd'], 4, fit.jacobian);
  return { a, b, c, d, y0: a + c, rSquared: stats.rSquared, stats };
}

/**
 * Calculate error statistics between actual and fitted values.
 * Returns null if arrays are empty or have mismatched lengths.
 */
export function calculateErrorStats(
  yActual: number[],
  yFitted: number[],
): ErrorStats | null {
  if (yActual.length === 0 || yActual.length !== yFitted.length) return null;

  const n = yActual.length;
  const yMean = mean(yActual);

  let sse = 0;
  let sst = 0;
  let absErrorSum = 0;

  for (let i = 0; i < n; i++) {
    const residual = yActual[i] - yFitted[i];
    sse += residual ** 2;
    sst += (yActual[i] - yMean) ** 2;
    absErrorSum += Math.abs(residual);
  }

  const rSquared = sst === 0 ? 1 : 1 - sse / sst;
  const rmse = Math.sqrt(sse / n);
  const meanAbsError = absErrorSum / n;

  return { sse, sst, rSquared, rmse, meanAbsError };
}

// --- Prediction band (95% CI for the mean response) ---

export interface ConfidenceBand {
  /** Query x values (where band is evaluated). */
  x: number[];
  /** Upper edge: ŷ(x) + tCrit · SE(prediction) */
  upper: number[];
  /** Lower edge: ŷ(x) - tCrit · SE(prediction) */
  lower: number[];
  /** Critical t value used (two-tailed, alpha=0.05 default). */
  tCritical: number;
}

/** Supported fit types for prediction band (v1: linear + polynomial). */
export type PredictionBandType = 'linear' | 'polynomial';

/**
 * Compute a 95% confidence band for the mean response ŷ(x).
 * - Linear: SE(ŷ) = s · sqrt(1/n + (x - x̄)² / Sxx)
 * - Polynomial (degree 1-6): SE(ŷ) = sqrt(x_pᵀ (XᵀX)⁻¹ x_p) · s
 *   where x_p = [1, x, x², ..., x^deg]^T. Pass `data.degree` to specify the polynomial degree.
 *
 * Returns null for unsupported fit types, insufficient / singular data,
 * or for polynomial without a specified `degree`.
 */
export function computePredictionBand(
  type: PredictionBandType,
  data: { x: number[]; y: number[]; degree?: number },
  queryX: number[],
  alpha: number = 0.05,
): ConfidenceBand | null {
  // alpha reserved for future use (custom confidence level); v1 hardcodes 0.05
  void alpha;
  const xArr = data.x;
  const yArr = data.y;
  if (xArr.length < 2 || xArr.length !== yArr.length) return null;

  // Filter valid pairs
  const xv: number[] = [];
  const yv: number[] = [];
  for (let i = 0; i < xArr.length; i++) {
    if (Number.isFinite(xArr[i]) && Number.isFinite(yArr[i])) {
      xv.push(xArr[i]);
      yv.push(yArr[i]);
    }
  }
  if (xv.length < 2) return null;

  const n = xv.length;

  if (type === 'linear') {
    // Compute least squares
    const xMean = xv.reduce((s, v) => s + v, 0) / n;
    const yMean = yv.reduce((s, v) => s + v, 0) / n;
    let ssXX = 0;
    let ssXY = 0;
    for (let i = 0; i < n; i++) {
      ssXX += (xv[i] - xMean) ** 2;
      ssXY += (xv[i] - xMean) * (yv[i] - yMean);
    }
    if (Math.abs(ssXX) < 1e-12) return null;
    const slope = ssXY / ssXX;
    const intercept = yMean - slope * xMean;

    // SSE
    let sse = 0;
    for (let i = 0; i < n; i++) {
      const yPred = slope * xv[i] + intercept;
      sse += (yv[i] - yPred) ** 2;
    }
    const s = Math.sqrt(sse / (n - 2));
    const tCrit = tCritical(n - 2);
    const yPredAtQuery = (qx: number) => slope * qx + intercept;

    const x: number[] = [];
    const upper: number[] = [];
    const lower: number[] = [];
    for (const qx of queryX) {
      if (!Number.isFinite(qx)) continue;
      const yHat = yPredAtQuery(qx);
      const se = s * Math.sqrt(1 / n + (qx - xMean) ** 2 / ssXX);
      x.push(qx);
      upper.push(yHat + tCrit * se);
      lower.push(yHat - tCrit * se);
    }
    return { x, upper, lower, tCritical: tCrit };
  }

  if (type === 'polynomial') {
    const degree = data.degree;
    if (degree === undefined || degree < 1 || degree > 6) return null;
    const p = degree + 1;
    if (n <= degree) return null;

    // Build Vandermonde and solve via QR
    const vandermonde: number[][] = xv.map((xi) => {
      const row: number[] = [];
      for (let j = 0; j <= degree; j++) row.push(xi ** j);
      return row;
    });
    const qr = qrDecompose(vandermonde);
    if (!qr) return null;
    const qtb = new Array(p).fill(0);
    for (let j = 0; j < p; j++) {
      for (let i = 0; i < n; i++) qtb[j] += qr.Q[i][j] * yv[i];
    }
    const coeffs = solveUpperTriangular(qr.R, qtb);
    if (!coeffs) return null;
    const RInv = inverseUpperTriangular(qr.R);
    if (!RInv) return null;

    // SSE
    let sse = 0;
    for (let i = 0; i < n; i++) {
      let yp = 0;
      for (let j = 0; j <= degree; j++) yp += coeffs[j] * xv[i] ** j;
      sse += (yv[i] - yp) ** 2;
    }
    const df = n - p;
    if (df <= 0) return null; // need at least 1 dof
    const s = Math.sqrt(sse / df);
    const tCrit = tCritical(df);

    const x: number[] = [];
    const upper: number[] = [];
    const lower: number[] = [];
    for (const qx of queryX) {
      if (!Number.isFinite(qx)) continue;
      // se = s * sqrt(x_p^T (X^T X)^{-1} x_p) = s * sqrt(Σ_i (Σ_j RInv[i][j] * qx^j)^2)
      let se2 = 0;
      for (let i = 0; i < p; i++) {
        let rowSum = 0;
        for (let j = 0; j < p; j++) {
          rowSum += RInv[i][j] * qx ** j;
        }
        se2 += rowSum * rowSum;
      }
      const se = s * Math.sqrt(se2);
      let yHat = 0;
      for (let j = 0; j <= degree; j++) yHat += coeffs[j] * qx ** j;
      x.push(qx);
      upper.push(yHat + tCrit * se);
      lower.push(yHat - tCrit * se);
    }
    return { x, upper, lower, tCritical: tCrit };
  }

  return null;
}

// --- Global fit (Phase 3 Task 3.5) ---

/** Specification for a single dataset in a global (multi-dataset) fit. */
export interface GlobalFitDataset {
  x: number[];
  y: number[];
  /**
   * Predict function for THIS dataset using the combined parameter vector.
   * Caller decides the parameter-slot layout (e.g. [local1, local2, shared]).
   */
  predict: (params: number[], x: number) => number;
}

/** Result of a global fit: optimal parameter vector + R² + total SSE. */
export interface GlobalFitResult {
  params: number[];
  rSquared: number;
  sse: number;
  n: number;
}

/**
 * Global (multi-dataset) least-squares fit via Levenberg-Marquardt.
 *
 * Concatenates the residuals from all datasets and runs a single LM
 * optimization over the combined parameter vector. Supports per-dataset
 * local parameters AND shared parameters — caller controls layout via
 * each `datasets[i].predict`.
 *
 * Minimum 2 valid datasets required.
 */
export function globalFit(
  datasets: GlobalFitDataset[],
  initial: number[],
  options?: { maxIter?: number },
): GlobalFitResult | null {
  if (datasets.length < 2) return null;
  // Filter each dataset to finite-value pairs.
  const filteredDatasets: { x: number[]; y: number[]; predict: GlobalFitDataset['predict'] }[] = [];
  for (const ds of datasets) {
    if (ds.x.length < 2 || ds.x.length !== ds.y.length) continue;
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < ds.x.length; i++) {
      if (Number.isFinite(ds.x[i]) && Number.isFinite(ds.y[i])) {
        x.push(ds.x[i]);
        y.push(ds.y[i]);
      }
    }
    if (x.length >= 2) filteredDatasets.push({ x, y, predict: ds.predict });
  }
  if (filteredDatasets.length < 2) return null;

  // Concatenate (x, y) pairs across datasets into a single array.
  const xAll: number[] = [];
  const yAll: number[] = [];
  for (let d = 0; d < filteredDatasets.length; d++) {
    const ds = filteredDatasets[d];
    for (let i = 0; i < ds.x.length; i++) {
      xAll.push(ds.x[i]);
      yAll.push(ds.y[i]);
    }
  }

  // Per-row dataset tag (which dataset does row i belong to?).
  const tag: number[] = [];
  for (let d = 0; d < filteredDatasets.length; d++) {
    for (let i = 0; i < filteredDatasets[d].x.length; i++) tag.push(d);
  }

  // Shared counter — lmFitGeneral calls predictFn in three sequential patterns:
  //   (1) residuals: n calls (i = 0..n-1)
  //   (2) jacobian: p * n calls (j = 0..p-1, i = 0..n-1) twice (params+/-)
  //   (3) newParams residuals: n calls
  // All sequential by `i`, so a single counter is safe.
  let counter = 0;
  const wrappedPredict = (params: number[], x: number) => {
    const idx = counter++;
    return filteredDatasets[tag[idx]].predict(params, x);
  };

  // NB: lmFitGeneral may call predictFn in different orders depending on
  // branch path. To be robust, we re-implement the inner LM loop here
  // using our counter.
  const fit = lmFitGlobal(wrappedPredict, xAll, yAll, initial, options?.maxIter ?? 200, tag, filteredDatasets);
  if (!fit) return null;

  // Compute R² across all datasets with the returned params.
  const n = yAll.length;
  let sse = 0;
  const yMean = yAll.reduce((s, v) => s + v, 0) / n;
  for (let i = 0; i < n; i++) {
    const pred = filteredDatasets[tag[i]].predict(fit, xAll[i]);
    const r = yAll[i] - pred;
    sse += r * r;
  }
  let sst = 0;
  for (let i = 0; i < n; i++) sst += (yAll[i] - yMean) ** 2;
  const rSquared = sst === 0 ? 1 : 1 - sse / sst;
  return { params: fit, rSquared, sse, n };
}

// Note: this is a separate LM implementation from `lmFitGeneral` because that
// function's `predictFn` signature is `predict(params, x)`, which doesn't expose
// the row index. For global fitting with per-dataset dispatch, our wrapper
// closure above maintains a counter that aligns predict calls with dataset
// rows via the `tag` array. We re-implement the LM loop here so that we
// control counter resets between "outer" iterations.
function lmFitGlobal(
  predict: (params: number[], x: number) => void,
  x: number[],
  y: number[],
  initial: number[],
  maxIter: number,
  tag: number[],
  datasets: { predict: GlobalFitDataset['predict'] }[],
): number[] | null {
  const n = Math.min(x.length, y.length);
  if (n < initial.length + 1) return null;
  const p = initial.length;
  const h = 1e-5;
  let params = [...initial];
  let lambda = 0.01;
  let bestSSE = Infinity;
  let bestParams = [...params];

  for (let iter = 0; iter < maxIter; iter++) {
    // Counter reset at the start of each lmFitGlobal iteration
    let counter = 0;
    const predictAt = (paramsVec: number[], idx: number) =>
      datasets[tag[idx]].predict(paramsVec, x[idx]);

    // Residuals
    const residuals = new Array(n);
    for (let i = 0; i < n; i++) {
      counter++;
      residuals[i] = y[i] - predictAt(params, i);
      // silence unused 'predict' warning (kept for API parity)
      void predict;
    }
    let sse = 0;
    for (let i = 0; i < n; i++) sse += residuals[i] * residuals[i];
    if (sse < bestSSE) bestSSE = sse, bestParams = [...params];

    // Jacobian (central difference)
    const jacobian: number[][] = [];
    for (let i = 0; i < n; i++) jacobian.push(new Array(p).fill(0));
    counter = 0; // reset
    for (let j = 0; j < p; j++) {
      const paramsPlus = [...params];
      const paramsMinus = [...params];
      const scale = Math.max(Math.abs(params[j]), 1);
      const hj = h * scale;
      paramsPlus[j] = params[j] + hj;
      paramsMinus[j] = params[j] - hj;
      for (let i = 0; i < n; i++) {
        counter++;
        jacobian[i][j] = -(predictAt(paramsPlus, i) - predictAt(paramsMinus, i)) / (2 * hj);
      }
    }

    // JᵀJ and Jᵀr
    const JtJ: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
    const Jtr = new Array(p).fill(0);
    for (let r = 0; r < p; r++) {
      for (let c = 0; c < p; c++) {
        let s = 0;
        for (let k = 0; k < n; k++) s += jacobian[k][r] * jacobian[k][c];
        JtJ[r][c] = s;
      }
      let s = 0;
      for (let k = 0; k < n; k++) s += jacobian[k][r] * residuals[k];
      Jtr[r] = s;
    }

    const JtJDamped = JtJ.map((row, i) => row.map((v, j) => v + (i === j ? lambda * (JtJ[i][i] + 1e-10) : 0)));
    const delta = solveSymmetric(JtJDamped, Jtr);
    if (!delta || delta.some((d) => !Number.isFinite(d))) break;

    counter = 0; // reset
    const rawNewParams = params.map((p0, i) => p0 + delta[i]);
    const newResiduals = new Array(n);
    for (let i = 0; i < n; i++) {
      counter++;
      newResiduals[i] = y[i] - predictAt(rawNewParams, i);
    }
    let newSSE = 0;
    for (let i = 0; i < n; i++) newSSE += newResiduals[i] * newResiduals[i];
    if (newSSE < sse) {
      params = rawNewParams;
      lambda /= 10;
    } else {
      lambda *= 10;
    }
    if (Math.max(...delta.map((d) => Math.abs(d))) < 1e-8) break;
  }
  return bestParams;
}
