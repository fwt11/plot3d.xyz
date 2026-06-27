import { uid } from '@/utils/sampleData';
import { useUiStore } from '@/store/uiStore';
import type { AnnotationType, Annotation } from '@/types';
import {
  Type,
  ArrowUpRight,
  Square,
  Sigma,
  MousePointer2,
  Minus,
  Brackets,
  MessageSquare,
  Circle,
  Hexagon,
  FlipHorizontal,
  FlipVertical,
  AlignStartVertical,
  AlignEndVertical,
  Tag,
  Image as ImageIcon,
} from 'lucide-react';

export type AnnotationTool = AnnotationType | 'select';

/** Backward-compatible helper for existing panels that only need the original 4 types. */
export function getAnnotationTypes(t: (key: string) => string): { type: AnnotationType; label: string; icon: React.ReactNode }[] {
  return [
    { type: 'text', label: t('annotation.text'), icon: <Type size={16} /> },
    { type: 'latex', label: t('annotation.latex'), icon: <Sigma size={16} /> },
    { type: 'arrow', label: t('annotation.arrow'), icon: <ArrowUpRight size={16} /> },
    { type: 'rect', label: t('annotation.rect'), icon: <Square size={16} /> },
  ];
}

export function getAnnotationTools(t: (key: string) => string): { type: AnnotationTool; label: string; icon: React.ReactNode }[] {
  return [
    { type: 'select', label: t('annotation.select'), icon: <MousePointer2 size={16} /> },
    { type: 'text', label: t('annotation.text'), icon: <Type size={16} /> },
    { type: 'latex', label: t('annotation.latex'), icon: <Sigma size={16} /> },
    { type: 'callout', label: t('annotation.callout'), icon: <MessageSquare size={16} /> },
    { type: 'arrow', label: t('annotation.arrow'), icon: <ArrowUpRight size={16} /> },
    { type: 'line', label: t('annotation.line'), icon: <Minus size={16} /> },
    { type: 'bracket', label: t('annotation.bracket'), icon: <Brackets size={16} /> },
    { type: 'rect', label: t('annotation.rect'), icon: <Square size={16} /> },
    { type: 'ellipse', label: t('annotation.ellipse'), icon: <Circle size={16} /> },
    { type: 'polygon', label: t('annotation.polygon'), icon: <Hexagon size={16} /> },
    { type: 'hline', label: t('annotation.hline'), icon: <AlignStartVertical size={16} /> },
    { type: 'vline', label: t('annotation.vline'), icon: <AlignEndVertical size={16} /> },
    { type: 'hband', label: t('annotation.hband'), icon: <FlipHorizontal size={16} /> },
    { type: 'vband', label: t('annotation.vband'), icon: <FlipVertical size={16} /> },
    { type: 'dataLabel', label: t('annotation.dataLabel'), icon: <Tag size={16} /> },
    { type: 'image', label: t('annotation.image'), icon: <ImageIcon size={16} /> },
  ];
}

function defaultContentFor(type: AnnotationType, t: (key: string) => string): string {
  switch (type) {
    case 'latex':
      return '$E = mc^2$';
    case 'dataLabel':
      return '{{y}}';
    case 'text':
    case 'callout':
      return t('annotation.defaultText');
    default:
      return '';
  }
}

function defaultColorForTheme(theme: 'light' | 'dark'): string {
  return theme === 'dark' ? '#f4f4f5' : '#18181b';
}

export function createDefaultAnnotation(
  type: AnnotationType,
  t: (key: string) => string,
  overrides: Partial<Annotation> = {}
): Annotation {
  const theme = useUiStore.getState().theme;
  const base: Annotation = {
    id: uid(),
    type,
    x: 50,
    y: 50,
    content: defaultContentFor(type, t),
    fontSize: 14,
    color: defaultColorForTheme(theme),
    visible: true,
    coordMode: 'percent',
    strokeWidth: 2,
    strokeDash: 'solid',
    opacity: 1,
    rotation: 0,
    fillOpacity: 0.15,
    padding: 4,
    borderRadius: 2,
    textAlign: 'center',
    textValign: 'middle',
    ...overrides,
  };

  switch (type) {
    case 'arrow':
      return { ...base, content: '', arrowTo: { x: 70, y: 30 } };
    case 'line':
      return { ...base, content: '', endPoint: { x: 70, y: 30 } };
    case 'bracket':
      return { ...base, content: '', endPoint: { x: 70, y: 50 }, bracketHeight: 12 };
    case 'rect':
      return { ...base, content: '', rectSize: { w: 20, h: 15 }, fillColor: base.color };
    case 'ellipse':
      return { ...base, content: '', ellipseRadii: { rx: 10, ry: 7 }, fillColor: base.color };
    case 'polygon':
      return {
        ...base,
        content: '',
        polygonPoints: [
          { x: 40, y: 40 },
          { x: 60, y: 40 },
          { x: 65, y: 55 },
          { x: 50, y: 65 },
          { x: 35, y: 55 },
        ],
        fillColor: base.color,
      };
    case 'callout':
      return { ...base, content: t('annotation.defaultText'), arrowTo: { x: 70, y: 30 }, backgroundColor: base.color + '20' };
    case 'hline':
      return { ...base, content: '', y: 50, referenceValue: 0 };
    case 'vline':
      return { ...base, content: '', x: 50, referenceValue: 0 };
    case 'hband':
      return { ...base, content: '', y: 50, referenceValue: [40, 60], fillColor: base.color };
    case 'vband':
      return { ...base, content: '', x: 50, referenceValue: [40, 60], fillColor: base.color };
    case 'dataLabel':
      return { ...base, content: '{{y}}', coordMode: 'data' };
    case 'image':
      return { ...base, content: '', imageSrc: '', imageSize: { w: 20, h: 20 } };
    default:
      return base;
  }
}
