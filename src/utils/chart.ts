import type { ChartType, ColorMapName } from '@/types';

/** All available color map names */
export const colorMapNames: ColorMapName[] = ['jet', 'viridis', 'hot', 'coolwarm', 'parula', 'plasma', 'cividis', 'inferno', 'magma', 'turbo', 'batlow'];

/** Check if a chart type is 3D */
export function is3DChart(type: ChartType): boolean {
  return type === 'surface3d' || type === 'scatter3d' || type === 'bar3d' || type === 'isosurface3d' || type === 'volume3d';
}

/** Check if a chart type uses a color map (color scale).
 *  These chart types render surface/matrix data with a color scale bar. */
export function usesColorMap(type: ChartType): boolean {
  return (
    type === 'surface3d' ||
    type === 'isosurface3d' ||
    type === 'volume3d' ||
    type === 'heatmap'
  );
}
