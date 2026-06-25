import { useConfirmStore } from '@/store/confirmStore';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';

export function ConfirmDialog() {
  const { t } = useTranslation();
  const open = useConfirmStore((s) => s.open);
  const options = useConfirmStore((s) => s.options);
  const resolve = useConfirmStore((s) => s.resolve);

  if (!open || !options) return null;

  const confirmLabel = options.confirmLabel ?? t('confirm.ok');
  const cancelLabel = options.cancelLabel ?? t('confirm.cancel');

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'var(--bg-base)' }}
      onClick={() => resolve(false)}
    >
      <div
        className="rounded-lg shadow-xl max-w-sm w-full mx-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            {options.danger && <AlertTriangle size={16} style={{ color: '#f59e0b' }} />}
            <span className="text-sm font-medium">{options.title}</span>
          </div>
          <button onClick={() => resolve(false)} className="p-1 rounded hover:bg-black/10" aria-label="Close">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {options.message}
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => resolve(false)}
            className="px-3 py-1.5 text-sm rounded transition-colors"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => resolve(true)}
            className="px-3 py-1.5 text-sm rounded text-white transition-opacity"
            style={{ background: options.danger ? '#ef4444' : 'var(--accent)' }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
