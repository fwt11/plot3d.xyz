import { useTranslation } from 'react-i18next';
import { useChartStore, useDatasetStore } from '@/store/plotStore';
import { useToastStore } from '@/store/toastStore';
import { Palette } from 'lucide-react';
import { getColorMapGradient } from '@/utils/colormaps';
import { colorMapNames, is3DChart, usesColorMap } from '@/utils/chart';
import { getChartTypes } from './chartTypes';
import { RibbonGroup } from './RibbonGroup';

export function ChartTab() {
  const { t } = useTranslation();
  const chartConfig = useChartStore((s) => s.chartConfig);
  const setChartType = useChartStore((s) => s.setChartType);
  const setColorMap = useChartStore((s) => s.setColorMap);
  const datasets = useDatasetStore((s) => s.datasets);
  const activeDatasetId = useDatasetStore((s) => s.activeDatasetId);
  const addToast = useToastStore((s) => s.addToast);

  const chartTypes = getChartTypes(t);
  const types2d = chartTypes.filter((c) => c.group === '2d');
  const typesStat = chartTypes.filter((c) => c.group === 'stat');
  const types3d = chartTypes.filter((c) => c.group === '3d');
  const showColorMap = usesColorMap(chartConfig.type);

  const handleSetChartType = (type: typeof chartConfig.type) => {
    if (is3DChart(type)) {
      const activeDs = datasets.find((d) => d.id === activeDatasetId);
      const hasZ = activeDs?.columns.some((c) => c.type === 'Z');
      if (!hasZ) {
        addToast(t('toast.noZColumnFor3D', 'No Z column available for 3D chart'), 'warning');
        return;
      }
    }
    setChartType(type);
  };

  const renderChartButton = ({ type, label, icon }: { type: typeof chartConfig.type; label: string; icon: React.ReactNode }) => (
    <button
      key={type}
      onClick={() => handleSetChartType(type)}
      className={`ribbon-btn ${chartConfig.type === type ? 'ring-1 ring-sky-500/50' : ''}`}
      style={
        chartConfig.type === type
          ? { background: 'rgba(14,165,233,0.2)', color: 'var(--accent)' }
          : undefined
      }
      title={label}
      aria-label={label}
    >
      {icon}
      <span className="text-[11px] leading-4">{label}</span>
    </button>
  );

  return (
    <div className="flex items-stretch">
      <RibbonGroup label={t('chart.chartType2d')}>
        {types2d.map(renderChartButton)}
      </RibbonGroup>

      <RibbonGroup label={t('chart.chartTypeStat')}>
        {typesStat.map(renderChartButton)}
      </RibbonGroup>

      <RibbonGroup label={t('chart.chartType3d')}>
        {types3d.map(renderChartButton)}
      </RibbonGroup>

      {showColorMap && (
        <RibbonGroup label={t('chart.colorMap')}>
          <div className="flex items-center gap-1.5">
            <Palette size={14} style={{ color: 'var(--text-muted)' }} />
            <div className="flex gap-1">
              {colorMapNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setColorMap(name)}
                  className={`w-9 h-6 rounded-sm border transition-all focus:ring-2 focus:ring-offset-1 ${
                    chartConfig.colorMap === name ? 'scale-105 ring-2 ring-offset-1' : ''
                  }`}
                  style={{ background: getColorMapGradient(name), borderColor: chartConfig.colorMap === name ? 'var(--accent)' : 'var(--border)', '--tw-ring-color': 'var(--accent)' } as React.CSSProperties}
                  aria-label={name}
                  title={name}
                />
              ))}
            </div>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{chartConfig.colorMap}</span>
          </div>
        </RibbonGroup>
      )}
    </div>
  );
}
