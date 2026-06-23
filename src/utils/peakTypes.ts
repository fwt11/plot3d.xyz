// Peak fitting type definitions

/** Supported peak shape models. */
export type PeakShape = 'gaussian' | 'lorentzian' | 'pseudovoigt';

/** Background model for peak fitting. */
export type BackgroundType = 'none' | 'linear' | 'polynomial';

/** A single peak's fitted parameters. */
export interface PeakParams {
  /** Peak amplitude (height at center). */
  amplitude: number;
  /** Peak center position (x). */
  center: number;
  /** Peak width parameter.
   *  - Gaussian: standard deviation σ
   *  - Lorentzian: half-width at half-maximum (HWHM)
   *  - Pseudo-Voigt: FWHM / (2*sqrt(2*ln2)) approx
   */
  width: number;
  /** Pseudo-Voigt mixing factor (0 = Gaussian, 1 = Lorentzian). Only used for pseudovoigt. */
  eta?: number;
}

/** Result of a single peak fit. */
export interface PeakResult extends PeakParams {
  /** Integrated peak area. */
  area: number;
  /** Full width at half maximum. */
  fwhm: number;
  /** R² contribution for this peak. */
  rSquared: number;
}

/** Complete multi-peak fit result. */
export interface MultiPeakFitResult {
  /** Fitted peaks. */
  peaks: PeakResult[];
  /** Background coefficients (for linear: [intercept, slope]; for polynomial: highest-first). */
  background: number[];
  /** Background type used. */
  backgroundType: BackgroundType;
  /** Overall R² of the fit. */
  rSquared: number;
  /** Adjusted R². */
  adjustedRSquared: number;
  /** Root mean squared error. */
  rmse: number;
  /** Number of data points. */
  n: number;
  /** Number of parameters. */
  p: number;
  /** Fitted x values (evaluation grid). */
  fittedX: number[];
  /** Fitted y values (sum of all peaks + background). */
  fittedY: number[];
  /** Background-only y values on the grid. */
  backgroundY: number[];
  /** Per-peak y contributions on the grid. */
  peakY: number[][];
}

/** Options for multi-peak fitting. */
export interface MultiPeakFitOptions {
  /** Peak shape model. */
  shape: PeakShape;
  /** Background type. */
  backgroundType: BackgroundType;
  /** Polynomial background degree (used when backgroundType === 'polynomial'). */
  backgroundDegree?: number;
  /** Maximum Gauss-Newton iterations. */
  maxIterations?: number;
  /** Convergence tolerance on parameter change. */
  tolerance?: number;
}

/** Default fit options. */
export const DEFAULT_FIT_OPTIONS: MultiPeakFitOptions = {
  shape: 'gaussian',
  backgroundType: 'linear',
  backgroundDegree: 2,
  maxIterations: 200,
  tolerance: 1e-8,
};
