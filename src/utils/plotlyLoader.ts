// Lazy-loading helper for Plotly + react-plotly.js factory.
// Extracted from ChartView.tsx for testability and reuse.

import type { ComponentType } from 'react';

export type PlotComponentType = ComponentType<Record<string, unknown>>;

let PlotComponent: PlotComponentType | null = null;
let plotlyLoadPromise: Promise<PlotComponentType> | null = null;
let plotlyModule: {
  Plots: { resize: (el: HTMLElement) => void };
  relayout: (el: HTMLElement, update: Record<string, unknown>) => void;
} | null = null;

/** Returns the active Plotly module reference, or null if not yet loaded. */
export function getPlotlyModule(): typeof plotlyModule {
  return plotlyModule;
}

/**
 * Lazy-load the Plotly.js + react-plotly.js factory bundle.
 * Subsequent calls return the cached promise/component.
 */
export function loadPlotly(): Promise<PlotComponentType> {
  if (PlotComponent) return Promise.resolve(PlotComponent);
  if (plotlyLoadPromise) return plotlyLoadPromise;

  plotlyLoadPromise = import('plotly.js-dist-min').then((PlotlyModule) => {
    const Plotly = PlotlyModule.default;
    plotlyModule = Plotly as unknown as typeof plotlyModule;
    return import('react-plotly.js/factory').then((factoryModule) => {
      PlotComponent = factoryModule.default(Plotly);
      return PlotComponent;
    });
  });
  return plotlyLoadPromise;
}
