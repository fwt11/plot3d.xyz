import { usePlotStore } from '@/store/plotStore';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AxisConfig } from '@/types';

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b" style={{ borderColor: 'var(--border)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 w-full px-3 py-2 text-xs font-medium transition-colors"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(63,63,70,0.3)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

function AxisEditor({ label, axis, onChange }: { label: string; axis: AxisConfig; onChange: (a: Partial<AxisConfig>) => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {t('config.label')}
        <input
          type="text"
          value={axis.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="flex-1 border rounded px-2 py-0.5 outline-none focus:border-sky-500/50"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        />
      </label>
      <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {t('config.autoRange')}
        <input
          type="checkbox"
          checked={axis.autoRange}
          onChange={(e) => onChange({ autoRange: e.target.checked })}
          className="accent-sky-500"
        />
      </label>
      {!axis.autoRange && (
        <div className="flex gap-2">
          <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {t('config.min')}
            <input
              type="number"
              value={axis.min ?? ''}
              onChange={(e) => onChange({ min: e.target.value ? Number(e.target.value) : undefined })}
              className="w-16 border rounded px-1.5 py-0.5 outline-none focus:border-sky-500/50"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </label>
          <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {t('config.max')}
            <input
              type="number"
              value={axis.max ?? ''}
              onChange={(e) => onChange({ max: e.target.value ? Number(e.target.value) : undefined })}
              className="w-16 border rounded px-1.5 py-0.5 outline-none focus:border-sky-500/50"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </label>
        </div>
      )}
      <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {t('config.showGrid')}
        <input
          type="checkbox"
          checked={axis.gridVisible}
          onChange={(e) => onChange({ gridVisible: e.target.checked })}
          className="accent-sky-500"
        />
      </label>
    </div>
  );
}

export default function ConfigPanel() {
  const { t } = useTranslation();
  const chartConfig = usePlotStore((s) => s.chartConfig);
  const setChartTitle = usePlotStore((s) => s.setChartTitle);
  const setXAxis = usePlotStore((s) => s.setXAxis);
  const setYAxis = usePlotStore((s) => s.setYAxis);
  const setLegend = usePlotStore((s) => s.setLegend);

  return (
    <div className="h-full overflow-y-auto text-xs">
      <Section title={t('config.title')}>
        <input
          type="text"
          value={chartConfig.title}
          onChange={(e) => setChartTitle(e.target.value)}
          className="w-full border rounded px-2 py-1 outline-none focus:border-sky-500/50"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        />
      </Section>

      <Section title={t('config.xAxis')}>
        <AxisEditor label={t('config.xAxis')} axis={chartConfig.xAxis} onChange={setXAxis} />
      </Section>

      <Section title={t('config.yAxis')}>
        <AxisEditor label={t('config.yAxis')} axis={chartConfig.yAxis} onChange={setYAxis} />
      </Section>

      <Section title={t('config.legend')}>
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('config.showLegend')}
          <input
            type="checkbox"
            checked={chartConfig.legend.visible}
            onChange={(e) => setLegend({ visible: e.target.checked })}
            className="accent-sky-500"
          />
        </label>
        {chartConfig.legend.visible && (
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {t('config.position')}
            <select
              value={chartConfig.legend.position}
              onChange={(e) => setLegend({ position: e.target.value as 'top' | 'bottom' | 'left' | 'right' })}
              className="border rounded px-2 py-0.5 outline-none"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              <option value="top">{t('config.top')}</option>
              <option value="bottom">{t('config.bottom')}</option>
              <option value="left">{t('config.left')}</option>
              <option value="right">{t('config.right')}</option>
            </select>
          </label>
        )}
      </Section>
    </div>
  );
}
