import { useMemo } from 'react';
import { useChartStore } from '@/store/chartStore';
import { useDatasetStore } from '@/store/datasetStore';

export interface DataRange {
  xMin: number; xMax: number; xLabel: string;
  yMin: number; yMax: number; yLabel: string;
  zMin: number; zMax: number; zLabel: string;
}

/**
 * Compute the global data range across all visible layers.
 *
 * Note: `datasets` and `chartConfig` are object references from Zustand stores
 * that may change on every store update even when the actual data hasn't changed.
 * This is acceptable because the useMemo will simply recompute and return a new
 * DataRange object — the downstream consumers now destructure individual fields
 * from the returned DataRange in their own useMemo dependency arrays, so they
 * won't re-render unless the actual numeric values change.
 */
export function useDataRange(): DataRange | null {
  const datasets = useDatasetStore((s) => s.datasets);
  const chartConfig = useChartStore((s) => s.chartConfig);

  return useMemo(() => {
    const visibleLayers = chartConfig.layers.filter((l) => l.visible);
    if (visibleLayers.length === 0) return null;

    let globalXMin = Infinity, globalXMax = -Infinity;
    let globalYMin = Infinity, globalYMax = -Infinity;
    let globalZMin = Infinity, globalZMax = -Infinity;
    let xLabel = chartConfig.xAxis.label;
    let yLabel = chartConfig.yAxis.label;
    let zLabel = chartConfig.zAxis?.label;

    for (const layer of visibleLayers) {
      const ds = datasets.find((d) => d.id === layer.datasetId);
      if (!ds) continue;
      const xCol = ds.columns.find((c) => c.id === layer.xColumn);
      const yCol = ds.columns.find((c) => c.id === layer.yColumn);
      const zCol = ds.columns.find((c) => c.id === layer.zColumn);
      if (!xCol || !yCol || !zCol) continue;

      const xVals = xCol.values.map(Number);
      const yVals = yCol.values.map(Number);
      const zVals = zCol.values.map(Number);

      globalXMin = Math.min(globalXMin, ...xVals);
      globalXMax = Math.max(globalXMax, ...xVals);
      globalYMin = Math.min(globalYMin, ...yVals);
      globalYMax = Math.max(globalYMax, ...yVals);
      globalZMin = Math.min(globalZMin, ...zVals);
      globalZMax = Math.max(globalZMax, ...zVals);

      if (!xLabel) xLabel = xCol.name;
      if (!yLabel) yLabel = yCol.name;
      if (!zLabel) zLabel = zCol.name;
    }

    if (globalXMin === Infinity) return null;

    return {
      xMin: globalXMin, xMax: globalXMax, xLabel: xLabel || 'X',
      yMin: globalYMin, yMax: globalYMax, yLabel: yLabel || 'Y',
      zMin: globalZMin, zMax: globalZMax, zLabel: zLabel || 'Z',
    };
  }, [datasets, chartConfig]);
}

export function niceScale(min: number, max: number, ticks = 5): number[] {
  const range = max - min || 1;
  const step = Math.pow(10, Math.floor(Math.log10(range / ticks)));
  const niceStep = step * (range / step / ticks > 5 ? 2 : range / step / ticks > 2 ? 1 : 0.5);
  const start = Math.ceil(min / niceStep) * niceStep;
  const values: number[] = [];
  for (let v = start; v <= max + niceStep * 0.01; v += niceStep) {
    values.push(parseFloat(v.toFixed(4)));
  }
  return values;
}
