import { useDatasetStore } from '@/store/datasetStore';
import { useChartStore, selectActiveChart } from '@/store/chartStore';
import { useToastStore } from '@/store/toastStore';
import { confirm } from '@/store/confirmStore';
import { Plus, Trash2, ArrowUpDown, ArrowDown, ArrowUp, Copy, ClipboardPaste, Filter, Sparkles, AlertTriangle, Search, X, FunctionSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DataColumn } from '@/types';
import { showContextMenu, type MenuItemOrSeparator } from '@/utils/contextMenu';
import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { DataProcessingModal, type DataProcessingMode } from '@/components/DataProcessingModal';
import { FindReplaceModal } from '@/components/FindReplaceModal';
import { ComputedColumnModal } from '@/components/ComputedColumnModal';

/** Approximate row height in pixels (must match the actual rendered row height). */
const ROW_HEIGHT = 28;
/** Number of extra rows to render above/below the visible viewport. */
const OVERSCAN = 5;
/** Threshold above which virtual scrolling kicks in. */
const VIRTUAL_THRESHOLD = 200;
/** Default column width in pixels. */
const DEFAULT_COL_WIDTH = 120;
/** Minimum column width in pixels. */
const MIN_COL_WIDTH = 60;

/** Column types that should contain numeric values. */
const NUMERIC_COLUMN_TYPES: DataColumn['type'][] = ['X', 'Y', 'Z', 'error', 'errorPlus', 'errorMinus'];

/** Check if a column type expects numeric values. */
function isNumericColumn(type: DataColumn['type']): boolean {
  return NUMERIC_COLUMN_TYPES.includes(type);
}

/** Check if a value is a valid number (or empty, which is allowed). */
function isValidNumericInput(value: string): boolean {
  if (value.trim() === '') return true;
  const n = Number(value);
  return !isNaN(n) && isFinite(n);
}

interface DataTableProps {
  showToolbar?: boolean;
}

