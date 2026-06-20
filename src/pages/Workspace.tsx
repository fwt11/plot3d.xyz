import { useState, useEffect } from 'react';
import { usePlotStore } from '@/store/plotStore';
import DataTable from '@/components/DataTable';
import Chart2D from '@/components/Chart2D';
import Scene3D from '@/components/Scene3D';
import Scene3DControls from '@/components/Scene3DControls';
import ConfigPanel from '@/components/ConfigPanel';
import Ribbon from '@/components/Ribbon';
import LayerPanel from '@/components/LayerPanel';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Layers } from 'lucide-react';

export default function Workspace() {
  const [showDataPanel, setShowDataPanel] = useState(true);
  const [showConfigPanel, setShowConfigPanel] = useState(true);
  const chartConfig = usePlotStore((s) => s.chartConfig);
  const theme = usePlotStore((s) => s.theme);

  // Sync theme to document root so CSS variables are available globally
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const is3D = ['surface3d', 'scatter3d', 'contour3d', 'bar3d'].includes(chartConfig.type);

  return (
    <div data-theme={theme} className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Ribbon toolbar */}
      <Ribbon />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Data panel */}
        {showDataPanel && (
          <div className="w-72 flex flex-col shrink-0" style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
            <div className="flex items-center justify-between px-2 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>数据表格</span>
              <button onClick={() => setShowDataPanel(false)} style={{ color: 'var(--text-faint)' }} className="hover:opacity-80">
                <PanelLeftClose size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <DataTable />
            </div>
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <Layers size={12} style={{ color: 'var(--text-faint)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>图层管理</span>
              </div>
              <div className="max-h-48 overflow-y-auto p-2">
                <LayerPanel />
              </div>
            </div>
          </div>
        )}

        {/* Chart canvas */}
        <div className="flex-1 relative overflow-hidden" data-chart-area>
          {!showDataPanel && (
            <button
              onClick={() => setShowDataPanel(true)}
              className="absolute top-2 left-2 z-10 transition-colors"
              style={{ color: 'var(--text-faint)' }}
            >
              <PanelLeftOpen size={16} />
            </button>
          )}
          <div className="w-full h-full">
            {is3D ? (
              <div className="relative w-full h-full">
                <Scene3D />
                <Scene3DControls />
              </div>
            ) : (
              <Chart2D />
            )}
          </div>
        </div>

        {/* Config panel */}
        {showConfigPanel && (
          <div className="w-64 flex flex-col shrink-0" style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
            <div className="flex items-center justify-between px-2 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>图表配置</span>
              <button onClick={() => setShowConfigPanel(false)} style={{ color: 'var(--text-faint)' }} className="hover:opacity-80">
                <PanelRightClose size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ConfigPanel />
            </div>
          </div>
        )}
      </div>

      {!showConfigPanel && (
        <button
          onClick={() => setShowConfigPanel(true)}
          className="fixed right-2 top-20 z-10 transition-colors"
          style={{ color: 'var(--text-faint)' }}
        >
          <PanelRightOpen size={16} />
        </button>
      )}
    </div>
  );
}
