import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileTab } from './ribbon/FileTab';
import { GenerateTab } from './ribbon/GenerateTab';
import { TransformTab } from './ribbon/TransformTab';
import { ChartTab } from './ribbon/ChartTab';
import { AnnotationTab } from './ribbon/AnnotationTab';
import { FitTab } from './ribbon/FitTab';
import { StatsTab } from './ribbon/StatsTab';
import { useDatasetStore } from '@/store/datasetStore';
import { useChartStore } from '@/store/chartStore';
import { useToastStore } from '@/store/toastStore';
import { is3DChart } from '@/utils/chart';
import { uid } from '@/utils/sampleData';
import { Download, FileUp, Plus, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
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
  const chartType = useChartStore((s) => s.chartConfig.type);
  const exportConfig = useChartStore((s) => s.chartConfig.exportConfig);
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
        const div = document.querySelector('.js-plotly-plot');
        if (div) {
          const dataUrl = await Plotly.toImage(div, {
            format: 'png',
            scale: exportConfig.resolutionMultiplier,
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
    <div className="flex items-center gap-1 px-2 py-1" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
      <button
        onClick={handleQuickImport}
        className="ribbon-btn"
        title={t('file.importData') + ' (Ctrl+O)'}
        aria-label={t('file.importData')}
      >
        <FileUp size={16} />
        <span className="text-xs">{t('file.importData')}</span>
      </button>
      <button
        onClick={handleQuickExportPNG}
        className="ribbon-btn"
        title={t('file.exportPng') + ' (Ctrl+E)'}
        aria-label={t('file.exportPng')}
      >
        <Download size={16} />
        <span className="text-xs">PNG</span>
      </button>
      <button
        onClick={handleQuickAddLayer}
        className="ribbon-btn"
        title={t('layer.addLayer') + ' (Ctrl+L)'}
        aria-label={t('layer.addLayer')}
      >
        <Plus size={16} />
        <span className="text-xs">{t('layer.addLayer')}</span>
      </button>
    </div>
  );
}

// ─── Main Ribbon Component ──────────────────────────────────────
export default function Ribbon() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<RibbonTab>(readStoredTab);
  const [collapsed, setCollapsed] = useState(false);

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
      {/* Quick toolbar */}
      <QuickToolbar />

      {/* Tab headers */}
      <div className="flex items-end px-2 pt-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              if (collapsed) setCollapsed(false);
            }}
            onDoubleClick={() => setCollapsed((c) => !c)}
            className={`px-4 py-1.5 text-xs font-medium rounded-t transition-colors ${
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
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto px-2 py-1 transition-colors"
          style={{ color: 'var(--text-faint)' }}
          title={collapsed ? t('ribbon.expand', 'Expand') : t('ribbon.collapse', 'Collapse')}
          aria-label={collapsed ? t('ribbon.expand', 'Expand') : t('ribbon.collapse', 'Collapse')}
        >
          {collapsed ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
        </button>
      </div>

      {/* Tab content */}
      {!collapsed && (
        <div className="px-2 py-1 min-h-[56px] flex items-center" style={{ background: 'var(--bg-input)', borderTop: '1px solid var(--border)' }}>
          {activeTab === 'file' && <FileTab />}
          {activeTab === 'generate' && <GenerateTab />}
          {activeTab === 'transform' && <TransformTab />}
          {activeTab === 'stats' && <StatsTab />}
          {activeTab === 'fit' && <FitTab />}
          {activeTab === 'chart' && <ChartTab />}
          {activeTab === 'annotation' && <AnnotationTab />}
        </div>
      )}
    </div>
  );
}
