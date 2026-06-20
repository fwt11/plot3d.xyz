import { useNavigate } from 'react-router-dom';
import { usePlotStore } from '@/store/plotStore';
import Scene3D from '@/components/Scene3D';
import Scene3DControls from '@/components/Scene3DControls';
import Toolbar from '@/components/Toolbar';
import ChartTypeSelector from '@/components/ChartTypeSelector';
import { ArrowLeft } from 'lucide-react';

export default function Visualization3D() {
  const navigate = useNavigate();
  const chartConfig = usePlotStore((s) => s.chartConfig);

  const is3D = ['surface3d', 'scatter3d', 'contour3d', 'bar3d'].includes(chartConfig.type);

  return (
    <div className="flex flex-col h-screen bg-[#0f0f1a] text-zinc-300 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-700/50">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-sky-400 transition-colors text-xs"
        >
          <ArrowLeft size={14} />
          返回工作台
        </button>
        <div className="w-px h-5 bg-zinc-700" />
        <ChartTypeSelector />
      </div>

      <Toolbar />

      {/* 3D Canvas */}
      <div className="flex-1 relative">
        {is3D ? (
          <>
            <Scene3D />
            <Scene3DControls />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            请选择 3D 图表类型（3D 曲面 / 3D 散点 / 等高线 / 3D 柱状）
          </div>
        )}
      </div>
    </div>
  );
}
