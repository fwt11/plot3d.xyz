import { useChartStore, selectActiveChart } from '@/store/chartStore';
import { useHistoryStore } from '@/store/historyStore';
import { is3DChart } from '@/utils/chart';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AxisConfig, ExportBackground, Scene3DConfig } from '@/types';
import AnnotationPanel from './AnnotationPanel';
import TemplatePanel from './TemplatePanel';

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
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

interface SnapshotInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  /** History description for the snapshot pushed when the edit session starts. */
  historyDescription: string;
  /** Called on every keystroke; must update state WITHOUT pushing history. */
  onSilentChange: (value: string) => void;
}

/**
 * Text/number input that follows DataTable's edit-session convention:
 * push one history snapshot on focus, apply silent updates while typing,
 * and drop the snapshot on blur if nothing changed — so a typing session
 * produces a single undoable entry instead of one per keystroke.
 */
function SnapshotInput({ value, historyDescription, onSilentChange, ...rest }: SnapshotInputProps) {
  const originalRef = useRef<string | null>(null);
  return (
    <input
      {...rest}
      value={value}
      onFocus={(e) => {
        originalRef.current = e.currentTarget.value;
        useHistoryStore.getState().pushSnapshot(historyDescription);
      }}
      onChange={(e) => onSilentChange(e.target.value)}
      onBlur={(e) => {
        if (originalRef.current !== null && e.target.value === originalRef.current) {
          useHistoryStore.getState().popLastSnapshot(historyDescription);
        }
        originalRef.current = null;
      }}
    />
  );
}

function AxisEditor({ label, axis, onChange, onSilentChange, historyDescription, is3D = false, allowCategory = false, allowTimezone = false }: { label: string; axis: AxisConfig; onChange: (a: Partial<AxisConfig>) => void; onSilentChange: (a: Partial<AxisConfig>) => void; historyDescription: string; is3D?: boolean; allowCategory?: boolean; allowTimezone?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <label className="grid grid-cols-[40px_1fr] items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span className="truncate">{t('config.label')}</span>
        <SnapshotInput
          type="text"
          value={axis.label}
          historyDescription={historyDescription}
          onSilentChange={(v) => onSilentChange({ label: v })}
          className="w-full border rounded px-2 py-0.5 outline-none focus:border-sky-500/50"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          aria-label={`${label} ${t('config.label')}`}
        />
      </label>
      <label className="grid grid-cols-[40px_1fr] items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span className="truncate">{t('config.unit')}</span>
        <SnapshotInput
          type="text"
          value={axis.unit ?? ''}
          historyDescription={historyDescription}
          onSilentChange={(v) => onSilentChange({ unit: v })}
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
      {allowTimezone && (
        <label className="grid grid-cols-[60px_1fr] items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span className="truncate">{t('config.timezone')}</span>
          <select
            value={axis.timezone ?? ''}
            onChange={(e) => onChange({ timezone: e.target.value || undefined })}
            className="w-full border rounded px-2 py-0.5 outline-none focus:border-sky-500/50"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            aria-label={`${label} ${t('config.timezone')}`}
          >
            <option value="">Auto (detect date column)</option>
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York</option>
            <option value="America/Los_Angeles">America/Los_Angeles</option>
            <option value="America/Chicago">America/Chicago</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Europe/Berlin">Europe/Berlin</option>
            <option value="Asia/Shanghai">Asia/Shanghai</option>
            <option value="Asia/Tokyo">Asia/Tokyo</option>
            <option value="Asia/Singapore">Asia/Singapore</option>
            <option value="Australia/Sydney">Australia/Sydney</option>
          </select>
        </label>
      )}
    </div>
  );
}

function MarginInput({ label, value, onSilentChange, historyDescription }: { label: string; value: number; onSilentChange: (v: number) => void; historyDescription: string }) {
  return (
    <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
      {label}
      <SnapshotInput
        type="number"
        value={String(value)}
        historyDescription={historyDescription}
        onSilentChange={(v) => onSilentChange(Number(v))}
        className="w-14 border rounded px-1.5 py-0.5 outline-none focus:border-sky-500/50"
        style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        aria-label={label}
      />
    </label>
  );
}

