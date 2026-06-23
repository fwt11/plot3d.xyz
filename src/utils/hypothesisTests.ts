// Hypothesis testing module.
// Pure functions implementing common parametric and non-parametric tests.
// Implementations follow scipy.stats conventions for p-value computation.

import { mean, sampleVariance, sampleStdDev, toValidNumbers } from '@/utils/statistics';
import {
  tTwoTailedP, tCritical005,
  chi2P, chi2Critical005,
  fP, normalCdf,
} from '@/utils/distributions';

// --- Common test result type ---
export interface TestResult {
  /** Test name, e.g. "One-sample t-test" */
  name: string;
  /** Test statistic (t, F, U, W, etc.) */
  statistic: number;
  /** Degrees of freedom (may be a tuple for F-tests). */
  df: number | [number, number];
  /** p-value (two-tailed for symmetric distributions, upper-tail otherwise). */
  pValue: number;
  /** Whether to reject H0 at alpha=0.05. */
  significant: boolean;
  /** Human-readable conclusion. */
  conclusion: string;
  /** Optional extra fields (effect size, confidence interval, etc.). */
  extra?: Record<string, number | string>;
}

// --- t-tests ---

/** One-sample t-test: tests whether the mean of `sample` equals `mu0`. */
export function oneSampleTTest(sample: number[], mu0: number): TestResult {
  const x = toValidNumbers(sample);
  const n = x.length;
  if (n < 2) {
    return invalidResult('One-sample t-test', '样本量不足 (n < 2)');
  }
  const mu = mean(x);
  const sd = sampleStdDev(x);
  if (sd === 0 || !Number.isFinite(sd)) {
    return invalidResult('One-sample t-test', '标准差为 0，无法计算');
  }
  const se = sd / Math.sqrt(n);
  const t = (mu - mu0) / se;
  const df = n - 1;
  const p = tTwoTailedP(t, df);
  const tcrit = tCritical005(df);
  return {
    name: 'One-sample t-test',
    statistic: t,
    df,
    pValue: p,
    significant: Math.abs(t) > tcrit,
    conclusion: Math.abs(t) > tcrit
      ? `拒绝 H0：样本均值与 ${mu0} 有显著差异 (p=${fmtP(p)})`
      : `无法拒绝 H0：样本均值与 ${mu0} 无显著差异 (p=${fmtP(p)})`,
    extra: {
      sampleMean: mu,
      sampleSD: sd,
      tCritical: tcrit,
      meanDiff: mu - mu0,
      cohensD: (mu - mu0) / sd,
    },
  };
}

/** Two-sample (independent) t-test assuming equal variance (pooled). */
export function twoSampleTTest(sample1: number[], sample2: number[], mu0 = 0): TestResult {
  const x1 = toValidNumbers(sample1);
  const x2 = toValidNumbers(sample2);
  const n1 = x1.length;
  const n2 = x2.length;
  if (n1 < 2 || n2 < 2) {
    return invalidResult('Two-sample t-test', '样本量不足 (n < 2)');
  }
  const m1 = mean(x1);
  const m2 = mean(x2);
  const v1 = sampleVariance(x1);
  const v2 = sampleVariance(x2);
  // Pooled variance
  const pooledV = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2);
  if (pooledV <= 0 || !Number.isFinite(pooledV)) {
    return invalidResult('Two-sample t-test', '合并方差为 0，无法计算');
  }
  const se = Math.sqrt(pooledV * (1 / n1 + 1 / n2));
  const t = ((m1 - m2) - mu0) / se;
  const df = n1 + n2 - 2;
  const p = tTwoTailedP(t, df);
  const tcrit = tCritical005(df);
  // Cohen's d effect size
  const pooledSd = Math.sqrt(pooledV);
  const cohensD = (m1 - m2) / pooledSd;
  return {
    name: 'Two-sample t-test (pooled)',
    statistic: t,
    df,
    pValue: p,
    significant: Math.abs(t) > tcrit,
    conclusion: Math.abs(t) > tcrit
      ? `拒绝 H0：两组均值有显著差异 (p=${fmtP(p)})`
      : `无法拒绝 H0：两组均值无显著差异 (p=${fmtP(p)})`,
    extra: {
      mean1: m1,
      mean2: m2,
      meanDiff: m1 - m2,
      pooledSD: pooledSd,
      tCritical: tcrit,
      cohensD,
    },
  };
}

