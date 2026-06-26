import { useTranslation } from 'react-i18next';
import { useChartStore, useAnnotationToolStore } from '@/store/plotStore';
import { getAnnotationTools, type AnnotationTool } from '@/utils/annotations';
import { RibbonGroup } from './RibbonGroup';
import { MousePointer2, Trash2, Copy, ArrowUpToLine, ArrowDownToLine, Lock, Unlock } from 'lucide-react';

export function AnnotationTab() {
  const { t } = useTranslation();
  const annotations = useChartStore((s) => s.chartConfig.annotations);
  const activeTool = useAnnotationToolStore((s) => s.activeTool);
  const selectedId = useAnnotationToolStore((s) => s.selectedId);
  const setActiveTool = useAnnotationToolStore((s) => s.setActiveTool);
  const setSelectedId = useAnnotationToolStore((s) => s.setSelectedId);
  const removeAnnotation = useChartStore((s) => s.removeAnnotation);
  const duplicateAnnotation = useChartStore((s) => s.duplicateAnnotation);
  const bringAnnotationToFront = useChartStore((s) => s.bringAnnotationToFront);
  const sendAnnotationToBack = useChartStore((s) => s.sendAnnotationToBack);
  const updateAnnotation = useChartStore((s) => s.updateAnnotation);

  const tools = getAnnotationTools(t);
  const selected = annotations.find((a) => a.id === selectedId);

  const toggleTool = (type: AnnotationTool) => {
    setActiveTool(activeTool === type ? 'select' : type);
  };

  return (
    <div className="flex items-stretch">
      <RibbonGroup label={t('annotation.addAnnotation')}>
        {tools.map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => toggleTool(type)}
            className={`ribbon-btn ${activeTool === type ? 'ring-1 ring-sky-500 bg-sky-500/10' : ''}`}
            aria-label={label}
            title={label}
          >
            {icon}
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </RibbonGroup>

      {selected && (
        <RibbonGroup label={t('annotation.properties')}>
          <button
            onClick={() => setSelectedId(null)}
            className="ribbon-btn"
            aria-label={t('annotation.select')}
            title={t('annotation.select')}
          >
            <MousePointer2 size={16} />
            <span className="text-xs">{t('annotation.select')}</span>
          </button>
          <button
            onClick={() => duplicateAnnotation(selected.id)}
            className="ribbon-btn"
            aria-label={t('annotation.duplicate')}
            title={t('annotation.duplicate')}
          >
            <Copy size={16} />
            <span className="text-xs">{t('annotation.duplicate')}</span>
          </button>
          <button
            onClick={() => bringAnnotationToFront(selected.id)}
            className="ribbon-btn"
            aria-label={t('annotation.bringToFront')}
            title={t('annotation.bringToFront')}
          >
            <ArrowUpToLine size={16} />
            <span className="text-xs">{t('annotation.bringToFront')}</span>
          </button>
          <button
            onClick={() => sendAnnotationToBack(selected.id)}
            className="ribbon-btn"
            aria-label={t('annotation.sendToBack')}
            title={t('annotation.sendToBack')}
          >
            <ArrowDownToLine size={16} />
            <span className="text-xs">{t('annotation.sendToBack')}</span>
          </button>
          <button
            onClick={() => updateAnnotation(selected.id, { locked: !selected.locked })}
            className="ribbon-btn"
            aria-label={selected.locked ? t('annotation.locked') : t('annotation.locked')}
            title={selected.locked ? t('annotation.locked') : t('annotation.locked')}
          >
            {selected.locked ? <Lock size={16} /> : <Unlock size={16} />}
            <span className="text-xs">{selected.locked ? t('annotation.locked') : t('annotation.locked')}</span>
          </button>
          <button
            onClick={() => {
              removeAnnotation(selected.id);
              setSelectedId(null);
            }}
            className="ribbon-btn"
            style={{ color: '#fb7185' }}
            aria-label={t('annotation.delete')}
            title={t('annotation.delete')}
          >
            <Trash2 size={16} />
            <span className="text-xs">{t('annotation.delete')}</span>
          </button>
        </RibbonGroup>
      )}
    </div>
  );
}
