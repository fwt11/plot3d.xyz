import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileTab } from './ribbon/FileTab';
import { GenerateTab } from './ribbon/GenerateTab';
import { TransformTab } from './ribbon/TransformTab';
import { ChartTab } from './ribbon/ChartTab';
import { AnnotationTab } from './ribbon/AnnotationTab';

// ─── Ribbon Tab Types ───────────────────────────────────────────
type RibbonTab = 'file' | 'generate' | 'transform' | 'chart' | 'annotation';

// ─── Main Ribbon Component ──────────────────────────────────────
export default function Ribbon() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<RibbonTab>('chart');

  const tabs: { key: RibbonTab; label: string }[] = [
    { key: 'file', label: t('ribbon.file') },
    { key: 'generate', label: t('ribbon.generate') },
    { key: 'transform', label: t('ribbon.transform') },
    { key: 'chart', label: t('ribbon.chart') },
    { key: 'annotation', label: t('ribbon.annotation') },
  ];

  return (
    <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }} className="select-none">
      {/* Tab headers */}
      <div className="flex items-end px-2 pt-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 text-xs font-medium rounded-t transition-colors ${
              activeTab === tab.key
                ? 'border-t border-x -mb-px'
                : 'hover:opacity-80'
            }`}
            style={activeTab === tab.key ? {
              background: 'var(--bg-input)',
              color: 'var(--accent)',
              borderColor: 'var(--border)',
              borderBottomColor: 'var(--bg-input)',
            } : {
              color: 'var(--text-muted)',
            }}
            aria-label={tab.label}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-2 py-1 min-h-[56px] flex items-center" style={{ background: 'var(--bg-input)', borderTop: '1px solid var(--border)' }}>
        {activeTab === 'file' && <FileTab />}
        {activeTab === 'generate' && <GenerateTab />}
        {activeTab === 'transform' && <TransformTab />}
        {activeTab === 'chart' && <ChartTab />}
        {activeTab === 'annotation' && <AnnotationTab />}
      </div>
    </div>
  );
}
