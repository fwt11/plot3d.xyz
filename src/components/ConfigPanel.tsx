import { useChartStore } from '@/store/chartStore';
import { is3DChart } from '@/utils/chart';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AxisConfig, ExportBackground } from '@/types';
import AnnotationPanel from './AnnotationPanel';
import TemplatePanel from './TemplatePanel';

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b" style={{ borderColor: 'var(--border)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 w-full px-3 py-2 text-xs font-medium transition-colors"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
        aria-label={title}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

function AxisEditor({ label, axis, onChange, is3D = false, allowCategory = false }: { label: string; axis: AxisConfig; onChange: (a: Partial<AxisConfig>) => void; is3D?: boolean; allowCategory?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <label className="grid grid-cols-[40px_1fr] items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span className="truncate">{t('config.label')}</span>
        <input
          type="text"
          value={axis.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="w-full border rounded px-2 py-0.5 outline-none focus:border-sky-500/50"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          aria-label={`${label} ${t('config.label')}`}
        />
      </label>
      <label className="grid grid-cols-[40px_1fr] items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span className="truncate">{t('config.unit')}</span>
        <input
          type="text"
          value={axis.unit ?? ''}
          onChange={(e) => onChange({ unit: e.target.value })}
          placeholder="e.g. s, mol/L"
          className="w-full border rounded px-2 py-0.5 outline-none focus:border-sky-500/50"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          aria-label={`${label} ${t('config.unit')}`}
        />
      </label>
      <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {t('config.autoRange')}
        <input
          type="checkbox"
          checked={axis.autoRange}
          onChange={(e) => onChange({ autoRange: e.target.checked })}
          className="accent-sky-500"
          aria-label={`${label} ${t('config.autoRange')}`}
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
              aria-label={`${label} ${t('config.min')}`}
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
              aria-label={`${label} ${t('config.max')}`}
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
          aria-label={`${label} ${t('config.showGrid')}`}
        />
      </label>
      {!is3D && (
        <>
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {t('config.logScale')}
            <input
              type="checkbox"
              checked={axis.logScale}
              onChange={(e) => onChange({ logScale: e.target.checked })}
              className="accent-sky-500"
              aria-label={`${label} ${t('config.logScale')}`}
            />
          </label>
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {t('config.scientificNotation')}
            <input
              type="checkbox"
              checked={axis.scientificNotation}
              onChange={(e) => onChange({ scientificNotation: e.target.checked })}
              className="accent-sky-500"
              aria-label={`${label} ${t('config.scientificNotation')}`}
            />
          </label>
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {t('config.tickAngle', 'Tick Angle')}
            <input
              type="number"
              value={axis.tickAngle ?? 0}
              onChange={(e) => onChange({ tickAngle: Number(e.target.value) })}
              className="w-16 border rounded px-1.5 py-0.5 outline-none focus:border-sky-500/50"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              aria-label={`${label} ${t('config.tickAngle', 'Tick Angle')}`}
            />
            <span style={{ color: 'var(--text-muted)' }}>°</span>
          </label>
        </>
      )}
      {allowCategory && (
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('config.categoryAxis')}
          <input
            type="checkbox"
            checked={axis.categoryAxis ?? true}
            onChange={(e) => onChange({ categoryAxis: e.target.checked })}
            className="accent-sky-500"
            aria-label={`${label} ${t('config.categoryAxis')}`}
          />
        </label>
      )}
    </div>
  );
}

function MarginInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
      {label}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-14 border rounded px-1.5 py-0.5 outline-none focus:border-sky-500/50"
        style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        aria-label={label}
      />
    </label>
  );
}

