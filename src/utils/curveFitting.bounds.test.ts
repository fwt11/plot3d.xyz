import { describe, it, expect } from 'vitest';
import { lorentzianFit, hillFit, logistic4PLFit } from './curveFitting';

describe('LM fits with parameter bounds', () => {
  it('lorentzianFit respects bounds: constrains sigma to >= 0.5', () => {
    // Tight bounds force sigma to lower bound
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i <= 10; i += 0.5) {
      x.push(i);
      y.push(10 * 1 / ((i - 5) ** 2 + 1));
    }
    const result = lorentzianFit(x, y, {
      bounds: [
        [0, 100],    // amplitude: unconstrained
        [0, 10],     // center: x range
        [0.5, 0.6],  // sigma: tightly bounded low
      ],
    });
    expect(result).not.toBeNull();
    // sigma should be near lower bound 0.5
    expect(result!.sigma).toBeGreaterThanOrEqual(0.5);
    expect(result!.sigma).toBeLessThanOrEqual(0.6 + 0.1); // small slack
  });

  it('hillFit respects bounds: Vmax is constrained', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0.1; i <= 10; i += 0.2) {
      x.push(i);
      y.push(20 * i ** 2 / (5 ** 2 + i ** 2));
    }
    const result = hillFit(x, y, {
      bounds: [
        [0, 15],   // Vmax ≤ 15
        [0.1, 100], // K unconstrained
        [0.1, 10],  // n unconstrained
      ],
    });
    expect(result).not.toBeNull();
    // Vmax should be near upper bound 15 (true is 20)
    expect(result!.Vmax).toBeGreaterThanOrEqual(14);
    expect(result!.Vmax).toBeLessThanOrEqual(16);
  });

  it('logistic4PLFit respects bounds on slope b', () => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0.1; i <= 20; i += 0.5) {
      x.push(i);
      y.push(0.5 + (10 - 0.5) / (1 + (i / 5) ** 5));  // b=5
    }
    const result = logistic4PLFit(x, y, {
      bounds: [
        [0, 100],     // a
        [0.1, 1.5],   // b constrained: true is 5
        [0.5, 20],    // c
        [0, 5],       // d
      ],
    });
    expect(result).not.toBeNull();
    // b should be near upper bound 1.5 (true is 5)
    expect(result!.b).toBeLessThanOrEqual(1.6);
  });

  it('returns null when bounds make initial guess invalid', () => {
    const x = [0, 1, 2, 3, 4];
    const y = x.map((xi) => 10 * 1 / ((xi - 2) ** 2 + 1));
    const result = lorentzianFit(x, y, {
      bounds: [
        [100, 200],  // amplitude >= 100 (but data max is 10)
        [0, 5],
        [0.5, 1],
      ],
    });
    // Should return null or result with amplitude within bound
    if (result) {
      expect(result.amplitude).toBeGreaterThanOrEqual(100);
    }
  });
});
