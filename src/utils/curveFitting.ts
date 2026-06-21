// Curve fitting utility module

// --- Helper types ---

interface LinearFitResult {
  slope: number;
  intercept: number;
  rSquared: number;
}

interface PolynomialFitResult {
  coefficients: number[];
  rSquared: number;
}

interface ExponentialFitResult {
  a: number;
  b: number;
  rSquared: number;
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

/** Multiply matrix A (m×n) by matrix B (n×p) → matrix (m×p) */
function matMul(a: number[][], b: number[][]): number[][] {
  const m = a.length;
  const n = b.length;
  const p = b[0].length;
  const result: number[][] = Array.from({ length: m }, () => new Array(p).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < n; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

/** Invert a square matrix using Gauss-Jordan elimination */
function matInvert(matrix: number[][]): number[][] | null {
  const n = matrix.length;
  // Augment with identity
  const aug: number[][] = matrix.map((row, i) => {
    const identityRow = new Array(n).fill(0);
    identityRow[i] = 1;
    return [...row, ...identityRow];
  });

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) return null; // Singular matrix

    for (let j = 0; j < 2 * n; j++) {
      aug[col][j] /= pivot;
    }

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  return aug.map((row) => row.slice(n));
}

/** Transpose a matrix */
function matTranspose(a: number[][]): number[][] {
  const rows = a.length;
  const cols = a[0].length;
  const result: number[][] = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = a[i][j];
    }
  }
  return result;
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

  // R² calculation
  const yFitted = xv.map((xi) => slope * xi + intercept);
  const stats = calculateErrorStats(yv, yFitted);
  if (!stats) return null;

  return { slope, intercept, rSquared: stats.rSquared };
}

/**
 * Polynomial regression using normal equations (matrix approach).
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

  // Build Vandermonde matrix: each row is [1, x, x², ..., x^degree]
  const vandermonde: number[][] = xv.map((xi) => {
    const row: number[] = [];
    for (let j = 0; j <= degree; j++) {
      row.push(xi ** j);
    }
    return row;
  });

  // Normal equations: (X^T X) c = X^T y
  const xt = matTranspose(vandermonde);
  const xtx = matMul(xt, vandermonde);
  const xty = matMul(xt, yv.map((v) => [v]));

  const xtxInv = matInvert(xtx);
  if (!xtxInv) return null;

  const coeffMatrix = matMul(xtxInv, xty);

  // Coefficients from lowest degree to highest
  const coeffsLowToHigh = coeffMatrix.map((row) => row[0]);

  // Reverse to highest degree first
  const coefficients = [...coeffsLowToHigh].reverse();

  // R² calculation
  const yFitted = xv.map((xi) => {
    let yPred = 0;
    for (let j = 0; j <= degree; j++) {
      yPred += coeffsLowToHigh[j] * xi ** j;
    }
    return yPred;
  });

  const stats = calculateErrorStats(yv, yFitted);
  if (!stats) return null;

  return { coefficients, rSquared: stats.rSquared };
}

/**
 * Exponential fit: y = a * e^(b*x)
 * Linearizes by taking log(y), then performs linear regression on log(y) vs x.
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

  const logY = yv.map((v) => Math.log(v));
  const linResult = linearFit(xv, logY);
  if (!linResult) return null;

  const b = linResult.slope;
  const a = Math.exp(linResult.intercept);

  // Calculate R² against original (non-log) y values
  const yFitted = xv.map((xi) => a * Math.exp(b * xi));
  const stats = calculateErrorStats(yv, yFitted);
  if (!stats) return null;

  return { a, b, rSquared: stats.rSquared };
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
