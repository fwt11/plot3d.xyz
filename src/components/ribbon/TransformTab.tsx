import { useTranslation } from 'react-i18next';
import { useDatasetStore } from '@/store/plotStore';
import { ArrowUpDown, Minimize2, Plus } from 'lucide-react';
import { RibbonGroup } from './RibbonGroup';

export function TransformTab() {
  const { t } = useTranslation();
  const datasets = useDatasetStore((s) => s.datasets);
  const activeDatasetId = useDatasetStore((s) => s.activeDatasetId);
  const transformColumn = useDatasetStore((s) => s.transformColumn);
  const addComputedColumn = useDatasetStore((s) => s.addComputedColumn);
  const sortDataset = useDatasetStore((s) => s.sortDataset);
  const normalizeColumn = useDatasetStore((s) => s.normalizeColumn);
  const addColumn = useDatasetStore((s) => s.addColumn);
  const addRow = useDatasetStore((s) => s.addRow);

  const activeDs = datasets.find((d) => d.id === activeDatasetId);
  const yCol = activeDs?.columns.find((c) => c.type === 'Y') ?? activeDs?.columns[1];

  const transform = (fn: (v: number) => number) => {
    if (!activeDs || !yCol) return;
    transformColumn(activeDs.id, yCol.id, fn);
  };

  const compute = (name: string, fn: (row: Record<string, number>) => number) => {
    if (!activeDs) return;
    addComputedColumn(activeDs.id, name, fn);
  };

  return (
    <div className="flex items-stretch">
      <RibbonGroup label={t('transform.mathTransform')}>
        <button onClick={() => transform(Math.log)} className="ribbon-btn" title="ln(y)" aria-label="ln(y)">
          <span className="text-sm font-mono">ln</span>
          <span className="text-xs">{t('transform.log')}</span>
        </button>
        <button onClick={() => transform(Math.log10)} className="ribbon-btn" title="log10(y)" aria-label="log10(y)">
          <span className="text-sm font-mono">lg</span>
          <span className="text-xs">{t('transform.log10')}</span>
        </button>
        <button onClick={() => transform(Math.exp)} className="ribbon-btn" title="e^y" aria-label="e^y">
          <span className="text-sm font-mono">eˣ</span>
          <span className="text-xs">{t('transform.exp')}</span>
        </button>
        <button onClick={() => transform(Math.sqrt)} className="ribbon-btn" title="√y" aria-label="√y">
          <span className="text-sm font-mono">√</span>
          <span className="text-xs">{t('transform.sqrt')}</span>
        </button>
        <button onClick={() => transform((v) => v * v)} className="ribbon-btn" title="y²" aria-label="y²">
          <span className="text-sm font-mono">x²</span>
          <span className="text-xs">{t('transform.square')}</span>
        </button>
        <button onClick={() => transform((v) => 1 / v)} className="ribbon-btn" title="1/y" aria-label="1/y">
          <span className="text-sm font-mono">1/x</span>
          <span className="text-xs">{t('transform.reciprocal')}</span>
        </button>
        <button onClick={() => transform(Math.abs)} className="ribbon-btn" title="|y|" aria-label="|y|">
          <span className="text-sm font-mono">|x|</span>
          <span className="text-xs">{t('transform.abs')}</span>
        </button>
      </RibbonGroup>

      <RibbonGroup label={t('transform.trigTransform')}>
        <button onClick={() => transform(Math.sin)} className="ribbon-btn" title="sin(y)" aria-label="sin(y)">
          <span className="text-sm font-mono">sin</span>
        </button>
        <button onClick={() => transform(Math.cos)} className="ribbon-btn" title="cos(y)" aria-label="cos(y)">
          <span className="text-sm font-mono">cos</span>
        </button>
        <button onClick={() => transform(Math.tan)} className="ribbon-btn" title="tan(y)" aria-label="tan(y)">
          <span className="text-sm font-mono">tan</span>
        </button>
        <button onClick={() => transform((v) => v * Math.PI / 180)} className="ribbon-btn" title="y° → rad" aria-label="deg to rad">
          <span className="text-sm font-mono">°→r</span>
          <span className="text-xs">{t('transform.degToRad')}</span>
        </button>
      </RibbonGroup>

      <RibbonGroup label={t('transform.computedCol')}>
        <button onClick={() => compute('x+y', (r) => (r[activeDs!.columns[0].name] ?? 0) + (r[activeDs!.columns[1].name] ?? 0))} className="ribbon-btn" title="X + Y" aria-label="X + Y">
          <span className="text-sm font-mono">+</span>
          <span className="text-xs">{t('transform.add')}</span>
        </button>
        <button onClick={() => compute('x-y', (r) => (r[activeDs!.columns[0].name] ?? 0) - (r[activeDs!.columns[1].name] ?? 0))} className="ribbon-btn" title="X - Y" aria-label="X - Y">
          <span className="text-sm font-mono">−</span>
          <span className="text-xs">{t('transform.sub')}</span>
        </button>
        <button onClick={() => compute('x*y', (r) => (r[activeDs!.columns[0].name] ?? 0) * (r[activeDs!.columns[1].name] ?? 0))} className="ribbon-btn" title="X × Y" aria-label="X × Y">
          <span className="text-sm font-mono">×</span>
          <span className="text-xs">{t('transform.mul')}</span>
        </button>
        <button onClick={() => compute('x/y', (r) => { const d = r[activeDs!.columns[1].name]; return d ? r[activeDs!.columns[0].name] / d : NaN; })} className="ribbon-btn" title="X ÷ Y" aria-label="X ÷ Y">
          <span className="text-sm font-mono">÷</span>
          <span className="text-xs">{t('transform.div')}</span>
        </button>
      </RibbonGroup>

      <RibbonGroup label={t('transform.dataOps')}>
        <button
          onClick={() => { if (activeDs && yCol) sortDataset(activeDs.id, yCol.id, true); }}
          className="ribbon-btn" title={t('transform.sortAsc')} aria-label={t('transform.sortAsc')}
        >
          <ArrowUpDown size={16} />
          <span className="text-xs">{t('transform.asc')}</span>
        </button>
        <button
          onClick={() => { if (activeDs && yCol) sortDataset(activeDs.id, yCol.id, false); }}
          className="ribbon-btn" title={t('transform.sortDesc')} aria-label={t('transform.sortDesc')}
        >
          <ArrowUpDown size={16} className="rotate-180" />
          <span className="text-xs">{t('transform.desc')}</span>
        </button>
        <button
          onClick={() => { if (activeDs && yCol) normalizeColumn(activeDs.id, yCol.id); }}
          className="ribbon-btn" title={t('transform.normalizeTip')} aria-label={t('transform.normalize')}
        >
          <Minimize2 size={16} />
          <span className="text-xs">{t('transform.normalize')}</span>
        </button>
        {activeDs && (
          <>
            <button onClick={() => addColumn(activeDs.id)} className="ribbon-btn" title={t('transform.addColTip')} aria-label={t('transform.addCol')}>
              <Plus size={16} />
              <span className="text-xs">{t('transform.addCol')}</span>
            </button>
            <button onClick={() => addRow(activeDs.id)} className="ribbon-btn" title={t('transform.addRowTip')} aria-label={t('transform.addRow')}>
              <Plus size={16} />
              <span className="text-xs">{t('transform.addRow')}</span>
            </button>
          </>
        )}
      </RibbonGroup>
    </div>
  );
}