/** Welch's t-test (unequal variance). */
export function welchTTest(sample1: number[], sample2: number[]): TestResult {
  const x1 = toValidNumbers(sample1);
  const x2 = toValidNumbers(sample2);
  const n1 = x1.length;
  const n2 = x2.length;
  if (n1 < 2 || n2 < 2) {
    return invalidResult("Welch's t-test", '样本量不足 (n < 2)');
  }
  const m1 = mean(x1);
  const m2 = mean(x2);
  const v1 = sampleVariance(x1);
  const v2 = sampleVariance(x2);
  if (v1 <= 0 && v2 <= 0) {
    return invalidResult("Welch's t-test", '方差为 0，无法计算');
  }
  const se = Math.sqrt(v1 / n1 + v2 / n2);
  const t = (m1 - m2) / se;
  // Welch–Satterthwaite degrees of freedom
  const num = Math.pow(v1 / n1 + v2 / n2, 2);
  const denom = Math.pow(v1 / n1, 2) / (n1 - 1) + Math.pow(v2 / n2, 2) / (n2 - 1);
  const df = num / denom;
  const p = tTwoTailedP(t, df);
  const tcrit = tCritical005(Math.floor(df));
  return {
    name: "Welch's t-test",
    statistic: t,
    df,
    pValue: p,
    significant: Math.abs(t) > tcrit,
    conclusion: Math.abs(t) > tcrit
      ? `拒绝 H0：两组均值有显著差异 (p=${fmtP(p)})`
      : `无法拒绝 H0：两组均值无显著差异 (p=${fmtP(p)})`,
    extra: {
      mean1: m1,
      mean2: m2,
      meanDiff: m1 - m2,
      tCritical: tcrit,
    },
  };
}

/** Paired t-test: tests whether the mean difference between paired samples is zero. */
export function pairedTTest(sample1: number[], sample2: number[]): TestResult {
  const x1 = toValidNumbers(sample1);
  const x2 = toValidNumbers(sample2);
  const n = Math.min(x1.length, x2.length);
  if (n < 2) {
    return invalidResult('Paired t-test', '配对样本量不足 (n < 2)');
  }
  const diffs: number[] = [];
  for (let i = 0; i < n; i++) {
    diffs.push(x1[i] - x2[i]);
  }
  const dBar = mean(diffs);
  const sd = sampleStdDev(diffs);
  if (sd === 0 || !Number.isFinite(sd)) {
    return invalidResult('Paired t-test', '差值标准差为 0，无法计算');
  }
  const se = sd / Math.sqrt(n);
  const t = dBar / se;
  const df = n - 1;
  const p = tTwoTailedP(t, df);
  const tcrit = tCritical005(df);
  return {
    name: 'Paired t-test',
    statistic: t,
    df,
    pValue: p,
    significant: Math.abs(t) > tcrit,
    conclusion: Math.abs(t) > tcrit
      ? `拒绝 H0：配对差值均值有显著差异 (p=${fmtP(p)})`
      : `无法拒绝 H0：配对差值均值无显著差异 (p=${fmtP(p)})`,
    extra: {
      meanDiff: dBar,
      sdDiff: sd,
      tCritical: tcrit,
      cohensD: dBar / sd,
    },
  };
}

// --- ANOVA ---