export default function ConfigPanel() {
  const { t } = useTranslation();
  const chartConfig = useChartStore((s) => s.chartConfig);
  const is3D = is3DChart(chartConfig.type);
  const setChartTitle = useChartStore((s) => s.setChartTitle);
  const setXAxis = useChartStore((s) => s.setXAxis);
  const setYAxis = useChartStore((s) => s.setYAxis);
  const setYAxisRight = useChartStore((s) => s.setYAxisRight);
  const setZAxis = useChartStore((s) => s.setZAxis);
  const setLegend = useChartStore((s) => s.setLegend);
  const setMargins = useChartStore((s) => s.setMargins);
  const setExportConfig = useChartStore((s) => s.setExportConfig);
  const setFontSize = useChartStore((s) => s.setFontSize);

  const hasRightYAxis = !is3D && chartConfig.layers.some((l) => l.yAxisSide === 'right');

  return (
    <div className="h-full overflow-y-auto text-xs pb-6">
      <Section title={t('config.title')}>
        <input
          type="text"
          value={chartConfig.title}
          onChange={(e) => setChartTitle(e.target.value)}
          className="w-full border rounded px-2 py-1 outline-none focus:border-sky-500/50"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          aria-label={t('config.title')}
        />
      </Section>

      <Section title={t('config.xAxis')}>
        <AxisEditor label={t('config.xAxis')} axis={chartConfig.xAxis} onChange={setXAxis} is3D={is3D} allowCategory={chartConfig.type === 'bar'} />
      </Section>

      <Section title={t('config.yAxis')}>
        <AxisEditor label={t('config.yAxis')} axis={chartConfig.yAxis} onChange={setYAxis} is3D={is3D} />
      </Section>

      {hasRightYAxis && chartConfig.yAxisRight && (
        <Section title={t('config.yAxisRight', 'Right Y Axis')}>
          <AxisEditor label={t('config.yAxisRight', 'Right Y')} axis={chartConfig.yAxisRight} onChange={setYAxisRight} is3D={is3D} />
        </Section>
      )}

      {is3D && chartConfig.zAxis && (
        <Section title={t('config.zAxis')}>
          <AxisEditor label={t('config.zAxis')} axis={chartConfig.zAxis} onChange={setZAxis} is3D={is3D} />
        </Section>
      )}

      <Section title={t('config.legend')}>
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('config.showLegend')}
          <input
            type="checkbox"
            checked={chartConfig.legend.visible}
            onChange={(e) => setLegend({ visible: e.target.checked })}
            className="accent-sky-500"
            aria-label={t('config.showLegend')}
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
              aria-label={t('config.position')}
            >
              <option value="inside-top-right">{t('config.legendInsideTopRight', { defaultValue: 'Inside Top Right' })}</option>
              <option value="inside-top-left">{t('config.legendInsideTopLeft', { defaultValue: 'Inside Top Left' })}</option>
              <option value="inside-bottom-right">{t('config.legendInsideBottomRight', { defaultValue: 'Inside Bottom Right' })}</option>
              <option value="inside-bottom-left">{t('config.legendInsideBottomLeft', { defaultValue: 'Inside Bottom Left' })}</option>
              <option value="top">{t('config.top')}</option>
              <option value="bottom">{t('config.bottom')}</option>
              <option value="left">{t('config.left')}</option>
              <option value="right">{t('config.right')}</option>
            </select>
          </label>
        )}
      </Section>

      {!is3D && (
        <Section title={t('config.margins')} defaultOpen={false}>
          <div className="grid grid-cols-2 gap-2">
            <MarginInput label={t('config.marginTop')} value={chartConfig.marginTop} onChange={(v) => setMargins({ marginTop: v })} />
            <MarginInput label={t('config.marginRight')} value={chartConfig.marginRight} onChange={(v) => setMargins({ marginRight: v })} />
            <MarginInput label={t('config.marginBottom')} value={chartConfig.marginBottom} onChange={(v) => setMargins({ marginBottom: v })} />
            <MarginInput label={t('config.marginLeft')} value={chartConfig.marginLeft} onChange={(v) => setMargins({ marginLeft: v })} />
          </div>
        </Section>
      )}

      <Section title={t('config.export')} defaultOpen={false}>
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('config.resolution')}
          <select
            value={chartConfig.exportConfig.resolutionMultiplier}
            onChange={(e) => setExportConfig({ resolutionMultiplier: Number(e.target.value) as 1 | 2 | 4 })}
            className="border rounded px-2 py-0.5 outline-none"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            aria-label={t('config.resolution')}
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('config.background')}
          <select
            value={chartConfig.exportConfig.background}
            onChange={(e) => setExportConfig({ background: e.target.value as ExportBackground })}
            className="border rounded px-2 py-0.5 outline-none"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            aria-label={t('config.background')}
          >
            <option value="transparent">{t('config.bgTransparent')}</option>
            <option value="white">{t('config.bgWhite')}</option>
            <option value="theme">{t('config.bgTheme')}</option>
          </select>
        </label>
      </Section>

      <Section title={t('config.fontSize')} defaultOpen={false}>
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('config.fontSize')}
          <input
            type="number"
            value={chartConfig.fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-16 border rounded px-1.5 py-0.5 outline-none focus:border-sky-500/50"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            aria-label={t('config.fontSize')}
          />
        </label>
      </Section>

      {!is3D && (
        <Section title={t('annotation.annotations')} defaultOpen={false}>
          <AnnotationPanel />
        </Section>
      )}

      <Section title={t('template.title', { defaultValue: 'Templates' })} defaultOpen={false}>
        <TemplatePanel />
      </Section>
    </div>
  );
}
