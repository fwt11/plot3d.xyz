import {
  LineChart, BarChart3, ScatterChart, AreaChart, PieChart,
  Box, Rotate3D, Mountain, Binary, Compass, BarChart2, Grid3x3,
  Activity, Layers,
} from 'lucide-react';
import type { ChartType } from '@/types';

export const getChartTypes = (t: (key: string) => string): { type: ChartType; label: string; icon: React.ReactNode; group: '2d' | '3d' | 'stat' }[] => [
  { type: 'line', label: t('chartTypes.line'), icon: <LineChart size={15} />, group: '2d' },
  { type: 'scatter', label: t('chartTypes.scatter'), icon: <ScatterChart size={15} />, group: '2d' },
  { type: 'bar', label: t('chartTypes.bar'), icon: <BarChart3 size={15} />, group: '2d' },
  { type: 'area', label: t('chartTypes.area'), icon: <AreaChart size={15} />, group: '2d' },
  { type: 'pie', label: t('chartTypes.pie'), icon: <PieChart size={15} />, group: '2d' },
  { type: 'polar', label: t('chartTypes.polar'), icon: <Compass size={15} />, group: '2d' },
  { type: 'box', label: t('chartTypes.box'), icon: <Box size={15} />, group: 'stat' },
  { type: 'histogram', label: t('chartTypes.histogram'), icon: <BarChart2 size={15} />, group: 'stat' },
  { type: 'violin', label: t('chartTypes.violin'), icon: <Activity size={15} />, group: 'stat' },
  { type: 'heatmap', label: t('chartTypes.heatmap'), icon: <Grid3x3 size={15} />, group: 'stat' },
  { type: 'surface3d', label: t('chartTypes.surface3d'), icon: <Mountain size={15} />, group: '3d' },
  { type: 'scatter3d', label: t('chartTypes.scatter3d'), icon: <Rotate3D size={15} />, group: '3d' },
  { type: 'contour3d', label: t('chartTypes.contour3d'), icon: <Binary size={15} />, group: '3d' },
  { type: 'bar3d', label: t('chartTypes.bar3d'), icon: <Box size={15} />, group: '3d' },
  { type: 'isosurface3d', label: t('chartTypes.isosurface3d'), icon: <Layers size={15} />, group: '3d' },
  { type: 'volume3d', label: t('chartTypes.volume3d'), icon: <Box size={15} />, group: '3d' },
];