/** One-way ANOVA: tests whether means of multiple groups are equal. */
export function oneWayAnova(groups: number[][]): TestResult {
  const validGroups = groups
    .map((g) => toValidNumbers(g))
    .filter((g) => g.length > 0);
  if (validGroups.length < 2) {
    return invalidResult('One-way ANOVA', '至少需要 2 组数据');
  }
  const k = validGroups.length;
  const ns = validGroups.map((g) => g.length);
  const N = ns.reduce((a, b) => a + b, 0);
  if (N - k < 1) {
    return invalidResult('One-way ANOVA', '自由度不足');
  }
  const means = validGroups.map((g) => mean(g));
  const grandMean = means.reduce((a, b, i) => a + b * ns[i], 0) / N;

  // Between-group sum of squares
  let ssb = 0;
  for (let i = 0; i < k; i++) {
    ssb += ns[i] * (means[i] - grandMean) ** 2;
  }
  // Within-group sum of squares
  let ssw = 0;
  for (let i = 0; i < k; i++) {
    const m = means[i];
    for (const v of validGroups[i]) {
      ssw += (v - m) ** 2;
    }
  }
  const dfb = k - 1;
  const dfw = N - k;
  const msb = ssb / dfb;
  const msw = ssw / dfw;
  if (msw <= 0 || !Number.isFinite(msw)) {
    return invalidResult('One-way ANOVA', '组内方差为 0，无法计算');
  }
  const F = msb / msw;
  const p = fP(F, dfb, dfw);
  return {
    name: 'One-way ANOVA',
    statistic: F,
    df: [dfb, dfw],
    pValue: p,
    significant: p < 0.05,
    conclusion: p < 0.05
      ? `拒绝 H0：各组均值不全相等 (p=${fmtP(p)})`
      : `无法拒绝 H0：各组均值无显著差异 (p=${fmtP(p)})`,
    extra: {
      ssBetween: ssb,
      ssWithin: ssw,
      msBetween: msb,
      msWithin: msw,
      grandMean,
      etaSquared: ssb / (ssb + ssw),
    },
  };
}

// --- Non-parametric tests ---

/** Rank values, handling ties with average rank. */
function rankValues(values: number[]): number[] {
  const n = values.length;
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && indexed[j].v === indexed[i].v) j++;
    const avgRank = (i + 1 + j) / 2; // average of ranks i+1..j
    for (let k = i; k < j; k++) {
      ranks[indexed[k].i] = avgRank;
    }
    i = j;
  }
  return ranks;
}

/** Mann-Whitney U test (Wilcoxon rank-sum test): compares two independent samples. */
export function mannWhitneyU(sample1: number[], sample2: number[]): TestResult {
  const x1 = toValidNumbers(sample1);
  const x2 = toValidNumbers(sample2);
  const n1 = x1.length;
  const n2 = x2.length;
  if (n1 < 1 || n2 < 1) {
    return invalidResult('Mann-Whitney U test', '样本量不足');
  }
  const combined = [...x1, ...x2];
  const ranks = rankValues(combined);
  const R1 = ranks.slice(0, n1).reduce((a, b) => a + b, 0);
  const R2 = ranks.slice(n1).reduce((a, b) => a + b, 0);
  const U1 = R1 - (n1 * (n1 + 1)) / 2;
  const U2 = R2 - (n2 * (n2 + 1)) / 2;
  const U = Math.min(U1, U2);
  // Normal approximation for n1, n2 >= 8 (or use exact for small samples)
  const muU = (n1 * n2) / 2;
  const sigmaU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  let p: number;
  if (sigmaU > 0 && (n1 >= 8 || n2 >= 8)) {
    const z = (U - muU) / sigmaU;
    // Continuity correction
    const zCorrected = Math.abs(z) - 0.5 / sigmaU;
    p = 2 * (1 - normalCdf(Math.max(0, zCorrected)));
  } else {
    // Exact p-value via normal approximation (small samples — approximate)
    const z = (U - muU) / sigmaU;
    p = 2 * (1 - normalCdf(Math.abs(z)));
  }
  return {
    name: 'Mann-Whitney U test',
    statistic: U,
    df: n1 + n2 - 2,
    pValue: p,
    significant: p < 0.05,
    conclusion: p < 0.05
      ? `拒绝 H0：两组分布有显著差异 (p=${fmtP(p)})`
      : `无法拒绝 H0：两组分布无显著差异 (p=${fmtP(p)})`,
    extra: {
      U1,
      U2,
      rankSum1: R1,
      rankSum2: R2,
    },
  };
}

