// Web Worker for curve fitting computations.
// Moves heavy fitting (polynomial QR decomposition, Gauss-Newton iterations)
// off the main thread to keep UI responsive.

import {
  linearFit,
  polynomialFit,
  exponentialFit,
  logarithmicFit,
  powerFit,
  gaussianFit,
  logisticFit,
  generateFittedValues,
  type FitStatistics,
} from '../utils/curveFitting';

export type FitType =
  | 'linear'
  | 'poly2'
  | 'poly3'
  | 'poly4'
  | 'poly5'
  | 'poly6'
  | 'exponential'
  | 'logarithmic'
  | 'power'
  | 'gaussian'
  | 'logistic';

export interface FitRequest {
  id: number;
  type: FitType;
  x: number[];
  y: number[];
}

export interface FitSuccessResponse {
  id: number;
  success: true;
  equation: string;
  fittedX: number[];
  fittedY: number[];
  stats: FitStatistics;
}

export interface FitErrorResponse {
  id: number;
  success: false;
  error: string;
}

export type FitResponse = FitSuccessResponse | FitErrorResponse;

function buildEquationAndFittedFn(
  type: FitType,
  x: number[],
  y: number[],
): { equation: string; fittedX: number[]; fittedY: number[]; stats: FitStatistics } | null {
  const xMin = Math.min(...x);
  const xMax = Math.max(...x);

  let equation = '';
  let fittedFn: ((x: number) => number) | null = null;
  let stats: FitStatistics | null = null;

  if (type === 'linear') {
    const r = linearFit(x, y);
    if (!r || !r.stats) return null;
    stats = r.stats;
    const sign = r.intercept >= 0 ? '+' : '-';
    equation = `y = ${r.slope.toFixed(4)}x ${sign} ${Math.abs(r.intercept).toFixed(4)}`;
    fittedFn = (v: number) => r.slope * v + r.intercept;
  } else if (type === 'exponential') {
    const r = exponentialFit(x, y);
    if (!r || !r.stats) return null;
    stats = r.stats;
    equation = `y = ${r.a.toFixed(4)} * e^(${r.b.toFixed(4)}x)`;
    fittedFn = (v: number) => r.a * Math.exp(r.b * v);
  } else if (type === 'logarithmic') {
    const r = logarithmicFit(x, y);
    if (!r || !r.stats) return null;
    stats = r.stats;
    const sign = r.a >= 0 ? '+' : '-';
    equation = `y = ${Math.abs(r.a).toFixed(4)} ${sign} ${r.b.toFixed(4)}*ln(x)`;
    fittedFn = (v: number) => r.a + r.b * Math.log(v);
  } else if (type === 'power') {
    const r = powerFit(x, y);
    if (!r || !r.stats) return null;
    stats = r.stats;
    equation = `y = ${r.a.toFixed(4)} * x^${r.b.toFixed(4)}`;
    fittedFn = (v: number) => r.a * Math.pow(v, r.b);
  } else if (type === 'gaussian') {
    const r = gaussianFit(x, y);
    if (!r || !r.stats) return null;
    stats = r.stats;
    equation = `y = ${r.amplitude.toFixed(4)} * exp(-((x - ${r.center.toFixed(4)})² / (2*${r.sigma.toFixed(4)}²)))`;
    const { amplitude, center, sigma } = r;
    fittedFn = (v: number) => {
      const dv = v - center;
      return amplitude * Math.exp(-(dv * dv) / (2 * sigma * sigma));
    };
  } else if (type === 'logistic') {
    const r = logisticFit(x, y);
    if (!r || !r.stats) return null;
    stats = r.stats;
    equation = `y = ${r.L.toFixed(4)} / (1 + exp(-${r.k.toFixed(4)}*(x - ${r.x0.toFixed(4)})))`;
    const { L, k, x0 } = r;
    fittedFn = (v: number) => L / (1 + Math.exp(-k * (v - x0)));
  } else if (type.startsWith('poly')) {
    const degree = parseInt(type.replace('poly', ''));
    const r = polynomialFit(x, y, degree);
    if (!r || !r.stats) return null;
    stats = r.stats;
    const terms = r.coefficients.map((c, i) => {
      const exp = degree - i;
      if (exp === 0) return c.toFixed(4);
      if (exp === 1) return `${c.toFixed(4)}x`;
      return `${c.toFixed(4)}x^${exp}`;
    });
    equation = `y = ${terms.join(' + ').replace(/\+ -/g, '- ')}`;
    const coeffsLowToHigh = [...r.coefficients].reverse();
    fittedFn = (v: number) => {
      let out = 0;
      for (let j = 0; j < coeffsLowToHigh.length; j++) {
        out += coeffsLowToHigh[j] * Math.pow(v, j);
      }
      return out;
    };
  }

  if (!stats || !fittedFn) return null;

  const fitted = generateFittedValues(fittedFn, xMin, xMax, 100);
  return { equation, fittedX: fitted.x, fittedY: fitted.y, stats };
}

self.onmessage = (e: MessageEvent<FitRequest>) => {
  const req = e.data;
  try {
    const result = buildEquationAndFittedFn(req.type, req.x, req.y);
    if (!result) {
      const err: FitErrorResponse = { id: req.id, success: false, error: 'FitFailed' };
      self.postMessage(err);
      return;
    }
    const res: FitSuccessResponse = {
      id: req.id,
      success: true,
      equation: result.equation,
      fittedX: result.fittedX,
      fittedY: result.fittedY,
      stats: result.stats,
    };
    self.postMessage(res);
  } catch (err) {
    const res: FitErrorResponse = {
      id: req.id,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(res);
  }
};
