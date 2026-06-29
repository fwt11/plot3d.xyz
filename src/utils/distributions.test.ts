import { describe, it, expect } from 'vitest';
import {
  normalPdf,
  normalCdf,
  erf,
  logGamma,
  gamma,
  gammainc,
  gammaincc,
  betainc,
  tCdf,
  tTwoTailedP,
  chi2Cdf,
  chi2P,
  fCdf,
  fP,
  tCritical005,
  chi2Critical005,
} from './distributions';

describe('normalCdf', () => {
  it('returns 0.5 at z=0', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
  });

  it('returns ≈0.8413 at z=1', () => {
    expect(normalCdf(1)).toBeCloseTo(0.8413, 3);
  });

  it('returns ≈0.975 at z=1.96', () => {
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
  });

  it('returns ≈1 at very large z', () => {
    expect(normalCdf(6)).toBeGreaterThan(0.9999);
  });

  it('returns ≈0 at very small z', () => {
    expect(normalCdf(-6)).toBeLessThan(0.0001);
  });

  it('respects mu / sigma parameters', () => {
    // N(10, 2) CDF at 10 = 0.5
    expect(normalCdf(10, 10, 2)).toBeCloseTo(0.5, 7);
    // N(0, 1) CDF at 2 ≈ 0.9772
    expect(normalCdf(2, 0, 1)).toBeCloseTo(0.9772, 3);
  });
});

describe('normalPdf', () => {
  it('returns ≈0.3989 at z=0 (standard normal)', () => {
    expect(normalPdf(0)).toBeCloseTo(0.3989, 3);
  });

  it('returns 0 at extreme z', () => {
    expect(normalPdf(10)).toBeLessThan(1e-20);
  });
});

describe('erf', () => {
  it('returns ≈0 at x=0', () => {
    // erf(0) ≈ 0 within ~1e-9 due to approximation
    expect(Math.abs(erf(0))).toBeLessThan(1e-9);
  });

  it('is antisymmetric', () => {
    expect(erf(1)).toBeCloseTo(-erf(-1), 10);
  });

  it('approaches 1 for large positive x', () => {
    expect(erf(5)).toBeCloseTo(1, 6);
  });
});

describe('logGamma / gamma', () => {
  it('logGamma(1) = 0', () => {
    expect(logGamma(1)).toBeCloseTo(0, 10);
  });

  it('logGamma uses reflection formula for x < 0.5', () => {
    // logGamma(0.3) ≈ 1.0958
    expect(logGamma(0.3)).toBeCloseTo(1.0958, 3);
  });

  it('gamma(1) = 1', () => {
    expect(gamma(1)).toBeCloseTo(1, 10);
  });

  it('gamma(0.5) = sqrt(π)', () => {
    expect(gamma(0.5)).toBeCloseTo(Math.sqrt(Math.PI), 10);
  });

  it('gamma(5) = 24 (4!)', () => {
    expect(gamma(5)).toBeCloseTo(24, 10);
  });

  it('gamma(0.3) uses reflection formula', () => {
    // gamma(0.3) ≈ 2.9915
    expect(gamma(0.3)).toBeCloseTo(2.9915, 3);
  });
});

describe('gammainc / gammaincc', () => {
  it('gammainc(a, 0) = 0', () => {
    expect(gammainc(2, 0)).toBe(0);
  });

  it('gammainc + gammaincc = 1', () => {
    const a = 3, x = 5;
    expect(gammainc(a, x) + gammaincc(a, x)).toBeCloseTo(1, 8);
  });

  it('gammaincc(a, 0) = 1', () => {
    expect(gammaincc(2, 0)).toBe(1);
  });
});

describe('betainc', () => {
  it('betainc(a, b, 0) = 0', () => {
    expect(betainc(2, 3, 0)).toBe(0);
  });

  it('betainc(a, b, 1) = 1', () => {
    expect(betainc(2, 3, 1)).toBe(1);
  });

  it('betainc(1, 1, 0.5) = 0.5 (uniform)', () => {
    expect(betainc(1, 1, 0.5)).toBeCloseTo(0.5, 10);
  });
});

describe('tCdf / tTwoTailedP', () => {
  it('tCdf(0, df) = 0.5', () => {
    expect(tCdf(0, 10)).toBeCloseTo(0.5, 10);
  });

  it('tCdf at very large positive t → ≈1', () => {
    expect(tCdf(10, 5)).toBeGreaterThan(0.999);
  });

  it('tCdf at very large negative t → ≈0', () => {
    expect(tCdf(-10, 5)).toBeLessThan(0.001);
  });

  it('tCdf returns NaN for invalid df', () => {
    expect(tCdf(0, 0)).toBeNaN();
    expect(tCdf(0, -1)).toBeNaN();
    expect(tCdf(0, NaN)).toBeNaN();
  });

  it('tTwoTailedP = 2 * (1 - tCdf(|t|))', () => {
    expect(tTwoTailedP(2, 10)).toBeCloseTo(2 * (1 - tCdf(2, 10)), 10);
  });

  it('tTwoTailedP returns NaN for invalid inputs', () => {
    expect(tTwoTailedP(2, 0)).toBeNaN();
    expect(tTwoTailedP(NaN, 10)).toBeNaN();
  });
});