export default function ConfigPanel() {
  const { t } = useTranslation();
  const chartConfig = useChartStore(selectActiveChart);
  const is3D = is3DChart(chartConfig.type);
  const setChartTitle = useChartStore((s) => s.setChartTitleSilent);
  const setXAxis = useChartStore((s) => s.setXAxis);
  const setYAxis = useChartStore((s) => s.setYAxis);
  const setYAxisRight = useChartStore((s) => s.setYAxisRight);
  const setZAxis = useChartStore((s) => s.setZAxis);
  const setXAxisSilent = useChartStore((s) => s.setXAxisSilent);
  const setYAxisSilent = useChartStore((s) => s.setYAxisSilent);
  const setYAxisRightSilent = useChartStore((s) => s.setYAxisRightSilent);
  const setZAxisSilent = useChartStore((s) => s.setZAxisSilent);
  const setMarginsSilent = useChartStore((s) => s.setMarginsSilent);
  const marginsHistoryDesc = t('history.setMargins', { defaultValue: 'Adjust margins' });
  const setLegend = useChartStore((s) => s.setLegend);
  const setExportConfig = useChartStore((s) => s.setExportConfig);
  const setFontSize = useChartStore((s) => s.setFontSize);
  const setScene3D = useChartStore((s) => s.setScene3D);
  const setSurfaceMesh = useChartStore((s) => s.setSurfaceMesh);
  const setContourProjection = useChartStore((s) => s.setContourProjection);

  const hasRightYAxis = !is3D && chartConfig.layers.some((l) => l.yAxisSide === 'right');
  const scene3D = chartConfig.scene3D ?? { aspectMode: 'cube', aspectRatio: { x: 1, y: 1, z: 1 }, projection: 'orthographic' };

  return (
    <div className="h-full overflow-y-auto text-xs pb-6">
      <Section title={t('config.title')}>
        <SnapshotInput
          type="text"
          value={chartConfig.title}
          historyDescription={t('history.setChartTitle', { defaultValue: 'Edit title' })}
          onSilentChange={setChartTitle}
          className="w-full border rounded px-2 py-1 outline-none focus:border-sky-500/50"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          aria-label={t('config.title')}
        />
      </Section>

      <Section title={t('config.xAxis')}>
        <AxisEditor label={t('config.xAxis')} axis={chartConfig.xAxis} onChange={setXAxis} onSilentChange={setXAxisSilent} historyDescription={t('history.setXAxis', { defaultValue: 'Edit X axis' })} is3D={is3D} allowCategory={chartConfig.type === 'bar'} allowTimezone />
      </Section>

      <Section title={t('config.yAxis')}>
        <AxisEditor label={t('config.yAxis')} axis={chartConfig.yAxis} onChange={setYAxis} onSilentChange={setYAxisSilent} historyDescription={t('history.setYAxis', { defaultValue: 'Edit Y axis' })} is3D={is3D} />
      </Section>

      {hasRightYAxis && chartConfig.yAxisRight && (
        <Section title={t('config.yAxisRight', 'Right Y Axis')}>
          <AxisEditor label={t('config.yAxisRight', 'Right Y')} axis={chartConfig.yAxisRight} onChange={setYAxisRight} onSilentChange={setYAxisRightSilent} historyDescription={t('history.setYAxisRight', { defaultValue: 'Edit right Y axis' })} is3D={is3D} />
        </Section>
      )}

      {is3D && chartConfig.zAxis && (
        <Section title={t('config.zAxis')}>
          <AxisEditor label={t('config.zAxis')} axis={chartConfig.zAxis} onChange={setZAxis} onSilentChange={setZAxisSilent} historyDescription={t('history.setZAxis', { defaultValue: 'Edit Z axis' })} is3D={is3D} />
        </Section>
      )}

      {is3D && (
        <Section title={t('config.scene3D', { defaultValue: '3D Scene' })}>
          <label className="grid grid-cols-[60px_1fr] items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span className="truncate">{t('config.aspectMode', { defaultValue: 'Aspect' })}</span>
            <select
              value={scene3D.aspectMode}
              onChange={(e) => setScene3D({ aspectMode: e.target.value as Scene3DConfig['aspectMode'] })}
              className="border rounded px-2 py-0.5 outline-none"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              aria-label={t('config.aspectMode', { defaultValue: 'Aspect' })}
            >
              <option value="cube">{t('config.aspectModeCube', { defaultValue: 'Cube (1:1:1)' })}</option>
              <option value="data">{t('config.aspectModeData', { defaultValue: 'Data' })}</option>
              <option value="manual">{t('config.aspectModeManual', { defaultValue: 'Manual' })}</option>
            </select>
          </label>
          {scene3D.aspectMode === 'manual' && (
            <div className="grid grid-cols-3 gap-2">
              {(['x', 'y', 'z'] as const).map((axis) => (
                <label key={axis} className="flex flex-col gap-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span className="uppercase" style={{ color: 'var(--text-muted)' }}>{axis}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={scene3D.aspectRatio[axis]}
                    onChange={(e) => setScene3D({ aspectRatio: { ...scene3D.aspectRatio, [axis]: Number(e.target.value) } })}
                    className="w-full border rounded px-1.5 py-0.5 outline-none focus:border-sky-500/50"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    aria-label={`${t('config.aspectRatio', { defaultValue: 'Aspect ratio' })} ${axis}`}
                  />
                </label>
              ))}
            </div>
          )}
          <label className="grid grid-cols-[60px_1fr] items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span className="truncate">{t('config.projection', { defaultValue: 'Projection' })}</span>
            <select
              value={scene3D.projection}
              onChange={(e) => setScene3D({ projection: e.target.value as Scene3DConfig['projection'] })}
              className="border rounded px-2 py-0.5 outline-none"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              aria-label={t('config.projection', { defaultValue: 'Projection' })}
            >
              <option value="orthographic">{t('config.projectionOrthographic', { defaultValue: 'Orthographic' })}</option>
              <option value="perspective">{t('config.projectionPerspective', { defaultValue: 'Perspective' })}</option>
            </select>
          </label>
          {chartConfig.type === 'surface3d' && (
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('config.surfaceMesh', { defaultValue: 'Show mesh' })}
              <input
                type="checkbox"
                checked={chartConfig.surfaceMesh ?? true}
                onChange={(e) => setSurfaceMesh(e.target.checked)}
                className="accent-sky-500"
                aria-label={t('config.surfaceMesh', { defaultValue: 'Show mesh' })}
              />
            </label>
          )}
          {chartConfig.type === 'surface3d' && (() => {
            const projection = chartConfig.contourProjection ?? { floor: false, walls: false };
            return (
              <>
                <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {t('config.contourProjectionFloor', { defaultValue: 'Floor projection' })}
                  <input
                    type="checkbox"
                    checked={projection.floor}
                    onChange={(e) => setContourProjection({ ...projection, floor: e.target.checked })}
                    className="accent-sky-500"
                    aria-label={t('config.contourProjectionFloor', { defaultValue: 'Floor projection' })}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {t('config.contourProjectionWalls', { defaultValue: 'Wall projections' })}
                  <input
                    type="checkbox"
                    checked={projection.walls}
                    onChange={(e) => setContourProjection({ ...projection, walls: e.target.checked })}
                    className="accent-sky-500"
                    aria-label={t('config.contourProjectionWalls', { defaultValue: 'Wall projections' })}
                  />
                </label>
              </>
            );
          })()}
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
          <>
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
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('config.legendBorder', { defaultValue: 'Show border' })}
              <input
                type="checkbox"
                checked={chartConfig.legend.bordered ?? false}
                onChange={(e) => setLegend({ bordered: e.target.checked })}
                className="accent-sky-500"
                aria-label={t('config.legendBorder', { defaultValue: 'Show border' })}
              />
            </label>
          </>
        )}
      </Section>

      {!is3D && (
        <Section title={t('config.margins')} defaultOpen={false}>
          <div className="grid grid-cols-2 gap-2">
            <MarginInput label={t('config.marginTop')} value={chartConfig.marginTop} onSilentChange={(v) => setMarginsSilent({ marginTop: v })} historyDescription={marginsHistoryDesc} />
            <MarginInput label={t('config.marginRight')} value={chartConfig.marginRight} onSilentChange={(v) => setMarginsSilent({ marginRight: v })} historyDescription={marginsHistoryDesc} />
            <MarginInput label={t('config.marginBottom')} value={chartConfig.marginBottom} onSilentChange={(v) => setMarginsSilent({ marginBottom: v })} historyDescription={marginsHistoryDesc} />
            <MarginInput label={t('config.marginLeft')} value={chartConfig.marginLeft} onSilentChange={(v) => setMarginsSilent({ marginLeft: v })} historyDescription={marginsHistoryDesc} />
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
          {t('config.figureSize')}
          <select
            value={chartConfig.exportConfig.figureMultiplier}
            onChange={(e) => setExportConfig({ figureMultiplier: Number(e.target.value) as 1 | 2 | 3 })}
            className="border rounded px-2 py-0.5 outline-none"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            aria-label={t('config.figureSize')}
          >
            <option value={1}>1x ({t('config.figureSizeActual', 'Actual')})</option>
            <option value={2}>2x ({t('config.figureSizeDouble', 'Double')})</option>
            <option value={3}>3x ({t('config.figureSizeTriple', 'Triple')})</option>
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
