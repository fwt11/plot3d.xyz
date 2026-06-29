import { describe, it, expect } from 'vitest';
import { linearFit, polynomialFit } from './curveFitting';

describe('linearFit with weights', () => {
  it('uniform weights equal unweighted fit', () => {
    const x = [0, 1, 2, 3, 4];
    const y = [1, 3, 5, 7, 9];
    const r1 = linearFit(x, y);
    const r2 = linearFit(x, y, { weights: [1, 1, 1, 1, 1] });
    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    expect(r2!.slope).toBeCloseTo(r1!.slope, 10);
    expect(r2!.intercept).toBeCloseTo(r1!.intercept, 10);
  });

  it('heavy weight on point pulls fit toward it', () => {
    // y = 2x + 1 mostly, but one outlier at x=2 with low weight should be down-weighted
    const x = [0, 1, 2, 3, 4];
    const y = [1, 3, 100, 7, 9]; // outlier at i=2
    const w = [1, 1, 0.001, 1, 1]; // near-zero weight on outlier
    const result = linearFit(x, y, { weights: w });
    expect(result).not.toBeNull();
    // Without outlier the fit would be slope=2; WLS should recover near it
    expect(result!.slope).toBeCloseTo(2, 1);
    expect(result!.intercept).toBeCloseTo(1, 1);
  });

  it('zero weight excludes point entirely', () => {
    const x = [0, 1, 2, 3, 4];
    const y = [1, 3, 100, 7, 9];
    const r1 = linearFit(x, y, { weights: [1, 1, 0, 1, 1] });
    const r2 = linearFit([0, 1, 3, 4], [1, 3, 7, 9]);
    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    expect(r1!.slope).toBeCloseTo(r2!.slope, 10);
    expect(r1!.intercept).toBeCloseTo(r2!.intercept, 10);
  });

  it('ignores extra weights if length mismatches', () => {
    const x = [0, 1, 2, 3, 4];
    const y = [1, 3, 5, 7, 9];
    // Weights array shorter than x → fall back to unweighted
    const r1 = linearFit(x, y);
    const r2 = linearFit(x, y, { weights: [1, 1] });
    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    expect(r2!.slope).toBeCloseTo(r1!.slope, 10);
  });

  it('returns null for too few data (after weight filter)', () => {
    // All weights zero → 0 effective points
    const x = [0, 1, 2];
    const y = [1, 3, 5];
    const result = linearFit(x, y, { weights: [0, 0, 0] });
    expect(result).toBeNull();
  });

  it('handles length-1 case gracefully', () => {
    const result = linearFit([1], [2], { weights: [1] });
    expect(result).toBeNull();
  });
});

describe('polynomialFit with weights (degree 1)', () => {
  it('weighted poly1 equals weighted linearFit', () => {
    const x = [0, 1, 2, 3, 4];
    const y = [1, 3, 5, 7, 9];
    const w = [1, 0.5, 2, 0.5, 1];
    const lin = linearFit(x, y, { weights: w });
    const poly = polynomialFit(x, y, 1, { weights: w });
    expect(lin).not.toBeNull();
    expect(poly).not.toBeNull();
    // poly coefficients are in highest-degree-first order: [slope, intercept]
    expect(poly!.coefficients[0]).toBeCloseTo(lin!.slope, 8);
    expect(poly!.coefficients[1]).toBeCloseTo(lin!.intercept, 8);
  });
});
