import { uid } from '@/utils/sampleData';
import type { AnnotationType, Annotation } from '@/types';
import { Type, ArrowUpRight, Square, Sigma } from 'lucide-react';

export function getAnnotationTypes(t: (key: string) => string): { type: AnnotationType; label: string; icon: React.ReactNode }[] {
  return [
    { type: 'text', label: t('annotation.text'), icon: <Type size={16} /> },
    { type: 'latex', label: t('annotation.latex'), icon: <Sigma size={16} /> },
    { type: 'arrow', label: t('annotation.arrow'), icon: <ArrowUpRight size={16} /> },
    { type: 'rect', label: t('annotation.rect'), icon: <Square size={16} /> },
  ];
}

export function createDefaultAnnotation(type: AnnotationType, t: (key: string) => string): Annotation {
  const base: Annotation = {
    id: uid(),
    type,
    x: 50,
    y: 50,
    content: type === 'latex' ? '$E = mc^2$' : type === 'text' ? t('annotation.defaultText') : '',
    fontSize: 14,
    color: '#e4e4e7',
    visible: true,
    coordMode: 'percent',
  };
  if (type === 'arrow') return { ...base, content: '', arrowTo: { x: 70, y: 30 } };
  if (type === 'rect') return { ...base, content: '', rectSize: { w: 20, h: 15 } };
  return base;
}
