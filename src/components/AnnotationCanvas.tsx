import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Annotation, AnnotationType } from '@/types';
import { useAnnotationToolStore, useChartInteractionStore } from '@/store/plotStore';
import { createDefaultAnnotation } from '@/utils/annotations';
import { AnnotationRenderer } from './AnnotationRenderer';
import { AnnotationToolbar } from './AnnotationToolbar';
import {
  readAxisRanges,
  clientToPercent,
  toStoredCoords,
  toDisplayPercent,
  clampPercent,
  rotatePointIsometric,
  type AxisRanges,
} from '@/utils/annotationCoords';

interface Point { x: number; y: number }

type DrawingState =
  | { tool: 'rect' | 'ellipse' | 'arrow' | 'callout' | 'line' | 'bracket' | 'hband' | 'vband'; start: Point; current: Point }
  | { tool: 'polygon'; points: Point[] }
  | null;

type DragMode =
  | { kind: 'move'; id: string; startMouse: Point; start: Point; initial: Annotation }
  | { kind: 'resize'; id: string; handle: string; startMouse: Point; initial: Annotation }
  | { kind: 'rotate'; id: string; initialRotation: number; centerPx: { x: number; y: number }; startAngle: number }
  | { kind: 'endpoint'; id: string; field: 'arrowTo' | 'endPoint'; startMouse: Point; start: Point; initial: Annotation }
  | { kind: 'anchor'; id: string; startMouse: Point; start: Point; initial: Annotation }
  | null;

