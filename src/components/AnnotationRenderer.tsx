import type { Annotation } from '@/types';
import { renderLatexToHTML, extractLatex, isLatexContent } from '@/utils/latex';
import { toDisplayPercent, readAxisRanges, type AxisRanges } from '@/utils/annotationCoords';

function percent(v: number): string {
  return `${v}%`;
}

function resolveContent(ann: Annotation): string {
  if (ann.type === 'latex' || isLatexContent(ann.content)) {
    const { latex, displayMode } = extractLatex(ann.content);
    return renderLatexToHTML(latex, displayMode);
  }
  return ann.content.replace(/\{\{(x|y|z)\}\}/g, (_, key) => {
    if (key === 'x' && ann.dataAttachment?.xValue !== undefined) return String(ann.dataAttachment.xValue);
    if (key === 'y' && ann.dataAttachment?.yValue !== undefined) return String(ann.dataAttachment.yValue);
    if (key === 'z' && ann.dataAttachment?.yValue !== undefined) return String(ann.dataAttachment.yValue);
    return '';
  });
}

interface AnnotationRendererProps {
  annotation: Annotation;
  axisRanges?: AxisRanges | null;
  isSelected?: boolean;
  onMouseDown?: (e: React.MouseEvent, ann: Annotation) => void;
  onDoubleClick?: (e: React.MouseEvent, ann: Annotation) => void;
}

