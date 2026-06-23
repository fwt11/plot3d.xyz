import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatasetStore } from '@/store/datasetStore';
import { useToastStore } from '@/store/toastStore';
import { X, ChevronUp, ChevronDown, Replace, CheckCheck } from 'lucide-react';

interface FindMatch {
  rowIdx: number;
  colIdx: number;
  colId: string;
  value: string;
}

export function FindReplaceModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const datasets = useDatasetStore((s) => s.datasets);
  const activeDatasetId = useDatasetStore((s) => s.activeDatasetId);
  const updateCellValue = useDatasetStore((s) => s.updateCellValue);
  const updateCellValueSilent = useDatasetStore((s) => s.updateCellValueSilent);
  const addToast = useToastStore((s) => s.addToast);

  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [matchWholeCell, setMatchWholeCell] = useState(false);
  const [matches, setMatches] = useState<FindMatch[]>([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [searchScope, setSearchScope] = useState<'all' | string>('all');

  const findInputRef = useRef<HTMLInputElement>(null);

  const dataset = datasets.find((d) => d.id === activeDatasetId);

  // Focus the find input on open
  useEffect(() => {
    findInputRef.current?.focus();
  }, []);

  // Run search when find text or options change
  const runSearch = useCallback(() => {
    if (!dataset || !findText) {
      setMatches([]);
      setCurrentMatchIdx(0);
      return;
    }

    const newMatches: FindMatch[] = [];
    const searchText = matchCase ? findText : findText.toLowerCase();

    dataset.columns.forEach((col, colIdx) => {
      // Skip columns not in scope
      if (searchScope !== 'all' && col.id !== searchScope) return;

      col.values.forEach((val, rowIdx) => {
        const cellStr = String(val ?? '');
        const compareStr = matchCase ? cellStr : cellStr.toLowerCase();

        if (matchWholeCell) {
          if (compareStr === searchText) {
            newMatches.push({ rowIdx, colIdx, colId: col.id, value: cellStr });
          }
        } else {
          if (compareStr.includes(searchText)) {
            newMatches.push({ rowIdx, colIdx, colId: col.id, value: cellStr });
          }
        }
      });
    });

    setMatches(newMatches);
    setCurrentMatchIdx(0);
  }, [dataset, findText, matchCase, matchWholeCell, searchScope]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(runSearch, 200);
    return () => clearTimeout(timer);
  }, [runSearch]);

  // Navigate to a match by focusing the cell
  const goToMatch = useCallback((idx: number) => {
    if (matches.length === 0) return;
    const clampedIdx = Math.max(0, Math.min(matches.length - 1, idx));
    setCurrentMatchIdx(clampedIdx);
    const match = matches[clampedIdx];
    const el = document.querySelector<HTMLInputElement>(
      `input[data-row="${match.rowIdx}"][data-col="${match.colIdx}"]`
    );
    if (el) {
      el.focus();
      el.select();
      // Scroll into view
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [matches]);

  const handleFindNext = () => goToMatch(currentMatchIdx + 1);
  const handleFindPrev = () => goToMatch(currentMatchIdx - 1);

  const handleReplace = () => {
    if (!dataset || matches.length === 0) return;
    const match = matches[currentMatchIdx];
    const newValue = matchWholeCell
      ? replaceText
      : matchCase
        ? match.value.replace(findText, replaceText)
        : match.value.replace(new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), replaceText);

    updateCellValue(dataset.id, match.colId, match.rowIdx, newValue);
    addToast(t('findReplace.replaced', 'Replaced 1 occurrence'), 'success');
    // Re-run search after a short delay to update matches
    setTimeout(runSearch, 50);
  };

  const handleReplaceAll = () => {
    if (!dataset || matches.length === 0) return;
    // Group matches by cell to avoid double-replacing
    const cellMap = new Map<string, FindMatch>();
    matches.forEach((m) => {
      const key = `${m.rowIdx}-${m.colId}`;
      if (!cellMap.has(key)) cellMap.set(key, m);
    });

    let count = 0;
    cellMap.forEach((match) => {
      const newValue = matchWholeCell
        ? replaceText
        : matchCase
          ? match.value.replace(findText, replaceText)
          : match.value.replace(new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), replaceText);
      updateCellValueSilent(dataset.id, match.colId, match.rowIdx, newValue);
      count++;
    });
    // Push a single history snapshot for the batch operation
    useDatasetStore.getState(); // ensure store is accessed
    addToast(t('findReplace.replacedAll', { count, defaultValue: `Replaced ${count} occurrences` }), 'success');
    setTimeout(runSearch, 50);
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-input)',
    borderColor: 'var(--border)',
    color: 'var(--text-primary)',
  };

  const labelStyle: React.CSSProperties = {
    color: 'var(--text-secondary)',
  };

  return (
    <div className="fixed top-16 right-4 z-50" style={{ zIndex: 'var(--z-modal)' }}>
      <div
        className="rounded-lg shadow-2xl border w-[380px]"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('findReplace.title', 'Find & Replace')}
          </span>
          <button onClick={onClose} className="transition-colors" style={{ color: 'var(--text-muted)' }} aria-label={t('findReplace.close', 'Close')}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-3 space-y-2">
          {/* Find */}
          <div className="flex items-center gap-1">
            <input
              ref={findInputRef}
              type="text"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              placeholder={t('findReplace.findPlaceholder', 'Find…')}
              className="flex-1 border rounded px-2 py-1 outline-none text-xs"
              style={inputStyle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (e.shiftKey) handleFindPrev();
                  else handleFindNext();
                }
              }}
            />
            <button
              onClick={handleFindPrev}
              disabled={matches.length === 0}
              className="p-1 rounded transition-colors disabled:opacity-30"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              title={t('findReplace.previous', 'Previous (Shift+Enter)')}
              aria-label={t('findReplace.previous', 'Previous')}
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={handleFindNext}
              disabled={matches.length === 0}
              className="p-1 rounded transition-colors disabled:opacity-30"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              title={t('findReplace.next', 'Next (Enter)')}
              aria-label={t('findReplace.next', 'Next')}
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Replace */}
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder={t('findReplace.replacePlaceholder', 'Replace with…')}
              className="flex-1 border rounded px-2 py-1 outline-none text-xs"
              style={inputStyle}
            />
            <button
              onClick={handleReplace}
              disabled={matches.length === 0}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors disabled:opacity-30"
              style={{ color: 'var(--accent)', border: '1px solid var(--border)' }}
              title={t('findReplace.replace', 'Replace')}
            >
              <Replace size={12} />
              {t('findReplace.replace', 'Replace')}
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={matches.length === 0}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors disabled:opacity-30"
              style={{ color: 'var(--accent)', border: '1px solid var(--border)' }}
              title={t('findReplace.replaceAll', 'Replace All')}
            >
              <CheckCheck size={12} />
              {t('findReplace.all', 'All')}
            </button>
          </div>

          {/* Options */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1 text-xs cursor-pointer" style={labelStyle}>
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(e) => setMatchCase(e.target.checked)}
                className="accent-sky-500"
              />
              {t('findReplace.matchCase', 'Match case')}
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer" style={labelStyle}>
              <input
                type="checkbox"
                checked={matchWholeCell}
                onChange={(e) => setMatchWholeCell(e.target.checked)}
                className="accent-sky-500"
              />
              {t('findReplace.matchWholeCell', 'Match whole cell')}
            </label>
          </div>

          {/* Scope */}
          {dataset && (
            <label className="flex items-center gap-1 text-xs" style={labelStyle}>
              {t('findReplace.scope', 'Search in')}
              <select
                value={searchScope}
                onChange={(e) => setSearchScope(e.target.value)}
                className="border rounded px-1 py-0.5 outline-none text-xs"
                style={inputStyle}
              >
                <option value="all">{t('findReplace.allColumns', 'All columns')}</option>
                {dataset.columns.map((col) => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </label>
          )}

          {/* Match count */}
          <div className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {matches.length > 0
              ? t('findReplace.matchCount', { current: currentMatchIdx + 1, total: matches.length, defaultValue: `${currentMatchIdx + 1} of ${matches.length} matches` })
              : findText
                ? t('findReplace.noMatches', 'No matches')
                : t('findReplace.typeToSearch', 'Type to search')}
          </div>
        </div>
      </div>
    </div>
  );
}
