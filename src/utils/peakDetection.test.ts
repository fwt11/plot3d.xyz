import { describe, it, expect } from 'vitest';
import { detectPeaks, estimateInitialPeaks } from './peakDetection';

/** Build a sum of Gaussians on an integer grid 0..n-1. */
function gaussianMixture(
  n: number,
  peaks: Array<{ amplitude: number; center: number; sigma: number }>,
): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    x.push(i);
    let v = 0;
    for (const p of peaks) {
      v += p.amplitude * Math.exp(-((i - p.center) ** 2) / (2 * p.sigma * p.sigma));
    }
    y.push(v);
  }
  return { x, y };
}

describe('detectPeaks', () => {
  it('detects a single isolated peak', () => {
    const { x, y } = gaussianMixture(100, [{ amplitude: 10, center: 50, sigma: 5 }]);
    const peaks = detectPeaks(x, y);
    expect(peaks).toHaveLength(1);
    expect(peaks[0].index).toBe(50);
    expect(peaks[0].y).toBeCloseTo(10, 5);
  });

  it('detects both peaks when a taller peak shadows a shorter one', () => {
    // Regression: prominence used to reset to 0 when the outward walk hit a
    // higher peak, so only the global maximum survived.
    // scipy.signal.find_peaks(y, prominence=0.5) → [50, 140] with
    // prominences [10, 4].
    const { x, y } = gaussianMixture(200, [
      { amplitude: 10, center: 50, sigma: 5 },
      { amplitude: 4, center: 140, sigma: 6 },
    ]);
    const peaks = detectPeaks(x, y);
    expect(peaks).toHaveLength(2);
    expect(peaks.map((p) => p.index)).toEqual([50, 140]);
    expect(peaks[0].y).toBeCloseTo(10, 5);
    expect(peaks[1].y).toBeCloseTo(4, 1);
  });

  it('detects all three peaks with the tallest in the middle', () => {
    const { x, y } = gaussianMixture(220, [
      { amplitude: 5, center: 30, sigma: 4 },
      { amplitude: 10, center: 110, sigma: 5 },
      { amplitude: 6, center: 190, sigma: 4 },
    ]);
    const peaks = detectPeaks(x, y);
    expect(peaks).toHaveLength(3);
    expect(peaks.map((p) => p.index)).toEqual([30, 110, 190]);
  });

  it('honors minProminence to reject the shorter peak', () => {
    const { x, y } = gaussianMixture(200, [
      { amplitude: 10, center: 50, sigma: 5 },
      { amplitude: 4, center: 140, sigma: 6 },
    ]);
    const peaks = detectPeaks(x, y, 5); // shorter peak has prominence 4
    expect(peaks).toHaveLength(1);
    expect(peaks[0].index).toBe(50);
  });

  it('returns no peaks for flat data', () => {
    const x = [0, 1, 2, 3, 4, 5];
    const y = [5, 5, 5, 5, 5, 5];
    expect(detectPeaks(x, y)).toEqual([]);
  });

  it('returns no peaks for fewer than 3 points', () => {
    expect(detectPeaks([0, 1], [1, 2])).toEqual([]);
  });

  it('reports a positive FWHM for each peak', () => {
    const { x, y } = gaussianMixture(200, [
      { amplitude: 10, center: 50, sigma: 5 },
      { amplitude: 4, center: 140, sigma: 6 },
    ]);
    const peaks = detectPeaks(x, y);
    for (const p of peaks) {
      expect(p.fwhm).toBeGreaterThan(0);
    }
    // FWHM of a Gaussian ≈ 2.3548σ
    expect(peaks[0].fwhm).toBeGreaterThan(8);
    expect(peaks[0].fwhm).toBeLessThan(16);
  });
});

describe('estimateInitialPeaks', () => {
  it('converts FWHM to shape-specific widths', () => {
    const { x, y } = gaussianMixture(100, [{ amplitude: 10, center: 50, sigma: 5 }]);
    const peaks = detectPeaks(x, y);
    const gauss = estimateInitialPeaks(peaks, 'gaussian');
    expect(gauss).toHaveLength(1);
    expect(gauss[0].center).toBe(50);
    expect(gauss[0].amplitude).toBeCloseTo(10, 5);
    expect(gauss[0].width).toBeGreaterThan(3);
    expect(gauss[0].width).toBeLessThan(7);
    const lorentz = estimateInitialPeaks(peaks, 'lorentzian');
    expect(lorentz[0].width).toBeCloseTo(gauss[0].width * (2.3548 / 2), 5);
    const pv = estimateInitialPeaks(peaks, 'pseudovoigt');
    expect(pv[0].eta).toBe(0.5);
  });
});
