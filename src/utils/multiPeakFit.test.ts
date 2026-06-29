import { describe, it, expect } from 'vitest';
import { multiPeakFit, fmtPeak } from './multiPeakFit';

describe('multiPeakFit — gaussian single peak', () => {
  it('fits a single Gaussian peak with provided initial params', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 60; i++) {
      x.push(i);
      y.push(10 * Math.exp(-Math.pow(i - 30, 2) / (2 * 5 * 5)));
    }
    const result = multiPeakFit(
      x,
      y,
      [{ amplitude: 10, center: 30, width: 5 }],
      { shape: 'gaussian', backgroundType: 'linear' },
    );
    expect(result).not.toBeNull();
    expect(result!.peaks).toHaveLength(1);
    expect(result!.peaks[0].center).toBeCloseTo(30, 0);
    expect(result!.peaks[0].amplitude).toBeGreaterThan(5);
    expect(result!.rSquared).toBeGreaterThan(0.99);
  });

  it('computes FWHM and area for gaussian peak', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 60; i++) {
      x.push(i);
      y.push(10 * Math.exp(-Math.pow(i - 30, 2) / (2 * 5 * 5)));
    }
    const result = multiPeakFit(
      x,
      y,
      [{ amplitude: 10, center: 30, width: 5 }],
      { shape: 'gaussian', backgroundType: 'linear' },
    );
    expect(result).not.toBeNull();
    // FWHM = 2.3548 * width ≈ 11.77 for width ≈ 5
    expect(result!.peaks[0].fwhm).toBeGreaterThan(8);
    expect(result!.peaks[0].fwhm).toBeLessThan(15);
    expect(result!.peaks[0].area).toBeGreaterThan(0);
  });

  it('returns fitted curves on evaluation grid', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 60; i++) {
      x.push(i);
      y.push(10 * Math.exp(-Math.pow(i - 30, 2) / (2 * 5 * 5)));
    }
    const result = multiPeakFit(
      x,
      y,
      [{ amplitude: 10, center: 30, width: 5 }],
      { shape: 'gaussian', backgroundType: 'linear' },
    );
    expect(result).not.toBeNull();
    expect(result!.fittedX.length).toBeGreaterThan(0);
    expect(result!.fittedX.length).toBe(result!.fittedY.length);
    expect(result!.fittedX.length).toBe(result!.backgroundY.length);
    expect(result!.peakY[0].length).toBe(result!.fittedX.length);
  });
});

