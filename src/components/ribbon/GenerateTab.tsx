import { useTranslation } from 'react-i18next';
import { useDatasetStore } from '@/store/plotStore';
import { BarChart3, Mountain, Waves, Circle } from 'lucide-react';
import {
  createSampleSineDataset,
  createSampleSurfaceDataset,
  createSampleScatter3DDataset,
  createSampleBarDataset,
} from '@/utils/sampleData';
import { RibbonGroup } from './RibbonGroup';

export function GenerateTab() {
  const { t } = useTranslation();
  const addDataset = useDatasetStore((s) => s.addDataset);

  return (
    <div className="flex items-stretch">
      <RibbonGroup label={t('generate.functionCurve')}>
        <button onClick={() => addDataset(createSampleSineDataset())} className="ribbon-btn" aria-label={t('generate.sine')}>
          <Waves size={16} />
          <span className="text-xs">{t('generate.sine')}</span>
        </button>
        <button onClick={() => addDataset(createSampleSurfaceDataset())} className="ribbon-btn" aria-label={t('generate.sincSurface')}>
          <Mountain size={16} />
          <span className="text-xs">{t('generate.sincSurface')}</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label={t('generate.shape3d')}>
        <button onClick={() => addDataset(createSampleScatter3DDataset())} className="ribbon-btn" aria-label={t('generate.sphere')}>
          <Circle size={16} />
          <span className="text-xs">{t('generate.sphere')}</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label={t('generate.other')}>
        <button onClick={() => addDataset(createSampleBarDataset())} className="ribbon-btn" aria-label={t('generate.bar')}>
          <BarChart3 size={16} />
          <span className="text-xs">{t('generate.bar')}</span>
        </button>
      </RibbonGroup>
    </div>
  );
}
