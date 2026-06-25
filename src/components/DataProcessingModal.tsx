import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatasetStore } from '@/store/plotStore';
import { useToastStore } from '@/store/toastStore';
import { Database, X, Filter, Sparkles, AlertTriangle, Trash2 } from 'lucide-react';
import { detectOutliers, findMissingIndices } from '@/utils/dataProcessing';
import type { FilterOperator, MissingValueStrategy } from '@/utils/dataProcessing';

export type DataProcessingMode = 'filter' | 'missing' | 'outlier';

interface DataProcessingModalProps {
  mode: DataProcessingMode;
  columnId: string;
  onClose: () => void;
}

export function DataProcessingModal({ mode, columnId, onClose }: DataProcessingModalProps) {
  const { t } = useTranslation();
  const datasets = useDatasetStore((s) => s.datasets);
  const activeDatasetId = useDatasetStore((s) => s.activeDatasetId);
  const filterRowsByCondition = useDatasetStore((s) => s.filterRowsByCondition);
  const fillMissingColumn = useDatasetStore((s) => s.fillMissingColumn);
  const replaceColumnOutliers = useDatasetStore((s) => s.replaceColumnOutliers);
  const removeRowsAt = useDatasetStore((s) => s.removeRowsAt);
  const addToast = useToastStore((s) => s.addToast);

  const [operator, setOperator] = useState<FilterOperator>('gt');
  const [filterValue, setFilterValue] = useState('0');
  const [rangeMin, setRangeMin] = useState('0');
  const [rangeMax, setRangeMax] = useState('1');
  const [missingStrategy, setMissingStrategy] = useState<MissingValueStrategy>('mean');
  const [outlierK, setOutlierK] = useState(1.5);
  const [outlierAction, setOutlierAction] = useState<'remove' | 'replace-fence' | 'replace-nan'>('remove');

  const activeDs = datasets.find((d) => d.id === activeDatasetId);
  const col = activeDs?.columns.find((c) => c.id === columnId);

  const previewInfo = useMemo(() => {
    if (!col) return null;
    const values = col.values;
    const missingIdx = findMissingIndices(values);
    const outlierRes = detectOutliers(values, outlierK);
    return {
      total: values.length,
      missing: missingIdx.length,
      outliers: outlierRes.indices.length,
      q1: outlierRes.q1,
      q3: outlierRes.q3,
      iqr: outlierRes.iqr,
      lowerFence: outlierRes.lowerFence,
      upperFence: outlierRes.upperFence,
    };
  }, [col, outlierK]);

  const handleApply = () => {
    if (!activeDs || !col) return;
    if (mode === 'filter') {
      if (operator === 'range') {
        const min = Number(rangeMin);
        const max = Number(rangeMax);
        if (isNaN(min) || isNaN(max)) { addToast(t('data.invalidValue'), 'warning'); return; }
        filterRowsByCondition(activeDs.id, col.id, { operator, minValue: min, maxValue: max });
      } else {
        const v = Number(filterValue);
        if (isNaN(v)) { addToast(t('data.invalidValue'), 'warning'); return; }
        filterRowsByCondition(activeDs.id, col.id, { operator, value: v });
      }
      addToast(t('data.filterApplied'), 'success');
    } else if (mode === 'missing') {
      fillMissingColumn(activeDs.id, col.id, missingStrategy);
      addToast(t('data.missingHandled'), 'success');
    } else if (mode === 'outlier') {
      if (outlierAction === 'remove') {
        const res = detectOutliers(col.values, outlierK);
        removeRowsAt(activeDs.id, res.indices);
        addToast(t('data.outliersRemoved', { count: res.indices.length }), 'success');
      } else {
        replaceColumnOutliers(activeDs.id, col.id, outlierK, outlierAction === 'replace-nan' ? 'nan' : 'fence');
        addToast(t('data.outliersReplaced'), 'success');
      }
    }
    onClose();
  };

  if (!col) return null;

  const title = mode === 'filter' ? t('data.filterTitle') : mode === 'missing' ? t('data.missingTitle') : t('data.outlierTitle');
  const Icon = mode === 'filter' ? Filter : mode === 'missing' ? Sparkles : AlertTriangle;

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-input)',
    borderColor: 'var(--border)',
    color: 'var(--text-primary)',
  };
  const labelStyle: React.CSSProperties = { color: 'var(--text-secondary)' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'transparent' }}
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-xl flex flex-col w-96"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <Icon size={16} />
            <span className="text-sm font-medium">{title}</span>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
              {col.name}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-black/10" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          {previewInfo && (
            <div className="text-xs p-2 rounded" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
              <div>{t('data.totalRows')}: <span style={{ color: 'var(--text-primary)' }}>{previewInfo.total}</span></div>
              {mode === 'missing' && (
                <div>{t('data.missingCount')}: <span style={{ color: previewInfo.missing > 0 ? '#fbbf24' : 'var(--text-primary)' }}>{previewInfo.missing}</span></div>
              )}
              {mode === 'outlier' && (
                <>
                  <div>{t('data.outlierCount')}: <span style={{ color: previewInfo.outliers > 0 ? '#fb7185' : 'var(--text-primary)' }}>{previewInfo.outliers}</span></div>
                  <div className="font-mono mt-1">
                    Q1={previewInfo.q1.toFixed(3)} · Q3={previewInfo.q3.toFixed(3)} · IQR={previewInfo.iqr.toFixed(3)}
                  </div>
                  <div className="font-mono">
                    [{previewInfo.lowerFence.toFixed(3)}, {previewInfo.upperFence.toFixed(3)}]
                  </div>
                </>
              )}
            </div>
          )}

          {mode === 'filter' && (
            <>
              <label className="flex flex-col gap-1 text-xs" style={labelStyle}>
                {t('data.filterOperator')}
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value as FilterOperator)}
                  className="border rounded px-2 py-1 outline-none"
                  style={inputStyle}
                >
                  <option value="gt">&gt; {t('data.greaterThan')}</option>
                  <option value="lt">&lt; {t('data.lessThan')}</option>
                  <option value="ge">≥ {t('data.greaterEqual')}</option>
                  <option value="le">≤ {t('data.lessEqual')}</option>
                  <option value="eq">= {t('data.equal')}</option>
                  <option value="ne">≠ {t('data.notEqual')}</option>
                  <option value="range">{t('data.inRange')}</option>
                </select>
              </label>
              {operator === 'range' ? (
                <div className="flex gap-2">
                  <label className="flex flex-col gap-1 text-xs flex-1" style={labelStyle}>
                    {t('data.min')}
                    <input
                      type="number"
                      value={rangeMin}
                      onChange={(e) => setRangeMin(e.target.value)}
                      className="border rounded px-2 py-1 outline-none"
                      style={inputStyle}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs flex-1" style={labelStyle}>
                    {t('data.max')}
                    <input
                      type="number"
                      value={rangeMax}
                      onChange={(e) => setRangeMax(e.target.value)}
                      className="border rounded px-2 py-1 outline-none"
                      style={inputStyle}
                    />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col gap-1 text-xs" style={labelStyle}>
                  {t('data.threshold')}
                  <input
                    type="number"
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="border rounded px-2 py-1 outline-none"
                    style={inputStyle}
                  />
                </label>
              )}
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('data.filterTip')}
              </div>
            </>
          )}

          {mode === 'missing' && (
            <label className="flex flex-col gap-1 text-xs" style={labelStyle}>
              {t('data.missingStrategy')}
              <select
                value={missingStrategy}
                onChange={(e) => setMissingStrategy(e.target.value as MissingValueStrategy)}
                className="border rounded px-2 py-1 outline-none"
                style={inputStyle}
              >
                <option value="delete">{t('data.missingDelete')}</option>
                <option value="mean">{t('data.missingMean')}</option>
                <option value="median">{t('data.missingMedian')}</option>
                <option value="interpolate">{t('data.missingInterpolate')}</option>
                <option value="zero">{t('data.missingZero')}</option>
              </select>
            </label>
          )}

          {mode === 'outlier' && (
            <>
              <label className="flex flex-col gap-1 text-xs" style={labelStyle}>
                {t('data.outlierK')}
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={outlierK}
                  onChange={(e) => setOutlierK(Number(e.target.value) || 1.5)}
                  className="border rounded px-2 py-1 outline-none"
                  style={inputStyle}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs" style={labelStyle}>
                {t('data.outlierAction')}
                <select
                  value={outlierAction}
                  onChange={(e) => setOutlierAction(e.target.value as typeof outlierAction)}
                  className="border rounded px-2 py-1 outline-none"
                  style={inputStyle}
                >
                  <option value="remove">{t('data.outlierRemove')}</option>
                  <option value="replace-fence">{t('data.outlierReplaceFence')}</option>
                  <option value="replace-nan">{t('data.outlierReplaceNaN')}</option>
                </select>
              </label>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs rounded border"
              style={inputStyle}
            >
              {t('confirm.cancel')}
            </button>
            <button
              onClick={handleApply}
              className="px-3 py-1 text-xs rounded flex items-center gap-1"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {outlierAction === 'remove' && mode === 'outlier' ? <Trash2 size={12} /> : <Database size={12} />}
              {t('data.apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
