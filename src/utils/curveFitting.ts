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
export function linearFit(x: number[], y: number[]): LinearFitResult | null {
  const { x: xv, y: yv } = filterValidPairs(x, y);
  if (xv.length < 2) return null;

  const n = xv.length;
  const p = 2;
  const xMean = mean(xv);
  const yMean = mean(yv);

  let ssXY = 0;
  let ssXX = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (xv[i] - xMean) * (yv[i] - yMean);
    ssXX += (xv[i] - xMean) ** 2;
  }

  if (Math.abs(ssXX) < 1e-12) return null;

  const slope = ssXY / ssXX;
  const intercept = yMean - slope * xMean;

  // Fitted values and residuals
  const fittedValues = xv.map((xi) => slope * xi + intercept);
  const residuals = yv.map((yi, i) => yi - fittedValues[i]);
  const stats = calculateErrorStats(yv, fittedValues);
  if (!stats) return null;

  // Adjusted R²
  const adjustedRSquared = n > p ? 1 - ((1 - stats.rSquared) * (n - 1)) / (n - p) : stats.rSquared;

  // Parameter standard errors
  const sse = stats.sse;
  const residualSE = Math.sqrt(sse / (n - p));
  const seSlope = residualSE / Math.sqrt(ssXX);
  const seIntercept = residualSE * Math.sqrt(1 / n + (xMean * xMean) / ssXX);

  // 95% CI
  const tCrit = tCritical(n - p);
  const ciSlope: [number, number] = [slope - tCrit * seSlope, slope + tCrit * seSlope];
  const ciIntercept: [number, number] = [intercept - tCrit * seIntercept, intercept + tCrit * seIntercept];

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
    parameterNames: ['slope', 'intercept'],
    parameterEstimates: [slope, intercept],
    parameterSE: [seSlope, seIntercept],
    parameterCI: [ciSlope, ciIntercept],
  };

  return { slope, intercept, rSquared: stats.rSquared, stats: fullStats };
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
): PolynomialFitResult | null {
  if (degree < 1 || degree > 6) return null;

  const { x: xv, y: yv } = filterValidPairs(x, y);
  if (xv.length <= degree) return null;

  const n = xv.length;
  const p = degree + 1;

  // Build Vandermonde matrix: each row is [1, x, x², ..., x^degree]
  const vandermonde: number[][] = xv.map((xi) => {
    const row: number[] = [];
    for (let j = 0; j <= degree; j++) {
      row.push(xi ** j);
    }
    return row;
  });

  // Solve least squares via QR: A c = y  →  R c = Q^T y
  const qr = qrDecompose(vandermonde);
  if (!qr) return null;

  const qtb = new Array(degree + 1).fill(0);
  for (let j = 0; j <= degree; j++) {
    for (let i = 0; i < n; i++) {
      qtb[j] += qr.Q[i][j] * yv[i];
    }
  }

  const coeffsLowToHigh = solveUpperTriangular(qr.R, qtb);
  if (!coeffsLowToHigh) return null;

  // Reverse to highest degree first
  const coefficients = [...coeffsLowToHigh].reverse();

  // Fitted values and residuals
  const fittedValues = xv.map((xi) => {
    let yPred = 0;
    for (let j = 0; j <= degree; j++) {
      yPred += coeffsLowToHigh[j] * xi ** j;
    }
    return yPred;
  });
  const residuals = yv.map((yi, i) => yi - fittedValues[i]);

  const stats = calculateErrorStats(yv, fittedValues);
  if (!stats) return null;

  // Adjusted R²
  const adjustedRSquared = n > p ? 1 - ((1 - stats.rSquared) * (n - 1)) / (n - p) : stats.rSquared;

  // Parameter standard errors via covariance matrix: cov = s² * R⁻¹ R⁻ᵀ
  const sse = stats.sse;
  const residualSE = Math.sqrt(sse / (n - p));
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

  // 95% CI
  const tCrit = tCritical(n - p);
  const parameterCI: Array<[number, number]> = coeffsLowToHigh.map((c, i) => [
    c - tCrit * parameterSE[i],
    c + tCrit * parameterSE[i],
  ]);

  // Parameter names: c₀ (intercept), c₁, c₂, ...
  const parameterNames = coeffsLowToHigh.map((_, i) => (i === 0 ? 'intercept' : `c${i}`));

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
    parameterNames,
    parameterEstimates: coeffsLowToHigh,
    parameterSE,
    parameterCI,
  };

  return { coefficients, rSquared: stats.rSquared, stats: fullStats };
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
