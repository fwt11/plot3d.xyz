import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileTab } from './ribbon/FileTab';
import { GenerateTab } from './ribbon/GenerateTab';
import { TransformTab } from './ribbon/TransformTab';
import { ChartTab } from './ribbon/ChartTab';
import { AnnotationTab } from './ribbon/AnnotationTab';
import { FitTab } from './ribbon/FitTab';
import { StatsTab } from './ribbon/StatsTab';
import { HistoryPanel } from './HistoryPanel';
import { useUiStore } from '@/store/uiStore';
import { useDatasetStore } from '@/store/datasetStore';
import { useChartStore } from '@/store/chartStore';
import { useHistoryStore } from '@/store/historyStore';
import { useToastStore } from '@/store/toastStore';
import { is3DChart } from '@/utils/chart';
import { uid } from '@/utils/sampleData';
import { buildExportPayload } from '@/utils/exportLayout';
import { Download, FileUp, Plus, ChevronsDownUp, ChevronsUpDown, Undo2, Redo2, History, Sun, Moon, Languages } from 'lucide-react';
import Plotly from 'plotly.js-dist-min';

// ─── Ribbon Tab Types ───────────────────────────────────────────
type RibbonTab = 'file' | 'generate' | 'transform' | 'stats' | 'fit' | 'chart' | 'annotation';

const RIBBON_TAB_KEY = 'plot3d-ribbon-tab';

function readStoredTab(): RibbonTab {
  try {
    const stored = localStorage.getItem(RIBBON_TAB_KEY);
    if (stored && ['file', 'generate', 'transform', 'stats', 'fit', 'chart', 'annotation'].includes(stored)) {
      return stored as RibbonTab;
    }
  } catch {
    // ignore
  }
  return 'chart';
}

