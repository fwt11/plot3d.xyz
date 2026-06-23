// Peak detection algorithms for spectral data (XRD, Raman, IR, XPS, PL).
// Pure functions operating on number arrays.

/** A detected peak candidate. */
export interface DetectedPeak {
  /** Index in the input array. */
  index: number;
  /** X position. */
  x: number;
  /** Y value (intensity). */
  y: number;
  /** Estimated width (FWHM) based on half-prominence descent. */
  fwhm: number;
}

/**
 * Detect peaks in (x, y) data using a prominence-based local-maxima method.
 *
 * Algorithm:
 *  1. Find local maxima where y[i] > y[i-1] && y[i] >= y[i+1].
 *  2. Compute prominence for each candidate (drop to lowest saddle on either side).
 *  3. Keep peaks with prominence >= minProminence and height >= minHeight.
 *  4. Estimate FWHM by walking left/right until y drops below half the peak height.
 *
 * @param x  X values (must be sorted ascending for width estimation).
 * @param y  Y values.
 * @param minProminence  Minimum prominence (relative to local baseline). Default: 5% of range.
 * @param minHeight  Minimum absolute height. Default: mean(y).
 * @returns Detected peaks sorted by x.
 */
export function detectPeaks(
  x: number[],
  y: number[],
  minProminence?: number,
  minHeight?: number,
): DetectedPeak[] {
  const n = Math.min(x.length, y.length);
  if (n < 3) return [];

  const yRange = Math.max(...y) - Math.min(...y);
  const promThreshold = minProminence ?? yRange * 0.05;
  const heightThreshold = minHeight ?? y.reduce((s, v) => s + v, 0) / n;

  const candidates: DetectedPeak[] = [];

  for (let i = 1; i < n - 1; i++) {
    // Local maximum condition
    if (y[i] > y[i - 1] && y[i] >= y[i + 1] && y[i] >= heightThreshold) {
      // Compute prominence: find the highest saddle on each side down to a higher peak,
      // then prominence = y[i] - max(leftSaddle, rightSaddle).
      // Simplified: walk outward until y rises above y[i] or reaches the end.
      let leftBase = y[i];
      for (let j = i - 1; j >= 0; j--) {
        if (y[j] > y[i]) { leftBase = y[i]; break; }
        if (y[j] < leftBase) leftBase = y[j];
        if (j === 0) leftBase = y[0];
      }
      let rightBase = y[i];
      for (let j = i + 1; j < n; j++) {
        if (y[j] > y[i]) { rightBase = y[i]; break; }
        if (y[j] < rightBase) rightBase = y[j];
        if (j === n - 1) rightBase = y[n - 1];
      }
      const saddle = Math.max(leftBase, rightBase);
      const prominence = y[i] - saddle;

      if (prominence >= promThreshold) {
        // Estimate FWHM: walk left/right until y drops below half the peak height
        const halfHeight = saddle + prominence / 2;
        let leftIdx = i;
        for (let j = i; j >= 0; j--) {
          if (y[j] <= halfHeight) { leftIdx = j; break; }
          if (j === 0) leftIdx = 0;
        }
        let rightIdx = i;
        for (let j = i; j < n; j++) {
          if (y[j] <= halfHeight) { rightIdx = j; break; }
          if (j === n - 1) rightIdx = n - 1;
        }
        const fwhm = Math.abs(x[rightIdx] - x[leftIdx]);
        candidates.push({ index: i, x: x[i], y: y[i], fwhm: fwhm > 0 ? fwhm : Math.abs(x[n - 1] - x[0]) / 50 });
      }
    }
  }

  // Merge peaks that are too close (within 1/4 of the smaller FWHM)
  const merged: DetectedPeak[] = [];
  for (const pk of candidates) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(pk.x - last.x) < Math.min(pk.fwhm, last.fwhm) / 4 && pk.y > last.y) {
      merged[merged.length - 1] = pk;
    } else if (last && Math.abs(pk.x - last.x) < Math.min(pk.fwhm, last.fwhm) / 4) {
      // keep the existing (taller) peak
      continue;
    } else {
      merged.push(pk);
    }
  }

  return merged.sort((a, b) => a.x - b.x);
}

/**
 * Estimate initial peak parameters from detected peaks.
 * Returns amplitude, center, and width (σ for Gaussian) for each peak.
 */
export function estimateInitialPeaks(
  peaks: DetectedPeak[],
  shape: 'gaussian' | 'lorentzian' | 'pseudovoigt',
): Array<{ amplitude: number; center: number; width: number; eta?: number }> {
  return peaks.map((pk) => {
    // Convert FWHM to the shape-specific width parameter
    let width: number;
    if (shape === 'gaussian') {
      // FWHM = 2*sqrt(2*ln2)*σ ≈ 2.3548*σ
      width = pk.fwhm / 2.3548;
    } else if (shape === 'lorentzian') {
      // FWHM = 2*HWHM
      width = pk.fwhm / 2;
    } else {
      // Pseudo-Voigt: use Gaussian σ as initial width
      width = pk.fwhm / 2.3548;
    }
    if (width <= 0) width = Math.abs(pk.fwhm) || 1;
    return {
      amplitude: pk.y,
      center: pk.x,
      width,
      eta: shape === 'pseudovoigt' ? 0.5 : undefined,
    };
  });
}
