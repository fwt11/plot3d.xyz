// Statistical distribution functions for hypothesis testing.
// Pure functions; implementations follow standard references (scipy.stats / Numerical Recipes).
// Focus on correctness for the p-value ranges commonly used in scientific reporting.

// --- Gamma function (Lanczos approximation) ---
const LANCZOS_G = 7;
const LANCZOS_C: number[] = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** Natural log of the gamma function. */
export function logGamma(x: number): number {
  if (x < 0.5) {
    // Reflection formula: Γ(x)Γ(1-x) = π / sin(πx)
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  x -= 1;
  let a = LANCZOS_C[0];
  const t = x + LANCZOS_G + 0.5;
  for (let i = 1; i < LANCZOS_G + 2; i++) {
    a += LANCZOS_C[i] / (x + i);
  }
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Gamma function. */
export function gamma(x: number): number {
  if (x < 0.5) {
    return Math.PI / (Math.sin(Math.PI * x) * Math.exp(logGamma(1 - x)));
  }
  return Math.exp(logGamma(x));
}

/** Lower incomplete gamma function P(a, x) = γ(a, x) / Γ(a) via series expansion.
 *  Accurate for x < a + 1. */
function lowerIncompleteGammaSeries(a: number, x: number): number {
  if (x <= 0) return 0;
  let sum = 1 / a;
  let del = sum;
  let n = 0;
  while (n < 1000) {
    n += 1;
    del *= x / (a + n);
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/** Upper incomplete gamma function Q(a, x) = 1 - P(a, x) via continued fraction.
 *  Accurate for x >= a + 1. */
function upperIncompleteGammaCF(a: number, x: number): number {
  const tiny = 1e-30;
  const fpmin = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  let i = 0;
  while (i < 1000) {
    i += 1;
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = b + an / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** Regularized lower incomplete gamma P(a, x) = γ(a, x) / Γ(a).
 *  This is the CDF of the Gamma(a, 1) distribution. */
export function gammainc(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) return lowerIncompleteGammaSeries(a, x);
  return 1 - upperIncompleteGammaCF(a, x);
}

/** Regularized upper incomplete gamma Q(a, x) = 1 - P(a, x). */
export function gammaincc(a: number, x: number): number {
  if (x <= 0) return 1;
  if (x < a + 1) return 1 - lowerIncompleteGammaSeries(a, x);
  return upperIncompleteGammaCF(a, x);
}

// --- Beta function and incomplete beta ---
/** Beta function B(a, b) = Γ(a)Γ(b)/Γ(a+b). */
export function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

/** Incomplete beta function I_x(a, b) via continued fraction (Lentz's method).
 *  Returns the regularized incomplete beta function. */
function betacf(a: number, b: number, x: number): number {
  const fpmin = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < fpmin) d = fpmin;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    const aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    h *= d * c;
    const aa2 = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa2 * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa2 / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b).
 *  This is the CDF of the Beta(a, b) distribution at x. */
export function betainc(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = logBeta(a, b);
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta);
  if (x < (a + 1) / (a + b + 2)) {
    return front * betacf(a, b, x) / a;
  }
  return 1 - front * betacf(b, a, 1 - x) / b;
}

// --- Standard normal distribution ---
/** PDF of standard normal at x. */
export function normalPdf(x: number, mu = 0, sigma = 1): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (Math.sqrt(2 * Math.PI) * sigma);
}

/** CDF of standard normal at x (via erf approximation). */
export function normalCdf(x: number, mu = 0, sigma = 1): number {
  const z = (x - mu) / sigma;
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Error function (Abramowitz & Stegun 7.1.26 approximation, max error ~1.5e-7). */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

// --- t-distribution ---
/** CDF of Student's t-distribution with df degrees of freedom at x. */
export function tCdf(x: number, df: number): number {
  if (!Number.isFinite(df) || df <= 0) return NaN;
  const t = x * x;
  // Use incomplete beta: P(T <= x) = 1 - 0.5 * I_{df/(df+x^2)}(df/2, 1/2) for x > 0
  //                              = 0.5 * I_{df/(df+x^2)}(df/2, 1/2) for x < 0
  const xBeta = df / (df + t);
  const ib = betainc(df / 2, 0.5, xBeta);
  return x > 0 ? 1 - 0.5 * ib : 0.5 * ib;
}

/** Two-tailed p-value for Student's t with df degrees of freedom. */
export function tTwoTailedP(t: number, df: number): number {
  if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0) return NaN;
  return 2 * (1 - tCdf(Math.abs(t), df));
}

// --- Chi-square distribution ---
/** CDF of chi-square distribution with k degrees of freedom at x. */
export function chi2Cdf(x: number, k: number): number {
  if (x <= 0) return 0;
  if (!Number.isFinite(k) || k <= 0) return NaN;
  return gammainc(k / 2, x / 2);
}

/** Upper-tail p-value for chi-square: P(X > x). */
export function chi2P(x: number, k: number): number {
  if (x <= 0) return 1;
  if (!Number.isFinite(k) || k <= 0) return NaN;
  return gammaincc(k / 2, x / 2);
}

// --- F-distribution ---
/** CDF of F-distribution with (d1, d2) degrees of freedom at x. */
export function fCdf(x: number, d1: number, d2: number): number {
  if (x <= 0) return 0;
  if (!Number.isFinite(d1) || !Number.isFinite(d2) || d1 <= 0 || d2 <= 0) return NaN;
  // F CDF = 1 - I_{d2/(d2 + d1*x)}(d2/2, d1/2)
  const xBeta = d2 / (d2 + d1 * x);
  return 1 - betainc(d2 / 2, d1 / 2, xBeta);
}

/** Upper-tail p-value for F-distribution: P(F > x). */
export function fP(x: number, d1: number, d2: number): number {
  if (x <= 0) return 1;
  return 1 - fCdf(x, d1, d2);
}

// --- Critical values (two-tailed alpha = 0.05) ---
// t critical values table (alpha=0.025 one-tailed)
const T_CRIT_025: Record<number, number> = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
  6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
  11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131,
  20: 2.086, 25: 2.060, 30: 2.042, 40: 2.021, 60: 2.000,
  120: 1.980,
};

/** Two-tailed t critical value for alpha=0.05 given degrees of freedom. */
export function tCritical005(df: number): number {
  if (df <= 0) return NaN;
  if (T_CRIT_025[df] !== undefined) return T_CRIT_025[df];
  if (df >= 120) return 1.96;
  const keys = Object.keys(T_CRIT_025).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < keys.length - 1; i++) {
    if (df > keys[i] && df < keys[i + 1]) {
      const t1 = T_CRIT_025[keys[i]];
      const t2 = T_CRIT_025[keys[i + 1]];
      return t1 + ((t2 - t1) * (df - keys[i])) / (keys[i + 1] - keys[i]);
    }
  }
  return 1.96;
}

