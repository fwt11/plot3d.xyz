import { describe, it, expect } from 'vitest';
import { lmFitGeneral, lorentzianFit, weibullFit, logistic4PLFit, logistic5PLFit, hillFit, biexponentialFit } from './curveFitting';

describe('lorentzianFit', () => {
  it('fits y = A * σ² / ((x - x₀)² + σ²) with A=10, x₀=2, σ=1', () => {
    // Lorentzian peak — use finer sampling to help LM converge
    const x: number[] = [];
    const y: number[] = [];
    for (let i = -10; i <= 10; i += 0.1) {
      x.push(i);
      const s = 1, c = 2, A = 10;
      y.push(A * s * s / ((i - c) ** 2 + s * s));
    }
    const result = lorentzianFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.amplitude).toBeCloseTo(10, 0);
    expect(result!.center).toBeCloseTo(2, 0);
    expect(result!.sigma).toBeCloseTo(1, 0);
  });

  it('returns null for too few points', () => {
    expect(lorentzianFit([1, 2], [1, 2])).toBeNull();
  });
});

describe('weibullFit', () => {
  it('fits y = A * (1 - exp(-(x/λ)^k)) with A=10, λ=2, k=1.5', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0.1; i <= 10; i += 0.2) {
      x.push(i);
      const A = 10, lambda = 2, k = 1.5;
      y.push(A * (1 - Math.exp(-Math.pow(i / lambda, k))));
    }
    const result = weibullFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.amplitude).toBeGreaterThan(8);
    expect(result!.amplitude).toBeLessThan(12);
  });
});

describe('logistic4PLFit', () => {
  it('fits 4PL sigmoid d=0.5, a=10, c=5, b=2', () => {
    // y = d + (a - d) / (1 + (x/c)^b)
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0.1; i <= 20; i += 0.5) {
      x.push(i);
      const d = 0.5, a = 10, c = 5, b = 2;
      y.push(d + (a - d) / (1 + Math.pow(i / c, b)));
    }
    const result = logistic4PLFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.a).toBeGreaterThan(7);
    expect(result!.a).toBeLessThan(13);
  });
});

describe('logistic5PLFit', () => {
  it('fits 5PL with g=1 (asymmetric param = 1 → reduces to 4PL)', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0.1; i <= 20; i += 0.5) {
      x.push(i);
      const d = 0.5, a = 10, c = 5, b = 2, g = 1;
      // 5PL: y = d + (a - d) / (1 + (x/c)^b)^g
      y.push(d + (a - d) / Math.pow(1 + Math.pow(i / c, b), g));
    }
    const result = logistic5PLFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.a).toBeGreaterThan(5);
  });
});

describe('hillFit', () => {
  it('fits y = Vmax * x^n / (K^n + x^n) with Vmax=10, K=5, n=2', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0.1; i <= 10; i += 0.2) {
      x.push(i);
      const Vmax = 10, K = 5, n = 2;
      y.push(Vmax * Math.pow(i, n) / (Math.pow(K, n) + Math.pow(i, n)));
    }
    const result = hillFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.Vmax).toBeGreaterThan(5);
  });
});

describe('biexponentialFit', () => {
  it('fits y = a*exp(-b*x) + c*exp(-d*x) with a=5,b=0.5,c=2,d=0.2', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i <= 10; i += 0.2) {
      x.push(i);
      y.push(5 * Math.exp(-0.5 * i) + 2 * Math.exp(-0.2 * i));
    }
    const result = biexponentialFit(x, y);
    expect(result).not.toBeNull();
    // Total area ≈ a/b + c/d = 5/0.5 + 2/0.2 = 10 + 10 = 20
    // y(0) = 5 + 2 = 7
    expect(result!.y0).toBeCloseTo(7, 1);
  });
});


// --- Regression: lmFitGeneral Jacobian sign (P0) ---
// The Jacobian previously held -∂f/∂p while the update solved (JᵀJ+λ)δ = +Jᵀr,
// so every step increased SSE and the fit silently returned the initial guess.

/** Deterministic pseudo-noise in [-amp, amp] (no Math.random → reproducible). */
const detNoise = (i: number, amp: number) => amp * Math.sin(i * 7.13 + 1.7);

describe('lmFitGeneral — regression for inverted Jacobian sign', () => {
  it('converges from [1.5, 0.3] to [2, 0.5] on exact y = 2·e^(−0.5x)', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i <= 20; i++) {
      const xi = i * 0.5;
      x.push(xi);
      y.push(2 * Math.exp(-0.5 * xi));
    }
    const predict = (params: number[], xi: number) => params[0] * Math.exp(-params[1] * xi);
    const fit = lmFitGeneral(predict, x, y, [1.5, 0.3]);
    expect(fit).not.toBeNull();
    // Before the fix the initial guess was returned unchanged.
    expect(fit!.params[0]).toBeCloseTo(2, 4);
    expect(fit!.params[1]).toBeCloseTo(0.5, 4);
  });
});

