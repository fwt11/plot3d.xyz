import { describe, it, expect } from 'vitest';
import { buildFitEquationAnnotation } from './fitAnnotation';

describe('buildFitEquationAnnotation', () => {
  const baseFit = {
    type: 'linear',
    rSquared: 0.99,
    adjustedRSquared: 0.985,
    rmse: 0.1,
    mae: 0.05,
    residualSE: 0.1,
    n: 10,
    dof: 8,
    equation: 'y = 2.0000x + 1.0000',
    fittedX: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    fittedY: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19],
    stats: {} as never,
  };

  it('returns an annotation with type fitEquation', () => {
    const ann = buildFitEquationAnnotation(baseFit);
    expect(ann.type).toBe('fitEquation');
    expect(ann.visible).toBe(true);
  });

  it('content contains LaTeX-wrapped equation', () => {
    const ann = buildFitEquationAnnotation(baseFit);
    expect(ann.content).toContain('$$');
    expect(ann.content).toContain('2.0000x');
    expect(ann.content).toContain('1.0000');
  });

  it('positions at top-right by default', () => {
    const ann = buildFitEquationAnnotation(baseFit);
    expect(ann.x).toBeGreaterThan(80);
    expect(ann.y).toBeLessThan(20);
  });

  it('respects custom position', () => {
    const ann = buildFitEquationAnnotation(baseFit, { x: 10, y: 50 });
    expect(ann.x).toBe(10);
    expect(ann.y).toBe(50);
  });

  it('has unique id', () => {
    const a1 = buildFitEquationAnnotation(baseFit);
    const a2 = buildFitEquationAnnotation(baseFit);
    expect(a1.id).not.toBe(a2.id);
  });
});
