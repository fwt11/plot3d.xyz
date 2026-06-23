// Multi-peak fitting using Gauss-Newton non-linear least squares.
// Supports Gaussian, Lorentzian, and Pseudo-Voigt peak shapes with
// linear or polynomial background subtraction.

import type {
  PeakShape,
  PeakResult,
  MultiPeakFitResult,
  MultiPeakFitOptions,
} from './peakTypes';
import { DEFAULT_FIT_OPTIONS } from './peakTypes';
import { detectPeaks, estimateInitialPeaks, type DetectedPeak } from './peakDetection';

// --- Peak shape functions ---

/** Evaluate a single peak at position x. */
function evalPeak(x: number, amp: number, center: number, width: number, eta: number | undefined, shape: PeakShape): number {
  if (width <= 0) return 0;
  const dx = x - center;
  if (shape === 'gaussian') {
    return amp * Math.exp(-(dx * dx) / (2 * width * width));
  }
  if (shape === 'lorentzian') {
    // width = HWHM; L(x) = amp / (1 + (dx/width)^2)
    return amp / (1 + (dx / width) * (dx / width));
  }
  // Pseudo-Voigt: (1-eta)*Gaussian + eta*Lorentzian
  const g = Math.exp(-(dx * dx) / (2 * width * width));
  const l = 1 / (1 + (dx / width) * (dx / width));
  return amp * ((1 - eta!) * g + eta! * l);
}

/** Partial derivatives of a peak w.r.t. its parameters. */
function peakPartials(x: number, amp: number, center: number, width: number, eta: number | undefined, shape: PeakShape): number[] {
  const dx = x - center;
  if (shape === 'gaussian') {
    const expTerm = Math.exp(-(dx * dx) / (2 * width * width));
    const dAmp = expTerm;
    const dCenter = amp * expTerm * dx / (width * width);
    const dWidth = amp * expTerm * dx * dx / (width * width * width);
    return [dAmp, dCenter, dWidth];
  }
  if (shape === 'lorentzian') {
    const denom = 1 + (dx / width) * (dx / width);
    const dAmp = 1 / denom;
    const dCenter = amp * (2 * dx) / (width * width * denom * denom);
    const dWidth = amp * 2 * dx * dx / (width * width * width * denom * denom);
    return [dAmp, dCenter, dWidth];
  }
  // Pseudo-Voigt: 4 params [amp, center, width, eta]
  const g = Math.exp(-(dx * dx) / (2 * width * width));
  const l = 1 / (1 + (dx / width) * (dx / width));
  const dAmp = (1 - eta!) * g + eta! * l;
  const dCenter = amp * ((1 - eta!) * g * dx / (width * width) + eta! * 2 * dx / (width * width * l * l));
  const dWidth = amp * ((1 - eta!) * g * dx * dx / (width * width * width) + eta! * 2 * dx * dx / (width * width * width * l * l));
  const dEta = amp * (l - g);
  return [dAmp, dCenter, dWidth, dEta];
}

/** Number of parameters per peak for a given shape. */
function paramsPerPeak(shape: PeakShape): number {
  return shape === 'pseudovoigt' ? 4 : 3;
}

// --- Background fitting ---

/** Fit a polynomial background of given degree to (x, y) data via least squares.
 *  Returns coefficients from highest degree to lowest (numpy polyfit convention). */
function fitPolynomialBackground(x: number[], y: number[], degree: number): number[] {
  const n = x.length;
  const p = degree + 1;
  if (n < p) return new Array(p).fill(0);

  // Build Vandermonde matrix (low to high degree)
  const A: number[][] = x.map((xi) => {
    const row: number[] = [];
    for (let j = 0; j < p; j++) row.push(Math.pow(xi, j));
    return row;
  });

  // Normal equations: (A^T A) c = A^T y
  const AtA: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const Aty: number[] = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let r = 0; r < p; r++) {
      Aty[r] += A[i][r] * y[i];
      for (let c = 0; c < p; c++) {
        AtA[r][c] += A[i][r] * A[i][c];
      }
    }
  }

  // Solve via Gaussian elimination with partial pivoting
  const coeffs = gaussianElim(AtA, Aty);
  // Reverse to highest-degree-first
  return coeffs.reverse();
}

/** Solve a linear system Ax = b via Gaussian elimination with partial pivoting. */
function gaussianElim(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let k = 0; k < n; k++) {
    // Partial pivoting
    let maxRow = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(M[i][k]) > Math.abs(M[maxRow][k])) maxRow = i;
    }
    [M[k], M[maxRow]] = [M[maxRow], M[k]];

    if (Math.abs(M[k][k]) < 1e-14) continue;

    for (let i = k + 1; i < n; i++) {
      const factor = M[i][k] / M[k][k];
      for (let j = k; j <= n; j++) {
        M[i][j] -= factor * M[k][j];
      }
    }
  }

  // Back-substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j];
    x[i] = Math.abs(M[i][i]) < 1e-14 ? 0 : sum / M[i][i];
  }
  return x;
}