/** Wilcoxon signed-rank test: compares paired samples. */
export function wilcoxonSignedRank(sample1: number[], sample2: number[]): TestResult {
  const x1 = toValidNumbers(sample1);
  const x2 = toValidNumbers(sample2);
  const n = Math.min(x1.length, x2.length);
  if (n < 5) {
    return invalidResult('Wilcoxon signed-rank test', '配对样本量不足 (n < 5)');
  }
  const diffs: number[] = [];
  for (let i = 0; i < n; i++) {
    const d = x1[i] - x2[i];
    if (d !== 0) diffs.push(d);
  }
  if (diffs.length < 5) {
    return invalidResult('Wilcoxon signed-rank test', '非零差值不足');
  }
  const absDiffs = diffs.map((d) => Math.abs(d));
  const ranks = rankValues(absDiffs);
  const Wplus = diffs.reduce((s, d, i) => (d > 0 ? s + ranks[i] : s), 0);
  const Wminus = diffs.reduce((s, d, i) => (d < 0 ? s + ranks[i] : s), 0);
  const W = Math.min(Wplus, Wminus);
  const nn = diffs.length;
  const muW = (nn * (nn + 1)) / 4;
  const sigmaW = Math.sqrt((nn * (nn + 1) * (2 * nn + 1)) / 24);
  let p: number;
  if (sigmaW > 0) {
    const z = (W - muW) / sigmaW;
    p = 2 * (1 - normalCdf(Math.abs(z)));
  } else {
    p = 1;
  }
  return {
    name: 'Wilcoxon signed-rank test',
    statistic: W,
    df: nn - 1,
    pValue: p,
    significant: p < 0.05,
    conclusion: p < 0.05
      ? `拒绝 H0：配对差值分布非对称于 0 (p=${fmtP(p)})`
      : `无法拒绝 H0：配对差值分布对称于 0 (p=${fmtP(p)})`,
    extra: {
      Wplus,
      Wminus,
      nNonZero: nn,
    },
  };
}

/** Kruskal-Wallis H test: non-parametric alternative to one-way ANOVA. */
export function kruskalWallis(groups: number[][]): TestResult {
  const validGroups = groups
    .map((g) => toValidNumbers(g))
    .filter((g) => g.length > 0);
  if (validGroups.length < 2) {
    return invalidResult('Kruskal-Wallis test', '至少需要 2 组数据');
  }
  const k = validGroups.length;
  const ns = validGroups.map((g) => g.length);
  const N = ns.reduce((a, b) => a + b, 0);
  if (N < k) {
    return invalidResult('Kruskal-Wallis test', '总样本量不足');
  }
  const combined: number[] = [];
  for (const g of validGroups) combined.push(...g);
  const ranks = rankValues(combined);
  let idx = 0;
  const rankSums: number[] = [];
  for (let i = 0; i < k; i++) {
    let s = 0;
    for (let j = 0; j < ns[i]; j++) {
      s += ranks[idx++];
    }
    rankSums.push(s);
  }
  const H = (12 / (N * (N + 1))) * rankSums.reduce((s, R, i) => s + (R * R) / ns[i], 0) - 3 * (N + 1);
  const df = k - 1;
  const p = chi2P(H, df);
  return {
    name: 'Kruskal-Wallis H test',
    statistic: H,
    df,
    pValue: p,
    significant: p < 0.05,
    conclusion: p < 0.05
      ? `拒绝 H0：各组分布不全相同 (p=${fmtP(p)})`
      : `无法拒绝 H0：各组分布无显著差异 (p=${fmtP(p)})`,
    extra: {
      rankSums: rankSums.join(', '),
      totalN: N,
    },
  };
}