describe('multiPeakFit — boundary conditions', () => {
  it('returns null for fewer than 3 points', () => {
    const result = multiPeakFit(
      [1, 2],
      [1, 2],
      [{ amplitude: 1, center: 1.5, width: 0.5 }],
      { shape: 'gaussian', backgroundType: 'linear' },
    );
    expect(result).toBeNull();
  });

  it('auto-detects peaks when none provided', () => {
    // Multi-peak data: two well-separated Gaussians
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 100; i++) {
      x.push(i);
      const v1 = 10 * Math.exp(-Math.pow(i - 25, 2) / (2 * 3 * 3));
      const v2 = 8 * Math.exp(-Math.pow(i - 70, 2) / (2 * 4 * 4));
      y.push(v1 + v2);
    }
    const result = multiPeakFit(x, y, undefined, { shape: 'gaussian', backgroundType: 'linear' });
    expect(result).not.toBeNull();
    expect(result!.peaks.length).toBeGreaterThanOrEqual(1);
  });

  it('respects lorentzian shape', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 80; i++) {
      x.push(i);
      // Lorentzian: A * sigma^2 / ((x - center)^2 + sigma^2)
      const s = 5;
      const c = 40;
      y.push(10 * (s * s) / (Math.pow(i - c, 2) + s * s));
    }
    const result = multiPeakFit(
      x,
      y,
      [{ amplitude: 10, center: 40, width: 5 }],
      { shape: 'lorentzian', backgroundType: 'linear' },
    );
    expect(result).not.toBeNull();
    expect(result!.peaks[0].center).toBeCloseTo(40, 0);
    expect(result!.rSquared).toBeGreaterThan(0.95);
  });

  it('handles pseudovoigt shape with eta parameter', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 80; i++) {
      x.push(i);
      const s = 5;
      const c = 40;
      const g = 10 * Math.exp(-Math.pow(i - c, 2) / (2 * s * s));
      const l = 10 * (s * s) / (Math.pow(i - c, 2) + s * s);
      // Half gaussian, half lorentzian
      y.push(0.5 * g + 0.5 * l);
    }
    const result = multiPeakFit(
      x,
      y,
      [{ amplitude: 10, center: 40, width: 5, eta: 0.5 }],
      { shape: 'pseudovoigt', backgroundType: 'linear' },
    );
    expect(result).not.toBeNull();
    expect(result!.peaks[0].eta).toBeDefined();
    expect(result!.peaks[0].eta).toBeGreaterThanOrEqual(0);
    expect(result!.peaks[0].eta).toBeLessThanOrEqual(1);
  });

  it('handles background polynomial option', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 60; i++) {
      x.push(i);
      const peak = 10 * Math.exp(-Math.pow(i - 30, 2) / (2 * 5 * 5));
      const bg = 0.05 * i + 1;
      y.push(peak + bg);
    }
    const result = multiPeakFit(
      x,
      y,
      [{ amplitude: 10, center: 30, width: 5 }],
      { shape: 'gaussian', backgroundType: 'linear' },
    );
    expect(result).not.toBeNull();
    expect(result!.backgroundType).toBe('linear');
    expect(result!.background.length).toBeGreaterThan(0);
  });

  it('handles no-background option (default)', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 60; i++) {
      x.push(i);
      y.push(10 * Math.exp(-Math.pow(i - 30, 2) / (2 * 5 * 5)));
    }
    const result = multiPeakFit(
      x,
      y,
      [{ amplitude: 10, center: 30, width: 5 }],
      { shape: 'gaussian', backgroundType: 'none' },
    );
    expect(result).not.toBeNull();
    expect(result!.background).toHaveLength(0);
  });

  it('handles polynomial background option', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 80; i++) {
      x.push(i);
      const peak = 10 * Math.exp(-Math.pow(i - 40, 2) / (2 * 5 * 5));
      // Quadratic background
      const bg = 0.001 * i * i + 0.5;
      y.push(peak + bg);
    }
    const result = multiPeakFit(
      x,
      y,
      [{ amplitude: 10, center: 40, width: 5 }],
      { shape: 'gaussian', backgroundType: 'polynomial', backgroundDegree: 2 },
    );
    expect(result).not.toBeNull();
    expect(result!.backgroundType).toBe('polynomial');
  });

  it('clamps pseudovoigt eta to [0, 1] during optimization', () => {
    // Set eta way out of range; optimizer should clamp
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 80; i++) {
      x.push(i);
      const s = 5;
      const c = 40;
      const g = 10 * Math.exp(-Math.pow(i - c, 2) / (2 * s * s));
      y.push(g);
    }
    const result = multiPeakFit(
      x,
      y,
      [{ amplitude: 10, center: 40, width: 5, eta: 5.0 }],
      { shape: 'pseudovoigt', backgroundType: 'linear', maxIterations: 50 },
    );
    expect(result).not.toBeNull();
    // Eta should be clamped to [0, 1] regardless of starting value
    expect(result!.peaks[0].eta).toBeGreaterThanOrEqual(0);
    expect(result!.peaks[0].eta).toBeLessThanOrEqual(1);
  });

  it('handles constant y (sst=0 → rSquared=1)', () => {
    const x = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const y = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
    const result = multiPeakFit(
      x,
      y,
      [{ amplitude: 5, center: 4.5, width: 1 }],
      { shape: 'gaussian', backgroundType: 'linear' },
    );
    expect(result).not.toBeNull();
    expect(result!.rSquared).toBe(1);
  });

  it('uses adjustedRSquared = rSquared when n ≤ p (else branch)', () => {
    // With polynomial background of degree 2, we have amp+center+width + 3 bg coeffs = 6 params
    // For n=6 data points, n === p → adjusted = rSquared (else branch)
    const x = [0, 1, 2, 3, 4, 5];
    const y = [10, 8, 6, 4, 3, 5];
    const result = multiPeakFit(
      x,
      y,
      [{ amplitude: 5, center: 2.5, width: 2 }],
      { shape: 'gaussian', backgroundType: 'polynomial', backgroundDegree: 2 },
    );
    expect(result).not.toBeNull();
    // Adjusted R² falls back to R² when n ≤ p
    expect(result!.adjustedRSquared).toBe(result!.rSquared);
  });

  it('returns null when auto-detection finds no peaks (flat data)', () => {
    // Pure flat data → detectPeaks returns 0 peaks → returns null
    const x = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const y = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
    const result = multiPeakFit(x, y, undefined, { shape: 'gaussian', backgroundType: 'linear' });
    expect(result).toBeNull();
  });
});

describe('fmtPeak', () => {
  it('formats normal values to 4 decimal places', () => {
    expect(fmtPeak(1.234567)).toBe('1.2346');
  });

  it('returns — for non-finite values', () => {
    expect(fmtPeak(NaN)).toBe('—');
    expect(fmtPeak(Infinity)).toBe('—');
  });

  it('uses exponential for very small or large values', () => {
    expect(fmtPeak(1e-10)).toMatch(/e-/);
    expect(fmtPeak(1e10)).toMatch(/e\+/);
  });

  it('respects custom digits parameter', () => {
    expect(fmtPeak(1.234567, 2)).toBe('1.23');
  });
});