describe('chi2Cdf / chi2P', () => {
  it('chi2Cdf at 0 with k>0 returns 0', () => {
    expect(chi2Cdf(0, 5)).toBe(0);
  });

  it('chi2Cdf at very large x returns ≈1', () => {
    expect(chi2Cdf(100, 5)).toBeGreaterThan(0.9999);
  });

  it('chi2Cdf returns NaN for invalid k', () => {
    expect(chi2Cdf(5, 0)).toBeNaN();
    expect(chi2Cdf(5, -1)).toBeNaN();
  });

  it('chi2P at 0 returns 1', () => {
    expect(chi2P(0, 5)).toBe(1);
  });

  it('chi2P returns NaN for invalid k', () => {
    expect(chi2P(5, 0)).toBeNaN();
  });

  it('chi2P + chi2Cdf = 1', () => {
    expect(chi2Cdf(3, 4) + chi2P(3, 4)).toBeCloseTo(1, 8);
  });
});

describe('fCdf / fP', () => {
  it('fCdf at F=0 returns 0', () => {
    expect(fCdf(0, 2, 10)).toBe(0);
  });

  it('fCdf at very large F returns ≈1', () => {
    expect(fCdf(100, 2, 10)).toBeGreaterThan(0.9999);
  });

  it('fCdf returns NaN for invalid df', () => {
    expect(fCdf(1, 0, 10)).toBeNaN();
    expect(fCdf(1, 2, 0)).toBeNaN();
    expect(fCdf(1, -1, 10)).toBeNaN();
    expect(fCdf(1, NaN, 10)).toBeNaN();
  });

  it('fP at F=0 returns 1', () => {
    expect(fP(0, 2, 10)).toBe(1);
  });

  it('fP returns upper-tail p-value (small when F large)', () => {
    const p = fP(10, 2, 10);
    expect(p).toBeLessThan(0.05);
    expect(p).toBeGreaterThan(0);
  });

  it('fP + fCdf = 1', () => {
    expect(fCdf(2.5, 4, 20) + fP(2.5, 4, 20)).toBeCloseTo(1, 8);
  });
});

describe('tCritical005', () => {
  it('returns 12.706 at df=1', () => {
    expect(tCritical005(1)).toBeCloseTo(12.706, 3);
  });

  it('returns 2.776 at df=4', () => {
    expect(tCritical005(4)).toBeCloseTo(2.776, 3);
  });

  it('returns 1.98 at df=120 (table value)', () => {
    // Table has explicit entry for df=120 (asymptotic 1.96 only for df ≥ 120 with no table match)
    // Note: the code returns T_CRIT_025[120] = 1.98 when table hits; 1.96 only when df > 120
    expect(tCritical005(120)).toBeCloseTo(1.98, 3);
  });

  it('returns ≈1.96 at df > 120', () => {
    expect(tCritical005(1000)).toBeCloseTo(1.96, 2);
  });

  it('interpolates between table entries', () => {
    // df=17 is between 15 (2.131) and 20 (2.086); interpolated ≈ 2.110
    const c = tCritical005(17);
    expect(c).toBeGreaterThan(2.086);
    expect(c).toBeLessThan(2.131);
  });

  it('returns NaN for df ≤ 0', () => {
    expect(tCritical005(0)).toBeNaN();
    expect(tCritical005(-1)).toBeNaN();
  });
});

describe('chi2Critical005', () => {
  it('returns ≈3.841 at df=1', () => {
    expect(chi2Critical005(1)).toBeCloseTo(3.841, 3);
  });

  it('returns ≈11.070 at df=5', () => {
    expect(chi2Critical005(5)).toBeCloseTo(11.070, 3);
  });

  it('returns NaN for df ≤ 0', () => {
    expect(chi2Critical005(0)).toBeNaN();
    expect(chi2Critical005(-1)).toBeNaN();
  });

  it('interpolates between table entries (df < 100)', () => {
    // df=12 is between 10 (18.307) and 15 (24.996); interpolated ≈ 20.5
    const c = chi2Critical005(12);
    expect(c).toBeGreaterThan(18.307);
    expect(c).toBeLessThan(24.996);
  });

  it('uses large-df approximation for df ≥ 100 (not in table)', () => {
    // df=200 not in table, < 100 is false → uses approximation
    const c = chi2Critical005(200);
    expect(c).toBeGreaterThan(200);
    expect(c).toBeLessThan(300);
  });

  it('uses large-df approximation for df < 1 (no table entry)', () => {
    // df=0.5: not in table, not > 0 → falls to approx via the no-table branch
    const c = chi2Critical005(0.5);
    expect(c).toBeGreaterThan(0);
    expect(Number.isFinite(c)).toBe(true);
  });
});