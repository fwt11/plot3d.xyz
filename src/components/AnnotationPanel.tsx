import { usePlotStore } from '@/store/plotStore';
import { useTranslation } from 'react-i18next';
import { uid } from '@/utils/sampleData';
import type { AnnotationType, Annotation } from '@/types';
import { Plus, Trash2, Eye, EyeOff, Type, ArrowUpRight, Square, Sigma } from 'lucide-react';

function getAnnotationTypes(t: (key: string) => string): { type: AnnotationType; label: string; icon: React.ReactNode }[] {
  return [
    { type: 'text', label: t('annotation.text'), icon: <Type size={12} /> },
    { type: 'latex', label: t('annotation.latex'), icon: <Sigma size={12} /> },
    { type: 'arrow', label: t('annotation.arrow'), icon: <ArrowUpRight size={12} /> },
    { type: 'rect', label: t('annotation.rect'), icon: <Square size={12} /> },
  ];
}

function createDefaultAnnotation(type: AnnotationType, t: (key: string) => string): Annotation {
  const base = {
    id: uid(),
    type,
    x: 50,
    y: 50,
    content: type === 'latex' ? '$E = mc^2$' : type === 'text' ? t('annotation.defaultText') : '',
    fontSize: 14,
    color: '#e4e4e7',
    visible: true,
    coordMode: 'percent' as const,
  };
  if (type === 'arrow') {
    return { ...base, content: '', arrowTo: { x: 70, y: 30 } };
  }
  if (type === 'rect') {
    return { ...base, content: '', rectSize: { w: 20, h: 15 } };
  }
  return base;
}

export default function AnnotationPanel() {
  const { t } = useTranslation();
  const annotations = usePlotStore((s) => s.chartConfig.annotations);
  const addAnnotation = usePlotStore((s) => s.addAnnotation);
  const removeAnnotation = usePlotStore((s) => s.removeAnnotation);
  const updateAnnotation = usePlotStore((s) => s.updateAnnotation);

  const annotationTypes = getAnnotationTypes(t);

  return (
    <div className="space-y-2">
      {/* Add buttons */}
      <div className="flex flex-wrap gap-1">
        {annotationTypes.map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => addAnnotation(createDefaultAnnotation(type, t))}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors"
            style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Annotation list */}
      {annotations.length === 0 && (
        <div className="text-xs py-2 text-center" style={{ color: 'var(--text-faint)' }}>
          {t('annotation.addAnnotation')}
        </div>
      )}

      {annotations.map((ann) => (
        <div key={ann.id} className="p-2 rounded space-y-1.5" style={{ background: 'var(--bg-surface)' }}>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => updateAnnotation(ann.id, { visible: !ann.visible })}
              style={{ color: 'var(--text-secondary)' }}
            >
              {ann.visible ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
            <span className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              {ann.type === 'latex' ? 'LaTeX' : ann.type}
            </span>
            <input
              type="color"
              value={ann.color}
              onChange={(e) => updateAnnotation(ann.id, { color: e.target.value })}
              className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 ml-auto"
            />
            <button
              onClick={() => removeAnnotation(ann.id)}
              className="transition-colors"
              style={{ color: 'var(--text-faint)' }}
            >
              <Trash2 size={11} />
            </button>
          </div>

          {/* Content input */}
          {(ann.type === 'text' || ann.type === 'latex') && (
            <input
              type="text"
              value={ann.content}
              onChange={(e) => updateAnnotation(ann.id, { content: e.target.value })}
              placeholder={ann.type === 'latex' ? t('annotation.latexPlaceholder') : t('annotation.textPlaceholder')}
              className="w-full border rounded px-2 py-0.5 text-xs outline-none font-mono"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          )}

          {/* Coord mode toggle */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateAnnotation(ann.id, { coordMode: 'percent' })}
              className={`px-1.5 py-0.5 rounded text-xs transition-colors ${ann.coordMode === 'percent' ? 'font-medium' : ''}`}
              style={{
                background: ann.coordMode === 'percent' ? 'var(--accent)' : 'var(--bg-input)',
                color: ann.coordMode === 'percent' ? '#fff' : 'var(--text-muted)',
              }}
            >
              %
            </button>
            <button
              onClick={() => updateAnnotation(ann.id, { coordMode: 'data' })}
              className={`px-1.5 py-0.5 rounded text-xs transition-colors ${ann.coordMode === 'data' ? 'font-medium' : ''}`}
              style={{
                background: ann.coordMode === 'data' ? 'var(--accent)' : 'var(--bg-input)',
                color: ann.coordMode === 'data' ? '#fff' : 'var(--text-muted)',
              }}
            >
              XY
            </button>
          </div>

          {/* Position */}
          <div className="flex gap-2">
            <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              X
              <input
                type="number"
                value={ann.x}
                onChange={(e) => updateAnnotation(ann.id, { x: Number(e.target.value) })}
                className="w-12 border rounded px-1 py-0.5 outline-none"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </label>
            <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Y
              <input
                type="number"
                value={ann.y}
                onChange={(e) => updateAnnotation(ann.id, { y: Number(e.target.value) })}
                className="w-12 border rounded px-1 py-0.5 outline-none"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </label>
            <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('annotation.fontSize', '字号')}
              <input
                type="number"
                value={ann.fontSize}
                min={8}
                max={72}
                onChange={(e) => updateAnnotation(ann.id, { fontSize: Number(e.target.value) })}
                className="w-10 border rounded px-1 py-0.5 outline-none"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </label>
          </div>

          {/* Arrow target */}
          {ann.type === 'arrow' && ann.arrowTo && (
            <div className="flex gap-2">
              <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                →X
                <input
                  type="number"
                  value={ann.arrowTo.x}
                  onChange={(e) => updateAnnotation(ann.id, { arrowTo: { ...ann.arrowTo, x: Number(e.target.value) } })}
                  className="w-12 border rounded px-1 py-0.5 outline-none"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </label>
              <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                →Y
                <input
                  type="number"
                  value={ann.arrowTo.y}
                  onChange={(e) => updateAnnotation(ann.id, { arrowTo: { ...ann.arrowTo, y: Number(e.target.value) } })}
                  className="w-12 border rounded px-1 py-0.5 outline-none"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </label>
            </div>
          )}

          {/* Rect size */}
          {ann.type === 'rect' && ann.rectSize && (
            <div className="flex gap-2">
              <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('annotation.width', '宽')}
                <input
                  type="number"
                  value={ann.rectSize.w}
                  onChange={(e) => updateAnnotation(ann.id, { rectSize: { ...ann.rectSize, w: Number(e.target.value) } })}
                  className="w-12 border rounded px-1 py-0.5 outline-none"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </label>
              <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('annotation.height', '高')}
                <input
                  type="number"
                  value={ann.rectSize.h}
                  onChange={(e) => updateAnnotation(ann.id, { rectSize: { ...ann.rectSize, h: Number(e.target.value) } })}
                  className="w-12 border rounded px-1 py-0.5 outline-none"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </label>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