// --- Normality tests ---

/** Shapiro-Wilk test for normality (Royston's approximation).
 *  Suitable for 3 <= n <= 5000. Returns W statistic and p-value. */
export function shapiroWilk(sample: number[]): TestResult {
  const x = toValidNumbers(sample);
  const n = x.length;
  if (n < 3) {
    return invalidResult('Shapiro-Wilk test', '样本量不足 (n < 3)');
  }
  if (n > 5000) {
    return invalidResult('Shapiro-Wilk test', '样本量过大 (n > 5000)，建议使用 K-S 检验');
  }
  const sorted = [...x].sort((a, b) => a - b);
  const mu = mean(sorted);
  let S2 = 0;
  for (const v of sorted) S2 += (v - mu) ** 2;
  if (S2 === 0) {
    return invalidResult('Shapiro-Wilk test', '数据方差为 0');
  }
  // Compute Royston's approximation for the W coefficients
  const m = Array.from({ length: n }, (_, i) => normPPF((i + 1) / (n + 1)));
  const m2 = m.reduce((s, v) => s + v * v, 0);
  const u = 1 / Math.sqrt(n);
  // Royston's coefficients
  const aN = -2.706556 + 4.434685 * u - 2.071498 * u * u - 0.147981 * u * u * u + 0.221096 * u * u * u * u;
  const aN1 = -3.582633 + 5.682633 * u - 1.752460 * u * u - 0.293762 * u * u * u + 0.421801 * u * u * u * u;
  const a = new Array(n);
  a[n - 1] = aN;
  a[0] = -aN;
  if (n > 5) {
    a[n - 2] = aN1;
    a[1] = -aN1;
    const eps = (m2 - 2 * m[n - 1] * m[n - 1] - 2 * m[n - 2] * m[n - 2]) / (1 - 2 * aN * aN - 2 * aN1 * aN1);
    for (let i = 2; i < n - 2; i++) {
      a[i] = m[i] / Math.sqrt(eps);
    }
  } else {
    const eps = (m2 - 2 * m[n - 1] * m[n - 1]) / (1 - 2 * aN * aN);
    for (let i = 1; i < n - 1; i++) {
      a[i] = m[i] / Math.sqrt(eps);
    }
  }
  // W statistic
  let numerator = 0;
  for (let i = 0; i < n; i++) {
    numerator += a[i] * sorted[i];
  }
  const W = (numerator * numerator) / S2;
  // Royston's p-value approximation
  let p: number;
  if (n === 3) {
    p = 6 / Math.PI * (Math.asin(Math.sqrt(W)) - Math.asin(Math.sqrt(3 / 4)));
  } else {
    let y, muY, sigmaY;
    if (n <= 11) {
      const gamma = -2.273 + 0.459 * n;
      muY = 0.5440 - 0.39978 * n + 0.025054 * n * n - 0.0006714 * n * n * n;
      sigmaY = Math.exp(1.3822 - 0.77857 * n + 0.062767 * n * n - 0.0020322 * n * n * n);
      y = -Math.log(gamma - Math.log(1 - W));
    } else {
      const lnN = Math.log(n);
      muY = 0.0038915 * Math.pow(lnN, 3) - 0.083751 * lnN * lnN - 0.31082 * lnN - 1.5861;
      sigmaY = Math.exp(0.0030302 * Math.pow(lnN, 2) - 0.082676 * lnN - 0.4803);
      y = Math.log(1 - W);
    }
    const z = (y - muY) / sigmaY;
    p = 1 - normalCdf(z);
  }
  return {
    name: 'Shapiro-Wilk test',
    statistic: W,
    df: n - 1,
    pValue: p,
    significant: p < 0.05,
    conclusion: p < 0.05
      ? `拒绝 H0：数据不服从正态分布 (p=${fmtP(p)})`
      : `无法拒绝 H0：数据可视为正态分布 (p=${fmtP(p)})`,
    extra: {
      sampleSize: n,
      W,
    },
  };
}

