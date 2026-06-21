import { Text } from '@react-three/drei';
import { useChartStore } from '@/store/chartStore';
import { useDatasetStore } from '@/store/datasetStore';
import { useScene3DStore } from '@/store/scene3DStore';
import { getColorMapGradient } from '@/utils/colormaps';
import { useTranslation } from 'react-i18next';
import { useDataRange, niceScale } from './types';

export function ChartTitle() {
  const title = useChartStore((s) => s.chartConfig.title);
  if (!title) return null;
  return (
    <Text position={[0, 1.45, 0]} fontSize={0.12} color="#e4e4e7" anchorX="center" anchorY="bottom">
      {title}
    </Text>
  );
}

export function ColorbarOverlay() {
  const scene3D = useScene3DStore((s) => s.scene3D);
  const dataRange = useDataRange();

  if (!scene3D.showColorbar || !dataRange) return null;

  const zTicks = niceScale(dataRange.zMin, dataRange.zMax);

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
      <div className="flex flex-col items-end text-xs" style={{ color: 'var(--colorbar-text)' }}>
        {zTicks.map((v) => (
          <span key={v} className="leading-none">{v.toFixed(v === Math.round(v) ? 0 : 1)}</span>
        ))}
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <div
          className="w-4 rounded-sm"
          style={{
            height: '180px',
            background: getColorMapGradient(scene3D.colorMap),
          }}
        />
      </div>
      <div className="text-xs -rotate-90 whitespace-nowrap" style={{ color: 'var(--colorbar-text)' }}>
        {dataRange.zLabel}
      </div>
    </div>
  );
}

export function LegendOverlay() {
  const { t } = useTranslation();
  const chartConfig = useChartStore((s) => s.chartConfig);
  const datasets = useDatasetStore((s) => s.datasets);

  if (!chartConfig.legend.visible) return null;

  return (
    <div className={`absolute top-3 left-1/2 -translate-x-1/2 flex gap-4 rounded px-3 py-1.5`} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      {chartConfig.layers.filter((l) => l.visible).map((layer) => {
        const ds = datasets.find((d) => d.id === layer.datasetId);
        return (
          <div key={layer.id} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <div className="w-3 h-1 rounded" style={{ backgroundColor: layer.color }} />
            {ds?.name ?? t('data.noDataset')}
          </div>
        );
      })}
    </div>
  );
}
