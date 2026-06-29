// Client wrapper for the curve-fitting Web Worker.
// Falls back to synchronous execution if Workers are unavailable.

import type { FitRequest, FitResponse, FitType } from '@/workers/fitWorker';
import type { FitStatistics } from '@/utils/curveFitting';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (v: FitResponse) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === 'undefined') return null;
  try {
    worker = new Worker(new URL('../workers/fitWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<FitResponse>) => {
      const data = e.data;
      const cb = pending.get(data.id);
      if (cb) {
        pending.delete(data.id);
        cb.resolve(data);
      }
    };
    worker.onerror = (e) => {
      // Reject all pending requests on fatal worker error
      for (const [, cb] of pending) cb.reject(new Error(e.message || 'Worker error'));
      pending.clear();
    };
    return worker;
  } catch {
    return null;
  }
}

export interface FitWorkerResult {
  equation: string;
  fittedX: number[];
  fittedY: number[];
  stats: FitStatistics;
}

/**
 * Run a curve fit in a Web Worker. Falls back to synchronous execution
 * (via dynamic import) if Workers are unavailable.
 */
export async function runFit(
  type: FitType,
  x: number[],
  y: number[],
  weights?: number[],
): Promise<FitWorkerResult> {
  const w = getWorker();
  if (!w) {
    // Fallback: run in main thread
    return runFitSync(type, x, y, weights);
  }
  const id = nextId++;
  const req: FitRequest = { id, type, x, y, weights };
  return new Promise<FitWorkerResult>((resolve, reject) => {
    pending.set(id, {
      resolve: (res: FitResponse) => {
        if (res.success) {
          resolve({ equation: res.equation, fittedX: res.fittedX, fittedY: res.fittedY, stats: res.stats });
        } else {
          reject(new Error(res.error));
        }
      },
      reject,
    });
    w.postMessage(req);
  });
}

// Synchronous fallback that mirrors the worker's buildEquationAndFittedFn.
// Only used when Workers are unavailable.
async function runFitSync(
  type: FitType,
  x: number[],
  y: number[],
  weights?: number[],
): Promise<FitWorkerResult> {
  const {
    linearFit, polynomialFit, exponentialFit, logarithmicFit,
    powerFit, gaussianFit, logisticFit, generateFittedValues,
  } = await import('@/utils/curveFitting');

  const xMin = Math.min(...x);
  const xMax = Math.max(...x);
  let equation = '';
  let fittedFn: ((v: number) => number) | null = null;
  let stats: FitStatistics | null = null;

  if (type === 'linear') {
    const r = linearFit(x, y, weights ? { weights } : undefined);
    if (!r || !r.stats) throw new Error('FitFailed');
    stats = r.stats;
    const sign = r.intercept >= 0 ? '+' : '-';
    equation = `y = ${r.slope.toFixed(4)}x ${sign} ${Math.abs(r.intercept).toFixed(4)}`;
    fittedFn = (v: number) => r.slope * v + r.intercept;
  } else if (type === 'exponential') {
    const r = exponentialFit(x, y);
    if (!r || !r.stats) throw new Error('FitFailed');
    stats = r.stats;
    equation = `y = ${r.a.toFixed(4)} * e^(${r.b.toFixed(4)}x)`;
    fittedFn = (v: number) => r.a * Math.exp(r.b * v);
  } else if (type === 'logarithmic') {
    const r = logarithmicFit(x, y);
    if (!r || !r.stats) throw new Error('FitFailed');
    stats = r.stats;
    const sign = r.a >= 0 ? '+' : '-';
    equation = `y = ${Math.abs(r.a).toFixed(4)} ${sign} ${r.b.toFixed(4)}*ln(x)`;
    fittedFn = (v: number) => r.a + r.b * Math.log(v);
  } else if (type === 'power') {
    const r = powerFit(x, y);
    if (!r || !r.stats) throw new Error('FitFailed');
    stats = r.stats;
    equation = `y = ${r.a.toFixed(4)} * x^${r.b.toFixed(4)}`;
    fittedFn = (v: number) => r.a * Math.pow(v, r.b);
  } else if (type === 'gaussian') {
    const r = gaussianFit(x, y);
    if (!r || !r.stats) throw new Error('FitFailed');
    stats = r.stats;
    equation = `y = ${r.amplitude.toFixed(4)} * exp(-((x - ${r.center.toFixed(4)})² / (2*${r.sigma.toFixed(4)}²)))`;
    const { amplitude, center, sigma } = r;
    fittedFn = (v: number) => {
      const dv = v - center;
      return amplitude * Math.exp(-(dv * dv) / (2 * sigma * sigma));
    };
  } else if (type === 'logistic') {
    const r = logisticFit(x, y);
    if (!r || !r.stats) throw new Error('FitFailed');
    stats = r.stats;
    equation = `y = ${r.L.toFixed(4)} / (1 + exp(-${r.k.toFixed(4)}*(x - ${r.x0.toFixed(4)})))`;
    const { L, k, x0 } = r;
    fittedFn = (v: number) => L / (1 + Math.exp(-k * (v - x0)));
  } else if (type.startsWith('poly')) {
    const degree = parseInt(type.replace('poly', ''));
    const r = polynomialFit(x, y, degree, weights ? { weights } : undefined);
    if (!r || !r.stats) throw new Error('FitFailed');
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

  if (!stats || !fittedFn) throw new Error('FitFailed');
  const fitted = generateFittedValues(fittedFn, xMin, xMax, 100);
  return { equation, fittedX: fitted.x, fittedY: fitted.y, stats };
}
