import { describe, it, expect } from 'vitest';
import { computePredictionBand, type ConfidenceBand } from './curveFitting';

describe('computePredictionBand — linear', () => {
  it('returns narrowest band at x̄ for noisy fit', () => {
    const x = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const y = x.map((xi, i) => 2 * xi + 1 + (i % 2 === 0 ? 0.1 : -0.1));
    const band = computePredictionBand('linear', { x, y }, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 0.05);
    expect(band).not.toBeNull();
    const xMean = 4.5;
    let idxMean = 0;
    let minDist = Infinity;
    for (let i = 0; i < band!.x.length; i++) {
      const d = Math.abs(band!.x[i] - xMean);
      if (d < minDist) {
        minDist = d;
        idxMean = i;
      }
    }
    const halfWidthAtMean = band!.upper[idxMean] - band!.lower[idxMean];
    const halfWidthAtEdge = band!.upper[0] - band!.lower[0];
    expect(halfWidthAtEdge).toBeGreaterThan(halfWidthAtMean);
  });

  it('zero half-width for perfect linear fit (SSE=0)', () => {
    const x = [0, 1, 2, 3, 4];
    const y = x.map((xi) => 2 * xi + 1);
    const band = computePredictionBand('linear', { x, y }, [0, 1, 2, 3, 4], 0.05);
    expect(band).not.toBeNull();
    for (let i = 0; i < x.length; i++) {
      expect(band!.upper[i]).toBeCloseTo(y[i], 6);
      expect(band!.lower[i]).toBeCloseTo(y[i], 6);
    }
  });

  it('returns null when too few points', () => {
    const band = computePredictionBand('linear', { x: [1], y: [2] }, [1, 2], 0.05);
    expect(band).toBeNull();
  });

  it('returns null for unsupported fit types', () => {
    const x = [0, 1, 2, 3, 4];
    const y = x.map((xi) => Math.exp(xi));
    // @ts-expect-error: 'exponential' is intentionally not in PredictionBandType (v1)
    const band = computePredictionBand('exponential', { x, y }, x, 0.05);
    expect(band).toBeNull();
  });
});

describe('computePredictionBand — polynomial (with degree)', () => {
  it('uses covariance matrix for prediction variance (degree 2, perfect fit)', () => {
    const x = [-2, -1, 0, 1, 2, 3, 4];
    const y = x.map((xi) => xi * xi);
    // Pass degree=2 explicitly
    const band = computePredictionBand('polynomial', { x, y, degree: 2 }, x, 0.05);
    expect(band).not.toBeNull();
    // Perfect quadratic → SSE = 0 → band has zero half-width
    for (let i = 0; i < x.length; i++) {
      expect(band!.upper[i]).toBeCloseTo(y[i], 6);
      expect(band!.lower[i]).toBeCloseTo(y[i], 6);
    }
  });

  it('non-zero half-width for noisy polynomial fit', () => {
    const x = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const y = x.map((xi) => xi * xi + (xi % 2 === 0 ? 0.5 : -0.5));
    const band = computePredictionBand('polynomial', { x, y, degree: 2 }, x, 0.05);
    expect(band).not.toBeNull();
    for (let i = 0; i < x.length; i++) {
      expect(band!.upper[i]).toBeGreaterThan(band!.lower[i]);
    }
  });

  it('degree=1 produces non-zero band for noisy linear-like data', () => {
    const x = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const y = x.map((xi, i) => 2 * xi + 1 + (i % 2 === 0 ? 0.1 : -0.1));
    const poly = computePredictionBand('polynomial', { x, y, degree: 1 }, x, 0.05);
    expect(poly).not.toBeNull();
    for (let i = 0; i < x.length; i++) {
      expect(poly!.upper[i]).toBeGreaterThan(poly!.lower[i]);
      // Upper > fitted, lower < fitted (since fitted line passes through middle)
      const yHat = 2 * x[i] + 1;
      expect(poly!.upper[i]).toBeGreaterThan(yHat);
      expect(poly!.lower[i]).toBeLessThan(yHat);
    }
  });
});

describe('ConfidenceBand shape', () => {
  it('has matching-length arrays', () => {
    const x = [0, 1, 2, 3, 4, 5];
    const y = x.map((xi) => 2 * xi + 1 + (xi % 2 === 0 ? 0.05 : -0.05));
    const band = computePredictionBand('linear', { x, y }, x, 0.05) as ConfidenceBand;
    expect(band.x).toHaveLength(x.length);
    expect(band.upper).toHaveLength(x.length);
    expect(band.lower).toHaveLength(x.length);
    for (let i = 0; i < band.x.length; i++) {
      expect(band.upper[i]).toBeGreaterThan(band.lower[i]);
    }
  });
});