import { useState, useCallback } from 'react';
import type { Annotation } from '@/types';
import { renderLatexToHTML, extractLatex, isLatexContent, renderMixedContent } from '@/utils/latex';

/** Read the current X/Y axis ranges from the rendered Plotly chart so annotations in data mode can be positioned. */
function readAxisRanges(plotDiv: HTMLElement | null): { xMin: number; xMax: number; yMin: number; yMax: number } | null {
  if (!plotDiv) return null;
  try {
    // Plotly stores layout in _fullLayout; fall back to _layout if unavailable
    const fullLayout = (plotDiv as unknown as { _fullLayout?: { xaxis?: { range?: [number, number] }; yaxis?: { range?: [number, number] } } })._fullLayout;
    const xaxis = fullLayout?.xaxis;
    const yaxis = fullLayout?.yaxis;
    if (!xaxis?.range || !yaxis?.range) return null;
    return { xMin: xaxis.range[0], xMax: xaxis.range[1], yMin: yaxis.range[0], yMax: yaxis.range[1] };
  } catch {
    return null;
  }
}

export function AnnotationOverlay({
  annotations,
  chartArea,
  plotDivRef,
  onMoveAnnotation,
  onDragEnd,
}: {
  annotations: Annotation[];
  chartArea: DOMRect | null;
  plotDivRef: React.RefObject<HTMLDivElement | null>;
  onMoveAnnotation: (id: string, x: number, y: number, extra?: Partial<Annotation>) => void;
  onDragEnd: (id: string, x: number, y: number, extra?: Partial<Annotation>) => void;
}) {
  const [dragging, setDragging] = useState<{ id: string; startMouseX: number; startMouseY: number; startX: number; startY: number } | null>(null);
  const [draggingArrow, setDraggingArrow] = useState<{ id: string; endpoint: 'start' | 'end'; startMouseX: number; startMouseY: number; startX: number; startY: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent, ann: Annotation) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging({ id: ann.id, startMouseX: e.clientX, startMouseY: e.clientY, startX: ann.x, startY: ann.y });
  }, []);

  const handleArrowEndpointDown = useCallback((e: React.MouseEvent, annId: string, endpoint: 'start' | 'end', startX: number, startY: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingArrow({ id: annId, endpoint, startMouseX: e.clientX, startMouseY: e.clientY, startX, startY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!chartArea) return;

    if (dragging) {
      const dx = ((e.clientX - dragging.startMouseX) / chartArea.width) * 100;
      const dy = ((e.clientY - dragging.startMouseY) / chartArea.height) * 100;
      const x = Math.max(0, Math.min(100, dragging.startX + dx));
      const y = Math.max(0, Math.min(100, dragging.startY + dy));
      onMoveAnnotation(dragging.id, x, y);
    } else if (draggingArrow) {
      const dx = ((e.clientX - draggingArrow.startMouseX) / chartArea.width) * 100;
      const dy = ((e.clientY - draggingArrow.startMouseY) / chartArea.height) * 100;
      const x = Math.max(0, Math.min(100, draggingArrow.startX + dx));
      const y = Math.max(0, Math.min(100, draggingArrow.startY + dy));
      if (draggingArrow.endpoint === 'start') {
        onMoveAnnotation(draggingArrow.id, x, y);
      } else {
        onMoveAnnotation(draggingArrow.id, -1, -1, { arrowTo: { x, y } });
      }
    }
  }, [dragging, draggingArrow, chartArea, onMoveAnnotation]);

  const handleMouseUp = useCallback(() => {
    // On drag end, push a single history snapshot with final position
    if (dragging) {
      // The annotation position is already updated via onMoveAnnotation (silent),
      // now we just need to push one history entry
      onDragEnd(dragging.id, -1, -1);
    } else if (draggingArrow) {
      if (draggingArrow.endpoint === 'start') {
        onDragEnd(draggingArrow.id, -1, -1);
      } else {
        onDragEnd(draggingArrow.id, -1, -1, {});
      }
    }
    setDragging(null);
    setDraggingArrow(null);
  }, [dragging, draggingArrow, onDragEnd]);

  const isDragging = dragging || draggingArrow;

  if (!chartArea || annotations.length === 0) return null;

  // For data-coord annotations, read the current axis ranges from Plotly
  const axisRanges = readAxisRanges(plotDivRef.current?.querySelector('.js-plotly-plot') as HTMLElement | null);

  /** Convert an annotation's coordinate (percent or data) to a pixel offset within the chart area */
  const toPixelX = (val: number, mode: 'percent' | 'data'): number => {
    if (mode === 'percent' || !axisRanges) return (val / 100) * chartArea.width;
    const { xMin, xMax } = axisRanges;
    const t = xMax === xMin ? 0.5 : (val - xMin) / (xMax - xMin);
    return t * chartArea.width;
  };
  const toPixelY = (val: number, mode: 'percent' | 'data'): number => {
    if (mode === 'percent' || !axisRanges) return (val / 100) * chartArea.height;
    const { yMin, yMax } = axisRanges;
    const t = yMax === yMin ? 0.5 : (val - yMin) / (yMax - yMin);
    return t * chartArea.height;
  };

  return (
    <div
      className="absolute inset-0"
      style={{ padding: '16px', cursor: isDragging ? 'grabbing' : 'default', pointerEvents: isDragging ? 'auto' : 'none' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {annotations.filter((a) => a.visible).map((ann) => {
        const px = toPixelX(ann.x, ann.coordMode);
        const py = toPixelY(ann.y, ann.coordMode);

        if (ann.type === 'arrow' && ann.arrowTo) {
          const tx = toPixelX(ann.arrowTo.x, ann.coordMode);
          const ty = toPixelY(ann.arrowTo.y, ann.coordMode);
          return (
            <svg key={ann.id} className="absolute inset-0 w-full h-full" style={{ overflow: 'visible', pointerEvents: 'none' }}>
              <defs>
                <marker id={`arrowhead-${ann.id}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill={ann.color} />
                </marker>
              </defs>
              <line x1={px} y1={py} x2={tx} y2={ty} stroke={ann.color} strokeWidth={2} markerEnd={`url(#arrowhead-${ann.id})`} style={{ pointerEvents: 'none' }} />
              <circle cx={px} cy={py} r={6} fill={ann.color} fillOpacity={0.6} stroke={ann.color} strokeWidth={1} style={{ cursor: 'grab', pointerEvents: 'auto' }} onMouseDown={(e) => handleArrowEndpointDown(e as unknown as React.MouseEvent, ann.id, 'start', ann.x, ann.y)} />
              <circle cx={tx} cy={ty} r={6} fill={ann.color} fillOpacity={0.6} stroke={ann.color} strokeWidth={1} style={{ cursor: 'grab', pointerEvents: 'auto' }} onMouseDown={(e) => handleArrowEndpointDown(e as unknown as React.MouseEvent, ann.id, 'end', ann.arrowTo!.x, ann.arrowTo!.y)} />
            </svg>
          );
        }

        if (ann.type === 'rect' && ann.rectSize) {
          // Rect size is always in percent of chart area (independent of coord mode)
          const w = (ann.rectSize.w / 100) * chartArea.width;
          const h = (ann.rectSize.h / 100) * chartArea.height;
          return (
            <div key={ann.id} className="absolute border-2 rounded-sm cursor-grab active:cursor-grabbing" style={{ left: px - w / 2, top: py - h / 2, width: w, height: h, borderColor: ann.color, backgroundColor: ann.color + '15', pointerEvents: 'auto' }} onMouseDown={(e) => handleMouseDown(e, ann)} />
          );
        }

        let html: string;
        if ((ann.type as string) === 'latex' || isLatexContent(ann.content)) {
          const { latex, displayMode } = extractLatex(ann.content);
          html = renderLatexToHTML(latex, displayMode);
        } else {
          html = renderMixedContent(ann.content);
        }

        return (
          <div key={ann.id} className="absolute cursor-grab active:cursor-grabbing select-none" style={{ left: px, top: py, transform: 'translate(-50%, -50%)', color: ann.color, fontSize: `${ann.fontSize}px`, lineHeight: 1.2, whiteSpace: 'nowrap', textShadow: '0 1px 3px rgba(0,0,0,0.8)', pointerEvents: 'auto' }} onMouseDown={(e) => handleMouseDown(e, ann)} dangerouslySetInnerHTML={{ __html: html }} />
        );
      })}
    </div>
  );
}
