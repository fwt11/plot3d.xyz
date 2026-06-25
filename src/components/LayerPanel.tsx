import { useState, useCallback, useRef, useMemo } from 'react';
import { useChartStore } from '@/store/chartStore';
import { useDatasetStore } from '@/store/datasetStore';
import { useToastStore } from '@/store/toastStore';
import { confirm } from '@/store/confirmStore';
import { Eye, EyeOff, Trash2, Plus, ChevronDown, ChevronRight, Copy, Lock, Unlock, GripVertical, Search, ArrowUpToLine, ArrowDownToLine, Palette } from 'lucide-react';
import { uid } from '@/utils/sampleData';
import { is3DChart } from '@/utils/chart';
import { useTranslation } from 'react-i18next';
import { showContextMenu, type MenuItemOrSeparator } from '@/utils/contextMenu';
import type { LayerConfig } from '@/types';

// ─── Style Presets ──────────────────────────────────────────────
interface StylePreset {
  id: string;
  nameKey: string;
  defaultName: string;
  apply: (layer: LayerConfig) => Partial<LayerConfig>;
}

const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'line-solid',
    nameKey: 'layer.presetLineSolid',
    defaultName: 'Solid Line',
    apply: () => ({ lineStyle: 'solid', lineWidth: 3, pointStyle: 'circle', pointSize: 6, fill: false }),
  },
  {
    id: 'line-dashed',
    nameKey: 'layer.presetLineDashed',
    defaultName: 'Dashed Line',
    apply: () => ({ lineStyle: 'dashed', lineWidth: 3, pointStyle: 'circle', pointSize: 6, fill: false }),
  },
  {
    id: 'scatter',
    nameKey: 'layer.presetScatter',
    defaultName: 'Scatter Only',
    apply: () => ({ lineStyle: 'solid', lineWidth: 1, pointStyle: 'circle', pointSize: 8, fill: false }),
  },
  {
    id: 'area-fill',
    nameKey: 'layer.presetAreaFill',
    defaultName: 'Area Fill',
    apply: () => ({ lineStyle: 'solid', lineWidth: 3, pointStyle: 'none', pointSize: 4, fill: true }),
  },
  {
    id: 'bold',
    nameKey: 'layer.presetBold',
    defaultName: 'Bold Line',
    apply: () => ({ lineStyle: 'solid', lineWidth: 5, pointStyle: 'circle', pointSize: 8, fill: false }),
  },
];

