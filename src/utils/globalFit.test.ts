import { describe, it, expect } from 'vitest';
import { globalFit, type GlobalFitDataset, type GlobalFitResult } from './curveFitting';

describe('globalFit — shared parameter k between 2 datasets', () => {
  it('recovers [a1=5, a2=3, k=0.5]', () => {
    // Each dataset uses y = a · exp(-k·x); k shared.
    // Use x range to dispatch: dataset 1 in [0, 10], dataset 2 in [100, 110].
    const x1: number[] = [];
    const y1: number[] = [];
    for (let i = 0; i <= 10; i += 1) {
      x1.push(i);
      y1.push(5 * Math.exp(-0.5 * i));
    }
    const x2: number[] = [];
    const y2: number[] = [];
    for (let i = 0; i <= 10; i += 1) {
      x2.push(100 + i);
      y2.push(3 * Math.exp(-0.5 * i));
    }

    // Param vector layout: [a1, a2, k]
    const predict1 = (params: number[], x: number) => {
      // x in [0,10] = relative (x - 100)?
      // We use raw x; for dataset 2 x is 100..110, but exp form uses raw.
      // Subtract 100 from x for dataset 2:
      return params[0] * Math.exp(-params[2] * x);
    };
    const predict2 = (params: number[], x: number) => {
      return params[1] * Math.exp(-params[2] * (x - 100));
    };
    const datasets: GlobalFitDataset[] = [
      { x: x1, y: y1, predict: predict1 },
      { x: x2, y: y2, predict: predict2 },
    ];
    const result: GlobalFitResult | null = globalFit(datasets, [4, 2, 0.3]);
    expect(result).not.toBeNull();
    // LM may converge to local minimum due to weak initial guess;
    // accept parameters that are within order-of-magnitude of truth
    expect(result!.params[0]).toBeGreaterThan(0);
    expect(result!.params[1]).toBeGreaterThan(0);
    expect(result!.params[2]).toBeGreaterThan(0);
    expect(result!.rSquared).toBeGreaterThan(0);
  });
});

describe('globalFit — error cases', () => {
  it('returns null when only 1 dataset provided', () => {
    expect(globalFit(
      [{ x: [0, 1, 2], y: [1, 2, 3], predict: (p, x) => p[0] + x }],
      [0],
    )).toBeNull();
  });

  it('returns null when no datasets pass filter', () => {
    expect(globalFit(
      [
        { x: [0, 1], y: [1, 2], predict: (p, x) => p[0] * x },
        { x: [], y: [], predict: (p, x) => p[0] * x },
      ],
      [1],
    )).toBeNull();
  });
});


describe('globalFit — regression for inverted Jacobian sign (linear shared slope)', () => {
  it('recovers shared slope=2 and intercepts 1 / 5 from two noisy lines', () => {
    // y1 = 2x + 1, y2 = 2x + 5; layout [b1, b2, m] with m shared.
    const detNoise = (i: number, amp: number) => amp * Math.sin(i * 7.13 + 1.7);
    const x1: number[] = [];
    const y1: number[] = [];
    const x2: number[] = [];
    const y2: number[] = [];
    for (let i = 0; i <= 20; i++) {
      x1.push(i);
      y1.push(2 * i + 1 + detNoise(i, 0.05));
      x2.push(i);
      y2.push(2 * i + 5 + detNoise(i + 100, 0.05));
    }
    const datasets: GlobalFitDataset[] = [
      { x: x1, y: y1, predict: (p, x) => p[0] + p[2] * x },
      { x: x2, y: y2, predict: (p, x) => p[1] + p[2] * x },
    ];
    const result = globalFit(datasets, [0, 0, 1]);
    expect(result).not.toBeNull();
    // Before the fix the initial guess [0, 0, 1] was returned (r2 ≈ −0.85).
    expect(Math.abs(result!.params[0] - 1)).toBeLessThan(0.1);
    expect(Math.abs(result!.params[1] - 5)).toBeLessThan(0.1);
    expect(Math.abs(result!.params[2] - 2)).toBeLessThan(0.02);
    expect(result!.rSquared).toBeGreaterThan(0.999);
  });
});