// --- Main multi-peak fit ---

/**
 * Fit multiple peaks to (x, y) data.
 *
 * If initialPeaks is not provided, peaks are auto-detected via detectPeaks().
 * Uses Gauss-Newton iteration with Levenberg-Marquardt damping for stability.
 *
 * @param x  X values (sorted ascending recommended).
 * @param y  Y values.
 * @param initialPeaks  Optional initial peak parameters.
 * @param options  Fit options.
 */
export function multiPeakFit(
  x: number[],
  y: number[],
  initialPeaks?: Array<{ amplitude: number; center: number; width: number; eta?: number }>,
  options: MultiPeakFitOptions = DEFAULT_FIT_OPTIONS,
): MultiPeakFitResult | null {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;

  const { shape, backgroundType, backgroundDegree = 2, maxIterations = 200, tolerance = 1e-8 } = options;
  const ppp = paramsPerPeak(shape);

  // --- Detect or use provided peaks ---
  let peaks: Array<{ amplitude: number; center: number; width: number; eta?: number }>;
  if (initialPeaks && initialPeaks.length > 0) {
    peaks = initialPeaks.map((p) => ({ ...p }));
  } else {
    const detected: DetectedPeak[] = detectPeaks(x, y);
    if (detected.length === 0) return null;
    peaks = estimateInitialPeaks(detected, shape);
  }
  const nPeaks = peaks.length;
  if (nPeaks === 0) return null;

  // --- Fit background first (rough) ---
  let bgCoeffs: number[] = [];
  if (backgroundType === 'linear') {
    bgCoeffs = fitPolynomialBackground(x, y, 1);
  } else if (backgroundType === 'polynomial') {
    bgCoeffs = fitPolynomialBackground(x, y, backgroundDegree);
  }

  // --- Flatten parameters into a single vector ---
  // Layout: [peak0_amp, peak0_center, peak0_width, (peak0_eta), peak1_..., ..., bg_coeffs...]
  const nBgParams = bgCoeffs.length;
  const totalParams = nPeaks * ppp + nBgParams;

  const params: number[] = [];
  for (const pk of peaks) {
    params.push(pk.amplitude, pk.center, pk.width);
    if (shape === 'pseudovoigt') params.push(pk.eta ?? 0.5);
  }
  for (const c of bgCoeffs) params.push(c);

  // --- Gauss-Newton with LM damping ---
  const lambda = 0.01; // LM damping factor
  let bestSSE = Infinity;
  let bestParams = [...params];

  for (let iter = 0; iter < maxIterations; iter++) {
    // Build Jacobian and residual vector
    const J: number[][] = [];
    const residuals: number[] = [];

    for (let i = 0; i < n; i++) {
      const xi = x[i];
      const yi = y[i];

      // Predicted value: sum of peaks + background
      let pred = 0;
      const partials: number[] = [];

      for (let k = 0; k < nPeaks; k++) {
        const base = k * ppp;
        const amp = params[base];
        const center = params[base + 1];
        const width = params[base + 2];
        const eta = shape === 'pseudovoigt' ? params[base + 3] : undefined;

        pred += evalPeak(xi, amp, center, width, eta, shape);
        const p = peakPartials(xi, amp, center, width, eta, shape);
        partials.push(...p);
      }

      // Background contribution
      for (let b = 0; b < nBgParams; b++) {
        const bgIdx = nPeaks * ppp + b;
        const bgVal = params[bgIdx];
        const power = nBgParams - 1 - b;
        pred += bgVal * Math.pow(xi, power);
        partials.push(Math.pow(xi, power));
      }

      residuals.push(yi - pred);
      J.push(partials);
    }

    // Compute J^T J and J^T r
    const JtJ: number[][] = Array.from({ length: totalParams }, () => new Array(totalParams).fill(0));
    const Jtr: number[] = new Array(totalParams).fill(0);
    let sse = 0;

    for (let i = 0; i < n; i++) {
      for (let r = 0; r < totalParams; r++) {
        Jtr[r] += J[i][r] * residuals[i];
        for (let c = 0; c < totalParams; c++) {
          JtJ[r][c] += J[i][r] * J[i][c];
        }
      }
      sse += residuals[i] * residuals[i];
    }

    // Track best solution
    if (sse < bestSSE) {
      bestSSE = sse;
      bestParams = [...params];
    }

    // Add LM damping: (J^T J + λ*diag) delta = J^T r
    const JtJDamped = JtJ.map((row) => [...row]);
    for (let i = 0; i < totalParams; i++) {
      JtJDamped[i][i] += lambda * (JtJ[i][i] + 1e-10);
    }

    const delta = gaussianElim(JtJDamped, Jtr);
    if (!delta || delta.some((d) => !Number.isFinite(d))) break;

    // Check convergence
    const maxDelta = Math.max(...delta.map(Math.abs));
    if (maxDelta < tolerance) break;

    // Update parameters
    for (let i = 0; i < totalParams; i++) {
      params[i] += delta[i];
    }

    // Constrain widths to be positive
    for (let k = 0; k < nPeaks; k++) {
      const base = k * ppp;
      if (params[base + 2] <= 0) params[base + 2] = 1e-6;
    }
    // Constrain eta to [0, 1] for pseudo-Voigt
    if (shape === 'pseudovoigt') {
      for (let k = 0; k < nPeaks; k++) {
        const base = k * ppp;
        params[base + 3] = Math.max(0, Math.min(1, params[base + 3]));
      }
    }
  }

  // Use best parameters found
  for (let i = 0; i < totalParams; i++) params[i] = bestParams[i];

  // --- Build result ---
  const fittedPeaks: PeakResult[] = [];
  for (let k = 0; k < nPeaks; k++) {
    const base = k * ppp;
    const amp = params[base];
    const center = params[base + 1];
    const width = params[base + 2];
    const eta = shape === 'pseudovoigt' ? params[base + 3] : undefined;

    // FWHM conversion
    let fwhm: number;
    if (shape === 'gaussian') {
      fwhm = 2.3548 * width;
    } else if (shape === 'lorentzian') {
      fwhm = 2 * width;
    } else {
      // Pseudo-Voigt: approximate FWHM
      fwhm = 2.3548 * width * (1 - eta!) + 2 * width * eta!;
    }

    // Area via analytical integration
    let area: number;
    if (shape === 'gaussian') {
      area = amp * width * Math.sqrt(2 * Math.PI);
    } else if (shape === 'lorentzian') {
      area = amp * Math.PI * width;
    } else {
      const gArea = amp * width * Math.sqrt(2 * Math.PI);
      const lArea = amp * Math.PI * width;
      area = (1 - eta!) * gArea + eta! * lArea;
    }

    fittedPeaks.push({
      amplitude: amp,
      center,
      width,
      eta,
      area,
      fwhm,
      rSquared: 0, // per-peak R² not meaningful; computed below if needed
    });
  }

  const finalBgCoeffs = params.slice(nPeaks * ppp);

  // --- Compute fitted curves on evaluation grid ---
  const xMin = x[0];
  const xMax = x[n - 1];
  const nGrid = Math.max(100, n);
  const fittedX: number[] = [];
  const fittedY: number[] = [];
  const backgroundY: number[] = [];
  const peakY: number[][] = fittedPeaks.map(() => []);

  for (let i = 0; i < nGrid; i++) {
    const xi = xMin + (xMax - xMin) * i / (nGrid - 1);
    fittedX.push(xi);

    let bgVal = 0;
    for (let b = 0; b < finalBgCoeffs.length; b++) {
      bgVal += finalBgCoeffs[b] * Math.pow(xi, finalBgCoeffs.length - 1 - b);
    }
    backgroundY.push(bgVal);

    let totalY = bgVal;
    for (let k = 0; k < fittedPeaks.length; k++) {
      const pk = fittedPeaks[k];
      const py = evalPeak(xi, pk.amplitude, pk.center, pk.width, pk.eta, shape);
      peakY[k].push(py);
      totalY += py;
    }
    fittedY.push(totalY);
  }

  // --- Statistics ---
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  let sst = 0;
  for (let i = 0; i < n; i++) sst += (y[i] - yMean) * (y[i] - yMean);
  const sse = bestSSE;
  const rSquared = sst === 0 ? 1 : 1 - sse / sst;
  const p = totalParams;
  const adjustedRSquared = n > p ? 1 - ((1 - rSquared) * (n - 1)) / (n - p) : rSquared;
  const rmse = Math.sqrt(sse / n);

  return {
    peaks: fittedPeaks,
    background: finalBgCoeffs,
    backgroundType,
    rSquared,
    adjustedRSquared,
    rmse,
    n,
    p,
    fittedX,
    fittedY,
    backgroundY,
    peakY,
  };
}

/** Format a peak parameter for display. */
export function fmtPeak(v: number, digits = 4): string {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-4 && v !== 0)) return v.toExponential(digits);
  return v.toFixed(digits);
}
