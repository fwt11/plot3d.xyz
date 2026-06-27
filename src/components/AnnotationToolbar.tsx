import type { Annotation, AnnotationType } from '@/types';
import { toDisplayPercent, type AxisRanges } from '@/utils/annotationCoords';
import {
  Lock,
  Unlock,
  Copy,
  Trash2,
  ArrowUpToLine,
  ArrowDownToLine,
  Minus,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';

interface AnnotationToolbarProps {
  annotation: Annotation;
  axisRanges: AxisRanges | null;
  onUpdate: (data: Partial<Annotation>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  t: (key: string) => string;
}

const FONT_OPTIONS = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
  { value: '"Courier New", monospace', label: 'Courier New' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: '"Microsoft YaHei", sans-serif', label: '微软雅黑' },
  { value: 'sans-serif', label: 'Sans Serif' },
  { value: 'serif', label: 'Serif' },
  { value: 'monospace', label: 'Monospace' },
];

function isTextType(type: AnnotationType): boolean {
  return ['text', 'latex', 'callout', 'dataLabel'].includes(type);
}

function hasFill(type: AnnotationType): boolean {
  return ['rect', 'ellipse', 'polygon', 'hband', 'vband'].includes(type);
}

function hasStroke(type: AnnotationType): boolean {
  return ['rect', 'ellipse', 'polygon', 'arrow', 'line', 'bracket', 'callout', 'hline', 'vline', 'hband', 'vband'].includes(type);
}

function ToolbarDivider() {
  return <div className="w-px h-4 self-center" style={{ background: 'var(--border)' }} />;
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
  danger,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-6 h-6 flex items-center justify-center rounded ${active ? 'bg-sky-500/20' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
      title={title}
      style={{ color: danger ? '#fb7185' : active ? 'var(--accent)' : 'var(--text-secondary)' }}
    >
      {children}
    </button>
  );
}

function ColorSwatch({
  value,
  onChange,
  title,
}: {
  value: string;
  onChange: (color: string) => void;
  title: string;
}) {
  return (
    <label
      className="relative flex items-center justify-center w-6 h-6 rounded cursor-pointer border"
      style={{ backgroundColor: value, borderColor: 'var(--border)' }}
      title={title}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
    </label>
  );
}

export function AnnotationToolbar({
  annotation,
  axisRanges,
  onUpdate,
  onRemove,
  onDuplicate,
  onBringToFront,
  onSendToBack,
  t,
}: AnnotationToolbarProps) {
  const disp = toDisplayPercent(annotation.x, annotation.y, annotation.coordMode, axisRanges);
  const color = annotation.color;
  const fillColor = annotation.fillColor ?? color;
  const backgroundColor = annotation.backgroundColor ?? 'transparent';
  const strokeWidth = annotation.strokeWidth ?? 2;
  const opacity = annotation.opacity ?? 1;
  const locked = annotation.locked ?? false;
  const isText = isTextType(annotation.type);
  const showFill = hasFill(annotation.type);
  const showStroke = hasStroke(annotation.type);

  return (
    <div
      className="absolute z-20 flex flex-wrap items-center gap-1 px-1.5 py-1 rounded-md border shadow-sm max-w-[90%]"
      style={{
        left: `${disp.x}%`,
        top: `${disp.y}%`,
        transform: 'translate(-50%, -130%)',
        background: 'var(--bg-surface)',
        borderColor: 'var(--border)',
        pointerEvents: 'auto',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Font settings for text annotations */}
      {isText && (
        <>
          <select
            value={annotation.fontFamily ?? 'Arial, sans-serif'}
            onChange={(e) => onUpdate({ fontFamily: e.target.value })}
            className="h-6 px-1 text-xs rounded border outline-none"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            title={t('annotation.fontFamily')}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>

          <input
            type="number"
            min={8}
            max={72}
            step={1}
            value={annotation.fontSize}
            onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
            className="w-12 h-6 px-1 text-xs rounded border outline-none"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            title={t('annotation.fontSize')}
          />

          <ToolbarButton
            active={annotation.fontWeight === 'bold'}
            onClick={() => onUpdate({ fontWeight: annotation.fontWeight === 'bold' ? 'normal' : 'bold' })}
            title={t('annotation.bold')}
          >
            <Bold size={14} />
          </ToolbarButton>

          <ToolbarButton
            active={annotation.fontStyle === 'italic'}
            onClick={() => onUpdate({ fontStyle: annotation.fontStyle === 'italic' ? 'normal' : 'italic' })}
            title={t('annotation.italic')}
          >
            <Italic size={14} />
          </ToolbarButton>

          <ToolbarButton
            active={annotation.textDecoration === 'underline'}
            onClick={() => onUpdate({ textDecoration: annotation.textDecoration === 'underline' ? 'none' : 'underline' })}
            title={t('annotation.underline')}
          >
            <Underline size={14} />
          </ToolbarButton>

          <ToolbarDivider />

          <ColorSwatch
            value={color}
            onChange={(c) => onUpdate({ color: c })}
            title={t('annotation.color')}
          />

          <ColorSwatch
            value={backgroundColor === 'transparent' ? '#ffffff' : backgroundColor}
            onChange={(c) => onUpdate({ backgroundColor: c })}
            title={t('annotation.backgroundColor')}
          />

          <ToolbarDivider />

          <ToolbarButton
            active={annotation.textAlign === 'left'}
            onClick={() => onUpdate({ textAlign: 'left' })}
            title={t('annotation.alignLeft')}
          >
            <AlignLeft size={14} />
          </ToolbarButton>

          <ToolbarButton
            active={annotation.textAlign === 'center'}
            onClick={() => onUpdate({ textAlign: 'center' })}
            title={t('annotation.alignCenter')}
          >
            <AlignCenter size={14} />
          </ToolbarButton>

          <ToolbarButton
            active={annotation.textAlign === 'right'}
            onClick={() => onUpdate({ textAlign: 'right' })}
            title={t('annotation.alignRight')}
          >
            <AlignRight size={14} />
          </ToolbarButton>

          <ToolbarDivider />
        </>
      )}

      {/* Stroke / fill for non-text annotations */}
      {!isText && (
        <>
          <ColorSwatch
            value={color}
            onChange={(c) => onUpdate({ color: c })}
            title={t('annotation.color')}
          />

          {showFill && (
            <ColorSwatch
              value={fillColor}
              onChange={(c) => onUpdate({ fillColor: c })}
              title={t('annotation.fillColor')}
            />
          )}

          {showStroke && (
            <div className="flex items-center gap-0.5 px-1">
              {[1, 2, 4].map((w) => (
                <ToolbarButton
                  key={w}
                  active={strokeWidth === w}
                  onClick={() => onUpdate({ strokeWidth: w })}
                  title={`${t('annotation.strokeWidth')} ${w}px`}
                >
                  <Minus size={12 + w} strokeWidth={w} />
                </ToolbarButton>
              ))}
            </div>
          )}

          <ToolbarDivider />
        </>
      )}

      {/* Opacity */}
      <div className="flex items-center gap-1">
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => onUpdate({ opacity: Number(e.target.value) })}
          className="w-16 h-1 accent-sky-500 cursor-pointer"
          title={t('annotation.opacity')}
        />
      </div>

      <ToolbarDivider />

      {/* Common actions */}
      <ToolbarButton
        active={locked}
        onClick={() => onUpdate({ locked: !locked })}
        title={t('annotation.locked')}
      >
        {locked ? <Lock size={14} /> : <Unlock size={14} />}
      </ToolbarButton>

      <ToolbarButton onClick={onDuplicate} title={t('annotation.duplicate')}>
        <Copy size={14} />
      </ToolbarButton>

      <ToolbarButton onClick={onBringToFront} title={t('annotation.bringToFront')}>
        <ArrowUpToLine size={14} />
      </ToolbarButton>

      <ToolbarButton onClick={onSendToBack} title={t('annotation.sendToBack')}>
        <ArrowDownToLine size={14} />
      </ToolbarButton>

      <ToolbarButton onClick={onRemove} title={t('annotation.delete')} danger>
        <Trash2 size={14} />
      </ToolbarButton>
    </div>
  );
}
