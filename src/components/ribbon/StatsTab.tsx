import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatasetStore } from '@/store/plotStore';
import { useToastStore } from '@/store/toastStore';
import { toValidNumbers, describe, fmt, type DescriptiveStats } from '@/utils/statistics';
import { RibbonGroup } from './RibbonGroup';
import { Sigma, ChevronDown, ChevronUp, Copy, Download, Layers } from 'lucide-react';

export function StatsTab() {
  const { t } = useTranslation();
  const datasets = useDatasetStore((s) => s.datasets);
  const activeDatasetId = useDatasetStore((s) => s.activeDatasetId);
  const addToast = useToastStore((s) => s.addToast);

  const [statsResult, setStatsResult] = useState<StatsResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchStatsResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showBatchDetails, setShowBatchDetails] = useState(false);

  const activeDs = datasets.find((d) => d.id === activeDatasetId);

  // Numeric columns available for statistics
  const numericCols = useMemo(() => {
    if (!activeDs) return [];
    return activeDs.columns.filter((c) => {
      const nums = toValidNumbers(c.values);
      return nums.length > 0;
    });
  }, [activeDs]);

  const runStats = useCallback(() => {
    if (!activeDs) return;
    const results: ColumnStats[] = [];
    for (const col of activeDs.columns) {
      const nums = toValidNumbers(col.values);
      if (nums.length === 0) continue;
      results.push({
        columnName: col.name,
        columnId: col.id,
        type: col.type,
        stats: describe(nums),
      });
    }
    if (results.length === 0) {
      addToast(t('toast.statsNoData'), 'warning');
      return;
    }
    setStatsResult({ datasetName: activeDs.name, columns: results });
    setShowDetails(true);
  }, [activeDs, addToast, t]);

  const runBatchStats = useCallback(() => {
    if (datasets.length === 0) {
      addToast(t('toast.statsNoData'), 'warning');
      return;
    }
    const batchResults: BatchDatasetStats[] = [];
    for (const ds of datasets) {
      const colStats: ColumnStats[] = [];
      for (const col of ds.columns) {
        const nums = toValidNumbers(col.values);
        if (nums.length === 0) continue;
        colStats.push({
          columnName: col.name,
          columnId: col.id,
          type: col.type,
          stats: describe(nums),
        });
      }
      if (colStats.length > 0) {
        batchResults.push({ datasetId: ds.id, datasetName: ds.name, columns: colStats });
      }
    }
    if (batchResults.length === 0) {
      addToast(t('toast.statsNoData'), 'warning');
      return;
    }
    setBatchResult({ datasets: batchResults });
    setShowBatchDetails(true);
    addToast(t('toast.batchStatsDone', { count: batchResults.length, defaultValue: `Stats computed for ${batchResults.length} dataset(s)` }), 'success');
  }, [datasets, addToast, t]);

  const copyToClipboard = useCallback(async () => {
    if (!statsResult) return;
    const lines = [statsResult.datasetName];
    lines.push('Metric,' + statsResult.columns.map((c) => c.columnName).join(','));
    const metrics: { key: keyof DescriptiveStats; label: string }[] = [
      { key: 'count', label: 'Count' },
      { key: 'mean', label: 'Mean' },
      { key: 'stdDev', label: 'Std Dev' },
      { key: 'variance', label: 'Variance' },
      { key: 'stdError', label: 'Std Error' },
      { key: 'min', label: 'Min' },
      { key: 'q1', label: 'Q1' },
      { key: 'median', label: 'Median' },
      { key: 'q3', label: 'Q3' },
      { key: 'max', label: 'Max' },
      { key: 'range', label: 'Range' },
      { key: 'iqr', label: 'IQR' },
      { key: 'skewness', label: 'Skewness' },
      { key: 'kurtosis', label: 'Kurtosis' },
      { key: 'ci95Low', label: 'CI95 Low' },
      { key: 'ci95High', label: 'CI95 High' },
      { key: 'sum', label: 'Sum' },
    ];
    for (const m of metrics) {
      const row = m.label + ',' + statsResult.columns.map((c) => fmt(c.stats[m.key])).join(',');
      lines.push(row);
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      addToast(t('toast.copySuccess'), 'success');
    } catch {
      addToast(t('toast.copyFailed'), 'warning');
    }
  }, [statsResult, addToast, t]);

  const exportCSV = useCallback(() => {
    if (!statsResult) return;
    const lines = ['Metric,' + statsResult.columns.map((c) => c.columnName).join(',')];
    const metrics: { key: keyof DescriptiveStats; label: string }[] = [
      { key: 'count', label: 'Count' },
      { key: 'mean', label: 'Mean' },
      { key: 'stdDev', label: 'Std Dev' },
      { key: 'variance', label: 'Variance' },
      { key: 'stdError', label: 'Std Error' },
      { key: 'min', label: 'Min' },
      { key: 'q1', label: 'Q1' },
      { key: 'median', label: 'Median' },
      { key: 'q3', label: 'Q3' },
      { key: 'max', label: 'Max' },
      { key: 'range', label: 'Range' },
      { key: 'iqr', label: 'IQR' },
      { key: 'skewness', label: 'Skewness' },
      { key: 'kurtosis', label: 'Kurtosis' },
      { key: 'ci95Low', label: 'CI95 Low' },
      { key: 'ci95High', label: 'CI95 High' },
      { key: 'sum', label: 'Sum' },
    ];
    for (const m of metrics) {
      lines.push(m.label + ',' + statsResult.columns.map((c) => fmt(c.stats[m.key])).join(','));
    }
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stats_${statsResult.datasetName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast(t('toast.exportSuccess'), 'success');
  }, [statsResult, addToast, t]);

  const exportBatchCSV = useCallback(() => {
    if (!batchResult) return;
    const lines = ['Dataset,Column,Count,Mean,StdDev,Variance,StdError,Min,Q1,Median,Q3,Max,Range,IQR,Skewness,Kurtosis,CI95Low,CI95High,Sum'];
    for (const ds of batchResult.datasets) {
      for (const col of ds.columns) {
        const s = col.stats;
        lines.push([
          ds.datasetName,
          col.columnName,
          s.count,
          fmt(s.mean),
          fmt(s.stdDev),
          fmt(s.variance),
          fmt(s.stdError),
          fmt(s.min),
          fmt(s.q1),
          fmt(s.median),
          fmt(s.q3),
          fmt(s.max),
          fmt(s.range),
          fmt(s.iqr),
          fmt(s.skewness),
          fmt(s.kurtosis),
          fmt(s.ci95Low),
          fmt(s.ci95High),
          fmt(s.sum),
        ].join(','));
      }
    }
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'batch_stats.csv';
    a.click();
    URL.revokeObjectURL(url);
    addToast(t('toast.exportSuccess'), 'success');
  }, [batchResult, addToast, t]);

  return (
    <div className="flex items-stretch">
      <RibbonGroup label={t('stats.descriptive')}>
        <button
          onClick={runStats}
          className="ribbon-btn"
          title={t('stats.runTip')}
          aria-label={t('stats.run')}
          disabled={!activeDs || numericCols.length === 0}
        >
          <Sigma size={16} />
          <span className="text-xs">{t('stats.run')}</span>
        </button>
        <button
          onClick={runBatchStats}
          className="ribbon-btn"
          title={t('stats.batchTip', { defaultValue: 'Run statistics across all datasets' })}
          aria-label={t('stats.batch', { defaultValue: 'Batch Stats' })}
          disabled={datasets.length === 0}
        >
          <Layers size={16} />
          <span className="text-xs">{t('stats.batch', { defaultValue: 'Batch' })}</span>
        </button>
      </RibbonGroup>

      {statsResult && (
        <RibbonGroup label={t('stats.results')}>
          <div className="flex flex-col gap-0.5 text-xs min-w-0 max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
            <div className="font-mono text-xs truncate" style={{ color: 'var(--text-primary)' }}>
              {statsResult.datasetName} · {statsResult.columns.length} {t('stats.columns')}
            </div>
            <div className="flex gap-1 mt-1">
              <button
                onClick={() => setShowDetails((v) => !v)}
                className="ribbon-btn"
                title={showDetails ? t('stats.hideDetails') : t('stats.showDetails')}
                aria-label={showDetails ? t('stats.hideDetails') : t('stats.showDetails')}
              >
                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span className="text-xs">{t('stats.details')}</span>
              </button>
              <button
                onClick={copyToClipboard}
                className="ribbon-btn"
                title={t('stats.copy')}
                aria-label={t('stats.copy')}
              >
                <Copy size={14} />
                <span className="text-xs">{t('stats.copy')}</span>
              </button>
              <button
                onClick={exportCSV}
                className="ribbon-btn"
                title={t('stats.exportCsv')}
                aria-label={t('stats.exportCsv')}
              >
                <Download size={14} />
                <span className="text-xs">{t('stats.exportCsv')}</span>
              </button>
            </div>
            {showDetails && (
              <StatsTable result={statsResult} t={t} />
            )}
          </div>
        </RibbonGroup>
      )}

      {batchResult && (
        <RibbonGroup label={t('stats.batchResults', { defaultValue: 'Batch Results' })}>
          <div className="flex flex-col gap-0.5 text-xs min-w-0 max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
            <div className="font-mono text-xs truncate" style={{ color: 'var(--text-primary)' }}>
              {batchResult.datasets.length} {t('stats.datasets', { defaultValue: 'datasets' })}
            </div>
            <div className="flex gap-1 mt-1">
              <button
                onClick={() => setShowBatchDetails((v) => !v)}
                className="ribbon-btn"
                title={showBatchDetails ? t('stats.hideDetails') : t('stats.showDetails')}
                aria-label={showBatchDetails ? t('stats.hideDetails') : t('stats.showDetails')}
              >
                {showBatchDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span className="text-xs">{t('stats.details')}</span>
              </button>
              <button
                onClick={exportBatchCSV}
                className="ribbon-btn"
                title={t('stats.exportCsv')}
                aria-label={t('stats.exportCsv')}
              >
                <Download size={14} />
                <span className="text-xs">{t('stats.exportCsv')}</span>
              </button>
            </div>
            {showBatchDetails && (
              <BatchStatsTable result={batchResult} t={t} />
            )}
          </div>
        </RibbonGroup>
      )}
    </div>
  );
}

// --- Types ---

interface ColumnStats {
  columnName: string;
  columnId: string;
  type: string;
  stats: DescriptiveStats;
}

interface StatsResult {
  datasetName: string;
  columns: ColumnStats[];
}

interface BatchDatasetStats {
  datasetId: string;
  datasetName: string;
  columns: ColumnStats[];
}

interface BatchStatsResult {
  datasets: BatchDatasetStats[];
}

// --- Stats Table ---

function StatsTable({ result, t }: { result: StatsResult; t: (key: string) => string }) {
  const metrics: { key: keyof DescriptiveStats; label: string }[] = [
    { key: 'count', label: t('stats.count') },
    { key: 'mean', label: t('stats.mean') },
    { key: 'stdDev', label: t('stats.stdDev') },
    { key: 'variance', label: t('stats.variance') },
    { key: 'stdError', label: t('stats.stdError') },
    { key: 'min', label: t('stats.min') },
    { key: 'q1', label: t('stats.q1') },
    { key: 'median', label: t('stats.median') },
    { key: 'q3', label: t('stats.q3') },
    { key: 'max', label: t('stats.max') },
    { key: 'range', label: t('stats.range') },
    { key: 'iqr', label: t('stats.iqr') },
    { key: 'skewness', label: t('stats.skewness') },
    { key: 'kurtosis', label: t('stats.kurtosis') },
    { key: 'ci95Low', label: t('stats.ci95Low') },
    { key: 'ci95High', label: t('stats.ci95High') },
    { key: 'sum', label: t('stats.sum') },
  ];

  return (
    <div className="mt-1 p-2 rounded text-xs overflow-auto max-h-64" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
      <table className="border-collapse" style={{ color: 'var(--text-primary)' }}>
        <thead>
          <tr style={{ color: 'var(--text-muted)' }}>
            <th className="text-left pr-3 pb-1 sticky top-0" style={{ background: 'var(--bg-input)' }}>{t('stats.metric')}</th>
            {result.columns.map((c) => (
              <th key={c.columnId} className="text-right pr-3 pb-1 sticky top-0" style={{ background: 'var(--bg-input)' }}>
                {c.columnName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.key}>
              <td className="pr-3 font-mono">{m.label}</td>
              {result.columns.map((c) => (
                <td key={c.columnId} className="text-right pr-3 font-mono">
                  {fmt(c.stats[m.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Batch Stats Table ---

function BatchStatsTable({ result, t }: { result: BatchStatsResult; t: (key: string) => string }) {
  return (
    <div className="mt-1 p-2 rounded text-xs overflow-auto max-h-64" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
      <table className="border-collapse" style={{ color: 'var(--text-primary)' }}>
        <thead>
          <tr style={{ color: 'var(--text-muted)' }}>
            <th className="text-left pr-3 pb-1 sticky top-0" style={{ background: 'var(--bg-input)' }}>{t('stats.dataset')}</th>
            <th className="text-left pr-3 pb-1 sticky top-0" style={{ background: 'var(--bg-input)' }}>{t('stats.column')}</th>
            <th className="text-right pr-3 pb-1 sticky top-0" style={{ background: 'var(--bg-input)' }}>N</th>
            <th className="text-right pr-3 pb-1 sticky top-0" style={{ background: 'var(--bg-input)' }}>{t('stats.mean')}</th>
            <th className="text-right pr-3 pb-1 sticky top-0" style={{ background: 'var(--bg-input)' }}>{t('stats.stdDev')}</th>
            <th className="text-right pr-3 pb-1 sticky top-0" style={{ background: 'var(--bg-input)' }}>{t('stats.min')}</th>
            <th className="text-right pr-3 pb-1 sticky top-0" style={{ background: 'var(--bg-input)' }}>{t('stats.median')}</th>
            <th className="text-right pr-3 pb-1 sticky top-0" style={{ background: 'var(--bg-input)' }}>{t('stats.max')}</th>
          </tr>
        </thead>
        <tbody>
          {result.datasets.map((ds) =>
            ds.columns.map((col, ci) => (
              <tr key={`${ds.datasetId}-${col.columnId}`}>
                {ci === 0 && (
                  <td className="pr-3 font-mono align-top" rowSpan={ds.columns.length} style={{ color: 'var(--accent)' }}>
                    {ds.datasetName}
                  </td>
                )}
                <td className="pr-3 font-mono">{col.columnName}</td>
                <td className="text-right pr-3 font-mono">{col.stats.count}</td>
                <td className="text-right pr-3 font-mono">{fmt(col.stats.mean)}</td>
                <td className="text-right pr-3 font-mono">{fmt(col.stats.stdDev)}</td>
                <td className="text-right pr-3 font-mono">{fmt(col.stats.min)}</td>
                <td className="text-right pr-3 font-mono">{fmt(col.stats.median)}</td>
                <td className="text-right pr-3 font-mono">{fmt(col.stats.max)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
