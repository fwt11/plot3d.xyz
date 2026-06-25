import { useState, useMemo } from 'react';
import { useHistoryStore, type HistoryEntry } from '@/store/historyStore';
import { useToastStore } from '@/store/toastStore';
import { useTranslation } from 'react-i18next';
import { X, Undo2, Redo2, GitBranch, Trash2, RotateCcw, Clock, ChevronRight, ChevronDown } from 'lucide-react';

interface HistoryPanelProps {
  onClose: () => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function HistoryPanel({ onClose }: HistoryPanelProps) {
  const { t } = useTranslation();
  const past = useHistoryStore((s) => s._past);
  const future = useHistoryStore((s) => s._future);
  const branches = useHistoryStore((s) => s._branches);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const restoreBranch = useHistoryStore((s) => s.restoreBranch);
  const deleteBranch = useHistoryStore((s) => s.deleteBranch);
  const clearHistory = useHistoryStore((s) => s.clearHistory);
  const addToast = useToastStore((s) => s.addToast);

  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());

  const toggleBranch = (id: string) => {
    setExpandedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClear = () => {
    clearHistory();
    addToast(t('history.cleared', { defaultValue: 'History cleared' }), 'info');
  };

  // Build a combined timeline: past (oldest→newest) → current → future (newest→oldest)
  const timeline = useMemo(() => {
    const items: { type: 'past' | 'current' | 'future'; entry?: HistoryEntry; index: number }[] = [];
    past.forEach((entry, i) => {
      items.push({ type: 'past', entry, index: i });
    });
    items.push({ type: 'current', index: -1 });
    // Future is stored newest-first; display oldest-first (reverse)
    [...future].reverse().forEach((entry, i) => {
      items.push({ type: 'future', entry, index: future.length - 1 - i });
    });
    return items;
  }, [past, future]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 1000, background: 'transparent' }}
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-xl flex flex-col"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          width: 'min(560px, 90vw)',
          maxHeight: '80vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <Clock size={16} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {t('history.title', 'History')}
            </h2>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              ({past.length} + {future.length})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={past.length === 0}
              className="p-1.5 rounded transition-colors disabled:opacity-30"
              style={{ color: 'var(--text-secondary)' }}
              title={t('history.undo', 'Undo')}
              aria-label={t('history.undo', 'Undo')}
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={redo}
              disabled={future.length === 0}
              className="p-1.5 rounded transition-colors disabled:opacity-30"
              style={{ color: 'var(--text-secondary)' }}
              title={t('history.redo', 'Redo')}
              aria-label={t('history.redo', 'Redo')}
            >
              <Redo2 size={14} />
            </button>
            <button
              onClick={handleClear}
              disabled={past.length === 0 && future.length === 0 && branches.length === 0}
              className="p-1.5 rounded transition-colors disabled:opacity-30"
              style={{ color: 'var(--text-muted)' }}
              title={t('history.clear', 'Clear all history')}
              aria-label={t('history.clear', 'Clear all history')}
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded transition-colors"
              style={{ color: 'var(--text-muted)' }}
              title={t('common.close', 'Close')}
              aria-label={t('common.close', 'Close')}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-2">
          {timeline.length === 1 && branches.length === 0 && (
            <div className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('history.empty', 'No history yet')}
            </div>
          )}
          {timeline.map((item, i) => {
            if (item.type === 'current') {
              return (
                <div
                  key="current"
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
                  style={{ background: 'rgba(14,165,233,0.15)', color: 'var(--accent)' }}
                >
                  <ChevronRight size={12} />
                  <span className="font-medium">{t('history.current', 'Current state')}</span>
                </div>
              );
            }
            const isPast = item.type === 'past';
            const entry = item.entry!;
            return (
              <div
                key={`${item.type}-${i}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors hover:bg-white/5"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span style={{ color: isPast ? 'var(--text-muted)' : 'var(--text-faint)' }}>
                  {isPast ? <Undo2 size={12} /> : <Redo2 size={12} />}
                </span>
                <span className="flex-1 truncate">{entry.description}</span>
                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                  {formatTime(entry.timestamp)}
                </span>
              </div>
            );
          })}

          {/* Branches */}
          {branches.length > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                <GitBranch size={12} />
                {t('history.branches', 'Branches')} ({branches.length})
              </div>
              {branches.map((branch) => {
                const isExpanded = expandedBranches.has(branch.id);
                return (
                  <div key={branch.id} className="mt-1">
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors hover:bg-white/5">
                      <button
                        onClick={() => toggleBranch(branch.id)}
                        className="transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        aria-label={isExpanded ? t('common.collapse', 'Collapse') : t('common.expand', 'Expand')}
                      >
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                      <GitBranch size={12} style={{ color: 'var(--text-faint)' }} />
                      <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                        {t('history.branchFrom', { desc: branch.description, defaultValue: `Branch from: ${branch.description}` })}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        {branch.entries.length} {t('history.steps', 'steps')}
                      </span>
                      <button
                        onClick={() => {
                          restoreBranch(branch.id);
                          addToast(t('history.branchRestored', { defaultValue: 'Branch restored' }), 'success');
                        }}
                        className="p-1 rounded transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        title={t('history.restoreBranch', 'Restore branch')}
                        aria-label={t('history.restoreBranch', 'Restore branch')}
                      >
                        <RotateCcw size={12} />
                      </button>
                      <button
                        onClick={() => deleteBranch(branch.id)}
                        className="p-1 rounded transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        title={t('history.deleteBranch', 'Delete branch')}
                        aria-label={t('history.deleteBranch', 'Delete branch')}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="pl-6">
                        {branch.entries.map((entry, j) => (
                          <div
                            key={j}
                            className="flex items-center gap-2 px-2 py-1 rounded text-xs"
                            style={{ color: 'var(--text-faint)' }}
                          >
                            <Redo2 size={10} />
                            <span className="flex-1 truncate">{entry.description}</span>
                            <span className="text-xs">{formatTime(entry.timestamp)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-faint)' }}>
          {t('history.hint', { defaultValue: 'Undoing then editing creates a branch. Click a branch to restore it.' })}
        </div>
      </div>
    </div>
  );
}

export default HistoryPanel;