export default function LayerPanel() {
  const { t } = useTranslation();
  const chartConfig = useChartStore((s) => s.chartConfig);
  const datasets = useDatasetStore((s) => s.datasets);
  const addLayer = useChartStore((s) => s.addLayer);
  const removeLayer = useChartStore((s) => s.removeLayer);
  const updateLayer = useChartStore((s) => s.updateLayer);
  const moveLayer = useChartStore((s) => s.moveLayer);
  const reorderLayers = useChartStore((s) => s.reorderLayers);
  const addToast = useToastStore((s) => s.addToast);
  const is3D = is3DChart(chartConfig.type);

  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [showPresetsFor, setShowPresetsFor] = useState<string | null>(null);
  const dragLayerIdRef = useRef<string | null>(null);
  const dragOverIndexRef = useRef<number | null>(null);

  const toggleExpand = (layerId: string) => {
    setExpandedLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
  };

  // Filtered layers based on search query
  const filteredLayers = useMemo(() => {
    if (!searchQuery.trim()) return chartConfig.layers;
    const q = searchQuery.toLowerCase();
    return chartConfig.layers.filter((layer) => {
      const ds = datasets.find((d) => d.id === layer.datasetId);
      const name = (layer.displayName || ds?.name || '').toLowerCase();
      return name.includes(q);
    });
  }, [chartConfig.layers, datasets, searchQuery]);

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg-input)',
    borderColor: 'var(--border)',
    color: 'var(--text-primary)',
  };

  const labelStyle: React.CSSProperties = {
    color: 'var(--text-secondary)',
  };

  // ─── Drag and drop handlers ─────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, layerId: string) => {
    dragLayerIdRef.current = layerId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', layerId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverIndexRef.current = index;
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const draggedId = dragLayerIdRef.current;
    if (!draggedId) return;
    const layers = chartConfig.layers;
    const fromIndex = layers.findIndex((l) => l.id === draggedId);
    if (fromIndex === -1) return;
    // Compute the actual target index in the full layers array
    let toIndex = targetIndex;
    if (fromIndex < toIndex) toIndex -= 1; // account for removal
    if (toIndex !== fromIndex) {
      moveLayer(draggedId, toIndex);
    }
    dragLayerIdRef.current = null;
    dragOverIndexRef.current = null;
  }, [chartConfig.layers, moveLayer]);

  const handleDragEnd = useCallback(() => {
    dragLayerIdRef.current = null;
    dragOverIndexRef.current = null;
  }, []);

  // ─── Move to top / bottom ───────────────────────────────────
  const handleMoveToTop = useCallback((layerId: string) => {
    reorderLayers([layerId, ...chartConfig.layers.filter((l) => l.id !== layerId).map((l) => l.id)]);
  }, [chartConfig.layers, reorderLayers]);

  const handleMoveToBottom = useCallback((layerId: string) => {
    reorderLayers([...chartConfig.layers.filter((l) => l.id !== layerId).map((l) => l.id), layerId]);
  }, [chartConfig.layers, reorderLayers]);

  // ─── Lock / unlock layer ────────────────────────────────────
  const handleToggleLock = useCallback((layerId: string) => {
    const layer = chartConfig.layers.find((l) => l.id === layerId);
    if (!layer) return;
    updateLayer(layerId, { locked: !layer.locked });
  }, [chartConfig.layers, updateLayer]);

  // ─── Apply style preset ─────────────────────────────────────
  const handleApplyPreset = useCallback((layerId: string, preset: StylePreset) => {
    const layer = chartConfig.layers.find((l) => l.id === layerId);
    if (!layer) return;
    updateLayer(layerId, preset.apply(layer));
    setShowPresetsFor(null);
    addToast(t('layer.presetApplied', { defaultValue: 'Style preset applied' }), 'success');
  }, [chartConfig.layers, updateLayer, addToast, t]);

  const handleLayerContextMenu = useCallback((e: React.MouseEvent, layerId: string) => {
    const layer = chartConfig.layers.find((l) => l.id === layerId);
    if (!layer) return;
    const idx = chartConfig.layers.findIndex((l) => l.id === layerId);
    const isLocked = !!layer.locked;
    const items: MenuItemOrSeparator[] = [
      {
        label: layer.visible ? t('context.hideLayer') : t('context.showLayer'),
        icon: layer.visible ? <EyeOff size={14} /> : <Eye size={14} />,
        onClick: () => updateLayer(layerId, { visible: !layer.visible }),
      },
      {
        label: isLocked ? t('layer.unlock', 'Unlock Layer') : t('layer.lock', 'Lock Layer'),
        icon: isLocked ? <Unlock size={14} /> : <Lock size={14} />,
        onClick: () => handleToggleLock(layerId),
      },
      { separator: true },
      {
        label: t('layer.moveToTop', 'Move to Top'),
        icon: <ArrowUpToLine size={14} />,
        onClick: () => handleMoveToTop(layerId),
        disabled: idx === 0,
      },
      {
        label: t('layer.moveToBottom', 'Move to Bottom'),
        icon: <ArrowDownToLine size={14} />,
        onClick: () => handleMoveToBottom(layerId),
        disabled: idx === chartConfig.layers.length - 1,
      },
      { separator: true },
      {
        label: t('context.duplicateLayer'),
        icon: <Copy size={14} />,
        onClick: () => {
          addLayer({ ...layer, id: uid(), displayName: (layer.displayName || layer.datasetId) + ' (copy)', locked: false });
        },
      },
      { separator: true },
      {
        label: t('context.deleteLayer'),
        icon: <Trash2 size={14} />,
        onClick: () => { confirm({ title: t('confirm.deleteLayerTitle'), message: t('confirm.deleteLayerMessage'), danger: true, onConfirm: () => { removeLayer(layerId); addToast(t('toast.deleted'), 'info'); } }); },
        danger: true,
        disabled: isLocked,
      },
    ];
    showContextMenu(e, items);
  }, [chartConfig.layers, updateLayer, addLayer, removeLayer, handleToggleLock, handleMoveToTop, handleMoveToBottom, t, addToast]);

  return (
    <div className="h-full overflow-y-auto text-xs flex flex-col">
      {/* Search / filter */}
      <div className="p-2 sticky top-0 z-10" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-1 px-2 py-1 rounded" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
          <Search size={12} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('layer.searchPlaceholder', 'Search layers...')}
            className="flex-1 bg-transparent outline-none text-xs"
            style={{ color: 'var(--text-primary)' }}
            aria-label={t('layer.searchPlaceholder', 'Search layers...')}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ color: 'var(--text-muted)' }}
              aria-label={t('layer.clearSearch', 'Clear')}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Layer list */}
      <div className="flex-1 p-1 space-y-1">
        {filteredLayers.map((layer) => {
          const ds = datasets.find((d) => d.id === layer.datasetId);
          const errorColumns = ds ? ds.columns.filter((c) => c.type === 'error') : [];
          const errorPlusColumns = ds ? ds.columns.filter((c) => c.type === 'errorPlus') : [];
          const errorMinusColumns = ds ? ds.columns.filter((c) => c.type === 'errorMinus') : [];
          const isExpanded = expandedLayers.has(layer.id);
          const isLocked = !!layer.locked;
          const displayName = layer.displayName || ds?.name || layer.datasetId;
          const actualIndex = chartConfig.layers.findIndex((l) => l.id === layer.id);
          const isEditingName = editingNameId === layer.id;
          const isDragging = dragLayerIdRef.current === layer.id;

          return (
            <div
              key={layer.id}
              draggable={!isLocked}
              onDragStart={(e) => handleDragStart(e, layer.id)}
              onDragOver={(e) => handleDragOver(e, actualIndex)}
              onDrop={(e) => handleDrop(e, actualIndex)}
              onDragEnd={handleDragEnd}
              className="rounded space-y-1.5 transition-opacity"
              style={{
                background: 'var(--bg-surface)',
                opacity: isDragging ? 0.5 : 1,
                border: '1px solid var(--border)',
              }}
              onContextMenu={(e) => handleLayerContextMenu(e, layer.id)}
            >
              {/* Header row: drag handle + visibility + name + lock + delete */}
              <div className="flex items-center gap-1 p-1.5">
                <span
                  className="cursor-grab active:cursor-grabbing shrink-0"
                  style={{ color: isLocked ? 'var(--text-faint)' : 'var(--text-muted)' }}
                  title={t('layer.dragToSort', 'Drag to reorder')}
                >
                  <GripVertical size={12} />
                </span>
                <button
                  onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
                  className="transition-colors shrink-0"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  aria-label={layer.visible ? t('layer.hideLayer', 'Hide layer') : t('layer.showLayer', 'Show layer')}
                >
                  {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                {isEditingName ? (
                  <input
                    type="text"
                    autoFocus
                    defaultValue={layer.displayName ?? ''}
                    placeholder={ds?.name ?? layer.datasetId}
                    onBlur={(e) => {
                      updateLayer(layer.id, { displayName: e.target.value || undefined });
                      setEditingNameId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateLayer(layer.id, { displayName: (e.target as HTMLInputElement).value || undefined });
                        setEditingNameId(null);
                      } else if (e.key === 'Escape') {
                        setEditingNameId(null);
                      }
                    }}
                    className="flex-1 bg-transparent outline-none text-xs border-b"
                    style={{ color: 'var(--text-primary)', borderColor: 'var(--accent)' }}
                    aria-label={t('layer.displayName', 'Display name')}
                  />
                ) : (
                  <button
                    onClick={() => !isLocked && setEditingNameId(layer.id)}
                    className="flex-1 text-left text-xs truncate transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                    title={t('layer.clickToEdit', 'Click to edit name')}
                    disabled={isLocked}
                  >
                    {displayName}
                  </button>
                )}
                <button
                  onClick={() => handleToggleLock(layer.id)}
                  className="transition-colors shrink-0"
                  style={{ color: isLocked ? 'var(--accent)' : 'var(--text-faint)' }}
                  title={isLocked ? t('layer.unlock', 'Unlock Layer') : t('layer.lock', 'Lock Layer')}
                  aria-label={isLocked ? t('layer.unlock', 'Unlock Layer') : t('layer.lock', 'Lock Layer')}
                >
                  {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
                <button
                  onClick={() => setShowPresetsFor(showPresetsFor === layer.id ? null : layer.id)}
                  className="transition-colors shrink-0"
                  style={{ color: showPresetsFor === layer.id ? 'var(--accent)' : 'var(--text-faint)' }}
                  title={t('layer.stylePresets', 'Style Presets')}
                  disabled={isLocked}
                  aria-label={t('layer.stylePresets', 'Style Presets')}
                >
                  <Palette size={12} />
                </button>
                <button
                  onClick={() => confirm({ title: t('confirm.deleteLayerTitle'), message: t('confirm.deleteLayerMessage'), danger: true, onConfirm: () => removeLayer(layer.id) })}
                  className="transition-colors shrink-0"
                  style={{ color: 'var(--text-muted)', opacity: isLocked ? 0.3 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={(e) => { if (!isLocked) e.currentTarget.style.color = '#fb7185'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  disabled={isLocked}
                  aria-label={t('layer.deleteLayer', 'Delete layer')}
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Style preset quick bar */}
              {showPresetsFor === layer.id && (
                <div className="flex flex-wrap gap-1 px-1.5 pb-1.5">
                  {STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleApplyPreset(layer.id, preset)}
                      className="px-2 py-0.5 rounded text-xs transition-colors"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                      {t(preset.nameKey, preset.defaultName)}
                    </button>
                  ))}
                </div>
              )}

              {/* Dataset + color row */}
              <div className="flex items-center gap-2 px-1.5">
                <select
                  value={layer.datasetId}
                  onChange={(e) => {
                    const newDs = datasets.find((d) => d.id === e.target.value);
                    if (!newDs) return;
                    const xCol = newDs.columns.find((c) => c.type === 'X') ?? newDs.columns[0];
                    const yCol = newDs.columns.find((c) => c.type === 'Y') ?? newDs.columns[1];
                    const zCol = newDs.columns.find((c) => c.type === 'Z');
                    updateLayer(layer.id, {
                      datasetId: newDs.id,
                      xColumn: xCol?.id ?? '',
                      yColumn: yCol?.id ?? '',
                      zColumn: zCol?.id,
                      errorColumn: undefined,
                    });
                  }}
                  disabled={isLocked}
                  className="flex-1 border rounded px-1.5 py-0.5 text-xs outline-none"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)', opacity: isLocked ? 0.6 : 1 }}
                  aria-label={t('layer.selectDataset', 'Select dataset')}
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <input
                  type="color"
                  value={layer.color}
                  onChange={(e) => updateLayer(layer.id, { color: e.target.value })}
                  disabled={isLocked}
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                  style={{ opacity: isLocked ? 0.6 : 1 }}
                  aria-label={t('layer.color', 'Layer color')}
                />
              </div>

              {/* X/Y/Z column selectors */}
              {ds && (
                <div className="flex gap-1.5 px-1.5">
                  <label className="flex items-center gap-1 text-xs" style={labelStyle}>
                    X
                    <select
                      value={layer.xColumn}
                      onChange={(e) => updateLayer(layer.id, { xColumn: e.target.value })}
                      disabled={isLocked}
                      className="border rounded px-1 py-0.5 outline-none"
                      style={{ ...selectStyle, opacity: isLocked ? 0.6 : 1 }}
                      aria-label={t('layer.xColumn', 'X column')}
                    >
                      {ds.columns.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1 text-xs" style={labelStyle}>
                    Y
                    <select
                      value={layer.yColumn}
                      onChange={(e) => updateLayer(layer.id, { yColumn: e.target.value })}
                      disabled={isLocked}
                      className="border rounded px-1 py-0.5 outline-none"
                      style={{ ...selectStyle, opacity: isLocked ? 0.6 : 1 }}
                      aria-label={t('layer.yColumn', 'Y column')}
                    >
                      {ds.columns.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                  {is3D && (
                    <label className="flex items-center gap-1 text-xs" style={labelStyle}>
                      Z
                      <select
                        value={layer.zColumn ?? ''}
                        onChange={(e) => updateLayer(layer.id, { zColumn: e.target.value || undefined })}
                        disabled={isLocked}
                        className="border rounded px-1 py-0.5 outline-none"
                        style={{ ...selectStyle, opacity: isLocked ? 0.6 : 1 }}
                        aria-label={t('layer.zColumn', 'Z column')}
                      >
                        <option value="">{t('layer.none')}</option>
                        {ds.columns.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}

              {/* Style toggle button */}
              <button
                onClick={() => toggleExpand(layer.id)}
                className="flex items-center gap-1 text-xs w-full transition-colors px-1.5"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                aria-label={t('layer.style', 'Style')}
              >
                {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                {t('layer.style', 'Style')}
              </button>

              {/* Collapsible style options */}
              {isExpanded && (
                <div className="space-y-1.5 px-1.5 pb-1.5" style={{ borderTop: '1px solid var(--border)', paddingTop: 4 }}>
                  <div className="flex gap-1.5">
                    <label className="flex items-center gap-1 text-xs flex-1" style={labelStyle}>
                      {t('layer.lineStyle', 'Line Style')}
                      <select
                        value={layer.lineStyle}
                        onChange={(e) => updateLayer(layer.id, { lineStyle: e.target.value as 'solid' | 'dashed' | 'dotted' })}
                        disabled={isLocked}
                        className="border rounded px-1 py-0.5 outline-none flex-1"
                        style={{ ...selectStyle, opacity: isLocked ? 0.6 : 1 }}
                        aria-label={t('layer.lineStyle', 'Line Style')}
                      >
                        <option value="solid">{t('layer.solid', 'Solid')}</option>
                        <option value="dashed">{t('layer.dashed', 'Dashed')}</option>
                        <option value="dotted">{t('layer.dotted', 'Dotted')}</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-1 text-xs" style={labelStyle}>
                      {t('layer.lineWidth', 'Line Width')}
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={layer.lineWidth}
                        onChange={(e) => updateLayer(layer.id, { lineWidth: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
                        disabled={isLocked}
                        className="border rounded px-1 py-0.5 outline-none w-10 text-center"
                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)', opacity: isLocked ? 0.6 : 1 }}
                        aria-label={t('layer.lineWidth', 'Line Width')}
                      />
                    </label>
                  </div>
                  <div className="flex gap-1.5">
                    <label className="flex items-center gap-1 text-xs flex-1" style={labelStyle}>
                      {t('layer.pointStyle', 'Point Style')}
                      <select
                        value={layer.pointStyle}
                        onChange={(e) => updateLayer(layer.id, { pointStyle: e.target.value as 'circle' | 'square' | 'triangle' | 'none' })}
                        disabled={isLocked}
                        className="border rounded px-1 py-0.5 outline-none flex-1"
                        style={{ ...selectStyle, opacity: isLocked ? 0.6 : 1 }}
                        aria-label={t('layer.pointStyle', 'Point Style')}
                      >
                        <option value="circle">{t('layer.circle', 'Circle')}</option>
                        <option value="square">{t('layer.square', 'Square')}</option>
                        <option value="triangle">{t('layer.triangle', 'Triangle')}</option>
                        <option value="none">{t('layer.nonePoint', 'None')}</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-1 text-xs" style={labelStyle}>
                      {t('layer.pointSize', 'Point Size')}
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={layer.pointSize}
                        onChange={(e) => updateLayer(layer.id, { pointSize: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
                        disabled={isLocked}
                        className="border rounded px-1 py-0.5 outline-none w-10 text-center"
                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)', opacity: isLocked ? 0.6 : 1 }}
                        aria-label={t('layer.pointSize', 'Point Size')}
                      />
                    </label>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <label className="flex items-center gap-1 text-xs cursor-pointer" style={labelStyle}>
                      <input
                        type="checkbox"
                        checked={layer.fill}
                        onChange={(e) => updateLayer(layer.id, { fill: e.target.checked })}
                        disabled={isLocked}
                        className="accent-sky-500"
                        aria-label={t('layer.fill', 'Fill')}
                      />
                      {t('layer.fill', 'Fill')}
                    </label>
                  </div>
                  {!is3D && (
                    <div className="flex gap-1.5 items-center">
                      <label className="flex items-center gap-1 text-xs flex-1" style={labelStyle}>
                        {t('layer.yAxisSide', 'Y Axis Side')}
                        <select
                          value={layer.yAxisSide || 'left'}
                          onChange={(e) => updateLayer(layer.id, { yAxisSide: e.target.value as 'left' | 'right' })}
                          disabled={isLocked}
                          className="border rounded px-1 py-0.5 outline-none flex-1"
                          style={{ ...selectStyle, opacity: isLocked ? 0.6 : 1 }}
                          aria-label={t('layer.yAxisSide', 'Y Axis Side')}
                        >
                          <option value="left">{t('layer.yAxisLeft', 'Left')}</option>
                          <option value="right">{t('layer.yAxisRight', 'Right')}</option>
                        </select>
                      </label>
                    </div>
                  )}
                  {/* Error bar type + style config */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-1.5 items-center">
                      <label className="flex items-center gap-1 text-xs flex-1" style={labelStyle}>
                        {t('layer.errorBarType', 'Error Bar Type')}
                        <select
                          value={layer.errorBarConfig?.type ?? 'custom'}
                          onChange={(e) => {
                            const type = e.target.value as 'sd' | 'se' | 'ci95' | 'custom';
                            updateLayer(layer.id, {
                              errorBarConfig: {
                                type,
                                capWidth: layer.errorBarConfig?.capWidth ?? 6,
                                capStyle: layer.errorBarConfig?.capStyle ?? 'line',
                                showCap: layer.errorBarConfig?.showCap ?? true,
                                asymmetric: layer.errorBarConfig?.asymmetric ?? false,
                                thickness: layer.errorBarConfig?.thickness ?? 2,
                              },
                            });
                          }}
                          disabled={isLocked}
                          className="border rounded px-1 py-0.5 outline-none flex-1"
                          style={{ ...selectStyle, opacity: isLocked ? 0.6 : 1 }}
                          aria-label={t('layer.errorBarType', 'Error Bar Type')}
                        >
                          <option value="custom">{t('layer.errorBarCustom', 'Custom Column')}</option>
                          <option value="sd">{t('layer.errorBarSD', 'SD (Std Dev)')}</option>
                          <option value="se">{t('layer.errorBarSE', 'SE (Std Error)')}</option>
                          <option value="ci95">{t('layer.errorBarCI95', '95% CI')}</option>
                        </select>
                      </label>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <label className="flex items-center gap-1 text-xs" style={labelStyle}>
                        {t('layer.errorBarCapWidth', 'Cap Width')}
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={layer.errorBarConfig?.capWidth ?? 6}
                          onChange={(e) => updateLayer(layer.id, {
                            errorBarConfig: {
                              type: layer.errorBarConfig?.type ?? 'custom',
                              capWidth: Math.max(0, Math.min(20, Number(e.target.value) || 6)),
                              capStyle: layer.errorBarConfig?.capStyle ?? 'line',
                              showCap: layer.errorBarConfig?.showCap ?? true,
                              asymmetric: layer.errorBarConfig?.asymmetric ?? false,
                              thickness: layer.errorBarConfig?.thickness ?? 2,
                            },
                          })}
                          disabled={isLocked}
                          className="border rounded px-1 py-0.5 outline-none w-10 text-center"
                          style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)', opacity: isLocked ? 0.6 : 1 }}
                          aria-label={t('layer.errorBarCapWidth', 'Cap Width')}
                        />
                      </label>
                      <label className="flex items-center gap-1 text-xs" style={labelStyle}>
                        {t('layer.errorBarThickness', 'Thickness')}
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={layer.errorBarConfig?.thickness ?? 2}
                          onChange={(e) => updateLayer(layer.id, {
                            errorBarConfig: {
                              type: layer.errorBarConfig?.type ?? 'custom',
                              capWidth: layer.errorBarConfig?.capWidth ?? 6,
                              capStyle: layer.errorBarConfig?.capStyle ?? 'line',
                              showCap: layer.errorBarConfig?.showCap ?? true,
                              asymmetric: layer.errorBarConfig?.asymmetric ?? false,
                              thickness: Math.max(1, Math.min(10, Number(e.target.value) || 2)),
                            },
                          })}
                          disabled={isLocked}
                          className="border rounded px-1 py-0.5 outline-none w-10 text-center"
                          style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)', opacity: isLocked ? 0.6 : 1 }}
                          aria-label={t('layer.errorBarThickness', 'Thickness')}
                        />
                      </label>
                      <label className="flex items-center gap-1 text-xs cursor-pointer" style={labelStyle}>
                        <input
                          type="checkbox"
                          checked={layer.errorBarConfig?.showCap ?? true}
                          onChange={(e) => updateLayer(layer.id, {
                            errorBarConfig: {
                              type: layer.errorBarConfig?.type ?? 'custom',
                              capWidth: layer.errorBarConfig?.capWidth ?? 6,
                              capStyle: layer.errorBarConfig?.capStyle ?? 'line',
                              showCap: e.target.checked,
                              asymmetric: layer.errorBarConfig?.asymmetric ?? false,
                              thickness: layer.errorBarConfig?.thickness ?? 2,
                            },
                          })}
                          disabled={isLocked}
                          className="accent-sky-500"
                          aria-label={t('layer.errorBarShowCap', 'Show Cap')}
                        />
                        {t('layer.errorBarShowCap', 'Cap')}
                      </label>
                      <label className="flex items-center gap-1 text-xs cursor-pointer" style={labelStyle}>
                        <input
                          type="checkbox"
                          checked={layer.errorBarConfig?.asymmetric ?? false}
                          onChange={(e) => updateLayer(layer.id, {
                            errorBarConfig: {
                              type: layer.errorBarConfig?.type ?? 'custom',
                              capWidth: layer.errorBarConfig?.capWidth ?? 6,
                              capStyle: layer.errorBarConfig?.capStyle ?? 'line',
                              showCap: layer.errorBarConfig?.showCap ?? true,
                              asymmetric: e.target.checked,
                              thickness: layer.errorBarConfig?.thickness ?? 2,
                            },
                          })}
                          disabled={isLocked}
                          className="accent-sky-500"
                          aria-label={t('layer.errorBarAsymmetric', 'Asymmetric')}
                        />
                        {t('layer.errorBarAsymmetric', 'Asym')}
                      </label>
                    </div>
                  </div>
                  {ds && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex gap-1.5 items-center">
                        <label className="flex items-center gap-1 text-xs flex-1" style={labelStyle}>
                          {t('layer.errorColumn', 'Error Column')}
                          <select
                            value={layer.errorColumn ?? ''}
                            onChange={(e) => updateLayer(layer.id, { errorColumn: e.target.value || undefined })}
                            disabled={isLocked}
                            className="border rounded px-1 py-0.5 outline-none flex-1"
                            style={{ ...selectStyle, opacity: isLocked ? 0.6 : 1 }}
                            aria-label={t('layer.errorColumn', 'Error Column')}
                          >
                            <option value="">{t('layer.none')}</option>
                            {errorColumns.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <label className="flex items-center gap-1 text-xs flex-1" style={labelStyle}>
                          {t('layer.errorPlusColumn', 'Error+ Column')}
                          <select
                            value={layer.errorPlusColumn ?? ''}
                            onChange={(e) => updateLayer(layer.id, { errorPlusColumn: e.target.value || undefined })}
                            disabled={isLocked}
                            className="border rounded px-1 py-0.5 outline-none flex-1"
                            style={{ ...selectStyle, opacity: isLocked ? 0.6 : 1 }}
                            aria-label={t('layer.errorPlusColumn', 'Error+ Column')}
                          >
                            <option value="">{t('layer.none')}</option>
                            {errorPlusColumns.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <label className="flex items-center gap-1 text-xs flex-1" style={labelStyle}>
                          {t('layer.errorMinusColumn', 'Error− Column')}
                          <select
                            value={layer.errorMinusColumn ?? ''}
                            onChange={(e) => updateLayer(layer.id, { errorMinusColumn: e.target.value || undefined })}
                            disabled={isLocked}
                            className="border rounded px-1 py-0.5 outline-none flex-1"
                            style={{ ...selectStyle, opacity: isLocked ? 0.6 : 1 }}
                            aria-label={t('layer.errorMinusColumn', 'Error− Column')}
                          >
                            <option value="">{t('layer.none')}</option>
                            {errorMinusColumns.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <label className="flex items-center gap-1 text-xs flex-1" style={labelStyle}>
                          {t('layer.errorXColumn', 'X Error Column')}
                          <select
                            value={layer.errorXColumn ?? ''}
                            onChange={(e) => updateLayer(layer.id, { errorXColumn: e.target.value || undefined })}
                            disabled={isLocked}
                            className="border rounded px-1 py-0.5 outline-none flex-1"
                            style={{ ...selectStyle, opacity: isLocked ? 0.6 : 1 }}
                            aria-label={t('layer.errorXColumn', 'X Error Column')}
                          >
                            <option value="">{t('layer.none')}</option>
                            {errorColumns.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <label className="flex items-center gap-1 text-xs flex-1" style={labelStyle}>
                          {t('layer.errorXPlusColumn', 'X Error+ Column')}
                          <select
                            value={layer.errorXPlusColumn ?? ''}
                            onChange={(e) => updateLayer(layer.id, { errorXPlusColumn: e.target.value || undefined })}
                            disabled={isLocked}
                            className="border rounded px-1 py-0.5 outline-none flex-1"
                            style={{ ...selectStyle, opacity: isLocked ? 0.6 : 1 }}
                            aria-label={t('layer.errorXPlusColumn', 'X Error+ Column')}
                          >
                            <option value="">{t('layer.none')}</option>
                            {errorPlusColumns.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <label className="flex items-center gap-1 text-xs flex-1" style={labelStyle}>
                          {t('layer.errorXMinusColumn', 'X Error− Column')}
                          <select
                            value={layer.errorXMinusColumn ?? ''}
                            onChange={(e) => updateLayer(layer.id, { errorXMinusColumn: e.target.value || undefined })}
                            disabled={isLocked}
                            className="border rounded px-1 py-0.5 outline-none flex-1"
                            style={{ ...selectStyle, opacity: isLocked ? 0.6 : 1 }}
                            aria-label={t('layer.errorXMinusColumn', 'X Error− Column')}
                          >
                            <option value="">{t('layer.none')}</option>
                            {errorMinusColumns.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filteredLayers.length === 0 && searchQuery && (
          <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>
            {t('layer.noResults', 'No matching layers')}
          </div>
        )}
        {datasets.length > 0 && (
          <button
            onClick={() => {
              const ds = datasets[0];
              const yCol = ds.columns.find((c) => c.type === 'Y') ?? ds.columns[1];
              const xCol = ds.columns.find((c) => c.type === 'X') ?? ds.columns[0];
              const zCol = ds.columns.find((c) => c.type === 'Z');
              if (yCol && xCol) {
                addLayer({
                  id: uid(),
                  datasetId: ds.id,
                  xColumn: xCol.id,
                  yColumn: yCol.id,
                  zColumn: zCol?.id,
                  color: `hsl(${Math.random() * 360}, 70%, 55%)`,
                  visible: true,
                  lineStyle: 'solid',
                  lineWidth: 3,
                  pointStyle: 'circle',
                  pointSize: 6,
                  fill: false,
                });
              }
            }}
            className="flex items-center gap-1 transition-colors mt-1 p-1"
            style={{ color: 'var(--accent)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#7dd3fc'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
            aria-label={t('layer.addLayer')}
          >
            <Plus size={12} />
            {t('layer.addLayer')}
          </button>
        )}
      </div>
    </div>
  );
}
