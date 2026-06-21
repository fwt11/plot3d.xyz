import {
  LineChart, BarChart3, ScatterChart, AreaChart, PieChart,
  Box, Rotate3D, Mountain, Binary, Compass,
} from 'lucide-react';
import type { ChartType } from '@/types';

export const getChartTypes = (t: (key: string) => string): { type: ChartType; label: string; icon: React.ReactNode; group: '2d' | '3d' }[] => [
  { type: 'line', label: t('chartTypes.line'), icon: <LineChart size={16} />, group: '2d' },
  { type: 'scatter', label: t('chartTypes.scatter'), icon: <ScatterChart size={16} />, group: '2d' },
  { type: 'bar', label: t('chartTypes.bar'), icon: <BarChart3 size={16} />, group: '2d' },
  { type: 'area', label: t('chartTypes.area'), icon: <AreaChart size={16} />, group: '2d' },
  { type: 'pie', label: t('chartTypes.pie'), icon: <PieChart size={16} />, group: '2d' },
  { type: 'polar', label: t('chartTypes.polar'), icon: <Compass size={16} />, group: '2d' },
  { type: 'surface3d', label: t('chartTypes.surface3d'), icon: <Mountain size={16} />, group: '3d' },
  { type: 'scatter3d', label: t('chartTypes.scatter3d'), icon: <Rotate3D size={16} />, group: '3d' },
  { type: 'contour3d', label: t('chartTypes.contour3d'), icon: <Binary size={16} />, group: '3d' },
  { type: 'bar3d', label: t('chartTypes.bar3d'), icon: <Box size={16} />, group: '3d' },
];
