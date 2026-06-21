import type { ChartType, ColorMapName } from '@/types';

/** All available color map names */
export const colorMapNames: ColorMapName[] = ['jet', 'viridis', 'hot', 'coolwarm', 'parula', 'plasma', 'cividis', 'inferno', 'magma', 'turbo', 'batlow'];

/** Check if a chart type is 3D */
export function is3DChart(type: ChartType): boolean {
  return type === 'surface3d' || type === 'scatter3d' || type === 'contour3d' || type === 'bar3d';
}
