import { describe, it, expect } from 'vitest';
import { lorentzianFit, weibullFit, logistic4PLFit, logistic5PLFit, hillFit, biexponentialFit } from './curveFitting';

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
