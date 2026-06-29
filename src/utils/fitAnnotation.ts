// Helpers for "fit equation" annotations — visualises a fitted equation on the chart
// using KaTeX rendering via the existing annotation infrastructure.

import type { Annotation } from '@/types';
import { equationToLatex } from './fitExport';
import { uid } from './sampleData';

/** Minimal subset of FitResult used by buildFitEquationAnnotation. Avoids a
 *  circular import between fitExport / fitStore. */
export interface FitResultLike {
  type: string;
  equation: string;
  rSquared: number;
  n: number;
}

export interface BuildFitEquationAnnotationOptions {
  /** Position in percent (0-100). Default: top-right (95, 5). */
  x?: number;
  y?: number;
  /** Color (CSS). Default: theme text-secondary. */
  color?: string;
  /** Font size (px). Default: 14. */
  fontSize?: number;
}

/**
 * Build an `Annotation` whose content is the fit equation rendered as LaTeX.
 * Drop the result into `chartStore.addAnnotation()` and it will float on the chart.
 */
export function buildFitEquationAnnotation(
  fit: FitResultLike,
  options: BuildFitEquationAnnotationOptions = {},
): Annotation {
  const content = equationToLatex(fit.equation);
  return {
    id: uid(),
    type: 'fitEquation',
    x: options.x ?? 95,
    y: options.y ?? 5,
    content,
    color: options.color ?? 'var(--text-secondary)',
    fontSize: options.fontSize ?? 14,
    visible: true,
    coordMode: 'percent',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 8,
    borderRadius: 4,
    zIndex: 10,
  };
}