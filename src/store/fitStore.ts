import { create } from 'zustand';
import type { FitStatistics } from '@/utils/curveFitting';

export type FitType = 'linear' | 'poly2' | 'poly3' | 'poly4' | 'poly5' | 'poly6' | 'exponential' | 'logarithmic' | 'power' | 'gaussian' | 'logistic';

export interface FitResult {
  type: FitType;
  rSquared: number;
  adjustedRSquared: number;
  rmse: number;
  mae: number;
  residualSE: number;
  n: number;
  dof: number;
  equation: string;
  fittedX: number[];
  fittedY: number[];
  stats: FitStatistics;
}

interface FitStore {
  fitResult: FitResult | null;
  showStats: boolean;
  showResidualPlot: boolean;
  residualMode: 'fitted' | 'x';
  isFitting: boolean;
  showMultiPeak: boolean;
  setFitResult: (result: FitResult | null) => void;
  setShowStats: (show: boolean) => void;
  setShowResidualPlot: (show: boolean) => void;
  setResidualMode: (mode: 'fitted' | 'x') => void;
  setIsFitting: (isFitting: boolean) => void;
  setShowMultiPeak: (show: boolean) => void;
  clearFitResult: () => void;
}

export const useFitStore = create<FitStore>()((set) => ({
  fitResult: null,
  showStats: false,
  showResidualPlot: false,
  residualMode: 'fitted',
  isFitting: false,
  showMultiPeak: false,
  setFitResult: (fitResult) => set({ fitResult }),
  setShowStats: (showStats) => set({ showStats }),
  setShowResidualPlot: (showResidualPlot) => set({ showResidualPlot }),
  setResidualMode: (residualMode) => set({ residualMode }),
  setIsFitting: (isFitting) => set({ isFitting }),
  setShowMultiPeak: (showMultiPeak) => set({ showMultiPeak }),
  clearFitResult: () => set({ fitResult: null, showStats: false, showResidualPlot: false }),
}));
