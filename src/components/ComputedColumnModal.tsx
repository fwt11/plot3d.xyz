import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatasetStore } from '@/store/datasetStore';
import { useToastStore } from '@/store/toastStore';
import { X, FunctionSquare, Calculator } from 'lucide-react';
import { parse } from 'mathjs';

interface ComputedColumnModalProps {
  datasetId: string;
  onClose: () => void;
}

const QUICK_FUNCTIONS = [
  { label: 'sin', code: 'sin(' },
  { label: 'cos', code: 'cos(' },
  { label: 'tan', code: 'tan(' },
  { label: 'log', code: 'log(' },
  { label: 'log10', code: 'log10(' },
  { label: 'exp', code: 'exp(' },
  { label: 'sqrt', code: 'sqrt(' },
  { label: 'abs', code: 'abs(' },
  { label: 'pow', code: 'pow(' },
  { label: 'pi', code: 'pi' },
  { label: 'e', code: 'e' },
];

export function ComputedColumnModal({ datasetId, onClose }: ComputedColumnModalProps) {
  const { t } = useTranslation();
  const datasets = useDatasetStore((s) => s.datasets);
  const addComputedColumn = useDatasetStore((s) => s.addComputedColumn);
  const addToast = useToastStore((s) => s.addToast);

  const dataset = datasets.find((d) => d.id === datasetId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [formula, setFormula] = useState('');
  const [columnName, setColumnName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Build safe column variable names: col_0, col_1, ...
  const colMeta = useMemo(() => {
    if (!dataset) return [];
    return dataset.columns.map((c, i) => ({
      original: c.name,
      safe: `col_${i}`,
      type: c.type,
    }));
  }, [dataset]);

  const insertAtCursor = useCallback((text: string) => {
    const el = textareaRef.current;
    if (!el) {
      setFormula((prev) => prev + text);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const prev = el.value;
    const next = prev.slice(0, start) + text + prev.slice(end);
    setFormula(next);
    setTimeout(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  }, []);

  const validateFormula = useCallback(() => {
    if (!dataset || !formula.trim()) {
      setError(null);
      return false;
    }
    try {
      const parsed = parse(formula);
      const compiled = parsed.compile();
      const scope: Record<string, number> = {};
      dataset.columns.forEach((c, i) => {
        const n = Number(c.values[0]);
        scope[`col_${i}`] = !isNaN(n) && isFinite(n) ? n : NaN;
      });
      compiled.evaluate(scope);
      setError(null);
      return true;
    } catch (err) {
      setError(String(err));
      return false;
    }
  }, [dataset, formula]);

  // Validate on formula change (debounced feel)
  useEffect(() => {
    const id = setTimeout(() => {
      if (formula.trim()) validateFormula();
      else setError(null);
    }, 400);
    return () => clearTimeout(id);
  }, [formula, validateFormula]);

  const handleApply = useCallback(() => {
    if (!dataset || !formula.trim()) return;
    try {
      const parsed = parse(formula);
      const compiled = parsed.compile();
      const fn = (row: Record<string, number>) => {
        return compiled.evaluate(row);
      };
      const name = columnName.trim() || t('data.computedColumnDefault', 'Computed');
      addComputedColumn(dataset.id, name, fn);
      addToast(t('toast.computedColumnAdded', 'Computed column added'), 'success');
      onClose();
    } catch (err) {
      setError(String(err));
    }
  }, [dataset, formula, columnName, addComputedColumn, addToast, onClose, t]);

  if (!dataset) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-2xl border w-[520px] max-h-[90vh] overflow-y-auto flex flex-col"
        style={{ background: 'var(--bg-panel)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <FunctionSquare size={16} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {t('data.computedColumnTitle', 'Computed Column')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            aria-label={t('common.close')}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Column name */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('data.newColumnName', 'New Column Name')}
            </label>
            <input
              type="text"
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              className="w-full border rounded px-2 py-1 outline-none text-xs"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              placeholder={t('data.computedColumnDefault', 'Computed')}
            />
          </div>

          {/* Formula input */}
          <div className="space-y-1">
            <label className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
              <Calculator size={12} />
              {t('data.formula', 'Formula')}
            </label>
            <textarea
              ref={textareaRef}
              id="formula-input"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              className="w-full border rounded px-2 py-1.5 outline-none text-sm font-mono resize-y"
              style={{
                background: 'var(--bg-input)',
                borderColor: error ? 'var(--danger)' : 'var(--border)',
                color: 'var(--text-primary)',
                minHeight: 60,
              }}
              placeholder={t('data.formulaPlaceholder', 'e.g., sin(col_0) + col_1 * 2')}
              rows={3}
            />
            {error && (
              <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
            )}
          </div>

          {/* Column quick-insert */}
          <div className="space-y-1.5">
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('data.availableColumns', 'Available Columns')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {colMeta.map((c) => (
                <button
                  key={c.safe}
                  onClick={() => insertAtCursor(c.safe)}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs rounded border transition-colors"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-surface)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--accent)';
                    e.currentTarget.style.borderColor = 'var(--accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-muted)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                  title={`${c.original} (${c.type})`}
                >
                  <span className="font-mono text-[10px] opacity-60">{c.safe}</span>
                  <span>{c.original}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick functions */}
          <div className="space-y-1.5">
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('data.quickFunctions', 'Functions')}
            </div>
            <div className="flex flex-wrap gap-1">
              {QUICK_FUNCTIONS.map((f) => (
                <button
                  key={f.label}
                  onClick={() => insertAtCursor(f.code)}
                  className="px-2 py-0.5 text-xs rounded border transition-colors font-mono"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-surface)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--accent)';
                    e.currentTarget.style.borderColor = 'var(--accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-muted)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded transition-colors"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {t('confirm.cancel')}
          </button>
          <button
            onClick={handleApply}
            disabled={!formula.trim() || !!error}
            className="px-3 py-1.5 text-xs rounded transition-opacity disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {t('data.applyFormula', 'Apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
