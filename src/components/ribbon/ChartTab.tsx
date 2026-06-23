import { useTranslation } from 'react-i18next';
import { useChartStore } from '@/store/plotStore';
import { Palette } from 'lucide-react';
import { getColorMapGradient } from '@/utils/colormaps';
import { colorMapNames } from '@/utils/chart';
import { getChartTypes } from './chartTypes';
import { RibbonGroup } from './RibbonGroup';

export function ChartTab() {
  const { t } = useTranslation();
  const chartConfig = useChartStore((s) => s.chartConfig);
  const setChartType = useChartStore((s) => s.setChartType);
  const setChartTitle = useChartStore((s) => s.setChartTitle);
  const setColorMap = useChartStore((s) => s.setColorMap);

  const chartTypes = getChartTypes(t);

  return (
    <div className="flex items-stretch">
      <RibbonGroup label={t('chart.chartType')}>
        {chartTypes.map(({ type, label, icon, group }) => (
          <button
            key={type}
            onClick={() => setChartType(type)}
            className={`ribbon-btn ${chartConfig.type === type ? 'ring-1 ring-sky-500/50' : ''} ${group !== '2d' ? 'ml-1 border-l pl-2' : ''}`}
            style={{
              ...(chartConfig.type === type ? { background: 'rgba(14,165,233,0.2)', color: 'var(--accent)' } : {}),
              ...(group !== '2d' ? { borderColor: 'var(--border)' } : {}),
            }}
            title={label}
            aria-label={label}
          >
            {icon}
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </RibbonGroup>

      <RibbonGroup label={t('chart.title')}>
        <input
          type="text"
          value={chartConfig.title}
          onChange={(e) => setChartTitle(e.target.value)}
          className="w-40 border rounded px-2 py-1 text-xs outline-none focus:border-sky-500/50"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          placeholder={t('chart.titlePlaceholder')}
          aria-label={t('chart.title')}
        />
      </RibbonGroup>

      <RibbonGroup label={t('chart.colorMap')}>
        <div className="flex items-center gap-1.5">
          <Palette size={14} style={{ color: 'var(--text-muted)' }} />
          <div className="flex gap-1">
            {colorMapNames.map((name) => (
              <button
                key={name}
                onClick={() => setColorMap(name)}
                className={`w-8 h-5 rounded-sm border transition-all focus:ring-2 focus:ring-offset-1 ${
                  chartConfig.colorMap === name ? 'scale-110' : ''
                }`}
                style={{ background: getColorMapGradient(name), borderColor: chartConfig.colorMap === name ? 'var(--accent)' : 'var(--border)' }}
                aria-label={name}
                title={name}
              />
            ))}
          </div>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{chartConfig.colorMap}</span>
        </div>
      </RibbonGroup>
    </div>
  );
}
