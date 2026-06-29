// Fit report computations: F-statistic and its p-value for overall regression significance.
// Built on top of existing distribution functions (distributions.ts).

import { fCdf } from './distributions';

/**
 * Compute the F-statistic for overall regression significance.
 * F = (R² / (p-1)) / ((1 - R²) / (n - p))
 *   where p = number of parameters, n = number of data points.
 *
 * For linear regression (p=2), this is equivalent to t² for the slope.
 *
 * @returns the F statistic. Returns 0 for rSquared=0, Infinity for rSquared=1.
 */
export function fStatistic(rSquared: number, n: number, p: number): number {
  if (p <= 1) return Infinity; // no F-test possible for p=1 (intercept-only)
  if (rSquared >= 1) return Infinity;
  if (rSquared <= 0) return 0;
  const num = rSquared / (p - 1);
  const denom = (1 - rSquared) / (n - p);
  if (denom === 0) return Infinity;
  return num / denom;
}

/**
 * Compute the p-value for the F-statistic (upper-tail).
 * p = P(F_{p-1, n-p} > observed F)
 *
 * @returns a value in [0, 1]. Returns 1 if F=0; NaN if inputs are invalid.
 */
export function fPValue(f: number, p: number, n: number): number {
  if (!Number.isFinite(f) || p <= 1 || n <= p) return NaN;
  if (f === 0) return 1;
  return 1 - fCdf(f, p - 1, n - p);
}

/** Format a p-value for display: shows '< 0.0001' for very small values,
 *  '1.0000' for very large, and the value rounded to 4 decimals otherwise. */
export function formatPValue(p: number): string {
  if (!Number.isFinite(p)) return '—';
  if (p < 0.0001) return '< 0.0001';
  if (p > 0.9999) return '1.0000';
  return p.toFixed(4);
}