// ─── Quick Toolbar ──────────────────────────────────────────────
function QuickToolbar() {
  const { t } = useTranslation();
  const chartConfig = useChartStore((s) => s.chartConfig);
  const chartType = chartConfig.type;
  const exportConfig = chartConfig.exportConfig;
  const addToast = useToastStore((s) => s.addToast);
  const datasets = useDatasetStore((s) => s.datasets);
  const activeDatasetId = useDatasetStore((s) => s.activeDatasetId);
  const addLayer = useChartStore((s) => s.addLayer);

  // Quick import: trigger the hidden file input in FileTab
  const handleQuickImport = () => {
    const input = document.querySelector<HTMLInputElement>('input[accept=".csv,.xlsx,.xls"]');
    input?.click();
  };

  // Quick export PNG
  const handleQuickExportPNG = async () => {
    const is3D = is3DChart(chartType);
    const bgColor = exportConfig.background === 'transparent' ? undefined : exportConfig.background === 'white' ? '#ffffff' : undefined;
    try {
      if (!is3D) {
        const div = document.querySelector('.js-plotly-plot') as HTMLElement | null;
        if (div) {
          const { data, layout, width, height } = buildExportPayload(div, chartConfig, 2);
          const dataUrl = await Plotly.toImage({ data, layout }, {
            format: 'png',
            scale: exportConfig.resolutionMultiplier,
            width,
            height,
            bgcolor: bgColor ?? 'rgba(0,0,0,0)',
          });
          const link = document.createElement('a');
          link.download = 'chart.png';
          link.href = dataUrl;
          link.click();
          addToast(t('toast.exportSuccess'), 'success');
          return;
        }
      }
      // Fallback: dispatch a click on the FileTab PNG button
      const btn = document.querySelector<HTMLButtonElement>('[data-quick-export-png]');
      btn?.click();
    } catch {
      addToast(t('toast.exportFailed'), 'error');
    }
  };

  // Quick add layer
  const handleQuickAddLayer = () => {
    const ds = datasets.find((d) => d.id === activeDatasetId) ?? datasets[0];
    if (!ds) return;
    const xCol = ds.columns.find((c) => c.type === 'X') ?? ds.columns[0];
    const yCol = ds.columns.find((c) => c.type === 'Y') ?? ds.columns[1];
    if (xCol && yCol) {
      addLayer({
        id: uid(),
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
      });
      addToast(t('layer.addLayer'), 'success');
    }
  };

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={handleQuickImport}
        className="flex items-center justify-center w-6 h-6 rounded transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        title={t('file.importData') + ' (Ctrl+O)'}
        aria-label={t('file.importData')}
      >
        <FileUp size={14} />
      </button>
      <button
        onClick={handleQuickExportPNG}
        className="flex items-center justify-center w-6 h-6 rounded transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        title={t('file.exportPng') + ' (Ctrl+E)'}
        aria-label={t('file.exportPng')}
      >
        <Download size={14} />
      </button>
      <button
        onClick={handleQuickAddLayer}
        className="flex items-center justify-center w-6 h-6 rounded transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        title={t('layer.addLayer') + ' (Ctrl+L)'}
        aria-label={t('layer.addLayer')}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

// ─── Main Ribbon Component ──────────────────────────────────────
export default function Ribbon() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<RibbonTab>(readStoredTab);
  const [collapsed, setCollapsed] = useState(false);

  // Global controls state
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const lang = useUiStore((s) => s.lang);
  const setLang = useUiStore((s) => s.setLang);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const pastLength = useHistoryStore((s) => s._past.length);
  const futureLength = useHistoryStore((s) => s._future.length);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // Persist active tab to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(RIBBON_TAB_KEY, activeTab);
    } catch {
      // ignore
    }
  }, [activeTab]);

  const tabs: { key: RibbonTab; label: string }[] = [
    { key: 'file', label: t('ribbon.file') },
    { key: 'generate', label: t('ribbon.generate') },
    { key: 'transform', label: t('ribbon.transform') },
    { key: 'stats', label: t('ribbon.stats') },
    { key: 'fit', label: t('ribbon.fit') },
    { key: 'chart', label: t('ribbon.chart') },
    { key: 'annotation', label: t('ribbon.annotation') },
  ];

  return (
    <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }} className="select-none">
      {/* Tab headers + Quick toolbar + Global controls */}
      <div className="flex items-center px-2" style={{ height: 32 }}>
        <div className="flex items-end">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                if (collapsed) setCollapsed(false);
              }}
              onDoubleClick={() => setCollapsed((c) => !c)}
              className={`px-3 py-1 text-xs font-medium rounded-t transition-colors ${
                activeTab === tab.key && !collapsed
                  ? 'border-t border-x -mb-px'
                  : 'hover:opacity-80'
              }`}
              style={activeTab === tab.key && !collapsed ? {
                background: 'var(--bg-input)',
                color: 'var(--accent)',
                borderColor: 'var(--border)',
                borderBottomColor: 'var(--bg-input)',
              } : {
                color: 'var(--text-muted)',
              }}
              aria-label={tab.label}
              title={t('ribbon.doubleClickToCollapse', 'Double-click to collapse/expand')}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <QuickToolbar />
          <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} className="mx-1" />
          <button
            onClick={undo}
            disabled={pastLength === 0}
            className="flex items-center justify-center w-6 h-6 rounded transition-colors disabled:opacity-30"
            style={{ color: 'var(--text-secondary)' }}
            title={t('workspace.undo', 'Undo') + ' (Ctrl+Z)'}
            aria-label={t('workspace.undo', 'Undo')}
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={redo}
            disabled={futureLength === 0}
            className="flex items-center justify-center w-6 h-6 rounded transition-colors disabled:opacity-30"
            style={{ color: 'var(--text-secondary)' }}
            title={t('workspace.redo', 'Redo') + ' (Ctrl+Y)'}
            aria-label={t('workspace.redo', 'Redo')}
          >
            <Redo2 size={14} />
          </button>
          <button
            onClick={() => setShowHistoryPanel(true)}
            className="flex items-center justify-center w-6 h-6 rounded transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title={t('history.title', 'History')}
            aria-label={t('history.title', 'History')}
          >
            <History size={14} />
          </button>
          <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} className="mx-1" />
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-6 h-6 rounded transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title={theme === 'dark' ? t('file.switchLight') : t('file.switchDark')}
            aria-label={theme === 'dark' ? t('file.switchLight') : t('file.switchDark')}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            className="flex items-center justify-center w-6 h-6 rounded transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title={t('language.switch')}
            aria-label={t('language.switch')}
          >
            <Languages size={14} />
          </button>
          <span className="text-xs font-medium px-1" style={{ color: 'var(--text-muted)' }}>
            {lang === 'zh' ? '中' : 'EN'}
          </span>
          <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} className="mx-1" />
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center justify-center w-6 h-6 rounded transition-colors"
            style={{ color: 'var(--text-faint)' }}
            title={collapsed ? t('ribbon.expand', 'Expand') : t('ribbon.collapse', 'Collapse')}
            aria-label={collapsed ? t('ribbon.expand', 'Expand') : t('ribbon.collapse', 'Collapse')}
          >
            {collapsed ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
          </button>
        </div>
      </div>

      {/* Tab content */}
      {!collapsed && (
        <div className="px-2 py-1 min-h-[52px] flex items-center" style={{ background: 'var(--bg-input)', borderTop: '1px solid var(--border)' }}>
          {activeTab === 'file' && <FileTab />}
          {activeTab === 'generate' && <GenerateTab />}
          {activeTab === 'transform' && <TransformTab />}
          {activeTab === 'stats' && <StatsTab />}
          {activeTab === 'fit' && <FitTab />}
          {activeTab === 'chart' && <ChartTab />}
          {activeTab === 'annotation' && <AnnotationTab />}
        </div>
      )}

      {/* History panel overlay inside ribbon area */}
      {showHistoryPanel && (
        <HistoryPanel onClose={() => setShowHistoryPanel(false)} />
      )}
    </div>
  );
}
