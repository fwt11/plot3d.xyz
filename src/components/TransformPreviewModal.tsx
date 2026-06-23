import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatasetStore } from '@/store/plotStore';
import { useToastStore } from '@/store/toastStore';
import { toNumber } from '@/types';
import { savitzkyGolay, movingAverage, lowPassFilter, whittakerSmoothing } from '@/utils/dataProcessing';
import { Wand2, X, Check } from 'lucide-react';

export type PreviewOperation =
  | { kind: 'transform'; fn: (v: number) => number; label: string }
  | { kind: 'normalize'; method: 'minmax' | 'zscore' | 'log'; label: string }
  | { kind: 'smooth'; method: 'sg' | 'moving' | 'lowpass' | 'whittaker'; params: { windowSize?: number; polyOrder?: number; alpha?: number; lambda?: number }; label: string };

interface TransformPreviewModalProps {
  columnId: string;
  operation: PreviewOperation;
  onClose: () => void;
}

export function TransformPreviewModal({ columnId, operation, onClose }: TransformPreviewModalProps) {
  const { t } = useTranslation();
  const datasets = useDatasetStore((s) => s.datasets);
  const activeDatasetId = useDatasetStore((s) => s.activeDatasetId);
  const transformColumn = useDatasetStore((s) => s.transformColumn);
  const normalizeColumnByMethod = useDatasetStore((s) => s.normalizeColumnByMethod);
  const smoothColumn = useDatasetStore((s) => s.smoothColumn);
  const addToast = useToastStore((s) => s.addToast);

  const activeDs = datasets.find((d) => d.id === activeDatasetId);
  const col = activeDs?.columns.find((c) => c.id === columnId);
  const xCol = activeDs?.columns.find((c) => c.type === 'X') ?? activeDs?.columns[0];

  const preview = useMemo(() => {
    if (!col) return { x: [] as number[], original: [] as number[], transformed: [] as number[] };
    const original = col.values.map((v) => toNumber(v)).filter((v) => Number.isFinite(v));
    let transformed: number[];
    if (operation.kind === 'transform') {
      transformed = original.map(operation.fn);
    } else if (operation.kind === 'normalize') {
      if (operation.method === 'minmax') {
        const min = Math.min(...original);
        const max = Math.max(...original);
        const range = max - min || 1;
        transformed = original.map((v) => (v - min) / range);
      } else if (operation.method === 'zscore') {
        const mean = original.reduce((s, v) => s + v, 0) / original.length;
        const variance = original.reduce((s, v) => s + (v - mean) ** 2, 0) / original.length;
        const sd = Math.sqrt(variance) || 1;
        transformed = original.map((v) => (v - mean) / sd);
      } else {
        transformed = original.map((v) => (v > 0 ? Math.log(v) : NaN));
      }
    } else {
      // smooth - compute preview using the same algorithm
      const nums = col.values.map((v) => { const n = toNumber(v); return isNaN(n) ? NaN : n; });
      if (operation.method === 'sg') transformed = savitzkyGolay(nums, operation.params.windowSize ?? 5, operation.params.polyOrder ?? 2);
      else if (operation.method === 'moving') transformed = movingAverage(nums, operation.params.windowSize ?? 5);
      else if (operation.method === 'lowpass') transformed = lowPassFilter(nums, operation.params.alpha ?? 0.2);
      else transformed = whittakerSmoothing(nums, operation.params.lambda ?? 10);
      transformed = transformed.filter((v: number) => Number.isFinite(v));
    }
    const x = xCol ? xCol.values.map((v) => toNumber(v)).filter((v) => Number.isFinite(v)).slice(0, original.length) : original.map((_, i) => i);
    return { x, original, transformed };
  }, [col, xCol, operation]);

  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 600, h: 320 });

  useEffect(() => {
    const update = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setSize({ w: rect.width, h: rect.height });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const margin = 40;
  const plotW = Math.max(10, size.w - margin * 2);
  const plotH = Math.max(10, size.h - margin * 2);

  const allValues = [...preview.original, ...preview.transformed].filter((v) => Number.isFinite(v));
  const yMin = allValues.length ? Math.min(...allValues) : 0;
  const yMax = allValues.length ? Math.max(...allValues) : 1;
  const yRange = yMax - yMin || 1;
  const xMin = preview.x.length ? Math.min(...preview.x) : 0;
  const xMax = preview.x.length ? Math.max(...preview.x) : 1;
  const xRange = xMax - xMin || 1;

  const tx = (v: number) => margin + ((v - xMin) / xRange) * plotW;
  const ty = (v: number) => margin + plotH - ((v - yMin) / yRange) * plotH;

  const originalPath = preview.x.length > 0
    ? preview.x.map((x, i) => `${i === 0 ? 'M' : 'L'}${tx(x).toFixed(1)},${ty(preview.original[i]).toFixed(1)}`).join(' ')
    : '';
  const transformedPath = preview.x.length > 0
    ? preview.x.map((x, i) => `${i === 0 ? 'M' : 'L'}${tx(x).toFixed(1)},${ty(preview.transformed[i]).toFixed(1)}`).join(' ')
    : '';

  const handleApply = () => {
    if (!activeDs || !col) return;
    if (operation.kind === 'transform') {
      transformColumn(activeDs.id, col.id, operation.fn);
    } else if (operation.kind === 'normalize') {
      normalizeColumnByMethod(activeDs.id, col.id, operation.method);
    } else {
      smoothColumn(activeDs.id, col.id, operation.method, operation.params);
    }
    addToast(t('transform.applied'), 'success');
    onClose();
  };

  if (!col) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-xl flex flex-col"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text-primary)', width: 700, maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <Wand2 size={16} />
            <span className="text-sm font-medium">{t('transform.preview')}</span>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
              {operation.label} · {col.name}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-black/10" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-2 p-4">
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1">
              <span className="inline-block w-4 h-0.5" style={{ background: '#71717a' }} />
              <span style={{ color: 'var(--text-muted)' }}>{t('transform.original')}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-4 h-0.5" style={{ background: '#0ea5e9' }} />
              <span style={{ color: 'var(--text-muted)' }}>{t('transform.transformed')}</span>
            </div>
          </div>
          <svg ref={svgRef} width="100%" height={320} style={{ background: 'var(--bg-input)', borderRadius: 4 }}>
            {/* Grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((p) => (
              <line key={`h${p}`} x1={margin} y1={margin + p * plotH} x2={margin + plotW} y2={margin + p * plotH} stroke="var(--grid-color)" strokeWidth="0.5" />
            ))}
            {[0, 0.25, 0.5, 0.75, 1].map((p) => (
              <line key={`v${p}`} x1={margin + p * plotW} y1={margin} x2={margin + p * plotW} y2={margin + plotH} stroke="var(--grid-color)" strokeWidth="0.5" />
            ))}
            {/* Axes */}
            <line x1={margin} y1={margin + plotH} x2={margin + plotW} y2={margin + plotH} stroke="var(--border)" strokeWidth="1" />
            <line x1={margin} y1={margin} x2={margin} y2={margin + plotH} stroke="var(--border)" strokeWidth="1" />
            {/* Original curve */}
            {originalPath && <path d={originalPath} fill="none" stroke="#71717a" strokeWidth="1.5" strokeDasharray="4 2" />}
            {/* Transformed curve */}
            {transformedPath && <path d={transformedPath} fill="none" stroke="#0ea5e9" strokeWidth="2" />}
            {/* Y axis labels */}
            <text x={margin - 6} y={margin + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">{yMax.toFixed(2)}</text>
            <text x={margin - 6} y={margin + plotH} textAnchor="end" fontSize="10" fill="var(--text-muted)">{yMin.toFixed(2)}</text>
            {/* X axis labels */}
            <text x={margin} y={margin + plotH + 14} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{xMin.toFixed(2)}</text>
            <text x={margin + plotW} y={margin + plotH + 14} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{xMax.toFixed(2)}</text>
          </svg>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('transform.previewTip')}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs rounded border"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            {t('confirm.cancel')}
          </button>
          <button
            onClick={handleApply}
            className="px-3 py-1 text-xs rounded flex items-center gap-1"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Check size={12} />
            {t('transform.apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