describe('lmFitGeneral-based fits — perturbed data converges to true params', () => {
  it('lorentzianFit recovers A=10, x₀=2, σ=1.5 with noise', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i <= 80; i++) {
      const xi = -10 + i * 0.25;
      x.push(xi);
      y.push(10 * 1.5 * 1.5 / ((xi - 2) ** 2 + 1.5 * 1.5) + detNoise(i, 0.05));
    }
    const result = lorentzianFit(x, y);
    expect(result).not.toBeNull();
    expect(Math.abs(result!.amplitude - 10)).toBeLessThan(0.3);
    expect(Math.abs(result!.center - 2)).toBeLessThan(0.1);
    expect(Math.abs(result!.sigma - 1.5)).toBeLessThan(0.1);
    expect(result!.rSquared).toBeGreaterThan(0.99);
  });

  it('weibullFit recovers A=10, λ=2, k=1.5 with noise', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 50; i++) {
      const xi = 0.1 + i * 0.2;
      x.push(xi);
      y.push(10 * (1 - Math.exp(-Math.pow(xi / 2, 1.5))) + detNoise(i, 0.05));
    }
    const result = weibullFit(x, y);
    expect(result).not.toBeNull();
    expect(result!.amplitude).toBeGreaterThan(9);
    expect(result!.amplitude).toBeLessThan(11);
    expect(result!.lambda).toBeGreaterThan(1.7);
    expect(result!.lambda).toBeLessThan(2.3);
    expect(result!.k).toBeGreaterThan(1.2);
    expect(result!.k).toBeLessThan(1.8);
    expect(result!.rSquared).toBeGreaterThan(0.99);
  });

  it('logistic4PLFit recovers a=10, b=2, c=5, d=0.5 with noise', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 40; i++) {
      const xi = 0.1 + i * 0.5;
      x.push(xi);
      y.push(0.5 + (10 - 0.5) / (1 + Math.pow(xi / 5, 2)) + detNoise(i, 0.05));
    }
    const result = logistic4PLFit(x, y);
    expect(result).not.toBeNull();
    expect(Math.abs(result!.a - 10)).toBeLessThan(0.5);
    expect(Math.abs(result!.b - 2)).toBeLessThan(0.3);
    expect(Math.abs(result!.c - 5)).toBeLessThan(0.3);
    expect(Math.abs(result!.d - 0.5)).toBeLessThan(0.3);
    expect(result!.rSquared).toBeGreaterThan(0.99);
  });

  it('logistic5PLFit recovers a=10, c=5, g=1.5 with noise', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 40; i++) {
      const xi = 0.1 + i * 0.5;
      x.push(xi);
      y.push(0.5 + (10 - 0.5) / Math.pow(1 + Math.pow(xi / 5, 2), 1.5) + detNoise(i, 0.05));
    }
    const result = logistic5PLFit(x, y);
    expect(result).not.toBeNull();
    expect(Math.abs(result!.a - 10)).toBeLessThan(1);
    expect(Math.abs(result!.c - 5)).toBeLessThan(0.7);
    expect(Math.abs(result!.g - 1.5)).toBeLessThan(0.5);
    expect(result!.rSquared).toBeGreaterThan(0.99);
  });

  it('hillFit recovers Vmax=10, K=5, n=2 with noise', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 50; i++) {
      const xi = 0.1 + i * 0.2;
      x.push(xi);
      y.push(10 * Math.pow(xi, 2) / (Math.pow(5, 2) + Math.pow(xi, 2)) + detNoise(i, 0.05));
    }
    const result = hillFit(x, y);
    expect(result).not.toBeNull();
    expect(Math.abs(result!.Vmax - 10)).toBeLessThan(0.5);
    expect(Math.abs(result!.K - 5)).toBeLessThan(0.3);
    expect(Math.abs(result!.n - 2)).toBeLessThan(0.2);
    expect(result!.rSquared).toBeGreaterThan(0.99);
  });

  it('biexponentialFit reproduces the curve with noise (y0 ≈ 7)', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i <= 50; i++) {
      const xi = i * 0.2;
      x.push(xi);
      y.push(5 * Math.exp(-0.5 * xi) + 2 * Math.exp(-0.2 * xi) + detNoise(i, 0.02));
    }
    const result = biexponentialFit(x, y);
    expect(result).not.toBeNull();
    // (a,b) and (c,d) are interchangeable, so assert on the reconstructed curve
    expect(Math.abs(result!.y0 - 7)).toBeLessThan(0.3);
    expect(result!.rSquared).toBeGreaterThan(0.99);
  });
});