export default function DataTable({ showToolbar = false }: DataTableProps) {
  const { t } = useTranslation();
  const datasets = useDatasetStore((s) => s.datasets);
  const activeDatasetId = useDatasetStore((s) => s.activeDatasetId);
  const setActiveDataset = useDatasetStore((s) => s.setActiveDataset);
  const updateCellValue = useDatasetStore((s) => s.updateCellValue);
  const updateCellValueSilent = useDatasetStore((s) => s.updateCellValueSilent);
  const addColumn = useDatasetStore((s) => s.addColumn);
  const removeColumn = useDatasetStore((s) => s.removeColumn);
  const addRow = useDatasetStore((s) => s.addRow);
  const insertRowAt = useDatasetStore((s) => s.insertRowAt);
  const removeRow = useDatasetStore((s) => s.removeRow);
  const setColumnType = useDatasetStore((s) => s.setColumnType);
  const renameColumn = useDatasetStore((s) => s.renameColumn);
  const sortDataset = useDatasetStore((s) => s.sortDataset);
  const addToast = useToastStore((s) => s.addToast);
  const activeChart = useChartStore((s) => selectActiveChart(s));

  const contextRef = useRef<{ colId: string; rowIdx: number } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [dataModal, setDataModal] = useState<{ mode: DataProcessingMode; columnId: string } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizingColRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showComputedColumn, setShowComputedColumn] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [lastSelectedRow, setLastSelectedRow] = useState<number | null>(null);

  const dataset = datasets.find((d) => d.id === activeDatasetId);

  // Read-only indicator: which columns the active chart's layers reference.
  // Pure visual cue — does NOT mutate column types.
  // - `isX`: column is used as the (shared) X axis in some layer.
  // - `traceColors`: distinct curve colors of layers using this column as Y/Z,
  //   so the dot color matches the curve on the chart / legend.
  const usedInfo = useMemo(() => {
    const map = new Map<string, { isX: boolean; traceColors: Set<string> }>();
    if (!dataset) return map;
    for (const layer of activeChart.layers) {
      if (layer.datasetId !== dataset.id) continue;
      const mark = (colId: string | undefined, role: 'X' | 'Y' | 'Z') => {
        if (!colId) return;
        const entry = map.get(colId) ?? { isX: false, traceColors: new Set<string>() };
        if (role === 'X') entry.isX = true;
        else entry.traceColors.add(layer.color);
        map.set(colId, entry);
      };
      mark(layer.xColumn, 'X');
      mark(layer.yColumn, 'Y');
      mark(layer.zColumn, 'Z');
    }
    return map;
  }, [activeChart.layers, dataset]);

  // Listen for Ctrl+F find/replace open event
  useEffect(() => {
    const handleFindOpen = () => setShowFindReplace(true);
    document.addEventListener('datatable-find-open', handleFindOpen);
    return () => document.removeEventListener('datatable-find-open', handleFindOpen);
  }, []);

  // Listen for Ctrl+A select all event
  useEffect(() => {
    const handleSelectAll = () => {
      if (!dataset) return;
      const maxRows = Math.max(...dataset.columns.map((c) => c.values.length), 0);
      setSelectedRows(new Set(Array.from({ length: maxRows }, (_, i) => i)));
    };
    document.addEventListener('datatable-select-all', handleSelectAll);
    return () => document.removeEventListener('datatable-select-all', handleSelectAll);
  }, [dataset]);

  // Clear selection when dataset changes
  useEffect(() => {
    setSelectedRows(new Set());
    setLastSelectedRow(null);
  }, [activeDatasetId]);

  /** Handle row header click for selection (Ctrl/Shift multi-select). */
  const handleRowSelect = useCallback((e: React.MouseEvent, rowIdx: number) => {
    e.preventDefault();
    if (e.shiftKey && lastSelectedRow !== null) {
      // Range select
      const start = Math.min(lastSelectedRow, rowIdx);
      const end = Math.max(lastSelectedRow, rowIdx);
      setSelectedRows((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) next.add(i);
        return next;
      });
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle single row
      setSelectedRows((prev) => {
        const next = new Set(prev);
        if (next.has(rowIdx)) next.delete(rowIdx);
        else next.add(rowIdx);
        return next;
      });
      setLastSelectedRow(rowIdx);
    } else {
      // Single select
      setSelectedRows(new Set([rowIdx]));
      setLastSelectedRow(rowIdx);
    }
  }, [lastSelectedRow]);

  /** Batch delete selected rows. */
  const handleBatchDelete = useCallback(() => {
    if (!dataset || selectedRows.size === 0) return;
    const rowsToDelete = Array.from(selectedRows).sort((a, b) => b - a); // descending to preserve indices
    confirm({
      title: t('findReplace.batchDeleteTitle', 'Delete Selected Rows'),
      message: t('findReplace.batchDeleteMessage', { count: selectedRows.size, defaultValue: `Delete ${selectedRows.size} selected rows? This can be undone with Ctrl+Z.` }),
      danger: true,
      onConfirm: () => {
        useDatasetStore.getState().removeRowsAt(dataset.id, rowsToDelete);
        setSelectedRows(new Set());
        setLastSelectedRow(null);
        addToast(t('toast.deleted'), 'info');
      },
    });
  }, [dataset, selectedRows, t, addToast]);

  /** Batch fill selected cells in a column with a value. */
  const handleBatchFill = useCallback((colId: string) => {
    if (!dataset || selectedRows.size === 0) return;
    const value = window.prompt(t('findReplace.fillValue', 'Enter value to fill:'), '');
    if (value === null) return;
    selectedRows.forEach((rowIdx) => {
      updateCellValueSilent(dataset.id, colId, rowIdx, value);
    });
    addToast(t('findReplace.filled', { count: selectedRows.size, defaultValue: `Filled ${selectedRows.size} cells` }), 'success');
  }, [dataset, selectedRows, updateCellValueSilent, t, addToast]);

  /** Clear row selection. */
  const handleClearSelection = useCallback(() => {
    setSelectedRows(new Set());
    setLastSelectedRow(null);
  }, []);

  /** Get the width for a column, falling back to the default. */
  const getColWidth = useCallback((colId: string) => columnWidths[colId] ?? DEFAULT_COL_WIDTH, [columnWidths]);

  /** Start dragging a column's resize handle. */
  const startColResize = useCallback((e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = getColWidth(colId);
    resizingColRef.current = { colId, startX: e.clientX, startWidth };
  }, [getColWidth]);

  // Track column resize drag globally
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const ref = resizingColRef.current;
      if (!ref) return;
      const delta = e.clientX - ref.startX;
      const newWidth = Math.max(MIN_COL_WIDTH, ref.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [ref.colId]: newWidth }));
    };
    const handleMouseUp = () => { resizingColRef.current = null; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  /** Focus a cell input by row and column index using data attributes. */
  const focusCell = useCallback((rowIdx: number, colIdx: number) => {
    const el = scrollContainerRef.current?.querySelector(
      `input[data-row="${rowIdx}"][data-col="${colIdx}"]`
    ) as HTMLInputElement | null;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  /** Handle keyboard navigation within a cell input. */
  const handleCellKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number, _totalCols: number, totalRows: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (rowIdx < totalRows - 1) focusCell(rowIdx + 1, colIdx);
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      if (rowIdx > 0) focusCell(rowIdx - 1, colIdx);
    } else if (e.key === 'ArrowDown' && e.altKey) {
      e.preventDefault();
      if (rowIdx < totalRows - 1) focusCell(rowIdx + 1, colIdx);
    } else if (e.key === 'ArrowUp' && e.altKey) {
      e.preventDefault();
      if (rowIdx > 0) focusCell(rowIdx - 1, colIdx);
    }
    // Tab / Shift+Tab are handled natively by the browser for focus order,
    // but we ensure the next cell input is within the rendered viewport.
  }, [focusCell]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => setScrollTop(el.scrollTop);
    const handleResize = () => setViewportHeight(el.clientHeight);
    handleResize();
    el.addEventListener('scroll', handleScroll, { passive: true });
    const resizeObserver = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    resizeObserver.observe(el);
    return () => {
      el.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, []);

  const maxRows = Math.max(...(dataset?.columns.map((c) => c.values.length) ?? [0]), 0);
  const useVirtual = maxRows > VIRTUAL_THRESHOLD;

  // Compute visible row range
  const { startIndex, endIndex, totalHeight, offsetY } = useMemo(() => {
    if (!useVirtual) {
      return { startIndex: 0, endIndex: maxRows, totalHeight: 0, offsetY: 0 };
    }
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;
    const endIndex = Math.min(maxRows, startIndex + visibleCount);
    const totalHeight = maxRows * ROW_HEIGHT;
    const offsetY = startIndex * ROW_HEIGHT;
    return { startIndex, endIndex, totalHeight, offsetY };
  }, [useVirtual, maxRows, scrollTop, viewportHeight]);

  const handleCellContextMenu = useCallback((e: React.MouseEvent, colId: string, rowIdx: number) => {
    if (!dataset) return;
    contextRef.current = { colId, rowIdx };
    const items: MenuItemOrSeparator[] = [
      { label: t('context.insertRowAbove'), icon: <ArrowUp size={14} />, onClick: () => insertRowAt(dataset.id, rowIdx, 0) },
      { label: t('context.insertRowBelow'), icon: <ArrowDown size={14} />, onClick: () => insertRowAt(dataset.id, rowIdx, 1) },
      { separator: true },
      { label: t('context.deleteRow'), icon: <Trash2 size={14} />, onClick: () => { removeRow(dataset.id, rowIdx); addToast(t('toast.deleted'), 'info'); }, danger: true },
      { separator: true },
      { label: t('context.insertColumnLeft'), icon: <Plus size={14} />, onClick: () => addColumn(dataset.id) },
      { label: t('context.deleteColumn'), icon: <Trash2 size={14} />, onClick: () => { confirm({ title: t('confirm.deleteColumnTitle'), message: t('confirm.deleteColumnMessage'), danger: true, onConfirm: () => { removeColumn(dataset.id, colId); addToast(t('toast.deleted'), 'info'); } }); }, danger: true },
      { separator: true },
      { label: t('context.sortAsc'), icon: <ArrowUpDown size={14} />, onClick: () => sortDataset(dataset.id, colId, true) },
      { label: t('context.sortDesc'), icon: <ArrowUpDown size={14} />, onClick: () => sortDataset(dataset.id, colId, false) },
      { separator: true },
      { label: t('context.filterRows'), icon: <Filter size={14} />, onClick: () => setDataModal({ mode: 'filter', columnId: colId }) },
      { label: t('context.fillMissing'), icon: <Sparkles size={14} />, onClick: () => setDataModal({ mode: 'missing', columnId: colId }) },
      { label: t('context.handleOutliers'), icon: <AlertTriangle size={14} />, onClick: () => setDataModal({ mode: 'outlier', columnId: colId }) },
    ];
    // Add batch operations when rows are selected
    if (selectedRows.size > 0) {
      items.push({ separator: true });
      items.push({
        label: t('findReplace.batchDelete', { count: selectedRows.size, defaultValue: `Delete ${selectedRows.size} Selected Rows` }),
        icon: <Trash2 size={14} />,
        onClick: handleBatchDelete,
        danger: true,
      });
      items.push({
        label: t('findReplace.batchFill', 'Fill Selected Cells'),
        icon: <Sparkles size={14} />,
        onClick: () => handleBatchFill(colId),
      });
    }
    items.push({ separator: true });
    items.push({
      label: t('context.copyCell'), icon: <Copy size={14} />,
      onClick: () => {
        const col = dataset.columns.find((c) => c.id === colId);
        if (col) navigator.clipboard.writeText(String(col.values[rowIdx] ?? ''));
      },
    });
    items.push({
      label: t('context.copyColumn'), icon: <ClipboardPaste size={14} />,
      onClick: () => {
        const col = dataset.columns.find((c) => c.id === colId);
        if (col) navigator.clipboard.writeText(col.values.join('\n'));
      },
    });
    showContextMenu(e, items);
  }, [dataset, insertRowAt, removeRow, addColumn, removeColumn, sortDataset, t, addToast, selectedRows, handleBatchDelete, handleBatchFill]);

  const handleHeaderContextMenu = useCallback((e: React.MouseEvent, colId: string) => {
    if (!dataset) return;
    contextRef.current = { colId, rowIdx: -1 };
    const items: MenuItemOrSeparator[] = [
      { label: t('context.insertColumnLeft'), icon: <Plus size={14} />, onClick: () => addColumn(dataset.id) },
      { label: t('context.deleteColumn'), icon: <Trash2 size={14} />, onClick: () => { confirm({ title: t('confirm.deleteColumnTitle'), message: t('confirm.deleteColumnMessage'), danger: true, onConfirm: () => { removeColumn(dataset.id, colId); addToast(t('toast.deleted'), 'info'); } }); }, danger: true },
      { separator: true },
      { label: t('context.sortAsc'), icon: <ArrowUpDown size={14} />, onClick: () => sortDataset(dataset.id, colId, true) },
      { label: t('context.sortDesc'), icon: <ArrowUpDown size={14} />, onClick: () => sortDataset(dataset.id, colId, false) },
      { separator: true },
      { label: t('context.filterRows'), icon: <Filter size={14} />, onClick: () => setDataModal({ mode: 'filter', columnId: colId }) },
      { label: t('context.fillMissing'), icon: <Sparkles size={14} />, onClick: () => setDataModal({ mode: 'missing', columnId: colId }) },
      { label: t('context.handleOutliers'), icon: <AlertTriangle size={14} />, onClick: () => setDataModal({ mode: 'outlier', columnId: colId }) },
      { separator: true },
      {
        label: t('context.copyColumn'), icon: <ClipboardPaste size={14} />,
        onClick: () => {
          const col = dataset.columns.find((c) => c.id === colId);
          if (col) navigator.clipboard.writeText(col.values.join('\n'));
        },
      },
    ];
    showContextMenu(e, items);
  }, [dataset, addColumn, removeColumn, sortDataset, t, addToast]);

  if (!dataset) return <div className="p-4" style={{ color: 'var(--text-muted)' }}>{t('data.noDataset')}</div>;

  const typeColors: Record<DataColumn['type'], { className: string; style: React.CSSProperties }> = {
    X: { className: 'border', style: { background: 'color-mix(in srgb, var(--color-x) 18%, transparent)', color: 'var(--color-x)', borderColor: 'color-mix(in srgb, var(--color-x) 35%, transparent)' } },
    Y: { className: 'border', style: { background: 'color-mix(in srgb, var(--color-y) 18%, transparent)', color: 'var(--color-y)', borderColor: 'color-mix(in srgb, var(--color-y) 35%, transparent)' } },
    Z: { className: 'border', style: { background: 'color-mix(in srgb, var(--color-z) 18%, transparent)', color: 'var(--color-z)', borderColor: 'color-mix(in srgb, var(--color-z) 35%, transparent)' } },
    label: { className: 'border', style: { background: 'color-mix(in srgb, var(--color-label) 18%, transparent)', color: 'var(--color-label)', borderColor: 'color-mix(in srgb, var(--color-label) 35%, transparent)' } },
    error: { className: 'border', style: { background: 'color-mix(in srgb, var(--color-error) 18%, transparent)', color: 'var(--color-error)', borderColor: 'color-mix(in srgb, var(--color-error) 35%, transparent)' } },
    errorPlus: { className: 'border', style: { background: 'color-mix(in srgb, var(--color-error) 14%, transparent)', color: 'var(--color-error)', borderColor: 'color-mix(in srgb, var(--color-error) 28%, transparent)' } },
    errorMinus: { className: 'border', style: { background: 'color-mix(in srgb, var(--color-error) 14%, transparent)', color: 'var(--color-error)', borderColor: 'color-mix(in srgb, var(--color-error) 28%, transparent)' } },
  };

  const typeOptions: { value: DataColumn['type']; label: string }[] = [
    { value: 'X', label: t('data.xAxis') },
    { value: 'Y', label: t('data.yAxis') },
    { value: 'Z', label: t('data.zAxis3d') },
    { value: 'label', label: t('data.label') },
    { value: 'error', label: t('data.error') },
    { value: 'errorPlus', label: t('data.errorPlus') },
    { value: 'errorMinus', label: t('data.errorMinus') },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Dataset tabs */}
      <div className="flex items-center gap-1 px-2 py-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border)', background: 'var(--bg-input)' }}>
        {datasets.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveDataset(d.id)}
            className="px-3 py-1 rounded text-xs transition-all shrink-0"
            style={d.id === activeDatasetId
              ? { background: 'color-mix(in srgb, var(--accent) 18%, transparent)', color: 'var(--accent)' }
              : { color: 'var(--text-muted)' }
            }
            onMouseEnter={(e) => { if (d.id !== activeDatasetId) e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { if (d.id !== activeDatasetId) e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      {showToolbar && (
        <div className="flex items-center gap-1 px-2 py-1 border-b shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <button
            onClick={() => addRow(dataset.id)}
            className="flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <Plus size={12} />
            {t('data.addRow')}
          </button>
          <button
            onClick={() => addColumn(dataset.id)}
            className="flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <Plus size={12} />
            {t('data.addColumn')}
          </button>
          <div className="w-px h-3 mx-1" style={{ background: 'var(--border)' }} />
          <button
            onClick={() => setShowFindReplace(true)}
            className="flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <Search size={12} />
            {t('findReplace.title')}
          </button>
          <div className="w-px h-3 mx-1" style={{ background: 'var(--border)' }} />
          <button
            onClick={() => setShowComputedColumn(true)}
            className="flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <FunctionSquare size={12} />
            F(x)
          </button>
          {selectedRows.size > 0 && (
            <>
              <div className="w-px h-3 mx-1" style={{ background: 'var(--border)' }} />
              <button
                onClick={handleBatchDelete}
                className="flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors"
                style={{ color: 'var(--danger)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--danger) 12%, transparent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <Trash2 size={12} />
                {t('findReplace.batchDelete', { count: selectedRows.size, defaultValue: `Delete ${selectedRows.size} Selected Rows` })}
              </button>
              <button
                onClick={handleClearSelection}
                className="flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <X size={12} />
                {t('findReplace.clearSelection', 'Clear Selection')}
              </button>
            </>
          )}
        </div>
      )}

      {/* Table */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: 'var(--bg-surface)' }}>
              <th className="px-2 py-1 font-normal border-b border-r w-10" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>#</th>
              {dataset.columns.map((col) => (
                <th key={col.id} className="border-b border-r min-w-[80px] relative" style={{ borderColor: 'var(--border)', width: getColWidth(col.id), ...(usedInfo.has(col.id) ? { boxShadow: 'inset 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent)' } : {}) }}
                  onContextMenu={(e) => handleHeaderContextMenu(e, col.id)}
                >
                  <div className="flex flex-col items-center gap-0.5 px-1 py-1">
                    {usedInfo.get(col.id) && (
                      <div
                        className="flex items-center justify-center gap-0.5"
                        title={t('data.usedInActiveChart')}
                      >
                        {usedInfo.get(col.id)!.isX && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-x)' }} />
                        )}
                        {[...usedInfo.get(col.id)!.traceColors].map((c, i) => (
                          <span key={i} className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: c }} title={c} />
                        ))}
                      </div>
                    )}
                    <select
                      value={col.type}
                      onChange={(e) => setColumnType(dataset.id, col.id, e.target.value as DataColumn['type'])}
                      className={`text-xs font-bold px-1.5 py-0.5 rounded cursor-pointer outline-none ${typeColors[col.type].className}`}
                      style={typeColors[col.type].style}
                    >
                      {typeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1 w-full">
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) => renameColumn(dataset.id, col.id, e.target.value)}
                        className="flex-1 text-center outline-none min-w-0"
                        style={{ background: 'transparent', color: 'var(--text-primary)' }}
                      />
                      <button
                        onClick={() => confirm({ title: t('confirm.deleteColumnTitle'), message: t('confirm.deleteColumnMessage'), danger: true, onConfirm: () => removeColumn(dataset.id, col.id) })}
                        className="transition-colors shrink-0"
                        style={{ color: 'var(--text-faint)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                  {/* Column resize handle */}
                  <div
                    onMouseDown={(e) => startColResize(e, col.id)}
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-sky-500/40 transition-colors"
                    style={{ zIndex: 1 }}
                    title={t('data.dragToResize', 'Drag to resize column')}
                  />
                </th>
              ))}
              <th className="border-b w-8" style={{ borderColor: 'var(--border)' }}>
                <button
                  onClick={() => addColumn(dataset.id)}
                  className="transition-colors p-1"
                  style={{ color: 'var(--text-faint)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
                >
                  <Plus size={12} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {useVirtual && offsetY > 0 && (
              <tr style={{ height: offsetY }}>
                <td colSpan={dataset.columns.length + 2} style={{ padding: 0, border: 'none' }} />
              </tr>
            )}
            {Array.from({ length: (useVirtual ? endIndex - startIndex : maxRows) }).map((_, i) => {
              const rowIdx = useVirtual ? startIndex + i : i;
              const isSelected = selectedRows.has(rowIdx);
              return (
                <tr key={rowIdx} className="transition-colors"
                  style={{ background: isSelected ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent' }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <td
                    className="px-2 py-0.5 border-r text-right cursor-pointer select-none"
                    style={{ color: isSelected ? 'var(--accent)' : 'var(--text-faint)', borderColor: 'var(--border)', fontWeight: isSelected ? 600 : 400 }}
                    onClick={(e) => handleRowSelect(e, rowIdx)}
                    onContextMenu={(e) => { handleRowSelect(e, rowIdx); }}
                  >
                    {rowIdx + 1}
                  </td>
                  {dataset.columns.map((col, colIdx) => {
                    const cellValue = String(col.values[rowIdx] ?? '');
                    const isNumeric = isNumericColumn(col.type);
                    const isInvalid = isNumeric && !isValidNumericInput(cellValue);
                    return (
                    <td key={col.id} className="border-r" style={{ borderColor: 'var(--border)' }}
                      onContextMenu={(e) => handleCellContextMenu(e, col.id, rowIdx)}
                    >
                      <input
                        type="text"
                        value={cellValue}
                        data-row={rowIdx}
                        data-col={colIdx}
                        onChange={(e) => updateCellValueSilent(dataset.id, col.id, rowIdx, e.target.value)}
                        onBlur={(e) => updateCellValue(dataset.id, col.id, rowIdx, e.target.value)}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIdx, colIdx, dataset.columns.length, maxRows)}
                        className="w-full px-2 py-0.5 outline-none transition-colors"
                        style={{
                          background: 'transparent',
                          color: isInvalid ? 'var(--color-error)' : 'var(--text-primary)',
                          borderBottom: isInvalid ? '2px solid var(--color-error)' : undefined,
                        }}
                        title={isInvalid ? t('data.invalidValue', 'Please enter a valid number') : undefined}
                        onFocus={(e) => { e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
                      />
                    </td>
                    );
                  })}
                  <td className="text-center">
                    <button
                      onClick={() => { removeRow(dataset.id, rowIdx); addToast(t('toast.deleted'), 'info'); }}
                      className="transition-colors"
                      style={{ color: 'var(--text-faint)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
                    >
                      <Trash2 size={10} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {useVirtual && totalHeight - offsetY - (endIndex - startIndex) * ROW_HEIGHT > 0 && (
              <tr style={{ height: totalHeight - offsetY - (endIndex - startIndex) * ROW_HEIGHT }}>
                <td colSpan={dataset.columns.length + 2} style={{ padding: 0, border: 'none' }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add row button (hidden when toolbar is shown) */}
      {!showToolbar && (
        <div className="border-t p-1" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => addRow(dataset.id)}
            className="flex items-center gap-1 px-2 py-1 text-xs transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <Plus size={12} />
            {t('data.addRow')}
          </button>
        </div>
      )}

      {dataModal && (
        <DataProcessingModal
          mode={dataModal.mode}
          columnId={dataModal.columnId}
          onClose={() => setDataModal(null)}
        />
      )}

      {showFindReplace && (
        <FindReplaceModal onClose={() => setShowFindReplace(false)} />
      )}

      {showComputedColumn && dataset && (
        <ComputedColumnModal
          datasetId={dataset.id}
          onClose={() => setShowComputedColumn(false)}
        />
      )}
    </div>
  );
}
