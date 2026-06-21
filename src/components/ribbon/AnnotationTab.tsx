import { useTranslation } from 'react-i18next';
import { useChartStore } from '@/store/plotStore';
import { Trash2, EyeOff, Eye } from 'lucide-react';
import { getAnnotationTypes, createDefaultAnnotation } from '@/utils/annotations';
import { RibbonGroup } from './RibbonGroup';

export function AnnotationTab() {
  const { t } = useTranslation();
  const annotations = useChartStore((s) => s.chartConfig.annotations);
  const addAnnotation = useChartStore((s) => s.addAnnotation);
  const removeAnnotation = useChartStore((s) => s.removeAnnotation);
  const updateAnnotation = useChartStore((s) => s.updateAnnotation);

  const annotationTypes = getAnnotationTypes(t);

  return (
    <div className="flex items-stretch">
      <RibbonGroup label={t('annotation.addAnnotation')}>
        {annotationTypes.map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => addAnnotation(createDefaultAnnotation(type, t))}
            className="ribbon-btn"
            aria-label={label}
          >
            {icon}
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </RibbonGroup>

      {annotations.length > 0 && (
        <RibbonGroup label={t('annotation.annotationList')}>
          <div className="flex items-center gap-2 max-w-[600px] overflow-x-auto">
            {annotations.map((ann) => (
              <div key={ann.id} className="flex items-center gap-1 shrink-0 rounded px-1.5 py-1" style={{ background: 'var(--bg-input)' }}>
                <button
                  onClick={() => updateAnnotation(ann.id, { visible: !ann.visible })}
                  style={{ color: 'var(--text-secondary)' }}
                  aria-label={ann.visible ? t('annotation.hide', 'Hide annotation') : t('annotation.show', 'Show annotation')}
                  aria-pressed={ann.visible}
                >
                  {ann.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                </button>
                <span className="text-xs uppercase w-8" style={{ color: 'var(--text-muted)' }}>
                  {ann.type === 'latex' ? 'TeX' : ann.type}
                </span>
                {(ann.type === 'text' || ann.type === 'latex') && (
                  <input
                    type="text"
                    value={ann.content}
                    onChange={(e) => updateAnnotation(ann.id, { content: e.target.value })}
                    className="w-24 border rounded px-1.5 py-0.5 text-xs outline-none focus:border-sky-500/50"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    placeholder={ann.type === 'latex' ? '$E=mc^2$' : t('annotation.textPlaceholder')}
                    aria-label={ann.type === 'latex' ? t('annotation.latex') : t('annotation.textPlaceholder')}
                  />
                )}
                <input
                  type="color"
                  value={ann.color}
                  onChange={(e) => updateAnnotation(ann.id, { color: e.target.value })}
                  className="w-4 h-4 rounded cursor-pointer bg-transparent border-0"
                  aria-label={t('annotation.color', 'Annotation color')}
                />
                <button
                  onClick={() => removeAnnotation(ann.id)}
                  style={{ color: 'var(--text-faint)' }}
                  aria-label={t('annotation.delete', 'Delete annotation')}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </RibbonGroup>
      )}
    </div>
  );
}