export function AnnotationCanvas({
  annotations,
  plotDivRef,
  onAdd,
  onUpdateSilent,
  onFinish,
  onRemove,
  onDuplicate,
  onBringToFront,
  onSendToBack,
  t,
}: {
  annotations: Annotation[];
  plotDivRef: React.RefObject<HTMLDivElement | null>;
  onAdd: (ann: Annotation) => void;
  onUpdateSilent: (id: string, data: Partial<Annotation>) => void;
  onFinish: (id: string, data?: Partial<Annotation>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  t: (key: string) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeTool = useAnnotationToolStore((s) => s.activeTool);
  const selectedId = useAnnotationToolStore((s) => s.selectedId);
  const setSelectedId = useAnnotationToolStore((s) => s.setSelectedId);
  const setActiveTool = useAnnotationToolStore((s) => s.setActiveTool);
  const setEditingId = useAnnotationToolStore((s) => s.setEditingId);

  const [drawing, setDrawing] = useState<DrawingState>(null);
  const [drag, setDrag] = useState<DragMode>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setContainerSize({ w: rect.width, h: rect.height });
    };
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (ro) ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const zoom = useChartInteractionStore((s) => s.zoom);
  // Re-read axis ranges whenever the zoom state changes so data-coordinate annotations track pan/zoom.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const axisRanges = useMemo(() => readAxisRanges(plotDivRef.current?.querySelector('.js-plotly-plot') as HTMLElement | null), [plotDivRef, zoom]);

  const editingId = useAnnotationToolStore((s) => s.editingId);

  const selectedAnnotation = useMemo(
    () => annotations.find((a) => a.id === selectedId) ?? null,
    [annotations, selectedId]
  );

  const editingAnnotation = useMemo(
    () => annotations.find((a) => a.id === editingId) ?? null,
    [annotations, editingId]
  );

  const getRect = useCallback((): DOMRect | null => {
    return containerRef.current?.getBoundingClientRect() ?? null;
  }, []);

  const toStored = useCallback(
    (x: number, y: number, coordMode: 'percent' | 'data') => {
      const ranges = axisRanges ?? readAxisRanges(plotDivRef.current?.querySelector('.js-plotly-plot') as HTMLElement | null);
      return toStoredCoords(x, y, coordMode, ranges);
    },
    [axisRanges, plotDivRef]
  );

  const toDisplay = useCallback(
    (x: number, y: number, coordMode: 'percent' | 'data') => {
      const ranges = axisRanges ?? readAxisRanges(plotDivRef.current?.querySelector('.js-plotly-plot') as HTMLElement | null);
      return toDisplayPercent(x, y, coordMode, ranges);
    },
    [axisRanges, plotDivRef]
  );

  const finishDrawing = useCallback(
    (final: DrawingState) => {
      if (!final) return;
      if (final.tool === 'polygon') {
        if (final.points.length < 3) {
          setDrawing(null);
          return;
        }
        const ann = createDefaultAnnotation('polygon', t);
        ann.polygonPoints = final.points.map((p) => toStored(p.x, p.y, ann.coordMode));
        onAdd(ann);
        setDrawing(null);
        setActiveTool('select');
        setSelectedId(ann.id);
        return;
      }

      const tool = final.tool;
      const start = final.start;
      const current = final.current;
      if (Math.abs(current.x - start.x) < 0.5 && Math.abs(current.y - start.y) < 0.5) {
        setDrawing(null);
        return;
      }

      const minX = Math.min(start.x, current.x);
      const minY = Math.min(start.y, current.y);
      const maxX = Math.max(start.x, current.x);
      const maxY = Math.max(start.y, current.y);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      const ann = createDefaultAnnotation(tool as AnnotationType, t);

      if (tool === 'rect' || tool === 'hband' || tool === 'vband') {
        ann.x = toStored(cx, cy, ann.coordMode).x;
        ann.y = toStored(cx, cy, ann.coordMode).y;
        ann.rectSize = { w: maxX - minX, h: maxY - minY };
        if (tool === 'hband' || tool === 'vband') {
          ann.referenceValue = tool === 'hband' ? [minY, maxY] : [minX, maxX];
        }
      } else if (tool === 'ellipse') {
        ann.x = toStored(cx, cy, ann.coordMode).x;
        ann.y = toStored(cx, cy, ann.coordMode).y;
        ann.ellipseRadii = { rx: (maxX - minX) / 2, ry: (maxY - minY) / 2 };
      } else if (tool === 'arrow') {
        const storedStart = toStored(start.x, start.y, ann.coordMode);
        ann.x = storedStart.x;
        ann.y = storedStart.y;
        ann.arrowTo = toStored(current.x, current.y, ann.coordMode);
      } else if (tool === 'callout') {
        const storedStart = toStored(start.x, start.y, ann.coordMode);
        const storedCurrent = toStored(current.x, current.y, ann.coordMode);
        ann.x = storedCurrent.x;
        ann.y = storedCurrent.y;
        ann.arrowTo = storedStart;
      } else if (tool === 'line' || tool === 'bracket') {
        const storedStart = toStored(start.x, start.y, ann.coordMode);
        ann.x = storedStart.x;
        ann.y = storedStart.y;
        ann.endPoint = toStored(current.x, current.y, ann.coordMode);
        if (tool === 'bracket') {
          const bh = ann.bracketHeight ?? 12;
          const beamX = (start.x + current.x) / 2;
          const beamY = Math.min(start.y, current.y) - bh;
          const storedBeam = toStored(beamX, beamY, ann.coordMode);
          ann.bracketTopX = storedBeam.x;
          ann.bracketTopY = storedBeam.y;
        }
      }

      onAdd(ann);
      setDrawing(null);
      setActiveTool('select');
      setSelectedId(ann.id);
    },
    [onAdd, setActiveTool, setSelectedId, t, toStored]
  );

  const handleContainerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const rect = getRect();
      if (!rect) return;
      const { x, y } = clientToPercent(e.clientX, e.clientY, rect);

      if (activeTool === 'select') {
        // Deselect if clicking empty area
        const target = e.target as HTMLElement;
        if (!target.closest('[data-annotation-id]')) {
          setSelectedId(null);
        }
        return;
      }

      if (activeTool === 'text') {
        const ann = createDefaultAnnotation(activeTool, t);
        const stored = toStored(x, y, ann.coordMode);
        ann.x = stored.x;
        ann.y = stored.y;
        onAdd(ann);
        setActiveTool('select');
        setSelectedId(ann.id);
        setEditingId(ann.id);
        return;
      }

      if (activeTool === 'hline' || activeTool === 'vline') {
        const ann = createDefaultAnnotation(activeTool, t);
        const stored = toStored(x, y, ann.coordMode);
        ann.x = stored.x;
        ann.y = stored.y;
        ann.referenceValue = activeTool === 'hline' ? stored.y : stored.x;
        onAdd(ann);
        setActiveTool('select');
        setSelectedId(ann.id);
        return;
      }

      if (activeTool === 'dataLabel') {
        const ann = createDefaultAnnotation('dataLabel', t);
        const stored = toStored(x, y, 'data');
        ann.x = stored.x;
        ann.y = stored.y;
        ann.dataAttachment = { xValue: stored.x, yValue: stored.y };
        onAdd(ann);
        setActiveTool('select');
        setSelectedId(ann.id);
        return;
      }

      if (activeTool === 'image') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const ann = createDefaultAnnotation('image', t);
            const stored = toStored(x, y, ann.coordMode);
            ann.x = stored.x;
            ann.y = stored.y;
            ann.imageSrc = reader.result as string;
            onAdd(ann);
            setActiveTool('select');
            setSelectedId(ann.id);
          };
          reader.readAsDataURL(file);
        };
        input.click();
        return;
      }

      if (activeTool === 'polygon') {
        setDrawing((prev) => {
          if (!prev || prev.tool !== 'polygon') return { tool: 'polygon', points: [{ x, y }] };
          return { ...prev, points: [...prev.points, { x, y }] };
        });
        return;
      }

      if (
        activeTool === 'rect' ||
        activeTool === 'ellipse' ||
        activeTool === 'arrow' ||
        activeTool === 'callout' ||
        activeTool === 'line' ||
        activeTool === 'bracket' ||
        activeTool === 'hband' ||
        activeTool === 'vband'
      ) {
        setDrawing({ tool: activeTool, start: { x, y }, current: { x, y } });
      }
    },
    [activeTool, getRect, onAdd, setActiveTool, setEditingId, setSelectedId, t, toStored]
  );

  const handleContainerMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = getRect();
      if (!rect) return;
      const { x, y } = clientToPercent(e.clientX, e.clientY, rect);

      if (drawing && drawing.tool !== 'polygon') {
        setDrawing({ ...drawing, current: { x, y } });
        return;
      }

      if (drag) {
        if (drag.kind === 'move' && selectedAnnotation) {
          const dx = x - drag.startMouse.x;
          const dy = y - drag.startMouse.y;
          const nextX = clampPercent(drag.start.x + dx);
          const nextY = clampPercent(drag.start.y + dy);
          const storedStart = toStored(drag.start.x, drag.start.y, drag.initial.coordMode);
          const storedNext = toStored(nextX, nextY, drag.initial.coordMode);
          const dataDx = storedNext.x - storedStart.x;
          const dataDy = storedNext.y - storedStart.y;
          const update: Partial<Annotation> = { x: drag.initial.x + dataDx, y: drag.initial.y + dataDy };
          // For connectors, translate the endpoint so the whole arrow moves without rotating/resizing.
          if (drag.initial.type === 'arrow' || drag.initial.type === 'callout') {
            if (drag.initial.arrowTo) {
              update.arrowTo = {
                x: drag.initial.arrowTo.x + dataDx,
                y: drag.initial.arrowTo.y + dataDy,
              };
            }
          } else if (drag.initial.type === 'line' || drag.initial.type === 'bracket') {
            if (drag.initial.endPoint) {
              update.endPoint = {
                x: drag.initial.endPoint.x + dataDx,
                y: drag.initial.endPoint.y + dataDy,
              };
            }
          }
          onUpdateSilent(drag.id, update);
        } else if (drag.kind === 'endpoint' && selectedAnnotation) {
          const stored = toStored(x, y, drag.initial.coordMode);
          onUpdateSilent(drag.id, { [drag.field]: { x: stored.x, y: stored.y } });
        } else if (drag.kind === 'anchor' && selectedAnnotation) {
          const dx = x - drag.startMouse.x;
          const dy = y - drag.startMouse.y;
          const nextX = clampPercent(drag.start.x + dx);
          const nextY = clampPercent(drag.start.y + dy);
          const stored = toStored(nextX, nextY, drag.initial.coordMode);
          onUpdateSilent(drag.id, { x: stored.x, y: stored.y });
        } else if (drag.kind === 'rotate' && selectedAnnotation) {
          const currentAngle = Math.atan2(e.clientY - drag.centerPx.y, e.clientX - drag.centerPx.x) * 180 / Math.PI;
          let newRotation = drag.initialRotation + (currentAngle - drag.startAngle);
          while (newRotation > 180) newRotation -= 360;
          while (newRotation < -180) newRotation += 360;
          onUpdateSilent(drag.id, { rotation: newRotation });
        }
      }
    },
    [drawing, drag, getRect, onUpdateSilent, selectedAnnotation, toStored]
  );

  const handleContainerMouseUp = useCallback(() => {
    if (drawing) {
      finishDrawing(drawing);
    }
    if (drag) {
      onFinish(drag.id);
      setDrag(null);
    }
  }, [drawing, drag, finishDrawing, onFinish]);

  const handleAnnotationMouseDown = useCallback(
    (e: React.MouseEvent, ann: Annotation) => {
      if (e.button !== 0) return;
      if (activeTool !== 'select') return;
      e.stopPropagation();
      setSelectedId(ann.id);
      if (ann.locked) return;
      const rect = getRect();
      if (!rect) return;
      const { x, y } = clientToPercent(e.clientX, e.clientY, rect);
      const disp = toDisplay(ann.x, ann.y, ann.coordMode);
      setDrag({ kind: 'move', id: ann.id, startMouse: { x, y }, start: disp, initial: ann });
    },
    [activeTool, getRect, setSelectedId, toDisplay]
  );

  const handleAnnotationDoubleClick = useCallback(
    (_e: React.MouseEvent, ann: Annotation) => {
      if (ann.type === 'text' || ann.type === 'callout' || ann.type === 'dataLabel' || (ann.type as string) === 'latex') {
        setEditingId(ann.id);
      }
    },
    [setEditingId]
  );

  // Keyboard: Esc cancels drawing/deselects; Delete removes selected
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (drawing?.tool === 'polygon') {
          finishDrawing(drawing);
        } else if (drawing) {
          setDrawing(null);
        } else {
          setSelectedId(null);
          setActiveTool('select');
        }
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !drawing && !editingId) {
        onRemove(selectedId);
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [drawing, editingId, finishDrawing, onRemove, selectedId, setActiveTool, setSelectedId]);

  // Clicking on empty chart area deselects the current annotation.
  useEffect(() => {
    const chartArea = plotDivRef.current;
    if (!chartArea) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (activeTool !== 'select') return;
      if (e.button !== 0) return;
      if (editingId) return;
      if ((e.target as HTMLElement).closest('.annotation-canvas')) return;
      setSelectedId(null);
    };

    chartArea.addEventListener('mousedown', handleMouseDown);
    return () => chartArea.removeEventListener('mousedown', handleMouseDown);
  }, [activeTool, editingId, plotDivRef, setSelectedId]);

  const cursor = useMemo(() => {
    if (drag) return 'grabbing';
    if (activeTool === 'select') return 'default';
    if (activeTool === 'text' || activeTool === 'callout' || activeTool === 'dataLabel' || activeTool === 'hline' || activeTool === 'vline' || activeTool === 'image') return 'crosshair';
    return 'crosshair';
  }, [activeTool, drag]);

  // Container captures events only while drawing, dragging, or inline-editing; otherwise Plotly keeps zoom/pan/hover.
  const containerPointerEvents = activeTool === 'select' && !drag && !editingAnnotation ? 'none' : 'auto';

  // Drawing preview
  const previewAnnotation = useMemo<Annotation | null>(() => {
    if (!drawing || drawing.tool === 'polygon') return null;
    const { start, current } = drawing;
    const minX = Math.min(start.x, current.x);
    const minY = Math.min(start.y, current.y);
    const maxX = Math.max(start.x, current.x);
    const maxY = Math.max(start.y, current.y);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const ann = createDefaultAnnotation(drawing.tool as AnnotationType, t);
    ann.coordMode = 'percent';
    ann.opacity = 0.6;
    if (drawing.tool === 'rect' || drawing.tool === 'hband' || drawing.tool === 'vband') {
      ann.x = cx;
      ann.y = cy;
      ann.rectSize = { w: maxX - minX, h: maxY - minY };
      if (drawing.tool === 'hband' || drawing.tool === 'vband') {
        ann.referenceValue = drawing.tool === 'hband' ? [minY, maxY] : [minX, maxX];
      }
    } else if (drawing.tool === 'ellipse') {
      ann.x = cx;
      ann.y = cy;
      ann.ellipseRadii = { rx: (maxX - minX) / 2, ry: (maxY - minY) / 2 };
    } else if (drawing.tool === 'arrow') {
      ann.x = start.x;
      ann.y = start.y;
      ann.arrowTo = current;
    } else if (drawing.tool === 'callout') {
      ann.x = current.x;
      ann.y = current.y;
      ann.arrowTo = start;
    } else if (drawing.tool === 'line' || drawing.tool === 'bracket') {
      ann.x = start.x;
      ann.y = start.y;
      ann.endPoint = current;
    }
    return ann;
  }, [drawing, t]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 annotation-canvas"
      style={{ cursor, pointerEvents: containerPointerEvents }}
      onMouseDown={handleContainerMouseDown}
      onMouseMove={handleContainerMouseMove}
      onMouseUp={handleContainerMouseUp}
      onMouseLeave={handleContainerMouseUp}
    >
      {annotations.map((ann) => (
        <AnnotationRenderer
          key={ann.id}
          annotation={ann}
          axisRanges={axisRanges}
          containerAspectRatio={containerSize.w / containerSize.h}
          isSelected={ann.id === selectedId}
          onMouseDown={handleAnnotationMouseDown}
          onDoubleClick={handleAnnotationDoubleClick}
        />
      ))}
      {previewAnnotation && (
        <AnnotationRenderer annotation={previewAnnotation} axisRanges={axisRanges} containerAspectRatio={containerSize.w / containerSize.h} isSelected={false} />
      )}
      {drawing?.tool === 'polygon' && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {drawing.points.map((p, i) => (
            <circle key={i} cx={`${p.x}%`} cy={`${p.y}%`} r={3} fill="var(--accent)" />
          ))}
          {drawing.points.length > 1 && (
            <polyline
              points={drawing.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1}
              strokeDasharray="4 2"
            />
          )}
        </svg>
      )}
      {selectedAnnotation && activeTool === 'select' && !editingAnnotation && (
        <SelectionOverlay
          annotation={selectedAnnotation}
          axisRanges={axisRanges}
          containerAspectRatio={containerSize.w / containerSize.h}
          onEndpointDown={(field, start) => {
            setDrag({ kind: 'endpoint', id: selectedAnnotation.id, field, startMouse: start, start, initial: selectedAnnotation });
          }}
          onAnchorDown={(start) => {
            setDrag({ kind: 'anchor', id: selectedAnnotation.id, startMouse: start, start, initial: selectedAnnotation });
          }}
          onRotateDown={(centerPx, startAngle) => {
            setDrag({ kind: 'rotate', id: selectedAnnotation.id, initialRotation: selectedAnnotation.rotation ?? 0, centerPx, startAngle });
          }}
        />
      )}
      {selectedAnnotation && activeTool === 'select' && !editingAnnotation && !drag && (
        <AnnotationToolbar
          annotation={selectedAnnotation}
          axisRanges={axisRanges}
          onUpdate={(data) => onFinish(selectedAnnotation.id, data)}
          onRemove={() => {
            onRemove(selectedAnnotation.id);
            setSelectedId(null);
          }}
          onDuplicate={() => onDuplicate(selectedAnnotation.id)}
          onBringToFront={() => onBringToFront(selectedAnnotation.id)}
          onSendToBack={() => onSendToBack(selectedAnnotation.id)}
          t={t}
        />
      )}
      {editingAnnotation && (
        <InlineTextEditor
          annotation={editingAnnotation}
          axisRanges={axisRanges}
          onCommit={(content) => {
            onFinish(editingAnnotation.id, { content });
            setEditingId(null);
          }}
          onCancel={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function SelectionOverlay({
  annotation,
  axisRanges,
  containerAspectRatio = 1,
  onEndpointDown,
  onAnchorDown,
  onRotateDown,
}: {
  annotation: Annotation;
  axisRanges: AxisRanges | null;
  containerAspectRatio?: number;
  onEndpointDown: (field: 'arrowTo' | 'endPoint', start: Point) => void;
  onAnchorDown: (start: Point) => void;
  onRotateDown?: (centerPx: { x: number; y: number }, startAngle: number) => void;
}) {
  const disp = toDisplayPercent(annotation.x, annotation.y, annotation.coordMode, axisRanges);
  const endpoint = annotation.type === 'arrow' || annotation.type === 'callout'
    ? annotation.arrowTo
    : (annotation.type === 'line' || annotation.type === 'bracket' ? annotation.endPoint : null);
  const dispEndpoint = endpoint
    ? toDisplayPercent(endpoint.x, endpoint.y, annotation.coordMode, axisRanges)
    : null;

  const handleEndpointMouseDown = (e: React.MouseEvent, field: 'arrowTo' | 'endPoint') => {
    e.stopPropagation();
    e.preventDefault();
    const target = e.currentTarget.parentElement?.parentElement as HTMLElement | null;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    onEndpointDown(field, clientToPercent(e.clientX, e.clientY, rect));
  };

  const handleAnchorMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const target = e.currentTarget.parentElement?.parentElement as HTMLElement | null;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    onAnchorDown(clientToPercent(e.clientX, e.clientY, rect));
  };

  const handleRotateMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!onRotateDown || !dispEndpoint) return;
    const target = e.currentTarget.parentElement?.parentElement as HTMLElement | null;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const bh = annotation.bracketHeight ?? 12;
    const t1x = disp.x;
    const t1y = disp.y - bh;
    const t2x = dispEndpoint.x;
    const t2y = dispEndpoint.y - bh;
    const midX = (t1x + t2x) / 2;
    const midY = (t1y + t2y) / 2;
    const centerPx = { x: rect.left + (rect.width * midX) / 100, y: rect.top + (rect.height * midY) / 100 };
    const startAngle = Math.atan2(e.clientY - centerPx.y, e.clientX - centerPx.x) * 180 / Math.PI;
    onRotateDown(centerPx, startAngle);
  };

  const isConnector = annotation.type === 'arrow' || annotation.type === 'line' || annotation.type === 'bracket' || annotation.type === 'callout';

  // For bracket: rotate handle positions to match the rendered bracket, compensating for aspect ratio
  let handleEndpointPos = dispEndpoint;
  let handleAnchorPos = disp;
  if (annotation.type === 'bracket' && dispEndpoint) {
    const bh = annotation.bracketHeight ?? 12;
    const t1x = disp.x;
    const t1y = disp.y - bh;
    const t2x = dispEndpoint.x;
    const t2y = dispEndpoint.y - bh;
    const midX = (t1x + t2x) / 2;
    const midY = (t1y + t2y) / 2;
    const rot = annotation.rotation ?? 0;
    handleEndpointPos = rotatePointIsometric(dispEndpoint.x, dispEndpoint.y, midX, midY, rot, containerAspectRatio);
    handleAnchorPos = rotatePointIsometric(disp.x, disp.y, midX, midY, rot, containerAspectRatio);
  }

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
      {isConnector && handleEndpointPos && (
        <>
          {/* Endpoint handle */}
          <g
            style={{ cursor: 'grab', pointerEvents: 'auto' }}
            onMouseDown={(e) => handleEndpointMouseDown(e, annotation.type === 'arrow' || annotation.type === 'callout' ? 'arrowTo' : 'endPoint')}
          >
            <circle
              cx={`${handleEndpointPos.x}%`}
              cy={`${handleEndpointPos.y}%`}
              r={6}
              fill="var(--accent)"
              stroke="#fff"
              strokeWidth={2}
            />
          </g>
        </>
      )}
      {/* Anchor handle for all annotations */}
      <g
        style={{ cursor: 'grab', pointerEvents: 'auto' }}
        onMouseDown={handleAnchorMouseDown}
      >
        <circle
          cx={`${handleAnchorPos.x}%`}
          cy={`${handleAnchorPos.y}%`}
          r={5}
          fill="var(--accent)"
          stroke="#fff"
          strokeWidth={2}
        />
      </g>
      {/* Rotation handle for bracket */}
      {annotation.type === 'bracket' && dispEndpoint && onRotateDown && (
        <g
          style={{ cursor: 'grab', pointerEvents: 'auto' }}
          onMouseDown={handleRotateMouseDown}
        >
          <circle
            cx={`${(() => {
              const bh = annotation.bracketHeight ?? 12;
              const t1x = disp.x;
              const t1y = disp.y - bh;
              const t2x = dispEndpoint.x;
              const t2y = dispEndpoint.y - bh;
              const midX = (t1x + t2x) / 2;
              const midY = (t1y + t2y) / 2;
              const r = rotatePointIsometric(midX, midY - 12, midX, midY, annotation.rotation ?? 0, containerAspectRatio);
              return `${r.x}%`;
            })()}`}
            cy={`${(() => {
              const bh = annotation.bracketHeight ?? 12;
              const t1x = disp.x;
              const t1y = disp.y - bh;
              const t2x = dispEndpoint.x;
              const t2y = dispEndpoint.y - bh;
              const midX = (t1x + t2x) / 2;
              const midY = (t1y + t2y) / 2;
              const r = rotatePointIsometric(midX, midY - 12, midX, midY, annotation.rotation ?? 0, containerAspectRatio);
              return `${r.y}%`;
            })()}`}
            r={5}
            fill="#f59e0b"
            stroke="#fff"
            strokeWidth={2}
          />
        </g>
      )}
      {annotation.type === 'rect' && annotation.rectSize && (
        <rect
          x={`${disp.x - annotation.rectSize.w / 2}%`}
          y={`${disp.y - annotation.rectSize.h / 2}%`}
          width={`${annotation.rectSize.w}%`}
          height={`${annotation.rectSize.h}%`}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1}
          strokeDasharray="3 2"
          pointerEvents="none"
        />
      )}
      {annotation.type === 'ellipse' && annotation.ellipseRadii && (
        <ellipse
          cx={`${disp.x}%`}
          cy={`${disp.y}%`}
          rx={`${annotation.ellipseRadii.rx}%`}
          ry={`${annotation.ellipseRadii.ry}%`}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1}
          strokeDasharray="3 2"
          pointerEvents="none"
        />
      )}
      {annotation.type === 'image' && annotation.imageSize && (
        <rect
          x={`${disp.x - annotation.imageSize.w / 2}%`}
          y={`${disp.y - annotation.imageSize.h / 2}%`}
          width={`${annotation.imageSize.w}%`}
          height={`${annotation.imageSize.h}%`}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1}
          strokeDasharray="3 2"
          pointerEvents="none"
        />
      )}
    </svg>
  );
}

function InlineTextEditor({
  annotation,
  axisRanges,
  onCommit,
  onCancel,
}: {
  annotation: Annotation;
  axisRanges: AxisRanges | null;
  onCommit: (content: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(annotation.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const disp = toDisplayPercent(annotation.x, annotation.y, annotation.coordMode, axisRanges);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  return (
    <textarea
      ref={textareaRef}
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onCommit(value.trim());
        }
        if (e.key === 'Escape') {
          onCancel();
        }
      }}
      className="absolute z-10 text-xs outline-none resize-none border-2 rounded px-1 py-0.5 shadow-lg"
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        left: `${disp.x}%`,
        top: `${disp.y}%`,
        transform: 'translate(-50%, -50%)',
        minWidth: 80,
        minHeight: 20,
        color: annotation.color,
        fontSize: `${annotation.fontSize}px`,
        fontFamily: annotation.fontFamily,
        fontWeight: annotation.fontWeight,
        background: 'var(--bg-input)',
        borderColor: 'var(--accent)',
        pointerEvents: 'auto',
      }}
    />
  );
}