/** Inverse normal CDF (probit function) via Acklam's algorithm. */
function normPPF(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q, r;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= phigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
}

/** Kolmogorov-Smirnov one-sample test for normality.
 *  Compares the sample to a normal distribution with the given mean and SD. */
export function ksTestNormal(sample: number[], mu0?: number, sigma0?: number): TestResult {
  const x = toValidNumbers(sample);
  const n = x.length;
  if (n < 5) {
    return invalidResult('Kolmogorov-Smirnov test', '样本量不足 (n < 5)');
  }
  const sorted = [...x].sort((a, b) => a - b);
  const mu = mu0 !== undefined ? mu0 : mean(sorted);
  const sd = sigma0 !== undefined ? sigma0 : sampleStdDev(sorted);
  if (sd <= 0 || !Number.isFinite(sd)) {
    return invalidResult('Kolmogorov-Smirnov test', '标准差为 0 或无效');
  }
  let D = 0;
  for (let i = 0; i < n; i++) {
    const cdf = normalCdf(sorted[i], mu, sd);
    const dPlus = (i + 1) / n - cdf;
    const dMinus = cdf - i / n;
    if (dPlus > D) D = dPlus;
    if (dMinus > D) D = dMinus;
  }
  // Kolmogorov distribution p-value
  const sqrtN = Math.sqrt(n);
  const lambda = (sqrtN + 0.12 + 0.11 / sqrtN) * D;
  let p = 0;
  for (let k = 1; k <= 100; k++) {
    const term = 2 * Math.pow(-1, k - 1) * Math.exp(-2 * k * k * lambda * lambda);
    p += term;
    if (Math.abs(term) < 1e-10) break;
  }
  p = Math.max(0, Math.min(1, p));
  return {
    name: 'Kolmogorov-Smirnov test (normal)',
    statistic: D,
    df: n - 1,
    pValue: p,
    significant: p < 0.05,
    conclusion: p < 0.05
      ? `拒绝 H0：数据不服从指定正态分布 (p=${fmtP(p)})`
      : `无法拒绝 H0：数据可视为该正态分布 (p=${fmtP(p)})`,
    extra: {
      D,
      mean: mu,
      stdDev: sd,
    },
  };
}

// --- Helpers ---

function invalidResult(name: string, reason: string): TestResult {
  return {
    name,
    statistic: NaN,
    df: NaN,
    pValue: NaN,
    significant: false,
    conclusion: `无法计算：${reason}`,
  };
}

/** Format p-value: show '< 0.0001' for very small values. */
export function fmtP(p: number): string {
  if (!Number.isFinite(p)) return '—';
  if (p < 0.0001) return '< 0.0001';
  return p.toFixed(4);
}

/** Format a test statistic for display. */
export function fmtStat(v: number, digits = 4): string {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-4 && v !== 0)) return v.toExponential(digits);
  return v.toFixed(digits);
}

/** Generate Q-Q plot data (theoretical quantiles vs sample quantiles).
 *  Returns pairs [theoretical, sample] for plotting. */
export function qqPlotData(sample: number[]): { theoretical: number[]; sample: number[] } {
  const x = toValidNumbers(sample);
  const n = x.length;
  if (n < 2) return { theoretical: [], sample: [] };
  const sorted = [...x].sort((a, b) => a - b);
  const theoretical: number[] = [];
  const sampleQ: number[] = [];
  for (let i = 0; i < n; i++) {
    // Use (i + 0.5) / n for plotting positions
    const p = (i + 0.5) / n;
    theoretical.push(normPPF(p));
    sampleQ.push(sorted[i]);
  }
  return { theoretical, sample: sampleQ };
}

// Re-export for convenience
export { tCritical005, chi2Critical005 };