// Chi-square critical values table (alpha=0.05, upper tail)
const CHI2_CRIT_005: Record<number, number> = {
  1: 3.841, 2: 5.991, 3: 7.815, 4: 9.488, 5: 11.070,
  6: 12.592, 7: 14.067, 8: 15.507, 9: 16.919, 10: 18.307,
  15: 24.996, 20: 31.410, 25: 37.652, 30: 43.773, 40: 55.758,
  50: 67.505, 60: 79.082, 100: 124.342,
};

/** Upper-tail chi-square critical value for alpha=0.05 given degrees of freedom. */
export function chi2Critical005(df: number): number {
  if (df <= 0) return NaN;
  if (CHI2_CRIT_005[df] !== undefined) return CHI2_CRIT_005[df];
  // Approximation for large df: chi2 ≈ df * (1 - 2/(9*df) + z*sqrt(2/(9*df)))^3
  // with z = 1.6449 for alpha=0.05 upper tail
  const z = 1.6449;
  const approx = df * Math.pow(1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df)), 3);
  // For small df not in table, use approximation directly
  if (df < 100) {
    const keys = Object.keys(CHI2_CRIT_005).map(Number).sort((a, b) => a - b);
    for (let i = 0; i < keys.length - 1; i++) {
      if (df > keys[i] && df < keys[i + 1]) {
        const v1 = CHI2_CRIT_005[keys[i]];
        const v2 = CHI2_CRIT_005[keys[i + 1]];
        return v1 + ((v2 - v1) * (df - keys[i])) / (keys[i + 1] - keys[i]);
      }
    }
  }
  return approx;
}
