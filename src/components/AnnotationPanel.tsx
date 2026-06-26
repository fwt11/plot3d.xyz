import { useChartStore, useAnnotationToolStore } from '@/store/plotStore';
import { useTranslation } from 'react-i18next';
import { getAnnotationTypes, createDefaultAnnotation } from '@/utils/annotations';
import { Trash2, Eye, EyeOff, Copy, ArrowUpToLine, ArrowDownToLine, Lock, Unlock } from 'lucide-react';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2 flex-wrap">{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{children}</span>;
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  className = 'w-14',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`border rounded px-1.5 py-0.5 text-xs outline-none focus:border-sky-500/50 ${className}`}
      style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
    />
  );
}

export default function AnnotationPanel() {
  const { t } = useTranslation();
  const annotations = useChartStore((s) => s.chartConfig.annotations);
  const addAnnotation = useChartStore((s) => s.addAnnotation);
  const removeAnnotation = useChartStore((s) => s.removeAnnotation);
  const updateAnnotation = useChartStore((s) => s.updateAnnotation);
  const duplicateAnnotation = useChartStore((s) => s.duplicateAnnotation);
  const bringAnnotationToFront = useChartStore((s) => s.bringAnnotationToFront);
  const sendAnnotationToBack = useChartStore((s) => s.sendAnnotationToBack);
  const selectedId = useAnnotationToolStore((s) => s.selectedId);
  const setSelectedId = useAnnotationToolStore((s) => s.setSelectedId);

  const selected = annotations.find((a) => a.id === selectedId);
  const annotationTypes = getAnnotationTypes(t);

  if (!selected) {
    return (
      <div className="space-y-2">
        <Section title={t('annotation.addAnnotation')}>
          <div className="flex flex-wrap gap-1">
            {annotationTypes.map(({ type, label, icon }) => (
              <button
                key={type}
                onClick={() => addAnnotation(createDefaultAnnotation(type, t))}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors"
                style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}
                title={label}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </Section>
        {annotations.length === 0 ? (
          <div className="text-xs py-2 text-center" style={{ color: 'var(--text-faint)' }}>
            {t('annotation.addAnnotation')}
          </div>
        ) : (
          <Section title={t('annotation.annotationList')}>
            <div className="space-y-1">
              {annotations.map((ann) => (
                <button
                  key={ann.id}
                  onClick={() => setSelectedId(ann.id)}
                  className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs text-left transition-colors"
                  style={{
                    background: ann.id === selectedId ? 'var(--bg-surface-hover)' : 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span className="uppercase" style={{ color: 'var(--text-muted)' }}>{ann.type}</span>
                  <span className="truncate flex-1">{ann.content || ann.type}</span>
                </button>
              ))}
            </div>
          </Section>
        )}
      </div>
    );
  }

  const ann = selected;
  const update = (data: Partial<typeof ann>) => updateAnnotation(ann.id, data);

  return (
    <div className="space-y-3">
      <Row>
        <button
          onClick={() => update({ visible: !ann.visible })}
          style={{ color: 'var(--text-secondary)' }}
          title={ann.visible ? t('annotation.hide') : t('annotation.show')}
        >
          {ann.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          onClick={() => update({ locked: !ann.locked })}
          style={{ color: ann.locked ? 'var(--accent)' : 'var(--text-secondary)' }}
          title={t('annotation.locked')}
        >
          {ann.locked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>
        <button onClick={() => duplicateAnnotation(ann.id)} title={t('annotation.duplicate')} style={{ color: 'var(--text-secondary)' }}>
          <Copy size={14} />
        </button>
        <button onClick={() => sendAnnotationToBack(ann.id)} title={t('annotation.sendToBack')} style={{ color: 'var(--text-secondary)' }}>
          <ArrowDownToLine size={14} />
        </button>
        <button onClick={() => bringAnnotationToFront(ann.id)} title={t('annotation.bringToFront')} style={{ color: 'var(--text-secondary)' }}>
          <ArrowUpToLine size={14} />
        </button>
        <button
          onClick={() => {
            removeAnnotation(ann.id);
            setSelectedId(null);
          }}
          style={{ color: '#fb7185' }}
          title={t('annotation.delete')}
        >
          <Trash2 size={14} />
        </button>
      </Row>

      {/* Content */}
      {(ann.type === 'text' || ann.type === 'latex' || ann.type === 'callout' || ann.type === 'dataLabel') && (
        <Section title={t('annotation.content')}>
          <textarea
            value={ann.content}
            onChange={(e) => update({ content: e.target.value })}
            rows={2}
            className="w-full border rounded px-2 py-1 text-xs outline-none focus:border-sky-500/50 font-mono"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
        </Section>
      )}

      {/* Position & Coordinate Mode */}
      <Section title={t('annotation.position')}>
        <Row>
          <Label>X</Label>
          <NumberInput value={ann.x} onChange={(v) => update({ x: v })} step={0.1} />
          <Label>Y</Label>
          <NumberInput value={ann.y} onChange={(v) => update({ y: v })} step={0.1} />
        </Row>
        <Row>
          <button
            onClick={() => update({ coordMode: 'percent' })}
            className={`px-2 py-0.5 rounded text-xs ${ann.coordMode === 'percent' ? 'font-medium' : ''}`}
            style={{
              background: ann.coordMode === 'percent' ? 'var(--accent)' : 'var(--bg-input)',
              color: ann.coordMode === 'percent' ? '#fff' : 'var(--text-muted)',
            }}
          >
            %
          </button>
          <button
            onClick={() => update({ coordMode: 'data' })}
            className={`px-2 py-0.5 rounded text-xs ${ann.coordMode === 'data' ? 'font-medium' : ''}`}
            style={{
              background: ann.coordMode === 'data' ? 'var(--accent)' : 'var(--bg-input)',
              color: ann.coordMode === 'data' ? '#fff' : 'var(--text-muted)',
            }}
            title={t('annotation.dataModeTip')}
          >
            XY
          </button>
        </Row>

        {ann.type === 'rect' && ann.rectSize && (() => {
          const { w, h } = ann.rectSize;
          return (
            <Row>
              <Label>{t('annotation.width')}</Label>
              <NumberInput value={w} onChange={(v) => update({ rectSize: { w: v, h } })} step={0.1} />
              <Label>{t('annotation.height')}</Label>
              <NumberInput value={h} onChange={(v) => update({ rectSize: { w, h: v } })} step={0.1} />
            </Row>
          );
        })()}

        {ann.type === 'ellipse' && ann.ellipseRadii && (() => {
          const { rx, ry } = ann.ellipseRadii;
          return (
            <Row>
              <Label>RX</Label>
              <NumberInput value={rx} onChange={(v) => update({ ellipseRadii: { rx: v, ry } })} step={0.1} />
              <Label>RY</Label>
              <NumberInput value={ry} onChange={(v) => update({ ellipseRadii: { rx, ry: v } })} step={0.1} />
            </Row>
          );
        })()}

        {(ann.type === 'arrow' || ann.type === 'callout') && ann.arrowTo && (() => {
          const { x, y } = ann.arrowTo;
          return (
            <Row>
              <Label>→X</Label>
              <NumberInput value={x} onChange={(v) => update({ arrowTo: { x: v, y } })} step={0.1} />
              <Label>→Y</Label>
              <NumberInput value={y} onChange={(v) => update({ arrowTo: { x, y: v } })} step={0.1} />
            </Row>
          );
        })()}

        {(ann.type === 'line' || ann.type === 'bracket') && ann.endPoint && (() => {
          const { x, y } = ann.endPoint;
          return (
            <Row>
              <Label>→X</Label>
              <NumberInput value={x} onChange={(v) => update({ endPoint: { x: v, y } })} step={0.1} />
              <Label>→Y</Label>
              <NumberInput value={y} onChange={(v) => update({ endPoint: { x, y: v } })} step={0.1} />
            </Row>
          );
        })()}

        {ann.type === 'bracket' && (
          <Row>
            <Label>H</Label>
            <NumberInput value={ann.bracketHeight ?? 12} onChange={(v) => update({ bracketHeight: v })} step={0.5} />
          </Row>
        )}

        {ann.type === 'image' && ann.imageSize && (() => {
          const { w, h } = ann.imageSize;
          return (
            <Row>
              <Label>{t('annotation.width')}</Label>
              <NumberInput value={w} onChange={(v) => update({ imageSize: { w: v, h } })} step={0.1} />
              <Label>{t('annotation.height')}</Label>
              <NumberInput value={h} onChange={(v) => update({ imageSize: { w, h: v } })} step={0.1} />
            </Row>
          );
        })()}

        <Row>
          <Label>{t('annotation.rotation')}</Label>
          <NumberInput value={ann.rotation ?? 0} onChange={(v) => update({ rotation: v })} step={1} />
        </Row>
      </Section>

      {/* Appearance */}
      <Section title={t('annotation.appearance')}>
        <Row>
          <Label>{t('annotation.color')}</Label>
          <input
            type="color"
            value={ann.color}
            onChange={(e) => update({ color: e.target.value })}
            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
          />
          <Label>{t('annotation.fillColor')}</Label>
          <input
            type="color"
            value={ann.fillColor ?? ann.color}
            onChange={(e) => update({ fillColor: e.target.value })}
            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
          />
        </Row>
        <Row>
          <Label>{t('annotation.strokeWidth')}</Label>
          <NumberInput value={ann.strokeWidth ?? 2} onChange={(v) => update({ strokeWidth: v })} min={0} max={20} step={0.5} />
          <Label>{t('annotation.opacity')}</Label>
          <NumberInput value={ann.opacity ?? 1} onChange={(v) => update({ opacity: v })} min={0} max={1} step={0.05} />
        </Row>
        <Row>
          <Label>{t('annotation.fontSize')}</Label>
          <NumberInput value={ann.fontSize} onChange={(v) => update({ fontSize: v })} min={8} max={72} step={1} />
        </Row>
      </Section>
    </div>
  );
}
