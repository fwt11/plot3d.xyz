import { useState, useEffect } from 'react';
import { usePlotStore } from '@/store/plotStore';
import { useTranslation } from 'react-i18next';
import DataTable from '@/components/DataTable';
import Chart2D from '@/components/Chart2D';
import Scene3D from '@/components/Scene3D';
import Scene3DControls from '@/components/Scene3DControls';
import ConfigPanel from '@/components/ConfigPanel';
import Ribbon from '@/components/Ribbon';
import LayerPanel from '@/components/LayerPanel';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Layers, Sun, Moon, Languages, Undo2, Redo2 } from 'lucide-react';

function ChartTypeSuggestionBar() {
  const { t } = useTranslation();
  const pendingChartTypeSuggestion = usePlotStore((s) => s.pendingChartTypeSuggestion);
  const acceptChartTypeSuggestion = usePlotStore((s) => s.acceptChartTypeSuggestion);
  const dismissChartTypeSuggestion = usePlotStore((s) => s.dismissChartTypeSuggestion);

  if (!pendingChartTypeSuggestion) return null;

  const chartTypeName = t(`chartTypes.${pendingChartTypeSuggestion}`);

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 text-xs"
      style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        color: 'var(--text-secondary)',
      }}
    >
      <span>{t('workspace.zColumnDetected', { type: chartTypeName })}</span>
      <button
        onClick={acceptChartTypeSuggestion}
        className="px-2.5 py-0.5 rounded text-xs font-medium transition-colors"
        style={{
          background: 'rgba(14, 165, 233, 0.15)',
          color: '#0ea5e9',
          border: '1px solid rgba(14, 165, 233, 0.3)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(14, 165, 233, 0.25)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(14, 165, 233, 0.15)'; }}
      >
        {t('workspace.switchTo')}
      </button>
      <button
        onClick={dismissChartTypeSuggestion}
        className="px-2.5 py-0.5 rounded text-xs transition-colors"
        style={{
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(63,63,70,0.3)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
      >
        {t('workspace.dismiss')}
      </button>
    </div>
  );
}

export default function Workspace() {
  const { t } = useTranslation();
  const [showDataPanel, setShowDataPanel] = useState(true);
  const [showConfigPanel, setShowConfigPanel] = useState(true);
  const chartConfig = usePlotStore((s) => s.chartConfig);
  const theme = usePlotStore((s) => s.theme);
  const toggleTheme = usePlotStore((s) => s.toggleTheme);
  const lang = usePlotStore((s) => s.lang);
  const setLang = usePlotStore((s) => s.setLang);
  const undo = usePlotStore((s) => s.undo);
  const redo = usePlotStore((s) => s.redo);
  const canUndo = usePlotStore((s) => s.canUndo);
  const canRedo = usePlotStore((s) => s.canRedo);

  // Sync theme to document root so CSS variables are available globally
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Keyboard shortcuts for undo/redo and save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo()) redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  const is3D = ['surface3d', 'scatter3d', 'contour3d', 'bar3d'].includes(chartConfig.type);

  return (
    <div data-theme={theme} className="flex flex-col h-screen overflow-hidden relative" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Theme & Language controls - page top right */}
      <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md px-1.5 py-1" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', zIndex: 'var(--z-top)' }}>
        <button
          onClick={undo}
          disabled={!canUndo()}
          className="flex items-center justify-center w-7 h-7 rounded transition-colors disabled:opacity-30"
          style={{ color: 'var(--text-secondary)' }}
          title={t('workspace.undo', 'Undo') + ' (Ctrl+Z)'}
          aria-label={t('workspace.undo', 'Undo')}
        >
          <Undo2 size={15} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo()}
          className="flex items-center justify-center w-7 h-7 rounded transition-colors disabled:opacity-30"
          style={{ color: 'var(--text-secondary)' }}
          title={t('workspace.redo', 'Redo') + ' (Ctrl+Y)'}
          aria-label={t('workspace.redo', 'Redo')}
        >
          <Redo2 size={15} />
        </button>
        <div style={{ width: '1px', height: '14px', background: 'var(--border)' }} />
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-7 h-7 rounded transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          title={theme === 'dark' ? t('file.switchLight') : t('file.switchDark')}
          aria-label={theme === 'dark' ? t('file.switchLight') : t('file.switchDark')}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          className="flex items-center justify-center w-7 h-7 rounded transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          title={t('language.switch')}
          aria-label={t('language.switch')}
        >
          <Languages size={15} />
        </button>
        <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
          {lang === 'zh' ? '中' : 'EN'}
        </span>
      </div>

      {/* Ribbon toolbar */}
      <Ribbon />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Data panel */}
        {showDataPanel && (
          <div className="flex flex-col shrink-0" style={{ width: 'var(--panel-width-left)', borderRight: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
            <div className="flex items-center justify-between px-2 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('workspace.dataTable')}</span>
              <button onClick={() => setShowDataPanel(false)} style={{ color: 'var(--text-faint)' }} className="hover:opacity-80" aria-label={t('workspace.closeDataPanel', 'Close data panel')}>
                <PanelLeftClose size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <DataTable />
            </div>
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <Layers size={12} style={{ color: 'var(--text-faint)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('workspace.layerManage')}</span>
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
              className="absolute top-2 left-2 transition-colors"
              style={{ color: 'var(--text-faint)', zIndex: 'var(--z-panel)' }}
              aria-label={t('workspace.openDataPanel', 'Open data panel')}
            >
              <PanelLeftOpen size={16} />
            </button>
          )}
          <ChartTypeSuggestionBar />
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
          <div className="flex flex-col shrink-0" style={{ width: 'var(--panel-width-right)', borderLeft: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
            <div className="flex items-center justify-between px-2 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('workspace.chartConfig')}</span>
              <button onClick={() => setShowConfigPanel(false)} style={{ color: 'var(--text-faint)' }} className="hover:opacity-80" aria-label={t('workspace.closeConfigPanel', 'Close config panel')}>
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
          className="fixed right-2 transition-colors"
          style={{ color: 'var(--text-faint)', top: 'var(--ribbon-height)', zIndex: 'var(--z-panel)' }}
          aria-label={t('workspace.openConfigPanel', 'Open config panel')}
        >
          <PanelRightOpen size={16} />
        </button>
      )}
    </div>
  );
}
