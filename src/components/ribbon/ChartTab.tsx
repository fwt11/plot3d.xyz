import { useTranslation } from 'react-i18next';
import { useChartStore } from '@/store/plotStore';
import { useScene3DStore } from '@/store/plotStore';
import { Sun, Droplets, Palette, RotateCcw, Eye } from 'lucide-react';
import { getColorMapGradient } from '@/utils/colormaps';
import { colorMapNames, is3DChart } from '@/utils/chart';
import { getChartTypes } from './chartTypes';
import { RibbonGroup } from './RibbonGroup';

export function ChartTab() {
  const { t } = useTranslation();
  const chartConfig = useChartStore((s) => s.chartConfig);
  const setChartType = useChartStore((s) => s.setChartType);
  const scene3D = useScene3DStore((s) => s.scene3D);
  const setScene3D = useScene3DStore((s) => s.setScene3D);
  const setChartTitle = useChartStore((s) => s.setChartTitle);
  const is3D = is3DChart(chartConfig.type);

  const chartTypes = getChartTypes(t);

  return (
    <div className="flex items-stretch">
      <RibbonGroup label={t('chart.chartType')}>
        {chartTypes.map(({ type, label, icon, group }) => (
          <button
            key={type}
            onClick={() => setChartType(type)}
            className={`ribbon-btn ${chartConfig.type === type ? 'ring-1 ring-sky-500/50' : ''} ${group === '3d' ? 'ml-1 border-l pl-2' : ''}`}
            style={{
              ...(chartConfig.type === type ? { background: 'rgba(14,165,233,0.2)', color: 'var(--accent)' } : {}),
              ...(group === '3d' ? { borderColor: 'var(--border)' } : {}),
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

      {is3D && (
        <>
          <RibbonGroup label={t('chart.lighting')}>
            <div className="flex items-center gap-1">
              <Sun size={14} style={{ color: 'var(--text-muted)' }} />
              <input
                type="range" min="0" max="1" step="0.05"
                value={scene3D.ambientIntensity}
                onChange={(e) => setScene3D({ ambientIntensity: Number(e.target.value) })}
                className="w-16"
                style={{ accentColor: 'var(--accent)' }}
                aria-label={t('chart.lighting')}
              />
            </div>
          </RibbonGroup>
          <RibbonGroup label={t('chart.opacity')}>
            <div className="flex items-center gap-1">
              <Droplets size={14} style={{ color: 'var(--text-muted)' }} />
              <input
                type="range" min="0.1" max="1" step="0.05"
                value={scene3D.opacity}
                onChange={(e) => setScene3D({ opacity: Number(e.target.value) })}
                className="w-16"
                style={{ accentColor: 'var(--accent)' }}
                aria-label={t('chart.opacity')}
              />
            </div>
          </RibbonGroup>
          <RibbonGroup label={t('chart.colorMap')}>
            <div className="flex items-center gap-1.5">
              <Palette size={14} style={{ color: 'var(--text-muted)' }} />
              <div className="flex gap-1">
                {colorMapNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => setScene3D({ colorMap: name })}
                    className={`w-8 h-5 rounded-sm border transition-all focus:ring-2 focus:ring-offset-1 ${
                      scene3D.colorMap === name ? 'scale-110' : ''
                    }`}
                    style={{ background: getColorMapGradient(name), borderColor: scene3D.colorMap === name ? 'var(--accent)' : 'var(--border)' }}
                    aria-label={name}
                    title={name}
                  />
                ))}
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{scene3D.colorMap}</span>
            </div>
          </RibbonGroup>
          <RibbonGroup label={t('chart.viewpoint')}>
            <button onClick={() => setScene3D({ cameraPosition: [3, 3, 3] })} className="ribbon-btn" title={t('chart.resetView')} aria-label={t('chart.resetView')}>
              <RotateCcw size={16} />
              <span className="text-xs">{t('chart.reset')}</span>
            </button>
            <button
              onClick={() => setScene3D({ showAxes: !scene3D.showAxes })}
              className="ribbon-btn"
              style={scene3D.showAxes ? { color: 'var(--accent)' } : undefined}
              title={t('chart.toggleAxes')}
              aria-label={t('chart.toggleAxes')}
              aria-pressed={scene3D.showAxes}
            >
              <Eye size={16} />
              <span className="text-xs">{t('chart.axes')}</span>
            </button>
          </RibbonGroup>
        </>
      )}
    </div>
  );
}
