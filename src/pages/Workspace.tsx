import { useState, useEffect } from 'react';
import { useUiStore } from '@/store/uiStore';
import { useDatasetStore } from '@/store/datasetStore';
import { useChartStore } from '@/store/chartStore';
import { useHistoryStore } from '@/store/historyStore';
import { useChartInteractionStore } from '@/store/chartInteractionStore';
import { useTranslation } from 'react-i18next';
import DataTable from '@/components/DataTable';
import ChartView from '@/components/ChartView';
import ConfigPanel from '@/components/ConfigPanel';
import Ribbon from '@/components/Ribbon';
import LayerPanel from '@/components/LayerPanel';
import { ContextMenuOverlay } from '@/components/ContextMenu';
import ToastContainer from '@/components/Toast';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Layers, Sun, Moon, Languages, Undo2, Redo2 } from 'lucide-react';
import { serializeProject, saveProjectFile } from '@/utils/projectFile';

function ChartTypeSuggestionBar() {
  const { t } = useTranslation();
  const pendingChartTypeSuggestion = useDatasetStore((s) => s.pendingChartTypeSuggestion);
  const acceptChartTypeSuggestion = useDatasetStore((s) => s.acceptChartTypeSuggestion);
  const dismissChartTypeSuggestion = useDatasetStore((s) => s.dismissChartTypeSuggestion);

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

function StatusBar() {
  const chartType = useChartStore((s) => s.chartConfig.type);
  const layers = useChartStore((s) => s.chartConfig.layers);
  const datasets = useDatasetStore((s) => s.datasets);
  const activeDatasetId = useDatasetStore((s) => s.activeDatasetId);
  const hover = useChartInteractionStore((s) => s.hover);
  const zoom = useChartInteractionStore((s) => s.zoom);
  const { t } = useTranslation();

  const activeDs = datasets.find(d => d.id === activeDatasetId);
  const rowCount = activeDs ? Math.max(...activeDs.columns.map(c => c.values.length), 0) : 0;

  // Memory usage (Chrome-only, optional)
  const [memMB, setMemMB] = useState<number | null>(null);
  useEffect(() => {
    const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
    if (!perf.memory) return;
    const update = () => setMemMB(perf.memory!.usedJSHeapSize / 1024 / 1024);
    update();
    const id = setInterval(update, 2000);
    return () => clearInterval(id);
  }, []);

  const fmt = (v: number | string | undefined) => {
    if (v === undefined) return '';
    if (typeof v === 'number') {
      if (!isFinite(v)) return String(v);
      return Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0)
        ? v.toExponential(2)
        : v.toPrecision(4).replace(/\.?0+$/, '');
    }
    return String(v);
  };

  const zoomLabel = zoom && (zoom.x0 !== undefined || zoom.y0 !== undefined)
    ? `x:[${fmt(zoom.x0)}..${fmt(zoom.x1)}] y:[${fmt(zoom.y0)}..${fmt(zoom.y1)}]`
    : null;

  return (
    <div className="flex items-center px-3 gap-4 text-xs shrink-0 overflow-hidden" style={{ height: 'var(--status-bar-height, 24px)', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
      <span>{t(`chartTypes.${chartType}`)}</span>
      <span>{activeDs?.name ?? '-'}</span>
      <span>{rowCount} {t('workspace.rows')}</span>
      <span>{layers.length} {t('workspace.layers')}</span>
      {hover && (
        <span title={t('workspace.cursor')}>
          {t('workspace.cursor')}: ({fmt(hover.x)}, {fmt(hover.y)}{hover.z !== undefined ? `, ${fmt(hover.z)}` : ''})
        </span>
      )}
      {zoomLabel && (
        <span title={t('workspace.zoom')} className="truncate" style={{ maxWidth: 360 }}>
          {t('workspace.zoom')}: {zoomLabel}
        </span>
      )}
      {memMB !== null && (
        <span className="ml-auto" title={t('workspace.mem')}>
          {t('workspace.mem')}: {memMB.toFixed(0)} MB
        </span>
      )}
    </div>
  );
}

export default function Workspace() {
  const { t } = useTranslation();
  const [showDataPanel, setShowDataPanel] = useState(true);
  const [showConfigPanel, setShowConfigPanel] = useState(true);
  const [leftWidth, setLeftWidth] = useState(288);
  const [rightWidth, setRightWidth] = useState(256);
  const [layerPanelHeight, setLayerPanelHeight] = useState(220);
  const [resizing, setResizing] = useState<'left' | 'right' | 'layer' | null>(null);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const lang = useUiStore((s) => s.lang);
  const setLang = useUiStore((s) => s.setLang);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const pastLength = useHistoryStore((s) => s._past.length);
  const futureLength = useHistoryStore((s) => s._future.length);

  // Sync theme to document root so CSS variables are available globally
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Resizable panel tracking
  useEffect(() => {
    if (!resizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (resizing === 'left') {
        setLeftWidth(Math.max(200, Math.min(500, e.clientX)));
      } else if (resizing === 'right') {
        setRightWidth(Math.max(200, Math.min(500, window.innerWidth - e.clientX)));
      } else if (resizing === 'layer') {
        // Distance from viewport bottom to the layer panel top
        const dataPanelEl = document.getElementById('data-panel-container');
        if (!dataPanelEl) return;
        const rect = dataPanelEl.getBoundingClientRect();
        const newHeight = Math.max(120, Math.min(rect.height - 120, rect.bottom - e.clientY));
        setLayerPanelHeight(newHeight);
      }
    };
    const handleMouseUp = () => setResizing(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  // Keyboard shortcuts for undo/redo and save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (pastLength > 0) undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (futureLength > 0) redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const dsState = useDatasetStore.getState();
        const chartState = useChartStore.getState();
        const uiState = useUiStore.getState();
        const project = serializeProject({
          datasets: dsState.datasets,
          chartConfig: chartState.chartConfig,
          theme: uiState.theme,
          lang: uiState.lang,
        });
        const title = chartState.chartConfig.title || 'untitled';
        saveProjectFile(project, title);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, pastLength, futureLength]);

  return (
    <div data-theme={theme} className="flex flex-col h-screen overflow-hidden relative" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }} onContextMenu={(e) => e.preventDefault()}>
      <ContextMenuOverlay />
      {/* Theme & Language controls - page top right */}
      <div role="toolbar" aria-label={t('workspace.toolbar', 'Toolbar')} className="absolute top-2 right-2 flex items-center gap-1 rounded-md px-1.5 py-1" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', zIndex: 'var(--z-top)' }}>
        <button
          onClick={undo}
          disabled={pastLength === 0}
          className="flex items-center justify-center w-7 h-7 rounded transition-colors disabled:opacity-30"
          style={{ color: 'var(--text-secondary)' }}
          title={t('workspace.undo', 'Undo') + ' (Ctrl+Z)'}
          aria-label={t('workspace.undo', 'Undo')}
        >
          <Undo2 size={15} />
        </button>
        <button
          onClick={redo}
          disabled={futureLength === 0}
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
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {lang === 'zh' ? '中' : 'EN'}
        </span>
      </div>

      {/* Ribbon toolbar */}
      <Ribbon />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Data panel */}
        {showDataPanel && (
          <div id="data-panel-container" className="flex flex-col shrink-0" style={{ width: leftWidth, borderRight: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
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
              <div style={{ height: layerPanelHeight }} className="overflow-y-auto p-2">
                <LayerPanel />
              </div>
              <div
                className="h-1 cursor-row-resize hover:bg-sky-500/30 transition-colors"
                onMouseDown={() => setResizing('layer')}
                style={{ borderTop: '1px solid var(--border)' }}
              />
            </div>
          </div>
        )}
        {showDataPanel && (
          <div
            className="w-1 cursor-col-resize hover:bg-sky-500/30 transition-colors shrink-0"
            onMouseDown={() => setResizing('left')}
          />
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
            <ChartView />
          </div>
        </div>

        {/* Config panel */}
        {showConfigPanel && (
          <div
            className="w-1 cursor-col-resize hover:bg-sky-500/30 transition-colors shrink-0"
            onMouseDown={() => setResizing('right')}
          />
        )}
        {showConfigPanel && (
          <div className="flex flex-col shrink-0" style={{ width: rightWidth, borderLeft: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
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
      <StatusBar />
      <ToastContainer />
    </div>
  );
}
