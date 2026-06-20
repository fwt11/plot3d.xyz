import { useState } from 'react';
import { usePlotStore } from '@/store/plotStore';
import { Eye, EyeOff, Trash2, Plus } from 'lucide-react';
import { uid } from '@/utils/sampleData';

export default function LayerPanel() {
  const chartConfig = usePlotStore((s) => s.chartConfig);
  const datasets = usePlotStore((s) => s.datasets);
  const addLayer = usePlotStore((s) => s.addLayer);
  const removeLayer = usePlotStore((s) => s.removeLayer);
  const updateLayer = usePlotStore((s) => s.updateLayer);
  const is3D = ['surface3d', 'scatter3d', 'contour3d', 'bar3d'].includes(chartConfig.type);

  return (
    <div className="h-full overflow-y-auto text-xs">
      {chartConfig.layers.map((layer) => {
        const ds = datasets.find((d) => d.id === layer.datasetId);
        return (
          <div key={layer.id} className="p-2 rounded space-y-1.5" style={{ background: 'var(--bg-surface)' }}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
                className="hover:text-zinc-200"
                style={{ color: 'var(--text-secondary)' }}
              >
                {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
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
                  });
                }}
                className="flex-1 border rounded px-1.5 py-0.5 text-xs outline-none"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <input
                type="color"
                value={layer.color}
                onChange={(e) => updateLayer(layer.id, { color: e.target.value })}
                className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
              />
              <button
                onClick={() => removeLayer(layer.id)}
                className="hover:text-rose-400"
                style={{ color: 'var(--text-muted)' }}
              >
                <Trash2 size={12} />
              </button>
            </div>
            {ds && (
              <div className="flex gap-1.5">
                <label className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  X
                  <select
                    value={layer.xColumn}
                    onChange={(e) => updateLayer(layer.id, { xColumn: e.target.value })}
                    className="border rounded px-1 py-0.5 outline-none"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    {ds.columns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  Y
                  <select
                    value={layer.yColumn}
                    onChange={(e) => updateLayer(layer.id, { yColumn: e.target.value })}
                    className="border rounded px-1 py-0.5 outline-none"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    {ds.columns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                {is3D && (
                  <label className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Z
                    <select
                      value={layer.zColumn ?? ''}
                      onChange={(e) => updateLayer(layer.id, { zColumn: e.target.value || undefined })}
                      className="border rounded px-1 py-0.5 outline-none"
                      style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    >
                      <option value="">无</option>
                      {ds.columns.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
          </div>
        );
      })}
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
              });
            }
          }}
          className="flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors mt-1"
        >
          <Plus size={12} />
          添加图层
        </button>
      )}
    </div>
  );
}
