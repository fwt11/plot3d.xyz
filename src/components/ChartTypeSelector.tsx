import { usePlotStore } from '@/store/plotStore';
import {
  LineChart, BarChart3, ScatterChart, AreaChart, PieChart,
  Box, Rotate3D, Mountain, Binary,
} from 'lucide-react';
import type { ChartType } from '@/types';

const chartTypes: { type: ChartType; label: string; icon: React.ReactNode; group: '2d' | '3d' }[] = [
  { type: 'line', label: '折线图', icon: <LineChart size={16} />, group: '2d' },
  { type: 'scatter', label: '散点图', icon: <ScatterChart size={16} />, group: '2d' },
  { type: 'bar', label: '柱状图', icon: <BarChart3 size={16} />, group: '2d' },
  { type: 'area', label: '面积图', icon: <AreaChart size={16} />, group: '2d' },
  { type: 'pie', label: '饼图', icon: <PieChart size={16} />, group: '2d' },
  { type: 'surface3d', label: '3D 曲面', icon: <Mountain size={16} />, group: '3d' },
  { type: 'scatter3d', label: '3D 散点', icon: <Rotate3D size={16} />, group: '3d' },
  { type: 'contour3d', label: '等高线', icon: <Binary size={16} />, group: '3d' },
  { type: 'bar3d', label: '3D 柱状', icon: <Box size={16} />, group: '3d' },
];

export default function ChartTypeSelector() {
  const chartConfig = usePlotStore((s) => s.chartConfig);
  const setChartType = usePlotStore((s) => s.setChartType);

  return (
    <div className="flex items-center gap-1">
      {chartTypes.map(({ type, label, icon, group }) => (
        <button
          key={type}
          onClick={() => setChartType(type)}
          className={`
            flex items-center gap-1 px-2 py-1 rounded text-xs transition-all
            ${chartConfig.type === type
              ? 'bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/50'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
            }
            ${group === '3d' ? 'border-l border-zinc-700 pl-2 ml-1' : ''}
          `}
          title={label}
        >
          {icon}
          <span className="hidden xl:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
