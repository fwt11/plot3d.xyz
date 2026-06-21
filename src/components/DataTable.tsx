import { usePlotStore } from '@/store/plotStore';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DataColumn } from '@/types';

export default function DataTable() {
  const { t } = useTranslation();
  const datasets = usePlotStore((s) => s.datasets);
  const activeDatasetId = usePlotStore((s) => s.activeDatasetId);
  const setActiveDataset = usePlotStore((s) => s.setActiveDataset);
  const updateCellValue = usePlotStore((s) => s.updateCellValue);
  const addColumn = usePlotStore((s) => s.addColumn);
  const removeColumn = usePlotStore((s) => s.removeColumn);
  const addRow = usePlotStore((s) => s.addRow);
  const removeRow = usePlotStore((s) => s.removeRow);
  const setColumnType = usePlotStore((s) => s.setColumnType);
  const renameColumn = usePlotStore((s) => s.renameColumn);

  const dataset = datasets.find((d) => d.id === activeDatasetId);
  if (!dataset) return <div className="p-4" style={{ color: 'var(--text-muted)' }}>{t('data.noDataset')}</div>;

  const maxRows = Math.max(...dataset.columns.map((c) => c.values.length), 0);

  const typeColors: Record<DataColumn['type'], { className: string; style: React.CSSProperties }> = {
    X: { className: 'border', style: { background: 'rgba(16,185,129,0.2)', color: '#34d399', borderColor: 'rgba(16,185,129,0.3)' } },
    Y: { className: 'border', style: { background: 'rgba(14,165,233,0.2)', color: '#38bdf8', borderColor: 'rgba(14,165,233,0.3)' } },
    Z: { className: 'border', style: { background: 'rgba(168,85,247,0.2)', color: '#c084fc', borderColor: 'rgba(168,85,247,0.3)' } },
    label: { className: 'border', style: { background: 'rgba(245,158,11,0.2)', color: '#fbbf24', borderColor: 'rgba(245,158,11,0.3)' } },
    error: { className: 'border', style: { background: 'rgba(244,63,94,0.2)', color: '#fb7185', borderColor: 'rgba(244,63,94,0.3)' } },
  };

  const typeOptions: { value: DataColumn['type']; label: string }[] = [
    { value: 'X', label: t('data.xAxis') },
    { value: 'Y', label: t('data.yAxis') },
    { value: 'Z', label: t('data.zAxis3d') },
    { value: 'label', label: t('data.label') },
    { value: 'error', label: t('data.error') },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Dataset tabs */}
      <div className="flex items-center gap-1 px-2 py-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border)', background: 'var(--bg-input)' }}>
        {datasets.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveDataset(d.id)}
            className={`px-3 py-1 rounded text-xs transition-all shrink-0 ${
              d.id === activeDatasetId ? '' : ''
            }`}
            style={d.id === activeDatasetId
              ? { background: 'rgba(14,165,233,0.2)', color: '#38bdf8' }
              : { color: 'var(--text-muted)' }
            }
            onMouseEnter={(e) => {
              if (d.id !== activeDatasetId) e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              if (d.id !== activeDatasetId) e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: 'var(--bg-surface)' }}>
              <th className="px-2 py-1 font-normal border-b border-r w-10" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                #
              </th>
              {dataset.columns.map((col) => (
                <th key={col.id} className="border-b border-r min-w-[80px]" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex flex-col items-center gap-0.5 px-1 py-1">
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
                        onChange={(e) => {
                          renameColumn(dataset.id, col.id, e.target.value);
                        }}
                        className="flex-1 text-center outline-none min-w-0"
                        style={{ background: 'transparent', color: 'var(--text-primary)' }}
                      />
                      <button
                        onClick={() => removeColumn(dataset.id, col.id)}
                        className="transition-colors shrink-0"
                        style={{ color: 'var(--text-faint)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#fb7185'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                </th>
              ))}
              <th className="border-b w-8" style={{ borderColor: 'var(--border)' }}>
                <button
                  onClick={() => addColumn(dataset.id)}
                  className="transition-colors p-1"
                  style={{ color: 'var(--text-faint)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#38bdf8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
                >
                  <Plus size={12} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRows }).map((_, rowIdx) => (
              <tr key={rowIdx} className="transition-colors"
                style={{ background: 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <td className="px-2 py-0.5 border-r text-right" style={{ color: 'var(--text-faint)', borderColor: 'var(--border)' }}>
                  {rowIdx + 1}
                </td>
                {dataset.columns.map((col) => (
                  <td key={col.id} className="border-r" style={{ borderColor: 'var(--border)' }}>
                    <input
                      type="text"
                      value={col.values[rowIdx] ?? ''}
                      onChange={(e) => updateCellValue(dataset.id, col.id, rowIdx, e.target.value)}
                      className="w-full px-2 py-0.5 outline-none transition-colors"
                      style={{ background: 'transparent', color: 'var(--text-primary)' }}
                      onFocus={(e) => { e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
                      onBlur={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    />
                  </td>
                ))}
                <td className="text-center">
                  <button
                    onClick={() => removeRow(dataset.id, rowIdx)}
                    className="transition-colors"
                    style={{ color: 'var(--text-faint)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#fb7185'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
                  >
                    <Trash2 size={10} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add row button */}
      <div className="border-t p-1" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => addRow(dataset.id)}
          className="flex items-center gap-1 px-2 py-1 text-xs transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#38bdf8'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <Plus size={12} />
          {t('data.addRow')}
        </button>
      </div>
    </div>
  );
}