export function AnnotationRenderer({ annotation: ann, axisRanges, isSelected, onMouseDown, onDoubleClick }: AnnotationRendererProps) {
  if (!ann.visible) return null;

  const ranges = axisRanges ?? readAxisRanges(document.querySelector('.js-plotly-plot') as HTMLElement | null);
  const pos = toDisplayPercent(ann.x, ann.y, ann.coordMode, ranges);

  const commonStyle: React.CSSProperties = {
    position: 'absolute',
    left: percent(pos.x),
    top: percent(pos.y),
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'auto',
    userSelect: 'none',
    opacity: ann.opacity ?? 1,
  };

  const color = ann.color;
  const fillColor = ann.fillColor ?? color;
  const strokeWidth = ann.strokeWidth ?? 2;
  const strokeDash = ann.strokeDash === 'dashed' ? '6,4' : ann.strokeDash === 'dotted' ? '2,3' : undefined;

  // Reference lines/bands: span full width or height of the overlay
  if (ann.type === 'hline' || ann.type === 'vline' || ann.type === 'hband' || ann.type === 'vband') {
    const isHorizontal = ann.type === 'hline' || ann.type === 'hband';
    const isBand = ann.type === 'hband' || ann.type === 'vband';
    let start = isHorizontal ? ann.y : ann.x;
    let end = start;
    if (isBand && Array.isArray(ann.referenceValue) && ann.referenceValue.length === 2) {
      // For data mode, referenceValue holds data values; percent positions were precomputed into x/y
      // For simplicity we treat referenceValue as percent offsets relative to the anchor
      const [low, high] = ann.referenceValue;
      start = Math.min(low, high);
      end = Math.max(low, high);
    } else if (isBand) {
      const half = 5;
      start = (isHorizontal ? ann.y : ann.x) - half;
      end = (isHorizontal ? ann.y : ann.x) + half;
    }

    if (isBand) {
      return (
        <div
          className="absolute cursor-pointer hover:opacity-80"
          style={{
            ...(isHorizontal
              ? { left: 0, top: percent(start), width: '100%', height: percent(end - start) }
              : { left: percent(start), top: 0, width: percent(end - start), height: '100%' }),
            backgroundColor: fillColor,
            opacity: (ann.fillOpacity ?? 0.15) * (ann.opacity ?? 1),
            pointerEvents: 'auto',
          }}
          onMouseDown={(e) => onMouseDown?.(e, ann)}
          onDoubleClick={(e) => onDoubleClick?.(e, ann)}
          data-annotation-id={ann.id}
        />
      );
    }

    return (
      <div
        className="absolute"
        style={{
          ...(isHorizontal
            ? { left: 0, top: percent(start), width: '100%', height: 0 }
            : { left: percent(start), top: 0, width: 0, height: '100%' }),
          borderTop: isHorizontal ? `${strokeWidth}px ${ann.strokeDash === 'dashed' ? 'dashed' : ann.strokeDash === 'dotted' ? 'dotted' : 'solid'} ${color}` : undefined,
          borderLeft: !isHorizontal ? `${strokeWidth}px ${ann.strokeDash === 'dashed' ? 'dashed' : ann.strokeDash === 'dotted' ? 'dotted' : 'solid'} ${color}` : undefined,
          pointerEvents: 'auto',
          cursor: isHorizontal ? 'ns-resize' : 'ew-resize',
        }}
        onMouseDown={(e) => onMouseDown?.(e, ann)}
        onDoubleClick={(e) => onDoubleClick?.(e, ann)}
        data-annotation-id={ann.id}
      />
    );
  }

  // Arrow / Line / Bracket use a full-container SVG so coordinates align 1:1 with the selection overlay.
  if (ann.type === 'arrow' || ann.type === 'line' || ann.type === 'bracket') {
    const target = ann.type === 'arrow' ? ann.arrowTo : ann.endPoint;
    if (!target) return null;

    const targetPos = toDisplayPercent(target.x, target.y, ann.coordMode, ranges);
    const x1 = pos.x;
    const y1 = pos.y;
    const x2 = targetPos.x;
    const y2 = targetPos.y;
    const lineColor = isSelected ? 'var(--accent)' : color;

    return (
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        <defs>
          {ann.type === 'arrow' && (
            <marker id={`arrowhead-${ann.id}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill={lineColor} />
            </marker>
          )}
          {ann.type === 'bracket' && (
            <>
              <marker id={`bracket-start-${ann.id}`} markerWidth="6" markerHeight="8" refX="0" refY="4" orient="auto">
                <path d="M6 0 L0 4 L6 8" fill="none" stroke={lineColor} strokeWidth={strokeWidth} />
              </marker>
              <marker id={`bracket-end-${ann.id}`} markerWidth="6" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0 0 L6 4 L0 8" fill="none" stroke={lineColor} strokeWidth={strokeWidth} />
              </marker>
            </>
          )}
        </defs>
        {ann.type === 'bracket' ? (
          <path
            d={`M ${x1} ${y1} L ${x1} ${Math.min(y1, y2) - (ann.bracketHeight ?? 12)} L ${x2} ${Math.min(y1, y2) - (ann.bracketHeight ?? 12)} L ${x2} ${y2}`}
            fill="none"
            stroke={lineColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDash}
            markerStart={`url(#bracket-start-${ann.id})`}
            markerEnd={`url(#bracket-end-${ann.id})`}
          />
        ) : (
          <line
            x1={`${x1}%`}
            y1={`${y1}%`}
            x2={`${x2}%`}
            y2={`${y2}%`}
            stroke={lineColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDash}
            markerEnd={ann.type === 'arrow' ? `url(#arrowhead-${ann.id})` : undefined}
          />
        )}
        {/* Invisible clickable stroke for easier selection */}
        <line
          x1={`${x1}%`}
          y1={`${y1}%`}
          x2={`${x2}%`}
          y2={`${y2}%`}
          stroke="transparent"
          strokeWidth={Math.max(strokeWidth + 8, 12)}
          style={{ pointerEvents: 'auto', cursor: onMouseDown ? 'grab' : 'default' }}
          onMouseDown={(e) => onMouseDown?.(e as unknown as React.MouseEvent, ann)}
          onDoubleClick={(e) => onDoubleClick?.(e as unknown as React.MouseEvent, ann)}
          data-annotation-id={ann.id}
        />
      </svg>
    );
  }

  // Rectangle
  if (ann.type === 'rect' && ann.rectSize) {
    return (
      <div
        className="absolute cursor-grab active:cursor-grabbing"
        style={{
          ...commonStyle,
          width: percent(ann.rectSize.w),
          height: percent(ann.rectSize.h),
          border: `${strokeWidth}px ${ann.strokeDash === 'dashed' ? 'dashed' : ann.strokeDash === 'dotted' ? 'dotted' : 'solid'} ${color}`,
          backgroundColor: fillColor,
          opacity: (ann.fillOpacity ?? 0.15) * (ann.opacity ?? 1),
          borderRadius: ann.borderRadius ?? 2,
          transform: `translate(-50%, -50%) rotate(${ann.rotation ?? 0}deg)`,
        }}
        onMouseDown={(e) => onMouseDown?.(e, ann)}
        onDoubleClick={(e) => onDoubleClick?.(e, ann)}
        data-annotation-id={ann.id}
      />
    );
  }

  // Ellipse
  if (ann.type === 'ellipse' && ann.ellipseRadii) {
    return (
      <svg
        className="absolute overflow-visible cursor-grab"
        style={{
          left: percent(pos.x - ann.ellipseRadii.rx),
          top: percent(pos.y - ann.ellipseRadii.ry),
          width: percent(ann.ellipseRadii.rx * 2),
          height: percent(ann.ellipseRadii.ry * 2),
          pointerEvents: 'none',
          transform: `rotate(${ann.rotation ?? 0}deg)`,
          transformOrigin: 'center',
        }}
      >
        <ellipse
          cx="50%"
          cy="50%"
          rx="50%"
          ry="50%"
          fill={fillColor}
          fillOpacity={ann.fillOpacity ?? 0.15}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
          style={{ pointerEvents: 'auto' }}
          onMouseDown={(e) => onMouseDown?.(e as unknown as React.MouseEvent, ann)}
          onDoubleClick={(e) => onDoubleClick?.(e as unknown as React.MouseEvent, ann)}
          data-annotation-id={ann.id}
        />
      </svg>
    );
  }

  // Polygon
  if (ann.type === 'polygon' && ann.polygonPoints && ann.polygonPoints.length >= 3) {
    const displayPoints = ann.polygonPoints.map((p) => toDisplayPercent(p.x, p.y, ann.coordMode, ranges));
    const xs = displayPoints.map((p) => p.x);
    const ys = displayPoints.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const points = displayPoints
      .map((p) => {
        const px = ((p.x - minX) / Math.max(maxX - minX, 0.001)) * 100;
        const py = ((p.y - minY) / Math.max(maxY - minY, 0.001)) * 100;
        return `${px},${py}`;
      })
      .join(' ');

    return (
      <svg
        className="absolute overflow-visible"
        style={{
          left: percent(minX),
          top: percent(minY),
          width: percent(maxX - minX),
          height: percent(maxY - minY),
          pointerEvents: 'none',
        }}
      >
        <polygon
          points={points}
          fill={fillColor}
          fillOpacity={ann.fillOpacity ?? 0.15}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
          style={{ pointerEvents: 'auto', cursor: 'grab' }}
          onMouseDown={(e) => onMouseDown?.(e as unknown as React.MouseEvent, ann)}
          onDoubleClick={(e) => onDoubleClick?.(e as unknown as React.MouseEvent, ann)}
          data-annotation-id={ann.id}
        />
      </svg>
    );
  }

  // Image
  if (ann.type === 'image' && ann.imageSrc) {
    return (
      <img
        src={ann.imageSrc}
        alt=""
        className="absolute cursor-grab"
        style={{
          left: percent(pos.x),
          top: percent(pos.y),
          width: ann.imageSize ? percent(ann.imageSize.w) : '10%',
          height: ann.imageSize ? percent(ann.imageSize.h) : '10%',
          transform: `translate(-50%, -50%) rotate(${ann.rotation ?? 0}deg)`,
          opacity: ann.opacity ?? 1,
          pointerEvents: 'auto',
        }}
        onMouseDown={(e) => onMouseDown?.(e, ann)}
        onDoubleClick={(e) => onDoubleClick?.(e, ann)}
        data-annotation-id={ann.id}
      />
    );
  }

  // Text / LaTeX / DataLabel / Callout body
  const html = resolveContent(ann);
  const padding = ann.padding ?? 4;
  const isCallout = ann.type === 'callout';
  const calloutTarget = isCallout ? ann.arrowTo : null;

  const textEl = (
    <div
      className="absolute cursor-grab active:cursor-grabbing select-none"
      style={{
        ...commonStyle,
        color,
        fontSize: `${ann.fontSize}px`,
        fontFamily: ann.fontFamily,
        fontWeight: ann.fontWeight,
        fontStyle: ann.fontStyle,
        textDecoration: ann.textDecoration,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        textAlign: ann.textAlign,
        backgroundColor: ann.backgroundColor,
        padding,
        borderRadius: ann.borderRadius,
        transform: `translate(-50%, -50%) rotate(${ann.rotation ?? 0}deg)`,
      }}
      onMouseDown={(e) => onMouseDown?.(e, ann)}
      onDoubleClick={(e) => onDoubleClick?.(e, ann)}
      data-annotation-id={ann.id}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );

  if (!calloutTarget) return textEl;
  const calloutLineColor = isSelected ? 'var(--accent)' : color;
  const calloutTargetPos = toDisplayPercent(calloutTarget.x, calloutTarget.y, ann.coordMode, ranges);

  return (
    <>
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        <defs>
          <marker id={`callout-arrowhead-${ann.id}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={calloutLineColor} />
          </marker>
        </defs>
        <line
          x1={`${pos.x}%`}
          y1={`${pos.y}%`}
          x2={`${calloutTargetPos.x}%`}
          y2={`${calloutTargetPos.y}%`}
          stroke={calloutLineColor}
          strokeWidth={strokeWidth}
          markerEnd={`url(#callout-arrowhead-${ann.id})`}
        />
      </svg>
      {textEl}
    </>
  );
}
