import { useState, useEffect } from 'react';
import { useUiStore } from '@/store/uiStore';
import { useDatasetStore } from '@/store/datasetStore';
import { useChartStore } from '@/store/chartStore';
import { useHistoryStore } from '@/store/historyStore';
import { useAnnotationToolStore } from '@/store/plotStore';
import { useChartInteractionStore } from '@/store/chartInteractionStore';
import { useTranslation } from 'react-i18next';
import type { ChartType } from '@/types';
import DataTable from '@/components/DataTable';
import ChartView from '@/components/ChartView';
import ConfigPanel from '@/components/ConfigPanel';
import Ribbon from '@/components/Ribbon';
import { FitResultsBar } from '@/components/FitResultsBar';
import LayerPanel from '@/components/LayerPanel';
import FloatingPanel from '@/components/FloatingPanel';

import { ContextMenuOverlay } from '@/components/ContextMenu';
import ToastContainer from '@/components/Toast';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Maximize2 } from 'lucide-react';
import { serializeProject, saveProjectFile } from '@/utils/projectFile';
import type { Annotation } from '@/types';
import { uid } from '@/utils/sampleData';

let annotationClipboard: Annotation | null = null;

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
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [showConfigPanel, setShowConfigPanel] = useState(true);
  const [dataTablePopout, setDataTablePopout] = useState(false);
  const [mainTab, setMainTab] = useState<'chart' | 'data'>('chart');
  const [layerPanelWidth, setLayerPanelWidth] = useState(180);
  const [rightWidth, setRightWidth] = useState(280);
  const [resizing, setResizing] = useState<'layerPanel' | 'configPanel' | null>(null);
  const theme = useUiStore((s) => s.theme);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const pastLength = useHistoryStore((s) => s._past.length);
  const futureLength = useHistoryStore((s) => s._future.length);

  const annotations = useChartStore((s) => s.chartConfig.annotations);
  const addAnnotation = useChartStore((s) => s.addAnnotation);
  const duplicateAnnotation = useChartStore((s) => s.duplicateAnnotation);
  const selectedAnnotationId = useAnnotationToolStore((s) => s.selectedId);
  const setSelectedAnnotationId = useAnnotationToolStore((s) => s.setSelectedId);
  const setActiveAnnotationTool = useAnnotationToolStore((s) => s.setActiveTool);

  // Sync theme to document root so CSS variables are available globally
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Resizable panel tracking
  useEffect(() => {
    if (!resizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (resizing === 'layerPanel') {
        setLayerPanelWidth(Math.max(120, Math.min(400, e.clientX)));
      } else if (resizing === 'configPanel') {
        setRightWidth(Math.max(200, Math.min(500, window.innerWidth - e.clientX)));
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

  // Keyboard shortcuts for undo/redo, save, and common actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
      const isCtrl = e.ctrlKey || e.metaKey;

      // Undo / Redo / Save (work everywhere)
      if (isCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (pastLength > 0) undo();
        return;
      }
      if (isCtrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (futureLength > 0) redo();
        return;
      }
      if (isCtrl && e.key === 's') {
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
        return;
      }

      // Ctrl+O: Import data (trigger file input)
      if (isCtrl && e.key === 'o') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('input[accept=".csv,.xlsx,.xls"]');
        input?.click();
        return;
      }

      // Ctrl+E: Quick export PNG (trigger the quick toolbar export button)
      if (isCtrl && e.key === 'e') {
        e.preventDefault();
        const btn = document.querySelector<HTMLButtonElement>('[data-quick-export-png]');
        btn?.click();
        return;
      }

      // Ctrl+L: Add new layer
      if (isCtrl && e.key === 'l') {
        e.preventDefault();
        const dsState = useDatasetStore.getState();
        const chartState = useChartStore.getState();
        const ds = dsState.datasets.find((d) => d.id === dsState.activeDatasetId) ?? dsState.datasets[0];
        if (ds) {
          const xCol = ds.columns.find((c) => c.type === 'X') ?? ds.columns[0];
          const yCol = ds.columns.find((c) => c.type === 'Y') ?? ds.columns[1];
          if (xCol && yCol) {
            chartState.addLayer({
              id: Math.random().toString(36).slice(2),
              datasetId: ds.id,
              xColumn: xCol.id,
              yColumn: yCol.id,
              color: `hsl(${Math.random() * 360}, 70%, 55%)`,
              visible: true,
              lineStyle: 'solid',
              lineWidth: 3,
              pointStyle: 'circle',
              pointSize: 6,
              fill: false,
              fillOpacity: 0.35,
            });
          }
        }
        return;
      }

      // Ctrl+F: Open find dialog (dispatch custom event for DataTable)
      if (isCtrl && e.key === 'f') {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('datatable-find-open'));
        return;
      }

      // Ctrl+0: Reset chart zoom
      if (isCtrl && e.key === '0') {
        e.preventDefault();
        const plotDiv = document.querySelector('.js-plotly-plot');
        if (plotDiv) {
          import('plotly.js-dist-min').then((Plotly) => {
            Plotly.default.relayout(plotDiv, {
              'xaxis.autorange': true,
              'yaxis.autorange': true,
            });
          });
        }
        return;
      }

      // Ctrl++ / Ctrl+=: Zoom in chart
      if (isCtrl && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        const plotDiv = document.querySelector('.js-plotly-plot');
        if (plotDiv) {
          import('plotly.js-dist-min').then((Plotly) => {
            // Zoom in by 20% around center
            const layout = (plotDiv as HTMLElement & { layout?: Record<string, unknown> }).layout;
            const xaxis = layout?.xaxis as { range?: [number, number] } | undefined;
            const yaxis = layout?.yaxis as { range?: [number, number] } | undefined;
            if (xaxis?.range && yaxis?.range) {
              const [x0, x1] = xaxis.range;
              const [y0, y1] = yaxis.range;
              const xMid = (x0 + x1) / 2;
              const yMid = (y0 + y1) / 2;
              const xRange = (x1 - x0) * 0.4;
              const yRange = (y1 - y0) * 0.4;
              Plotly.default.relayout(plotDiv, {
                'xaxis.range': [xMid - xRange, xMid + xRange],
                'yaxis.range': [yMid - yRange, yMid + yRange],
              });
            }
          });
        }
        return;
      }

      // Ctrl+-: Zoom out chart
      if (isCtrl && e.key === '-') {
        e.preventDefault();
        const plotDiv = document.querySelector('.js-plotly-plot');
        if (plotDiv) {
          import('plotly.js-dist-min').then((Plotly) => {
            const layout = (plotDiv as HTMLElement & { layout?: Record<string, unknown> }).layout;
            const xaxis = layout?.xaxis as { range?: [number, number] } | undefined;
            const yaxis = layout?.yaxis as { range?: [number, number] } | undefined;
            if (xaxis?.range && yaxis?.range) {
              const [x0, x1] = xaxis.range;
              const [y0, y1] = yaxis.range;
              const xMid = (x0 + x1) / 2;
              const yMid = (y0 + y1) / 2;
              const xRange = (x1 - x0) * 0.625;
              const yRange = (y1 - y0) * 0.625;
              Plotly.default.relayout(plotDiv, {
                'xaxis.range': [xMid - xRange, xMid + xRange],
                'yaxis.range': [yMid - yRange, yMid + yRange],
              });
            }
          });
        }
        return;
      }

      // Ctrl+1~9: Switch chart type
      if (isCtrl && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const chartTypes: ChartType[] = ['line', 'scatter', 'bar', 'area', 'pie', 'polar', 'surface3d', 'scatter3d', 'contour3d'];
        const idx = parseInt(e.key, 10) - 1;
        if (idx < chartTypes.length) {
          useChartStore.getState().setChartType(chartTypes[idx]);
        }
        return;
      }

      // Ctrl+A: Select all (only when not in an input, or when in the data table)
      if (isCtrl && e.key === 'a' && !isInputFocused) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('datatable-select-all'));
        return;
      }

      // Annotation shortcuts (only when chart tab is active and not in an input)
      if (mainTab === 'chart' && !isInputFocused) {
        // Tool selection single-letter shortcuts
        if (!isCtrl && e.key === 'v') {
          e.preventDefault();
          setActiveAnnotationTool('select');
          return;
        }
        if (!isCtrl && e.key === 't') {
          e.preventDefault();
          setActiveAnnotationTool('text');
          return;
        }
        if (!isCtrl && e.key === 'a') {
          e.preventDefault();
          setActiveAnnotationTool('arrow');
          return;
        }
        if (!isCtrl && e.key === 'r') {
          e.preventDefault();
          setActiveAnnotationTool('rect');
          return;
        }
        if (!isCtrl && e.key === 'l') {
          e.preventDefault();
          setActiveAnnotationTool('line');
          return;
        }

        // Copy / duplicate selected annotation
        if (isCtrl && e.key === 'c' && selectedAnnotationId) {
          e.preventDefault();
          const ann = annotations.find((a) => a.id === selectedAnnotationId);
          if (ann) annotationClipboard = JSON.parse(JSON.stringify(ann));
          return;
        }
        if (isCtrl && e.key === 'v' && annotationClipboard) {
          e.preventDefault();
          const copy: Annotation = JSON.parse(JSON.stringify(annotationClipboard));
          copy.id = uid();
          copy.x += 2;
          copy.y += 2;
          addAnnotation(copy);
          setSelectedAnnotationId(copy.id);
          return;
        }
        if (isCtrl && e.key === 'd' && selectedAnnotationId) {
          e.preventDefault();
          duplicateAnnotation(selectedAnnotationId);
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, pastLength, futureLength, mainTab, annotations, selectedAnnotationId, addAnnotation, duplicateAnnotation, setActiveAnnotationTool, setSelectedAnnotationId]);

  return (
    <div data-theme={theme} className="flex flex-col h-screen overflow-hidden relative" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }} onContextMenu={(e) => e.preventDefault()}>
      <ContextMenuOverlay />
      {/* Ribbon toolbar */}
      <Ribbon />

      {/* Fit results summary bar (separate from ribbon to keep ribbon height fixed) */}
      <FitResultsBar />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Layer panel (left) */}
        {showLayerPanel && (
          <div className="flex flex-col shrink-0" style={{ width: layerPanelWidth, borderRight: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
            <div className="flex items-center justify-between px-2 py-1.5 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('workspace.layerManage')}</span>
              <button onClick={() => setShowLayerPanel(false)} style={{ color: 'var(--text-faint)' }} className="hover:opacity-80" aria-label={t('workspace.closeLayerPanel', 'Close layer panel')}>
                <PanelLeftClose size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <LayerPanel />
            </div>
          </div>
        )}
        {showLayerPanel && (
          <div
            className="w-1 cursor-col-resize hover:bg-sky-500/30 transition-colors shrink-0"
            onMouseDown={() => setResizing('layerPanel')}
          />
        )}

        {/* Main content with Chart | Data tabs */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Tab strip */}
          <div className="flex items-center shrink-0 px-1 py-1" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
            <button
              onClick={() => setMainTab('chart')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors"
              style={{
                color: mainTab === 'chart' ? 'var(--accent)' : 'var(--text-muted)',
                background: mainTab === 'chart' ? 'var(--bg-surface-hover)' : 'transparent',
              }}
              onMouseEnter={(e) => { if (mainTab !== 'chart') e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { if (mainTab !== 'chart') e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              {t('workspace.chart')}
            </button>
            <button
              onClick={() => setMainTab('data')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors"
              style={{
                color: mainTab === 'data' ? 'var(--accent)' : 'var(--text-muted)',
                background: mainTab === 'data' ? 'var(--bg-surface-hover)' : 'transparent',
              }}
              onMouseEnter={(e) => { if (mainTab !== 'data') e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { if (mainTab !== 'data') e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              {t('workspace.dataTable')}
            </button>
            <div className="flex-1" />
            {mainTab === 'data' && (
              <button
                onClick={() => setDataTablePopout(true)}
                style={{ color: 'var(--text-faint)' }}
                className="p-1 rounded hover:opacity-80"
                aria-label={t('workspace.popoutDataTable', 'Pop out Data Table')}
              >
                <Maximize2 size={14} />
              </button>
            )}
            {!showLayerPanel && mainTab === 'chart' && (
              <button
                onClick={() => setShowLayerPanel(true)}
                style={{ color: 'var(--text-faint)' }}
                className="p-1 rounded hover:opacity-80"
                aria-label={t('workspace.openLayerPanel', 'Open layer panel')}
              >
                <PanelLeftOpen size={14} />
              </button>
            )}
          </div>

          {/* Chart type suggestion bar */}
          <ChartTypeSuggestionBar />

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {mainTab === 'chart' && (
              <div className="w-full h-full">
                <ChartView />
              </div>
            )}
            {mainTab === 'data' && (
              dataTablePopout ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>{t('workspace.dataTablePoppedOut', 'Data Table is open in floating window')}</span>
                  <button
                    onClick={() => setDataTablePopout(false)}
                    className="px-2 py-1 rounded text-xs transition-colors"
                    style={{ color: 'var(--accent)', border: '1px solid var(--border)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {t('workspace.restoreDataTable', 'Restore')}
                  </button>
                </div>
              ) : (
                <DataTable showToolbar />
              )
            )}
          </div>
        </div>

        {/* Config panel (right) */}
        {showConfigPanel && (
          <div
            className="w-1 cursor-col-resize hover:bg-sky-500/30 transition-colors shrink-0"
            onMouseDown={() => setResizing('configPanel')}
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
      {dataTablePopout && (
        <FloatingPanel
          title={t('workspace.dataTable')}
          onClose={() => setDataTablePopout(false)}
        >
          <DataTable showToolbar />
        </FloatingPanel>
      )}
      <StatusBar />
      <ToastContainer />
    </div>
  );
}
