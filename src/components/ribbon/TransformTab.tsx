import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatasetStore } from '@/store/plotStore';
import { ArrowUpDown, Minimize2, Plus, Waves, Spline, ChevronDown } from 'lucide-react';
import { RibbonGroup } from './RibbonGroup';
import { TransformPreviewModal, type PreviewOperation } from '@/components/TransformPreviewModal';

/** Dropdown panel that opens below the trigger button. Closes on outside click. */
function DropdownPanel({
  label,
  icon,
  disabled,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="ribbon-btn"
        disabled={disabled}
        aria-label={label}
        title={label}
      >
        {icon}
        <span className="text-xs">{label}</span>
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-md shadow-lg p-2 flex flex-col gap-1.5 min-w-[180px]"
          style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function TransformTab() {
  const { t } = useTranslation();
  const datasets = useDatasetStore((s) => s.datasets);
  const activeDatasetId = useDatasetStore((s) => s.activeDatasetId);
  const addComputedColumn = useDatasetStore((s) => s.addComputedColumn);
  const sortDataset = useDatasetStore((s) => s.sortDataset);
  const interpolateColumn = useDatasetStore((s) => s.interpolateColumn);
  const addColumn = useDatasetStore((s) => s.addColumn);
  const addRow = useDatasetStore((s) => s.addRow);

  const [targetColId, setTargetColId] = useState<string>('');
  const [preview, setPreview] = useState<{ columnId: string; op: PreviewOperation } | null>(null);
  const [sgWindow, setSgWindow] = useState(5);
  const [sgOrder, setSgOrder] = useState(2);
  const [maWindow, setMaWindow] = useState(5);
  const [lpAlpha, setLpAlpha] = useState(0.2);
  const [wtLambda, setWtLambda] = useState(10);
  const [interpMethod, setInterpMethod] = useState<'linear' | 'spline' | 'akima' | 'pchip'>('spline');
  const [interpPoints, setInterpPoints] = useState(100);

  const activeDs = datasets.find((d) => d.id === activeDatasetId);
  const numericCols = activeDs?.columns.filter((c) => c.values.some((v) => !isNaN(Number(v)))) ?? [];
  const targetCol = activeDs?.columns.find((c) => c.id === targetColId) ?? activeDs?.columns.find((c) => c.type === 'Y') ?? activeDs?.columns[1];

  const targetColumnId = targetCol?.id ?? '';

  const transform = (fn: (v: number) => number, label: string) => {
    if (!activeDs || !targetCol) return;
    setPreview({ columnId: targetCol.id, op: { kind: 'transform', fn, label } });
  };

  const compute = (name: string, fn: (row: Record<string, number>) => number) => {
    if (!activeDs) return;
    addComputedColumn(activeDs.id, name, fn);
  };

  const applySmooth = (method: 'sg' | 'moving' | 'lowpass' | 'whittaker', label: string) => {
    if (!activeDs || !targetCol) return;
    const params = method === 'sg' ? { windowSize: sgWindow, polyOrder: sgOrder }
      : method === 'moving' ? { windowSize: maWindow }
      : method === 'lowpass' ? { alpha: lpAlpha }
      : { lambda: wtLambda };
    setPreview({ columnId: targetCol.id, op: { kind: 'smooth', method, params, label } });
  };

  const applyNormalize = (method: 'minmax' | 'zscore' | 'log', label: string) => {
    if (!activeDs || !targetCol) return;
    setPreview({ columnId: targetCol.id, op: { kind: 'normalize', method, label } });
  };

  const runInterpolate = () => {
    if (!activeDs || !targetCol) return;
    const xCol = activeDs.columns.find((c) => c.type === 'X') ?? activeDs.columns[0];
    if (!xCol) return;
    const xs = xCol.values.map((v) => Number(v)).filter((v) => !isNaN(v));
    if (xs.length < 2) return;
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const queryX = Array.from({ length: interpPoints }, (_, i) => xMin + (i / (interpPoints - 1)) * (xMax - xMin));
    interpolateColumn(activeDs.id, xCol.id, targetCol.id, interpMethod, queryX);
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-input)',
    borderColor: 'var(--border)',
    color: 'var(--text-primary)',
  };
  const labelStyle: React.CSSProperties = { color: 'var(--text-secondary)' };

  return (
    <div className="flex items-stretch">
      {/* Target column selector */}
      <RibbonGroup label={t('transform.targetColumn')}>
        <select
          value={targetColumnId}
          onChange={(e) => setTargetColId(e.target.value)}
          className="border rounded px-1.5 py-0.5 text-xs outline-none min-w-[100px]"
          style={inputStyle}
          aria-label={t('transform.targetColumn')}
        >
          {numericCols.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
          ))}
        </select>
      </RibbonGroup>

      {/* Math + Trig combined into one compact group */}
      <RibbonGroup label={t('transform.mathTransform')}>
        <button onClick={() => transform(Math.log, 'ln')} className="ribbon-btn" title="ln(y)" aria-label="ln(y)">
          <span className="text-sm font-mono">ln</span>
        </button>
        <button onClick={() => transform(Math.log10, 'log10')} className="ribbon-btn" title="log10(y)" aria-label="log10(y)">
          <span className="text-sm font-mono">lg</span>
        </button>
        <button onClick={() => transform(Math.exp, 'exp')} className="ribbon-btn" title="e^y" aria-label="e^y">
          <span className="text-sm font-mono">eˣ</span>
        </button>
        <button onClick={() => transform(Math.sqrt, 'sqrt')} className="ribbon-btn" title="√y" aria-label="√y">
          <span className="text-sm font-mono">√</span>
        </button>
        <button onClick={() => transform((v) => v * v, 'square')} className="ribbon-btn" title="y²" aria-label="y²">
          <span className="text-sm font-mono">x²</span>
        </button>
        <button onClick={() => transform((v) => 1 / v, 'reciprocal')} className="ribbon-btn" title="1/y" aria-label="1/y">
          <span className="text-sm font-mono">1/x</span>
        </button>
        <button onClick={() => transform(Math.abs, 'abs')} className="ribbon-btn" title="|y|" aria-label="|y|">
          <span className="text-sm font-mono">|x|</span>
        </button>
        <span className="mx-0.5" style={{ color: 'var(--border)' }}>|</span>
        <button onClick={() => transform(Math.sin, 'sin')} className="ribbon-btn" title="sin(y)" aria-label="sin(y)">
          <span className="text-sm font-mono">sin</span>
        </button>
        <button onClick={() => transform(Math.cos, 'cos')} className="ribbon-btn" title="cos(y)" aria-label="cos(y)">
          <span className="text-sm font-mono">cos</span>
        </button>
        <button onClick={() => transform(Math.tan, 'tan')} className="ribbon-btn" title="tan(y)" aria-label="tan(y)">
          <span className="text-sm font-mono">tan</span>
        </button>
        <button onClick={() => transform((v) => v * Math.PI / 180, 'deg2rad')} className="ribbon-btn" title="y° → rad" aria-label="deg to rad">
          <span className="text-sm font-mono">°→r</span>
        </button>
      </RibbonGroup>

      {/* Normalize — compact 3 buttons */}
      <RibbonGroup label={t('transform.normalizeGroup')}>
        <button onClick={() => applyNormalize('minmax', 'Min-Max')} className="ribbon-btn" title={t('transform.normalizeTip')} aria-label={t('transform.minMax')}>
          <Minimize2 size={14} />
          <span className="text-xs">{t('transform.minMax')}</span>
        </button>
        <button onClick={() => applyNormalize('zscore', 'Z-score')} className="ribbon-btn" title={t('transform.zscoreTip')} aria-label={t('transform.zscore')}>
          <span className="text-xs font-mono">z</span>
          <span className="text-xs">{t('transform.zscore')}</span>
        </button>
        <button onClick={() => applyNormalize('log', 'Log')} className="ribbon-btn" title={t('transform.logNormTip')} aria-label={t('transform.logNorm')}>
          <span className="text-sm font-mono">log</span>
          <span className="text-xs">{t('transform.logNorm')}</span>
        </button>
      </RibbonGroup>

      {/* Smoothing — dropdown panel */}
      <RibbonGroup label={t('transform.smoothing')}>
        <DropdownPanel label={t('transform.sg')} icon={<Waves size={14} />} disabled={!activeDs || !targetCol}>
          {(close) => (
            <>
              <button
                onClick={() => { applySmooth('sg', 'Savitzky-Golay'); close(); }}
                className="ribbon-btn"
                title={t('transform.sgTip')}
              >
                <Waves size={14} />
                <span className="text-xs">{t('transform.sg')}</span>
              </button>
              <label className="flex items-center gap-1 text-xs" style={labelStyle}>
                <span>w</span>
                <input type="number" min="3" max="51" step="2" value={sgWindow} onChange={(e) => setSgWindow(Math.max(3, Number(e.target.value) || 5))} className="w-12 border rounded px-1 py-0.5 outline-none" style={inputStyle} />
              </label>
              <label className="flex items-center gap-1 text-xs" style={labelStyle}>
                <span>p</span>
                <input type="number" min="1" max="5" value={sgOrder} onChange={(e) => setSgOrder(Math.max(1, Number(e.target.value) || 2))} className="w-12 border rounded px-1 py-0.5 outline-none" style={inputStyle} />
              </label>
              <div className="border-t my-0.5" style={{ borderColor: 'var(--border)' }} />
              <button
                onClick={() => { applySmooth('moving', 'Moving Average'); close(); }}
                className="ribbon-btn"
                title={t('transform.maTip')}
              >
                <span className="text-xs">{t('transform.ma')}</span>
              </button>
              <label className="flex items-center gap-1 text-xs" style={labelStyle}>
                <span>w</span>
                <input type="number" min="2" value={maWindow} onChange={(e) => setMaWindow(Math.max(2, Number(e.target.value) || 5))} className="w-12 border rounded px-1 py-0.5 outline-none" style={inputStyle} />
              </label>
              <div className="border-t my-0.5" style={{ borderColor: 'var(--border)' }} />
              <button
                onClick={() => { applySmooth('lowpass', 'Low-pass'); close(); }}
                className="ribbon-btn"
                title={t('transform.lpTip')}
              >
                <span className="text-xs">{t('transform.lp')}</span>
              </button>
              <label className="flex items-center gap-1 text-xs" style={labelStyle}>
                <span>α</span>
                <input type="number" min="0.01" max="0.99" step="0.05" value={lpAlpha} onChange={(e) => setLpAlpha(Math.max(0.01, Math.min(0.99, Number(e.target.value) || 0.2)))} className="w-12 border rounded px-1 py-0.5 outline-none" style={inputStyle} />
              </label>
              <div className="border-t my-0.5" style={{ borderColor: 'var(--border)' }} />
              <button
                onClick={() => { applySmooth('whittaker', 'Whittaker'); close(); }}
                className="ribbon-btn"
                title={t('transform.wtTip')}
              >
                <span className="text-xs">{t('transform.wt')}</span>
              </button>
              <label className="flex items-center gap-1 text-xs" style={labelStyle}>
                <span>λ</span>
                <input type="number" min="1" step="1" value={wtLambda} onChange={(e) => setWtLambda(Math.max(1, Number(e.target.value) || 10))} className="w-12 border rounded px-1 py-0.5 outline-none" style={inputStyle} />
              </label>
            </>
          )}
        </DropdownPanel>
      </RibbonGroup>

      {/* Interpolation — dropdown panel */}
      <RibbonGroup label={t('transform.interpolation')}>
        <DropdownPanel label={t('transform.interpolate')} icon={<Spline size={14} />} disabled={!activeDs || !targetCol}>
          {(close) => (
            <>
              <label className="flex flex-col gap-0.5 text-xs" style={labelStyle}>
                {t('transform.interpolation')}
                <select
                  value={interpMethod}
                  onChange={(e) => setInterpMethod(e.target.value as typeof interpMethod)}
                  className="border rounded px-1 py-0.5 outline-none"
                  style={inputStyle}
                >
                  <option value="linear">{t('transform.linear')}</option>
                  <option value="spline">{t('transform.spline')}</option>
                  <option value="akima">{t('transform.akima')}</option>
                  <option value="pchip">{t('transform.pchip')}</option>
                </select>
              </label>
              <label className="flex items-center gap-1 text-xs" style={labelStyle}>
                <span>n</span>
                <input type="number" min="2" value={interpPoints} onChange={(e) => setInterpPoints(Math.max(2, Number(e.target.value) || 100))} className="w-14 border rounded px-1 py-0.5 outline-none" style={inputStyle} />
              </label>
              <button
                onClick={() => { runInterpolate(); close(); }}
                className="ribbon-btn"
                title={t('transform.interpTip')}
              >
                <Spline size={14} />
                <span className="text-xs">{t('transform.interpolate')}</span>
              </button>
            </>
          )}
        </DropdownPanel>
      </RibbonGroup>

      {/* Computed Column */}
      <RibbonGroup label={t('transform.computedCol')}>
        <button onClick={() => compute('x+y', (r) => (r[activeDs!.columns[0].name] ?? 0) + (r[activeDs!.columns[1].name] ?? 0))} className="ribbon-btn" title="X + Y" aria-label="X + Y">
          <span className="text-sm font-mono">+</span>
          <span className="text-xs">{t('transform.add')}</span>
        </button>
        <button onClick={() => compute('x-y', (r) => (r[activeDs!.columns[0].name] ?? 0) - (r[activeDs!.columns[1].name] ?? 0))} className="ribbon-btn" title="X - Y" aria-label="X - Y">
          <span className="text-sm font-mono">−</span>
          <span className="text-xs">{t('transform.sub')}</span>
        </button>
        <button onClick={() => compute('x*y', (r) => (r[activeDs!.columns[0].name] ?? 0) * (r[activeDs!.columns[1].name] ?? 0))} className="ribbon-btn" title="X × Y" aria-label="X × Y">
          <span className="text-sm font-mono">×</span>
          <span className="text-xs">{t('transform.mul')}</span>
        </button>
        <button onClick={() => compute('x/y', (r) => { const d = r[activeDs!.columns[1].name]; return d ? r[activeDs!.columns[0].name] / d : NaN; })} className="ribbon-btn" title="X ÷ Y" aria-label="X ÷ Y">
          <span className="text-sm font-mono">÷</span>
          <span className="text-xs">{t('transform.div')}</span>
        </button>
      </RibbonGroup>

      {/* Data Operations */}
      <RibbonGroup label={t('transform.dataOps')}>
        <button
          onClick={() => { if (activeDs && targetCol) sortDataset(activeDs.id, targetCol.id, true); }}
          className="ribbon-btn" title={t('transform.sortAsc')} aria-label={t('transform.sortAsc')}
        >
          <ArrowUpDown size={14} />
          <span className="text-xs">{t('transform.asc')}</span>
        </button>
        <button
          onClick={() => { if (activeDs && targetCol) sortDataset(activeDs.id, targetCol.id, false); }}
          className="ribbon-btn" title={t('transform.sortDesc')} aria-label={t('transform.sortDesc')}
        >
          <ArrowUpDown size={14} className="rotate-180" />
          <span className="text-xs">{t('transform.desc')}</span>
        </button>
        {activeDs && (
          <>
            <button onClick={() => addColumn(activeDs.id)} className="ribbon-btn" title={t('transform.addColTip')} aria-label={t('transform.addCol')}>
              <Plus size={14} />
              <span className="text-xs">{t('transform.addCol')}</span>
            </button>
            <button onClick={() => addRow(activeDs.id)} className="ribbon-btn" title={t('transform.addRowTip')} aria-label={t('transform.addRow')}>
              <Plus size={14} />
              <span className="text-xs">{t('transform.addRow')}</span>
            </button>
          </>
        )}
      </RibbonGroup>

      {preview && (
        <TransformPreviewModal
          columnId={preview.columnId}
          operation={preview.op}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
